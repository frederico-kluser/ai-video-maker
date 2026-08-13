#!/usr/bin/env npx tsx
/**
 * src/autoria/executor/gravar-cassete.ts
 *
 * A CERIMONIA DE GRAVACAO do cassete de autoria — roda a mao, com rede
 * e credencial (o mesmo espirito do modo "gravacao" do orquestrador
 * F2-01: nunca em suite, nunca em CI).
 *
 * Passos:
 *   1. le o brief canonico (fixtures/cassetes/autoria/brief-canonico.json)
 *      e o manifesto canonico (fixtures/canonico/manifesto-valido.json —
 *      o cassete grava CONTRA o mesmo manifesto que o resto do pipeline
 *      usa, contrato-w6 §12);
 *   2. executa o executor de verdade (chamarAutoria) com o fetch real
 *      instrumentado pelo GravadorDeChamadas do F2-01;
 *   3. escreve o diretorio de cassete (fixtures/cassetes/autoria/<chave>/)
 *      com cassete.json, resultado.json, procedencia.json, chamadas.json,
 *      corpos/, volatil.json e invalidos.json (a fonte dos manifestos
 *      invalidos gravados — ∅-crit deste card);
 *   4. o gate (rejeitarSaidaInvalida) roda DENTRO do executor: um
 *      documento invalido vindo do provedor nao chega ao disco.
 *
 * Provedor:
 *   --provedor openai    (default) usa OPENAI_API_KEY do ambiente.
 *   --provedor anthropic sem credencial grava do SOSIA (resposta
 *                        canonica montada a mao, registrada em
 *                        procedencia.notas) — o mesmo papel do
 *                        sosia-local dos cassetes da W4.
 *
 * Uso:
 *   npx tsx src/autoria/executor/gravar-cassete.ts [--provedor openai|anthropic]
 *   npx tsx src/autoria/executor/gravar-cassete.ts --sosia-openai
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GravadorDeChamadas } from "../../resolucao/cassete/gravador.js";
import type { Manifesto } from "../../contratos/manifesto.js";
import { chamarAutoria } from "./executor.js";
import {
  gravarCasseteAutoria,
  RAIZ_CASSETES_PADRAO,
} from "./cassete.js";
import type { ManifestoInvalidoGravado } from "./cassete.js";
import type { ProcedenciaCassete } from "../../resolucao/cassete/formato.js";
import type { ProvedorAutoria } from "./contrato.js";
import type { BriefAutoria } from "./contrato.js";

const RAIZ = process.cwd();

function lerJson<T>(caminho: string): T {
  return JSON.parse(readFileSync(caminho, "utf-8")) as T;
}

const BRIEF_CANONICO = lerJson<BriefAutoria>(
  join(RAIZ, "fixtures", "cassetes", "autoria", "brief-canonico.json"),
);

const MANIFESTO_CANONICO = lerJson<Manifesto>(
  join(RAIZ, "fixtures", "canonico", "manifesto-valido.json"),
);

const INVALIDOS = lerJson<ManifestoInvalidoGravado[]>(
  join(RAIZ, "fixtures", "cassetes", "autoria", "invalidos-fonte.json"),
);

/**
 * O documento de autoria de REFERENCIA — a narrativa exata da fixture
 * canonica (manifesto-valido.json), projetada no Autoria.1: mesmos nos,
 * mesmos textos, mesmas cenas e locucoes; sem frame, sem layout, sem
 * cor (o sistema decide; AB-550). E o corpo da resposta SOSIA do
 * provedor anthropic (sem credencial) e o alvo de comparacao do replay
 * offline.
 */
export const DOCUMENTO_AUTORIA_CANONICO = {
  schema_version: "Autoria.1",
  nos: [
    {
      id: "n-001",
      schema: "Cabecalho.1",
      type: "cabecalho",
      texto: "Editor de Vídeo IA — Pipeline Declarativo",
      subtitulo: "Da ideia ao frame final, sem edição manual",
    },
    {
      id: "n-002",
      schema: "Texto.1",
      type: "texto",
      texto:
        "O pipeline converte um manifesto JSON em vídeo renderizado. Cada nó visual é uma unidade atômica com tipo, duração e animação independentes.",
      destaque: true,
    },
    {
      id: "n-003",
      schema: "Lista.1",
      type: "lista",
      itens: [
        "Cabeçalho: título e subtítulo com alinhamento configurável",
        "Texto: corpo com destaque opcional e animação de entrada",
        "Lista: itens ordenados ou não, com bullets automáticos",
      ],
      ordenada: false,
    },
    {
      id: "n-004",
      schema: "Lista.1",
      type: "lista",
      itens: [
        "Primeiro passo: definir o manifesto",
        "Segundo passo: validar contra o schema",
        "Terceiro passo: resolver timeline",
        "Quarto passo: renderizar com Remotion",
      ],
      ordenada: true,
    },
    {
      id: "n-005",
      schema: "Midia.1",
      type: "midia",
      tipo_midia: "imagem",
      texto_alternativo:
        "Diagrama do pipeline de renderização mostrando as etapas: manifesto → validação → timeline → Remotion → vídeo",
    },
    {
      id: "n-006",
      schema: "Midia.1",
      type: "midia",
      tipo_midia: "video",
      texto_alternativo:
        "Demonstração curta do editor em ação: uma cena com transição slide entre dois nós de texto",
    },
    {
      id: "n-007",
      schema: "Midia.1",
      type: "midia",
      tipo_midia: "gif",
      texto_alternativo:
        "Animação mostrando a interface do editor montando uma cena a partir de nós de texto",
    },
    {
      id: "n-008",
      schema: "Codigo.1",
      type: "codigo",
      codigo:
        "export const VideoEditor: React.FC<{ manifesto: Manifesto }> = ({ manifesto }) => {\n  return manifesto.cenas.map((cena) => (\n    <Sequence key={cena.id}>\n      {cena.nos.map((nodeId) => renderNode(nodeId))}\n    </Sequence>\n  ));\n};",
      linguagem: "typescript",
      linhas_destaque: [1, 3, 5],
    },
    {
      id: "n-009",
      schema: "Grafico.1",
      type: "grafico",
      tipo_grafico: "barras",
      titulo: "Tempo de Render por Tipo de Nó (ms)",
      dados: [
        { rotulo: "Cabeçalho", valor: 45 },
        { rotulo: "Texto", valor: 32 },
        { rotulo: "Lista", valor: 78 },
        { rotulo: "Mídia", valor: 210 },
        { rotulo: "Código", valor: 156 },
        { rotulo: "Gráfico", valor: 95 },
      ],
    },
    {
      id: "n-010",
      schema: "Grafico.1",
      type: "grafico",
      tipo_grafico: "linha",
      titulo: "Evolução do Tempo Total de Render",
      dados: [
        { rotulo: "Dia 1", valor: 1200 },
        { rotulo: "Dia 2", valor: 980 },
        { rotulo: "Dia 3", valor: 750 },
        { rotulo: "Dia 4", valor: 620 },
        { rotulo: "Dia 5", valor: 510 },
      ],
    },
    {
      id: "n-011",
      schema: "Grafico.1",
      type: "grafico",
      tipo_grafico: "pizza",
      titulo: "Distribuição de Tipos de Nó",
      dados: [
        { rotulo: "Texto", valor: 35 },
        { rotulo: "Cabeçalho", valor: 20 },
        { rotulo: "Mídia", valor: 15 },
        { rotulo: "Código", valor: 15 },
        { rotulo: "Gráfico", valor: 10 },
        { rotulo: "Lista", valor: 5 },
      ],
    },
    {
      id: "n-012",
      schema: "Grafico.1",
      type: "grafico",
      tipo_grafico: "area",
      dados: [
        { rotulo: "Jan", valor: 100 },
        { rotulo: "Fev", valor: 200 },
        { rotulo: "Mar", valor: 150 },
      ],
    },
    {
      id: "n-013",
      schema: "Grafico.1",
      type: "grafico",
      tipo_grafico: "dispersao",
      dados: [
        { rotulo: "A", valor: 1.5 },
        { rotulo: "B", valor: 3.2 },
        { rotulo: "C", valor: 2.8 },
      ],
    },
    {
      id: "n-014",
      schema: "Texto.1",
      type: "texto",
      texto:
        "O manifesto é a fonte única de verdade. Um arquivo JSON versionado por objeto, validado contra JSON Schema 2020-12, com subset para LLM. A timeline resolvida é gerada deterministicamente a partir das âncoras absolutas — nunca somando durações.",
      destaque: false,
    },
    {
      id: "n-015",
      schema: "Cabecalho.1",
      type: "cabecalho",
      texto: "Fim",
    },
  ],
  cenas: [
    {
      id: "c-001",
      nos: ["n-001"],
    },
    {
      id: "c-002",
      nos: ["n-002", "n-003"],
    },
    {
      id: "c-003",
      nos: ["n-005", "n-008", "n-004"],
    },
    {
      id: "c-004",
      nos: ["n-009", "n-010", "n-011", "n-012", "n-013"],
      audio_cena: {
        texto_locucao:
          "Nesta seção, apresentamos os dados de desempenho do pipeline. Cada tipo de nó tem características de renderização distintas.",
      },
    },
    {
      id: "c-005",
      nos: ["n-014", "n-006", "n-007", "n-015"],
      audio_cena: {
        texto_locucao:
          "Concluindo, o manifesto é a peça central do pipeline. Obrigado por assistir.",
      },
    },
  ],
  audio: {
    trilha_sonora: "trilha instrumental discreta, volume baixo",
  },
} as const;

/**
 * O envelope de resposta do SOSIA anthropic — a forma da API real
 * (output_config.format devolve blocos content[] com type "output_json"
 * e campo `json`), com o documento canonico dentro. A extracao do
 * executor roda por cima e o replay offline exercita o mesmo caminho.
 */
export const ENVELOPE_SOSIA_ANTHROPIC = {
  id: "msg_sosia_local_f4_04",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-4-5",
  content: [
    {
      type: "output_json",
      name: "documento_autoria",
      json: DOCUMENTO_AUTORIA_CANONICO,
    },
  ],
  stop_reason: "end_turn",
  usage: { input_tokens: 1250, output_tokens: 940 },
} as const;

/** `fetch` sosia: devolve o envelope canonico para qualquer chamada. */
export function fetchSosia(envelope: unknown): typeof fetch {
  return async function sosia(
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> {
    return new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

function procedencia(provedor: ProvedorAutoria, notas: string): ProcedenciaCassete {
  return {
    licenca:
      "Termos de uso do provedor de modelo de lingua (uso pessoal — ADR-0003; AB-950). Texto gerado por modelo; o projeto nao o redistribui.",
    provedor: provedor === "openai" ? "openai" : "sosia-local",
    ferramenta: "executor-de-autoria 1.0.0",
    assets: [],
    notas,
  };
}

function argumento(nome: string): boolean {
  return process.argv.includes(nome);
}

async function principal(): Promise<void> {
  const sosiaOpenAI = argumento("--sosia-openai");
  const provedorArg = process.argv[process.argv.indexOf("--provedor") + 1];
  const provedor: ProvedorAutoria = (provedorArg as ProvedorAutoria) ?? "openai";

  const gravador = new GravadorDeChamadas(
    provedor === "anthropic" || sosiaOpenAI
      ? fetchSosia(ENVELOPE_SOSIA_ANTHROPIC)
      : globalThis.fetch,
  );

  const chaveDeApi =
    provedor === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;

  const resultado = await chamarAutoria(provedor, BRIEF_CANONICO, {
    fetch: gravador.fetch,
    chaveDeApi,
  });

  const notas =
    provedor === "openai"
      ? sosiaOpenAI
        ? "Gravado do SOSIA (sem credencial utilizavel no dia) — documento de referencia montado a mao com a narrativa da fixture canonica. Regravar com OPENAI_API_KEY grava a resposta real."
        : "Gravado com chamada REAL ao provedor (OPENAI_API_KEY, dia do card F4-04). A resposta foi gravada como veio (sosia, nao sucessor)."
      : "Sem ANTHROPIC_API_KEY no dia do card: gravado do SOSIA (envelope montado a mao na forma da API real). AB-552 fica PENDENTE — evidencia com credencial, nunca gate.";

  const { chave, diretorio } = gravarCasseteAutoria({
    raiz: RAIZ_CASSETES_PADRAO,
    documento: resultado.documento,
    entrada: resultado.entrada,
    provedor,
    maxTokens: 4096,
    manifesto: MANIFESTO_CANONICO,
    chamadas: gravador.gravadas,
    corpos: gravador.corpos,
    procedencia: procedencia(provedor, notas),
    invalidos: INVALIDOS,
    preservarInvalidos: true,
  });

  console.log(`cassete de autoria (${provedor}): ${diretorio}`);
  console.log(`  chave: ${chave}`);
  console.log(`  origem: ${resultado.origem}`);
  console.log(`  chamadas gravadas: ${gravador.gravadas.length}`);
  console.log(`  manifestos invalidos gravados: ${INVALIDOS.length}`);
  console.log(`  documento: ${JSON.stringify(resultado.documento).slice(0, 120)}…`);
}

if (process.argv[1]?.endsWith("gravar-cassete.ts")) {
  void principal();
}
