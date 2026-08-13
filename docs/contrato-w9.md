# Contrato da W9 — o join final: orquestrador de ponta a ponta (F5-07)

Commit `PREP-w9`. Publicado **antes** de qualquer worktree da W9 existir,
pela mesma razao dos contratos-w6/w7/w8: uma worktree materializa apenas o
que esta commitado, e a divergencia aparece no merge como trabalho a
refazer.

A W9 tem **um card so** — o F5-07, o join 7, que mergeia sozinho, de
proposito (PROGRAMA.html): ele e o ponto em que todos os insumos das
ondas 0..8 convergem e o unico lugar em que o pipeline inteiro pode ser
provado de verdade. A W9.5 (I-04, infra — politica editorial) e
convocada aqui apenas para as pre-alocacoes e rotas que este arquivo
registra (§11 e §13); ela roda direto no branch de integracao, fora da
onda.

**O que este PREP NAO entrega fora do contrato:** nenhum stub. Nenhum
arquivo de `src/pipeline/**` nem `tests/e2e/**` existe em disco — o F5-07
cria os seus no primeiro commit. A receita `produzir` do justfile e criada
pelo card, nunca pelo PREP (regra da W5/W7/W8: stub que o gate rodasse
deixaria o PREP vermelho).

---

## 1. Mapa arquivo -> dono

A segunda coluna e o que da contratualidade. Sem ela, isto e uma sugestao.

| Arquivo / diretorio | Dono | Os outros |
|---|---|---|
| `src/pipeline/**` | F5-07 | nao editam |
| `tests/e2e/**` | F5-07 | nao editam |
| `docs/politica-editorial.md` | I-04 (W9.5) | nao editam |
| `docs/adr/0033-*.md` | I-04 (W9.5) | nao editam |

### Compartilhados nesta onda — so acrescente

- `docs/adr/` — **um arquivo novo por card** com o numero pre-alocado
  (§11), nunca edite o de outro. O F5-07 escreve o `0042`; o I-04 escreve
  o `0033`.
- `ledger/inbox/<CARD>.json` — um por card, por construcao (faixas
  pre-alocadas na §11).
- `justfile` — bloco proprio no fim do arquivo, delimitado por
  `# === F5-07 ===` … `# === fim F5-07 ===`. Nunca edite receita alheia.
  **A receita `produzir` e criada pelo card; o PREP nao criou stub.**

**Nada mais e compartilhado.** Os singletons seguem proibidos, na
numeracao **canonica** do PROGRAMA.html/AGENTS.md (o contrato-w7 §1 tinha
a numeracao INVERTIDA — aqui a ordem e a da tabela de singletons do
PROGRAMA):

- **S-1** — `package.json` + lockfile Node. Proibido; o F5-07 nao adiciona
  dependencia (tudo que precisa ja esta em ondas anteriores).
- **S-5** — `src/design/tokens.ts` (+ espelho Python). Proibido, em
  LEITURA e em ESCRITA: o F5-07 NAO toca tokens (§6, AB-720..723).
- S-3 (`src/Root.tsx`), S-4 (`schema/manifesto.schema.json`) — tambem
  proibidos; o orquestrador consome as fronteiras publicas dos modulos,
  nunca os singletons.

### Dependencia lateral e proibida por construcao

A W9 tem um card so, e o F5-07 nao enxerga a W9.5 (I-04). Precisou de algo
entregue pelo I-04? E dependencia lateral — pare, entregue o que da, e
**nomeie a diferenca no handoff**. O consumo permitido e apenas dos
contratos FECHADOS das ondas 0..8 (listados na §3) e deste PREP.

---

## 2. C1 — a LISTA FECHADA E NOMEADA de artefatos do `just produzir --fixture canonico --estrito`

O ∅-crit do F5-07 no PROGRAMA e: **remover qualquer artefato de entrega
esperado tem de ficar vermelho por ausencia, com o nome do artefato**
(pergunta adversarial 1: "O pipeline declara sucesso com um artefato
faltando?" — nao pode). A lista abaixo **e** o que "esperado" significa.
Ela vive neste contrato e e materializada no F5-07 como **uma unica
constante nomeada** (ex.: `ARTEFATOS_ESPERADOS_DO_ESTRITO`), lida pelo
∅-crit por leitura — o teste **nunca a reescreve** e nunca digita um nome
de artefato a mao.

| # | Artefato | Formato / identidade | Dono da producao |
|---|---|---|---|
| 1 | `manifesto-resolvido.json` | ManifestoResolvido.1 (schema `ManifestoResolvido.1`) | F2-01 (W3) |
| 2 | master de video deterministico | PNG (`frame-[frame].png`, frame ABSOLUTO — AB-691) e/ou QTRLE (`.mov qtrle/argb`) — os codecs de `CODIFICADORES_DA_COMPARACAO` (F5-01, ADR-0035) | F5-01 (W7) |
| 3 | master de audio do mix | MixDocument.1 (ADR-0034) + bytes WAV f32le do master, com `MixDocument.ferramentas` (pins) | F3-05 (W7) |
| 4 | entregavel `entregavel.m4a` | AAC 192 kbps 48 kHz estereo, -23.0 LUFS, teto -1.0 dBTP conferido no CODIFICADO (ADR-0040) | F5-03 (W8) |
| 5 | sidecar `entregavel.srt` | serializado do MESMO LegendasCanonicas.1 (ADR-0027, ADR-0040) | F5-03 (W8) |
| 6 | `pos-documento.json` | PosDocument.1 (alvo, ganho, medicoes, hashes, pins — `PosDocument.1.ferramentas`) | F5-03 (W8) |
| 7 | variante **16:9** | unica variante do estrito (§6) — derivada do mesmo manifesto (pintor promovido, AB-493) | F5-04 (W7) |
| 8 | thumbnails | do mesmo manifesto, com contraste e piso de legibilidade (F5-05) | F5-05 (W7) |
| 9 | relatorio de procedencia | transitivo, origem declarada; `semOrigem` -> VERMELHO | F5-06 (W7) |
| 10 | **mp4 final muxado (NOVO)** | video (perfil deterministico do pipeline) + audio (entregavel.m4a do pos) num so container. **O pos NAO muxa** — a muxagem video+audio e do orquestrador (AB-776) | **F5-07 (W9)** |
| 11 | relatorio-final do pipeline | declaracao de sucesso com hash+tamanho de CADA artefato (1..10), **escrita POR ULTIMO** e atomica (tmp + rename, padrao S-8) | **F5-07 (W9)** |

**O ∅-crit le a lista da constante, nunca a reescreve.** Para cada um dos
11 itens: remover o artefato da saida, renomea-lo ou corromper o seu
conteudo (hash muda) tem de deixar o gate VERMELHO **nomeando o artefato**
— e o relatorio-final (11) nunca declara sucesso com um artefato faltando.

O artefato 11 e a resposta a pergunta adversarial 4 do card ("O relatorio
sobrevive ao fechamento do terminal?"): ele so existe se o pipeline
terminou inteiro, e a escrita atomica garante que um processo morto no
meio deixa ou o arquivo anterior ou nenhum — nunca um relatorio parcial
lido como sucesso.

---

## 3. C2 — ordem de estagios, entradas e saidas nomeadas

A ordem abaixo e o caminho do estrito. Cada linha tem entradas e saidas
NOMEADAS — o F5-07 encadeia pelo nome do artefato, nunca por posicao de
diretorio nem por "o estagio seguinte adivinha".

| # | Estagio | Entradas | Saidas (nomes) |
|---|---|---|---|
| 1 | autoria | tema (PULADA no estrito: `--fixture canonico`) | manifesto.json (Autoria.1) |
| 2 | reparo mecanico (F4-03) | manifesto | manifesto reparado/validado — **mecanico SEMPRE no estrito, zero LLM** (AB-635, §8) |
| 3 | resolucao offline (F2-01..F2-07) | manifesto + cassetes do F2-07 + store | `manifesto-resolvido.json` + assets no store (SHA-256) |
| 4 | timing (F3-01) | manifesto resolvido | TimingCanonico.1 (`timing-canono.json`) |
| 5 | composicao (F1-01..F1-12) | manifesto resolvido | composicao integrada (727 frames, c-001..c-005) |
| 6 | render (F5-01) | composicao + PlanoDeAudio (MixDeEmenda) | master deterministico PNG/QTRLE |
| 7 | encode (F5-02) | master | video codificado (perfil `deterministico: true` — §7) |
| 8 | mix (F3-05) | timing + envelope de ducking + cadencia + musica | master de audio (MixDocument.1 + bytes WAV) |
| 9 | pos (F5-03) | master de audio + LegendasCanonicas.1 | `entregavel.m4a` + `entregavel.srt` + `pos-documento.json` |
| 10 | variantes / thumbnail (F5-04/F5-05) | manifesto (pintor promovido) | variante 16:9 + thumbnails |
| 11 | procedencia (F5-06) | store + cassetes | relatorio de procedencia transitivo |
| 12 | **mux (F5-07)** | video codificado + `entregavel.m4a` | mp4 final (AB-776) |
| 13 | **relatorio-final (F5-07)** | todos os artefatos 1..10 + seus documentos | relatorio-final (11), atomico, por ultimo |

Um estagio que falha **nao deixa artefato parcial que o proximo consume**
(pergunta adversarial 2): a saida de cada estagio so e publicada atomica
(tmp + rename) e o consumidor exige hash + tamanho declarados — artefato
parcial e artefato ausente.

---

## 4. C3 — regra de retomada: re-execucao idempotente, nunca "retomar do estagio N"

A pergunta adversarial 3 do card e: **"A retomada por estagio usa cache
velho quando a entrada mudou?"** A resposta deste contrato e a politica do
orquestrador (AB-793/794/795):

- **A re-execucao e INTEGRAL e idempotente, chaveada por conteudo (C7).**
  Rodar `just produzir --fixture canonico --estrito` de novo nao "retoma
  do estagio N": ele re-executa o caminho inteiro, e cada estagio consulta
  o cache pela chave C7 (ADR-0041). Entrada mudou => a chave muda => MISS
  => re-render/re-encode. Entrada igual => HIT => bytes ja provados. A
  idempotencia e o contrato: o pipeline inteiro, de novo, e barato.
- **NUNCA "retomar do estagio N confiando no cache".** Pular estagios
  porque "o cache esta quente" e o falso-verde do card: o cache quente
  nao prova render (AB-685). A unica leitura de cache sem render que o
  orquestrador faz e a INSPECAO via `ArmazemDeCache` (AB-795 —
  `indicesPresentes`/`ler`/`meta`, a API de leitura do F5-09), para
  decidir e relatar, nunca para pular trabalho.
- **Expor `--cache-dir`.** A raiz default do cache e `/tmp/ai-video-maker/
  render-cache` (nao sobrevive a reboot — AB-793); o F5-07 expoe a opcao
  e decide a raiz e a politica de persistencia do processo (o ADR-0041
  nao decide politica de evicao nem persistencia).
- **Preservar a sonda de cache-miss (AB-685).** O e2e estrito herda a
  disciplina do F5-09: um ∅-crit com cache QUENTE nao prova render. O gate
  do F5-07 forca o MISS na primeira execucao (chave fria) e compara contra
  o render sem cache — acertar a chave pelo motivo errado tem de ser
  detectavel.
- O F5-07 nao precisa conhecer o mecanismo da chave: `calcularChaveC7` /
  `componentesDaChaveC7` (F5-09) ja a contem (AB-792) — o orquestrador
  consome a API, nunca reimplementa a chave.

---

## 5. C4 — fila unica de encode: UMA instancia no processo

O teto de sessoes de encode e da MAQUINA (S-10, ADR-0032: 4 NVENC + 4
libx264). **Quem juntar encodes paralelos cria UMA fila e passa a mesma
instancia para todos** (AB-705 decisao; AB-773: o pos usa fila INJETADA
justamente porque a instancia unica do processo e deste card).

- O F5-07 cria **uma unica instancia** de `criarFilaDeEncode()` (F5-02,
  ADR-0036 decisao 7) e a injeta em **todos** os `executarEncode` do lote
  — encode do pipeline, encode de conferencia do pos e qualquer encode de
  variante.
- **Nunca** criar uma fila por chamada: isso multiplicaria o teto da
  maquina por N e a GPU nao sabe de quantas filas veio cada sessao (o teto
  do ADR-0032 e um teto da maquina).
- A instancia unica e do processo do orquestrador; o gate declara quantas
  sessoes o hardware admite (padrao S-10).

---

## 6. C5 — escopo 16:9 APENAS no estrito

- **Nenhum artefato 9:16 entra na lista esperada (§2).** A variante 9:16
  do canonico e REPROVADA em dado real (AB-720: reflow vertical nao cabe
  no retangulo util provisional; AB-721: marcador de midia estoura a safe
  area; AB-722: vinheta e grade invadem o retangulo 9:16) — o 9:16 **nao e
  entregavel** desta fase. A lista §2 tem a variante 16:9 apenas; produzir
  ou exigir um artefato 9:16 no estrito e fora de escopo.
- **O F5-07 NAO toca `src/design/tokens.ts` (S-5)**, nem para ler nem para
  mudar: a revisao de tokens (zonas 9:16, safe areas, marcador, vinheta)
  e roteada para ANTES da W10 (§13, AB-720..723) — o golden do F5-08 nao
  pode nascer com tokens provisorios.
- **A conformidade visual de marcador/vinheta e territorio do F5-08/F6-01
  (W10)** — oraculo visual de ponta a ponta e revisao humana. O F5-07 nao
  cria oraculo proprio de conformidade visual; o estrito prova PRESENCA e
  HASH (lista §2), e a conformidade e das camadas F5-04/F5-05 ja
  mergeadas.

---

## 7. C6 — perfil deterministico: o estrito usa APENAS `deterministico: true`

- `--estrito` encoda **apenas** com perfis `deterministico: true` do
  catalogo do F5-02 (ADR-0036): `entrega-software` (libx264), com **crf 18
  como ponto de partida** (decisao 8 do ADR-0036 — os valores declarados
  sao pontos de partida; calibracao formal e deste card).
- **NVENC (`deterministico: false`) nunca no estrito** — sem garantia de
  determinismo entre execucoes (AB-700): sem golden, sem bytes de cache,
  sem artefato esperado. O NVENC pode existir em caminho NAO-estrito
  (calibracao/experimento), mas o gate do estrito nao o usa.
- **A escolha do perfil por padrao do pipeline e deciso de produto DESTE
  card, com evidencia** (AB-701): encodar o MESMO master nos dois perfis,
  comparar **tamanho + SSIM minimo por frame** e registrar a tabela em
  `docs/medicao`. **Nunca escolher por igualar numeros** de eixos
  diferentes (CRF nao se compara a CQ).
- **A evidencia de calibracao (tamanho + SSIM) vive no ADR-0042** (F5-07,
  §11) — junto com a declaracao de que **libvmaf esta AUSENTE deste build**
  (ffmpeg 6.1.1-3ubuntu5 responde `Unknown filter` — AB-701, placar 2-0);
  a metrica disponivel hoje e SSIM/PSNR nativos, e isso e declarado, nunca
  omitido.
- Determinismo do perfil: gate testa ao vivo (2x encodes = bytes
  identicos + framemd5 identico, ADR-0036 decisao 3).

---

## 8. C7 — e2e offline: cassetes do F2-07 + fixture canonica, zero LLM

- O e2e do F5-07 roda **offline** — mesma disciplina do F2-07 (W5): os
  estagios de resolucao consomem os **cassetes commitados** de
  `fixtures/cassetes/<estagio>/` e a **fixture canonica**
  (`fixtures/canonico/`), com a rede bloqueada. O estrito nunca chama rede.
- **`--fixture canonico` = autoria PULADA**: o manifesto da fixture entra
  direto, e o reparo (F4-03) roda em modo **mecanico** — **zero LLM no
  caminho estrito** (AB-635, decisao: default mecanico; o reparador LLM
  fica disponivel na injecao mas sem politica de uso no estrito).
- O e2e prova o caminho inteiro da lista §2 a partir dos mesmos inputs
  que as ondas anteriores ja provaram por partes — a integracao e o
  produto do card (merge limpo != integracao).

---

## 9. C8 — AB-745: o e2e prova o hash NOVO da emenda no relatorio

O contrato C3 da W7 (contrato-w7 §4) determinou: o F5-06 (relatorio de
procedencia) cita os bytes da emenda pelo **hash NOVO** (materializado
pelo F3-05, enderecado por conteudo), nunca o hash do audio-fonte. O e2e
deste card **prova essa leitura ponta a ponta**:

- o **PlanoDeAudio** do render (F5-01, `MixDeEmenda.cenas`) e o relatorio
  do F5-06 derivam do MESMO mix do F3-05: para a MESMA cena, o hash da
  emenda citado no relatorio (via marcador `emenda: audio-fonte=<sha>`,
  MARCADOR_DERIVACAO do F5-06) **e o hash NOVO** — igual ao do
  PlanoDeAudio — **nunca o antigo** (hash do audio-fonte).
- O ∅-crit: um relatorio citando o hash da fonte no lugar do hash da
  emenda fica VERMELHO (o falso-verde que o contrato C3 da W7 persegue,
  re-prova no caminho ponta a ponta).

---

## 10. C9 — pin do mux: o MESMO ffmpeg 6.1.1 do pos, verificado

- A muxagem (artefato 10) usa o **mesmo ffmpeg 6.1.1 do pos** e verifica o
  pin — o padrao `MixDocument.ferramentas` (F3-05, W7) herdado pelo
  `PosDocument.1.ferramentas` (F5-03, W8, AB-777): o documento do pipeline
  registra as versoes pinadas (ffmpeg 6.1.1 + node) e o gate **falha se a
  versao corrente divergir do pin**.
- Determinismo entre versoes de ferramenta e declarado por pin, nunca
  assumido. Bump de versao invalida o documento e exige re-verificacao —
  e a chave C7 (componente 5) acende o miss sozinha (ADR-0041).
- O mesmo pin vale para o relatorio-final (11): ele registra a toolchain
  com que os artefatos foram produzidos.

---

## 11. Pre-alocacoes

| Card | Onda | Faixa de ledger | ADR | Porta TCP |
|---|---|---|---|---|
| F5-07 | W9 | AB-800..AB-829 | 0042 | 4510 |
| I-04 | W9.5 | AB-990..AB-999 | 0033 | — |

Conferido neste PREP: `docs/adr/` tem `0001`..`0041` unicos em disco
(`0033` e `0042` estao LIVRES — o 0033 nao foi escrito e o 0042 nao
existe); as faixas AB-800..829 e AB-990..999 estao livres (o maior id em
uso e AB-988, do I-03); a porta **4510 esta livre** (as W7/W8 usaram
4305 e 4501..4506 e 4509 — 4510 nao tem dono).

**Os ADRs NAO nascem neste PREP** — os numeros sao reservados e escritos
pelos respectivos cards no seu commit: o **0042** (F5-07) carrega a
decisao de perfil do estrito e a **evidencia tamanho+SSIM** (§7), que so
existe depois da execucao do card; o **0033** (I-04) e o ADR da politica
editorial. Ids de ledger nunca sao reciclados — um card que esgotar a
faixa para e pede faixa nova; nao invade a do vizinho.

---

## 12. A pergunta obrigatoria desta onda

O F5-07 e o ponto em que o pipeline inteiro converge; o merge do irmao
que apodrece uma assercao aqui e o do F5-09 (W8, cache) ou qualquer
refactor futuro de estagio. O git nao vai ter em que conflitar — e por
isso vai **mergear em silencio codigo que discorda**.

Antes de fechar o handoff, o agente responde:

> Existe alguma assercao neste diff sobre a **LISTA COMPLETA** de alguma
> coisa? Se sim, ela e verdade contra a sua base e pode ser **falsa
> depois do merge do irmao**. Reescreva como assercao sobre a **presenca
> do SEU item**, nunca sobre a ausencia dos outros.

Concretamente, nesta onda (AB-790):

- **Os testes do pipeline asserem PRESENCA: "o artefato X existe com hash
  Y"** — para cada um dos 11 itens da §2 — **nunca lista fechada de
  modulos nem de faixas**. Nao asserte "os estagios do pipeline sao
  exatamente estes N" nem "as faixas do plano sao exatamente estas": a
  lista fechada apodrece com o merge do irmao. A lista §2 e a UNICA lista
  fechada, e ela e o contrato do ∅-crit (lida da constante, §2).
- A assercao de presenca dos artefatos do F5-09 e do F5-03 (que ja
  existem nesta base) e herdada: o e2e consome os modulos por leitura,
  nunca duplica os numeros deles (loudness, chave C7, codecs).

---

## 13. Roteamento de ABs

### FECHA na W9 (o F5-07 decide; o gate do card prova)

| AB | O que e | Decisao da W9 |
|---|---|---|
| AB-705 | Fila explicita de encode: quem e o DONO da instancia unica do processo | **F5-07 cria UMA fila** (`criarFilaDeEncode`) e injeta em todos os encodes do lote (§5) |
| AB-773 | Fila do pos e injetada; a dona da fila compartilhada | **F5-07** — o pos (F5-03) ja usa fila injetada; a instancia unica do processo e deste card (§5) |
| AB-774 | O catalogo do F5-02 nao tem perfil de AUDIO; o pos criou o seu com o mesmo contrato | **o perfil de audio do pos (PERFIL_AUDIO_POS) E o perfil de audio do pipeline** — o F5-07 NAO duplica perfil de audio no catalogo do F5-02; consome o do pos por leitura |
| AB-776 | O pos entrega m4a + srt + PosDocument.1; a muxagem com o video e de quem? | **mux do orquestrador**: o F5-07 muxa video + audio no mp4 final (§2 item 10, §3 estagio 12) |
| AB-793 | Raiz default do cache em /tmp; politica de persistencia e do F5-07 | **F5-07 expoe `--cache-dir`** e decide a raiz/politica do processo (§4) |
| AB-794 | renderizarComCache renderiza faixas de MISS contiguas com o budget do chamador | **F5-07 decide o particionamento final** e passa o budget — frames cacheados continuam servindo (unidade por frame absoluto) |
| AB-795 | O F5-07 precisa de 'ler o cache sem render' para a retomada | **inspecao sem render via `ArmazemDeCache`** (§4) — retomada idempotente, nunca pular estagio |
| AB-685 | Worker morto derruba o pipeline; cache quente nao prova render | **politica preservada**: sonda de cache-miss no gate do F5-07 (§4) |
| AB-700 | NVENC sem garantia de determinismo — amostra unica nao e garantia | **estrito e deterministico**: NVENC nunca no estrito (§7) |
| AB-701 | "Mais proximo de CRF" nao e equivalencia; escolha de perfil exige medicao de saida | **calibracao com evidencia tamanho+SSIM**, registrada no ADR-0042 (§7) |
| AB-635 | Reparador mecanico vs LLM: a costura existe, a politica nao | **mecanico SEMPRE no estrito, zero LLM** (§8) |
| AB-745 | Hash da emenda citado no relatorio F5-06 | **e2e prova o hash NOVO** (PlanoDeAudio do F3-05), nunca o antigo (§9) |

### ROTEIA (nao fecha na W9)

| AB | O que e | Roteamento |
|---|---|---|
| AB-720 / AB-721 / AB-722 | Reflow vertical 9:16 do canonico, marcador de midia e vinheta/grade fora do retangulo 9:16 provisional | **revisao de tokens ANTES da W10** — o golden do F5-08 nao pode nascer com tokens provisorios; o 9:16 nao e entregavel nesta fase (§6). O F5-07 NAO toca tokens (S-5) |
| AB-723 | Pesquisa 2026: zonas de UI das plataformas de video vertical | **FECHADO como evidencia** (ledger/evidencia/AB-723.txt); alimenta a revisao de tokens acima, nunca a substitui |
| AB-746 / AB-747 / AB-749 | Procedencia: gaps de data, asset de terceiro dentro de cena, origem do manifesto | **F6-01 (W10)** — o dossie de revisao humana decide o uso dos campos; gaps visiveis, nao bloqueio |
| AB-748 | Reavaliacao sob AB-950: o relatorio e suficiente? | **I-04 define o papel (quem reavalia), F6-01 executa** (dossie) — o F5-06 entregou a ferramenta; a suficiencia e juizo do dono |
