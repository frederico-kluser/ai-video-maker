/**
 * src/sincronia/timing/validar.ts
 *
 * O ORACULO DO TIMING CANONICO — reprova o documento, ou fica em silencio.
 *
 * Card F3-01 (W5, caminho critico). ADR-0001: nenhum estagio comeca sem um
 * oraculo capaz de reprova-lo. Os criterios de aceitacao exigem tres sondas
 * negativas (∅-crit): um documento com palavra FORA DE ORDEM, com
 * SOBREPOSICAO ou com DURACAO NEGATIVA TEM de ser rejeitado — cada uma
 * provada por teste em `tests/sincronia/timing.test.ts`.
 *
 * ─── Por que este oraculo nao e uma copia de `validarTiming()` do F2-03 ──
 *
 * Pergunta adversarial (3) do card: "o oraculo do timing deriva da mesma
 * premissa do produtor? Se sim, as duas copias erram juntas." O produtor
 * (F2-03) valida contra o que ELE declara (`duracao_ms` no proprio
 * documento). Este oraculo valida contra premissas independentes:
 *
 *   C1..C4  a forma — o que o schema/timing.schema.json exige.
 *   C5..C7  a geometria — monotonicidade, sobreposicao, duracao. Sao
 *           REDERIVADAS do documento em segundos: um reparo deletado no
 *           produtor (P2/P3 de `paraPalavras()`) aparece aqui mesmo se o
 *           produtor nao acusar.
 *   C8      o invariante de cobertura — palavras + silencio cobrem
 *           exatamente `[0, duracao_s]`. NENHUM produtor calcula isto; e a
 *           premissa de que a semantica de silencio declarada e
 *           consistente com as palavras.
 *
 * E a verificacao de que a duracao do documento BATE COM OS BYTES do audio
 * (medida no PCM, tolerancia 250 ms) nao mora aqui: mora em `construir.ts`
 * (C9/C10), porque aqui nao ha bytes — la ha.
 */

import {
  FORMATO_TIMING_CANONICO,
  UNIDADE_SEGUNDOS,
} from "./formato.js";
import type {
  EntradaDeCena,
  IntervaloDeSilencio,
  PalavraCanonica,
  TimingCanonico,
} from "./formato.js";

/**
 * Tolerancia de comparacao, em segundos.
 *
 * O construtor deriva tudo de milissegundos inteiros (F2-03), entao as
 * fronteiras do documento caem em multiplos de 0.001 e a cobertura e
 * EXATA. 1e-6 so absorve a aritmetica de ponto flutuante da divisao por
 * 1000 — nenhum documento legítimo chega perto dela.
 */
export const EPS_S = 1e-6;

/** Documento canonico que nao pode existir. */
export class ETimingCanonicoInvalido extends Error {
  readonly code = "TIMING_CANONICO_INVALIDO";
  readonly problemas: readonly string[];
  constructor(unidade: string, problemas: readonly string[]) {
    super(
      `Timing canonico invalido${unidade === "" ? "" : ` em "${unidade}"`}:\n` +
        problemas.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "ETimingCanonicoInvalido";
    this.problemas = problemas;
  }
}

/**
 * Le um documento canonico a partir dos bytes, validando.
 *
 * E o ponto de entrada de quem consome (F3-02/03/04): bytes que nao
 * passam no oraculo nao existem.
 */
export function lerTimingCanonico(bytes: Buffer | string): TimingCanonico {
  const dados = JSON.parse(
    typeof bytes === "string" ? bytes : bytes.toString("utf-8"),
  ) as TimingCanonico;
  const problemas = validarTimingCanonico(dados);
  if (problemas.length > 0) {
    throw new ETimingCanonicoInvalido("(documento)", problemas);
  }
  return dados;
}

/**
 * Valida o documento canonico. Devolve a lista de problemas; vazia =
 * valido.
 */
export function validarTimingCanonico(doc: TimingCanonico): string[] {
  const problemas: string[] = [];

  // C1 — formato
  if (doc.schema_version !== FORMATO_TIMING_CANONICO) {
    problemas.push(
      `schema_version "${String(doc.schema_version)}" desconhecido ` +
        `(esperado ${FORMATO_TIMING_CANONICO})`,
    );
  }
  if (doc.unidade !== UNIDADE_SEGUNDOS) {
    problemas.push(
      `unidade do documento "${String(doc.unidade)}" — o contrato exige ${UNIDADE_SEGUNDOS}`,
    );
  }

  // C2 — o mapa de cenas existe e tem ao menos uma entrada. "Zero cenas"
  // e o modo de falha C1 aplicado ao timing: sucesso sem produto.
  const cenas = doc.cenas;
  if (cenas === undefined || typeof cenas !== "object" || Array.isArray(cenas)) {
    problemas.push("C2: 'cenas' ausente ou nao e um mapa");
    return problemas;
  }
  const ids = Object.keys(cenas);
  if (ids.length === 0) {
    problemas.push("C2: mapa de cenas vazio — documento sem produto");
    return problemas;
  }

  // C3/C4 — cada entrada
  for (const id of ids.sort()) {
    problemas.push(...validarEntrada(id, cenas[id] as EntradaDeCena));
  }

  return problemas;
}

/** Valida UMA entrada de cena. */
function validarEntrada(id: string, entrada: EntradaDeCena): string[] {
  const problemas: string[] = [];
  const rotulo = `cena "${id}"`;

  // C3a — a entrada declara a propria unidade, explicitamente (contrato).
  if (entrada.unidade !== UNIDADE_SEGUNDOS) {
    problemas.push(`${rotulo}: unidade "${String(entrada.unidade)}" — exige ${UNIDADE_SEGUNDOS}`);
  }

  // C3b — estado conhecido
  if (entrada.estado !== "locucao" && entrada.estado !== "silencio") {
    problemas.push(`${rotulo}: estado "${String(entrada.estado)}" desconhecido`);
    return problemas;
  }

  // C3c — duracao finita e positiva
  if (!Number.isFinite(entrada.duracao_s) || entrada.duracao_s <= 0) {
    problemas.push(
      `${rotulo}: duracao_s nao e um numero finito positivo (${String(entrada.duracao_s)})`,
    );
  }

  if (entrada.estado === "silencio") {
    // C3d — cena silenciosa nao carrega fala nenhuma. O proprio estado e
    // a declaracao de silencio; audio, texto ou palavras aqui seriam
    // contradicao (o schema tambem proibe, mas o oraculo nao pode
    // depender de o schema ter sido aplicado).
    const palavras = entrada.palavras;
    if (palavras !== undefined && palavras.length > 0) {
      problemas.push(
        `${rotulo}: estado "silencio" com ${palavras.length} palavra(s) — contradicao`,
      );
    }
    if (entrada.audio !== undefined) {
      problemas.push(
        `${rotulo}: estado "silencio" com campo 'audio' — cena silenciosa nao tem audio ligado`,
      );
    }
    return problemas;
  }

  // ─── estado = "locucao" ──────────────────────────────────────────────

  // C4a — a ligacao por conteudo: audio e SHA-256 hexadecimal.
  const audio = entrada.audio;
  if (typeof audio !== "string" || !/^[0-9a-f]{64}$/.test(audio)) {
    problemas.push(
      `${rotulo}: campo 'audio' ausente ou nao e SHA-256 — sem ele nao ha casamento por conteudo`,
    );
  }
  if (typeof entrada.texto !== "string" || entrada.texto.trim() === "") {
    problemas.push(`${rotulo}: texto ausente ou vazio`);
  }

  const palavras = entrada.palavras;
  if (!Array.isArray(palavras) || palavras.length === 0) {
    // C4b — audio com fala e zero palavras = "sucesso" sem produto (C1).
    problemas.push(
      `${rotulo}: estado "locucao" sem palavras — audio com fala e timing vazio`,
    );
  } else {
    problemas.push(...validarPalavras(rotulo, palavras, entrada.duracao_s));
  }

  const silencio = entrada.silencio;
  if (!Array.isArray(silencio)) {
    problemas.push(
      `${rotulo}: campo 'silencio' ausente — a semantica de silencio tem de ser declarada`,
    );
  } else {
    problemas.push(...validarSilencio(rotulo, silencio, palavras ?? [], entrada.duracao_s));
  }

  return problemas;
}

/** C5..C7 — a geometria das palavras. */
function validarPalavras(
  rotulo: string,
  palavras: readonly PalavraCanonica[],
  duracao_s: number,
): string[] {
  const problemas: string[] = [];
  let anteriorInicio = -Infinity;
  let anteriorFim = 0;

  palavras.forEach((p, i) => {
    const nome = `palavra ${i} ("${p.texto}")`;

    if (typeof p.texto !== "string" || p.texto.trim() === "") {
      problemas.push(`${rotulo}: ${nome} tem texto vazio`);
    }
    if (!Number.isFinite(p.inicio_s) || !Number.isFinite(p.fim_s)) {
      problemas.push(`${rotulo}: ${nome} tem tempo nao-finito (${p.inicio_s}..${p.fim_s})`);
      return;
    }

    // C5a — DURACAO NAO POSITIVA: fim <= inicio e a sonda negativa
    // "duracao negativa" do ∅-crit. Palavra de duracao zero ou negativa
    // some da legenda, ou a desenha para tras — as duas sem erro.
    if (p.fim_s <= p.inicio_s) {
      problemas.push(
        `${rotulo}: ${nome} tem duracao nao positiva ` +
          `(${p.inicio_s}..${p.fim_s})`,
      );
    }

    // C5b — FORA DE ORDEM: a palavra comeca antes da anterior.
    if (p.inicio_s < anteriorInicio - EPS_S) {
      problemas.push(
        `${rotulo}: ${nome} comeca em ${p.inicio_s}s, antes do inicio da ` +
          `anterior (${anteriorInicio}s) — fora de ordem`,
      );
    }

    // C5c — SOBREPOSICAO: a palavra comeca antes de a anterior TERMINAR.
    // E tambem a resposta a pergunta adversarial (1): legenda que
    // apareceria ANTES de a palavra ser falada. `anteriorFim` acumula o
    // maximo — espelha R4 de `validarTiming()` do F2-03.
    if (p.inicio_s < anteriorFim - EPS_S) {
      problemas.push(
        `${rotulo}: ${nome} comeca em ${p.inicio_s}s, antes do fim da ` +
          `anterior (${anteriorFim}s) — sobreposicao`,
      );
    }

    // C6 — dentro do audio: palavra nao pode comecar antes do byte zero
    // nem terminar depois do fim declarado.
    if (p.inicio_s < -EPS_S) {
      problemas.push(
        `${rotulo}: ${nome} comeca em ${p.inicio_s}s — antes do byte zero do audio`,
      );
    }
    if (p.fim_s > duracao_s + EPS_S) {
      problemas.push(
        `${rotulo}: ${nome} termina em ${p.fim_s}s, depois do fim da cena ` +
          `(${duracao_s}s)`,
      );
    }

    anteriorInicio = Math.max(anteriorInicio, p.inicio_s);
    anteriorFim = Math.max(anteriorFim, p.fim_s);
  });

  return problemas;
}

/** C7/C8 — a semantica de silencio declarada. */
function validarSilencio(
  rotulo: string,
  silencio: readonly IntervaloDeSilencio[],
  palavras: readonly PalavraCanonica[],
  duracao_s: number,
): string[] {
  const problemas: string[] = [];
  let anteriorFim = 0;

  silencio.forEach((s, i) => {
    const nome = `silencio ${i}`;
    if (!Number.isFinite(s.inicio_s) || !Number.isFinite(s.fim_s)) {
      problemas.push(`${rotulo}: ${nome} tem tempo nao-finito (${s.inicio_s}..${s.fim_s})`);
      return;
    }
    // C7a — intervalo de silencio valido e dentro da cena.
    if (s.fim_s <= s.inicio_s + EPS_S) {
      problemas.push(`${rotulo}: ${nome} nao e um intervalo (${s.inicio_s}..${s.fim_s})`);
    }
    if (s.inicio_s < -EPS_S || s.fim_s > duracao_s + EPS_S) {
      problemas.push(
        `${rotulo}: ${nome} (${s.inicio_s}..${s.fim_s}) fora de [0, ${duracao_s}]`,
      );
    }
    // C7b — silencios ordenados e sem sobreposicao entre si.
    if (s.inicio_s < anteriorFim - EPS_S) {
      problemas.push(
        `${rotulo}: ${nome} comeca em ${s.inicio_s}s, antes do fim do anterior ` +
          `(${anteriorFim}s)`,
      );
    }
    anteriorFim = Math.max(anteriorFim, s.fim_s);

    // C7c — silencio nao sobrepoe palavra: o silencio declarado tem de
    // estar nas lacunas, nunca em cima da fala.
    for (const p of palavras) {
      if (Number.isFinite(p.inicio_s) && Number.isFinite(p.fim_s)) {
        const sobrepoe =
          s.inicio_s < p.fim_s - EPS_S && s.fim_s > p.inicio_s + EPS_S;
        if (sobrepoe) {
          problemas.push(
            `${rotulo}: ${nome} (${s.inicio_s}..${s.fim_s}) sobrepoe a palavra ` +
              `"${p.texto}" (${p.inicio_s}..${p.fim_s})`,
          );
          break;
        }
      }
    }
  });

  // C8 — COBERTURA: palavras + silencio cobrem [0, duracao_s]. E o
  // invariante que amarra a semantica de silencio declarada as palavras:
  // nenhum produtor o calcula — premissa independente (pergunta
  // adversarial 3). Se um trecho do audio nao e nem fala nem silencio
  // declarado, o documento mente sobre o que ha ali.
  const intervalos: Array<{ inicio: number; fim: number }> = [];
  for (const p of palavras) {
    if (Number.isFinite(p.inicio_s) && Number.isFinite(p.fim_s)) {
      intervalos.push({ inicio: p.inicio_s, fim: p.fim_s });
    }
  }
  for (const s of silencio) {
    if (Number.isFinite(s.inicio_s) && Number.isFinite(s.fim_s)) {
      intervalos.push({ inicio: s.inicio_s, fim: s.fim_s });
    }
  }
  intervalos.sort((a, b) => a.inicio - b.inicio);

  let cobertoAte = 0; // mesclagem: maximo do fim ja coberto
  for (const iv of intervalos) {
    if (iv.inicio > cobertoAte + EPS_S) {
      problemas.push(
        `${rotulo}: buraco de ${iv.inicio - cobertoAte}s entre ${cobertoAte}s e ` +
          `${iv.inicio}s — trecho nem fala nem silencio declarado ` +
          "(invariante de cobertura)",
      );
    }
    cobertoAte = Math.max(cobertoAte, iv.fim);
  }
  if (cobertoAte < duracao_s - EPS_S) {
    problemas.push(
      `${rotulo}: fim da cena (${duracao_s}s) nao coberto — cobertura termina ` +
        `em ${cobertoAte}s (invariante de cobertura)`,
    );
  }

  return problemas;
}
