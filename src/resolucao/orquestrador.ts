/**
 * src/resolucao/orquestrador.ts
 *
 * O orquestrador — onde o impuro vira puro.
 *
 * Ele tem exatamente dois modos, e a diferenca entre eles e a fronteira
 * de determinismo:
 *
 *   modo "gravacao"  — ACIMA da fronteira. Executa o estagio de verdade,
 *                      com rede, e grava o cassete. Roda a mao, nunca em
 *                      suite. Este e o unico momento em que
 *                      `EstagioResolucao.resolver()` e chamado.
 *
 *   modo "offline"   — ABAIXO da fronteira. Le o cassete e reproduz.
 *                      Nunca chama o estagio, nunca toca a rede, e nunca
 *                      "cai para gravacao" quando falta cassete: falta
 *                      de cassete lanca ECasseteAusente (∅-crit).
 *
 * O default e "offline". Um default que fizesse gravacao transformaria
 * o primeiro `just test` de qualquer maquina numa rodada silenciosa de
 * chamadas pagas a provedores externos.
 *
 * A chave de cache (contrato.ts) inclui: versao do contrato, nome e
 * versao do estagio, hash do manifesto e os parametros. Mudar qualquer
 * um deles muda a chave, muda o diretorio do cassete, e portanto e cache
 * miss — em modo offline, um miss e um erro barulhento, nao um resultado
 * velho servido em silencio (C12).
 */

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Manifesto } from "../contratos/manifesto.js";
import {
  ORDEM_ESTAGIOS,
  chaveDeCache,
  componentesDaChave,
  hashDoManifesto,
} from "./contrato.js";
import type { EstagioResolucao, NomeEstagio } from "./contrato.js";
import {
  ECasseteAusente,
  RAIZ_CASSETES_PADRAO,
  diretorioDoCassete,
  paraProcedenciaDoStore,
} from "./cassete/formato.js";
import type { Cassete } from "./cassete/formato.js";
import { criarFetchDeCassete, lerCassete } from "./cassete/reprodutor.js";
import { gravarCassete } from "./cassete/gravador.js";
import { fundirParciais } from "./manifesto-resolvido.js";
import type {
  ManifestoResolvido,
  ParcialComRegistro,
  RegistroEstagio,
} from "./manifesto-resolvido.js";
import { Store } from "../store/store.js";

// ─── Opcoes ─────────────────────────────────────────────────────────────────────

/** Modo de operacao do orquestrador. */
export type ModoOrquestrador = "offline" | "gravacao";

export interface OpcoesOrquestrador {
  /** Estagios a executar. Ordenados internamente pela ordem canonica. */
  readonly estagios: readonly EstagioResolucao[];

  /** Raiz dos cassetes. Default: `fixtures/cassetes`. */
  readonly raizCassetes?: string;

  /** Modo. Default: `offline` — o seguro. */
  readonly modo?: ModoOrquestrador;

  /**
   * Store de conteudo (F0-07). Opcional em offline: o cassete ja carrega
   * o resultado. Em gravacao, e onde os assets e a procedencia sao
   * persistidos por hash.
   */
  readonly store?: Store;

  /** `fetch` real, so usado em modo gravacao. */
  readonly fetchReal?: typeof fetch;

  /** Relogio injetavel. So `volatil.json` do cassete o consome. */
  readonly relogio?: () => Date;
}

/** Resultado de uma resolucao. */
export interface ResultadoResolucao {
  /** O manifesto resolvido — o artefato que atravessa a fronteira. */
  readonly resolvido: ManifestoResolvido;
  /** Cassetes usados, por estagio. Auditoria de proveniencia. */
  readonly cassetes: Readonly<Record<string, string>>;
}

// ─── Orquestrador ───────────────────────────────────────────────────────────────

export class Orquestrador {
  private readonly estagios: readonly EstagioResolucao[];
  private readonly raizCassetes: string;
  private readonly modo: ModoOrquestrador;
  private readonly store: Store | undefined;
  private readonly fetchReal: typeof fetch | undefined;
  private readonly relogio: () => Date;

  constructor(opcoes: OpcoesOrquestrador) {
    this.estagios = ordenarPelaCanonica(opcoes.estagios);
    this.raizCassetes = opcoes.raizCassetes ?? RAIZ_CASSETES_PADRAO;
    this.modo = opcoes.modo ?? "offline";
    this.store = opcoes.store;
    this.fetchReal = opcoes.fetchReal;
    this.relogio = opcoes.relogio ?? (() => new Date());
  }

  /** Estagios na ordem em que serao executados. */
  get ordem(): readonly NomeEstagio[] {
    return this.estagios.map((e) => e.identidade.nome);
  }

  /** Chave de cache de um estagio para um manifesto. */
  chaveDe(estagio: EstagioResolucao, manifesto: Manifesto): string {
    return chaveDeCache(componentesDaChave(estagio, hashDoManifesto(manifesto)));
  }

  /**
   * Resolve o manifesto inteiro.
   *
   * Em offline: um estagio sem cassete interrompe TUDO. Nao ha
   * "continua com os outros" — um manifesto resolvido pela metade e pior
   * que nenhum, porque parece completo.
   */
  async resolver(manifesto: Manifesto): Promise<ResultadoResolucao> {
    const hashManifesto = hashDoManifesto(manifesto);
    const entradas: ParcialComRegistro[] = [];
    const cassetes: Record<string, string> = {};

    for (const estagio of this.estagios) {
      const { registro, parcial, diretorio } = await this.executar(
        estagio,
        manifesto,
        hashManifesto,
      );
      entradas.push({ registro, parcial });
      cassetes[estagio.identidade.nome] = diretorio;
    }

    return {
      resolvido: fundirParciais(manifesto, hashManifesto, entradas),
      cassetes,
    };
  }

  /** Resolve um unico estagio pelo nome. */
  async resolverEstagio(
    nome: NomeEstagio,
    manifesto: Manifesto,
  ): Promise<ResultadoResolucao> {
    const estagio = this.estagios.find((e) => e.identidade.nome === nome);
    if (!estagio) {
      throw new Error(
        `Estagio "${nome}" nao foi passado ao orquestrador. ` +
          `Estagios disponiveis: ${this.ordem.join(", ") || "(nenhum)"}.`,
      );
    }
    const hashManifesto = hashDoManifesto(manifesto);
    const { registro, parcial, diretorio } = await this.executar(
      estagio,
      manifesto,
      hashManifesto,
    );
    return {
      resolvido: fundirParciais(manifesto, hashManifesto, [{ registro, parcial }]),
      cassetes: { [nome]: diretorio },
    };
  }

  // ─── Execucao ─────────────────────────────────────────────────────────────

  private async executar(
    estagio: EstagioResolucao,
    manifesto: Manifesto,
    hashManifesto: string,
  ): Promise<{
    registro: RegistroEstagio;
    parcial: ParcialComRegistro["parcial"];
    diretorio: string;
  }> {
    const componentes = componentesDaChave(estagio, hashManifesto);
    const chave = chaveDeCache(componentes);
    const nome = estagio.identidade.nome;
    const diretorio = diretorioDoCassete(this.raizCassetes, nome, chave);

    if (this.modo === "gravacao") {
      const trabalho = await mkdtemp(join(tmpdir(), `resolucao-${nome}-`));
      const gravacao = await gravarCassete(estagio, {
        raiz: this.raizCassetes,
        manifesto,
        diretorioTrabalho: trabalho,
        ...(this.fetchReal !== undefined ? { fetchReal: this.fetchReal } : {}),
        relogio: this.relogio,
      });
      const cassete = await lerCassete(this.raizCassetes, nome, gravacao.chave);
      await this.persistirNoStore(cassete);
      return {
        registro: {
          estagio: nome,
          versaoEstagio: estagio.identidade.versao,
          chave: gravacao.chave,
          origem: "gravacao",
        },
        parcial: cassete.resultado,
        diretorio: gravacao.diretorio,
      };
    }

    // ── modo offline ────────────────────────────────────────────────────────
    // Nao ha try/catch aqui de proposito. Engolir ECasseteAusente para
    // "continuar" e exatamente o comportamento que o ∅-crit proibe.
    const cassete = await lerCassete(this.raizCassetes, nome, chave);
    return {
      registro: {
        estagio: nome,
        versaoEstagio: estagio.identidade.versao,
        chave,
        origem: "cassete",
      },
      parcial: cassete.resultado,
      diretorio,
    };
  }

  /**
   * Persiste a procedencia dos assets do cassete no store por hash.
   *
   * Traduz `licenca` → `license` via `paraProcedenciaDoStore`, para que
   * os cinco cards da W4 nao escrevam cinco tradutores diferentes.
   */
  private async persistirNoStore(cassete: Cassete): Promise<void> {
    if (!this.store) return;
    for (const asset of cassete.procedencia.assets) {
      const conteudo = await this.store.get(asset.hash);
      if (conteudo === null) continue; // asset ainda nao esta no store
      await this.store.put(conteudo, paraProcedenciaDoStore(asset, cassete.procedencia));
    }
  }

  /**
   * Reproduz o `fetch` de um cassete ja lido.
   *
   * Util para um estagio que queira ser exercitado offline contra as
   * respostas gravadas (F2-07 vai usar isto na suite de integracao).
   */
  static fetchDoCassete(cassete: Cassete, diretorio: string): typeof fetch {
    return criarFetchDeCassete(cassete, diretorio);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Ordena os estagios pela ordem canonica.
 *
 * A ordem e do CONTRATO, nao do chamador: se dependesse da ordem em que
 * o chamador passou a lista, dois callers com a mesma configuracao
 * produziriam manifestos resolvidos com `estagios[]` em ordens
 * diferentes — e o determinismo morreria num campo que ninguem olha.
 */
function ordenarPelaCanonica(
  estagios: readonly EstagioResolucao[],
): readonly EstagioResolucao[] {
  const porNome = new Map<NomeEstagio, EstagioResolucao>();
  for (const estagio of estagios) {
    const anterior = porNome.get(estagio.identidade.nome);
    if (anterior !== undefined) {
      throw new Error(
        `Dois estagios com o nome "${estagio.identidade.nome}" ` +
          `(versoes ${anterior.identidade.versao} e ${estagio.identidade.versao}). ` +
          `O nome e unico: o segundo silenciaria o primeiro.`,
      );
    }
    porNome.set(estagio.identidade.nome, estagio);
  }
  const saida: EstagioResolucao[] = [];
  for (const nome of ORDEM_ESTAGIOS) {
    const estagio = porNome.get(nome);
    if (estagio) saida.push(estagio);
  }
  return saida;
}

/** Reexport para quem so importa o orquestrador. */
export { ECasseteAusente };
