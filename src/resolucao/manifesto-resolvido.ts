/**
 * src/resolucao/manifesto-resolvido.ts
 *
 * O manifesto resolvido — o artefato que atravessa a fronteira de
 * determinismo.
 *
 * Regras que este tipo existe para tornar impossiveis:
 *
 *   C7  — nenhuma URL. Todo asset e referenciado por SHA-256 do conteudo.
 *         A URL de origem fica na procedencia do cassete/store, que vive
 *         ACIMA da fronteira e nunca e lida como caminho.
 *   C9  — nenhum tempo de parede. Nao ha `inicio`, `fim` nem `duracaoMs`
 *         aqui: dois pipelines identicos em maquinas diferentes tem de
 *         produzir o MESMO manifesto resolvido, byte a byte. Duracao e
 *         auditoria, e auditoria mora no cassete (`volatil.json`).
 *
 * O schema JSON equivalente (schema/manifesto-resolvido.schema.json)
 * proibe URL recursivamente, em qualquer profundidade, inclusive dentro
 * do manifesto embutido. Este arquivo e o espelho TypeScript dele.
 */

import type { Manifesto, NodeId } from "../contratos/manifesto.js";
import type { NomeEstagio } from "./contrato.js";

// ─── Versao ─────────────────────────────────────────────────────────────────────

/** Versao do schema do manifesto resolvido. */
export type SchemaVersionResolvido = "ManifestoResolvido.1";

/** Valor da versao, para uso em runtime. */
export const SCHEMA_VERSION_RESOLVIDO: SchemaVersionResolvido =
  "ManifestoResolvido.1";

/** Hash SHA-256 em hexadecimal minusculo. */
export type Sha256 = string;

// ─── Asset resolvido ────────────────────────────────────────────────────────────

/** Tipos de asset que a resolucao pode produzir. */
export type TipoAsset = "audio" | "imagem" | "video" | "gif" | "dados";

/**
 * Referencia a um asset resolvido, endereçada por hash de conteudo.
 *
 * `licenca` e obrigatoria. Um asset sem licenca no manifesto resolvido
 * e um asset que ninguem consegue defender depois — e a checagem existe
 * no schema, nao na revisao de codigo.
 */
export interface AssetResolvido {
  /** SHA-256 do conteudo. Chave de leitura no store. */
  readonly hash: Sha256;

  /** Tipo do asset. */
  readonly tipo: TipoAsset;

  /** MIME type. */
  readonly mimeType?: string;

  /** Tamanho em bytes. */
  readonly byteSize?: number;

  /** Duracao em segundos (audio/video/gif). */
  readonly duracaoSegundos?: number;

  /** Largura em pixels. */
  readonly largura?: number;

  /** Altura em pixels. */
  readonly altura?: number;

  /** Licenca do asset. Obrigatoria e nao-vazia. Nunca uma URL. */
  readonly licenca: string;

  /** Se a licenca exige atribuicao. */
  readonly atribuicaoObrigatoria: boolean;

  /** Texto exato de atribuicao exigido pela licenca. Nunca uma URL. */
  readonly atribuicao?: string;

  /** Fornecedor do asset (identificador, nao endereco). */
  readonly provedor: string;
}

// ─── Registro de estagio ────────────────────────────────────────────────────────

/** Como o resultado de um estagio chegou aqui. */
export type OrigemResultado = "cassete" | "gravacao";

/**
 * Registro de um estagio que participou desta resolucao.
 *
 * Deliberadamente SEM relogio: o que interessa abaixo da fronteira e
 * *qual* codigo produziu o resultado (nome + versao + chave), nunca
 * quando. Ver C9.
 */
export interface RegistroEstagio {
  /** Nome canonico do estagio. */
  readonly estagio: NomeEstagio;

  /** Versao do estagio que produziu o resultado. */
  readonly versaoEstagio: string;

  /** Chave de cache — nome do diretorio do cassete que sustenta isto. */
  readonly chave: Sha256;

  /** De onde veio o resultado: reproduzido do cassete ou recem-gravado. */
  readonly origem: OrigemResultado;
}

// ─── Parcial ────────────────────────────────────────────────────────────────────

/**
 * A camada que UM estagio produz.
 *
 * Cada estagio devolve apenas a sua camada; o orquestrador faz o merge.
 * Todos os campos sao opcionais porque cada estagio preenche so o que e
 * dele — `locucao` preenche `nos_locucao`, `musica` preenche
 * `trilha_sonora` e `nos_musica`, e assim por diante.
 */
export interface ParcialResolvido {
  /** Assets produzidos: hash → metadados. Sempre presente (pode ser vazio). */
  readonly assets: Readonly<Record<Sha256, AssetResolvido>>;

  /** NodeId → hash do asset de midia. */
  readonly nos_midia?: Readonly<Record<NodeId, Sha256>>;

  /** NodeId → hash do audio de locucao. */
  readonly nos_locucao?: Readonly<Record<NodeId, Sha256>>;

  /** NodeId → hash da imagem do grafico. */
  readonly nos_grafico?: Readonly<Record<NodeId, Sha256>>;

  /** NodeId → hash da imagem do codigo destacado. */
  readonly nos_codigo?: Readonly<Record<NodeId, Sha256>>;

  /** NodeId → hash do efeito sonoro daquele no. */
  readonly nos_musica?: Readonly<Record<NodeId, Sha256>>;

  /** Hash da trilha sonora do video inteiro, ou null se nao ha trilha. */
  readonly trilha_sonora?: Sha256 | null;
}

// ─── Manifesto resolvido ────────────────────────────────────────────────────────

/** O manifesto com todos os assets resolvidos. Atravessa a fronteira. */
export interface ManifestoResolvido {
  /** Versao do schema. */
  readonly schema_version: SchemaVersionResolvido;

  /** SHA-256 do JSON canonico do manifesto original. */
  readonly hash_manifesto_original: Sha256;

  /** Copia integra do manifesto original. */
  readonly manifesto: Manifesto;

  /** Todos os assets de todos os estagios: hash → metadados. */
  readonly assets: Readonly<Record<Sha256, AssetResolvido>>;

  /** NodeId → hash do asset de midia. */
  readonly nos_midia: Readonly<Record<NodeId, Sha256>>;

  /** NodeId → hash do audio de locucao. */
  readonly nos_locucao: Readonly<Record<NodeId, Sha256>>;

  /** NodeId → hash da imagem do grafico. */
  readonly nos_grafico: Readonly<Record<NodeId, Sha256>>;

  /** NodeId → hash da imagem do codigo destacado. */
  readonly nos_codigo: Readonly<Record<NodeId, Sha256>>;

  /** NodeId → hash do efeito sonoro daquele no. */
  readonly nos_musica: Readonly<Record<NodeId, Sha256>>;

  /** Hash da trilha sonora, ou null. */
  readonly trilha_sonora: Sha256 | null;

  /** Um registro por estagio que participou, em ordem canonica. */
  readonly estagios: readonly RegistroEstagio[];
}

// ─── Merge ──────────────────────────────────────────────────────────────────────

/** Uma parcial acompanhada do registro do estagio que a produziu. */
export interface ParcialComRegistro {
  readonly registro: RegistroEstagio;
  readonly parcial: ParcialResolvido;
}

/** Erro de colisao no merge: dois estagios reivindicaram o mesmo no. */
export class EColisaoDeMerge extends Error {
  readonly code = "COLISAO_DE_MERGE";
  constructor(campo: string, chave: string, a: string, b: string) {
    super(
      `Colisao de merge em ${campo}["${chave}"]: dois estagios reivindicaram ` +
        `o mesmo no com hashes diferentes (${a.slice(0, 12)}… vs ${b.slice(0, 12)}…). ` +
        `Merge silencioso aqui e resultado dependente de ordem.`,
    );
    this.name = "EColisaoDeMerge";
  }
}

const MAPAS_DE_NO = [
  "nos_midia",
  "nos_locucao",
  "nos_grafico",
  "nos_codigo",
  "nos_musica",
] as const;

type MapaDeNo = (typeof MAPAS_DE_NO)[number];

/**
 * Funde as parciais num manifesto resolvido completo.
 *
 * Determinista por construcao:
 * - as chaves de todos os mapas sao reordenadas lexicograficamente
 *   (Regra 1: nada de iteracao sobre objeto sem ordenacao explicita);
 * - colisao com hashes diferentes e ERRO, nao "o ultimo vence" — o
 *   ultimo-vence torna o resultado funcao da ordem de execucao.
 */
export function fundirParciais(
  manifesto: Manifesto,
  hashManifesto: Sha256,
  entradas: readonly ParcialComRegistro[],
): ManifestoResolvido {
  const assets: Record<Sha256, AssetResolvido> = {};
  const mapas: Record<MapaDeNo, Record<NodeId, Sha256>> = {
    nos_midia: {},
    nos_locucao: {},
    nos_grafico: {},
    nos_codigo: {},
    nos_musica: {},
  };
  let trilha: Sha256 | null = null;

  for (const { parcial } of entradas) {
    for (const [hash, asset] of Object.entries(parcial.assets)) {
      assets[hash] = asset;
    }
    for (const campo of MAPAS_DE_NO) {
      const origem = parcial[campo];
      if (!origem) continue;
      for (const [noId, hash] of Object.entries(origem)) {
        const anterior = mapas[campo][noId];
        if (anterior !== undefined && anterior !== hash) {
          throw new EColisaoDeMerge(campo, noId, anterior, hash);
        }
        mapas[campo][noId] = hash;
      }
    }
    if (parcial.trilha_sonora !== undefined && parcial.trilha_sonora !== null) {
      if (trilha !== null && trilha !== parcial.trilha_sonora) {
        throw new EColisaoDeMerge(
          "trilha_sonora",
          "(unica)",
          trilha,
          parcial.trilha_sonora,
        );
      }
      trilha = parcial.trilha_sonora;
    }
  }

  return {
    schema_version: SCHEMA_VERSION_RESOLVIDO,
    hash_manifesto_original: hashManifesto,
    manifesto,
    assets: ordenarMapa(assets),
    nos_midia: ordenarMapa(mapas.nos_midia),
    nos_locucao: ordenarMapa(mapas.nos_locucao),
    nos_grafico: ordenarMapa(mapas.nos_grafico),
    nos_codigo: ordenarMapa(mapas.nos_codigo),
    nos_musica: ordenarMapa(mapas.nos_musica),
    trilha_sonora: trilha,
    estagios: entradas.map((e) => e.registro),
  };
}

/** Reordena as chaves de um mapa lexicograficamente. */
function ordenarMapa<T>(mapa: Record<string, T>): Record<string, T> {
  const saida: Record<string, T> = {};
  for (const chave of Object.keys(mapa).sort()) {
    saida[chave] = mapa[chave] as T;
  }
  return saida;
}

// ─── Guarda C7 ──────────────────────────────────────────────────────────────────

/**
 * Padrao de URL: esquema explicito (`http://`, `s3://`), URL relativa a
 * protocolo (`//cdn...`) ou host cru (`www.…`).
 *
 * Usado pelo tripwire (C11: busca vazia em texto nao e prova de ausencia
 * — entao a busca acontece no JSON serializado inteiro, nao campo a campo).
 */
export const PADRAO_URL = /:\/\/|(^|[\s"'(<])\/\//;

/** Uma URL encontrada onde nao podia estar. */
export interface AchadoDeURL {
  readonly caminho: string;
  readonly valor: string;
}

/**
 * Varre um manifesto resolvido inteiro procurando URL, em qualquer
 * profundidade, tanto em valores quanto em nomes de propriedade.
 *
 * Espelha `$defs.SemURLProfundo` do schema JSON. O schema e a barreira;
 * esta funcao e a sonda que prova que a barreira esta de pe.
 */
export function encontrarURLs(valor: unknown, caminho = "$"): AchadoDeURL[] {
  const achados: AchadoDeURL[] = [];
  if (typeof valor === "string") {
    if (PADRAO_URL.test(valor)) achados.push({ caminho, valor });
    return achados;
  }
  if (Array.isArray(valor)) {
    valor.forEach((item, i) => {
      achados.push(...encontrarURLs(item, `${caminho}[${i}]`));
    });
    return achados;
  }
  if (valor !== null && typeof valor === "object") {
    for (const [chave, sub] of Object.entries(valor as Record<string, unknown>)) {
      if (PADRAO_URL.test(chave)) {
        achados.push({ caminho: `${caminho}.<nome-de-propriedade>`, valor: chave });
      }
      achados.push(...encontrarURLs(sub, `${caminho}.${chave}`));
    }
  }
  return achados;
}
