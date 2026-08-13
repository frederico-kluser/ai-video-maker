/**
 * tests/resolucao/locucao.test.ts
 *
 * O ESTAGIO DE LOCUCAO — o produto do card F2-03, em tres camadas:
 *
 *   1. FORMATO — o documento de timing por palavra existe, na unidade
 *      certa (ms inteiro), monotono, dentro do audio, e reconstroi o
 *      texto falado. Responde a pergunta adversarial (5): audio E
 *      timing sao produzidos, nao um ou outro.
 *
 *   2. JUNCAO — em pt-BR o estagio de alinhamento NAO pode ser deletado
 *      (armadilha de dominio do AGENTS.md). A juncao gruda a pontuacao
 *      na palavra vizinha quando ela e adjacente, e o travessao cercado
 *      de espaco continua palavra propria.
 *
 *   3. REPLAY — o cassete e SOSIA, nao sucessor (pergunta adversarial
 *      (4)): o replay produz os MESMOS bytes. E roda offline: o guarda
 *      de rede do vitest esta ligado (tests/setup/rede-bloqueada.ts), e
 *      este arquivo nunca o desliga — qualquer chamada a `fetch` real
 *      derrubaria a suite (pergunta adversarial (1)).
 *
 * As perguntas adversariais (2) e (3) sao provadas fora deste arquivo:
 *   (2) a chave inclui a versao do estagio → `tools/resolucao/chave.ts`
 *       muta `versaoEstagio` e exige cache miss (C12), no res-chave;
 *   (3) o cassete nao contem credencial → `tests/resolucao/cassete.test.ts`
 *       e o proprio gravador redigem headers sensiveis; aqui conferimos
 *       o cassete COMMITADO, que e o que esta versionado no repositorio.
 */

import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ARQUIVO_CHAMADAS,
  RAIZ_CASSETES_PADRAO,
  VALOR_REDIGIDO,
  diretorioDoCassete,
} from "src/resolucao/cassete/formato.js";
import { gravarCassete } from "src/resolucao/cassete/gravador.js";
import { chaveDeCache, componentesDaChave, hashDoManifesto } from "src/resolucao/contrato.js";
import { verificarCobertura, ARQUIVO_MARCADOR } from "src/resolucao/descoberta.js";
import estagio, {
  PARAMETROS_LOCUCAO,
  resolverUnidade,
  unidadesDeLocucao,
} from "src/resolucao/locucao/estagio.js";
import {
  EAlinhamentoObrigatorio,
  exigeAlinhamentoExplicito,
  juntarPontuacao,
  montarTiming,
  paraPalavras,
  tokensDeCaracteres,
  tokensDePalavras,
  tokensDeSpeechMarks,
} from "src/resolucao/locucao/alinhamento.js";
import type { TokenCru } from "src/resolucao/locucao/alinhamento.js";
import {
  conferirDuracao,
  duracaoDoWavMs,
  lerRespostaDeAlinhamento,
  requisicaoDeAlinhamento,
  requisicaoDeFala,
} from "src/resolucao/locucao/provedor.js";
import { reproduzirLocucao } from "src/resolucao/locucao/replay.js";
import { sintetizarWav, textoDoWav, transcrever } from "src/resolucao/locucao/sosia.js";
import {
  ESCOPO_DA_LOCUCAO,
  FORMATO_TIMING_LOCUCAO,
  MIME_TIMING_LOCUCAO,
  casarTimings,
  hashesDeTiming,
  lerTiming,
  serializarTiming,
  validarTiming,
} from "src/resolucao/locucao/timing.js";
import type { Manifesto } from "src/contratos/manifesto.js";
import type { Sha256 } from "src/resolucao/manifesto-resolvido.js";

// ─── Fixtures ───────────────────────────────────────────────────────────────────

/**
 * Texto canarionico com os tres tracos de pt-BR que a juncao precisa
 * atravessar: acento, travessao cercado de espaco e aspas curvas.
 */
const TEXTO_CANARIO =
  "Nesta seção, apresentamos os dados de desempenho do pipeline. " +
  "Cada tipo de nó — vídeo, gráfico ou código — tem características " +
  "de renderização distintas.";

function manifestoCanonico(): Manifesto {
  return JSON.parse(
    readFileSync("fixtures/canonico/manifesto-valido.json", "utf-8"),
  ) as Manifesto;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Executa `resolverUnidade` contra um fetch FALSO que fala a lingua do
 * sosia — sem rede, sem servidor, sem guarda a desligar. Os bytes sao
 * os mesmos que o sosia produziria: `sintetizarWav` e `transcrever` sao
 * as mesmas funcoes puras que o servidor sosia usa.
 */
async function resolverComSosiaFalso(
  texto: string,
  parametros: typeof PARAMETROS_LOCUCAO = PARAMETROS_LOCUCAO,
): Promise<{ audio: Buffer; hashAudio: Sha256; timingJson: string }> {
  const wav = sintetizarWav(texto);
  const transcricao = transcrever(texto);

  const fetchFalso = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : String(input);
    if (url.endsWith("/v1/audio/speech")) {
      return new Response(new Uint8Array(wav), {
        status: 200,
        headers: { "content-type": "audio/wav" },
      });
    }
    if (url.endsWith("/v1/audio/transcriptions")) {
      return new Response(JSON.stringify(transcricao), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`fetchFalso: rota inesperada ${url}`);
  }) as typeof fetch;

  const { audio, hashAudio, timing } = await resolverUnidade(
    { unidade: "c-004", texto },
    parametros,
    fetchFalso,
    "teste",
  );
  return { audio, hashAudio, timingJson: serializarTiming(timing).toString("utf-8") };
}

// ─── 1. O documento de timing ───────────────────────────────────────────────────

describe("locucao — o documento de timing (pergunta adversarial 5)", () => {
  it("audio E timing sao produzidos, nao um ou outro", async () => {
    const { audio, hashAudio, timingJson } = await resolverComSosiaFalso(TEXTO_CANARIO);
    // Audio: bytes de verdade, com duracao aritmetica (C4).
    expect(audio.length).toBeGreaterThan(0);
    expect(duracaoDoWavMs(audio)).toBeGreaterThan(0);

    // Timing: documento valido, ligado ao audio por conteudo.
    const timing = lerTiming(timingJson);
    expect(timing.audio).toBe(hashAudio);
    expect(validarTiming(timing)).toEqual([]);
  });

  it("o formato e TimingLocucao.1, escopo cena, unidade milissegundo inteiro", async () => {
    const { timingJson } = await resolverComSosiaFalso(TEXTO_CANARIO);
    const timing = lerTiming(timingJson);

    expect(timing.formato).toBe(FORMATO_TIMING_LOCUCAO);
    expect(timing.escopo).toBe(ESCOPO_DA_LOCUCAO);
    expect(timing.idioma).toBe("pt-BR");
    expect(timing.duracao_ms).toBeGreaterThan(0);

    for (const palavra of timing.palavras) {
      expect(Number.isInteger(palavra.inicio_ms)).toBe(true);
      expect(Number.isInteger(palavra.fim_ms)).toBe(true);
      expect(palavra.fim_ms).toBeGreaterThan(palavra.inicio_ms);
    }
  });

  it("a juncao anexa a pontuacao adjacente a palavra (R6)", async () => {
    const { timingJson } = await resolverComSosiaFalso(TEXTO_CANARIO);
    const timing = lerTiming(timingJson);

    // A reconstrucao (R6) so fecha se a juncao rodou: o ponto e a virgula
    // estao grudados, o travessao cercado de espaco e palavra propria.
    expect(timing.palavras.some((p) => p.texto === "pipeline.")).toBe(true);
    expect(timing.palavras.some((p) => p.texto === "seção,")).toBe(true);
    expect(timing.palavras.some((p) => p.texto === "—")).toBe(true);
  });

  it("tokensDePalavras marca a adjacencia pelo espaco a esquerda", () => {
    const tokens = tokensDePalavras(transcrever(TEXTO_CANARIO));
    const primeiro = tokens[0];
    expect(primeiro?.comecaPalavra).toBe(true);
    // O travessao cercado de espaco comeca palavra; a virgula adjacente
    // nao comeca.
    const travessao = tokens.find((t) => t.texto.trim() === "—");
    expect(travessao?.comecaPalavra).toBe(true);
    const virgula = tokens.find((t) => t.texto.trim() === ",");
    if (virgula !== undefined) {
      expect(virgula.comecaPalavra).toBe(false);
    }
  });
});

// ─── 2. A juncao em pt-BR ───────────────────────────────────────────────────────

describe("locucao — a juncao e obrigatoria em pt-BR", () => {
  it("exigeAlinhamentoExplicito diz sim para transcricao em pt-BR", () => {
    const veredicto = exigeAlinhamentoExplicito("pt-BR", "transcricao", "palavra");
    expect(veredicto.obrigatorio).toBe(true);
    expect(veredicto.motivo).toContain("nao pode ser deletado");
  });

  it("a juncao nao gruda pontuacao NAO adjacente", () => {
    const tokens: TokenCru[] = [
      { texto: "pipeline", inicio_s: 0.1, fim_s: 0.5, comecaPalavra: true },
      { texto: "—", inicio_s: 0.6, fim_s: 0.7, comecaPalavra: true },
      { texto: "fim", inicio_s: 0.8, fim_s: 1.0, comecaPalavra: true },
    ];
    const juntados = juntarPontuacao(tokens);
    expect(juntados.map((t) => t.texto)).toEqual(["pipeline", "—", "fim"]);
  });

  it("a juncao gruda pontuacao ADJACENTE", () => {
    const tokens: TokenCru[] = [
      { texto: "pipeline", inicio_s: 0.1, fim_s: 0.5, comecaPalavra: true },
      { texto: ".", inicio_s: 0.5, fim_s: 0.55, comecaPalavra: false },
    ];
    const juntados = juntarPontuacao(tokens);
    expect(juntados.map((t) => t.texto)).toEqual(["pipeline."]);
  });

  it("pontuacao nao-ASCII viram token proprio na fonte e gruda aqui", () => {
    // O sosia modela a ferramenta de transcricao: `…` nao esta em
    // string.punctuation, vira token proprio, e a juncao deste estagio
    // o anexa — a juncao da ferramenta nao o teria feito.
    const texto = "Seção…";
    const tokens = tokensDePalavras(transcrever(texto));
    expect(tokens.some((t) => t.texto === "…")).toBe(true);
    const juntados = juntarPontuacao(tokens);
    expect(juntados.some((t) => t.texto === "Seção…")).toBe(true);
  });

  it("paraPalavras aplica os tres reparos P1/P2/P3", () => {
    const tokens: TokenCru[] = [
      { texto: "a", inicio_s: 0.0012, fim_s: 0.1, comecaPalavra: true },
      // P2: comeca antes do fim da anterior → empurrado.
      { texto: "b", inicio_s: 0.05, fim_s: 0.2, comecaPalavra: true },
      // P3: duracao zero → ganha 1 ms.
      { texto: "c", inicio_s: 0.2, fim_s: 0.2, comecaPalavra: true },
    ];
    const palavras = paraPalavras(tokens);
    expect(palavras[1]?.inicio_ms).toBe(palavras[0]?.fim_ms);
    expect(palavras[2]?.fim_ms).toBe(palavras[2]?.inicio_ms! + 1);
  });

  it("montarTiming com juncao deletada (token solto) lanca EAlinhamentoObrigatorio", () => {
    // O sintoma da guarda por idioma ingles: a pontuacao veio como token
    // proprio e NINGUEM a anexou. A reconstrucao (R6) diverge do texto
    // falado e a juncao era obrigatoria — logo, erro com a causa nomeada.
    const tokens: TokenCru[] = [
      { texto: "olá", inicio_s: 0.1, fim_s: 0.4, comecaPalavra: true },
      // A virgula veio como PALAVRA propria (a juncao da ferramenta foi
      // deletada ou nao reconheceu a pontuacao). A adjacencia respeita o
      // bit: sem espaco a esquerda ela gruda; COM espaco, nao gruda e a
      // reconstrucao (R6) diverge do texto falado.
      { texto: ",", inicio_s: 0.4, fim_s: 0.42, comecaPalavra: true },
    ];
    expect(() =>
      montarTiming(tokens, {
        unidade: "c-004",
        audio: "a".repeat(64) as Sha256,
        idioma: "pt-BR",
        texto: "olá,",
        duracao_ms: 1000,
        provedor: "teste",
        unidade_nativa: "palavra",
        caminho: "transcricao",
      }),
    ).toThrow(EAlinhamentoObrigatorio);
  });

  it("tokensDeCaracteres acumula ate o espaco e nao vira palavra", () => {
    const alinhamento = {
      characters: ["o", "l", "á", " ", "m", "u", "n", "d", "o"],
      character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    };
    const tokens = tokensDeCaracteres(alinhamento);
    expect(tokens.map((t) => t.texto)).toEqual(["olá", "mundo"]);
    expect(tokens[0]?.inicio_s).toBe(0);
    expect(tokens[1]?.fim_s).toBe(0.9);
  });

  it("tokensDeSpeechMarks trata offsets como BYTE (acento desloca)", () => {
    // "seção" tem 5 caracteres e 6 bytes em UTF-8. O segundo mark aponta
    // em BYTES; recortar em caracteres com esse offset pegaria o inicio
    // do "ã" e cortaria o texto errado.
    const texto = "seção fim";
    // "seção" tem 5 caracteres e 7 bytes UTF-8; o espaco e o byte 7.
    expect(Buffer.byteLength("seção")).toBe(7);
    const marks = [
      { time: 0, type: "word", start: 0, end: 7, value: "seção" },
      { time: 500, type: "word", start: 8, end: 11, value: "fim" },
    ];
    const tokens = tokensDeSpeechMarks(texto, marks, 800);
    expect(tokens.map((t) => t.texto)).toEqual(["seção", "fim"]);
    // O fim da primeira palavra e o time da proxima mark.
    expect(tokens[0]?.fim_s).toBe(0.5);
    // A ultima palavra fecha na duracao total.
    expect(tokens[1]?.fim_s).toBe(0.8);
  });
});

// ─── 3. Replay: sosia, nao sucessor; offline de verdade ─────────────────────────

describe("locucao — o cassete versionado (perguntas adversariais 1, 3, 4)", () => {
  it("reproduz do cassete COMMITADO os mesmos bytes, sem rede", async () => {
    // O guarda de rede do vitest esta ligado: se qualquer caminho deste
    // teste tocasse a rede, a suite cairia (pergunta adversarial 1).
    const manifesto = manifestoCanonico();
    const reprod = await reproduzirLocucao(manifesto);
    const unidades = unidadesDeLocucao(manifesto);
    expect(reprod.unidades.length).toBe(unidades.length);

    for (const u of reprod.unidades) {
      // Pergunta adversarial (4): o replay bate com o gravado hash a hash.
      expect(u.hashAudio).toMatch(/^[0-9a-f]{64}$/);
      expect(u.audio.length).toBeGreaterThan(0);
      expect(validarTiming(u.timing)).toEqual([]);
      // Audio E timing (pergunta 5): ambos existem, e o timing aponta
      // para o audio.
      expect(u.timing.audio).toBe(u.hashAudio);
      expect(u.hashTiming).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("a chave do replay e a chave do cassete versionado", async () => {
    const manifesto = manifestoCanonico();
    const chave = chaveDeCache(
      componentesDaChave(estagio, hashDoManifesto(manifesto)),
    );
    const reprod = await reproduzirLocucao(manifesto);
    expect(reprod.chave).toBe(chave);
  });

  it("o cassete versionado nao contem credencial (pergunta adversarial 3)", async () => {
    const manifesto = manifestoCanonico();
    const chave = chaveDeCache(
      componentesDaChave(estagio, hashDoManifesto(manifesto)),
    );
    const diretorio = diretorioDoCassete(RAIZ_CASSETES_PADRAO, "locucao", chave);
    const bruto = await readFile(join(diretorio, ARQUIVO_CHAMADAS), "utf-8");
    expect(bruto).not.toContain("Bearer ");
    // Todo header de autorizacao esta redigido.
    const chamadas = JSON.parse(bruto) as Array<{
      headersRequisicao?: Record<string, string>;
    }>;
    for (const chamada of chamadas) {
      const auth = chamada.headersRequisicao?.authorization;
      if (auth !== undefined) {
        expect(auth).toBe(VALOR_REDIGIDO);
      }
    }
  });

  it("o replay converge com o resultado gravado (hash por hash)", async () => {
    const manifesto = manifestoCanonico();
    const reprod = await reproduzirLocucao(manifesto);
    const gravado = JSON.parse(
      readFileSync(
        join(RAIZ_CASSETES_PADRAO, "locucao", reprod.chave, "resultado.json"),
        "utf-8",
      ),
    ) as { nos_locucao: Record<string, string> };

    for (const u of reprod.unidades) {
      expect(gravado.nos_locucao[u.unidade]).toBe(u.hashAudio);
    }
  });

  it("casarTimings liga cada audio ao seu documento por CONTEUDO", async () => {
    const reprod = await reproduzirLocucao(manifestoCanonico());
    const assets: Record<string, { mimeType?: string }> = {};
    const nos: Record<string, string> = {};
    for (const u of reprod.unidades) {
      assets[u.hashAudio] = { mimeType: "audio/wav" };
      assets[u.hashTiming] = { mimeType: MIME_TIMING_LOCUCAO };
      nos[u.unidade] = u.hashAudio;
    }
    const timings = await casarTimings(
      { assets, nos_locucao: nos } as never,
      (hash) => {
        const u = reprod.unidades.find((x) => x.hashTiming === hash);
        return u !== undefined ? u.bytesTiming : null;
      },
    );
    expect(timings.map((t) => t.unidade).sort()).toEqual(
      reprod.unidades.map((u) => u.unidade).sort(),
    );
    expect(timings.every((t) => t.timing.audio === t.audio)).toBe(true);
  });
});

// ─── 4. Superficie de consumo (F3-01) ───────────────────────────────────────────

describe("locucao — superficie para F3-01", () => {
  it("hashesDeTiming filtra pelo MIME deste card, ignorando o resto", () => {
    const parcial = {
      assets: {
        [`${"a".repeat(64)}`]: { mimeType: "audio/wav" },
        [`${"b".repeat(64)}`]: { mimeType: MIME_TIMING_LOCUCAO },
        [`${"c".repeat(64)}`]: { mimeType: "image/png" },
      },
    };
    const hashes = hashesDeTiming(parcial as never);
    expect(hashes).toEqual([`${"b".repeat(64)}`]);
  });

  it("o MIME do timing nao e uma URL (guarda encontrarURLs)", () => {
    expect(MIME_TIMING_LOCUCAO).not.toContain("://");
  });

  it("resolverUnidade nao deixa nenhuma URL escapar para o documento", async () => {
    const { timingJson } = await resolverComSosiaFalso(TEXTO_CANARIO);
    expect(timingJson).not.toContain("http");
    expect(timingJson).not.toContain("://");
  });
});

// ─── 5. Prova de bloco: estagio sem cassete derruba o gate (C2) ─────────────────

describe("locucao — o ∅-crit nao e vazio por vacuidade", () => {
  it("um estagio locucao SEM cassete derruba a cobertura", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "locucao-∅-"));
    try {
      const raizEstagios = join(tmp, "src", "resolucao");
      const raizCassetes = join(tmp, "fixtures", "cassetes");
      await mkdir(join(raizEstagios, "locucao"), { recursive: true });
      await writeFile(
        join(raizEstagios, "locucao", ARQUIVO_MARCADOR),
        "export default {};\n",
        "utf-8",
      );
      const resultado = await verificarCobertura({
        raizEstagios,
        raizCassetes,
      });
      expect(resultado.ok).toBe(false);
      expect(
        resultado.cobertura.some((c) =>
          c.problemas.join("\n").includes("∅-crit"),
        ),
      ).toBe(true);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("o cassete COMMITADO passa pela gravacao offline (licenca em todo asset)", async () => {
    // Gravacao em diretorio temporario com o fetch falso do sosia: se o
    // estagio produzisse um asset sem licenca, gravarCassete recusaria.
    const tmp = await mkdtemp(join(tmpdir(), "locucao-gravacao-"));
    try {
      const manifesto = manifestoCanonico();
      const resultado = await gravarCassete(estagio, {
        raiz: join(tmp, "cassetes"),
        manifesto,
        diretorioTrabalho: tmp,
        fetchReal: (async (
          input: RequestInfo | URL,
          init?: RequestInit,
        ): Promise<Response> => {
          const url = typeof input === "string" ? input : String(input);
          if (url.endsWith("/v1/audio/speech")) {
            // O texto vem no corpo da requisicao: sintetizar outro texto
            // aqui produziria um audio cujo timing nao reconstroi o que o
            // estagio pediu (R6), e o erro seria deste teste, nao do card.
            const pedido = JSON.parse(String(init?.body)) as { input: string };
            return new Response(
              new Uint8Array(sintetizarWav(pedido.input)),
              { status: 200, headers: { "content-type": "audio/wav" } },
            );
          }
          if (url.endsWith("/v1/audio/transcriptions")) {
            const forma = await new Response(init?.body).formData();
            const arquivo = forma.get("file");
            const wav = Buffer.from(await (arquivo as Blob).arrayBuffer());
            return new Response(JSON.stringify(transcrever(textoDoWav(wav))), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          throw new Error(`fetchReal: rota inesperada ${url}`);
        }) as typeof fetch,
      });
      expect(resultado.chave).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

// ─── 6. Adaptador do provedor ───────────────────────────────────────────────────

describe("locucao — adaptador do provedor", () => {
  it("requisicaoDeFala envia texto, modelo, formato, velocidade e voz", () => {
    const { url, init } = requisicaoDeFala({
      base: "http://127.0.0.1:3203",
      modelo: "tts-1",
      voz: "alloy",
      velocidade: 1,
      formato: "wav",
      texto: "olá",
      credencial: "chave-teste",
    });
    expect(url).toBe("http://127.0.0.1:3203/v1/audio/speech");
    expect(init.method).toBe("POST");
    const corpo = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(corpo.input).toBe("olá");
    expect(corpo.model).toBe("tts-1");
    expect(corpo.voice).toBe("alloy");
    expect(corpo.speed).toBe(1);
    expect(corpo.response_format).toBe("wav");
  });

  it("requisicaoDeAlinhamento pede granularidade de PALAVRA e idioma explicito", () => {
    const { url, init } = requisicaoDeAlinhamento({
      base: "http://127.0.0.1:3203",
      modelo: "whisper-1",
      idioma: "pt-BR",
      audio: sintetizarWav("olá"),
      nomeDoArquivo: "c-004.wav",
      credencial: "chave-teste",
    });
    expect(url).toBe("http://127.0.0.1:3203/v1/audio/transcriptions");
    const corpo = init.body as FormData;
    expect(corpo.get("model")).toBe("whisper-1");
    expect(corpo.get("language")).toBe("pt-BR");
    expect(corpo.get("response_format")).toBe("verbose_json");
    expect(corpo.get("timestamp_granularities[]")).toBe("word");
  });

  it("lerRespostaDeAlinhamento exige words[] nao-vazio (C1 no audio)", () => {
    const resposta = transcrever("olá");
    const lida = lerRespostaDeAlinhamento(JSON.stringify(resposta));
    expect(lida.words?.length ?? 0).toBeGreaterThan(0);

    const semWords = JSON.stringify({ text: "sem granularidade" });
    expect(() => lerRespostaDeAlinhamento(semWords)).toThrow(/words/);

    const vazio = JSON.stringify({ words: [] });
    expect(() => lerRespostaDeAlinhamento(vazio)).toThrow(/vazio/);
  });

  it("conferirDuracao tolera 250 ms e derruba divergencia de segundos", () => {
    expect(() => conferirDuracao(1000, 1.0)).not.toThrow();
    expect(() => conferirDuracao(1000, 1.1)).not.toThrow();
    expect(() => conferirDuracao(1000, 2.0)).toThrow(/outro audio/);
  });

  it("duracaoDoWavMs mede no PCM, atravessando chunk LIST/INFO", () => {
    const wav = sintetizarWav("olá mundo");
    // O sosia escreve LIST/INFO/ICMT antes do data; o medidor atravessa.
    const ms = duracaoDoWavMs(wav);
    expect(ms).toBeGreaterThan(0);
    // WAV nao-RIFF e ilegivel.
    expect(() => duracaoDoWavMs(Buffer.from("NAO E WAV"))).toThrow(/curto demais/);
  });
});
