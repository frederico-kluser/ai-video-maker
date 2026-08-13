/**
 * src/resolucao/locucao/estagio.ts
 *
 * ESTAGIO DE RESOLUCAO: LOCUCAO — produz AUDIO e TIMING.
 *
 * Card F2-03, onda W4. Esta no caminho critico do programa
 * (`F0-01 → F0-02 → F2-01 → F2-03 → F3-01 → …`): F3-01 (timing canonico,
 * W5) consome diretamente o que sai daqui. O formato exato do timing
 * esta em `timing.ts` e nao muda sem bump de `identidade.versao`.
 *
 * ─── Por que DUAS chamadas e nao uma ─────────────────────────────────
 *
 * Nenhum provedor de TTS de uso geral devolve audio E timing por palavra
 * na mesma resposta. Levantamento da data de execucao (2026-08-11), nas
 * fontes primarias de cada provedor:
 *
 *   provedor de sintese usado aqui  audio, ZERO timing (o schema da
 *                                   requisicao tem 7 campos e nenhum e
 *                                   de timestamp)
 *   um provedor "with-timestamps"   audio + alinhamento por CARACTERE
 *                                   (nao por palavra) na mesma resposta
 *   um provedor de speech marks     timing por palavra, mas em chamada
 *                                   SEPARADA e com offset em BYTE
 *   um provedor por websocket       timing por palavra, so no stream
 *
 * Entao o caminho implementado tem dois saltos: sintese e depois
 * alinhamento por transcricao. E o mesmo caminho que a nota de dominio
 * do AGENTS.md chama de "caminho local de transcricao" — hospedado, mas
 * o mesmo codigo e as mesmas armadilhas. Ver `alinhamento.ts`.
 *
 * ─── A unidade de locucao e a CENA ───────────────────────────────────
 *
 * O manifesto declara locucao em `Cena.audio_cena.texto_locucao`. O
 * `ParcialResolvido` do contrato tipa `nos_locucao` como
 * `Record<NodeId, Sha256>`. Os dois discordam. Este card usa a chave que
 * o manifesto oferece (o id da CENA), declara isso em
 * `ESCOPO_DA_LOCUCAO` e no proprio documento de timing, e abre item de
 * ledger (AB-412) em vez de editar o arquivo de outro dono ou de
 * inventar uma atribuicao por no que o manifesto nao tem.
 */

import { createHash } from "node:crypto";
import type { EntradaEstagio, EstagioResolucao, SaidaEstagio } from "../contrato.js";
import type { AssetResolvido, Sha256 } from "../manifesto-resolvido.js";
import type {
  ProcedenciaAsset,
  ProcedenciaCassete,
} from "../cassete/formato.js";
import type { Cena, Manifesto } from "../../contratos/manifesto.js";
import { montarTiming, tokensDePalavras } from "./alinhamento.js";
import type { CaminhoDoTiming } from "./alinhamento.js";
import { assetDeTiming, serializarTiming } from "./timing.js";
import type { TimingLocucao } from "./timing.js";
import {
  conferirDuracao,
  duracaoDoWavMs,
  lerRespostaDeAlinhamento,
  requisicaoDeAlinhamento,
  requisicaoDeFala,
} from "./provedor.js";

// ─── Versao ─────────────────────────────────────────────────────────────────────

/**
 * Versao do estagio. Entra na chave de cache (C12).
 *
 * REGRA DURA: mudou `resolver()` de um jeito que pode mudar a saida?
 * Bump aqui. Isso inclui mudar o formato do documento de timing, o
 * conjunto de pontuacao de `alinhamento.ts` ou qualquer reparo em
 * `paraPalavras()` — os tres mudam bytes que entram no hash do asset.
 */
export const VERSAO_ESTAGIO = "1.0.0";

// ─── Licenca e disclosure ───────────────────────────────────────────────────────

/** Ficha de licenca de um provedor de locucao. */
interface FichaDeLicenca {
  readonly licenca: string;
  readonly atribuicaoObrigatoria: boolean;
  readonly atribuicao: string;
}

/**
 * Licenca e disclosure por provedor.
 *
 * `atribuicaoObrigatoria: true` nao e zelo: a obrigacao de informar ao
 * espectador que a voz e sintetica e CONTRATUAL no provedor de sintese
 * ("provide a clear disclosure to end users that the TTS voice they are
 * hearing is AI-generated and not a human voice"), e o ADR-0003 registra
 * que ela vale independentemente do enquadramento de uso. Carregar o
 * texto no asset e o que permite ao gate de publicacao (F5-06) saber que
 * ele existe sem reabrir este card.
 *
 * Provedor fora do mapa e ERRO, nunca um default: um default silencioso
 * aqui e um asset com licenca errada que passa em todos os gates.
 */
const LICENCA_POR_PROVEDOR: Readonly<Record<string, FichaDeLicenca>> = {
  openai: {
    licenca: "Termos-OpenAI-saida-do-cliente",
    atribuicaoObrigatoria: true,
    atribuicao: "Voz sintetica gerada por IA",
  },
  "sosia-local": {
    licenca: "CC0-1.0",
    atribuicaoObrigatoria: true,
    atribuicao: "Audio sintetico de referencia — nao e voz humana",
  },
};

/** Provedor declarado nao esta no mapa de licencas. */
export class EProvedorSemLicenca extends Error {
  readonly code = "PROVEDOR_SEM_LICENCA";
  constructor(provedor: string) {
    super(
      `Provedor "${provedor}" nao tem ficha de licenca em LICENCA_POR_PROVEDOR ` +
        `(src/resolucao/locucao/estagio.ts). Sem licenca declarada o cassete nao ` +
        `chega ao disco (∅-crit da W4) — e um default silencioso seria pior: ` +
        `produziria um asset com licenca errada que passa em todos os gates.`,
    );
    this.name = "EProvedorSemLicenca";
  }
}

/** Cena declara locucao mas nao tem o texto a sintetizar. */
export class ELocucaoSemTexto extends Error {
  readonly code = "LOCUCAO_SEM_TEXTO";
  constructor(cena: string) {
    super(
      `Cena "${cena}" tem audio_cena mas nao tem texto_locucao. ` +
        `Pular a cena em silencio produziria um video mudo onde deveria haver ` +
        `narracao, e nada ficaria vermelho.`,
    );
    this.name = "ELocucaoSemTexto";
  }
}

/** Falta a credencial do provedor no ambiente (so em modo gravacao). */
export class ECredencialAusente extends Error {
  readonly code = "CREDENCIAL_AUSENTE";
  constructor(variaveis: readonly string[]) {
    super(
      `Nenhuma credencial de locucao no ambiente (${variaveis.join(" ou ")}).\n` +
        `  Isto so e necessario em modo GRAVACAO — offline o orquestrador\n` +
        `  reproduz o cassete e nunca chama este codigo. Ver .env.example e\n` +
        `  docs/adr/0005-politica-segredos.md.`,
    );
    this.name = "ECredencialAusente";
  }
}

/** Variaveis de ambiente consultadas, na ordem. Nunca entram na chave. */
export const VARIAVEIS_DE_CREDENCIAL = ["LOCUCAO_API_KEY", "OPENAI_API_KEY"] as const;

/**
 * Le a credencial do ambiente.
 *
 * A credencial NAO e parametro e NAO entra na chave de cache — de
 * proposito. Ela nao muda a saida (o mesmo texto com a mesma voz produz
 * o mesmo audio, seja qual for a chave que pagou), e um segredo dentro
 * da chave viraria segredo dentro do nome de um diretorio versionado.
 */
function credencialDoAmbiente(): string {
  for (const nome of VARIAVEIS_DE_CREDENCIAL) {
    const valor = process.env[nome];
    if (valor !== undefined && valor.trim() !== "") return valor;
  }
  throw new ECredencialAusente(VARIAVEIS_DE_CREDENCIAL);
}

// ─── Unidades de locucao ────────────────────────────────────────────────────────

/** Uma cena que pede locucao. */
export interface UnidadeDeLocucao {
  readonly unidade: string;
  readonly texto: string;
}

/**
 * Lista as unidades de locucao de um manifesto, em ordem canonica.
 *
 * Ordena por id, nao pela ordem do array: a ordem do array e ordem de
 * escrita do manifesto, e duas escritas equivalentes produziriam dois
 * cassetes diferentes (Regra 1).
 */
export function unidadesDeLocucao(manifesto: Manifesto): UnidadeDeLocucao[] {
  const unidades: UnidadeDeLocucao[] = [];
  for (const cena of manifesto.cenas as readonly Cena[]) {
    const audio = cena.audio_cena;
    if (audio === undefined) continue;
    const texto = audio.texto_locucao;
    if (texto === undefined || texto.trim() === "") {
      throw new ELocucaoSemTexto(cena.id);
    }
    unidades.push({ unidade: cena.id, texto });
  }
  return unidades.sort((a, b) => (a.unidade < b.unidade ? -1 : a.unidade > b.unidade ? 1 : 0));
}

// ─── Parametros ─────────────────────────────────────────────────────────────────

/**
 * Parametros do estagio — tudo que muda a saida e nao esta no manifesto.
 *
 * Cada linha aqui e uma resposta a C12 ("o cache acerta pelo motivo
 * errado quando a chave omite um parametro"). Em particular:
 *
 *   `endpoint_base`  troca quem produz os bytes. Um cassete gravado
 *                    contra outra base NAO pode ser servido no lugar
 *                    deste — e com a base na chave isso e impossivel
 *                    por construcao, nao por disciplina.
 *   `idioma`         muda a decodificacao no alinhamento. Deixar de
 *                    envia-lo faz o provedor cair no default ingles.
 *   `modelo_*`       versao da ferramenta externa. O contrato exige que
 *                    ela esteja aqui e nao em lugar nenhum.
 *   `formato_audio`  `wav` e escolha, nao acaso: WAV tem duracao
 *                    aritmetica (bytes/byte-rate); MP3 tem duracao
 *                    estimada, que difere entre decodificadores (C4).
 */
export const PARAMETROS_LOCUCAO = {
  provedor: "sosia-local",
  endpoint_base: "http://127.0.0.1:3203",
  modelo_tts: "tts-1",
  voz: "alloy",
  velocidade: 1,
  formato_audio: "wav",
  modelo_alinhamento: "whisper-1",
  idioma: "pt-BR",
  origem_do_timing: "transcricao",
} as const;

// ─── Resolucao ──────────────────────────────────────────────────────────────────

/** O que uma unidade produziu. */
interface ResultadoDaUnidade {
  readonly audio: Buffer;
  readonly hashAudio: Sha256;
  readonly timing: TimingLocucao;
}

/**
 * Resolve UMA unidade de locucao: sintetiza, alinha, monta o timing.
 *
 * Exportada porque `replay.ts` a reusa para re-derivar os bytes a partir
 * do cassete. Reusar (em vez de reimplementar do lado do replay) e o que
 * torna o replay uma prova: se o estagio "consertasse" alguma coisa na
 * gravacao, o replay produziria outro hash e o teste ficaria vermelho.
 */
export async function resolverUnidade(
  unidade: UnidadeDeLocucao,
  parametros: typeof PARAMETROS_LOCUCAO,
  buscar: typeof fetch,
  credencial: string,
): Promise<ResultadoDaUnidade> {
  // ── 1. sintese ──────────────────────────────────────────────────────────
  const fala = requisicaoDeFala({
    base: parametros.endpoint_base,
    modelo: parametros.modelo_tts,
    voz: parametros.voz,
    velocidade: parametros.velocidade,
    formato: parametros.formato_audio,
    texto: unidade.texto,
    credencial,
  });
  const respostaFala = await buscar(fala.url, fala.init);
  if (!respostaFala.ok) {
    throw new Error(
      `sintese falhou para "${unidade.unidade}": HTTP ${respostaFala.status}`,
    );
  }
  const audio = Buffer.from(await respostaFala.arrayBuffer());
  const hashAudio = createHash("sha256").update(audio).digest("hex");

  // C4: a duracao sai do PCM, nao de um container e nao do provedor.
  const duracaoMs = duracaoDoWavMs(audio);

  // ── 2. alinhamento ──────────────────────────────────────────────────────
  const alinhamento = requisicaoDeAlinhamento({
    base: parametros.endpoint_base,
    modelo: parametros.modelo_alinhamento,
    idioma: parametros.idioma,
    audio,
    nomeDoArquivo: `${unidade.unidade}.wav`,
    credencial,
  });
  const respostaAlinhamento = await buscar(alinhamento.url, alinhamento.init);
  if (!respostaAlinhamento.ok) {
    throw new Error(
      `alinhamento falhou para "${unidade.unidade}": HTTP ${respostaAlinhamento.status}`,
    );
  }
  const dados = lerRespostaDeAlinhamento(await respostaAlinhamento.text());

  // O timing pode descrever outro audio sem que nada fique vermelho —
  // e a pergunta adversarial (2) do F3-01. Aqui fica.
  conferirDuracao(duracaoMs, dados.duration);

  // ── 3. juncao (nao pode ser deletada em pt-BR) ───────────────────────────
  const timing = montarTiming(tokensDePalavras(dados), {
    unidade: unidade.unidade,
    audio: hashAudio,
    idioma: parametros.idioma,
    texto: unidade.texto,
    duracao_ms: duracaoMs,
    provedor: parametros.provedor,
    unidade_nativa: "palavra",
    caminho: parametros.origem_do_timing as CaminhoDoTiming,
  });

  return { audio, hashAudio, timing };
}

const estagio: EstagioResolucao = {
  identidade: { nome: "locucao", versao: VERSAO_ESTAGIO },

  parametros: PARAMETROS_LOCUCAO,

  async resolver(entrada: EntradaEstagio): Promise<SaidaEstagio> {
    const parametros = entrada.parametros as unknown as typeof PARAMETROS_LOCUCAO;
    const ficha = LICENCA_POR_PROVEDOR[parametros.provedor];
    if (ficha === undefined) throw new EProvedorSemLicenca(parametros.provedor);

    const credencial = credencialDoAmbiente();

    const assets: Record<Sha256, AssetResolvido> = {};
    const nosLocucao: Record<string, Sha256> = {};
    const procedenciaAssets: ProcedenciaAsset[] = [];

    for (const unidade of unidadesDeLocucao(entrada.manifesto)) {
      // `entrada.fetch`, nunca `globalThis.fetch`: so este e gravado no
      // cassete, e so este e reproduzido offline. O global bate no
      // guarda de rede e derruba a suite — que e o resultado correto.
      const { audio, hashAudio, timing } = await resolverUnidade(
        unidade,
        parametros,
        entrada.fetch,
        credencial,
      );

      assets[hashAudio] = {
        hash: hashAudio,
        tipo: "audio",
        mimeType: "audio/wav",
        byteSize: audio.length,
        duracaoSegundos: timing.duracao_ms / 1000,
        licenca: ficha.licenca,
        atribuicaoObrigatoria: ficha.atribuicaoObrigatoria,
        atribuicao: ficha.atribuicao,
        provedor: parametros.provedor,
      };
      nosLocucao[unidade.unidade] = hashAudio;
      procedenciaAssets.push({
        hash: hashAudio,
        licenca: ficha.licenca,
        atribuicaoObrigatoria: ficha.atribuicaoObrigatoria,
        atribuicao: ficha.atribuicao,
        provedor: parametros.provedor,
        idNoProvedor: `${parametros.modelo_tts}/${parametros.voz}`,
      });

      // O timing e um asset de dados, enderecado pelo hash do proprio
      // documento. Ver timing.ts para por que ele nao e um campo.
      const assetTiming = assetDeTiming(timing, ficha.licenca, parametros.provedor);
      assets[assetTiming.hash] = assetTiming;
      procedenciaAssets.push({
        hash: assetTiming.hash,
        licenca: ficha.licenca,
        atribuicaoObrigatoria: false,
        provedor: parametros.provedor,
        idNoProvedor: `${parametros.modelo_alinhamento}/${parametros.idioma}`,
      });
    }

    const procedencia: ProcedenciaCassete = {
      licenca: ficha.licenca,
      provedor: parametros.provedor,
      ferramenta: `locucao ${VERSAO_ESTAGIO} (${parametros.modelo_tts} + ${parametros.modelo_alinhamento})`,
      assets: procedenciaAssets,
      notas:
        `Locucao sintetizada e alinhada por transcricao. ${ficha.atribuicao}. ` +
        `O timing por palavra e um asset de dados separado (mimeType ` +
        `application/vnd.editor-video-ia.timing-locucao+json); a ligacao com o ` +
        `audio vive no campo 'audio' do proprio documento. AB-950 continua fechado.`,
    };

    return { parcial: { assets, nos_locucao: nosLocucao }, procedencia };
  },
};

export default estagio;

// ─── Reexports de conveniencia ──────────────────────────────────────────────────

export { serializarTiming };
export type { TimingLocucao };
