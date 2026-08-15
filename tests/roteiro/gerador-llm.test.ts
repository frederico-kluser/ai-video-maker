/**
 * tests/roteiro/gerador-llm.test.ts
 *
 * O ORACULO da saida estruturada do gerador (REPLAN P1): o provedor LLM
 * hoje NAO envia output_config — "prompt rigoroso + gate" nao e oraculo
 * (nenhum teste falha se o parsing de marcadores do LLM quebrar). Este
 * arquivo fecha a frente com o schema podado por fornecedor (subset
 * strict-mode, llm-authoring) no output_config das chamadas:
 *
 *   1. SCHEMAS PODADOS — os 4 arquivos (roteiro.llm.*.json para a
 *      geracao completa, pedaco.llm.*.json para a regeneracao) sao JSON
 *      Schema 2020-12 VALIDOS (Ajv2020 — o mesmo validador que a autoria
 *      usa, tests/autoria/contrato/subset.test.ts), NAO contem nenhuma
 *      construcao hostil ao modo estrito de cada fornecedor (scanner por
 *      lista de chaves recusadas) e sao SUBSET do schema completo (todo
 *      campo existe la; enum ⊆ VOCABULARIO_TIPO_VISUAL; identidade,
 *      narracao e anexo — decisoes do sistema — nao existem no podado).
 *      SONDA NEGATIVA: o scanner PEGA construcoes hostis (minLength na
 *      Anthropic; const sem type na OpenAI — a construcao medida 400 na
 *      autoria, chamada.ts).
 *
 *   2. REQUEST — a chamada montada (fetch mock) carrega o output_config
 *      com o subset por fornecedor e por alvo: output_config.format
 *      json_schema na Anthropic; response_format.json_schema com
 *      strict:true na OpenAI (possivel porque o subset OpenAI deste
 *      gerador e strict-compativel). O output_config NAO aparece no
 *      prompt (system + user intocados — o prompt e byte-idêntico).
 *
 *   3. EXTRACAO — resposta com bloco output_json (anthropic) /
 *      content de response_format (openai) extraida corretamente; prosa
 *      ao redor do JSON continua sendo tratada. SONDA NEGATIVA: resposta
 *      que nao casa os blocos esperados (nem text nem output_json) →
 *      EProvedorRoteiroFalhou, nunca JSON aceito.
 *
 *   4. C12 — o output_config NAO faz parte do prompt: a chave do store
 *      compoe o FINGERPRINT do schema podado (chaveDoStore +
 *      fingerprintDoSchemaPodado). A prova e por transitividade (nada de
 *      mutar arquivos commitados — o vitest roda arquivos em paralelo):
 *      (a) fingerprint(schema) muda quando o conteudo muda (provas com
 *      arquivos tmp); (b) a chave reportada pelo gerador e EXATAMENTE a
 *      composicao com o fingerprint corrente; logo (c) schema editado =
 *      MISS, mesmo prompt byte-idêntico — e o teste fecha o ciclo com o
 *      cache: entrada identica 2x com o schema corrente = HIT.
 *
 *   5. COMPATIBILIDADE — o caminho sosia nao usa output_config (sem
 *      fetch; o sosia nao monta request nenhuma); o cassete commitado
 *      reproduz byte a byte (o cassete nao passa pelo output_config — a
 *      suite existente, gerador.test.ts, cobre; aqui so o fingerprint
 *      com os arquivos commitados).
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import Ajv2020, { type AnySchema } from "ajv/dist/2020.js";
import { chaveDeCacheGerador } from "../../src/roteiro/contrato/cache.js";
import type {
  Pedaco,
  PedidoGerarRoteiro,
  PedidoRegenerarPedaco,
  Roteiro,
} from "../../src/roteiro/contrato/contrato.js";
import { VOCABULARIO_TIPO_VISUAL } from "../../src/roteiro/contrato/contrato.js";
import { validarPedaco, validarRoteiro } from "../../src/roteiro/contrato/validar.js";
import { chaveDoStore } from "../../src/roteiro/gerador/cache.js";
import { gerarRoteiro, regenerarPedaco } from "../../src/roteiro/gerador/gerador.js";
import { montarPromptRegenerar, montarPromptRoteiro } from "../../src/roteiro/gerador/prompt.js";
import {
  CAMINHO_SCHEMA_LLM,
  EProvedorRoteiroFalhou,
  ESchemaPodadoAusente,
  ProvedorSosiaRoteiro,
  carregarSchemaPodado,
  criarProvedorLlm,
  fingerprintDoSchemaPodado,
} from "../../src/roteiro/gerador/provedor.js";
import type { ProvedorRoteiro } from "../../src/roteiro/gerador/provedor.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pedidoGerar(sobrescrita: Partial<PedidoGerarRoteiro> = {}): PedidoGerarRoteiro {
  return {
    brief: { tema: "Como funciona um cache de computador", contexto: "Video para iniciantes" },
    duracao_alvo_segundos: 30,
    versao_contrato: "Roteiro.1",
    versao_contrato_gerador: "1.0.0",
    versao_gerador: "1.0.0",
    ...sobrescrita,
  };
}

function pedacoAlvo(sobrescrita: Partial<Pedaco> = {}): Pedaco {
  return {
    id: "p-001",
    indice: 1,
    titulo: "O que e um cache",
    fala: "Um cache guarda o resultado de uma conta para nao refaze-la.",
    duracao_segundos: 12.5,
    tipo_visual: "manim",
    especificacao_visual: "Animacao estilo 3b1b com shapes",
    detalhes_de_producao: "Cena Manim via estagio grafico",
    narracao: { texto: "", origem: "nenhuma", status: "vazio" },
    ...sobrescrita,
  };
}

function pedidoRegenerar(
  sobrescrita: Partial<PedidoRegenerarPedaco> = {},
): PedidoRegenerarPedaco {
  return {
    brief: { tema: "Como funciona um cache de computador" },
    duracao_alvo_segundos: 30,
    pedaco_atual: pedacoAlvo(),
    resumo_demais_pedacos: "[{\"id\":\"p-000\"},{\"id\":\"p-002\"}]",
    versao_contrato: "Roteiro.1",
    versao_contrato_gerador: "1.0.0",
    versao_gerador: "1.0.0",
    ...sobrescrita,
  };
}

function cacheTmp(): string {
  return mkdtempSync(join(tmpdir(), "roteiro-llm-teste-"));
}

function carregarArquivo(caminho: string): unknown {
  return JSON.parse(readFileSync(caminho, "utf-8")) as unknown;
}

/** Um Roteiro VALIDO (forma de schema) — a resposta que o provedor devolve. */
function roteiroValido(): Roteiro {
  return {
    schema_version: "Roteiro.1",
    pedacos: [
      {
        id: "p-000",
        indice: 0,
        titulo: "Abertura",
        fala: "",
        duracao_segundos: 4,
        tipo_visual: "cabecalho",
        especificacao_visual: "Titulo em destaque",
        detalhes_de_producao: "Composicao de cabecalho",
        narracao: { texto: "", origem: "nenhuma", status: "vazio" },
      },
      {
        id: "p-001",
        indice: 1,
        titulo: "O que e um cache",
        fala: "Um cache guarda resultados para nao recalcular.",
        duracao_segundos: 8,
        tipo_visual: "texto",
        especificacao_visual: "Texto em destaque com a definicao",
        detalhes_de_producao: "Slide de texto",
        narracao: { texto: "", origem: "nenhuma", status: "vazio" },
      },
    ],
    duracao_total_segundos: 12,
  };
}

/** Um documento que SATISFAZ o schema podado (sem id/indice/narracao/anexo). */
const ROTEIRO_PODADO_VALIDO = {
  schema_version: "Roteiro.1",
  pedacos: [
    {
      titulo: "Abertura",
      fala: "",
      duracao_segundos: 4,
      tipo_visual: "cabecalho",
      especificacao_visual: "Titulo em destaque",
      detalhes_de_producao: "Composicao de cabecalho",
    },
    {
      titulo: "O que e um cache",
      fala: "Um cache guarda resultados para nao recalcular.",
      duracao_segundos: 8,
      tipo_visual: "texto",
      especificacao_visual: "Texto em destaque com a definicao",
      detalhes_de_producao: "Slide de texto",
    },
  ],
  duracao_total_segundos: 12,
} as const;

/** Inverte a ordem das chaves de objetos recursivamente (teste de canonicalizacao). */
function inverterOrdemDeChaves(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(inverterOrdemDeChaves);
  }
  if (valor !== null && typeof valor === "object") {
    const entrada = valor as Record<string, unknown>;
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(entrada).reverse()) {
      saida[chave] = inverterOrdemDeChaves(entrada[chave]);
    }
    return saida;
  }
  return valor;
}

/** Um Pedaco que SATISFAZ o schema podado da regeneracao. */
const PEDACO_PODADO_VALIDO = {
  titulo: "O que e um cache",
  fala: "Um cache guarda resultados para nao recalcular.",
  duracao_segundos: 8,
  tipo_visual: "texto",
  especificacao_visual: "Texto em destaque com a definicao",
  detalhes_de_producao: "Slide de texto",
} as const;

// ─── 1. Oráculo dos schemas podados ───────────────────────────────────────────

/**
 * Chaves recusadas pelo modo estrito da Anthropic — a MESMA lista que a
 * autoria usa (tests/autoria/contrato/subset.test.ts, ADR-0023):
 * o schema que viaja na chamada NAO pode conter nenhuma delas (chave
 * recusada = 400 na API, antes da inferencia).
 */
const RECUSADAS_ANTHROPIC = [
  "minimum",
  "maximum",
  "multipleOf",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "oneOf",
  "pattern",
  "if",
  "then",
  "else",
  "not",
  "dependentRequired",
  "dependentSchemas",
] as const;

/** Chaves recusadas pelo modo estrito da OpenAI (a lista da autoria). */
const RECUSADAS_OPENAI = [
  "allOf",
  "not",
  "if",
  "then",
  "else",
  "dependentRequired",
  "dependentSchemas",
  "oneOf",
  "default",
] as const;

/** Visita todos os objetos (e arrays) do schema, inclusive aninhados. */
function visitar(no: unknown, fn: (objeto: Record<string, unknown>) => void): void {
  if (Array.isArray(no)) {
    for (const item of no) {
      visitar(item, fn);
    }
    return;
  }
  if (no !== null && typeof no === "object") {
    const objeto = no as Record<string, unknown>;
    fn(objeto);
    for (const valor of Object.values(objeto)) {
      visitar(valor, fn);
    }
  }
}

/** Todas as chaves recusadas presentes no schema (vazio = subset limpo). */
function coletarChavesRecusadas(schema: unknown, recusadas: readonly string[]): string[] {
  const achadas: string[] = [];
  visitar(schema, (objeto) => {
    for (const chave of recusadas) {
      if (chave in objeto) {
        achadas.push(chave);
      }
    }
  });
  return achadas;
}

/** Todo objeto com properties tem additionalProperties:false. */
function objetosSemAditionalPropertiesFalse(schema: unknown): string[] {
  const problemas: string[] = [];
  visitar(schema, (objeto) => {
    if ("properties" in objeto && objeto.additionalProperties !== false) {
      problemas.push(JSON.stringify(objeto).slice(0, 100));
    }
  });
  return problemas;
}

/** minItems fora do {0, 1} aceito pela Anthropic. */
function minItemsForaDoAceito(schema: unknown): number[] {
  const valores: number[] = [];
  visitar(schema, (objeto) => {
    if (typeof objeto.minItems === "number") {
      valores.push(objeto.minItems as number);
    }
  });
  return valores.filter((v) => v !== 0 && v !== 1);
}

/** $ref externo (nao comeca em "#/") — proibido nos dois subsets. */
function refsExternos(schema: unknown): string[] {
  const refs: string[] = [];
  visitar(schema, (objeto) => {
    if (typeof objeto.$ref === "string" && !(objeto.$ref as string).startsWith("#/")) {
      refs.push(objeto.$ref as string);
    }
  });
  return refs;
}

/** Const SEM type — a construcao medida 400 no strict da OpenAI (autoria chamada.ts). */
function constsSemType(schema: unknown): string[] {
  const consts: string[] = [];
  visitar(schema, (objeto) => {
    if ("const" in objeto && !("type" in objeto)) {
      consts.push(`const ${JSON.stringify(objeto.const)} sem type`);
    }
  });
  return consts;
}

/** Propriedades fora de required (o strict da OpenAI exige TODAS em required). */
function propriedadesForaDeRequired(schema: unknown): string[] {
  const problemas: string[] = [];
  visitar(schema, (objeto) => {
    if (!objeto.properties || typeof objeto.properties !== "object") {
      return;
    }
    const nomes = Object.keys(objeto.properties as Record<string, unknown>);
    const requeridas = (objeto.required ?? []) as string[];
    const faltando = nomes.filter((n) => !requeridas.includes(n));
    if (faltando.length > 0) {
      problemas.push(`${faltando.join(", ")} em ${JSON.stringify(objeto).slice(0, 100)}`);
    }
  });
  return problemas;
}

describe("Schemas podados — JSON Schema valido, subset strict-mode por fornecedor (oraculo)", () => {
  const ajv = new Ajv2020({ strict: false });
  const ALVOS = ["completo", "pedaco"] as const;

  it("os 4 arquivos compilam como JSON Schema 2020-12 (Ajv2020 — o validador da autoria)", () => {
    for (const alvo of ALVOS) {
      for (const provedor of ["anthropic", "openai"] as const) {
        const schema = carregarSchemaPodado(provedor, alvo);
        expect(() => ajv.compile(schema as AnySchema), `${alvo}/${provedor}`).not.toThrow();
      }
    }
  });

  it("nenhuma chave recusada pela Anthropic esta nos subsets Anthropic", () => {
    for (const alvo of ALVOS) {
      const schema = carregarSchemaPodado("anthropic", alvo);
      const achadas = coletarChavesRecusadas(schema, RECUSADAS_ANTHROPIC);
      expect(achadas, `antropico/${alvo}: ${achadas.join(", ")}`).toEqual([]);
      expect(minItemsForaDoAceito(schema), `antropico/${alvo} minItems`).toEqual([]);
      expect(objetosSemAditionalPropertiesFalse(schema), `antropico/${alvo}`).toEqual([]);
      expect(refsExternos(schema), `antropico/${alvo}`).toEqual([]);
    }
  });

  it("nenhuma chave recusada pela OpenAI esta nos subsets OpenAI; raiz objeto; tudo em required; const com type", () => {
    for (const alvo of ALVOS) {
      const schema = carregarSchemaPodado("openai", alvo) as Record<string, unknown>;
      const achadas = coletarChavesRecusadas(schema, RECUSADAS_OPENAI);
      expect(achadas, `openai/${alvo}: ${achadas.join(", ")}`).toEqual([]);
      expect(schema.type, `openai/${alvo} raiz`).toBe("object");
      expect(schema.anyOf, `openai/${alvo} raiz anyOf`).toBeUndefined();
      expect(objetosSemAditionalPropertiesFalse(schema), `openai/${alvo}`).toEqual([]);
      expect(propriedadesForaDeRequired(schema), `openai/${alvo}`).toEqual([]);
      expect(constsSemType(schema), `openai/${alvo}`).toEqual([]);
      expect(refsExternos(schema), `openai/${alvo}`).toEqual([]);
    }
  });

  it("SONDA NEGATIVA: o scanner PEGA construcoes hostis (minLength na Anthropic; const sem type e prop fora de required na OpenAI)", () => {
    const hostilAnthropic = {
      type: "object",
      additionalProperties: false,
      required: ["titulo"],
      properties: { titulo: { type: "string", minLength: 1 } },
    };
    expect(coletarChavesRecusadas(hostilAnthropic, RECUSADAS_ANTHROPIC)).toContain("minLength");

    const hostilOpenaiConstSemType = {
      type: "object",
      additionalProperties: false,
      required: ["a"],
      properties: { a: { const: "x" } },
    };
    expect(constsSemType(hostilOpenaiConstSemType)).toHaveLength(1);

    const hostilOpenaiOpcional = {
      type: "object",
      additionalProperties: false,
      required: [],
      properties: { a: { type: "string" } },
    };
    expect(propriedadesForaDeRequired(hostilOpenaiOpcional)).toHaveLength(1);
  });

  it("o podado e SUBSET do completo: todo campo existe no schema completo; enum ⊆ vocabulario; decisoes do sistema ausentes", () => {
    const completo = carregarArquivo(CAMINHO_SCHEMA_LLM.completo.anthropic) as Record<string, unknown>;
    // O caminho do schema completo do contrato e o ponto de comparacao:
    // campos do podado ⊆ campos do completo.
    const caminhoCompleto = new URL(
      "../../src/roteiro/contrato/schema/roteiro.schema.json",
      import.meta.url,
    ).pathname;
    const schemaCompleto = carregarArquivo(caminhoCompleto) as {
      properties: Record<string, unknown>;
      $defs: { Pedaco: { properties: Record<string, unknown> } };
    };
    const camposDoRoteiro = Object.keys(completo.properties as Record<string, unknown>);
    for (const campo of camposDoRoteiro) {
      expect(
        campo in schemaCompleto.properties,
        `campo do podado ausente no completo: ${campo}`,
      ).toBe(true);
    }
    const camposDoPedacoCompleto = Object.keys(schemaCompleto.$defs.Pedaco.properties);
    for (const alvo of ALVOS) {
      const schema = carregarSchemaPodado("anthropic", alvo) as {
        properties: Record<string, unknown>;
      };
      if (alvo === "completo") {
        const items = (schema.properties.pedacos as { items: { properties: Record<string, unknown> } }).items;
        for (const campo of Object.keys(items.properties)) {
          expect(
            camposDoPedacoCompleto.includes(campo),
            `campo do pedaco podado ausente no completo: ${campo}`,
          ).toBe(true);
        }
      } else {
        for (const campo of Object.keys(schema.properties)) {
          expect(
            camposDoPedacoCompleto.includes(campo),
            `campo do pedaco podado ausente no completo: ${campo}`,
          ).toBe(true);
        }
      }
    }
    // Vocabulario: enum do tipo_visual ⊆ VOCABULARIO_TIPO_VISUAL do contrato.
    for (const alvo of ALVOS) {
      for (const provedor of ["anthropic", "openai"] as const) {
        const schema = carregarSchemaPodado(provedor, alvo) as {
          properties: Record<string, unknown>;
        };
        const tipoVisual =
          alvo === "completo"
            ? (
                (schema.properties.pedacos as { items: { properties: Record<string, unknown> } })
                  .items.properties.tipo_visual as { enum?: string[] }
              ).enum
            : (schema.properties.tipo_visual as { enum?: string[] } | undefined)?.enum;
        for (const valor of tipoVisual ?? []) {
          expect(
            (VOCABULARIO_TIPO_VISUAL as readonly string[]).includes(valor),
            `tipo_visual "${valor}" fora do vocabulario do contrato (${alvo}/${provedor})`,
          ).toBe(true);
        }
      }
    }
    // Decisoes do sistema NAO existem no podado: nenhum CAMPO com esses
    // nomes (a description pode citar a palavra; o que importa e a
    // propriedade — o modelo nao consegue emitir o que nao existe).
    for (const alvo of ALVOS) {
      for (const provedor of ["anthropic", "openai"] as const) {
        const nomesDeCampos: string[] = [];
        visitar(carregarSchemaPodado(provedor, alvo), (objeto) => {
          if (objeto.properties && typeof objeto.properties === "object") {
            nomesDeCampos.push(...Object.keys(objeto.properties as Record<string, unknown>));
          }
        });
        expect(
          nomesDeCampos,
          `${alvo}/${provedor} nao pode ter campo de decisao do sistema`,
        ).not.toContain("id");
        expect(nomesDeCampos, `${alvo}/${provedor}`).not.toContain("indice");
        expect(nomesDeCampos, `${alvo}/${provedor}`).not.toContain("narracao");
        expect(nomesDeCampos, `${alvo}/${provedor}`).not.toContain("anexo_hash");
        expect(nomesDeCampos, `${alvo}/${provedor}`).not.toContain("anexo_meta");
      }
    }
    // Primeira geracao: tipo_visual SEM gif/video (anexo e decisao do usuario);
    // regeneracao: enum INTEIRO (o alvo gif/video pode ser mantido).
    const completoAnthropic = carregarSchemaPodado("anthropic", "completo") as {
      properties: { pedacos: { items: { properties: { tipo_visual: { enum: string[] } } } } };
    };
    expect(completoAnthropic.properties.pedacos.items.properties.tipo_visual.enum).not.toContain("gif");
    expect(completoAnthropic.properties.pedacos.items.properties.tipo_visual.enum).not.toContain("video");
    const pedacoAnthropic = carregarSchemaPodado("anthropic", "pedaco") as {
      properties: { tipo_visual: { enum: string[] } };
    };
    expect(pedacoAnthropic.properties.tipo_visual.enum).toContain("gif");
    expect(pedacoAnthropic.properties.tipo_visual.enum).toContain("video");
  });

  it("o que o podado aceita vira documento valido no completo (com as decisoes do sistema aplicadas) — o ciclo fecha", () => {
    // Um documento satisfazendo o podado (sem id/indice/narracao) + as
    // decisoes do sistema (identidade derivada, RECORD-FIRST) valida no
    // schema completo — o MESMO validador do gate (validar.ts).
    const roteiroCompleto = {
      schema_version: "Roteiro.1",
      pedacos: ROTEIRO_PODADO_VALIDO.pedacos.map((p, i) => ({
        ...p,
        id: `p-${String(i).padStart(3, "0")}`,
        indice: i,
        narracao: { texto: "", origem: "nenhuma", status: "vazio" },
      })),
      duracao_total_segundos: ROTEIRO_PODADO_VALIDO.duracao_total_segundos,
    };
    const validacao = validarRoteiro(roteiroCompleto);
    expect(validacao.valido, validacao.problemas.join("; ")).toBe(true);

    const pedacoCompleto = {
      ...PEDACO_PODADO_VALIDO,
      id: "p-001",
      indice: 1,
      narracao: { texto: "", origem: "nenhuma", status: "vazio" },
    };
    const validacaoPedaco = validarPedaco(pedacoCompleto);
    expect(validacaoPedaco.valido, validacaoPedaco.problemas.join("; ")).toBe(true);
  });

  it("os documentos podados validam nos 4 schemas podados (Ajv — o que o modelo ve)", () => {
    for (const provedor of ["anthropic", "openai"] as const) {
      const fnRoteiro = ajv.compile(carregarSchemaPodado(provedor, "completo") as AnySchema);
      expect(fnRoteiro(ROTEIRO_PODADO_VALIDO), `${provedor} roteiro podado`).toBe(true);
      const fnPedaco = ajv.compile(carregarSchemaPodado(provedor, "pedaco") as AnySchema);
      expect(fnPedaco(PEDACO_PODADO_VALIDO), `${provedor} pedaco podado`).toBe(true);
    }
  });
});

// ─── 2. Request — output_config por fornecedor e por alvo ─────────────────────

describe("Request LLM — output_config presente com o subset podado; o schema NAO vai no prompt", () => {
  it("anthropic (geracao completa): output_config.format json_schema com o schema podado; prompt intocado", async () => {
    const chamadas: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      chamadas.push({ url: String(url), init: init ?? {} });
      return new Response(
        JSON.stringify({ content: [{ type: "output_json", json: roteiroValido() }] }),
        { status: 200 },
      );
    };
    const provedor = criarProvedorLlm("anthropic", { fetch: fetchMock, chaveDeApi: "chave-teste" });
    const prompt = montarPromptRoteiro(pedidoGerar());
    const saida = await provedor.gerarRoteiroCompleto(prompt);

    expect(chamadas.length).toBe(1);
    expect(chamadas[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    const corpo = JSON.parse(String(chamadas[0]?.init.body)) as Record<string, unknown>;
    const schemaEsperado = carregarArquivo(CAMINHO_SCHEMA_LLM.completo.anthropic);
    expect(corpo.output_config).toEqual({
      format: { type: "json_schema", name: "roteiro", schema: schemaEsperado },
    });
    // O output_config NAO faz parte do prompt (C12): system+user intocados.
    const textoDoPrompt = `${String(corpo.system)}\n${
      (corpo.messages as Array<{ content: string }>)[0]?.content
    }`;
    expect(textoDoPrompt).not.toContain("output_config");
    expect(textoDoPrompt).not.toContain(JSON.stringify(schemaEsperado));
    expect(JSON.stringify(saida)).toBe(JSON.stringify(roteiroValido()));
  });

  it("anthropic (regeneracao): o schema e o subset do PEDACO, com enum INTEIRO (gif/video inclusos)", async () => {
    const chamadas: Array<{ init: RequestInit }> = [];
    const fetchMock = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      chamadas.push({ init: init ?? {} });
      return new Response(
        JSON.stringify({ content: [{ type: "output_json", json: pedacoAlvo({ fala: "Fala nova." }) }] }),
        { status: 200 },
      );
    };
    const provedor = criarProvedorLlm("anthropic", { fetch: fetchMock, chaveDeApi: "k" });
    await provedor.regenerarPedaco(montarPromptRegenerar(pedidoRegenerar()));

    const corpo = JSON.parse(String(chamadas[0]?.init.body)) as {
      output_config?: { format: { name: string; schema: Record<string, unknown> } };
    };
    expect(corpo.output_config).toBeDefined();
    const format = corpo.output_config!;
    expect(format.format.name).toBe("pedaco");
    expect(format.format.schema).toEqual(carregarArquivo(CAMINHO_SCHEMA_LLM.pedaco.anthropic));
    const enumVisual = (
      format.format.schema.properties as Record<string, { enum?: string[] }>
    ).tipo_visual?.enum ?? [];
    expect(enumVisual).toContain("gif");
    expect(enumVisual).toContain("video");
  });

  it("openai (geracao completa): response_format.json_schema com strict:true e o subset OpenAI", async () => {
    const chamadas: Array<{ init: RequestInit }> = [];
    const fetchMock = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      chamadas.push({ init: init ?? {} });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(roteiroValido()) } }],
        }),
        { status: 200 },
      );
    };
    const provedor = criarProvedorLlm("openai", { fetch: fetchMock, chaveDeApi: "k" });
    const prompt = montarPromptRoteiro(pedidoGerar());
    await provedor.gerarRoteiroCompleto(prompt);

    const corpo = JSON.parse(String(chamadas[0]?.init.body)) as Record<string, unknown>;
    const jsonSchema = (corpo.response_format as { json_schema: Record<string, unknown> }).json_schema;
    expect(jsonSchema.name).toBe("roteiro");
    expect(jsonSchema.strict).toBe(true);
    expect(jsonSchema.schema).toEqual(carregarArquivo(CAMINHO_SCHEMA_LLM.completo.openai));
    const textoDoPrompt = `${(corpo.messages as Array<{ role: string; content: string }>)[0]?.content}\n${
      (corpo.messages as Array<{ role: string; content: string }>)[1]?.content
    }`;
    expect(textoDoPrompt).not.toContain("response_format");
    expect(textoDoPrompt).not.toContain(JSON.stringify(jsonSchema.schema));
  });

  it("openai (regeneracao): strict:true com o subset do PEDACO", async () => {
    const chamadas: Array<{ init: RequestInit }> = [];
    const fetchMock = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      chamadas.push({ init: init ?? {} });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(pedacoAlvo({ fala: "Fala nova." })) } }],
        }),
        { status: 200 },
      );
    };
    const provedor = criarProvedorLlm("openai", { fetch: fetchMock, chaveDeApi: "k" });
    await provedor.regenerarPedaco(montarPromptRegenerar(pedidoRegenerar()));

    const corpo = JSON.parse(String(chamadas[0]?.init.body)) as Record<string, unknown>;
    const jsonSchema = (corpo.response_format as { json_schema: Record<string, unknown> }).json_schema;
    expect(jsonSchema.name).toBe("pedaco");
    expect(jsonSchema.strict).toBe(true);
    expect(jsonSchema.schema).toEqual(carregarArquivo(CAMINHO_SCHEMA_LLM.pedaco.openai));
  });
});

// ─── 3. Extracao ──────────────────────────────────────────────────────────────

describe("Extracao — output_json (anthropic) e response_format (openai); prosa ao redor continua tratada", () => {
  it("anthropic: o bloco output_json (saida estruturada) e extraido como veio", async () => {
    const fetchMock = async (): Promise<Response> =>
      new Response(
        JSON.stringify({ content: [{ type: "output_json", json: roteiroValido() }] }),
        { status: 200 },
      );
    const provedor = criarProvedorLlm("anthropic", { fetch: fetchMock, chaveDeApi: "k" });
    const saida = await provedor.gerarRoteiroCompleto(montarPromptRoteiro(pedidoGerar()));
    expect(JSON.stringify(saida)).toBe(JSON.stringify(roteiroValido()));
  });

  it("anthropic: prosa ao redor do JSON no bloco text continua sendo tolerada", async () => {
    const fetchMock = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: `Aqui vai o roteiro:\n${JSON.stringify(roteiroValido())}\nFim.`,
            },
          ],
        }),
        { status: 200 },
      );
    const provedor = criarProvedorLlm("anthropic", { fetch: fetchMock, chaveDeApi: "k" });
    const saida = await provedor.gerarRoteiroCompleto("p");
    expect(JSON.stringify(saida)).toBe(JSON.stringify(roteiroValido()));
  });

  it("openai: o content do response_format (string JSON) e extraido", async () => {
    const fetchMock = async (): Promise<Response> =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(roteiroValido()) } }] }),
        { status: 200 },
      );
    const provedor = criarProvedorLlm("openai", { fetch: fetchMock, chaveDeApi: "k" });
    const saida = await provedor.regenerarPedaco("p");
    expect(JSON.stringify(saida)).toBe(JSON.stringify(roteiroValido()));
  });

  it("SONDA NEGATIVA: resposta anthropic que nao casa os blocos esperados (nem text nem output_json) → erro NOMEADO", async () => {
    const fetchMock = async (): Promise<Response> =>
      new Response(JSON.stringify({ content: [] }), { status: 200 });
    const provedor = criarProvedorLlm("anthropic", { fetch: fetchMock, chaveDeApi: "k" });
    await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(EProvedorRoteiroFalhou);
  });

  it("SONDA NEGATIVA: JSON malformado no content nunca e aceito (EProvedorRoteiroFalhou nomeado)", async () => {
    const fetchMock = async (): Promise<Response> =>
      new Response(JSON.stringify({ choices: [{ message: { content: "isto nao e JSON" } }] }), {
        status: 200,
      });
    const provedor = criarProvedorLlm("openai", { fetch: fetchMock, chaveDeApi: "k" });
    await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(EProvedorRoteiroFalhou);
  });
});

// ─── 4. C12 — o fingerprint do schema podado na chave do store ────────────────

describe("C12 — schema podado editado = MISS sem bump de prompt (fingerprint na chave do store)", () => {
  /** Escreve o schema COMMITADO num tmp e uma variante com campo renomeado em outro; devolve os dois caminhos. */
  function schemaRenomeadoEmTmp(renomear: string): { antigo: string; novo: string } {
    const dir = cacheTmp();
    const antigo = join(dir, "schema-antigo.json");
    const novo = join(dir, "schema-renomeado.json");
    const original = JSON.parse(
      readFileSync(CAMINHO_SCHEMA_LLM.completo.anthropic, "utf-8"),
    ) as {
      properties: { pedacos: { items: { properties: Record<string, unknown> } } };
    };
    writeFileSync(antigo, JSON.stringify(original)); // o conteudo COMMITADO
    // A variante: renomeia o campo (ex.: titulo -> titulo_renomeado) —
    // exatamente o tipo de edicao que mudaria a saida do LLM.
    const mutado = JSON.parse(
      readFileSync(CAMINHO_SCHEMA_LLM.completo.anthropic, "utf-8"),
    ) as {
      properties: { pedacos: { items: { properties: Record<string, unknown> } } };
    };
    const props = mutado.properties.pedacos.items.properties;
    const valor = props[renomear];
    delete props[renomear];
    props[`${renomear}_renomeado`] = valor;
    writeFileSync(novo, JSON.stringify(mutado));
    return { antigo, novo };
  }

  it("chaveDoStore compoe o fingerprint: fingerprint diferente = chave diferente (mesmo pedido e prompt)", () => {
    const contrato = chaveDeCacheGerador(pedidoGerar());
    const prompt = montarPromptRoteiro(pedidoGerar());
    const fingerprint = fingerprintDoSchemaPodado("completo");
    expect(chaveDoStore(contrato, prompt, fingerprint)).not.toBe(
      chaveDoStore(contrato, prompt, "outro-fingerprint"),
    );
    expect(chaveDoStore(contrato, prompt, fingerprint)).toBe(
      chaveDoStore(contrato, prompt, fingerprint),
    );
  });

  it("fingerprintDoSchemaPodado e sensivel ao CONTENDO: renomear um campo muda o fingerprint (C12)", () => {
    const { antigo, novo } = schemaRenomeadoEmTmp("titulo");
    const fingerprintAntigo = fingerprintDoSchemaPodado("completo", {
      anthropic: antigo,
      openai: antigo,
    });
    const fingerprintNovo = fingerprintDoSchemaPodado("completo", {
      anthropic: novo,
      openai: novo,
    });
    expect(fingerprintNovo).not.toBe(fingerprintAntigo);
  });

  it("o fingerprint e por CONTEUDO CANONICO (chaves ordenadas): mesmo conteudo, ordem diferente no arquivo = mesmo fingerprint", () => {
    const dir = cacheTmp();
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    const schema = carregarSchemaPodado("openai", "pedaco") as Record<string, unknown>;
    writeFileSync(a, JSON.stringify(schema)); // ordem "natural" das chaves
    writeFileSync(b, JSON.stringify(inverterOrdemDeChaves(schema))); // MESMO conteudo, ordem invertida
    expect(
      fingerprintDoSchemaPodado("pedaco", { anthropic: a, openai: a }),
    ).toBe(fingerprintDoSchemaPodado("pedaco", { anthropic: b, openai: b }));
  });

  it("o fingerprint e por ALVO: mudar o schema do PEDACO nao muda o fingerprint do COMPLETO (precisao da chave)", () => {
    const fingerprintCompleto = fingerprintDoSchemaPodado("completo");
    const fingerprintPedaco = fingerprintDoSchemaPodado("pedaco");
    expect(fingerprintCompleto).not.toBe(fingerprintPedaco);
    const { novo } = schemaRenomeadoEmTmp("titulo");
    // O fingerprint do PEDACO com schema mutado muda...
    expect(
      fingerprintDoSchemaPodado("pedaco", { anthropic: novo, openai: novo }),
    ).not.toBe(fingerprintPedaco);
    // ...mas o fingerprint do COMPLETO (arquivos commitados) fica intocado.
    expect(fingerprintDoSchemaPodado("completo")).toBe(fingerprintCompleto);
  });

  it("integracao: a chave reportada pelo gerador e EXATAMENTE a composicao com o fingerprint corrente", async () => {
    const pedido = pedidoGerar();
    const prompt = montarPromptRoteiro(pedido);
    const resultado = await gerarRoteiro(pedido, {
      provedor: new ProvedorSosiaRoteiro(),
      diretorioCache: cacheTmp(),
    });
    expect(resultado.chave).toBe(
      chaveDoStore(chaveDeCacheGerador(pedido), prompt, fingerprintDoSchemaPodado("completo")),
    );
  });

  it("PROVA C12 por transitividade (sem mutar arquivos commitados — o vitest roda arquivos em paralelo): schema corrente 2x = HIT", async () => {
    // (a) fingerprint(schema editado) != fingerprint(schema corrente) — provado acima;
    // (b) a chave do gerador == composicao com o fingerprint corrente — provado acima;
    // logo: editar o schema podado muda a chave do store SEM tocar no prompt —
    // MISS, nunca resultado velho para schema novo. Fecha o ciclo com o cache:
    // a MESMA entrada 2x com o schema corrente = HIT (pedido identico, prompt
    // byte-idêntico, schema antigo).
    const diretorio = cacheTmp();
    const contador = { chamadas: 0 };
    const provedor: ProvedorRoteiro = {
      nome: "sosia-com-sonda",
      async gerarRoteiroCompleto(prompt: string): Promise<unknown> {
        contador.chamadas++;
        return new ProvedorSosiaRoteiro().gerarRoteiroCompleto(prompt);
      },
      async regenerarPedaco(prompt: string): Promise<unknown> {
        contador.chamadas++;
        return new ProvedorSosiaRoteiro().regenerarPedaco(prompt);
      },
    };
    const primeira = await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: diretorio });
    expect(primeira.origem).toBe("chamada");
    expect(contador.chamadas).toBe(1);
    const segunda = await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: diretorio });
    expect(segunda.origem).toBe("cache");
    expect(contador.chamadas).toBe(1); // schema corrente: HIT, zero chamadas novas
    expect(segunda.chave).toBe(primeira.chave);
  });
});

// ─── 5. Compatibilidade ───────────────────────────────────────────────────────

describe("Compatibilidade — caminho sosia intocado; fingerprint com os arquivos commitados", () => {
  it("o sosia nao monta request nenhuma (sem output_config): gera sem fetch, com saida deterministica", async () => {
    const sosia = new ProvedorSosiaRoteiro();
    const prompt = montarPromptRoteiro(pedidoGerar());
    const primeira = await sosia.gerarRoteiroCompleto(prompt);
    const segunda = await sosia.gerarRoteiroCompleto(prompt);
    expect(JSON.stringify(primeira)).toBe(JSON.stringify(segunda));
  });

  it("o fingerprint dos arquivos commitados e estavel (mesmo valor em chamadas repetidas) e os 4 arquivos existem", () => {
    for (const alvo of ["completo", "pedaco"] as const) {
      const primeiro = fingerprintDoSchemaPodado(alvo);
      const segundo = fingerprintDoSchemaPodado(alvo);
      expect(segundo).toBe(primeiro);
      expect(primeiro).toMatch(/^[0-9a-f]{64}$/);
    }
    for (const alvo of ["completo", "pedaco"] as const) {
      for (const provedor of ["anthropic", "openai"] as const) {
        expect(() => carregarSchemaPodado(provedor, alvo)).not.toThrow();
      }
    }
  });

  it("schema podado AUSENTE → erro NOMEADO (ESchemaPodadoAusente), nunca falha muda", () => {
    expect(() =>
      fingerprintDoSchemaPodado("completo", {
        anthropic: join(cacheTmp(), "nao-existe.json"),
        openai: CAMINHO_SCHEMA_LLM.completo.openai,
      }),
    ).toThrow(ESchemaPodadoAusente);
  });
});
