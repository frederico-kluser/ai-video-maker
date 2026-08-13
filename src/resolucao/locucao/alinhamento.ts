/**
 * src/resolucao/locucao/alinhamento.ts
 *
 * A JUNCAO — o estagio que, em pt-BR, nao pode ser deletado.
 *
 * A armadilha esta nomeada no AGENTS.md, na tabela de armadilhas de
 * dominio, e vale para F2-03 e F3-01 (os dois no caminho critico):
 *
 *   "O caminho local de transcricao devolve timing por palavra em
 *    qualquer idioma"  →  "A funcao de juncao e guardada por idioma
 *    ingles. Em pt-BR, o estagio de alinhamento nao pode ser deletado."
 *
 * ─── A conclusao esta certa; o mecanismo, nao ─────────────────────────
 *
 * A pesquisa deste card foi ao fonte e a palavra "guardada" nao se
 * sustenta: `merge_punctuations` e chamada INCONDICIONALMENTE, sem
 * nenhum `if` de idioma (`whisper/timing.py:319`, dentro de
 * `add_word_timestamps`; idem `faster_whisper/transcribe.py:1618`). O
 * unico `if` de idioma na juncao e por ESPACO, nao por ingles
 * (`whisper/tokenizer.py:277`): `zh, ja, th, lo, my, yue` vao para
 * `split_tokens_on_unicode`, todo o resto — pt incluido — vai para
 * `split_tokens_on_spaces`, que e o caminho certo.
 *
 * O ingles entra por DEFAULT, em tres lugares independentes, e default
 * e pior que guarda: guarda falha alto, default acerta o idioma errado
 * em silencio.
 *
 *   D1 `whisper_full_default_params` do whisper.cpp tem
 *      `language = "en"`, e a CLI repete (`examples/cli/cli.cpp:84`).
 *      `-l` so autodetecta se voce escrever `auto`.
 *   D2 o `transcribe()` do Remotion so passa `-l` quando voce informa
 *      `language` (`install-whisper-cpp/src/transcribe.ts:179`:
 *      `language ? ['-l', language.toLowerCase()] : null`). Sem o
 *      parametro, audio pt-BR e decodificado como ingles.
 *   D3 a propria funcao de juncao do `transformers` faz
 *      `if language is None: language = "english"` dentro de
 *      `_combine_tokens_into_words`.
 *
 * E ha um quarto detalhe, este sim especifico de idioma e o que mais
 * dói em pt-BR: a pontuacao que a juncao reconhece e
 * `string.punctuation` do Python (`whisper/tokenizer.py:319`), que e
 * ASCII PURO. `…`, `—`, `«`, `»`, `“`, `”` NAO contam como pontuacao.
 * Em pt-BR eles aparecem, viram token proprio, e a legenda ganha uma
 * "palavra" que e so um travessao.
 *
 * ─── O que isso obriga aqui ──────────────────────────────────────────
 *
 * Duas coisas, e nenhuma e opcional:
 *
 *   1. `idioma` e SEMPRE enviado explicitamente ao provedor
 *      (`provedor.ts`), nunca deixado no default;
 *   2. a juncao roda aqui dentro, com um conjunto de pontuacao que
 *      inclui os nao-ASCII — ou seja, o estagio de alinhamento NAO
 *      pode ser deletado, exatamente como o AGENTS.md conclui.
 *
 * Este arquivo implementa a juncao uma vez, para as TRES unidades
 * nativas que os provedores reais entregam. `validarTiming()`
 * (timing.ts, regra R6) e o oraculo que reprova quem a deletar.
 *
 * ─── As tres unidades nativas ────────────────────────────────────────
 *
 *   palavra           lista de `{word, start, end}` em SEGUNDOS float.
 *                     Pontuacao pode vir como token proprio.
 *   caractere         um par de tempos por CARACTERE. Palavra e derivada
 *                     acumulando ate o espaco (AGENTS.md: "Timestamps de
 *                     locucao por caractere e por palavra sao a mesma
 *                     coisa" → sao coisas diferentes).
 *   speech-mark-byte  offsets de posicao no texto que sao BYTE, nao
 *                     caractere (AGENTS.md: "Offsets de speech mark sao
 *                     posicao de caractere" → num provedor sao offset de
 *                     byte, e pt-BR com acento tem byte != caractere em
 *                     UTF-8).
 *
 * As tres desembocam no MESMO `TimingLocucao`. E esse o produto de
 * F2-03: uma forma canonica, tres origens possiveis.
 */

import {
  ESCOPO_DA_LOCUCAO,
  FORMATO_TIMING_LOCUCAO,
  validarTiming,
  ETimingInvalido,
} from "./timing.js";
import type { OrigemDoTiming, PalavraLocucao, TimingLocucao } from "./timing.js";
import type { Sha256 } from "../manifesto-resolvido.js";

// ─── Pontuacao ──────────────────────────────────────────────────────────────────

/**
 * Pontuacao que gruda na palavra SEGUINTE (abre).
 *
 * Os nao-ASCII (`“`, `‘`, `«`, `—`) estao aqui de proposito: a juncao da
 * ferramenta de origem usa `string.punctuation` do Python, que e ASCII
 * puro, e por isso NAO os reconhece. Uma lista so-ASCII deste lado
 * deixaria `“` virar palavra de duracao 1 ms na legenda.
 */
export const PONTUACAO_PREFIXA = new Set([
  '"', "'", "“", "‘", "¿", "¡", "(", "[", "{", "-", "—", "«",
]);

/** Pontuacao que gruda na palavra ANTERIOR (fecha). */
export const PONTUACAO_SUFIXA = new Set([
  '"', "'", "”", "’", ".", ",", "!", "?", ":", ";", ")", "]", "}", "…", "»",
  "。", "，", "！", "？", "：", "、",
]);

// ─── Idioma ─────────────────────────────────────────────────────────────────────

/**
 * Por qual caminho o timing foi obtido.
 *
 *   `tts-nativo`   o proprio endpoint de TTS devolveu alinhamento junto
 *                  com o audio (por caractere, ou por speech mark).
 *   `transcricao`  o audio foi transcrito depois, por um modelo de
 *                  reconhecimento, e o timing veio dai. E NESTE caminho
 *                  que mora a guarda por idioma ingles — hospedado ou
 *                  local, o codigo e o mesmo.
 */
export type CaminhoDoTiming = "tts-nativo" | "transcricao";

/** Veredicto sobre a obrigatoriedade da juncao, com a razao por escrito. */
export interface VeredictoAlinhamento {
  readonly obrigatorio: boolean;
  readonly motivo: string;
}

/** Subtag primaria de um BCP-47: `"pt-BR"` → `"pt"`. */
export function idiomaPrimario(idioma: string): string {
  return (idioma.split("-")[0] ?? "").toLowerCase();
}

/**
 * Decide se a juncao explicita e obrigatoria — e diz por que.
 *
 * Devolve `obrigatorio: true` em todos os caminhos conhecidos hoje. Isso
 * e uma escolha, nao um descuido: a dispensa e que teria de ser
 * justificada caso a caso, nunca a exigencia. O valor da funcao esta no
 * `motivo`, que vai gravado no documento de timing e responde, dois anos
 * depois, "por que este passo existe?".
 *
 * Tres gatilhos, e cada um sozinho ja obriga:
 *
 *   1. caminho de TRANSCRICAO em idioma != ingles. E a armadilha
 *      nomeada, no mecanismo correto: a ferramenta de transcricao
 *      decodifica como ingles por DEFAULT e a pontuacao que a juncao
 *      dela reconhece e ASCII pura. Em pt-BR isso deixa `…`, `—` e as
 *      aspas curvas como token solto.
 *   2. unidade nativa != `palavra`. Caractere e speech mark nao SAO
 *      palavra; a palavra so existe depois da acumulacao.
 *   3. qualquer fonte pode emitir pontuacao como token proprio.
 */
export function exigeAlinhamentoExplicito(
  idioma: string,
  caminho: CaminhoDoTiming,
  unidadeNativa: OrigemDoTiming["unidade_nativa"],
): VeredictoAlinhamento {
  const primario = idiomaPrimario(idioma);

  if (caminho === "transcricao" && primario !== "en") {
    return {
      obrigatorio: true,
      motivo:
        `transcricao em idioma "${idioma}": a ferramenta decodifica como ingles ` +
        "por default e a juncao dela so reconhece pontuacao ASCII, entao o passo " +
        "de alinhamento nao pode ser deletado (AGENTS.md, armadilhas de dominio)",
    };
  }
  if (unidadeNativa !== "palavra") {
    return {
      obrigatorio: true,
      motivo:
        `unidade nativa "${unidadeNativa}" nao e palavra: a palavra so existe ` +
        "depois da acumulacao, e acumular e o passo de alinhamento",
    };
  }
  return {
    obrigatorio: true,
    motivo:
      `caminho "${caminho}" em "${idioma}" entrega palavra, mas pode emitir ` +
      "pontuacao como token proprio; a juncao roda sempre e a regra R6 de " +
      "validarTiming() prova que rodou",
  };
}

/** A juncao era obrigatoria e nao produziu palavras. */
export class EAlinhamentoObrigatorio extends Error {
  readonly code = "ALINHAMENTO_OBRIGATORIO";
  constructor(idioma: string, motivo: string, detalhe: string) {
    super(
      `Alinhamento obrigatorio nao pode ser pulado (idioma ${idioma}).\n` +
        `  motivo:  ${motivo}\n` +
        `  detalhe: ${detalhe}\n` +
        "  Em pt-BR o estagio de alinhamento NAO e opcional. Ver\n" +
        "  src/resolucao/locucao/alinhamento.ts e docs/adr/0007-timing-de-locucao.md.",
    );
    this.name = "EAlinhamentoObrigatorio";
  }
}

// ─── Token cru ──────────────────────────────────────────────────────────────────

/**
 * Um token com tempo, como a FONTE entregou — antes de qualquer juncao.
 *
 * Tempos em segundos, ponto flutuante, exatamente como vieram. A
 * conversao para milissegundo inteiro acontece de uma vez so no fim
 * (`paraPalavras`), nunca token a token: arredondar antes de juntar
 * espalha o erro de arredondamento por dentro das palavras.
 */
export interface TokenCru {
  readonly texto: string;
  readonly inicio_s: number;
  readonly fim_s: number;

  /**
   * Se este token INICIA uma palavra ortografica — ou seja, se havia
   * espaco antes dele no texto falado.
   *
   * Sem este bit a juncao e impossivel de fazer certo em pt-BR. Compare:
   *
   *   "pipeline."      o ponto e ADJACENTE  → gruda, vira uma palavra
   *   "pipeline — fim" o travessao tem espaco dos dois lados → NAO
   *                    gruda, e uma palavra propria
   *
   * Os dois casos sao "pontuacao ao lado de palavra"; so a adjacencia os
   * distingue. A ferramenta de transcricao carrega essa informacao no
   * espaco a esquerda do proprio token (`word.startswith(" ")`), e e
   * exatamente esse teste que a juncao dela faz. Aqui o bit e explicito
   * porque as outras duas fontes (caractere, speech mark) nao tem espaco
   * para testar — e inferir "adjacente" delas grudaria o travessao.
   */
  readonly comecaPalavra: boolean;
}

// ─── 1. Fonte: lista de palavras (segundos) ─────────────────────────────────────

/**
 * Resposta de transcricao com granularidade de palavra.
 *
 * Formato do `verbose_json` do endpoint de transcricao da OpenAI e da
 * saida do whisper local: `words: [{ word, start, end }]`, tempos em
 * SEGUNDOS. Os nomes de campo sao os do provedor, nao os nossos — este
 * tipo e o retrato da resposta, nao o nosso formato.
 */
export interface RespostaPalavras {
  readonly words?: ReadonlyArray<{
    readonly word: string;
    readonly start: number;
    readonly end: number;
  }>;
  readonly duration?: number;
  readonly language?: string;
  readonly text?: string;
}

/**
 * Extrai os tokens crus de uma resposta com granularidade de palavra.
 *
 * A adjacencia sai do ESPACO A ESQUERDA do proprio `word`, que e como a
 * ferramenta a codifica. O primeiro token conta como inicio de palavra
 * mesmo sem espaco: nao ha nada antes dele.
 */
export function tokensDePalavras(resposta: RespostaPalavras): TokenCru[] {
  return (resposta.words ?? []).map((w, i) => ({
    texto: w.word,
    inicio_s: w.start,
    fim_s: w.end,
    comecaPalavra: i === 0 || /^\s/u.test(w.word),
  }));
}

// ─── 2. Fonte: alinhamento por caractere ────────────────────────────────────────

/**
 * Alinhamento por CARACTERE.
 *
 * E o formato dos endpoints de TTS "com timestamps": tres arrays
 * paralelos — o caractere, o instante em que ele comeca e o instante em
 * que termina. Palavra nao existe na resposta; ela e derivada.
 *
 * Dois detalhes que ja custaram tempo a quem integrou isto:
 *
 *   - a MESMA resposta traz `alignment` (casa com o texto original) e
 *     `normalized_alignment` (casa com o texto depois da normalizacao do
 *     provedor: "$5" → "five dollars"). Os dois tem COMPRIMENTOS
 *     DIFERENTES quando a normalizacao dispara; nao sao indices
 *     intercambiaveis. Para legenda vale o original.
 *   - o transporte por websocket do mesmo provedor usa OUTROS nomes:
 *     `chars`, `charStartTimesMs`, `charDurationsMs` — camelCase,
 *     milissegundo, e DURACAO em vez de fim. Trocar de transporte troca
 *     o schema; por isso este tipo descreve so o HTTP.
 */
export interface AlinhamentoPorCaractere {
  readonly characters: readonly string[];
  readonly character_start_times_seconds: readonly number[];
  readonly character_end_times_seconds: readonly number[];
}

/**
 * Acumula caracteres ate o espaco, produzindo tokens de palavra.
 *
 * O inicio da palavra e o inicio do primeiro caractere dela; o fim e o
 * fim do ultimo. O espaco em si nao vira token — ele e a FRONTEIRA, e
 * transformar a fronteira em palavra e o bug classico deste caminho.
 *
 * Trabalha sobre pontos de codigo (`Array.from`), nao sobre unidades
 * UTF-16: um `ç` decomposto ou um emoji fora do BMP quebraria o
 * indice se a iteracao fosse por `charAt`.
 */
export function tokensDeCaracteres(
  alinhamento: AlinhamentoPorCaractere,
): TokenCru[] {
  const { characters, character_start_times_seconds, character_end_times_seconds } =
    alinhamento;
  const tokens: TokenCru[] = [];

  let atual = "";
  let inicio = 0;
  let fim = 0;

  // Todo token daqui nasce delimitado por espaco — foi assim que ele foi
  // fechado. Logo `comecaPalavra` e sempre verdadeiro, e o travessao
  // cercado de espaco continua sendo palavra propria.
  const fechar = (): void => {
    if (atual !== "") {
      tokens.push({ texto: atual, inicio_s: inicio, fim_s: fim, comecaPalavra: true });
      atual = "";
    }
  };

  for (let i = 0; i < characters.length; i++) {
    const c = characters[i] as string;
    const cInicio = character_start_times_seconds[i] ?? 0;
    const cFim = character_end_times_seconds[i] ?? cInicio;

    if (/\s/u.test(c)) {
      fechar();
      continue;
    }
    if (atual === "") inicio = cInicio;
    atual += c;
    fim = cFim;
  }
  fechar();

  return tokens;
}

// ─── 3. Fonte: speech marks com offset em BYTE ──────────────────────────────────

/**
 * Uma speech mark de tipo `word`.
 *
 * `time` e milissegundo desde o inicio do audio. `start` e `end` sao
 * offsets NO TEXTO — e num provedor real eles sao offsets de BYTE em
 * UTF-8, nao de caractere. A documentacao do provedor diz isso com
 * todas as letras: "the offset in bytes (not characters) of the start
 * of the object in the input text". Em ingles os dois coincidem; em
 * pt-BR, "seção" tem 5 caracteres e 6 bytes, e a partir da primeira
 * palavra acentuada todo offset seguinte fica deslocado.
 *
 * Ha ainda um bug confirmado pelo proprio provedor em que o corte cai no
 * MEIO de um caractere multibyte e o `value` volta com `�`. Por
 * isso, aqui, o recorte por offset manda sobre o `value`: o `value` e o
 * campo que mente primeiro.
 */
export interface SpeechMark {
  readonly time: number;
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly value: string;
}

/**
 * Converte speech marks em tokens crus, tratando `start`/`end` como
 * offsets de BYTE no texto original.
 *
 * O fim de cada palavra e o `time` da PROXIMA mark (as marks marcam
 * inicio, nao intervalo); a ultima recebe `duracaoTotalMs`. Sem isso a
 * ultima palavra fica com duracao zero e some da legenda.
 *
 * @param texto texto exatamente como enviado ao provedor
 * @param marks marks de tipo `word`, em ordem
 * @param duracaoTotalMs duracao do audio, para fechar a ultima palavra
 */
export function tokensDeSpeechMarks(
  texto: string,
  marks: readonly SpeechMark[],
  duracaoTotalMs: number,
): TokenCru[] {
  const bytes = Buffer.from(texto, "utf-8");
  const palavras = marks.filter((m) => m.type === "word");

  return palavras.map((m, i) => {
    // A fatia e recortada em BYTES e so entao decodificada. Recortar em
    // caractere com um offset de byte e exatamente o bug: silencioso,
    // e so aparece depois do primeiro acento.
    const recorte = bytes.subarray(m.start, m.end).toString("utf-8");
    const proximo = palavras[i + 1];
    const fimMs = proximo !== undefined ? proximo.time : duracaoTotalMs;
    return {
      // `value` e o que o provedor diz que a palavra e; o recorte e o
      // que os offsets apontam. Divergencia entre os dois e o sintoma de
      // byte-vs-caractere, e por isso o recorte manda: e ele que a
      // legenda usaria para destacar a palavra no texto.
      texto: recorte !== "" ? recorte : m.value,
      inicio_s: m.time / 1000,
      fim_s: fimMs / 1000,
      // Marks de tipo `word` ja sao palavras: o provedor nao emite mark
      // para pontuacao isolada. Adjacencia nao se aplica.
      comecaPalavra: true,
    };
  });
}

// ─── A juncao ───────────────────────────────────────────────────────────────────

/**
 * Junta pontuacao solta a palavra vizinha — o passo que nao pode ser
 * deletado.
 *
 * Duas passagens, nesta ordem:
 *   1. pontuacao que ABRE gruda no token seguinte, quando o seguinte for
 *      ADJACENTE (`!comecaPalavra`);
 *   2. pontuacao que FECHA gruda no token anterior, quando ela propria
 *      for adjacente ao anterior.
 *
 * A adjacencia e a regra inteira. Sem ela:
 *   - `"seção" + ","` (adjacente) ficaria separado, e a legenda mostraria
 *     uma virgula sozinha por 40 ms;
 *   - `"pipeline — fim"` (nao adjacente) viraria `"pipeline —fim"`, e o
 *     texto reconstruido deixaria de bater com o falado.
 *
 * O intervalo da palavra resultante COBRE os dois tokens: a pontuacao
 * ocupa tempo de audio real (a pausa depois da virgula e audivel), e
 * descarta-la encolhe a legenda em relacao a fala.
 */
export function juntarPontuacao(tokens: readonly TokenCru[]): TokenCru[] {
  const limpos = tokens
    .map((t) => ({ ...t, texto: t.texto.trim() }))
    .filter((t) => t.texto !== "");
  if (limpos.length === 0) return [];

  // Passagem 1 — pontuacao que abre gruda no seguinte adjacente.
  const passo1: TokenCru[] = [];
  for (let i = 0; i < limpos.length; i++) {
    const token = limpos[i] as TokenCru;
    const seguinte = limpos[i + 1];
    if (
      seguinte !== undefined &&
      !seguinte.comecaPalavra &&
      ehSoPontuacao(token.texto, PONTUACAO_PREFIXA)
    ) {
      limpos[i + 1] = {
        texto: token.texto + seguinte.texto,
        inicio_s: token.inicio_s,
        fim_s: Math.max(token.fim_s, seguinte.fim_s),
        comecaPalavra: token.comecaPalavra,
      };
      continue;
    }
    passo1.push(token);
  }

  // Passagem 2 — pontuacao que fecha gruda no anterior, se adjacente.
  const passo2: TokenCru[] = [];
  for (const token of passo1) {
    const anterior = passo2[passo2.length - 1];
    if (
      anterior !== undefined &&
      !token.comecaPalavra &&
      ehSoPontuacao(token.texto, PONTUACAO_SUFIXA)
    ) {
      passo2[passo2.length - 1] = {
        texto: anterior.texto + token.texto,
        inicio_s: anterior.inicio_s,
        fim_s: Math.max(anterior.fim_s, token.fim_s),
        comecaPalavra: anterior.comecaPalavra,
      };
      continue;
    }
    passo2.push(token);
  }

  return passo2;
}

/** `true` se o token e feito SO de caracteres do conjunto dado. */
function ehSoPontuacao(texto: string, conjunto: ReadonlySet<string>): boolean {
  const pontos = Array.from(texto);
  return pontos.length > 0 && pontos.every((c) => conjunto.has(c));
}

// ─── Conversao final ────────────────────────────────────────────────────────────

/**
 * Converte tokens (segundos float) em palavras (milissegundo inteiro),
 * aplicando os reparos de monotonicidade.
 *
 * Os reparos sao do ESTAGIO, nao da gravacao — e a distincao que o
 * contrato chama de "sosia, nao sucessor". O cassete guarda a resposta
 * como ela veio, com o defeito dentro; a correcao roda aqui e roda de
 * novo em todo replay. Consertar na gravacao esconderia o defeito e o
 * replay deixaria de testar este codigo.
 *
 * Os tres reparos, nomeados:
 *   P1 arredondamento — segundos float → ms inteiro, `Math.round`, uma
 *      vez so, no fim.
 *   P2 sobreposicao   — se o inicio cai antes do fim da anterior, ele e
 *      empurrado para o fim da anterior. Legenda que aparece antes da
 *      palavra ser falada e a pergunta adversarial (1) do F3-01.
 *   P3 duracao zero   — palavra que ficou com `fim <= inicio` recebe
 *      1 ms. Duracao zero some da legenda sem erro nenhum.
 */
export function paraPalavras(tokens: readonly TokenCru[]): PalavraLocucao[] {
  const palavras: PalavraLocucao[] = [];
  let anteriorFim = 0;

  for (const token of tokens) {
    let inicio = Math.round(token.inicio_s * 1000); // P1
    let fim = Math.round(token.fim_s * 1000); // P1
    if (inicio < anteriorFim) inicio = anteriorFim; // P2
    if (fim <= inicio) fim = inicio + 1; // P3
    palavras.push({
      indice: palavras.length,
      texto: token.texto,
      inicio_ms: inicio,
      fim_ms: fim,
    });
    anteriorFim = fim;
  }

  return palavras;
}

// ─── Montagem do documento ──────────────────────────────────────────────────────

/** Tudo que o documento de timing precisa alem dos tokens. */
export interface ContextoDoTiming {
  readonly unidade: string;
  readonly audio: Sha256;
  readonly idioma: string;
  readonly texto: string;
  readonly duracao_ms: number;
  readonly provedor: string;
  readonly unidade_nativa: OrigemDoTiming["unidade_nativa"];
  readonly caminho: CaminhoDoTiming;
}

/**
 * Monta e VALIDA o documento de timing a partir dos tokens crus.
 *
 * Este e o unico caminho de construcao. Ele sempre roda a juncao — nao
 * ha parametro para pular, de proposito: um parametro `pularJuncao`
 * seria a porta de fuga, e porta de fuga que existe e porta de fuga que
 * alguem usa "so para testar".
 *
 * @throws EAlinhamentoObrigatorio se a juncao era obrigatoria (e ela
 *   sempre e) e o resultado ainda assim nao reconstroi o texto falado —
 *   ou seja, se a juncao virou no-op sem que ninguem percebesse.
 */
export function montarTiming(
  tokensCrus: readonly TokenCru[],
  contexto: ContextoDoTiming,
): TimingLocucao {
  const veredicto = exigeAlinhamentoExplicito(
    contexto.idioma,
    contexto.caminho,
    contexto.unidade_nativa,
  );

  const juntados = juntarPontuacao(tokensCrus);
  const palavras = paraPalavras(juntados);

  const timing: TimingLocucao = {
    formato: FORMATO_TIMING_LOCUCAO,
    escopo: ESCOPO_DA_LOCUCAO,
    unidade: contexto.unidade,
    audio: contexto.audio,
    idioma: contexto.idioma,
    duracao_ms: contexto.duracao_ms,
    texto: contexto.texto,
    palavras,
    origem: {
      provedor: contexto.provedor,
      unidade_nativa: contexto.unidade_nativa,
      alinhamento_executado: true,
      motivo_do_alinhamento: veredicto.motivo,
    },
  };

  const problemas = validarTiming(timing);
  if (problemas.length === 0) return timing;

  // Se a unica coisa quebrada e a reconstrucao (R6), o diagnostico util
  // nao e "timing invalido": e "a juncao nao aconteceu". Nomear a causa
  // aqui poupa a proxima pessoa de reabrir esta armadilha do zero.
  const soR6 = problemas.every((p) => p.startsWith("R6"));
  if (soR6 && veredicto.obrigatorio) {
    throw new EAlinhamentoObrigatorio(
      contexto.idioma,
      veredicto.motivo,
      problemas.join(" | "),
    );
  }
  throw new ETimingInvalido(contexto.unidade, problemas);
}
