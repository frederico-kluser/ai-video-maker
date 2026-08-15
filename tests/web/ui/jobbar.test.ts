// =============================================================================
// JobBar — os cinco estados da barra de job (sem DOM)
// =============================================================================
// A barra e a renderizacao pura de derivarJob (estado-jobs.ts): nenhum,
// pendente (enfileirado), rodando (progresso + aria), ok (concluido) e
// erro (mensagem honesta + tentar de novo). FQ-U2/FQ-U4: o erro exibido
// e a mensagem do envelope/CLI, nunca generica; o botao de re-tentativa
// so existe quando o caller o fornece.
// =============================================================================

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { CODIGOS_ERRO, ErroApi } from "../../../src/web/ui/src/api.js";
import { JobBar } from "../../../src/web/ui/src/componentes/JobBar.js";
import { existeTestId, montar, porTestId } from "./ajuda/render.js";
import { jobDe, textosDa } from "./ajuda/stubs.js";

function barraDe(props: Partial<Parameters<typeof JobBar>[0]> = {}) {
  const elemento = createElement(JobBar, {
    job: null,
    resumo: null,
    rotulo: "Gerando roteiro",
    ...props,
  });
  return montar(elemento);
}

describe("JobBar — estados", () => {
  it("nenhum job e nenhum resumo = nada renderizado (a barra nao ocupa espaco)", () => {
    const { arvore } = barraDe();
    expect(arvore.toJSON()).toBeNull();
  });

  it("pendente mostra 'Enfileirado…' com progresso indeterminado", () => {
    const { arvore } = barraDe({ job: jobDe({ estado: "pendente", progresso: null }) });
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("Enfileirado…");
    expect(textos.join("")).toContain("…");
  });

  it("rodando mostra o progresso em % (texto e aria-valuenow)", () => {
    const { arvore } = barraDe({
      job: jobDe({ estado: "rodando", progresso: 0.456, mensagem: "Renderizando frames" }),
      testId: "barra-teste",
    });
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("46%");
    expect(textos.join("")).toContain("Em andamento…");
    expect(textos.join("")).toContain("Renderizando frames");

    const barra = porTestId(arvore, "barra-teste");
    const progressbar = barra.findByProps({ role: "progressbar" });
    expect(progressbar.props["aria-valuenow"]).toBe(46);
    expect(progressbar.props["aria-valuemax"]).toBe(100);
  });

  it("rodando sem progresso (CLI que nao reporta etapas) mostra reticencias e sem aria-valuenow", () => {
    const { arvore } = barraDe({ job: jobDe({ estado: "rodando", progresso: null }), testId: "barra-teste" });
    const barra = porTestId(arvore, "barra-teste");
    const progressbar = barra.findByProps({ role: "progressbar" });
    expect(progressbar.props["aria-valuenow"]).toBeUndefined();
    expect(textosDa(arvore.toJSON()).join(" ")).toContain("…");
  });

  it("ok mostra 'concluido' com a mensagem do job", () => {
    const { arvore } = barraDe({
      job: jobDe({ estado: "ok", artefato: { tipo: "video-mp4", caminho: "/x.mp4" }, mensagem: "video pronto" }),
    });
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("Gerando roteiro concluído — video pronto");
    // Estado ok nao tem botao de tentar de novo.
    expect(existeTestId(arvore, "botao-tentar-novamente")).toBe(false);
  });

  it("ok sem mensagem nao mostra o sufixo ' — '", () => {
    const { arvore } = barraDe({ job: jobDe({ estado: "ok", artefato: { tipo: "audio-wav", caminho: "/x.wav" }, mensagem: "" }) });
    expect(textosDa(arvore.toJSON()).join("")).toBe("Gerando roteiro concluído");
  });

  it("erro mostra a mensagem REAL do envelope e o botao de re-tentativa (FQ-U4)", () => {
    const aoTentarDeNovo = () => undefined;
    const { arvore } = barraDe({
      job: jobDe({ estado: "rodando" }),
      erro: new ErroApi(CODIGOS_ERRO.JOB_EXPIROU, "o job expirou — refaca a operacao", 404),
      aoTentarDeNovo,
      testId: "barra-teste",
      testIdTentarDeNovo: "botao-tentar-novamente",
    });
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("o job expirou — refaca a operacao");
    const botao = porTestId(arvore, "botao-tentar-novamente");
    expect(botao.props.onClick).toBe(aoTentarDeNovo);
  });

  it("erro sem aoTentarDeNovo nao renderiza botao (a barra so decide, o caller decide re-tentar)", () => {
    const { arvore } = barraDe({
      job: jobDe({ estado: "rodando" }),
      erro: { mensagem: "recusado" },
      testId: "barra-teste",
    });
    expect(textosDa(arvore.toJSON()).join(" ")).toContain("recusado");
    expect(existeTestId(arvore, "botao-tentar-novamente")).toBe(false);
  });

  it("erro do envelope vence o ok de um job anterior (nunca sucesso mentiroso)", () => {
    const { arvore } = barraDe({
      job: jobDe({ estado: "ok", artefato: { tipo: "video-mp4", caminho: "/x.mp4" } }),
      erro: { mensagem: "regenerar recusado: pedaco em uso" },
      testId: "barra-teste",
    });
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("regenerar recusado: pedaco em uso");
    expect(textos.join("")).not.toContain("concluído");
  });

  it("ok sem artefato (sucesso mentiroso do servidor) vira ERRO com re-tentativa", () => {
    const { arvore } = barraDe({
      job: jobDe({ estado: "ok", progresso: 1, artefato: null }),
      testId: "barra-teste",
      testIdTentarDeNovo: "botao-tentar-novamente",
      aoTentarDeNovo: () => undefined,
    });
    const textos = textosDa(arvore.toJSON());
    expect(textos.join("")).toContain("o job terminou sem artefato — refaca a operacao");
    expect(existeTestId(arvore, "botao-tentar-novamente")).toBe(true);
  });
});

