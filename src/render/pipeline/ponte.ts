// =============================================================================
// A PONTE AUTORIA -> COMPOSICAO — AB-550 (C2 do contrato-w7 §3)
// =============================================================================
//
// A ponte fecha a fronteira RESOLUCAO/COMPOSICAO no ponto de consumo do
// render. Tudo que ela preenche tem FONTE NOMEADA — nenhum campo nasce
// digitado a mao na ponte:
//
//   frames  -> da composicao: `planoDeComposicao` (aritmetica de F1-01,
//              calcularDuracao) — a MESMA que o timing canonico e o
//              envelope de ducking usam (AB-520/AB-600);
//   cores   -> dos tokens: `src/design/tokens.ts` (S-1 — leitura, nunca
//              edicao); a ponte importa o valor e registra o nome do token;
//   hash    -> dos bytes dos assets: SHA-256 (store de F0-07) — a ponte
//              RE-CALCULA o hash dos bytes que recebe e exige casamento
//              com a chave declarada (C7: nada de URL, nada de nome de
//              arquivo como identidade);
//   licenca -> da procedencia de F0-07 (`procedencia.json`, campo
//              `license` obrigatorio) — nunca digitada na ponte.
//
// E a ponte VALIDA A INTEGRIDADE REFERENCIAL (AB-631/AB-654): `cena.nos`
// so pode referenciar no existente no manifesto resolvido. O schema
// Autoria.1 nao valida isso (AB-654) e o reparo da W6 rejeita por politica
// (AB-631) — a ponte fecha o furo no ponto de consumo: manifesto resolvido
// com cena referenciando no inexistente e ERRO, com mensagem nomeando a
// regra e o caminho (contrato-w7 §3):
//
//     cena "c-003": referencia no inexistente "n-999" (regra
//     integridade-referencial, campo cena.nos)
//
// A ponte e funcao pura (bytes e procedencias entram por parametro): o
// mesmo conjunto de entradas produz o mesmo resultado — testavel sem
// render e sem disco.
// =============================================================================

import { createHash } from "node:crypto";
import type { Manifesto, NodeId } from "../../contratos/manifesto";
import {
  planoDeComposicao,
  type PlanoDeComposicao,
} from "../../composicao/ManifestoRaiz";
import { background } from "../../design/tokens";
import type { Procedencia } from "../../store/procedencia";

// ─── As regras que a ponte aplica (nomeadas nas mensagens de erro) ────────────

/** Integridade referencial: cena.nos so referencia no existente (AB-654). */
export const REGRA_INTEGRIDADE_REFERENCIAL = "integridade-referencial";
/** Hash: a chave do asset e o SHA-256 dos bytes (F0-07/C7). */
export const REGRA_HASH_DOS_BYTES = "hash-dos-bytes";
/** Licenca: vem da procedencia de F0-07, nunca digitada a mao. */
export const REGRA_LICENCA_DE_PROCEDENCIA = "licenca-de-procedencia";

/** Erro da ponte: manifesto que nao pode atravessar a fronteira. */
export class ErroDePonte extends Error {
  readonly code = "PONTE_REPROVOU";
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDePonte";
  }
}

// ─── Entradas e saida ──────────────────────────────────────────────────────────

/** Entradas da ponte — tudo resolvido, nada digitado a mao na ponte. */
export interface EntradasDaPonte {
  /** O manifesto de autoria. */
  readonly manifesto: Manifesto;
  /** Assets por hash declarado: hash -> bytes. */
  readonly assets: ReadonlyMap<string, Buffer>;
  /** Procedencia por hash (F0-07): hash -> procedencia. */
  readonly procedencias: ReadonlyMap<string, Procedencia>;
  /** Nos de grafico por id: noId -> hash do asset (AB-364). */
  readonly nosGrafico: ReadonlyMap<string, string>;
}

/** Um campo preenchido pela ponte, com a fonte nomeada ao lado. */
export interface FonteNomeada<T> {
  readonly valor: T;
  /** A fonte do valor — nome do modulo/regra que o produziu. */
  readonly fonte: string;
}

/** A cor da fronteira, com o token de onde veio (S-1). */
export interface CorDaFronteira extends FonteNomeada<string> {
  /** Nome do token em src/design/tokens.ts. */
  readonly token: string;
}

/** Um asset atravessado pela ponte, com a licenca da procedencia. */
export interface AssetDaPonte {
  readonly hash: string;
  readonly bytes: Buffer;
  readonly licenca: FonteNomeada<string>;
}

/** O manifesto resolvido que a ponte entrega a composicao. */
export interface ResultadoDaPonte {
  readonly schema_version: "ManifestoResolvido.1";
  readonly manifesto: Manifesto;
  /** O plano da composicao (F1-01) — a fonte dos frames. */
  readonly plano: PlanoDeComposicao;
  readonly assets: ReadonlyMap<string, AssetDaPonte>;
  readonly nosGrafico: ReadonlyMap<string, string>;
  readonly campos: {
    /** Frames: aritmetica de F1-01 (calcularDuracao/planoDeComposicao). */
    readonly frames: FonteNomeada<string>;
    /** Cores: token de src/design/tokens.ts (S-1). */
    readonly cores: CorDaFronteira;
    /** Hash: SHA-256 dos bytes, re-calculado (F0-07/C7). */
    readonly hash: FonteNomeada<string>;
    /** Licenca: procedencia de F0-07, nunca digitada a mao. */
    readonly licenca: FonteNomeada<string>;
  };
}

// ─── A travessia ───────────────────────────────────────────────────────────────

/**
 * Atravessa a ponte: valida a integridade referencial e os tres campos de
 * fronteira (hash, licenca, frames/cores), devolvendo o manifesto resolvido.
 *
 * @throws ErroDePonte para qualquer violacao, com mensagem nomeando a
 *   regra e o caminho do campo — a assinatura do ∅-crit (C2).
 */
export function atravessarPonte(entradas: EntradasDaPonte): ResultadoDaPonte {
  const { manifesto, assets, procedencias, nosGrafico } = entradas;

  // ── Integridade referencial (AB-631/AB-654): cena.nos -> no existente ──
  const nosDoManifesto = new Map<string, NodeId>(
    manifesto.nos.map((no) => [no.id, no.id]),
  );
  for (const cena of manifesto.cenas) {
    for (const noId of cena.nos) {
      if (!nosDoManifesto.has(noId)) {
        throw new ErroDePonte(
          `cena "${cena.id}": referencia no inexistente "${noId}" ` +
            `(regra ${REGRA_INTEGRIDADE_REFERENCIAL}, campo cena.nos)`,
        );
      }
    }
  }

  // ── Hash: a chave e o SHA-256 dos bytes (F0-07/C7) ──
  const atravessados = new Map<string, AssetDaPonte>();
  for (const [hash, bytes] of assets) {
    const calculado = createHash("sha256").update(bytes).digest("hex");
    if (calculado !== hash) {
      throw new ErroDePonte(
        `asset "${hash}": o SHA-256 dos bytes e "${calculado}" — a chave ` +
          `mentiu (regra ${REGRA_HASH_DOS_BYTES}, campo assets."${hash}")`,
      );
    }
    const procedencia = procedencias.get(hash);
    if (procedencia === undefined || procedencia.license === "") {
      throw new ErroDePonte(
        `asset "${hash}": sem procedencia com licenca — a licenca vem da ` +
          `procedencia de F0-07, nunca digitada a mao ` +
          `(regra ${REGRA_LICENCA_DE_PROCEDENCIA}, campo assets."${hash}".licenca)`,
      );
    }
    atravessados.set(hash, {
      hash,
      bytes,
      licenca: {
        valor: procedencia.license,
        fonte: "src/store/procedencia.ts (F0-07): procedencia.json, campo license",
      },
    });
  }

  // ── Nos de grafico: so referenciam asset atravessado (AB-364) ──
  for (const [noId, hash] of nosGrafico) {
    if (!atravessados.has(hash)) {
      throw new ErroDePonte(
        `no de grafico "${noId}": referencia o asset "${hash}" que nao ` +
          `atravessou a ponte (regra ${REGRA_HASH_DOS_BYTES}, campo nosGrafico."${noId}")`,
      );
    }
  }

  // ── Frames: a aritmetica de F1-01 (AB-520) — lança ErroDeComposicao
  //    para manifesto que a raiz recusaria ──
  const plano = planoDeComposicao(manifesto);

  // ── Cores: token de src/design/tokens.ts (S-1 — leitura, nunca edicao) ──
  const corDeBase: CorDaFronteira = {
    valor: background.primary,
    token: "background.primary",
    fonte: "src/design/tokens.ts (S-1)",
  };

  return {
    schema_version: "ManifestoResolvido.1",
    manifesto,
    plano,
    assets: atravessados,
    nosGrafico,
    campos: {
      frames: {
        valor:
          `${String(plano.totalFrames)} frames em ${String(plano.width)}x` +
          `${String(plano.height)}@${String(plano.fps)}fps`,
        fonte: "src/composicao (aritmetica de F1-01): planoDeComposicao",
      },
      cores: corDeBase,
      hash: {
        valor: "sha256",
        fonte: "src/store/store.ts (F0-07): Store.hashBuffer dos bytes",
      },
      licenca: {
        valor: "procedencia.json (F0-07)",
        fonte: "src/store/procedencia.ts (F0-07)",
      },
    },
  };
}
