# ADR-0007 — No de cabecalho: a mola e nomeada, e a janela e do no

- **Card:** F1-04 (onda W4)
- **Data:** 2026-08-11
- **Status:** aceito
- **Arquivos:** `src/composicao/nos/cabecalho.tsx`,
  `fixtures/snapshots/no-cabecalho/**`, `tools/no-cabecalho/*.sh`,
  `tests/composicao/no-cabecalho.test.ts`
- **Ledger:** AB-310, AB-311, AB-312, AB-313

## Contexto

O card pedia um no de cabecalho em que **toda mola venha de uma constante
nomeada dos tokens, nunca de valor inline**. Um `damping: 15` escrito no
componente e literal de token redeclarado: ele nao quebra hoje, diverge do
token num merge limpo, e o video passa a animar diferente do que o design
system diz — sem erro nenhum (AGENTS.md, Regra 2).

`src/design/tokens.ts` guarda os presets como par **(zeta, settlingTimeSeconds)**
e documenta, em comentario, a conversao para `mass/damping/stiffness`.
Comentario nao se importa. Alem disso, `tokens.ts` e singleton (S-5) e o
contrato da W4 proibe este card de toca-lo.

---

## D1 — A conversao (zeta, T) -> config mora no proprio no, exportada

**Decisao.** `configDaMola()`, `duracaoDaMola()` e `molaEm()` sao implementadas
e **exportadas** por `src/composicao/nos/cabecalho.tsx`.

**Por que aqui.** As duas alternativas estavam fechadas: `src/design/tokens.ts`
e singleton, e criar um modulo compartilhado novo (`src/design/mola.ts`) durante
uma onda de treze agentes cegos entre si e convite a dois cards criarem o mesmo
arquivo com conteudos diferentes — dependencia lateral, proibida por construcao.

**O custo, declarado.** Os outros sete cards de composicao precisam da mesma
conversao e nao enxergam esta. O resultado provavel da W4 sao varias copias da
mesma formula em arquivos distintos, que **nao conflitam no merge**. Por isso as
funcoes ja saem exportadas: a extracao futura e um `move`, nao uma reescrita.
Ledger **AB-310**.

---

## D2 — O token entra por duas portas: zeta na config, T em `durationInFrames`

**Decisao.**

| campo do token | por onde entra | verificado por |
|---|---|---|
| `zeta` | `config` (`stiffness = omega0^2*m`, `damping = 2*zeta*omega0*m`) | round-trip `damping / (2*sqrt(stiffness*mass))` == `zeta` |
| `settlingTimeSeconds` | `spring({ durationInFrames })` | `abs(mola(T*fps) - 1) <= threshold` e `mola(T*fps + 1) === 1` |
| `springDurationRestThreshold` | `spring({ durationRestThreshold })` e `omega0` | idem |

**Por que nao deixar T so na formula.** A formula documentada no token,
`omega0 = ln(1/threshold) / (zeta*T)`, assume envelope `e^-(zeta*omega0*t)`.
Em amortecimento critico o envelope real e `(1 + omega0*t) * e^-(omega0*t)`:
o termo linear ignorado e justamente o que domina. Medido nesta base com
`measureSpring()`:

| preset | zeta | T | esperado @30fps | medido pela formula pura | razao |
|---|---|---|---|---|---|
| `snappy` | 0.70 | 0.25 s | 7.5 frames | 7 frames | 0.93x |
| `overshoot` | 0.45 | 0.40 s | 12 frames | 12 frames | 1.00x |
| `suave` | 1.00 | 0.50 s | 15 frames | **22 frames** | **1.47x** |

O comentario do token chama isso de "superestima levemente". Em `zeta = 1` nao
e leve: o preset `suave` duraria 0.73 s onde o token promete 0.50 s, em
silencio. Com `durationInFrames`, quem impoe a duracao e o esticador do proprio
Remotion, e os **dois** campos do token viram observaveis. Ledger **AB-311**.

**Massa.** `MASSA_DE_REFERENCIA = 1` nao e decisao de design e por isso nao e
token: na equacao normalizada `x'' + 2*zeta*omega0*x' + omega0^2*x = 0` a massa
se cancela. O teste `a massa de referencia nao e decisao de design` prova que
escalar (m, k, c) pelo mesmo fator preserva zeta, em vez de afirmar.

---

## D3 — A janela declarada manda: fora dela, o no nao desenha nada

**Decisao.** Fora de `[0, no.duracao_frames)` o componente devolve `null`.
Dentro, ele some nos ultimos `msToFrames(transitionDuration.snap, fps)` frames
da propria janela. `duracao_frames <= 0` **estoura**, nao desenha.

**Por que `null` e nao `opacity: 0`.** Uma caixa invisivel continua ocupando
layout e continua aparecendo no DOM: o gate leria `data-no` e concluiria que o
no esta em cena. `null` torna a afirmacao "nao desenho fora da minha janela"
verificavel no pixel — e e assim que a composicao `no-cabecalho-fora-da-janela`
a verifica: o still do primeiro frame fora da janela tem faixa de luminancia
**zero**.

**Colisao possivel com F1-10.** Se as transicoes de cena tambem aplicarem fade
na fronteira, os dois se multiplicam. A saida do no e curta e derivada de token,
revertivel numa linha. Ledger **AB-312**.

---

## D4 — O quadro vazio e renderizado de verdade, e reprovado

**Decisao.** `tools/no-cabecalho/provar.sh` renderiza a composicao
`no-cabecalho-fora-da-janela` a cada execucao e exige que ela:

1. tenha faixa de luminancia **zero** (o componente nao desenhou nada), e
2. **difira** de todo snapshot aprovado.

**Por que.** "O smoke passaria com um quadro vazio?" so tem resposta honesta se
o quadro vazio existir no gate. Aqui ele existe, e reprovado, e o mesmo par de
assercoes (`faixa de luma >= 100`, `!= quadro vazio`) e o que cada still
aprovado tem de passar. C1 do AGENTS.md: `exit 0` de um render nao prova que
saiu imagem.

O espelho disso no nivel do DOM esta em `tests/composicao/no-cabecalho.test.ts`:
a funcao `reprovacoesDoSmoke()` e aplicada ao render feliz (tem de aprovar) e ao
render fora da janela (tem de reprovar).

---

## D5 — Snapshot ausente e VERMELHO, nunca "primeira execucao"

**Decisao.** `provar.sh` **nao** gera snapshot quando falta. Ausencia reprova,
com a palavra `AUSENTE` na saida. Gerar exige `--aprovar` explicito
(`just no-cabecalho-aprovar`).

**Por que.** O harness do canario (F0-06) trata ausencia como primeira execucao
e grava o aprovado. Isso e comodo e destroi o oraculo: apagar o snapshot vira
uma forma de aprovar qualquer regressao. `just no-cabecalho-ausencia` executa a
sonda de verdade — apaga cada snapshot, exige vermelho **pelo motivo certo**,
restaura, exige verde.

**Arvore limpa.** O gate fecha com `git diff --exit-code` **casado com**
`git status --porcelain` no diretorio de snapshots. Sozinho, `git diff` nao
enxerga arquivo nao rastreado e um snapshot novo daria falso verde (C3).

---

## D6 — O still carrega as fontes embutidas

**Decisao.** `fixtures/snapshots/no-cabecalho/entrada.tsx` chama
`registrarFontesLocais()` no escopo de modulo.

**Por que.** Os tokens pedem Inter. Sem o registro, o Chrome do render cai para
a pilha de seguranca sem erro (C6) e o snapshot vira refem das fontes instaladas
na maquina. O ponto de entrada de **producao** (`src/composicao/raiz.tsx`) ainda
nao faz isso — arquivo de outro card, nomeado no ledger **AB-313**.

---

## O que este ADR NAO decide

- Onde a conversao de mola deve morar em definitivo (AB-310).
- Se `src/design/tokens.ts` deve corrigir ou remover a formula aproximada
  (AB-311) — `tokens.ts` e singleton S-5.
- Quem desenha a fronteira entre cenas (AB-312).
- Quem registra as fontes no bundle de producao (AB-313).
