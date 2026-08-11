/**
 * src/resolucao/rede/bloqueio.ts
 *
 * Guarda de rede MINIMO — em processo.
 *
 * Escopo deste arquivo (F2-01): o mecanismo suficiente para que a
 * pergunta "a suite offline bloqueia a rede ou so nao a usa?" tenha
 * resposta executavel hoje. O guarda COMPLETO (subprocesso, proxy,
 * denominador de chamadas) e o card F2-07, que entrega
 * `tools/offline-guard.*` na W5 e substitui/estende isto.
 *
 * "Nao usar a rede" e "nao conseguir usar a rede" sao coisas diferentes.
 * A diferenca so aparece quando alguem tenta sair. Por isso este guarda
 * nao e um `expect(fetch).not.toHaveBeenCalled()`: ele derruba a
 * chamada, em quatro camadas, e a suite tem um estagio que tenta sair
 * de proposito para provar que a camada responde.
 *
 * Camadas interceptadas:
 *   1. `globalThis.fetch`            — o caminho de 99% do codigo
 *   2. `net.Socket.prototype.connect` — TCP cru, e o fundo de http/https/undici
 *   3. `http.request` / `https.request` (+ `.get`) — clientes classicos
 *   4. `dns.lookup` / `dns.promises.lookup` / `dns.resolve` — resolucao de nome
 *
 * Fora do escopo (F2-07): subprocessos (`curl` em `child_process`),
 * `dgram`, e o denominador de "zero chamadas externas". Em `just
 * res:offline` isso e coberto por fora, pelo namespace de rede
 * (`unshare --net`), que vale para o processo e todos os filhos.
 */

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

// ─── Erro ───────────────────────────────────────────────────────────────────────

/**
 * Toda tentativa de sair para a rede com o guarda ativo termina aqui.
 *
 * A mensagem e estavel de proposito: testes casam `/REDE BLOQUEADA/` e
 * um erro de rede generico (ENOTFOUND por DNS quebrado, por exemplo)
 * NAO casa. Assim "passou por acaso" e distinguivel de "foi bloqueado".
 */
export class ERedeBloqueada extends Error {
  readonly code = "REDE_BLOQUEADA";
  /** Camada que interceptou: fetch, socket, http, https ou dns. */
  readonly camada: string;
  /** Destino que a chamada tentou alcancar. */
  readonly destino: string;

  constructor(camada: string, destino: string) {
    super(
      `REDE BLOQUEADA [${camada}] → ${destino}. ` +
        `Este processo roda com o guarda de rede da resolucao ativo: ` +
        `nenhuma chamada externa sai daqui. Se um estagio precisa desta ` +
        `resposta, ela tem de estar num cassete (fixtures/cassetes/...), ` +
        `gravado em modo gravacao. Ver docs/contrato-estagio-resolucao.md.`,
    );
    this.name = "ERedeBloqueada";
    this.camada = camada;
    this.destino = destino;
  }
}

// ─── Opcoes ─────────────────────────────────────────────────────────────────────

export interface OpcoesBloqueio {
  /**
   * Permitir conexoes de loopback (127.0.0.1, ::1, localhost).
   *
   * Default: `false`. Existe porque a propria sonda do guarda precisa de
   * um servidor local para provar que, sem o guarda, a conexao funciona
   * — e com ele, nao. Nunca ligue isto numa suite de estagio: um
   * provedor pode estar atras de um proxy local.
   */
  readonly permitirLoopback?: boolean;
}

// ─── Estado ─────────────────────────────────────────────────────────────────────

interface Originais {
  fetch: typeof globalThis.fetch;
  socketConnect: typeof net.Socket.prototype.connect;
  httpRequest: typeof http.request;
  httpGet: typeof http.get;
  httpsRequest: typeof https.request;
  httpsGet: typeof https.get;
  dnsLookup: typeof dns.lookup;
  dnsPromisesLookup: typeof dns.promises.lookup;
  dnsResolve: typeof dns.resolve;
}

let originais: Originais | null = null;
let opcoesAtivas: Required<OpcoesBloqueio> = { permitirLoopback: false };
let tentativas: string[] = [];

const HOSTS_LOOPBACK = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0:0:0:0:0:0:0:1",
  "[::1]",
]);

function ehLoopback(host: string | undefined | null): boolean {
  if (host === undefined || host === null || host === "") return true;
  const limpo = host.replace(/^\[|\]$/g, "").toLowerCase();
  return HOSTS_LOOPBACK.has(limpo) || limpo.startsWith("127.");
}

/**
 * Se o "host" ja e um endereco IP literal.
 *
 * `dns.lookup("127.0.0.1")` nao faz consulta nenhuma — o Node detecta o
 * literal e retorna. Bloquear isso quebraria `server.listen()`, que
 * resolve o endereco de bind, sem impedir saida nenhuma: quem tenta sair
 * para um IP cru e pego na camada de socket, que continua fechada.
 */
function ehEnderecoLiteral(host: string | undefined | null): boolean {
  if (typeof host !== "string") return false;
  return net.isIP(host.replace(/^\[|\]$/g, "")) !== 0;
}

/** DNS que nao sai da maquina: literal de IP ou loopback autorizado. */
function dnsPermitido(host: string | undefined | null): boolean {
  if (ehEnderecoLiteral(host)) return true;
  return opcoesAtivas.permitirLoopback && ehLoopback(host);
}

function registrarEBloquear(camada: string, destino: string): never {
  tentativas.push(`${camada} → ${destino}`);
  throw new ERedeBloqueada(camada, destino);
}

// ─── API ────────────────────────────────────────────────────────────────────────

/** Se o guarda esta instalado neste processo. */
export function redeBloqueada(): boolean {
  return originais !== null;
}

/**
 * Tentativas de saida registradas desde a instalacao do guarda.
 *
 * Serve de denominador: "zero chamadas externas" sem denominador e
 * verdade por vacuidade. Aqui o numerador e a lista, e a lista existe.
 */
export function tentativasDeSaida(): readonly string[] {
  return [...tentativas];
}

/**
 * Instala o guarda de rede no processo.
 *
 * Idempotente: instalar duas vezes nao empilha patches.
 * @returns funcao que restaura o estado original.
 */
export function bloquearRede(opcoes: OpcoesBloqueio = {}): () => void {
  if (originais !== null) return liberarRede;

  opcoesAtivas = { permitirLoopback: opcoes.permitirLoopback ?? false };
  tentativas = [];

  originais = {
    fetch: globalThis.fetch,
    socketConnect: net.Socket.prototype.connect,
    httpRequest: http.request,
    httpGet: http.get,
    httpsRequest: https.request,
    httpsGet: https.get,
    dnsLookup: dns.lookup,
    dnsPromisesLookup: dns.promises.lookup,
    dnsResolve: dns.resolve,
  };

  // ── Camada 1: fetch ──────────────────────────────────────────────────────
  const fetchOriginal = originais.fetch;
  globalThis.fetch = function fetchBloqueado(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const destino = descreverEntradaFetch(input);
    if (opcoesAtivas.permitirLoopback && destinoEhLoopback(destino)) {
      return fetchOriginal(input, init);
    }
    return Promise.reject(criarErro("fetch", destino));
  } as typeof globalThis.fetch;

  // ── Camada 2: socket TCP ─────────────────────────────────────────────────
  const connectOriginal = originais.socketConnect;
  net.Socket.prototype.connect = function connectBloqueado(
    this: net.Socket,
    ...args: unknown[]
  ): net.Socket {
    const destino = descreverConnect(args);
    if (destino === null || (opcoesAtivas.permitirLoopback && destinoEhLoopback(destino))) {
      // destino === null → socket de dominio unix (caminho local, nao rede)
      return connectOriginal.apply(this, args as never) as net.Socket;
    }
    registrarEBloquear("socket", destino);
  } as typeof net.Socket.prototype.connect;

  // ── Camada 3: http/https ─────────────────────────────────────────────────
  http.request = envolverRequest("http", originais.httpRequest) as typeof http.request;
  http.get = envolverRequest("http", originais.httpGet) as typeof http.get;
  https.request = envolverRequest("https", originais.httpsRequest) as typeof https.request;
  https.get = envolverRequest("https", originais.httpsGet) as typeof https.get;

  // ── Camada 4: DNS ────────────────────────────────────────────────────────
  const lookupOriginal = originais.dnsLookup;
  dns.lookup = function lookupBloqueado(...args: unknown[]): void {
    const host = typeof args[0] === "string" ? args[0] : "";
    const callback = args[args.length - 1];
    if (dnsPermitido(host)) {
      (lookupOriginal as (...a: unknown[]) => void)(...args);
      return;
    }
    tentativas.push(`dns → ${host}`);
    if (typeof callback === "function") {
      (callback as (e: Error) => void)(new ERedeBloqueada("dns", host));
      return;
    }
    throw new ERedeBloqueada("dns", host);
  } as unknown as typeof dns.lookup;

  const lookupPromiseOriginal = originais.dnsPromisesLookup;
  dns.promises.lookup = function lookupPromiseBloqueado(
    hostname: string,
    ...resto: unknown[]
  ): Promise<unknown> {
    if (dnsPermitido(hostname)) {
      return (lookupPromiseOriginal as (...a: unknown[]) => Promise<unknown>)(
        hostname,
        ...resto,
      );
    }
    return Promise.reject(criarErro("dns", hostname));
  } as unknown as typeof dns.promises.lookup;

  const resolveOriginal = originais.dnsResolve;
  dns.resolve = function resolveBloqueado(...args: unknown[]): void {
    const host = typeof args[0] === "string" ? args[0] : "";
    const callback = args[args.length - 1];
    if (opcoesAtivas.permitirLoopback && ehLoopback(host)) {
      (resolveOriginal as (...a: unknown[]) => void)(...args);
      return;
    }
    tentativas.push(`dns → ${host}`);
    if (typeof callback === "function") {
      (callback as (e: Error) => void)(new ERedeBloqueada("dns", host));
      return;
    }
    throw new ERedeBloqueada("dns", host);
  } as unknown as typeof dns.resolve;

  return liberarRede;
}

/** Restaura tudo que `bloquearRede` trocou. */
export function liberarRede(): void {
  if (originais === null) return;
  globalThis.fetch = originais.fetch;
  net.Socket.prototype.connect = originais.socketConnect;
  http.request = originais.httpRequest;
  http.get = originais.httpGet;
  https.request = originais.httpsRequest;
  https.get = originais.httpsGet;
  dns.lookup = originais.dnsLookup;
  dns.promises.lookup = originais.dnsPromisesLookup;
  dns.resolve = originais.dnsResolve;
  originais = null;
}

/**
 * Roda `fn` com o guarda temporariamente desligado.
 *
 * ATENCAO — porta de fuga. Existe por UM motivo: a sonda do proprio
 * guarda precisa mostrar que, sem ele, a mesma chamada de loopback
 * funciona; se nao mostrasse, "bloqueou" seria indistinguivel de
 * "quebrou". O nome e feio de proposito e `tools/resolucao/offline.sh`
 * tem um tripwire que falha se este simbolo aparecer fora de
 * `src/resolucao/rede/` e `tests/resolucao/rede-bloqueada.test.ts`.
 *
 * Nunca use isto num estagio. Um estagio que precisa da rede grava
 * cassete em modo gravacao; offline ele reproduz.
 */
export async function __somenteParaSondaDoGuarda_comRedeLiberada<T>(
  fn: () => Promise<T>,
): Promise<T> {
  const estavaBloqueada = redeBloqueada();
  const opcoesAnteriores = { ...opcoesAtivas };
  if (estavaBloqueada) liberarRede();
  try {
    return await fn();
  } finally {
    if (estavaBloqueada) bloquearRede(opcoesAnteriores);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function criarErro(camada: string, destino: string): ERedeBloqueada {
  tentativas.push(`${camada} → ${destino}`);
  return new ERedeBloqueada(camada, destino);
}

function destinoEhLoopback(destino: string): boolean {
  const semEsquema = destino.replace(/^[a-z0-9+.-]+:\/\//i, "");
  const host = semEsquema.split("/")[0]?.split(":")[0] ?? "";
  return ehLoopback(host);
}

function descreverEntradaFetch(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url ?? String(input);
}

/** Descreve o destino de `Socket.connect`, ou null se nao for TCP. */
function descreverConnect(args: unknown[]): string | null {
  const primeiro = args[0];
  if (typeof primeiro === "number") {
    const host = typeof args[1] === "string" ? args[1] : "localhost";
    return `${host}:${primeiro}`;
  }
  if (typeof primeiro === "string") {
    // Socket de dominio unix — caminho local, nao e rede.
    return null;
  }
  if (primeiro !== null && typeof primeiro === "object") {
    const opts = primeiro as { host?: string; port?: number; path?: string };
    if (opts.path !== undefined) return null; // unix socket
    return `${opts.host ?? "localhost"}:${opts.port ?? "?"}`;
  }
  return "desconhecido";
}

function envolverRequest(
  esquema: string,
  original: (...args: never[]) => unknown,
): (...args: unknown[]) => unknown {
  return function requestBloqueado(...args: unknown[]): unknown {
    const destino = descreverRequest(esquema, args);
    if (opcoesAtivas.permitirLoopback && destinoEhLoopback(destino)) {
      return (original as unknown as (...a: unknown[]) => unknown)(...args);
    }
    registrarEBloquear(esquema, destino);
  };
}

function descreverRequest(esquema: string, args: unknown[]): string {
  const primeiro = args[0];
  if (typeof primeiro === "string") return primeiro;
  if (primeiro instanceof URL) return primeiro.href;
  if (primeiro !== null && typeof primeiro === "object") {
    const opts = primeiro as { host?: string; hostname?: string; port?: number; path?: string };
    const host = opts.hostname ?? opts.host ?? "localhost";
    return `${esquema}://${host}${opts.port ? `:${opts.port}` : ""}${opts.path ?? ""}`;
  }
  return `${esquema}://desconhecido`;
}
