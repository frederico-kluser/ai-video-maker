// =============================================================================
// Gera a fixture integrada — o manifesto canonico MAIS a camada de resolucao
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// A suite integrada renderiza o manifesto canonico (fixtures/canonico,
// imutavel — S-4 adjacente) com a FIACAO anexada: `assets` e `nos_grafico`,
// do mesmo formato do manifesto resolvido de F2-01 (schema
// ManifestoResolvido.1). E esta a forma que a W4 declarou como suposicao do
// no `grafico` (AB-364, docs/adr/0019): a fiacao anexa ao no o descritor do
// asset que mora fora dele.
//
// Por que este arquivo gera o JSON em vez de ele ser escrito a mao:
//   - `hash_manifesto_original` e o SHA-256 REAL dos bytes do canonico —
//     um hash digitado errado nao e pego por nenhum teste;
//   - o bloco `manifesto` tem de ser IGUAL ao canonico — gerar a partir do
//     canonico e conferir com deep-equal (tests/integracao/composicao/
//     fiar.test.ts) elimina a divergencia por copia;
//   - o hash do asset e o SHA-256 REAL dos bytes de grafico-integrado.png
//     (C7: endereco por conteudo, nunca por caminho).
//
// Uso:  npx tsx tests/integracao/composicao/gerar-fixture.ts
// Saida ja versionada em fixtures/snapshots/integrado/manifesto-integrado.json.
// =============================================================================

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..", "..");
const CANONICO = resolve(RAIZ, "fixtures", "canonico", "manifesto-valido.json");
const PNG = resolve(RAIZ, "fixtures", "snapshots", "integrado", "assets", "grafico-integrado.png");
const DESTINO = resolve(RAIZ, "fixtures", "snapshots", "integrado", "manifesto-integrado.json");

/**
 * Quais nos de grafico recebem asset resolvido (fiacao) e quais ficam no
 * caminho "dados" (o no desenha a serie declarada no manifesto).
 *
 * Os dois caminhos TEM de ser exercitados no render integrado: o asset e o
 * caminho de producao quando o estagio `grafico` (F2-02) resolveu o no; os
 * dados sao o caminho de fallback — e o contrato do no (AB-364) exige que
 * TODO asset fiado tenha `fonte`. O que NAO pode existir e um asset fiado
 * sem fonte: isso e ErroDeGraficoOpaco, coberto em fiar.test.ts.
 */
export const NOS_COM_ASSET: readonly string[] = ["n-009", "n-011"];

function principal(): void {
  const manifesto = JSON.parse(readFileSync(CANONICO, "utf8")) as unknown;
  const png = readFileSync(PNG);
  const hashDoPng = createHash("sha256").update(png).digest("hex");
  const hashDoManifesto = createHash("sha256")
    .update(readFileSync(CANONICO))
    .digest("hex");

  const nosGrafico: Record<string, string> = {};
  for (const id of NOS_COM_ASSET) {
    nosGrafico[id] = hashDoPng;
  }

  const fixture = {
    schema_version: "ManifestoResolvido.1",
    hash_manifesto_original: hashDoManifesto,
    manifesto,
    assets: {
      [hashDoPng]: {
        hash: hashDoPng,
        tipo: "imagem",
        mimeType: "image/png",
        largura: 480,
        altura: 320,
        byteSize: png.length,
        licenca: "CC0-1.0",
        atribuicaoObrigatoria: false,
        provedor: "local",
      },
    },
    nos_grafico: nosGrafico,
  };

  writeFileSync(DESTINO, `${JSON.stringify(fixture, null, 2)}\n`);
  process.stdout.write(
    `gerar-fixture: ${DESTINO}\n` +
      `  hash_manifesto_original = ${hashDoManifesto}\n` +
      `  asset grafico-integrado.png sha256 = ${hashDoPng} (${String(png.length)} bytes)\n` +
      `  nos com asset: ${NOS_COM_ASSET.join(", ")}\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  principal();
}
