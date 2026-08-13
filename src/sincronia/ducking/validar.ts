/**
 * src/sincronia/ducking/validar.ts
 *
 * O ORACULO DO ENVELOPE DE DUCKING — reprova o documento, ou fica em
 * silencio. Card F3-03 (W6). ADR-0001: o que o F3-05 (W7) vai aplicar no
 * mix tem de ser reprovavel por um oraculo independente do produtor.
 *
 * Os criterios sao REDERIVADOS do documento, em segundos, sem nenhuma
 * premissa emprestada do calculo:
 *
 *   E1  a forma — schema_version e unidade (sempre "segundos", declarada
 *       no documento, nunca inferida — mesma disciplina do timing).
 *   E2  o mapa de intervalos existe; vazio e legitimo (video sem locucao
 *       nao precisa de atenuacao) — zero intervalos nao e erro AQUI; o
 *       ∅-crit de cobertura vive em calcular.ts (coberturaDoEnvelope),
 *       que sabe a locucao que existe.
 *   E3  a geometria de cada intervalo — patamar valido (fim > inicio),
 *       ganho finito e NEGATIVO (zero nao e atenuacao), rampas finitas e
 *       ESTRITAMENTE positivas (rampa nula = degrau).
 *   E4  o invariante anti-degrau — intervalos ordenados por inicio_s, e
 *       a rampa de entrada de cada um comeca so depois de a rampa de
 *       saida do anterior ter terminado. Se dois intervalos fossem
 *       emitidos com rampas sobrepostas, o ganho mudaria de valor no
 *       meio de uma rampa (degrau) — o documento que admite isto e
 *       rejeitado.
 */

import { FORMATO_ENVELOPE_DUCKING } from "./formato.js";
import type { DuckingEnvelope, IntervaloDeDucking } from "./formato.js";
import { UNIDADE_SEGUNDOS } from "../timing/formato.js";
import { EPS_S } from "../timing/validar.js";

/** Documento de envelope que nao pode existir. */
export class EEnvelopeDuckingInvalido extends Error {
  readonly code = "ENVELOPE_DUCKING_INVALIDO";
  readonly problemas: readonly string[];
  constructor(problemas: readonly string[]) {
    super(
      "Envelope de ducking invalido:\n" + problemas.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "EEnvelopeDuckingInvalido";
    this.problemas = problemas;
  }
}

/**
 * Le um documento de envelope a partir dos bytes, validando.
 *
 * E o ponto de entrada de quem consome (F3-05, W7): bytes que nao passam
 * no oraculo nao existem.
 */
export function lerEnvelopeDucking(bytes: Buffer | string): DuckingEnvelope {
  const dados = JSON.parse(
    typeof bytes === "string" ? bytes : bytes.toString("utf-8"),
  ) as DuckingEnvelope;
  const problemas = validarEnvelopeDucking(dados);
  if (problemas.length > 0) {
    throw new EEnvelopeDuckingInvalido(problemas);
  }
  return dados;
}

/**
 * Valida o envelope. Devolve a lista de problemas; vazia = valido.
 */
export function validarEnvelopeDucking(doc: DuckingEnvelope): string[] {
  const problemas: string[] = [];

  // E1 — forma
  if (doc.schema_version !== FORMATO_ENVELOPE_DUCKING) {
    problemas.push(
      `schema_version "${String(doc.schema_version)}" desconhecido ` +
        `(esperado ${FORMATO_ENVELOPE_DUCKING})`,
    );
  }
  if (doc.unidade !== UNIDADE_SEGUNDOS) {
    problemas.push(
      `unidade do documento "${String(doc.unidade)}" — o contrato exige ${UNIDADE_SEGUNDOS}`,
    );
  }

  // E2 — o mapa de intervalos existe (vazio e legitimo: sem locucao nao
  // ha atenuacao; a cobertura contra a locucao real e do ∅-crit).
  const intervalos = doc.intervalos;
  if (!Array.isArray(intervalos)) {
    problemas.push("E2: 'intervalos' ausente ou nao e um array");
    return problemas;
  }

  // E3/E4 — geometria de cada intervalo e invariante anti-degrau.
  let fimDaRampaAnterior = -Infinity;
  intervalos.forEach((intervalo, i) => {
    problemas.push(...validarIntervalo(i, intervalo));
    if (intervalo.inicio_s === undefined) return;

    // E4 — a rampa de entrada deste intervalo tem de comecar DEPOIS do
    // fim da rampa de saida do anterior (ou exatamente no mesmo ponto:
    // ali as duas valem 0 dB). Se comecar antes, existe trecho onde o
    // documento pede dois ganhos ao mesmo tempo — degrau no meio de uma
    // rampa — e o documento nao pode existir.
    const inicioRampa = intervalo.inicio_s - (intervalo.rampa_entrada_s ?? 0);
    if (inicioRampa < fimDaRampaAnterior - EPS_S) {
      problemas.push(
        `intervalo ${i}: rampa de entrada comeca em ${inicioRampa}s, antes do fim ` +
          `da rampa de saida do anterior (${fimDaRampaAnterior}s) — ` +
          "degrau entre intervalos",
      );
    }
    fimDaRampaAnterior = intervalo.fim_s + (intervalo.rampa_saida_s ?? 0);
  });

  return problemas;
}

/** E3 — a geometria de UM intervalo. */
function validarIntervalo(i: number, intervalo: IntervaloDeDucking): string[] {
  const problemas: string[] = [];
  const rotulo = `intervalo ${i} (inicio ${String(intervalo.inicio_s)}s)`;

  const inicio = intervalo.inicio_s;
  const fim = intervalo.fim_s;
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) {
    problemas.push(`${rotulo}: tempo nao-finito (${inicio}..${fim})`);
    return problemas;
  }
  if (fim <= inicio + EPS_S) {
    problemas.push(`${rotulo}: patamar nao e um intervalo (${inicio}..${fim})`);
  }

  const ganho = intervalo.ganho_db;
  if (!Number.isFinite(ganho)) {
    problemas.push(`${rotulo}: ganho_db nao-finito (${String(ganho)})`);
  } else if (ganho >= 0) {
    problemas.push(
      `${rotulo}: ganho_db ${ganho} nao e atenuacao — o zero nao reduz ` +
        "nada, e locucao coberta por ganho zero esta sem atenuacao (∅-crit)",
    );
  }

  const rampaEntrada = intervalo.rampa_entrada_s;
  if (!Number.isFinite(rampaEntrada) || rampaEntrada <= 0) {
    problemas.push(
      `${rotulo}: rampa_entrada_s ${String(rampaEntrada)} — tem de ser ` +
        "finita e estritamente positiva (rampa nula e degrau)",
    );
  }
  const rampaSaida = intervalo.rampa_saida_s;
  if (!Number.isFinite(rampaSaida) || rampaSaida <= 0) {
    problemas.push(
      `${rotulo}: rampa_saida_s ${String(rampaSaida)} — tem de ser ` +
        "finita e estritamente positiva (rampa nula e degrau)",
    );
  }

  if (intervalo.cena !== undefined && intervalo.cena.trim() === "") {
    problemas.push(`${rotulo}: campo 'cena' vazio — so faz sentido nao-vazio`);
  }

  return problemas;
}
