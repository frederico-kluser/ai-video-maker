/**
 * src/autoria/executor/cassete.ts
 *
 * O CASSETE de autoria — o registro completo e reproduzivel de UMA
 * execucao do caminho de chamada da autoria para UMA chave de cache
 * (card F4-04; formato herdado do contrato F2-01).
 *
 * Layout — o MESMO do contrato F2-01 (src/resolucao/cassete/formato.ts),
 * sob `fixtures/cassetes/autoria/<chave>/`:
 *
 *   cassete.json      cabecalho: formato, identidade, componentes da chave
 *   resultado.json    o Documento de Autoria produzido (Autoria.1)
 *   procedencia.json  licenca e origem (licenca OBRIGATORIA)
 *   chamadas.json     as chamadas HTTP gravadas, na ordem (sosia, nao sucessor)
 *   corpos/<sha256>   corpo binario de cada resposta gravada
 *   volatil.json      o UNICO arquivo autorizado a mudar ao regravar
 *   invalidos.json    [EXTENSAO deste card] os manifestos INVALIDOS
 *                     gravados — o ∅-crit: o cassete NAO pode conter so
 *                     os bons. Cada entrada: id, motivo (a regra que
 *                     viola) e o documento como veio.
 *
 * A chave segue a MESMA construcao dos estagios de resolucao
 * (chaveDeCache sobre JSON canonico dos componentes, resolucao/contrato.ts):
 * versaoContrato, versaoEstagio, nome "autoria", hashManifesto (a fixture
 * canonica — o cassete grava contra o MESMO manifesto que o resto do
 * pipeline usa, contrato-w6 §12) e parametros {provedor, modelo,
 * maxTokens, promptSha256, briefSha256, tentativa}. Mudar QUALQUER
 * componente troca o diretorio — replay offline vira miss, nunca
 * resultado velho servido em silencio (C12).
 *
 * O determinismo do cassete e o mesmo do F2-01: regravar reproduz byte a
 * byte todos os arquivos exceto os campos declarados em CAMPOS_VOLATEIS
 * (todo volatil.json + procedencia.adquiridoEm). O teste
 * tests/autoria/cassete-diff.test.ts prova isso com relogios diferentes.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ARQUIVO_CABECALHO,
  ARQUIVO_CHAMADAS,
  ARQUIVO_PROCEDENCIA,
  ARQUIVO_RESULTADO,
  ARQUIVO_VOLATIL,
  CAMPOS_VOLATEIS,
  DIRETORIO_CORPOS,
  VERSAO_FORMATO_CASSETE,
  caminhoDoCorpo,
  diretorioDoCassete,
  procurarCredencial,
  sanitizarHeaders,
  sanitizarUrl,
  serializarCanonico,
  sha256,
  validarProcedencia,
} from "../../resolucao/cassete/formato.js";
import type {
  ChamadaGravada,
  ProcedenciaCassete,
  VolatilCassete,
} from "../../resolucao/cassete/formato.js";
import { jsonCanonico } from "../../resolucao/contrato.js";
import { hashDoManifesto } from "../../resolucao/contrato.js";
import type { Manifesto } from "../../contratos/manifesto.js";
import { chaveDeCache } from "../contrato/cache.js";
import type { EntradaAutoria } from "../contrato/contrato.js";
import type { DocumentoAutoria } from "../contrato/contrato.js";
import {
  NOME_CASSETE_AUTORIA,
  VERSAO_CONTRATO_EXECUTOR,
  VERSAO_EXECUTOR,
} from "./contrato.js";
import type { ProvedorAutoria } from "./contrato.js";

/** Arquivo extra deste card: os manifestos invalidos GRAVADOS (∅-crit). */
export const ARQUIVO_INVALIDOS = "invalidos.json";

/** Um manifesto invalido gravado — a resposta como veio, com o motivo. */
export interface ManifestoInvalidoGravado {
  /** Id estavel dentro do cassete (ex.: "invalido-01"). */
  readonly id: string;
  /** A regra do contrato que o documento viola (documentacao, nao gate). */
  readonly motivo: string;
  /** O documento invalido, como veio da resposta. */
  readonly documento: unknown;
}

/** Componentes da chave do cassete de autoria (mesma forma do F2-01). */
export interface ComponentesCasseteAutoria {
  readonly versaoContrato: string;
  readonly versaoEstagio: string;
  readonly nome: typeof NOME_CASSETE_AUTORIA;
  /** SHA-256 do manifesto contra o qual o cassete grava (fixture canonica). */
  readonly hashManifesto: string;
  /** Valores escalares apenas — tudo que muda a saida e nao e o brief. */
  readonly parametros: Readonly<Record<string, string | number | boolean | null>>;
}

/** Cabecalho do cassete de autoria. */
export interface CabecalhoCasseteAutoria {
  readonly formato: string;
  readonly chave: string;
  readonly componentes: ComponentesCasseteAutoria;
  readonly quantidadeChamadas: number;
  /**
   * A chave de cache do F4-01 da entrada gravada (auditoria: amarra o
   * cassete a entrada exata que o produziu; nao entra na chave do
   * cassete).
   */
  readonly chaveCacheEntrada: string;
}

/** Um cassete de autoria carregado do disco, inteiro. */
export interface CasseteAutoria {
  readonly cabecalho: CabecalhoCasseteAutoria;
  readonly resultado: DocumentoAutoria;
  readonly procedencia: ProcedenciaCassete;
  readonly chamadas: readonly ChamadaGravada[];
  readonly invalidos: readonly ManifestoInvalidoGravado[];
  readonly volatil: VolatilCassete;
}

// ─── Erros ─────────────────────────────────────────────────────────────────────

/** O ∅-crit de autoria: o cassete do MEU estagio nao existe. */
export class ECasseteAutoriaAusente extends Error {
  readonly code = "CASSETE_AUTORIA_AUSENTE";
  readonly chave: string;
  readonly diretorio: string;

  constructor(chave: string, diretorio: string, detalhe?: string) {
    super(
      `∅-crit: o cassete de AUTORIA nao existe para a chave ${chave.slice(0, 16)}…\n` +
        `  esperado: ${diretorio}\n` +
        (detalhe ? `  detalhe:  ${detalhe}\n` : "") +
        `  Um estagio sem cassete NAO e pulado: ele derruba a suite offline.\n` +
        `  Grave com: just autoria-gravar (com rede e credencial, a mao).`,
    );
    this.name = "ECasseteAutoriaAusente";
    this.chave = chave;
    this.diretorio = diretorio;
  }
}

/** Cassete existe mas esta quebrado. */
export class ECasseteAutoriaInvalido extends Error {
  readonly code = "CASSETE_AUTORIA_INVALIDO";
  readonly problemas: readonly string[];

  constructor(diretorio: string, problemas: readonly string[]) {
    super(
      `Cassete de autoria invalido em ${diretorio}:\n` +
        problemas.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "ECasseteAutoriaInvalido";
    this.problemas = problemas;
  }
}

// ─── Caminhos ──────────────────────────────────────────────────────────────────

/** Raiz padrao dos cassetes (a mesma do F2-01). */
export const RAIZ_CASSETES_PADRAO = "fixtures/cassetes";

/** Diretorio de todos os cassetes de autoria. */
export function diretorioDosCassetesAutoria(raiz: string): string {
  return join(raiz, NOME_CASSETE_AUTORIA);
}

/** Diretorio de um cassete de autoria: `<raiz>/autoria/<chave>`. */
export function diretorioDoCasseteAutoria(raiz: string, chave: string): string {
  return diretorioDoCassete(raiz, NOME_CASSETE_AUTORIA, chave);
}

// ─── Chave de cache do cassete ─────────────────────────────────────────────────

/**
 * Monta os componentes da chave do cassete de autoria.
 *
 * A MESMA construcao dos estagios de resolucao (componentesDaChave +
 * chaveDeCache de resolucao/contrato.ts), com o nome "autoria" — o nome
 * do CASSETE, nao um NomeEstagio de resolucao (o orquestrador nunca o
 * ve; AB-502).
 *
 * `promptSha256` e `briefSha256` amarram o cassete ao texto exato do
 * prompt (biblioteca F4-02) e as mensagens exatas do brief: se qualquer
 * um mudar, a chave muda e o replay offline vira miss (C12).
 */
export function componentesDoCassete(
  entrada: EntradaAutoria,
  provedor: ProvedorAutoria,
  maxTokens: number,
  manifesto: Manifesto,
): ComponentesCasseteAutoria {
  return {
    versaoContrato: VERSAO_CONTRATO_EXECUTOR,
    versaoEstagio: VERSAO_EXECUTOR,
    nome: NOME_CASSETE_AUTORIA,
    hashManifesto: hashDoManifesto(manifesto),
    parametros: {
      provedor,
      modelo: entrada.model,
      maxTokens,
      promptSha256: sha256(entrada.system),
      briefSha256: sha256(jsonCanonico(entrada.messages)),
      tentativa: entrada.tentativa ?? 1,
    },
  };
}

/**
 * Chave de cache do cassete de autoria: SHA-256 do JSON canonico dos
 * componentes — a mesma construcao de chaveDeCache da resolucao
 * (canonicalizacao identica; nome de tipo diferente porque "autoria"
 * nao e um NomeEstagio).
 */
export function chaveDoCasseteAutoria(componentes: ComponentesCasseteAutoria): string {
  return createHash("sha256")
    .update(jsonCanonico(componentes), "utf-8")
    .digest("hex");
}

// ─── Gravacao ──────────────────────────────────────────────────────────────────

export interface OpcoesGravacaoCasseteAutoria {
  /** Raiz dos cassetes (default: fixtures/cassetes). */
  readonly raiz?: string;
  /** O documento de autoria produzido pela chamada (o BOM). */
  readonly documento: DocumentoAutoria;
  /** A entrada de cache que produziu o documento. */
  readonly entrada: EntradaAutoria;
  /** Provedor usado na chamada. */
  readonly provedor: ProvedorAutoria;
  /** maxTokens usado na chamada. */
  readonly maxTokens: number;
  /** O manifesto contra o qual o cassete grava (fixture canonica). */
  readonly manifesto: Manifesto;
  /** Chamadas HTTP gravadas, na ordem (vazio quando o estagio e local). */
  readonly chamadas?: readonly ChamadaGravada[];
  /** Corpos das respostas, por hash (deduplicados). */
  readonly corpos?: ReadonlyMap<string, Buffer>;
  /** Procedencia (licenca obrigatoria — ∅-crit da W4, herdado). */
  readonly procedencia: ProcedenciaCassete;
  /** Manifestos invalidos GRAVADOS (∅-crit deste card). */
  readonly invalidos: readonly ManifestoInvalidoGravado[];
  /** Relogio injetavel (volatil.json e o unico consumidor). */
  readonly relogio?: () => Date;
  /** Quando true, preserva o invalidos.json ja existente (regravar). */
  readonly preservarInvalidos?: boolean;
}

/**
 * Escreve o diretorio de cassete de autoria inteiro, com JSON canonico.
 *
 * A mesma disciplina do gravador F2-01: validar procedencia ANTES de
 * escrever qualquer byte, varrer tudo procurando credencial, e escrever
 * atomico por arquivo. Regravar reproduz bytes identicos exceto
 * CAMPOS_VOLATEIS (testado em tests/autoria/cassete-diff.test.ts).
 */
export function gravarCasseteAutoria(opcoes: OpcoesGravacaoCasseteAutoria): {
  chave: string;
  diretorio: string;
} {
  const relogio = opcoes.relogio ?? (() => new Date());
  const raiz = opcoes.raiz ?? RAIZ_CASSETES_PADRAO;
  const componentes = componentesDoCassete(
    opcoes.entrada,
    opcoes.provedor,
    opcoes.maxTokens,
    opcoes.manifesto,
  );
  const chave = chaveDoCasseteAutoria(componentes);
  const diretorio = diretorioDoCasseteAutoria(raiz, chave);

  const chamadas = opcoes.chamadas ?? [];
  const cabecalho: CabecalhoCasseteAutoria = {
    formato: VERSAO_FORMATO_CASSETE,
    chave,
    componentes,
    quantidadeChamadas: chamadas.length,
    chaveCacheEntrada: chaveDeCache(opcoes.entrada),
  };
  const volatil: VolatilCassete = {
    gravadoEm: relogio().toISOString(),
    duracaoMs: 0,
    runtime: `node ${process.version}`,
  };

  const invalidos = opcoes.preservarInvalidos && existsSync(join(diretorio, ARQUIVO_INVALIDOS))
    ? JSON.parse(readFileSync(join(diretorio, ARQUIVO_INVALIDOS), "utf-8")) as unknown[]
    : opcoes.invalidos;

  const arquivos: Array<[string, string]> = [
    [ARQUIVO_CABECALHO, serializarCanonico(cabecalho)],
    [ARQUIVO_RESULTADO, serializarCanonico(opcoes.documento)],
    [ARQUIVO_PROCEDENCIA, serializarCanonico(opcoes.procedencia)],
    [ARQUIVO_CHAMADAS, serializarCanonico(chamadas)],
    [ARQUIVO_VOLATIL, serializarCanonico(volatil)],
    [ARQUIVO_INVALIDOS, serializarCanonico(invalidos)],
  ];

  // Procedencia valida ANTES do disco — cassete invalido nao chega ao
  // disco (mesma regra do gravador F2-01).
  const problemas = validarProcedencia(opcoes.procedencia, diretorio);
  if (problemas.length > 0) {
    throw new ECasseteAutoriaInvalido(
      diretorio,
      problemas.map((p) => `[${p.codigo}] ${p.mensagem}`),
    );
  }

  // Tripwire de credencial sobre TODOS os bytes que serao escritos (C11:
  // busca no texto inteiro, nao so nos headers).
  for (const [nome, conteudo] of arquivos) {
    const achados = procurarCredencial(conteudo);
    if (achados.length > 0) {
      throw new ECasseteAutoriaInvalido(diretorio, [
        `credencial detectada em ${nome}: ${achados.join(", ")}`,
      ]);
    }
  }
  if (opcoes.corpos) {
    for (const [hash, corpo] of opcoes.corpos) {
      const achados = procurarCredencial(corpo.toString("utf-8"));
      if (achados.length > 0) {
        throw new ECasseteAutoriaInvalido(diretorio, [
          `credencial detectada no corpo ${hash.slice(0, 12)}…: ${achados.join(", ")}`,
        ]);
      }
    }
  }

  rmSync(diretorio, { recursive: true, force: true });
  mkdirSync(diretorio, { recursive: true });
  for (const [nome, conteudo] of arquivos) {
    writeFileSync(join(diretorio, nome), conteudo, "utf-8");
  }
  if (opcoes.corpos && opcoes.corpos.size > 0) {
    mkdirSync(join(diretorio, DIRETORIO_CORPOS), { recursive: true });
    for (const [hash, corpo] of opcoes.corpos) {
      writeFileSync(caminhoDoCorpo(diretorio, hash), corpo);
    }
  }

  return { chave, diretorio };
}

// ─── Leitura ───────────────────────────────────────────────────────────────────

function lerJson<T>(caminho: string, problemas: string[]): T {
  try {
    return JSON.parse(readFileSync(caminho, "utf-8")) as T;
  } catch (erro) {
    problemas.push(`nao foi possivel ler/parsear ${caminho}: ${(erro as Error).message}`);
    return {} as T;
  }
}

/**
 * Le um cassete de autoria do disco, validando-o.
 *
 * @throws ECasseteAutoriaAusente quando o diretorio nao existe ou falta
 *   arquivo obrigatorio. Ausencia parcial e ausencia.
 * @throws ECasseteAutoriaInvalido quando o conteudo existe mas nao presta.
 */
export function lerCasseteAutoria(
  raiz: string,
  chave: string,
): CasseteAutoria {
  const diretorio = diretorioDoCasseteAutoria(raiz, chave);
  const problemas: string[] = [];

  if (!existsSync(diretorio)) {
    throw new ECasseteAutoriaAusente(chave, diretorio);
  }
  const obrigatorios = [
    ARQUIVO_CABECALHO,
    ARQUIVO_RESULTADO,
    ARQUIVO_PROCEDENCIA,
    ARQUIVO_VOLATIL,
    ARQUIVO_INVALIDOS,
  ];
  const faltando = obrigatorios.filter((a) => !existsSync(join(diretorio, a)));
  if (faltando.length > 0) {
    throw new ECasseteAutoriaAusente(
      chave,
      diretorio,
      `arquivo(s) obrigatorio(s) ausente(s): ${faltando.join(", ")}`,
    );
  }

  const cabecalho = lerJson<CabecalhoCasseteAutoria>(join(diretorio, ARQUIVO_CABECALHO), problemas);
  const resultado = lerJson<DocumentoAutoria>(join(diretorio, ARQUIVO_RESULTADO), problemas);
  const procedencia = lerJson<ProcedenciaCassete>(join(diretorio, ARQUIVO_PROCEDENCIA), problemas);
  const volatil = lerJson<VolatilCassete>(join(diretorio, ARQUIVO_VOLATIL), problemas);
  const chamadas = lerJson<ChamadaGravada[]>(join(diretorio, ARQUIVO_CHAMADAS), problemas);
  const invalidos = lerJson<ManifestoInvalidoGravado[]>(join(diretorio, ARQUIVO_INVALIDOS), problemas);

  if (problemas.length > 0) {
    throw new ECasseteAutoriaInvalido(diretorio, problemas);
  }
  if (cabecalho.formato !== VERSAO_FORMATO_CASSETE) {
    problemas.push(
      `cassete gravado no formato ${cabecalho.formato}, este codigo le ${VERSAO_FORMATO_CASSETE}`,
    );
  }
  if (cabecalho.chave !== chave) {
    problemas.push(
      `cabecalho.chave (${cabecalho.chave.slice(0, 16)}…) diverge do diretorio (${chave.slice(0, 16)}…)`,
    );
  }
  problemas.push(
    ...validarProcedencia(procedencia, join(diretorio, ARQUIVO_PROCEDENCIA)).map(
      (p) => `[${p.codigo}] ${p.mensagem}`,
    ),
  );
  if (!Array.isArray(invalidos)) {
    problemas.push("invalidos.json nao e um array");
  } else if (invalidos.length === 0) {
    problemas.push(
      "invalidos.json vazio — o cassete so tem os manifestos BONS, e so os bons nao testa nada (∅-crit do F4-04)",
    );
  }
  if (problemas.length > 0) {
    throw new ECasseteAutoriaInvalido(diretorio, problemas);
  }

  return {
    cabecalho,
    resultado,
    procedencia,
    chamadas: Array.isArray(chamadas) ? chamadas : [],
    invalidos: Array.isArray(invalidos) ? invalidos : [],
    volatil,
  };
}

// ─── Replay do fetch ───────────────────────────────────────────────────────────

/**
 * Cria o `fetch` que reproduz as chamadas gravadas de um cassete de
 * autoria — a MESMA mecanica do reprodutor F2-01 (casa por metodo e URL
 * sanitizada, devolve os corpos na ordem, lanca em chamada ausente).
 *
 * Offline, o executor usa este fetch: a requisicao e montada de
 * verdade, o corpo gravado volta como veio, a extracao e o gate rodam.
 * Um fetch que nao tivesse a chamada lanca em vez de cair para a rede.
 */
export function criarFetchDoCasseteAutoria(
  cassete: CasseteAutoria,
  diretorio: string,
): typeof fetch {
  const porChave = new Map<string, ChamadaGravada[]>();
  for (const chamada of cassete.chamadas) {
    const chave = `${chamada.metodo} ${chamada.url}`;
    const lista = porChave.get(chave) ?? [];
    lista.push(chamada);
    porChave.set(chave, lista);
  }
  const consumidas = new Map<string, number>();

  return async function fetchDoCassete(
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
    const chave = `${metodo} ${sanitizarUrl(url)}`;
    const gravadas = porChave.get(chave);
    if (!gravadas || gravadas.length === 0) {
      throw new Error(
        `Chamada nao gravada no cassete de autoria: ${metodo} ${url}\n` +
          `  cassete: ${diretorio}\n` +
          `  Ou o executor mudou sem bumpar a versao, ou o cassete precisa ser regravado.`,
      );
    }
    const indice = consumidas.get(chave) ?? 0;
    consumidas.set(chave, indice + 1);
    const gravada = gravadas[indice] ?? gravadas[gravadas.length - 1]!;

    const corpo = readFileSync(caminhoDoCorpo(diretorio, gravada.hashCorpo));
    const headers = new Headers();
    for (const [nome, valor] of Object.entries(gravada.headersResposta)) {
      headers.set(nome, valor);
    }
    return new Response(corpo, {
      status: gravada.status,
      headers,
    });
  };
}

// ─── Reexports de conveniencia (formato F2-01) ────────────────────────────────

export { sanitizarHeaders, sanitizarUrl, sha256, CAMPOS_VOLATEIS };
export type { ChamadaGravada, ProcedenciaCassete, VolatilCassete };
