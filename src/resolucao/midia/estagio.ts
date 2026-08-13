/**
 * src/resolucao/midia/estagio.ts
 *
 * ESTAGIO DE RESOLUCAO: midia externa. Card F2-04.
 *
 * O que ele faz, em uma linha: para cada no `midia` do manifesto, busca
 * um arquivo num provedor elegivel, BAIXA os bytes, e devolve o SHA-256
 * deles — nunca um endereço.
 *
 * A DECISAO QUE VEIO ANTES DESTE ARQUIVO
 * ─────────────────────────────────────────────────────────────────────
 * Um provedor (Unsplash, GIPHY) EXIGE hotlink; outro (Pixabay) o PROIBE
 * e manda baixar. Os dois nao podem valer juntos. A decisao esta em
 * `docs/adr/0008-hotlink-e-midia-externa.md` e em `politicas.ts`, e ela
 * e anterior a este downloader por construcao: provedor que exige
 * hotlink nao tem adaptador, entao nao ha caminho de codigo daqui ate
 * ele. Ver `adaptadores.ts`.
 *
 * O ENQUADRAMENTO DE USO E DEPENDENCIA DECLARADA, e ele NAO decide isto.
 * `docs/adr/0003-enquadramento-de-uso.md` fixou uso PESSOAL, o que muda
 * o que a LICENCA DE CONTEUDO permite (D3: a clausula comercial da GIPHY
 * deixa de vedar). A obrigacao de hotlink, porem, esta no CONTRATO DE
 * API, que vale para qualquer uso. Uso pessoal nao isenta — e por isso a
 * exclusao aqui e arquitetural, nao juridica.
 *
 * O QUE ATRAVESSA A FRONTEIRA
 * ─────────────────────────────────────────────────────────────────────
 * Somente hash, metadado e licenca. A URL de origem fica na
 * `procedencia`, que vive acima da fronteira e nunca e caminho de
 * leitura (C7). `encontrarURLs(parcial)` tem de sair vazio, e o teste
 * exige isso.
 */

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  EntradaEstagio,
  EstagioResolucao,
  SaidaEstagio,
} from "../contrato.js";
import type { AssetResolvido, TipoAsset } from "../manifesto-resolvido.js";
import type {
  ProcedenciaAsset,
  ProcedenciaCassete,
} from "../cassete/formato.js";
import type { NoMidia, TipoMidia } from "../../contratos/manifesto.js";
import { isNoMidia } from "../../contratos/manifesto.js";
import { selecionarAdaptador } from "./adaptadores.js";
import { VERSAO_API_COMMONS } from "./commons.js";
import type { CandidatoMidia } from "./politicas.js";

// ─── Constantes ─────────────────────────────────────────────────────────────────

/**
 * `licenca` da procedencia quando nenhum asset foi adquirido.
 *
 * O campo e obrigatorio e nao-vazio (∅-crit da W4) mesmo num manifesto
 * sem no de midia. Um valor explicito e greppavel e melhor que uma
 * licenca plausivel inventada: ninguem confunde isto com uma licenca.
 */
export const LICENCA_SEM_ASSET = "nenhum-asset-adquirido";

/** `tipo_midia` do manifesto -> `tipo` do asset resolvido. */
const TIPO_DE_ASSET: Readonly<Record<TipoMidia, TipoAsset>> = {
  imagem: "imagem",
  gif: "gif",
  video: "video",
};

/** User-Agent do download. Mesma etiqueta da busca. */
const AGENTE = "editor-video-ia/0.1 (resolucao de midia; card F2-04)";

// ─── Erros ──────────────────────────────────────────────────────────────────────

/**
 * O manifesto tem no de midia que este estagio nao consegue resolver.
 *
 * Lancado ANTES de qualquer chamada de rede, com TODOS os problemas de
 * uma vez. Um problema por execucao faria o operador descobrir o segundo
 * so depois de pagar pela primeira chamada.
 *
 * Nao existe "pular o no que nao da": um manifesto resolvido pela metade
 * parece completo, e a composicao renderiza um buraco sem reclamar.
 */
export class EMidiaNaoResolvivel extends Error {
  readonly code = "MIDIA_NAO_RESOLVIVEL";
  readonly problemas: readonly string[];

  constructor(problemas: readonly string[]) {
    super(
      `Nos de midia que este estagio nao consegue resolver:\n` +
        problemas.map((p) => `  - ${p}`).join("\n") +
        `\n  Nenhuma chamada de rede foi feita: a validacao vem antes do download.`,
    );
    this.name = "EMidiaNaoResolvivel";
    this.problemas = problemas;
  }
}

/** O download do arquivo escolhido falhou. */
export class EDownloadFalhou extends Error {
  readonly code = "DOWNLOAD_FALHOU";

  constructor(titulo: string, status: number) {
    super(
      `Download de "${titulo}" respondeu HTTP ${status}.\n` +
        `  O estagio nao continua com um asset vazio: um arquivo de 0 byte tem\n` +
        `  SHA-256 valido e passaria por todas as checagens abaixo da fronteira.`,
    );
    this.name = "EDownloadFalhou";
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** SHA-256 hexadecimal dos bytes baixados. */
function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Nos de midia do manifesto, em ordem lexicografica de id (Regra 1). */
export function nosDeMidia(nos: readonly unknown[]): NoMidia[] {
  return (nos as Parameters<typeof isNoMidia>[0][])
    .filter(isNoMidia)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Termo de busca de um no.
 *
 * E o `texto_alternativo`, e so ele. Nao ha fallback: um no sem
 * descricao nao tem como virar uma busca, e inventar um termo a partir
 * do `tipo_midia` produziria "a primeira imagem que o Commons devolve
 * para a palavra imagem" — resultado plausivel, arbitrario, e impossivel
 * de defender depois. Ver EMidiaNaoResolvivel.
 */
export function termoDeBuscaDoNo(no: NoMidia): string | undefined {
  const texto = no.texto_alternativo?.trim();
  return texto === undefined || texto === "" ? undefined : texto;
}

// ─── Estagio ────────────────────────────────────────────────────────────────────

const estagio: EstagioResolucao = {
  // ── 1. Identidade ────────────────────────────────────────────────────────
  identidade: { nome: "midia", versao: "1.0.1" },

  // ── 2. Parametros ────────────────────────────────────────────────────────
  // Tudo que muda a saida e nao esta no manifesto. Escalares apenas.
  parametros: {
    // Qual provedor. Trocar de provedor troca o conteudo baixado, entao
    // isto tem de estar na chave — senao o cassete do Commons seria
    // servido como se fosse do Pixabay (C12).
    provedor: "wikimedia-commons",

    // A DECISAO DO ADR-0008, na chave de cache.
    // Hoje ha um unico valor. Ele existe aqui para que a introducao de
    // qualquer outro modo de aquisicao (hotlink, proxy, embed) seja cache
    // miss por construcao, em vez de reaproveitar em silencio cassetes
    // gravados sob a decisao antiga.
    modoDeAquisicao: "baixar-e-rehospedar",

    // Versao da ferramenta externa (contrato, secao 3). O Commons pode
    // mudar o formato de `extmetadata` sem mudar a URL.
    versaoApiProvedor: VERSAO_API_COMMONS,

    // Muda a URL do arquivo baixado e portanto os BYTES e o hash.
    larguraAlvo: 200,

    // Muda o conjunto de candidatos e portanto a escolha.
    limiteCandidatos: 5,

    // Muda quais candidatos sao aceitos. Achatado em string porque a
    // chave so aceita escalar (contrato, secao 3).
    licencasAceitas: "CC-BY-4.0,CC-BY-SA-4.0,CC0-1.0,PDM-1.0",
  },

  // ── 3. Resolucao ─────────────────────────────────────────────────────────
  async resolver(entrada: EntradaEstagio): Promise<SaidaEstagio> {
    // A decisao de hotlink e a PRIMEIRA coisa que acontece, antes de
    // qualquer rede. Provedor inelegivel derruba aqui.
    const { adaptador } = selecionarAdaptador(String(entrada.parametros.provedor));

    const larguraAlvo = Number(entrada.parametros.larguraAlvo);
    const limiteCandidatos = Number(entrada.parametros.limiteCandidatos);
    const licencasAceitas = String(entrada.parametros.licencasAceitas)
      .split(",")
      .map((l) => l.trim())
      .filter((l) => l !== "");

    const nos = nosDeMidia(entrada.manifesto.nos);

    // ── validacao: TODOS os problemas, antes de qualquer chamada ─────────
    const problemas: string[] = [];
    for (const no of nos) {
      if (termoDeBuscaDoNo(no) === undefined) {
        problemas.push(
          `${no.id}: sem 'texto_alternativo' — nao ha termo de busca. O schema ` +
            `torna o campo opcional, mas midia EXTERNA nao pode ser resolvida ` +
            `sem uma descricao do que se quer (ledger AB-433).`,
        );
      }
      if (!adaptador.tiposSuportados.includes(no.tipo_midia)) {
        problemas.push(
          `${no.id}: tipo_midia "${no.tipo_midia}" nao e suportado pelo adaptador ` +
            `"${adaptador.provedor}" (suporta: ${adaptador.tiposSuportados.join(", ")}) ` +
            `(ledger AB-434).`,
        );
      }
    }
    if (problemas.length > 0) throw new EMidiaNaoResolvivel(problemas);

    // ── aquisicao ────────────────────────────────────────────────────────
    const assets: Record<string, AssetResolvido> = {};
    const nosMidia: Record<string, string> = {};
    const procedenciaAssets: ProcedenciaAsset[] = [];
    const divergencias: string[] = [];

    for (const no of nos) {
      const termoDeBusca = termoDeBuscaDoNo(no) as string;

      const candidatos = await adaptador.buscarCandidatos({
        fetch: entrada.fetch,
        termoDeBusca,
        tipoMidia: no.tipo_midia,
        larguraAlvo,
        limiteCandidatos,
        licencasAceitas,
      });
      // `buscarCandidatos` ja ordenou e ja garantiu pelo menos um.
      const escolhido = candidatos[0] as CandidatoMidia;

      const { bytes, mimeType } = await baixar(entrada, escolhido);
      const hash = sha256Hex(bytes);

      // Os bytes ficam no diretorio de trabalho, endereçados por hash. E
      // daqui que o store de conteudo os pega (ledger AB-435: o contrato
      // de estagio ainda nao tem canal formal estagio -> store).
      await writeFile(join(entrada.diretorioTrabalho, hash), bytes);

      const licenca = escolhido.licenca as string;
      assets[hash] = {
        hash,
        tipo: TIPO_DE_ASSET[no.tipo_midia],
        mimeType,
        byteSize: bytes.length,
        largura: escolhido.largura,
        altura: escolhido.altura,
        licenca,
        atribuicaoObrigatoria: escolhido.atribuicaoObrigatoria,
        ...(escolhido.atribuicao !== undefined
          ? { atribuicao: escolhido.atribuicao }
          : {}),
        provedor: adaptador.provedor,
      };
      nosMidia[no.id] = hash;

      procedenciaAssets.push({
        hash,
        licenca,
        atribuicaoObrigatoria: escolhido.atribuicaoObrigatoria,
        ...(escolhido.atribuicao !== undefined
          ? { atribuicao: escolhido.atribuicao }
          : {}),
        provedor: adaptador.provedor,
        idNoProvedor: escolhido.idNoProvedor,
        origem: escolhido.urlDescricao,
        termoDeBusca,
      });

      // O manifesto declara um `hash` para o no de midia, mas a autoria
      // nao tem como conhecer o SHA-256 de um arquivo que ainda nao foi
      // baixado. O que vale abaixo da fronteira e `nos_midia`, que
      // endereça bytes reais. A divergencia e REGISTRADA, nunca
      // silenciada, e nunca "corrigida" no manifesto (ledger AB-432).
      if (no.hash !== hash) {
        divergencias.push(
          `${no.id}: hash declarado ${no.hash.slice(0, 12)}… != adquirido ${hash.slice(0, 12)}…`,
        );
      }
    }

    // ── procedencia ──────────────────────────────────────────────────────
    const licencas = [...new Set(procedenciaAssets.map((a) => a.licenca))].sort();
    const notas = [
      `hotlink nao utilizado: bytes baixados e re-hospedados por hash ` +
        `(docs/adr/0008-hotlink-e-midia-externa.md)`,
      `AB-950 continua fechado (enquadramento de uso pessoal, ADR-0003)`,
      ...divergencias,
    ];

    const procedencia: ProcedenciaCassete = {
      // Nao ha "licenca do provedor" no Commons: ela e por arquivo. Com
      // mais de uma, todas ficam declaradas — escolher uma para
      // representar as outras esconderia a mais restritiva.
      licenca: licencas.length > 0 ? licencas.join("; ") : LICENCA_SEM_ASSET,
      provedor: adaptador.provedor,
      ferramenta: `${adaptador.provedor} ${adaptador.versaoApi}`,
      assets: procedenciaAssets,
      notas: notas.join(" | "),
    };

    return { parcial: { assets, nos_midia: nosMidia }, procedencia };
  },
};

/** Baixa o arquivo escolhido. O MIME que vale e o da resposta. */
async function baixar(
  entrada: EntradaEstagio,
  escolhido: CandidatoMidia,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const resposta = await entrada.fetch(escolhido.urlArquivo, {
    headers: { "user-agent": AGENTE },
  });
  if (!resposta.ok) throw new EDownloadFalhou(escolhido.titulo, resposta.status);

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  if (bytes.length === 0) throw new EDownloadFalhou(escolhido.titulo, resposta.status);

  // O provedor declara o MIME do ARQUIVO ORIGINAL; nos baixamos uma
  // versao redimensionada, que pode ter outro. Vale o que veio no fio.
  const cabecalho = resposta.headers.get("content-type");
  const mimeType =
    cabecalho === null
      ? escolhido.mimeTypeDeclarado
      : (cabecalho.split(";")[0] as string).trim();

  return { bytes, mimeType };
}

export default estagio;
