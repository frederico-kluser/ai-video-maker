/**
 * src/roteiro/contrato/rotas.ts
 *
 * O CONTRATO DE API do app web — a lista canonica de rotas, como
 * constantes. FQ-C4: o teste tests/roteiro/contrato.test.ts cruza
 * docs/roteiro/api.md com esta lista — rota documentada sem constante
 * (ou constante sem rota no documento) e FALHA.
 *
 * Formato de cada constante: "<METODO> <path>" — exatamente a linha que
 * o api.md usa (secao "Rotas — lista canonica"), para o cruzamento ser
 * textual. Paths com parametros usam ":nome" (o servidor da Onda 4
 * implementa o matcher; a ordem de casamento preferencia segmento
 * literal sobre ":param" — api.md §Matcher).
 *
 * O servidor escuta na porta 4610 (S-9, declarada em docs/roteiro/api.md)
 * e serve tudo sob este contrato; a SPA (Onda 5) consome exatamente isto.
 */
export const ROTAS_API = {
  // ── Estatica (a SPA) ──
  spaIndex: "GET /",
  spaAssets: "GET /assets/*",

  // ── Projetos ──
  criarProjeto: "POST /api/projetos",
  listarProjetos: "GET /api/projetos",
  obterProjeto: "GET /api/projetos/:id",
  atualizarBrief: "PATCH /api/projetos/:id",
  apagarProjeto: "DELETE /api/projetos/:id",

  // ── Roteiro ──
  gerarRoteiro: "POST /api/projetos/:id/roteiro/gerar",
  regenerarPedaco: "POST /api/projetos/:id/pedacos/:pedacoId/regenerar",
  editarPedaco: "PATCH /api/projetos/:id/pedacos/:pedacoId",

  // ── Narracao ──
  enviarGravacao: "PUT /api/projetos/:id/pedacos/:pedacoId/narracao/audio",
  obterAudioNarracao: "GET /api/projetos/:id/pedacos/:pedacoId/narracao/audio",
  removerNarracao: "DELETE /api/projetos/:id/pedacos/:pedacoId/narracao",

  // ── Preview ──
  pedirPreview: "POST /api/projetos/:id/pedacos/:pedacoId/preview",
  obterPreviewMp4: "GET /api/projetos/:id/pedacos/:pedacoId/preview.mp4",

  // ── Juntar / entrega ──
  pedirJuntar: "POST /api/projetos/:id/juntar",
  obterVideoFinal: "GET /api/projetos/:id/video-final.mp4",

  // ── Jobs assincronos ──
  obterJob: "GET /api/jobs/:jobId",
} as const;

export type RotaApi = (typeof ROTAS_API)[keyof typeof ROTAS_API];

/** A lista em si (para iterar — o teste FQ-C4 usa Object.values). */
export const ROTAS_API_LISTA: readonly RotaApi[] = Object.values(ROTAS_API);
