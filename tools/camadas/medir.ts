#!/usr/bin/env npx tsx
// =============================================================================
// medir.ts — le os PNGs do cenario de prova e mede a cobertura da safe area
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// Dois subcomandos:
//
//   parametros   imprime as variaveis do render (frame, ids, entrada) para o
//                gate consumir. Existe para que o shell NAO redigite numero
//                nenhum: frame, duracao e resolucao vem de prova/cena.tsx,
//                que os deriva de tokens.
//
//   medir --dir  compara cada PNG com o PNG de referencia e aplica o veredito
//                esperado de cada composicao. Composicao marcada `reprova`
//                que APROVA derruba o gate: e sinal de que o medidor ficou
//                cego, e um medidor cego e pior que nenhum.
// =============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  retanguloSeguro,
  type ModuloDeCamada,
} from "../../src/composicao/camadas/contrato-de-camada";
import {
  ALTURA_DA_PROVA,
  COMPOSICOES_DA_PROVA,
  DURACAO_DA_PROVA,
  FPS_DA_PROVA,
  FRAME_DA_PROVA,
  LARGURA_DA_PROVA,
  propsDaProva,
  resolverCamadas,
  type ComposicaoDeProva,
} from "../../src/composicao/camadas/prova/cena";
import { decodificarPng } from "./png";
import {
  medirCamada,
  relatarMedicao,
  type RetanguloDeclarado,
} from "./medicao";

const RAIZ = resolve(import.meta.dirname, "..", "..");
const ENTRADA = "src/composicao/camadas/prova/index.tsx";
const REFERENCIA = "camadas-sem";

/** Retangulos declarados por uma composicao = uniao dos planos das camadas. */
function declaradosDe(comp: ComposicaoDeProva): RetanguloDeclarado[] {
  const props = propsDaProva(FRAME_DA_PROVA);
  const modulos: ModuloDeCamada[] = resolverCamadas(comp.camadas);
  const retangulos: RetanguloDeclarado[] = [];
  for (const modulo of modulos) {
    for (const r of modulo.plano(props)) {
      retangulos.push({
        nome: `${modulo.meta.nome}/${r.nome}`,
        x: r.x,
        y: r.y,
        largura: r.largura,
        altura: r.altura,
        opacidade: r.opacidade,
      });
    }
  }
  return retangulos;
}

function imprimirParametros(): void {
  const ids = COMPOSICOES_DA_PROVA.map((c) => c.id);
  const aprovados = COMPOSICOES_DA_PROVA.filter(
    (c) => c.esperado !== "reprova",
  ).map((c) => c.id);
  const linhas = [
    `CAMADAS_ENTRADA='${ENTRADA}'`,
    `CAMADAS_FRAME=${String(FRAME_DA_PROVA)}`,
    `CAMADAS_DURACAO=${String(DURACAO_DA_PROVA)}`,
    `CAMADAS_FPS=${String(FPS_DA_PROVA)}`,
    `CAMADAS_LARGURA=${String(LARGURA_DA_PROVA)}`,
    `CAMADAS_ALTURA=${String(ALTURA_DA_PROVA)}`,
    `CAMADAS_REFERENCIA='${REFERENCIA}'`,
    `CAMADAS_IDS='${ids.join(" ")}'`,
    `CAMADAS_APROVADOS='${aprovados.join(" ")}'`,
  ];
  process.stdout.write(linhas.join("\n") + "\n");
}

function medirTudo(diretorio: string): number {
  const seguro = retanguloSeguro(LARGURA_DA_PROVA, ALTURA_DA_PROVA);
  const caminho = (id: string): string => resolve(diretorio, `${id}.png`);

  const referencia = decodificarPng(readFileSync(caminho(REFERENCIA)));

  process.stdout.write(
    `safe area protegida: x=${String(seguro.x)} y=${String(seguro.y)} ` +
      `${String(seguro.largura)}x${String(seguro.altura)} ` +
      `(action safe de tokens.safeArea16x9, o maior dos dois retangulos)\n`,
  );
  process.stdout.write(
    `frame amostrado: ${String(FRAME_DA_PROVA)} de ${String(DURACAO_DA_PROVA)}\n\n`,
  );

  let falhas = 0;

  for (const comp of COMPOSICOES_DA_PROVA) {
    if (comp.esperado === "referencia") continue;

    const imagem = decodificarPng(readFileSync(caminho(comp.id)));
    const declarados = declaradosDe(comp);
    const medicao = medirCamada(comp.id, referencia, imagem, seguro, declarados);

    const esperaAprovar = comp.esperado === "aprova";
    const ok = medicao.aprova === esperaAprovar;

    process.stdout.write(`${relatarMedicao(medicao)}\n`);
    if (ok) {
      process.stdout.write(
        `        esperado: ${comp.esperado} — ${comp.motivo}\n\n`,
      );
    } else {
      falhas++;
      process.stdout.write(
        `        FALHOU: esperado ${comp.esperado}, medido ` +
          `${medicao.aprova ? "aprova" : "reprova"} — ${comp.motivo}\n\n`,
      );
    }
  }

  // --- Denominador: um catalogo vazio sairia verde sem olhar nada (C2) ---
  const medidas = COMPOSICOES_DA_PROVA.filter((c) => c.esperado !== "referencia");
  const sondas = medidas.filter((c) => c.esperado === "reprova");
  if (medidas.length === 0 || sondas.length === 0) {
    process.stdout.write(
      "FALHOU: catalogo de prova sem composicao medida ou sem sonda negativa — " +
        "um gate que so foi visto aprovando nunca foi visto funcionando\n",
    );
    falhas++;
  }

  process.stdout.write(
    `${String(medidas.length)} composicao(oes) medida(s), ` +
      `${String(sondas.length)} sonda(s) negativa(s), ` +
      `${String(falhas)} falha(s)\n`,
  );

  return falhas === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const [subcomando, ...resto] = process.argv.slice(2);

if (subcomando === "parametros") {
  imprimirParametros();
  process.exit(0);
}

if (subcomando === "medir") {
  const idx = resto.indexOf("--dir");
  const dir = idx >= 0 ? resto[idx + 1] : undefined;
  if (!dir) {
    process.stderr.write("uso: medir.ts medir --dir <diretorio-com-os-pngs>\n");
    process.exit(2);
  }
  process.exit(medirTudo(resolve(RAIZ, dir)));
}

process.stderr.write(
  "uso: medir.ts parametros | medir.ts medir --dir <diretorio>\n",
);
process.exit(2);
