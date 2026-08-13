/**
 * src/entrega/procedencia/relatorio.ts
 *
 * O GERADOR do relatorio de procedencia (card F5-06, W7).
 *
 * O relatorio e funcao pura de (manifesto resolvido, store, cassetes,
 * relogio injetado): regeneravel a qualquer momento a partir do que ja
 * esta commitado — e isso e o que permite reavaliar o que foi produzido
 * SEM re-renderizar (pergunta 3 do card, razao de o relatorio existir).
 *
 * Transitivdade (pergunta 1 do card):
 *   - DENTRO DE UM CASSETE: todo `assets[]` da procedencia de cada
 *     estagio participante entra como transitivo (`cassete-<estagio>`);
 *   - DENTRO DE UMA EMENDA: todo registro de procedencia cujo texto
 *     carregue o marcador `emenda: audio-fonte=<sha256>` (contrato-w7
 *     C3) abre uma cadeia de derivacao que o relatorio caminha ate a
 *     origem (com teto de profundidade e deteccao de ciclo).
 *
 * ∅-crit: qualquer hash do video final (direto ou transitivo) sem
 * origem declarada entra em `semOrigem` — e o gate `just procedencia`
 * fica VERMELHO. Datas ausentes entram em `gapsDeData` (visiveis para a
 * reavaliacao, nunca bloqueantes).
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  ARQUIVO_CABECALHO,
  ARQUIVO_PROCEDENCIA,
  RAIZ_CASSETES_PADRAO,
  diretorioDoEstagio,
} from "../../resolucao/cassete/formato.js";
import type { Cassete, ProcedenciaCassete } from "../../resolucao/cassete/formato.js";
import { lerCassete } from "../../resolucao/cassete/reprodutor.js";
import type { ManifestoResolvido, Sha256 } from "../../resolucao/manifesto-resolvido.js";
import type { Procedencia } from "../../store/procedencia.js";
import type { Store } from "../../store/store.js";
import {
  DATA_EPOCH,
  LIMITE_PROFUNDIDADE_CADEIA,
  VERSAO_FORMATO_RELATORIO,
  dataRegistrada,
  extrairDerivacoes,
  origemDeclarada,
  origemDoStore,
} from "./formato.js";
import type {
  AusenciaDeOrigem,
  DerivacaoDeclarada,
  EntradaRelatorio,
  FonteDaOrigem,
  GapDeData,
  OrigemRegistrada,
  RelatorioProcedencia,
} from "./formato.js";

// ─── Interface de leitura do store ──────────────────────────────────────────────

/** O que o gerador precisa do store: ler a procedencia por hash. */
export interface LeitorDeProcedencia {
  /** Procedencia do asset, ou null quando o hash nao tem registro. */
  lerProcedencia(hash: Sha256): Promise<Procedencia | null>;
}

/**
 * Adapta o Store real (F0-07, `getProcedencia`) ao contrato de leitura
 * do relatorio. O Store e de outro card — o relatorio consome, nunca
 * edita. Consumidores futuros (F6-01, W10) passam o Store real por
 * aqui.
 */
export function adaptarStore(store: Store): LeitorDeProcedencia {
  return {
    lerProcedencia(hash: Sha256): Promise<Procedencia | null> {
      return store.getProcedencia(hash);
    },
  };
}

// ─── Opcoes ─────────────────────────────────────────────────────────────────────

export interface OpcoesGerarRelatorio {
  /** Raiz dos cassetes. Default: "fixtures/cassetes". */
  readonly raizCassetes?: string;

  /**
   * Store de conteudo (F0-07). Opcional: sem store, as origens saem
   * dos cassetes. Com store, o registro do store vence (e onde a emenda
   * do F3-05 declara a origem dos bytes).
   */
  readonly store?: LeitorDeProcedencia;

  /** Relogio injetavel. Determinismo (C9): so `geradoEm` o consome. */
  readonly relogio?: () => Date;
}

// ─── Papeis dos mapas de no ─────────────────────────────────────────────────────

const PAPEL_POR_MAPA: Readonly<Record<string, string>> = {
  nos_midia: "midia",
  nos_locucao: "locucao",
  nos_grafico: "grafico",
  nos_codigo: "codigo",
  nos_musica: "musica",
};

const PAPEL_TRILHA = "trilha-sonora";

// ─── Estado interno do gerador ─────────────────────────────────────────────────

interface RegistroEncontrado {
  readonly origem: OrigemRegistrada;
  readonly fonte: FonteDaOrigem;
}

interface CasseteLido {
  readonly estagio: string;
  readonly chave: string;
  readonly cassete: Cassete | null;
  readonly erro: string | null;
}

interface IndiceDeCassetes {
  /** hash → origem, reunida dos cassetes participantes. */
  readonly porHash: ReadonlyMap<Sha256, RegistroEncontrado>;
  /** hash → derivacoes declaradas no texto do registro (notas/atribuicao/origem). */
  readonly derivacoes: ReadonlyMap<Sha256, readonly DerivacaoDeclarada[]>;
  /** Os cassetes participantes, por estagio (para os transitivos). */
  readonly cassetes: readonly CasseteLido[];
}

// ─── Gerador ────────────────────────────────────────────────────────────────────

/**
 * Gera o relatorio de procedencia do video final descrito por um
 * manifesto resolvido.
 *
 * Nunca lanca por dados ausentes: tudo que falta vira entrada de
 * `semOrigem` ou de `gapsDeData` — o veredito e o relatorio, nao a
 * excecao.
 */
export async function gerarRelatorio(
  resolvido: ManifestoResolvido,
  opcoes: OpcoesGerarRelatorio = {},
): Promise<RelatorioProcedencia> {
  const raizCassetes = opcoes.raizCassetes ?? RAIZ_CASSETES_PADRAO;
  const relogio = opcoes.relogio ?? (() => new Date());
  const store = opcoes.store;

  // 1. Diretos: o que o manifesto resolvido referencia de forma direta.
  const diretosPorHash = coletarDiretos(resolvido);

  // 2. Cassetes participantes (os estagios que produziram o resolvido).
  const indice = await lerCassetesParticipantes(raizCassetes, resolvido);

  // 3. Entradas do relatorio: diretos + transitivos de cassete.
  const entradas = new Map<Sha256, EntradaRelatorio>();
  const falhasDeCadeia: AusenciaDeOrigem[] = [];

  const hashesDiretos = [...diretosPorHash.keys()].sort();
  for (const hash of hashesDiretos) {
    const direto = diretosPorHash.get(hash);
    if (direto === undefined) continue;
    entradas.set(
      hash,
      await montarEntrada(hash, direto.papeis, direto.nos, false, store, indice),
    );
  }

  for (const lido of indice.cassetes) {
    const cassete = lido.cassete;
    if (cassete === null) continue; // erro de leitura registrado em semOrigem abaixo
    for (const asset of cassete.procedencia.assets) {
      if (entradas.has(asset.hash)) continue;
      entradas.set(
        asset.hash,
        await montarEntrada(
          asset.hash,
          [`cassete-${lido.estagio}`],
          [],
          true,
          store,
          indice,
          cassete.procedencia,
        ),
      );
    }
  }

  // 4. Cadeias de derivacao (a emenda do F3-05): caminha da derivada
  //    ate a origem, com teto de profundidade e deteccao de ciclo.
  //    A falha da cadeia NAO apaga a origem registrada da derivada —
  //    ela entra em `falhasDeCadeia` e bloqueia pelo ∅-crit, com o
  //    registro original preservado no relatorio para auditoria.
  const visitadas = new Set<Sha256>();
  for (const hash of [...entradas.keys()].sort()) {
    const entrada = entradas.get(hash);
    if (entrada === undefined || entrada.derivadoDe === null) continue;
    const derivacoes = await derivacoesDe(entrada, store, indice);
    for (const derivacao of derivacoes) {
      await caminharDerivacao(
        derivacao.hash,
        hash,
        1,
        visitadas,
        entradas,
        falhasDeCadeia,
        store,
        indice,
      );
    }
  }

  // 5. Vereditos: ∅-crit (semOrigem) e gaps de data.
  const semOrigem: AusenciaDeOrigem[] = [...falhasDeCadeia];
  const gapsDeData: GapDeData[] = [];

  for (const entrada of entradas.values()) {
    const origem = entrada.origem;
    if (!origemDeclarada(origem)) {
      semOrigem.push({
        hash: entrada.hash,
        papel: entrada.papeis.join("+") || "desconhecido",
        motivo: entrada.motivoSemOrigem ?? "origem nao declarada",
      });
    } else if (origem !== null && !dataRegistrada(origem.adquiridoEm)) {
      gapsDeData.push({
        hash: entrada.hash,
        motivo:
          origem.adquiridoEm === undefined || origem.adquiridoEm.length === 0
            ? "data de aquisicao nao registrada"
            : `data de aquisicao nao registrada (epoch ${DATA_EPOCH})`,
      });
    }
  }

  // Cassetes que nao leram: os assets do estagio estao sem origem por construcao.
  for (const lido of indice.cassetes) {
    if (lido.cassete === null) {
      semOrigem.push({
        hash: `cassete:${lido.estagio}/${lido.chave.slice(0, 16)}…`,
        papel: `cassete-${lido.estagio}`,
        motivo: `cassete ilegivel: ${lido.erro ?? "erro desconhecido"}`,
      });
    }
  }

  // 6. Origem do proprio manifesto (texto gerado por modelo de lingua).
  const origemDoManifesto = await buscarOrigemDoManifesto(raizCassetes, resolvido);

  const diretos = [...entradas.values()]
    .filter((e) => !e.transitivo)
    .sort((a, b) => (a.hash < b.hash ? -1 : 1));
  const transitivos = [...entradas.values()]
    .filter((e) => e.transitivo)
    .sort((a, b) => (a.hash < b.hash ? -1 : 1));

  return {
    formato: VERSAO_FORMATO_RELATORIO,
    geradoEm: relogio().toISOString(),
    manifesto: {
      schemaVersion: resolvido.schema_version,
      hashManifestoOriginal: resolvido.hash_manifesto_original,
      origem: origemDoManifesto,
    },
    enquadramento: {
      uso: "pessoal",
      adr: "ADR-0003",
      ab950: "AB-950 continua fechado",
    },
    diretos,
    transitivos,
    semOrigem: semOrigem.sort((a, b) => (a.hash < b.hash ? -1 : 1)),
    gapsDeData: gapsDeData.sort((a, b) => (a.hash < b.hash ? -1 : 1)),
  };
}

// ─── Coleta dos diretos ─────────────────────────────────────────────────────────

interface DiretoColetado {
  readonly papeis: readonly string[];
  readonly nos: readonly string[];
}

function coletarDiretos(resolvido: ManifestoResolvido): ReadonlyMap<Sha256, DiretoColetado> {
  const porHash = new Map<Sha256, { papeis: Set<string>; nos: Set<string> }>();

  for (const [campo, papel] of Object.entries(PAPEL_POR_MAPA)) {
    const mapa = (resolvido as unknown as Record<string, Readonly<Record<string, Sha256>> | undefined>)[campo];
    if (mapa === undefined) continue;
    for (const [no, hash] of Object.entries(mapa)) {
      let registro = porHash.get(hash);
      if (registro === undefined) {
        registro = { papeis: new Set(), nos: new Set() };
        porHash.set(hash, registro);
      }
      registro.papeis.add(papel);
      registro.nos.add(no);
    }
  }

  if (resolvido.trilha_sonora !== null && resolvido.trilha_sonora !== undefined) {
    let registro = porHash.get(resolvido.trilha_sonora);
    if (registro === undefined) {
      registro = { papeis: new Set(), nos: new Set() };
      porHash.set(resolvido.trilha_sonora, registro);
    }
    registro.papeis.add(PAPEL_TRILHA);
  }

  const saida = new Map<Sha256, DiretoColetado>();
  for (const [hash, registro] of porHash) {
    saida.set(hash, {
      papeis: [...registro.papeis].sort(),
      nos: [...registro.nos].sort(),
    });
  }
  return saida;
}

// ─── Cassetes participantes ─────────────────────────────────────────────────────

async function lerCassetesParticipantes(
  raiz: string,
  resolvido: ManifestoResolvido,
): Promise<IndiceDeCassetes> {
  const porHash = new Map<Sha256, RegistroEncontrado>();
  const derivacoes = new Map<Sha256, readonly DerivacaoDeclarada[]>();
  const cassetes: CasseteLido[] = [];

  for (const registro of resolvido.estagios) {
    let cassete: Cassete | null = null;
    let erro: string | null = null;
    try {
      cassete = await lerCassete(raiz, registro.estagio, registro.chave);
    } catch (e) {
      erro = (e as Error).message.split("\n")[0] ?? String(e);
    }
    cassetes.push({ estagio: registro.estagio, chave: registro.chave, cassete, erro });
    if (cassete === null) continue;

    const proc = cassete.procedencia;
    for (const asset of proc.assets) {
      porHash.set(asset.hash, {
        origem: origemDoCassete(asset, proc),
        fonte: "cassete",
      });
      const encontradas = extrairDerivacoes(
        proc.notas,
        asset.atribuicao,
        asset.origem,
        asset.idNoProvedor,
      );
      if (encontradas.length > 0) {
        derivacoes.set(asset.hash, encontradas);
      }
    }
  }

  return { porHash, derivacoes, cassetes };
}

/** Origem de um asset do cassete: campos do asset + data/ferramenta do cassete. */
function origemDoCassete(
  asset: {
    readonly hash: Sha256;
    readonly licenca: string;
    readonly atribuicaoObrigatoria: boolean;
    readonly atribuicao?: string;
    readonly provedor: string;
    readonly idNoProvedor?: string;
    readonly origem?: string;
    readonly termoDeBusca?: string;
  },
  cassete: ProcedenciaCassete,
): OrigemRegistrada {
  return {
    licenca: asset.licenca,
    provedor: asset.provedor,
    atribuicaoObrigatoria: asset.atribuicaoObrigatoria,
    ...(cassete.adquiridoEm !== undefined ? { adquiridoEm: cassete.adquiridoEm } : {}),
    ...(cassete.ferramenta !== undefined ? { ferramenta: cassete.ferramenta } : {}),
    ...(asset.atribuicao !== undefined ? { atribuicao: asset.atribuicao } : {}),
    ...(asset.idNoProvedor !== undefined ? { idNoProvedor: asset.idNoProvedor } : {}),
    ...(asset.origem !== undefined ? { origem: asset.origem } : {}),
    ...(asset.termoDeBusca !== undefined ? { termoDeBusca: asset.termoDeBusca } : {}),
    ...(cassete.notas !== undefined ? { notas: cassete.notas } : {}),
  };
}

// ─── Entradas ───────────────────────────────────────────────────────────────────

async function montarEntrada(
  hash: Sha256,
  papeis: readonly string[],
  nos: readonly string[],
  transitivo: boolean,
  store: LeitorDeProcedencia | undefined,
  indice: IndiceDeCassetes,
  cassete?: ProcedenciaCassete,
): Promise<EntradaRelatorio> {
  const encontrado = await buscarOrigem(hash, store, indice);
  const derivacoes = derivacoesDoRegistro(hash, encontrado, indice, cassete);
  const origem = encontrado?.origem ?? null;

  return {
    hash,
    papeis: [...papeis].sort(),
    nos: [...nos].sort(),
    transitivo,
    origem,
    fonteDaOrigem: encontrado?.fonte ?? "ausente",
    derivadoDe: derivacoes.length > 0 ? (derivacoes[0] ?? null) : null,
    semData: encontrado !== null && !dataRegistrada(encontrado.origem.adquiridoEm),
    ...(!origemDeclarada(origem)
      ? {
          motivoSemOrigem:
            origem === null
              ? "sem registro de procedencia no store nem no cassete"
              : "registro sem licenca ou sem provedor declarados",
        }
      : {}),
  };
}

async function buscarOrigem(
  hash: Sha256,
  store: LeitorDeProcedencia | undefined,
  indice: IndiceDeCassetes,
): Promise<RegistroEncontrado | null> {
  if (store !== undefined) {
    const procedencia = await store.lerProcedencia(hash);
    if (procedencia !== null) {
      return { origem: origemDoStore(procedencia), fonte: "store" };
    }
  }
  const doCassete = indice.porHash.get(hash);
  return doCassete ?? null;
}

/** Derivacoes declaradas de uma entrada: store primeiro, depois cassete. */
async function derivacoesDe(
  entrada: EntradaRelatorio,
  store: LeitorDeProcedencia | undefined,
  indice: IndiceDeCassetes,
): Promise<readonly DerivacaoDeclarada[]> {
  if (entrada.fonteDaOrigem === "store" && store !== undefined) {
    const procedencia = await store.lerProcedencia(entrada.hash);
    if (procedencia !== null) {
      const encontradas = extrairDerivacoes(
        procedencia.notes,
        procedencia.sourceId,
        procedencia.attribution,
        procedencia.toolVersion,
      );
      if (encontradas.length > 0) return encontradas;
    }
  }
  return indice.derivacoes.get(entrada.hash) ?? [];
}

function derivacoesDoRegistro(
  hash: Sha256,
  encontrado: RegistroEncontrado | null,
  indice: IndiceDeCassetes,
  cassete?: ProcedenciaCassete,
): readonly DerivacaoDeclarada[] {
  if (encontrado !== null && encontrado.fonte === "store") {
    const encontradas = extrairDerivacoes(
      encontrado.origem.notas,
      encontrado.origem.idNoProvedor,
      encontrado.origem.atribuicao,
      encontrado.origem.ferramenta,
    );
    if (encontradas.length > 0) return encontradas;
  }
  const doIndice = indice.derivacoes.get(hash);
  if (doIndice !== undefined && doIndice.length > 0) return doIndice;
  if (cassete !== undefined) {
    return extrairDerivacoes(cassete.notas);
  }
  return [];
}

// ─── Caminhada da derivacao (emenda) ────────────────────────────────────────────

async function caminharDerivacao(
  fonte: Sha256,
  derivada: Sha256,
  profundidade: number,
  visitadas: Set<Sha256>,
  entradas: Map<Sha256, EntradaRelatorio>,
  falhasDeCadeia: AusenciaDeOrigem[],
  store: LeitorDeProcedencia | undefined,
  indice: IndiceDeCassetes,
): Promise<void> {
  if (profundidade > LIMITE_PROFUNDIDADE_CADEIA) {
    falhasDeCadeia.push({
      hash: derivada,
      papel: "emenda",
      motivo: "cadeia de derivacao excede o limite",
    });
    return;
  }
  if (visitadas.has(fonte)) {
    falhasDeCadeia.push({
      hash: derivada,
      papel: "emenda",
      motivo: "cadeia de derivacao ciclica",
    });
    return;
  }
  visitadas.add(fonte);

  const encontrado = await buscarOrigem(fonte, store, indice);
  if (encontrado === null) {
    falhasDeCadeia.push({
      hash: derivada,
      papel: "emenda",
      motivo: `audio-fonte ${fonte.slice(0, 16)}… sem origem declarada`,
    });
    return;
  }

  const jaExiste = entradas.get(fonte);
  if (jaExiste === undefined) {
    entradas.set(fonte, await montarEntrada(fonte, ["emenda"], [], true, store, indice));
    const proximas = derivacoesDoRegistro(fonte, encontrado, indice);
    for (const proxima of proximas) {
      await caminharDerivacao(
        proxima.hash,
        fonte,
        profundidade + 1,
        visitadas,
        entradas,
        falhasDeCadeia,
        store,
        indice,
      );
    }
  } else if (jaExiste.derivadoDe !== null) {
    const proximas = await derivacoesDe(jaExiste, store, indice);
    for (const proxima of proximas) {
      await caminharDerivacao(
        proxima.hash,
        jaExiste.hash,
        profundidade + 1,
        visitadas,
        entradas,
        falhasDeCadeia,
        store,
        indice,
      );
    }
  }
}

// ─── Origem do manifesto (autoria) ──────────────────────────────────────────────

/**
 * Busca a origem do texto do manifesto: os cassetes de autoria cujo
 * `componentes.hashManifesto` casam com o hash do manifesto original
 * do resolvido. Presenca por item: o relatorio lista TODOS os cassetes
 * casados (um brief pode ter sido gravado com mais de um provedor).
 */
async function buscarOrigemDoManifesto(
  raiz: string,
  resolvido: ManifestoResolvido,
): Promise<RelatorioProcedencia["manifesto"]["origem"]> {
  const dirAutoria = diretorioDoEstagio(raiz, "autoria");
  let chaves: string[];
  try {
    const entradas = await readdir(dirAutoria, { withFileTypes: true });
    chaves = entradas
      .filter((e) => e.isDirectory() && /^[0-9a-f]{64}$/.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    chaves = [];
  }

  const origens: OrigemRegistrada[] = [];
  for (const chave of chaves) {
    try {
      const cabecalho = JSON.parse(
        await readFile(join(dirAutoria, chave, ARQUIVO_CABECALHO), "utf-8"),
      ) as { componentes?: { hashManifesto?: string } };
      if (cabecalho.componentes?.hashManifesto !== resolvido.hash_manifesto_original) {
        continue;
      }
      const procedencia = JSON.parse(
        await readFile(join(dirAutoria, chave, ARQUIVO_PROCEDENCIA), "utf-8"),
      ) as ProcedenciaCassete;
      const origem: OrigemRegistrada = {
        licenca: procedencia.licenca,
        provedor: procedencia.provedor,
        atribuicaoObrigatoria: false,
        ferramenta: procedencia.ferramenta,
        notas: procedencia.notas,
      };
      origens.push(origem);
    } catch {
      // cassete de autoria ilegivel: omitido, nao fatal — a guarda da
      // suite de autoria (F4-04) e quem valida os cassetes dela.
    }
  }

  if (origens.length === 0) {
    return {
      origens: [],
      fonteDaOrigem: "ausente",
      motivo:
        "nenhum cassete de autoria com hashManifesto casando com o manifesto original",
    };
  }
  return { origens, fonteDaOrigem: "cassete" };
}
