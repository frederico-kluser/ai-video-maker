/**
 * src/resolucao/locucao/timing.ts
 *
 * O FORMATO DO TIMING DE LOCUCAO — a superficie que F3-01 consome.
 *
 * F2-03 esta no caminho critico (`F0-01 → F0-02 → F2-01 → F2-03 → F3-01`)
 * e produz DUAS coisas, nao uma: o audio da locucao e o timing por
 * palavra dele. O audio e enderecado por hash em `parcial.nos_locucao`;
 * o timing e um asset de `tipo: "dados"` no mesmo `parcial.assets`, e o
 * documento abaixo e o conteudo desse asset.
 *
 * ─── Por que o timing e um asset separado, e nao um campo ────────────
 *
 * `ParcialResolvido` (F2-01) nao tem campo de timing, e este card NAO
 * edita o arquivo de outro dono. A saida disponivel e a que o contrato
 * ja oferece: um asset enderecado por conteudo. Isso e melhor do que
 * parece — o timing passa a ser deduplicado por hash, versionado por
 * conteudo, e invalidado junto com o audio de que deriva.
 *
 * O preco e que a LIGACAO timing→audio nao cabe em `AssetResolvido`
 * (o schema tem `additionalProperties: false`). Entao ela vive DENTRO
 * do documento, no campo `audio`. Consequencia pratica para F3-01:
 * o casamento e por conteudo, nunca por posicao — ver `casarTimings()`.
 *
 * ─── Unidade: milissegundo inteiro ───────────────────────────────────
 *
 * O provedor devolve segundos em ponto flutuante. Este formato guarda
 * MILISSEGUNDO INTEIRO, de proposito:
 *
 *   - dois floats "iguais" podem serializar diferente (`0.1+0.2`), e o
 *     cassete exige byte identico ao regravar. Um float no resultado e
 *     um determinismo que morre num campo que ninguem olha;
 *   - comparacao exata (`fim <= duracao`) e o oraculo de F3-01, e
 *     comparacao exata de float e uma armadilha;
 *   - frame exige `fps`, que e do manifesto, nao do audio. Milissegundo
 *     e agnostico de fps e a conversao fica com quem tem o fps.
 *
 * ─── Isto NAO e tempo de parede (C9) ─────────────────────────────────
 *
 * `inicio_ms` e offset DENTRO do proprio audio, ancorado no byte zero
 * dele. Nao ha relogio, fuso, data nem duracao de execucao aqui. O
 * manifesto resolvido continua carregando apenas hashes — este
 * documento vive no store, atras de um SHA-256.
 */

import { createHash } from "node:crypto";
import type {
  AssetResolvido,
  ParcialResolvido,
  Sha256,
} from "../manifesto-resolvido.js";

// ─── Versao e identificacao ─────────────────────────────────────────────────────

/** Versao do formato deste documento. Muda ⇒ bump em `identidade.versao`. */
export const FORMATO_TIMING_LOCUCAO = "TimingLocucao.1" as const;

/**
 * MIME type do asset de timing.
 *
 * E por ele que F3-01 acha o documento dentro de `parcial.assets` sem
 * precisar de registro central (AGENTS.md Regra 6). Nao e uma URL: e um
 * identificador de midia, e o guarda `encontrarURLs()` nao o acusa
 * porque nao ha `://` nele.
 */
export const MIME_TIMING_LOCUCAO =
  "application/vnd.editor-video-ia.timing-locucao+json" as const;

/**
 * Escopo da unidade de fala.
 *
 * O manifesto declara locucao em `Cena.audio_cena.texto_locucao` — ou
 * seja, por CENA. `ParcialResolvido.nos_locucao` e tipado como
 * `Record<NodeId, Sha256>`, ou seja, por NO. Os dois contratos
 * discordam, e este card nao inventa a reconciliacao nem edita o
 * arquivo do dono: ele declara qual dos dois usou.
 *
 * Ver `ledger/inbox/F2-03.json`, item AB-412.
 */
export const ESCOPO_DA_LOCUCAO = "cena" as const;

// ─── O documento ────────────────────────────────────────────────────────────────

/** De onde o timing veio e em que unidade o provedor o entregou. */
export interface OrigemDoTiming {
  /** Identificador do provedor ou do caminho local. Nunca um endereco. */
  readonly provedor: string;

  /**
   * Unidade NATIVA do que a fonte devolveu, antes de qualquer juncao.
   *
   * As tres existem no mundo real e nao sao intercambiaveis (AGENTS.md,
   * armadilhas de dominio):
   *   - `palavra`           lista de palavras com `start`/`end` em segundos
   *   - `caractere`         um timestamp por CARACTERE; palavra e derivada
   *   - `speech-mark-byte`  offsets em BYTE, nao em caractere
   */
  readonly unidade_nativa: "palavra" | "caractere" | "speech-mark-byte";

  /**
   * Se o estagio de juncao/alinhamento foi EXECUTADO.
   *
   * Em pt-BR ele e obrigatorio e nao pode ser deletado — ver
   * `alinhamento.ts`, `exigeAlinhamentoExplicito()`.
   */
  readonly alinhamento_executado: boolean;

  /** Por que foi obrigatorio (ou por que nao foi). Texto de auditoria. */
  readonly motivo_do_alinhamento: string;
}

/** Uma palavra falada, com seu intervalo dentro do audio. */
export interface PalavraLocucao {
  /**
   * Posicao na locucao. 0-based, contigua, sem buraco.
   *
   * Existe para que F3-01 possa afirmar "faltou palavra" sem depender
   * da ordem do array — um array reordenado por engano continua
   * detectavel.
   */
  readonly indice: number;

  /**
   * Texto da palavra, ja com a pontuacao anexada e sem espaco nas
   * bordas. `"pipeline."`, nunca `"pipeline"` + `"."` separados.
   */
  readonly texto: string;

  /** Inicio, em milissegundos inteiros desde o byte zero deste audio. */
  readonly inicio_ms: number;

  /** Fim, em milissegundos inteiros. Sempre `> inicio_ms`. */
  readonly fim_ms: number;
}

/** O documento de timing de UMA unidade de locucao. */
export interface TimingLocucao {
  /** Versao do formato. */
  readonly formato: typeof FORMATO_TIMING_LOCUCAO;

  /** Escopo da unidade. Hoje sempre `"cena"` — ver `ESCOPO_DA_LOCUCAO`. */
  readonly escopo: typeof ESCOPO_DA_LOCUCAO;

  /** Id da unidade (id da cena). E a mesma chave usada em `nos_locucao`. */
  readonly unidade: string;

  /**
   * SHA-256 do AUDIO a que este timing se refere.
   *
   * E a unica ligacao timing→audio que existe, porque `AssetResolvido`
   * tem `additionalProperties: false` e nao aceita campo novo. F3-01
   * casa por este campo (`casarTimings()`), nunca por posicao no array.
   */
  readonly audio: Sha256;

  /** BCP-47 (`"pt-BR"`). A juncao depende dele; por isso esta gravado. */
  readonly idioma: string;

  /** Duracao total do audio, em milissegundos inteiros. */
  readonly duracao_ms: number;

  /** Texto falado, exatamente como foi enviado ao provedor. */
  readonly texto: string;

  /** Palavras em ordem, monotonicas e sem sobreposicao. */
  readonly palavras: readonly PalavraLocucao[];

  /** Procedencia tecnica do timing. */
  readonly origem: OrigemDoTiming;
}

// ─── Serializacao ───────────────────────────────────────────────────────────────

/**
 * Serializa o documento em JSON canonico (chaves ordenadas, indentacao 2,
 * quebra final) — os MESMOS bytes que entram no hash e no store.
 *
 * Nao reusa `serializarCanonico()` de `cassete/formato.ts` por acidente:
 * reusa de proposito. Duas serializacoes canonicas diferentes no mesmo
 * repositorio produzem dois hashes para o mesmo dado, e a divergencia so
 * aparece quando alguem tenta ler o asset pelo hash e nao acha.
 */
export function serializarTiming(timing: TimingLocucao): Buffer {
  return Buffer.from(JSON.stringify(ordenarProfundo(timing), null, 2) + "\n", "utf-8");
}

function ordenarProfundo(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarProfundo);
  if (valor !== null && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(valor as Record<string, unknown>).sort()) {
      const v = (valor as Record<string, unknown>)[chave];
      if (v === undefined) continue;
      saida[chave] = ordenarProfundo(v);
    }
    return saida;
  }
  return valor;
}

/** SHA-256 dos bytes canonicos do documento. E o hash do asset. */
export function hashDoTiming(timing: TimingLocucao): Sha256 {
  return createHash("sha256").update(serializarTiming(timing)).digest("hex");
}

/** Le um documento de timing a partir dos bytes do store. */
export function lerTiming(bytes: Buffer | string): TimingLocucao {
  const dados = JSON.parse(
    typeof bytes === "string" ? bytes : bytes.toString("utf-8"),
  ) as TimingLocucao;
  const problemas = validarTiming(dados);
  if (problemas.length > 0) throw new ETimingInvalido(dados.unidade ?? "(sem id)", problemas);
  return dados;
}

// ─── Validacao ──────────────────────────────────────────────────────────────────

/** Timing que nao pode existir. */
export class ETimingInvalido extends Error {
  readonly code = "TIMING_INVALIDO";
  readonly problemas: readonly string[];
  constructor(unidade: string, problemas: readonly string[]) {
    super(
      `Timing de locucao invalido para "${unidade}":\n` +
        problemas.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "ETimingInvalido";
    this.problemas = problemas;
  }
}

/**
 * Normaliza texto para COMPARACAO — nunca para armazenamento.
 *
 * NFC (dois jeitos de escrever "ç" tem de comparar igual) e colapso de
 * espaco. A pontuacao NAO e removida: e exatamente ela que denuncia uma
 * juncao que nao rodou.
 */
export function normalizarParaComparacao(texto: string): string {
  return texto.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Valida um documento de timing.
 *
 * As regras existem porque cada uma ja falhou em algum pipeline de
 * legenda de verdade:
 *
 *   R1 lista vazia         — audio com fala e zero palavras e a falha C1
 *                            ("exit 0 nao prova que saiu imagem") aplicada
 *                            ao audio: o estagio "funcionou" e nao produziu
 *                            timing nenhum.
 *   R2 indice contiguo     — palavra perdida no meio nao vira buraco
 *                            visivel na legenda; vira legenda errada.
 *   R3 duracao positiva    — palavra de duracao zero desaparece da
 *                            legenda sem erro.
 *   R4 monotonicidade      — legenda que aparece ANTES da palavra ser
 *                            falada e a pergunta adversarial (1) do F3-01.
 *   R5 dentro do audio     — palavra que termina depois do fim do audio
 *                            e legenda orfa no fim do video.
 *   R6 reconstrucao        — juntar as palavras tem de reproduzir o texto
 *                            falado. E ESTA a regra que pega o estagio de
 *                            alinhamento deletado: sem a juncao, a
 *                            pontuacao vira token proprio e a reconstrucao
 *                            diverge do texto de origem.
 */
export function validarTiming(timing: TimingLocucao): string[] {
  const problemas: string[] = [];

  if (timing.formato !== FORMATO_TIMING_LOCUCAO) {
    problemas.push(
      `formato "${String(timing.formato)}" desconhecido (esperado ${FORMATO_TIMING_LOCUCAO})`,
    );
  }
  if (!/^[0-9a-f]{64}$/.test(timing.audio ?? "")) {
    problemas.push("campo 'audio' nao e um SHA-256 hexadecimal");
  }
  if (!Number.isInteger(timing.duracao_ms) || timing.duracao_ms <= 0) {
    problemas.push(`duracao_ms invalida: ${String(timing.duracao_ms)}`);
  }

  const palavras = timing.palavras ?? [];

  // R1
  if (palavras.length === 0) {
    problemas.push(
      "R1: zero palavras. Audio com fala e timing vazio e 'sucesso' sem produto.",
    );
    return problemas;
  }

  let anteriorFim = 0;
  palavras.forEach((p, i) => {
    // R2
    if (p.indice !== i) {
      problemas.push(`R2: palavra na posicao ${i} declara indice ${p.indice}`);
    }
    if (!Number.isInteger(p.inicio_ms) || !Number.isInteger(p.fim_ms)) {
      problemas.push(
        `R3: palavra ${i} ("${p.texto}") tem tempo nao-inteiro ` +
          `(${p.inicio_ms}..${p.fim_ms}) — ms inteiro e o contrato`,
      );
      return;
    }
    // R3
    if (p.fim_ms <= p.inicio_ms) {
      problemas.push(
        `R3: palavra ${i} ("${p.texto}") tem duracao <= 0 ` +
          `(${p.inicio_ms}..${p.fim_ms})`,
      );
    }
    // R4
    if (p.inicio_ms < anteriorFim) {
      problemas.push(
        `R4: palavra ${i} ("${p.texto}") comeca em ${p.inicio_ms}ms, ` +
          `antes do fim da anterior (${anteriorFim}ms) — sobreposicao`,
      );
    }
    // R5
    if (p.fim_ms > timing.duracao_ms) {
      problemas.push(
        `R5: palavra ${i} ("${p.texto}") termina em ${p.fim_ms}ms, ` +
          `depois do fim do audio (${timing.duracao_ms}ms)`,
      );
    }
    if (p.texto.trim() === "") {
      problemas.push(`R6: palavra ${i} tem texto vazio`);
    }
    anteriorFim = Math.max(anteriorFim, p.fim_ms);
  });

  // R6
  const reconstruido = normalizarParaComparacao(palavras.map((p) => p.texto).join(" "));
  const original = normalizarParaComparacao(timing.texto ?? "");
  if (reconstruido !== original) {
    problemas.push(
      "R6: juntar as palavras nao reproduz o texto falado.\n" +
        `      falado:       ${original}\n` +
        `      reconstruido: ${reconstruido}\n` +
        "      Sintoma classico de estagio de alinhamento ausente: a pontuacao\n" +
        "      chegou como token proprio e ninguem a anexou a palavra.",
    );
  }

  return problemas;
}

// ─── Superficie de consumo (F3-01) ──────────────────────────────────────────────

/**
 * Metadado do asset de timing, como ele aparece em `parcial.assets`.
 *
 * `licenca` e obrigatoria mesmo aqui: o documento e derivado do audio e
 * herda a licenca dele. Um asset de dados sem licenca reprovaria o
 * ∅-crit tanto quanto um audio sem licenca.
 */
export function assetDeTiming(
  timing: TimingLocucao,
  licenca: string,
  provedor: string,
): AssetResolvido {
  const bytes = serializarTiming(timing);
  return {
    hash: hashDoTiming(timing),
    tipo: "dados",
    mimeType: MIME_TIMING_LOCUCAO,
    byteSize: bytes.length,
    duracaoSegundos: timing.duracao_ms / 1000,
    licenca,
    atribuicaoObrigatoria: false,
    provedor,
  };
}

/**
 * Lista os hashes dos assets de timing dentro de uma parcial/resolvido.
 *
 * PERGUNTA OBRIGATORIA DA ONDA: esta funcao NAO asserta nada sobre a
 * lista completa de assets. Ela filtra pelo MIME que este card produz e
 * ignora todo o resto — assets de F2-02, F2-04, F2-05 e F2-06 entram no
 * mesmo mapa depois do merge e nao podem quebrar isto.
 */
export function hashesDeTiming(parcial: {
  readonly assets: Readonly<Record<Sha256, AssetResolvido>>;
}): Sha256[] {
  return Object.keys(parcial.assets)
    .filter((hash) => parcial.assets[hash]?.mimeType === MIME_TIMING_LOCUCAO)
    .sort();
}

/** Uma unidade de locucao resolvida: audio + timing, ja casados. */
export interface LocucaoResolvida {
  readonly unidade: string;
  readonly audio: Sha256;
  readonly timing: TimingLocucao;
}

/**
 * Casa cada entrada de `nos_locucao` com o seu documento de timing.
 *
 * O casamento e por CONTEUDO (`timing.audio === hashDoAudio`), nunca por
 * ordem de array nem por indice paralelo: dois arrays "paralelos" saem
 * de sincronia no primeiro merge e o erro e silencioso.
 *
 * @param parcial parcial ou manifesto resolvido (so precisa de
 *   `assets` e `nos_locucao`)
 * @param carregar le os bytes de um asset pelo hash — tipicamente
 *   `store.get`. Sincrono ou assincrono, a criterio de quem chama.
 */
export async function casarTimings(
  parcial: Pick<ParcialResolvido, "assets" | "nos_locucao">,
  carregar: (hash: Sha256) => Promise<Buffer | null> | Buffer | null,
): Promise<LocucaoResolvida[]> {
  const timings = new Map<Sha256, TimingLocucao>();
  for (const hash of hashesDeTiming(parcial)) {
    const bytes = await carregar(hash);
    if (bytes === null) continue;
    const timing = lerTiming(bytes);
    timings.set(timing.audio, timing);
  }

  const saida: LocucaoResolvida[] = [];
  for (const unidade of Object.keys(parcial.nos_locucao ?? {}).sort()) {
    const audio = (parcial.nos_locucao as Record<string, Sha256>)[unidade] as Sha256;
    const timing = timings.get(audio);
    if (timing === undefined) {
      throw new ETimingInvalido(unidade, [
        `nao ha documento de timing cujo campo 'audio' seja ${audio.slice(0, 16)}…. ` +
          "Audio sem timing e legenda que nunca aparece — e ninguem fica vermelho.",
      ]);
    }
    saida.push({ unidade, audio, timing });
  }
  return saida;
}
