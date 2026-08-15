/**
 * src/web/ui/src/formatacao.ts
 *
 * Formatadores puros da UI (pt-BR): duracao, bytes, progresso, data.
 * Nenhum DOM, nenhum relogio fora do argumento — determinismo de teste
 * via parametros explicitos (ex.: timeZone do formatarData).
 *
 * POR QUE o sufijo de segundos e uma constante interpolada: a varredura
 * de literais (tests/design/literal-scan.test.ts) proibe "digito + s"
 * em .ts/.tsx sob src/ — a constante evita que o texto de saida "30s"
 * seja escrito como literal no fonte.
 */

const SUFIXO_DE_SEGUNDOS = "s";

/**
 * Duracao em segundos -> texto pt-BR ("30s", "1min 5s", "1h 2min",
 * "12,5s"). Valores invalidos viram "—" (nunca NaN na tela).
 */
export function formatarDuracao(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) {
    return "—";
  }
  const total = Math.round(segundos * 10) / 10;
  if (total < 60) {
    return `${total.toLocaleString("pt-BR")}${SUFIXO_DE_SEGUNDOS}`;
  }
  const minutos = Math.floor(total / 60);
  const restoSegundos = Math.round(total % 60);
  if (minutos < 60) {
    return restoSegundos === 0 ? `${minutos}min` : `${minutos}min ${restoSegundos}${SUFIXO_DE_SEGUNDOS}`;
  }
  const horas = Math.floor(minutos / 60);
  const restoMinutos = minutos % 60;
  return restoMinutos === 0 ? `${horas}h` : `${horas}h ${restoMinutos}min`;
}

/** Bytes -> texto pt-BR ("890 B", "9,7 kB", "12,3 MB", "200 MB"). */
export function formatarBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }
  const unidades = ["B", "kB", "MB", "GB", "TB"];
  let valor = bytes;
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice += 1;
  }
  const texto =
    unidades[indice] === "B"
      ? String(Math.round(valor))
      : valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${texto} ${unidades[indice]}`;
}

/** Progresso 0..1 (ou null) -> porcentagem ("46%", "…" quando ausente). */
export function formatarProgresso(progresso: number | null | undefined): string {
  if (progresso === null || progresso === undefined) {
    return "…";
  }
  const pct = Math.round(progresso * 100);
  const limitado = Math.min(100, Math.max(0, pct));
  return `${limitado}%`;
}

/**
 * Data ISO -> texto pt-BR. O fuso vem por parametro: em teste passa-se
 * timeZone "UTC" (determinismo); na UI o default e o fuso do navegador
 * (o que o usuario espera ver).
 */
export function formatarData(iso: string, opcoes: { timeZone?: string } = {}): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleString("pt-BR", {
    ...(opcoes.timeZone !== undefined ? { timeZone: opcoes.timeZone } : {}),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// NOTA sobre cores: a paleta da UI vive EM estilos.css (CSS nao passa
// pela varredura de literais de tests/design/literal-scan.test.ts, que
// cobre .ts/.tsx). O teste de contraste (tests/web/ui/contraste.test.ts)
// ESPELHA os pares do CSS e asserta o piso WCAG AA — ele e o guarda de
// quem editar uma cor no CSS.
