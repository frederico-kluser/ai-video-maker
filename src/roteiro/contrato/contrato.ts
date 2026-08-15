/**
 * src/roteiro/contrato/contrato.ts
 *
 * Contrato do dominio de ROTEIRO v1 (Onda 1 do app web).
 *
 * O roteiro e a ponte entre o USUARIO e o pipeline de video: o usuario
 * descreve o que vai fazer (BriefRoteiro), o gerador (Onda 2, LLM) produz
 * um Roteiro dividido em PEDACOS — pedaco = slide: uma fala + um visual +
 * como sera produzido — e o construtor de manifesto (Onda 2) transforma
 * cada pedaco em UMA cena do Manifesto.1: a fala vira
 * `Cena.audio_cena.texto_locucao` e o visual vira nos do vocabulario
 * existente. A ponte DocumentoAutoria -> Manifesto (a fronteira de
 * resolucao) e AB-550 e mora em src/render/pipeline/ponte.ts — ver
 * docs/roteiro/contrato-roteiro.md §5.
 *
 * Regras duras deste contrato (o schema e o UNICO contrato — FQ-C2):
 *   - additionalProperties:false em TODO objeto: campo fora do schema e
 *     emissao IMPOSSIVEL, nao apenas desencorajada;
 *   - pedaco invalido e REJEITADO com erro nomeado, nunca aceito em
 *     silencio (FQ-C1);
 *   - bump de versao do contrato invalida o cache do gerador (FQ-C3);
 *   - nenhuma URL atravessa este dominio: o gif/video anexado e o audio
 *     gravado sao enderecados por SHA-256 de conteudo (C7).
 *
 * A forma deste arquivo espelha src/autoria/contrato/contrato.ts: versao
 * congelada, tipos readonly, vocabulario fechado, decisao de sistema fora
 * do contrato. A validacao esta em validar.ts; a rejeicao em rejeitar.ts;
 * a chave de cache em cache.ts.
 */

/** Versao congelada do Roteiro. Bump = novo arquivo, nunca editar este. */
export const VERSAO_CONTRATO_ROTEIRO = "Roteiro.1" as const;
export type VersaoContratoRoteiro = typeof VERSAO_CONTRATO_ROTEIRO;

/**
 * Versao do CONTRATO do gerador (a composicao da chave de cache).
 *
 * Bump obrigatorio ao mudar a forma das entradas do gerador (Pedido*).
 * Entra na chave de cache (C12/FQ-C3): mudar aqui invalida todo o cache
 * antigo do gerador.
 */
export const VERSAO_CONTRATO_GERADOR = "1.0.0" as const;

/**
 * Versao do GERADOR (implementacao).
 *
 * REGRA DURA (a mesma da resolucao): mudou o codigo de um jeito que pode
 * mudar a saida? Bumpou a versao. Sem isso o cache serve resultado velho
 * para sempre.
 */
export const VERSAO_GERADOR = "1.0.0" as const;

/** Caminho do schema completo do roteiro (draft 2020-12 — o validador). */
export const CAMINHO_SCHEMA_ROTEIRO =
  new URL("./schema/roteiro.schema.json", import.meta.url).pathname;

/** Caminho do schema do pedaco isolado (referencia o schema do roteiro). */
export const CAMINHO_SCHEMA_PEDACO =
  new URL("./schema/pedaco.schema.json", import.meta.url).pathname;

/**
 * Formato do id de pedaco: `p-<indice>` com 3 digitos. O id e ESTAVEL por
 * posicao: regenerar um pedaco NAO renumera os irmaos (os ids deles sao
 * preservados byte a byte — e isso que mantem o preview dos irmaos em
 * cache, FQ-G2). O sufixo numerico tem de casar `indice` (regra
 * id-nao-casa-indice em validar.ts).
 */
export const PADRAO_ID_PEDACO = /^p-([0-9]{3})$/;

/**
 * Vocabulario fechado do visual de um pedaco. Fechado de proposito: o
 * construtor de manifesto (Onda 2) mapeia cada valor para nos do
 * Manifesto.1 (ver docs/roteiro/contrato-roteiro.md §4) — um valor novo
 * aqui e bump de contrato, nunca campo aberto.
 */
export const VOCABULARIO_TIPO_VISUAL = [
  "manim",
  "grafico",
  "gif",
  "video",
  "texto",
  "lista",
  "cabecalho",
] as const;
export type TipoVisualPedaco = (typeof VOCABULARIO_TIPO_VISUAL)[number];

/** Origem da narracao de um pedaco. */
export const VOCABULARIO_ORIGEM_NARRACAO = [
  "tts",
  "gravacao",
  "nenhuma",
] as const;
export type OrigemNarracao = (typeof VOCABULARIO_ORIGEM_NARRACAO)[number];

/**
 * Vocabulario fechado do tipo de anexo do usuario (gif/video). Fechado de
 * proposito: e a allowlist que a rota de anexo valida (regra
 * anexo-tipo-permitido) — o navegador envia exatamente um destes
 * Content-Types no PUT de anexo.
 */
export const VOCABULARIO_TIPO_ANEXO = [
  "image/gif",
  "video/mp4",
  "video/webm",
] as const;
export type TipoAnexo = (typeof VOCABULARIO_TIPO_ANEXO)[number];

/**
 * Limite de tamanho do anexo do usuario, em bytes (regra
 * anexo-tamanho-limite). 200 MB cobre gravacao de tela (o caso de uso que
 * o pedido do usuario nomeia) com folga. Valor de dominio em tipo nomeado
 * (Regra 2): a rota de anexo da Onda 4 importa a constante, nunca
 * redigita o numero.
 */
export const ANEXO_TAMANHO_MAXIMO_BYTES = 200 * 1024 * 1024;

/**
 * Status da narracao de um pedaco:
 *   - "vazio":   nenhum audio existe (nada gerado, nada gravado);
 *   - "gerado":  o audio existe e corresponde a `narracao.texto`, que e
 *                IGUAL a `fala` (a narracao esta em dia);
 *   - "editado": a `fala` mudou depois da ultima geracao/gravacao —
 *                `narracao.texto` aponta para o texto ANTIGO; o audio, se
 *                existir, e stale ate regenerar/regravar.
 */
export const VOCABULARIO_STATUS_NARRACAO = [
  "vazio",
  "gerado",
  "editado",
] as const;
export type StatusNarracao = (typeof VOCABULARIO_STATUS_NARRACAO)[number];

// ─── Formatos congelados (D5/D6 do plano — ver docs/roteiro/contrato-roteiro.md §8) ──

/**
 * Formato do preview de pedaco e do video final: mp4 h264 yuv420p
 * 1920x1080 30fps + aac 48k. Congelado aqui (fonte unica): a Onda 3
 * (preview/juntar) implementa exatamente isto e a Onda 6 (e2e) confere
 * com ffprobe por stream (C4).
 */
export const FORMATO_VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  video_codec: "h264",
  pix_fmt: "yuv420p",
  audio_codec: "aac",
  audio_sample_rate: 48000,
} as const;

/**
 * Formato do audio gravado pelo usuario (apos conversao webm -> wav): wav
 * 48kHz estéreo (D4). `hash_audio` do pedaco e o SHA-256 DESTE wav — os
 * bytes que o pipeline consome; dedupe por hash (S-8, FQ-N1).
 */
export const FORMATO_AUDIO_GRAVADO = {
  formato: "wav",
  sample_rate: 48000,
  canais: 2,
} as const;

/**
 * Tolerancia da regra duracao-total-inconsistente: a soma das duracoes
 * dos pedacos tem de bater com `duracao_total_segundos` dentro desta
 * folga (arredondamento de casas decimais do gerador). Valor de dominio
 * em tipo nomeado (Regra 2 — zero literais fora de src/design/): quem
 * precisar do numero importa a constante, nunca o redigita.
 */
export const TOLERANCIA_DURACAO_TOTAL_SEGUNDOS = 0.01;

// ─── Brief ────────────────────────────────────────────────────────────────────

/**
 * O brief do roteiro — a ENTRADA do usuario (espelha BriefAutoria de
 * src/autoria/executor/contrato.ts:76, com `contexto` a mais). Ausencia
 * de campo opcional nao e erro; `tema` ausente/vazio e erro.
 */
export interface BriefRoteiro {
  /** Obrigatorio: o que o video vai mostrar/explicar. */
  readonly tema: string;
  /** Contexto opcional que o usuario quer que o gerador considere. */
  readonly contexto?: string;
  /** Para quem e o video (afeta ritmo e vocabulario). */
  readonly publico?: string;
  /** Duracao total desejada em segundos (o sistema resolve a final). */
  readonly duracao_alvo_segundos?: number;
  /** Registro da locucao (formal, didatico, direto...). */
  readonly tom?: string;
  /** Assuntos, termos ou figuras a evitar. */
  readonly exclusoes?: string;
  /** Tipos de visual que DEVEM aparecer (ex.: ["grafico"]). */
  readonly nos_obrigatorios?: readonly string[];
}

// ─── Pedaco ───────────────────────────────────────────────────────────────────

/**
 * A narracao de um pedaco — o ESTADO do audio, nunca o audio em si.
 *
 * `texto` e o texto a que o audio ATUAL (se existir) corresponde; quando
 * o usuario edita `fala` depois da geracao, `texto` continua apontando
 * para o texto antigo e `status` vira "editado" — e a aplicacao da
 * regra de calibracao da locucao ("audio novo com timing velho
 * dessincroniza sem erro") ao nivel do roteiro.
 */
export interface NarracaoPedaco {
  /** O texto a que o audio atual corresponde ("" = nada narrado). */
  readonly texto: string;
  /** De onde o audio (se existir) veio. */
  readonly origem: OrigemNarracao;
  /**
   * SHA-256 do wav 48k estéreo gravado pelo usuario (FORMATO_AUDIO_GRAVADO).
   * SO existe com origem "gravacao" — audio de TTS vive no store da
   * resolucao, enderecado pela chave de cache (C7: conteudo, nunca URL).
   */
  readonly hash_audio?: string;
  /** "vazio" | "gerado" | "editado" — ver VOCABULARIO_STATUS_NARRACAO. */
  readonly status: StatusNarracao;
}

/**
 * Metadado do anexo do usuario (gif/video) — o par de `anexo_hash`:
 * `anexo_hash` e o SHA-256 dos bytes, `anexo_meta` descreve o arquivo
 * como o navegador o enviou. Os dois sao mutaveis SOMENTE pela rota de
 * anexo (PUT/GET/DELETE anexo — análogo a narracao: edicao de texto nao
 * os mexe, regra edicao-anexo-proibido).
 */
export interface AnexoMeta {
  /** Allowlist fechada: image/gif | video/mp4 | video/webm. */
  readonly tipo: TipoAnexo;
  /** Tamanho do arquivo em bytes (regra anexo-tamanho-limite). */
  readonly tamanho_bytes: number;
  /** Nome do arquivo como o usuario o enviou (exibicao na UI). */
  readonly nome_original: string;
}

/**
 * Um pedaco do roteiro — a unidade do site (um slide): uma fala narrada +
 * um visual + como sera produzido + o estado da narracao. O construtor
 * (Onda 2) transforma cada pedaco em UMA cena do Manifesto.1
 * (docs/roteiro/contrato-roteiro.md §5).
 */
export interface Pedaco {
  /** Id estavel por posicao (PADRAO_ID_PEDACO): p-000, p-001, ... */
  readonly id: string;
  /** Posicao no roteiro (0-based; contiguo — regra indices-nao-contiguos). */
  readonly indice: number;
  /** Titulo curto exibido na UI (nao vazio). */
  readonly titulo: string;
  /** Texto narrado; string vazia = sem fala (sem narracao). */
  readonly fala: string;
  /** Duracao deste pedaco em segundos (positiva; a soma e o total). */
  readonly duracao_segundos: number;
  /** O tipo do visual (vocabulario fechado). */
  readonly tipo_visual: TipoVisualPedaco;
  /** O que o visual mostra (texto livre — o construtor interpreta). */
  readonly especificacao_visual: string;
  /**
   * Texto que a UI exibe sobre COMO o pedaco sera feito (nunca vazio —
   * e o que a tela de roteiro mostra antes de qualquer preview).
   */
  readonly detalhes_de_producao: string;
  /** Estado da narracao (o audio em si fica no store, por hash). */
  readonly narracao: NarracaoPedaco;
  /**
   * SHA-256 do anexo do usuario (gif ou video) — obrigatorio quando
   * tipo_visual e "gif"/"video" e proibido nos demais (C7: o anexo e
   * enderecado por conteudo, nunca por URL). Mutavel SOMENTE pela rota
   * de anexo (regra edicao-anexo-proibido).
   */
  readonly anexo_hash?: string;
  /**
   * Metadado do anexo (tipo/tamanho/nome) — sempre junto de `anexo_hash`
   * (a rota de anexo seta/remove os dois como um par).
   */
  readonly anexo_meta?: AnexoMeta;
}

// ─── Roteiro ──────────────────────────────────────────────────────────────────

/** O roteiro completo — a saida do gerador (Onda 2). */
export interface Roteiro {
  readonly schema_version: VersaoContratoRoteiro;
  /** Um pedaco por cena do Manifesto (1..40). */
  readonly pedacos: readonly Pedaco[];
  /**
   * Duracao total em segundos — a soma das duracoes dos pedacos
   * (tolerancia 0.01s; regra duracao-total-inconsistente).
   */
  readonly duracao_total_segundos: number;
}

// ─── Edicao do usuario ────────────────────────────────────────────────────────

/**
 * Um pedaco PARCIAL editado pelo usuario. O que o usuario NAO edita:
 * `id`, `indice`, `narracao` (identidade e estado de audio mudam so
 * pelos endpoints de narracao) e `anexo_hash`/`anexo_meta` (o estado do
 * anexo muda so pela rota de anexo — regra edicao-anexo-proibido:
 * EdicaoPedaco com anexo e rejeitado). `pedacos_editados` do projeto
 * guarda estes deltas; a edicao sobrevive a regeneracao de outros
 * pedacos e entra na chave de cache do gerador (C12 — FQ-G3).
 */
export interface EdicaoPedaco {
  readonly titulo?: string;
  readonly fala?: string;
  readonly duracao_segundos?: number;
  readonly tipo_visual?: TipoVisualPedaco;
  readonly especificacao_visual?: string;
  readonly detalhes_de_producao?: string;
}

// ─── Projeto ──────────────────────────────────────────────────────────────────

/**
 * Estado persistido do projeto (o servidor da Onda 4 persiste em
 * dados/projetos/<id>/, JSON atomico S-8).
 *
 * `pedacos_editados` e a fonte de verdade das edicoes do usuario,
 * chaveada pelo id do pedaco: o servidor APLICA os deltas sobre o roteiro
 * ao servir (aplicarEdicaoPedaco em edicao.ts) e PODA registros cujo id
 * nao existe mais no roteiro (regeneracao completa renumera — edicoes
 * orfas nao sobrevivem a reescrita do roteiro inteiro; as de PEDACOS
 * NAO regenerados sobrevivem, e e isso que o gerador consome ao
 * regenerar um irmao).
 */
export interface ProjetoRoteiro {
  readonly id: string;
  readonly brief: BriefRoteiro;
  readonly roteiro?: Roteiro;
  readonly pedacos_editados: Readonly<Record<string, EdicaoPedaco>>;
  /** Data ISO-8601 (criado_em nunca muda). */
  readonly criado_em: string;
  readonly atualizado_em: string;
}

// ─── Entradas do gerador (pedidos) ────────────────────────────────────────────

/**
 * Entrada do gerador para gerar o roteiro COMPLETO (Onda 2 valida contra
 * este shape; e o stdin do CLI — docs/roteiro/api.md §CLIs).
 *
 * Os campos `versao_*` sao preenchidos pelo SERVIDOR ao montar o stdin
 * (o cliente da API nunca os envia): fazem parte da chave de cache
 * (FQ-C3 — bump de versao = MISS) e da validacao (versao desconhecida =
 * rejeicao nomeada). A chave e sha256(canonical_json(pedido)) (cache.ts).
 */
export interface PedidoGerarRoteiro {
  readonly brief: BriefRoteiro;
  /** Duracao alvo efetiva (o seletor da UI) — vence brief.duracao_alvo_segundos. */
  readonly duracao_alvo_segundos?: number;
  readonly versao_contrato: string;
  readonly versao_contrato_gerador: string;
  readonly versao_gerador: string;
}

/**
 * Entrada do gerador para regenerar UM pedaco (os demais ficam INTACTOS
 * no roteiro — FQ-G2). `pedaco_atual` e o pedaco com as edicoes do
 * usuario aplicadas; `resumo_demais_pedacos` e a serializacao canonica
 * dos IRMAOS (resumoDePedacos em canonicalizar.ts — deterministica por
 * construcao: mesmo estado dos irmaos, mesmo resumo, mesma chave).
 */
export interface PedidoRegenerarPedaco {
  readonly brief: BriefRoteiro;
  readonly duracao_alvo_segundos?: number;
  /** O pedaco a regenerar, com as edicoes do usuario ja aplicadas. */
  readonly pedaco_atual: Pedaco;
  /** Os irmaos serializados (canonicalizar.ts: resumoDePedacos). */
  readonly resumo_demais_pedacos: string;
  readonly versao_contrato: string;
  readonly versao_contrato_gerador: string;
  readonly versao_gerador: string;
}

/** A uniao das entradas de cache do gerador. */
export type EntradaGeradorRoteiro = PedidoGerarRoteiro | PedidoRegenerarPedaco;
