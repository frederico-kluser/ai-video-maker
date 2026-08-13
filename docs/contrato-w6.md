# Contrato da W6 — consumo do timing canonico, reparo de autoria e ducking

Commit `PREP-w6`. Publicado **antes** de qualquer worktree da W6 existir,
pela mesma razao do contrato-w5: uma worktree materializa apenas o que esta
commitado, e a divergencia aparece no merge como trabalho a refazer.

Cinco agentes rodam esta onda em paralelo. **Nenhum enxerga os outros.**
Tudo que eles precisam em comum esta neste arquivo e nos ADRs pre-alocados
de `docs/adr/` (numeros 0027..0031 livres, por ordem de merge — ver §8).

---

## 1. Mapa arquivo -> dono

A terceira coluna e o que da contratualidade. Sem ela, isto e uma sugestao.

**Os caminhos abaixo NAO existem no disco ainda** — cada card cria os seus
no primeiro commit. Nenhum card escreve fora do proprio mapa. Os contratos
que a W6 CONSUME (timing canonico e schema de autoria) ja existem: sao de
F3-01 (`src/sincronia/timing/**`, `schema/timing.schema.json`) e F4-01
(`src/autoria/contrato/**`), e nenhum card da W6 os edita.

| Arquivo / diretorio | Dono | Os outros |
|---|---|---|
| `src/sincronia/legendas/**` | F3-02 | nao editam |
| `src/sincronia/ducking/**` | F3-03 | nao editam |
| `src/sincronia/ritmo/**` | F3-04 | nao editam |
| `src/autoria/reparo/**` | F4-03 | nao editam |
| `fixtures/cassetes/autoria/**` + `tests/autoria/**` + `src/autoria/executor/**` | F4-04 | nao editam |

Duas notas de fronteira neste mapa:

- `tests/autoria/contrato/**` e do F4-01 (W5) e **nao muda**: o glob
  `tests/autoria/**` do F4-04 vale para o que o F4-04 criar abaixo de
  `tests/autoria/` **fora** de `contrato/`. Ver §12 (B1).
- `src/autoria/executor/**` e o **cliente de chamada** que o F4-04 constroi
  (ver §12). O F4-03 nao usa o executor; ele opera sobre o documento que a
  chamada devolveu, no proprio `src/autoria/reparo/**`.

### Compartilhados nesta onda — so acrescente

- `docs/adr/` — **um arquivo novo por card** com o numero pre-alocado (§8),
  nunca edite o de outro.
- `ledger/inbox/<CARD>.json` — um por card, por construcao (a W6 abre na
  faixa 580..659, §7).
- `justfile` — bloco proprio no fim do arquivo, delimitado por
  `# === <CARD> ===` … `# === fim <CARD> ===`. Nunca edite receita alheia.
  **As receitas da W6 (§5) sao criadas pelos cards; o PREP nao criou stubs**
  — um stub que o gate rodasse deixaria o PREP vermelho (regra mantida da
  W5, contrato-w5 §11).

**Nada mais e compartilhado.** Se um card precisar tocar
`src/sincronia/timing/**`, `src/autoria/contrato/**`, `schema/*.json`,
`fixtures/canonico/**` ou `src/composicao/**`, ele **para, nao faz, e
escreve no handoff** — vira PREP da onda seguinte. Os singletons (S-1, S-4,
S-5) seguem proibidos, e os dois contratos de entrada (timing, autoria) tem
dono nominal na W5.

### Dependencia lateral e proibida por construcao

Precisou de algo entregue por outro card **desta mesma onda**? Isso e
dependencia lateral. Pare, entregue o que da, e **nomeie a diferenca no
handoff**. Nao invente o artefato do vizinho nem edite o arquivo dele. O
consumo permitido e apenas dos contratos FECHADOS da W5 (timing canonico de
F3-01, schema de autoria de F4-01) e desta onda.

---

## 2. Contrato de consumo do timing canonico (substitui o "formato timing.json" do PROGRAMA)

O documento canonico de timing da onda e o de F3-01 (W5), entregue como
`schema/timing.schema.json` + `src/sincronia/timing/**`. O que esta abaixo
esta **congelado** — os tres consumidores (F3-02, F3-03, F3-04) e os
descendentes constroem em cima disso, e quem divergir esta fora do contrato:

- **Identificacao por MIME:** `MIME_TIMING_CANONICO`
  (`application/vnd.editor-video-ia.timing-canonico+json`, definido em
  `src/sincronia/timing/formato.ts`). NAO e o MIME do asset de origem
  (`application/vnd.editor-video-ia.timing-locucao+json`, F2-03): o
  canonico e derivado, produzido na composicao.
- **Entrada unica e saida unica:** ler — `lerTimingCanonico(bytes)` em
  `src/sincronia/timing/validar.ts` (rejeita documento invalido com o
  oraculo C1-C8); gravar — `serializarTimingCanonico(doc)` em
  `src/sincronia/timing/formato.ts` (os MESMOS bytes que entram no hash).
  Nenhum consumidor inventa o proprio parser.
- **Fonte dos bytes = replay do cassete de locucao** (AB-523): enquanto o
  store de conteudo nao existir (AB-411, aberto), os bytes do documento
  canonico vencem do replay offline do cassete de locucao (F2-03) — o mesmo
  caminho de `tools/timing/gerar.ts`. **NUNCA leia o asset de timing por
  hash:** os timings de locucao sao computados pelo estagio e NAO tem bytes
  commitados (AB-503 — os AUDIOS tem, os TIMINGS nao; a suite integrada
  F2-07 ja prova isso).
- **Unidade: SEGUNDOS, nunca frames.** O timing descreve tempo de parede do
  audio; conversao para frame e de quem consome, no ponto de consumo. Cada
  entrada declara a propria `unidade` explicitamente.
- **Silencio declarado:** trecho sem locucao e uma entrada com
  `estado: "silencio"` e `duracao_s` — nunca pela ausencia de entrada. A
  duracao da cena silenciosa e `duracaoDaCena()/fps` da aritmetica de
  composicao (F1-01); ver veredito do AB-520 neste PREP.
- **Consumo por CONTEUDO, nunca por posicao:** o casamento timing<->audio
  usa `casarTimings()` (src/resolucao/locucao/timing.ts), ligado pelo campo
  `audio` do documento (endereco por hash dos bytes canonicos), jamais por
  ordem de aparecimento ou indice de cena assumido. Um consumidor que case
  por posicao esta fora do contrato.
- **Semantica de unidade orfa (AB-522):** o documento canonico e funcao do
  MANIFESTO. Os consumidores iteram as cenas do manifesto; uma entrada orfa
  na parcial (unidade sem cena correspondente) e **ignorada** — e um
  consumidor **nunca inventa entrada** para cena sem locucao. Se o
  orquestrador comecar a produzir orfas, o item vira erro com campo de
  diagnostico no construtor.

### Veredito do AB-520 (duracao da cena silenciosa)

Verificacao executada neste PREP, W6, depois do merge de F1-12 (a suite
integrada de composicao ja posiciona cenas contra a mesma aritmetica):

```bash
python3 -c "import json; d=json.load(open('fixtures/canonico/timing-canono.json')); print(d['cenas']['c-001']['duracao_s'])"
# -> 3
```

`duracaoDaCena(c-001)/fps = 90 frames / 30 fps = 3.0` — confere com a
fixture. Conferido para TODAS as cenas silenciosas da fixture canonica:
c-001 3.0, c-002 7.0, c-003 6.0 (com `entrada_frames` dos nos). A suite
integrada (F1-12, `tests/integracao/composicao/fiar.test.ts`) sustenta a
mesma aritmetica de `src/composicao/tempo.ts`. **AB-520 FECHADO** com
evidencia em `ledger/evidencia/AB-520.txt`. O item remanescente: se a
composicao mudar a aritmetica de fronteiras, o golden do timing e
regenerado por ato explicito e o diff mostra a divergencia — registrado no
fechamento.

---

## 3. Contrato de erro do F4-03 (congelado)

O F4-03 valida e repara a saida do LLM de autoria contra o **schema real de
F4-01** (`src/autoria/contrato/schema/autoria.schema.json`, Autoria.1 —
draft 2020-12, `additionalProperties:false` em todo objeto). A classe do
erro decide o caminho. Congelado, nao negociado em tempo real:

**REPARAVEL = FORMA.** O que o reparo pode tocar, e so isso:

- espaco (brancos, quebra de linha) em campo textual;
- escape (sequencia de escape) em campo textual;
- case de enum do vocabulario fechado (ex.: `Fade` -> `fade`);
- ordem de campos ou de itens;
- duplicata (id de no/cena repetido).

**REJEICAO DEFINITIVA = SEMANTICA.** Irreparavel — o documento e
rejeitado, nunca "melhorado" ate passar:

- tipo de no desconhecido (fora dos 6 do schema);
- `texto_alternativo` ausente em no de midia (AB-433 — obrigatorio);
- qualquer violacao de AB-432/433 (hash de midia quando presente tem de ser
  string; texto_alternativo obrigatorio);
- transicao fora do vocabulario v1 `fade`/`slide`/`wipe`/`flip`/`none`
  (AB-555 — ver §13, B2).

**O reparo NAO preenche duracao, layout, cor, hash nem licenca.** Esses
campos nem existem no Autoria.1 — quem os preenche e a ponte para o S-4, na
fronteira de resolucao/composicao (AB-550, aberto, destino F5-01 na W7; ver
§13). Um reparo que "resolve" a semantica e o LLM decidindo duas vezes.

**Tres tentativas com simplificacao progressiva e depois rejeicao.** A cada
tentativa o erro do validador volta com o caminho JSON dos campos que
falharam (mesma disciplina do `rejeitar.ts` de F4-01); a simplificacao
progressiva reduz o escopo do pedido de reparo (formato do prompt, nao do
documento). Esgotadas as tres, rejeicao definitiva.

**O erro final nomeia a regra que falhou.** Nao e "invalido": e a regra do
schema (ou do vocabulario fechado) que o documento violou, com o caminho
JSON.

---

## 4. Contrato do envelope de ducking (congelado)

O F3-03 produz o **envelope de ducking como DADO** — nunca um compressor
cuja saida muda entre versoes. O formato e `DuckingEnvelope.1`, e quem o
consumir (F3-05, W7) depende dos campos abaixo:

- **Envelope como DADO:** um documento serializavel, deterministico, chave
  por **intervalo absoluto** na timeline (segundos desde o byte zero do
  video, nao indice de trecho);
- **Campos minimos por intervalo:** `inicio_s`, `fim_s`, `ganho_db`
  (atenuacao em dB) e as **rampas de entrada e saida** (duracao da transicao
  de/para o ganho);
- **Unidade: segundos**, coerente com o timing canonico (§2);
- **CALCULADO, nunca compressor:** o envelope e funcao pura do timing
  canonico; dois processamentos sobre os mesmos bytes produzem bytes
  identicos;
- **A atenuacao comeca ANTES da fala:** a rampa de entrada inicia-se antes
  de `inicio_s` da fala, com folga declarada (a curva de ataque cobre o
  ataque da palavra);
- **Trechos colados nao produzem degrau:** dois intervalos de fala
  contiguos (ou com silencio curto) tem curvas que se concatenam sem
  descontinuidade audivel;
- **∅-crit do card:** um trecho com locucao SEM atenuacao fica VERMELHO.

**Fronteira de aplicacao registrada:** a APLICACAO do envelope no mix de
audio e do F3-05 (W7) — `docs/adr/0012-musica-e-efeitos.md` (§ "O que este
ADR NAO decide", linha ~247: "O mix de audio (ducking, loudness, cobertura
da trilha) — F3-05"). O F3-03 **produz** o envelope que o F3-05 **consome**;
o F3-03 nao mixa nada.

---

## 5. Receitas pre-registradas (NENHUM stub no justfile)

As receitas abaixo entram no justfile nos blocos dos respectivos cards. O
PREP **nao cria stubs** — uma receita vazia que o gate rodasse deixaria o
PREP vermelho (regra da W5 mantida). Quem as cria: o proprio card, no seu
commit, com corpo que falha por ausencia ate a implementacao existir.

| Receita prevista | Card | O que faz (a definir pelo card) |
|---|---|---|
| `legendas` | F3-02 | gate das legendas a partir do timing (∅-crit: apagar a regra de caracteres-por-segundo fica VERMELHO) |
| `ducking` | F3-03 | gate do envelope de ducking calculado (∅-crit: locucao sem atenuacao VERMELHO) |
| `ritmo` | F3-04 | gate do corte de silencio e cadencia (∅-crit: nenhuma palavra cortada) |
| `autoria-reparo` | F4-03 | gate de validacao/reparo (∅-crit: manifesto irreparavel rejeitado) |
| `autoria-offline` | F4-04 | gate do cassete de autoria e suite de rejeicao (∅-crit: manifesto invalido que passa derruba a suite) |

Convencao de nomes: **hifen, nunca `:`** — o PROGRAMA.html escreve
`just autoria:reparo` / `just autoria:offline`, mas o `just` 1.42 le `a:b:`
como "receita a depende de b" e o parse morre (armadilha 9.1, ja tratada no
arquivo inteiro; mesma resolucao do `prompts:testar` -> `prompts-testar` da
W5). Valem `autoria-reparo` e `autoria-offline`.

---

## 6. Ordem de merge da W6

**F3-02 → F3-03 → F3-04 → F4-03 → F4-04**

Motivo: os tres consumidores do timing (F3-02, F3-03, F3-04) sao
independentes entre si, mas F3-03 (ducking) e F3-04 (ritmo) leem o mesmo
documento que F3-02 valida na pratica; F4-03 (reparo) depende apenas do
schema de autoria (W5) e do vocabulario; F4-04 (cassete de autoria + suite
de rejeicao) e o ultimo, pois exercita o pipeline de autoria inteiro e
escreve em `src/autoria/executor/**`, que ninguem mais toca.

Gate completo apos **cada** merge — nunca ao fim da onda. A bisseccao e o
produto, nao a limpeza.

---

## 7. Faixas de id do ledger

Pre-alocadas. **Ids nunca sao reciclados** — o numero e citado no codigo.
Um card que esgotar a faixa para e pede faixa nova; nao invade a do
vizinho.

| Card | Faixa |
|---|---|
| F3-02 | 580..599 |
| F3-03 | 600..614 |
| F3-04 | 615..629 |
| F4-03 | 630..649 |
| F4-04 | 650..659 |

---

## 8. Numeros de ADR pre-alocados

A renumeracao terminou em `0026` (docs/adr/ tem `0001`..`0026` unicos). Os
numeros abaixo estao livres e sao deste card:

| Card | ADR |
|---|---|
| F3-02 | 0027 |
| F3-03 | 0028 |
| F3-04 | 0029 |
| F4-03 | 0030 |
| F4-04 | 0031 |
| I-03 (W6.5) | 0032 |
| I-04 (W9.5) | 0033 |

Quem mergear antes escreve o seu; o numero de um card nao pode ser tomado
por outro (ordem de merge §6 garante a sequencia). Os dois numeros de infra
(0032, 0033) foram pre-alocados para corrigir as referencias stale do
PROGRAMA.html (I-03 citava "ADR-0006" e I-04 citava "ADR-0007", numeros que
a renumeracao da W3/W4 ja ocupou com outros ADRs).

---

## 9. Faixas de porta TCP

Studio e preview simultaneos colidem em porta.

| Card | Porta | Card | Porta |
|---|---|---|---|
| F3-02 | 4302 | F4-03 | 4403 |
| F3-03 | 4303 | F4-04 | 4404 |
| F3-04 | 4304 | | |

(contiguas as da W5: 4301 e 4401/4402 ja reservadas para F3-01 e F4-01/02.)

---

## 10. A pergunta obrigatoria desta onda

A W6 e a onda em que cinco cards consomem os MESMOS dois contratos
(timing canonico e schema de autoria) e dois deles tocam a MESMA familia de
caminhos (`src/sincronia/**`, `tests/autoria/**`). O git nao vai ter em que
conflitar — e por isso vai **mergear em silencio codigo que discorda**.

Antes de fechar o handoff, cada agente responde:

> Existe alguma assercao neste diff sobre a **LISTA COMPLETA** de alguma
> coisa? Se sim, ela e verdade contra a sua base e pode ser **falsa depois
> do merge do irmao**. Reescreva como assercao sobre a **presenca do SEU
> item**, nunca sobre a ausencia dos outros.

Concretamente, nesta onda: **nao asserte listas fechadas de cenas, de
trechos, de intervalos, de estagios, de cassetes nem de entradas do timing
canonico** — asserte que o **seu** item esta la.

O caso mais caro e o F4-04 (AB-500/AB-502): o cassete de autoria so tem
sentido como prova de PRESENCA do proprio estagio/cassete — "o cassete do
MEU estagio tem o manifesto invalido gravado" — nunca "o pipeline inteiro
tem so N cassetes" nem "nenhum outro estagio existe" (assertar a ausencia
dos outros e o falso verde que o AB-502 fecha: o orquestrador ja lanca
`EEstagioDesconhecido` para nome fora da lista canonica, desde este PREP).

---

## 11. Dividas levadas a frente (dono: PREP / ondas seguintes)

| Item | O que e | Quem tropeca |
|---|---|---|
| AB-501 | O cassete de GRAFICO e metadata-only: os bytes do video renderizado NAO foram commitados. O F5-01 (render de ponta a ponta, W7) vai precisar dos bytes do grafico para o primeiro render integrado — primeiro tropeco do F5-01. | F5-01 (W7) |
| AB-493 | O pintor de cena de producao mora na suite integrada; `src/composicao/` ainda nao tem a camada de pintura em producao. Vira PREP-w7. | PREP-w7 |
| AB-396 / AB-397 | WebM vp9 sai `yuv420p` (sem alfa — o grafico composto vira retangulo opaco) e o encode nao-determinista (hash do asset varia entre gravacoes). Cartucho do F2-02/orquestrador quando o alfa entrar na composicao. | F2-02 / orquestrador |

Nenhuma destas bloqueia a W6: os consumidores da W6 trabalham sobre o
timing canonico e o documento de autoria, que sao textuais e tem bytes
commitados (ou replay).

---

## 12. O executor de autoria e o cassete do F4-04 (B1)

Alem do mapa §1, o F4-04 ganha um bloco proprio no contrato, porque o
cassete de autoria so testa alguma coisa se o CAMINHO DE CHAMADA que o
produz estiver no repositorio.

- **Dono:** `src/autoria/executor/**` (adicionado ao mapa do F4-04).
  O executor e o **cliente de chamada** do estagio de autoria:
  - usa os **schemas podados por fornecedor**
    (`src/autoria/contrato/schema/autoria.llm.anthropic.json` /
    `autoria.llm.openai.json`) para montar a chamada — nunca o schema
    completo;
  - respeita o **cache do F4-01** (hash do brief + prompt + modelo, C12 —
    `src/autoria/contrato/cache.ts`);
  - **valida via `rejeitar.ts` ANTES do pipeline** (`rejeitarSaidaInvalida`
    em `src/autoria/contrato/rejeitar.ts`): a resposta do LLM so entra no
    pipeline depois de validar contra o schema completo
    (`validarSaidaAutoria`, `src/autoria/contrato/validar.ts`).
- **Manifesto de gravacao do cassete de autoria = fixture canonica**
  (`fixtures/canonico/manifesto-valido.json`): o cassete de autoria grava
  contra o mesmo manifesto que o resto do pipeline usa — um manifesto
  diferente nao exercitaria o caminho real de resolucao.
- **AB-551/552/554 sao EVIDENCIA com credencial, NUNCA gate:** os tetos
  reais de rate limit dos provedores, a aceitacao de `temperature` e a
  degradacao silenciosa sao medidos por quem tem a credencial (comando de
  medicao no item de ledger) e registrados como evidencia — o gate local
  permanece **verde OFFLINE** (sem rede, sem chamada, cassete apenas).
  Um gate que dependesse de rate limit ou de resposta de provedor nao
  rodaria em CI local.

---

## 13. Limites AB-550/555 no texto do contrato (B2)

- **F4-03 e F4-04 operam APENAS sobre o Autoria.1.** O documento de
  autoria (schema de F4-01) e narrativa pura: `schema_version` `Autoria.1`,
  `nos`, `cenas`, `audio` — sem frames, sem layout, sem cor, sem hash
  exigido (AB-432), sem licenca.
- **A ponte para o S-4 (frames, layout, cor, hash e licenca) e da fronteira
  de resolucao/composicao.** Quem preenche esses campos e o AB-550 (aberto,
  responde F1-12), com destino F5-01 na W7. Nenhum card da W6 preenche a
  ponte; um F4-03/F4-04 que "completasse" o manifesto com frames/layout/cor
  estaria fora do contrato (o schema reprova a emissao — e proposital).
- **Nenhum card da W6 emite `clockWipe`/`cube`.** O vocabulario v1 de
  transicao do Autoria.1 e `fade`/`slide`/`wipe`/`flip`/`none` (AB-555:
  o S-4 tem `clockWipe`/`cube`, mas o pacote instalado diverge — a ponte e
  da resolucao, nao da autoria; emissao fora do vocabulario v1 e REJEICAO
  DEFINITIVA no F4-03, §3).
