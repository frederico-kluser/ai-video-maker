/**
 * src/store/procedencia.ts
 *
 * Tipos para procedencia.json — metadado de proveniencia de cada asset
 * armazenado no store enderecado por conteudo.
 *
 * O campo `license` e obrigatorio: e a unica defesa real contra um
 * agente que "encontrou um asset perfeito" sem checar a licenca.
 * — asset-acquisition SKILL.md §1.5
 *
 * O campo `fetchedFrom` armazena a URL de origem, mas esta URL NAO e
 * usada como caminho de leitura (invariante C7).
 * — AGENTS.md C7
 */

/** Identificador do fornecedor do asset. */
export type ProvedorAsset =
  | "giphy"
  | "tenor"
  | "pexels"
  | "pixabay"
  | "openverse"
  | "remotion-animated-emoji"
  | "local"
  | "manual"
  | "unknown";

/** Metadado gravado no ato do download, junto com o byte. */
export interface Procedencia {
  /** Licenca do asset (obrigatorio). Ex: "CC BY 4.0", "GIPHY User ToS", "MIT" */
  license: string;

  /** Se a licenca exige atribuicao. */
  attributionRequired: boolean;

  /** Texto exato de atribuicao exigido pela licenca, se houver. */
  attribution?: string;

  /** Fornecedor do asset. */
  source: ProvedorAsset;

  /** ID do asset no fornecedor (ex: giphy id, pexels photo id). */
  sourceId?: string;

  /** URL de onde o asset foi baixado. NAO usar como caminho de leitura (C7). */
  fetchedFrom?: string;

  /** Timestamp ISO 8601 do momento da aquisicao. */
  acquiredAt: string;

  /** Largura em pixels (se aplicavel). */
  width?: number;

  /** Altura em pixels (se aplicavel). */
  height?: number;

  /** Duracao em segundos (se aplicavel). */
  durationSeconds?: number;

  /** MIME type do arquivo original. */
  mimeType?: string;

  /** Tamanho em bytes do arquivo original. */
  byteSize?: number;

  /** Termo de busca usado para encontrar o asset (se aplicavel). */
  searchTerm?: string;

  /** Versao da ferramenta usada para baixar (ex: "curl 8.0.1"). */
  toolVersion?: string;

  /** Notas adicionais de auditoria. */
  notes?: string;
}

/** Guard: verifica se um objeto parece um Procedencia valido. */
export function isValidProcedencia(obj: unknown): obj is Procedencia {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.license === "string" &&
    p.license.length > 0 &&
    typeof p.attributionRequired === "boolean" &&
    typeof p.source === "string" &&
    typeof p.acquiredAt === "string"
  );
}
