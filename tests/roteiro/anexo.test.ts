// =============================================================================
// MODULO DE ANEXO (src/roteiro/anexo/**) — o anexo do usuario (gif/video)
// =============================================================================
//
// Contrato (docs/roteiro/api.md §"PUT .../anexo" + src/roteiro/anexo/):
//   - allowlist FECHADA de tipos: VOCABULARIO_TIPO_ANEXO (image/gif |
//     video/mp4 | video/webm) — fora dela, regra anexo-tipo-permitido;
//   - tamanho <= ANEXO_TAMANHO_MAXIMO_BYTES (200 MB, constante do
//     contrato — fonte unica) — acima, regra anexo-tamanho-limite;
//   - corpo vazio -> ErroAnexoVazio (regra anexo-vazio na rota);
//   - sha256 dos bytes + store append-only por hash (S-8): mesmo conteudo
//     2x = mesmo hash e UMA entrada (FQ-N1 — put idempotente);
//   - procedencia no ato (auditoria): license CC0-1.0 (convencao de asset
//     sintetico do proprio pipeline), attributionRequired false (asset do
//     proprio usuario, ADR-0003), source "local", acquiredAt do relogio
//     injetado, mime/tamanho medidos, origem em notes;
//   - o upload NUNCA decide tipo_visual (upload primeiro, tipo depois).
//
// Anti-C2: cada grupo fecha com sonda negativa sobre o ALVO do grupo —
// hash correto, entrada unica no store, procedencia auditavel, erro
// nomeado com regra do contrato.
// =============================================================================

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  ANEXO_TAMANHO_MAXIMO_BYTES,
  VOCABULARIO_TIPO_ANEXO,
} from "../../src/roteiro/contrato/contrato.js";
import {
  ErroAnexoVazio,
  ErroTamanhoAnexoExcedido,
  ErroTipoAnexoInvalido,
  procedenciaDoAnexo,
  receberAnexo,
  validarTamanhoAnexo,
  validarTipoAnexo,
  VERSAO_MODULO_ANEXO,
} from "../../src/roteiro/anexo/index.js";
import { Store } from "../../src/store/store.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const raizes: string[] = [];

function novoStore(): { store: Store; raiz: string } {
  const raiz = mkdtempSync(join(tmpdir(), "anexo-store-teste-"));
  raizes.push(raiz);
  return { store: new Store({ root: raiz }), raiz };
}

function relogioFixo(): () => Date {
  return () => new Date("2026-08-14T10:00:00.000Z");
}

/** Conta os arquivos (recursivo) sob a raiz do store. */
function contarArquivos(raiz: string): number {
  let total = 0;
  for (const nome of readdirSync(raiz, "utf-8")) {
    const caminho = join(raiz, nome);
    total += statSync(caminho).isDirectory() ? contarArquivos(caminho) : 1;
  }
  return total;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

afterEach(() => {
  for (const raiz of raizes.splice(0)) {
    rmSync(raiz, { recursive: true, force: true });
  }
});

const BYTES_GIF = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xFF\xFF\xFF\x21\xF9\x04\x01\x00\x00\x00\x00\x2C\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3B", "binary");
const BYTES_MP4 = Buffer.from("\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42mp41\x00\x00\x00\x00", "binary");
const BYTES_WEBM = Buffer.from("\x1A\x45\xDF\xA3\x9F\x42\x86\x81\x01\x42\xF7\x81\x01\x42\xF2\x81\x04\x42\xF3\x81\x08\x42\x82\x84webm", "binary");

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 1 — receberAnexo: o caminho feliz (hash, meta, store, procedencia)
// ═════════════════════════════════════════════════════════════════════════════
describe("receberAnexo: validacao -> hash -> store com procedencia -> par (hash, meta)", () => {
  it("grava os bytes por sha256 e devolve o par com tipo/tamanho/nome_original", async () => {
    const { store, raiz } = novoStore();
    const resultado = await receberAnexo(
      BYTES_GIF,
      { tipo: "image/gif", nome_original: "reacao.gif" },
      { store, relogio: relogioFixo() },
    );
    // Sonda do grupo: o hash e o sha256 REAL dos bytes (endereco por conteudo).
    expect(resultado.hash_anexo).toBe(sha256(BYTES_GIF));
    expect(resultado.anexo_meta).toEqual({
      tipo: "image/gif",
      tamanho_bytes: BYTES_GIF.length,
      nome_original: "reacao.gif",
    });
    const lido = await store.get(resultado.hash_anexo);
    expect(lido).not.toBeNull();
    expect(lido!.equals(BYTES_GIF)).toBe(true);
    // Procedencia auditavel ao lado dos bytes.
    const procedencia = JSON.parse(
      readFileSync(store.procedenciaPath(resultado.hash_anexo), "utf-8"),
    ) as Record<string, unknown>;
    expect(procedencia.license).toBe("CC0-1.0");
    expect(procedencia.attributionRequired).toBe(false);
    expect(procedencia.source).toBe("local");
    expect(procedencia.acquiredAt).toBe("2026-08-14T10:00:00.000Z");
    expect(procedencia.mimeType).toBe("image/gif");
    expect(procedencia.byteSize).toBe(BYTES_GIF.length);
    expect(procedencia.toolVersion).toBe(`anexo-${VERSAO_MODULO_ANEXO}`);
    const notas = String(procedencia.notes);
    expect(notas).toContain("origem: local-usuario");
    expect(notas).toContain("nome_original=reacao.gif");
    expect(notas).toContain("mime_declarado=image/gif");
    expect(notas).toContain("ADR-0003");
    expect(contarArquivos(raiz)).toBe(2); // 1 byte + 1 procedencia
  });

  it("os tres tipos da allowlist passam e o tipo chega ao meta sem estreitamento", async () => {
    const { store } = novoStore();
    const casos: Array<[Buffer, string]> = [
      [BYTES_GIF, "image/gif"],
      [BYTES_MP4, "video/mp4"],
      [BYTES_WEBM, "video/webm"],
    ];
    for (const [bytes, tipo] of casos) {
      const resultado = await receberAnexo(bytes, { tipo }, { store, relogio: relogioFixo() });
      expect(resultado.anexo_meta.tipo).toBe(tipo);
      expect(resultado.anexo_meta.tamanho_bytes).toBe(bytes.length);
      expect((await store.get(resultado.hash_anexo))!.equals(bytes)).toBe(true);
    }
  });

  it("sem nome_original, o meta carrega \"\" (campo sempre presente)", async () => {
    const { store } = novoStore();
    const resultado = await receberAnexo(BYTES_GIF, { tipo: "image/gif" }, { store, relogio: relogioFixo() });
    expect(resultado.anexo_meta.nome_original).toBe("");
  });

  it("dedupe por hash: mesmo conteudo 2x = mesmo hash e UMA entrada no store (FQ-N1)", async () => {
    const { store, raiz } = novoStore();
    const primeiro = await receberAnexo(BYTES_GIF, { tipo: "image/gif", nome_original: "a.gif" }, { store, relogio: relogioFixo() });
    const segundo = await receberAnexo(BYTES_GIF, { tipo: "image/gif", nome_original: "b.gif" }, { store, relogio: relogioFixo() });
    // Sonda do grupo: hash identico + UMA entrada (append-only por conteudo).
    expect(segundo.hash_anexo).toBe(primeiro.hash_anexo);
    expect(contarArquivos(raiz)).toBe(2); // 1 byte + 1 procedencia, nao 4
    // A segunda procedencia nao sobrescreve a primeira (asset imutavel).
    const procedencia = JSON.parse(
      readFileSync(store.procedenciaPath(primeiro.hash_anexo), "utf-8"),
    ) as { notes: string };
    expect(procedencia.notes).toContain("nome_original=a.gif");
  });

  it("conteudo DIFERENTE = hash diferente = entrada propria (nada e sobrescrito)", async () => {
    const { store, raiz } = novoStore();
    const a = await receberAnexo(BYTES_GIF, { tipo: "image/gif" }, { store, relogio: relogioFixo() });
    const b = await receberAnexo(Buffer.concat([BYTES_GIF, Buffer.from([0])]), { tipo: "image/gif" }, { store, relogio: relogioFixo() });
    expect(a.hash_anexo).not.toBe(b.hash_anexo);
    expect(contarArquivos(raiz)).toBe(4); // 2 bytes + 2 procedencias
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 2 — validacoes nomeadas (regras do contrato)
// ═════════════════════════════════════════════════════════════════════════════
describe("validacoes: tipo na allowlist, tamanho no teto, corpo nao-vazio", () => {
  it("validarTipoAnexo aceita EXATAMENTE VOCABULARIO_TIPO_ANEXO e estreita o tipo", () => {
    expect(VOCABULARIO_TIPO_ANEXO).toEqual(["image/gif", "video/mp4", "video/webm"]);
    for (const tipo of VOCABULARIO_TIPO_ANEXO) {
      expect(validarTipoAnexo(tipo)).toBe(tipo);
    }
  });

  it.each([
    "image/png",
    "image/jpeg",
    "video/quicktime",
    "application/octet-stream",
    "",
    "IMAGE/GIF", // MIME e case-sensitive — maiusculo e fora
    "image/gif ",
  ])("tipo fora da allowlist \"%s\" -> ErroTipoAnexoInvalido com a regra anexo-tipo-permitido", (tipo) => {
    let lancou = false;
    try {
      validarTipoAnexo(tipo);
    } catch (erro) {
      lancou = true;
      expect(erro).toBeInstanceOf(ErroTipoAnexoInvalido);
      expect((erro as ErroTipoAnexoInvalido).code).toBe("ANEXO_TIPO_INVALIDO");
      expect((erro as ErroTipoAnexoInvalido).message).toContain("anexo-tipo-permitido");
      expect((erro as ErroTipoAnexoInvalido).message).toContain("image/gif");
    }
    // Sonda do grupo: o caso em que NADA lanca e a regressao silenciosa.
    expect(lancou, `tipo "${tipo}" deveria ter sido rejeitado`).toBe(true);
  });

  it("validarTamanhoAnexo: na fronteira exata passa; um byte acima lanca a regra nomeada", () => {
    expect(() => validarTamanhoAnexo(0)).not.toThrow();
    expect(() => validarTamanhoAnexo(1)).not.toThrow();
    expect(() => validarTamanhoAnexo(ANEXO_TAMANHO_MAXIMO_BYTES)).not.toThrow();
    let lancou = false;
    try {
      validarTamanhoAnexo(ANEXO_TAMANHO_MAXIMO_BYTES + 1);
    } catch (erro) {
      lancou = true;
      expect(erro).toBeInstanceOf(ErroTamanhoAnexoExcedido);
      expect((erro as ErroTamanhoAnexoExcedido).code).toBe("ANEXO_TAMANHO_EXCEDIDO");
      expect((erro as ErroTamanhoAnexoExcedido).message).toContain("anexo-tamanho-limite");
      expect((erro as ErroTamanhoAnexoExcedido).message).toContain(String(ANEXO_TAMANHO_MAXIMO_BYTES));
    }
    expect(lancou).toBe(true);
  });

  it("receberAnexo com bytes vazios -> ErroAnexoVazio (o store nunca e tocado)", async () => {
    const { store, raiz } = novoStore();
    let lancou = false;
    try {
      await receberAnexo(Buffer.alloc(0), { tipo: "image/gif" }, { store, relogio: relogioFixo() });
    } catch (erro) {
      lancou = true;
      expect(erro).toBeInstanceOf(ErroAnexoVazio);
      expect((erro as ErroAnexoVazio).code).toBe("ANEXO_VAZIO");
      expect((erro as ErroAnexoVazio).message).toContain("nao pode ser vazio");
    }
    expect(lancou).toBe(true);
    expect(contarArquivos(raiz)).toBe(0);
  });

  it("receberAnexo com tipo fora da allowlist rejeita ANTES de gravar qualquer coisa", async () => {
    const { store, raiz } = novoStore();
    await expect(
      receberAnexo(BYTES_GIF, { tipo: "image/png" }, { store, relogio: relogioFixo() }),
    ).rejects.toBeInstanceOf(ErroTipoAnexoInvalido);
    expect(contarArquivos(raiz)).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 3 — procedenciaDoAnexo (auditoria no ato, ADR-0003)
// ═════════════════════════════════════════════════════════════════════════════
describe("procedenciaDoAnexo: origem declarada, licenca CC0-1.0, relogio injetado", () => {
  const base = {
    tipo: "video/mp4",
    byteSize: 1234,
    relogio: relogioFixo(),
    toolVersion: "anexo-1.0.0",
  };

  it("com nome_original, as notas carregam origem + nome + mime", () => {
    const p = procedenciaDoAnexo({ ...base, nomeOriginal: "gravacao.mp4" });
    expect(p).toEqual({
      license: "CC0-1.0",
      attributionRequired: false,
      source: "local",
      acquiredAt: "2026-08-14T10:00:00.000Z",
      mimeType: "video/mp4",
      byteSize: 1234,
      toolVersion: "anexo-1.0.0",
      notes: expect.stringContaining("nome_original=gravacao.mp4") as unknown as string,
    });
    expect(p.notes).toContain("origem: local-usuario");
    expect(p.notes).toContain("mime_declarado=video/mp4");
    expect(p.notes).toContain("sem atribuicao devida");
  });

  it("sem nome_original (ou vazio), as notas omitem o campo", () => {
    const semNome = procedenciaDoAnexo({ ...base });
    expect(semNome.notes).not.toContain("nome_original=");
    const nomeVazio = procedenciaDoAnexo({ ...base, nomeOriginal: "" });
    expect(nomeVazio.notes).not.toContain("nome_original=");
  });

  it("o relogio injetado e a unica fonte do acquiredAt (determinismo da procedencia)", () => {
    const p = procedenciaDoAnexo({
      ...base,
      relogio: () => new Date("2026-01-02T03:04:05.678Z"),
    });
    expect(p.acquiredAt).toBe("2026-01-02T03:04:05.678Z");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 4 — o relogio default (o servidor registra o momento real)
// ═════════════════════════════════════════════════════════════════════════════
describe("relogio default (sem opcoes.relogio)", () => {
  it("acquiredAt e uma data ISO valida e proxima do agora", async () => {
    const { store } = novoStore();
    const antes = Date.now();
    const resultado = await receberAnexo(BYTES_GIF, { tipo: "image/gif" }, { store });
    const procedencia = JSON.parse(
      readFileSync(store.procedenciaPath(resultado.hash_anexo), "utf-8"),
    ) as { acquiredAt: string };
    const instante = Date.parse(procedencia.acquiredAt);
    expect(Number.isFinite(instante)).toBe(true);
    expect(instante).toBeGreaterThanOrEqual(antes - 5000);
    expect(instante).toBeLessThanOrEqual(Date.now() + 5000);
  });

  it("a procedencia do anexo existe no disco ao lado dos bytes (auditoria completa)", async () => {
    const { store } = novoStore();
    const resultado = await receberAnexo(BYTES_WEBM, { tipo: "video/webm" }, { store });
    expect(existsSync(store.procedenciaPath(resultado.hash_anexo))).toBe(true);
  });
});
