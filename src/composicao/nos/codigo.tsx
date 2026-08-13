// =============================================================================
// NO: codigo — desenha tokens JA COMPUTADOS; nunca destaca sintaxe
// =============================================================================
// Card: F1-08 (onda W4)
//
// POR QUE ESTE COMPONENTE NAO SABE DESTACAR SINTAXE
//
// Destacar sintaxe e trabalho IMPURO: exige gramatica, tema e — em algumas
// ferramentas (twoslash) — buscar tipos numa CDN. Nada disso pode acontecer
// abaixo da fronteira de determinismo (AGENTS.md, Regra 1). O destaque e
// computado ACIMA da fronteira, pelo estagio de resolucao `codigo` (F2-05),
// cacheado por hash, e chega aqui como DADO.
//
// Consequencia direta, e o ponto do card: se o no vier com codigo cru e sem
// tokens, este componente NAO adivinha. Ele desenha o codigo em uma cor so e
// marca `data-destaque="ausente"` na arvore. Nao existe neste arquivo tabela de
// palavras-chave, regex de lexer, nem import de destacador — e ha teste que
// varre o proprio fonte atras disso (tests/composicao/no-codigo.test.ts).
//
// O QUE E ERRO, E O QUE E AUSENCIA
//
//   ausencia  -> nao ha `destaque_sintaxe`. Desenha cru, marcado. Nao explode:
//                a fixture canonica do repositorio tem no de codigo sem
//                destaque, e um render que morre por isso reprovaria F1-01.
//   mentira   -> ha `destaque_sintaxe`, mas ele DISCORDA do codigo do no
//                (linha a mais, texto que nao reconstroi a fonte, papel
//                desconhecido, formato de outra versao). Isso e RECUSA dura:
//                desenhar seria exibir um codigo que nao e o codigo do
//                manifesto. `ErroDeDestaque` sobe.
//
// FORMATO ASSUMIDO — dependencia lateral declarada, nao inventada
//
// F2-05 e irmao desta onda e e cego para este arquivo. O contrato de estagio
// (docs/contrato-estagio-resolucao.md) so fixa que a saida do estagio `codigo`
// e `nos_codigo: Record<NodeId, Sha256>` — um hash de asset por no. Ele NAO
// fixa o conteudo desse asset. A suposicao deste card, declarada no handoff e
// em docs/adr/0007-no-codigo-destaque-pre-computado.md:
//
//   o asset apontado por `nos_codigo[<id do no>]` e um JSON com o formato
//   `DestaqueDeCodigo` definido abaixo, e a camada de hidratacao o anexa ao no
//   como o campo `destaque_sintaxe`.
//
// O campo NAO entra em src/contratos/manifesto.ts nem no schema: os dois sao
// singletons (S-4) e nao pertencem a este card. Por isso a leitura aqui e
// estrutural e conferida, nunca um cast cego.
// =============================================================================

import { interpolate } from "remotion";
import type { NoCodigo } from "../../contratos/manifesto";
import {
  background,
  border,
  borderRadius,
  fontFamily,
  highlight,
  lineHeight,
  msToFrames,
  spacing,
  state,
  text as corDeTexto,
  transitionDuration,
  typeScale,
} from "../../design/tokens";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";

// ---------------------------------------------------------------------------
// Metadados — a descoberta le isto do proprio modulo (Regra 6)
// ---------------------------------------------------------------------------

export const meta: NoComponentMeta = {
  tipo: "codigo",
  schema: "Codigo.1",
  id: "no-codigo",
  descricao: "Bloco de codigo com realce de linhas",
};

// ---------------------------------------------------------------------------
// O formato do destaque pre-computado
// ---------------------------------------------------------------------------

/** Versao do formato do artefato de destaque. Outra versao e recusada. */
export const FORMATO_DE_DESTAQUE = "DestaqueCodigo.1";

/**
 * Papeis lexicos que este componente sabe COLORIR (nao reconhecer).
 * Quem classifica e o destacador, acima da fronteira. Um papel fora desta
 * lista e recusado: pintar de cor default seria inventar significado.
 */
export const PAPEIS_DE_TOKEN = [
  "texto",
  "palavra-chave",
  "cadeia",
  "numero",
  "comentario",
  "funcao",
  "tipo",
  "operador",
] as const;

export type PapelDeToken = (typeof PAPEIS_DE_TOKEN)[number];

/** Um pedaco contiguo de uma linha, com o papel que o destacador atribuiu. */
export interface TokenDeDestaque {
  papel: PapelDeToken;
  /** Texto literal, ja recortado. A concatenacao reconstroi a linha. */
  texto: string;
}

/** Uma linha inteira, em tokens. Linha vazia = lista vazia. */
export interface LinhaDestacada {
  /** Numero da linha, base 1 — a mesma base de `linhas_destaque`. */
  numero: number;
  tokens: TokenDeDestaque[];
}

/** O artefato que F2-05 produz e a hidratacao anexa ao no. */
export interface DestaqueDeCodigo {
  formato: typeof FORMATO_DE_DESTAQUE;
  /** Linguagem que o destacador reconheceu — pode divergir da pedida. */
  linguagem: string;
  /** Identificacao do destacador e versao — entra na chave de cache (C12). */
  destacador: string;
  linhas: LinhaDestacada[];
}

/**
 * Cor de cada papel. TODA cor vem de src/design/tokens.ts (Regra 2): este
 * arquivo nao declara nenhum valor de cor, so escolhe qual token usa.
 *
 * NOTA PARA QUEM FOR MEXER: nao existe grupo `sintaxe` em tokens.ts hoje. O
 * mapa abaixo reaproveita os papeis semanticos que existem. Se o projeto
 * quiser uma paleta de sintaxe propria, isso e alteracao de S-5 (singleton) e
 * vira PREP — nao se resolve declarando cor aqui. Ver ledger AB-353.
 */
export const COR_POR_PAPEL: Record<PapelDeToken, string> = {
  texto: corDeTexto.primary,
  "palavra-chave": highlight.secondary,
  cadeia: state.success,
  numero: highlight.accent,
  comentario: corDeTexto.muted,
  funcao: highlight.primary,
  tipo: state.info,
  operador: corDeTexto.secondary,
};

/** Cor do codigo quando NAO ha destaque: uma cor so, sem significado. */
export const COR_SEM_DESTAQUE = corDeTexto.primary;

/**
 * Papeis cuja cor SO pode aparecer se houve destaque pre-computado.
 *
 * Os outros tres papeis (`texto`, `operador`, `comentario`) usam cinzas que a
 * moldura do proprio no tambem usa — nome do arquivo, borda, codigo sem
 * destaque. Contar esses cinzas como prova de destaque daria falso positivo no
 * pixel. Estes cinco sao cores saturadas que nenhuma outra parte do no desenha:
 * ver o quadro `no-codigo-cru`, onde nenhuma delas pode aparecer.
 */
export const PAPEIS_DISTINTIVOS: readonly PapelDeToken[] = [
  "palavra-chave",
  "cadeia",
  "numero",
  "funcao",
  "tipo",
];

/** Cores que a moldura do no usa e que, por isso, nao provam destaque nenhum. */
export const CORES_DA_MOLDURA: readonly string[] = [
  COR_SEM_DESTAQUE,
  corDeTexto.muted,
  corDeTexto.secondary,
  background.primary,
  background.secondary,
  background.elevated,
  border.default,
];

// ---------------------------------------------------------------------------
// Recusa
// ---------------------------------------------------------------------------

/** O destaque pre-computado discorda do codigo do no. Render nao segue. */
export class ErroDeDestaque extends Error {
  readonly erros: readonly string[];
  constructor(noId: string, erros: readonly string[]) {
    super(
      `no "${noId}": destaque pre-computado invalido (${String(erros.length)} erro(s)):\n` +
        erros.map((e) => `  - ${e}`).join("\n"),
    );
    this.name = "ErroDeDestaque";
    this.erros = erros;
  }
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function ehPapel(valor: unknown): valor is PapelDeToken {
  return (
    typeof valor === "string" && (PAPEIS_DE_TOKEN as readonly string[]).includes(valor)
  );
}

/**
 * Confere o artefato contra o codigo cru do no. Devolve TODOS os problemas.
 * Lista vazia = pode desenhar.
 *
 * A assercao que carrega o peso e a ultima: a concatenacao dos tokens de cada
 * linha tem de reconstruir aquela linha, caractere por caractere. Sem ela, um
 * destaque desalinhado (um caractere comido, um espaco a mais) passaria — e o
 * video mostraria um codigo que nao e o do manifesto, sem nada ficar vermelho.
 */
export function conferirDestaque(codigoCru: string, valor: unknown): string[] {
  const erros: string[] = [];

  if (!ehObjeto(valor)) {
    return [`destaque_sintaxe deveria ser objeto, veio ${typeof valor}`];
  }

  if (valor["formato"] !== FORMATO_DE_DESTAQUE) {
    erros.push(
      `formato "${String(valor["formato"])}" desconhecido ` +
        `(este componente desenha "${FORMATO_DE_DESTAQUE}")`,
    );
  }
  if (typeof valor["linguagem"] !== "string" || valor["linguagem"].trim() === "") {
    erros.push("linguagem ausente ou vazia");
  }
  if (typeof valor["destacador"] !== "string" || valor["destacador"].trim() === "") {
    erros.push("destacador ausente ou vazio (procedencia do artefato)");
  }

  const linhasCruas = codigoCru.split("\n");
  const linhas: unknown = valor["linhas"];
  if (!Array.isArray(linhas)) {
    erros.push(`linhas deveria ser lista, veio ${typeof linhas}`);
    return erros;
  }
  if (linhas.length !== linhasCruas.length) {
    erros.push(
      `o destaque tem ${String(linhas.length)} linha(s) e o codigo do no tem ` +
        `${String(linhasCruas.length)}`,
    );
    return erros;
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha: unknown = linhas[i];
    const onde = `linha ${String(i + 1)}`;
    if (!ehObjeto(linha)) {
      erros.push(`${onde}: deveria ser objeto, veio ${typeof linha}`);
      continue;
    }
    if (linha["numero"] !== i + 1) {
      erros.push(
        `${onde}: numero ${String(linha["numero"])} fora de ordem ` +
          `(esperado ${String(i + 1)}, base 1 e sem buraco)`,
      );
    }
    const tokens: unknown = linha["tokens"];
    if (!Array.isArray(tokens)) {
      erros.push(`${onde}: tokens deveria ser lista, veio ${typeof tokens}`);
      continue;
    }
    let reconstruida = "";
    for (let j = 0; j < tokens.length; j++) {
      const token: unknown = tokens[j];
      if (!ehObjeto(token)) {
        erros.push(`${onde}, token ${String(j)}: deveria ser objeto`);
        continue;
      }
      if (!ehPapel(token["papel"])) {
        erros.push(
          `${onde}, token ${String(j)}: papel "${String(token["papel"])}" desconhecido ` +
            `(papeis: ${PAPEIS_DE_TOKEN.join(", ")})`,
        );
      }
      if (typeof token["texto"] !== "string") {
        erros.push(`${onde}, token ${String(j)}: texto deveria ser string`);
        continue;
      }
      reconstruida += token["texto"];
    }
    const crua = linhasCruas[i] ?? "";
    if (reconstruida !== crua) {
      erros.push(
        `${onde}: os tokens nao reconstroem o codigo do no ` +
          `(tokens: ${JSON.stringify(reconstruida)}, no: ${JSON.stringify(crua)})`,
      );
    }
  }

  return erros;
}

/** Como o no chegou: com destaque conferido, ou sem destaque nenhum. */
export interface LeituraDeDestaque {
  destaque: DestaqueDeCodigo | null;
  estado: "pre-computado" | "ausente";
}

/**
 * Le `destaque_sintaxe` do no. Ausente devolve `null` (desenha cru);
 * presente e torto ESTOURA. Nunca improvisa tokens.
 */
export function lerDestaque(no: NoCodigo): LeituraDeDestaque {
  const bruto: unknown = (no as unknown as Record<string, unknown>)["destaque_sintaxe"];
  if (bruto === undefined || bruto === null) {
    return { destaque: null, estado: "ausente" };
  }
  const erros = conferirDestaque(no.codigo, bruto);
  if (erros.length > 0) {
    throw new ErroDeDestaque(no.id, erros);
  }
  return { destaque: bruto as unknown as DestaqueDeCodigo, estado: "pre-computado" };
}

// ---------------------------------------------------------------------------
// O componente
// ---------------------------------------------------------------------------

const Codigo: NoComponent = ({ no, frame, fps, height }) => {
  const codigo = no as NoCodigo;

  // A janela declarada e do no, nao do envelope. O <Sequence> ja janela em
  // producao, mas um componente que desenha fora da propria duracao vaza
  // quando alguem o monta direto (Studio, teste, still). Aqui ele nao vaza.
  if (frame < 0 || frame >= codigo.duracao_frames) {
    return null;
  }

  const entrada = Math.max(1, msToFrames(transitionDuration.base, fps));
  const opacidade = interpolate(frame, [0, entrada], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const linhasCruas = codigo.codigo.split("\n");
  const realcadas = new Set(codigo.linhas_destaque ?? []);
  const leitura = lerDestaque(codigo);

  const corpo = Math.round(height * typeScale.caption);
  const alturaDaLinha = Math.round(corpo * lineHeight.normal);

  return (
    <div
      data-no={codigo.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      data-destaque={leitura.estado}
      data-linguagem={codigo.linguagem}
      data-destacador={leitura.destaque?.destacador ?? ""}
      data-linguagem-destacada={leitura.destaque?.linguagem ?? ""}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        paddingLeft: spacing["20"],
        paddingRight: spacing["20"],
        backgroundColor: background.primary,
        opacity: opacidade,
      }}
    >
      {codigo.nome_arquivo !== undefined ? (
        <div
          data-parte="nome-arquivo"
          style={{
            fontSize: Math.round(height * typeScale.small),
            color: corDeTexto.muted,
            fontFamily: fontFamily.mono,
            marginBottom: spacing["3"],
          }}
        >
          {codigo.nome_arquivo}
        </div>
      ) : null}
      <pre
        data-parte="bloco"
        style={{
          margin: 0,
          padding: spacing["6"],
          backgroundColor: background.secondary,
          borderRadius: borderRadius.md,
          borderStyle: "solid",
          borderWidth: spacing["1"] / 4,
          borderColor: border.default,
          overflow: "hidden",
          fontSize: corpo,
          fontFamily: fontFamily.mono,
          lineHeight: lineHeight.normal,
          color: COR_SEM_DESTAQUE,
        }}
      >
        {linhasCruas.map((crua, i) => {
          const numero = i + 1;
          const tokens = leitura.destaque?.linhas[i]?.tokens;
          return (
            <div
              key={`${String(numero)}:${crua}`}
              data-linha={String(numero)}
              data-realcada={realcadas.has(numero) ? "sim" : "nao"}
              style={{
                backgroundColor: realcadas.has(numero)
                  ? background.elevated
                  : background.secondary,
                height: alturaDaLinha,
                paddingLeft: spacing["2"],
                paddingRight: spacing["2"],
                borderRadius: borderRadius.sm,
                whiteSpace: "pre",
              }}
            >
              {tokens === undefined
                ? crua
                : tokens.map((token, j) => (
                    <span
                      // eslint-disable-next-line react/no-array-index-key
                      key={`${String(j)}:${token.papel}:${token.texto}`}
                      data-papel={token.papel}
                      style={{ color: COR_POR_PAPEL[token.papel] }}
                    >
                      {token.texto}
                    </span>
                  ))}
            </div>
          );
        })}
      </pre>
    </div>
  );
};

export default Codigo;
