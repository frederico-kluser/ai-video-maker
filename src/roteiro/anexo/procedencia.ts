/**
 * src/roteiro/anexo/procedencia.ts
 *
 * A PROCEDENCIA do anexo enviado pelo usuario — o irmao de
 * procedencia.json que o Store grava ao lado dos bytes (S-8). Espelho
 * de src/roteiro/narracao/procedencia.ts: o anexo e um ASSET DO
 * PROPRIO USUARIO (gif baixado por ele, gravacao de tela, video proprio)
 * gravado para o proprio video — enquadramento ADR-0003 (uso pessoal),
 * nada de terceiro a atribuir, nada a licenciar de volta.
 *
 * Sobre `source`: a uniao fechada ProvedorAsset de src/store/procedencia.ts
 * nao tem "local-usuario" — a origem declarada vai em `notes` e `source`
 * usa o valor "local" do vocabulario (a auditoria le os dois juntos).
 */

import type { Procedencia } from "../../store/procedencia.js";

/** O que a procedencia do anexo precisa saber sobre a aquisicao. */
export interface DadosDaProcedenciaDoAnexo {
  /** Nome original do arquivo enviado (auditoria; opcional). */
  readonly nomeOriginal?: string;
  /** MIME da allowlist (image/gif | video/mp4 | video/webm). */
  readonly tipo: string;
  /** Tamanho dos bytes em bytes. */
  readonly byteSize: number;
  /** Relogio do acquiredAt (o servidor passa o dele; testes, fixo). */
  readonly relogio: () => Date;
  /** Versao da ferramenta de aquisicao (ex.: "anexo-1.0.0"). */
  readonly toolVersion: string;
}

/**
 * Monta a procedencia do anexo do usuario. Campos auditaveis no ato:
 * licenca (CC0-1.0 — a convencao de asset sintetico do proprio pipeline,
 * o mesmo da narracao), sem atribuicao (asset do proprio usuario),
 * origem declarada em notes, mime e tamanho medidos.
 */
export function procedenciaDoAnexo(
  dados: DadosDaProcedenciaDoAnexo,
): Procedencia {
  const partes = ["origem: local-usuario"];
  if (dados.nomeOriginal !== undefined && dados.nomeOriginal !== "") {
    partes.push(`nome_original=${dados.nomeOriginal}`);
  }
  partes.push(`mime_declarado=${dados.tipo}`);
  return {
    license: "CC0-1.0",
    attributionRequired: false,
    source: "local",
    acquiredAt: dados.relogio().toISOString(),
    mimeType: dados.tipo,
    byteSize: dados.byteSize,
    toolVersion: dados.toolVersion,
    notes:
      `${partes.join("; ")} — anexo do proprio usuario para o proprio ` +
      "video (ADR-0003, uso pessoal); sem atribuicao devida",
  };
}
