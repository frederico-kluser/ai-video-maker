#!/usr/bin/env npx tsx
/**
 * tools/gates/verificar-gates.ts
 *
 * O ∅-CRIT EXECUTÁVEL DO CARD F6-03 — `just gates-bloqueia`.
 *
 * Valida o estado corrente de docs/gates/** (os cinco gates numerados de
 * publicação P-1..P-5 — PROGRAMA.html:2995). O runbook de publicação (F6-02,
 * W11) o consome no fechamento; `just gates-validar` (tools/gates/gate.ts) o
 * exercita com sondas.
 *
 * O comando falha (exit 1, VERMELHO) quando, para o diretório pedido:
 *
 *   1. algum gate P-1..P-5 está AUSENTE — presença por gate, nunca lista
 *      fechada (a pergunta obrigatória da W10); diretório vazio ou sem
 *      nenhuma seção reconhecível = falha (all([]) não aprova nada);
 *   2. o documento não declara o número do gate esperado (F6-03:gate);
 *   3. o veredito não é um dos três possíveis (CONFERE/REPROVADO/NÃO_COLETADO);
 *   4. o veredito é `CONFERE` SEM EVIDÊNCIA ANEXADA — o ∅-crit do card: um
 *      gate com veredito CONFERE sem evidência anexada TEM de falhar
 *      (PROGRAMA.html, Apêndice G — "um veredito que não pode existir").
 *      Evidência = saída de comando SALVA: bloco anexado no documento
 *      (marcador F6-03:evidencia-anexada + bloco de código) ou arquivo em
 *      docs/gates/evidencias/ (F6-03:evidencia-arquivo, existente e não
 *      vazio). Exceção estrutural: o GATE P-5 (fecho consolidado) declara
 *      F6-03:evidencia-auto=VERIFICADOR — a evidência dele é a saída da
 *      própria rodada de verificação, salva pelo operador no ato;
 *   5. o veredito é `REPROVADO` ou `NÃO_COLETADO` — ambos BLOQUEIAM a
 *      publicação; `NÃO_COLETADO` nunca vira `CONFERE` sozinho (sem a
 *      execução do comando e a saída salva, o veredito não troca);
 *   6. a assinatura não nomeia um dos QUATRO papéis da política §3
 *      (acentuados, vocabulário único em tools/revisao/formato.ts) — nunca
 *      "o time"; sem nome de quem assina ou sem data válida quando o
 *      veredito é CONFERE.
 *
 * Zero gates reconhecíveis = falha (zero itens parseados não aprova nada —
 * C2/falsifiable-gates). Quando tudo fecha (os cinco gates CONFERE com
 * evidência anexada), imprime VERDE: a publicação está autorizada.
 *
 * Uso:
 *   npx tsx tools/gates/verificar-gates.ts [--dir <caminho>]
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PAPEIS_DO_DOSSIE } from "../revisao/formato.js";

// ─── Caminhos ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Raiz do repositorio, resolvida a partir deste arquivo. */
const RAIZ = resolve(__dirname, "..", "..");
const DIRETORIO_GATES = join(RAIZ, "docs", "gates");

/** Os cinco gates numerados de publicação (presença per gate, nunca lista fechada). */
const GATES_ESPERADOS: readonly string[] = ["P-1", "P-2", "P-3", "P-4", "P-5"];

/** Vereditos possíveis de um gate (a tríade do F6-03). */
const VEREDITOS_VALIDOS: ReadonlySet<string> = new Set(["CONFERE", "REPROVADO", "NÃO_COLETADO"]);

// ─── Argumentos ─────────────────────────────────────────────────────────────────

interface Argumentos {
  readonly dir: string;
}

function parsearArgumentos(argv: readonly string[]): Argumentos {
  let dir = DIRETORIO_GATES;
  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i] ?? "";
    if (atual === "--dir") {
      dir = resolve(RAIZ, argv[i + 1] ?? "docs/gates");
      i += 1;
    } else {
      console.error(`argumento desconhecido: ${atual}`);
      process.exit(2);
    }
  }
  return { dir };
}

// ─── Parsing dos documentos de gate ─────────────────────────────────────────────

interface DocumentoGate {
  readonly nome: string;
  readonly marcadorGate: string | null;
  readonly veredito: string | null;
  readonly assinadoPor: string | null;
  readonly assinadoEm: string | null;
  readonly evidencia: string | null;
  readonly evidenciaArquivo: string | null;
  readonly evidenciaAnexada: boolean;
  readonly evidenciaAuto: boolean;
  readonly nomeAssinante: string;
  readonly texto: string;
}

function extrairMarcador(texto: string, chave: string): string | null {
  const m = new RegExp(`<!-- F6-03:${chave}=([^>]+) -->`).exec(texto);
  return m === null ? null : (m[1] ?? null);
}

function parsearGate(nome: string, texto: string): DocumentoGate {
  return {
    nome,
    marcadorGate: extrairMarcador(texto, "gate"),
    veredito: extrairMarcador(texto, "veredito"),
    assinadoPor: extrairMarcador(texto, "assinado_por"),
    assinadoEm: extrairMarcador(texto, "assinado_em"),
    evidencia: extrairMarcador(texto, "evidencia"),
    evidenciaArquivo: extrairMarcador(texto, "evidencia-arquivo"),
    evidenciaAnexada: texto.includes("<!-- F6-03:evidencia-anexada -->"),
    evidenciaAuto: texto.includes("<!-- F6-03:evidencia-auto=VERIFICADOR -->"),
    nomeAssinante: /^- \*\*nome:\*\* (.+)$/m.exec(texto)?.[1]?.trim() ?? "",
    texto,
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parsearArgumentos(process.argv.slice(2));
  let falhas = 0;

  const falhou = (motivo: string): void => {
    console.log(`  [FALHOU] ${motivo}`);
    falhas += 1;
  };
  const ok = (motivo: string): void => {
    console.log(`  [OK]     ${motivo}`);
  };

  console.log("=== gates-bloqueia — veredito consolidado dos gates P-1..P-5 (F6-03, W11) ===");
  console.log(`--- [1/4] presenca dos gates numerados (pergunta obrigatoria: PRESENCA, nunca lista fechada) ---`);

  let arquivos: string[];
  try {
    arquivos = await readdir(args.dir);
  } catch {
    falhou(
      `diretorio ${args.dir} ausente ou ilegivel — nenhum documento de gate; diretório vazio não aprova nada`,
    );
    console.log("gates-bloqueia: VERMELHO (1 falha) — publicação bloqueada");
    process.exit(1);
  }

  let reconhecidos = 0;
  const documentos = new Map<string, DocumentoGate>();
  for (const nome of GATES_ESPERADOS) {
    const caminho = join(args.dir, `${nome}.md`);
    try {
      const texto = await readFile(caminho, "utf-8");
      documentos.set(nome, parsearGate(nome, texto));
      reconhecidos += 1;
      ok(`GATE ${nome} presente (${caminho})`);
    } catch {
      falhou(`GATE ${nome} AUSENTE — presenca por gate, nunca lista fechada (procurei ${caminho})`);
    }
  }

  console.log("--- [2/4] secoes reconheciveis (zero itens parseados = falha) ---");
  if (reconhecidos === 0) {
    falhou("nenhum documento de gate reconhecível — zero itens parseados não aprova nada");
  } else {
    ok(`${reconhecidos} documentos de gate reconhecíveis`);
  }

  console.log("--- [3/4] veredito, evidencia anexada e assinatura por papel (gate a gate) ---");
  for (const nome of GATES_ESPERADOS) {
    const doc = documentos.get(nome);
    if (doc === undefined) continue;

    if (doc.marcadorGate !== nome) {
      falhou(`GATE ${nome}: documento não declara o número esperado (achado: \`${doc.marcadorGate ?? "(ausente)"}\`)`);
    }
    if (!doc.texto.includes(`# GATE ${nome} —`)) {
      falhou(`GATE ${nome}: cabeçalho \`# GATE ${nome} —\` ausente — o nome tem de casar com o runbook F6-02`);
    }
    if (!doc.texto.includes("## O dano que este gate previne")) {
      falhou(`GATE ${nome}: sem a seção do dano concreto ("O dano que este gate previne") — "boas práticas" não é dano`);
    }
    for (const vereditoPossivel of ["CONFERE", "REPROVADO", "NÃO_COLETADO"]) {
      if (!doc.texto.includes(vereditoPossivel)) {
        falhou(`GATE ${nome}: não declara o veredito possível \`${vereditoPossivel}\``);
      }
    }

    const veredito = doc.veredito;
    if (veredito === null) {
      falhou(`GATE ${nome}: sem veredito declarado`);
      continue;
    }
    if (!VEREDITOS_VALIDOS.has(veredito)) {
      falhou(`GATE ${nome}: veredito inválido \`${veredito}\` (possíveis: CONFERE / REPROVADO / NÃO_COLETADO)`);
      continue;
    }

    // Papel nomeado — o vocabulário são os quatro papéis acentuados da política §3.
    const papel = doc.assinadoPor;
    if (papel === null || !PAPEIS_DO_DOSSIE.includes(papel)) {
      falhou(
        `GATE ${nome}: assinatura não nomeia papel válido (achado: \`${papel ?? "(ausente)"}\`) — os quatro papéis acentuados de tools/revisao/formato.ts; nunca "o time"`,
      );
    } else {
      ok(`GATE ${nome}: assinado por papel nomeado ${papel}`);
    }

    if (veredito === "CONFERE") {
      // O ∅-crit do F6-03: CONFERE sem evidência anexada TEM de falhar.
      const evidencia = doc.evidencia;
      const temBlocoAnexado =
        doc.evidenciaAnexada && doc.texto.indexOf("```", doc.texto.indexOf("<!-- F6-03:evidencia-anexada -->")) !== -1;
      let temArquivo = false;
      if (doc.evidenciaArquivo !== null) {
        const caminho = resolve(args.dir, doc.evidenciaArquivo);
        try {
          const info = await stat(caminho);
          temArquivo = info.size > 0;
        } catch {
          temArquivo = false;
        }
      }
      const fechoConsolidado = nome === "P-5" && doc.evidenciaAuto;
      if (evidencia === null || evidencia === "") {
        falhou(`GATE ${nome}: CONFERE sem descrição da evidência anexada — ∅-crit do F6-03`);
      } else if (!temBlocoAnexado && !temArquivo && !fechoConsolidado) {
        falhou(
          `GATE ${nome}: CONFERE sem evidência ANEXADA — saída de comando salva nunca afirmação; ∅-crit do F6-03`,
        );
      } else if (!temBlocoAnexado && !temArquivo && fechoConsolidado) {
        ok(`GATE ${nome}: CONFERE com evidência auto-referente (a rodada final do verificador — F6-03:evidencia-auto)`);
      } else {
        ok(`GATE ${nome}: CONFERE com evidência anexada (${evidencia})`);
      }
      if (doc.evidenciaArquivo !== null && !temArquivo) {
        falhou(`GATE ${nome}: evidência referenciada não existe ou está vazia: ${doc.evidenciaArquivo}`);
      }
      if (doc.assinadoEm === null || !/^\d{4}-\d{2}-\d{2}$/.test(doc.assinadoEm)) {
        falhou(`GATE ${nome}: CONFERE sem data válida de assinatura (achado: \`${doc.assinadoEm ?? "(ausente)"}\`)`);
      }
      if (doc.nomeAssinante === "" || doc.nomeAssinante === "_(preencher)_") {
        falhou(`GATE ${nome}: CONFERE sem nome de quem assina`);
      } else if (/^o time$/i.test(doc.nomeAssinante) || /^a equipe$/i.test(doc.nomeAssinante)) {
        falhou(`GATE ${nome}: assinado como "o time" — a política exige papel NOMEADO (nunca o coletivo)`);
      }
    } else if (veredito === "REPROVADO") {
      falhou(`GATE ${nome}: REPROVADO — condição reprovou; publicação bloqueada`);
    } else {
      falhou(
        `GATE ${nome}: NÃO_COLETADO — evidência não coletada; nunca vira CONFERE sozinho; publicação bloqueada`,
      );
    }
  }

  console.log("--- [4/4] alavanca-mestra citada (politica §2.3) ---");
  const readme = join(args.dir, "README.md");
  try {
    const texto = await readFile(readme, "utf-8");
    if (!texto.includes("alavanca-mestra")) {
      falhou("README.md não cita a alavanca-mestra (política §2.3)");
    } else {
      ok("README.md cita a alavanca-mestra");
    }
  } catch {
    falhou("README.md ausente no diretório de gates");
  }

  console.log("");
  if (falhas > 0) {
    console.log(`gates-bloqueia: VERMELHO (${falhas} falha(s)) — publicação bloqueada`);
    process.exit(1);
  }
  console.log("gates-bloqueia: VERDE — os cinco gates CONFERE com evidência anexada");
  console.log("Publicação autorizada: o runbook F6-02 pode executar o ato de publicação (fase 2+).");
}

main().catch((erro: unknown) => {
  console.error(`FALHOU: ${(erro as Error).message ?? String(erro)}`);
  process.exit(1);
});
