// =============================================================================
// render-evidencias.ts — producao EXTERNA da evidencia F1-03 (familia resolvida)
// =============================================================================
// POR QUE EXISTE — o teste tests/design/font-resolve.test.ts rodava bundle() +
// renderStill() DENTRO do processo vitest, onde o guarda de rede da resolucao
// (tests/setup/rede-bloqueada.ts, carregado por vitest.config.ts) bloqueia o
// WebSocket de loopback que o renderStill abre para o Chrome local
// (http://127.0.0.1:PORT/devtools/browser/...) com ERedeBloqueada. O beforeAll
// morria e a suite inteira F1-03 falhava.
//
// A correcao prescrita: produzir a evidencia em PROCESSO EXTERNO — como fazem
// os provar.sh dos nos, que rodam `npx remotion still` fora do vitest. Este
// script faz o MESMO bundle + renderStill que o teste fazia, e grava em
// output/fontes/:
//   fontes-locais.png           — o still do render
//   familias-resolvidas.json    — a evidencia (artefato emitido pelo render)
//   sonda-negativa-erro.json    — relatorio da sonda negativa (arquivo ausente)
//
// O teste so LER os arquivos produzidos. Nenhuma assercao de pixel, nenhuma
// comparacao: o que se le e o NOME da familia, o peso, o estilo e o estado da
// FontFace, colhidos DENTRO do navegador do render.
//
// SOBRE O GUARDA DE REDE — este subprocesso NAO passa pelo guarda em processo
// do vitest, e isso e correto: o guarda existe para os estagios de resolucao
// (F2-01) e este render de fontes e instrumentacao local. A prova de rede
// bloqueada de verdade continua sendo o guarda EXTERNO `unshare --net` de
// tools/resolucao/offline.sh, que vale para o processo e todos os filhos. O
// guarda em processo NAO foi enfraquecido (permitirLoopback continua false).
//
// Uso: npx tsx tools/fontes/render-evidencias.ts
// Exit 0 somente quando as tres saidas foram produzidas como esperado
// (still + evidencia + sonda que MORREU). Qualquer outra coisa: exit 1.
// =============================================================================

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import type { EmittedArtifact } from "@remotion/renderer";
import { ARQUIVO_DE_EVIDENCIA } from "../../src/design/fontes/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(__dirname, "..", "..");
const pontoDeEntrada = resolve(raiz, "fixtures", "fontes", "index.tsx");
const dirSaida = resolve(raiz, "output", "fontes");

const COMPOSICAO_BOA = "fontes-locais";
const COMPOSICAO_QUEBRADA = "fontes-arquivo-ausente";
const NOME_DO_STILL = "fontes-locais.png";
const ARQUIVO_RELATORIO_DA_SONDA = "sonda-negativa-erro.json";

function falhar(mensagem: string): never {
  process.stderr.write(`render-evidencias: ${mensagem}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  // Bundle da fixture de fontes
  // -------------------------------------------------------------------------
  const serveUrl = await bundle({
    entryPoint: pontoDeEntrada,
    onProgress: () => undefined,
    ignoreRegisterRootWarning: true,
  });

  const composicoes = await getCompositions(serveUrl);

  // -------------------------------------------------------------------------
  // Render da composicao boa + coleta do artefato de evidencia
  // -------------------------------------------------------------------------
  const alvo = composicoes.find((c) => c.id === COMPOSICAO_BOA);
  if (alvo === undefined) {
    falhar(`Composicao ${COMPOSICAO_BOA} nao registrada no bundle`);
  }

  mkdirSync(dirSaida, { recursive: true });

  const artefatos: EmittedArtifact[] = [];
  await renderStill({
    composition: alvo,
    serveUrl,
    frame: 0,
    imageFormat: "png",
    output: resolve(dirSaida, NOME_DO_STILL),
    overwrite: true,
    chromiumOptions: { gl: "swangle" },
    onArtifact: (a) => artefatos.push(a),
  });

  const caminhoDoStill = resolve(dirSaida, NOME_DO_STILL);
  if (!existsSync(caminhoDoStill)) {
    falhar(`O still nao foi gravado: ${caminhoDoStill}`);
  }

  const bruto = artefatos.find((a) => a.filename === ARQUIVO_DE_EVIDENCIA);
  if (bruto === undefined) {
    falhar(
      `O still saiu mas o render nao emitiu ${ARQUIVO_DE_EVIDENCIA}. ` +
        `Artefatos vistos: ${JSON.stringify(artefatos.map((a) => a.filename))}`,
    );
  }
  const texto =
    typeof bruto.content === "string"
      ? bruto.content
      : Buffer.from(bruto.content).toString("utf-8");
  writeFileSync(resolve(dirSaida, ARQUIVO_DE_EVIDENCIA), texto);

  // -------------------------------------------------------------------------
  // Sonda negativa: arquivo de fonte ausente TEM de derrubar o render (C6)
  // -------------------------------------------------------------------------
  // loadFont() chama cancelRender() quando o arquivo nao carrega; se o render
  // sobreviver, e sinal de que uma fonte faltando caiu em fallback silencioso
  // e todo o resto desta suite e teatro. O relatorio grava o erro em formato
  // que o teste consegue assertar; o exit code nao-zero e a segunda linha de
  // defesa quando a sonda NAO morre.
  const quebrada = composicoes.find((c) => c.id === COMPOSICAO_QUEBRADA);
  if (quebrada === undefined) {
    falhar(`Composicao ${COMPOSICAO_QUEBRADA} nao registrada no bundle`);
  }

  let morreu = false;
  let erro: unknown = null;
  try {
    await renderStill({
      composition: quebrada,
      serveUrl,
      frame: 0,
      imageFormat: "png",
      output: null,
      overwrite: true,
      chromiumOptions: { gl: "swangle" },
      timeoutInMilliseconds: 20_000,
    });
  } catch (e) {
    morreu = true;
    erro = e;
  }

  writeFileSync(
    resolve(dirSaida, ARQUIVO_RELATORIO_DA_SONDA),
    JSON.stringify(
      {
        composicao: COMPOSICAO_QUEBRADA,
        morreu,
        erro: morreu ? String(erro) : null,
      },
      null,
      2,
    ),
  );

  if (!morreu) {
    falhar(
      `SONDA NEGATIVA FALHOU: o render de ${COMPOSICAO_QUEBRADA} sobreviveu ` +
        `a uma fonte ausente (C6). Relatorio gravado em ` +
        `${resolve(dirSaida, ARQUIVO_RELATORIO_DA_SONDA)}.`,
    );
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`render-evidencias: erro inesperado: ${String(e)}\n`);
  process.exit(1);
});
