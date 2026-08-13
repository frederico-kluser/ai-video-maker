/**
 * src/resolucao/locucao/replay.ts
 *
 * REPRODUCAO OFFLINE — como F3-01 obtem os BYTES do audio e do timing.
 *
 * ─── O buraco que este arquivo tapa ──────────────────────────────────
 *
 * O contrato de estagio (F2-01) devolve `ParcialResolvido`, que so
 * carrega HASH. Os bytes de cada asset teriam de estar no store de
 * conteudo — mas `EntradaEstagio` nao entrega store nenhum ao estagio, e
 * `Orquestrador.persistirNoStore()` faz `store.get(hash)` e desiste em
 * silencio quando o conteudo nao esta la. Ou seja: hoje ninguem poe os
 * bytes no store. Item de ledger AB-411; nao e invencao deste card
 * consertar contrato alheio.
 *
 * A saida que NAO exige mexer no contrato: os bytes sao uma funcao pura
 * das respostas gravadas no cassete. Reexecutar `resolver()` com o
 * `fetch` do cassete devolve exatamente os mesmos bytes — e devolve
 * offline, com a rede fechada, porque `criarFetchDeCassete` le de
 * `corpos/`.
 *
 * ─── E por que isso e uma PROVA, nao so uma conveniencia ─────────────
 *
 * O mesmo codigo (`resolverUnidade`) roda na gravacao e aqui. Se o
 * estagio tivesse "consertado" alguma coisa no momento da gravacao — em
 * vez de consertar dentro de `resolver()` — o replay produziria outro
 * hash e `conferir()` ficaria vermelho. E a resposta executavel para a
 * pergunta adversarial (4): o cassete e SOSIA, nao sucessor.
 */

import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Manifesto } from "../../contratos/manifesto.js";
import { chaveDeCache, componentesDaChave, hashDoManifesto } from "../contrato.js";
import {
  RAIZ_CASSETES_PADRAO,
  diretorioDoCassete,
} from "../cassete/formato.js";
import { criarFetchDeCassete, lerCassete } from "../cassete/reprodutor.js";
import estagio, { PARAMETROS_LOCUCAO, resolverUnidade, unidadesDeLocucao } from "./estagio.js";
import { serializarTiming } from "./timing.js";
import type { TimingLocucao } from "./timing.js";
import type { Sha256 } from "../manifesto-resolvido.js";

/** Uma unidade de locucao reproduzida do cassete, com os bytes. */
export interface UnidadeReproduzida {
  /** Id da unidade (id da cena). */
  readonly unidade: string;
  /** SHA-256 do audio. Mesma chave de `parcial.nos_locucao`. */
  readonly hashAudio: Sha256;
  /** Bytes do audio, prontos para o store. */
  readonly audio: Buffer;
  /** O documento de timing. */
  readonly timing: TimingLocucao;
  /** Bytes canonicos do documento — e deles que sai o hash do asset. */
  readonly bytesTiming: Buffer;
  /** SHA-256 do documento de timing. */
  readonly hashTiming: Sha256;
}

/** Resultado de uma reproducao. */
export interface ReproducaoDeLocucao {
  readonly chave: string;
  readonly diretorio: string;
  readonly unidades: readonly UnidadeReproduzida[];
}

/** O replay divergiu do que o cassete afirma. */
export class EReplayDivergente extends Error {
  readonly code = "REPLAY_DIVERGENTE";
  constructor(detalhes: readonly string[]) {
    super(
      "O replay do cassete nao reproduziu o resultado gravado:\n" +
        detalhes.map((d) => `  - ${d}`).join("\n") +
        "\n  Ou o estagio consertou algo NA GRAVACAO (e o cassete e sucessor,\n" +
        "  nao sosia), ou `resolver()` mudou sem bump de identidade.versao.",
    );
    this.name = "EReplayDivergente";
  }
}

/**
 * Reexecuta a locucao a partir do cassete, offline, e devolve os bytes.
 *
 * Nao toca a rede: o `fetch` vem de `criarFetchDeCassete`, que le
 * `corpos/<sha256>` do disco. Roda com o guarda de rede armado.
 *
 * @param manifesto o manifesto original (o mesmo que gerou a chave)
 * @param raizCassetes raiz dos cassetes; default `fixtures/cassetes`
 */
export async function reproduzirLocucao(
  manifesto: Manifesto,
  raizCassetes: string = RAIZ_CASSETES_PADRAO,
): Promise<ReproducaoDeLocucao> {
  const chave = chaveDeCache(
    componentesDaChave(estagio, hashDoManifesto(manifesto)),
  );
  const diretorio = diretorioDoCassete(raizCassetes, "locucao", chave);
  const cassete = await lerCassete(raizCassetes, "locucao", chave);
  const buscar = criarFetchDeCassete(cassete, diretorio);

  // A credencial nao entra na chave e nao vai para o cassete; no replay
  // ela e um marcador que nunca sai daqui.
  const credencialDeReplay = "replay";
  const anterior = process.env.LOCUCAO_API_KEY;
  process.env.LOCUCAO_API_KEY = credencialDeReplay;

  try {
    const unidades: UnidadeReproduzida[] = [];
    for (const unidade of unidadesDeLocucao(manifesto)) {
      const { audio, hashAudio, timing } = await resolverUnidade(
        unidade,
        PARAMETROS_LOCUCAO,
        buscar,
        credencialDeReplay,
      );
      const bytesTiming = serializarTiming(timing);
      unidades.push({
        unidade: unidade.unidade,
        hashAudio,
        audio,
        timing,
        bytesTiming,
        hashTiming: hashDeBytes(bytesTiming),
      });
    }

    conferir(cassete.resultado, unidades, diretorio);
    return { chave, diretorio, unidades };
  } finally {
    if (anterior === undefined) delete process.env.LOCUCAO_API_KEY;
    else process.env.LOCUCAO_API_KEY = anterior;
  }
}

/** SHA-256 dos MESMOS bytes que iriam para o store. */
function hashDeBytes(bytes: Buffer): Sha256 {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Confere o replay contra o `resultado.json` gravado.
 *
 * Compara HASH, nao objeto: e o hash que o resto do pipeline usa para
 * achar o byte. Dois objetos "equivalentes" com hashes diferentes sao
 * dois assets diferentes, e a igualdade estrutural esconderia isso.
 */
function conferir(
  resultado: { nos_locucao?: Readonly<Record<string, string>>; assets: Readonly<Record<string, unknown>> },
  unidades: readonly UnidadeReproduzida[],
  diretorio: string,
): void {
  const divergencias: string[] = [];
  const gravado = resultado.nos_locucao ?? {};

  for (const u of unidades) {
    const esperado = gravado[u.unidade];
    if (esperado === undefined) {
      divergencias.push(
        `unidade "${u.unidade}" nao existe em nos_locucao do cassete (${diretorio})`,
      );
      continue;
    }
    if (esperado !== u.hashAudio) {
      divergencias.push(
        `audio de "${u.unidade}": cassete diz ${esperado.slice(0, 16)}…, ` +
          `replay produziu ${u.hashAudio.slice(0, 16)}…`,
      );
    }
    if (resultado.assets[u.hashTiming] === undefined) {
      divergencias.push(
        `timing de "${u.unidade}": o asset ${u.hashTiming.slice(0, 16)}… que o ` +
          `replay produziu nao esta no cassete`,
      );
    }
  }

  // PERGUNTA OBRIGATORIA DA ONDA: a checagem e sobre a presenca dos itens
  // DESTE card, nunca sobre a lista completa de `assets`. Depois do merge
  // o mesmo mapa carrega assets de F2-02, F2-04, F2-05 e F2-06.

  if (divergencias.length > 0) throw new EReplayDivergente(divergencias);
}

/** Caminho do corpo bruto de uma resposta gravada — util em teste. */
export function caminhoDeCorpoGravado(diretorio: string, hash: string): string {
  return join(diretorio, "corpos", hash);
}
