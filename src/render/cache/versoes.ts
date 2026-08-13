// =============================================================================
// VERSOES DA PILHA — a identidade do renderizador (cache F5-09, ADR-0041)
// =============================================================================
//
// A componente 4 da chave C7 e `H(versao do codigo / compositor /
// navegador)` e a 5 e o `pin das ferramentas` (node, ffmpeg) — o mesmo
// padrao de `MixDocument.ferramentas` do F3-05: determinismo entre
// versoes e DECLARADO por pin, nunca assumido.
//
//   - compositor: o codigo que rasteriza e a pilha Remotion
//     (remotion + @remotion/renderer + @remotion/bundler + o binario
//     compositor-linux-x64-gnu). Bump de Remotion = novo rasterizador =
//     bytes diferentes — a chave tem de acender o miss sozinha
//     (pergunta adversarial 1 do card).
//   - navegador: o chrome-headless-shell que o Remotion baixa e pina em
//     `node_modules/.remotion/chrome-headless-shell/VERSION` (o
//     TESTED_VERSION da versao instalada). A versao e LIDA do binario
//     instalado — o navegador que de fato renderiza, nunca um numero
//     digitado a mao.
//   - ferramentas: node (process.versions.node) e ffmpeg (primeira linha
//     de `ffmpeg -version`) — o pin que a entrega tambem registra.
//
// Leitura em runtime: este modulo vive ACIMA da fronteira de
// determinismo (o cache e I/O por natureza). O que ele NAO faz: ler
// data/hora, memTotal, numero de workers, plano de faixas, porta ou env
// de agendamento — nada disso e conteudo (ADR-0041, decisao 2).
//
// Toda leitura e injetavel — os testes passam versoes fixas e o gate
// assere a sensibilidade da chave a cada componente sem depender da
// maquina.
// =============================================================================

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** A versao da pilha que renderiza — a identidade do rasterizador. */
export interface VersoesDaPilha {
  /** Versao do pacote `remotion` (package.json do projeto). */
  readonly remotion: string;
  /** Versao de `@remotion/renderer` (o codigo que renderiza). */
  readonly renderer: string;
  /** Versao de `@remotion/bundler` (o codigo que empacota). */
  readonly bundler: string;
  /** Versao do binario compositor (o rasterizador nativo), ou "nao-declarado". */
  readonly compositor: string;
  /** Versao do chrome-headless-shell INSTALADO (o navegador do render). */
  readonly navegador: string;
}

/** O pin de ferramentas — o mesmo padrao de MixDocument.ferramentas (F3-05). */
export interface PinDeFerramentas {
  readonly node: string;
  readonly ffmpeg: string;
}

/** Leitor da versao do ffmpeg (injetavel no teste). */
export type LerVersaoDoFfmpeg = () => string;

/** Opcoes da leitura — tudo opcional; os defaults sao a maquina real. */
export interface OpcoesDasVersoes {
  /** Raiz do projeto (onde esta package.json e node_modules). */
  readonly raizDoProjeto?: string;
  /** Leitor do ffmpeg (default: `ffmpeg -version`). */
  readonly lerFfmpeg?: LerVersaoDoFfmpeg;
}

/**
 * A versao de um pacote instalado em `node_modules/<nome>/package.json`.
 * `"nao-declarado"` quando ausente — ausencia e VERMELHO no sentido
 * seguro: a chave muda (miss), nunca acerta por acaso.
 */
function versaoDoPacote(raiz: string, nome: string): string {
  try {
    const caminho = join(raiz, "node_modules", nome, "package.json");
    const documento = JSON.parse(readFileSync(caminho, "utf8")) as {
      version?: unknown;
    };
    return typeof documento.version === "string" && documento.version !== ""
      ? documento.version
      : "nao-declarado";
  } catch {
    return "nao-declarado";
  }
}

/**
 * A versao do chrome-headless-shell instalado — o VERSION file que o
 * próprio BrowserFetcher do Remotion escreve em
 * `node_modules/.remotion/chrome-headless-shell/VERSION` (o numero
 * TESTED_VERSION da versão instalada). Ler do binario instalado: se o
 * navegador mudar, a chave muda; se sumir, "nao-declarado" (miss).
 */
function versaoDoNavegador(raiz: string): string {
  try {
    const caminho = join(
      raiz,
      "node_modules",
      ".remotion",
      "chrome-headless-shell",
      "VERSION",
    );
    if (!existsSync(caminho)) {
      return "nao-declarado";
    }
    const versao = readFileSync(caminho, "utf8").trim();
    return versao === "" ? "nao-declarado" : versao;
  } catch {
    return "nao-declarado";
  }
}

/** A versao do ffmpeg instalado: primeira linha de `ffmpeg -version`. */
export function lerVersaoDoFfmpeg(): string {
  try {
    const saida = execFileSync("ffmpeg", ["-version"], {
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const primeira = saida.split("\n")[0] ?? "";
    const casa = /^ffmpeg version (\S+)/.exec(primeira);
    return casa?.[1] ?? "nao-declarado";
  } catch {
    return "nao-declarado";
  }
}

/**
 * A raiz do projeto: sobe de `src/render/cache/` ate achar package.json
 * (a mesma busca que o BrowserFetcher do Remotion faz pelo cwd).
 */
function acharRaizDoProjeto(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const pai = dirname(dir);
    if (pai === dir) {
      return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    }
    dir = pai;
  }
}

/**
 * Le as versoes da pilha em runtime.
 *
 * Toda leitura tem fallback para `"nao-declarado"` — a direcao segura:
 * uma versao ausente MUDA a chave (miss), nunca deixa o cache acertar
 * por acaso. O que NAO entra aqui: data, memTotal, workers, faixas,
 * porta, env de agendamento (ADR-0041, decisao 2).
 */
export function lerVersoesDaPilha(
  opcoes: OpcoesDasVersoes = {},
): VersoesDaPilha {
  const raiz = opcoes.raizDoProjeto ?? acharRaizDoProjeto();
  return Object.freeze({
    remotion: versaoDoPacote(raiz, "remotion"),
    renderer: versaoDoPacote(raiz, "@remotion/renderer"),
    bundler: versaoDoPacote(raiz, "@remotion/bundler"),
    compositor: versaoDoPacote(raiz, "@remotion/compositor-linux-x64-gnu"),
    navegador: versaoDoNavegador(raiz),
  });
}

/**
 * Le o pin de ferramentas (node + ffmpeg) em runtime — o padrao de
 * `MixDocument.ferramentas` do F3-05 aplicado ao cache: o determinismo
 * entre versoes de ferramenta e declarado na chave, nunca assumido.
 */
export function lerPinDeFerramentas(
  opcoes: OpcoesDasVersoes = {},
): PinDeFerramentas {
  return Object.freeze({
    node: process.versions.node ?? "nao-declarado",
    ffmpeg: (opcoes.lerFfmpeg ?? lerVersaoDoFfmpeg)(),
  });
}
