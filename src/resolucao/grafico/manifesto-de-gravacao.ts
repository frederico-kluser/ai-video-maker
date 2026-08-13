/**
 * src/resolucao/grafico/manifesto-de-gravacao.ts
 *
 * O manifesto contra o qual o cassete de `grafico` foi gravado. Card F2-02.
 *
 * Ele mora no codigo, e nao num JSON solto, porque a chave de cache do
 * cassete e SHA-256 do manifesto: quem quiser reproduzir a gravacao precisa
 * do mesmo manifesto byte a byte, e o compilador e melhor guardiao disso do
 * que a memoria de quem regrava.
 *
 * Por que nao a fixture canonica (`fixtures/canonico/manifesto-valido.json`):
 * ela nao e minha — F1-01 e dono dela, e ela muda com a composicao. Um
 * cassete atrelado a um arquivo de outro card viraria cache miss no primeiro
 * ajuste do dono, e o ∅-crit acusaria o card errado.
 *
 * As dimensoes sao pequenas de proposito: o cassete e versionado no git e o
 * render e um passo manual. 480x270 a 15 fps renderiza em ~1 s e exercita
 * exatamente o mesmo caminho de codigo que 1920x1080.
 *
 * Os dois nos cobrem coisas diferentes:
 *   g-001  barras, cor por nome do Manim — `CYAN`, que NAO existe no
 *          namespace de `from manim import *`. E o call-site vivo do quirk
 *          COLOR_FALLBACKS: sem ele, `NameError` dentro do subprocesso.
 *   g-002  linha, SEM cor declarada — exercita a cor de serie vinda dos
 *          tokens de design, e um tipo de grafico com geometria de pontos
 *          em vez de retangulos.
 */

import type { Manifesto } from "../../contratos/manifesto.js";

/** O manifesto da gravacao. Congelado: mudar aqui muda a chave do cassete. */
export const MANIFESTO_DE_GRAVACAO: Manifesto = {
  schema_version: "Manifesto.1",
  fps: 15,
  width: 480,
  height: 270,
  nos: [
    {
      id: "g-001",
      schema: "Grafico.1",
      type: "grafico",
      duracao_frames: 15,
      tipo_grafico: "barras",
      titulo: "Cassetes por onda",
      dados: [
        { rotulo: "W3", valor: 1, cor: "CYAN" },
        { rotulo: "W4", valor: 5, cor: "CYAN" },
        { rotulo: "W5", valor: 3, cor: "CYAN" },
      ],
    },
    {
      id: "g-002",
      schema: "Grafico.1",
      type: "grafico",
      duracao_frames: 15,
      tipo_grafico: "linha",
      titulo: "Reducao de refutacoes",
      dados: [
        { rotulo: "seg", valor: 4 },
        { rotulo: "ter", valor: 2 },
        { rotulo: "qua", valor: 6 },
      ],
    },
  ],
  cenas: [{ id: "c-001", nos: ["g-001", "g-002"] }],
};
