/**
 * src/sincronia/legendas/validar.ts
 *
 * O ORACULO DAS LEGENDAS CANONICAS — reprova o documento, ou fica em
 * silencio. Card F3-02 (W6). ADR-0001: nenhum estagio comeca sem um
 * oraculo capaz de reprova-lo.
 *
 * ─── O invariante mora em SEGUNDOS, nunca em frames ────────────────────
 *
 *   duracao >= max(0,833 s; caracteres/20)   e   duracao <= 7 s
 *
 * [R14-01·R14-11 (2-0)] — piso de 20 frames (Netflix, "5/6 s" = 0,833 s)
 * a 40 frames (DCMP, 1,333 s); teto de 6 s (DCMP) a 7 s (Netflix). Os
 * numeros NAO aparecem aqui: vivem em src/design/tokens.ts (S-5), e este
 * oraculo os importa — trocar de plataforma ou de idioma e editar
 * valores, nunca este arquivo (audio-captions-sync SKILL.md §Legibilidade).
 *
 * Por que SEGUNDOS e o unico jeito certo: num manifesto frame-based, a
 * regra mais provavel de ser reescrita em frames por conveniencia. 20
 * frames a 60 fps sao 0,333 s — QUATRO VEZES abaixo do piso de 0,833 s,
 * em silencio. A sonda negativa abaixo usa exatamente esse caso: uma
 * legenda de 0,4 s (que uma reescrita em frames a 60 fps aprovaria) TEM
 * de ser reprovada aqui. APAGAR a regra de caracteres-por-segundo deixa
 * o ∅-crit VERMELHO (criterio de aceitacao do card).
 *
 * ─── Premissa independente ──────────────────────────────────────────────
 *
 * O oraculo NAO confia nos campos do documento: cada regra e conferida
 * contra o timing canonico e o manifesto (entrada do contrato). `audio`
 * e reconferido contra o timing; `inicio_s`/`fim_s` sao reconferidos
 * contra as palavras da cena e a timeline da composicao; `caracteres` e
 * REDERIVADO das linhas. Um construtor que "consertasse" no documento o
 * que o timing nao permite aparece aqui.
 *
 * As regras respondem as perguntas adversariais do card:
 *   (1) duracao abaixo do piso ou acima do teto da norma → C5.
 *   (2) legenda que aparece ANTES da palavra → C4a/C4b.
 *   (3) paginacao que estoura a safe area em vertical → C4e (linhas).
 *   (4) invariante em SEGUNDOS → C5 e a sonda negativa em
 *       tests/sincronia/legendas.test.ts.
 */

import {
  lineHeight,
  maxCpsAdult,
  maxLines,
  maxTextDurationSeconds,
  minTextDurationSeconds,
  safeArea16x9,
  safeArea9x16,
  typeScale,
} from "../../design/tokens.js";
import { calcularDuracao } from "../../composicao/tempo.js";
import type { Manifesto } from "../../contratos/manifesto.js";
import { validarTimingCanonico } from "../timing/validar.js";
import type { TimingCanonico } from "../timing/formato.js";
import {
  FORMATO_LEGENDAS_CANONICAS,
  UNIDADE_LEGENDAS,
} from "./formato.js";
import type { LegendasCanonicas } from "./formato.js";

/**
 * Tolerancia de comparacao, em segundos.
 *
 * O timing canonico deriva de milissegundos inteiros (F2-03), entao as
 * fronteiras caem em multiplos de 0.001; a timeline da composicao cai em
 * multiplos de 1/fps. 1e-6 absorve a aritmetica de ponto flutuante da
 * divisao — nenhum documento legitimo chega perto dela.
 */
export const EPS_S = 1e-6;

/** Documento de legendas que nao pode existir. */
export class ELegendasInvalidas extends Error {
  readonly code = "LEGENDAS_INVALIDAS";
  readonly problemas: readonly string[];
  constructor(problemas: readonly string[]) {
    super(
      "Legendas canonicas invalidas:\n" +
        problemas.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "ELegendasInvalidas";
    this.problemas = problemas;
  }
}

/** O contexto contra o qual o documento e conferido. */
export interface ContextoDeLegendas {
  readonly manifesto: Manifesto;
  readonly timing: TimingCanonico;
}

/**
 * Le um documento de legendas a partir dos bytes, validando.
 *
 * E o ponto de entrada de quem consome (F5-03, W8): bytes que nao passam
 * no oraculo nao existem.
 */
export function lerLegendas(
  bytes: Buffer | string,
  contexto: ContextoDeLegendas,
): LegendasCanonicas {
  const dados = JSON.parse(
    typeof bytes === "string" ? bytes : bytes.toString("utf-8"),
  ) as LegendasCanonicas;
  const problemas = validarLegendas(dados, contexto);
  if (problemas.length > 0) {
    throw new ELegendasInvalidas(problemas);
  }
  return dados;
}

/**
 * Valida o documento de legendas. Devolve a lista de problemas; vazia =
 * valido.
 */
export function validarLegendas(
  doc: LegendasCanonicas,
  contexto: ContextoDeLegendas,
): string[] {
  const { manifesto, timing } = contexto;
  const problemas: string[] = [];

  // O documento de entrada nao existe se o timing nao passar no oraculo
  // dele — a cadeia começa fechada.
  problemas.push(...validarTimingCanonico(timing).map((p) => `timing: ${p}`));

  // C1 — forma
  if (doc.schema_version !== FORMATO_LEGENDAS_CANONICAS) {
    problemas.push(
      `schema_version "${String(doc.schema_version)}" desconhecido ` +
        `(esperado ${FORMATO_LEGENDAS_CANONICAS})`,
    );
  }
  if (doc.unidade !== UNIDADE_LEGENDAS) {
    problemas.push(
      `unidade do documento "${String(doc.unidade)}" — o contrato exige ${UNIDADE_LEGENDAS}`,
    );
  }
  if (!Array.isArray(doc.legendas)) {
    problemas.push("C2: campo 'legendas' ausente ou nao e uma lista");
    return problemas;
  }

  // Timeline absoluta da composicao — a mesma aritmetica de F1-01 que a
  // suite integrada ancora. Se a timeline for invalida, o oraculo para.
  const timeline = calcularDuracao(manifesto);
  const porCena = new Map(timeline.timeline.map((t) => [t.cenaId, t]));

  // C2 — presenca por cena com locucao: "legenda que nunca aparece" e o
  // modo de falha C1 aplicado a este documento (F3-01, AB-522). Cada
  // cena do timing com `estado: "locucao"` TEM de ter ao menos uma
  // legenda que a referencia — presenca do item, nunca lista fechada.
  const cenasComLegenda = new Set(doc.legendas.map((l) => l.cena));
  for (const id of Object.keys(timing.cenas).sort()) {
    const entrada = timing.cenas[id];
    if (entrada?.estado === "locucao" && !cenasComLegenda.has(id)) {
      problemas.push(
        `C2: cena "${id}" com locucao sem nenhuma legenda — legenda que nunca aparece`,
      );
    }
  }

  // C3 — cada legenda
  //
  // A sobreposicao e verificada POR CENA, nunca entre cenas: duas cenas
  // com audios que se sobrepoem na timeline (a fixture canonica tem uma
  // ocorrencia — ver AB-58x no ledger) produzem legendas que se
  // sobrepoem SEM ser defeito deste documento: e o defeito da timeline,
  // e o mix que o expoe (F3-05, W7), nao a legenda.
  const fimAnteriorPorCena = new Map<string, number>();
  doc.legendas.forEach((legenda, i) => {
    const rotulo = `legenda ${i} (${legenda.cena} @ ${legenda.inicio_s}s)`;
    problemas.push(...validarLegenda(rotulo, legenda, contexto, porCena.get(legenda.cena)));

    // C4 — dentro da MESMA cena, a legenda N+1 nao comeca antes de a N
    // terminar: a leitura nunca disputa duas caixas da mesma fala.
    if (!Number.isFinite(legenda.inicio_s)) return;
    const fimAnterior = fimAnteriorPorCena.get(legenda.cena) ?? -Infinity;
    if (legenda.inicio_s < fimAnterior - EPS_S) {
      problemas.push(
        `${rotulo}: comeca em ${legenda.inicio_s}s, antes do fim da anterior ` +
          `(${fimAnterior}s) — sobreposicao na mesma cena`,
      );
    }
    fimAnteriorPorCena.set(legenda.cena, Math.max(fimAnterior, legenda.fim_s));
  });

  return problemas;
}

/** Valida UMA legenda contra o timing e a timeline. */
function validarLegenda(
  rotulo: string,
  legenda: { readonly unidade: string; readonly cena: string; readonly audio: string; readonly inicio_s: number; readonly fim_s: number; readonly linhas: readonly string[]; readonly texto: string; readonly caracteres: number },
  contexto: ContextoDeLegendas,
  posicao: { frameInicial: number; frameFinal: number } | undefined,
): string[] {
  const { manifesto, timing } = contexto;
  const problemas: string[] = [];

  // C3a — a entrada declara a propria unidade (contrato: nunca inferida
  // de contexto). A regra de duracao C5 so vale em segundos.
  if (legenda.unidade !== UNIDADE_LEGENDAS) {
    problemas.push(
      `${rotulo}: unidade "${String(legenda.unidade)}" — exige ${UNIDADE_LEGENDAS}`,
    );
  }

  // C3b — a cena existe no timing e e de locucao. Uma legenda para cena
  // silenciosa seria inventar fala onde o timing declara silencio.
  const entrada = timing.cenas[legenda.cena];
  if (entrada === undefined) {
    problemas.push(`${rotulo}: cena "${legenda.cena}" nao existe no timing canonico`);
    return problemas;
  }
  if (entrada.estado !== "locucao") {
    problemas.push(
      `${rotulo}: cena "${legenda.cena}" tem estado "${entrada.estado}" — ` +
        "legenda para cena sem locucao seria inventar fala",
    );
    return problemas;
  }

  // C3b2 — o endereco por CONTEUDO: a legenda declara o audio de que
  // deriva, e ele tem de ser o MESMO que o timing declara para a cena.
  if (legenda.audio !== entrada.audio) {
    problemas.push(
      `${rotulo}: audio ${legenda.audio.slice(0, 16)}… diverge do timing ` +
        `${(entrada.audio ?? "").slice(0, 16)}… — casamento por conteudo violado`,
    );
  }

  if (!Number.isFinite(legenda.inicio_s) || !Number.isFinite(legenda.fim_s)) {
    problemas.push(`${rotulo}: tempo nao-finito (${legenda.inicio_s}..${legenda.fim_s})`);
    return problemas;
  }

  const inicioCenaAbs = (posicao?.frameInicial ?? 0) / manifesto.fps;
  // O limite da legenda e o FIM DO AUDIO da cena (inicio + duracao_s do
  // timing), NAO o fim da janela visual da composicao: a legenda descreve
  // a fala, e a fala e o timing. Se a janela visual for mais curta que a
  // fala, quem reconcilia e a fronteira de composicao (AB-550) e o mix
  // (F3-05) — nao a legenda.
  const fimDoAudioAbs = inicioCenaAbs + (entrada.duracao_s ?? 0);
  const palavras = entrada.palavras ?? [];

  // C3c — geometria da duracao: fim > inicio.
  if (legenda.fim_s <= legenda.inicio_s) {
    problemas.push(
      `${rotulo}: duracao nao positiva (${legenda.inicio_s}..${legenda.fim_s})`,
    );
  }

  // C3d — dentro da cena: a legenda nao pode nascer antes da cena
  // comecar nem morrer depois de a fala da cena terminar.
  if (legenda.inicio_s < inicioCenaAbs - EPS_S) {
    problemas.push(
      `${rotulo}: comeca em ${legenda.inicio_s}s, antes do inicio da cena ` +
        `(${inicioCenaAbs}s)`,
    );
  }
  if (legenda.fim_s > fimDoAudioAbs + EPS_S) {
    problemas.push(
      `${rotulo}: termina em ${legenda.fim_s}s, depois do fim do audio da cena ` +
        `(${fimDoAudioAbs}s) — fora da fala`,
    );
  }

  // C4a — a legenda nasce no inicio de UMA PALAVRA da cena (nunca no
  // meio de uma palavra, nunca numa lacuna inventada).
  const iniciosAbs = palavras.map((p) => inicioCenaAbs + p.inicio_s);
  const casaComPalavra = iniciosAbs.some(
    (ini) => Math.abs(ini - legenda.inicio_s) <= EPS_S,
  );
  if (!casaComPalavra) {
    problemas.push(
      `${rotulo}: comeca em ${legenda.inicio_s}s, que nao e o inicio de ` +
        "nenhuma palavra da cena — legenda no meio da fala",
    );
  }

  // C4b — perguntas adversariais (2): NENHUM caminho em que a legenda
  // aparece ANTES da palavra. A primeira palavra da cena comeca em
  // `inicioCenaAbs + palavras[0].inicio_s`; antes disso e legenda
  // antecipada.
  const inicioPrimeiraPalavraAbs =
    palavras.length > 0 ? inicioCenaAbs + (palavras[0]?.inicio_s ?? 0) : inicioCenaAbs;
  if (legenda.inicio_s < inicioPrimeiraPalavraAbs - EPS_S) {
    problemas.push(
      `${rotulo}: comeca em ${legenda.inicio_s}s, antes da primeira palavra ` +
        `(${inicioPrimeiraPalavraAbs}s) — legenda aparece antes da palavra`,
    );
  }

  // C4c — a legenda cobre ao menos a palavra em que nasce: termina
  // depois do fim dela. Uma legenda que fecha antes da propria primeira
  // palavra terminaria no meio da fala.
  const palavraDoInicio = palavras.find(
    (p) => Math.abs(inicioCenaAbs + p.inicio_s - legenda.inicio_s) <= EPS_S,
  );
  if (palavraDoInicio !== undefined) {
    const fimDaPalavraAbs = inicioCenaAbs + (palavraDoInicio.fim_s ?? 0);
    if (legenda.fim_s < fimDaPalavraAbs - EPS_S) {
      problemas.push(
        `${rotulo}: termina em ${legenda.fim_s}s, antes do fim da palavra em que ` +
          `nasce (${fimDaPalavraAbs}s)`,
      );
    }
  }

  // C4e — paginacao vertical: no maximo `maxLines` linhas. E a regra que
  // limita a caixa na vertical (safe area): com 2 linhas o bloco teorico
  // cabe nas safe areas 16:9 e 9:16 — ver o invariante em
  // tests/sincronia/legendas.test.ts.
  const linhas = legenda.linhas ?? [];
  if (linhas.length < 1) {
    problemas.push(`${rotulo}: zero linhas — legenda vazia`);
  }
  if (linhas.length > maxLines) {
    problemas.push(
      `${rotulo}: ${linhas.length} linhas > maximo ${maxLines} — ` +
        "a caixa estoura a safe area em vertical",
    );
  }
  if (legenda.texto !== linhas.join("\n")) {
    problemas.push(`${rotulo}: 'texto' nao e a juncao das linhas com quebras`);
  }
  if (!Number.isInteger(legenda.caracteres) || legenda.caracteres <= 0) {
    problemas.push(`${rotulo}: 'caracteres' invalido (${String(legenda.caracteres)})`);
  } else {
    // O oraculo REDERIVA o numerador do piso — nunca confia no campo.
    const derivados = linhas.join("").length;
    if (legenda.caracteres !== derivados) {
      problemas.push(
        `${rotulo}: declara ${legenda.caracteres} caracteres, mas as linhas ` +
          `tem ${derivados} — campo 'caracteres' mentiroso`,
      );
    }
    const duracao = legenda.fim_s - legenda.inicio_s;

    // C5 — O INVARIANTE, em SEGUNDOS:
    //   duracao >= max(piso da norma; caracteres/velocidade de leitura)
    //   e duracao <= teto da norma.
    // A primeira metade do max e o piso absoluto da norma; a segunda e a
    // REGRA DE CARACTERES-POR-SEGUNDO — o ∅-crit do card. Apagar esta
    // clausula (ou reescrever qualquer uma em frames) deixa o gate
    // VERMELHO pelo teste certo.
    const pisoAbsoluto = minTextDurationSeconds;
    const pisoDeLeitura = legenda.caracteres / maxCpsAdult;
    const piso = Math.max(pisoAbsoluto, pisoDeLeitura);

    if (duracao < piso - EPS_S) {
      problemas.push(
        `${rotulo}: duracao ${duracao.toFixed(3)}s abaixo do piso ` +
          `max(${pisoAbsoluto}s; ${legenda.caracteres} caracteres / ` +
          `${maxCpsAdult} CPS = ${pisoDeLeitura.toFixed(3)}s) = ${piso.toFixed(3)}s ` +
          "— legenda rapida demais para ler (invariante em SEGUNDOS)",
      );
    }
    if (duracao > maxTextDurationSeconds + EPS_S) {
      problemas.push(
        `${rotulo}: duracao ${duracao.toFixed(3)}s acima do teto da norma ` +
          `(${maxTextDurationSeconds}s) — legenda travada na tela`,
      );
    }
  }

  return problemas;
}

// ─── Invariante de safe area vertical (teorico, por tokens) ────────────────────

/**
 * A altura do bloco de legenda com N linhas, em pixels da resolucao
 * `(largura, altura)`. Derivada dos tokens (S-5): fonte caption como
 * fracao da altura do frame, altura de linha normal.
 */
export function alturaDoBlocoDeLegenda(
  linhas: number,
  resolucao: { width: number; height: number },
): number {
  const tamanhoDaFonte = typeScale.caption * resolucao.height;
  return linhas * tamanhoDaFonte * lineHeight.normal;
}

/**
 * A caixa vertical util de uma resolucao, em pixels: a safe area que se
 * aplica a ela. 16:9 usa a graphics safe da EBU R 95 (5%); 9:16 usa o
 * retangulo util provisional (AB-071). Resolucao fora das duas → `null`.
 */
export function caixaVerticalUtil(resolucao: {
  width: number;
  height: number;
}): { y: number; altura: number } | null {
  const eh16x9 = Math.abs(resolucao.width / resolucao.height - 16 / 9) < 1e-6;
  const eh9x16 = Math.abs(resolucao.width / resolucao.height - 9 / 16) < 1e-6;
  if (eh16x9) {
    return {
      y: safeArea16x9.graphicsSafe.top,
      altura: safeArea16x9.graphicsSafe.bottom - safeArea16x9.graphicsSafe.top,
    };
  }
  if (eh9x16) {
    return { y: safeArea9x16.safeRect.y, altura: safeArea9x16.safeRect.height };
  }
  return null;
}
