// =============================================================================
// Fixture do no de codigo — F1-08
// =============================================================================
// Dois nos com o MESMO codigo cru e a mesma janela de tempo. A unica diferenca
// e o campo `destaque_sintaxe`:
//
//   NO_COM_DESTAQUE  — traz os tokens ja computados (o que F2-05 entrega).
//   NO_SEM_DESTAQUE  — nao traz nada. O componente desenha cru e marca.
//
// Os tokens abaixo foram escritos A MAO, de proposito: este repositorio nao
// tem destacador embaixo da fronteira de determinismo, e este arquivo nao vai
// ser o primeiro. O componente confere que a concatenacao dos tokens de cada
// linha reconstroi a linha crua — se eu errar um espaco aqui, o gate fica
// vermelho.
// =============================================================================

import type { NoCodigo } from "../../../src/contratos/manifesto";
import {
  FORMATO_DE_DESTAQUE,
  type DestaqueDeCodigo,
  type LinhaDestacada,
  type PapelDeToken,
} from "../../../src/composicao/nos/codigo";

/** Um no de codigo com o campo extra que a hidratacao anexa. */
export type NoCodigoHidratado = NoCodigo & {
  destaque_sintaxe?: DestaqueDeCodigo;
};

// ---------------------------------------------------------------------------
// O codigo cru — a fonte da verdade das linhas
// ---------------------------------------------------------------------------

export const CODIGO_CRU = [
  "// destaque pre-computado: o render so desenha",
  'import { destacar } from "./destacador";',
  "",
  "export const LIMITE: number = 42;",
  "export function tokenizar(codigo: string): Token[] {",
  "  return destacar(codigo).slice(0, LIMITE);",
  "}",
].join("\n");

// ---------------------------------------------------------------------------
// Os tokens, um por papel
// ---------------------------------------------------------------------------

type Par = [PapelDeToken, string];

function linha(numero: number, pares: Par[]): LinhaDestacada {
  return {
    numero,
    tokens: pares.map(([papel, texto]) => ({ papel, texto })),
  };
}

/** Os oito papeis aparecem: o still de prova exercita a paleta inteira. */
export const DESTAQUE: DestaqueDeCodigo = {
  formato: FORMATO_DE_DESTAQUE,
  linguagem: "typescript",
  destacador: "destacador-de-mentira 0.0.0-fixture",
  linhas: [
    linha(1, [["comentario", "// destaque pre-computado: o render so desenha"]]),
    linha(2, [
      ["palavra-chave", "import"],
      ["texto", " "],
      ["operador", "{"],
      ["texto", " "],
      ["funcao", "destacar"],
      ["texto", " "],
      ["operador", "}"],
      ["texto", " "],
      ["palavra-chave", "from"],
      ["texto", " "],
      ["cadeia", '"./destacador"'],
      ["operador", ";"],
    ]),
    linha(3, []),
    linha(4, [
      ["palavra-chave", "export"],
      ["texto", " "],
      ["palavra-chave", "const"],
      ["texto", " "],
      ["texto", "LIMITE"],
      ["operador", ":"],
      ["texto", " "],
      ["tipo", "number"],
      ["texto", " "],
      ["operador", "="],
      ["texto", " "],
      ["numero", "42"],
      ["operador", ";"],
    ]),
    linha(5, [
      ["palavra-chave", "export"],
      ["texto", " "],
      ["palavra-chave", "function"],
      ["texto", " "],
      ["funcao", "tokenizar"],
      ["operador", "("],
      ["texto", "codigo"],
      ["operador", ":"],
      ["texto", " "],
      ["tipo", "string"],
      ["operador", ")"],
      ["operador", ":"],
      ["texto", " "],
      ["tipo", "Token"],
      ["operador", "[]"],
      ["texto", " "],
      ["operador", "{"],
    ]),
    linha(6, [
      ["texto", "  "],
      ["palavra-chave", "return"],
      ["texto", " "],
      ["funcao", "destacar"],
      ["operador", "("],
      ["texto", "codigo"],
      ["operador", ")"],
      ["operador", "."],
      ["funcao", "slice"],
      ["operador", "("],
      ["numero", "0"],
      ["operador", ","],
      ["texto", " "],
      ["texto", "LIMITE"],
      ["operador", ")"],
      ["operador", ";"],
    ]),
    linha(7, [["operador", "}"]]),
  ],
};

// ---------------------------------------------------------------------------
// Os dois nos
// ---------------------------------------------------------------------------

/** Janela declarada do no, em frames. O still e tirado dentro dela. */
export const DURACAO_FRAMES = 90;

/** Frame do still aprovado — depois do fade de entrada, opacidade cheia. */
export const FRAME_DO_STILL = 20;

const BASE: NoCodigo = {
  id: "n-codigo-fixture",
  schema: "Codigo.1",
  type: "codigo",
  duracao_frames: DURACAO_FRAMES,
  codigo: CODIGO_CRU,
  linguagem: "typescript",
  linhas_destaque: [4, 5],
  nome_arquivo: "destacador.ts",
};

/** O caso feliz: tokens ja computados chegam prontos. */
export const NO_COM_DESTAQUE: NoCodigoHidratado = {
  ...BASE,
  destaque_sintaxe: DESTAQUE,
};

/** O caso do card: codigo cru, sem tokens. O componente NAO adivinha. */
export const NO_SEM_DESTAQUE: NoCodigoHidratado = { ...BASE, id: "n-codigo-cru" };
