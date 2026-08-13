// =============================================================================
// A CHAVE C7 DO CACHE DE RENDER — por CONTEUDO, nunca por data (F5-09)
// =============================================================================
//
// ADR-0041, decisao 1: cinco componentes OBRIGATORIOS, nesta ordem:
//
//   1. H(manifesto resolvido) — hash dos BYTES do manifesto resolvido
//      que o render consome (o que sera lido, nao um resumo digitado);
//   2. H(assets) — re-hash dos BYTES dos assets referenciados (a chave
//      NUNCA confia no hash declarado no manifesto: o conteudo que
//      importa e o que o store de F0-07 vai entregar ao render — C7);
//   3. H(tokens consumidos) — os valores de S-5 (`src/design/tokens.ts`)
//      importados POR LEITURA e hasheados: mudar um token de design
//      tem de invalidar o cache (o ∅-crit do PROGRAMA). O snapshot e
//      o agregado `tokens` — SUPERCONJUNTO dos consumidos hoje: a
//      direcao conservadora (invalida mais, nunca menos), robusta a
//      composicoes que passem a consumir tokens novos sem atualizar
//      esta lista (contrato-w8 §7: presenca, nunca lista fechada);
//   4. H(versao do codigo / compositor / navegador) — a pilha Remotion
//      (bump de Remotion = novo rasterizador = bytes diferentes) e a
//      versao do chrome-headless-shell instalado (pergunta adversarial
//      1 do card);
//   5. pin das ferramentas — node e ffmpeg em runtime, o mesmo padrao
//      de `MixDocument.ferramentas` do F3-05.
//
// NUNCA entram na chave (ADR-0041, decisao 2 — qualquer um deles faz o
// cache mentir): data/hora, `memTotal` (AB-684: a leitura muda a
// CONCORRENCIA, nunca o conteudo da saida), numero de workers, plano de
// faixas, porta TCP, env de agendamento. A assinatura desta funcao NAO
// aceita nenhum deles — ausencia por construcao, e o teste assere que a
// chave NAO cita essas palavras no objeto de componentes.
//
// Determinismo: mesmos bytes de entrada produzem a mesma chave, em
// qualquer processo, em qualquer maquina, em qualquer instante. A chave
// e funcao pura do conteudo — por isso a invalidacao e por CONTEUDO e
// nunca por data (por data e falso verde: tocar um arquivo sem mudar
// conteudo nao e mudanca de saida).
// =============================================================================

import { createHash } from "node:crypto";
import { tokens as tokensConsumidos } from "../../design/tokens";
import { serializarCanonico } from "./serializar";
import type { PinDeFerramentas, VersoesDaPilha } from "./versoes";

/** A versao do FORMATO da chave — bump quebra o formato, nao o conteudo. */
export const FORMATO_DA_CHAVE = "chave-c7-v1";

/** Hash SHA-256 em hex — a primitiva da chave (a mesma do store F0-07). */
export function sha256Hex(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Entradas da chave — SOMENTE conteudo. Nenhum campo de ambiente/execucao. */
export interface EntradasDaChaveC7 {
  /**
   * Os BYTES do manifesto resolvido que o render consome (1). Em
   * producao: o cassete resolvido como ele sera lido do store.
   */
  readonly manifestoResolvido: Buffer;
  /**
   * Assets por hash declarado -> bytes (2). A chave RE-HASHA os bytes:
   * o hash declarado participa apenas como ordem deterministica.
   */
  readonly assets: ReadonlyMap<string, Buffer>;
  /**
   * Snapshot dos valores de S-5 que o render consome (3). Default: o
   * agregado `tokens` real de src/design/tokens.ts, importado aqui por
   * LEITURA. Injetavel para a sonda de mutacao do gate (um token
   * MUDADO com cache quente tem de ficar VERMELHO).
   */
  readonly tokensConsumidos?: unknown;
  /** Versoes da pilha — codigo/compositor/navegador (4). */
  readonly versoes: VersoesDaPilha;
  /** Pin de ferramentas — node/ffmpeg em runtime (5). */
  readonly pinFerramentas: PinDeFerramentas;
}

/**
 * Os cinco componentes, cada um ja hasheado — o que vai para o
 * `meta.json` do cache (diagnostico: POR QUE esta chave existe, sem
 * data). O objeto de componentes e parte da chave: qualquer componente
 * diferente produz chave diferente.
 */
export interface ComponentesDaChaveC7 {
  /** H(manifesto resolvido) — hash dos bytes consumidos. */
  readonly manifesto: string;
  /** H(assets) — re-hash dos bytes, por hash declarado ordenado. */
  readonly assets: string;
  /** H(tokens consumidos) — hash dos VALORES de S-5 importados. */
  readonly tokens: string;
  /** H(versoes) — codigo/compositor/navegador. */
  readonly versoes: string;
  /** pin das ferramentas — node/ffmpeg. */
  readonly ferramentas: string;
}

/**
 * Re-hash dos bytes dos assets: para cada hash declarado (ordenado —
 * ordem de mapa nao pode mudar a chave), o SHA-256 dos bytes que serao
 * lidos. A chave nao confia na declaracao: bytes diferentes = chave
 * diferente, mesmo que o manifesto continue declarando o mesmo hash.
 */
function componenteDosAssets(
  assets: ReadonlyMap<string, Buffer>,
): string {
  const declarados = [...assets.keys()].sort();
  const linhas = declarados.map((declarado) => {
    const bytes = assets.get(declarado);
    if (bytes === undefined) {
      throw new Error(
        `chave C7: asset "${declarado}" declarado sem bytes — re-hash impossivel ` +
          "(a chave hasheia os BYTES que serao lidos, nunca a declaracao)",
      );
    }
    return `${declarado}:${sha256Hex(bytes)}`;
  });
  return sha256Hex(linhas.join("\n"));
}

/**
 * Calcula os cinco componentes da chave C7 — o objeto que tambem vai
 * para o meta.json do cache (diagnostico sem data).
 */
export function componentesDaChaveC7(
  entradas: EntradasDaChaveC7,
): ComponentesDaChaveC7 {
  const { manifestoResolvido, assets, tokensConsumidos, versoes, pinFerramentas } =
    entradas;

  const snapshotDeTokens = tokensConsumidos ?? tokensConsumidosReais();

  return Object.freeze({
    manifesto: sha256Hex(manifestoResolvido),
    assets: componenteDosAssets(assets),
    tokens: sha256Hex(serializarCanonico(snapshotDeTokens)),
    versoes: sha256Hex(
      serializarCanonico({
        remotion: versoes.remotion,
        renderer: versoes.renderer,
        bundler: versoes.bundler,
        compositor: versoes.compositor,
        navegador: versoes.navegador,
      }),
    ),
    ferramentas: sha256Hex(
      serializarCanonico({
        node: pinFerramentas.node,
        ffmpeg: pinFerramentas.ffmpeg,
      }),
    ),
  });
}

/**
 * O snapshot real dos tokens consumidos: o agregado `tokens` de S-5,
 * importado por LEITURA (nunca editado). Funcao separada para deixar
 * explicito que o import acontece no ponto de consumo da chave.
 */
export function tokensConsumidosReais(): unknown {
  return tokensConsumidos;
}

/**
 * A chave C7 — SHA-256 dos cinco componentes mais o formato.
 *
 * Dois renders do MESMO conteudo (mesmo manifesto, mesmos bytes de
 * assets, mesmos tokens, mesma pilha, mesmo pin) produzem a MESMA
 * chave, em qualquer maquina e em qualquer instante. Qualquer mudanca
 * de conteudo produz chave DIFERENTE — o miss — inclusive um token de
 * design mudado (∅-crit do PROGRAMA).
 */
export function calcularChaveC7(entradas: EntradasDaChaveC7): string {
  const componentes = componentesDaChaveC7(entradas);
  return sha256Hex(
    serializarCanonico({
      formato: FORMATO_DA_CHAVE,
      componentes,
    }),
  );
}
