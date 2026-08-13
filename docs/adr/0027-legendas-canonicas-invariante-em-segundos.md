# ADR-0027 — Legendas canonicas a partir do timing: o invariante em SEGUNDOS e a norma brasileira de legendagem

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F3-02 (W6)
- **Depende de:** ADR-0022 (origem do timing canonico, F3-01), ADR-0001
  (todo card tem oraculo), ADR-0006 (composicao raiz / aritmetica de tempo,
  F1-01)
- **Consumido por:** F5-03 (pos, W8 — sidecar SRT e legenda queimada),
  F5-07 (orquestrador de ponta a ponta, W9)

## Contexto

A W6 tem tres consumidores do timing canonico. Este ADR registra o do
F3-02: legenda a partir do timing, com o invariante de duracao **em
segundos, nunca em frames**:

```
duracao >= max(0,833 s; caracteres/20)   e   duracao <= 7 s
```

Os numeros sao do contrato congelado (PROGRAMA.html, card F3-02, `[R14-01·R14-11 (2-0)]`):
piso de 20 frames (Netflix TTSG, "5/6 s" = 0,833 s) a 40 frames (DCMP,
1,333 s); teto de 6 s (DCMP) a 7 s (Netflix). Eles vivem em
`src/design/tokens.ts` (S-5) e o codigo de composicao os importa — o
ADR-0022 ja decidiu que nenhum numero de legibilidade aparece literal no
codigo de composicao.

A pergunta de pesquisa obrigatoria do card (PROGRAMA.html, pesquisa D):
**existe norma ou guia publico de legendagem em portugues brasileiro que
fixe caracteres por linha, numero de linhas e velocidade de leitura — e
quais os numeros, a edicao e o ano?** Os 42 CPL / 20 CPS herdados sao
norma proprietaria calibrada para ingles; pt-BR e mais longo.

## Pesquisa da data de execucao (2026-08-13) — a norma brasileira

O `scripts/search.sh` do deep-orchestrator (tier 1 surf-skill + tier 2
Brave) falhou na data de execucao em todas as tiers (erros de rede do
DuckDuckGo em todas as queries; Brave devolveu HTTP 422) — registrado no
ledger (AB-580). A pesquisa foi concluida via busca web direta + leitura
do texto INTEGRAL da norma (PDF de 25 paginas):

| Fonte | O que fixa | Numeros | Placar |
|---|---|---|---|
| **ABNT NBR 15290:2016** — "Acessibilidade em comunicacao na televisao", 2a edicao, publicada 19/12/2016, cancela e substitui a 15290:2005. PDF integral lido (2026-08-13) | §4.1.7 numero de linhas (pop-on): **2 linhas**, podendo ter 3 quando o trabalho de edicao nao permitir de outra forma; roll-up: 2 + 1 em atualizacao. §4.2.8 tempo de exposicao: **1 linha completa = 2 s (max 3 s); 2 linhas = 3 s; 3 linhas = 4,5 s a 5 s**; publico infantil 3-4 s por linha. §4.1.5 velocidade: "A velocidade nao pode ser limitada, de forma a preservar o conteudo original" — **a norma NAO fixa CPS**. §4.1.6.4 tamanho/espaçamento/quantidade de caracteres remetem a NBR 15610-1 (norma de codificacao de video, sem valor publico de CPL) | linhas e exposicao; sem CPS; sem CPL | (1-0) — texto integral, publicador unico (ABNT) |
| **EIA-608 / CEA-608** (Line 21) — padrao de closed caption analogico, o mesmo que o Brasil usou na TV analogica (a propria NBR 15290:2005 o referencia para a linha 21 do VBI) | maximo de **32 caracteres por linha** | 32 CPL | (1-0) — Wikipedia (Line 21 captions) |
| **DCMP Captioning Key** (descrito e legendado, EUA, guia publico continuo) | velocidade em **palavras por minuto**: 120-160 wpm educacional; max 225 wpm filmes culturais adultos; duracao minima 40 frames (1 s + 10 frames = 1,333 s), maxima 6 s; **sem dados para portugues** | wpm, nao CPS | (1-0) — dcmp.org |
| **Ancine IN n. 128/2016** (alterada pela IN n. 145/2018) | define "legendagem descritiva" considerando "numero de caracteres" e "velocidade de leitura" na composicao — **sem valores numericos** | nenhum | (1-0) — IN publicada |
| **Netflix TTSG** (herdado, ja registrado nos tokens em 2026-08-11) | 42 CPL, 20 CPS, 2 linhas — norma proprietaria calibrada para **ingles** | 42 / 20 / 2 | (1-0) — partnerhelp.netflixstudios.com |

**Conclusao da pesquisa:** nao existe norma publica brasileira que fixe
CPS ou CPL para legendas — a ABNT NBR 15290:2016 fixa LINHAS (2, max 3) e
TEMPO DE EXPOSICAO (2-5 s), e a velocidade de leitura e explicitamente
nao limitada por ela. Os numeros herdados do contrato (0,833-7 s; 20 CPS)
continuam como contrato congelado; a calibracao pt-BR do CPS (o 20 e do
ingles) fica como item de ledger aberto (AB-581), fechavel por medicao com
leitores pt-BR. O que a norma brasileira fixa (2 linhas) COINCIDE com o
token `maxLines = 2` do design system; a folga de 3 linhas da NBR 15290
quando a edicao exigir fica registrada para quem quiser relaxar o token
(F5-03) — trocar o token, nunca o codigo.

## Decisao

### 1. O invariante de duracao e calculado em SEGUNDOS, nunca em frames

`duracao >= max(minTextDurationSeconds; caracteres/maxCpsAdult)` e
`duracao <= maxTextDurationSeconds`, tudo importado de
`src/design/tokens.ts`. A sonda negativa do card prova a unidade: uma
legenda de **0,4 s** com 4 caracteres (que uma reescrita em frames a
60 fps aprovaria — "20 frames" = 0,333 s, quatro vezes abaixo do piso) e
REPROVADA pelo oraculo em segundos. Apagar a regra de caracteres-por-
segundo deixa o ∅-crit do card VERMELHO (provado por mutacao, ver AB-582).

### 2. A legenda descreve a FALA, e a fala e o timing — o limite e o FIM DO AUDIO

O intervalo de cada legenda e ancorado no inicio da cena (timeline da
composicao, F1-01) e limitado pelo **fim do audio** da cena
(`inicio_s` da cena + `duracao_s` do timing), nunca pelo fim da janela
visual da composicao. Consequencia: se a janela visual for mais curta que
a fala — como na fixture canonica, onde a cena c-004 tem janela visual de
4 s e audio de 8,505 s — a legenda continua descrevendo a fala inteira.
Quem reconcilia janela visual × fala e a fronteira de composicao (AB-550,
aberto) e o mix (F3-05, W7) — nao a legenda. Item de ledger AB-583.

### 3. Consumo por CONTEUDO, iterando o MANIFESTO (AB-522)

O construtor itera as cenas do manifesto: cena silenciosa → nenhuma
legenda; cena com locucao → ao menos uma. Cada legenda carrega `cena`
(chave do manifesto) e `audio` (o SHA-256 do timing de que deriva — o
endereco por conteudo). Nada por posicao, nada inventado para cena sem
locucao. A sobreposicao entre legendas e verificada POR CENA: duas cenas
com audios sobrepostos na timeline produzem legendas sobrepostas sem ser
defeito deste documento (e o defeito da timeline, que o mix expoe).

### 4. A legenda nunca aparece ANTES da palavra

A legenda nasce no inicio de UMA palavra da cena (nunca no meio, nunca
antes da primeira). A folga de leitura — quando o piso exige mais tempo
do que a fala ocupa — estende o FIM da legenda sobre o silencio declarado
(atras), clampada pelo inicio da proxima legenda, pelo fim do audio e
pelo teto de 7 s. Se nem assim o piso couber, o timing nao comporta
legenda valida e o construtor PARA nomeando a cena (ELegendasImpossiveis)
— vermelho > documento que o oraculo reprovaria.

### 5. Paginacao limitada a `maxLines` linhas — a caixa vertical e limitada por construcao

`maxLines` (2) e `maxCharsPerLine` (42) vem dos tokens. O bloco teorico
de `maxLines` linhas (fonte caption × lineHeight normal) cabe nas safe
areas verticais 16:9 (EBU R 95, graphics safe) e 9:16 (provisional,
AB-071) — invariante testado. Uma legenda acima de `maxLines` linhas e
reprovada pelo oraculo.

### 6. O documento: `LegendasCanonicas.1`, tempos ABSOLUTOS em segundos

Lista plana e ordenada de legendas com `inicio_s`/`fim_s` ABSOLUTOS
(segundos desde o byte zero do video) — o que o consumidor de pos (F5-03,
sidecar SRT, legenda queimada) precisa sem recalcular timeline. Golden
commitado em `fixtures/canonico/legendas-canono.json`, conferido byte a
byte por `tools/legendas/gerar.ts --conferir` no gate `just legendas`.

## Consequencias

- O consumidor F5-03 (W8) le via `lerLegendas(bytes, contexto)` e
  serializa para SRT so no ponto de consumo (o `serializeSrt` do Remotion
  fabrica `timestampMs` e nao e round-trip limpo — a legenda queimada e o
  sidecar tem de nascer do MESMO documento, pergunta adversarial (3) do
  proprio F5-03).
- A fixture canonica expoe uma incoerencia latente: c-004 tem audio de
  8,505 s dentro de janela visual de 4 s, e os audios de c-004 e c-005 se
  sobrepoem em 4,505 s na timeline absoluta (AB-583). Nenhum estagio
  anterior a este card consumia tempo de audio absoluto, por isso nada
  ficou vermelho. Quem tropeca: F3-05 (mix, W7), F5-01 (render, W7) e o
  PREP-w7 — a correcao e a ponte de AB-550 (duracao da cena derivada do
  audio), nao um ajuste na legenda.
- O piso de 0,833 s e mais permissivo que o tempo de exposicao da NBR
  15290:2016 (2 s para linha completa) e que o piso DCMP (1,333 s): a
  escolha dos extremos mais permissivos foi a do design system
  (tokens.ts, "escolha nossa, nao leitura de norma") e o contrato a
  congela — um aperto futuro e troca de tokens, nunca de codigo.

## Guardas executaveis

- `just legendas` — typecheck escopado + suite + golden byte a byte; o
  ∅-crit (apagar a regra de caracteres-por-segundo) e provado por mutacao
  em AB-582 e pela sonda que exige a mensagem do piso de leitura.
- `just design-varrer` — nenhum numero do invariante e literal fora de
  `src/design/tokens.ts` (S-5).

## Sign-off

- F3-02 (W6) — autor deste ADR.
- Pendente: revisor adversarial da onda.
