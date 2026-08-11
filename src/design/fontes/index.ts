// =============================================================================
// FONTES LOCAIS EMBUTIDAS — F1-03
// =============================================================================
// Fonte do problema: AGENTS.md, C6 — "Uma fonte que nao carregou cai para
// fallback sem erro". O video sai com a tipografia errada e nada fica vermelho.
// Este modulo existe para tornar esse silencio impossivel.
//
// MECANISMO — @remotion/fonts loadFont()
//   https://www.remotion.dev/docs/fonts-api/load-font
//   "Automatically blocks the render until the font is ready."
// A implementacao envolve o carregamento em delayRender()/continueRender() e,
// no catch, chama cancelRender(err). Consequencia direta: uma fonte que nao
// carrega DERRUBA o render. Ela nao cai em fallback silencioso.
// Um @font-face puro em CSS nao tem essa garantia — o render tira o quadro
// enquanto a fonte ainda esta chegando, ou nunca chega, e ninguem fica sabendo.
//
// ZERO REDE — os bytes canonicos vivem em assets/fontes/. O diretorio publico
// do Remotion (public/) so tem o link simbolico public/fontes -> ../assets/fontes,
// entao staticFile() funciona com a configuracao padrao, sem duplicar arquivo e
// sem tocar em nenhum arquivo de configuracao compartilhado. Nenhum endereco
// remoto aparece em lugar nenhum: o render e offline por construcao.
//
// PESO E ESTILO SAO PARTE DA IDENTIDADE — "Inter" nao e uma fonte. Cada entrada
// abaixo fixa familia + peso + estilo + formato. O formato e declarado, nunca
// inferido pela extensao do arquivo.
//
// LICENCA — SIL Open Font License 1.1 (assets/fontes/OFL.txt).
// Ficha por familia, com o direito de embutir declarado e verificado:
//   assets/fontes/Inter.md
//   assets/fontes/JetBrainsMono.md
// =============================================================================

import { loadFont, type LoadFontOptions } from "@remotion/fonts";
import { staticFile } from "remotion";
import { fontFamily, fontWeight } from "../tokens";

// =============================================================================
// Catalogo
// =============================================================================

/** Formato de arquivo aceito por loadFont() */
export type FormatoDeFonte = NonNullable<LoadFontOptions["format"]>;

/** Uma face concreta: familia + peso + estilo + arquivo */
export interface FonteLocal {
  /**
   * Nome da familia CSS. Tem de casar com o name ID 1 do binario —
   * `just fontes-licenca` compara os dois.
   */
  familia: string;
  /** Nome do arquivo dentro de assets/fontes/ (fonte da verdade dos bytes) */
  arquivo: string;
  /** Caminho dentro do diretorio publico do bundle */
  caminhoPublico: string;
  /** Peso CSS. LoadFontOptions exige string, nao numero. */
  peso: string;
  /** Estilo CSS */
  estilo: "normal" | "italic";
  /** Formato declarado — nao deixamos loadFont() adivinhar pela extensao */
  formato: FormatoDeFonte;
  /** Peso esperado dentro do binario (OS/2.usWeightClass) */
  pesoNoBinario: number;
  /** Subfamilia esperada dentro do binario (name ID 2) */
  subfamiliaNoBinario: string;
  /** Ficha de licenca que autoriza embutir este arquivo */
  ficha: string;
  /** Para que esta face serve no video */
  papel: string;
}

/** Subdiretorio das fontes dentro do diretorio publico (public/fontes) */
export const SUBDIRETORIO_DAS_FONTES = "fontes";

/** Onde os bytes canonicos moram, relativo a raiz do repositorio */
export const DIRETORIO_CANONICO = "assets/fontes";

const woff2: FormatoDeFonte = "woff2";

/**
 * Toda fonte embutida no projeto. Nada fora desta lista e carregado.
 */
export const FONTES_LOCAIS: readonly FonteLocal[] = [
  {
    familia: "Inter",
    arquivo: "Inter-Regular.woff2",
    caminhoPublico: `${SUBDIRETORIO_DAS_FONTES}/Inter-Regular.woff2`,
    peso: String(fontWeight.regular),
    estilo: "normal",
    formato: woff2,
    pesoNoBinario: fontWeight.regular,
    subfamiliaNoBinario: "Regular",
    ficha: "Inter.md",
    papel: "Texto corrido, legendas, interface",
  },
  {
    familia: "Inter",
    arquivo: "Inter-Bold.woff2",
    caminhoPublico: `${SUBDIRETORIO_DAS_FONTES}/Inter-Bold.woff2`,
    peso: String(fontWeight.bold),
    estilo: "normal",
    formato: woff2,
    pesoNoBinario: fontWeight.bold,
    subfamiliaNoBinario: "Bold",
    ficha: "Inter.md",
    papel: "Titulos e display",
  },
  {
    familia: "JetBrains Mono",
    arquivo: "JetBrainsMono-Regular.woff2",
    caminhoPublico: `${SUBDIRETORIO_DAS_FONTES}/JetBrainsMono-Regular.woff2`,
    peso: String(fontWeight.regular),
    estilo: "normal",
    formato: woff2,
    pesoNoBinario: fontWeight.regular,
    subfamiliaNoBinario: "Regular",
    ficha: "JetBrainsMono.md",
    papel: "Codigo fonte",
  },
];

// =============================================================================
// Registro
// =============================================================================

let registrado: Promise<void> | null = null;

/**
 * Carrega todas as fontes locais.
 *
 * Idempotente: chamadas repetidas devolvem a mesma promessa.
 * Cada loadFont() abre um delayRender() proprio, entao basta chamar isto no
 * escopo de modulo do ponto de entrada — o render espera sozinho.
 *
 * Se qualquer arquivo faltar ou estiver corrompido, loadFont() chama
 * cancelRender() e o render morre. E esse o ponto.
 */
export function registrarFontesLocais(): Promise<void> {
  if (registrado !== null) {
    return registrado;
  }
  registrado = Promise.all(
    FONTES_LOCAIS.map((fonte) =>
      loadFont({
        family: fonte.familia,
        url: staticFile(fonte.caminhoPublico),
        weight: fonte.peso,
        style: fonte.estilo,
        format: fonte.formato,
      }),
    ),
  ).then(() => undefined);
  return registrado;
}

/** Desfaz a memoizacao. Somente para teste. */
export function esquecerRegistroDeFontes(): void {
  registrado = null;
}

/** Ja houve chamada a registrarFontesLocais()? */
export function fontesForamRegistradas(): boolean {
  return registrado !== null;
}

// =============================================================================
// Sondas — o que o render tem de provar
// =============================================================================

/**
 * Familia que NUNCA e registrada. Serve de controle: se a leitura da familia
 * resolvida devolvesse "resolveu" para tudo, esta sonda pegaria (C2 — um
 * oraculo que so sabe dizer sim nao e oraculo).
 */
export const FAMILIA_DE_CONTROLE = "FamiliaQueNaoExisteNesteProjeto";

/** Arquivo que o render nao tem — usado pela sonda negativa de carregamento */
export const CAMINHO_INEXISTENTE = `${SUBDIRETORIO_DAS_FONTES}/EsteArquivoNaoExiste.woff2`;

/** Nome do artefato com a evidencia colhida dentro do navegador do render */
export const ARQUIVO_DE_EVIDENCIA = "familias-resolvidas.json";

/** Uma sonda: um elemento de texto e a familia que ele TEM de resolver */
export interface SondaTipografica {
  /** Identificador do elemento, via atributo data-sonda */
  id: string;
  /** Pilha CSS exatamente como o token entrega — e o token que esta em teste */
  pilha: string;
  /** Peso CSS aplicado ao elemento */
  peso: string;
  /** Estilo CSS aplicado ao elemento */
  estilo: "normal" | "italic";
  /** Familia que tem de resolver. null = nenhuma deve resolver (controle). */
  familiaEsperada: string | null;
  /** Texto renderizado */
  texto: string;
}

/** Texto das sondas — cobre caixa alta, caixa baixa, digitos e acento pt-BR */
const TEXTO_DA_SONDA = "Aa Bb Cc — 0123 acentuacao: coracao, informacao";

/**
 * As sondas partem dos TOKENS, nao de strings escritas a mao. Se alguem trocar
 * fontFamily.sans por uma familia que nao esta embutida, esta sonda fica
 * vermelha — o gate protege o token, nao uma copia dele.
 */
export const SONDAS_TIPOGRAFICAS: readonly SondaTipografica[] = [
  {
    id: "sans-regular",
    pilha: fontFamily.sans,
    peso: String(fontWeight.regular),
    estilo: "normal",
    familiaEsperada: "Inter",
    texto: TEXTO_DA_SONDA,
  },
  {
    id: "display-bold",
    pilha: fontFamily.display,
    peso: String(fontWeight.bold),
    estilo: "normal",
    familiaEsperada: "Inter",
    texto: TEXTO_DA_SONDA,
  },
  {
    id: "mono-regular",
    pilha: fontFamily.mono,
    peso: String(fontWeight.regular),
    estilo: "normal",
    familiaEsperada: "JetBrains Mono",
    texto: TEXTO_DA_SONDA,
  },
  {
    id: "controle-sem-fonte",
    pilha: FAMILIA_DE_CONTROLE,
    peso: String(fontWeight.regular),
    estilo: "normal",
    familiaEsperada: null,
    texto: TEXTO_DA_SONDA,
  },
];
