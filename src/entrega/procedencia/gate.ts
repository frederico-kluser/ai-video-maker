#!/usr/bin/env npx tsx
/**
 * src/entrega/procedencia/gate.ts
 *
 * O ORACULO do card F5-06 (W7). `just procedencia` chama isto.
 *
 * Cada checagem existe porque a sua ausencia produziria um verde que
 * nao significa nada — e todas imprimem denominador ("0 problemas" sem
 * "sobre N itens" e a armadilha C2 do AGENTS.md).
 *
 *   1. DENOMINADOR  o relatorio tem diretos E transitivos, gerados dos
 *                   cassetes commitados — sem denominador, o ∅-crit
 *                   passa sobre nada.
 *   2. ∅-CRIT  nenhum asset do video final (direto ou transitivo) sem
 *              origem declarada. VAZIO = entrega liberada.
 *   3. SONDA NEGATIVA  quatro mutacoes, cada uma tem de ficar VERMELHA
 *              pelo motivo certo: (a) hash sem registro, (b) registro
 *              com licenca vazia, (c) emenda com audio-fonte sem
 *              origem, (d) cadeia de derivacao ciclica.
 *   4. EMENDA (C3)  a origem dos bytes da emenda (audio-fonte +
 *              operacao) esta no relatorio transitivo, e o hash usado e
 *              o NOVO (da emenda), nunca o da fonte.
 *   5. PRESENCA  os assets conhecidos da fixture canonica estao no
 *              relatorio com licenca e provedor — per-item, nunca
 *              lista fechada (pergunta obrigatoria da W7, contrato-w7
 *              §12).
 *   6. DATA E TERMOS  a origem registrada carrega data de aquisicao e
 *              termos (atribuicao/termoDeBusca) quando existem.
 *   7. DETERMINISMO  duas geracoes com relogios diferentes diferem SO
 *              em `geradoEm` — o relatorio e regeneravel byte a byte,
 *              e e isso que permite reavaliar sem re-renderizar.
 *   8. AB-950  o relatorio declara "AB-950 continua fechado"
 *              (ADR-0003: omissao e falha de gate).
 *
 * O "video final" deste gate (antes do F5-01 mergear) e o manifesto
 * resolvido montado dos cassetes commitados: tudo que os estagios da
 * W4 produziram. Quando o F5-01 (hub) entregar a ponte AB-550, o
 * manifesto resolvido da ponte substitui essa montagem como entrada —
 * o gerador aceita qualquer ManifestoResolvido.
 *
 * Uso:
 *   npx tsx src/entrega/procedencia/gate.ts
 */

import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "../../store/store.js";
import type { Procedencia } from "../../store/procedencia.js";
import {
  ARQUIVO_CABECALHO,
  RAIZ_CASSETES_PADRAO,
} from "../../resolucao/cassete/formato.js";
import type { CabecalhoCassete } from "../../resolucao/cassete/formato.js";
import { verificarCobertura } from "../../resolucao/descoberta.js";
import { ORDEM_ESTAGIOS, hashDoManifesto } from "../../resolucao/contrato.js";
import type { Manifesto } from "../../contratos/manifesto.js";
import type {
  AssetResolvido,
  ManifestoResolvido,
  Sha256,
  RegistroEstagio,
} from "../../resolucao/manifesto-resolvido.js";
import { adaptarStore, gerarRelatorio } from "./relatorio.js";
import type { LeitorDeProcedencia } from "./relatorio.js";
import { MARCADOR_DERIVACAO, serializarRelatorio } from "./formato.js";
import type { RelatorioProcedencia } from "./formato.js";

// ─── Caminhos ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Raiz do repositorio, resolvida a partir deste arquivo. */
const RAIZ = resolve(__dirname, "..", "..", "..");

/** A fixture canonica — o manifesto base da W7 (tambem o de gravacao). */
const CAMINHO_MANIFESTO_CANONICO = resolve(
  RAIZ,
  "fixtures",
  "canonico",
  "manifesto-valido.json",
);

/** Hashes conhecidos da fixture canonica (per-item, nunca lista fechada). */
const HASH_TRILHA = "6ac2876495aa5f0a8d4558bc35aa3e05f6e88b667a097cd3b7f41f15874276bb";
const HASH_MIDIA = "dd6f0be76df31705998cd38604847d60ffa2833056dcc3864fb2f7047abeeb1f";
const HASH_GRAFICO = "943bdb0f597e16a6430121d85c451a809fb5f6bc8fb01679d17615474ba4003a";
const HASH_MUSICA_CCBY = "d9b8d3b5e4ae0a6ed336e769301546735ff34f29c14be6e1232da6b7096c0988";
/** Timing de locucao (whisper): entra DENTRO do cassete de locucao. */
const HASH_TIMING_LOCUCAO = "15ea1591069231d080425045634404e2d3c2e5f51bc84fe991fc147a36856bdd";

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

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Monta o "video final" da W7: manifesto resolvido dos cassetes commitados. */
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

/** Um store sintetico para as sondas: so o que a sonda colocar. */
class StoreSonda implements LeitorDeProcedencia {
  private readonly registros = new Map<Sha256, Procedencia>();
  constructor(registros: Readonly<Record<string, Procedencia>>) {
    for (const [hash, p] of Object.entries(registros)) this.registros.set(hash, p);
  }
  async lerProcedencia(hash: Sha256): Promise<Procedencia | null> {
    return this.registros.get(hash) ?? null;
  }
}

function procedenciaSonda(overrides: Partial<Procedencia>): Procedencia {
  return {
    license: "CC0-1.0",
    attributionRequired: false,
    source: "local",
    acquiredAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

/** Manifesto resolvido minimo para as sondas: so o que a sonda referenciar. */
function manifestoDaSonda(
  hashManifestoOriginal: Sha256,
  referencias: Readonly<Record<string, Sha256>>,
): ManifestoResolvido {
  const mapaPorPapel: Record<string, Record<string, Sha256>> = {};
  for (const [no, hash] of Object.entries(referencias)) {
    mapaPorPapel[no.startsWith("g") ? "nos_grafico" : "nos_midia"] ??= {};
    const campo = no.startsWith("g") ? "nos_grafico" : "nos_midia";
    mapaPorPapel[campo]![no] = hash;
  }
  return {
    schema_version: "ManifestoResolvido.1",
    hash_manifesto_original: hashManifestoOriginal,
    manifesto: {
      schema_version: "Manifesto.1",
      fps: 30,
      width: 1920,
      height: 1080,
      nos: [],
      cenas: [],
    },
    assets: {},
    nos_midia: mapaPorPapel["nos_midia"] ?? {},
    nos_locucao: {},
    nos_grafico: mapaPorPapel["nos_grafico"] ?? {},
    nos_codigo: {},
    nos_musica: {},
    trilha_sonora: null,
    estagios: [],
  };
}

const sha256Hex = (texto: string): string =>
  createHash("sha256").update(texto).digest("hex");

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  console.log("=== procedencia — relatorio transitivo (F5-06) ===");

  const manifestoBase = JSON.parse(
    await readFile(CAMINHO_MANIFESTO_CANONICO, "utf-8"),
  ) as Manifesto;

  const store = adaptarStore(new Store()); // .cache/store — pode nao existir; origens caem nos cassetes
  const resolvido = await montarResolvidoDosCassetes(RAIZ_CASSETES_PADRAO, manifestoBase);

  // ── 1. denominador ─────────────────────────────────────────────────────
  secao("1/8 denominador: relatorio com diretos e transitivos, dos cassetes commitados");
  const relatorio = await gerarRelatorio(resolvido, {
    raizCassetes: RAIZ_CASSETES_PADRAO,
    store,
    relogio: () => new Date("2026-08-13T12:00:00.000Z"),
  });

  console.log(
    `  ${relatorio.diretos.length} asset(s) direto(s), ` +
      `${relatorio.transitivos.length} transitivo(s), ` +
      `${resolvido.estagios.length} cassete(s) participante(s)`,
  );
  if (relatorio.diretos.length === 0) {
    falhou("denominador zero: nenhum asset direto no relatorio");
  } else {
    ok(`${relatorio.diretos.length} asset(s) direto(s) no relatorio`);
  }
  if (relatorio.transitivos.length === 0) {
    falhou("denominador zero: nenhum asset transitivo no relatorio");
  } else {
    ok(`${relatorio.transitivos.length} asset(s) transitivo(s) no relatorio`);
  }

  // ── 2. ∅-crit ──────────────────────────────────────────────────────────
  secao("2/8 ∅-crit: nenhum asset do video final sem origem declarada");
  if (relatorio.semOrigem.length > 0) {
    for (const falta of relatorio.semOrigem) {
      falhou(`${falta.hash.slice(0, 16)}… (${falta.papel}): ${falta.motivo}`);
    }
  } else {
    ok(`zero assets sem origem declarada (${relatorio.gapsDeData.length} gap(s) de data reportado(s))`);
  }

  // ── 3. sonda negativa ──────────────────────────────────────────────────
  secao("3/8 sonda negativa: quatro mutacoes tem de ficar VERMELHAS");

  const tmp = await mkdtemp(join(tmpdir(), "procedencia-gate-"));

  // (a) hash referenciado sem registro nenhum
  const semRegistro = sha256Hex("asset-sem-registro");
  const r1 = await gerarRelatorio(
    manifestoDaSonda(semRegistro, { "n-probe-a": semRegistro }),
    { raizCassetes: join(tmp, "cassetes"), store: new StoreSonda({}) },
  );
  if (
    r1.semOrigem.some(
      (f) => f.hash === semRegistro && f.motivo.includes("sem registro"),
    )
  ) {
    ok("(a) hash sem registro nenhum acusado como sem origem");
  } else {
    falhou("(a) SONDA: hash sem registro nenhum NAO foi acusado");
  }

  // (b) registro com licenca vazia
  const licencaVazia = sha256Hex("asset-licenca-vazia");
  const r2 = await gerarRelatorio(
    manifestoDaSonda(licencaVazia, { "n-probe-b": licencaVazia }),
    {
      raizCassetes: join(tmp, "cassetes"),
      store: new StoreSonda({ [licencaVazia]: procedenciaSonda({ license: "" }) }),
    },
  );
  if (
    r2.semOrigem.some(
      (f) => f.hash === licencaVazia && f.motivo.includes("licenca"),
    )
  ) {
    ok("(b) registro com licenca vazia acusado como sem origem");
  } else {
    falhou("(b) SONDA: registro com licenca vazia NAO foi acusado");
  }

  // (c) emenda com audio-fonte sem origem
  const fonteSumida = sha256Hex("audio-fonte-sem-registro");
  const emendaOrfa = sha256Hex("emenda-de-audio-fonte-sumida");
  const r3 = await gerarRelatorio(
    manifestoDaSonda(emendaOrfa, { "n-probe-c": emendaOrfa }),
    {
      raizCassetes: join(tmp, "cassetes"),
      store: new StoreSonda({
        [emendaOrfa]: procedenciaSonda({
          notes: `${MARCADOR_DERIVACAO}${fonteSumida}; operacao=emenda de locucao v1.0.0`,
        }),
      }),
    },
  );
  if (
    r3.semOrigem.some(
      (f) => f.hash === emendaOrfa && f.motivo.includes("audio-fonte"),
    )
  ) {
    ok("(c) emenda com audio-fonte sem origem acusada");
  } else {
    falhou("(c) SONDA: emenda com audio-fonte sem origem NAO foi acusada");
  }

  // (d) cadeia de derivacao ciclica
  const hashX = sha256Hex("emenda-x");
  const hashY = sha256Hex("emenda-y");
  const r4 = await gerarRelatorio(
    manifestoDaSonda(hashX, { "n-probe-d": hashX }),
    {
      raizCassetes: join(tmp, "cassetes"),
      store: new StoreSonda({
        [hashX]: procedenciaSonda({ notes: `${MARCADOR_DERIVACAO}${hashY}` }),
        [hashY]: procedenciaSonda({ notes: `${MARCADOR_DERIVACAO}${hashX}` }),
      }),
    },
  );
  if (
    r4.semOrigem.some(
      (f) => f.hash === hashX && f.motivo.includes("ciclica"),
    )
  ) {
    ok("(d) cadeia de derivacao ciclica acusada");
  } else {
    falhou("(d) SONDA: cadeia de derivacao ciclica NAO foi acusada");
  }

  // ── 4. emenda (C3): origem no relatorio transitivo ─────────────────────
  secao("4/8 emenda (C3): origem dos bytes emendados no relatorio transitivo");
  const audioFonte = sha256Hex("audio-fonte-real");
  const emenda = sha256Hex("emenda-real");
  const rEmenda = await gerarRelatorio(
    manifestoDaSonda(emenda, { "n-probe-e": emenda }),
    {
      raizCassetes: join(tmp, "cassetes"),
      store: new StoreSonda({
        [emenda]: procedenciaSonda({
          notes: `${MARCADOR_DERIVACAO}${audioFonte}; operacao=emenda de locucao v1.0.0`,
        }),
        [audioFonte]: procedenciaSonda({
          license: "CC0-1.0",
          attributionRequired: true,
          attribution: "Audio sintetico de referencia — nao e voz humana",
          source: "local",
          acquiredAt: "2026-08-13T12:09:52.576Z",
        }),
      }),
    },
  );

  const diretaEmenda = rEmenda.diretos.find((e) => e.hash === emenda);
  const transitivaFonte = rEmenda.transitivos.find((e) => e.hash === audioFonte);

  if (diretaEmenda !== undefined && diretaEmenda.derivadoDe?.hash === audioFonte) {
    ok(`a emenda declara derivacao do audio-fonte ${audioFonte.slice(0, 16)}… (operacao registrada)`);
  } else {
    falhou("SONDA/EMENDA: a emenda direta nao declara a derivacao do audio-fonte");
  }
  if (transitivaFonte !== undefined && transitivaFonte.origem !== null) {
    ok(`audio-fonte presente como transitivo com origem (licenca ${transitivaFonte.origem.licenca})`);
  } else {
    falhou("SONDA/EMENDA: o audio-fonte nao apareceu como transitivo com origem");
  }
  if (rEmenda.semOrigem.length === 0) {
    ok("cadeia emenda → audio-fonte inteira com origem declarada");
  } else {
    falhou("SONDA/EMENDA: cadeia valida foi acusada como sem origem");
  }

  // ── 5. presenca per-item (pergunta obrigatoria da W7, §12) ─────────────
  secao("5/8 presenca per-item: os assets conhecidos estao no relatorio");
  const procurar = (hash: Sha256): { entrada?: { papeis: readonly string[]; origem: { licenca: string; provedor: string } | null } } => {
    const e = relatorio.diretos.find((x) => x.hash === hash) ??
      relatorio.transitivos.find((x) => x.hash === hash);
    return e === undefined ? {} : { entrada: { papeis: e.papeis, origem: e.origem } };
  };

  const trilha = procurar(HASH_TRILHA);
  if (trilha.entrada !== undefined && trilha.entrada.papeis.includes("trilha-sonora") && trilha.entrada.origem !== null) {
    ok(`trilha sonora ${HASH_TRILHA.slice(0, 16)}… presente com origem`);
  } else {
    falhou(`a trilha sonora ${HASH_TRILHA.slice(0, 16)}… NAO esta no relatorio com origem`);
  }

  const midia = procurar(HASH_MIDIA);
  if (midia.entrada !== undefined && midia.entrada.papeis.includes("midia") && midia.entrada.origem !== null) {
    ok(`midia ${HASH_MIDIA.slice(0, 16)}… presente com origem`);
  } else {
    falhou(`a midia ${HASH_MIDIA.slice(0, 16)}… NAO esta no relatorio com origem`);
  }

  const grafico = procurar(HASH_GRAFICO);
  if (grafico.entrada !== undefined && grafico.entrada.papeis.includes("grafico") && grafico.entrada.origem !== null) {
    ok(`grafico ${HASH_GRAFICO.slice(0, 16)}… presente com origem`);
  } else {
    falhou(`o grafico ${HASH_GRAFICO.slice(0, 16)}… NAO esta no relatorio com origem`);
  }

  const musicaCcBy = procurar(HASH_MUSICA_CCBY);
  if (musicaCcBy.entrada !== undefined && musicaCcBy.entrada.papeis.includes("musica") && musicaCcBy.entrada.origem !== null) {
    ok(`asset de musica CC BY ${HASH_MUSICA_CCBY.slice(0, 16)}… presente como direto com origem`);
  } else {
    falhou(`o asset de musica CC BY ${HASH_MUSICA_CCBY.slice(0, 16)}… NAO esta no relatorio com origem`);
  }

  const timingLocucao = relatorio.transitivos.find((e) => e.hash === HASH_TIMING_LOCUCAO);
  if (timingLocucao !== undefined && timingLocucao.papeis.includes("cassete-locucao") && timingLocucao.origem !== null) {
    ok(`timing de locucao ${HASH_TIMING_LOCUCAO.slice(0, 16)}… presente como transitivo (entrou dentro do cassete de locucao)`);
  } else {
    falhou(`o timing de locucao ${HASH_TIMING_LOCUCAO.slice(0, 16)}… NAO esta no relatorio como transitivo com origem`);
  }

  // ── 6. data e termos ───────────────────────────────────────────────────
  secao("6/8 data e termos: a origem registrada carrega data e atribuicao");
  const trilhaCompleta = relatorio.diretos.find((e) => e.hash === HASH_TRILHA) ??
    relatorio.transitivos.find((e) => e.hash === HASH_TRILHA);
  if (trilhaCompleta?.origem?.adquiridoEm !== undefined && trilhaCompleta.origem.adquiridoEm.length > 0) {
    ok(`trilha com data de aquisicao (${trilhaCompleta.origem.adquiridoEm})`);
  } else {
    falhou("a trilha sonora NAO tem data de aquisicao no relatorio");
  }

  const musicaCcByCompleta = relatorio.diretos.find((e) => e.hash === HASH_MUSICA_CCBY) ??
    relatorio.transitivos.find((e) => e.hash === HASH_MUSICA_CCBY);
  if (
    musicaCcByCompleta?.origem?.atribuicao !== undefined &&
    musicaCcByCompleta.origem.atribuicaoObrigatoria === true
  ) {
    ok("asset CC BY com atribuicao e atribuicaoObrigatoria no relatorio");
  } else {
    falhou("o asset CC BY NAO registra atribuicao obrigatoria no relatorio");
  }

  // ── 7. determinismo (C9) ───────────────────────────────────────────────
  secao("7/8 determinismo: duas geracoes com relogios diferentes");
  const comRelogioA = await gerarRelatorio(resolvido, {
    raizCassetes: RAIZ_CASSETES_PADRAO,
    store,
    relogio: () => new Date("2026-01-01T00:00:00.000Z"),
  });
  const comRelogioB = await gerarRelatorio(resolvido, {
    raizCassetes: RAIZ_CASSETES_PADRAO,
    store,
    relogio: () => new Date("2026-12-31T23:59:59.000Z"),
  });
  const jsonA = serializarRelatorio(comRelogioA);
  const jsonB = serializarRelatorio(comRelogioB);
  if (jsonA === jsonB) {
    falhou("duas geracoes com relogios diferentes produziram bytes identicos — geradoEm nao entrou?");
  } else {
    const semDataA = JSON.parse(jsonA) as { geradoEm?: string };
    const semDataB = JSON.parse(jsonB) as { geradoEm?: string };
    delete (semDataA as { geradoEm?: string }).geradoEm;
    delete (semDataB as { geradoEm?: string }).geradoEm;
    if (JSON.stringify(semDataA) === JSON.stringify(semDataB)) {
      ok("as duas geracoes diferem SO em geradoEm");
    } else {
      falhou("as duas geracoes divergem alem de geradoEm");
    }
  }

  // ── 8. AB-950 ──────────────────────────────────────────────────────────
  secao("8/8 AB-950: enquadramento declarado no relatorio");
  if (relatorio.enquadramento.ab950 === "AB-950 continua fechado") {
    ok("AB-950 continua fechado — enquadramento de uso pessoal (ADR-0003)");
  } else {
    falhou("o relatorio NAO declara 'AB-950 continua fechado'");
  }

  await rm(tmp, { recursive: true, force: true });

  console.log("");
  if (falhas > 0) {
    console.log(`=== VERMELHO: ${falhas} checagem(ns) falharam ===`);
    return 1;
  }
  console.log("=== VERDE: procedencia (F5-06) ===");
  return 0;
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("procedencia: erro inesperado:", erro);
    process.exit(2);
  },
);
