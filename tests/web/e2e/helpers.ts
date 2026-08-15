/**
 * tests/web/e2e/helpers.ts
 *
 * Ajudantes compartilhados dos specs de E2E web (Onda 7): derivacao de
 * ids de pedaco a partir dos CARDS (armadilha 1 — o numero de pedacos e
 * 2..5 no sosia, nunca assuma 5; re-derivar apos cada mutacao —
 * armadilha 3), espera por estado de JobBar, narracao via API (o
 * Playwright NAO grava microfone — REPLAN Onda 4, item 7), o tripwire
 * de rede do navegador (o guarda do Node NAO alcanca o processo do
 * browser — P4 do REPLAN) e os oraculos de midia (C1/C4: ffprobe por
 * stream + conteudo nao-chapado, nunca so o status HTTP). Os specs
 * rodam SOMENTE no runner do Playwright (*.spec.ts): o vitest inclui
 * so os *.test.ts sob tests/ (vitest.config.ts — N-1 do REPLAN).
 *
 * Os data-testid usados sao o CONTRATO de marcacao da Onda 6 (handoff
 * da SPA): pedaco-<id>, fala-<id>, barra-<alvo>, job-ok/job-erro/job-
 * andamento (classes da JobBar), botao-gravar-<id>, audio-narracao-<id>,
 * video-preview-<id>, botao-atualizar, botao-baixar-video.
 */

import { expect, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

/** A raiz deste arquivo (tests/web/e2e/) — resolve as fixtures por URL. */
const AQUI = fileURLToPath(new URL(".", import.meta.url));

/** A fixture de narracao NADA silenciosa (senoide/vozeado — max -17,8 dB). */
export const CAMINHO_GRAVACAO = fileURLToPath(new URL("../../roteiro/fixtures/gravacao.webm", import.meta.url));

/** A fixture de midia do "anexo feliz" (h264 320x240 1s + aac — decodifica). */
export const CAMINHO_ANEXO_MP4 = fileURLToPath(new URL("../../roteiro/fixtures/anexo.mp4", import.meta.url));

/**
 * A fixture GIF do anexo feliz (320x240). PREFERIDA ao mp4 no e2e: o
 * caminho midia-video (mp4 anexado) NAO renderiza no preview com o
 * chrome-headless-shell 149 (ACHADO MEDIDO da Onda 7 — o worker morre
 * com delayRender de fonte nunca limpa; o caminho midia-gif usa o
 * <Gif> deterministico e renderiza).
 */
export const CAMINHO_ANEXO_GIF = fileURLToPath(new URL("../../roteiro/fixtures/anexo.gif", import.meta.url));

/**
 * Deriva os ids de pedaco dos CARDS exibidos (lista-pedacos), nunca de
 * resposta de API: o que a UI mostra e o contrato do teste. Forma
 * fechada p-\d{3} (PADRAO_ID_PEDACO do contrato).
 */
export async function idsDePedacos(page: Page): Promise<string[]> {
  const testeIds = await page.locator('[data-testid^="pedaco-"]').evaluateAll((nos) =>
    nos.map((no) => no.getAttribute("data-testid") ?? ""),
  );
  const ids: string[] = [];
  for (const testeId of testeIds) {
    const casado = /^pedaco-(p-\d{3})$/.exec(testeId);
    if (casado !== null) {
      ids.push(casado[1]!);
    }
  }
  return ids;
}

/**
 * Deriva os ids dos pedacos COM FALA do que a UI renderizou: o card so
 * desenha `fala-<id>` quando fala != "" (FQ-U3 e armadilha 3 — p-000
 * nasce sem fala e GANHA fala na regeneracao; re-derivar SEMPRE apos
 * gerar/regenerar/editar).
 */
export async function pedacosComFala(page: Page): Promise<string[]> {
  const testeIds = await page.locator('[data-testid^="fala-"]').evaluateAll((nos) =>
    nos.map((no) => no.getAttribute("data-testid") ?? ""),
  );
  const ids: string[] = [];
  for (const testeId of testeIds) {
    const casado = /^fala-(p-\d{3})$/.exec(testeId);
    if (casado !== null) {
      ids.push(casado[1]!);
    }
  }
  return ids;
}

/**
 * Espera a JobBar de um alvo chegar ao estado ok (`job-ok`). O "ok" da
 * UI so existe derivado com artefato (derivarJob confere ok-sem-artefato
 * — FQ-U2/C1); o teste espera a classe, nunca o texto solto.
 *
 * timeoutMs explicito: o PRIMEIRO preview de um run inclui o download do
 * Chrome do Remotion + bundle + render — o default do expect (30s) nao
 * cobre; o poll da UI tem teto de 5 min (pollarJob) e o teste acompanha.
 */
export async function aguardarJobOk(page: Page, testeIdDaBarra: string, timeoutMs = 300_000): Promise<void> {
  await expect(page.getByTestId(testeIdDaBarra)).toHaveClass(/job-ok/, { timeout: timeoutMs });
}

/**
 * Espera a JobBar de um alvo chegar ao estado erro (`job-erro` com
 * role=alert) e devolve a MENSAGEM REAL exibida (a saida/erro do
 * servidor, nunca generica — FQ-U4/FQ-S3). O teste asserta a mensagem,
 * nao so a classe.
 */
export async function aguardarJobErro(page: Page, testeIdDaBarra: string, timeoutMs = 300_000): Promise<string> {
  const barra = page.getByTestId(testeIdDaBarra);
  await expect(barra).toHaveClass(/job-erro/, { timeout: timeoutMs });
  await expect(barra.locator(".job-erro-mensagem")).toBeVisible();
  return (await barra.locator(".job-erro-mensagem").innerText()).trim();
}

/**
 * Cria um projeto pela UI (tela novo-projeto) e gera o roteiro, e
 * devolve o id do projeto (extraido da URL #/projeto/<id>). O brief usa
 * tema+contexto fixos e duracao alvo 90s (o seletor oferece 30..300).
 */
export async function criarProjetoEroteiro(page: Page): Promise<string> {
  await page.goto("/");
  await expect(page.getByTestId("tela-novo-projeto")).toBeVisible();
  await page.getByTestId("campo-tema").fill("Como funciona um cache de processador");
  await page.getByTestId("campo-contexto").fill("para iniciantes, sem matematica pesada");
  await page.getByTestId("campo-duracao").selectOption("90");
  await page.getByTestId("botao-criar").click();
  await expect(page).toHaveURL(/#\/projeto\/proj-[0-9a-f]{8}$/);
  await expect(page.getByTestId("tela-projeto")).toBeVisible();
  const id = extrairProjetoIdDaUrl(page.url());
  if (id === null) {
    throw new Error(`URL sem id de projeto valido: ${page.url()}`);
  }
  await page.getByTestId("botao-gerar-roteiro").click();
  await aguardarJobOk(page, "barra-gerar-roteiro");
  await expect(page.getByTestId("lista-pedacos")).toBeVisible();
  return id;
}

/** Extrai o id do projeto da URL (#/projeto/<id>). */
export function extrairProjetoIdDaUrl(url: string): string | null {
  const casado = /#\/projeto\/(proj-[0-9a-f]{8})$/.exec(url);
  return casado === null ? null : casado[1]!;
}

/**
 * A duracao total ESPERADA do video final: roteiro.duracao_total_segundos
 * do GET projeto (a fonte de verdade do servidor — o teste nunca
 * hardcoda o numero de pedacos nem a duracao; armadilha 1).
 */
export async function duracaoTotalDoRoteiro(page: Page, baseURL: string, projetoId: string): Promise<number> {
  const resposta = await page.request.get(`${baseURL}/api/projetos/${projetoId}`);
  expect(resposta.status()).toBe(200);
  const corpo = (await resposta.json()) as { projeto?: { roteiro?: { duracao_total_segundos?: unknown } } };
  const duracao = corpo.projeto?.roteiro?.duracao_total_segundos;
  if (typeof duracao !== "number" || !Number.isFinite(duracao)) {
    throw new Error(`GET projeto sem duracao_total_segundos no roteiro: ${JSON.stringify(corpo).slice(0, 200)}`);
  }
  return duracao;
}

/**
 * Narracao VIA API (page.request — o Playwright nao grava microfone;
 * a fixture gravacao.webm e NADA silenciosa, max -17,8 dB). PUT body cru
 * com Content-Type audio/webm (api.md) e 201 esperado. Depois do PUT a
 * UI precisa de um refetch (botao-atualizar) para ver a narracao.
 */
export async function narrarPedacoViaApi(page: Page, baseURL: string, projetoId: string, pedacoId: string): Promise<void> {
  const bytes = readFileSync(CAMINHO_GRAVACAO);
  const resposta = await page.request.put(
    `${baseURL}/api/projetos/${projetoId}/pedacos/${pedacoId}/narracao/audio`,
    {
      data: bytes,
      headers: { "Content-Type": "audio/webm" },
    },
  );
  expect(resposta.status(), `PUT narracao de ${pedacoId} deveria ser 201`).toBe(201);
}

/**
 * Sonda de launch por CONTEUDO (N-2): GET / tem de servir o index.html
 * DA SPA com id="raiz" — status 200 sozinho nao prova o build (o
 * servidor 503a quando dist/web falta, mas um 200 de outra coisa
 * tambem existe). FQ-E2: com o servidor morto este teste (e o run
 * inteiro, via webServer) FALHA.
 */
export async function sondarSpaNoAr(page: Page): Promise<void> {
  const resposta = await page.request.get("/");
  expect(resposta.status()).toBe(200);
  const corpo = await resposta.text();
  expect(corpo, "o index servido tem de ser o da SPA buildada (id raiz)").toContain('id="raiz"');
}

/**
 * Tripwire de REDE do navegador (REPLAN P4): observa TODA requisicao do
 * browser; host fora de localhost/127.0.0.1 e VIOLACAO (SPA sem CDN, sem
 * fontes remotas — C6 enforced no processo que importa; o guarda do
 * Node nao alcanca o processo do browser). O teste asserta a lista vazia
 * no final. Blobs/data/about nao sao rede e passam.
 *
 * POR QUE response/requestfailed e NAO page.route nem page.on("request"):
 * MEDIDO na Onda 7 — page.route com o glob universal (dominio Fetch) e
 * page.on("request") com req.url() QUEBRAM o render do Remotion do
 * preview: o worker do render morre e o job erro com delayRender de
 * fonte nunca limpa (28s). A observacao por response + requestfailed
 * nao intercepta nada e nao quebra o render (verificado: fluxo completo
 * com preview real passando). Uma requisicao externa sempre termina em
 * response OU requestfailed — nenhum host escapa dos dois eventos.
 */
export function armarTripwireDeRede(page: Page, violacoes: string[]): void {
  page.on("response", (resposta) => {
    registrarSeForaDeLocalhost(resposta.url(), violacoes);
  });
  page.on("requestfailed", (requisicao) => {
    registrarSeForaDeLocalhost(requisicao.url(), violacoes);
  });
}

/** Registra a URL como violacao se o host for externo (ou ignora sem parse). */
function registrarSeForaDeLocalhost(url: string, violacoes: string[]): void {
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") {
      if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
        violacoes.push(url);
      }
    }
  } catch {
    // URL nao parseavel (ex.: about:blank) — nao e rede, ignora.
  }
}

/** Resultado do oraculo estrutural (ffprobe por stream — C4). */
export interface EstruturaDeMidia {
  readonly codigoVideo: string;
  readonly largura: number;
  readonly altura: number;
  readonly duracaoVideoSegundos: number;
  readonly codigoAudio: string;
  readonly duracaoAudioSegundos: number;
}

/**
 * Oraculo estrutural (camada 0 de video-characterization): ffprobe POR
 * STREAM (C4 — duracao do container mente; o parse tem de ser nao-vazio:
 * chave errada devolve saida vazia com exit 0 — falsifiable-gates).
 */
export async function oraculoEstrutural(caminho: string): Promise<EstruturaDeMidia> {
  const video = JSON.parse(
    (await execFileAsync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,duration", "-of", "json", caminho])).stdout,
  ) as { streams?: Array<{ codec_name?: string; width?: number; height?: number; duration?: string }> };
  const audio = JSON.parse(
    (await execFileAsync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name,duration", "-of", "json", caminho])).stdout,
  ) as { streams?: Array<{ codec_name?: string; duration?: string }> };

  const streamVideo = video.streams?.[0];
  const streamAudio = audio.streams?.[0];
  // Parse nao-vazio e FALHA (falsifiable-gates): sem trilha de video o
  // objeto nao tem o que reportar — "sem trilha" e vermelho, nunca verde.
  if (streamVideo === undefined || typeof streamVideo.codec_name !== "string") {
    throw new Error("oraculo: o arquivo nao tem trilha de video legivel (parse vazio)");
  }
  if (streamAudio === undefined || typeof streamAudio.codec_name !== "string") {
    throw new Error("oraculo: o arquivo nao tem trilha de audio legivel (parse vazio)");
  }
  return {
    codigoVideo: streamVideo.codec_name,
    largura: streamVideo.width ?? -1,
    altura: streamVideo.height ?? -1,
    duracaoVideoSegundos: Number(streamVideo.duration ?? "NaN"),
    codigoAudio: streamAudio.codec_name,
    duracaoAudioSegundos: Number(streamAudio.duration ?? "NaN"),
  };
}

/**
 * Oraculo de CONTEUDO (C1): o audio nao pode ser silencioso e o quadro
 * nao pode ser chapado/preto — exit 0 de um render nao prova imagem, e
 * um video preto passa em TODA a camada estrutural. Documentado aqui:
 *  - audio: volumedetect — max_volume tem de estar ACIMA de -50 dB (a
 *    narracao da fixture chega a -17,8 dB e o juntar normaliza para EBU
 *    R128; silencio real fica em -inf);
 *  - video: signalstats no frame em 40% da duracao — YMAX-YMIN
 *    (espalhamento de luma) >= 20: um frame preto (16/16) ou branco
 *    (235/235) tem espalhamento 0; o slide de texto tem texto sobre
 *    fundo. NUNCA o frame 0 (fade-in pode comecar preto).
 */
export async function oraculoDeConteudo(caminho: string, duracaoVideoSegundos: number): Promise<void> {
  const volume = await execFileAsync("ffmpeg", ["-hide_banner", "-nostats", "-i", caminho, "-af", "volumedetect", "-f", "null", "-"]);
  const linhasDoVolume = volume.stderr;
  const max = /max_volume: (-?[\d.]+) dB/.exec(linhasDoVolume)?.[1];
  if (max === undefined) {
    throw new Error(`oraculo de conteudo: volumedetect nao reportou max_volume — ${linhasDoVolume.slice(-400)}`);
  }
  const maxDb = Number(max);
  if (!Number.isFinite(maxDb) || maxDb <= -50) {
    throw new Error(`oraculo de conteudo: audio silencioso demais (max_volume ${max} dB) — C1`);
  }

  // Frame em 40% da duracao (nunca o frame 0 — fade-in de cena).
  const salto = Math.max(0.5, duracaoVideoSegundos * 0.4);
  const quadro = await execFileAsync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-ss", String(salto), "-i", caminho, "-vf", "signalstats,metadata=print:file=-", "-frames:v", "1", "-f", "null", "-"],
  );
  const linhasDoQuadro = quadro.stdout;
  const ymin = /lavfi\.signalstats\.YMIN=(\d+)/.exec(linhasDoQuadro)?.[1];
  const ymax = /lavfi\.signalstats\.YMAX=(\d+)/.exec(linhasDoQuadro)?.[1];
  if (ymin === undefined || ymax === undefined) {
    throw new Error(`oraculo de conteudo: signalstats nao reportou YMIN/YMAX — ${linhasDoQuadro.slice(-400)}`);
  }
  const espalhamento = Number(ymax) - Number(ymin);
  if (espalhamento < 20) {
    throw new Error(
      `oraculo de conteudo: frame chapado/preto (YMIN ${ymin}, YMAX ${ymax}, espalhamento ${espalhamento}) — C1`,
    );
  }
}
