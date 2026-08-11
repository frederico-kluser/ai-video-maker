// =============================================================================
// TOKENS DE DESIGN — Editor de Video IA
// =============================================================================
// Fonte primaria: docs/00-panorama-verificado.md §5.1
// Skill: motion-design-system (SKILL.md)
// Cada valor comenta a fonte (URL + data de acesso)
//
// REGRA DE OURO: nenhum literal numerico ou #hex existe em codigo de composicao.
// Todo valor que toca pixel ou som vem DESTE arquivo, importado, nunca redeclarado.
// =============================================================================

// =============================================================================
// CORES — paleta completa com razao de contraste medida por par
// =============================================================================
// Fonte da formula de contraste:
//   https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (2026-08-11)
// Minimos normativos: 4.5:1 texto normal, 3:1 texto grande (AA)
//   https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (2026-08-11)
//   https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json (2026-08-11)
// Escopo: WCAG regula pagina web, nao video. O numero e emprestado; a obrigacao e nossa.
//   motion-design-system SKILL.md §Paleta e contraste

/** Canal de cor 0–255 ou 0.0–1.0 */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** Par foreground/background com razao de contraste medida */
export interface ContrastPair {
  fg: string;
  bg: string;
  ratio: number;
  /** AA normal (4.5) ou AA large (3.0) */
  passesAANormal: boolean;
  passesAALarge: boolean;
}

/** Escala de cinza — Tailwind Gray (2026-08-11) */
export const gray = {
  "50": "#F9FAFB",
  "100": "#F3F4F6",
  "200": "#E5E7EB",
  "300": "#D1D5DB",
  "400": "#9CA3AF",
  "500": "#6B7280",
  "600": "#4B5563",
  "700": "#374151",
  "800": "#1F2937",
  "900": "#111827",
  "950": "#030712",
} as const;

/** Azul — identidade primaria */
export const blue = {
  "50": "#EFF6FF",
  "100": "#DBEAFE",
  "200": "#BFDBFE",
  "300": "#93C5FD",
  "400": "#60A5FA",
  "500": "#3B82F6",
  "600": "#2563EB",
  "700": "#1D4ED8",
  "800": "#1E40AF",
  "900": "#1E3A8A",
  "950": "#172554",
} as const;

/** Roxo — identidade secundaria */
export const purple = {
  "50": "#FAF5FF",
  "100": "#F3E8FF",
  "200": "#E9D5FF",
  "300": "#D8B4FE",
  "400": "#C084FC",
  "500": "#A855F7",
  "600": "#9333EA",
  "700": "#7E22CE",
  "800": "#6B21A8",
  "900": "#581C87",
  "950": "#3B0764",
} as const;

/** Verde — sucesso, confirmacao */
export const green = {
  "50": "#F0FDF4",
  "100": "#DCFCE7",
  "200": "#BBF7D0",
  "300": "#86EFAC",
  "400": "#4ADE80",
  "500": "#22C55E",
  "600": "#16A34A",
  "700": "#15803D",
  "800": "#166534",
  "900": "#14532D",
  "950": "#052E16",
} as const;

/** Vermelho — erro, perigo, atencao */
export const red = {
  "50": "#FEF2F2",
  "100": "#FEE2E2",
  "200": "#FECACA",
  "300": "#FCA5A5",
  "400": "#F87171",
  "500": "#EF4444",
  "600": "#DC2626",
  "700": "#B91C1C",
  "800": "#991B1B",
  "900": "#7F1D1D",
  "950": "#450A0A",
} as const;

/** Ambar — aviso, destaque */
export const amber = {
  "50": "#FFFBEB",
  "100": "#FEF3C7",
  "200": "#FDE68A",
  "300": "#FCD34D",
  "400": "#FBBF24",
  "500": "#F59E0B",
  "600": "#D97706",
  "700": "#B45309",
  "800": "#92400E",
  "900": "#78350F",
  "950": "#451A03",
} as const;

/** Ciano — informacao */
export const cyan = {
  "50": "#ECFEFF",
  "100": "#CFFAFE",
  "200": "#A5F3FC",
  "300": "#67E8F9",
  "400": "#22D3EE",
  "500": "#06B6D4",
  "600": "#0891B2",
  "700": "#0E7490",
  "800": "#155E75",
  "900": "#164E63",
  "950": "#083344",
} as const;

/** Paleta completa indexada por nome */
export const palette = {
  gray,
  blue,
  purple,
  green,
  red,
  amber,
  cyan,
  white: "#FFFFFF",
  black: "#000000",
} as const;

// =============================================================================
// CORES SEMANTICAS — papeis, nao nomes
// =============================================================================
// Fonte dos papeis: motion-design-system SKILL.md §Paleta e contraste
// Cada par (fg, bg) lista a razao medida. O gate recomputa no pixel renderizado.

/** Cores de fundo */
export const background = {
  /** Fundo principal — escuro (padrao do editor) */
  primary: palette.gray[950],
  /** Fundo secundario — cards, paineis */
  secondary: palette.gray[900],
  /** Fundo elevado — modais, tooltips */
  elevated: palette.gray[800],
  /** Fundo claro — slides, legendas */
  light: palette.gray[50],
} as const;

/** Cores de texto */
export const text = {
  /** Texto principal sobre fundo escuro */
  primary: palette.gray[50],
  /** Texto secundario sobre fundo escuro */
  secondary: palette.gray[400],
  /** Texto muted sobre fundo escuro */
  muted: palette.gray[500],
  /** Texto sobre fundo claro */
  dark: palette.gray[900],
  /** Texto secundario sobre fundo claro */
  darkSecondary: palette.gray[600],
} as const;

/** Cores de borda */
export const border = {
  default: palette.gray[700],
  focus: palette.blue[500],
  error: palette.red[500],
} as const;

/** Cores de estado */
export const state = {
  success: palette.green[500],
  warning: palette.amber[500],
  error: palette.red[500],
  info: palette.cyan[500],
} as const;

/** Cores de realce (highlight) */
export const highlight = {
  primary: palette.blue[500],
  secondary: palette.purple[500],
  accent: palette.amber[500],
} as const;

// =============================================================================
// PARES DE CONTRASTE — pre-computados para validacao
// =============================================================================
// Formula: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio (2026-08-11)
// L = 0.2126*R + 0.7152*G + 0.0722*B (sRGB linearizado)
// ratio = (L1 + 0.05) / (L2 + 0.05)

/**
 * sRGB para luminancia relativa (WCAG 2.2)
 * Fonte: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance (2026-08-11)
 */
export function hexToLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linearize = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return (
    0.2126 * linearize(r) +
    0.7152 * linearize(g) +
    0.0722 * linearize(b)
  );
}

/**
 * Razao de contraste entre duas cores hex
 * Fonte: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio (2026-08-11)
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pares de contraste verificados para texto sobre fundo */
export const contrastPairs: ContrastPair[] = [
  // Texto claro sobre fundo escuro
  {
    fg: text.primary,
    bg: background.primary,
    ratio: contrastRatio(text.primary, background.primary),
    passesAANormal: true,
    passesAALarge: true,
  },
  {
    fg: text.secondary,
    bg: background.primary,
    ratio: contrastRatio(text.secondary, background.primary),
    passesAANormal: true,
    passesAALarge: true,
  },
  {
    fg: text.primary,
    bg: background.secondary,
    ratio: contrastRatio(text.primary, background.secondary),
    passesAANormal: true,
    passesAALarge: true,
  },
  // Texto escuro sobre fundo claro
  {
    fg: text.dark,
    bg: background.light,
    ratio: contrastRatio(text.dark, background.light),
    passesAANormal: true,
    passesAALarge: true,
  },
  {
    fg: text.darkSecondary,
    bg: background.light,
    ratio: contrastRatio(text.darkSecondary, background.light),
    passesAANormal: true,
    passesAALarge: true,
  },
  // Cores de estado sobre fundo escuro
  {
    fg: state.success,
    bg: background.primary,
    ratio: contrastRatio(state.success, background.primary),
    passesAANormal: true,
    passesAALarge: true,
  },
  {
    fg: state.warning,
    bg: background.primary,
    ratio: contrastRatio(state.warning, background.primary),
    passesAANormal: true,
    passesAALarge: true,
  },
  {
    fg: state.error,
    bg: background.primary,
    ratio: contrastRatio(state.error, background.primary),
    passesAANormal: true,
    passesAALarge: true,
  },
  {
    fg: state.info,
    bg: background.primary,
    ratio: contrastRatio(state.info, background.primary),
    passesAANormal: true,
    passesAALarge: true,
  },
  // Highlight sobre fundo escuro
  {
    fg: highlight.primary,
    bg: background.primary,
    ratio: contrastRatio(highlight.primary, background.primary),
    passesAANormal: true,
    passesAALarge: true,
  },
  {
    fg: highlight.secondary,
    bg: background.primary,
    ratio: contrastRatio(highlight.secondary, background.primary),
    passesAANormal: true,
    passesAALarge: true,
  },
  {
    fg: highlight.accent,
    bg: background.primary,
    ratio: contrastRatio(highlight.accent, background.primary),
    passesAANormal: true,
    passesAALarge: true,
  },
];

// =============================================================================
// TIPOGRAFIA — escala, fontes, pesos
// =============================================================================
// Fonte da escala: motion-design-system SKILL.md §Escala tipografica
// A escala e relacional (fracao da altura do frame), nunca em px absoluto.
// Piso de altura de caixa: 2.5% para secundario, 5% para principal (sem fonte normativa)
// Referencia de tamanho minimo: 11pt Apple HIG
//   https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json (2026-08-11)
//   (escopo: UI de app, nao video — e ancora do argumento, nao piso importavel)

/** Familia tipografica */
// F1-03: a primeira familia de sans/display/mono e EMBUTIDA — carregada de
// assets/fontes/ por src/design/fontes/index.ts. Zero rede, zero endereco remoto.
// Peso e estilo tambem sao fixados la: Inter 400 e 700 normal, JetBrains Mono
// 400 normal. O resto de cada pilha e rede de seguranca do CSS e NAO deve
// entrar em uso — AGENTS.md C6: uma fonte que nao carregou cai para fallback
// sem erro. tests/design/font-resolve.test.ts renderiza um still e le, dentro
// do navegador do render, qual familia foi de fato resolvida em cada pilha.
// Licenca e direito de embutir por familia: assets/fontes/*.md
export const fontFamily = {
  /** Texto corrido, legendas, UI — Inter embutida, peso 400 normal */
  sans: "Inter, system-ui, -apple-system, sans-serif",
  /** Titulos, display — Inter embutida, peso 700 normal */
  display: "Inter, system-ui, -apple-system, sans-serif",
  /** Codigo fonte — JetBrains Mono embutida, peso 400 normal */
  mono: "JetBrains Mono, Fira Code, monospace",
  /** Serif para contraste estilistico — pilha de sistema, nao embutida */
  serif: "Georgia, Times New Roman, serif",
} as const;

/** Escala tipografica — fracao da altura do frame (1080px = referencia) */
export const typeScale = {
  /** Display — titulo principal (~5% da altura do frame = 54px em 1080p) */
  display: 0.05,
  /** Title — titulo de secao (~3.5% = 38px) */
  title: 0.035,
  /** Subtitle — subtitulo (~2.5% = 27px) */
  subtitle: 0.025,
  /** Body — texto corrido (~2% = 22px) */
  body: 0.02,
  /** Caption — legendas, notas (~1.8% = 19px) */
  caption: 0.018,
  /** Small — texto auxiliar (~1.5% = 16px) */
  small: 0.015,
} as const;

/** Pesos tipograficos */
export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

/** Altura de linha (multiplo do tamanho da fonte) */
export const lineHeight = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.6,
  loose: 1.8,
} as const;

/** Largura maxima de linha em caracteres */
// Fonte: Netflix TTSG — 42 chars/line (ingles)
//   https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977 (2026-08-11)
// pt-BR pode exigir 37-40 chars — motion-design-system SKILL.md §O arquivo e o vocabulario
export const maxCharsPerLine = 42;

/** Maximo de linhas simultaneas */
// Fonte: Netflix TTSG — 2 lines max
//   https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977 (2026-08-11)
export const maxLines = 2;

// =============================================================================
// ESPACAMENTO — grid de 4px
// =============================================================================
// Fonte: motion-design-system SKILL.md §Escala tipografica
// Grid baseado em multiplos de 4px (convencao de UI, sem fonte normativa unica)

/** Escala de espacamento (multiplos de 4px) */
export const spacing = {
  /** 0px */
  "0": 0,
  /** 4px — 1 unidade */
  "1": 4,
  /** 8px — 2 unidades */
  "2": 8,
  /** 12px — 3 unidades */
  "3": 12,
  /** 16px — 4 unidades */
  "4": 16,
  /** 20px — 5 unidades */
  "5": 20,
  /** 24px — 6 unidades */
  "6": 24,
  /** 32px — 8 unidades */
  "8": 32,
  /** 40px — 10 unidades */
  "10": 40,
  /** 48px — 12 unidades */
  "12": 48,
  /** 64px — 16 unidades */
  "16": 64,
  /** 80px — 20 unidades */
  "20": 80,
  /** 96px — 24 unidades */
  "24": 96,
  /** 128px — 32 unidades */
  "32": 128,
} as const;

/** Border radius */
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// =============================================================================
// DURACOES — transicoes, texto, animacao
// =============================================================================
// Fonte: motion-design-system SKILL.md §Duracoes canonicas de transicao
// Grade inspirada no Material 3 (50-1000ms), mas e grade de UI, nao de video
//   https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss (2026-08-11)
// Tokens em milissegundos; a timeline vive em frames. Arredonde UMA VEZ na camada de token.

/** Duracao de transicao canonica em milissegundos */
export const transitionDuration = {
  /** Corte seco — 0ms */
  cut: 0,
  /** Instantaneo — 100ms */
  instant: 100,
  /** Snap — 200ms */
  snap: 200,
  /** Base — 300ms */
  base: 300,
  /** Calm — 500ms */
  calm: 500,
} as const;

/** Converte duracao em ms para frames (arredondamento unico na camada de token) */
export function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

/** Duracoes em frames para 30fps e 60fps (pre-computadas) */
export const transitionFrames = {
  cut: { "30": 0, "60": 0 },
  instant: { "30": msToFrames(transitionDuration.instant, 30), "60": msToFrames(transitionDuration.instant, 60) },
  snap: { "30": msToFrames(transitionDuration.snap, 30), "60": msToFrames(transitionDuration.snap, 60) },
  base: { "30": msToFrames(transitionDuration.base, 30), "60": msToFrames(transitionDuration.base, 60) },
  calm: { "30": msToFrames(transitionDuration.calm, 30), "60": msToFrames(transitionDuration.calm, 60) },
} as const;

// =============================================================================
// TEMPO DE TEXTO EM TELA — invariantes de legendagem
// =============================================================================
// Fonte: motion-design-system SKILL.md §Tempo de texto na tela
// Piso: 20 frames Netflix (5/6 s = 0.833 s) a 40 frames DCMP (1.333 s)
//   https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617 (2026-08-11)
//   https://dcmp.org/learn/captioningkey/597 (2026-08-11)
// Teto: 6 s DCMP a 7 s Netflix
// CPS: 20 CPS adulto (Netflix, fonte unica - 1-0)
// Adotamos os extremos mais permissivos: 0.833 s a 7 s
//   (escolha nossa, nao leitura de norma)

/** Duracao minima de texto em tela (segundos) */
export const minTextDurationSeconds = 0.833;

/** Duracao maxima de texto em tela (segundos) */
export const maxTextDurationSeconds = 7;

/** Caracteres por segundo — adulto (pt-BR) */
// Fonte: Netflix TTSG — 20 CPS (ingles, fonte unica - 1-0)
//   https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977 (2026-08-11)
export const maxCpsAdult = 20;

/** Caracteres por segundo — infantil */
export const maxCpsChild = 17;

/** Intervalo minimo entre legendas em frames */
// Fonte: Netflix Subtitle Timing Guidelines (1-0)
//   https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977 (2026-08-11)
export const minSubtitleGapFrames = 2;

/** Velocidade de narracao de referencia (palavras por minuto) */
// Fonte: Brysbaert 2019 — 183 wpm leitura em voz alta (77 estudos); audiolivros 140-180
//   https://gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf (2026-08-11)
// 165 e escolha nossa dentro da faixa — motion-design-system SKILL.md §Tempo de texto
export const narrationWpm = 165;

// =============================================================================
// SAFE AREAS — por aspecto e plataforma
// =============================================================================
// Fonte 16:9: EBU R 95 v1.1 — action safe 3.5%, graphics safe 5%
//   https://tech.ebu.ch/docs/r/r095.pdf (2026-08-11)
//   docs/00-panorama-verificado.md §1.5, R14-11
// Fonte 9:16: provisional (AB-071) — 12% topo, 20% base, 15% direita
//   docs/00-panorama-verificado.md §7.6 (AB-071)
//   motion-design-system SKILL.md §Grade e safe area
// Margem arredondada ao inteiro mais proximo.
// Retangulo em coordenadas de borda: [margem, D - margem].

/** Safe area para 16:9 (1920x1080) — EBU R 95 */
export const safeArea16x9 = {
  /** Resolucao de referencia */
  width: 1920,
  height: 1080,
  /** Action safe — 3.5% */
  actionSafePct: 0.035,
  /** Graphics safe — 5% */
  graphicsSafePct: 0.05,
  /** Action safe margins (px): h=67, v=38 */
  actionSafe: {
    left: 67,
    right: 1853,
    top: 38,
    bottom: 1042,
  },
  /** Graphics safe margins (px): h=96, v=54 */
  graphicsSafe: {
    left: 96,
    right: 1824,
    top: 54,
    bottom: 1026,
  },
} as const;

/** Safe area para 9:16 (1080x1920) — provisional (AB-071) */
// Fonte: docs/00-panorama-verificado.md §7.6 (AB-071)
// Pesquisa web 2026-08-11 confirma faixas similares:
//   TikTok: top 15%, bottom 20%, right 15% — veopro.ai (2026-01-20)
//   Instagram Reels: bottom 250px, top 100px — trymypost.com (2026-03-30)
//   TikTok: 900x1492 centered — postplanify.com (2026-01-09)
// Valores provisorios sem fonte primaria; medir por app e versao.
export const safeArea9x16 = {
  /** Resolucao de referencia */
  width: 1080,
  height: 1920,
  /** Margem superior — 12% (≈230px) */
  topPct: 0.12,
  topPx: 230,
  /** Margem inferior — 20% (≈384px) */
  bottomPct: 0.20,
  bottomPx: 384,
  /** Margem direita — 15% (≈162px) */
  rightPct: 0.15,
  rightPx: 162,
  /** Retangulo util (action safe em 9:16) */
  safeRect: {
    x: 0,
    y: 230,
    width: 918,
    height: 1306,
  },
} as const;

// =============================================================================
// Z-INDEX — camadas de composicao
// =============================================================================
// Fonte: convencao do projeto (sem fonte normativa)
// Ordem: fundo → conteudo → overlay → legenda → UI

export const zIndex = {
  /** Fundo, gradiente, cor solida */
  background: 0,
  /** Conteudo principal */
  content: 10,
  /** Overlay — vignette, grain, filtro */
  overlay: 20,
  /** Legendas, texto queimado */
  captions: 30,
  /** UI — watermarks, botoes, CTAs */
  ui: 40,
  /** Tooltip, modal, notificacao */
  tooltip: 50,
} as const;

// =============================================================================
// BREAKPOINTS — resolucoes de saida
// =============================================================================
// Fonte: plataformas de destino (2026-08-11)
//   https://blog.lunabloomai.com/social-media-video-specs/ (2026-06-06)
//   https://trustypost.ai/blog/tiktok-video-size-2026-dimensions-ratio-safe-zones/ (2026-05-17)

export const breakpoints = {
  /** 16:9 — YouTube, broadcast (1920x1080) */
  hd: { width: 1920, height: 1080 },
  /** 9:16 — TikTok, Reels, Shorts (1080x1920) */
  vertical: { width: 1080, height: 1920 },
  /** 1:1 — Instagram feed (1080x1080) */
  square: { width: 1080, height: 1080 },
  /** 4:5 — Instagram portrait (1080x1350) */
  portrait: { width: 1080, height: 1350 },
} as const;

// =============================================================================
// AUDIO — loudness, true peak
// =============================================================================
// Fonte: motion-design-system SKILL.md §Loudness e headroom
// Cinco normas, nenhum alvo herdavel:
//   EBU R 128 = -23.0 LUFS (broadcast)
//     https://tech.ebu.ch/docs/r/r128.pdf (2026-08-11)
//   AES TD1008 = -18/-16/-14 (NAO se aplica a video — escopo declarado)
//     https://aes2.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf (2026-08-11)
//   Netflix OTT = -27 LKFS dialog-gated
//   Spotify = -14 LUFS (musica, nao video)
//     https://support.spotify.com/artists/article/loudness-normalization (2026-08-11)
//   Google Assistant = -16 LUFS stereo
//     https://developers.google.com/assistant/tools/audio-loudness (2026-08-11)
// targetLufs e decisao do dono registrada em ADR (P-09 → ADR-009)
// Pesquisa web 2026-08-11: YouTube ≈ -14 LUFS (sem fonte primaria)
//   Instagram/TikTok ≈ -10 a -12 LUFS — opus.pro (2026-05-06)

/** Alvo de loudness integrada (LUFS) — placeholder, decisao ADR pendente */
// EBU R 128 broadcast como default conservador
export const targetLufs = -23.0;

/** True peak maximo (dBTP) — teto, nao alvo */
// Fonte: EBU R 128 = -1 dBTP (convergente com AES TD1008, Spotify)
//   https://tech.ebu.ch/docs/r/r128.pdf (2026-08-11)
// Netflix e mais restritivo: -2 dBTP
export const maxTruePeakDbtp = -1.0;

/** Nivel de musica de fundo relativo a locucao (dB) */
// Sem fonte normativa — chute calibravel
// motion-design-system SKILL.md §Nao verificado
export const musicUnderVoiceDb = -18;

/** Nivel de musica nos intervalos (dB) */
export const musicSoloDb = -6;

// =============================================================================
// FOTOSSENSIBILIDADE — limite de flashes
// =============================================================================
// Fonte: WCAG 2.2 Nivel A — 3 flashes/segundo
//   https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html (2026-08-11)
// ITU BT.1702 — mesmo limite, area de referencia diverge
//   https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf (2026-08-11)
// docs/00-panorama-verificado.md §1.5, R14-06

/** Maximo de flashes por segundo (WCAG 2.2 Nivel A) */
export const maxFlashesPerSecond = 3;

/** Area de referencia local (WCAG) — 25% de 10° visual → ~341x256 px */
export const flashAreaLocalPx = 341 * 256;

/** Area de referencia global (ITU) — 1/4 da area da tela */
export const flashAreaGlobalPct = 0.25;

/** Delta de luminancia relativa minima para contar como flash */
export const flashLuminanceDelta = 0.10;

/** Luminancia maxima da regiao escura (WCAG: < 0.80) */
export const flashDarkRegionMaxLuminance = 0.80;

// =============================================================================
// PRESETS DE MOLA — (zeta, T) → config
// =============================================================================
// Fonte: motion-design-system SKILL.md §Presets de mola
// spring() implementa oscilador harmonico amortecido:
//   const zeta = c / (2 * Math.sqrt(k * m))
//   https://www.remotion.dev/docs/spring (2026-08-11)
//   https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts (2026-08-11)
// Default Remotion: mass=1, damping=10, stiffness=100 → zeta=0.5 (subamortecido)
// Token e (zeta, T); mass/damping/stiffness e derivado.
// Conversao: omega0 = ln(1/threshold)/(zeta*T), stiffness = omega0^2*m, damping = 2*zeta*omega0*m
// (derivada, superestima levemente — cada linha confirmada por measureSpring())

/** Parametros de preset de mola */
export interface SpringPreset {
  /** Razao de amortecimento (zeta < 1 = overshoot, zeta >= 1 = sem repique) */
  zeta: number;
  /** Tempo de acomodacao alvo (segundos) */
  settlingTimeSeconds: number;
  /** Descricao */
  label: string;
}

/** Presets de mola canonicos */
export const springPresets: Record<string, SpringPreset> = {
  snappy: {
    zeta: 0.7,
    settlingTimeSeconds: 0.25,
    label: "Chega e para; repique pequeno",
  },
  suave: {
    zeta: 1.0,
    settlingTimeSeconds: 0.5,
    label: "Amortecimento critico, zero repique",
  },
  overshoot: {
    zeta: 0.45,
    settlingTimeSeconds: 0.4,
    label: "Repique deliberado, para enfase",
  },
} as const;

/** Threshold padrao do Remotion para durationRestThreshold */
// Fonte: https://www.remotion.dev/docs/transitions/timings/springtiming (2026-08-11)
export const springDurationRestThreshold = 0.005;

// =============================================================================
// TIPOS AGREGADOS — exportacao unificada
// =============================================================================

/** Todos os tokens de design em um unico objeto tipado */
export const tokens = {
  palette,
  background,
  text,
  border,
  state,
  highlight,
  contrastPairs,
  fontFamily,
  typeScale,
  fontWeight,
  lineHeight,
  maxCharsPerLine,
  maxLines,
  spacing,
  borderRadius,
  transitionDuration,
  transitionFrames,
  minTextDurationSeconds,
  maxTextDurationSeconds,
  maxCpsAdult,
  maxCpsChild,
  minSubtitleGapFrames,
  narrationWpm,
  safeArea16x9,
  safeArea9x16,
  zIndex,
  breakpoints,
  targetLufs,
  maxTruePeakDbtp,
  musicUnderVoiceDb,
  musicSoloDb,
  maxFlashesPerSecond,
  flashAreaLocalPx,
  flashAreaGlobalPct,
  flashLuminanceDelta,
  flashDarkRegionMaxLuminance,
  springPresets,
  springDurationRestThreshold,
} as const;

/** Tipo inferido dos tokens */
export type DesignTokens = typeof tokens;