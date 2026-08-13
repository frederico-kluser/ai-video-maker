/**
 * tools/revisao/formato.ts
 *
 * O VOCABULÁRIO COMPARTILHADO DO DOSSIÊ (card F6-01, W10) — lido pelo
 * gerador (gerar-dossie.ts), pelo ∅-crit (verificar-dossie.ts) e pelo
 * gate (gate.ts). Nenhum desses módulos importa outro que execute efeitos
 * colaterais no topo: o vocabulário mora aqui, isolado.
 *
 * O dossiê é o registro da fase 1 da política editorial (docs/politica-
 * editorial.md §1). Os papéis são OS MESMOS da política §3 — Revisor
 * editorial, Revisor jurídico, Operador de reversão, Operador de
 * publicação — nunca "o time" (pergunta adversarial 1 do card).
 */

/**
 * Papeis nomeados da politica editorial §3 — o vocabulario das assinaturas.
 * Os nomes sao OS MESMOS da politica (docs/politica-editorial.md §3), com
 * acentuacao: o dossie usa os MESMOS papeis da politica (pergunta
 * adversarial 1 do card). O gate e o verificador casam por string literal;
 * alterar um nome aqui quebra o fecho com a politica de proposito.
 */
export const PAPEIS_DO_DOSSIE: readonly string[] = [
  "Revisor editorial",
  "Revisor jurídico",
  "Operador de reversão",
  "Operador de publicação",
];

/** Os itens do checklist (docs/revisao/checklist.md), por papel. */
export const ITENS_POR_PAPEL: Readonly<Record<string, readonly string[]>> = {
  "Revisor editorial": ["E1", "E2", "E3", "E4", "E5"],
  "Revisor jurídico": ["J1", "J2", "J3", "J4"],
  "Operador de reversão": ["R1", "R2"],
  "Operador de publicação": ["P1", "P2"],
};

/** Todos os itens obrigatorios (presenca per-item, nunca lista fechada no gate). */
export const ITENS_OBRIGATORIOS: readonly string[] = Object.values(ITENS_POR_PAPEL).flat();

/** Vereditos aceitos por item. */
export const VEREDITOS_DE_ITEM = new Set(["CONFERE", "REPROVADO", "NAO_APLICAVEL"]);

/** Vereditos aceitos como global de um papel. */
export const VEREDITOS_GLOBAIS = new Set(["CONFERE", "REPROVADO"]);

/** As duas declaracoes validas do gatilho AB-950 (ADR-0003: omissao e falha). */
export const DECLARACOES_AB950 = new Set(["AB-950 continua fechado", "AB-950 disparou"]);

/**
 * Itens que admitem `NAO_APLICAVEL` — hoje só o J2 (disclosure de voz
 * sintética não se aplica a entrega sem locução). Os demais itens se
 * aplicam a toda entrega (todo vídeo tem conteúdo visual e narrativo);
 * marcar um deles como N/A é falso verde.
 */
export const ITENS_QUE_ADMITEM_NAO_APLICAVEL = new Set(["J2"]);
