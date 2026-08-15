/**
 * src/roteiro/juntar/cli.ts
 *
 * O CLI do juntar — a convencao D11 (docs/roteiro/api.md §"CLIs de
 * operacao pesada"): o servidor da Onda 5 chama este executavel via
 * child-process, nunca o juntar em processo.
 *
 * Contrato:
 *   - Entrada: JSON em stdin — `{ "roteiro": Roteiro, "opcoes": {...} }`,
 *     onde `opcoes` (opcional) carrega:
 *       - `previews`: { "<id do pedaco>": "<caminho do mp4 do preview>" }
 *         — O SERVIDOR resolve os caminhos (o layout dos previews e da
 *         Onda 4; aqui entram caminhos, nunca hashes a descobrir);
 *       - `musica_caminho` (opcional): caminho de disco da trilha de
 *         fundo (C7 — nunca URL);
 *       - `timing_pedacos` (opcional): timing de TTS por pedaco
 *         (cues relativos ao pedaco) — a fonte do SRT final; gravacao
 *         NAO deriva legendas (D4), entao o servidor omite timing para
 *         pedacos gravados.
 *   - Saida: JSON em stdout — `{ hash, caminho, duracao_segundos,
 *     duracao_total_segundos, srt_caminho?, loudness }` (a saida JSON e
 *     SO sucesso; `duracao_total_segundos` == `duracao_segundos` — o
 *     video final E o total; o api.md nomeia o campo total, o card
 *     nomeia o por-stream — os dois vao, com o mesmo valor);
 *   - Progresso: arquivo de estado reescrito atomicamente (tmp+rename,
 *     S-8) — caminho por `--estado <path>` ou env `ROTEIRO_ESTADO_PATH`;
 *   - Exit codes: 0 = sucesso; 2 = entrada/uso invalidos (stdin nao e
 *     JSON, roteiro ausente, opcoes malformadas, flag desconhecida);
 *     1 = falha da operacao — inclusive os GATES 409 (o servidor mapeia
 *     o `codigo` do envelope: juntar-fala-sem-narracao,
 *     juntar-anexo-invalido, juntar-roteiro-invalido,
 *     juntar-preview-ausente -> 409; juntar-formatos-divergentes ->
 *     409 (estado conflitante dos previews); juntar-render-falhou ->
 *     500 honesto). Erro SEMPRE no stderr (envelope JSON do api.md).
 */

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { juntar } from "./juntar.js";
import {
  ErroJuntar,
  ErroJuntarFalaSemNarracao,
  ErroJuntarFormatosDivergentes,
  ErroJuntarPreviewAusente,
  ErroJuntarRoteiroInvalido,
} from "./juntar.js";
import type { CueDeTiming, OpcoesDeJuntar } from "./juntar.js";
import type { Roteiro } from "../contrato/contrato.js";

/** Estados possiveis do arquivo de progresso (JobStatus sem id/artefato). */
interface EstadoDeProgresso {
  tipo: "juntar-video";
  estado: "pendente" | "rodando" | "ok" | "erro";
  progresso: number | null;
  mensagem: string;
  erro: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Escreve o arquivo de estado atomicamente (tmp + rename, S-8). */
function escreverEstado(caminho: string | undefined, estado: EstadoDeProgresso): void {
  if (caminho === undefined) {
    return;
  }
  mkdirSync(dirname(caminho), { recursive: true });
  const temporario = `${caminho}.tmp-${process.pid}`;
  writeFileSync(temporario, JSON.stringify(estado), "utf-8");
  renameSync(temporario, caminho);
}

/** Le o stdin inteiro (a entrada JSON do pedido). */
function lerStdin(): Promise<string> {
  return new Promise((resolve, rejeitar) => {
    let dados = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (parte: string) => {
      dados += parte;
    });
    process.stdin.on("end", () => resolve(dados));
    process.stdin.on("error", rejeitar);
  });
}

/** Envelope de erro do api.md, no stderr. */
function reportarErro(codigo: string, mensagem: string, detalhes: string[] = []): void {
  const envelope = { erro: { codigo, mensagem, detalhes } };
  process.stderr.write(`${JSON.stringify(envelope)}\n`);
}

/** Erro de uso do CLI (exit 2). */
class ErroDeUso extends Error {}

/** Parseia os argumentos: --estado <path> | --help. */
function parsearArgumentos(argv: readonly string[]): { caminhoEstado?: string; ajuda: boolean } {
  const opcoes: { caminhoEstado?: string } = {};
  let ajuda = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      ajuda = true;
      continue;
    }
    if (arg === "--estado") {
      const valor = argv[i + 1];
      if (valor === undefined || valor.startsWith("--")) {
        throw new ErroDeUso("--estado exige um caminho de arquivo");
      }
      opcoes.caminhoEstado = valor;
      i++;
      continue;
    }
    throw new ErroDeUso(`argumento desconhecido: ${arg} (use --help)`);
  }
  return { caminhoEstado: opcoes.caminhoEstado, ajuda };
}

const TEXTO_DE_AJUDA = `CLI do juntar e entregar (D11 — docs/roteiro/api.md).

Uso:
  npx tsx src/roteiro/juntar/cli.ts [--estado <path>]

Entrada: JSON em stdin:
  { "roteiro": <Roteiro do contrato>, "opcoes": {
      "previews": { "<id do pedaco>": "<caminho do mp4 do preview>" },
      "musica_caminho": "<caminho de disco da trilha>" (opcional),
      "timing_pedacos": { "<id>": [ { "texto", "inicio_segundos", "fim_segundos" } ] } (opcional)
    } }
  O servidor resolve os caminhos dos previews e o timing de TTS; gravacao
  nao deriva legendas (D4) — sem timing, sem SRT.

Saida: JSON em stdout (so sucesso):
  { "hash", "caminho", "duracao_segundos", "duracao_total_segundos", "srt_caminho"?, "loudness" }

Progresso: arquivo reescrito a cada avanco, atomico (S-8):
  --estado <path>   ou   ROTEIRO_ESTADO_PATH

Exit codes: 0 = sucesso; 2 = entrada/uso invalidos; 1 = falha da
operacao (gates 409 — fala sem narracao, anexo invalido, roteiro
invalido, preview ausente, formatos divergentes — e falha de render).
Erro sempre no stderr (envelope JSON: { "erro": { "codigo", "mensagem" } }).
`;

// ─── Validacao da entrada (o contrato do stdin) ───────────────────────────────

/** Erro de entrada do CLI — o servidor nunca deveria mandar isto. */
function entradaInvalida(mensagem: string): never {
  throw new ErroDeEntrada(mensagem);
}

class ErroDeEntrada extends Error {}

/** Valida um cue de timing (a forma minima — o tempo e do TTS). */
function validarCue(valor: unknown): CueDeTiming {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    entradaInvalida("timing_pedacos: cue nao e um objeto");
  }
  const cue = valor as Record<string, unknown>;
  if (typeof cue.texto !== "string" || cue.texto.trim() === "") {
    entradaInvalida("timing_pedacos: cue sem texto nao-vazio");
  }
  const inicio = Number(cue.inicio_segundos);
  const fim = Number(cue.fim_segundos);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim < inicio) {
    entradaInvalida(
      `timing_pedacos: cue com tempo invalido (${String(cue.inicio_segundos)}..` +
        `${String(cue.fim_segundos)})`,
    );
  }
  return { texto: cue.texto, inicio_segundos: inicio, fim_segundos: fim };
}

/** Valida `opcoes` (parcial — o resto e default) e devolve as OpcoesDeJuntar. */
function validarOpcoes(valor: unknown): OpcoesDeJuntar {
  if (valor === undefined) {
    return { previews: {} };
  }
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    entradaInvalida("opcoes precisa ser um objeto");
  }
  const opcoes = valor as Record<string, unknown>;

  let previews: Record<string, string> = {};
  if (opcoes.previews !== undefined) {
    if (opcoes.previews === null || typeof opcoes.previews !== "object" || Array.isArray(opcoes.previews)) {
      entradaInvalida("opcoes.previews precisa ser um objeto { id do pedaco: caminho }");
    }
    for (const [id, caminho] of Object.entries(opcoes.previews as Record<string, unknown>)) {
      if (typeof caminho !== "string" || caminho === "") {
        entradaInvalida(`opcoes.previews["${id}"] precisa ser um caminho nao-vazio`);
      }
      previews[id] = caminho;
    }
  }

  let musicaCaminho: string | undefined;
  if (opcoes.musica_caminho !== undefined) {
    if (typeof opcoes.musica_caminho !== "string" || opcoes.musica_caminho === "") {
      entradaInvalida("opcoes.musica_caminho precisa ser um caminho nao-vazio");
    }
    musicaCaminho = opcoes.musica_caminho;
  }

  let timingPedacos: Record<string, readonly CueDeTiming[]> = {};
  if (opcoes.timing_pedacos !== undefined) {
    if (opcoes.timing_pedacos === null || typeof opcoes.timing_pedacos !== "object" || Array.isArray(opcoes.timing_pedacos)) {
      entradaInvalida("opcoes.timing_pedacos precisa ser um objeto { id: [cues] }");
    }
    for (const [id, cues] of Object.entries(opcoes.timing_pedacos as Record<string, unknown>)) {
      if (!Array.isArray(cues)) {
        entradaInvalida(`opcoes.timing_pedacos["${id}"] precisa ser um array de cues`);
      }
      timingPedacos[id] = cues.map(validarCue);
    }
  }

  return { previews, musica_caminho: musicaCaminho, timing_pedacos: timingPedacos };
}

/** Mapeia um ErroJuntar para o codigo estavel do envelope (exit 1). */
function codigoDoErro(erro: ErroJuntar): string {
  return erro.codigo;
}

/**
 * O ponto de entrada do CLI. Nunca lanca: toda falha vira envelope no
 * stderr + exit code (0 | 1 | 2) — o servidor le os dois.
 */
export async function principal(): Promise<number> {
  let caminhoEstado: string | undefined;
  let ajuda: boolean;
  try {
    ({ caminhoEstado, ajuda } = parsearArgumentos(process.argv.slice(2)));
  } catch (erro) {
    if (erro instanceof ErroDeUso) {
      reportarErro("uso-invalido", erro.message);
      return 2;
    }
    throw erro;
  }
  if (ajuda) {
    process.stdout.write(TEXTO_DE_AJUDA);
    return 0;
  }
  caminhoEstado = caminhoEstado ?? process.env.ROTEIRO_ESTADO_PATH;
  const agora = new Date().toISOString();

  let entradaBruta: string;
  try {
    entradaBruta = await lerStdin();
  } catch (erro) {
    reportarErro("entrada-invalida", `falha ao ler stdin: ${(erro as Error).message}`);
    return 2;
  }

  /** Estado terminal de ERRO para entradas rejeitadas na porta (o poll
   *  do servidor precisa ver o terminal, nunca o arquivo ausente). */
  const estadoDeErro = (mensagem: string): void => {
    escreverEstado(caminhoEstado, {
      tipo: "juntar-video",
      estado: "erro",
      progresso: 1,
      mensagem: "Entrada invalida.",
      erro: mensagem,
      criado_em: agora,
      atualizado_em: new Date().toISOString(),
    });
  };

  let pedido: Record<string, unknown>;
  try {
    pedido = JSON.parse(entradaBruta) as Record<string, unknown>;
  } catch (erro) {
    estadoDeErro(`stdin nao e JSON valido: ${(erro as Error).message}`);
    reportarErro("entrada-invalida", `stdin nao e JSON valido: ${(erro as Error).message}`);
    return 2;
  }
  if (pedido === null || typeof pedido !== "object" || Array.isArray(pedido)) {
    estadoDeErro("stdin precisa ser um objeto JSON (o pedido)");
    reportarErro("entrada-invalida", "stdin precisa ser um objeto JSON (o pedido)");
    return 2;
  }

  // O roteiro e obrigatorio na entrada; o VALOR e validado pelo contrato
  // dentro do juntar (validarRoteiro — revalidacao com regras anexo-*).
  if (pedido.roteiro === undefined || pedido.roteiro === null || typeof pedido.roteiro !== "object") {
    estadoDeErro("pedido sem roteiro (o juntar so roda com roteiro gerado)");
    reportarErro(
      "entrada-invalida",
      "pedido sem roteiro — o juntar so roda com roteiro gerado",
    );
    return 2;
  }

  let opcoes: OpcoesDeJuntar;
  try {
    opcoes = validarOpcoes(pedido.opcoes);
  } catch (erro) {
    const mensagem = (erro as Error).message;
    estadoDeErro(mensagem);
    reportarErro("entrada-invalida", mensagem);
    return 2;
  }

  const estado: EstadoDeProgresso = {
    tipo: "juntar-video",
    estado: "rodando",
    progresso: 0.05,
    mensagem: "Verificando juntavel (narracao, anexos, previews)...",
    erro: null,
    criado_em: agora,
    atualizado_em: agora,
  };
  escreverEstado(caminhoEstado, estado);

  try {
    estado.progresso = 0.2;
    estado.mensagem = "Conferindo formatos dos previews (ffprobe)...";
    estado.atualizado_em = new Date().toISOString();
    escreverEstado(caminhoEstado, estado);

    const resultado = await juntar(pedido.roteiro as Roteiro, opcoes);

    estado.progresso = 0.95;
    estado.mensagem = "Conferindo a entrega...";
    estado.atualizado_em = new Date().toISOString();
    escreverEstado(caminhoEstado, estado);

    process.stdout.write(
      `${JSON.stringify({
        hash: resultado.hash,
        caminho: resultado.caminho,
        duracao_segundos: resultado.duracaoSegundos,
        duracao_total_segundos: resultado.duracaoSegundos,
        srt_caminho: resultado.srtCaminho ?? null,
        loudness: {
          alvo_lufs: resultado.medicoes.alvoLufs,
          entregavel_integrado_lufs: resultado.medicoes.entregavelIntegradoLufs,
          entregavel_true_peak_dbtp: resultado.medicoes.entregavelTruePeakDbtp,
          ganho_aplicado_db: resultado.medicoes.ganhoAplicadoDb,
          musica_aplicada: resultado.medicoes.musicaAplicada,
        },
      })}\n`,
    );

    estado.estado = "ok";
    estado.progresso = 1;
    estado.mensagem = "Video juntado e entregue.";
    estado.atualizado_em = new Date().toISOString();
    escreverEstado(caminhoEstado, estado);
    return 0;
  } catch (erro) {
    // A familia ErroJuntar carrega o codigo estavel (409s + render); o
    // que cai aqui fora dela e falha interna — codigo honesto, nunca
    // "ok" mentiroso (FQ-S1). Os 409s do juntar sao ERRO (exit 1): o
    // servidor mapeia o codigo do envelope para o HTTP.
    const codigo = erro instanceof ErroJuntar
      ? codigoDoErro(erro)
      : "juntar-render-falhou";
    // Os detalhes estruturais do 409 (o servidor pode listar os pedacos
    // sem parsear a mensagem): problemas do validador para anexo/roteiro,
    // divergencias para formatos, ids para fala/preview ausentes.
    const detalhes: string[] =
      erro instanceof ErroJuntarRoteiroInvalido
        ? [...erro.problemas]
        : erro instanceof ErroJuntarFormatosDivergentes
          ? [...erro.divergencias]
          : erro instanceof ErroJuntarFalaSemNarracao ||
              erro instanceof ErroJuntarPreviewAusente
            ? erro.pedacos.map((p) => `pedacos[${String(p.indice)}].id ${p.id}`)
            : [];
    const mensagem = (erro as Error).message;
    estado.estado = "erro";
    estado.progresso = 1;
    estado.erro = mensagem;
    estado.atualizado_em = new Date().toISOString();
    escreverEstado(caminhoEstado, estado);
    reportarErro(codigo, mensagem, detalhes as string[]);
    return 1;
  }
}

// Execucao direta (npx tsx src/roteiro/juntar/cli.ts): o servidor da
// Onda 5 le o exit code. A guarda protege a importacao por testes
// (os testes chamam principal() direto com stdin/escreverEstado stub).
if (process.argv[1]?.endsWith("cli.ts")) {
  principal()
    .then((codigo) => {
      process.exitCode = codigo;
    })
    .catch((erro) => {
      reportarErro("erro-interno", (erro as Error).message);
      process.exitCode = 1;
    });
}
