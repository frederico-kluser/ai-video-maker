// =============================================================================
// NO: grafico — desenha o grafico e RECUSA formato sem canal alfa
// =============================================================================
// Card: F1-09 (onda W4). Ver docs/adr/0019-no-grafico-alfa-e-erro-de-build.md.
//
// O QUE ESTE ARQUIVO EXISTE PARA IMPEDIR
//
// O grafico chega RENDERIZADO do estagio de resolucao (card F2-02) e entra no
// video POR CIMA da cena. Se o formato entregue nao carrega canal alfa — um
// JPEG, um MP4 — o que aparece no video nao e o grafico: e um RETANGULO OPACO
// cobrindo o fundo. E nada nesse caminho acusa erro. O bundle passa. O render
// sai com exit 0. O arquivo tem bytes. O snapshot ate fica estavel, porque o
// retangulo e perfeitamente deterministico. O defeito so aparece para quem
// ASSISTE o video — e ai o build ja disse tres vezes que estava tudo certo.
//
// Por isso a regra deste no: formato sem alfa e ERRO DE BUILD, e o erro NOMEIA
// O NO. Duas guardas, uma para cada momento em que o erro pode ser barato:
//
//   1. `conferirGraficosResolvidos()` — sobre o manifesto resolvido, ANTES de
//      abrir navegador. E o que `just no-grafico` roda primeiro.
//   2. o proprio componente — lanca ANTES de emitir qualquer elemento, entao
//      nenhum pixel opaco chega ao arquivo de saida nem por engano.
//
// LISTA DE PERMISSAO, NUNCA LISTA DE PROIBICAO
//
// Uma lista de proibicao aprova por omissao: o formato que ninguem previu entra
// calado, e a guarda vira decoracao. Aqui, formato ausente da tabela e RECUSADO
// — inclusive `mimeType` vazio.
//
// CONTRATO DO COMPONENTE (cobrado por `just comp-pureza`)
//
// - funcao pura de (no, frame, fps, width, height); `frame` vem por PROP;
// - zero Date.now / Math.random / setTimeout / fetch, zero relogio, zero disco;
// - zero animacao CSS, zero background-image, zero mask-image;
// - toda interpolacao com extrapolateLeft/extrapolateRight explicitos;
// - imports RELATIVOS: o bundler e webpack e nao le os `paths` do tsconfig.
//
// FUNDO TRANSPARENTE E PARTE DO CONTRATO
//
// Este no NAO pinta fundo. Um `backgroundColor` de tela cheia aqui seria
// exatamente o retangulo opaco que o card existe para proibir — so que escrito
// por nos, em vez de recebido do estagio de resolucao.
// =============================================================================

import type React from "react";
import { Img, interpolate } from "remotion";
import type { DadoGrafico, No, NoGrafico } from "../../contratos/manifesto";
import {
  borderRadius,
  fontWeight,
  highlight,
  msToFrames,
  spacing,
  state,
  text as corDeTexto,
  transitionDuration,
  typeScale,
} from "../../design/tokens";
import type { AssetResolvido } from "../../resolucao/manifesto-resolvido";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "grafico",
  schema: "Grafico.1",
  id: "no-grafico",
  descricao:
    "Grafico (barras, linha, pizza, area, dispersao) sobre fundo transparente; recusa asset sem canal alfa",
};

// ---------------------------------------------------------------------------
// SUPOSICAO DECLARADA sobre F2-02 (dependencia lateral, proibida por contrato)
// ---------------------------------------------------------------------------
// F2-02 (estagio `grafico`) roda em paralelo com este card e e cego para ele.
// O que este arquivo consome NAO e o codigo de F2-02: e o contrato ja commitado
// por F2-01 na W3 — `nos_grafico: NodeId -> Sha256` e `assets[hash]:
// AssetResolvido` (src/resolucao/manifesto-resolvido.ts,
// schema/manifesto-resolvido.schema.json).
//
// O que resta de suposicao, e que fica declarada aqui e no ADR:
//
//   (a) a camada de fiacao (W5) anexa ao NO o descritor do asset que hoje mora
//       fora dele, em `assets[nos_grafico[no.id]]`. O contrato de props e
//       fechado — (no, frame, fps, width, height) — entao `no` e o unico canal.
//   (b) `fonte` e o caminho local JA RESOLVIDO a partir do hash pela fiacao.
//       Ele nunca e gravado no manifesto resolvido: la so existe hash (C7).
//   (c) F2-02 declara `mimeType` no asset. Sem `mimeType` o formato e
//       desconhecido, e desconhecido e recusado (nao aprovado por omissao).
//
// Se F2-02 entregar outra forma, o ajuste e nesta interface e no ponto de
// fiacao — a tabela de formatos e as guardas nao mudam.

/** O asset de grafico ja resolvido, do jeito que a fiacao o entrega ao no. */
export interface GraficoResolvido {
  /** Descritor de `assets[nos_grafico[no.id]]` do manifesto resolvido. */
  readonly asset: AssetResolvido;
  /** Caminho local derivado do hash pela fiacao. Nunca vem do manifesto. */
  readonly fonte?: string;
}

/** O no de grafico depois da fiacao do manifesto resolvido. */
export type NoGraficoResolvido = NoGrafico & {
  readonly grafico_resolvido?: GraficoResolvido;
};

// ---------------------------------------------------------------------------
// A tabela de formatos — a unica fonte de verdade sobre alfa neste projeto
// ---------------------------------------------------------------------------

/** O que um formato entrega quando o grafico e composto sobre a cena. */
export interface CapacidadeDeFormato {
  /** Carrega canal alfa por pixel? Sem isso, o grafico vira retangulo opaco. */
  readonly alfa: boolean;
  /** O navegador do render consegue exibir? Ter alfa e nao tocar tambem falha. */
  readonly reproduzivelNoNavegador: boolean;
  /** Por que — a frase que entra na mensagem de erro. */
  readonly nota: string;
}

/**
 * Lista de PERMISSAO por `mimeType`. Quem nao esta aqui e recusado.
 *
 * As duas linhas contra-intuitivas vem de armadilhas ja registradas em
 * AGENTS.md ("As 14 armadilhas de dominio"):
 *
 *   video/quicktime — o `.mov` do motor de graficos e `qtrle`/`argb`: TEM
 *   alfa, e mesmo assim o navegador do render NAO o reproduz. Aprovar por
 *   "tem alfa" poe no video um buraco em vez de um retangulo — troca de
 *   sintoma, nao conserto.
 *
 *   video/webm — o WebM com alfa so sai do motor de graficos com
 *   `--format=webm` junto da flag de transparencia; a flag sozinha produz o
 *   `.mov` acima. E por isso que os dois casos precisam de linha separada.
 */
export const FORMATOS_DE_GRAFICO: Readonly<Record<string, CapacidadeDeFormato>> = {
  "image/png": {
    alfa: true,
    reproduzivelNoNavegador: true,
    nota: "PNG RGBA (tipo de cor 6) ou cinza+alfa (tipo 4)",
  },
  "image/webp": {
    alfa: true,
    reproduzivelNoNavegador: true,
    nota: "WebP estendido (VP8X) com bloco ALPH",
  },
  "image/apng": {
    alfa: true,
    reproduzivelNoNavegador: true,
    nota: "APNG mantem o alfa do PNG quadro a quadro",
  },
  "image/gif": {
    alfa: true,
    reproduzivelNoNavegador: true,
    nota: "GIF tem transparencia de 1 bit por indice, nao alfa por pixel",
  },
  "image/svg+xml": {
    alfa: true,
    reproduzivelNoNavegador: true,
    nota: "SVG e vetorial: o que nao foi pintado continua transparente",
  },
  "image/jpeg": {
    alfa: false,
    reproduzivelNoNavegador: true,
    nota: "JFIF nao tem canal alfa — todo pixel do quadro e opaco",
  },
  "image/bmp": {
    alfa: false,
    reproduzivelNoNavegador: true,
    nota: "o navegador ignora o alfa do BMP v5 e trata o quadro como opaco",
  },
  "video/webm": {
    alfa: true,
    reproduzivelNoNavegador: true,
    nota: "VP8/VP9 em WebM carregam canal alfa",
  },
  "video/mp4": {
    alfa: false,
    reproduzivelNoNavegador: true,
    nota: "H.264/HEVC em MP4 nao carregam canal alfa no navegador",
  },
  "video/quicktime": {
    alfa: true,
    reproduzivelNoNavegador: false,
    nota: "qtrle/argb tem alfa, mas o navegador do render nao reproduz .mov",
  },
};

/** Os formatos que passam nas DUAS condicoes, em ordem estavel. */
export const FORMATOS_ACEITOS: readonly string[] = Object.keys(FORMATOS_DE_GRAFICO)
  .filter((mime) => {
    const capacidade = FORMATOS_DE_GRAFICO[mime];
    return capacidade !== undefined && capacidade.alfa && capacidade.reproduzivelNoNavegador;
  })
  .sort();

/** `image/png; charset=binary` e `IMAGE/PNG` sao o mesmo formato. */
export function normalizarMime(mime: string): string {
  return (mime.split(";")[0] ?? "").trim().toLowerCase();
}

/** Capacidade do formato, ou `undefined` quando ele nao esta na permissao. */
export function capacidadeDoFormato(
  mime: string | undefined,
): CapacidadeDeFormato | undefined {
  if (mime === undefined) return undefined;
  return FORMATOS_DE_GRAFICO[normalizarMime(mime)];
}

// ---------------------------------------------------------------------------
// As guardas
// ---------------------------------------------------------------------------

/**
 * Erro de build deste no. A mensagem sempre nomeia o no que causou.
 *
 * TUDO EM UMA LINHA, de proposito. Quando este erro e lancado dentro do
 * navegador do render, o que volta para o terminal e a PRIMEIRA LINHA da
 * mensagem — verificado: com o detalhe na segunda linha, o operador recebia
 * "no-grafico: 1 grafico(s) recusado(s)" e nada sobre qual no ou qual formato.
 * Um erro que nao nomeia o no manda alguem procurar no lugar errado.
 */
export class ErroDeGraficoOpaco extends Error {
  readonly erros: readonly string[];
  constructor(erros: readonly string[]) {
    const primeiro = erros[0] ?? `${meta.id}: recusado sem motivo registrado`;
    super(
      erros.length === 1
        ? primeiro
        : `${meta.id}: ${String(erros.length)} graficos recusados — ${erros.join(" || ")}`,
    );
    this.name = "ErroDeGraficoOpaco";
    this.erros = erros;
  }
}

/**
 * Confere UM asset de grafico. Devolve TODOS os problemas (vazia = aprovado).
 * Nao lanca: quem chama decide se acumula ou estoura.
 */
export function conferirAssetDeGrafico(noId: string, asset: AssetResolvido): string[] {
  const erros: string[] = [];
  const onde = `${meta.id}: no "${noId}"`;
  const aceitos = FORMATOS_ACEITOS.join(", ");

  if (asset.tipo === "audio" || asset.tipo === "dados") {
    erros.push(
      `${onde}: asset ${asset.hash} e do tipo "${asset.tipo}", que nao produz ` +
        `pixel — um grafico so entra no video como imagem ou video`,
    );
  }

  const mime = asset.mimeType;
  if (mime === undefined || mime.trim().length === 0) {
    erros.push(
      `${onde}: asset ${asset.hash} sem mimeType — formato desconhecido NAO e ` +
        `aprovado por omissao. Formatos aceitos: ${aceitos}`,
    );
    return erros;
  }

  const normalizado = normalizarMime(mime);
  const capacidade = capacidadeDoFormato(mime);
  if (capacidade === undefined) {
    erros.push(
      `${onde}: formato "${normalizado}" nao esta na lista de permissao deste ` +
        `no — recusado por desconhecido, nunca aprovado por omissao. ` +
        `Formatos aceitos: ${aceitos}`,
    );
    return erros;
  }

  if (!capacidade.alfa) {
    erros.push(
      `${onde}: formato "${normalizado}" NAO tem canal alfa (${capacidade.nota}) ` +
        `— o grafico entraria no video como retangulo opaco por cima da cena, ` +
        `sem nenhum erro no build. Peca ao estagio "grafico" um destes: ${aceitos}`,
    );
  }

  if (!capacidade.reproduzivelNoNavegador) {
    erros.push(
      `${onde}: formato "${normalizado}" ate tem alfa, mas o navegador do render ` +
        `nao o reproduz (${capacidade.nota}) — o grafico sumiria do video. ` +
        `Peca ao estagio "grafico" um destes: ${aceitos}`,
    );
  }

  return erros;
}

/** Como `conferirAssetDeGrafico`, mas estoura. Usada pelo componente. */
export function exigirAssetDeGraficoUtilizavel(
  noId: string,
  asset: AssetResolvido,
): void {
  const erros = conferirAssetDeGrafico(noId, asset);
  if (erros.length > 0) {
    throw new ErroDeGraficoOpaco(erros);
  }
}

/**
 * O recorte do manifesto resolvido que esta conferencia precisa.
 * Estrutural de proposito: aceita o `ManifestoResolvido` inteiro e tambem o
 * JSON de uma fixture, sem obrigar quem chama a montar o documento completo.
 */
export interface ManifestoParaConferencia {
  readonly manifesto: { readonly nos: readonly No[] };
  readonly assets: Readonly<Record<string, AssetResolvido>>;
  readonly nos_grafico?: Readonly<Record<string, string>>;
}

/**
 * Guarda de BUILD: confere todo no de grafico do manifesto resolvido antes de
 * qualquer navegador abrir. Devolve uma mensagem por no problematico, cada uma
 * nomeando o no. Lista vazia = aprovado.
 *
 * Nao asserta nada sobre a lista completa de nos do manifesto: percorre os nos
 * que sao DESTE tipo e cobra cada um. Um no de outro tipo nao e problema deste
 * arquivo.
 */
export function conferirGraficosResolvidos(
  resolvido: ManifestoParaConferencia,
): string[] {
  const erros: string[] = [];
  const mapa = resolvido.nos_grafico ?? {};

  for (const no of resolvido.manifesto.nos) {
    if (no.type !== meta.tipo) continue;
    const onde = `${meta.id}: no "${no.id}"`;

    const hash = mapa[no.id];
    if (hash === undefined) {
      erros.push(
        `${onde}: e do tipo "${meta.tipo}" e nao tem hash em nos_grafico — ` +
          `o estagio "grafico" nao resolveu este no, e no video ele sairia ` +
          `sem o grafico que o manifesto declara`,
      );
      continue;
    }

    const asset = resolvido.assets[hash];
    if (asset === undefined) {
      erros.push(
        `${onde}: nos_grafico aponta para o hash ${hash}, que nao existe em ` +
          `assets — referencia pendurada`,
      );
      continue;
    }

    erros.push(...conferirAssetDeGrafico(no.id, asset));
  }

  return erros;
}

/** Como `conferirGraficosResolvidos`, mas estoura. E o alvo do gate de build. */
export function exigirGraficosComAlfa(resolvido: ManifestoParaConferencia): void {
  const erros = conferirGraficosResolvidos(resolvido);
  if (erros.length > 0) {
    throw new ErroDeGraficoOpaco(erros);
  }
}

// ---------------------------------------------------------------------------
// Geometria — tudo derivado de (width, height) e dos tokens de espacamento
// ---------------------------------------------------------------------------

/** Paleta de serie, para o dado que nao declara cor propria. */
const PALETA_DE_SERIE: readonly string[] = [
  highlight.primary,
  state.success,
  state.warning,
  state.error,
  highlight.secondary,
  state.info,
];

function corDoDado(dado: DadoGrafico, indice: number): string {
  if (dado.cor !== undefined && dado.cor.trim().length > 0) return dado.cor;
  return PALETA_DE_SERIE[indice % PALETA_DE_SERIE.length] ?? highlight.primary;
}

interface AreaDeDesenho {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
}

interface Ponto {
  readonly x: number;
  readonly y: number;
}

/** Pontos do topo de cada dado, ja com o progresso da animacao aplicado. */
function pontosDaSerie(
  dados: readonly DadoGrafico[],
  area: AreaDeDesenho,
  progresso: number,
): Ponto[] {
  const maximo = Math.max(...dados.map((d) => Math.abs(d.valor)), Number.MIN_VALUE);
  const passo = dados.length > 1 ? area.largura / (dados.length - 1) : 0;
  const base = area.y + area.altura;
  return dados.map((dado, indice) => {
    const fracao = Math.abs(dado.valor) / maximo;
    const alturaFinal = fracao * area.altura;
    return {
      x: dados.length > 1 ? area.x + passo * indice : area.x + area.largura / 2,
      y: base - alturaFinal * progresso,
    };
  });
}

/** Um setor de pizza como caminho SVG. Angulos em radianos, zero as 12h. */
function setorDePizza(
  centro: Ponto,
  raio: number,
  anguloInicial: number,
  anguloFinal: number,
): string {
  const x1 = centro.x + raio * Math.sin(anguloInicial);
  const y1 = centro.y - raio * Math.cos(anguloInicial);
  const x2 = centro.x + raio * Math.sin(anguloFinal);
  const y2 = centro.y - raio * Math.cos(anguloFinal);
  const arcoGrande = anguloFinal - anguloInicial > Math.PI ? 1 : 0;
  return [
    `M ${String(centro.x)} ${String(centro.y)}`,
    `L ${String(x1)} ${String(y1)}`,
    `A ${String(raio)} ${String(raio)} 0 ${String(arcoGrande)} 1 ${String(x2)} ${String(y2)}`,
    "Z",
  ].join(" ");
}

// ---------------------------------------------------------------------------
// As cinco formas
// ---------------------------------------------------------------------------

function desenharBarras(
  dados: readonly DadoGrafico[],
  area: AreaDeDesenho,
  progresso: number,
): React.ReactNode {
  const vao = spacing["2"];
  const larguraBarra = Math.max(
    (area.largura - vao * Math.max(dados.length - 1, 0)) / Math.max(dados.length, 1),
    1,
  );
  const maximo = Math.max(...dados.map((d) => Math.abs(d.valor)), Number.MIN_VALUE);
  const base = area.y + area.altura;

  return dados.map((dado, indice) => {
    const alturaBarra = (Math.abs(dado.valor) / maximo) * area.altura * progresso;
    return (
      <rect
        key={dado.rotulo}
        x={area.x + indice * (larguraBarra + vao)}
        y={base - alturaBarra}
        width={larguraBarra}
        height={Math.max(alturaBarra, 0)}
        rx={borderRadius.sm}
        fill={corDoDado(dado, indice)}
      />
    );
  });
}

function desenharLinha(
  dados: readonly DadoGrafico[],
  area: AreaDeDesenho,
  progresso: number,
  preencher: boolean,
): React.ReactNode {
  const pontos = pontosDaSerie(dados, area, progresso);
  const cor = corDoDado(dados[0] ?? { rotulo: "", valor: 0 }, 0);
  const linha = pontos
    .map((p) => `${String(p.x)} ${String(p.y)}`)
    .join(" L ");
  const base = area.y + area.altura;
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];

  return (
    <g>
      {preencher && primeiro !== undefined && ultimo !== undefined ? (
        <path
          d={
            `M ${String(primeiro.x)} ${String(base)} L ${linha} ` +
            `L ${String(ultimo.x)} ${String(base)} Z`
          }
          fill={cor}
          fillOpacity={0.35}
        />
      ) : null}
      <path
        d={`M ${linha}`}
        fill="none"
        stroke={cor}
        strokeWidth={spacing["1"]}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pontos.map((ponto, indice) => (
        <circle
          key={dados[indice]?.rotulo ?? String(indice)}
          cx={ponto.x}
          cy={ponto.y}
          r={spacing["2"]}
          fill={corDoDado(dados[indice] ?? { rotulo: "", valor: 0 }, indice)}
        />
      ))}
    </g>
  );
}

function desenharPizza(
  dados: readonly DadoGrafico[],
  area: AreaDeDesenho,
  progresso: number,
): React.ReactNode {
  const total = dados.reduce((soma, dado) => soma + Math.abs(dado.valor), 0);
  if (total <= 0) return null;
  const centro: Ponto = {
    x: area.x + area.largura / 2,
    y: area.y + area.altura / 2,
  };
  const raio = Math.min(area.largura, area.altura) / 2;
  const setores: React.ReactNode[] = [];
  let angulo = 0;
  for (let indice = 0; indice < dados.length; indice++) {
    const dado = dados[indice];
    if (dado === undefined) continue;
    const abertura = (Math.abs(dado.valor) / total) * Math.PI * 2 * progresso;
    setores.push(
      <path
        key={dado.rotulo}
        d={setorDePizza(centro, raio, angulo, angulo + abertura)}
        fill={corDoDado(dado, indice)}
      />,
    );
    angulo += abertura;
  }
  return <g>{setores}</g>;
}

function desenharDispersao(
  dados: readonly DadoGrafico[],
  area: AreaDeDesenho,
  progresso: number,
): React.ReactNode {
  const pontos = pontosDaSerie(dados, area, 1);
  return pontos.map((ponto, indice) => (
    <circle
      key={dados[indice]?.rotulo ?? String(indice)}
      cx={ponto.x}
      cy={ponto.y}
      r={spacing["4"] * progresso}
      fill={corDoDado(dados[indice] ?? { rotulo: "", valor: 0 }, indice)}
    />
  ));
}

function desenharSerie(
  grafico: NoGrafico,
  area: AreaDeDesenho,
  progresso: number,
): React.ReactNode {
  const dados = grafico.dados;
  if (dados.length === 0) return null;
  switch (grafico.tipo_grafico) {
    case "barras":
      return desenharBarras(dados, area, progresso);
    case "linha":
      return desenharLinha(dados, area, progresso, false);
    case "area":
      return desenharLinha(dados, area, progresso, true);
    case "pizza":
      return desenharPizza(dados, area, progresso);
    case "dispersao":
      return desenharDispersao(dados, area, progresso);
  }
}

// ---------------------------------------------------------------------------
// O componente
// ---------------------------------------------------------------------------

const Grafico: NoComponent = ({ no, frame, fps, width, height }) => {
  const grafico = no as NoGraficoResolvido;

  // A JANELA DO NO. `frame` chega local (0 = primeiro frame visivel deste no)
  // e esta guarda vem ANTES de qualquer desenho: fora de [0, duracao_frames)
  // o no NAO EXISTE e retorna null — o padrao dos sete irmaos (pergunta
  // adversarial 4 da onda). A primeira versao deste no clampeava o frame e
  // congelava o desenho no ultimo estado valido; so a mitigacao da raiz
  // (EnvelopeJanela nunca chamar fora da janela) escondia a divergencia, e um
  // pintor futuro pintaria o grafico congelado sobre o conteudo seguinte.
  if (frame < 0 || frame >= grafico.duracao_frames) {
    return null;
  }

  const resolvido = grafico.grafico_resolvido;

  // GUARDA — antes de emitir qualquer elemento. Um formato sem alfa nunca
  // chega a pintar: o render inteiro para, nomeando este no.
  if (resolvido !== undefined) {
    exigirAssetDeGraficoUtilizavel(grafico.id, resolvido.asset);
    if (resolvido.fonte === undefined || resolvido.fonte.trim().length === 0) {
      throw new ErroDeGraficoOpaco([
        `${meta.id}: no "${grafico.id}": o asset ${resolvido.asset.hash} foi ` +
          `resolvido, mas a fiacao nao entregou o caminho local — desenhar o ` +
          `grafico a partir de dados aqui trocaria em silencio o que o estagio ` +
          `"grafico" produziu`,
      ]);
    }
  }

  // A guarda acima garante frame em [0, duracao_frames): a entrada e o
  // progresso usam `frame` direto, com os dois extrapolate explicitos.
  const entrada = Math.max(
    1,
    Math.min(msToFrames(transitionDuration.base, fps), Math.max(grafico.duracao_frames - 1, 1)),
  );
  const progresso = interpolate(frame, [0, entrada], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const respiro = spacing["16"];
  const tamanhoTitulo = Math.round(height * typeScale.title);
  const tamanhoRotulo = Math.round(height * typeScale.caption);
  const alturaTitulo = grafico.titulo === undefined ? 0 : tamanhoTitulo + spacing["6"];
  const alturaRotulos = tamanhoRotulo + spacing["4"];

  const area: AreaDeDesenho = {
    x: respiro,
    y: respiro + alturaTitulo,
    largura: Math.max(width - respiro * 2, 1),
    altura: Math.max(height - respiro * 2 - alturaTitulo - alturaRotulos, 1),
  };

  return (
    <div
      data-no={grafico.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      data-modo={resolvido === undefined ? "dados" : "asset"}
      style={{
        position: "absolute",
        inset: 0,
        opacity: progresso,
      }}
    >
      {grafico.titulo === undefined ? null : (
        <div
          style={{
            position: "absolute",
            left: respiro,
            top: respiro,
            width: area.largura,
            fontSize: tamanhoTitulo,
            fontWeight: fontWeight.semibold,
            color: corDeTexto.primary,
            textAlign: "center",
          }}
        >
          {grafico.titulo}
        </div>
      )}

      {resolvido === undefined ? (
        <>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${String(width)} ${String(height)}`}
            style={{ position: "absolute", left: 0, top: 0 }}
            aria-hidden="true"
          >
            {desenharSerie(grafico, area, progresso)}
          </svg>
          <div
            style={{
              position: "absolute",
              left: area.x,
              top: area.y + area.altura + spacing["4"],
              width: area.largura,
              display: "flex",
              fontSize: tamanhoRotulo,
              color: corDeTexto.secondary,
            }}
          >
            {grafico.dados.map((dado) => (
              <span key={dado.rotulo} style={{ flex: 1, textAlign: "center" }}>
                {dado.rotulo}
              </span>
            ))}
          </div>
        </>
      ) : (
        <Img
          src={resolvido.fonte ?? ""}
          alt={grafico.titulo ?? grafico.id}
          style={{
            position: "absolute",
            left: area.x,
            top: area.y,
            width: area.largura,
            height: area.altura,
            objectFit: "contain",
          }}
        />
      )}
    </div>
  );
};

export default Grafico;
