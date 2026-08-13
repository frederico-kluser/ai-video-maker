# ADR-0034 — Mix de audio composto: medido, nunca escutado

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F3-05 (W7, caminho critico do audio)
- **Depende de:** F3-01 (timing canonico), F3-03 (envelope de ducking,
  ADR-0028), F3-04 (ritmo/cadencia, ADR-0029), F1-01 (aritmetica da
  composicao), F2-06 (trilha, ADR-0012), F0-07 (store por conteudo)
- **Consumido por:** F5-01 (render integrado, W7 — posiciona os bytes da
  EMENDA), F5-06 (procedencia da emenda, W7), F5-03 (loudness, W8)

> Consolida o contrato congelado de docs/contrato-w7.md §2 (C1), §4 (C3)
> e §6 (emendas do card) na forma de decisao registrada — o mix como
> FUNCAO PURA dos contratos fechados, com a emenda materializada (AB-617)
> e a medida "a musica cobre a locucao?" feita nos bytes, nunca por escuta.

## Contexto

O card pede: "Trilha de audio composta — 'a musica cobre a locucao?' meça,
não escute", com tres ∅-crits: mix sem locucao e VERMELHO; duas locucoes
simultaneas por mais de 0,1 s e VERMELHO (C1 item 4); emenda enderecada
pelo hash do audio-fonte e VERMELHO (C3). Tres problemas se acumulam sem
decisao registrada:

1. **O que o mix soma.** A locucao (audio TTS por cena), a musica (F2-06)
   e a emenda — e em que forma, em que taxa, com que volumes e como o
   envelope de ducking (F3-03) e aplicado. A fixture canonica prova o caso
   caro: c-004 tem fala de 8,505 s numa janela visual de 4 s e as falas de
   c-004/c-005 se sobrepoem em 4,505 s na timeline absoluta — quem manda?
2. **O que e a emenda.** O F3-04 (ADR-0029) declarou que a cadencia
   preserva `audio` = hash da FONTE e que "quem materializa o audio
   emendado e o F3-05/F5-01 na W7 — ver AB-617". A materializacao (bytes
   + hash novos, enderecaveis por conteudo) e a identidade nova da emenda.
3. **Como medir "a musica cobre a locucao".** Sem escuta: a medida tem de
   ser numeros sobre os bytes do mix, com limiares declarados.

## Decisao

### D1 — O mix e funcao pura dos contratos fechados; o master e f32 estéreo 48 kHz

`mixar()` em `src/audio/mix/mixar.ts` e funcao pura de (timing canonico +
envelope + cadencia + posicoes da aritmetica F1-01 + volumes do manifesto +
bytes dos assets). O master e WAV f32le (o f32 preserva a medicao de clip
que o s16 perderia na quantizacao) estereo 48 kHz; a locucao mono sobe
para o centro (L = R). A reamostragem/decodificacao e da FERRAMENTA pinada
(ffmpeg 6.1.1, gravado em `MixDocument.ferramentas`): o modulo nao
reamostra, e o determinismo entre versoes e DECLARADO por pin, nunca por
reimplementacao. Determinismo 2x provado em dois processos separados com
TZ/LANG propositalmente diferentes (C9).

### D2 — A emenda preserva o formato da fonte e ganha bytes + hash NOVOS (C3)

A emenda (palavras na ordem, ligadas pelas lacunas restantes) e os bytes
da fonte menos as regioes de corte da cadencia — WAV s16 na taxa da fonte
(16 kHz mono), nunca reamostrada: a emenda e uma EDICAO da fonte, e o hash
"a fonte editada" so existe se o formato nao mudar. A duracao emendada
materializa EXATAMENTE a duracao declarada pelo documento compactado da
cadencia (Ritmo.1 item 5: o corte nunca muda a duracao sem atualizar o
documento; a quantizacao das fronteiras em amostras e ajustada na cauda,
que e silencio declarado). Os bytes + hash novos sao publicados no store
(F0-07) e enderecaveis por conteudo; com cortes na cadencia, o hash da
emenda e SEMPRE distinto do hash da fonte (∅-crit C3 — a emenda tratada
como se fosse a fonte e o falso-verde perseguido). Sem cortes, a emenda e
a fonte byte a byte e o hash coincide por enderecamento de conteudo —
correto, e o caso de estresse (cadencia cortante, gapAlvo 0,05) exercita
a identidade nova de verdade.

### D3 — O ganho do envelope acompanha a fala EMENDADA (C1 item 2)

"a atenuacao acompanha a fala, nao a janela visual" — e a fala do mix e a
EMENDADA. O ganho aplicado em cada instante do master e:
`ganhoEm(envelope, posicaoDaCena + posicaoOriginal(local))` dentro do span
emendado da cena (a inversa da compactacao da cadencia, a mesma iteracao
do oraculo do F3-04); fora dos spans — inclusive na cauda cortada pela
reconciliacao — vale o envelope plano: a cauda removida continua coberta
(C1 item 3, "envelope estendido"). Com a cadencia default (sem cortes), a
inversa e a identidade e o ganho e o do ADR-0028.

### D4 — Reconciliacao por CORTE SECO: cena posterior manda (C1 itens 3 e 4)

A fala da cena carrega ALEM da janela visual (a duracao e a do timing,
nunca a janela — C1 item 1) e comeca no INICIO ABSOLUTO da cena
(frameInicial/fps, AB-520 — C1 item 2). Onde duas falas se sobrepoem por
mais de 0,1 s, a cauda da anterior e cortada exatamente no inicio da
posterior (C1 item 3). O corte e SECO (sem fade): o fade e alternativa
registrada para a calibracao por escuta (AB-662). A sobreposicao residual
> 0,1 s no mix e ERRO (C1 item 4), medida nos bytes.

### D5 — As medicoes do oraculo e seus limiares declarados

`verificar.ts` (o oraculo) rededuz as colocacoes dos MESMOS inputs e mede
nos bytes; problemas vazio = VERDE. Limiares:

| Limiar | Valor | Regra |
|---|---|---|
| sobreposicao residual | > 0,1 s = ERRO | C1 item 4 |
| atenuacao medida vs declarada | ±1 dB | o mix aplica o envelope que o documento declara |
| atenuacao onde a fala existe | <= -6 dB | o ducking nao pode sumir |
| margem fala/musica | >= 6 dB | a musica nunca cobre a fala |
| piso de RMS da fala | 1e-3 | presenca de energia (≈ -60 dBFS) |

A medida "a musica cobre a locucao?" (adversarial 3) e: em cada intervalo
de fala, os bytes do mix DIFEREM do mix sem envelope (o envelope TEM
efeito onde a fala existe) e a atenuacao medida bate com a declarada. A
medida de clip (adversarial 1) e o pico absoluto dos bytes <= 1.0. Os
limiares nao sao calibrados por escuta (AB-661); a calibracao humana e da
W10/F6-01 (contrato-w7 §13, roteamento de AB-602/603).

### D6 — MixDocument.1: o mix e bytes + documento de colocacao

O documento declara onde cada faixa toca (inicio_s/fim_s absolutos, hash
da fonte e da emenda por cena, hash e intervalo da musica, pins de
ferramenta). O oraculo nao confia no documento: rededuz as colocacoes dos
inputs e compara byte a byte com os bytes produzidos.

## Alternativas consideradas / descartadas

| Alternativa | Por que descartada |
|---|---|
| Compressor em tempo de mix | Saida nao-deterministica entre versoes — quebra a fronteira (ADR-0028) |
| Mix na taxa da fonte (16 kHz) | A trilha e 44,1 kHz; o master do video e 48 kHz; a reamostragem e da ferramenta pinada |
| Emenda reamostrada para 48 kHz | O hash da emenda deixaria de ser "a fonte editada"; a emenda e a EDICAO da fonte (C3) |
| Reconciliacao com fade | O fade e alternativa; o corte seco e o minimo que o C1 pede ("cortada OU fadeada") e e deterministico; a escolha de fade fica para a escuta (AB-662) |
| Envelope plano (sem mapeamento pela cadencia) | Com cadencia cortante, a atenuacao desalinharia da fala emendada — contraria o C1 item 2 |
| Verificacao por escuta ou por forma de onda | O card manda medir; a forma de onda e frágil por construcao (video-characterization) |

## Consequencias

### Positivas

- Os tres ∅-crits do card sao exercitados por sondas que TEM de ficar
  VERMELHAS, com a mensagem assertada (falsifiable-gates).
- A pergunta da onda (§12) tem resposta executavel: "a fala de c-004 esta
  em [14,233..22,738] com a cauda cortada no inicio de c-005" — os MESMOS
  numeros que o F5-01 deriva dos MESMOS inputs.
- O F5-01 (W7) consome a emenda pelos bytes novos (C3) e o F5-06 registra
  a origem deles (a fonte e a operacao de corte).

### Custos e desvios registrados

- **AB-660** — o determinismo do decode do ffmpeg e provado 2x na maquina
  local; a igualdade entre maquinas com o mesmo pin e assumida (verificavel
  no CI).
- **AB-661** — limiares de cobertura (margem 6 dB, tolerancia 1 dB) e o
  piso de RMS sao numeros de engenharia, nao calibrados por escuta.
- **AB-662** — o corte seco da reconciliacao pode clicar na cauda cortada
  (a fixture c-004 corta no meio de uma palavra — estresse deliberado).
- **AB-663** — o mapeamento do envelope pela cadencia (D3) so sera validado
  por escuta no primeiro render integrado (F5-01/F5-07).

## Revisao adversarial

- **"O mix usa o mesmo codigo para construir e verificar — nao e circular?"**
  A rededucao do oraculo parte dos INPUTS (timing, cadencia, envelope,
  posicoes, bytes) — os contratos congelados com oraculos proprios (F3-01/
  03/04) — e as sondas mutam o ARTEFATO: mix sem locucao, sem reconciliacao,
  com a emenda enderecada pela fonte, sem envelope, com clip. Cada sonda
  TEM de ficar VERMELHA com a mensagem certa; o gate falha se uma sonda
  passar. A rededucao de colocacao (`spansEsperados`) usa a duracao do
  DOCUMENTO da cadencia, nao os bytes da emenda — um erro de materializacao
  aparece como divergencia de bytes ou de documento.
- **"E se o merge do F5-01 mudar os inputs?"** Nenhuma assercao fala de
  lista completa de cenas/faixas/assets (pergunta da onda §12): tudo e
  presenca do item DESTE card derivado dos inputs congelados.
- **"Por que 48 kHz e nao 44,1?"** Padrao de video; a trilha (44,1) e a
  locucao (16) sao reamostradas pela ferramenta pinada — o determinismo e
  por pin + prova 2x, nao por escolha de taxa.
- **"A emenda sem cortes tem o hash da fonte — nao viola o C3?"** Nao:
  com zero cortes os bytes emendados SAO os da fonte e o hash coincide por
  enderecamento de conteudo (a identidade e do conteudo, nao do rotulo). O
  ∅-crit persegue a emenda TRATADA como fonte quando ha cortes — o caso de
  estresse (gapAlvo 0,05) o exercita com bytes que diferem de verdade.

## O que este ADR NAO decide / explicitamente fora de escopo

- A normalizacao de loudness do master (alvo de LUFS, true peak apos
  codificacao) — F5-03 (W8).
- A calibracao por escuta de limiares e rampas — W10/F6-01 (contrato-w7 §13).
- A migracao dos parametros de ducking para tokens (S-5) — AB-601.
- O alvo de cadencia do pipeline de producao — F5-07 (W9), AB-619.
