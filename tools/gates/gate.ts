#!/usr/bin/env npx tsx
/**
 * tools/gates/gate.ts
 *
 * O GATE DO CARD F6-03 (W11) — `just gates-validar` (hífen; o justfile
 * 1.42.4 não suporta dois-pontos — divergência nomeada no ADR-0047).
 *
 * Prova, sem render e sem rede:
 *
 *   1. PRESENÇA dos artefatos do card, per-item (pergunta obrigatória da
 *      W10: assere PRESENÇA, nunca lista fechada);
 *   2. estrutura dos documentos de gate (dano concreto, vereditos
 *      possíveis, papel nomeado esperado, cabeçalho GATE P-N, alavanca-
 *      mestra citada);
 *   3. o ∅-crit (criterio de aceitacao 2 do card): UM GATE COM VEREDITO
 *      CONFERE SEM EVIDÊNCIA ANEXADA TEM DE FALHAR — sondas negativas por
 *      alvo, cada mutação tem de falhar VERMELHO nomeando o gate e o
 *      motivo;
 *   4. sonda positiva: os cinco gates CONFERE com evidência anexada e
 *      assinaturas por papel nomeado são aceitos (exit 0, VERDE) — sem
 *      sonda positiva o gate só saberia falhar, nunca passar;
 *   5. o estado commitado de docs/gates/** é rejeitado de propósito
 *      (todos NÃO_COLETADO — nenhuma evidência coletada, nenhum vídeo
 *      publicado): `just gates-bloqueia` é VERMELHO por construção, como o
 *      dossiê-rascunho canônico do F6-01.
 *
 * As sondas rodam em diretório temporário: nenhum documento de gate de
 * teste toca docs/gates/. O verificador consumido é
 * tools/gates/verificar-gates.ts, exercitado como subprocesso.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PAPEIS_DO_DOSSIE } from "../revisao/formato.js";

// ─── Caminhos ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Raiz do repositorio, resolvida a partir deste arquivo. */
const RAIZ = resolve(__dirname, "..", "..");
const DIRETORIO_GATES = join(RAIZ, "docs", "gates");
const DIRETORIO_EVIDENCIAS = join(DIRETORIO_GATES, "evidencias");

/** Os cinco gates numerados de publicação (presença per gate, nunca lista fechada). */
const GATES_ESPERADOS: readonly string[] = ["P-1", "P-2", "P-3", "P-4", "P-5"];

/**
 * O papel nomeado que assina cada gate — o contrato documentado no ADR-0047
 * e nos próprios documentos (política §3: Revisor editorial assina o
 * veredito dos gates P-1..P-5; os demais assinam por território).
 */
const PAPEL_POR_GATE: Readonly<Record<string, string>> = {
  "P-1": "Operador de publicação",
  "P-2": "Revisor jurídico",
  "P-3": "Revisor jurídico",
  "P-4": "Operador de publicação",
  "P-5": "Revisor editorial",
};

/** O comando de evidencia de cada gate (para o preenchimento sintetico). */
const COMANDO_POR_GATE: Readonly<Record<string, string>> = {
  "P-1": "just revisar-bloqueia --entrega ID",
  "P-2": "just procedencia",
  "P-3": "python3 tools/validate-ledger.py --id AB-950 --exigir-gatilho",
  "P-4": "just pos",
  "P-5": "npx tsx tools/gates/verificar-gates.ts",
};

// ─── Placar ─────────────────────────────────────────────────────────────────────

let falhas = 0;

function ok(mensagem: string): void {
  console.log(`  [OK]     ${mensagem}`);
}

function falhou(mensagem: string): void {
  console.log(`  [FALHOU] ${mensagem}`);
  falhas += 1;
}

function secao(titulo: string): void {
  console.log("");
  console.log(`--- ${titulo} ---`);
}

// ─── Subprocessos ───────────────────────────────────────────────────────────────

interface ResultadoComando {
  readonly codigo: number;
  readonly saida: string;
}

/** Roda o verificador de gates como subprocesso e devolve codigo + saida. */
function rodar(dir: string): Promise<ResultadoComando> {
  return new Promise((resolver, rejeitar) => {
    execFile(
      process.execPath,
      [join(RAIZ, "node_modules", "tsx", "dist", "cli.mjs"), join(RAIZ, "tools", "gates", "verificar-gates.ts"), "--dir", dir],
      { cwd: RAIZ, timeout: 120_000 },
      (erro, stdout, stderr) => {
        if (erro !== null && (erro as { code?: number }).code !== undefined) {
          // exit != 0: o resultado é o codigo de saida (esperado nas sondas).
          resolver({ codigo: (erro as { code?: number }).code ?? 1, saida: `${stdout}\n${stderr}` });
          return;
        }
        if (erro !== null) {
          rejeitar(erro);
          return;
        }
        resolver({ codigo: 0, saida: `${stdout}\n${stderr}` });
      },
    );
  });
}

/** Sonda: o verificador tem de falhar (exit != 0) contendo o fragmento na saida. */
async function sondaNegativa(nome: string, fragmento: string, dir: string): Promise<void> {
  const resultado = await rodar(dir);
  const saida = resultado.saida;
  if (resultado.codigo === 0) {
    falhou(`sonda negativa ${nome}: esperava VERMELHO, saiu VERDE`);
    return;
  }
  if (!saida.includes(fragmento)) {
    falhou(
      `sonda negativa ${nome}: falhou sem nomear o motivo esperado — faltou "${fragmento}" na saída:\n${saida}`,
    );
    return;
  }
  ok(`sonda negativa ${nome}: VERMELHO nomeando "${fragmento}"`);
}

/** Sonda positiva: o verificador tem de sair VERDE (exit 0). */
async function sondaPositiva(nome: string, dir: string): Promise<void> {
  const resultado = await rodar(dir);
  if (resultado.codigo !== 0) {
    falhou(`sonda positiva ${nome}: esperava VERDE, saiu VERMELHO:\n${resultado.saida}`);
    return;
  }
  if (!resultado.saida.includes("gates-bloqueia: VERDE")) {
    falhou(`sonda positiva ${nome}: saiu 0 sem imprimir "gates-bloqueia: VERDE"`);
    return;
  }
  ok(`sonda positiva ${nome}: VERDE`);
}

// ─── Preenchimento sintetico (para as sondas, em diretorio temporario) ──────────

/**
 * Preenche o documento commitado: veredito CONFERE, assinatura por papel
 * nomeado (nome + data) e evidência anexada (bloco de código). Nada disso
 * toca docs/gates/ — as sondas rodam em diretório temporario.
 */
function preencherGate(nome: string, texto: string): string {
  let t = texto;
  t = t.replace("<!-- F6-03:veredito=NÃO_COLETADO -->", "<!-- F6-03:veredito=CONFERE -->");
  t = t.replace("<!-- F6-03:assinado_em= -->", "<!-- F6-03:assinado_em=2026-08-13 -->");
  const comando = COMANDO_POR_GATE[nome] ?? "comando do gate";
  t = t.replace("<!-- F6-03:evidencia= -->", `<!-- F6-03:evidencia=${nome}.txt — saída salva de ${comando} -->`);
  t = t.replace("- **nome:** _(preencher)_", "- **nome:** Dono do Programa");
  const bloco = [
    "",
    "<!-- F6-03:evidencia-anexada -->",
    "",
    "```text",
    `F6-03-EVIDENCIA-SINTETICA-${nome}`,
    `$ ${comando}`,
    "(saída salva — evidência anexada para a sonda)",
    "```",
    "",
  ].join("\n");
  // Anexa logo depois da linha de descrição da evidência.
  const marcadorEvidencia = new RegExp(`(<!-- F6-03:evidencia=([^>]+) -->)\n`).exec(t);
  if (marcadorEvidencia !== null && marcadorEvidencia[0] !== undefined) {
    t = t.replace(marcadorEvidencia[0], `${marcadorEvidencia[0]}${bloco}\n`);
  }
  return t;
}

/** Remove a evidencia anexada (bloco sintetico) de um documento preenchido. */
function removerEvidencia(texto: string): string {
  return texto.replace(/<!-- F6-03:evidencia-anexada -->\n\n```text\n[\s\S]*?```\n/, "");
}

/** Monta o diretório temporario com os cinco gates (opcionalmente preenchidos). */
async function montarDiretorio(
  tmp: string,
  textos: ReadonlyMap<string, string>,
  comPreenchimento: boolean,
): Promise<string> {
  const dir = join(tmp, comPreenchimento ? "positivo" : "bruto");
  await mkdir(dir, { recursive: true });
  for (const nome of GATES_ESPERADOS) {
    const texto = textos.get(nome);
    if (texto === undefined) continue;
    const final = comPreenchimento ? preencherGate(nome, texto) : texto;
    await writeFile(join(dir, `${nome}.md`), final, "utf-8");
  }
  const readme = textos.get("README");
  if (readme !== undefined) {
    await writeFile(join(dir, "README.md"), readme, "utf-8");
  }
  await mkdir(join(dir, "evidencias"), { recursive: true });
  return dir;
}

// ─── O gate ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== gates-validar — card F6-03 (W11), gates numerados de publicação ===");

  secao("[1/5] presenca dos artefatos do card (por nome, nunca por ausencia)");
  const obrigatorios: ReadonlyArray<readonly [string, string]> = [
    ["docs/gates/README.md", "o indice e o contrato de formato dos gates"],
    ["docs/gates/evidencias/", "o diretorio das evidencias anexadas"],
    ["tools/gates/verificar-gates.ts", "o ∅-crit executavel (just gates-bloqueia)"],
    ["tools/gates/gate.ts", "este gate"],
    ["ledger/inbox/F6-03.json", "os itens do ledger do card (faixa AB-890..AB-909)"],
  ];
  for (const [caminho, descricao] of obrigatorios) {
    try {
      if (caminho.endsWith("/")) {
        await readdir(join(RAIZ, caminho));
      } else {
        await readFile(join(RAIZ, caminho), "utf-8");
      }
      ok(`${caminho} presente (${descricao})`);
    } catch {
      falhou(`artefato ausente: ${caminho} (${descricao})`);
    }
  }

  const textos = new Map<string, string>();
  for (const nome of GATES_ESPERADOS) {
    const caminho = join(DIRETORIO_GATES, `${nome}.md`);
    try {
      const texto = await readFile(caminho, "utf-8");
      textos.set(nome, texto);
      ok(`docs/gates/${nome}.md presente`);
    } catch {
      falhou(`docs/gates/${nome}.md AUSENTE — presença por gate, nunca lista fechada`);
    }
  }
  try {
    textos.set("README", await readFile(join(DIRETORIO_GATES, "README.md"), "utf-8"));
  } catch {
    falhou("docs/gates/README.md ilegível");
  }

  const adrs = (await readdir(join(RAIZ, "docs", "adr"))).filter((n) => n.startsWith("0047-"));
  if (adrs.length === 0) {
    falhou("docs/adr/0047-*.md ausente — a decisão dos gates precisa de ADR");
  } else {
    ok(`docs/adr/0047-*.md presente (${adrs.join(", ")})`);
  }

  const justfile = await readFile(join(RAIZ, "justfile"), "utf-8");
  if (!justfile.includes("# === F6-03 ===") || !justfile.includes("# === fim F6-03 ===")) {
    falhou("bloco # === F6-03 === do justfile ausente ou sem marcador de fim");
  } else {
    ok("bloco # === F6-03 === do justfile presente com marcador de fim");
  }
  for (const receita of ["gates-validar", "gates-bloqueia"]) {
    if (!new RegExp(`^${receita}[:\\s]`, "m").test(justfile)) {
      falhou(`receita \`just ${receita}\` ausente no justfile`);
    } else {
      ok(`receita \`just ${receita}\` presente`);
    }
  }
  if (!justfile.includes("alavanca-mestra")) {
    falhou("bloco F6-03 do justfile nao cita a alavanca-mestra (politica §2.3)");
  } else {
    ok("bloco F6-03 do justfile cita a alavanca-mestra");
  }

  let ledgerF603: ReadonlyArray<{ readonly id: string }> = [];
  try {
    ledgerF603 = JSON.parse(
      await readFile(join(RAIZ, "ledger", "inbox", "F6-03.json"), "utf-8"),
    ) as ReadonlyArray<{ readonly id: string }>;
  } catch {
    falhou("ledger/inbox/F6-03.json ilegível ou ausente");
  }
  const idsDoLedger = new Set(ledgerF603.map((i) => i.id));
  // Presenca per-item da faixa 890..898 (faixa do card: AB-890..AB-909).
  for (let n = 890; n <= 898; n += 1) {
    const id = `AB-${n}`;
    if (!idsDoLedger.has(id)) {
      falhou(`ledger/inbox/F6-03.json sem o item ${id}`);
    } else {
      ok(`ledger item ${id} presente`);
    }
  }

  secao("[2/5] estrutura dos documentos de gate (dano concreto, vereditos, papel)");
  for (const nome of GATES_ESPERADOS) {
    const texto = textos.get(nome);
    if (texto === undefined) continue;
    if (!texto.includes(`# GATE ${nome} —`)) {
      falhou(`GATE ${nome}: cabeçalho \`# GATE ${nome} —\` ausente — o nome tem de casar com o runbook F6-02 (GATE P-1)`);
    }
    if (!texto.includes("## O dano que este gate previne")) {
      falhou(`GATE ${nome}: sem a seção do dano concreto ("O dano que este gate previne") — "boas práticas" não é dano`);
    }
    for (const vereditoPossivel of ["CONFERE", "REPROVADO", "NÃO_COLETADO"]) {
      if (!texto.includes(vereditoPossivel)) {
        falhou(`GATE ${nome}: não declara o veredito possível \`${vereditoPossivel}\``);
      }
    }
    const papelEsperado = PAPEL_POR_GATE[nome];
    if (papelEsperado === undefined) {
      falhou(`GATE ${nome}: contrato sem papel esperado definido no gate`);
      continue;
    }
    if (!PAPEIS_DO_DOSSIE.includes(papelEsperado)) {
      falhou(`GATE ${nome}: papel esperado ${papelEsperado} fora do vocabulário de tools/revisao/formato.ts`);
    }
    if (!texto.includes(`assinado_por=${papelEsperado}`)) {
      falhou(`GATE ${nome}: assinatura não nomeia o papel esperado ${papelEsperado}`);
    } else {
      ok(`GATE ${nome}: papel nomeado ${papelEsperado}, vereditos possíveis e dano concreto presentes`);
    }
  }
  const readmeTexto = textos.get("README");
  if (readmeTexto !== undefined && !readmeTexto.includes("alavanca-mestra")) {
    falhou("docs/gates/README.md nao cita a alavanca-mestra (politica §2.3)");
  }

  secao("[3/5] ∅-crit — sondas negativas por alvo (cada mutacao tem de ficar VERMELHA)");
  const tmp = await mkdtemp(join(tmpdir(), "f6-03-gate-"));
  try {
    const dirBruto = await montarDiretorio(tmp, textos, false);
    const dirPositivo = await montarDiretorio(tmp, textos, true);

    // Sonda positiva primeiro: os cinco gates CONFERE com evidência e assinatura.
    await sondaPositiva("os cinco gates CONFERE com evidência anexada e papéis nomeados", dirPositivo);

    // Estado commitado: nada foi coletado — publicação bloqueada por construção.
    await sondaNegativa(
      "estado commitado (todos NÃO_COLETADO) bloqueia a publicação",
      "NÃO_COLETADO",
      dirBruto,
    );

    /** A mutacao por alvo: o gate que cada mutação atinge ("TODOS" = todos). */
    const mutacoes: ReadonlyArray<readonly [string, string | "TODOS", (t: string) => string, string]> = [
      ["GATE P-1 CONFERE sem evidência anexada (∅-crit)", "P-1", removerEvidencia, "sem evidência ANEXADA"],
      ["todos CONFERE sem evidência (veredito trocado, nada anexado)", "TODOS", removerEvidencia, "sem evidência ANEXADA"],
      ["GATE P-2 NÃO_COLETADO (volta ao estado bloqueante)", "P-2", (t) => t.replace("<!-- F6-03:veredito=CONFERE -->", "<!-- F6-03:veredito=NÃO_COLETADO -->"), "NÃO_COLETADO"],
      ["GATE P-3 REPROVADO (condição reprovou)", "P-3", (t) => t.replace("<!-- F6-03:veredito=CONFERE -->", "<!-- F6-03:veredito=REPROVADO -->"), "REPROVADO"],
      ["GATE P-4 assinado como 'o time' (coletivo, nunca papel nomeado)", "P-4", (t) => t.replace("<!-- F6-03:assinado_por=Operador de publicação -->", "<!-- F6-03:assinado_por=o time -->"), "nunca"],
      ["GATE P-5 papel fora do vocabulário dos quatro", "P-5", (t) => t.replace("<!-- F6-03:assinado_por=Revisor editorial -->", "<!-- F6-03:assinado_por=Coordenador -->"), "papel válido"],
      ["GATE P-5 CONFERE sem data de assinatura", "P-5", (t) => t.replace("<!-- F6-03:assinado_em=2026-08-13 -->", "<!-- F6-03:assinado_em= -->"), "sem data"],
      ["GATE P-5 CONFERE sem nome de quem assina", "P-5", (t) => t.replace("- **nome:** Dono do Programa", "- **nome:** _(preencher)_"), "sem nome"],
      ["GATE P-1 com veredito inválido", "P-1", (t) => t.replace("<!-- F6-03:veredito=CONFERE -->", "<!-- F6-03:veredito=ABERTO -->"), "veredito inválido"],
      ["GATE P-2 sem o cabeçalho GATE P-2", "P-2", (t) => t.replace(/# GATE P-2 — .*\n/, ""), "cabeçalho"],
      ["GATE P-3 sem a seção do dano concreto", "P-3", (t) => t.replace(/## O dano que este gate previne[\s\S]*?(?=## )/, ""), "dano concreto"],
      ["GATE P-1 com evidência-arquivo inexistente", "P-1", (t) => `${t}\n<!-- F6-03:evidencia-arquivo=nao-existe.txt -->\n`, "não existe ou está vazia"],
      ["GATE P-1 sem nenhum marcador reconhecível", "P-1", (t) => t.split("\n").slice(0, 1).join("\n"), "sem veredito"],
    ];

    for (const [nomeMutacao, alvo, mutacao, fragmento] of mutacoes) {
      const dirMutacao = join(tmp, "mutacao");
      await mkdir(dirMutacao, { recursive: true });
      for (const nome of GATES_ESPERADOS) {
        const base = textos.get(nome);
        if (base === undefined) continue;
        // Todos os cenários partem do documento PREENCHIDO (CONFERE +
        // assinatura + evidência); a mutação só troca o que quer atacar.
        let texto = preencherGate(nome, base);
        if (alvo === "TODOS" || alvo === nome) {
          texto = mutacao(texto);
        }
        await writeFile(join(dirMutacao, `${nome}.md`), texto, "utf-8");
      }
      await writeFile(join(dirMutacao, "README.md"), readmeTexto ?? "", "utf-8");
      await mkdir(join(dirMutacao, "evidencias"), { recursive: true });
      await sondaNegativa(nomeMutacao, fragmento, dirMutacao);
    }

    // Gate ausente: diretório sem o P-3.
    const dirSemP3 = join(tmp, "sem-p3");
    await mkdir(dirSemP3, { recursive: true });
    for (const nome of GATES_ESPERADOS) {
      if (nome === "P-3") continue;
      const base = textos.get(nome);
      if (base === undefined) continue;
      await writeFile(join(dirSemP3, `${nome}.md`), preencherGate(nome, base), "utf-8");
    }
    await writeFile(join(dirSemP3, "README.md"), readmeTexto ?? "", "utf-8");
    await mkdir(join(dirSemP3, "evidencias"), { recursive: true });
    await sondaNegativa("GATE P-3 ausente (presença por gate)", "P-3 AUSENTE", dirSemP3);

    // Diretório inexistente: nenhum documento de gate.
    const dirInexistente = join(tmp, "inexistente");
    await sondaNegativa("diretório de gates inexistente", "nenhum documento de gate", dirInexistente);

    secao("[4/5] a alavanca-mestra e citada nos documentos (politica §2.3)");
    if (readmeTexto !== undefined && readmeTexto.includes("alavanca-mestra")) {
      ok("README.md cita a alavanca-mestra");
    }

    secao("[5/5] o estado commitado de docs/gates/** e rejeitado (nada publicado)");
    await sondaNegativa(
      "docs/gates/** commitados (todos NÃO_COLETADO) não liberam publicação",
      "NÃO_COLETADO",
      DIRETORIO_GATES,
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  console.log("");
  if (falhas > 0) {
    console.log(`gates-validar: VERMELHO (${falhas} falha(s))`);
    process.exit(1);
  }
  console.log("gates-validar: VERDE — os cinco gates P-1..P-5 existem, o ∅-crit morde");
  console.log("(CONFERE sem evidência anexada = falha; REPROVADO/NÃO_COLETADO = publicação bloqueada)");
}

main().catch((erro: unknown) => {
  console.error(`FALHOU: ${(erro as Error).message ?? String(erro)}`);
  process.exit(1);
});
