#!/usr/bin/env npx tsx
/**
 * tools/revisao/gerar-dossie.ts
 *
 * O GERADOR DO DOSSIÊ DE REVISÃO — card F6-01 (W10).
 *
 * `just revisar` chama isto. Gera o rascunho do dossiê para uma entrega:
 * docs/revisao/dossie-<entrega>.md (default).
 *
 * O dossiê é o registro da fase 1 da política editorial (docs/politica-
 * editorial.md §1): a prova de que o vídeo passou na revisão humana com
 * aprovação nominal. Sem dossiê assinado, a publicação é impossível (gate
 * G-HUM, que consome a alavanca-mestra da política — PROGRAMA.html:2994).
 *
 * Este gerador produz o RASCUNHO: as seções que a máquina conhece
 * preenchidas, as decisões humanas (vereditos do checklist + assinaturas
 * por papel) em branco. **Nunca assina nada** — um dossiê recém-gerado é
 * inválido por construção, e é isso que o ∅-crit exige (gerar ≠ aprovar).
 *
 * Os valores que o gate lê (vereditos, assinaturas) vivem no TEXTO VISÍVEL
 * do markdown — quem assina edita o que lê, não um marcador escondido.
 * Campos emitidos só pela máquina (identidade, hashes, regeneração,
 * enquadramento, disclosure, gaps) usam marcadores HTML comentados
 * `<!-- F6-01:... -->` — o gate os confere e nunca são decisão humana.
 *
 * Consome (nunca edita): src/entrega/procedencia/relatorio.ts
 * (gerarRelatorio + adaptarStore), src/resolucao/descoberta.js
 * (verificarCobertura), src/resolucao/contrato.js (ORDEM_ESTAGIOS,
 * hashDoManifesto), src/resolucao/cassete/formato.js, fixtures/cassetes,
 * fixtures/canonico/manifesto-valido.json.
 *
 * Uso:
 *   npx tsx tools/revisao/gerar-dossie.ts [--entrega <id>] [--saida <dir>] [--dossie <caminho>]
 *
 * Quando a entrega não existe em --saida, o gerador monta a ENTREGA DE
 * FIXTURE dos cassetes commitados (o mesmo material que o gate do F5-06 usa
 * como "vídeo final") e gera o dossiê a partir dela — o rascunho nasce em
 * qualquer checkout, sem render.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gerarRelatorio } from "../../src/entrega/procedencia/relatorio.js";
import type { RelatorioProcedencia } from "../../src/entrega/procedencia/formato.js";
import { serializarRelatorio } from "../../src/entrega/procedencia/formato.js";
import { verificarCobertura } from "../../src/resolucao/descoberta.js";
import { ORDEM_ESTAGIOS, hashDoManifesto } from "../../src/resolucao/contrato.js";
import { ARQUIVO_CABECALHO, RAIZ_CASSETES_PADRAO } from "../../src/resolucao/cassete/formato.js";
import type { CabecalhoCassete } from "../../src/resolucao/cassete/formato.js";
import type {
  AssetResolvido,
  ManifestoResolvido,
  Sha256,
  RegistroEstagio,
} from "../../src/resolucao/manifesto-resolvido.js";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import {
  PAPEIS_DO_DOSSIE,
  ITENS_POR_PAPEL,
  DECLARACOES_AB950,
} from "./formato.js";

// ─── Caminhos ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Raiz do repositorio, resolvida a partir deste arquivo. */
const RAIZ = resolve(__dirname, "..", "..");

const CAMINHO_MANIFESTO_CANONICO = join(RAIZ, "fixtures", "canonico", "manifesto-valido.json");
const DIRETORIO_DOSSIES = join(RAIZ, "docs", "revisao");

/** Identificador default da entrega (a fixture canonica do F5-07). */
const ENTREGA_DEFAULT = "canonico";

// ─── Argumentos ─────────────────────────────────────────────────────────────────

interface Argumentos {
  readonly entrega: string;
  readonly saida: string;
  readonly dossie: string;
}

function parsearArgumentos(argv: readonly string[]): Argumentos {
  let entrega = ENTREGA_DEFAULT;
  let saida = join(RAIZ, "output");
  let dossie = "";
  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i] ?? "";
    if (atual === "--entrega") {
      entrega = argv[i + 1] ?? ENTREGA_DEFAULT;
      i += 1;
    } else if (atual === "--saida") {
      saida = resolve(RAIZ, argv[i + 1] ?? "output");
      i += 1;
    } else if (atual === "--dossie") {
      dossie = resolve(RAIZ, argv[i + 1] ?? "");
      i += 1;
    } else {
      console.error(`argumento desconhecido: ${atual}`);
      console.error("uso: npx tsx tools/revisao/gerar-dossie.ts [--entrega <id>] [--saida <dir>] [--dossie <caminho>]");
      process.exit(2);
    }
  }
  if (dossie === "") dossie = join(DIRETORIO_DOSSIES, `dossie-${entrega}.md`);
  return { entrega, saida, dossie };
}

// ─── Montagem da entrega de fixture (material commitado, sem render) ────────────

/** O "video final" da W7, montado dos cassetes commitados (F5-06 gate §1). */
async function montarResolvidoDosCassetes(
  raizCassetes: string,
  manifestoBase: Manifesto,
): Promise<ManifestoResolvido> {
  const cobertura = await verificarCobertura({ raizCassetes });
  if (!cobertura.ok) {
    throw new Error(
      "denominador: cobertura de cassetes falhou — " +
        cobertura.cobertura
          .flatMap((c) => c.problemas.map((p) => p.split("\n")[0]))
          .join(" | "),
    );
  }

  const assets: Record<string, AssetResolvido> = {};
  const mapas: Record<string, Record<string, Sha256>> = {
    nos_midia: {},
    nos_locucao: {},
    nos_grafico: {},
    nos_codigo: {},
    nos_musica: {},
  };
  let trilha_sonora: Sha256 | null = null;
  const estagios: RegistroEstagio[] = [];

  for (const nome of ORDEM_ESTAGIOS) {
    const porEstagio = cobertura.cobertura.find((c) => c.nome === nome);
    if (porEstagio === undefined || porEstagio.chaves.length === 0) continue;
    for (const chave of [...porEstagio.chaves].sort()) {
      const cabecalho = JSON.parse(
        await readFile(join(raizCassetes, nome, chave, ARQUIVO_CABECALHO), "utf-8"),
      ) as CabecalhoCassete;
      const parcial = JSON.parse(
        await readFile(join(raizCassetes, nome, chave, "resultado.json"), "utf-8"),
      ) as {
        assets: Record<string, AssetResolvido>;
        nos_midia?: Record<string, Sha256>;
        nos_locucao?: Record<string, Sha256>;
        nos_grafico?: Record<string, Sha256>;
        nos_codigo?: Record<string, Sha256>;
        nos_musica?: Record<string, Sha256>;
        trilha_sonora?: Sha256 | null;
      };

      for (const [hash, asset] of Object.entries(parcial.assets)) {
        assets[hash] = asset;
      }
      for (const campo of Object.keys(mapas)) {
        const origem = (parcial as unknown as Record<string, Record<string, Sha256> | undefined>)[campo];
        if (origem === undefined) continue;
        for (const [no, hash] of Object.entries(origem)) {
          mapas[campo]![no] = hash;
        }
      }
      if (parcial.trilha_sonora !== null && parcial.trilha_sonora !== undefined) {
        trilha_sonora = parcial.trilha_sonora;
      }
      estagios.push({
        estagio: nome,
        versaoEstagio: cabecalho.componentes.versaoEstagio,
        chave,
        origem: "cassete",
      });
    }
  }

  const ordenar = <T,>(m: Record<string, T>): Record<string, T> => {
    const saida: Record<string, T> = {};
    for (const k of Object.keys(m).sort()) saida[k] = m[k] as T;
    return saida;
  };

  return {
    schema_version: "ManifestoResolvido.1",
    hash_manifesto_original: hashDoManifesto(manifestoBase),
    manifesto: manifestoBase,
    assets: ordenar(assets),
    nos_midia: ordenar(mapas.nos_midia!),
    nos_locucao: ordenar(mapas.nos_locucao!),
    nos_grafico: ordenar(mapas.nos_grafico!),
    nos_codigo: ordenar(mapas.nos_codigo!),
    nos_musica: ordenar(mapas.nos_musica!),
    trilha_sonora,
    estagios: estagios.sort((a, b) =>
      a.estagio < b.estagio ? -1 : a.estagio > b.estagio ? 1 : a.chave < b.chave ? -1 : 1,
    ),
  };
}

/** sha256 de um texto. */
function sha256De(texto: string): string {
  return createHash("sha256").update(texto, "utf-8").digest("hex");
}

/** Ordena chaves recursivamente (mesmo criterio do serializador do F5-06). */
function ordenarCanonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarCanonico);
  if (valor !== null && typeof valor === "object") {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of entradas) saida[chave] = ordenarCanonico(v);
    return saida;
  }
  return valor;
}

/**
 * Vereditos essenciais do relatorio (o que a regeneracao tem de
 * preservar). Compara em forma canonica (chaves ordenadas): o relatorio
 * embutido passou pelo serializador do F5-06 (chaves ordenadas) enquanto
 * o regenerado sai na ordem de construcao — comparar em ordem crua daria
 * DIVERGENTE para relatorios semanticamente identicos.
 */
function vereditosEssenciais(relatorio: RelatorioProcedencia): string {
  const chaves = (r: ReadonlyArray<{ readonly hash: string }>): readonly string[] =>
    [...r].map((e) => e.hash).sort();
  return JSON.stringify(
    ordenarCanonico({
      semOrigem: relatorio.semOrigem,
      gapsDeData: relatorio.gapsDeData,
      diretos: chaves(relatorio.diretos),
      transitivos: chaves(relatorio.transitivos),
      enquadramento: relatorio.enquadramento,
    }),
  );
}

/** Compara dois relatorios nos vereditos essenciais (AB-748: regeneravel). */
function regeneracaoConsistente(a: RelatorioProcedencia, b: RelatorioProcedencia): boolean {
  return vereditosEssenciais(a) === vereditosEssenciais(b);
}

// ─── Leitura da entrega ─────────────────────────────────────────────────────────

interface EntregaLida {
  /** Quando a entrega real existe em --saida. */
  readonly real: boolean;
  readonly resolvido: ManifestoResolvido;
  readonly relatorio: RelatorioProcedencia;
  readonly relatorioTexto: string;
  readonly relatorioFinalTexto: string;
}

async function lerEntrega(saida: string, raizCassetes: string): Promise<EntregaLida> {
  const arquivos = ["relatorio-final.json", "relatorio-procedencia.json", "manifesto-resolvido.json"];
  let todosExistem = true;
  for (const nome of arquivos) {
    try {
      await readFile(join(saida, nome), "utf-8");
    } catch {
      todosExistem = false;
    }
  }
  if (todosExistem) {
    const relatorioTexto = await readFile(join(saida, "relatorio-procedencia.json"), "utf-8");
    const relatorio = JSON.parse(relatorioTexto) as RelatorioProcedencia;
    const resolvido = JSON.parse(
      await readFile(join(saida, "manifesto-resolvido.json"), "utf-8"),
    ) as ManifestoResolvido;
    const relatorioFinalTexto = await readFile(join(saida, "relatorio-final.json"), "utf-8");
    return { real: true, resolvido, relatorio, relatorioTexto, relatorioFinalTexto };
  }

  // Entrega de fixture: montada dos cassetes commitados + manifesto canonico.
  const manifestoBase = JSON.parse(
    await readFile(CAMINHO_MANIFESTO_CANONICO, "utf-8"),
  ) as Manifesto;
  const resolvido = await montarResolvidoDosCassetes(raizCassetes, manifestoBase);
  const relatorio = await gerarRelatorio(resolvido, { raizCassetes });
  const relatorioTexto = serializarRelatorio(relatorio);
  const relatorioFinalTexto = JSON.stringify({
    schema_version: "RelatorioFinal.1",
    pipeline: { fixture: "canonico", estrito: true },
    sucesso: true,
    artefatos: [
      { nome: "manifesto-resolvido.json", arquivos: [] },
      { nome: "relatorio-procedencia.json", arquivos: [] },
    ],
    ferramentas: { ffmpeg: "fixture", node: "fixture" },
    origem: "gerador de dossie (F6-01): entrega de fixture dos cassetes commitados",
  });
  return { real: false, resolvido, relatorio, relatorioTexto, relatorioFinalTexto };
}

// ─── Declaracoes ────────────────────────────────────────────────────────────────

/** A declaracao de enquadramento (AB-993) — nunca omitida (ADR-0003). */
function declaracaoDeEnquadramento(relatorio: RelatorioProcedencia): string {
  const ab950 = relatorio.enquadramento?.ab950 ?? "AB-950 continua fechado";
  return DECLARACOES_AB950.has(ab950)
    ? ab950
    : "INDEFINIDO — declaracao invalida (nunca omitir AB-950; ADR-0003)";
}

/** O disclosure de voz sintetica (AB-999): o gerador detecta a locucao. */
function declaracaoDeDisclosure(resolvido: ManifestoResolvido): string {
  const temLocucao = resolvido.estagios.some((e) => e.estagio === "locucao");
  const temVoz = resolvido.nos_locucao !== undefined && Object.keys(resolvido.nos_locucao).length > 0;
  if (temLocucao && temVoz) {
    return "DECLARADO — a entrega contem voz sintetica (estagio locucao/TTS); a obrigacao de disclosure do provedor (ADR-0003 D4, AB-999) e conferida pelo Revisor juridico no item J2.";
  }
  return "DECLARADO — a entrega nao contem voz sintetica (NAO_APLICAVEL justificado no item J2).";
}

// ─── Render do dossie ───────────────────────────────────────────────────────────

/** Renderiza o dossie em markdown: valores do gate no texto visivel. */
function renderizarDossie(
  entrega: string,
  entregaLida: EntregaLida,
  regeneracao: string,
  ab950: string,
  disclosure: string,
): string {
  const relatorio = entregaLida.relatorio;
  const hashRelatorio = sha256De(entregaLida.relatorioTexto);
  const hashRelatorioFinal = sha256De(entregaLida.relatorioFinalTexto);
  const gaps = relatorio.gapsDeData;
  const sucesso = (JSON.parse(entregaLida.relatorioFinalTexto) as { sucesso?: boolean }).sucesso ?? false;

  const linhas: string[] = [];
  linhas.push(`# Dossiê de revisão humana — entrega \`${entrega}\``);
  linhas.push("");
  linhas.push(`> **RASCUNHO GERADO POR MÁQUINA (F6-01).** Vereditos do checklist e
> assinaturas por papel estão em branco. Um dossiê só vale para publicação
> depois de assinado pelos quatro papéis nomeados — até lá, \`just
> revisar-bloqueia\` falha de propósito.`);
  linhas.push("");
  linhas.push(`<!-- F6-01:dossie:entrega=${entrega} -->`);
  linhas.push(`<!-- F6-01:relatorio-embutido-hash=${hashRelatorio} -->`);
  linhas.push(`<!-- F6-01:relatorio-final-hash=${hashRelatorioFinal} -->`);
  linhas.push(`<!-- F6-01:regeneracao=${regeneracao} -->`);
  linhas.push(`<!-- F6-01:enquadramento=DECLARADO -->`);
  linhas.push(`<!-- F6-01:ab950=${ab950} -->`);
  linhas.push(`<!-- F6-01:disclosure=DECLARADO -->`);
  linhas.push(`<!-- F6-01:gaps=DECLARADO -->`);
  linhas.push("");

  linhas.push("## 1. Identidade da entrega");
  linhas.push("");
  linhas.push(`- **entrega:** \`${entrega}\``);
  linhas.push(
    `- **origem:** ${entregaLida.real ? "entrega real em `output/`" : "entrega de FIXTURE montada dos cassetes commitados (sem render)"}`,
  );
  linhas.push(`- **sucesso do relatorio-final:** \`${sucesso}\``);
  linhas.push(`- **hash relatorio-procedencia.json:** \`${hashRelatorio}\``);
  linhas.push(`- **hash relatorio-final.json:** \`${hashRelatorioFinal}\``);
  linhas.push(`- **semOrigem (∅-crit F5-06):** ${relatorio.semOrigem.length === 0 ? "VAZIO — liberado" : `${relatorio.semOrigem.length} entrada(s) — BLOQUEADO`}`);
  linhas.push("");
  linhas.push("## 2. Gaps de data visíveis (AB-746 — visíveis, não omitidos)");
  linhas.push("");
  if (gaps.length === 0) {
    linhas.push("Nenhum gap de data no relatório de procedência desta entrega.");
  } else {
    linhas.push("| hash | motivo | decisão do dono (preencher) |");
    linhas.push("|---|---|---|");
    for (const gap of gaps) {
      linhas.push(`| \`${gap.hash.slice(0, 16)}…\` | ${gap.motivo} | _(preencher)_ |`);
    }
  }
  linhas.push("");
  linhas.push("## 3. Relatório de procedência (F5-06 — gerarRelatorio)");
  linhas.push("");
  linhas.push(`**Regeneração dos mesmos commitados (AB-748):** \`${regeneracao}\` — ` +
    (regeneracao === "CONSISTENTE"
      ? "o relatório regenerado sem re-renderizar coincide nos vereditos essenciais (semOrigem, gaps, diretos, transitivos, enquadramento)."
      : "o relatório regenerado DIVERGE nos vereditos essenciais — dossiê inválido."));
  linhas.push("");
  linhas.push("```json");
  linhas.push(entregaLida.relatorioTexto);
  linhas.push("```");
  linhas.push("");
  linhas.push("## 4. Declaração de enquadramento (AB-993)");
  linhas.push("");
  linhas.push(`- **uso:** pessoal — **ADR-0003** (a decisão de uso não é a decisão de publicação; política §0.2).`);
  linhas.push(`- **gatilho AB-950:** \`${ab950}\` — nunca omitido (ADR-0003: omissão é falha de gate).`);
  linhas.push(`- **caso não previsto (política §7):** "o que não está escrito não está decidido" — caso não previsto bloqueia publicação nova até enquadramento por registro.`);
  linhas.push("");
  linhas.push("## 5. Disclosure de voz sintética (AB-999)");
  linhas.push("");
  linhas.push(disclosure);
  linhas.push("");
  linhas.push("## 6. Checklist por papel (docs/revisao/checklist.md)");
  linhas.push("");
  for (const papel of PAPEIS_DO_DOSSIE) {
    linhas.push(`### ${papel}`);
    linhas.push("");
    for (const item of ITENS_POR_PAPEL[papel] ?? []) {
      linhas.push(`- [ ] ${item} — veredito: \`PENDENTE\``);
    }
    linhas.push("");
  }
  linhas.push("## 7. Assinaturas por papel");
  linhas.push("");
  linhas.push("Assinar com nome + data + veredito global. Um papel sem assinatura torna o dossiê inválido (∅-crit).");
  linhas.push("");
  for (const papel of PAPEIS_DO_DOSSIE) {
    linhas.push(`### Assinatura — ${papel}`);
    linhas.push("");
    linhas.push(`- **nome:** _(preencher)_`);
    linhas.push(`- **data:** _(preencher)_`);
    linhas.push(`- **veredito global:** \`PENDENTE\``);
    linhas.push("");
  }
  linhas.push("---");
  linhas.push("");
  linhas.push("Gerado por `just revisar` (F6-01). Confira a estrutura e o ∅-crit em `docs/revisao/dossie.md`.");
  return linhas.join("\n");
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parsearArgumentos(process.argv.slice(2));

  const entregaLida = await lerEntrega(args.saida, RAIZ_CASSETES_PADRAO);

  // Regeneracao: relatorio dos mesmos commitados, sem store, sem render (AB-748).
  const regenerado = await gerarRelatorio(entregaLida.resolvido, { raizCassetes: RAIZ_CASSETES_PADRAO });
  const regeneracao = regeneracaoConsistente(entregaLida.relatorio, regenerado)
    ? "CONSISTENTE"
    : "DIVERGENTE";

  const ab950 = declaracaoDeEnquadramento(entregaLida.relatorio);
  const disclosure = declaracaoDeDisclosure(entregaLida.resolvido);
  const conteudo = renderizarDossie(args.entrega, entregaLida, regeneracao, ab950, disclosure);

  // Protecao do registro: nunca sobrescrever um dossie ja assinado.
  try {
    const existente = await readFile(args.dossie, "utf-8");
    const temAssinatura =
      /veredito global:\*\* `(?!PENDENTE\b)/.test(existente) ||
      /\*\*nome:\*\* (?!_\(preencher\)_)/.test(existente);
    if (temAssinatura) {
      console.error(
        `recusado: ${args.dossie} já contém assinatura — o registro de aprovação humana não é sobrescrito pelo gerador.`,
      );
      process.exit(2);
    }
  } catch {
    // arquivo nao existe: rascunho novo.
  }

  await writeFile(args.dossie, conteudo, "utf-8");
  console.log(`dossiê rascunho gerado: ${args.dossie} (entrega ${args.entrega}, regeneração ${regeneracao})`);
  console.log(
    `atenção: rascunho NÃO assinado — \`just revisar-bloqueia\` falha até as assinaturas dos 4 papéis.`,
  );
}

main().catch((erro: unknown) => {
  console.error(`FALHOU: ${(erro as Error).message ?? String(erro)}`);
  process.exit(1);
});
