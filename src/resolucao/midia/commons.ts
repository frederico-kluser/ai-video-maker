/**
 * src/resolucao/midia/commons.ts
 *
 * Adaptador do Wikimedia Commons — o provedor elegivel implementado.
 *
 * Por que este e nao outro, na ordem em que as razoes pesam:
 *
 *   1. ELEGIVEL pela decisao de hotlink (ADR-0008). A politica do site
 *      diz que hotlink "is not recommended" — nao proibe, nao exige.
 *      Baixar e re-hospedar e o caminho recomendado, que e exatamente o
 *      unico que este pipeline consegue percorrer.
 *   2. SEM CREDENCIAL. A Action API do MediaWiki e publica. Isso torna a
 *      pergunta adversarial "o cassete contem alguma credencial?"
 *      respondivel por construcao: nao existe credencial neste estagio.
 *      Nao ha chave para vazar, nem header para redigir.
 *   3. LICENCA POR ARQUIVO, declarada na propria resposta. O adaptador
 *      LE a licenca de cada candidato; nao assume uma licenca do
 *      provedor. Arquivo com licenca que nao reconhecemos e DESCARTADO:
 *      "preciso checar" nao e licenca.
 *
 * O QUE ESTE ADAPTADOR CONSERTA DA RESPOSTA — e por que o conserto fica
 * aqui e nao na gravacao do cassete:
 *
 *   a) `extmetadata.AttributionRequired.value` vem como a STRING
 *      `"true"`/`"false"`, nao como booleano;
 *   b) `extmetadata.Artist.value` vem como HTML, com `<a href="//...">`
 *      — e `//` casa `PADRAO_URL`, ou seja, copiar isso para o manifesto
 *      resolvido violaria C7;
 *   c) `extmetadata.License.value` vem em minuscula e em vocabulario do
 *      Commons (`cc-by-sa-4.0`, `pd`), nao em identificador canonico;
 *   d) `extmetadata.License` as vezes simplesmente NAO EXISTE, mesmo com
 *      `LicenseShortName` preenchido.
 *
 *   Os quatro consertos rodam no ESTAGIO, e portanto tambem no replay.
 *   Se fossem feitos na hora de gravar, o cassete guardaria a resposta
 *   ja arrumada, o replay testaria a arrumacao em vez do estagio, e o
 *   dia em que o Commons mudasse o formato ninguem descobriria. Cassete
 *   e sosia, nao sucessor: o corpo gravado contem o HTML, a string
 *   `"true"` e o candidato sem licenca que este codigo descarta.
 */

import type { TipoMidia } from "../../contratos/manifesto.js";
import type {
  AdaptadorProvedor,
  CandidatoMidia,
  ContextoDeBusca,
} from "./politicas.js";

// ─── Constantes ─────────────────────────────────────────────────────────────────

/** Endpoint da Action API. Vive ACIMA da fronteira: nunca vai para o parcial. */
const ENDPOINT = "https://commons.wikimedia.org/w/api.php";

/**
 * User-Agent descritivo.
 *
 * A politica de etiqueta da Wikimedia exige identificacao; um cliente
 * anonimo pode ser barrado. Nao entra em `parametros` porque nao muda a
 * saida — muda apenas se a chamada e atendida.
 */
const AGENTE = "editor-video-ia/0.1 (resolucao de midia; card F2-04)";

/** Versao da API externa. Entra em `parametros` (contrato, secao 3). */
export const VERSAO_API_COMMONS = "mediawiki-action-api-2026-08";

/**
 * Vocabulario do Commons -> identificador canonico.
 *
 * Nao ha SPDX para dominio publico; `PDM-1.0` (Creative Commons Public
 * Domain Mark 1.0) e o identificador canonico mais proximo e o mesmo que
 * agregadores de conteudo aberto usam. A escolha esta registrada no
 * ledger (AB-436) porque "dominio publico" depende de jurisdicao e a
 * marca nao e uma licenca.
 */
const LICENCAS_CANONICAS: Readonly<Record<string, string>> = {
  cc0: "CC0-1.0",
  "cc0-1.0": "CC0-1.0",
  pd: "PDM-1.0",
  "pd-usgov": "PDM-1.0",
  "public domain": "PDM-1.0",
  "cc-by-2.0": "CC-BY-2.0",
  "cc-by-2.5": "CC-BY-2.5",
  "cc-by-3.0": "CC-BY-3.0",
  "cc-by-4.0": "CC-BY-4.0",
  "cc-by-sa-2.0": "CC-BY-SA-2.0",
  "cc-by-sa-2.5": "CC-BY-SA-2.5",
  "cc-by-sa-3.0": "CC-BY-SA-3.0",
  "cc-by-sa-4.0": "CC-BY-SA-4.0",
};

/** Licencas cujo default e exigir credito, quando o provedor nao diz. */
const FAMILIA_COM_ATRIBUICAO = /^CC-BY/;

/** Filtro de busca por tipo de midia, no dialeto do CirrusSearch. */
const FILTRO_POR_TIPO: Readonly<Record<TipoMidia, string>> = {
  imagem: "filetype:bitmap",
  gif: "filetype:bitmap",
  video: "filetype:video",
};

/** MIMEs aceitos por tipo de midia. Um `gif` que veio `image/png` nao serve. */
const MIMES_POR_TIPO: Readonly<Record<TipoMidia, readonly string[]>> = {
  imagem: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  gif: ["image/gif"],
  video: ["video/webm", "video/ogg", "video/mp4"],
};

// ─── Erros ──────────────────────────────────────────────────────────────────────

/**
 * Nenhum candidato sobreviveu aos filtros.
 *
 * A mensagem lista TODOS os candidatos e a razao de cada descarte. Um
 * "nao achei nada" sem denominador nao distingue "a busca voltou vazia"
 * de "voltou cinco e recusei os cinco" — e as duas coisas se consertam
 * de maneiras opostas.
 */
export class ENenhumCandidatoAceito extends Error {
  readonly code = "NENHUM_CANDIDATO_ACEITO";

  constructor(termo: string, avaliados: number, razoes: readonly string[]) {
    super(
      `Nenhum candidato aceito para "${termo}".\n` +
        `  candidatos avaliados: ${avaliados}\n` +
        (razoes.length > 0
          ? razoes.map((r) => `    descartado: ${r}`).join("\n") + "\n"
          : "    (a busca nao devolveu nenhum resultado)\n") +
        `  Amplie o termo, aumente limiteCandidatos, ou acrescente a licenca a\n` +
        `  parametros.licencasAceitas — depois de ler o que ela exige.`,
    );
    this.name = "ENenhumCandidatoAceito";
  }
}

/** A resposta do provedor nao tem a forma esperada. */
export class ERespostaInesperada extends Error {
  readonly code = "RESPOSTA_INESPERADA";

  constructor(detalhe: string) {
    super(
      `Resposta inesperada do Wikimedia Commons: ${detalhe}.\n` +
        `  O estagio nao "completa o que faltou": campo ausente e erro, porque um\n` +
        `  default inventado aqui viraria licenca inventada tres linhas abaixo.`,
    );
    this.name = "ERespostaInesperada";
  }
}

// ─── Normalizacao (roda no replay tambem) ───────────────────────────────────────

/** Converte a string `"true"`/`"false"` do provedor em booleano. */
export function booleanoDoProvedor(valor: string | undefined): boolean | undefined {
  if (valor === undefined) return undefined;
  const limpo = valor.trim().toLowerCase();
  if (limpo === "true") return true;
  if (limpo === "false") return false;
  return undefined;
}

/** Vocabulario do Commons -> identificador canonico, ou `undefined`. */
export function licencaCanonica(bruta: string): string | undefined {
  return LICENCAS_CANONICAS[bruta.trim().toLowerCase()];
}

/**
 * HTML do provedor -> texto puro, sem URL.
 *
 * Duas passadas de proposito. A primeira tira as tags; a segunda tira
 * qualquer resto que ainda pareca endereço. `PADRAO_URL` casa tambem
 * `//host`, e `<a href="//commons...">` e a forma que o Commons usa —
 * entao remover so `http://` deixaria a violacao de C7 passar.
 */
export function textoPuro(html: string): string {
  const semTag = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'");
  return semTag
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "")
    .replace(/(^|\s)\/\/\S+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Linha de credito no formato pedido pelo Commons, em texto puro. */
export function montarAtribuicao(
  autor: string,
  titulo: string,
  licencaCurta: string,
): string {
  const partes = [autor, titulo, licencaCurta, "via Wikimedia Commons"].filter(
    (p) => p.trim() !== "",
  );
  return partes.join(", ");
}

// ─── Forma da resposta ──────────────────────────────────────────────────────────

interface CampoExtmetadata {
  readonly value?: unknown;
}

interface ImageInfoCommons {
  readonly url?: string;
  readonly descriptionurl?: string;
  readonly thumburl?: string;
  readonly thumbwidth?: number;
  readonly thumbheight?: number;
  readonly mime?: string;
  readonly extmetadata?: Readonly<Record<string, CampoExtmetadata>>;
}

interface PaginaCommons {
  readonly pageid?: number;
  readonly title?: string;
  readonly imageinfo?: readonly ImageInfoCommons[];
}

interface RespostaCommons {
  readonly query?: { readonly pages?: readonly PaginaCommons[] };
}

function valorDe(
  extmetadata: Readonly<Record<string, CampoExtmetadata>> | undefined,
  campo: string,
): string | undefined {
  const valor = extmetadata?.[campo]?.value;
  return typeof valor === "string" ? valor : undefined;
}

// ─── URL da busca ───────────────────────────────────────────────────────────────

/**
 * Monta a URL da busca.
 *
 * Exportada porque o teste offline precisa provar que o estagio pede
 * EXATAMENTE a URL que o cassete gravou — e a unica forma de provar isso
 * sem rede e comparar as duas strings.
 */
export function urlDeBusca(ctx: ContextoDeBusca): string {
  const parametros = new URLSearchParams();
  parametros.set("action", "query");
  parametros.set("format", "json");
  parametros.set("formatversion", "2");
  parametros.set("generator", "search");
  parametros.set(
    "gsrsearch",
    `${ctx.termoDeBusca} ${FILTRO_POR_TIPO[ctx.tipoMidia]}`,
  );
  parametros.set("gsrnamespace", "6");
  parametros.set("gsrlimit", String(ctx.limiteCandidatos));
  parametros.set("prop", "imageinfo");
  parametros.set("iiprop", "url|size|mime|sha1|extmetadata");
  parametros.set("iiurlwidth", String(ctx.larguraAlvo));
  return `${ENDPOINT}?${parametros.toString()}`;
}

// ─── Adaptador ──────────────────────────────────────────────────────────────────

/**
 * Le um candidato da resposta. Devolve o candidato OU a razao do
 * descarte — nunca `null` mudo.
 */
function lerCandidato(
  pagina: PaginaCommons,
  ctx: ContextoDeBusca,
): { candidato: CandidatoMidia } | { descarte: string } {
  const titulo = pagina.title ?? "(sem titulo)";
  const info = pagina.imageinfo?.[0];
  if (info === undefined) return { descarte: `${titulo}: sem imageinfo` };

  const urlArquivo = info.thumburl ?? info.url;
  if (urlArquivo === undefined) {
    return { descarte: `${titulo}: sem thumburl nem url` };
  }

  const mime = info.mime ?? "";
  if (!MIMES_POR_TIPO[ctx.tipoMidia].includes(mime)) {
    return {
      descarte: `${titulo}: mime "${mime}" nao serve para tipo_midia "${ctx.tipoMidia}"`,
    };
  }

  // (c) e (d): a licenca vem em minuscula, em vocabulario do Commons, e
  // as vezes `License` nao existe. Sem identificador canonico o candidato
  // cai fora — nao ha default, porque default de licenca e passivo.
  const bruta =
    valorDe(info.extmetadata, "License") ??
    valorDe(info.extmetadata, "LicenseShortName") ??
    "";
  const licenca = licencaCanonica(bruta);
  if (licenca === undefined) {
    return {
      descarte: `${titulo}: licenca "${bruta || "(ausente)"}" nao reconhecida`,
    };
  }
  if (!ctx.licencasAceitas.includes(licenca)) {
    return { descarte: `${titulo}: licenca ${licenca} fora de licencasAceitas` };
  }

  // (a): a string "true"/"false" vira booleano. Quando o campo nao vem,
  // a familia da licenca decide — CC-BY* exige credito.
  const declarado = booleanoDoProvedor(
    valorDe(info.extmetadata, "AttributionRequired"),
  );
  const atribuicaoObrigatoria =
    declarado ?? FAMILIA_COM_ATRIBUICAO.test(licenca);

  // (b): o Artist vem em HTML com href="//..." — copiar isso para o
  // parcial violaria C7. `textoPuro` tira tag e endereço.
  const autor = textoPuro(valorDe(info.extmetadata, "Artist") ?? "");
  const licencaCurta = textoPuro(
    valorDe(info.extmetadata, "LicenseShortName") ?? licenca,
  );
  const atribuicao = atribuicaoObrigatoria
    ? montarAtribuicao(autor, titulo, licencaCurta)
    : undefined;

  return {
    candidato: {
      idNoProvedor: String(pagina.pageid ?? titulo),
      titulo,
      urlArquivo,
      urlDescricao: info.descriptionurl ?? "",
      mimeTypeDeclarado: mime,
      largura: info.thumbwidth ?? 0,
      altura: info.thumbheight ?? 0,
      licenca,
      licencaBruta: bruta,
      atribuicaoObrigatoria,
      ...(atribuicao !== undefined ? { atribuicao } : { atribuicao: undefined }),
    },
  };
}

/** O adaptador do Wikimedia Commons. */
export const adaptadorCommons: AdaptadorProvedor = {
  provedor: "wikimedia-commons",

  // `video` fica de fora com todas as letras. O caminho existiria, mas
  // nao foi exercitado contra o provedor, e "suportado mas nunca rodado"
  // e a forma mais cara de mentira nesta base. Ledger AB-434.
  tiposSuportados: ["imagem", "gif"],

  versaoApi: VERSAO_API_COMMONS,

  async buscarCandidatos(ctx: ContextoDeBusca): Promise<CandidatoMidia[]> {
    const resposta = await ctx.fetch(urlDeBusca(ctx), {
      headers: { "user-agent": AGENTE, accept: "application/json" },
    });
    if (!resposta.ok) {
      throw new ERespostaInesperada(`HTTP ${resposta.status} na busca`);
    }

    const corpo = (await resposta.json()) as RespostaCommons;
    const paginas = corpo.query?.pages;
    if (paginas !== undefined && !Array.isArray(paginas)) {
      throw new ERespostaInesperada("query.pages nao e uma lista (formatversion=2?)");
    }

    const aceitos: CandidatoMidia[] = [];
    const razoes: string[] = [];
    for (const pagina of paginas ?? []) {
      const leitura = lerCandidato(pagina, ctx);
      if ("candidato" in leitura) aceitos.push(leitura.candidato);
      else razoes.push(leitura.descarte);
    }

    if (aceitos.length === 0) {
      throw new ENenhumCandidatoAceito(
        ctx.termoDeBusca,
        (paginas ?? []).length,
        razoes,
      );
    }

    // Ordenacao explicita (AGENTS.md Regra 1). A ordem em que o motor de
    // busca devolveu e ranking, nao dado: ela muda sem o conteudo mudar.
    return aceitos.sort((a, b) => (a.titulo < b.titulo ? -1 : a.titulo > b.titulo ? 1 : 0));
  },
};
