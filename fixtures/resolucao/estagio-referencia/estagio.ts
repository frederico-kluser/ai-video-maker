/**
 * fixtures/resolucao/estagio-referencia/estagio.ts
 *
 * ESTAGIO DE REFERENCIA — o template dos cinco cards da W4.
 *
 * Copie este arquivo para `src/resolucao/<nome>/estagio.ts`, troque o
 * nome, a versao e o corpo de `resolver()`. Tudo o mais e obrigatorio.
 *
 * Este arquivo mora em `fixtures/` de proposito: `src/resolucao/*\/estagio.ts`
 * e descoberto pela convencao (Regra 6) e exigiria cassete gravado.
 * O template nao e um estagio de verdade — nao pode entrar na cobertura.
 *
 * Ele e deterministico: a saida depende apenas do manifesto e dos
 * parametros. E isso que permite a `just res:cassete` gravar duas vezes
 * e exigir bytes identicos. Um estagio real (TTS, Manim, download) nao
 * e deterministico na origem — o cassete e que o torna deterministico
 * para todo mundo abaixo da fronteira.
 */

import { createHash } from "node:crypto";
import type {
  EntradaEstagio,
  EstagioResolucao,
  SaidaEstagio,
} from "../../../src/resolucao/contrato.js";
import type { AssetResolvido } from "../../../src/resolucao/manifesto-resolvido.js";
import type {
  ProcedenciaAsset,
  ProcedenciaCassete,
} from "../../../src/resolucao/cassete/formato.js";

/** Licenca declarada. Obrigatoria: e o ∅-crit dos cinco cards da W4. */
const LICENCA = "CC0-1.0";

const estagio: EstagioResolucao = {
  // ── 1. Identidade ────────────────────────────────────────────────────────
  // O nome e um dos cinco canonicos. A versao entra na chave de cache:
  // mudou o corpo de resolver() de um jeito que muda a saida? bumpe aqui.
  identidade: { nome: "locucao", versao: "1.0.0" },

  // ── 2. Parametros ────────────────────────────────────────────────────────
  // Tudo que muda a saida e nao esta no manifesto. Escalares apenas.
  // Omitir um parametro daqui e o modo de falha C12: o cache acerta pelo
  // motivo errado e voce serve o audio da voz antiga para sempre.
  parametros: { voz: "referencia", velocidade: 1, formato: "wav" },

  // ── 3. Resolucao ─────────────────────────────────────────────────────────
  async resolver(entrada: EntradaEstagio): Promise<SaidaEstagio> {
    const assets: Record<string, AssetResolvido> = {};
    const nosLocucao: Record<string, string> = {};
    const procedenciaAssets: ProcedenciaAsset[] = [];

    // Um estagio real chamaria `entrada.fetch(...)` aqui — nunca
    // `globalThis.fetch`. So `entrada.fetch` e gravado no cassete; o
    // global bate no guarda de rede e derruba a suite.
    for (const no of entrada.manifesto.nos) {
      const semente = [
        entrada.manifesto.schema_version,
        no.id,
        String(entrada.parametros.voz),
        String(entrada.parametros.velocidade),
      ].join("|");
      const hash = createHash("sha256").update(semente, "utf-8").digest("hex");

      assets[hash] = {
        hash,
        tipo: "audio",
        mimeType: "audio/wav",
        // Nunca uma URL: so hash e metadado (C7).
        licenca: LICENCA,
        atribuicaoObrigatoria: false,
        provedor: "referencia",
      };
      nosLocucao[no.id] = hash;
      procedenciaAssets.push({
        hash,
        licenca: LICENCA,
        atribuicaoObrigatoria: false,
        provedor: "referencia",
      });
    }

    const procedencia: ProcedenciaCassete = {
      licenca: LICENCA,
      provedor: "referencia",
      ferramenta: "estagio-referencia 1.0.0",
      assets: procedenciaAssets,
      notas: "Estagio de referencia — nao chama rede, saida deriva do manifesto.",
    };

    return {
      parcial: { assets, nos_locucao: nosLocucao },
      procedencia,
    };
  },
};

export default estagio;
