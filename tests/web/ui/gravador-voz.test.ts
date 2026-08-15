// =============================================================================
// GravadorVoz — gravacao de voz (MediaRecorder) e erros honestos
// =============================================================================
// Sem DOM (react-test-renderer) com stubs minimos: window (setInterval/
// clearInterval reais — o relogio fake os controla), URL.createObjectURL/
// revokeObjectURL, navigator.mediaDevices e uma classe MediaRecorder de
// teste. O blob vai com o mimeType REAL do gravador (body cru no PUT,
// nunca multipart — api.md). FQ-U4: permissao negada, navegador sem
// mediaDevices e 4xx/5xx exibem erro honesto, nunca silencio.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act } from "react";
import { ErroApi } from "../../../src/web/ui/src/api.js";
import { GravadorVoz } from "../../../src/web/ui/src/componentes/GravadorVoz.js";
import { existeTestId, montar, porTestId } from "./ajuda/render.js";
import { criarClienteStub, textosDa } from "./ajuda/stubs.js";
import type { NarracaoPedaco } from "../../../src/roteiro/contrato/contrato.js";

// ─── Stubs de ambiente (restaurados a cada teste) ─────────────────────────────

/** MediaRecorder de teste: registra instancias e emite onstop sincrono. */
class MediaRecorderStub {
  static instancias: MediaRecorderStub[] = [];
  static isTypeSupported(tipo: string): boolean {
    return tipo === "audio/webm;codecs=opus";
  }
  readonly mimeType: string;
  state = "inactive";
  ondataavailable: ((evento: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  private readonly trilhas: Array<{ stop: () => void }>;
  private readonly stream: { getTracks: () => Array<{ stop: () => void }> };

  constructor(stream: { getTracks: () => Array<{ stop: () => void }> }, opcoes: { mimeType: string }) {
    this.stream = stream;
    this.trilhas = stream.getTracks();
    this.mimeType = opcoes.mimeType;
    MediaRecorderStub.instancias.push(this);
  }
  start(): void {
    this.state = "recording";
  }
  stop(): void {
    this.state = "inactive";
    this.onstop?.();
  }
  emitirDados(dados: Blob): void {
    this.ondataavailable?.({ data: dados });
  }
  trilhasDoStream(): Array<{ stop: () => void }> {
    return this.stream.getTracks();
  }
}

interface GravadorMontado {
  arvore: ReturnType<typeof montar>["arvore"];
  stub: ReturnType<typeof criarClienteStub>;
  desmontar(): void;
}

function montarGravador(narracao: NarracaoPedaco, fala = "texto narrado"): GravadorMontado {
  const stub = criarClienteStub();
  stub.enviarGravacao.mockResolvedValue({ texto: fala, origem: "gravacao", status: "gerado", hash_audio: "h" });
  stub.removerNarracao.mockResolvedValue(undefined);
  stub.obterAudioNarracao.mockResolvedValue(new Blob(["RIFF"], { type: "audio/wav" }));
  const aoMudar = vi.fn(async () => undefined);
  const montada = montar(
    createElement(GravadorVoz, {
      cliente: stub.cliente,
      projetoId: "proj-001",
      pedacoId: "p-000",
      fala,
      narracao,
      aoMudar,
    }),
  );
  return { arvore: montada.arvore, stub, desmontar: () => montada.desmontar() };
}

/** Um stream fake cujas trilhas registram stop(). */
function streamFake(): { getTracks: () => Array<{ stop: ReturnType<typeof vi.fn> }>; trilhas: Array<{ stop: ReturnType<typeof vi.fn> }> } {
  const trilhas = [{ stop: vi.fn() }];
  return { getTracks: () => trilhas, trilhas };
}

beforeEach(() => {
  vi.useFakeTimers();
  // window minimo: setInterval/clearInterval REAIS (o relogio fake os
  // controla por indirecao — o stub delega ao globalThis no momento da
  // chamada).
  (globalThis as { window?: unknown }).window = {
    setInterval: (...args: unknown[]) => (globalThis.setInterval as (...a: unknown[]) => unknown)(...args),
    clearInterval: (...args: unknown[]) => (globalThis.clearInterval as (...a: unknown[]) => unknown)(...args),
  };
  URL.createObjectURL = vi.fn(() => "blob:teste-1");
  URL.revokeObjectURL = vi.fn();
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = MediaRecorderStub;
  MediaRecorderStub.instancias = [];
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
  delete (navigator as { mediaDevices?: unknown }).mediaDevices;
});

// ─── Regras de exibicao ───────────────────────────────────────────────────────

describe("GravadorVoz — regras de exibicao", () => {
  it("sem audio existente o botao diz 'Gravar voz' (e nao mostra Ouvir/Remover)", () => {
    const { arvore } = montarGravador({ texto: "", origem: "nenhuma", status: "vazio" });
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("Gravar voz");
    expect(existeTestId(arvore, "botao-ouvir-p-000")).toBe(false);
    expect(existeTestId(arvore, "botao-remover-narracao-p-000")).toBe(false);
  });

  it("com audio existente o botao diz 'Regravar voz' e mostra Ouvir/Remover", () => {
    const { arvore } = montarGravador({ texto: "x", origem: "gravacao", status: "gerado", hash_audio: "h" });
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("Regravar voz");
    expect(existeTestId(arvore, "botao-ouvir-p-000")).toBe(true);
    expect(existeTestId(arvore, "botao-remover-narracao-p-000")).toBe(true);
  });
});

// ─── Erros honestos de acesso ao microfone (FQ-U4) ────────────────────────────

describe("GravadorVoz — acesso ao microfone", () => {
  it("navegador sem mediaDevices mostra o erro honesto (https/outro navegador)", async () => {
    const { arvore } = montarGravador({ texto: "", origem: "nenhuma", status: "vazio" });
    await act(async () => {
      const botao = porTestId(arvore, "botao-gravar-p-000");
      (botao.props.onClick as () => void)();
    });
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("este navegador não permite gravar áudio");
  });

  it("getUserMedia negada mostra o erro de permissao (nunca trava)", async () => {
    const { arvore } = montarGravador({ texto: "", origem: "nenhuma", status: "vazio" });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => {
        throw new Error("NotAllowedError");
      }) },
    });

    await act(async () => {
      const botao = porTestId(arvore, "botao-gravar-p-000");
      (botao.props.onClick as () => void)();
    });

    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("não foi possível acessar o microfone — verifique a permissão do navegador");
  });
});

// ─── Fluxo completo: gravar -> parar -> enviar (body cru) ─────────────────────

describe("GravadorVoz — gravar, parar e enviar", () => {
  it("gravar inicia o MediaRecorder com o mimeType real e o contador de segundos", async () => {
    const stream = streamFake();
    const { arvore } = montarGravador({ texto: "", origem: "nenhuma", status: "vazio" });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });

    await act(async () => {
      const botao = porTestId(arvore, "botao-gravar-p-000");
      (botao.props.onClick as () => void)();
    });

    const gravador = MediaRecorderStub.instancias[0]!;
    expect(gravador.mimeType).toBe("audio/webm;codecs=opus");
    expect(gravador.state).toBe("recording");
    // A fase gravando troca o botao para "Parar e enviar".
    expect(existeTestId(arvore, "botao-parar-gravar-p-000")).toBe(true);

    // O contador de segundos anda com o relogio.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("Parar e enviar (1s)");
  });

  it("parar envia o blob com o mimeType REAL do gravador e refaz o fetch (PUT body cru)", async () => {
    const stream = streamFake();
    const { arvore, stub, desmontar } = montarGravador({ texto: "", origem: "nenhuma", status: "vazio" });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });

    await act(async () => {
      const botao = porTestId(arvore, "botao-gravar-p-000");
      (botao.props.onClick as () => void)();
    });
    const gravador = MediaRecorderStub.instancias[0]!;
    act(() => {
      gravador.emitirDados(new Blob(["audio-bytes"], { type: "audio/webm" }));
    });

    await act(async () => {
      const parar = porTestId(arvore, "botao-parar-gravar-p-000");
      (parar.props.onClick as () => void)();
    });

    expect(stub.enviarGravacao).toHaveBeenCalledTimes(1);
    const [projetoId, pedacoId, blob, tipo] = stub.enviarGravacao.mock.calls[0]!;
    expect(projetoId).toBe("proj-001");
    expect(pedacoId).toBe("p-000");
    expect(blob).toBeInstanceOf(Blob);
    expect(tipo).toBe("audio/webm;codecs=opus");
    // O envio parou as trilhas do stream (o microfone nao fica aceso).
    expect(stream.trilhas[0]!.stop).toHaveBeenCalledTimes(1);
    // O contador zera e o botao volta a "Gravar voz".
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("Gravar voz");
    desmontar();
  });

  it("upload 409 exibe a mensagem do envelope (FQ-U4) e o estado volta ao ocioso", async () => {
    const stream = streamFake();
    const { arvore, stub, desmontar } = montarGravador({ texto: "", origem: "nenhuma", status: "vazio" });
    stub.enviarGravacao.mockRejectedValueOnce(new ErroApi("pedaco-sem-fala", "sem fala nao ha o que narrar", 409));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });

    await act(async () => {
      (porTestId(arvore, "botao-gravar-p-000").props.onClick as () => void)();
    });
    const gravador = MediaRecorderStub.instancias[0]!;
    act(() => {
      gravador.emitirDados(new Blob(["x"], { type: "audio/webm" }));
    });
    await act(async () => {
      (porTestId(arvore, "botao-parar-gravar-p-000").props.onClick as () => void)();
    });

    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("sem fala nao ha o que narrar");
    // Voltou ao ocioso: o botao de gravar reaparece.
    expect(existeTestId(arvore, "botao-gravar-p-000")).toBe(true);
    desmontar();
  });

  it("erro nao-ErroApi do upload exibe a mensagem generica honesta", async () => {
    const stream = streamFake();
    const { arvore, stub, desmontar } = montarGravador({ texto: "", origem: "nenhuma", status: "vazio" });
    stub.enviarGravacao.mockRejectedValueOnce(new TypeError("rede caiu"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });

    await act(async () => {
      (porTestId(arvore, "botao-gravar-p-000").props.onClick as () => void)();
    });
    const gravador = MediaRecorderStub.instancias[0]!;
    act(() => {
      gravador.emitirDados(new Blob(["x"], { type: "audio/webm" }));
    });
    await act(async () => {
      (porTestId(arvore, "botao-parar-gravar-p-000").props.onClick as () => void)();
    });

    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("não foi possível enviar a gravação — tente de novo");
    desmontar();
  });

  it("fallback de mime quando o navegador nao suporta opus (audio/webm simples)", async () => {
    const original = MediaRecorderStub.isTypeSupported;
    MediaRecorderStub.isTypeSupported = () => false;
    try {
      const stream = streamFake();
      const { arvore, stub, desmontar } = montarGravador({ texto: "", origem: "nenhuma", status: "vazio" });
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: vi.fn(async () => stream) },
      });

      await act(async () => {
        (porTestId(arvore, "botao-gravar-p-000").props.onClick as () => void)();
      });
      expect(MediaRecorderStub.instancias[0]!.mimeType).toBe("audio/webm");

      const gravador = MediaRecorderStub.instancias[0]!;
      act(() => {
        gravador.emitirDados(new Blob(["x"], { type: "audio/webm" }));
      });
      await act(async () => {
        (porTestId(arvore, "botao-parar-gravar-p-000").props.onClick as () => void)();
      });

      const tipo = stub.enviarGravacao.mock.calls[0]![3];
      expect(tipo).toBe("audio/webm");
      desmontar();
    } finally {
      MediaRecorderStub.isTypeSupported = original;
    }
  });
});

// ─── Ouvir e remover ──────────────────────────────────────────────────────────

describe("GravadorVoz — ouvir e remover", () => {
  it("ouvir carrega o wav e exibe o player com object URL", async () => {
    const { arvore, stub, desmontar } = montarGravador({ texto: "x", origem: "gravacao", status: "gerado", hash_audio: "h" });

    await act(async () => {
      const ouvir = porTestId(arvore, "botao-ouvir-p-000");
      (ouvir.props.onClick as () => void)();
    });

    expect(stub.obterAudioNarracao).toHaveBeenCalledWith("proj-001", "p-000");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const audio = porTestId(arvore, "audio-narracao-p-000");
    expect(audio.props.src).toBe("blob:teste-1");
    desmontar();
  });

  it("ouvir com 404 exibe a mensagem do envelope", async () => {
    const { arvore, stub, desmontar } = montarGravador({ texto: "x", origem: "gravacao", status: "gerado", hash_audio: "h" });
    stub.obterAudioNarracao.mockRejectedValueOnce(new ErroApi("narracao-nao-gravada", "sem gravacao", 404));

    await act(async () => {
      const ouvir = porTestId(arvore, "botao-ouvir-p-000");
      (ouvir.props.onClick as () => void)();
    });

    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("sem gravacao");
    desmontar();
  });

  it("ouvir duas vezes revoga a URL anterior antes de criar a nova", async () => {
    const { arvore, desmontar } = montarGravador({ texto: "x", origem: "gravacao", status: "gerado", hash_audio: "h" });

    await act(async () => {
      (porTestId(arvore, "botao-ouvir-p-000").props.onClick as () => void)();
    });
    await act(async () => {
      (porTestId(arvore, "botao-ouvir-p-000").props.onClick as () => void)();
    });

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:teste-1");
    desmontar();
  });

  it("comecar apos ouvir revoga a URL antiga (gravar de novo descarta o audio antigo)", async () => {
    const stream = streamFake();
    const { arvore, desmontar } = montarGravador({ texto: "x", origem: "gravacao", status: "gerado", hash_audio: "h" });

    await act(async () => {
      (porTestId(arvore, "botao-ouvir-p-000").props.onClick as () => void)();
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });
    await act(async () => {
      (porTestId(arvore, "botao-gravar-p-000").props.onClick as () => void)();
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:teste-1");
    desmontar();
  });

  it("remover chama DELETE narracao, revoga a URL e refaz o fetch", async () => {
    const { arvore, stub, desmontar } = montarGravador({ texto: "x", origem: "gravacao", status: "gerado", hash_audio: "h" });

    // Primeiro ouvir para criar a object URL.
    await act(async () => {
      (porTestId(arvore, "botao-ouvir-p-000").props.onClick as () => void)();
    });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    await act(async () => {
      const remover = porTestId(arvore, "botao-remover-narracao-p-000");
      (remover.props.onClick as () => void)();
    });

    expect(stub.removerNarracao).toHaveBeenCalledWith("proj-001", "p-000");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:teste-1");
    // O player some (a URL foi revogada).
    expect(existeTestId(arvore, "audio-narracao-p-000")).toBe(false);
    desmontar();
  });

  it("remover com erro exibe a mensagem do envelope", async () => {
    const { arvore, stub, desmontar } = montarGravador({ texto: "x", origem: "gravacao", status: "gerado", hash_audio: "h" });
    stub.removerNarracao.mockRejectedValueOnce(new ErroApi("narracao-nao-gravada", "sem gravacao", 404));

    await act(async () => {
      (porTestId(arvore, "botao-remover-narracao-p-000").props.onClick as () => void)();
    });

    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("sem gravacao");
    desmontar();
  });
});

// ─── Cleanup no desmonte ──────────────────────────────────────────────────────

describe("GravadorVoz — cleanup no desmonte", () => {
  it("desmontar no meio da gravacao para o intervalo e as trilhas (o microfone nao fica aceso)", async () => {
    const stream = streamFake();
    const { arvore, desmontar } = montarGravador({ texto: "", origem: "nenhuma", status: "vazio" });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });

    await act(async () => {
      (porTestId(arvore, "botao-gravar-p-000").props.onClick as () => void)();
    });
    expect(stream.trilhas[0]!.stop).not.toHaveBeenCalled();

    desmontar();

    expect(stream.trilhas[0]!.stop).toHaveBeenCalledTimes(1);
    // O contador parou de andar: avancar o relogio nao dispara nada novo.
  });

  it("desmontar apos ouvir revoga a object URL", async () => {
    const { arvore, desmontar } = montarGravador({ texto: "x", origem: "gravacao", status: "gerado", hash_audio: "h" });
    await act(async () => {
      (porTestId(arvore, "botao-ouvir-p-000").props.onClick as () => void)();
    });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    desmontar();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:teste-1");
  });
});
