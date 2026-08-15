// =============================================================================
// ModalEdicao — construcao do delta, regras de anexo e erros honestos
// =============================================================================
// Sem DOM (react-test-renderer). O foco e a FUNCAO PURA construirDelta
// (closure do componente — exercitada pelo fluxo de salvar, que envia o
// delta ao cliente) e as regras de upload: tipo_visual gif/video EXIGE
// anexo primeiro, allowlist de tipo, teto de 200 MB (constante do
// contrato, nunca redigitada) e erros do servidor exibidos com a mensagem
// do envelope (FQ-U4).
// =============================================================================

import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act } from "react";
import type { ChangeEvent } from "react";
import { ErroApi } from "../../../src/web/ui/src/api.js";
import { ModalEdicao } from "../../../src/web/ui/src/componentes/ModalEdicao.js";
import { ANEXO_TAMANHO_MAXIMO_BYTES } from "../../../src/roteiro/contrato/contrato.js";
import type { Pedaco } from "../../../src/roteiro/contrato/contrato.js";
import { existeTestId, montar, porTestId } from "./ajuda/render.js";
import { criarClienteStub, pedacoDe, textosDa } from "./ajuda/stubs.js";

/** Evento sintetico de input/select (o teste nao tem DOM). */
function eventoDe(valor: unknown): ChangeEvent<HTMLInputElement> {
  return { target: { value: valor } } as unknown as ChangeEvent<HTMLInputElement>;
}

/** Evento sintetico do input file. */
function eventoDeArquivo(arquivo: File | undefined): ChangeEvent<HTMLInputElement> {
  return { target: { files: arquivo === undefined ? [] : [arquivo], value: "caminho-fake" } } as unknown as ChangeEvent<HTMLInputElement>;
}

interface ModalMontado {
  arvore: ReturnType<typeof montar>["arvore"];
  stub: ReturnType<typeof criarClienteStub>;
  atualizarPedaco(pedaco: Pedaco, aberto?: boolean): void;
  desmontar(): void;
}

function montarModal(pedaco: Pedaco, opcoes: { aberto?: boolean; aoFechar?: () => void } = {}): ModalMontado {
  const stub = criarClienteStub();
  const aoMudar = vi.fn(async () => undefined);
  const aoFechar = opcoes.aoFechar ?? vi.fn();
  const montada = montar(
    createElement(ModalEdicao, {
      cliente: stub.cliente,
      projetoId: "proj-001",
      pedaco,
      aberto: opcoes.aberto ?? true,
      aoFechar,
      aoMudar,
    }),
  );
  return {
    arvore: montada.arvore,
    stub,
    atualizarPedaco(novo: Pedaco, aberto = true) {
      montada.atualizar(
        createElement(ModalEdicao, {
          cliente: stub.cliente,
          projetoId: "proj-001",
          pedaco: novo,
          aberto,
          aoFechar,
          aoMudar,
        }),
      );
    },
    desmontar: () => montada.desmontar(),
  };
}

async function clicarSalvar(modal: ModalMontado): Promise<void> {
  const botao = porTestId(modal.arvore, "botao-salvar-edicao");
  await act(async () => {
    (botao.props.onClick as () => void)();
  });
}

describe("ModalEdicao — o delta de edicao (construirDelta via salvar)", () => {
  it("durante o salvamento o botao mostra 'Salvando…' e fica desabilitado", async () => {
    const modal = montarModal(pedacoDe());
    let liberar!: (valor: unknown) => void;
    modal.stub.editarPedaco.mockReturnValueOnce(
      new Promise((resolver) => {
        liberar = resolver;
      }),
    );

    await act(async () => {
      (porTestId(modal.arvore, "botao-salvar-edicao").props.onClick as () => void)();
    });
    // O salvamento esta em voo: o botao mostra "Salvando…" e esta
    // desabilitado (nunca um segundo clique na mesma operacao).
    expect(porTestId(modal.arvore, "botao-salvar-edicao").props.disabled).toBe(true);
    expect(textosDa(modal.arvore.toJSON()).join("")).toContain("Salvando…");

    await act(async () => {
      liberar({ id: "p-000", indice: 0, titulo: "titulo" });
    });
  });

  it("salvar envia o delta COMPLETO com os seis campos editaveis e a duracao com virgula", async () => {
    const pedaco = pedacoDe({ id: "p-003", titulo: "titulo velho", fala: "fala velha", duracao_segundos: 10 });
    const modal = montarModal(pedaco);

    act(() => {
      porTestId(modal.arvore, "campo-titulo").props.onChange(eventoDe("titulo novo"));
    });
    act(() => {
      porTestId(modal.arvore, "campo-fala").props.onChange(eventoDe("fala nova"));
    });
    act(() => {
      porTestId(modal.arvore, "campo-duracao").props.onChange(eventoDe("3,5"));
    });
    act(() => {
      porTestId(modal.arvore, "campo-especificacao").props.onChange(eventoDe("visual novo"));
    });
    act(() => {
      porTestId(modal.arvore, "campo-detalhes").props.onChange(eventoDe("producao nova"));
    });
    await clicarSalvar(modal);

    expect(modal.stub.editarPedaco).toHaveBeenCalledTimes(1);
    const [projetoId, pedacoId, delta] = modal.stub.editarPedaco.mock.calls[0]!;
    expect(projetoId).toBe("proj-001");
    expect(pedacoId).toBe("p-003");
    expect(delta).toEqual({
      titulo: "titulo novo",
      fala: "fala nova",
      tipo_visual: "texto",
      especificacao_visual: "visual novo",
      detalhes_de_producao: "producao nova",
      duracao_segundos: 3.5,
    });
  });

  it("duracao invalida (nao-numero, zero, negativa, vazia) sai do delta — nunca NaN no PATCH", async () => {
    for (const invalida of ["abc", "0", "-5", ""]) {
      const modal = montarModal(pedacoDe());
      act(() => {
        porTestId(modal.arvore, "campo-duracao").props.onChange(eventoDe(invalida));
      });
      await clicarSalvar(modal);

      const delta = modal.stub.editarPedaco.mock.calls[0]![2] as Record<string, unknown>;
      expect(delta.duracao_segundos).toBeUndefined();
      expect(delta.titulo).toBe("titulo");
      // Os demais campos continuam no delta (o servidor valida o shape completo).
      expect(delta.fala).toBe("");
    }
  });

  it("delta construido de UMA vez (EdicaoPedaco readonly) — o objeto enviado e o objeto valido", async () => {
    const modal = montarModal(pedacoDe());
    await clicarSalvar(modal);
    expect(modal.stub.editarPedaco.mock.calls[0]![2]).toEqual({
      titulo: "titulo",
      fala: "",
      tipo_visual: "texto",
      especificacao_visual: "visual",
      detalhes_de_producao: "detalhes",
      duracao_segundos: 10,
    });
  });
});

describe("ModalEdicao — regra do anexo (upload primeiro, tipo depois)", () => {
  it("tipo_visual texto nao exibe o bloco de anexo", () => {
    const modal = montarModal(pedacoDe());
    expect(existeTestId(modal.arvore, "bloco-anexo")).toBe(false);
  });

  it("tipo_visual gif/video exibe o bloco de anexo", () => {
    const modal = montarModal(pedacoDe({ tipo_visual: "video" }));
    expect(existeTestId(modal.arvore, "bloco-anexo")).toBe(true);
  });

  it("gif sem anexo BLOQUEIA o salvar antes do PATCH (o upload vem primeiro)", async () => {
    const modal = montarModal(pedacoDe({ tipo_visual: "gif" }));
    act(() => {
      porTestId(modal.arvore, "campo-tipo-visual").props.onChange(eventoDe("gif"));
    });

    await clicarSalvar(modal);

    expect(modal.stub.editarPedaco).not.toHaveBeenCalled();
    const textos = textosDa(modal.arvore.toJSON());
    expect(textos.join("")).toContain("envie o anexo (GIF ou vídeo) antes de salvar o tipo de visual");
  });

  it("gif COM anexo salva normalmente (o bloco mostra nome e tamanho do anexo)", async () => {
    const modal = montarModal(
      pedacoDe({
        tipo_visual: "gif",
        anexo_hash: "sha-abc",
        anexo_meta: { tipo: "image/gif", tamanho_bytes: 2048, nome_original: "loop.gif" },
      }),
    );
    act(() => {
      porTestId(modal.arvore, "campo-tipo-visual").props.onChange(eventoDe("gif"));
    });

    await clicarSalvar(modal);

    expect(modal.stub.editarPedaco).toHaveBeenCalledTimes(1);
    const textos = textosDa(modal.arvore.toJSON());
    expect(textos.join("")).toContain("Anexado: loop.gif (2 kB)");
  });
});

describe("ModalEdicao — upload do anexo (body cru + ?nome=, regras de tamanho/tipo)", () => {
  function arquivoDe(parcial: Partial<File>): File {
    return { size: 1024, type: "image/gif", name: "x.gif", ...parcial } as File;
  }

  it("arquivo dentro das regras envia body cru com nome original (nunca multipart)", async () => {
    const modal = montarModal(pedacoDe({ tipo_visual: "gif" }));
    const arquivo = arquivoDe({ name: "reação final.gif", type: "image/gif" });

    await act(async () => {
      const campo = porTestId(modal.arvore, "campo-anexo");
      (campo.props.onChange as (e: ChangeEvent<HTMLInputElement>) => void)(eventoDeArquivo(arquivo));
    });

    expect(modal.stub.enviarAnexo).toHaveBeenCalledTimes(1);
    const [projetoId, pedacoId, bytes, tipo, nome] = modal.stub.enviarAnexo.mock.calls[0]!;
    expect(projetoId).toBe("proj-001");
    expect(pedacoId).toBe("p-000");
    expect(bytes).toBe(arquivo);
    expect(tipo).toBe("image/gif");
    expect(nome).toBe("reação final.gif");
  });

  it("arquivo acima do teto do contrato (200 MB) e recusado ANTES do envio", async () => {
    const modal = montarModal(pedacoDe({ tipo_visual: "gif" }));
    const arquivo = arquivoDe({ size: ANEXO_TAMANHO_MAXIMO_BYTES + 1 });

    await act(async () => {
      const campo = porTestId(modal.arvore, "campo-anexo");
      (campo.props.onChange as (e: ChangeEvent<HTMLInputElement>) => void)(eventoDeArquivo(arquivo));
    });

    expect(modal.stub.enviarAnexo).not.toHaveBeenCalled();
    const textos = textosDa(modal.arvore.toJSON());
    expect(textos.join("")).toContain("arquivo acima do limite (200 MB)");
  });

  it("tipo fora da allowlist do contrato e recusado ANTES do envio", async () => {
    const modal = montarModal(pedacoDe({ tipo_visual: "video" }));
    const arquivo = arquivoDe({ type: "application/pdf" });

    await act(async () => {
      const campo = porTestId(modal.arvore, "campo-anexo");
      (campo.props.onChange as (e: ChangeEvent<HTMLInputElement>) => void)(eventoDeArquivo(arquivo));
    });

    expect(modal.stub.enviarAnexo).not.toHaveBeenCalled();
    const textos = textosDa(modal.arvore.toJSON());
    expect(textos.join("")).toContain("tipo de arquivo fora da lista permitida (GIF, MP4 ou WebM)");
  });

  it("selecao vazia (cancelou o dialogo) nao dispara nada", async () => {
    const modal = montarModal(pedacoDe({ tipo_visual: "gif" }));
    await act(async () => {
      const campo = porTestId(modal.arvore, "campo-anexo");
      (campo.props.onChange as (e: ChangeEvent<HTMLInputElement>) => void)(eventoDeArquivo(undefined));
    });
    expect(modal.stub.enviarAnexo).not.toHaveBeenCalled();
  });

  it("erro do servidor no upload exibe a mensagem do envelope (FQ-U4)", async () => {
    const modal = montarModal(pedacoDe({ tipo_visual: "gif" }));
    modal.stub.enviarAnexo.mockRejectedValueOnce(new ErroApi("anexo-inexistente", "o anexo sumiu do store", 404));

    await act(async () => {
      const campo = porTestId(modal.arvore, "campo-anexo");
      (campo.props.onChange as (e: ChangeEvent<HTMLInputElement>) => void)(eventoDeArquivo(arquivoDe({})));
    });

    const textos = textosDa(modal.arvore.toJSON());
    expect(textos.join("")).toContain("o anexo sumiu do store");
  });

  it("erro nao-ErroApi no upload exibe a mensagem generica honesta", async () => {
    const modal = montarModal(pedacoDe({ tipo_visual: "video" }));
    modal.stub.enviarAnexo.mockRejectedValueOnce(new TypeError("rede caiu"));

    await act(async () => {
      const campo = porTestId(modal.arvore, "campo-anexo");
      (campo.props.onChange as (e: ChangeEvent<HTMLInputElement>) => void)(eventoDeArquivo(arquivoDe({})));
    });

    const textos = textosDa(modal.arvore.toJSON());
    expect(textos.join("")).toContain("não foi possível enviar o anexo");
  });
});

describe("ModalEdicao — remover anexo, fechar, reset entre pedacos", () => {
  it("remover anexo chama DELETE anexo e refetch", async () => {
    const modal = montarModal(
      pedacoDe({ tipo_visual: "video", anexo_hash: "h", anexo_meta: { tipo: "video/mp4", tamanho_bytes: 10, nome_original: "v.mp4" } }),
    );
    await act(async () => {
      const botao = porTestId(modal.arvore, "botao-remover-anexo");
      (botao.props.onClick as () => void)();
    });
    expect(modal.stub.removerAnexo).toHaveBeenCalledWith("proj-001", "p-000");
  });

  it("remover anexo com erro exibe a mensagem do envelope (FQ-U4)", async () => {
    const modal = montarModal(
      pedacoDe({ tipo_visual: "video", anexo_hash: "h", anexo_meta: { tipo: "video/mp4", tamanho_bytes: 10, nome_original: "v.mp4" } }),
    );
    modal.stub.removerAnexo.mockRejectedValueOnce(new ErroApi("anexo-inexistente", "sem anexo", 404));

    await act(async () => {
      const botao = porTestId(modal.arvore, "botao-remover-anexo");
      (botao.props.onClick as () => void)();
    });

    const textos = textosDa(modal.arvore.toJSON()).join("");
    expect(textos).toContain("sem anexo");
  });

  it("remover anexo com erro nao-ErroApi exibe a mensagem generica honesta", async () => {
    const modal = montarModal(
      pedacoDe({ tipo_visual: "gif", anexo_hash: "h", anexo_meta: { tipo: "image/gif", tamanho_bytes: 10, nome_original: "x.gif" } }),
    );
    modal.stub.removerAnexo.mockRejectedValueOnce(new TypeError("rede caiu"));

    await act(async () => {
      const botao = porTestId(modal.arvore, "botao-remover-anexo");
      (botao.props.onClick as () => void)();
    });

    const textos = textosDa(modal.arvore.toJSON()).join("");
    expect(textos).toContain("não foi possível remover o anexo");
  });

  it("fechar chama aoFechar (botao e clique no fundo)", async () => {
    const aoFechar = vi.fn();
    const modal = montarModal(pedacoDe(), { aoFechar });

    await act(async () => {
      const botao = porTestId(modal.arvore, "botao-fechar-edicao");
      (botao.props.onClick as () => void)();
    });
    expect(aoFechar).toHaveBeenCalledTimes(1);

    await act(async () => {
      const fundo = modal.arvore.root.findAllByProps({ className: "modal-fundo" })[0]!;
      (fundo.props.onMouseDown as () => void)();
    });
    expect(aoFechar).toHaveBeenCalledTimes(2);
  });

  it("aberto=false renderiza null (o modal nao ocupa espaco)", () => {
    const modal = montarModal(pedacoDe(), { aberto: false });
    expect(modal.arvore.toJSON()).toBeNull();
  });

  it("reabrir com outro pedaco RESETA os campos (o estado nao vaza entre cards)", async () => {
    const modal = montarModal(pedacoDe({ id: "p-000", titulo: "primeiro", fala: "fala A" }));
    act(() => {
      porTestId(modal.arvore, "campo-titulo").props.onChange(eventoDe("titulo sujo do card 1"));
    });

    // Fecha e abre com outro pedaco.
    modal.atualizarPedaco(pedacoDe({ id: "p-001", titulo: "segundo", fala: "fala B" }), true);

    const campo = porTestId(modal.arvore, "campo-titulo");
    expect(campo.props.value).toBe("segundo");
    expect(porTestId(modal.arvore, "campo-fala").props.value).toBe("fala B");
  });

  it("erro do salvar exibe a mensagem do envelope (FQ-U4) e o modal permanece aberto", async () => {
    const modal = montarModal(pedacoDe());
    modal.stub.editarPedaco.mockRejectedValueOnce(new ErroApi("brief-invalido", "fala fora do limite", 400));

    await clicarSalvar(modal);

    const textos = textosDa(modal.arvore.toJSON());
    expect(textos.join("")).toContain("fala fora do limite");
    // O modal continua aberto para o usuario corrigir (nunca some em silencio).
    expect(existeTestId(modal.arvore, "modal-edicao")).toBe(true);
  });

  it("erro nao-ErroApi do salvar exibe a mensagem generica honesta", async () => {
    const modal = montarModal(pedacoDe());
    modal.stub.editarPedaco.mockRejectedValueOnce(new TypeError("boom"));

    await clicarSalvar(modal);

    const textos = textosDa(modal.arvore.toJSON());
    expect(textos.join("")).toContain("não foi possível salvar a edição");
  });
});
