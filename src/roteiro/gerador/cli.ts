/**
 * src/roteiro/gerador/cli.ts
 *
 * O CLI do gerador de roteiro — a convencao D11 (docs/roteiro/api.md
 * §"CLIs de operacao pesada"): o servidor da Onda 4/5 chama este
 * executavel via child-process, nunca o gerador em processo.
 *
 * Contrato:
 *   - Entrada: JSON em stdin — um PedidoGerarRoteiro OU um
 *     PedidoRegenerarPedaco (a presenca de `pedaco_atual` decide a
 *     operacao), com as `versao_*` preenchidas pelo servidor;
 *   - Saida: JSON em stdout — o Roteiro completo ou o Pedaco regenerado
 *     (a saida JSON e SO sucesso);
 *   - Progresso: arquivo de estado reescrito atomicamente (tmp+rename,
 *     S-8) a cada avanco — caminho por `--estado <path>` ou env
 *     `ROTEIRO_ESTADO_PATH`; o poll do servidor rele o arquivo;
 *   - Provedor: `--provedor <nome>` ou env `ROTEIRO_PROVEDOR`
 *     (sosia | cassete | llm-anthropic | llm-openai; default: sosia —
 *     o unico sem rede e sem credencial, e o que o e2e da Onda 7 usa);
 *   - Exit codes: 0 = sucesso; 2 = entrada/uso invalidos (JSON
 *     malformado, pedido invalido, flag desconhecida); 1 = falha de
 *     geracao (provedor falhou, saida invalida, cassete ausente). Erro
 *     SEMPRE com a mensagem no stderr (envelope JSON do api.md).
 */

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ErroContratoRoteiro } from "../contrato/rejeitar.js";
import {
  validarPedidoGerarRoteiro,
  validarPedidoRegenerarPedaco,
} from "../contrato/validar.js";
import {
  criarProvedorRoteiroPorNome,
  EProvedorDesconhecido,
  EProvedorRoteiroFalhou,
  ECasseteRoteiroAusente,
  ECasseteRoteiroInvalido,
} from "./provedor.js";
import { gerarRoteiro, regenerarPedaco } from "./gerador.js";
import type { OpcoesGeradorRoteiro } from "./gerador.js";

/** Estados possiveis do arquivo de progresso (JobStatus sem id/artefato). */
interface EstadoDeProgresso {
  tipo: "gerar-roteiro" | "regenerar-pedaco";
  estado: "pendente" | "rodando" | "ok" | "erro";
  progresso: number | null;
  mensagem: string;
  erro: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Escreve o arquivo de estado atomicamente (tmp + rename, S-8). */
function escreverEstado(caminho: string | undefined, estado: EstadoDeProgresso): void {
  if (caminho === undefined) {
    return;
  }
  mkdirSync(dirname(caminho), { recursive: true });
  const temporario = `${caminho}.tmp-${process.pid}`;
  writeFileSync(temporario, JSON.stringify(estado), "utf-8");
  renameSync(temporario, caminho);
}

/** Le o stdin inteiro (a entrada JSON do pedido). */
function lerStdin(): Promise<string> {
  return new Promise((resolve, rejeitar) => {
    let dados = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (parte: string) => {
      dados += parte;
    });
    process.stdin.on("end", () => resolve(dados));
    process.stdin.on("error", rejeitar);
  });
}

/** Envelope de erro do api.md, no stderr. */
function reportarErro(codigo: string, mensagem: string, detalhes: string[] = []): void {
  const envelope = { erro: { codigo, mensagem, detalhes } };
  process.stderr.write(`${JSON.stringify(envelope)}\n`);
}

interface OpcoesCli {
  caminhoEstado?: string;
  provedor?: string;
  raizCassetes?: string;
}

/** Parseia os argumentos: --estado <path> | --provedor <nome> | --raiz-cassetes <path> | --help. */
function parsearArgumentos(argv: readonly string[]): { opcoes: OpcoesCli; ajuda: boolean } {
  const opcoes: OpcoesCli = {};
  let ajuda = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      ajuda = true;
      continue;
    }
    if (arg === "--estado") {
      const valor = argv[i + 1];
      if (valor === undefined || valor.startsWith("--")) {
        throw new ErroDeUso("--estado exige um caminho de arquivo");
      }
      opcoes.caminhoEstado = valor;
      i++;
      continue;
    }
    if (arg === "--provedor") {
      const valor = argv[i + 1];
      if (valor === undefined || valor.startsWith("--")) {
        throw new ErroDeUso("--provedor exige um nome (sosia | cassete | llm-anthropic | llm-openai)");
      }
      opcoes.provedor = valor;
      i++;
      continue;
    }
    if (arg === "--raiz-cassetes") {
      const valor = argv[i + 1];
      if (valor === undefined || valor.startsWith("--")) {
        throw new ErroDeUso("--raiz-cassetes exige um caminho");
      }
      opcoes.raizCassetes = valor;
      i++;
      continue;
    }
    throw new ErroDeUso(`argumento desconhecido: ${arg} (use --help)`);
  }
  return { opcoes, ajuda };
}

/** Erro de uso do CLI (exit 2). */
class ErroDeUso extends Error {}

const TEXTO_DE_AJUDA = `CLI do gerador de roteiro (D11 — docs/roteiro/api.md).

Uso:
  npx tsx src/roteiro/gerador/cli.ts [--estado <path>] [--provedor <nome>] [--raiz-cassetes <path>]

Entrada: JSON em stdin — PedidoGerarRoteiro (gera o roteiro completo) ou
PedidoRegenerarPedaco (regenera UM pedaco; a presenca de "pedaco_atual"
decide a operacao), com as versoes do contrato preenchidas.

Saida: JSON em stdout — o Roteiro ou o Pedaco. A saida JSON e so sucesso.

Progresso: arquivo reescrito a cada avanco, atomico (S-8):
  --estado <path>   ou   ROTEIRO_ESTADO_PATH

Provedor: --provedor <nome> ou ROTEIRO_PROVEDOR:
  sosia (default) | cassete | llm-anthropic | llm-openai
Raiz dos cassetes (so para o provedor cassete): --raiz-cassetes <path>
ou RAIZ_CASSETES (default: fixtures/cassetes).

Exit codes: 0 = sucesso; 2 = entrada/uso invalidos; 1 = falha de geracao.
Erro sempre no stderr (envelope JSON: { "erro": { "codigo", "mensagem" } }).
`;

/** Monta as opcoes do gerador a partir do CLI (provedor por nome). */
function montarOpcoesDoGerador(opcoesCli: OpcoesCli): OpcoesGeradorRoteiro {
  const provedorNome = opcoesCli.provedor ?? process.env.ROTEIRO_PROVEDOR ?? "sosia";
  const provedor = criarProvedorRoteiroPorNome(provedorNome, {
    raizCassetes: opcoesCli.raizCassetes ?? process.env.RAIZ_CASSETES,
  });
  return { provedor };
}

/**
 * O ponto de entrada do CLI. Nunca lanca: toda falha vira envelope no
 * stderr + exit code (0 | 1 | 2) — o servidor le os dois.
 */
export async function principal(): Promise<number> {
  let opcoes: OpcoesCli;
  let ajuda: boolean;
  try {
    ({ opcoes, ajuda } = parsearArgumentos(process.argv.slice(2)));
  } catch (erro) {
    if (erro instanceof ErroDeUso) {
      reportarErro("uso-invalido", erro.message);
      return 2;
    }
    throw erro;
  }
  if (ajuda) {
    process.stdout.write(TEXTO_DE_AJUDA);
    return 0;
  }
  const caminhoEstado = opcoes.caminhoEstado ?? process.env.ROTEIRO_ESTADO_PATH;
  const agora = new Date().toISOString();

  let entradaBruta: string;
  try {
    entradaBruta = await lerStdin();
  } catch (erro) {
    reportarErro("entrada-invalida", `falha ao ler stdin: ${(erro as Error).message}`);
    return 2;
  }

  /** Estado terminal de ERRO para entradas rejeitadas na porta (o poll
   *  do servidor precisa ver o terminal, nunca o arquivo ausente). */
  const estadoDeErro = (mensagem: string): void => {
    escreverEstado(caminhoEstado, {
      tipo: "gerar-roteiro",
      estado: "erro",
      progresso: 1,
      mensagem: "Entrada invalida.",
      erro: mensagem,
      criado_em: agora,
      atualizado_em: new Date().toISOString(),
    });
  };

  let pedido: Record<string, unknown>;
  try {
    pedido = JSON.parse(entradaBruta) as Record<string, unknown>;
  } catch (erro) {
    estadoDeErro(`stdin nao e JSON valido: ${(erro as Error).message}`);
    reportarErro("entrada-invalida", `stdin nao e JSON valido: ${(erro as Error).message}`);
    return 2;
  }
  if (pedido === null || typeof pedido !== "object" || Array.isArray(pedido)) {
    estadoDeErro("stdin precisa ser um objeto JSON (o pedido)");
    reportarErro("entrada-invalida", "stdin precisa ser um objeto JSON (o pedido)");
    return 2;
  }

  const regeneracao = "pedaco_atual" in pedido;
  const tipo: "gerar-roteiro" | "regenerar-pedaco" = regeneracao
    ? "regenerar-pedaco"
    : "gerar-roteiro";

  // GATE do pedido AQUI (exit 2): pedido invalido e ERRO DE ENTRADA, nao
  // de geracao. O gerador revalida de qualquer forma (segunda linha de
  // defesa para chamadas de biblioteca); o CLI distingue os exit codes.
  const validacao = regeneracao
    ? validarPedidoRegenerarPedaco(pedido)
    : validarPedidoGerarRoteiro(pedido);
  if (!validacao.valido) {
    estadoDeErro("pedido nao valida contra o contrato");
    reportarErro("pedido-invalido", "pedido nao valida contra o contrato", validacao.problemas);
    return 2;
  }

  const estado: EstadoDeProgresso = {
    tipo,
    estado: "rodando",
    progresso: 0.05,
    mensagem: regeneracao ? "Validando pedido de regeneracao..." : "Validando pedido de geracao...",
    erro: null,
    criado_em: agora,
    atualizado_em: agora,
  };
  escreverEstado(caminhoEstado, estado);

  let opcoesGerador: OpcoesGeradorRoteiro;
  try {
    opcoesGerador = montarOpcoesDoGerador(opcoes);
  } catch (erro) {
    estado.estado = "erro";
    estado.progresso = 1;
    estado.erro = (erro as Error).message;
    estado.atualizado_em = new Date().toISOString();
    escreverEstado(caminhoEstado, estado);
    reportarErro("configuracao-invalida", (erro as Error).message);
    return 2;
  }

  try {
    estado.progresso = 0.3;
    estado.mensagem = regeneracao ? "Regenerando o pedaco..." : "Gerando o roteiro...";
    estado.atualizado_em = new Date().toISOString();
    escreverEstado(caminhoEstado, estado);

    if (regeneracao) {
      const resultado = await regenerarPedaco(
        pedido as never,
        opcoesGerador,
      );
      estado.progresso = 0.95;
      estado.mensagem = "Validando o pedaco regenerado...";
      estado.atualizado_em = new Date().toISOString();
      escreverEstado(caminhoEstado, estado);
      process.stdout.write(`${JSON.stringify(resultado.pedaco)}\n`);
    } else {
      const resultado = await gerarRoteiro(
        pedido as never,
        opcoesGerador,
      );
      estado.progresso = 0.95;
      estado.mensagem = "Validando o roteiro...";
      estado.atualizado_em = new Date().toISOString();
      escreverEstado(caminhoEstado, estado);
      process.stdout.write(`${JSON.stringify(resultado.roteiro)}\n`);
    }

    estado.estado = "ok";
    estado.progresso = 1;
    estado.mensagem = regeneracao ? "Pedaco regenerado." : "Roteiro gerado.";
    estado.atualizado_em = new Date().toISOString();
    escreverEstado(caminhoEstado, estado);
    return 0;
  } catch (erro) {
    const codigo = erro instanceof ErroContratoRoteiro
      ? "saida-invalida"
      : erro instanceof EProvedorRoteiroFalhou
        ? "provedor-falhou"
        : erro instanceof ECasseteRoteiroAusente || erro instanceof ECasseteRoteiroInvalido
          ? "cassete-ausente"
          : "geracao-falhou";
    const detalhes = erro instanceof ErroContratoRoteiro ? erro.problemas : [];
    estado.estado = "erro";
    estado.progresso = 1;
    estado.erro = (erro as Error).message;
    estado.atualizado_em = new Date().toISOString();
    escreverEstado(caminhoEstado, estado);
    reportarErro(codigo, (erro as Error).message, detalhes);
    return 1;
  }
}

// Execucao direta (npx tsx src/roteiro/gerador/cli.ts): o servidor da
// Onda 4 le o exit code. A guarda protege a importacao por testes
// (os testes chamam principal() direto com stdin/escreverEstado stub).
if (process.argv[1]?.endsWith("cli.ts")) {
  principal()
    .then((codigo) => {
      process.exitCode = codigo;
    })
    .catch((erro) => {
      reportarErro("erro-interno", (erro as Error).message);
      process.exitCode = 1;
    });
}
