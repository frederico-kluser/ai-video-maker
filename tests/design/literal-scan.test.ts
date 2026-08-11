// =============================================================================
// Varredura de literais — gate "zero literais fora de src/design/"
// =============================================================================
// Regra: nenhum literal numerico ou #hex deve existir no codigo de composicao.
// Todo valor que toca pixel ou som vem de src/design/tokens.ts, importado.
// Um literal duplicado nao quebra hoje; ele destroi o custo de reversao de
// ~15 linhas que justifica o arquivo de tokens.
//
// Fonte: motion-design-system SKILL.md §O arquivo e o vocabulario
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// Diretorios e arquivos a escanear
// ---------------------------------------------------------------------------

/** Diretorios que contem codigo fonte (TS, TSX) */
const SOURCE_DIRS = ["src"];

/** Arquivos explicitamente excluidos da varredura */
const EXCLUDED_FILES = new Set([
  "src/design/tokens.ts", // o proprio arquivo de tokens
  "tests/design/literal-scan.test.ts", // este teste
]);

/** Extensoes a escanear */
const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

// ---------------------------------------------------------------------------
// Coletores de arquivos
// ---------------------------------------------------------------------------

function* walkDir(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      // Skip node_modules, dist, .git, etc.
      if (
        entry === "node_modules" ||
        entry === "dist" ||
        entry === ".git" ||
        entry === "output" ||
        entry === ".remotion" ||
        entry === ".cache" ||
        entry === "__pycache__" ||
        entry.startsWith(".")
      ) {
        continue;
      }
      yield* walkDir(fullPath);
    } else if (stat.isFile()) {
      const ext = extname(entry);
      if (SCAN_EXTENSIONS.has(ext)) {
        const relPath = relative(rootDir, fullPath);
        if (!EXCLUDED_FILES.has(relPath)) {
          yield relPath;
        }
      }
    }
  }
}

function collectFiles(): string[] {
  const files: string[] = [];
  for (const dir of SOURCE_DIRS) {
    const fullDir = resolve(rootDir, dir);
    for (const file of walkDir(fullDir)) {
      files.push(file);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Padroes de literal proibido
// ---------------------------------------------------------------------------
// Cada padrao captura uma classe de literal que deveria ser um token.
// Regex com nome para mensagem de erro clara.

interface LiteralPattern {
  name: string;
  regex: RegExp;
  /** Linhas a ignorar dentro do match (ex.: imports, comentarios) */
  ignoreLines?: RegExp;
  /** Contexto: o que este padrao captura */
  description: string;
}

const PATTERNS: LiteralPattern[] = [
  // --- Cores hex ---
  {
    name: "hex-color",
    regex: /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
    description: "Cor hexadecimal literal (ex.: #3B82F6). Use tokens.palette ou cor semantica.",
  },
  // --- Duracoes em ms ---
  {
    name: "duration-ms",
    regex: /\b(\d+)\s*\bms\b/g,
    description: "Duracao literal em ms (ex.: 300ms). Use tokens.transitionDuration.",
  },
  // --- Duracoes em segundos ---
  {
    name: "duration-s",
    regex: /(?<![a-zA-Z0-9])(\d+(?:\.\d+)?)\s*[sS](?![a-zA-Z])/g,
    description: "Duracao literal em segundos (ex.: 0.833s). Use tokens.minTextDurationSeconds.",
  },
  // --- Pixels hardcoded (spacing, safe areas) ---
  {
    name: "px-literal",
    regex: /\b(\d{2,4})\s*px\b/g,
    description: "Valor literal em px (ex.: 1080px). Use tokens.breakpoints, tokens.safeArea.",
  },
  // --- Safe area percentages ---
  {
    name: "safe-area-pct",
    regex: /(?:safeArea|safe[_-]?area|actionSafe|graphicsSafe|topPct|bottomPct|rightPct)\s*[:=]\s*(0\.\d+)/gi,
    description: "Safe area percentual redeclarada. Importe de tokens.safeArea*.",
  },
  // --- LUFS literal ---
  {
    name: "lufs-literal",
    regex: /(?<![a-zA-Z])(?:targetLufs|lufs|LUFS)\s*[:=]\s*(-?\d+(?:\.\d+)?)/gi,
    description: "LUFS literal redeclarado. Use tokens.targetLufs.",
  },
  // --- CPS literal ---
  {
    name: "cps-literal",
    regex: /(?<![a-zA-Z])(?:maxCps|cps|CPS|charsPerSecond)\s*[:=]\s*(\d+)/gi,
    description: "CPS literal redeclarado. Use tokens.maxCpsAdult.",
  },
  // --- Flash limit literal ---
  {
    name: "flash-literal",
    regex: /(?<![a-zA-Z])(?:maxFlashes|flashesPerSecond)\s*[:=]\s*(\d+)/gi,
    description: "Limite de flash redeclarado. Use tokens.maxFlashesPerSecond.",
  },
  // --- Z-index literal ---
  {
    name: "zindex-literal",
    regex: /(?<![a-zA-Z])zIndex\s*[:=]\s*(\d+)/gi,
    description: "z-index literal redeclarado. Use tokens.zIndex.",
  },
];

// ---------------------------------------------------------------------------
// Linhas de excecao — permitidas mesmo casando o padrao
// ---------------------------------------------------------------------------
// Ex.: imports de tokens, comentarios de documentacao, definicoes de tipo.

const ALLOWED_LINE_PATTERNS = [
  /^import\s/,                          // import statements
  /^\/\/\s*eslint/,                     // eslint directives
  /^\/\*\s*eslint/,                     // eslint block directives
  /@ts-ignore/,                         // ts-ignore
  /@ts-expect-error/,                   // ts-expect-error
  /^export\s+interface/,                // type definitions
  /^export\s+type/,                     // type exports
  /from\s+["']src\/design\/tokens["']/, // importing from tokens
  /from\s+["']\.\.\/design\/tokens["']/, // relative import from tokens
  /from\s+["']\.\/tokens["']/,          // same-dir import
  /^\/\/\s*Fonte:/,                     // source comments
  /^\/\/\s*https?:/,                    // URL comments
  /^\/\/\s*REGRA:/,                     // rule comments
  /^\/\/\s*Este\s/,                     // "Este arquivo" comments
  /^\/\/\s*Placeholder/,                 // placeholder comments
  /^\/\/\s*esqueleto/,                  // skeleton comments
  /^\/\/\s*TOKENS/,                     // token header comments
];

function isAllowedLine(line: string): boolean {
  return ALLOWED_LINE_PATTERNS.some((pattern) => pattern.test(line.trim()));
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("Varredura de literais — zero literais fora de src/design/", () => {
  const files = collectFiles();

  it("encontrou arquivos para escanear (sonda negativa contra seletor vazio)", () => {
    // Se nao houver arquivos, o gate sai verde por nao ter olhado nada.
    // Fonte: motion-design-system SKILL.md §Falso verde deste dominio
    expect(files.length, "Nenhum arquivo encontrado para escanear. Seletor vazio = falso verde.").toBeGreaterThan(0);
  });

  // Um teste por arquivo + padrao para mensagens de erro claras
  for (const file of files) {
    for (const pattern of PATTERNS) {
      it(`${file}: sem literais "${pattern.name}"`, () => {
        const fullPath = resolve(rootDir, file);
        let content: string;
        try {
          content = readFileSync(fullPath, "utf-8");
        } catch {
          // Arquivo pode ter sido removido entre a coleta e o teste
          return;
        }

        const violations: string[] = [];
        const lines = content.split("\n");

        // Reset regex state
        pattern.regex.lastIndex = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          // Skip allowed lines
          if (isAllowedLine(line)) continue;
          // Skip pure comment lines
          if (line.trim().startsWith("//")) continue;
          if (line.trim().startsWith("*")) continue;

          // Reset regex per line
          pattern.regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = pattern.regex.exec(line)) !== null) {
            const value = match[1] || match[0];
            violations.push(
              `  linha ${i + 1}: "${match[0].trim()}" — ${pattern.description}`,
            );
          }
        }

        if (violations.length > 0) {
          expect.fail(
            `${violations.length} literal(is) "${pattern.name}" em ${file}:\n${violations.join("\n")}`,
          );
        }
      });
    }
  }
});