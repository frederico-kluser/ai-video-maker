/**
 * src/resolucao/midia/politicas.ts
 *
 * A DECISAO DE HOTLINK, como dado — nao como `if` no meio do downloader.
 *
 * O card F2-04 comeca com um conflito de termos de uso: um provedor
 * EXIGE hotlink (servir o arquivo a partir do servidor dele) e outro o
 * PROIBE (baixar e re-hospedar). Os dois nao podem valer ao mesmo tempo,
 * e a escolha nao e do downloader: ela decide se o downloader existe.
 *
 * A decisao esta em `docs/adr/0013-hotlink-e-midia-externa.md`:
 *
 *   BAIXAR E RE-HOSPEDAR. Hotlink nunca. Provedor que EXIGE hotlink e
 *   inelegivel — nao por licenca, mas por arquitetura.
 *
 * As tres razoes, em uma linha cada:
 *
 *   1. C7 / schema — `schema/manifesto-resolvido.schema.json` aplica
 *      `$defs.SemURLProfundo` na raiz: nenhuma URL atravessa a fronteira
 *      de determinismo, em nenhuma profundidade. Um asset hotlinkado E
 *      uma URL viva no momento do render. Nao ha como expressa-lo.
 *   2. Enderecamento por conteudo — o pipeline referencia asset por
 *      SHA-256 dos bytes. Nao se hasheia o que nao se tem.
 *   3. Render offline — `res-offline` fecha a rede no kernel. Um asset
 *      hotlinkado faria o render depender de um terceiro vivo, e o teste
 *      de "render 2x, bytes identicos" passaria a medir o servidor
 *      alheio.
 *
 * O QUE ESTA TABELA IMPOE, e como:
 *
 *   Um provedor com `politicaHotlink: "exige"` NAO TEM `adaptador`. O
 *   mecanismo nao e a checagem — e a AUSENCIA de codigo capaz de baixar
 *   dele. A checagem (`exigirProvedorElegivel`) existe para dar
 *   diagnostico, nao para ser a barreira. Uma barreira que e um `if`
 *   some quando alguem apaga o `if`; uma barreira que e a inexistencia
 *   do adaptador exige escrever o adaptador para desaparecer.
 *
 * O ENQUADRAMENTO DE USO NAO RESOLVE ISTO. `docs/adr/0003-enquadramento-de-uso.md`
 * decidiu uso PESSOAL, e isso muda o que a LICENCA DE CONTEUDO permite.
 * A obrigacao de hotlink do Unsplash e da GIPHY nao esta na licenca de
 * conteudo: esta no CONTRATO DE API, que vale para qualquer uso, pessoal
 * ou nao. Uso pessoal nao isenta. Ver ADR-0013, secao "Revisao adversarial".
 */

import type { TipoMidia } from "../../contratos/manifesto.js";

// ─── Politica ───────────────────────────────────────────────────────────────────

/**
 * O que os termos do provedor dizem sobre hotlink.
 *
 * `desencoraja` e `silente` sao categorias separadas de proposito:
 * "nao recomendado" e uma frase que existe no documento; "silente" e uma
 * busca negativa, que e evidencia mais fraca (C11) e esta rotulada como
 * tal para nao virar "permitido" por descuido.
 */
export type PoliticaHotlink = "exige" | "proibe" | "desencoraja" | "silente";

/** Onde a obrigacao mora. Muda quem ela alcanca. */
export type FonteDaObrigacao = "contrato-de-api" | "licenca-de-conteudo" | "politica-do-site";

/**
 * O que o programa sabe sobre um provedor de midia — com citacao.
 *
 * `citacao` e a frase literal do documento. Sem ela isto seria uma
 * opiniao sobre termos de uso, que e o tipo de coisa que ninguem
 * consegue auditar seis meses depois.
 */
export interface PoliticaDeProvedor {
  /** Identificador do provedor. Entra em `parametros.provedor` e na chave. */
  readonly provedor: string;

  /** O que os termos dizem sobre hotlink. */
  readonly politicaHotlink: PoliticaHotlink;

  /** Onde a obrigacao mora: contrato de API alcanca tambem uso pessoal. */
  readonly fonteDaObrigacao: FonteDaObrigacao;

  /** Documento consultado. Vive ACIMA da fronteira — e doc, nao caminho de leitura. */
  readonly documento: string;

  /** Frase literal do documento. Nunca parafrase. */
  readonly citacao: string;

  /** Data de consulta do documento (ISO-8601, so o dia). */
  readonly consultadoEm: string;

  /** Se a chamada exige credencial. */
  readonly exigeCredencial: boolean;

  /** Se o provedor exige atribuicao visivel. */
  readonly atribuicaoObrigatoria: boolean;

  /** Ressalva que muda a leitura da politica. */
  readonly ressalva?: string;
}

// ─── A tabela ───────────────────────────────────────────────────────────────────

/**
 * Provedores conhecidos e o que os termos deles dizem.
 *
 * Acrescentar provedor aqui e barato; a checagem de elegibilidade e
 * derivada, nunca redigitada. NAO existe nenhuma assercao neste card
 * sobre esta tabela ser COMPLETA: as invariantes sao universais ("todo
 * provedor que exige hotlink nao tem adaptador"), que continuam
 * verdadeiras quando alguem acrescenta a decima entrada.
 */
export const POLITICAS_DE_PROVEDOR: readonly PoliticaDeProvedor[] = [
  {
    provedor: "unsplash",
    politicaHotlink: "exige",
    fonteDaObrigacao: "contrato-de-api",
    documento: "unsplash.com/api-terms (secao 6, Image Interaction Data)",
    citacao:
      "you must directly use or embed the related image URLs returned by the API " +
      'in your Developer Apps (generally referred to as "hotlinking") in accordance ' +
      "with the API Guidelines. [...] Failure to do any of the foregoing in this " +
      "Section 6 will constitute a material breach of these API Terms.",
    consultadoEm: "2026-08-11",
    exigeCredencial: true,
    atribuicaoObrigatoria: true,
    ressalva:
      "A Unsplash License dispensa atribuicao; as API Guidelines a exigem. " +
      "A obrigacao vem do contrato de API, entao uso pessoal nao isenta.",
  },
  {
    provedor: "giphy",
    politicaHotlink: "exige",
    fonteDaObrigacao: "contrato-de-api",
    documento: "developers.giphy.com/docs/api/",
    citacao:
      "GIPHY media should be loaded directly from the media URLs returned by the " +
      "API and should not be cached, proxied, rewritten, or stored by the partner.",
    consultadoEm: "2026-08-11",
    exigeCredencial: true,
    atribuicaoObrigatoria: true,
    ressalva:
      'Exige tambem "Powered By GIPHY" visivel. Ja preterida por ADR-0003 D3, ' +
      "por razoes independentes (limite de 100 req/h e zona cinzenta juridica). " +
      "Aqui a exclusao e de outra natureza: arquitetural, e vale mesmo se D3 mudar.",
  },
  {
    provedor: "pixabay",
    politicaHotlink: "proibe",
    fonteDaObrigacao: "contrato-de-api",
    documento: "pixabay.com/api/docs/ (secao Hotlinking)",
    citacao:
      "Returned image URLs may be used for temporarily displaying search results. " +
      "However, permanent hotlinking of images (using Pixabay URLs in your app) is " +
      "not allowed. If you intend to use the images, please download them to your " +
      "server first.",
    consultadoEm: "2026-08-11",
    exigeCredencial: true,
    atribuicaoObrigatoria: false,
    ressalva:
      "A proibicao e de IMAGENS. Para VIDEO o mesmo documento diz o contrario " +
      '("Videos may be embedded directly in your applications. Yet, we recommend ' +
      'storing them on your server."). Baixar e re-hospedar satisfaz os dois casos. ' +
      "A proibicao NAO esta nos Termos de Servico, e sim na documentacao da API.",
  },
  {
    provedor: "pexels",
    politicaHotlink: "silente",
    fonteDaObrigacao: "contrato-de-api",
    documento: "pexels.com/api/documentation/ e pexels.com/terms-of-service/",
    citacao:
      "(busca negativa: nenhuma ocorrencia de hotlink, framing, embedding ou " +
      "caching nos dois documentos, em 2026-08-11)",
    consultadoEm: "2026-08-11",
    exigeCredencial: true,
    atribuicaoObrigatoria: true,
    ressalva:
      "Silencio apurado por busca negativa, que nao e prova de ausencia (C11). " +
      "Elegivel, mas reverificar antes de virar provedor primario. " +
      'A API exige "prominent link to Pexels" e credito ao fotografo.',
  },
  {
    provedor: "wikimedia-commons",
    politicaHotlink: "desencoraja",
    fonteDaObrigacao: "politica-do-site",
    documento: "commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia",
    citacao:
      'Directly using a Commons file via embedding its URL ("hotlinking") is also ' +
      "possible, but is not recommended.",
    consultadoEm: "2026-08-11",
    exigeCredencial: false,
    atribuicaoObrigatoria: true,
    ressalva:
      "A licenca e POR ARQUIVO (CC0, PD, CC BY, CC BY-SA), nao do provedor. " +
      "A atribuicao tambem: um arquivo PD nao exige credito, um CC BY exige. " +
      "Por isso o adaptador le a licenca de cada candidato em vez de assumir uma.",
  },
];

// ─── Consulta ───────────────────────────────────────────────────────────────────

/** Politica de um provedor, ou `undefined` se ele nao esta na tabela. */
export function politicaDe(provedor: string): PoliticaDeProvedor | undefined {
  return POLITICAS_DE_PROVEDOR.find((p) => p.provedor === provedor);
}

/**
 * A regra, em uma funcao: quem EXIGE hotlink e inelegivel.
 *
 * `desencoraja` e `silente` sao elegiveis: nenhum dos dois obriga a
 * servir do servidor do provedor, que e a unica coisa que este pipeline
 * nao consegue fazer.
 */
export function ehElegivel(politica: PoliticaDeProvedor): boolean {
  return politica.politicaHotlink !== "exige";
}

// ─── Erros ──────────────────────────────────────────────────────────────────────

/**
 * O provedor pedido exige hotlink.
 *
 * Este erro e lancado ANTES de qualquer chamada de rede — a decisao
 * precede o download, que e literalmente o enunciado do card.
 */
export class EProvedorExigeHotlink extends Error {
  readonly code = "PROVEDOR_EXIGE_HOTLINK";
  readonly provedor: string;

  constructor(politica: PoliticaDeProvedor) {
    super(
      `Provedor "${politica.provedor}" exige hotlink e por isso e inelegivel.\n` +
        `  Termos (${politica.documento}, consultado em ${politica.consultadoEm}):\n` +
        `    "${politica.citacao}"\n` +
        `  Este pipeline nao consegue hotlinkar: nenhuma URL atravessa a fronteira\n` +
        `  de determinismo (schema/manifesto-resolvido.schema.json, SemURLProfundo),\n` +
        `  todo asset e endereçado por SHA-256, e o render roda com a rede fechada.\n` +
        `  Baixar deste provedor violaria os termos dele; hotlinkar violaria o\n` +
        `  contrato do pipeline. A saida e trocar de provedor, nao afrouxar nenhum\n` +
        `  dos dois. Ver docs/adr/0013-hotlink-e-midia-externa.md.`,
    );
    this.name = "EProvedorExigeHotlink";
    this.provedor = politica.provedor;
  }
}

/** Provedor que nao esta na tabela de politicas. */
export class EProvedorDesconhecido extends Error {
  readonly code = "PROVEDOR_DESCONHECIDO";

  constructor(provedor: string) {
    super(
      `Provedor "${provedor}" nao tem politica de hotlink declarada em ` +
        `src/resolucao/midia/politicas.ts.\n` +
        `  Um provedor sem politica declarada nao e "provavelmente ok": e um\n` +
        `  provedor cujos termos ninguem leu. Acrescente a entrada com a CITACAO\n` +
        `  literal do documento e a data de consulta antes de usa-lo.`,
    );
    this.name = "EProvedorDesconhecido";
  }
}

/** Provedor elegivel, mas sem adaptador implementado neste repositorio. */
export class EProvedorSemAdaptador extends Error {
  readonly code = "PROVEDOR_SEM_ADAPTADOR";

  constructor(provedor: string, disponiveis: readonly string[]) {
    super(
      `Provedor "${provedor}" e elegivel, mas nao ha adaptador implementado.\n` +
        `  Adaptadores disponiveis: ${disponiveis.join(", ") || "(nenhum)"}.\n` +
        `  Elegivel e implementado sao coisas diferentes: a primeira e uma leitura\n` +
        `  dos termos, a segunda e codigo escrito.`,
    );
    this.name = "EProvedorSemAdaptador";
  }
}

// ─── Guarda ─────────────────────────────────────────────────────────────────────

/**
 * Exige que o provedor esteja na tabela E seja elegivel.
 *
 * Chamado no comeco de `resolver()`, antes de qualquer `fetch`. E um
 * diagnostico, nao a barreira: a barreira e nao existir adaptador para
 * provedor que exige hotlink (ver `ADAPTADORES` em `adaptadores.ts` e o
 * teste que amarra as duas coisas).
 */
export function exigirProvedorElegivel(provedor: string): PoliticaDeProvedor {
  const politica = politicaDe(provedor);
  if (politica === undefined) throw new EProvedorDesconhecido(provedor);
  if (!ehElegivel(politica)) throw new EProvedorExigeHotlink(politica);
  return politica;
}

// ─── Adaptador ──────────────────────────────────────────────────────────────────

/** Contexto de uma busca no provedor. Tudo que muda o resultado esta aqui. */
export interface ContextoDeBusca {
  /** O `fetch` do contrato. NUNCA `globalThis.fetch`. */
  readonly fetch: typeof fetch;
  /** Termo de busca, vindo do manifesto. */
  readonly termoDeBusca: string;
  /** Tipo de midia pedido pelo no. */
  readonly tipoMidia: TipoMidia;
  /** Largura alvo do arquivo a baixar, em pixels. */
  readonly larguraAlvo: number;
  /** Quantos candidatos pedir ao provedor. */
  readonly limiteCandidatos: number;
  /** Licencas canonicas aceitas. Candidato fora da lista e descartado. */
  readonly licencasAceitas: readonly string[];
}

/**
 * Um candidato devolvido pelo provedor, ja normalizado.
 *
 * `licencaBruta` fica ao lado de `licenca` de proposito: o cassete grava
 * a resposta como ela veio (sosia), e a normalizacao roda tambem no
 * replay. Guardar as duas torna a normalizacao auditavel sem abrir o
 * corpo bruto.
 */
export interface CandidatoMidia {
  /** Id do asset no provedor. */
  readonly idNoProvedor: string;
  /** Titulo/nome do arquivo no provedor. Ordenacao deterministica usa isto. */
  readonly titulo: string;
  /** URL do arquivo a baixar. Vive ACIMA da fronteira. */
  readonly urlArquivo: string;
  /** URL da pagina de descricao, para auditoria. Acima da fronteira. */
  readonly urlDescricao: string;
  /** MIME declarado pelo provedor (o do download manda, se divergir). */
  readonly mimeTypeDeclarado: string;
  /** Largura do arquivo a baixar, em pixels. */
  readonly largura: number;
  /** Altura do arquivo a baixar, em pixels. */
  readonly altura: number;
  /** Licenca canonica, ja normalizada. `undefined` = nao reconhecida. */
  readonly licenca: string | undefined;
  /** Licenca como o provedor a escreveu. Auditoria da normalizacao. */
  readonly licencaBruta: string;
  /** Se a licenca daquele arquivo exige atribuicao. */
  readonly atribuicaoObrigatoria: boolean;
  /** Texto de atribuicao, em texto puro e sem URL. */
  readonly atribuicao: string | undefined;
}

/** Adaptador de um provedor elegivel. So provedor elegivel tem um. */
export interface AdaptadorProvedor {
  /** Provedor que este adaptador atende. Casa com `PoliticaDeProvedor.provedor`. */
  readonly provedor: string;

  /** Tipos de midia que este adaptador sabe buscar. */
  readonly tiposSuportados: readonly TipoMidia[];

  /** Versao da API externa. Entra em `parametros` e portanto na chave. */
  readonly versaoApi: string;

  /** Busca candidatos. Usa `ctx.fetch`, nunca `globalThis.fetch`. */
  buscarCandidatos(ctx: ContextoDeBusca): Promise<CandidatoMidia[]>;
}
