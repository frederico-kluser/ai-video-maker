# ADR-0028 — Envelope de ducking: dado calculado, nunca compressor

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F3-03 (W6, caminho critico)
- **Depende de:** F3-01 (timing canonico, W5), ADR-0022 (origem do timing
  canonico), ADR-0012 (musica e efeitos — fronteira de aplicacao),
  ADR-0001 (todo card tem oraculo)
- **Consumido por:** F3-05 (mix de audio, W7) — a APLICACAO do envelope;
  F5-01 (render de ponta a ponta, W7) — posicoes absolutas no render

> Consolida o contrato congelado de docs/contrato-w6.md §4
> (DuckingEnvelope.1) na forma de decisao registrada, com os numeros, a
> fonte das posicoes absolutas e o que fica para o F3-05.

## Contexto

O card do programa pede: "Envelope de ducking — calculado, nao um
compressor cuja saida muda entre versoes". O vocabulario fixa o exemplo de
referencia: "um trecho de 3 segundos de locucao reduz o ganho da musica em
-12 dB, com ataque de 100 ms antes do inicio da fala e release de 200 ms
apos o fim".

O problema que este card fecha: um compressor real (o processamento que
escuta e atenua em tempo real) tem saida nao-deterministica entre versoes
— o que quebra a fronteira de determinismo do programa. A alternativa e
produzir o envelope como DADO: um documento serializavel que descreve,
para cada intervalo absoluto da timeline, o ganho da trilha — e que o
F3-05 (W7) aplica no mix. A decisao deste ADR e a forma desse documento e
de onde vencem os numeros e as posicoes.

## Decisao

### D1 — DuckingEnvelope.1: envelope como DADO, chave por intervalo absoluto

O documento (`src/sincronia/ducking/formato.ts`) tem `schema_version`
"DuckingEnvelope.1", `unidade` "segundos" e um array `intervalos`
ordenado por inicio absoluto. Campos minimos por intervalo, como manda o
contrato: `inicio_s`, `fim_s`, `ganho_db` (atenuacao em dB, negativa) e as
rampas `rampa_entrada_s` / `rampa_saida_s` (duracao da transicao de/para o
ganho). O intervalo e chave por INTERVALO ABSOLUTO na timeline — segundos
desde o byte zero do video, nunca indice de trecho, nunca posicao
relativa: o F3-05 nao recalcula nada para saber onde atenuar.

O campo `cena` (primeira cena que originou o intervalo) e informativo,
para rastreabilidade — apos a fusao de intervalos colados (D3) o intervalo
pode cobrir fala de mais de uma cena.

### D2 — CALCULADO: funcao pura, provada por golden byte a byte

`calcularEnvelopeDucking()` (`src/sincronia/ducking/calcular.ts`) e funcao
pura de (timing canonico + posicoes absolutas + parametros): dois
processamentos sobre os mesmos bytes produzem bytes identicos — provado
por teste (2x) e por execucao em dois processos separados (sondas do
gate). Nenhum estado, nenhum relogio, nenhum compressor.

A saida e regressada contra um golden COMMITADO
(`tests/fixtures/ducking-canono.json`), gerado do timing canonico
commitado de F3-01: o `just ducking` compara byte a byte e a divergencia e
VERMELHA ate a regeneracao explicita (`just ducking-gravar`). E a resposta
escrita a pergunta adversarial (1) do card: o envelope nao muda entre
versoes sem um ato explicito e um diff para revisar.

A serializacao reusa `serializarCanonico()` de `src/resolucao/cassete/` —
a MESMA do timing canonico: dois serializadores canonicos no mesmo
repositorio produziriam dois hashes para o mesmo dado.

### D3 — Posicoes absolutas da aritmetica da composicao (AB-520), nunca soma de duracao_s

O timing canonico nao carrega a posicao absoluta das cenas (so a duracao
de cada uma). A fonte canonica das posicoes e `posicoesDaTimeline()`, que
usa exatamente `calcularDuracao()` de `src/composicao/tempo.ts` (F1-01,
ancorada pela suite integrada do F1-12) e divide o `frameInicial` pelo fps
do manifesto. E o veredito do AB-520 (contrato-w6 §2): um consumidor que
somasse `duracao_s` deslocaria o conteudo em relacao a composicao sem
erro nenhum — as transicoes ENCURTAM a timeline, e a fixture canonica
prova (c-004 comeca em 14,23 s, nao em 16,0 s como diria a soma).

O F3-05 (W7) pode injetar o proprio mapa de posicoes; o que este card
proibe e inventar posicao onde ela nao existe: cena com locucao SEM
posicao absoluta e erro, nao chute (o envelope nao pode posicionar a fala
que nao sabe onde esta).

### D4 — A atenuacao comeca ANTES da fala, com folga e rampas declaradas

Os numeros do vocabulario vivem em `src/sincronia/ducking/parametros.ts`
(exportados, congelados pelo golden):

| Constante | Valor | Papel |
|---|---|---|
| `DUCKING_GANHO_DB` | -12 | atenuacao da trilha durante a fala, em dB |
| `DUCKING_FOLGA_ENTRADA_S` | 0,1 | o patamar comeca 0,1 s antes da primeira palavra |
| `DUCKING_ATAQUE_S` | 0,1 | rampa de entrada: 0,1 s ate o inicio do patamar |
| `DUCKING_FOLGA_SAIDA_S` | 0,2 | o patamar termina 0,2 s depois da ultima palavra |
| `DUCKING_RELEASE_S` | 0,2 | rampa de saida: 0,2 s a partir do fim do patamar |

O contrato exige "a atenuacao comeca ANTES da fala, com folga declarada (a
curva de ataque cobre o ataque da palavra)": o PATAMAR ja vale 0,1 s antes
de a voz comecar, e a rampa de entrada termina antes do ataque da palavra
— no primeiro sample da fala o ganho ja e pleno. A folga e declarada no
proprio documento (o F3-05 nao adivinha).

Os numeros moram em `src/sincronia/ducking/` e NAO em
`src/design/tokens.ts` porque tokens.ts e o S-5 (dono unico por onda,
alteracao recaptura snapshots) e este card nao tem autorizacao de toca-lo
— a migracao futura fica registrada em AB-601.

### D5 — Trechos colados nao produzem degrau: fusao de intervalos com rampas sobrepostas

Dois intervalos vizinhos produziriam degrau se a rampa de entrada do
segundo comecasse antes de a rampa de saida do primeiro terminar — nesse
trecho o documento pediria dois ganhos ao mesmo tempo. O calculo FUNDE
esses intervalos num patamar continuo (rampa de entrada do primeiro,
patamar ate a fala que termina mais tarde, rampa de saida do ultimo), e o
oraculo (`validarEnvelopeDucking`, E4) REJEITA qualquer documento em que o
invariante anti-degrau falhe: a regra de fusao e uma propriedade do
FORMATO, nao so do calculo. Lacunas maiores que a soma das rampas
devolvem a musica a 0 dB entre os intervalos, sem descontinuidade —
provado por amostragem da funcao `ganhoEm` nas emendas.

A lacuna media coberta pela fusao e de ate ~0,3 s (soma das rampas): o
silencio curto entre frases proximas mantem a musica 100% atenuada
(anti-pumping). Essa escolha nao foi validada por escuta — ver AB-603.

### D6 — ∅-crit por PRESENCA: cobertura por palavra, aplicacao fica no F3-05

A sonda negativa do card — "um trecho com locucao SEM atenuacao tem de
ficar vermelho" — e `coberturaDoEnvelope()`: para cada palavra do timing
canonico (o contrato de entrada, congelado), existe intervalo cujo
patamar (`ganho_db < 0`) contem o trecho absoluto da palavra. A suite
prova por mutacao (patamar cortado, envelope vazio, ganho zero) e o
`--conferir` do gate sai 1 com a palavra nomeada. Perde-se a cobertura, o
gate fica VERMELHO.

Cena silenciosa (estado "silencio" do timing) nao gera intervalo: a
semantica de silencio e declarada, e silencio sem atenuacao e o desenho —
locucao sem atenuacao e o ∅-crit.

A APLICACAO do envelope no mix (dB -> amplitude, soma de faixas, clip) e
do F3-05 (W7) — ADR-0012 §"O que este ADR NAO decide": "O mix de audio
(ducking, loudness, cobertura da trilha) — F3-05". Este card entrega o
DADO (`calcularEnvelopeDucking`) e a leitura do DADO (`ganhoEm`,
`coberturaDoEnvelope`, `lerEnvelopeDucking`); nao mixa nada.

## Alternativas consideradas / descartadas

| Alternativa | Por que descartada |
|---|---|
| Compressor em tempo de mix | Saida nao-deterministica entre versoes — quebra a fronteira de determinismo (o proprio enunciado do card) |
| Posicoes por soma de `duracao_s` do timing | Ignora transicoes (a timeline ENCURTA); e exatamente o deslocamento silencioso que o AB-520 fecha |
| Posicoes embutidas no timing canonico | F3-01 esta congelado (W5); mudar o formato exigiria bump e regeneracao do golden do timing |
| Envelope em frames | Contraria o contrato-w6 §2 (unidade SEGUNDOS, conversao e de quem consome) |
| Um intervalo por cena, sem fusao | Dois intervalos com rampas sobrepostas = degrau; o oraculo E4 fecharia o proprio produtor |
| Golden em `fixtures/canonico/` | Fora do mapa de arquivos deste card (contrato-w6 §1); o golden mora em `tests/fixtures/` e cumpre o mesmo papel |

## Consequencias

### Positivas

- A pergunta adversarial (1) tem resposta executavel: golden byte a byte +
  teste de determinismo 2x.
- A pergunta (2) tem resposta no dado: o patamar ja vale com folga no
  ataque da palavra (teste amostra `ganhoEm` no instante da fala).
- A pergunta (3) tem resposta no formato: fusao + invariante E4 do
  oraculo — degrau e documento que NAO EXISTE, nao um caso esquecido.
- O F3-05 recebe um documento autocontido (intervalos absolutos + rampas)
  e uma leitura (`ganhoEm`), sem estado compartilhado.

### Custos e desvios registrados

- **AB-600** — o envelope assume que o audio da cena comeca no inicio
  absoluto da cena (frameInicial/fps) e toca pela duracao declarada no
  timing. A fixture canonica tem c-004 com audio (8,505 s) mais longo que
  a cena visual (4 s): se a composicao cortar ou deslocar o audio, o
  envelope diverge da audicao.
- **AB-601** — os parametros moram fora de tokens.ts (S-5); o golden pina
  os numeros ate a migracao.
- **AB-602** — folga/ataque/release/ganho sao os numeros do vocabulario,
  nao medidos por escuta; calibrar quando o mix existir.
- **AB-603** — lacunas de ate ~0,3 s mantem a musica 100% atenuada
  (fusao); escolha de audio nao validada por escuta.

## Revisao adversarial

- **"Por que o envelope nao corta o silencio entre palavras?"** O ducking
  atenua a TRILHA, nao edita a locucao: o corte de silencio e do F3-04
  (ritmo) — outro consumidor do timing, com o proprio ∅-crit (nenhuma
  palavra cortada).
- **"E se o F3-05 quiser ganho diferente de -12 dB?"** O envelope e o
  DADO; o F3-05 aplica o que o documento diz. Parametros diferentes
  produzem outro documento (a entrada declara os parametros). O que este
  card garante e determinismo, nao imutabilidade de valores.
- **"A cobertura por palavra nao e uma lista completa de palavras?"** E a
  cobertura do CONTRATO DE ENTRADA (o timing de F3-01, congelado, que os
  irmaos da onda nao editam) — a pergunta obrigatoria da W6 e respondida
  em teste: assercao de presenca (a fala de c-004 TEM intervalo; a de
  c-005 TEM), nunca ausencia dos itens dos irmaos.
- **"Rampas de 0,1/0,2 s sao audiveis?"** Nao foi medido (AB-602). A
  rampa linear e o minimo que o formato exige para nao ter degrau; a
  curva pode evoluir por parametro, com regeneracao explicita do golden.

## O que este ADR NAO decide / explicitamente fora de escopo

- A APLICACAO do envelope no mix (dB -> amplitude, soma, clip, loudness)
  — `F3-05` (W7).
- O corte de silencio e a cadencia — `F3-04` (W7 desta onda).
- A origem dos numeros do vocabulario (calibracao por escuta) — AB-602.
- A migracao dos parametros para `src/design/tokens.ts` (S-5) — AB-601.
