/**
 * src/resolucao/musica/hidratar.ts
 *
 * Reidratacao do store a partir do cassete — o passo que torna
 * "o efeito remoto virou hash no store" verificavel OFFLINE.
 *
 * O problema que isto resolve: `.cache/store/` esta no `.gitignore` (e
 * tem de estar — sao bytes de asset). Entao, num clone novo, o store
 * esta vazio. Se a prova de que o efeito foi enderecado por conteudo
 * dependesse do store existir, ela nao rodaria em lugar nenhum a nao ser
 * na maquina que gravou — ou seja, nao rodaria.
 *
 * O cassete resolve isso sozinho, sem nenhuma decisao nova: o gravador
 * ja escreve cada corpo de resposta em `corpos/<sha256-do-corpo>`. Para
 * um download direto de audio, o corpo da resposta E o audio, logo
 * `sha256(corpo) == hash do asset`. O cassete, portanto, ja e um store
 * enderecado por conteudo — so falta copiar.
 *
 * Consequencias que valem mais que a economia de codigo:
 *
 *   - a prova roda com a REDE BLOQUEADA, porque le do disco;
 *   - ela e byte-a-byte: cada arquivo e rehasheado e comparado com o
 *     proprio nome (um `cp` corrompido reprova);
 *   - a invariante que ela verifica e a do card, nao uma aproximacao:
 *     "todo hash citado em resultado.json existe como conteudo".
 *
 * A checagem barata que NAO fazemos: confiar no nome do arquivo. Um
 * store cujo indice e o nome do arquivo e verdadeiro por tautologia. O
 * hash e recalculado sempre.
 */

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  ARQUIVO_PROCEDENCIA,
  ARQUIVO_RESULTADO,
  DIRETORIO_CORPOS,
  paraProcedenciaDoStore,
} from "../cassete/formato.js";
import type { ProcedenciaCassete } from "../cassete/formato.js";
import type { ParcialResolvido } from "../manifesto-resolvido.js";
import { Store } from "../../store/store.js";

// ─── Tipos ──────────────────────────────────────────────────────────────────────

/** Um asset reidratado do cassete para o store. */
export interface AssetHidratado {
  readonly hash: string;
  readonly bytes: number;
  readonly licenca: string;
  readonly caminhoNoStore: string;
}

/** Relatorio de uma reidratacao. */
export interface RelatorioHidratacao {
  /** Hashes citados em `resultado.json#/assets`. E o DENOMINADOR. */
  readonly hashesEsperados: readonly string[];
  /** Assets efetivamente reidratados e verificados byte a byte. */
  readonly hidratados: readonly AssetHidratado[];
  /** Hashes esperados sem corpo correspondente no cassete. */
  readonly semCorpo: readonly string[];
  /** Corpos cujo conteudo nao bate com o proprio nome. */
  readonly corrompidos: readonly string[];
  readonly ok: boolean;
}

// ─── Leitura ────────────────────────────────────────────────────────────────────

async function lerJson<T>(caminho: string): Promise<T> {
  return JSON.parse(await readFile(caminho, "utf-8")) as T;
}

/** Lista os corpos gravados, com o hash que o nome do arquivo afirma. */
async function listarCorpos(dirCassete: string): Promise<string[]> {
  try {
    const entradas = await readdir(join(dirCassete, DIRETORIO_CORPOS), {
      withFileTypes: true,
    });
    return entradas
      .filter((e) => e.isFile() && /^[0-9a-f]{64}$/.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

// ─── Reidratacao ────────────────────────────────────────────────────────────────

/**
 * Copia para o store todo asset citado em `resultado.json`, verificando
 * cada byte, e devolve o relatorio com o denominador explicito.
 *
 * Nao lanca: devolve `ok: false` e a lista de problemas. Quem chama
 * decide o que e vermelho — a ferramenta de gate decide, o teste decide,
 * e nenhum dos dois herda a decisao do outro.
 */
export async function hidratarStoreDoCassete(
  dirCassete: string,
  store: Store,
): Promise<RelatorioHidratacao> {
  const resultado = await lerJson<ParcialResolvido>(join(dirCassete, ARQUIVO_RESULTADO));
  const procedencia = await lerJson<ProcedenciaCassete>(
    join(dirCassete, ARQUIVO_PROCEDENCIA),
  );

  const hashesEsperados = Object.keys(resultado.assets ?? {}).sort();
  const corpos = new Set(await listarCorpos(dirCassete));

  const hidratados: AssetHidratado[] = [];
  const semCorpo: string[] = [];
  const corrompidos: string[] = [];

  for (const hash of hashesEsperados) {
    if (!corpos.has(hash)) {
      // O hash existe na parcial e o byte nao existe no cassete. Isso
      // nao e "faltou um arquivo": e um manifesto resolvido apontando
      // para conteudo que ninguem tem.
      semCorpo.push(hash);
      continue;
    }
    const conteudo = await readFile(join(dirCassete, DIRETORIO_CORPOS, hash));
    const recalculado = createHash("sha256").update(conteudo).digest("hex");
    if (recalculado !== hash) {
      corrompidos.push(`${hash} (conteudo hasheia ${recalculado})`);
      continue;
    }

    const daProcedencia = procedencia.assets.find((a) => a.hash === hash);
    const licenca = daProcedencia?.licenca ?? "";
    const resultadoPut = await store.put(
      conteudo,
      daProcedencia !== undefined
        ? paraProcedenciaDoStore(daProcedencia, procedencia)
        : {
            license: procedencia.licenca,
            attributionRequired: true,
            source: "unknown",
            acquiredAt: procedencia.adquiridoEm ?? new Date(0).toISOString(),
          },
    );
    hidratados.push({
      hash,
      bytes: conteudo.length,
      licenca,
      caminhoNoStore: resultadoPut.path,
    });
  }

  return {
    hashesEsperados,
    hidratados,
    semCorpo,
    corrompidos,
    // Denominador zero NAO e sucesso (C2): um cassete sem asset nenhum
    // passaria em "nenhum problema encontrado" e nao provaria nada.
    ok:
      hashesEsperados.length > 0 &&
      semCorpo.length === 0 &&
      corrompidos.length === 0 &&
      hidratados.length === hashesEsperados.length,
  };
}

/** Renderiza o relatorio para terminal. Imprime o denominador sempre. */
export function formatarHidratacao(r: RelatorioHidratacao): string {
  const linhas: string[] = [];
  linhas.push(`Assets citados em ${ARQUIVO_RESULTADO}: ${r.hashesEsperados.length}`);
  for (const a of r.hidratados) {
    linhas.push(
      `  [OK] ${a.hash.slice(0, 16)}… ${String(a.bytes).padStart(8)} B  ${a.licenca}`,
    );
  }
  for (const h of r.semCorpo) {
    linhas.push(`  [FALHOU] ${h.slice(0, 16)}… citado na parcial e sem corpo no cassete`);
  }
  for (const c of r.corrompidos) {
    linhas.push(`  [FALHOU] ${c} — o conteudo nao confere com o endereco`);
  }
  linhas.push(
    r.ok
      ? `Store reidratado: ${r.hidratados.length}/${r.hashesEsperados.length} assets verificados byte a byte`
      : `Store reidratado: FALHOU (${r.hidratados.length}/${r.hashesEsperados.length})`,
  );
  return linhas.join("\n");
}
