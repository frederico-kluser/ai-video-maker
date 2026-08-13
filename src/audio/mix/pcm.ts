/**
 * src/audio/mix/pcm.ts
 *
 * PCM COMO DADO — a moeda interna do mix (card F3-05, W7). ADR-0034.
 *
 * O mix trabalha sobre amostras em ponto flutuante (f32) em um formato
 * declarado (rate, canais), e serializa/parseia WAV nos dois formatos que
 * o pipeline usa:
 *
 *   - WAV PCM s16 (mono 16 kHz): o formato do audio-FONTE da locucao
 *     (cassete F2-03) e o da EMENDA (C3 — a emenda preserva o formato da
 *     fonte; nunca e reamostrada);
 *   - WAV f32le: o master do mix (estéreo 48 kHz — decisao do ADR-0034,
 *     D1). O f32 preserva a medicao de clip (|amostra| > 1.0 = clip) que
 *     um s16 jah perderia na quantizacao.
 *
 * Tudo aqui e funcao pura dos bytes/amostras: dois processamentos sobre
 * os mesmos bytes produzem os mesmos bytes. O parse REJEITA formato que
 * o modulo nao conhece (nunca silencio, nunca chute) e o encoder escreve
 * apenas os chunks fmt+data — nada de metadado de ferramenta (o WAV e
 * enderecado por conteudo: metadado de versao dentro do arquivo tornaria
 * o hash dependente da ferramenta).
 */

// ─── O formato interno ─────────────────────────────────────────────────────────

/**
 * PCM em ponto flutuante, amostras INTERCALADAS (L,R,L,R,...).
 *
 * Amostras em [-1, 1] — a guarda de clip mede |amostra| > 1.0 no master.
 */
export interface Pcm {
  /** Taxa de amostragem em Hz. */
  readonly rate: number;
  /** Quantidade de canais (1 = mono, 2 = estéreo). */
  readonly canais: number;
  /** Amostras intercaladas; comprimento multiplo de `canais`. */
  readonly amostras: Float32Array;
}

/** Duracao do PCM em segundos (aritmetica exata: amostras/rate/canais). */
export function duracaoPcm(pcm: Pcm): number {
  return pcm.amostras.length / pcm.canais / pcm.rate;
}

/** Indice da amostra (de canal 0) mais proxima do instante t (segundos). */
export function amostraEm(pcm: Pcm, t: number): number {
  return Math.round(t * pcm.rate);
}

/**
 * Indice da amostra (de canal 0) que comeca a regiao [inicio, fim] em
 * segundos, com o arredondamento DIRIGIDO para dentro da regiao
 * (floor no inicio, ceil no fim) — cortes nunca comem amostra de fora.
 */
export function amostrasDaRegiao(
  pcm: Pcm,
  inicioS: number,
  fimS: number,
): { inicio: number; fim: number } {
  const inicio = Math.max(0, Math.floor(inicioS * pcm.rate));
  const fim = Math.min(
    pcm.amostras.length / pcm.canais,
    Math.ceil(fimS * pcm.rate),
  );
  if (fim <= inicio) {
    throw new EMixPcmInvalido(
      `regiao ${inicioS}..${fimS}s nao contem amostra nenhuma a ${pcm.rate} Hz`,
    );
  }
  return { inicio, fim };
}

// ─── Erros ─────────────────────────────────────────────────────────────────────

/** PCM que nao pode existir: formato desconhecido, regiao invalida. */
export class EMixPcmInvalido extends Error {
  readonly code = "MIX_PCM_INVALIDO";
  constructor(detalhe: string) {
    super(`PCM do mix invalido: ${detalhe}`);
    this.name = "EMixPcmInvalido";
  }
}

// ─── Parse / encode de WAV ─────────────────────────────────────────────────────

/**
 * Le um WAV PCM (s16le ou f32le) e devolve o PCM em f32.
 *
 * Rejeita codec que nao seja PCM linear (uma entrada AAC/MP3 "entraria"
 * com bytes errados e o mix ficaria verde sobre lixo); rejeita rate zero
 * e canais zero (divisao indefinida). O parse varre os chunks RIFF em
 * vez de assumir offset 44 — mesma disciplina do F2-03 (provedor.ts).
 *
 * @throws EMixPcmInvalido se os bytes nao forem um WAV PCM conhecido.
 */
export function lerWavPcm(bytes: Buffer): Pcm {
  if (
    bytes.length < 44 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new EMixPcmInvalido("bytes nao sao um WAV RIFF/WAVE");
  }

  let rate = 0;
  let canais = 0;
  let bits = 0;
  let offset = 12;
  let dados: Buffer | null = null;

  while (offset + 8 <= bytes.length) {
    const chunkId = bytes.toString("ascii", offset, offset + 4);
    const tamanho = bytes.readUInt32LE(offset + 4);
    const corpo = offset + 8;
    if (corpo + tamanho > bytes.length) {
      throw new EMixPcmInvalido(`chunk "${chunkId}" estoura o arquivo`);
    }
    if (chunkId === "fmt ") {
      let formato = bytes.readUInt16LE(corpo);
      if (formato === 0xfffe) {
        // WAVE_FORMAT_EXTENSIBLE (0xFFFE): o formato real esta no GUID
        // SubFormat (offset 40 do chunk fmt, apos cbSize em 16). O
        // ffmpeg grava extensible para f32 — sem isso o parse rejeitaria
        // o proprio decode do gate.
        const sub = corpo + 24;
        if (sub + 2 > bytes.length) {
          throw new EMixPcmInvalido("fmt extensible sem SubFormat");
        }
        formato = bytes.readUInt16LE(sub);
      }
      if (formato !== 1 && formato !== 3) {
        throw new EMixPcmInvalido(
          `formato de audio ${formato} (esperado 1=PCM s16 ou 3=IEEE float)`,
        );
      }
      canais = bytes.readUInt16LE(corpo + 2);
      rate = bytes.readUInt32LE(corpo + 4);
      bits = bytes.readUInt16LE(corpo + 14);
      if (formato === 1 && bits !== 16) {
        throw new EMixPcmInvalido(`PCM inteiro com ${bits} bits (esperado 16)`);
      }
      if (formato === 3 && bits !== 32) {
        throw new EMixPcmInvalido(`IEEE float com ${bits} bits (esperado 32)`);
      }
    } else if (chunkId === "data") {
      dados = bytes.subarray(corpo, corpo + tamanho);
    }
    offset = corpo + tamanho + (tamanho % 2); // chunks RIFF sao alinhados a 2
  }

  if (dados === null) {
    throw new EMixPcmInvalido("WAV sem chunk data");
  }
  if (rate <= 0 || canais <= 0 || bits <= 0) {
    throw new EMixPcmInvalido("chunk fmt ausente ou incompleto");
  }

  const amostras = new Float32Array(dados.length / (bits / 8));
  if (bits === 16) {
    for (let i = 0; i < amostras.length; i++) {
      amostras[i] = dados.readInt16LE(i * 2) / 32768;
    }
  } else {
    for (let i = 0; i < amostras.length; i++) {
      amostras[i] = dados.readFloatLE(i * 4);
    }
  }

  return { rate, canais, amostras };
}

/**
 * Encoda PCM em WAV. `bits` 16 = s16le (formato da fonte e da emenda),
 * 32 = f32le (master do mix). Nenhum metadado alem de fmt+data: o arquivo
 * e enderecado por conteudo, e metadado de ferramenta quebraria o hash.
 */
export function escreverWavPcm(pcm: Pcm, bits: 16 | 32): Buffer {
  const bytesPorAmostra = bits / 8;
  const tamanhoDados = pcm.amostras.length * bytesPorAmostra;
  const cabecalho = Buffer.alloc(44);

  cabecalho.write("RIFF", 0, "ascii");
  cabecalho.writeUInt32LE(36 + tamanhoDados, 4);
  cabecalho.write("WAVE", 8, "ascii");
  cabecalho.write("fmt ", 12, "ascii");
  cabecalho.writeUInt32LE(16, 16); // tamanho do chunk fmt
  cabecalho.writeUInt16LE(bits === 16 ? 1 : 3, 20); // 1=PCM, 3=IEEE float
  cabecalho.writeUInt16LE(pcm.canais, 22);
  cabecalho.writeUInt32LE(pcm.rate, 24);
  cabecalho.writeUInt32LE(pcm.rate * pcm.canais * bytesPorAmostra, 28);
  cabecalho.writeUInt16LE(pcm.canais * bytesPorAmostra, 32);
  cabecalho.writeUInt16LE(bits, 34);
  cabecalho.write("data", 36, "ascii");
  cabecalho.writeUInt32LE(tamanhoDados, 40);

  const corpo = Buffer.allocUnsafe(tamanhoDados);
  if (bits === 16) {
    for (let i = 0; i < pcm.amostras.length; i++) {
      const v = pcm.amostras[i] ?? 0;
      const s = Math.max(-1, Math.min(1, v));
      corpo.writeInt16LE(Math.round(s * 32767), i * 2);
    }
  } else {
    for (let i = 0; i < pcm.amostras.length; i++) {
      corpo.writeFloatLE(pcm.amostras[i] ?? 0, i * 4);
    }
  }
  return Buffer.concat([cabecalho, corpo]);
}

// ─── Operacoes de mixagem (puras) ─────────────────────────────────────────────

/**
 * Converte o PCM para o numero de canais do master. Mono -> estereo
 * (centro: L = R = amostra) — a locucao e mono por contrato e o master
 * e estereo (ADR-0034, D1). Qualquer outra conversao e ERRO (o mix nao
 * inventa posicionamento de canal).
 */
export function paraCanais(pcm: Pcm, canais: number): Pcm {
  if (pcm.canais === canais) return pcm;
  if (pcm.canais === 1 && canais === 2) {
    const amostras = new Float32Array(pcm.amostras.length * 2);
    for (let i = 0; i < pcm.amostras.length; i++) {
      const v = pcm.amostras[i] ?? 0;
      amostras[i * 2] = v;
      amostras[i * 2 + 1] = v;
    }
    return { rate: pcm.rate, canais, amostras };
  }
  throw new EMixPcmInvalido(
    `conversao de ${pcm.canais} para ${canais} canais nao suportada ` +
      "(so mono -> estereo)",
  );
}

/**
 * Estende/trunca um PCM para uma duracao (em segundos), zerando o resto.
 * Usado para montar faixas do tamanho do mix.
 */
export function pcmNaDuracao(pcm: Pcm, duracaoS: number): Pcm {
  const total = Math.ceil(duracaoS * pcm.rate) * pcm.canais;
  const amostras = new Float32Array(total);
  amostras.set(pcm.amostras.subarray(0, Math.min(total, pcm.amostras.length)));
  return { rate: pcm.rate, canais: pcm.canais, amostras };
}

/**
 * Aplica ganho LINEAR (amplitude) ao PCM, retornando novo buffer.
 * Nao toca o original (o mix precisa da musica crua para medir).
 */
export function comGanho(pcm: Pcm, ganho: number): Pcm {
  const amostras = new Float32Array(pcm.amostras.length);
  for (let i = 0; i < amostras.length; i++) {
    amostras[i] = (pcm.amostras[i] ?? 0) * ganho;
  }
  return { rate: pcm.rate, canais: pcm.canais, amostras };
}

/** Soma dois PCM do MESMO formato, amostra a amostra (novo buffer). */
export function somar(a: Pcm, b: Pcm): Pcm {
  if (a.rate !== b.rate || a.canais !== b.canais) {
    throw new EMixPcmInvalido(
      `soma de formatos diferentes: ${a.rate}/${a.canais} x ${b.rate}/${b.canais}`,
    );
  }
  const tamanho = Math.max(a.amostras.length, b.amostras.length);
  const amostras = new Float32Array(tamanho);
  for (let i = 0; i < tamanho; i++) {
    amostras[i] = (a.amostras[i] ?? 0) + (b.amostras[i] ?? 0);
  }
  return { rate: a.rate, canais: a.canais, amostras };
}

/**
 * Soma um PCM (menor) DENTRO de outro, deslocado por um atraso em
 * amostras (de canal 0). Usado para posicionar a fala na timeline.
 */
export function sobrepor(
  base: Pcm,
  inserido: Pcm,
  atrasoAmostras: number,
): Pcm {
  if (base.rate !== inserido.rate || base.canais !== inserido.canais) {
    throw new EMixPcmInvalido(
      `sobreposicao de formatos diferentes: ` +
        `${base.rate}/${base.canais} x ${inserido.rate}/${inserido.canais}`,
    );
  }
  const inicio = atrasoAmostras * base.canais;
  const amostras = Float32Array.from(base.amostras);
  for (let i = 0; i < inserido.amostras.length; i++) {
    const alvo = inicio + i;
    if (alvo >= amostras.length) break;
    amostras[alvo] = (amostras[alvo] ?? 0) + (inserido.amostras[i] ?? 0);
  }
  return { rate: base.rate, canais: base.canais, amostras };
}

/**
 * Recorta um trecho [inicioS, fimS) do PCM (novo buffer). As fronteiras
 * sao arredondadas para dentro da regiao (floor/ceil) — o mesmo
 * arredondamento de `amostrasDaRegiao`, para cortes nunca comerem amostra
 * de fora.
 */
export function recortar(pcm: Pcm, inicioS: number, fimS: number): Pcm {
  const { inicio, fim } = amostrasDaRegiao(pcm, inicioS, fimS);
  const amostras = pcm.amostras.subarray(inicio * pcm.canais, fim * pcm.canais);
  return {
    rate: pcm.rate,
    canais: pcm.canais,
    amostras: Float32Array.from(amostras),
  };
}

/** Energia RMS (raiz da media quadratica) de um trecho, em [0, 1]. */
export function rms(pcm: Pcm, inicioS: number, fimS: number): number {
  const { inicio, fim } = amostrasDaRegiao(pcm, inicioS, fimS);
  let soma = 0;
  for (let i = inicio * pcm.canais; i < fim * pcm.canais; i++) {
    const v = pcm.amostras[i] ?? 0;
    soma += v * v;
  }
  const n = Math.max(1, (fim - inicio) * pcm.canais);
  return Math.sqrt(soma / n);
}

/** Amplitude de pico absoluta do PCM inteiro (para a guarda de clip). */
export function picoAbsoluto(pcm: Pcm): number {
  let pico = 0;
  for (const v of pcm.amostras) {
    const a = Math.abs(v);
    if (a > pico) pico = a;
  }
  return pico;
}

/** O mix estourou o teto de 0 dBFS — um master que nao pode existir. */
export class EMixClipado extends Error {
  readonly code = "MIX_CLIPADO";
  readonly pico: number;
  constructor(pico: number, t: number) {
    super(
      `O mix clipa: pico ${pico.toFixed(3)} (> 1.0 = 0 dBFS) em t=${t.toFixed(3)}s. ` +
        "A soma das faixas estoura o teto — reduza os volumes ou o ducking.",
    );
    this.name = "EMixClipado";
    this.pico = pico;
  }
}

/**
 * Guarda de clip: qualquer amostra com |v| > 1.0 derruba o mix.
 * Medida nos BYTES do master (f32), nunca por escuta.
 */
export function conferirClip(pcm: Pcm): void {
  for (let i = 0; i < pcm.amostras.length; i++) {
    const v = pcm.amostras[i] ?? 0;
    if (Math.abs(v) > 1.0) {
      const t = i / pcm.canais / pcm.rate;
      throw new EMixClipado(Math.abs(v), t);
    }
  }
}
