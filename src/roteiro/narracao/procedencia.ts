/**
 * src/roteiro/narracao/procedencia.ts
 *
 * A PROCEDENCIA do audio gravado pelo usuario (FQ-N3) — o irmao de
 * procedencia.json que o Store grava ao lado dos bytes (S-8).
 *
 * Regras (asset-acquisition SKILL.md §1.5): license OBRIGATORIO,
 * attributionRequired declarado, source declarado, acquiredAt gravado
 * no ato. O enquadramento e o ADR-0003 (uso pessoal): o audio e a VOZ
 * DO PROPRIO USUARIO gravada para o proprio video — nada de terceiro,
 * nada a atribuir, nada a licenciar de volta.
 *
 * Sobre `source`: o tipo ProvedorAsset de src/store/procedencia.ts e
 * uma uniao FECHADA e nao tem o valor "local-usuario" (e a Onda 4 nao
 * edita src/store/**). A origem declarada vai em `notes`
 * ("origem: local-usuario") e `source` usa o valor "local" do
 * vocabulario — a auditoria le os dois juntos.
 */

import type { Procedencia } from "../../store/procedencia.js";

/** O que a procedencia da gravacao precisa saber sobre a aquisicao. */
export interface DadosDaProcedenciaDaGravacao {
  /** Nome original do arquivo enviado (auditoria; opcional). */
  readonly nomeOriginal?: string;
  /** MIME declarado pelo navegador (ex.: "audio/webm"; auditoria). */
  readonly tipo?: string;
  /** Duracao do wav final em segundos (gravada no ato — custa rede/leitura). */
  readonly duracaoSegundos: number;
  /** Tamanho do wav final em bytes. */
  readonly byteSize: number;
  /** Relogio do acquiredAt (o servidor passa o dele; testes, fixo). */
  readonly relogio: () => Date;
  /** Versao da ferramenta de aquisicao (ex.: "narracao-1.0.0"). */
  readonly toolVersion: string;
}

/**
 * Monta a procedencia da gravacao do usuario. Campos auditaveis no ato:
 * licenca (CC0-1.0 — a convencao de asset sintetico do proprio pipeline,
 * src/pipeline/produzir.ts marca as emendas com a mesma string), sem
 * atribuicao (voz do proprio usuario), origem declarada em notes,
 * duracao e tamanho medidos.
 */
export function procedenciaDaGravacao(
  dados: DadosDaProcedenciaDaGravacao,
): Procedencia {
  const partes = ["origem: local-usuario"];
  if (dados.nomeOriginal !== undefined && dados.nomeOriginal !== "") {
    partes.push(`nome_original=${dados.nomeOriginal}`);
  }
  partes.push(`mime_declarado=${dados.tipo ?? "audio/webm"}`);
  return {
    license: "CC0-1.0",
    attributionRequired: false,
    source: "local",
    acquiredAt: dados.relogio().toISOString(),
    durationSeconds: dados.duracaoSegundos,
    mimeType: "audio/wav",
    byteSize: dados.byteSize,
    toolVersion: dados.toolVersion,
    notes:
      `${partes.join("; ")} — gravacao do proprio usuario para o proprio ` +
      "video (ADR-0003, uso pessoal); sem atribuicao devida",
  };
}
