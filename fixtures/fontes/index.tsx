// =============================================================================
// Fixture de fontes locais — ponto de entrada do render de prova (F1-03)
// =============================================================================
// Duas composicoes, com papeis opostos:
//
//   fontes-locais          — o still de prova. Renderiza uma sonda por token
//                            tipografico e emite, como <Artifact>, a familia
//                            que o motor de fontes do navegador REALMENTE
//                            resolveu para cada uma. O teste le esse artefato.
//
//   fontes-arquivo-ausente — a sonda negativa. Pede uma fonte que nao existe.
//                            loadFont() chama cancelRender() e o render TEM de
//                            morrer. Se este render passar, o mecanismo inteiro
//                            e teatro: quer dizer que uma fonte faltando nao
//                            derruba nada e o video sai com fallback.
//
// Este arquivo nao e composicao de producao — vive em fixtures/ e so e usado
// por tests/design/font-resolve.test.ts e por `just fontes:testar`.
// =============================================================================

import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Artifact,
  Composition,
  continueRender,
  delayRender,
  registerRoot,
  staticFile,
} from "remotion";
import { loadFont } from "@remotion/fonts";
import {
  ARQUIVO_DE_EVIDENCIA,
  CAMINHO_INEXISTENTE,
  FONTES_LOCAIS,
  SONDAS_TIPOGRAFICAS,
  registrarFontesLocais,
  type SondaTipografica,
} from "../../src/design/fontes/index";
import { coletarEvidencia } from "../../src/design/fontes/resolucao";
import { background, fontWeight, text } from "../../src/design/tokens";

// ---------------------------------------------------------------------------
// Registro das fontes — escopo de modulo, como manda a doc do Remotion.
// Cada loadFont() abre um delayRender() proprio; o render espera sozinho.
// ---------------------------------------------------------------------------
void registrarFontesLocais();

const LARGURA = 1920;
const ALTURA = 1080;
const FPS = 30;
const TAMANHO_DA_SONDA = 56;
const ESPACO = 32;

// ---------------------------------------------------------------------------
// Sonda visual
// ---------------------------------------------------------------------------

const Sonda: React.FC<{ sonda: SondaTipografica }> = ({ sonda }) => {
  return (
    <div
      data-sonda={sonda.id}
      style={{
        fontFamily: sonda.pilha,
        fontWeight: sonda.peso,
        fontStyle: sonda.estilo,
        fontSize: TAMANHO_DA_SONDA,
        color: text.primary,
        marginBottom: ESPACO,
        whiteSpace: "nowrap",
      }}
    >
      {sonda.texto}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Coletor da evidencia
// ---------------------------------------------------------------------------
// Abre um delayRender proprio, espera document.fonts.ready, le a familia
// resolvida de cada sonda e so entao libera o quadro. O continueRender fica
// num efeito que depende da evidencia ja estar no estado, para garantir que o
// <Artifact> foi commitado ANTES de o Remotion capturar o quadro.
// ---------------------------------------------------------------------------

const Coletor: React.FC = () => {
  const [evidencia, setEvidencia] = useState<string | null>(null);
  const [espera] = useState(() =>
    delayRender("Lendo a familia resolvida de cada sonda tipografica"),
  );

  useEffect(() => {
    let vivo = true;
    document.fonts.ready
      .then(() => {
        if (!vivo) {
          return;
        }
        const urls = FONTES_LOCAIS.map((f) => staticFile(f.caminhoPublico));
        setEvidencia(
          JSON.stringify(coletarEvidencia(SONDAS_TIPOGRAFICAS, urls), null, 2),
        );
      })
      .catch((err: unknown) => {
        // Nao engolir: sem evidencia o still nao prova nada.
        throw err;
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (evidencia !== null) {
      continueRender(espera);
    }
  }, [evidencia, espera]);

  if (evidencia === null) {
    return null;
  }
  return <Artifact filename={ARQUIVO_DE_EVIDENCIA} content={evidencia} />;
};

// ---------------------------------------------------------------------------
// Composicao de prova
// ---------------------------------------------------------------------------

const FontesLocais: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: background.primary,
        justifyContent: "center",
        padding: ESPACO,
      }}
    >
      {SONDAS_TIPOGRAFICAS.map((sonda) => (
        <Sonda key={sonda.id} sonda={sonda} />
      ))}
      <Coletor />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Sonda negativa — arquivo ausente
// ---------------------------------------------------------------------------
// O loadFont() e disparado no inicializador do useState, ou seja, durante o
// primeiro render e ANTES do primeiro commit. Isso garante que o delayRender
// interno do loadFont ja esta aberto quando o Remotion vai capturar o quadro —
// sem isso haveria corrida e o render poderia sair antes da falha aparecer.
// ---------------------------------------------------------------------------

const ArquivoAusente: React.FC = () => {
  useState(() => {
    void loadFont({
      family: "SondaNegativaSemArquivo",
      url: staticFile(CAMINHO_INEXISTENTE),
      weight: String(fontWeight.regular),
      style: "normal",
      format: "woff2",
    });
    return null;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: background.primary }}>
      <div
        style={{
          fontFamily: "SondaNegativaSemArquivo",
          fontSize: TAMANHO_DA_SONDA,
          color: text.primary,
        }}
      >
        Este render tem de falhar.
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="fontes-locais"
        component={FontesLocais}
        durationInFrames={1}
        fps={FPS}
        width={LARGURA}
        height={ALTURA}
      />
      <Composition
        id="fontes-arquivo-ausente"
        component={ArquivoAusente}
        durationInFrames={1}
        fps={FPS}
        width={LARGURA}
        height={ALTURA}
      />
    </>
  );
};

registerRoot(RemotionRoot);
