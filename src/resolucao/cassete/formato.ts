/**
 * src/resolucao/cassete/formato.ts
 *
 * O FORMATO DO CASSETE. Cinco cards da W4 (F2-02..F2-06) implementam
 * estagios contra este arquivo, em paralelo e cegos entre si — entao
 * tudo que eles precisam saber esta aqui e em
 * docs/contrato-estagio-resolucao.md.
 *
 * Um cassete e o registro completo e reproduzivel de UMA execucao de UM
 * estagio para UMA chave de cache. Layout:
 *
 *   fixtures/cassetes/<nome-estagio>/<chave>/
 *     cassete.json      cabecalho: formato, identidade, componentes da chave
 *     resultado.json    a ParcialResolvido produzida (JSON canonico)
 *     procedencia.json  licenca e origem — `licenca` OBRIGATORIA (∅-crit da W4)
 *     chamadas.json     as chamadas HTTP gravadas, na ordem (sosia, nao sucessor)
 *     corpos/<sha256>   corpo binario de cada resposta gravada
 *     volatil.json      o UNICO arquivo autorizado a mudar ao regravar
 *
 * Determinismo do cassete: regravar tem de reproduzir byte a byte todos
 * os arquivos, exceto os campos declarados em CAMPOS_VOLATEIS. Qualquer
 * outra diferenca refuta o determinismo do estagio — e `just res:cassete`
 * falha (ver diff.ts).
 *
 * Por que `volatil.json` existe em vez de simplesmente nao gravar hora:
 * auditoria de aquisicao (quando este byte entrou no repositorio) e um
 * requisito de licenca, nao um capricho. Isolar o volatil num arquivo
 * so mantem a auditoria E mantem o diff total: nao ha campo volatil
 * escondido no meio de um arquivo que deveria ser estavel.
 */

import { createHash } from "node:crypto";
import { join } from "node:path";
import type { ComponentesChave, NomeEstagio } from "../contrato.js";
import type { ParcialResolvido } from "../manifesto-resolvido.js";
import type { Procedencia, ProvedorAsset } from "../../store/procedencia.js";

// ─── Versao do formato ──────────────────────────────────────────────────────────

/** Versao do layout de cassete. Muda ⇒ todo cassete antigo e invalido. */
export const VERSAO_FORMATO_CASSETE = "1.0.0";

/** Raiz padrao dos cassetes, relativa a raiz do repositorio. */
export const RAIZ_CASSETES_PADRAO = "fixtures/cassetes";

// ─── Nomes de arquivo ───────────────────────────────────────────────────────────

export const ARQUIVO_CABECALHO = "cassete.json";
export const ARQUIVO_RESULTADO = "resultado.json";
export const ARQUIVO_PROCEDENCIA = "procedencia.json";
export const ARQUIVO_CHAMADAS = "chamadas.json";
export const ARQUIVO_VOLATIL = "volatil.json";
export const DIRETORIO_CORPOS = "corpos";

/**
 * Arquivos que TEM de existir num cassete valido.
 *
 * `chamadas.json` e `corpos/` sao opcionais: um estagio puramente local
 * (destaque de codigo, por exemplo) nao faz chamada nenhuma. Os quatro
 * abaixo nao sao opcionais — em particular `procedencia.json`, cuja
 * ausencia e exatamente o ∅-crit dos cards da W4.
 */
export const ARQUIVOS_OBRIGATORIOS = [
  ARQUIVO_CABECALHO,
  ARQUIVO_RESULTADO,
  ARQUIVO_PROCEDENCIA,
  ARQUIVO_VOLATIL,
] as const;

/**
 * Os UNICOS campos que podem diferir entre duas gravacoes do mesmo
 * cassete. Tudo o mais que diferir refuta o determinismo.
 *
 * Formato: `<arquivo>#/<ponteiro>` — `*` casa qualquer campo do arquivo.
 * Lista curta de proposito: cada entrada aqui e um pedaco de determinismo
 * que estamos abrindo mao, e tem de caber num paragrafo de justificativa.
 */
export const CAMPOS_VOLATEIS: readonly string[] = [
  // Todo o volatil.json: hora de gravacao, duracao, versoes do ambiente.
  `${ARQUIVO_VOLATIL}#/*`,
  // Auditoria de aquisicao. Exigida por licenca; nao entra em nenhuma chave.
  `${ARQUIVO_PROCEDENCIA}#/adquiridoEm`,
] as const;

// ─── Procedencia ────────────────────────────────────────────────────────────────

/**
 * Procedencia de um asset individual produzido pelo estagio.
 *
 * Campos em portugues de proposito: o ∅-crit dos cinco cards da W4 e
 * `rg -L '"licenca"' fixtures/cassetes/<nome>/**\/procedencia.json` →
 * vazio. `src/store/procedencia.ts` usa nomes em ingles (`license`) por
 * ser outro contrato, de outro card; use `paraProcedenciaDoStore()`
 * para converter, nunca copie a mao.
 */
export interface ProcedenciaAsset {
  /** SHA-256 do conteudo a que esta procedencia se refere. */
  readonly hash: string;

  /**
   * Licenca. OBRIGATORIA, nao-vazia, e nunca uma URL.
   *
   * "Preciso checar" nao e licenca. Se o provedor nao declara licenca,
   * o asset nao entra: e mais barato trocar de asset do que descobrir
   * depois que o video inteiro e indefensavel.
   */
  readonly licenca: string;

  /** Se a licenca exige atribuicao visivel. */
  readonly atribuicaoObrigatoria: boolean;

  /** Texto exato de atribuicao exigido, quando obrigatoria. */
  readonly atribuicao?: string;

  /** Provedor (identificador, ex.: "giphy", "pexels", "openai", "local"). */
  readonly provedor: string;

  /** Id do asset no provedor. */
  readonly idNoProvedor?: string;

  /**
   * De onde veio. Fica AQUI, acima da fronteira, e nunca no manifesto
   * resolvido — e nunca e usada como caminho de leitura (C7).
   */
  readonly origem?: string;

  /** Termo de busca usado, quando o asset veio de busca. */
  readonly termoDeBusca?: string;
}

/** Procedencia do cassete inteiro. */
export interface ProcedenciaCassete {
  /**
   * Licenca predominante desta gravacao. OBRIGATORIA e nao-vazia.
   *
   * Fica no topo para que o ∅-crit da W4 (um `rg` por `"licenca"`)
   * acuse cassete sem licenca mesmo quando `assets` estiver vazio.
   */
  readonly licenca: string;

  /** Provedor principal desta gravacao. */
  readonly provedor: string;

  /** Ferramenta e versao que produziu o resultado (ex.: "manim 0.18.1"). */
  readonly ferramenta?: string;

  /** Procedencia de cada asset produzido. Cada um tem sua propria licenca. */
  readonly assets: readonly ProcedenciaAsset[];

  /** ISO-8601 da aquisicao. VOLATIL: ver CAMPOS_VOLATEIS. */
  readonly adquiridoEm?: string;

  /** Notas de auditoria. */
  readonly notas?: string;
}

// ─── Chamadas gravadas ──────────────────────────────────────────────────────────

/**
 * Uma chamada HTTP gravada — o "sosia" da resposta externa.
 *
 * Sosia, nao sucessor: grave a resposta como ela veio. Se o estagio
 * conserta algo da resposta (normaliza um campo, preenche um default),
 * o conserto e do ESTAGIO e roda tambem no replay. Consertar na hora de
 * gravar esconde o defeito e o replay deixa de testar o estagio.
 */
export interface ChamadaGravada {
  /** Ordem da chamada dentro da execucao. Comeca em 0. */
  readonly indice: number;

  /** Metodo HTTP. */
  readonly metodo: string;

  /** URL chamada. Nunca vaza para o manifesto resolvido. */
  readonly url: string;

  /** Headers da requisicao, ja sanitizados. */
  readonly headersRequisicao: Readonly<Record<string, string>>;

  /** Corpo da requisicao, quando houver. */
  readonly corpoRequisicao?: string;

  /** Status HTTP da resposta. */
  readonly status: number;

  /** Headers da resposta, ja sanitizados. */
  readonly headersResposta: Readonly<Record<string, string>>;

  /** SHA-256 do corpo da resposta. O corpo vive em `corpos/<hash>`. */
  readonly hashCorpo: string;

  /** Tamanho do corpo em bytes. */
  readonly bytesCorpo: number;
}

// ─── Cabecalho ──────────────────────────────────────────────────────────────────

/** Cabecalho do cassete: a identidade completa do que foi gravado. */
export interface CabecalhoCassete {
  /** Versao do layout de cassete. */
  readonly formato: string;

  /** Chave de cache — tambem o nome do diretorio. */
  readonly chave: string;

  /** Componentes da chave, explicitos. Auditoria de C12 a olho nu. */
  readonly componentes: ComponentesChave;

  /** Quantas chamadas HTTP foram gravadas. */
  readonly quantidadeChamadas: number;
}

/** Campos volateis, isolados. O unico arquivo que pode mudar ao regravar. */
export interface VolatilCassete {
  /** ISO-8601 do momento da gravacao. */
  readonly gravadoEm: string;

  /** Duracao da execucao em ms. */
  readonly duracaoMs: number;

  /** Versao do runtime que gravou (ex.: "node v24.15.0"). */
  readonly runtime: string;
}

/** Um cassete carregado do disco, inteiro. */
export interface Cassete {
  readonly cabecalho: CabecalhoCassete;
  readonly resultado: ParcialResolvido;
  readonly procedencia: ProcedenciaCassete;
  readonly chamadas: readonly ChamadaGravada[];
  readonly volatil: VolatilCassete;
}

// ─── Caminhos ───────────────────────────────────────────────────────────────────

/** Diretorio de todos os cassetes de um estagio. */
export function diretorioDoEstagio(raiz: string, nome: string): string {
  return join(raiz, nome);
}

/** Diretorio de um cassete: `<raiz>/<nome>/<chave>`. */
export function diretorioDoCassete(
  raiz: string,
  nome: string,
  chave: string,
): string {
  return join(raiz, nome, chave);
}

/** Caminho do corpo de uma resposta gravada, por hash. */
export function caminhoDoCorpo(dirCassete: string, hash: string): string {
  return join(dirCassete, DIRETORIO_CORPOS, hash);
}

// ─── Serializacao canonica ──────────────────────────────────────────────────────

/**
 * Serializa em JSON canonico com quebra de linha final.
 *
 * Canonico = chaves ordenadas lexicograficamente, indentacao fixa de 2.
 * Sem isso, dois processos que escrevem o mesmo dado produzem bytes
 * diferentes e `just res:cassete` acusa uma divergencia que nao existe
 * — pior: acostuma todo mundo a ignorar o resultado do diff.
 */
export function serializarCanonico(valor: unknown): string {
  return JSON.stringify(ordenarProfundo(valor), null, 2) + "\n";
}

function ordenarProfundo(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarProfundo);
  if (valor !== null && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(valor as Record<string, unknown>).sort()) {
      const v = (valor as Record<string, unknown>)[chave];
      if (v === undefined) continue;
      saida[chave] = ordenarProfundo(v);
    }
    return saida;
  }
  return valor;
}

/** SHA-256 hexadecimal de um buffer. */
export function sha256(dados: Buffer | string): string {
  return createHash("sha256")
    .update(typeof dados === "string" ? Buffer.from(dados, "utf-8") : dados)
    .digest("hex");
}

// ─── Sanitizacao de credencial ──────────────────────────────────────────────────

/**
 * Headers que NUNCA entram num cassete com o valor real.
 *
 * Um cassete e versionado no repositorio. Uma chave de API dentro dele e
 * uma chave publicada — e o `git` nao esquece. A pergunta adversarial
 * dos cinco cards da W4 e literalmente "o cassete contem alguma
 * credencial?"; esta lista e a resposta executavel.
 */
export const HEADERS_SENSIVEIS: readonly string[] = [
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "api-key",
  "apikey",
  "x-auth-token",
  "x-access-token",
  "cookie",
  "set-cookie",
  "x-amz-security-token",
  "x-goog-api-key",
];

/** Marcador que substitui o valor de um header sensivel. */
export const VALOR_REDIGIDO = "[REDIGIDO]";

/**
 * Headers de RESPOSTA que nunca entram num cassete — nem redigidos:
 * removidos na gravacao.
 *
 * Classe AB-440/AB-473 (decidida no ADR-0026, card F2-07): headers que o
 * fornecedor devolve volateis a cada requisicao (`date`, `age`,
 * `x-request-id`, ...) e que, crus em `chamadas.json`, refutam o diff de
 * determinismo do estagio sem nenhum defeito dele. Remover NA GRAVACAO —
 * em vez de listar em CAMPOS_VOLATEIS — tem duas consequencias de
 * proposito:
 *
 *   1. o header nunca e versionado. Em particular `x-client-ip`
 *      (AB-475) e a PII do endereco de quem gravou: um whitelist de
 *      volateis manteria o IPv6 real no historico do git para sempre;
 *   2. a sonda negativa do diff continua dura: um header volátil que
 *      ESCAPA desta lista e nao esta em CAMPOS_VOLATEIS REFUTA o diff
 *      (e o teste de integracao fabrica um para exigir o vermelho).
 *
 * A lista e fechada por medicao real (amostras: cassetes de midia e
 * musica, 2026-08-13). Cada entrada: por que muda entre gravacoes.
 */
export const HEADERS_VOLATEIS: readonly string[] = [
  "date", // relogio do fornecedor
  "age", // idade de cache do CDN
  "server", // maquina/versao do provedor — troca com deploy e com a
  // instancia sorteada pelo balanceador
  "x-request-id", // id de requisicao unico por chamada
  "server-timing", // metricas do servidor (cache hit/miss, host sorteado)
  "x-search-id", // id de busca unico por chamada (Wikimedia)
  "x-cache", // "cp7001 miss, cp7001 pass" — estado de cache do CDN
  "x-cache-status", // pass/miss — estado de cache do CDN
  "x-client-ip", // AB-475: endereco de quem gravou (PII). O provedor o
  // devolve de volta (verificado em midia e musica); ele NAO pode ser
  // versionado nem como volátil-whitelisted
  "content-length", // tamanho do corpo — varia com re-encode/cache;
  // o replay o recomputa do corpo gravado
  "transfer-encoding", // chunked — detalhe de transporte do CDN
  "x-ratelimit-remaining", // contador de janela do rate limit (Wikimedia) —
  // descendo com cada requisicao do mesmo bucket
  "x-ratelimit-reset", // instante de reset da janela do rate limit
] as const;

/**
 * Remove os headers volateis de um conjunto de headers de resposta.
 *
 * Aplicado na GRAVACAO, depois de `sanitizarHeaders`, apenas aos headers
 * de resposta (os de requisicao sao nossos e estaveis). Chaves em
 * minuscula, como o resto do cassete.
 */
export function removerHeadersVolateis(
  headers: Readonly<Record<string, string>>,
): Record<string, string> {
  const volateis = new Set(HEADERS_VOLATEIS);
  const saida: Record<string, string> = {};
  for (const chave of Object.keys(headers).sort()) {
    if (volateis.has(chave.toLowerCase())) continue;
    saida[chave] = headers[chave] as string;
  }
  return saida;
}

/** Redige headers sensiveis, preservando os demais. Chaves em minuscula. */
export function sanitizarHeaders(
  headers: Readonly<Record<string, string>>,
): Record<string, string> {
  const sensiveis = new Set(HEADERS_SENSIVEIS);
  const saida: Record<string, string> = {};
  for (const chave of Object.keys(headers).sort()) {
    const minuscula = chave.toLowerCase();
    saida[minuscula] = sensiveis.has(minuscula)
      ? VALOR_REDIGIDO
      : (headers[chave] as string);
  }
  return saida;
}

/**
 * Remove credencial embutida na propria URL (`?api_key=`, `token=`,
 * `user:senha@host`). Provedor que exige chave em query string e comum,
 * e a URL vai inteira para `chamadas.json`.
 */
export function sanitizarUrl(url: string): string {
  let saida = url.replace(/\/\/[^/@\s]+:[^/@\s]+@/, `//${VALOR_REDIGIDO}@`);
  saida = saida.replace(
    /([?&](?:api[_-]?key|key|token|access[_-]?token|secret|signature|sig)=)[^&#\s]+/gi,
    `$1${VALOR_REDIGIDO}`,
  );
  return saida;
}

// ─── Validacao ──────────────────────────────────────────────────────────────────

/** Um problema encontrado num cassete. */
export interface ProblemaCassete {
  readonly codigo:
    | "CASSETE_AUSENTE"
    | "ARQUIVO_AUSENTE"
    | "LICENCA_AUSENTE"
    | "CREDENCIAL_VAZADA"
    | "FORMATO_INCOMPATIVEL"
    | "JSON_INVALIDO";
  readonly mensagem: string;
  readonly caminho: string;
}

/**
 * Valida a procedencia de um cassete.
 *
 * A regra que este validador existe para impor: `licenca` presente e
 * nao-vazia no topo E em cada asset. Ausencia de licenca nunca e um
 * aviso — e um erro.
 */
export function validarProcedencia(
  procedencia: unknown,
  caminho: string,
): ProblemaCassete[] {
  const problemas: ProblemaCassete[] = [];
  if (procedencia === null || typeof procedencia !== "object") {
    problemas.push({
      codigo: "JSON_INVALIDO",
      mensagem: "procedencia.json nao e um objeto",
      caminho,
    });
    return problemas;
  }
  const p = procedencia as Record<string, unknown>;

  if (typeof p.licenca !== "string" || p.licenca.trim() === "") {
    problemas.push({
      codigo: "LICENCA_AUSENTE",
      mensagem:
        "procedencia.licenca ausente ou vazia — todo cassete declara sob que " +
        "licenca o conteudo foi adquirido (∅-crit da W4)",
      caminho,
    });
  }

  if (typeof p.provedor !== "string" || p.provedor.trim() === "") {
    problemas.push({
      codigo: "JSON_INVALIDO",
      mensagem: "procedencia.provedor ausente ou vazio",
      caminho,
    });
  }

  const assets = p.assets;
  if (!Array.isArray(assets)) {
    problemas.push({
      codigo: "JSON_INVALIDO",
      mensagem: "procedencia.assets ausente (use [] quando nao ha asset)",
      caminho,
    });
    return problemas;
  }

  assets.forEach((asset, i) => {
    const a = asset as Record<string, unknown>;
    if (typeof a?.licenca !== "string" || a.licenca.trim() === "") {
      problemas.push({
        codigo: "LICENCA_AUSENTE",
        mensagem: `procedencia.assets[${i}].licenca ausente ou vazia`,
        caminho,
      });
    }
    if (typeof a?.hash !== "string" || !/^[0-9a-f]{64}$/.test(a.hash)) {
      problemas.push({
        codigo: "JSON_INVALIDO",
        mensagem: `procedencia.assets[${i}].hash nao e um SHA-256 hexadecimal`,
        caminho,
      });
    }
  });

  return problemas;
}

/**
 * Padroes de credencial que nao podem aparecer em nenhum byte do cassete.
 *
 * Complementa a redacao de headers: uma chave pode ter vazado no corpo
 * da resposta, num campo `notas`, ou numa URL que a sanitizacao nao
 * cobriu. C11: buscar so onde voce acha que a chave estaria nao e prova
 * de ausencia — entao a busca e no texto inteiro.
 */
export const PADROES_CREDENCIAL: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bsk-ant-[A-Za-z0-9_-]{8,}/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}/i,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret)"?\s*[:=]\s*"?[A-Za-z0-9_-]{16,}/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{20,}/,
];

/** Procura credencial em texto cru. Retorna os padroes que casaram. */
export function procurarCredencial(texto: string): string[] {
  const achados: string[] = [];
  for (const padrao of PADROES_CREDENCIAL) {
    const m = padrao.exec(texto);
    if (m) achados.push(m[0].slice(0, 24) + "…");
  }
  return achados;
}

// ─── Ponte com o store (F0-07) ──────────────────────────────────────────────────

/**
 * Procedencia no formato do store de conteudo.
 *
 * E o tipo do F0-07, reusado — nao uma copia. Uma copia divergiria no
 * primeiro campo que o F0-07 acrescentasse, e a divergencia so
 * apareceria numa auditoria de licenca, que e tarde.
 */
export type ProcedenciaDoStore = Procedencia;

/** Provedores que o store conhece (vocabulario fechado do F0-07). */
const PROVEDORES_DO_STORE: readonly ProvedorAsset[] = [
  "giphy",
  "tenor",
  "pexels",
  "pixabay",
  "openverse",
  "remotion-animated-emoji",
  "local",
  "manual",
  "unknown",
];

/**
 * Traduz o provedor livre do cassete para o vocabulario fechado do store.
 *
 * Provedor desconhecido vira `"unknown"` — mas o nome original NAO se
 * perde: ele vai para `notes`. Um provedor que some no mapeamento e uma
 * auditoria de licenca que nao consegue voltar a origem.
 */
function paraProvedorDoStore(provedor: string): {
  source: ProvedorAsset;
  rebaixado: boolean;
} {
  const conhecido = PROVEDORES_DO_STORE.find((p) => p === provedor);
  return conhecido !== undefined
    ? { source: conhecido, rebaixado: false }
    : { source: "unknown", rebaixado: true };
}

/**
 * Converte a procedencia de um asset do cassete para o formato do store.
 *
 * Existe para que os cinco cards da W4 nao precisem decidir, cada um por
 * conta, como mapear `licenca` → `license`. Cinco mapeamentos escritos
 * em paralelo divergem em pelo menos um campo — e o campo que diverge e
 * sempre o que ninguem testa.
 */
export function paraProcedenciaDoStore(
  asset: ProcedenciaAsset,
  cassete: ProcedenciaCassete,
): ProcedenciaDoStore {
  const { source, rebaixado } = paraProvedorDoStore(asset.provedor);
  const notas: string[] = [];
  if (cassete.notas !== undefined) notas.push(cassete.notas);
  if (rebaixado) notas.push(`provedor original: ${asset.provedor}`);

  const saida: ProcedenciaDoStore = {
    license: asset.licenca,
    attributionRequired: asset.atribuicaoObrigatoria,
    source,
    acquiredAt: cassete.adquiridoEm ?? new Date(0).toISOString(),
  };
  if (asset.atribuicao !== undefined) saida.attribution = asset.atribuicao;
  if (asset.idNoProvedor !== undefined) saida.sourceId = asset.idNoProvedor;
  if (asset.origem !== undefined) saida.fetchedFrom = asset.origem;
  if (cassete.ferramenta !== undefined) saida.toolVersion = cassete.ferramenta;
  if (notas.length > 0) saida.notes = notas.join(" | ");
  if (asset.termoDeBusca !== undefined) saida.searchTerm = asset.termoDeBusca;
  return saida;
}

// ─── Erros ──────────────────────────────────────────────────────────────────────

/**
 * O erro do ∅-crit: um estagio existe e o cassete dele nao.
 *
 * Este erro NUNCA vira aviso, nunca vira `skip`, nunca vira `continue`.
 * Estagio sem cassete pulado em silencio e uma suite offline que passa
 * sem exercitar nada — verde por ausencia, o modo de falha que este
 * projeto inteiro existe para nao ter.
 */
export class ECasseteAusente extends Error {
  readonly code = "CASSETE_AUSENTE";
  readonly estagio: string;
  readonly chave: string;
  readonly diretorio: string;

  constructor(estagio: string, chave: string, diretorio: string, detalhe?: string) {
    super(
      `∅-crit: estagio "${estagio}" nao tem cassete para a chave ${chave.slice(0, 16)}…\n` +
        `  esperado: ${diretorio}\n` +
        (detalhe ? `  detalhe:  ${detalhe}\n` : "") +
        `  Um estagio sem cassete NAO e pulado: ele derruba a suite offline.\n` +
        `  Grave rodando o orquestrador com modo: "gravacao" (com rede, a mao).\n` +
        `  Passo a passo: docs/contrato-estagio-resolucao.md, secao 6.`,
    );
    this.name = "ECasseteAusente";
    this.estagio = estagio;
    this.chave = chave;
    this.diretorio = diretorio;
  }
}

/** Erro de cassete invalido (existe mas esta quebrado). */
export class ECasseteInvalido extends Error {
  readonly code = "CASSETE_INVALIDO";
  readonly problemas: readonly ProblemaCassete[];

  constructor(diretorio: string, problemas: readonly ProblemaCassete[]) {
    super(
      `Cassete invalido em ${diretorio}:\n` +
        problemas.map((p) => `  [${p.codigo}] ${p.mensagem}`).join("\n"),
    );
    this.name = "ECasseteInvalido";
    this.problemas = problemas;
  }
}

/** Reexport de conveniencia para quem so importa este arquivo. */
export type { ComponentesChave, NomeEstagio };
