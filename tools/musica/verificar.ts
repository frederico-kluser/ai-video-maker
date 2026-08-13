#!/usr/bin/env npx tsx
/**
 * tools/musica/verificar.ts — o oraculo do card F2-06
 *
 * Roda `just res-musica`. Prova, COM A REDE BLOQUEADA neste mesmo
 * processo (primeira linha do `main`), as quatro afirmacoes do card:
 *
 *   1. o efeito remoto virou HASH no store, e o byte confere;
 *   2. nenhuma URL atravessou a fronteira — e ela nao sumiu, mudou de
 *      lado (esta na procedencia);
 *   3. com cache quente, o estagio nao chama a rede;
 *   4. o cassete e sosia, nao sucessor: rodar `resolver()` contra os
 *      bytes crus gravados reproduz `resultado.json` byte a byte.
 *
 * Mais uma que o contrato pede e que so pode ser provada aqui:
 *
 *   5. determinismo do estagio, por regravacao e diff. Note QUAL
 *      regravacao: a partir do CASSETE, nao da rede. `just res-cassete
 *      --estagio musica` regrava duas vezes contra a rede real, e a rede
 *      real devolve `date`, `age`, `x-cache` e `x-request-id` diferentes
 *      a cada resposta — headers que vao para `chamadas.json` e que
 *      `CAMPOS_VOLATEIS` nao declara. O diff reprova por causa do
 *      relogio do fornecedor, nao por causa do estagio. Regravando a
 *      partir do cassete, os headers sao os gravados (identicos nas duas
 *      passadas) e o que sobra medindo e exatamente o que se quer medir.
 *      Registrado no ledger como AB-473.
 *
 * Cada fase tem sonda negativa: uma prova que nunca reprovou nao e
 * prova. E cada fase imprime o DENOMINADOR — "nenhum problema
 * encontrado" sobre zero itens e o falso-verde da casa (C2).
 *
 * Uso:  npx tsx tools/musica/verificar.ts
 */

import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bloquearRede, tentativasDeSaida } from "../../src/resolucao/rede/bloqueio.js";
import {
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
import { Store } from "../../src/store/store.js";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import { criarEstagioMusica } from "../../src/resolucao/musica/estagio.js";
import {
  formatarHidratacao,
  hidratarStoreDoCassete,
} from "../../src/resolucao/musica/hidratar.js";

const MANIFESTO_PADRAO = "fixtures/canonico/manifesto-valido.json";

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

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  // A rede cai ANTES de qualquer leitura. Tudo abaixo desta linha e
  // offline por construcao, nao por educacao.
  bloquearRede({ permitirLoopback: false });

  console.log("=== res-musica — card F2-06, com a rede bloqueada neste processo ===");

  const manifesto = JSON.parse(await readFile(MANIFESTO_PADRAO, "utf-8")) as Manifesto;
  const estagio = criarEstagioMusica();
  const chave = chaveDoEstagio(estagio, manifesto);
  const dirCassete = diretorioDoCassete(RAIZ_CASSETES_PADRAO, "musica", chave);

  console.log(`Estagio:  musica v${estagio.identidade.versao}`);
  console.log(`Chave:    ${chave}`);
  console.log(`Cassete:  ${dirCassete}`);

  const cassete = await lerCassete(RAIZ_CASSETES_PADRAO, "musica", chave);
  const resultadoGravado = cassete.resultado;
  const hashes = Object.keys(resultadoGravado.assets).sort();

  // ─── Fase 1: denominador ──────────────────────────────────────────────────
  fase("[1/7] denominador — sem isto, todo o resto e vacuidade (C2)");
  console.log(`  assets no resultado: ${hashes.length}`);
  console.log(`  chamadas gravadas:   ${cassete.chamadas.length}`);
  console.log(`  nos com efeito:      ${Object.keys(resultadoGravado.nos_musica ?? {}).length}`);
  console.log(`  procedencias:        ${cassete.procedencia.assets.length}`);
  exigir(hashes.length > 0, `o cassete tem ${hashes.length} asset(s)`);
  exigir(cassete.chamadas.length > 0, `o cassete tem ${cassete.chamadas.length} chamada(s) gravada(s)`);
  exigir(
    cassete.procedencia.assets.length === hashes.length,
    `procedencia cobre os ${hashes.length} asset(s) (${cassete.procedencia.assets.length})`,
  );
  exigir(
    typeof resultadoGravado.trilha_sonora === "string",
    "ha trilha sonora resolvida",
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
      // Um asset cujo campo de atribuicao carrega endereco — o jeito
      // mais realista de uma URL vazar, porque e exatamente o formato
      // que a Creative Commons pede no credito completo.
      [primeiro]: {
        ...assetOriginal,
        atribuicao: "Kevin MacLeod (incompetech.com) https://creativecommons.org/licenses/by/4.0/",
      },
    },
  };
  exigir(
    encontrarURLs(contrabando).length > 0,
    "sonda negativa: uma URL contrabandeada na atribuicao E detectada",
  );

  // ─── Fase 3: o hash e o byte, no store ────────────────────────────────────
  fase("[3/7] o efeito remoto virou hash no store — verificado byte a byte");
  const tmpStore = await mkdtemp(join(tmpdir(), "musica-store-"));
  try {
    const relatorio = await hidratarStoreDoCassete(dirCassete, new Store({ root: tmpStore }));
    console.log(
      formatarHidratacao(relatorio)
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n"),
    );
    exigir(relatorio.ok, "todo asset citado no resultado existe como conteudo e rehasheia igual");

    // Sonda negativa: um byte trocado no store TEM de reprovar.
    const alvo = relatorio.hidratados[0];
    if (alvo === undefined) {
      falhou("sonda negativa impossivel: nenhum asset hidratado");
    } else {
      const original = await readFile(alvo.caminhoNoStore);
      const adulterado = Buffer.from(original);
      adulterado[0] = (adulterado[0] ?? 0) ^ 0xff;
      const store = new Store({ root: tmpStore });
      await writeFile(alvo.caminhoNoStore, adulterado);
      const integro = await store.verify(alvo.hash);
      await writeFile(alvo.caminhoNoStore, original);
      exigir(!integro, "sonda negativa: um byte trocado no store reprova em store.verify()");
    }
  } finally {
    await rm(tmpStore, { recursive: true, force: true });
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
  const resolvido = await orquestrador.resolverEstagio("musica", manifesto);
  const depois = tentativasDeSaida().length;
  ok("o orquestrador resolveu sem invocar `resolver()` (o espiao teria lancado)");
  exigir(
    depois === antes,
    `zero tentativas de saida durante a reproducao (antes=${antes}, depois=${depois})`,
  );
  exigir(
    resolvido.resolvido.trilha_sonora === resultadoGravado.trilha_sonora,
    "a trilha reproduzida e a mesma do cassete",
  );
  exigir(
    resolvido.resolvido.estagios[0]?.origem === "cassete",
    `o registro declara origem "cassete" (${resolvido.resolvido.estagios[0]?.origem})`,
  );

  // ─── Fase 5: sosia, nao sucessor ──────────────────────────────────────────
  fase("[5/7] o cassete e sosia: `resolver()` sobre os bytes CRUS reproduz o resultado");
  const tmpReplay = await mkdtemp(join(tmpdir(), "musica-replay-"));
  try {
    const estagioReplay = criarEstagioMusica({
      raizStore: join(tmpReplay, "store"),
      pausaEntreDownloadsMs: 0,
    });
    const saida = await estagioReplay.resolver({
      manifesto,
      parametros: estagioReplay.parametros,
      fetch: criarFetchDeCassete(cassete, dirCassete),
      diretorioTrabalho: tmpReplay,
    });
    exigir(
      serializarCanonico(saida.parcial) === serializarCanonico(resultadoGravado),
      "rodar o estagio contra os corpos gravados reproduz `resultado.json` byte a byte",
    );

    // A prova de que a resposta foi gravada SUJA: o corpo cru do
    // catalogo ainda tem HTML e URL nos campos de credito, e o
    // resultado limpo saiu disso. Se o gravador tivesse "consertado",
    // o corpo estaria limpo e o normalizador nunca mais seria testado.
    const corpoCatalogo = await corpoDaChamadaDoCatalogo(dirCassete, cassete.chamadas);
    exigir(
      /<a [^>]*href=/.test(corpoCatalogo),
      "o corpo gravado do catalogo AINDA tem HTML cru (nao foi higienizado na gravacao)",
    );
    exigir(
      /"AttributionRequired":\s*\{\s*"value":\s*"(true|false)"/.test(corpoCatalogo),
      'o corpo gravado ainda traz AttributionRequired como STRING ("true"/"false")',
    );
    const temURLNoCredito = /"Credit":\s*\{[^}]*https?:\\?\/\\?\//.test(corpoCatalogo);
    exigir(temURLNoCredito, "o corpo gravado ainda traz URL dentro do texto de credito");
    ok("logo: a limpeza e do ESTAGIO e roda tambem no replay");
  } finally {
    await rm(tmpReplay, { recursive: true, force: true });
  }

  // ─── Fase 6: determinismo, regravando a partir do cassete ─────────────────
  fase("[6/7] determinismo: duas regravacoes a partir do cassete, relogios diferentes");
  const tmpDet = await mkdtemp(join(tmpdir(), "musica-determinismo-"));
  try {
    const alvos: string[] = [];
    for (const [indice, quando] of [
      "2026-01-01T00:00:00.000Z",
      "2026-12-31T23:59:59.000Z",
    ].entries()) {
      const raiz = join(tmpDet, `gravacao-${indice + 1}`);
      const estagioDet = criarEstagioMusica({
        raizStore: join(tmpDet, `store-${indice + 1}`),
        pausaEntreDownloadsMs: 0,
      });
      const g = await gravarCassete(estagioDet, {
        raiz,
        manifesto,
        diretorioTrabalho: tmpDet,
        // A rede e substituida pelo cassete: o que varia entre as duas
        // passadas passa a ser so o estagio, que e o que se quer medir.
        fetchReal: criarFetchDeCassete(cassete, dirCassete),
        relogio: () => new Date(quando),
      });
      alvos.push(g.diretorio);
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

  // Estrutural, e mais forte que a varredura: a API do fornecedor nao
  // usa credencial, entao nao ha o que redigir. Provamos que nenhuma
  // requisicao gravada levou header de autenticacao nem chave em query.
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
  console.log("=== VERDE: res-musica ===");
  return 0;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** O corpo cru da chamada ao catalogo (a unica que devolve JSON). */
async function corpoDaChamadaDoCatalogo(
  dirCassete: string,
  chamadas: readonly ChamadaGravada[],
): Promise<string> {
  const chamada = chamadas.find((c) => c.url.includes("/w/api.php"));
  if (chamada === undefined) {
    throw new Error("cassete sem a chamada ao catalogo — o formato mudou?");
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
    console.error("res-musica: erro inesperado:", erro);
    process.exit(2);
  },
);
