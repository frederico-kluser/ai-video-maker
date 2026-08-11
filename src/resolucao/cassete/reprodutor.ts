/**
 * src/resolucao/cassete/reprodutor.ts
 *
 * Reproducao de cassete — o lado puro da fronteira.
 *
 * Tudo que `just res:offline` executa passa por aqui. O reprodutor nunca
 * toca a rede, nunca chama o estagio, e nunca "cai para o modo online"
 * quando falta alguma coisa. Falta de cassete lanca `ECasseteAusente`
 * (∅-crit) e falta de uma chamada dentro de um cassete existente lanca
 * `EChamadaNaoGravada`.
 *
 * O que NAO existe aqui, de proposito: fallback. Um reprodutor que cai
 * para a rede quando o cassete falta transforma a suite offline numa
 * suite online intermitente — verde na maquina que tem rede, vermelha no
 * CI, e ninguem descobre qual das duas esta certa.
 */

import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import {
  ARQUIVOS_OBRIGATORIOS,
  ARQUIVO_CABECALHO,
  ARQUIVO_CHAMADAS,
  ARQUIVO_PROCEDENCIA,
  ARQUIVO_RESULTADO,
  ARQUIVO_VOLATIL,
  ECasseteAusente,
  ECasseteInvalido,
  VERSAO_FORMATO_CASSETE,
  caminhoDoCorpo,
  diretorioDoCassete,
  diretorioDoEstagio,
  sanitizarUrl,
  validarProcedencia,
} from "./formato.js";
import type {
  CabecalhoCassete,
  Cassete,
  ChamadaGravada,
  ProblemaCassete,
  ProcedenciaCassete,
  VolatilCassete,
} from "./formato.js";
import type { ParcialResolvido } from "../manifesto-resolvido.js";

// ─── Erros ──────────────────────────────────────────────────────────────────────

/** O cassete existe, mas o estagio pediu uma chamada que nao esta nele. */
export class EChamadaNaoGravada extends Error {
  readonly code = "CHAMADA_NAO_GRAVADA";
  constructor(metodo: string, url: string, diretorio: string) {
    super(
      `Chamada nao gravada: ${metodo} ${url}\n` +
        `  cassete: ${diretorio}\n` +
        `  O cassete existe mas nao contem esta chamada. Ou o estagio mudou de\n` +
        `  comportamento sem bumpar a versao, ou o cassete precisa ser regravado.\n` +
        `  Nao ha fallback para a rede: offline e offline.`,
    );
    this.name = "EChamadaNaoGravada";
  }
}

// ─── Leitura ────────────────────────────────────────────────────────────────────

async function existe(caminho: string): Promise<boolean> {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

/**
 * Le um cassete do disco, validando-o.
 *
 * @throws ECasseteAusente quando o diretorio nao existe ou falta um
 *   arquivo obrigatorio. Ausencia parcial e ausencia: meio cassete nao
 *   reproduz meio estagio, reproduz um resultado errado.
 * @throws ECasseteInvalido quando o conteudo existe mas nao presta
 *   (formato incompativel, licenca ausente, JSON quebrado).
 */
export async function lerCassete(
  raiz: string,
  nome: string,
  chave: string,
): Promise<Cassete> {
  const diretorio = diretorioDoCassete(raiz, nome, chave);

  if (!(await existe(diretorio))) {
    throw new ECasseteAusente(nome, chave, diretorio, "diretorio nao existe");
  }

  const faltando: string[] = [];
  for (const arquivo of ARQUIVOS_OBRIGATORIOS) {
    if (!(await existe(join(diretorio, arquivo)))) faltando.push(arquivo);
  }
  if (faltando.length > 0) {
    throw new ECasseteAusente(
      nome,
      chave,
      diretorio,
      `arquivo(s) obrigatorio(s) ausente(s): ${faltando.join(", ")}`,
    );
  }

  const problemas: ProblemaCassete[] = [];

  const cabecalho = await lerJson<CabecalhoCassete>(
    join(diretorio, ARQUIVO_CABECALHO),
    problemas,
  );
  const resultado = await lerJson<ParcialResolvido>(
    join(diretorio, ARQUIVO_RESULTADO),
    problemas,
  );
  const procedencia = await lerJson<ProcedenciaCassete>(
    join(diretorio, ARQUIVO_PROCEDENCIA),
    problemas,
  );
  const volatil = await lerJson<VolatilCassete>(
    join(diretorio, ARQUIVO_VOLATIL),
    problemas,
  );
  const chamadas = (await existe(join(diretorio, ARQUIVO_CHAMADAS)))
    ? await lerJson<ChamadaGravada[]>(join(diretorio, ARQUIVO_CHAMADAS), problemas)
    : [];

  if (problemas.length > 0) throw new ECasseteInvalido(diretorio, problemas);

  if (cabecalho.formato !== VERSAO_FORMATO_CASSETE) {
    problemas.push({
      codigo: "FORMATO_INCOMPATIVEL",
      mensagem:
        `cassete gravado no formato ${cabecalho.formato}, ` +
        `este codigo le ${VERSAO_FORMATO_CASSETE}`,
      caminho: join(diretorio, ARQUIVO_CABECALHO),
    });
  }
  if (cabecalho.chave !== chave) {
    problemas.push({
      codigo: "FORMATO_INCOMPATIVEL",
      mensagem:
        `cabecalho.chave (${cabecalho.chave.slice(0, 16)}…) diverge do ` +
        `diretorio (${chave.slice(0, 16)}…) — cassete movido a mao?`,
      caminho: join(diretorio, ARQUIVO_CABECALHO),
    });
  }
  problemas.push(...validarProcedencia(procedencia, join(diretorio, ARQUIVO_PROCEDENCIA)));

  if (problemas.length > 0) throw new ECasseteInvalido(diretorio, problemas);

  return {
    cabecalho,
    resultado,
    procedencia,
    chamadas: Array.isArray(chamadas) ? chamadas : [],
    volatil,
  };
}

async function lerJson<T>(caminho: string, problemas: ProblemaCassete[]): Promise<T> {
  try {
    return JSON.parse(await readFile(caminho, "utf-8")) as T;
  } catch (erro) {
    problemas.push({
      codigo: "JSON_INVALIDO",
      mensagem: `nao foi possivel ler/parsear: ${(erro as Error).message}`,
      caminho,
    });
    return {} as T;
  }
}

// ─── Replay de chamadas ─────────────────────────────────────────────────────────

/**
 * Cria o `fetch` que reproduz as chamadas de um cassete.
 *
 * Casa por (metodo, url sanitizada). Chamada repetida da mesma URL
 * reproduz as gravacoes na ordem em que foram feitas — provedor que
 * pagina devolve conteudo diferente para a mesma URL, e um replay que
 * devolvesse sempre a primeira pagina esconderia justamente o bug de
 * paginacao.
 */
export function criarFetchDeCassete(
  cassete: Cassete,
  diretorioCassete: string,
): typeof fetch {
  const consumidas = new Map<string, number>();

  return async function fetchDeCassete(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = sanitizarUrl(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url,
    );
    const metodo = (init?.method ?? "GET").toUpperCase();
    const assinatura = `${metodo} ${url}`;

    const candidatas = cassete.chamadas.filter(
      (c) => c.metodo === metodo && c.url === url,
    );
    if (candidatas.length === 0) {
      throw new EChamadaNaoGravada(metodo, url, diretorioCassete);
    }

    const jaConsumidas = consumidas.get(assinatura) ?? 0;
    const escolhida =
      candidatas[Math.min(jaConsumidas, candidatas.length - 1)] as ChamadaGravada;
    consumidas.set(assinatura, jaConsumidas + 1);

    const corpo = await readFile(caminhoDoCorpo(diretorioCassete, escolhida.hashCorpo));
    return new Response(new Uint8Array(corpo), {
      status: escolhida.status,
      headers: new Headers(escolhida.headersResposta as Record<string, string>),
    });
  } as typeof fetch;
}

// ─── Cobertura ──────────────────────────────────────────────────────────────────

/** Lista as chaves de cassete gravadas para um estagio. */
export async function chavesGravadas(
  raiz: string,
  nome: string,
): Promise<string[]> {
  const dir = diretorioDoEstagio(raiz, nome);
  try {
    const entradas = await readdir(dir, { withFileTypes: true });
    return entradas
      .filter((e) => e.isDirectory() && /^[0-9a-f]{64}$/.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}
