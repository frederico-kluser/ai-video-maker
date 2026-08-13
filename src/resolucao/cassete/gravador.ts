/**
 * src/resolucao/cassete/gravador.ts
 *
 * Gravacao de cassete — o lado impuro da fronteira.
 *
 * Dois niveis, um dentro do outro:
 *
 *   GravadorDeChamadas — envolve `fetch`, grava requisicao e resposta
 *     como elas foram, sanitiza credencial, guarda o corpo por hash.
 *
 *   GravadorDeCassete — executa um estagio em modo gravacao, coleta as
 *     chamadas que ele fez, e escreve o diretorio de cassete completo.
 *
 * Este arquivo so roda em modo gravacao — ou seja, com a rede liberada e
 * fora da suite offline. Em `just res:offline` nada aqui e executado; o
 * que roda e o reprodutor.
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  ARQUIVO_CABECALHO,
  ARQUIVO_CHAMADAS,
  ARQUIVO_PROCEDENCIA,
  ARQUIVO_RESULTADO,
  ARQUIVO_VOLATIL,
  DIRETORIO_CORPOS,
  VERSAO_FORMATO_CASSETE,
  caminhoDoCorpo,
  diretorioDoCassete,
  procurarCredencial,
  removerHeadersVolateis,
  sanitizarHeaders,
  sanitizarUrl,
  serializarCanonico,
  sha256,
  validarProcedencia,
} from "./formato.js";
import type {
  CabecalhoCassete,
  ChamadaGravada,
  ProcedenciaCassete,
  VolatilCassete,
} from "./formato.js";
import { ECasseteInvalido } from "./formato.js";
import { componentesDaChave, chaveDeCache, hashDoManifesto } from "../contrato.js";
import type { EstagioResolucao } from "../contrato.js";
import type { Manifesto } from "../../contratos/manifesto.js";

// ─── Gravador de chamadas HTTP ──────────────────────────────────────────────────

/** Uma chamada gravada junto com o corpo bruto da resposta. */
interface ChamadaComCorpo {
  readonly chamada: ChamadaGravada;
  readonly corpo: Buffer;
}

/**
 * Envolve `fetch` gravando cada chamada.
 *
 * O `fetch` devolvido e o que vai em `EntradaEstagio.fetch`. Um estagio
 * que use `globalThis.fetch` em vez deste nao tem a chamada gravada — e
 * offline ele quebra no guarda de rede, que e o resultado correto.
 */
export class GravadorDeChamadas {
  private readonly chamadas: ChamadaComCorpo[] = [];
  private readonly fetchReal: typeof fetch;

  constructor(fetchReal: typeof fetch = globalThis.fetch) {
    this.fetchReal = fetchReal;
  }

  /** O `fetch` instrumentado que o estagio deve usar. */
  get fetch(): typeof fetch {
    const gravador = this;
    return async function fetchGravado(
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      const metodo = (init?.method ?? "GET").toUpperCase();

      const resposta = await gravador.fetchReal(input, init);
      const corpo = Buffer.from(await resposta.clone().arrayBuffer());

      gravador.registrar({
        metodo,
        url,
        headersRequisicao: normalizarHeaders(init?.headers),
        corpoRequisicao: typeof init?.body === "string" ? init.body : undefined,
        status: resposta.status,
        headersResposta: cabecalhosDeResposta(resposta),
        corpo,
      });

      return resposta;
    } as typeof fetch;
  }

  /** Registra uma chamada ja realizada. */
  registrar(dados: {
    metodo: string;
    url: string;
    headersRequisicao: Record<string, string>;
    corpoRequisicao?: string;
    status: number;
    headersResposta: Record<string, string>;
    corpo: Buffer;
  }): ChamadaGravada {
    const chamada: ChamadaGravada = {
      indice: this.chamadas.length,
      metodo: dados.metodo.toUpperCase(),
      url: sanitizarUrl(dados.url),
      headersRequisicao: sanitizarHeaders(dados.headersRequisicao),
      ...(dados.corpoRequisicao !== undefined
        ? { corpoRequisicao: dados.corpoRequisicao }
        : {}),
      status: dados.status,
      // Volateis removidos DEPOIS da sanitizacao: headers do fornecedor
      // que mudam a cada requisicao (date, age, x-request-id, …) nao
      // entram em chamadas.json nem redigidos — ver HEADERS_VOLATEIS e
      // ADR-0026 (AB-440/473/475). Nao toca no corpo nem no hash.
      headersResposta: removerHeadersVolateis(
        sanitizarHeaders(dados.headersResposta),
      ),
      hashCorpo: sha256(dados.corpo),
      bytesCorpo: dados.corpo.length,
    };
    this.chamadas.push({ chamada, corpo: dados.corpo });
    return chamada;
  }

  /** Todas as chamadas gravadas, na ordem. */
  get gravadas(): readonly ChamadaGravada[] {
    return this.chamadas.map((c) => c.chamada);
  }

  /** Corpos gravados, indexados por hash (deduplicados). */
  get corpos(): ReadonlyMap<string, Buffer> {
    const mapa = new Map<string, Buffer>();
    for (const { chamada, corpo } of this.chamadas) {
      mapa.set(chamada.hashCorpo, corpo);
    }
    return mapa;
  }
}

// ─── Gravador de cassete ────────────────────────────────────────────────────────

/** Opcoes de gravacao de um cassete. */
export interface OpcoesGravacao {
  /** Raiz dos cassetes (default: `fixtures/cassetes`). */
  readonly raiz: string;

  /** Manifesto que esta sendo resolvido. */
  readonly manifesto: Manifesto;

  /** Diretorio de trabalho temporario para o estagio. */
  readonly diretorioTrabalho: string;

  /** `fetch` real a instrumentar. Default: `globalThis.fetch`. */
  readonly fetchReal?: typeof fetch;

  /** Relogio injetavel — `volatil.json` e o unico lugar que o consome. */
  readonly relogio?: () => Date;
}

/** Resultado de uma gravacao. */
export interface ResultadoGravacao {
  /** Chave (e nome do diretorio) do cassete gravado. */
  readonly chave: string;
  /** Diretorio absoluto/relativo do cassete. */
  readonly diretorio: string;
  /** Quantidade de chamadas HTTP gravadas. */
  readonly quantidadeChamadas: number;
}

/**
 * Executa um estagio de verdade e grava o cassete.
 *
 * Passos, nesta ordem — a ordem importa:
 *   1. calcula a chave (identidade + versao + parametros + manifesto);
 *   2. executa o estagio com `fetch` instrumentado;
 *   3. VALIDA a procedencia (licenca obrigatoria) — antes de escrever
 *      qualquer byte. Cassete invalido nao chega ao disco: se chegasse,
 *      o proximo `res:offline` passaria e a divida ficaria invisivel;
 *   4. varre tudo que vai ser escrito procurando credencial;
 *   5. escreve o diretorio inteiro, com JSON canonico.
 */
export async function gravarCassete(
  estagio: EstagioResolucao,
  opcoes: OpcoesGravacao,
): Promise<ResultadoGravacao> {
  const relogio = opcoes.relogio ?? (() => new Date());
  const hashManifesto = hashDoManifesto(opcoes.manifesto);
  const componentes = componentesDaChave(estagio, hashManifesto);
  const chave = chaveDeCache(componentes);
  const diretorio = diretorioDoCassete(
    opcoes.raiz,
    estagio.identidade.nome,
    chave,
  );

  const gravadorChamadas = new GravadorDeChamadas(opcoes.fetchReal);
  const inicio = Date.now();

  const saida = await estagio.resolver({
    manifesto: opcoes.manifesto,
    parametros: estagio.parametros,
    fetch: gravadorChamadas.fetch,
    diretorioTrabalho: opcoes.diretorioTrabalho,
  });

  const duracaoMs = Date.now() - inicio;

  // ── 3. procedencia antes do disco ────────────────────────────────────────
  const problemas = validarProcedencia(saida.procedencia, diretorio);
  if (problemas.length > 0) throw new ECasseteInvalido(diretorio, problemas);

  const cabecalho: CabecalhoCassete = {
    formato: VERSAO_FORMATO_CASSETE,
    chave,
    componentes,
    quantidadeChamadas: gravadorChamadas.gravadas.length,
  };
  const volatil: VolatilCassete = {
    gravadoEm: relogio().toISOString(),
    duracaoMs,
    runtime: `node ${process.version}`,
  };

  const arquivos: Array<[string, string]> = [
    [ARQUIVO_CABECALHO, serializarCanonico(cabecalho)],
    [ARQUIVO_RESULTADO, serializarCanonico(saida.parcial)],
    [ARQUIVO_PROCEDENCIA, serializarCanonico(saida.procedencia)],
    [ARQUIVO_CHAMADAS, serializarCanonico(gravadorChamadas.gravadas)],
    [ARQUIVO_VOLATIL, serializarCanonico(volatil)],
  ];

  // ── 4. tripwire de credencial ────────────────────────────────────────────
  for (const [nome, conteudo] of arquivos) {
    const achados = procurarCredencial(conteudo);
    if (achados.length > 0) {
      throw new ECasseteInvalido(diretorio, [
        {
          codigo: "CREDENCIAL_VAZADA",
          mensagem: `credencial detectada em ${nome}: ${achados.join(", ")}`,
          caminho: join(diretorio, nome),
        },
      ]);
    }
  }
  for (const [hash, corpo] of gravadorChamadas.corpos) {
    const achados = procurarCredencial(corpo.toString("utf-8"));
    if (achados.length > 0) {
      throw new ECasseteInvalido(diretorio, [
        {
          codigo: "CREDENCIAL_VAZADA",
          mensagem: `credencial detectada no corpo ${hash.slice(0, 12)}…: ${achados.join(", ")}`,
          caminho: caminhoDoCorpo(diretorio, hash),
        },
      ]);
    }
  }

  // ── 5. escrita ───────────────────────────────────────────────────────────
  await rm(diretorio, { recursive: true, force: true });
  await mkdir(diretorio, { recursive: true });
  for (const [nome, conteudo] of arquivos) {
    await writeFile(join(diretorio, nome), conteudo, "utf-8");
  }
  const corpos = gravadorChamadas.corpos;
  if (corpos.size > 0) {
    await mkdir(join(diretorio, DIRETORIO_CORPOS), { recursive: true });
    for (const [hash, corpo] of corpos) {
      await writeFile(caminhoDoCorpo(diretorio, hash), corpo);
    }
  }

  return {
    chave,
    diretorio,
    quantidadeChamadas: gravadorChamadas.gravadas.length,
  };
}

/** Escreve uma procedencia ja pronta num cassete existente (uso de teste). */
export async function escreverProcedencia(
  diretorio: string,
  procedencia: ProcedenciaCassete,
): Promise<void> {
  await mkdir(diretorio, { recursive: true });
  await writeFile(
    join(diretorio, ARQUIVO_PROCEDENCIA),
    serializarCanonico(procedencia),
    "utf-8",
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function normalizarHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const saida: Record<string, string> = {};
  if (!headers) return saida;
  if (headers instanceof Headers) {
    headers.forEach((valor, chave) => {
      saida[chave] = valor;
    });
    return saida;
  }
  if (Array.isArray(headers)) {
    for (const par of headers) {
      if (par.length >= 2) saida[par[0] as string] = par[1] as string;
    }
    return saida;
  }
  return { ...(headers as Record<string, string>) };
}

function cabecalhosDeResposta(resposta: Response): Record<string, string> {
  const saida: Record<string, string> = {};
  resposta.headers.forEach((valor, chave) => {
    saida[chave] = valor;
  });
  return saida;
}
