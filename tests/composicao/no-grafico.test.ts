// =============================================================================
// no-grafico — o no `grafico` renderiza, respeita a duracao declarada e
//               RECUSA formato sem canal alfa em tempo de render
// =============================================================================
// Card: F1-09 (onda W4)
//
// Este arquivo responde, sem navegador, as tres perguntas adversariais do
// card que so o markup consegue provar:
//
//   (a) o no respeita a duracao declarada? — fora de [0, duracao_frames) o no
//       NAO EXISTE e retorna null (markup vazio); nunca desenha em frame que
//       nao e dele.
//   (b) um manifesto pedindo formato sem alfa FALHA NO BUILD — o proprio
//       componente lanca `ErroDeGraficoOpaco` antes de emitir qualquer
//       elemento; nao existe caminho "renderizou o retangulo opaco".
//   (c) o caminho "asset resolvido" consome o arquivo cujo hash esta no
//       manifesto resolvido (a fonte vem da fiacao, o conteudo e o do hash).
//
// Os dados vem de fixtures/snapshots/no-grafico/cenario.ts — um arquivo so,
// consumido tambem pelo registro do Remotion e pelas sondas de
// tools/no-grafico/, para que nao existam tres verdades.
// =============================================================================

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Grafico, {
  conferirGraficosResolvidos,
  ErroDeGraficoOpaco,
  exigirAssetDeGraficoUtilizavel,
  FORMATOS_ACEITOS,
  FORMATOS_DE_GRAFICO,
  meta,
  normalizarMime,
} from "src/composicao/nos/grafico";
import type { NoGraficoResolvido } from "src/composicao/nos/grafico";
import {
  ALTURA,
  ASSET_BYTES_SEM_ALFA,
  ASSET_COM_ALFA,
  ASSET_FORMATO_DESCONHECIDO,
  ASSET_FORMATO_SEM_ALFA,
  ASSET_MOV,
  ASSET_SEM_MIME,
  DURACAO_FRAMES,
  FPS,
  HASH_COM_ALFA,
  LARGURA,
  NO_AREA,
  NO_BARRAS,
  NO_COM_ASSET,
  NO_DISPERSAO,
  NO_LINHA,
  NO_PIZZA,
  NOS_POR_TIPO,
  NO_VAZIO,
} from "../../fixtures/snapshots/no-grafico/cenario";

function renderizar(no: NoGraficoResolvido, frame: number): string {
  return renderToStaticMarkup(
    createElement(Grafico, {
      no,
      frame,
      fps: FPS,
      width: LARGURA,
      height: ALTURA,
    }),
  );
}

/** Remove o atributo data-frame: ele e o relogio, nao o desenho. */
function semRelogio(html: string): string {
  return html.replace(/data-frame="\d+"/g, "");
}

describe("no-grafico: identificacao (descoberta por convencao)", () => {
  it("exporta meta com tipo 'grafico', schema 'Grafico.1' e id unico", () => {
    expect(meta.tipo).toBe("grafico");
    expect(meta.schema).toBe("Grafico.1");
    expect(meta.id).toBe("no-grafico");
    expect(meta.descricao.length).toBeGreaterThan(0);
  });

  it("o export default e o proprio componente (registro usa `default`)", () => {
    expect(Grafico).toBeTypeOf("function");
  });
});

describe("no-grafico: os cinco tipos de grafico renderizam sem asset", () => {
  it.each(NOS_POR_TIPO)("$id ($tipo_grafico): svg com data-no e data-tipo", (no) => {
    const html = renderizar(no, 20);
    expect(html).toContain(`data-no="${no.id}"`);
    expect(html).toContain('data-tipo="grafico"');
    expect(html).toContain("<svg");
    expect(html).toContain('data-modo="dados"');
    // O no NAO pinta fundo: nenhum backgroundColor em lugar nenhum.
    expect(html).not.toContain("background-color");
  });

  it("no vazio renderiza sem lancar e sem pintar nada (nao e quadro opaco)", () => {
    expect(() => renderizar(NO_VAZIO, 20)).not.toThrow();
    const html = renderizar(NO_VAZIO, 20);
    expect(html).not.toContain("background-color");
  });

  it("no frame 0 o desenho esta no inicio da entrada (nada fora da janela)", () => {
    // Entrada de transitionDuration.base (300ms = 9 frames a 30fps): no
    // frame 0 o progresso e 0, e a barra mais alta ainda tem altura 0.
    const html = renderizar(NO_BARRAS, 0);
    expect(html).toContain('height="0"');
  });

  it("cada no tem data-no proprio — um no nao vaza no markup do outro", () => {
    const html = renderizar(NO_LINHA, 20);
    expect(html).toContain(`data-no="${NO_LINHA.id}"`);
    expect(html).not.toContain(`data-no="${NO_BARRAS.id}"`);
  });
});

describe("no-grafico: a duracao declarada e respeitada (pergunta adversarial 4)", () => {
  it.each([-1, DURACAO_FRAMES, DURACAO_FRAMES + 60, DURACAO_FRAMES + 5000])(
    "fora da janela o no NAO EXISTE: markup vazio em frame %d",
    (frame) => {
      // renderToStaticMarkup de um componente que retorna null e a string
      // vazia — o no nao emite nenhum elemento fora de [0, duracao_frames).
      expect(renderizar(NO_BARRAS, frame)).toBe("");
    },
  );

  it("dentro da entrada o desenho ANIMA (frame 1 difere do frame cheio)", () => {
    const cedo = semRelogio(renderizar(NO_BARRAS, 1));
    const cheio = semRelogio(renderizar(NO_BARRAS, 20));
    expect(cedo).not.toBe(cheio);
  });
});

describe("no-grafico: caminho com asset resolvido", () => {
  it("a guarda aceita o PNG com alfa do hash do store (asset legitimo)", () => {
    expect(ASSET_COM_ALFA.hash).toBe(HASH_COM_ALFA);
    expect(FORMATOS_DE_GRAFICO["image/png"]?.alfa).toBe(true);
    // A guarda que o componente chama antes de emitir qualquer elemento nao
    // lanca para o caso bom.
    expect(() =>
      exigirAssetDeGraficoUtilizavel(NO_COM_ASSET.id, ASSET_COM_ALFA),
    ).not.toThrow();
  });

  it("a guarda que o componente chama RECUSA o formato sem alfa", () => {
    expect(() =>
      exigirAssetDeGraficoUtilizavel(NO_COM_ASSET.id, ASSET_FORMATO_SEM_ALFA),
    ).toThrow(ErroDeGraficoOpaco);
  });

  it("asset resolvido SEM fonte (fiacao que nao entregou o caminho) falha", () => {
    const no: NoGraficoResolvido = {
      ...NO_COM_ASSET,
      grafico_resolvido: { asset: ASSET_COM_ALFA },
    };
    expect(() => renderizar(no, 20)).toThrow(/caminho local/);
  });
});

// O ramo que RENDERIZA o asset (o <Img> do Remotion) nao cabe em
// react-dom/server — <Img> chama useCurrentFrame() e so existe dentro de uma
// composicao. Quem prova esse ramo com navegador de verdade e
// tools/no-grafico/provar.ts (composicao no-grafico-asset: render 2x,
// bytes identicos, snapshot aprovado e assercao de pixel).

describe("no-grafico: formato sem alfa e ERRO DE BUILD, nao video errado", () => {
  it("JPEG no descritor: o componente lanca ErroDeGraficoOpaco nomeando o no", () => {
    const no: NoGraficoResolvido = {
      ...NO_COM_ASSET,
      grafico_resolvido: { asset: ASSET_FORMATO_SEM_ALFA, fonte: "grafico-opaco.png" },
    };
    expect(() => renderizar(no, 20)).toThrow(ErroDeGraficoOpaco);
    try {
      renderizar(no, 20);
      throw new Error("deveria ter lancado");
    } catch (erro) {
      if (erro instanceof ErroDeGraficoOpaco) {
        const mensagem = erro.message;
        expect(mensagem).toContain("no-grafico");
        expect(mensagem).toContain('no "g-asset"');
        expect(mensagem).toContain("image/jpeg");
        expect(mensagem).toContain("retangulo opaco");
      } else {
        throw erro;
      }
    }
  });

  it("o erro chega na PRIMEIRA linha da mensagem (terminal mostra a 1a linha)", () => {
    const no: NoGraficoResolvido = {
      ...NO_COM_ASSET,
      grafico_resolvido: { asset: ASSET_FORMATO_SEM_ALFA, fonte: "grafico-opaco.png" },
    };
    try {
      renderizar(no, 20);
      throw new Error("deveria ter lancado");
    } catch (erro) {
      if (erro instanceof ErroDeGraficoOpaco) {
        const primeiraLinha = erro.message.split("\n")[0] ?? "";
        expect(primeiraLinha).toContain('no "g-asset"');
      } else {
        throw erro;
      }
    }
  });
});

describe("no-grafico: a lista de permissao de formatos", () => {
  it("aceita so quem tem alfa E e reproduzivel no navegador do render", () => {
    expect(FORMATOS_ACEITOS).toEqual(
      ["image/apng", "image/gif", "image/png", "image/svg+xml", "image/webp", "video/webm"],
    );
  });

  it("rejeita os tres modos de falha conhecidos", () => {
    expect(FORMATOS_ACEITOS).not.toContain("image/jpeg"); // sem alfa
    expect(FORMATOS_ACEITOS).not.toContain("video/mp4"); // sem alfa
    expect(FORMATOS_ACEITOS).not.toContain("video/quicktime"); // alfa, mas o navegador nao reproduz
  });

  it("formato desconhecido nao entra na permissao (recusado, nao aprovado)", () => {
    expect(FORMATOS_DE_GRAFICO["image/avif"]).toBeUndefined();
    expect(FORMATOS_ACEITOS).not.toContain("image/avif");
  });

  it("normalizarMime trata parametro e caixa ('IMAGE/PNG; charset=binary')", () => {
    expect(normalizarMime("image/png; charset=binary")).toBe("image/png");
    expect(normalizarMime("IMAGE/PNG")).toBe("image/png");
  });
});

describe("no-grafico: a guarda de build sobre o manifesto resolvido", () => {
  it("manifesto com asset em formato sem alfa: erros nomeiam o no e o formato", () => {
    const erros = conferirGraficosResolvidos({
      manifesto: { nos: [NO_COM_ASSET] },
      assets: { [HASH_COM_ALFA]: ASSET_FORMATO_SEM_ALFA },
      nos_grafico: { [NO_COM_ASSET.id]: HASH_COM_ALFA },
    });
    expect(erros.length).toBeGreaterThan(0);
    const juntos = erros.join(" ");
    expect(juntos).toContain('no "g-asset"');
    expect(juntos).toContain("image/jpeg");
  });

  it("manifesto em formato COM alfa: nenhum erro", () => {
    const erros = conferirGraficosResolvidos({
      manifesto: { nos: [NO_COM_ASSET] },
      assets: { [HASH_COM_ALFA]: ASSET_COM_ALFA },
      nos_grafico: { [NO_COM_ASSET.id]: HASH_COM_ALFA },
    });
    expect(erros).toEqual([]);
  });

  it("nos de OUTRO tipo nao sao problema deste no (sem assercao de lista completa)", () => {
    const erros = conferirGraficosResolvidos({
      manifesto: { nos: [{ id: "g-outro", type: "texto" } as never] },
      assets: {},
      nos_grafico: {},
    });
    expect(erros).toEqual([]);
  });

  it.each([
    ["MOV com alfa que o navegador nao reproduz", ASSET_MOV],
    ["formato desconhecido", ASSET_FORMATO_DESCONHECIDO],
    ["asset sem mimeType", ASSET_SEM_MIME],
  ] as const)("%s: a conferencia do descritor reprova", (_nome, asset) => {
    const erros = conferirGraficosResolvidos({
      manifesto: { nos: [NO_COM_ASSET] },
      assets: { [asset.hash]: asset },
      nos_grafico: { [NO_COM_ASSET.id]: asset.hash },
    });
    expect(erros.length).toBeGreaterThan(0);
    const juntos = erros.join(" ");
    expect(juntos).toContain('no "g-asset"');
  });

  it("PNG de tipo de cor 2: o DESCRITOR passa de proposito — so os bytes pegam", () => {
    // O descritor diz "image/png" e e verdade; o arquivo E um PNG; so que de
    // tipo de cor 2 (RGB), sem canal alfa. A guarda de descritor nao tem como
    // ver isso — e exatamente por isso existe a conferencia de BYTES em
    // tools/no-grafico/conferir.ts, cobrada pela sonda ∅-5 de mutar. Se este
    // teste passar a reprovar, a guarda de bytes perdeu a funcao.
    const erros = conferirGraficosResolvidos({
      manifesto: { nos: [NO_COM_ASSET] },
      assets: { [ASSET_BYTES_SEM_ALFA.hash]: ASSET_BYTES_SEM_ALFA },
      nos_grafico: { [NO_COM_ASSET.id]: ASSET_BYTES_SEM_ALFA.hash },
    });
    expect(erros).toEqual([]);
  });

  it("no de grafico sem hash em nos_grafico: erros nomeiam o no", () => {
    const erros = conferirGraficosResolvidos({
      manifesto: { nos: [NO_COM_ASSET] },
      assets: {},
      nos_grafico: {},
    });
    expect(erros.length).toBeGreaterThan(0);
    expect(erros.join(" ")).toContain("nao tem hash em nos_grafico");
  });
});
