#!/usr/bin/env npx tsx
/**
 * tools/revisao/gate.ts
 *
 * O GATE DO CARD F6-01 (W10). `just revisar-gate` chama isto.
 *
 * Prova, sem render e sem rede (cassetes commitados — o mesmo material do
 * gate do F5-06):
 *
 *   1. PRESENCA dos artefatos do card, per-item (pergunta obrigatoria da
 *      W10: assere PRESENÇA, nunca lista fechada);
 *   2. `just revisar` gera o dossiê (criterio de aceitacao 1 do card) — e
 *      o dossiê gerado é REJEITADO pelo gate (gerar ≠ aprovar);
 *   3. o ∅-crit (criterio 2): entrega sem dossiê BLOQUEIA a publicação —
 *      sondas negativas por alvo, cada mutacao tem de falhar VERMELHO
 *      nomeando o item;
 *   4. sonda positiva: um dossiê preenchido e assinado pelos quatro
 *      papéis nomeados é aceito (exit 0) — sem sonda positiva o gate só
 *      saberia falhar, nunca passar.
 *
 * As sondas rodam em diretorio temporario: nenhum dossiê de teste toca
 * docs/revisao/. O dossiê-rascunho canônico de docs/revisao/ é verificado
 * de propósito: existe e o gate o REJEITA (assinatura humana pendente) —
 * a publicação da entrega canônica continua bloqueada, como o ∅-crit manda.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gerarRelatorio } from "../../src/entrega/procedencia/relatorio.js";
import { serializarRelatorio } from "../../src/entrega/procedencia/formato.js";
import { RAIZ_CASSETES_PADRAO } from "../../src/resolucao/cassete/formato.js";
import { verificarCobertura } from "../../src/resolucao/descoberta.js";
import { ORDEM_ESTAGIOS, hashDoManifesto } from "../../src/resolucao/contrato.js";
import { ARQUIVO_CABECALHO } from "../../src/resolucao/cassete/formato.js";
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
  ITENS_OBRIGATORIOS,
} from "./formato.js";

// ─── Caminhos ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Raiz do repositorio, resolvida a partir deste arquivo. */
const RAIZ = resolve(__dirname, "..", "..");

const CAMINHO_MANIFESTO_CANONICO = join(RAIZ, "fixtures", "canonico", "manifesto-valido.json");
const DIRETORIO_REVISAO = join(RAIZ, "docs", "revisao");

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

/** Roda o verificador/generador como subprocesso e devolve codigo + saida. */
function rodar(
  ferramenta: "verificar-dossie" | "gerar-dossie",
  args: readonly string[],
): Promise<ResultadoComando> {
  return new Promise((resolver, rejeitar) => {
    execFile(
      process.execPath,
      [join(RAIZ, "node_modules", "tsx", "dist", "cli.mjs"), join(RAIZ, "tools", "revisao", `${ferramenta}.ts`), ...args],
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

/** Sonda: o comando tem de falhar (exit != 0) contendo o fragmento na saida. */
async function sondaNegativa(
  nome: string,
  fragmento: string,
  args: readonly string[],
  ferramenta: "verificar-dossie" | "gerar-dossie" = "verificar-dossie",
): Promise<void> {
  const resultado = await rodar(ferramenta, args);
  const saida = resultado.saida;
  if (resultado.codigo === 0) {
    falhou(`sonda negativa ${nome}: esperava VERMELHO, saiu VERDE`);
    return;
  }
  if (!saida.includes(fragmento)) {
    falhou(
      `sonda negativa ${nome}: falhou sem nomear o motivo esperado — faltou "${fragmento}" na saída`,
    );
    return;
  }
  ok(`sonda negativa ${nome}: VERMELHO nomeando "${fragmento}"`);
}

/** Sonda positiva: o comando tem de sair VERDE (exit 0). */
async function sondaPositiva(nome: string, args: readonly string[]): Promise<void> {
  const resultado = await rodar("verificar-dossie", args);
  if (resultado.codigo !== 0) {
    falhou(`sonda positiva ${nome}: esperava VERDE, saiu VERMELHO:\n${resultado.saida}`);
    return;
  }
  if (!resultado.saida.includes("VERDE")) {
    falhou(`sonda positiva ${nome}: saiu 0 sem imprimir VERDE`);
    return;
  }
  ok(`sonda positiva ${nome}: VERDE`);
}

// ─── Entrega de fixture (material commitado, sem render) ────────────────────────

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

/** Monta a entrega de fixture em um diretorio temporario. */
async function montarEntregaDeFixture(tmp: string): Promise<string> {
  const dirEntrega = join(tmp, "entrega");
  await mkdir(dirEntrega, { recursive: true });
  const manifestoBase = JSON.parse(
    await readFile(CAMINHO_MANIFESTO_CANONICO, "utf-8"),
  ) as Manifesto;
  const resolvido = await montarResolvidoDosCassetes(RAIZ_CASSETES_PADRAO, manifestoBase);
  const relatorio = await gerarRelatorio(resolvido, { raizCassetes: RAIZ_CASSETES_PADRAO });
  await writeFile(
    join(dirEntrega, "manifesto-resolvido.json"),
    JSON.stringify(resolvido),
    "utf-8",
  );
  await writeFile(
    join(dirEntrega, "relatorio-procedencia.json"),
    serializarRelatorio(relatorio),
    "utf-8",
  );
  await writeFile(
    join(dirEntrega, "relatorio-final.json"),
    JSON.stringify({
      schema_version: "RelatorioFinal.1",
      pipeline: { fixture: "canonico", estrito: true },
      sucesso: true,
      artefatos: [],
      ferramentas: { ffmpeg: "fixture", node: "fixture" },
      origem: "gate do F6-01: entrega de fixture dos cassetes commitados",
    }),
    "utf-8",
  );
  return dirEntrega;
}

/** Preenche o rascunho: vereditos CONFERE + assinaturas dos 4 papeis. */
function preencherDossie(rascunho: string): string {
  let texto = rascunho;
  for (const item of ITENS_OBRIGATORIOS) {
    texto = texto.replaceAll(`- [ ] ${item} — veredito: \`PENDENTE\``, `- [ ] ${item} — veredito: \`CONFERE\``);
  }
  texto = texto.replaceAll("- **nome:** _(preencher)_", "- **nome:** Dono do Programa");
  texto = texto.replaceAll("- **data:** _(preencher)_", "- **data:** 2026-08-13");
  texto = texto.replaceAll("- **veredito global:** `PENDENTE`", "- **veredito global:** `CONFERE`");
  return texto;
}

// ─── O gate ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== revisar-gate — card F6-01 (W10), checklist de revisao humana ===");

  secao("[1/4] presenca dos artefatos do card (por nome, nunca por ausencia)");
  const obrigatorios: ReadonlyArray<readonly [string, string]> = [
    ["docs/revisao/checklist.md", "o checklist assinavel por papel nomeado"],
    ["docs/revisao/dossie.md", "a especificacao do dossie e do ∅-crit"],
    ["docs/revisao/dossie-canonico.md", "o rascunho do dossie da entrega canonica (gerado por just revisar)"],
    ["tools/revisao/gerar-dossie.ts", "o gerador do dossie"],
    ["tools/revisao/verificar-dossie.ts", "o ∅-crit executavel (gate G-HUM)"],
    ["tools/revisao/gate.ts", "este gate"],
    ["ledger/inbox/F6-01.json", "os itens do ledger do card (faixa AB-850..AB-869)"],
  ];
  for (const [caminho, descricao] of obrigatorios) {
    try {
      await readFile(join(RAIZ, caminho), "utf-8");
      ok(`${caminho} presente (${descricao})`);
    } catch {
      falhou(`artefato ausente: ${caminho} (${descricao})`);
    }
  }

  const adrs = (await readdir(join(RAIZ, "docs", "adr"))).filter((n) => n.startsWith("0045-"));
  if (adrs.length === 0) {
    falhou("docs/adr/0045-*.md ausente — a decisao do dossie precisa de ADR");
  } else {
    ok(`docs/adr/0045-*.md presente (${adrs.join(", ")})`);
  }

  const justfile = await readFile(join(RAIZ, "justfile"), "utf-8");
  if (!justfile.includes("# === F6-01 ===") || !justfile.includes("# === fim F6-01 ===")) {
    falhou("bloco # === F6-01 === do justfile ausente ou sem marcador de fim");
  } else {
    ok("bloco # === F6-01 === do justfile presente com marcador de fim");
  }
  const receitas: ReadonlyArray<[string, string]> = [
    ["revisar", "^revisar\\s"],
    ["revisar-bloqueia", "^revisar-bloqueia\\s"],
    ["revisar-gate", "^revisar-gate[:\\s]"],
  ];
  for (const [nome, padrao] of receitas) {
    if (!new RegExp(padrao, "m").test(justfile)) {
      falhou(`receita \`just ${nome}\` ausente no justfile`);
    } else {
      ok(`receita \`just ${nome}\` presente`);
    }
  }

  const checklist = await readFile(join(RAIZ, "docs", "revisao", "checklist.md"), "utf-8");
  for (const papel of PAPEIS_DO_DOSSIE) {
    if (!checklist.includes(papel)) {
      falhou(`checklist sem o papel nomeado ${papel}`);
    } else {
      ok(`checklist nomeia o papel ${papel}`);
    }
  }
  // Os itens que so um humano pega (pergunta adversarial 2 do card).
  const itensSoHumanos: ReadonlyArray<[string, string]> = [
    ["marcador", "conformidade visual: marcador"],
    ["vinheta", "conformidade visual: vinheta"],
    ["safe area", "conformidade visual: safe area"],
    ["Qualidade narrativa", "qualidade narrativa"],
    ["Adequação editorial", "adequacao editorial"],
  ];
  for (const [fragmento, descricao] of itensSoHumanos) {
    if (!checklist.includes(fragmento)) {
      falhou(`checklist sem ${descricao}`);
    } else {
      ok(`checklist cobre ${descricao}`);
    }
  }
  // A alavanca-mestra citada nos documentos do card (politica §2.3).
  const dossieSpec = await readFile(join(RAIZ, "docs", "revisao", "dossie.md"), "utf-8");
  if (!dossieSpec.includes("alavanca-mestra")) {
    falhou("docs/revisao/dossie.md nao cita a alavanca-mestra (politica §2.3)");
  } else {
    ok("docs/revisao/dossie.md cita a alavanca-mestra");
  }
  if (!justfile.includes("alavanca-mestra")) {
    falhou("bloco F6-01 do justfile nao cita a alavanca-mestra");
  } else {
    ok("bloco F6-01 do justfile cita a alavanca-mestra");
  }

  let ledgerF601: ReadonlyArray<{ readonly id: string }> = [];
  try {
    ledgerF601 = JSON.parse(
      await readFile(join(RAIZ, "ledger", "inbox", "F6-01.json"), "utf-8"),
    ) as ReadonlyArray<{ readonly id: string }>;
  } catch {
    falhou("ledger/inbox/F6-01.json ilegível ou ausente");
  }
  const idsDoLedger = new Set(ledgerF601.map((i) => i.id));
  // Presenca per-item da faixa 850..858 (faixa do card: AB-850..AB-869).
  for (let n = 850; n <= 858; n += 1) {
    const id = `AB-${n}`;
    if (!idsDoLedger.has(id)) {
      falhou(`ledger/inbox/F6-01.json sem o item ${id}`);
    } else {
      ok(`ledger item ${id} presente`);
    }
  }

  secao("[2/4] just revisar gera o dossie — e o dossie gerado NAO aprova nada");
  const tmp = await mkdtemp(join(tmpdir(), "f6-01-gate-"));
  try {
    const dirEntrega = await montarEntregaDeFixture(tmp);
    const dossieRascunho = join(tmp, "dossie-rascunho.md");

    const gerado = await rodar("gerar-dossie", [
      "--entrega", "canonico",
      "--saida", dirEntrega,
      "--dossie", dossieRascunho,
    ]);
    if (gerado.codigo !== 0) {
      falhou(`just revisar falhou ao gerar o rascunho:\n${gerado.saida}`);
    } else {
      ok("just revisar gerou o rascunho (exit 0)");
    }

    const rascunhoTexto = await readFile(dossieRascunho, "utf-8");
    for (const secaoEsperada of [
      "## 1. Identidade da entrega",
      "## 2. Gaps de data",
      "## 3. Relatório de procedência",
      "## 4. Declaração de enquadramento",
      "## 5. Disclosure de voz sintética",
      "## 6. Checklist por papel",
      "## 7. Assinaturas por papel",
    ]) {
      if (!rascunhoTexto.includes(secaoEsperada)) {
        falhou(`rascunho sem a seção ${secaoEsperada}`);
      }
    }
    for (const papel of PAPEIS_DO_DOSSIE) {
      if (!rascunhoTexto.includes(`### Assinatura — ${papel}`)) {
        falhou(`rascunho sem o bloco de assinatura do papel ${papel}`);
      }
    }
    ok("rascunho com as 7 secoes e os 4 blocos de assinatura");

    // Gerar nao aprova: o rascunho tem de ser REJEITADO pelo ∅-crit.
    await sondaNegativa(
      "rascunho rejeitado (gerar != aprovar)",
      "veredito",
      ["--entrega", "canonico", "--saida", dirEntrega, "--dossie", dossieRascunho],
    );

    // O gerador recusa sobrescrever dossie ja assinado.
    const dossieAssinado = join(tmp, "dossie-assinado.md");
    await writeFile(
      dossieAssinado,
      rascunhoTexto.replace("- **veredito global:** `PENDENTE`", "- **veredito global:** `CONFERE`"),
      "utf-8",
    );
    const recusado = await rodar("gerar-dossie", [
      "--entrega", "canonico",
      "--saida", dirEntrega,
      "--dossie", dossieAssinado,
    ]);
    if (recusado.codigo === 0) {
      falhou("gerador sobrescreveu um dossie ja assinado — o registro de aprovacao nao pode ser regravado");
    } else if (!recusado.saida.includes("não é sobrescrito")) {
      falhou(`gerador recusou sem nomear o motivo ("não é sobrescrito"):\n${recusado.saida}`);
    } else {
      ok("gerador recusa sobrescrever dossie assinado");
    }

    secao("[3/4] ∅-crit — sondas negativas por alvo (cada mutacao tem de ficar VERMELHA)");
    const dossieValido = join(tmp, "dossie-valido.md");
    const textoPreenchido = preencherDossie(rascunhoTexto);
    await writeFile(dossieValido, textoPreenchido, "utf-8");

    // Sonda positiva primeiro: o dossie preenchido e aceito.
    await sondaPositiva("dossie preenchido e assinado pelos 4 papeis", [
      "--entrega", "canonico", "--saida", dirEntrega, "--dossie", dossieValido,
    ]);

    const mutacoes: ReadonlyArray<[string, (t: string) => string, string]> = [
      ["entrega sem dossie (arquivo removido)", (t) => {
        void t;
        return "__ARQUIVO_REMOVIDO__";
      }, "sem dossiê"],
      ["assinatura do Revisor editorial removida", (t) =>
        t.replace(/### Assinatura — Revisor editorial\n[\s\S]*?(?=### Assinatura — Revisor jurídico)/, ""),
        "Revisor editorial"],
      ["assinatura do Revisor juridico removida", (t) =>
        t.replace(/### Assinatura — Revisor jurídico\n[\s\S]*?(?=### Assinatura — Operador de reversão)/, ""),
        "Revisor jurídico"],
      ["assinatura do Operador de reversao removida", (t) =>
        t.replace(/### Assinatura — Operador de reversão\n[\s\S]*?(?=### Assinatura — Operador de publicação)/, ""),
        "Operador de reversão"],
      ["assinatura do Operador de publicacao removida", (t) =>
        t.replace(/### Assinatura — Operador de publicação\n[\s\S]*?(?=\n---)/, ""),
        "Operador de publicação"],
      ["assinatura sem nome", (t) =>
        t.replace("- **nome:** Dono do Programa", "- **nome:** _(preencher)_"),
        "sem nome"],
      ["assinatura como 'o time' (coletivo, nunca papel nomeado)", (t) =>
        t.replace("- **nome:** Dono do Programa", "- **nome:** o time"),
        "nunca o coletivo"],
      ["declaracao de enquadramento removida", (t) =>
        t.replace("<!-- F6-01:enquadramento=DECLARADO -->", ""),
        "enquadramento"],
      ["gatilho AB-950 nao declarado", (t) =>
        t.replace("<!-- F6-01:ab950=AB-950 continua fechado -->", "<!-- F6-01:ab950=nao informado -->"),
        "AB-993"],
      ["disclosure de voz removido", (t) =>
        t.replace("<!-- F6-01:disclosure=DECLARADO -->", ""),
        "AB-999"],
      ["veredito do item E1 de volta a PENDENTE", (t) =>
        t.replace("- [ ] E1 — veredito: `CONFERE`", "- [ ] E1 — veredito: `PENDENTE`"),
        "E1"],
      ["item J3 marcado NAO_APLICAVEL (so o J2 admite)", (t) =>
        t.replace("- [ ] J3 — veredito: `CONFERE`", "- [ ] J3 — veredito: `NAO_APLICAVEL`"),
        "J3"],
      ["veredito REPROVADO no item E2", (t) =>
        t.replace("- [ ] E2 — veredito: `CONFERE`", "- [ ] E2 — veredito: `REPROVADO`"),
        "REPROVADO"],
      ["hash do relatorio embutido adulterado", (t) => {
        const atual = /<!-- F6-01:relatorio-embutido-hash=([0-9a-f]+) -->/.exec(t)?.[1] ?? "";
        const adulterado = atual.endsWith("0") ? `${atual.slice(0, -1)}1` : `${atual.slice(0, -1)}0`;
        return t.replace(atual, adulterado);
      }, "não fecha com o relatorio-procedencia"],
      ["regeneracao DIVERGENTE", (t) =>
        t.replace("<!-- F6-01:regeneracao=CONSISTENTE -->", "<!-- F6-01:regeneracao=DIVERGENTE -->"),
        "DIVERGENTE"],
      ["identidade da entrega divergente", (t) =>
        t.replace("<!-- F6-01:dossie:entrega=canonico -->", "<!-- F6-01:dossie:entrega=outra -->"),
        "pedida"],
      ["dossie sem nenhuma secao reconhecivel", (t) =>
        t.split("\n").slice(0, 1).join("\n"),
        "zero itens parseados"],
      ["entrega ausente no disco (saida vazia)", (t) => {
        void t;
        return "__MANTER_DOSSIE__";
      }, "ausente"],
    ];

    for (const [nome, mutacao, fragmento] of mutacoes) {
      let textoMutado: string;
      let dossieDaMutacao = join(tmp, "dossie-mutado.md");
      if (nome.startsWith("entrega sem dossie")) {
        textoMutado = "__REMOVIDO__";
      } else if (nome.startsWith("entrega ausente no disco")) {
        textoMutado = textoPreenchido;
        dossieDaMutacao = dossieValido;
      } else {
        textoMutado = mutacao(textoPreenchido);
      }
      if (nome.startsWith("entrega sem dossie")) {
        const ausente = join(tmp, "dossie-inexistente.md");
        await sondaNegativa(nome, fragmento, [
          "--entrega", "canonico", "--saida", dirEntrega, "--dossie", ausente,
        ]);
        continue;
      }
      await writeFile(dossieDaMutacao, textoMutado, "utf-8");
      if (nome.startsWith("entrega ausente no disco")) {
        const saidaVazia = join(tmp, "saida-vazia");
        await sondaNegativa(nome, fragmento, [
          "--entrega", "canonico", "--saida", saidaVazia, "--dossie", dossieDaMutacao,
        ]);
        continue;
      }
      await sondaNegativa(nome, fragmento, [
        "--entrega", "canonico", "--saida", dirEntrega, "--dossie", dossieDaMutacao,
      ]);
    }

    secao("[4/4] o dossie-rascunho canonico commitado e rejeitado (publicacao bloqueada)");
    await sondaNegativa(
      "dossie-canonico.md (rascunho sem assinaturas) nao libera publicacao",
      "veredito",
      ["--entrega", "canonico", "--saida", join(RAIZ, "output"), "--dossie", join(DIRETORIO_REVISAO, "dossie-canonico.md")],
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  console.log("");
  if (falhas > 0) {
    console.log(`revisar-gate: VERMELHO (${falhas} falha(s))`);
    process.exit(1);
  }
  console.log("revisar-gate: VERDE — o dossie e pre-condicao da publicacao, e o ∅-crit morde");
  console.log("(entrega sem dossie assinado = publicacao bloqueada; G-HUM, alavanca-mestra)");
}

main().catch((erro: unknown) => {
  console.error(`FALHOU: ${(erro as Error).message ?? String(erro)}`);
  process.exit(1);
});
