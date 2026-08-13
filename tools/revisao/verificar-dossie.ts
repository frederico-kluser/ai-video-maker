#!/usr/bin/env npx tsx
/**
 * tools/revisao/verificar-dossie.ts
 *
 * O ∅-CRIT EXECUTÁVEL DO CARD F6-01 — gate G-HUM (PROGRAMA.html:2994).
 *
 * `just revisar-bloqueia` chama isto. A **alavanca-mestra** da política
 * editorial (docs/politica-editorial.md §2) é a flag que desliga a
 * publicação inteira; o ponto em que o dossiê entra nela é este gate:
 * **a publicação exige dossiê assinado — sem dossiê, bloqueia.**
 *
 * O comando falha (exit 1, VERMELHO) quando, para a entrega pedida:
 *
 *   1. o arquivo do dossiê NÃO EXISTE — "entrega sem dossiê" (∅-crit: o
 *      dossiê é pré-condição, não pós-condição);
 *   2. o dossiê não declara a identidade da entrega pedida;
 *   3. o relatório de procedência embutido está ausente, ilegível ou com
 *      hash divergente do `relatorio-procedencia.json` da entrega;
 *   4. a regeneração (AB-748) está `DIVERGENTE`;
 *   5. a declaração de enquadramento (AB-993) está ausente ou o gatilho
 *      AB-950 não está declarado (ADR-0003: omissão é falha de gate);
 *   6. o disclosure de voz sintética (AB-999) está ausente;
 *   7. algum item obrigatório do checklist está sem veredito ou com
 *      veredito inválido (nomeia o item; `NAO_APLICAVEL` só vale no J2);
 *   8. alguma das QUATRO assinaturas por papel está ausente, sem nome ou
 *      sem data (nomeia o papel); veredito global `REPROVADO` = entrega
 *      reprovada na revisão;
 *   9. a entrega pedida não existe em --saida — "nada a publicar",
 *      bloqueado (a ausência nunca aprova).
 *
 * Zero seções reconhecíveis no dossiê = falha (all([]) não aprova nada —
 * C2/falsifiable-gates). Quando tudo fecha, imprime VERDE: a publicação
 * pode seguir para os gates P-1..P-5 (F6-03, W11).
 *
 * Uso:
 *   npx tsx tools/revisao/verificar-dossie.ts [--entrega <id>] [--saida <dir>] [--dossie <caminho>]
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAPEIS_DO_DOSSIE,
  ITENS_OBRIGATORIOS,
  VEREDITOS_DE_ITEM,
  VEREDITOS_GLOBAIS,
  DECLARACOES_AB950,
  ITENS_QUE_ADMITEM_NAO_APLICAVEL,
} from "./formato.js";

// ─── Caminhos ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Raiz do repositorio, resolvida a partir deste arquivo. */
const RAIZ = resolve(__dirname, "..", "..");
const DIRETORIO_DOSSIES = join(RAIZ, "docs", "revisao");

// ─── Argumentos ─────────────────────────────────────────────────────────────────

interface Argumentos {
  readonly entrega: string;
  readonly saida: string;
  readonly dossie: string;
}

function parsearArgumentos(argv: readonly string[]): Argumentos {
  let entrega = "canonico";
  let saida = join(RAIZ, "output");
  let dossie = "";
  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i] ?? "";
    if (atual === "--entrega") {
      entrega = argv[i + 1] ?? "canonico";
      i += 1;
    } else if (atual === "--saida") {
      saida = resolve(RAIZ, argv[i + 1] ?? "output");
      i += 1;
    } else if (atual === "--dossie") {
      dossie = resolve(RAIZ, argv[i + 1] ?? "");
      i += 1;
    } else {
      console.error(`argumento desconhecido: ${atual}`);
      process.exit(2);
    }
  }
  if (dossie === "") dossie = join(DIRETORIO_DOSSIES, `dossie-${entrega}.md`);
  return { entrega, saida, dossie };
}

// ─── Parsing do dossie ──────────────────────────────────────────────────────────

interface Marcador {
  readonly entrega: string | null;
  readonly relatorioEmbutidoHash: string | null;
  readonly relatorioFinalHash: string | null;
  readonly regeneracao: string | null;
  readonly enquadramento: string | null;
  readonly ab950: string | null;
  readonly disclosure: string | null;
  readonly gaps: string | null;
  readonly vereditos: ReadonlyMap<string, string>;
  readonly assinaturas: ReadonlyMap<string, { nome: string; data: string; veredito: string }>;
}

function extrairMarcador(texto: string, chave: string): string | null {
  const m = new RegExp(`<!-- F6-01:${chave}=([^>]+) -->`).exec(texto);
  return m === null ? null : (m[1] ?? null);
}

function parsearDossie(texto: string): Marcador {
  const vereditos = new Map<string, string>();
  const regexVeredito = /^- \[ \] ([A-Z][0-9]) — veredito: `([^`]+)`/gm;
  for (const m of texto.matchAll(regexVeredito)) {
    const item = m[1];
    const valor = m[2];
    if (item !== undefined && valor !== undefined && !vereditos.has(item)) {
      vereditos.set(item, valor);
    }
  }

  const assinaturas = new Map<string, { nome: string; data: string; veredito: string }>();
  for (const papel of PAPEIS_DO_DOSSIE) {
    const bloco = new RegExp(`### Assinatura — ${papel}\\n([\\s\\S]*?)(?=### |\\n---|$)`).exec(texto);
    if (bloco === null) continue;
    const corpo = bloco[1] ?? "";
    const nome = /^- \*\*nome:\*\* (.+)$/m.exec(corpo)?.[1]?.trim() ?? "";
    const data = /^- \*\*data:\*\* (.+)$/m.exec(corpo)?.[1]?.trim() ?? "";
    const veredito = /^- \*\*veredito global:\*\* `([^`]+)`/m.exec(corpo)?.[1]?.trim() ?? "";
    assinaturas.set(papel, { nome, data, veredito });
  }

  return {
    entrega: extrairMarcador(texto, "dossie:entrega"),
    relatorioEmbutidoHash: extrairMarcador(texto, "relatorio-embutido-hash"),
    relatorioFinalHash: extrairMarcador(texto, "relatorio-final-hash"),
    regeneracao: extrairMarcador(texto, "regeneracao"),
    enquadramento: extrairMarcador(texto, "enquadramento"),
    ab950: extrairMarcador(texto, "ab950"),
    disclosure: extrairMarcador(texto, "disclosure"),
    gaps: extrairMarcador(texto, "gaps"),
    vereditos,
    assinaturas,
  };
}

function sha256DoArquivo(texto: string): string {
  return createHash("sha256").update(texto, "utf-8").digest("hex");
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

  console.log(`=== revisar-bloqueia — gate G-HUM para a entrega ${args.entrega} ===`);
  console.log(`--- [1/9] presenca do dossie (∅-crit: pre-condicao, nunca pos-condicao) ---`);
  let texto: string;
  try {
    texto = await readFile(args.dossie, "utf-8");
    ok(`dossiê encontrado: ${args.dossie}`);
  } catch {
    falhou(
      `entrega ${args.entrega} sem dossiê (procurei ${args.dossie}) — publicação bloqueada (G-HUM, alavanca-mestra)`,
    );
    console.log("revisar-bloqueia: VERMELHO");
    process.exit(1);
  }

  const doc = parsearDossie(texto);

  console.log("--- [2/9] secoes reconheciveis (zero itens parseados = falha) ---");
  const marcadoresPresentes =
    (doc.entrega === null ? 0 : 1) +
    (doc.relatorioEmbutidoHash === null ? 0 : 1) +
    (doc.regeneracao === null ? 0 : 1) +
    (doc.enquadramento === null ? 0 : 1) +
    (doc.ab950 === null ? 0 : 1) +
    (doc.disclosure === null ? 0 : 1) +
    (doc.gaps === null ? 0 : 1) +
    doc.vereditos.size +
    doc.assinaturas.size;
  if (marcadoresPresentes === 0) {
    falhou("dossiê sem nenhuma seção reconhecível — zero itens parseados não aprova nada");
  } else {
    ok(`${marcadoresPresentes} seções reconhecíveis`);
  }

  console.log("--- [3/9] identidade da entrega ---");
  if (doc.entrega !== args.entrega) {
    falhou(`dossiê declara a entrega \`${doc.entrega ?? "(ausente)"}\`, pedida \`${args.entrega}\``);
  } else {
    ok(`dossiê cobre a entrega ${args.entrega}`);
  }
  if (doc.relatorioFinalHash === null) {
    falhou("dossiê sem hash do relatorio-final.json (identidade da entrega incompleta)");
  } else {
    ok(`hash relatorio-final.json declarado: ${doc.relatorioFinalHash.slice(0, 16)}…`);
  }

  console.log("--- [4/9] relatorio de procedencia embutido (F5-06) ---");
  if (doc.relatorioEmbutidoHash === null) {
    falhou("dossiê sem o relatório de procedência embutido (seção 3 ausente ou ilegível)");
  } else {
    ok(`relatório embutido declarado: ${doc.relatorioEmbutidoHash.slice(0, 16)}…`);
  }
  if (!/```json[\s\S]*```/.test(texto)) {
    falhou("dossiê sem o bloco JSON do relatório de procedência (seção 3)");
  }

  console.log("--- [5/9] regeneracao (AB-748: relatorio regeneravel dos mesmos commitados) ---");
  if (doc.regeneracao === "CONSISTENTE") {
    ok("regeneração CONSISTENTE");
  } else if (doc.regeneracao === "DIVERGENTE") {
    falhou("regeneração DIVERGENTE — o relatório regenerado diverge nos vereditos essenciais");
  } else {
    falhou(`regeneração não declarada (achado: \`${doc.regeneracao ?? "(ausente)"}\`)`);
  }

  console.log("--- [6/9] enquadramento (AB-993) e disclosure de voz (AB-999) ---");
  if (doc.enquadramento === "DECLARADO" && doc.ab950 !== null && DECLARACOES_AB950.has(doc.ab950)) {
    ok(`enquadramento declarado: ${doc.ab950}`);
  } else {
    falhou(
      `declaração de enquadramento ausente ou inválida (achado: \`${doc.ab950 ?? "(ausente)"}\`) — AB-993, nunca omitido`,
    );
  }
  if (doc.disclosure === "DECLARADO") {
    ok("disclosure de voz sintética declarado (AB-999)");
  } else {
    falhou("disclosure de voz sintética ausente (AB-999 — obrigação do provedor)");
  }
  if (doc.gaps === "DECLARADO") {
    ok("gaps de data visíveis (AB-746 — visíveis, não omitidos)");
  } else {
    falhou("seção de gaps de data ausente — os gaps têm de estar visíveis no dossiê");
  }

  console.log("--- [7/9] vereditos do checklist (item por item) ---");
  let reprovado = false;
  for (const item of ITENS_OBRIGATORIOS) {
    const valor = doc.vereditos.get(item);
    if (valor === undefined || valor === "PENDENTE") {
      falhou(`item ${item} sem veredito — PENDENTE: o humano não respondeu`);
      continue;
    }
    if (!VEREDITOS_DE_ITEM.has(valor)) {
      falhou(`item ${item} com veredito inválido: \`${valor}\``);
      continue;
    }
    if (valor === "NAO_APLICAVEL" && !ITENS_QUE_ADMITEM_NAO_APLICAVEL.has(item)) {
      falhou(`item ${item} não admite NÃO_APLICÁVEL (só o J2 é condicional)`);
      continue;
    }
    if (valor === "REPROVADO") {
      reprovado = true;
      falhou(`item ${item} REPROVADO — entrega reprovada na revisão humana`);
      continue;
    }
    ok(`item ${item}: ${valor}`);
  }

  console.log("--- [8/9] assinaturas por papel nomeado (nunca 'o time') ---");
  for (const papel of PAPEIS_DO_DOSSIE) {
    const assinatura = doc.assinaturas.get(papel);
    if (assinatura === undefined) {
      falhou(`assinatura do papel ${papel} ausente`);
      continue;
    }
    if (assinatura.nome === "" || assinatura.nome === "_(preencher)_") {
      falhou(`papel ${papel} sem nome de quem assina`);
      continue;
    }
    if (/^o time$/i.test(assinatura.nome.trim()) || /^a equipe$/i.test(assinatura.nome.trim())) {
      falhou(`papel ${papel} assinado como "o time" — a política exige papel NOMEADO (nunca o coletivo)`);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(assinatura.data)) {
      falhou(`papel ${papel} sem data válida (achado: \`${assinatura.data}\`)`);
      continue;
    }
    if (!VEREDITOS_GLOBAIS.has(assinatura.veredito)) {
      falhou(`papel ${papel} sem veredito global (achado: \`${assinatura.veredito}\`)`);
      continue;
    }
    if (assinatura.veredito === "REPROVADO") {
      reprovado = true;
      falhou(`papel ${papel} REPROVOU a entrega — revisão não aprovada`);
      continue;
    }
    ok(`${papel} assinado por ${assinatura.nome} em ${assinatura.data} (${assinatura.veredito})`);
  }
  if (reprovado) {
    falhou("veredito REPROVADO presente — dossiê não pode liberar a publicação");
  }

  console.log("--- [9/9] a entrega existe e o relatório embutido fecha com ela ---");
  let relatorioFinalExiste = true;
  let relatorioProcedenciaTexto: string | null = null;
  try {
    await readFile(join(args.saida, "relatorio-final.json"), "utf-8");
  } catch {
    relatorioFinalExiste = false;
  }
  if (relatorioFinalExiste) {
    try {
      relatorioProcedenciaTexto = await readFile(join(args.saida, "relatorio-procedencia.json"), "utf-8");
    } catch {
      relatorioProcedenciaTexto = null;
    }
    if (relatorioProcedenciaTexto === null) {
      falhou(`entrega ${args.entrega} sem relatorio-procedencia.json em ${args.saida}`);
    } else {
      const hashDaEntrega = sha256DoArquivo(relatorioProcedenciaTexto);
      if (doc.relatorioEmbutidoHash !== null && doc.relatorioEmbutidoHash !== hashDaEntrega) {
        falhou(
          `hash do relatório embutido (${doc.relatorioEmbutidoHash.slice(0, 16)}…) não fecha com o relatorio-procedencia.json da entrega (${hashDaEntrega.slice(0, 16)}…) — dossiê de outra entrega`,
        );
      } else {
        ok(`relatório embutido fecha com o relatorio-procedencia.json da entrega`);
      }
    }
  } else {
    falhou(
      `entrega ${args.entrega} ausente em ${args.saida} (sem relatorio-final.json) — nada a publicar; bloqueado (ausência nunca aprova)`,
    );
  }

  console.log("");
  if (falhas > 0) {
    console.log(`revisar-bloqueia: VERMELHO (${falhas} falha(s)) — publicação bloqueada (G-HUM, alavanca-mestra)`);
    process.exit(1);
  }
  console.log("revisar-bloqueia: VERDE — dossiê válido para a entrega " + args.entrega);
  console.log("G-HUM liberado: a publicação pode seguir para os gates P-1..P-5 (F6-03, W11).");
}

main().catch((erro: unknown) => {
  console.error(`FALHOU: ${(erro as Error).message ?? String(erro)}`);
  process.exit(1);
});
