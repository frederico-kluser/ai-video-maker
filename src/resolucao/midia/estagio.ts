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
 * `docs/adr/0013-hotlink-e-midia-externa.md` e em `politicas.ts`, e ela
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

/**
 * Dimensoes reais de um asset de IMAGEM, lidas dos BYTES baixados.
 *
 * Por que os bytes e nao o que o provedor declarou: o Commons declara as
 * dimensoes do THUMBNAIL pedido (`iiurlwidth`), mas para GIFs pequenos a
 * thumb pode ser o arquivo ORIGINAL inalterado (`thumbnail_unscaled`) —
 * medido na Onda 3: "Spinning globe map.gif" veio 405x178 com o provedor
 * declarando 1920x844. A declaracao mentirosa iria para o manifesto
 * resolvido. O byte e a verdade (mesma disciplina do hash).
 *
 * Suporta GIF, PNG e JPEG (os MIMEs de imagem aceitos pelo adaptador).
 * `undefined` = formato nao reconhecido — quem chama cai no declarado.
 */
export function dimensoesDoByte(
  bytes: Uint8Array,
  mimeType: string,
): { largura: number; altura: number } | undefined {
  const mime = mimeType.split(";")[0]!.trim().toLowerCase();
  const u16 = (o: number): number => bytes[o]! | (bytes[o + 1]! << 8);
  const u32 = (o: number): number =>
    (bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!;

  if (mime === "image/gif" && bytes.length >= 10) {
    const magic = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!);
    if (magic === "GIF") return { largura: u16(6), altura: u16(8) };
  }
  if (mime === "image/png" && bytes.length >= 24) {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    if (sig.every((b, i) => bytes[i] === b) && bytes[12] === 0x49) {
      // IHDR: width BE em 16, height BE em 20.
      return { largura: u32(16), altura: u32(20) };
    }
  }
  if (mime === "image/jpeg" && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    // Varre os marcadores ate um SOF (0xC0..0xCF, exceto C4/C8/CC):
    // altura BE em i+5, largura BE em i+7.
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marcador = bytes[i + 1]!;
      if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
        return { largura: u16(i + 7), altura: u16(i + 5) };
      }
      i += 2 + u16(i + 2);
    }
  }
  return undefined;
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
  // 1.2.0 (Onda 3): `larguraAlvo` 200 -> 1920 (o canvas 16:9) e o
  // adaptador passou a aceitar `video`. Os dois mudam a saida — bump
  // obrigatorio (contrato, secao 3); o cassete velho vira cache miss.
  identidade: { nome: "midia", versao: "1.2.0" },

  // ── 2. Parametros ────────────────────────────────────────────────────────
  // Tudo que muda a saida e nao esta no manifesto. Escalares apenas.
  parametros: {
    // Qual provedor. Trocar de provedor troca o conteudo baixado, entao
    // isto tem de estar na chave — senao o cassete do Commons seria
    // servido como se fosse do Pixabay (C12).
    provedor: "wikimedia-commons",

    // A DECISAO DO ADR-0013, na chave de cache.
    // Hoje ha um unico valor. Ele existe aqui para que a introducao de
    // qualquer outro modo de aquisicao (hotlink, proxy, embed) seja cache
    // miss por construcao, em vez de reaproveitar em silencio cassetes
    // gravados sob a decisao antiga.
    modoDeAquisicao: "baixar-e-rehospedar",

    // Versao da ferramenta externa (contrato, secao 3). O Commons pode
    // mudar o formato de `extmetadata` sem mudar a URL.
    versaoApiProvedor: VERSAO_API_COMMONS,

    // Muda a URL do arquivo baixado e portanto os BYTES e o hash.
    // 1920 = a largura do canvas 16:9 da fixture canonica: a Onda 3
    // regravou o cassete para que o asset chegue na resolucao do quadro
    // (o antigo 200px subia 7.7x ate 1920 — o "nao vi nada" do usuario).
    // Para video o alvo nao se aplica ao download (vai o ORIGINAL, ver
    // commons.ts), mas continua na chave e na URL da busca.
    larguraAlvo: 1920,

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
      // Dimensoes: para imagem/gif, a verdade dos BYTES baixados (o
      // provedor declara as do thumbnail pedido, que pode ser o original
      // inalterado — Onda 3); para video valem as do arquivo original.
      const reais =
        no.tipo_midia === "video"
          ? { largura: escolhido.largura, altura: escolhido.altura }
          : (dimensoesDoByte(bytes, mimeType) ?? {
              largura: escolhido.largura,
              altura: escolhido.altura,
            });
      assets[hash] = {
        hash,
        tipo: TIPO_DE_ASSET[no.tipo_midia],
        mimeType,
        byteSize: bytes.length,
        largura: reais.largura,
        altura: reais.altura,
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
        `(docs/adr/0013-hotlink-e-midia-externa.md)`,
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
