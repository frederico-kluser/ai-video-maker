# =============================================================================
# TOKENS DE DESIGN — Editor de Video IA (espelho Python)
# =============================================================================
# GERADO AUTOMATICAMENTE por scripts/generate-tokens-py.ts
# NAO EDITE MANUALMENTE — edite src/design/tokens.ts e rode just design:gerar
# =============================================================================
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

# =============================================================================
# CORES
# =============================================================================

GRAY = {
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
}

BLUE = {
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
}

PURPLE = {
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
}

GREEN = {
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
}

RED = {
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
}

AMBER = {
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
}

CYAN = {
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
}

PALETTE = {
    "gray": GRAY,
    "blue": BLUE,
    "purple": PURPLE,
    "green": GREEN,
    "red": RED,
    "amber": AMBER,
    "cyan": CYAN,
    "white": "#FFFFFF",
    "black": "#000000",
}

# Cores semanticas
BACKGROUND = {
    "primary": PALETTE["black"],  # preto puro (onda1-fundo-preto)
    "secondary": GRAY["900"],
    "elevated": GRAY["800"],
    "light": GRAY["50"],
}

TEXT = {
    "primary": GRAY["50"],
    "secondary": GRAY["400"],
    "muted": GRAY["500"],
    "dark": GRAY["900"],
    "dark_secondary": GRAY["600"],
}

BORDER = {
    "default": GRAY["700"],
    "focus": BLUE["500"],
    "error": RED["500"],
}

STATE = {
    "success": GREEN["500"],
    "warning": AMBER["500"],
    "error": RED["500"],
    "info": CYAN["500"],
}

HIGHLIGHT = {
    "primary": BLUE["500"],
    "secondary": PURPLE["500"],
    "accent": AMBER["500"],
}

# =============================================================================
# TIPOGRAFIA
# =============================================================================

FONT_FAMILY = {
    "sans": "Inter, system-ui, -apple-system, sans-serif",
    "display": "Inter, system-ui, -apple-system, sans-serif",
    "mono": "JetBrains Mono, Fira Code, monospace",
    "serif": "Georgia, Times New Roman, serif",
}

TYPE_SCALE = {
    "display": 0.05,
    "title": 0.035,
    "subtitle": 0.025,
    "body": 0.02,
    "caption": 0.018,
    "small": 0.015,
}

FONT_WEIGHT = {
    "light": 300,
    "regular": 400,
    "medium": 500,
    "semibold": 600,
    "bold": 700,
    "extrabold": 800,
}

LINE_HEIGHT = {
    "tight": 1.1,
    "normal": 1.4,
    "relaxed": 1.6,
    "loose": 1.8,
}

MAX_CHARS_PER_LINE = 42
MAX_LINES = 2

# =============================================================================
# ESPACAMENTO
# =============================================================================

SPACING = {
    "0": 0,
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32,
    "10": 40,
    "12": 48,
    "16": 64,
    "20": 80,
    "24": 96,
    "32": 128,
}

BORDER_RADIUS = {
    "none": 0,
    "sm": 4,
    "md": 8,
    "lg": 12,
    "xl": 16,
    "full": 9999,
}

# =============================================================================
# DURACOES
# =============================================================================

TRANSITION_DURATION = {
    "cut": 0,
    "instant": 100,
    "snap": 200,
    "base": 300,
    "calm": 500,
}

def ms_to_frames(ms: int, fps: int) -> int:
    """Converte duracao em ms para frames (arredondamento unico)."""
    return round((ms / 1000) * fps)

TRANSITION_FRAMES = {
    "cut": {"30": 0, "60": 0},
    "instant": {"30": ms_to_frames(100, 30), "60": ms_to_frames(100, 60)},
    "snap": {"30": ms_to_frames(200, 30), "60": ms_to_frames(200, 60)},
    "base": {"30": ms_to_frames(300, 30), "60": ms_to_frames(300, 60)},
    "calm": {"30": ms_to_frames(500, 30), "60": ms_to_frames(500, 60)},
}

# =============================================================================
# TEMPO DE TEXTO EM TELA
# =============================================================================

MIN_TEXT_DURATION_SECONDS = 0.833
MAX_TEXT_DURATION_SECONDS = 7
MAX_CPS_ADULT = 20
MAX_CPS_CHILD = 17
MIN_SUBTITLE_GAP_FRAMES = 2
NARRATION_WPM = 165

# =============================================================================
# SAFE AREAS
# =============================================================================

SAFE_AREA_16X9 = {
    "width": 1920,
    "height": 1080,
    "action_safe_pct": 0.035,
    "graphics_safe_pct": 0.05,
    "action_safe": {"left": 67, "right": 1853, "top": 38, "bottom": 1042},
    "graphics_safe": {"left": 96, "right": 1824, "top": 54, "bottom": 1026},
}

SAFE_AREA_9X16 = {
    "width": 1080,
    "height": 1920,
    "top_pct": 0.12,
    "top_px": 230,
    "bottom_pct": 0.20,
    "bottom_px": 384,
    "right_pct": 0.15,
    "right_px": 162,
    "safe_rect": {"x": 0, "y": 230, "width": 918, "height": 1306},
}

# =============================================================================
# Z-INDEX
# =============================================================================

Z_INDEX = {
    "background": 0,
    "content": 10,
    "overlay": 20,
    "captions": 30,
    "ui": 40,
    "tooltip": 50,
}

# =============================================================================
# BREAKPOINTS
# =============================================================================

BREAKPOINTS = {
    "hd": {"width": 1920, "height": 1080},
    "vertical": {"width": 1080, "height": 1920},
    "square": {"width": 1080, "height": 1080},
    "portrait": {"width": 1080, "height": 1350},
}

# =============================================================================
# AUDIO
# =============================================================================

TARGET_LUFS = -23.0
MAX_TRUE_PEAK_DBTP = -1.0
MUSIC_UNDER_VOICE_DB = -18
MUSIC_SOLO_DB = -6

# =============================================================================
# FOTOSSENSIBILIDADE
# =============================================================================

MAX_FLASHES_PER_SECOND = 3
FLASH_AREA_LOCAL_PX = 341 * 256  # = 87296
FLASH_AREA_GLOBAL_PCT = 0.25
FLASH_LUMINANCE_DELTA = 0.10
FLASH_DARK_REGION_MAX_LUMINANCE = 0.80

# =============================================================================
# PRESETS DE MOLA
# =============================================================================

@dataclass
class SpringPreset:
    zeta: float
    settling_time_seconds: float
    label: str

SPRING_PRESETS = {
    "snappy": SpringPreset(zeta=0.7, settling_time_seconds=0.25, label="Chega e para; repique pequeno"),
    "suave": SpringPreset(zeta=1.0, settling_time_seconds=0.5, label="Amortecimento critico, zero repique"),
    "overshoot": SpringPreset(zeta=0.45, settling_time_seconds=0.4, label="Repique deliberado, para enfase"),
}

SPRING_DURATION_REST_THRESHOLD = 0.005

# =============================================================================
# CONTRASTE — utilidade
# =============================================================================

def hex_to_luminance(hex_color: str) -> float:
    """sRGB para luminancia relativa (WCAG 2.2).
    Fonte: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
    """
    r = int(hex_color[1:3], 16) / 255.0
    g = int(hex_color[3:5], 16) / 255.0
    b = int(hex_color[5:7], 16) / 255.0

    def linearize(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)

def contrast_ratio(hex1: str, hex2: str) -> float:
    """Razao de contraste entre duas cores hex.
    Fonte: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
    """
    l1 = hex_to_luminance(hex1)
    l2 = hex_to_luminance(hex2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

# =============================================================================
# VALIDACAO RAPIDA
# =============================================================================

if __name__ == "__main__":
    # Verifica que pares de contraste essenciais passam
    pairs = [
        (TEXT["primary"], BACKGROUND["primary"], "text.primary / bg.primary"),
        (TEXT["dark"], BACKGROUND["light"], "text.dark / bg.light"),
    ]
    for fg, bg, label in pairs:
        ratio = contrast_ratio(fg, bg)
        status = "AA" if ratio >= 4.5 else "AA-large" if ratio >= 3.0 else "FAIL"
        print(f"{label}: {ratio:.2f}:1 ({status})")
    print("tokens.py: OK")
