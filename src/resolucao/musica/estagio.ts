/**
 * src/resolucao/musica/estagio.ts
 *
 * ESTAGIO DE RESOLUCAO: musica e efeitos sonoros.  Card F2-06.
 *
 * O card em uma frase: *os efeitos do pacote do fornecedor sao URLs
 * remotas; precisam ir para o store*. Este arquivo e a travessia.
 *
 *   pacote (titulo)                    src/resolucao/musica/pacote.ts
 *      │
 *      ├─ entrada.fetch(API)  ────────► URL REMOTA + licenca declarada
 *      │                                 [gravado: chamadas.json + corpos/]
 *      ├─ entrada.fetch(URL)  ────────► bytes do audio
 *      │                                 [gravado: corpos/<sha256>]
 *      ├─ sha256(bytes)       ────────► HASH
 *      ├─ store.put(bytes, …) ────────► .cache/store/<ab>/<hash>  (F0-07)
 *      │
 *      ▼  ─────────────── fronteira de determinismo ───────────────
 *   parcial.assets[HASH]     = { licenca, atribuicao, … }   ← so hash e texto
 *   parcial.nos_musica[noId] = HASH
 *   parcial.trilha_sonora    = HASH
 *
 *   procedencia.assets[].origem = URL                        ← a URL fica ACIMA
 *
 * Nada de URL desce. Nao por disciplina: `schema/manifesto-resolvido.schema.json`
 * aplica `$defs.SemURLProfundo` na raiz e rejeita URL em qualquer
 * profundidade, valor ou nome de propriedade. Este estagio ainda checa
 * por conta propria antes de devolver (`encontrarURLs`), porque um erro
 * que estoura no estagio nomeia o campo, e um erro que estoura no schema
 * diz so "o documento nao valida".
 *
 * Ler antes de mexer:
 *   docs/contrato-estagio-resolucao.md
 *   docs/adr/0007-musica-e-efeitos.md
 *   docs/adr/0003-enquadramento-de-uso.md  (uso pessoal — o que a licenca precisa cobrir)
 */

import { createHash } from "node:crypto";
import type {
  EntradaEstagio,
  EstagioResolucao,
  SaidaEstagio,
} from "../contrato.js";
import type { AssetResolvido, ParcialResolvido } from "../manifesto-resolvido.js";
import { encontrarURLs } from "../manifesto-resolvido.js";
import type {
  ProcedenciaAsset,
  ProcedenciaCassete,
} from "../cassete/formato.js";
import { paraProcedenciaDoStore } from "../cassete/formato.js";
import { Store } from "../../store/store.js";
import type { No } from "../../contratos/manifesto.js";
import {
  CATALOGO,
  ID_DA_TRILHA,
  NOME_DO_PACOTE,
  PROVEDOR,
  VERSAO_DO_PACOTE,
  efeitoDoNo,
  itemPorId,
  titulosNecessarios,
} from "./pacote.js";
import type { ItemDoPacote } from "./pacote.js";
import {
  USER_AGENT,
  VERSAO_API_EXTERNA,
  atribuicaoSemURL,
  normalizarCatalogo,
  urlDoCatalogo,
} from "./fornecedor.js";
import type { ArquivoDoFornecedor } from "./fornecedor.js";

// ─── Identidade ─────────────────────────────────────────────────────────────────

/**
 * Versao do estagio. Semver, e entra na chave de cache.
 *
 * REGRA DURA (contrato §3): mudou `resolver()` de um jeito que pode
 * mudar a saida? Bumpe aqui. Sem bump, o cassete gravado sob o codigo
 * antigo continua sendo encontrado e o resultado velho e servido para
 * sempre — o modo de falha C12.
 *
 * Conta como "muda a saida" tambem: mexer em `pacote.ts` (catalogo ou
 * mapa de tipo de no) e mexer na normalizacao de `fornecedor.ts`.
 */
export const VERSAO_ESTAGIO = "1.0.1";

// ─── Opcoes ─────────────────────────────────────────────────────────────────────

/** Opcoes de construcao do estagio. */
export interface OpcoesEstagioMusica {
  /**
   * Raiz do store de conteudo (F0-07). Default: o do proprio `Store`.
   *
   * NAO entra em `parametros`, de proposito: onde o byte e guardado nao
   * muda que byte e. Poe-lo na chave faria dois operadores com stores em
   * caminhos diferentes gravarem cassetes distintos para resultado
   * identico — cache miss por motivo nenhum, que e o espelho do C12.
   */
  readonly raizStore?: string;

  /**
   * Pausa entre downloads, em ms. Default: `PAUSA_PADRAO_MS`.
   *
   * Cortesia com o fornecedor, nao determinante do resultado — o
   * fornecedor devolveu 429 numa rajada de cinco requisicoes durante o
   * desenvolvimento deste card. Tambem NAO entra em `parametros`: o
   * intervalo entre dois downloads nao muda um byte do que e baixado. No
   * replay (que le do cassete) a pausa e zerada, porque nao ha ninguem
   * para ser cortes com.
   */
  readonly pausaEntreDownloadsMs?: number;
}

/** Intervalo cortes entre dois downloads consecutivos. */
export const PAUSA_PADRAO_MS = 1200;

// ─── Parametros ─────────────────────────────────────────────────────────────────

/**
 * Duracao minima aceitavel para a trilha, em segundos.
 *
 * E criterio de CURADORIA, nao de mixagem: uma trilha de 3 segundos nao
 * e trilha. Se ela cobre ou nao um video especifico, e quantas vezes
 * precisa repetir para cobrir, e decisao de F3-05 (mix de audio) — este
 * estagio publica `duracaoSegundos` em `assets` para que F3-05 decida.
 */
export const DURACAO_MINIMA_TRILHA_SEGUNDOS = 30;

/**
 * Parametros do estagio: tudo que muda a saida e nao esta no manifesto.
 *
 * O que NAO esta aqui, e por que:
 *
 *   `loudnessAlvo` — o contrato o cita como parametro tipico de musica.
 *   Este estagio nao toca em loudness: ele entrega os bytes como o
 *   fornecedor os serviu. Normalizacao de loudness e do card F3-05.
 *   Declarar um parametro que nao muda a saida passaria em `res-chave`
 *   (qualquer mudanca muda a chave) e mentiria sobre o desenho: quem
 *   lesse a chave concluiria que este estagio normaliza audio.
 *
 *   `raizStore` — ver `OpcoesEstagioMusica`.
 */
export const PARAMETROS = {
  provedor: PROVEDOR,
  pacote: NOME_DO_PACOTE,
  versaoPacote: VERSAO_DO_PACOTE,
  versaoApiExterna: VERSAO_API_EXTERNA,
  duracaoMinimaTrilhaSegundos: DURACAO_MINIMA_TRILHA_SEGUNDOS,
} as const;

// ─── Erros ──────────────────────────────────────────────────────────────────────

/** O byte que chegou nao e o byte que o fornecedor prometeu. */
export class EIntegridadeDoDownload extends Error {
  readonly code = "INTEGRIDADE_DO_DOWNLOAD";
  constructor(titulo: string, detalhe: string) {
    super(
      `Download de "${titulo}" nao confere: ${detalhe}\n` +
        `  O fornecedor publica o proprio hash do arquivo. Divergencia significa ` +
        `conteudo trocado, truncado ou intermediado — exatamente o C7 acontecendo.\n` +
        `  O asset NAO entra no store.`,
    );
    this.name = "EIntegridadeDoDownload";
  }
}

/** Uma URL escapou para dentro da parcial. Nunca deveria ser possivel. */
export class EURLAtravessouAFronteira extends Error {
  readonly code = "URL_ATRAVESSOU_A_FRONTEIRA";
  constructor(achados: readonly { caminho: string; valor: string }[]) {
    super(
      `URL na parcial resolvida — ${achados.length} ocorrencia(s):\n` +
        achados.map((a) => `  ${a.caminho} = ${a.valor}`).join("\n") +
        `\n  O manifesto resolvido e enderecado por hash de conteudo (C7). ` +
        `A URL de origem vive em procedencia.assets[].origem, acima da fronteira.`,
    );
    this.name = "EURLAtravessouAFronteira";
  }
}

/** A trilha escolhida nao passa no criterio de curadoria. */
export class ETrilhaInadequada extends Error {
  readonly code = "TRILHA_INADEQUADA";
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ETrilhaInadequada";
  }
}

// ─── Baixado ────────────────────────────────────────────────────────────────────

/** Um item do pacote depois de baixado e hasheado. */
interface ItemBaixado {
  readonly item: ItemDoPacote;
  readonly arquivo: ArquivoDoFornecedor;
  readonly hash: string;
  readonly bytes: number;
  readonly conteudo: Buffer;
}

// ─── O estagio ──────────────────────────────────────────────────────────────────

/**
 * Constroi o estagio.
 *
 * `export default` e a instancia de producao; os testes usam esta
 * fabrica para apontar o store a um diretorio temporario. As duas
 * instancias tem `identidade` e `parametros` identicos e portanto a
 * MESMA chave de cache — o que e o ponto: um cassete gravado pela
 * instancia de producao e reproduzido pela de teste sem regravar nada.
 */
export function criarEstagioMusica(
  opcoes: OpcoesEstagioMusica = {},
): EstagioResolucao {
  const store =
    opcoes.raizStore !== undefined ? new Store({ root: opcoes.raizStore }) : new Store();
  const pausaMs = opcoes.pausaEntreDownloadsMs ?? PAUSA_PADRAO_MS;

  return {
    identidade: { nome: "musica", versao: VERSAO_ESTAGIO },
    parametros: PARAMETROS,

    async resolver(entrada: EntradaEstagio): Promise<SaidaEstagio> {
      const nos = entrada.manifesto.nos;

      // ── 1. o pacote diz QUAIS titulos, nunca quais bytes ────────────────
      const titulos = titulosNecessarios(nos);

      // ── 2. o fornecedor converte titulo em URL REMOTA ───────────────────
      // Uma chamada so, para todos os titulos: menos rede, menos cassete,
      // e uma unica resposta a auditar.
      const respostaCatalogo = await entrada.fetch(urlDoCatalogo(titulos), {
        method: "GET",
        headers: { "user-agent": USER_AGENT, accept: "application/json" },
      });
      if (!respostaCatalogo.ok) {
        throw new Error(
          `Fornecedor ${PROVEDOR} devolveu ${respostaCatalogo.status} no catalogo.`,
        );
      }
      // Sosia, nao sucessor: o corpo cru vai para `corpos/` exatamente
      // como veio; a normalizacao abaixo e do ESTAGIO e roda igual no
      // replay.
      const catalogo = normalizarCatalogo(
        JSON.parse(await respostaCatalogo.text()) as unknown,
        titulos,
      );

      // ── 3. cada URL vira bytes, e cada bytes vira hash no store ─────────
      const baixados = new Map<string, ItemBaixado>();
      for (const titulo of titulos) {
        const arquivo = catalogo.get(titulo);
        if (arquivo === undefined) continue; // normalizarCatalogo ja teria lancado
        const item = itemDoTitulo(titulo);

        if (pausaMs > 0) await esperar(pausaMs);
        const resposta = await entrada.fetch(arquivo.urlDownload, {
          method: "GET",
          headers: { "user-agent": USER_AGENT },
        });
        if (!resposta.ok) {
          throw new Error(
            `Download de "${titulo}" devolveu ${resposta.status} — ` +
              `a URL veio da API e nao serviu bytes. C7 em movimento.`,
          );
        }
        const conteudo = Buffer.from(await resposta.arrayBuffer());

        conferirIntegridade(arquivo, conteudo);
        const hash = createHash("sha256").update(conteudo).digest("hex");

        baixados.set(titulo, {
          item,
          arquivo,
          hash,
          bytes: conteudo.length,
          conteudo,
        });
      }

      const trilha = exigirBaixado(baixados, itemPorId(ID_DA_TRILHA).titulo);
      conferirTrilha(trilha);

      // ── 4. procedencia: e o unico lugar onde a URL e obrigatoria ────────
      const procedenciaAssets = [...baixados.keys()].sort().map((titulo) => {
        const b = baixados.get(titulo) as ItemBaixado;
        return procedenciaDoAsset(b.item, b.arquivo, b.hash);
      });
      const procedencia = procedenciaBase(procedenciaAssets);

      // ── 5. o byte vira endereco de conteudo no store (F0-07) ────────────
      // Append-only e enderecado por SHA-256: dois nos que usam o mesmo
      // efeito convergem no mesmo arquivo, e regravar nao duplica nada.
      // A procedencia vai junto com o byte — asset sem licenca no store
      // e um passivo que ninguem consegue auditar depois.
      for (const titulo of [...baixados.keys()].sort()) {
        const b = baixados.get(titulo) as ItemBaixado;
        await store.put(
          b.conteudo,
          paraProcedenciaDoStore(procedenciaDoAsset(b.item, b.arquivo, b.hash), procedencia),
        );
      }

      // ── 6. montagem da parcial: so hash daqui para baixo ────────────────
      const assets: Record<string, AssetResolvido> = {};
      for (const titulo of [...baixados.keys()].sort()) {
        const b = baixados.get(titulo) as ItemBaixado;
        assets[b.hash] = assetResolvido(b);
      }

      const nosMusica: Record<string, string> = {};
      for (const no of [...nos].sort(ordenarPorId)) {
        nosMusica[no.id] = exigirBaixado(baixados, efeitoDoNo(no).titulo).hash;
      }

      const parcial: ParcialResolvido = {
        assets,
        nos_musica: nosMusica,
        trilha_sonora: trilha.hash,
      };

      // ── 7. a guarda C7, no proprio estagio ──────────────────────────────
      const achados = encontrarURLs(parcial);
      if (achados.length > 0) throw new EURLAtravessouAFronteira(achados);

      return { parcial, procedencia };
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function ordenarPorId(a: No, b: No): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Pausa cortes. Nao entra em nenhum resultado — so no relogio de parede. */
function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/**
 * Qual item do pacote corresponde a um titulo.
 *
 * Titulo fora do catalogo e erro: os titulos pedidos ao fornecedor saem
 * de `titulosNecessarios()`, entao um titulo orfao aqui significaria que
 * alguem montou a lista por fora do pacote.
 */
function itemDoTitulo(titulo: string): ItemDoPacote {
  const item = CATALOGO.find((i) => i.titulo === titulo);
  if (item === undefined) {
    throw new Error(
      `titulo "${titulo}" nao pertence ao pacote ${NOME_DO_PACOTE} v${VERSAO_DO_PACOTE}.`,
    );
  }
  return item;
}

function exigirBaixado(
  baixados: ReadonlyMap<string, ItemBaixado>,
  titulo: string,
): ItemBaixado {
  const b = baixados.get(titulo);
  if (b === undefined) {
    throw new Error(
      `"${titulo}" era necessario e nao foi baixado. ` +
        `Um asset faltando nao pode virar "no sem efeito": o video sairia mudo e verde.`,
    );
  }
  return b;
}

/**
 * Confere o byte contra o que o fornecedor prometeu.
 *
 * Dois oraculos independentes: o tamanho e o SHA-1 publicado pela
 * propria API. Nao e paranoia — e a unica checagem que distingue "baixei
 * o arquivo" de "baixei alguma coisa": um proxy que devolve pagina de
 * erro com status 200 passa em qualquer teste que so olhe `resposta.ok`
 * (C1: exit 0 nao prova conteudo).
 */
function conferirIntegridade(arquivo: ArquivoDoFornecedor, conteudo: Buffer): void {
  if (conteudo.length === 0) {
    throw new EIntegridadeDoDownload(arquivo.titulo, "corpo vazio");
  }
  if (arquivo.bytes > 0 && conteudo.length !== arquivo.bytes) {
    throw new EIntegridadeDoDownload(
      arquivo.titulo,
      `tamanho ${conteudo.length} != ${arquivo.bytes} declarado pelo fornecedor`,
    );
  }
  if (arquivo.sha1Declarado !== "") {
    const sha1 = createHash("sha1").update(conteudo).digest("hex");
    if (sha1 !== arquivo.sha1Declarado) {
      throw new EIntegridadeDoDownload(
        arquivo.titulo,
        `sha1 ${sha1.slice(0, 12)}… != ${arquivo.sha1Declarado.slice(0, 12)}… declarado`,
      );
    }
  }
}

/** Criterio de curadoria da trilha. Cobertura do video e de F3-05. */
function conferirTrilha(trilha: ItemBaixado): void {
  if (trilha.arquivo.duracaoSegundos < DURACAO_MINIMA_TRILHA_SEGUNDOS) {
    throw new ETrilhaInadequada(
      `A trilha "${trilha.item.id}" dura ${trilha.arquivo.duracaoSegundos.toFixed(1)} s, ` +
        `abaixo do minimo de ${DURACAO_MINIMA_TRILHA_SEGUNDOS} s declarado em parametros.\n` +
        `  Troque a trilha no catalogo e bumpe VERSAO_DO_PACOTE, ou baixe o minimo ` +
        `de proposito (o minimo esta na chave de cache: mudar e cache miss).`,
    );
  }
}

/** Metadados do asset que atravessam a fronteira. Zero URL. */
function assetResolvido(baixado: ItemBaixado): AssetResolvido {
  const { arquivo, hash, bytes } = baixado;
  return {
    hash,
    tipo: "audio",
    mimeType: arquivo.mime,
    byteSize: bytes,
    duracaoSegundos: arquivo.duracaoSegundos,
    licenca: arquivo.licenca,
    atribuicaoObrigatoria: arquivo.atribuicaoObrigatoria,
    // Creditamos SEMPRE, inclusive CC0 — que nao exige. A Creative
    // Commons recomenda o credito para material CC0 por norma
    // profissional, e uma pipeline de creditos com dois caminhos
    // (um que credita, outro que nao) tem um caminho que ninguem testa.
    // `atribuicaoObrigatoria` continua dizendo a verdade juridica.
    atribuicao: atribuicaoSemURL(arquivo),
    provedor: PROVEDOR,
  };
}

/** Procedencia de um asset. Aqui a URL e obrigatoria — e este e o lugar dela. */
function procedenciaDoAsset(
  item: ItemDoPacote,
  arquivo: ArquivoDoFornecedor,
  hash: string,
): ProcedenciaAsset {
  return {
    hash,
    licenca: arquivo.licenca,
    atribuicaoObrigatoria: arquivo.atribuicaoObrigatoria,
    atribuicao: atribuicaoSemURL(arquivo),
    provedor: PROVEDOR,
    idNoProvedor: arquivo.titulo,
    // O "S" de TASL. Fica aqui, acima da fronteira, e nunca e usado como
    // caminho de leitura (C7): o pipeline le do store, por hash.
    origem: arquivo.urlDownload,
    termoDeBusca: item.id,
  };
}

/** Cabecalho da procedencia do cassete. `licenca` no topo e o ∅-crit da W4. */
function procedenciaBase(assets: readonly ProcedenciaAsset[]): ProcedenciaCassete {
  const distintas = [...new Set(assets.map((a) => a.licenca))].sort();
  return {
    // Licenca predominante: quando o pacote mistura licencas, a
    // declaracao do topo lista todas. Escolher "a mais comum" esconderia
    // justamente a mais restritiva, que e a que manda.
    licenca: distintas.length > 0 ? distintas.join(" + ") : "SEM ASSET",
    provedor: PROVEDOR,
    ferramenta: `${NOME_DO_PACOTE} ${VERSAO_DO_PACOTE} / ${VERSAO_API_EXTERNA}`,
    assets,
    // O UNICO campo de relogio autorizado no cassete fora de volatil.json
    // (CAMPOS_VOLATEIS: `procedencia.json#/adquiridoEm`). Existe porque
    // auditoria de licenca pergunta "quando este byte entrou no
    // repositorio", e a resposta nao pode ser a epoch.
    adquiridoEm: new Date().toISOString(),
    notas:
      "Uso pessoal (ADR-0003, D1; AB-950 continua fechado). O credito que " +
      "atravessa a fronteira e T+A+L do modelo TASL, sem URL, porque " +
      "$defs.TextoSemURL do manifesto resolvido proibe endereco. O 'S' (fonte) " +
      "fica em assets[].origem e idNoProvedor; CC BY 4.0 §3(a)(2) permite " +
      "satisfazer 3(a)(1) por referencia a um recurso que reune as informacoes, " +
      "e e F5-06 que junta as duas metades na publicacao.",
  };
}

/**
 * Instancia de producao, descoberta por convencao (AGENTS.md Regra 6):
 * `src/resolucao/musica/estagio.ts` + `export default`.
 */
const estagio: EstagioResolucao = criarEstagioMusica();

export default estagio;
