// =============================================================================
// PIXELS — o oraculo de pixel dos snapshots de transicao (CLI)
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// AGENTS.md, C1: "`exit 0` de um render nao prova que saiu imagem. Quadro
// preto = sucesso." Este CLI decodifica os PNGs de um diretorio de render
// (tools/transicoes/png.ts) e exige, quadro a quadro, o PIXEL PREVISTO pela
// demonstracao — as mesmas assercoes que tests/composicao/transicoes.test.ts
// faz sobre os aprovados, aqui sobre o render RECEM-PRODUZIDO, para o
// provar.sh poder rodar as duas coisas em sequencia.
//
// Cada quadro tem um `prova` (tools/transicoes/quadros.ts): o que ele
// REPROVARIA se quebrasse. Um quadro preto, uma cor so, um lado faltando ou
// uma transicao invertida produzem outra cor — e este CLI acusa pelo VALOR
// do pixel, nomeando o quadro e o motivo.
//
// Uso:
//   npx tsx tools/transicoes/pixels.ts <diretorio-dos-pngs>
// Exit: 0 = todo quadro tem o pixel prometido; 1 = algum quadro reprovou.
// =============================================================================

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { background } from "../../src/design/tokens";
import {
  DEMO_ALTURA,
  DEMO_CENA_A,
  DEMO_CENA_B,
  DEMO_LARGURA,
  corDaCena,
} from "../../src/composicao/transicoes/demonstracao";
import {
  QUADROS,
  arquivoDoQuadro,
  type Quadro,
} from "./quadros";
import {
  corDeHex,
  corRelativa,
  coresDistintas,
  distancia,
  fracaoProxima,
  lerPng,
  misturar,
  type Cor,
  type Imagem,
} from "./png";

const COR_A = corDeHex(corDaCena(DEMO_CENA_A));
const COR_B = corDeHex(corDaCena(DEMO_CENA_B));
const COR_PALCO = corDeHex(background.primary);
/** Mistura 50/50 das duas cores — o pixel que nenhum lado produz sozinho. */
const BLEND_MEIO = misturar(COR_A, COR_B, 0.5);

const TOLERANCIA = 2;

const DIR = process.argv[2];
if (!DIR) {
  console.error("uso: npx tsx tools/transicoes/pixels.ts <diretorio-dos-pngs>");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// O oraculo por quadro. Cada assercao espelha o que o snapshot aprovado
// promete em tests/composicao/transicoes.test.ts — e e capaz de REPROVAR.
// ---------------------------------------------------------------------------

/** Uma assercao nomeada sobre um quadro. */
interface Assercao {
  nome: string;
  /** Por que ela existe — vira mensagem de falha. */
  motivo: string;
  verificar: (imagem: Imagem) => boolean;
}

/** Checa um pixel relativo com tolerancia. */
function perto(imagem: Imagem, fx: number, fy: number, alvo: Cor): boolean {
  return distancia(corRelativa(imagem, fx, fy), alvo) <= TOLERANCIA;
}

function assercoesDo(quadro: Quadro): Assercao[] {
  const comuns: Assercao[] = [
    {
      nome: "C1 entropia",
      motivo: "quadro preto ou cor unica = render vazio = sucesso falso (AGENTS.md, C1)",
      verificar: (imagem) => coresDistintas(imagem) > 1,
    },
    {
      nome: "tamanho da demonstracao",
      motivo: "o pixel e asserido em coordenadas RELATIVAS — o tamanho errado muda tudo",
      verificar: (imagem) => imagem.largura === DEMO_LARGURA && imagem.altura === DEMO_ALTURA,
    },
  ];

  const especificas: Record<string, Assercao[]> = {
    "fade-antes": [
      {
        nome: "tela = cena A inteira",
        motivo: "fora da fronteira so a cena que sai desenha",
        verificar: (imagem) => fracaoProxima(imagem, COR_A, TOLERANCIA) > 0.9,
      },
    ],
    "fade-meio": [
      {
        nome: "centro = mistura 50/50",
        motivo: "o pixel do meio da fronteira e a mistura que NENHUM lado produz sozinho",
        verificar: (imagem) => perto(imagem, 0.5, 0.5, BLEND_MEIO),
      },
      {
        nome: "a tela e a mistura",
        motivo: "os DOIS lados desenharam por cima do palco",
        verificar: (imagem) => fracaoProxima(imagem, BLEND_MEIO, TOLERANCIA) > 0.8,
      },
      {
        nome: "nenhum lado sozinho domina",
        motivo: "se so um lado desenhasse, a cor pura dele cobriria a tela",
        verificar: (imagem) =>
          fracaoProxima(imagem, COR_A, TOLERANCIA) < 0.05 &&
          fracaoProxima(imagem, COR_B, TOLERANCIA) < 0.05,
      },
    ],
    "fade-depois": [
      {
        nome: "tela = cena B inteira",
        motivo: "depois da fronteira so a cena que entra desenha",
        verificar: (imagem) => fracaoProxima(imagem, COR_B, TOLERANCIA) > 0.9,
      },
    ],
    "wipe-meio": [
      {
        nome: "esquerda B, direita A",
        motivo: "a varredura parte a tela ao meio: a que entra a esquerda, a que sai a direita",
        verificar: (imagem) => perto(imagem, 0.25, 0.5, COR_B) && perto(imagem, 0.75, 0.5, COR_A),
      },
    ],
    "clock-wipe-meio": [
      {
        nome: "setor de 180 graus revela a direita",
        motivo: "a varredura circular sai das 12h no sentido horario; invertida, acusa aqui",
        verificar: (imagem) =>
          perto(imagem, 0.25, 0.5, COR_A) &&
          perto(imagem, 0.75, 0.5, COR_B) &&
          perto(imagem, 0.5, 0.25, COR_B),
      },
    ],
    "slide-meio": [
      {
        nome: "esquerda B, direita A",
        motivo: "as duas cenas deslocadas de meia tela, encostadas",
        verificar: (imagem) => perto(imagem, 0.25, 0.5, COR_B) && perto(imagem, 0.75, 0.5, COR_A),
      },
      {
        nome: "canto inferior-esquerdo = B",
        motivo: "a cena B TRANSLADOU ate la — um recorte (wipe) nao chegaria",
        verificar: (imagem) => perto(imagem, 0.1, 0.85, COR_B),
      },
    ],
    "cube-meio": [
      {
        nome: "esquerda B, direita A",
        motivo: "as duas faces do cubo em quina",
        verificar: (imagem) => perto(imagem, 0.25, 0.5, COR_B) && perto(imagem, 0.75, 0.5, COR_A),
      },
      {
        nome: "palco na borda",
        motivo: "a perspectiva mostra o palco alem das faces",
        verificar: (imagem) => perto(imagem, 0.02, 0.5, COR_PALCO),
      },
      {
        nome: "perspectiva rica",
        motivo: "a quina do cubo mistura cor e gradiente — tela chapada nao produz 100+ cores",
        verificar: (imagem) => coresDistintas(imagem) > 100,
      },
    ],
    "flip-quarto": [
      {
        nome: "centro = face que sai (A)",
        motivo: "a um quarto do giro so a face que sai esta de frente (backface)",
        verificar: (imagem) => perto(imagem, 0.5, 0.5, COR_A),
      },
      {
        nome: "palco na borda direita",
        motivo: "a face ja rotacionada abre o palco na borda",
        verificar: (imagem) => perto(imagem, 0.98, 0.5, COR_PALCO),
      },
      {
        nome: "rotacao rica",
        motivo: "a rotacao deforma a cor em gradiente — tela chapada nao produz 100+ cores",
        verificar: (imagem) => coresDistintas(imagem) > 100,
      },
    ],
    "none-meio": [
      {
        nome: "tela = cena B inteira",
        motivo: "corte seco: o que entra cobre o que sai",
        verificar: (imagem) => fracaoProxima(imagem, COR_B, TOLERANCIA) > 0.9,
      },
    ],
  };

  return [...comuns, ...(especificas[quadro.nome] ?? [])];
}

// ---------------------------------------------------------------------------
// Execucao
// ---------------------------------------------------------------------------

let falhou = 0;

for (const quadro of QUADROS) {
  const caminho = join(DIR, arquivoDoQuadro(quadro));
  let imagem: Imagem;
  try {
    imagem = lerPng(readFileSync(caminho));
  } catch (causa) {
    console.log(`VERMELHO: ${quadro.nome}.png — AUSENTE ou ilegivel: ${String(causa)}`);
    falhou = 1;
    continue;
  }

  const reprovadas: string[] = [];
  for (const assercao of assercoesDo(quadro)) {
    if (!assercao.verificar(imagem)) {
      reprovadas.push(assercao.nome);
    }
  }

  if (reprovadas.length > 0) {
    console.log(`VERMELHO: ${quadro.nome}.png — ${reprovadas.join("; ")}`);
    console.log(`  ${quadro.prova}`);
    falhou = 1;
  } else {
    console.log(`ok: ${quadro.nome}.png (${String(coresDistintas(imagem))} cores distintas)`);
  }
}

if (falhou !== 0) {
  console.log("");
  console.log("=== VERMELHO: o oraculo de pixel reprovou — o render nao desenha o prometido ===");
  process.exit(1);
}

console.log("");
console.log(`=== VERDE: ${String(QUADROS.length)} quadros com o pixel prometido (C1) ===`);
