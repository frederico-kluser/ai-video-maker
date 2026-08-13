# ADR-0029 — Ritmo: corte de silencio e cadencia como dado

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F3-04 (W6, 🟡 medio)
- **Depende de:** ADR-0022 (origem do timing canonico, F3-01), ADR-0001
  (todo card tem oraculo), contrato-w6 §2 (consumo do timing canonico)
- **Consumido por:** F5-01 (render de ponta a ponta, W7), F3-05 (mix de
  audio, W7 — emenda materializada, AB-617)

## Contexto

O video com narracao arrasta quando as lacunas entre palavras sao longas.
O card F3-04 pede "ritmo": corte de silencio e cadencia — com o ∅-crit de
que **nenhuma palavra pode ser cortada**. O corte e um PLANO DE EDICAO, nao
a edicao: o F3-04 consome o timing canonico (contrato-w6 §2) e produz a
cadencia como DADO deterministico — da mesma forma que o F3-03 produz o
envelope de ducking como dado e nao como compressor.

Duas decisoes de fronteira viravam armadilha sem registro:

1. **O que e a cadencia?** Se o corte redefinisse o documento canonico por
   fora, dois consumidores (F5-01 e F3-05) divergiriam sem conflito de
   merge — o falso verde que a W5 existe para matar. A resposta deste ADR:
   a cadencia e um `TimingCanonico` VALIDO (mesma forma, mesmo schema,
   mesmo oraculo), com as MESMAS palavras e as lacunas encurtadas.
2. **Como provar que nenhuma palavra foi cortada?** A prova precisa de
   comparacao do timing ANTES e DEPOIS — por isso o resultado declara as
   regioes removidas da timeline original (`cortes`), e o teste reconstroi
   a timeline original a partir da compactada (round-trip).

## Decisao

### 1. Consumo: a entrada unica do contrato, nunca um parser proprio

O F3-04 le o documento canonico por `lerTimingCanonico(bytes)` e o
re-serializa por `serializarTimingCanonico` (`src/sincronia/timing/`,
F3-01) — o formato e o oraculo sao a superficie unica. A fonte dos bytes e
o replay do cassete de locucao (AB-523): o golden commitado (que o
`timing-testar` prova byte a byte igual ao replay) e o caminho curto dos
testes; um teste de aceitacao percorre a via completa
(`reproduzirLocucao` + `construirTimingCanonico`). NUNCA por hash.

### 2. A politica de corte (congelada)

`cortarSilencio(doc, { gapAlvoS })` — funcao pura do documento e do alvo:

- de cada lacuna de silencio DECLARADA com mais de `gapAlvoS` segundos,
  mantem-se os PRIMEIROS `gapAlvoS` segundos e remove-se o rabo (a regiao
  removida fica no lado da proxima palavra — nunca sobre ela);
- `gapAlvoS = 0` remove a lacuna inteira (palavras ficam contiguas);
  resto menor que o piso do oraculo (`EPS_S = 1e-6`) nao e emitido, para o
  documento compactado continuar valido;
- cena com `estado: "silencio"` nao tem palavra nem lacuna de locucao: o
  corte nao a toca (a duracao dela e da aritmetica da composicao, AB-520);
- `duracao_s` do compactado = original - soma dos cortes: o corte NUNCA
  muda a duracao sem atualizar o documento (pergunta adversarial 3);
- default `GAP_ALVO_S = 0.25` s: nao comprime a fixture canonica (lacunas
  naturais de 0.09 s) — compressao agressiva e escolha explicita de quem
  consome, via `gapAlvoS`. O valor e politica do modulo, NAO token de
  design (S-5): um ritmo configuravel por manifesto e outra onda (AB-619).

### 3. A cadencia e um TimingCanonico valido — e as regioes de corte sao declaradas

O resultado do corte e `ResultadoDeCorte`:

- `politica` — versao da politica (`Ritmo.1`, `FORMATO_RITMO`) e o alvo
  efetivo, para o consumidor auditar qual politica produziu a cadencia;
- `documento` — a cadencia: um `TimingCanonico` que passa no MESMO oraculo
  de `validar.ts` (cobertura palavras + silencio = [0, duracao_s]
  inclusive, monotonicidade, sem sobreposicao) — o modulo REAPLICA o
  oraculo na entrada e na saida, e lanca `ETimingCanonicoInvalido` se
  alguma das duas falhar;
- `cortes` — as regioes removidas da timeline ORIGINAL, por cena: cada
  regiao e um sub-intervalo de uma lacuna declarada, nunca de uma palavra.
  E a base da prova do ∅-crit (AB-615).

As palavras da cadencia sao as MESMAS do documento de entrada: mesmo
texto, mesma duracao; a posicao na nova timeline e a original menos o
corte acumulado antes da palavra (o ataque e a release sobrevivem
inteiros). O mapa de compactacao e `novo(t) = t - corteAcumulado(t)`;
a inversa (round-trip) devolve a posicao original e e testada.

### 4. Determinismo e idempotencia por construcao

`cortarSilencio` e funcao pura: dois processamentos sobre os mesmos bytes
produzem bytes identicos. E IDEMPOTENTE: apos o corte nenhuma lacuna passa
do alvo, entao aplicar 2x nao corta nada — 2x = 1x, testado com varios
alvos e no piso do oraculo (pergunta adversarial 2).

### 5. Limites registrados

- **O campo `audio` da cadencia referencia o audio-FONTE** (o hash e a
  ligacao por conteudo do contrato; o audio emendado nao existe em bytes).
  Quando o F3-05 (W7) materializar a emenda, os bytes e o hash novos
  substituem o campo e o documento ganha identidade nova — disciplina de
  AB-521 (AB-617, aberto).
- **O corte nao decide a cadencia de cenas silenciosas** — a duracao delas
  e da composicao (AB-520 fechado). Quem cortar cena silenciosa no video e
  o consumidor visual, com a aritmetica de tempo da composicao.
- **O modulo nao aplica o corte em audio nem em video** — F3-05/F5-01 na
  W7, que recebem esta superficie e o handoff deste card.

### 6. Porta e ledger

Porta TCP 4304 reservada (contrato-w6 §9). Ledger `ledger/inbox/F3-04.json`
na faixa AB-615..AB-629 (contrato-w6 §7).

## Consequencias

- O consumidor F5-01 (W7) obtem a cadencia com
  `cortarSilencio(lerTimingCanonico(bytes))`: palavras na ordem da nova
  timeline, lacunas restantes, duracao nova; as regioes em `cortes`
  permitem reconstruir a posicao original de cada palavra (round-trip,
  iteracao sobre pontos fixos) para fatiar o audio-fonte.
- Se a politica mudar (novo alvo, nova regra de borda), `FORMATO_RITMO`
  sobe no MESMO commit e a identidade dos bytes da cadencia muda — o
  consumidor distingue geracoes pelo campo `politica`.
- Nenhuma assercao deste card fala de lista completa de cenas: tudo e
  presenca do item deste card (contrato-w6 §10) — o merge dos irmaos pode
  crescer o mapa sem derrubar a suite.

## Guardas executaveis

```sh
just ritmo                       # tsc + suite: ∅-crit + adversariais 1/2/3/4
npx vitest run tests/sincronia/ritmo.test.ts   # a suite inteira
```

## Sign-off

Decisao tecnica aceita neste ADR; o sign-off do valor de `GAP_ALVO_S` como
default de produto (ritmo agressivo vs natural) fica com a onda que levar o
ritmo a render (F5-01, W7) — ver AB-619.
