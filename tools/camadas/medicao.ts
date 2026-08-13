// =============================================================================
// MEDICAO DE COBERTURA — a assercao que da nome ao card, em pixel
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// Entram dois PNGs do MESMO cenario: um sem camada nenhuma (referencia) e um
// com a camada ligada. Sai um numero por pergunta:
//
//   1. INVASAO   quantos pixels DENTRO da safe area mudaram.  Tem de ser 0.
//                Esta e a pergunta do card. Ela vale para os tres papeis:
//                um fundo tambem reprova aqui se subir de z-index, porque
//                nesse caso ele passa a apagar o conteudo.
//
//   2. VAZAMENTO quantos pixels mudaram FORA de todo retangulo declarado.
//                Tem de ser 0 — a camada nao pinta o que nao declarou, senao
//                a medicao geometrica estaria medindo outra coisa que nao o
//                que aparece no video.
//
//   3. ENTROPIA  quais retangulos declarados nao mudaram NENHUM pixel.
//                Tem de ser lista vazia. E esta a resposta para "o smoke
//                passaria com o componente devolvendo quadro vazio?": nao,
//                porque quadro vazio deixa TODOS os retangulos sem pixel, e
//                uma camada correta so passa se cada retangulo declarado
//                tiver de fato virado pixel.
//
// Sem (3), uma camada decorativa que nao desenha nada e indistinguivel de uma
// camada transparente correta — os dois renderizam, os dois saem com codigo 0.
// =============================================================================

import { contemPonto, type Retangulo } from "../../src/composicao/camadas/geometria";
import type { ImagemRgba } from "./png";

/** Retangulo declarado pela camada, na forma que atravessa o JSON do plano. */
export interface RetanguloDeclarado extends Retangulo {
  nome: string;
  opacidade: number;
}

/** Um pixel que mudou, com a cor dos dois lados — para a mensagem de erro. */
export interface PixelDivergente {
  x: number;
  y: number;
  referencia: [number, number, number, number];
  camada: [number, number, number, number];
}

export interface MedicaoDeCamada {
  camada: string;
  largura: number;
  altura: number;
  /** Total de pixels diferentes entre referencia e camada. */
  totalDiferentes: number;
  /** Pixels diferentes DENTRO da safe area. Zero e a unica nota de aprovacao. */
  diferentesNoSeguro: number;
  /** O primeiro pixel invadido, para a mensagem nomear onde. */
  primeiroNoSeguro: PixelDivergente | null;
  /** Pixels diferentes fora de todo retangulo declarado. */
  diferentesForaDoDeclarado: number;
  primeiroForaDoDeclarado: PixelDivergente | null;
  /** Retangulos declarados que nao produziram nenhum pixel diferente. */
  retangulosSemPixel: string[];
  /** Quantos retangulos foram declarados. */
  retangulosDeclarados: number;
  aprova: boolean;
  motivos: string[];
}

function corEm(
  img: ImagemRgba,
  i: number,
): [number, number, number, number] {
  return [
    img.dados[i] ?? 0,
    img.dados[i + 1] ?? 0,
    img.dados[i + 2] ?? 0,
    img.dados[i + 3] ?? 0,
  ];
}

/** `true` quando os quatro canais sao identicos. Zero tolerancia: o render e deterministico. */
function iguais(a: ImagemRgba, b: ImagemRgba, i: number): boolean {
  return (
    a.dados[i] === b.dados[i] &&
    a.dados[i + 1] === b.dados[i + 1] &&
    a.dados[i + 2] === b.dados[i + 2] &&
    a.dados[i + 3] === b.dados[i + 3]
  );
}

/**
 * Mede uma camada contra a referencia.
 *
 * Zero tolerancia de cor: os dois PNGs saem do MESMO render deterministico,
 * do mesmo cenario, no mesmo frame. Qualquer diferenca de canal e a camada,
 * nao ruido — e uma tolerancia aqui seria exatamente o buraco por onde uma
 * invasao de baixa opacidade passaria sem ser vista.
 */
export function medirCamada(
  nome: string,
  referencia: ImagemRgba,
  comCamada: ImagemRgba,
  seguro: Retangulo,
  declarados: readonly RetanguloDeclarado[],
): MedicaoDeCamada {
  if (
    referencia.largura !== comCamada.largura ||
    referencia.altura !== comCamada.altura
  ) {
    throw new Error(
      `medicao impossivel: referencia ${String(referencia.largura)}x${String(referencia.altura)} ` +
        `e camada ${String(comCamada.largura)}x${String(comCamada.altura)}`,
    );
  }

  const { largura, altura } = referencia;
  let totalDiferentes = 0;
  let diferentesNoSeguro = 0;
  let primeiroNoSeguro: PixelDivergente | null = null;
  let diferentesForaDoDeclarado = 0;
  let primeiroForaDoDeclarado: PixelDivergente | null = null;

  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = (y * largura + x) * 4;
      if (iguais(referencia, comCamada, i)) continue;
      totalDiferentes++;

      if (contemPonto(seguro, x, y)) {
        diferentesNoSeguro++;
        primeiroNoSeguro ??= {
          x,
          y,
          referencia: corEm(referencia, i),
          camada: corEm(comCamada, i),
        };
        continue;
      }

      let declarado = false;
      for (const r of declarados) {
        if (contemPonto(r, x, y)) {
          declarado = true;
          break;
        }
      }
      if (!declarado) {
        diferentesForaDoDeclarado++;
        primeiroForaDoDeclarado ??= {
          x,
          y,
          referencia: corEm(referencia, i),
          camada: corEm(comCamada, i),
        };
      }
    }
  }

  // --- Entropia por retangulo: cada declarado tem de ter virado pixel ---
  const retangulosSemPixel: string[] = [];
  for (const r of declarados) {
    let achou = false;
    const xFim = Math.min(largura, r.x + r.largura);
    const yFim = Math.min(altura, r.y + r.altura);
    for (let y = Math.max(0, r.y); y < yFim && !achou; y++) {
      for (let x = Math.max(0, r.x); x < xFim; x++) {
        if (!iguais(referencia, comCamada, (y * largura + x) * 4)) {
          achou = true;
          break;
        }
      }
    }
    if (!achou) retangulosSemPixel.push(r.nome);
  }

  const motivos: string[] = [];
  if (diferentesNoSeguro > 0) {
    const p = primeiroNoSeguro;
    motivos.push(
      `INVASAO: ${String(diferentesNoSeguro)} pixel(s) mudaram DENTRO da safe area ` +
        `[${String(seguro.x)},${String(seguro.y)} ${String(seguro.largura)}x${String(seguro.altura)}]` +
        (p
          ? ` — primeiro em (${String(p.x)},${String(p.y)}): ` +
            `${p.referencia.join(",")} -> ${p.camada.join(",")}`
          : ""),
    );
  }
  if (diferentesForaDoDeclarado > 0) {
    const p = primeiroForaDoDeclarado;
    motivos.push(
      `VAZAMENTO: ${String(diferentesForaDoDeclarado)} pixel(s) mudaram fora de todo ` +
        `retangulo declarado` +
        (p ? ` — primeiro em (${String(p.x)},${String(p.y)})` : ""),
    );
  }
  if (declarados.length === 0) {
    motivos.push(
      "QUADRO VAZIO: a camada nao declarou retangulo nenhum — nada a medir, e " +
        "um seletor vazio nunca pode contar como aprovacao (C2)",
    );
  }
  if (retangulosSemPixel.length > 0) {
    motivos.push(
      `SEM PIXEL: ${String(retangulosSemPixel.length)} de ${String(declarados.length)} ` +
        `retangulo(s) declarado(s) nao mudaram nenhum pixel: ` +
        retangulosSemPixel.slice(0, 5).join(", ") +
        (retangulosSemPixel.length > 5 ? ", ..." : ""),
    );
  }
  if (totalDiferentes === 0) {
    motivos.push(
      "QUADRO VAZIO: a camada nao mudou UM pixel do cenario — indistinguivel " +
        "de um componente que devolveu quadro vazio",
    );
  }

  return {
    camada: nome,
    largura,
    altura,
    totalDiferentes,
    diferentesNoSeguro,
    primeiroNoSeguro,
    diferentesForaDoDeclarado,
    primeiroForaDoDeclarado,
    retangulosSemPixel,
    retangulosDeclarados: declarados.length,
    aprova: motivos.length === 0,
    motivos,
  };
}

/** Linha de relatorio de uma medicao, para a saida do gate. */
export function relatarMedicao(m: MedicaoDeCamada): string {
  const cabeca =
    `${m.aprova ? "APROVA" : "REPROVA"}  ${m.camada}: ` +
    `${String(m.totalDiferentes)} pixel(s) mudaram, ` +
    `${String(m.diferentesNoSeguro)} dentro da safe area, ` +
    `${String(m.retangulosDeclarados)} retangulo(s) declarado(s)`;
  if (m.motivos.length === 0) return cabeca;
  return [cabeca, ...m.motivos.map((s) => `        ${s}`)].join("\n");
}
