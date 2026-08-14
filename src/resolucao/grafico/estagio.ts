/**
 * src/resolucao/grafico/estagio.ts
 *
 * Estagio de resolucao `grafico` — Manim headless. Card F2-02 (W4).
 *
 * Contrato: `docs/contrato-estagio-resolucao.md` (F2-01).
 * Quirks absorvidos do 3blue1brown: `docs/reuso-3b1b.md` + ADR-0004, com a
 * implementacao e as citacoes `arquivo:linha` em
 * `src/resolucao/grafico/manim/quirks.py`.
 * Decisoes deste card: `docs/adr/0009-estagio-grafico-manim.md`.
 *
 * O que o estagio faz, em ordem:
 *
 *   1. seleciona os nos `grafico` do manifesto, em ordem lexicografica de id;
 *   2. gera a cena Manim de cada um (`cena.ts`) — funcao pura;
 *   3. entrega ao motor grafico (`executor.ts`), que sanea (quirks), valida,
 *      renderiza headless e devolve o SHA-256 do arquivo produzido;
 *   4. devolve `nos_grafico` + `assets` + procedencia com licenca.
 *
 * O que ele NAO faz, e cada "nao" e uma decisao:
 *
 *   - nao chama a rede. `entrada.fetch` existe e nao e usado: o Manim e um
 *     processo local. `chamadas.json` do cassete sai vazio, e isso e o
 *     retrato fiel da execucao;
 *   - nao conserta nada que venha do motor. Todo saneamento acontece na
 *     ENTRADA (o codigo da cena), antes do subprocesso. Se o estagio
 *     corrigisse a saida, o cassete gravado seria um sucessor da execucao
 *     real, e nao um sosia dela;
 *   - nao degrada quando o Manim falta. `EMotorGraficoAusente` interrompe;
 *   - nao grava `adquiridoEm`. `EntradaEstagio` nao oferece relogio
 *     injetavel, e ler `Date.now()` aqui poria uma fonte de nao-determinismo
 *     dentro do estagio para preencher um campo que a auditoria ja tem em
 *     `volatil.json`. Item de ledger AB-391.
 *
 * DEPENDENCIAS DO RENDER (so a GRAVACAO do cassete, nunca a suite):
 *
 *   - Manim CE 0.20.1 + PyAV, num interpretador Python. O executor aceita
 *     `PYTHON_BIN` / `MANIM_BIN` (ver executor.ts e runner.py) e exige as
 *     versoes declaradas em PARAMETROS_GRAFICO — divergencia e erro, nunca
 *     aviso (C12: a versao do gerador e o muxer vao dentro dos bytes do
 *     video e mudam o hash do asset em silencio).
 *   - LaTeX/TinyTeX no PATH do subprocesso: as equacoes MathTex (todas as
 *     cinco cenas de cena.ts) sao compiladas por `latex`/`dvipng`. Neste
 *     ambiente de desenvolvimento, o venv do projeto 3blue1brown tem o
 *     Manim (`/home/ondokai/Projects/3blue1brown/manim-api/venv/bin/python`)
 *     e o TinyTeX vive em `~/.TinyTeX/bin/x86_64-linux` — e com esses dois
 *     que o cassete e gravado (gravar.ts, `just res-grafico-gravar`).
 *     Falta de LaTeX nao e "video sem equacao": o render falha e o cassete
 *     anterior fica intacto.
 */

import {
  isNoGrafico,
  type Manifesto,
  type NoGrafico,
} from "../../contratos/manifesto.js";
import type {
  EntradaEstagio,
  EstagioResolucao,
  ParametrosEstagio,
  SaidaEstagio,
} from "../contrato.js";
import type { AssetResolvido, Sha256 } from "../manifesto-resolvido.js";
import type {
  ProcedenciaAsset,
  ProcedenciaCassete,
} from "../cassete/formato.js";
import { gerarCenaManim } from "./cena.js";
import {
  ExecutorManimSubprocesso,
  type ExecutorManim,
  type FormatoDeVideo,
  type ResultadoDeRender,
} from "./executor.js";

// ─── Constantes declaradas ──────────────────────────────────────────────────────

/**
 * Licenca do que este estagio produz.
 *
 * O video e gerado localmente a partir dos dados do manifesto: nao ha asset
 * de terceiro dentro dele. O Manim CE e MIT, mas isso e a licenca da
 * FERRAMENTA, nao da saida — um compilador GPL nao torna GPL o binario. Por
 * isso `CC0-1.0` (nossa saida, sem restricao) e `ferramenta: "manim <ver>"`
 * como registro separado.
 */
export const LICENCA_DA_SAIDA = "CC0-1.0";

/** Provedor, no vocabulario da procedencia do cassete. */
export const PROVEDOR = "local";

/** MIME por formato. */
const MIME_POR_FORMATO: Record<FormatoDeVideo, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/**
 * Parametros do estagio: tudo que muda a saida e NAO esta no manifesto.
 *
 * `fps`, `width` e `height` NAO estao aqui de proposito: eles vem do
 * manifesto e ja entram na chave via `hashManifesto`. Declara-los duas vezes
 * criaria duas fontes de verdade para o mesmo numero.
 *
 * `versaoMuxer` esta aqui porque foi MEDIDO que precisa estar: o container
 * produzido carrega a tag `encoder=Lavf62.12.102`, entao o hash do asset
 * muda quando a libavformat do PyAV muda — sem que nada no codigo mude.
 * Omitir isso e o modo de falha C12 na forma mais silenciosa possivel. O
 * runner recusa renderizar se o muxer local divergir do declarado aqui.
 */
export const PARAMETROS_GRAFICO = {
  versaoManim: "0.20.1",
  versaoMuxer: "Lavf62.12.102",
  // Cairo fixo: a deteccao automatica de GPU do projeto de origem roda a cada
  // render, sem cache, custando ate 3 spawns de subprocesso
  // (docs/reuso-3b1b.md item 2.17, IGNORAR).
  renderer: "cairo",
  formato: "webm",
  // Cartucho webm (F2-02, estagio de resolucao de grafico): o `.mov`
  // qtrle/argb do default anterior tinha alfa mas o navegador do render do
  // Remotion NAO o reproduz (F1-12 marcou video/quicktime
  // reproduzivelNoNavegador:false e o render integrado recusou de proposito).
  // Medido na regravacao do cassete (2026-08-13): `-t --format=webm` no
  // Manim 0.20.1 + PyAV 18 produz VP9 **yuv420p** — o alfa e descartado
  // (libvpx-vp9 desta cadeia nao carrega canal alfa; verificado com ffprobe
  // e decodificacao PyAV). O navegador reproduz webm; o alfa e uma pergunta
  // em aberto (AB-390).
  fundoTransparente: true,
} as const satisfies ParametrosEstagio;

// ─── Montagem do estagio ────────────────────────────────────────────────────────

/** Opcoes de construcao. O executor e injetavel so para teste e gravacao. */
export interface OpcoesDoEstagioGrafico {
  readonly executor?: ExecutorManim;
  readonly versao?: string;
}

/** Nos `grafico` do manifesto, em ordem lexicografica de id. */
export function nosDeGrafico(manifesto: Manifesto): NoGrafico[] {
  return manifesto.nos
    .filter(isNoGrafico)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Constroi o estagio.
 *
 * A fabrica existe para que os testes injetem um executor; `export default`
 * abaixo constroi a instancia real, e e ela que a descoberta por convencao
 * (AGENTS.md Regra 6) encontra.
 */
export function criarEstagioGrafico(
  opcoes: OpcoesDoEstagioGrafico = {},
): EstagioResolucao {
  const executor = opcoes.executor ?? new ExecutorManimSubprocesso();

  return {
    identidade: { nome: "grafico", versao: opcoes.versao ?? "1.2.1" },
    parametros: PARAMETROS_GRAFICO,

    async resolver(entrada: EntradaEstagio): Promise<SaidaEstagio> {
      const formato = String(entrada.parametros["formato"] ?? "webm") as FormatoDeVideo;
      const assets: Record<Sha256, AssetResolvido> = {};
      const nosGrafico: Record<string, Sha256> = {};
      const procedenciaAssets: ProcedenciaAsset[] = [];
      const correcoes: string[] = [];

      // Dois nos com o MESMO tipo_grafico recebem cenas matematicas distintas:
      // a lista e processada em ordem lexicografica de id (nosDeGrafico), e o
      // ordinal do no entre os do mesmo tipo desloca a escolha no catalogo
      // (cena.ts — cenaMatematicaDoNo). Deterministico por construcao.
      const contagemPorTipo = new Map<string, number>();
      for (const no of nosDeGrafico(entrada.manifesto)) {
        const deslocamento = contagemPorTipo.get(no.tipo_grafico) ?? 0;
        contagemPorTipo.set(no.tipo_grafico, deslocamento + 1);
        const cena = gerarCenaManim(
          no,
          {
            fps: entrada.manifesto.fps,
            larguraPx: entrada.manifesto.width,
            alturaPx: entrada.manifesto.height,
          },
          { deslocamentoEntreIguais: deslocamento },
        );

        const render: ResultadoDeRender = await executor.renderizar({
          codigo: cena.fonte,
          larguraPx: entrada.manifesto.width,
          alturaPx: entrada.manifesto.height,
          fps: entrada.manifesto.fps,
          formato,
          fundoTransparente: Boolean(entrada.parametros["fundoTransparente"]),
          versaoManim: String(entrada.parametros["versaoManim"]),
          versaoMuxer: String(entrada.parametros["versaoMuxer"]),
          diretorioTrabalho: entrada.diretorioTrabalho,
        });

        // O hash vem do motor e atravessa intacto. Nenhuma normalizacao,
        // nenhum "arredonda para o que a gente esperava".
        assets[render.hash] = {
          hash: render.hash,
          tipo: "video",
          mimeType: MIME_POR_FORMATO[formato] ?? MIME_POR_FORMATO.webm,
          byteSize: render.bytes,
          duracaoSegundos: cena.duracaoSegundos,
          largura: render.largura,
          altura: render.altura,
          licenca: LICENCA_DA_SAIDA,
          atribuicaoObrigatoria: false,
          provedor: PROVEDOR,
        };
        nosGrafico[no.id] = render.hash;
        procedenciaAssets.push({
          hash: render.hash,
          licenca: LICENCA_DA_SAIDA,
          atribuicaoObrigatoria: false,
          provedor: PROVEDOR,
          idNoProvedor: render.nomeCena,
        });
        for (const correcao of render.correcoes) {
          correcoes.push(`${no.id}: ${correcao}`);
        }
      }

      const procedencia: ProcedenciaCassete = {
        licenca: LICENCA_DA_SAIDA,
        provedor: PROVEDOR,
        ferramenta: `manim ${String(entrada.parametros["versaoManim"])}`,
        assets: procedenciaAssets,
        notas: montarNotas(correcoes, String(entrada.parametros["versaoMuxer"])),
      };

      return {
        parcial: { assets, nos_grafico: nosGrafico },
        procedencia,
      };
    },
  };
}

/**
 * Notas de auditoria da gravacao.
 *
 * As correcoes de quirk entram NOMEADAS. Um conserto silencioso e
 * indistinguivel de nenhum conserto, e daqui a seis meses a pergunta vai ser
 * "por que a cor do grafico do no n-003 nao e a que o manifesto pediu?".
 */
function montarNotas(correcoes: readonly string[], muxer: string): string {
  const base =
    `Render local com Manim CE headless (cairo, --write_to_movie), muxer ${muxer}. ` +
    "Saida gerada a partir dos dados do manifesto; nenhum asset de terceiro.";
  if (correcoes.length === 0) {
    return `${base} Nenhuma correcao de quirk foi necessaria.`;
  }
  return `${base} Correcoes de quirk aplicadas ao codigo da cena: ${correcoes.join("; ")}.`;
}

/** A instancia que a descoberta por convencao encontra. */
const estagio: EstagioResolucao = criarEstagioGrafico();

export default estagio;
