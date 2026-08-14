#!/usr/bin/env npx tsx
/**
 * tools/midia/verificar.ts — o oraculo do card F2-04, incl. determinismo
 *
 * Roda `just res-midia`. Prova, COM A REDE BLOQUEADA neste mesmo processo
 * (primeira linha do `main`), as afirmacoes do card:
 *
 *   1. o cassete nao e vazio — tem chamadas reais de busca E download;
 *   2. C7 — nenhuma URL atravessou a fronteira, e ela nao sumiu, mudou
 *      de lado (esta na procedencia);
 *   3. os bytes dos assets rehasheiam para o SHA-256 declarado;
 *   4. com cache quente, o estagio nao chama a rede — e nem `resolver()`
 *      roda (o espiao lancaria);
 *   5. o cassete e sosia, nao sucessor: rodar `resolver()` contra os
 *      bytes crus gravados reproduz `resultado.json` byte a byte;
 *   6. determinismo do estagio, por regravacao e diff — A PARTIR DO
 *      CASSETE (ver abaixo), duas vezes com relogios diferentes, zero
 *      refutacoes exigidas e sonda negativa;
 *   7. zero credencial em qualquer byte do cassete.
 *
 * POR QUE O DETERMINISMO E MEDIDO A PARTIR DO CASSETE, NAO DA REDE
 * ─────────────────────────────────────────────────────────────────────
 * `just res-cassete --estagio midia` regrava duas vezes contra a rede
 * real, e a rede real refuta o diff por duas causas independentes, sem
 * nenhum defeito do estagio (registrado como AB-440, mesmo classe do
 * AB-473 do irmao musica):
 *
 *   a. headers volateis do provedor entram crus em `chamadas.json` —
 *      `date`, `age`, `server`, `x-request-id`, `server-timing`,
 *      `x-search-id`, `x-cache`, `x-cache-status`, `content-length`,
 *      `transfer-encoding` — e `CAMPOS_VOLATEIS`
 *      (src/resolucao/cassete/formato.ts) so cobre `volatil.json#/*` e
 *      `procedencia.json#/adquiridoEm`. A decisao da whitelist e do
 *      join F2-07, na W5.
 *   b. o CORPO da busca muda entre gravacoes consecutivas: o ranking do
 *      Commons nao e estavel nem dentro do mesmo segundo (hashCorpo
 *      8883742a… -> 25c8700d…, bytesCorpo 14222 -> 14223 numa gravacao
 *      dupla). O AB-439 reconhecia drift "entre dias"; o revisor
 *      provou que e mais rapido que isso.
 *
 * A prova correta regrava a partir do cassete: `fetchReal` vira o
 * reprodutor do proprio cassete, e o que varia entre as duas passadas
 * passa a ser so o estagio — que e o que se quer medir. As chamadas
 * REAIS do cassete (3 buscas + 3 downloads de binario — um par por no
 * de midia da fixture canonica) rodam em cada
 * gravacao: a fase 6 conta e nomeia as chamadas regravadas, para a
 * prova nunca voltar a ser vacua (C2).
 *
 * Cada fase tem sonda negativa: uma prova que nunca reprovou nao e
 * prova.
 *
 * Uso:  npx tsx tools/midia/verificar.ts
 */

import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bloquearRede, tentativasDeSaida } from "../../src/resolucao/rede/bloqueio.js";
import {
  ARQUIVO_CHAMADAS,
  ARQUIVO_RESULTADO,
  DIRETORIO_CORPOS,
  PADROES_CREDENCIAL,
  RAIZ_CASSETES_PADRAO,
  diretorioDoCassete,
  procurarCredencial,
  serializarCanonico,
} from "../../src/resolucao/cassete/formato.js";
import type { ChamadaGravada } from "../../src/resolucao/cassete/formato.js";
import { lerCassete, criarFetchDeCassete } from "../../src/resolucao/cassete/reprodutor.js";
import { gravarCassete } from "../../src/resolucao/cassete/gravador.js";
import { diffCassetes, formatarDiff } from "../../src/resolucao/cassete/diff.js";
import { chaveDoEstagio } from "../../src/resolucao/contrato.js";
import { Orquestrador } from "../../src/resolucao/orquestrador.js";
import { encontrarURLs } from "../../src/resolucao/manifesto-resolvido.js";
import type {
  AssetResolvido,
  ParcialResolvido,
} from "../../src/resolucao/manifesto-resolvido.js";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import estagio from "../../src/resolucao/midia/estagio.js";
import { lerManifestoDeGravacao } from "../../src/resolucao/midia/gravar.js";

// ─── Placar ─────────────────────────────────────────────────────────────────────

let falhas = 0;

function ok(mensagem: string): void {
  console.log(`  [OK] ${mensagem}`);
}

function falhou(mensagem: string): void {
  console.log(`  [FALHOU] ${mensagem}`);
  falhas++;
}

function exigir(condicao: boolean, mensagem: string): void {
  if (condicao) ok(mensagem);
  else falhou(mensagem);
}

function fase(titulo: string): void {
  console.log("");
  console.log(`--- ${titulo} ---`);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Divisao das chamadas gravadas em busca (api.php) e download (upload). */
function dividirChamadas(chamadas: readonly ChamadaGravada[]): {
  buscas: readonly ChamadaGravada[];
  downloads: readonly ChamadaGravada[];
} {
  return {
    buscas: chamadas.filter((c) => c.url.includes("/w/api.php")),
    downloads: chamadas.filter((c) => c.url.includes("upload.wikimedia.org")),
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  // A rede cai ANTES de qualquer leitura. Tudo abaixo desta linha e
  // offline por construcao, nao por educacao.
  bloquearRede({ permitirLoopback: false });

  console.log("=== res-midia — card F2-04, com a rede bloqueada neste processo ===");

  const manifesto = await lerManifestoDeGravacao();
  const chave = chaveDoEstagio(estagio, manifesto);
  const dirCassete = diretorioDoCassete(RAIZ_CASSETES_PADRAO, "midia", chave);

  console.log(`Estagio:  midia v${estagio.identidade.versao}`);
  console.log(`Chave:    ${chave}`);
  console.log(`Cassete:  ${dirCassete}`);

  const cassete = await lerCassete(RAIZ_CASSETES_PADRAO, "midia", chave);
  const resultadoGravado = cassete.resultado;
  const hashes = Object.keys(resultadoGravado.assets).sort();
  const nosMidiaGravado = resultadoGravado.nos_midia ?? {};
  const { buscas, downloads } = dividirChamadas(cassete.chamadas);

  // ─── Fase 1: denominador ──────────────────────────────────────────────────
  fase("[1/7] denominador — sem isto, todo o resto e vacuidade (C2)");
  console.log(`  assets no resultado: ${hashes.length}`);
  console.log(`  chamadas gravadas:   ${cassete.chamadas.length} (${buscas.length} busca + ${downloads.length} download)`);
  console.log(`  nos de midia:        ${Object.keys(nosMidiaGravado).length}`);
  console.log(`  procedencias:        ${cassete.procedencia.assets.length}`);
  exigir(hashes.length > 0, `o cassete tem ${hashes.length} asset(s)`);
  exigir(
    cassete.chamadas.length > 0,
    `o cassete tem ${cassete.chamadas.length} chamada(s) gravada(s)`,
  );
  exigir(buscas.length > 0, `o cassete tem ${buscas.length} chamada(s) de BUSCA (api.php)`);
  exigir(
    downloads.length > 0,
    `o cassete tem ${downloads.length} chamada(s) de DOWNLOAD de binario (upload.wikimedia.org)`,
  );
  exigir(
    cassete.procedencia.assets.length === hashes.length,
    `procedencia cobre os ${hashes.length} asset(s) (${cassete.procedencia.assets.length})`,
  );

  // ─── Fase 2: a URL nao desceu — e nao sumiu ───────────────────────────────
  fase("[2/7] C7 — nenhuma URL abaixo da fronteira, e a URL preservada acima");
  const achados = encontrarURLs(resultadoGravado);
  exigir(achados.length === 0, `encontrarURLs(resultado.json) = ${achados.length} ocorrencia(s)`);
  for (const a of achados) console.log(`         ${a.caminho} = ${a.valor}`);

  // A metade que quase todo mundo esquece: provar que a URL EXISTE do
  // outro lado. Um estagio que simplesmente apagasse a origem tambem
  // passaria na checagem de cima — e destruiria a auditoria de licenca.
  const comOrigem = cassete.procedencia.assets.filter(
    (a) => typeof a.origem === "string" && /^https:\/\//.test(a.origem),
  );
  exigir(
    comOrigem.length === cassete.procedencia.assets.length,
    `todas as ${cassete.procedencia.assets.length} procedencias guardam a URL de origem ` +
      `(${comOrigem.length}) — a URL mudou de lado, nao foi apagada`,
  );

  // Sonda negativa: a mesma funcao TEM de reprovar uma parcial com URL.
  const primeiro = hashes[0] as string;
  const assetOriginal = resultadoGravado.assets[primeiro] as AssetResolvido;
  const contrabando: ParcialResolvido = {
    ...resultadoGravado,
    assets: {
      ...resultadoGravado.assets,
      // Uma URL no credito — o formato que a atribuicao de verdade usa.
      [primeiro]: {
        ...assetOriginal,
        atribuicao: "Autor da obra, https://commons.wikimedia.org/wiki/File:Exemplo.png",
      },
    },
  };
  exigir(
    encontrarURLs(contrabando).length > 0,
    "sonda negativa: uma URL contrabandeada na atribuicao E detectada",
  );

  // ─── Fase 3: o hash e o byte ──────────────────────────────────────────────
  fase("[3/7] os bytes dos assets rehasheiam para o SHA-256 declarado");
  for (const [hash, meta] of Object.entries(resultadoGravado.assets)) {
    const bytes = await readFile(join(dirCassete, DIRETORIO_CORPOS, hash));
    exigir(
      sha256Hex(bytes) === hash,
      `corpos/${hash.slice(0, 12)}… rehasheia para o hash declarado`,
    );
    exigir(bytes.length === meta.byteSize, `byteSize confere para ${hash.slice(0, 12)}…`);
  }

  // Sonda negativa: um byte trocado num asset TEM de reprovar o rehash.
  const alvo = hashes[0] as string;
  const tmpByte = await mkdtemp(join(tmpdir(), "midia-byte-"));
  try {
    const original = await readFile(join(dirCassete, DIRETORIO_CORPOS, alvo));
    const adulterado = Buffer.from(original);
    adulterado[0] = (adulterado[0] ?? 0) ^ 0xff;
    await writeFile(join(tmpByte, "adulterado"), adulterado);
    const corrompido = await readFile(join(tmpByte, "adulterado"));
    exigir(
      sha256Hex(corrompido) !== alvo,
      "sonda negativa: um byte trocado no corpo NAO rehasheia para o hash declarado",
    );
  } finally {
    await rm(tmpByte, { recursive: true, force: true });
  }

  // ─── Fase 4: cache quente + rede bloqueada => zero rede ───────────────────
  fase("[4/7] cache quente: o estagio NAO chama a rede (nem `resolver()` roda)");
  const antes = tentativasDeSaida().length;
  const espiao = {
    ...estagio,
    resolver(): never {
      throw new Error(
        "resolver() foi chamado com cache quente — o orquestrador deveria ter " +
          "reproduzido o cassete sem tocar no estagio.",
      );
    },
  };
  const orquestrador = new Orquestrador({
    estagios: [espiao],
    raizCassetes: RAIZ_CASSETES_PADRAO,
    modo: "offline",
  });
  const resolvido = await orquestrador.resolverEstagio("midia", manifesto);
  const depois = tentativasDeSaida().length;
  ok("o orquestrador resolveu sem invocar `resolver()` (o espiao teria lancado)");
  exigir(
    depois === antes,
    `zero tentativas de saida durante a reproducao (antes=${antes}, depois=${depois})`,
  );
  exigir(
    resolvido.resolvido.nos_midia["n-005"] === nosMidiaGravado["n-005"] &&
      resolvido.resolvido.nos_midia["n-006"] === nosMidiaGravado["n-006"] &&
      resolvido.resolvido.nos_midia["n-007"] === nosMidiaGravado["n-007"],
    "os nos n-005/n-006/n-007 reproduzidos sao os mesmos do cassete",
  );
  exigir(
    resolvido.resolvido.estagios[0]?.origem === "cassete",
    `o registro declara origem "cassete" (${resolvido.resolvido.estagios[0]?.origem})`,
  );

  // ─── Fase 5: sosia, nao sucessor ──────────────────────────────────────────
  fase("[5/7] o cassete e sosia: `resolver()` sobre os bytes CRUS reproduz o resultado");
  const tmpReplay = await mkdtemp(join(tmpdir(), "midia-replay-"));
  try {
    const saida = await estagio.resolver({
      manifesto,
      parametros: estagio.parametros,
      fetch: criarFetchDeCassete(cassete, dirCassete),
      diretorioTrabalho: tmpReplay,
    });
    exigir(
      serializarCanonico(saida.parcial) === serializarCanonico(resultadoGravado),
      "rodar o estagio contra os corpos gravados reproduz `resultado.json` byte a byte",
    );

    // A prova de que a resposta foi gravada SUJA: o corpo cru da busca
    // ainda tem HTML e o booleano como string "true", e o resultado
    // limpo saiu disso. Se o gravador tivesse "consertado", o corpo
    // estaria limpo e o normalizador nunca mais seria testado.
    const corpoBusca = await corpoDaChamadaDeBusca(dirCassete, cassete.chamadas);
    // Onda 3: o cassete novo foi gravado para a fixture canonica e os
    // tres assets adquiridos sao CC0/PDM — o corpo da PRIMEIRA busca
    // ("code health checker") traz AttributionRequired como string
    // "false" (os candidatos CC0), nao "true". O que se prova aqui e a
    // STRING-nidade do campo (o provedor entrega texto, o estagio
    // normaliza para booleano) — o valor exato depende do cassete.
    exigir(
      /"AttributionRequired":\s*\{\s*"value":\s*"(true|false)"/.test(corpoBusca),
      'o corpo gravado ainda traz AttributionRequired como STRING ("true"/"false")',
    );
    exigir(
      /href=\\"\/\/commons\.wikimedia\.org/.test(corpoBusca),
      "o corpo gravado ainda traz HTML com href relativo a protocolo",
    );
    ok("logo: a limpeza e do ESTAGIO e roda tambem no replay");
  } finally {
    await rm(tmpReplay, { recursive: true, force: true });
  }

  // ─── Fase 6: determinismo, regravando a partir do cassete ─────────────────
  fase("[6/7] determinismo: duas regravacoes a partir do cassete, relogios diferentes");
  const tmpDet = await mkdtemp(join(tmpdir(), "midia-determinismo-"));
  try {
    const alvos: string[] = [];
    for (const [indice, quando] of [
      "2026-01-01T00:00:00.000Z",
      "2026-12-31T23:59:59.000Z",
    ].entries()) {
      const raiz = join(tmpDet, `gravacao-${indice + 1}`);
      const g = await gravarCassete(estagio, {
        raiz,
        manifesto,
        diretorioTrabalho: tmpDet,
        // A rede e substituida pelo cassete: o que varia entre as duas
        // passadas passa a ser so o estagio, que e o que se quer medir.
        fetchReal: criarFetchDeCassete(cassete, dirCassete),
        relogio: () => new Date(quando),
      });
      alvos.push(g.diretorio);

      // Denominador anti-vacuidade: a regravacao TEM de ter rodado as
      // chamadas reais do cassete — busca E download de binarios. Um
      // manifesto sem no de midia faria zero chamadas e "passaria" (C2);
      // esta linha e a que impede o verde por vazio.
      const regravado = JSON.parse(
        await readFile(join(g.diretorio, ARQUIVO_CHAMADAS), "utf-8"),
      ) as ChamadaGravada[];
      const { buscas: b, downloads: d } = dividirChamadas(regravado);
      exigir(
        g.quantidadeChamadas > 0 && b.length > 0 && d.length > 0,
        `gravacao ${indice + 1}: ${g.quantidadeChamadas} chamadas reais ` +
          `(${b.length} busca + ${d.length} download) — a perna de determinismo NAO e vacua`,
      );
    }
    const [a, b] = alvos as [string, string];
    const diff = await diffCassetes(a, b);
    console.log(
      formatarDiff(diff)
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n"),
    );
    exigir(diff.refutacoes === 0, `zero refutacoes (${diff.explicadas} diferenca(s) explicada(s))`);

    // Sonda negativa: mutar o resultado TEM de deixar o diff vermelho.
    const caminho = join(b, ARQUIVO_RESULTADO);
    const dados = JSON.parse(await readFile(caminho, "utf-8")) as Record<string, unknown>;
    dados["__mutacao_da_sonda"] = "um byte que nao estava la";
    await writeFile(caminho, serializarCanonico(dados), "utf-8");
    const mutado = await diffCassetes(a, b);
    exigir(
      mutado.refutacoes > 0,
      `sonda negativa: resultado mutado deixa o diff VERMELHO (${mutado.refutacoes} refutacao(oes))`,
    );
  } finally {
    await rm(tmpDet, { recursive: true, force: true });
  }

  // ─── Fase 7: credencial ───────────────────────────────────────────────────
  fase("[7/7] credencial: nenhum byte do cassete carrega segredo");
  const arquivos = await listarTudo(dirCassete);
  console.log(`  arquivos varridos: ${arquivos.length} (${PADROES_CREDENCIAL.length} padroes)`);
  exigir(arquivos.length > 0, "o denominador da varredura nao e zero");
  let comCredencial = 0;
  for (const arquivo of arquivos) {
    const texto = (await readFile(arquivo)).toString("utf-8");
    const achadosCred = procurarCredencial(texto);
    if (achadosCred.length > 0) {
      falhou(`credencial em ${arquivo}: ${achadosCred.join(", ")}`);
      comCredencial++;
    }
  }
  exigir(comCredencial === 0, "nenhum arquivo do cassete casa padrao de credencial");

  // O provedor escolhido nao usa credencial: nao ha header de
  // autenticacao gravado nem chave em query string.
  const comAuth = cassete.chamadas.filter((c) =>
    Object.keys(c.headersRequisicao).some((h) =>
      ["authorization", "x-api-key", "apikey", "api-key", "cookie"].includes(h.toLowerCase()),
    ),
  );
  exigir(comAuth.length === 0, `nenhuma das ${cassete.chamadas.length} chamadas levou header de autenticacao`);
  const comChaveNaQuery = cassete.chamadas.filter((c) =>
    /[?&](api[_-]?key|key|token|access[_-]?token|secret|signature|sig)=/i.test(c.url),
  );
  exigir(
    comChaveNaQuery.length === 0,
    `nenhuma das ${cassete.chamadas.length} URLs gravadas traz chave em query string`,
  );

  // Sonda negativa do proprio varredor.
  exigir(
    procurarCredencial('{"api_key": "AKIAIOSFODNN7EXAMPLE"}').length > 0,
    "sonda negativa: o varredor de credencial reconhece um segredo plantado",
  );

  // ─── Veredito ─────────────────────────────────────────────────────────────
  console.log("");
  if (falhas > 0) {
    console.log(`=== VERMELHO: ${falhas} verificacao(oes) falharam ===`);
    return 1;
  }
  console.log("=== VERDE: res-midia ===");
  return 0;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** O corpo cru de uma chamada de busca ao Commons (a unica que devolve JSON). */
async function corpoDaChamadaDeBusca(
  dirCassete: string,
  chamadas: readonly ChamadaGravada[],
): Promise<string> {
  const chamada = chamadas.find((c) => c.url.includes("/w/api.php"));
  if (chamada === undefined) {
    throw new Error("cassete sem chamada de busca — o formato mudou?");
  }
  return (await readFile(join(dirCassete, DIRETORIO_CORPOS, chamada.hashCorpo))).toString("utf-8");
}

/** Todos os arquivos do cassete, recursivamente. */
async function listarTudo(raiz: string): Promise<string[]> {
  const saida: string[] = [];
  const entradas = await readdir(raiz, { withFileTypes: true });
  for (const e of entradas) {
    const completo = join(raiz, e.name);
    if (e.isDirectory()) saida.push(...(await listarTudo(completo)));
    else saida.push(completo);
  }
  return saida.sort();
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("res-midia: erro inesperado:", erro);
    process.exit(2);
  },
);
