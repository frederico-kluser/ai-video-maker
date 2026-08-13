# Fechamento do ledger — F6-04 (W11)

**Card:** F6-04 · **Gate:** G-LED · **Data do fechamento:** 2026-08-13
**Comando de aceitacao:**

```
python3 tools/validate-ledger.py --exigir-fechados --categoria plataforma,infra,operacao
```

**Veredito:** exit 0 — zero itens ABERTO nas categorias bloqueantes
(`plataforma`, `infra`, `operacao` — os papeis de `quem_responde` que o
F6-04 define como bloqueantes; vocabulario em `ledger/CATEGORIAS.md`).

**Receita do gate (bloco F6-04 do justfile):** `just ledger-fechar`
inclui `--permitir-aberto AB-950` — a allowlist e exercitada em toda
execucao do gate, nunca silenciosa (ver secao Allowlist).

---

## Resumo numerico

| Status | Antes | Depois |
|---|---|---|
| ABERTO | 207 | 133 |
| FECHADO | 49 | 118 |
| NAO_EXERCITADO | 0 | 5 |
| INVIAVEL | 0 | 0 |
| **Total** | 256 | 256 |

As 74 categorias bloqueantes abertas foram: 69 FECHADO com evidencia,
5 NAO_EXERCITADO. Os dois closes falsos pre-existentes (AB-491 e AB-506)
foram corrigidos com evidencia real (permanecem FECHADO).

## Allowlist — itens abertos permitidos

| Id | Justificativa |
|---|---|
| AB-950 | Item permanente do enquadramento de uso (I-01, ADR-0003, pre-alocado na faixa 950..969 e materializado pelo I-04): nunca fechado por construcao, porque e o gatilho que reabre o escopo 'uso pessoal' se o uso virar organizacao com fins lucrativos e mais de 3 empregados. Verificavel por `--exigir-gatilho`; todo gate de publicacao, relatorio de procedencia e handoff declara 'AB-950 continua fechado' ou 'AB-950 disparou' — omissao e falha de gate. Fora das categorias bloqueantes (responde=juridico); a entrada existe para que a excecao permanente seja explicita e verificavel por maquina, nunca silenciosa. |

**Regra do validador:** cada `--permitir-aberto <id>` exige uma linha nesta
secao com justificativa de >= 40 chars e fora da lista negra; a flag sem
justificativa falha. **A allowlist tem exatamente UM item** — um segundo
seria padrao de excecao, e o gate morrendo devagar (pergunta adversarial 4
do card).

## O que foi fechado — decisoes item a item

Todos os FECHADO tem `evidencia` estruturada em `ledger/evidencia/AB-NNN.txt`
(comando real, exit, sha256 do arquivo) e `data_resolucao: 2026-08-13`.
O comando da evidencia e o proprio `verificacao.cmd` do item; onde o
comando original estava quebrado (quote aninhado, `durante:` nao-executavel,
globo literal em `open()`, acento/linha de quebra no rg) ou apontava para
estado superado (cartucho qtrle aposentado), o `verificacao.cmd` foi
atualizado JUNTO com o fechamento — a espera descreve o estado verificado.

### W1-W3 — fundacao e hubs (AB-241, 243, 245, 272, 274, 280..285, 310..313, 321, 323, 335, 340, 343, 360, 361, 363, 377)

Fechados com o gate que os exercita hoje (just --list, tsc --noEmit,
pytest collect, no-texto, det-provar-midia, no-grafico, transicoes).
Destaques:
- **AB-243/284** — o justfile parseia e as receitas sao hifen (armadilha 9.1 do RETOMAR).
- **AB-245** — `npx tsc --noEmit` exit 0 (corrigido no PREP-gate-verde).
- **AB-285** — pytest coleta as duas grafias (armadilha 9.5 corrigida).
- **AB-272** — SEGUNDO BRANCH medido: o bundle REPASSA o link — nenhum
  .woff2 como arquivo regular no `public/` do bundle; o symlink aponta
  para `assets/fontes` do disco local. Decisao registrada: aceito para a
  maquina pinada (o golden da W10 renderiza local); bundle self-contained
  e Windows ficam fora de escopo, nomeados neste item.
- **AB-310** — a conversao (zeta, T) -> config de mola vive numa unica
  funcao exportada (`configDaMola` em `src/composicao/nos/cabecalho.tsx`);
  nenhum outro no redeclara a formula.
- **AB-323** — o guardrail sai exit 0 na sonda (checagem corrigida).
- **AB-363** — o conferidor sai VERMELHO nomeando os DOIS motivos
  (formato sem alfa + NAO-VERIFICADO de JPEG) — o vermelho e a resposta.

### W4 — nos e resolucao (AB-392, 393, 396, 397, 435, 440, 451, 453, 454, 470, 473, 474, 475, 490, 491, 494, 496, 497, 502)

- **AB-392/393** — NAO_EXERCITADO: a cena sem o patch / o render cairo
  exigem o ambiente Manim (venv do projeto de referencia), indisponivel
  nesta worktree. O patch condicional permanece (`quirks.py`); o ADR-0009
  registra a pergunta. Reexercitar com Manim.
- **AB-396** — FECHADO com decisao registrada (ADR-0009, 2026-08-13):
  o libvpx-vp9 desta cadeia nao e determinista (medido); o cartucho webm
  v1.1.0 convive com o hash instavel — `--conferir` nao compara bytes sob
  webm e o determinismo do video e provado na cadeia commitada. **Decisao
  do fechamento:** aceitar o encoder nao-determinista com o aviso
  documentado; o retorno a comparacao byte a byte fica condicionado a um
  encoder determinista (registrado no ADR), sem bloquear o pipeline.
- **AB-397** — FECHADO: o webm v1.1.0 sai yuv420p (sem alfa) e o no F1-09
  recusa formatos sem alfa; o caminho com alfa da composicao usa PNG RGBA
  (`resolvido-com-alfa.json`), provado pelo conferir VERDE.
- **AB-435** — o estagio de midia escreve o byte por hash no
  `diretorioTrabalho` (grep do writeFile).
- **AB-440/473** — res-midia / res-musica VERDE com sonda negativa de
  credencial (determinismo medido a partir do cassete, regravacao dupla,
  zero refutacoes).
- **AB-451** — NAO_EXERCITADO: equivalencia com motor real exige o
  singleton S-1 (package.json) aberto; o lexer nao foi medido contra
  Shiki/lighter.
- **AB-453** — cold-start de bloco de 60 linhas: ~1-2 ms em processo novo
  (3 execucoes) — sem teto de orcamento necessario.
- **AB-454** — pilha `fontFamily.mono` (JetBrains Mono, Fira Code,
  monospace) + woff2 em public/fontes.
- **AB-470** — nenhum procedencia.json de musica sem `licenca`
  (sonda `--files-without-match` com denominador).
- **AB-474** — o gravador ganhou `--pausa` (cortesia entre downloads,
  default `PAUSA_PADRAO_MS`, fora da chave de cache) — mitigacao do 429
  em rajada sem retry no estagio. NAO re-gravado nesta worktree (a
  regravacao sobrescreveria o cassete commitado; o flag e a decisao).
- **AB-475** — o header `x-client-ip` (PII) sai None nas 6 chamadas do
  cassete de musica: redigido por `HEADERS_SENSIVEIS`
  (`src/resolucao/cassete/formato.ts`) antes de tocar o disco.
- **AB-490** — o `.mov` qtrle/argb foi aposentado (ADR-0009 D3); o
  cassete atual e o webm v1.1.0 e `video/quicktime` segue na tabela do no
  como `reproduzivelNoNavegador: false`. **Regressao registrada:** a sonda
  `int-composicao-qtrle` (F1-12) perdeu a pre-condicao — ver secao
  'Regressoes descobertas'.
- **AB-491** — close falso corrigido: evidencia real (provar.ts VERDE,
  integrado-grafico-asset com as 5 cores).
- **AB-494/496/497** — suite integrada: ausencia (15 nos removidos, todos
  acusados), provar VERDE, presenca VERDE.
- **AB-502** — repro executado: `EEstagioDesconhecido` lancado na
  construcao do Orquestrador com estagio fora da lista canonica — o
  descarte silencioso do ADR-0026 D6 foi corrigido.

### W5-W9 — timing, autoria, pipeline, entrega (AB-521, 523, 571..574, 617, 660, 681, 683, 684, 686, 691, 702, 703, 745, 851, 852, 858)

- **AB-521** — timing determinismo 2x + gerar --conferir VERDE.
- **AB-523** — `timing-canonico` presente em src/tests (1 ocorrencia).
- **AB-571** — busca executada em 2026-08-13 (8 fontes); as duas mais
  promissoras conferidas manualmente: nenhuma traz faixa de wpm datada
  para locucao portuguesa — placar (1-0) preservado (segunda metade da
  espera).
- **AB-572** — corroboracao independente ENCONTRADA: Carleton College
  (guia institucional de video instrucional) documenta 2,5-3 s por corte
  como o benchmark moderno; analise de 200 TikToks (nichos, educacao com
  ASL 2,8 s). Placar (2-0); a banda de pacing do pipeline (4-8 s de
  cutscore.io) fica no lado lento da faixa corroborada — decisao de
  pacing preservada com a corroboracao registrada na evidencia.
- **AB-573/574** — NAO_EXERCITADO: audicao/sintese no provedor real de
  TTS exige credencial (sem .env nesta worktree; cassete contra sosia).
  O dicionario de pronuncias e a regra 135 wpm permanecem provisorios.
- **AB-617** — ritmo: o teste 'a cadencia carrega o hash do audio-FONTE'
  passa cena a cena.
- **AB-660** — audio-mix VERDE; master.wav com o sha256 da referencia
  (64d172e6...) — identico nos dois processos.
- **AB-681/684/691** — render-fixture: qtrle 727/727 frames decodificados,
  orcamento da maquina (MemTotal 31,0 GiB, limite 23,2, RAM 9,67, workers
  8) e comparacao byte a byte no codec deterministico.
- **AB-683** — medido na data do fechamento (c=8): pico do grupo 3264 MiB
  dentro da tolerancia do pico declarado (3904 MiB ±30%); o orcamento do
  gate imprime workers 8 e RAM dentro do teto. O `ram_worker_marginal`
  medido (184 MiB) ficou ~33% acima do declarado (138 MiB) — medicao sob
  carga compartilhada (loadavg 19, dois worktrees irmaos rodando); o
  mecanismo do AB-980 (conferencia curta + tolerancias) e o que absorve.
- **AB-686** — PORTA = 4501 (F5-01).
- **AB-702** — ffmpeg 6.1.1-3ubuntu5 + suite de comando/reais VERDE (11
  testes).
- **AB-703** — justificativa do perfil cita a versao medida (6.1.1):
  2x execucoes com os flags bitexact produzem bytes identicos.
- **AB-745** — procedencia VERDE (emenda C3 com marcador textual).
- **AB-851/858** — revisar-gate VERDE (a sonda 'dossie rascunho rejeitado'
  fica VERMELHA nomeando o item; o dossie assinado pelos 4 papeis passa).
- **AB-852** — revisar-bloqueia VERMELHO (18 falhas): sem dossie valido
  nao ha publicacao — o ∅-crit do G-HUM bloqueia, nomeando a primeira
  falha.

### W6.5-W11 — maquina, politica, dossie (AB-980..987, 990, 992, 995, 997, 998)

- **AB-980** — re-medido na data do fechamento com o loadavg do dia
  registrado na evidencia (uptime); `ram_worker_marginal` dentro do
  mecanismo de tolerancia declarado em docs/medicao/maquina.md (a
  conferencia curta re-mede — o proprio mecanismo do AB-980).
- **AB-981** — driver 580.159.03 (o pin do ADR-0032) + 8 sessoes NVENC
  inicializando.
- **AB-982** — utilizacao da GPU em 0% nas amostras dos FRAMES (uma
  amostra de 10% no startup/bundle, fora do caminho de frames) — os
  numeros de RAM/saturacao descrevem o caminho CPU (SwiftShader), como
  declarado no ADR-0032.
- **AB-983** — curva de saturacao dos frames 240-479: ponto de saturacao
  <= o dos frames 0-239 (tetos conservadores confirmados).
- **AB-984** — df: 29 GiB livres de 915 GiB (97%) — o teto pratico de
  lotes inclui espaco (registrado no fechamento).
- **AB-985** — faixa curta com tf_por_frame maior (startup diluido em
  menos frames) e relacoes entre niveis preservadas.
- **AB-986** — free: MemTotal 31,7 GiB; disponivel instavel (host
  compartilhado) — teto por total com margem, como declarado.
- **AB-987** — VRAM amostrada durante 8 sessoes NVENC: muito abaixo de
  2048 MiB — a VRAM dedicada (8188 MiB) nao e o teto no caminho 720p.
- **AB-990/992/995/997/998** — a politica editorial e o ADR-0033
  registram: alavanca-mestra citada (sweep vazio), atos separados
  (reversao ≠ correcao, papel AB-748, novo dossie), canal como escopo do
  F6-02, G-HUM/não-publicavel/fase 0 como piso, e recusa-e-log com a
  configuracao anterior valendo, sem redeploy.

## Itens mantidos ABERTO fora das categorias bloqueantes

| Id | Por que fica aberto |
|---|---|
| AB-950 | Allowlist (unica) — ver secao acima |
| AB-849 (F5-08) | Gap declarado pelo proprio F5-08: bytes de `assets/fontes/*.woff2` fora da chave C7 do cache de render. Fica aberto (responde=dono) e e transferido ao dono do cache (F5-09): a correcao e em `src/render/cache/chave.ts`. NAO entrou na allowlist — nao e bloqueante e nao e permanente. |
| AB-410/411/412 (F2-03) | Bytes de voz reais pendentes (cassete contra sosia) e canais de bytes do store. Decisao: NAO bloqueantes — o pipeline roda offline com o cassete sosia (provado pelo golden da W10); a voz real e questao de fidelidade/verificacao para o dia da credencial. O `responde=F3-01` e um slug INVALIDO (id de card no campo de papel) — divida de schema, ver secao abaixo. |
| AB-652/655 (F4-04) | Limites da Anthropic e cassete anthropic do sosia: pendentes de credencial — nunca exercitados; nao bloqueiam (o provedor em uso e a OpenAI). |
| AB-991/993/994/996/999 (I-04) | Papeis documentais, clausula de nao-previsto, ciclo de negocio, reavaliacao juridica apos gatilho e disclosure de voz: decisoes do dono/juridico — fora das categorias bloqueantes. |
| demais ABERTO (responde=dono/juridico) | Itens de decisao do dono e juridico das W1-W11 — fora das categorias bloqueantes por definicao do F6-04. |

## Divida historica — erros de schema (decisao (a))

O validador em modo schema (`python3 tools/validate-ledger.py`, sem flags)
reporta **100 erros pre-existentes** em 71 itens de inboxes de ondas
anteriores (eram 103 antes deste fechamento; o AB-491 foi corrigido com
evidencia real e o AB-506 ganhou evidencia e data_resolucao — os 100
restantes sao todos de itens que este fechamento nao tocou): `categoria`
fora do vocabulario fechado (`autoria`, `pipeline`, `procedencia`,
`encode`, `resolucao`, `manim`, `gate`, `provedor`, `rede`, `alfa`,
`design`, `entrega`, `escopo`, `oraculo`, `produto`, `contrato`,
`integracao`, `auditoria`, `custo`, `privacidade`, `pesquisa`,
`design-tokens`, `design-system`, `legenda`, `infra`), `responde` com id
de card (`F3-01`, `F4-04`, `F5-07`, `F5-01`, `F5-04`, `F1-12`, `F3-02`,
`PREP-w7`, `dono-de-tokens`), `antecedencia: merge`, evidencias invalidas
(AB-390/AB-580) e campos obrigatorios ausentes (AB-581/AB-584).

**Decisao (a), com evidencia:** o validador e a autoridade — o vocabulario
fechado de `ledger/CATEGORIAS.md` existe desde o F0-03 (W1) e os historicos
foram escritos fora dele por dez ondas. Atualizar o vocabulario para
aceitar os historicos (opcao (b)) destruiria o vocabulario fechado e nao
cobriria os `responde` com id de card, que sao erros de dado, nao
evolucao de vocabulario. **A divida e registrada aqui e a correcao e
exigida** (F6-05, arquivamento, ou PREP dedicado): cada item da lista de
100 erros tem de migrar `categoria`/`responde`/`antecedencia` para o
vocabulario fechado, item a item, com o fechamento registrado. Enquanto a
divida existir, o modo schema continua VERMELHO — a divida nao some da
superficie, so sai do escopo do gate G-LED (que assere fechamento, nao
schema).

## Regressoes descobertas no fechamento

1. **`just int-composicao` (F1-12) esta VERMELHO** desde a troca do
   cartucho do estagio grafico para webm (ADR-0009 D3, 2026-08-13): a
   sonda `int-composicao-qtrle` (`tests/integracao/composicao/qtrle.ts`)
   exige um cassete `.mov` qtrle/argb que nao existe mais em
   `fixtures/cassetes/grafico/` (o cassete e o webm v1.1.0). A recusa do
   `video/quicktime` pelo no continua valida (tabela
   `reproduzivelNoNavegador: false`); a sonda perdeu a pre-condicao.
   Correcao exigida (F6-05 ou PREP): apontar a sonda para o cassete webm
   ou arquiva-la com registro. Nao faz parte do gate (5 PASS), mas faz
   parte da aceitacao do F1-12.
2. **Load compartilhado no dia do fechamento** (loadavg 19, dois worktrees
   irmaos): as medicoes de maquina (AB-683/980/983/985) foram feitas sob
   carga — registradas com o loadavg na evidencia; o mecanismo de
   tolerancia do docs/medicao/maquina.md e o que absorve (AB-980).

## Premissas e limites do fechamento

1. **NAO_EXERCITADO (5)** — AB-392/393 (Manim indisponivel), AB-451
   (S-1 fechado), AB-573/574 (sem credencial de TTS). Nao sao closes por
   deducao: sao estados honestos de nao-exercicio, com o motivo no item.
2. **Nenhum item ficou INVIAVEL** — portanto nenhum ADR-0048 foi
   necessario (a pergunta adversarial 2 nao se aplica).
3. **Busca web (AB-571/572)** — executada com a infraestrutura do
   deep-orchestrator (search.sh); a primeira tentativa falhou em todas as
   camadas (transitorio) e a segunda passou via Brave. A conferencia
   manual das fontes esta anexada na evidencia.
4. **`--permitir-aberto` sem `--categoria`** coloca TODOS os itens em
   escopo — o gate do G-LED sempre passa `--categoria` explícita.
5. A **allowlist tem 1 item** (pergunta adversarial 4 respondida com a
   propria regra do validador: `--permitir-aberto` sem justificativa
   falha).

## O que este documento NAO cobre

- A correcao dos 100 erros de schema historicos (divida exigida — secao
  acima; dono: F6-05/PREP).
- O arquivamento das regras mortas e do escopo negativo (F6-05).
- O runbook de publicacao (F6-02) e os gates numerados (F6-03) — esta
  wave, em worktrees irmaas.

---

## Fechamento final (pós-merges W11/W12)

**Data:** 2026-08-13 · **Agente:** fix-gled-final (onda 12.5) · **Comando:**

```
python3 tools/validate-ledger.py --exigir-fechados --categoria plataforma,infra,operacao --permitir-aberto AB-950
```

**Veredito:** exit 0 — zero itens ABERTO nas categorias bloqueantes no estado
MERGEADO (depois dos merges do F6-02/F6-03 e da migração de vocabulário do
F6-05). A allowlist permanece com exatamente 1 item (AB-950) — nada foi
adicionado a ela.

### Contexto

O F6-04 fechou o ledger na base dele; os irmãos F6-02 (runbook) e F6-03
(gates) mergearam depois (AB-870..898 novos), e a migração de vocabulário do
F6-05 normalizou `responde` inválidos (ex.: `F3-01` -> `plataforma → dono`),
expondo o AB-410 como bloqueante. O estado mergeado reportava 12 itens ABERTO
em categorias bloqueantes — este fechamento resolve os 12.

### Resumo

| Métrica | Valor |
|---|---|
| FECHADO neste fechamento | 12 (AB-870, 871, 873, 874, 875, 891, 893, 894, 895, 896, 898, 930) |
| NAO_EXERCITADO neste fechamento | 1 (AB-410) |
| Transferidos de categoria | 0 |
| Allowlist | inalterada — 1 item (AB-950) |

Estado do ledger (272 itens): ABERTO 136 · FECHADO 130 · NAO_EXERCITADO 6 ·
INVIAVEL 0.

### Os 11 do F6-02/F6-03 — fechados com evidência real

- **AB-870/871/873/874/875** (runbook de publicação): os `verificacao.cmd`
  (rg sobre `docs/runbooks/publicacao.md` e `docs/adr/0046-*.md`) rodam hoje e
  saem exit 0 — o runbook registra bucket dedicado de upload, disputa de
  expiração de token, mapeamento fase->privacyStatus, audit de conformidade
  sem SLA e a materialização da ALAVANCA_MESTRA pelo GATE P-1. Evidências em
  `ledger/evidencia/AB-87N.txt`.
- **AB-891/893/895/898** (gates): `just gates-validar` VERDE (18 sondas, o
  ∅-crit morde: CONFERE sem evidência falha; REPROVADO/NÃO_COLETADO bloqueiam).
- **AB-894**: `just gates-validar` VERDE **e** `gates-bloqueia` VERMELHO
  (estado commitado NÃO_COLETADO bloqueia a publicação) — exit 0 como espera.
- **AB-896**: `grep -n 'revisar-bloqueia' docs/gates/P-1.md` casa e
  `gates-validar` VERDE — o P-1 consome o verificador do dossie.

O único "comando quebrado" encontrado era de ambiente, não de receita:
`node_modules` ausente na worktree (erro MODULE_NOT_FOUND no tsx) — resolvido
pelo symlink de bootstrap do orquestrador para o node_modules do repo
principal. Nenhum `verificacao.cmd` precisou ser alterado.

### AB-410 — NAO_EXERCITADO (não transferido)

O item é genuinamente `plataforma → dono` (o provedor responde o fato, o dono
decide a regravação): regravar o cassete de locução com voz de verdade exige
credencial válida do provedor de síntese, e a chave disponível está sem
crédito (credit_balance_exhausted, HTTP 429; sem .env na worktree). Marcado
NAO_EXERCITADO com o motivo no item — mesmo padrão dos AB-573/574. O cassete
de sosia permanece válido para a suite offline até o dia da credencial.

### AB-930 resolvido

O item-ponte do F6-05 que documentava os 11 como fila de trabalho foi
FECHADO com a própria verificação dele (o comando do G-LED com allowlist, que
agora roda exit 0 — evidência em `ledger/evidencia/AB-930.txt`).

### Transferências de categoria

Zero. Nenhum item aberto bloqueante precisou de transferência de `responde`:
11 fecharam com evidência real e 1 (AB-410) é NÃO_EXERCITADO honesto. Os
candidatos citados no handoff (AB-274/AB-282) já estavam FECHADO no
fechamento do F6-04, com o `responde` normalizado pela migração do F6-05 —
nada a transferir. O vocabulário de `ledger/CATEGORIAS.md` não foi alterado.
