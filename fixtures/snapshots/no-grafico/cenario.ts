// =============================================================================
// Cenario do no `grafico` — os dados que o snapshot, o teste e as sondas usam
// =============================================================================
// Card: F1-09 (onda W4)
//
// Um arquivo so, consumido por tres caminhos, para que nao existam tres
// verdades: o registro do Remotion (index.tsx), o teste de markup
// (tests/composicao/no-grafico.test.ts) e as sondas (tools/no-grafico/).
//
// Os hashes abaixo sao o SHA-256 REAL dos arquivos em assets/. E assim que a
// conferencia de bytes acha o arquivo: pelo conteudo, como o store (S-8), sem
// caminho nenhum atravessar a fronteira de determinismo (C7).
// =============================================================================

import type { NoGrafico } from "../../../src/contratos/manifesto";
import type { AssetResolvido } from "../../../src/resolucao/manifesto-resolvido";

export const FPS = 30;
export const LARGURA = 1920;
export const ALTURA = 1080;
export const DURACAO_FRAMES = 120;

/** Frame do still. Depois da entrada (300ms = 9 frames a 30fps): desenho cheio. */
export const FRAME_DO_SNAPSHOT = 20;

/** SHA-256 de fixtures/snapshots/no-grafico/assets/grafico-com-alfa.png */
export const HASH_COM_ALFA =
  "4dd3497f7719e4aa541f1087413be1522e47f4ac75c44eaceefcc4a8e5c4878c";

/** SHA-256 de fixtures/snapshots/no-grafico/assets/grafico-opaco.png */
export const HASH_OPACO =
  "7eb1fe8c0cb659c66ffb3e3aec182b5496afece564c0aec3d96f303ebbea130f";

// ---------------------------------------------------------------------------
// Os cinco tipos de grafico, para o caminho sem asset resolvido
// ---------------------------------------------------------------------------

function base(id: string, tipo: NoGrafico["tipo_grafico"]): Omit<NoGrafico, "dados"> {
  return {
    id,
    schema: "Grafico.1",
    type: "grafico",
    duracao_frames: DURACAO_FRAMES,
    tipo_grafico: tipo,
  };
}

export const NO_BARRAS: NoGrafico = {
  ...base("g-barras", "barras"),
  titulo: "Frames por segundo, por perfil de encode",
  dados: [
    { rotulo: "cpu", valor: 18 },
    { rotulo: "qsv", valor: 41 },
    { rotulo: "vaapi", valor: 37 },
    { rotulo: "nvenc", valor: 96 },
    { rotulo: "swangle", valor: 12 },
  ],
};

export const NO_LINHA: NoGrafico = {
  ...base("g-linha", "linha"),
  titulo: "Duracao do gate por onda",
  dados: [
    { rotulo: "W1", valor: 120 },
    { rotulo: "W2", valor: 165 },
    { rotulo: "W3", valor: 143 },
    { rotulo: "W4", valor: 210 },
  ],
};

export const NO_AREA: NoGrafico = {
  ...base("g-area", "area"),
  dados: [
    { rotulo: "jan", valor: 100 },
    { rotulo: "fev", valor: 220 },
    { rotulo: "mar", valor: 160 },
  ],
};

export const NO_PIZZA: NoGrafico = {
  ...base("g-pizza", "pizza"),
  titulo: "Onde o tempo de render vai",
  dados: [
    { rotulo: "compor", valor: 35 },
    { rotulo: "encodar", valor: 45 },
    { rotulo: "resolver", valor: 20 },
  ],
};

export const NO_DISPERSAO: NoGrafico = {
  ...base("g-dispersao", "dispersao"),
  dados: [
    { rotulo: "a", valor: 1.5 },
    { rotulo: "b", valor: 3.25 },
    { rotulo: "c", valor: 2.75 },
    { rotulo: "d", valor: 4 },
  ],
};

/** Sem dados: o no tem de continuar valido e nao pode virar quadro opaco. */
export const NO_VAZIO: NoGrafico = {
  ...base("g-vazio", "barras"),
  dados: [],
};

export const NOS_POR_TIPO: readonly NoGrafico[] = [
  NO_BARRAS,
  NO_LINHA,
  NO_AREA,
  NO_PIZZA,
  NO_DISPERSAO,
  NO_VAZIO,
];

// ---------------------------------------------------------------------------
// Os assets resolvidos — como F2-02 os descreve em `assets[hash]`
// ---------------------------------------------------------------------------

export const ASSET_COM_ALFA: AssetResolvido = {
  hash: HASH_COM_ALFA,
  tipo: "imagem",
  mimeType: "image/png",
  largura: 480,
  altura: 320,
  licenca: "CC0-1.0",
  atribuicaoObrigatoria: false,
  provedor: "manim",
};

/** Mentira no DESCRITOR: o formato declarado nao tem canal alfa. */
export const ASSET_FORMATO_SEM_ALFA: AssetResolvido = {
  ...ASSET_COM_ALFA,
  mimeType: "image/jpeg",
};

/**
 * Mentira nos BYTES: `image/png` e verdade, o arquivo e PNG mesmo — so que de
 * tipo de cor 2 (RGB), sem canal alfa. O descritor passa; so a conferencia de
 * bytes pega.
 */
export const ASSET_BYTES_SEM_ALFA: AssetResolvido = {
  ...ASSET_COM_ALFA,
  hash: HASH_OPACO,
};

/** Tem alfa (qtrle/argb) e mesmo assim o navegador do render nao reproduz. */
export const ASSET_MOV: AssetResolvido = {
  ...ASSET_COM_ALFA,
  hash: HASH_COM_ALFA,
  mimeType: "video/quicktime",
};

/** Formato que ninguem previu: recusado por desconhecido, nao aprovado. */
export const ASSET_FORMATO_DESCONHECIDO: AssetResolvido = {
  ...ASSET_COM_ALFA,
  mimeType: "image/avif",
};

/** Sem `mimeType`: o formato e desconhecido, e desconhecido nao passa. */
export const ASSET_SEM_MIME: AssetResolvido = {
  hash: HASH_COM_ALFA,
  tipo: "imagem",
  licenca: "CC0-1.0",
  atribuicaoObrigatoria: false,
  provedor: "manim",
};

/** O no que a fiacao entrega quando o estagio "grafico" ja rodou. */
export const NO_COM_ASSET: NoGrafico = {
  ...base("g-asset", "barras"),
  titulo: "Grafico vindo do estagio de resolucao",
  dados: NO_BARRAS.dados,
};
