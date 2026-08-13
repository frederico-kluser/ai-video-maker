/**
 * src/resolucao/musica/fornecedor.ts
 *
 * Cliente do fornecedor — e o lugar onde "sosia, nao sucessor" e decidido.
 *
 * O contrato (docs/contrato-estagio-resolucao.md §5) e explicito:
 *
 *   "Grave a resposta como ela veio. Se o estagio conserta algo da
 *    resposta (normaliza campo, preenche default), o conserto e do
 *    ESTAGIO e roda tambem no replay."
 *
 * A resposta deste fornecedor precisa de MUITO conserto, e por isso ele
 * e um bom teste da regra. O que vem no fio:
 *
 *   Artist  = '<a href="//commons.wikimedia.org/wiki/User:Amada44" …>Amada44</a>'
 *   Credit  = '<a … href="https://freesound.org/people/rhodesmas/…">https://…</a>'
 *   AttributionRequired = 'true'      ← a STRING "true", nao o booleano
 *   LicenseUrl          = 'https://creativecommons.org/licenses/by/3.0'
 *
 * Tres armadilhas de uma vez: HTML no meio do credito, URL no TEXTO (nao
 * so no href — strip de tag nao basta), e booleano que chega como
 * string. Nenhuma delas pode ser consertada na hora de gravar: se fosse,
 * `corpos/<sha256>` guardaria a versao limpa, o replay leria limpo, e o
 * codigo de limpeza deixaria de ser exercitado exatamente no dia em que
 * quebrasse. Aqui a limpeza e funcao pura, roda depois do fetch, e roda
 * de novo identica quando a resposta vem do cassete.
 *
 * A escolha deste fornecedor tem uma razao que outros candidatos nao
 * atendiam — ver `docs/adr/0012-musica-e-efeitos.md`:
 *   - a Action API **nao usa credencial**: nao ha chave para vazar no
 *     cassete, nem em header nem em query string;
 *   - `LicenseShortName` e um NOME ("CC BY 3.0"), e a URL do deed vem
 *     num campo separado. Na API do Freesound o campo `license` e a
 *     *deed URL*, e `licenca: resposta.license` poria uma URL abaixo da
 *     fronteira — que o schema rejeita.
 */

import { PADRAO_URL } from "../manifesto-resolvido.js";
import { PROVEDOR } from "./pacote.js";

// ─── Endereco do fornecedor ─────────────────────────────────────────────────────

/**
 * Endpoint da Action API.
 *
 * Esta URL vive em `src/`, ACIMA da fronteira, e nunca e copiada para
 * dentro de `ParcialResolvido`. E o unico endereco que este modulo
 * conhece: todos os demais chegam pela resposta do fornecedor.
 */
export const ENDPOINT_API = "https://commons.wikimedia.org/w/api.php";

/**
 * Versao da API externa. Entra em `parametros` e portanto na chave.
 *
 * O contrato manda incluir a versao da ferramenta externa ("manim
 * 0.18.1", "ffmpeg 7.1"). Aqui a ferramenta externa e a API: se o
 * fornecedor mudar o formato de `extmetadata`, a saida muda, e sem este
 * componente na chave o cassete velho continuaria valendo.
 */
export const VERSAO_API_EXTERNA = "mediawiki-action-api-formatversion-2";

/**
 * User-Agent enviado ao fornecedor.
 *
 * A politica do fornecedor exige um agente identificavel. Nao e
 * credencial: e um rotulo publico, e vai gravado no cassete de proposito
 * — quem auditar precisa saber com que identidade o byte foi pedido.
 */
export const USER_AGENT = "ai-video-maker/0.1 (projeto pessoal; estagio de resolucao musica)";

// ─── Formato bruto ──────────────────────────────────────────────────────────────

/** Um valor de `extmetadata`, como o fornecedor o envia. */
interface ValorExtMetadata {
  readonly value?: unknown;
}

/** `imageinfo[0]` cru. */
interface ImageInfoBruto {
  readonly url?: unknown;
  readonly descriptionurl?: unknown;
  readonly mime?: unknown;
  readonly size?: unknown;
  readonly sha1?: unknown;
  readonly duration?: unknown;
  readonly extmetadata?: Readonly<Record<string, ValorExtMetadata>>;
}

/** Uma pagina da resposta. */
interface PaginaBruta {
  readonly title?: unknown;
  readonly missing?: unknown;
  readonly imageinfo?: readonly ImageInfoBruto[];
}

/** A resposta inteira, em `formatversion=2`. */
interface RespostaBruta {
  readonly query?: {
    readonly pages?: readonly PaginaBruta[];
    readonly normalized?: readonly { readonly from?: unknown; readonly to?: unknown }[];
  };
}

// ─── Formato normalizado ────────────────────────────────────────────────────────

/**
 * Um arquivo do fornecedor, ja normalizado.
 *
 * Repare na separacao: `urlDownload` e `urlDeed` sao URL e ficam acima
 * da fronteira (vao para a procedencia). `licenca`, `atribuicao` e
 * `autor` sao texto sem URL e podem descer.
 */
export interface ArquivoDoFornecedor {
  /** Titulo pedido ao fornecedor. Identificador, nao endereco. */
  readonly titulo: string;

  /** Nome legivel da obra (o "T" de TASL). Sem URL. */
  readonly nomeDaObra: string;

  /** Autor em texto puro (o "A" de TASL). Sem URL. */
  readonly autor: string;

  /** Nome da licenca (o "L" de TASL), ex.: "CC BY 3.0", "CC0". Sem URL. */
  readonly licenca: string;

  /** Se a licenca exige atribuicao, ja convertido de string para booleano. */
  readonly atribuicaoObrigatoria: boolean;

  /** MIME declarado pelo fornecedor. */
  readonly mime: string;

  /** Tamanho em bytes declarado pelo fornecedor. */
  readonly bytes: number;

  /** Duracao em segundos declarada pelo fornecedor. */
  readonly duracaoSegundos: number;

  /** SHA-1 do arquivo, declarado pelo fornecedor. Oraculo independente. */
  readonly sha1Declarado: string;

  /** URL de download. ACIMA da fronteira: vai para procedencia.origem. */
  readonly urlDownload: string;

  /** URL da pagina de descricao. ACIMA da fronteira. */
  readonly urlDescricao: string;

  /** URL do deed da licenca. ACIMA da fronteira. */
  readonly urlDeed: string;
}

// ─── Limpeza de texto ───────────────────────────────────────────────────────────

const ENTIDADES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&nbsp;/g, " "],
  [/&quot;/g, '"'],
  [/&#0*39;/g, "'"],
  [/&apos;/g, "'"],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  // `&amp;` por ultimo: senao `&amp;lt;` viraria `<` em duas passadas.
  [/&amp;/g, "&"],
];

/**
 * Transforma um campo de credito do fornecedor em texto puro sem URL.
 *
 * Por que tirar tag NAO basta: num dos itens do pacote o texto do link
 * E a URL (`<a href="https://…">https://…</a>`). Removendo so as tags,
 * sobra a URL — e ela desceria para o manifesto resolvido, onde
 * `$defs.SemURLProfundo` a rejeita. Por isso ha duas fases: tirar
 * marcacao e depois tirar qualquer token que ainda pareca endereco,
 * inclusive URL relativa a protocolo (`//host/...`), que e o caso do
 * item "campainha".
 */
export function limparTextoDoProvedor(bruto: unknown): string {
  if (typeof bruto !== "string") return "";
  let texto = bruto;

  // 1. marcacao
  texto = texto.replace(/<[^>]*>/g, " ");
  for (const [padrao, substituto] of ENTIDADES) texto = texto.replace(padrao, substituto);

  // 2. enderecos que sobraram no proprio texto
  texto = texto.replace(/\S*:\/\/\S*/g, " ");
  texto = texto.replace(/(^|\s)\/\/\S*/g, " ");
  texto = texto.replace(/(^|\s)www\.\S*/gi, " ");

  // 3. pontuacao orfa deixada pela remocao, e espacos.
  //    CUIDADO com o ';' final: ele pode ser o fechamento de uma entidade
  //    decodificada em duas passadas (`&amp;lt;` -> `&lt;`). Rouba-lo
  //    deixaria `&lt;b&gt` sem fechamento — o teste "decodifica entidades
  //    sem criar tag por acidente" existe para pegar exatamente isto.
  texto = texto.replace(/\s+/g, " ").trim();
  texto = texto.replace(/^[\s,;:.\-–—|()[\]]+/, "");
  if (!/&[a-zA-Z0-9#]+;$/.test(texto)) {
    texto = texto.replace(/[\s,;:\-–—|]+$/, "");
  }
  return texto.trim();
}

/**
 * Converte o booleano-como-string do fornecedor.
 *
 * `AttributionRequired` chega como `'true'` / `'false'`. O default e o
 * conservador: qualquer coisa que nao seja explicitamente `'false'`
 * conta como atribuicao exigida. Errar para o lado de creditar demais
 * custa uma linha nos creditos; errar para o outro lado e violacao de
 * licenca.
 */
export function ehAtribuicaoObrigatoria(bruto: unknown): boolean {
  if (typeof bruto === "boolean") return bruto;
  if (typeof bruto !== "string") return true;
  return bruto.trim().toLowerCase() !== "false";
}

// ─── Erros ──────────────────────────────────────────────────────────────────────

/** O fornecedor respondeu, mas a resposta nao serve. */
export class ERespostaDoFornecedor extends Error {
  readonly code = "RESPOSTA_DO_FORNECEDOR";
  constructor(mensagem: string) {
    super(`Fornecedor ${PROVEDOR}: ${mensagem}`);
    this.name = "ERespostaDoFornecedor";
  }
}

// ─── Montagem da requisicao ─────────────────────────────────────────────────────

/**
 * Monta a URL de consulta ao catalogo.
 *
 * Deterministica por construcao: os titulos entram ordenados e a ordem
 * dos parametros e fixa. Se a URL dependesse da ordem dos nos do
 * manifesto, dois manifestos com os mesmos nos embaralhados gravariam
 * cassetes diferentes — e o replay de um nao serviria para o outro.
 */
export function urlDoCatalogo(titulos: readonly string[]): string {
  const ordenados = [...titulos].sort();
  const parametros = new URLSearchParams([
    ["action", "query"],
    ["format", "json"],
    ["formatversion", "2"],
    ["prop", "imageinfo"],
    ["iiprop", "url|mime|size|sha1|extmetadata"],
    ["titles", ordenados.join("|")],
  ]);
  return `${ENDPOINT_API}?${parametros.toString()}`;
}

// ─── Normalizacao ───────────────────────────────────────────────────────────────

function texto(em: Readonly<Record<string, ValorExtMetadata>>, campo: string): string {
  return limparTextoDoProvedor(em[campo]?.value);
}

function urlCrua(valor: unknown, campo: string, titulo: string): string {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new ERespostaDoFornecedor(`"${titulo}" veio sem ${campo}.`);
  }
  return valor;
}

/**
 * Converte UMA pagina bruta no formato normalizado.
 *
 * Exportada porque e ela que o teste de "sosia, nao sucessor" roda
 * contra os bytes crus gravados em `corpos/`: se aplicar esta funcao ao
 * corpo do cassete nao reproduzir `resultado.json`, entao algo foi
 * consertado na gravacao e o replay parou de testar o estagio.
 */
export function normalizarPagina(pagina: PaginaBruta): ArquivoDoFornecedor {
  const titulo = typeof pagina.title === "string" ? pagina.title : "(sem titulo)";

  if (pagina.missing === true || pagina.imageinfo === undefined) {
    throw new ERespostaDoFornecedor(
      `"${titulo}" nao existe no fornecedor (missing). O pacote referencia um ` +
        `arquivo que sumiu ou foi renomeado — corrija o catalogo e bumpe VERSAO_DO_PACOTE.`,
    );
  }

  const ii = pagina.imageinfo[0];
  if (ii === undefined) {
    throw new ERespostaDoFornecedor(`"${titulo}" veio com imageinfo vazio.`);
  }
  const em = ii.extmetadata ?? {};

  const licenca = texto(em, "LicenseShortName");
  if (licenca === "") {
    // O ∅-crit da W4 comeca aqui, e nao no gravador: um asset sem
    // licenca declarada PELO FORNECEDOR nao vira asset. E mais barato
    // trocar de efeito do que descobrir o passivo depois do render.
    throw new ERespostaDoFornecedor(
      `"${titulo}" nao declara licenca (extmetadata.LicenseShortName vazio). ` +
        `"Preciso checar" nao e licenca: o item nao entra.`,
    );
  }

  const autor = texto(em, "Artist");
  const nomeDaObra = texto(em, "ObjectName") || titulo.replace(/^File:/, "");
  const atribuicaoObrigatoria = ehAtribuicaoObrigatoria(em["AttributionRequired"]?.value);

  if (atribuicaoObrigatoria && autor === "") {
    throw new ERespostaDoFornecedor(
      `"${titulo}" exige atribuicao e nao declara autor utilizavel. ` +
        `Um credito obrigatorio que ninguem consegue escrever e uma violacao com data marcada.`,
    );
  }

  const duracao = typeof ii.duration === "number" ? ii.duration : 0;
  const bytes = typeof ii.size === "number" ? ii.size : 0;
  const sha1 = typeof ii.sha1 === "string" ? ii.sha1 : "";
  const mime = typeof ii.mime === "string" ? ii.mime : "application/octet-stream";

  return {
    titulo,
    nomeDaObra,
    autor,
    licenca,
    atribuicaoObrigatoria,
    mime,
    bytes,
    duracaoSegundos: duracao,
    sha1Declarado: sha1,
    urlDownload: urlCrua(ii.url, "url", titulo),
    urlDescricao: urlCrua(ii.descriptionurl, "descriptionurl", titulo),
    urlDeed: typeof em["LicenseUrl"]?.value === "string" ? em["LicenseUrl"].value : "",
  };
}

/**
 * Converte a resposta inteira num mapa titulo -> arquivo.
 *
 * Indexado por titulo, NUNCA por posicao: em `formatversion=2` o
 * fornecedor devolve `pages` como array e a ordem nao acompanha a ordem
 * de `titles` (verificado: um pedido de tres titulos volta com o
 * terceiro na frente). Ler por posicao daria um estagio que troca os
 * efeitos de lugar de vez em quando — nao-determinismo que passa em
 * qualquer teste que so conte assets.
 */
export function normalizarCatalogo(
  bruto: unknown,
  titulosPedidos: readonly string[],
): ReadonlyMap<string, ArquivoDoFornecedor> {
  const resposta = bruto as RespostaBruta;
  const paginas = resposta?.query?.pages;
  if (!Array.isArray(paginas)) {
    throw new ERespostaDoFornecedor(
      "resposta sem query.pages — a API mudou de formato ou devolveu erro.",
    );
  }

  // O fornecedor pode normalizar o titulo pedido (espaco -> underscore).
  // Sem esta ponte, um titulo normalizado viraria "arquivo ausente".
  const dePara = new Map<string, string>();
  for (const n of resposta.query?.normalized ?? []) {
    if (typeof n.from === "string" && typeof n.to === "string") dePara.set(n.from, n.to);
  }

  const porTitulo = new Map<string, ArquivoDoFornecedor>();
  for (const pagina of paginas) {
    const arquivo = normalizarPagina(pagina);
    porTitulo.set(arquivo.titulo, arquivo);
  }

  const saida = new Map<string, ArquivoDoFornecedor>();
  for (const pedido of [...titulosPedidos].sort()) {
    const chave = dePara.get(pedido) ?? pedido;
    const arquivo = porTitulo.get(chave);
    if (arquivo === undefined) {
      throw new ERespostaDoFornecedor(
        `"${pedido}" foi pedido e nao voltou na resposta ` +
          `(voltaram: ${[...porTitulo.keys()].sort().join(", ") || "nenhum"}).`,
      );
    }
    saida.set(pedido, arquivo);
  }
  return saida;
}

// ─── Atribuicao ─────────────────────────────────────────────────────────────────

/**
 * Monta o credito que ATRAVESSA a fronteira — o pedaco sem URL.
 *
 * Modelo TASL (Title, Author, Source, License), do wiki da Creative
 * Commons. Tres das quatro letras cabem aqui; **o "S" nao cabe**, e essa
 * e a descoberta que este card publica para F3-05 e F5-06:
 *
 *   CC BY 4.0, secao 3(a)(1)(E), exige "a URI or hyperlink to the
 *   Licensed Material to the extent reasonably practicable". Ou seja: o
 *   credito juridicamente completo CONTEM uma URI. E
 *   `$defs.TextoSemURL` do manifesto resolvido proibe URL no campo
 *   `atribuicao`. As duas exigencias sao verdadeiras e incompativeis no
 *   mesmo campo.
 *
 *   A saida nao e escolher uma: e a propria secao 3(a)(2), que permite
 *   satisfazer 3(a)(1) "by providing a URI or hyperlink to a resource
 *   that includes the required information". Entao o credito e partido:
 *   T+A+L descem em `assets[].atribuicao`, e S (urlDescricao,
 *   urlDownload, urlDeed) fica em `procedencia`, acima da fronteira.
 *   Quem publica o video (F5-06) junta os dois de novo.
 *
 * Nunca devolve URL: o resultado passa por uma checagem contra
 * PADRAO_URL antes de sair. Se um campo novo do fornecedor trouxer
 * endereco por um caminho que a limpeza nao previu, isto estoura aqui —
 * e nao tres camadas abaixo, na validacao de schema, onde a mensagem
 * seria "algo em algum lugar tem uma URL".
 */
export function atribuicaoSemURL(arquivo: ArquivoDoFornecedor): string {
  const partes: string[] = [];
  if (arquivo.nomeDaObra !== "") partes.push(`"${arquivo.nomeDaObra}"`);
  if (arquivo.autor !== "") partes.push(`por ${arquivo.autor}`);
  partes.push(`sob ${arquivo.licenca}`);
  const credito = partes.join(" ");

  if (PADRAO_URL.test(credito)) {
    throw new ERespostaDoFornecedor(
      `o credito montado para "${arquivo.titulo}" contem URL: ${credito}\n` +
        `  O manifesto resolvido nao aceita URL em nenhuma profundidade ` +
        `($defs.SemURLProfundo). A URL vai para procedencia.origem, nunca para atribuicao.`,
    );
  }
  return credito;
}
