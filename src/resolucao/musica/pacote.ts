/**
 * src/resolucao/musica/pacote.ts
 *
 * O PACOTE DO FORNECEDOR — e a razao pela qual este card existe.
 *
 * Um pacote de efeitos sonoros nao entrega bytes: ele entrega
 * *enderecos*. Cada item deste catalogo e um identificador no fornecedor,
 * e o que o fornecedor devolve para esse identificador e uma **URL
 * remota**. Uma URL nao atravessa a fronteira de determinismo por tres
 * motivos independentes, e basta um:
 *
 *   1. C7 — o conteudo de uma URL muda sem a URL mudar. Dois renders do
 *      mesmo manifesto, em datas diferentes, sairiam com audios
 *      diferentes e ninguem veria diferenca no manifesto resolvido.
 *   2. A URL exige rede no momento do render. A composicao e pura: nao
 *      ha rede abaixo da fronteira.
 *   3. `schema/manifesto-resolvido.schema.json` (`$defs.SemURLProfundo`)
 *      **rejeita** URL em qualquer profundidade — valor ou nome de
 *      propriedade. Nao e convencao; e impossivel pelo schema.
 *
 * Entao o caminho de um efeito, deste arquivo ate o video, e:
 *
 *     titulo no pacote
 *       -> API do fornecedor (entrada.fetch)  -> URL remota  [gravada no cassete]
 *       -> download (entrada.fetch)           -> bytes       [gravados em corpos/]
 *       -> sha256(bytes)                      -> HASH
 *       -> store por conteudo (F0-07)         -> .cache/store/<ab>/<hash>
 *       -> parcial.nos_musica[no] = HASH                      ← so o hash cruza
 *          parcial.assets[HASH]   = { licenca, atribuicao, ... }
 *       -> procedencia.assets[].origem = URL                  ← a URL fica ACIMA
 *
 * O fornecedor escolhido e o Wikimedia Commons, pela Action API. A
 * escolha e deliberada e esta registrada em `docs/adr/0012-musica-e-efeitos.md`;
 * o que importa aqui e uma propriedade que nenhum outro candidato tinha:
 * **a API nao usa credencial**. A pergunta adversarial "o cassete contem
 * alguma credencial?" passa a ter resposta estrutural (nao ha o que
 * vazar) em vez de resposta por redacao (havia, e foi mascarada).
 */

import type { No } from "../../contratos/manifesto.js";

// ─── Identidade do pacote ───────────────────────────────────────────────────────

/**
 * Nome do pacote. Entra em `parametros` e portanto na chave de cache:
 * trocar de pacote tem de ser cache miss, nunca "o mesmo audio de antes".
 */
export const NOME_DO_PACOTE = "commons-efeitos-base";

/**
 * Versao do catalogo. Bump obrigatorio ao acrescentar, remover ou trocar
 * qualquer item — inclusive ao mudar o mapa `TIPO_DE_NO_PARA_EFEITO`.
 * Sem bump, um manifesto ja resolvido continua servindo o efeito antigo.
 */
export const VERSAO_DO_PACOTE = "1.0.0";

/** Identificador do fornecedor. E identificador, nunca endereco (C7). */
export const PROVEDOR = "wikimedia-commons";

// ─── Itens ──────────────────────────────────────────────────────────────────────

/** Papel de um item dentro do pacote. */
export type PapelDoItem = "efeito" | "trilha";

/**
 * Um item do pacote.
 *
 * Repare no que NAO esta aqui: a URL. O pacote guarda o identificador
 * do arquivo no fornecedor; a URL e devolvida pela API em tempo de
 * resolucao, com parametros de campanha que o proprio fornecedor
 * acrescenta (`?utm_source=...`). Fixar a URL neste arquivo daria a
 * impressao de que ela e estavel — e a premissa falsa de C7.
 */
export interface ItemDoPacote {
  /** Id estavel dentro do pacote. Entra no relatorio, nao no hash. */
  readonly id: string;

  /** Titulo do arquivo no fornecedor. E o que a API recebe. */
  readonly titulo: string;

  /** Para que serve dentro do video. */
  readonly papel: PapelDoItem;

  /** Por que este item esta no pacote. Auditoria de curadoria. */
  readonly justificativa: string;
}

/**
 * O catalogo.
 *
 * Curadoria com dois criterios explicitos: licenca **declarada pelo
 * proprio fornecedor** (nunca inferida por quem escolheu) e arquivo
 * pequeno — o cassete e versionado no git, e o git nao esquece
 * (ledger AB-280). Os cinco itens somam ~1,2 MB.
 *
 * A mistura de licencas e proposital: tres itens dispensam atribuicao
 * (CC0 / dominio publico) e dois a exigem (CC BY 3.0). Um pacote so de
 * CC0 deixaria o caminho de atribuicao sem exercicio — e o caminho sem
 * exercicio e o que quebra na primeira vez que alguem precisa dele.
 */
export const CATALOGO: readonly ItemDoPacote[] = [
  {
    id: "abertura",
    titulo: "File:Airplane Chime Sound Effect.ogg",
    papel: "efeito",
    justificativa:
      "Sino curto e neutro (2,9 segundos). CC0: exercita o caminho sem atribuicao.",
  },
  {
    id: "conquista",
    titulo: "File:Achievement unlocked sound effect video game.wav",
    papel: "efeito",
    justificativa:
      "Acorde ascendente (1,1 segundos). CC BY 3.0: exercita o caminho COM atribuicao obrigatoria.",
  },
  {
    id: "caixa-de-musica",
    titulo: "File:Music Box Sound Effect.ogg",
    papel: "efeito",
    justificativa:
      "Timbre suave (2,1 segundos). Dominio publico: terceira variante de licenca no mesmo pacote.",
  },
  {
    id: "campainha",
    titulo: "File:Sound Effect - Door Bell.ogg",
    papel: "efeito",
    justificativa:
      "Campainha (3,7 segundos). CC0, e o unico item cujo credito bruto do fornecedor traz " +
      "URL relativa a protocolo (`//commons...`) — exercita a limpeza que o schema cobra.",
  },
  {
    id: "trilha-elevador",
    titulo: "File:Kevin MacLeod - Lift Motif.ogg",
    papel: "trilha",
    justificativa:
      "Trilha instrumental de 44,4 segundos, CC BY 3.0. Cobre a fixture canonica (727 frames a 30 fps = 24,2 segundos).",
  },
] as const;

/** Busca um item pelo id. Id ausente e erro, nunca `undefined` silencioso. */
export function itemPorId(id: string): ItemDoPacote {
  const item = CATALOGO.find((i) => i.id === id);
  if (item === undefined) {
    throw new EPacoteInconsistente(
      `item "${id}" nao existe em ${NOME_DO_PACOTE} v${VERSAO_DO_PACOTE}. ` +
        `Ids disponiveis: ${CATALOGO.map((i) => i.id).join(", ")}.`,
    );
  }
  return item;
}

/** Os itens de um papel, na ordem do catalogo (que e a ordem do arquivo). */
export function itensDoPapel(papel: PapelDoItem): readonly ItemDoPacote[] {
  return CATALOGO.filter((i) => i.papel === papel);
}

// ─── Politica de selecao ────────────────────────────────────────────────────────

/**
 * Qual efeito toca em qual tipo de no.
 *
 * Isto e POLITICA, nao descoberta: a escolha e arbitraria e esta aqui
 * para ser lida e discutida, nao escondida num `switch` no meio do
 * estagio. Mudar este mapa muda a saida, e por isso exige bump de
 * `VERSAO_DO_PACOTE` (que esta em `parametros`, que esta na chave).
 *
 * Tres itens sao reaproveitados por mais de um tipo de proposito: o
 * store e enderecado por conteudo, entao dois nos que usam o mesmo
 * efeito compartilham UM hash e UM download. O numero de chamadas de
 * rede e o numero de efeitos DISTINTOS usados, nao o numero de nos.
 */
export const TIPO_DE_NO_PARA_EFEITO: Readonly<Record<string, string>> = {
  cabecalho: "abertura",
  texto: "caixa-de-musica",
  lista: "conquista",
  midia: "campainha",
  codigo: "caixa-de-musica",
  grafico: "conquista",
};

/** Id do item de trilha sonora deste pacote. */
export const ID_DA_TRILHA = "trilha-elevador";

/**
 * Efeito de um no.
 *
 * Tipo fora do mapa e ERRO, nao `continue`. Um no que passasse batido
 * sairia sem efeito e ninguem notaria: o video renderiza, o gate fica
 * verde, e o defeito so aparece assistindo. Falha barulhenta e mais
 * barata.
 */
export function efeitoDoNo(no: No): ItemDoPacote {
  const id = TIPO_DE_NO_PARA_EFEITO[no.type];
  if (id === undefined) {
    throw new EPacoteInconsistente(
      `no "${no.id}" e do tipo "${no.type}", que nao esta em ` +
        `TIPO_DE_NO_PARA_EFEITO (${Object.keys(TIPO_DE_NO_PARA_EFEITO).sort().join(", ")}).\n` +
        `  Um tipo de no sem efeito mapeado nao pode ser pulado em silencio: ` +
        `o video sairia mudo naquele trecho e o gate ficaria verde.\n` +
        `  Acrescente o mapeamento e bumpe VERSAO_DO_PACOTE (a chave de cache depende dela).`,
    );
  }
  return itemPorId(id);
}

/**
 * Titulos que a resolucao precisa pedir ao fornecedor, deduplicados e em
 * ordem lexicografica.
 *
 * A ordem e explicita de proposito (AGENTS.md Regra 1): a ordem dos nos
 * do manifesto nao pode virar ordem de chamada, senao dois manifestos
 * com os mesmos nos em ordem diferente produziriam cassetes diferentes.
 */
export function titulosNecessarios(nos: readonly No[]): readonly string[] {
  const titulos = new Set<string>([itemPorId(ID_DA_TRILHA).titulo]);
  for (const no of nos) titulos.add(efeitoDoNo(no).titulo);
  return [...titulos].sort();
}

// ─── Erro ───────────────────────────────────────────────────────────────────────

/** O pacote pediu algo que ele mesmo nao declara. */
export class EPacoteInconsistente extends Error {
  readonly code = "PACOTE_INCONSISTENTE";
  constructor(mensagem: string) {
    super(`Pacote ${NOME_DO_PACOTE} v${VERSAO_DO_PACOTE}: ${mensagem}`);
    this.name = "EPacoteInconsistente";
  }
}
