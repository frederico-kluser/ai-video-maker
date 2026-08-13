# Arquivamento e escopo negativo — o corte (F6-05, W12)

**Card:** F6-05 (W12, o corte) · **Data:** 2026-08-13 · **Gate:** `just arquivar`
**Depende de:** F6-02 (runbook), F6-03 (gates P-1..P-5), F6-04 (fechamento do ledger)
**Registro da decisao:** ADR-0049 (docs/adr/0049-arquivamento-e-escopo-negativo.md)

Este documento congela **por escrito** o estado final do programa: o que era
vivo, o que morreu e o que virou manual. A regra que governa este arquivo e a
do playbook — *"se um dia o script for removido do gate, registre por escrito
que a regra virou manual: a ausencia de um verificador e indistinguivel de
conformidade"*. Aqui, toda regra cujo verificador automatico foi removido
declara isso **no mesmo documento** que a seção de vida.

---

## O que era vivo (estado final, 2026-08-13)

### O gate central — `tools/gate.sh`, 5 etapas, VERDE

| Etapa | O que roda | Ferramentas |
|---|---|---|
| `build` | `npx tsc --noEmit && python3 -c '...'` | node, python3 |
| `test` | `npx vitest run` + `python3 -m pytest tests/` (dois runners, rc capturados — C2) | node, python3 |
| `lint` | `npx tsc --noEmit && python3 -m ruff check src/ tests/` | node, python3 |
| `typecheck` | `npx tsc --noEmit` | node |
| `versoes` | node, python3, ffmpeg presentes | node, python3, ffmpeg |

O gate comeca verde com tudo vazio e cada card acrescenta uma etapa exigida
(Regra 4 do AGENTS.md). Hoje: **5 PASS, zero FAIL** (`bash tools/gate.sh`).

### Os gates proprios dos cards — 42 blocos no justfile

Cada card criou o SEU gate como receita hifenizada no justfile (convencao do
AB-284 — `just` 1.42 nao aceita `:` em nome de receita). Primeira receita de
cada bloco, na ordem do arquivo:

```
F1-01 comp-testar      F1-03 fontes-testar      F1-04 no-cabecalho
F1-05 no-texto         F1-06 no-lista           F1-07 no-midia
F1-08 no-codigo        F1-09 no-grafico-conferir F1-10 transicoes
F1-11 no-camadas       F1-12 int-composicao     F2-01 res-sem-cassete
F2-02 res-grafico-licenca  F2-03 res-locucao    F2-04 res-midia
F2-05 res-codigo-licenca   F2-06 res-musica     F2-07 res-offline-integrado
F3-01 timing-testar    F3-02 legendas           F3-03 ducking
F3-04 ritmo            F3-05 audio-mix          F4-01 autoria-contrato
F4-02 prompts-testar   F4-03 autoria-reparo     F4-04 autoria-offline
F5-01 render-fixture   F5-02 encode-perfis      F5-03 pos
F5-04 variantes        F5-05 thumb              F5-06 procedencia
F5-07 e2e              F5-08 gm-e2e             F5-09 render-cache
F6-01 revisar-gate     F6-02 runbook-publicacao F6-03 gates-validar
F6-04 ledger-fechar    F6-05 arquivar
I-04 politica-editorial (docs/contas.md; sem receita propria)
```

### Os oraculos vivos

- **Golden master** (F5-08): `just gm-e2e` — 2x identico, frames-chave +
  envelope de audio, qualquer mudanca de token/fonte/ferramenta acende o diff.
  Indice em `fixtures/gm/manifesto.json` com `naoCobre` declarado.
- **Gates numerados de publicacao** (F6-03): `just gates-validar` (exit 0) e
  `just gates-bloqueia` (VERMELHO sem os cinco `CONFERE` com evidencia anexada)
  — `docs/gates/P-1..P-5.md`, veredito `CONFERE` exige evidencia anexada.
- **Runbook de publicacao** (F6-02): `docs/runbooks/publicacao.md`, nascido
  `ENCERRADO COMO CONSTRUIDO E NAO DISPARADO`; `rg -q "GATE P-1"` no ∅-crit.
- **Dossie de revisao humana** (F6-01): `just revisar-gate`; sem dossie
  assinado pelos 4 papeis nao ha publicacao (G-HUM bloqueia).
- **Ledger de incerteza** (F0-03 + F6-04): `tools/validate-ledger.py` —
  schema exit 0 (a divida historica foi migrada neste card — ver secao
  "Divida historica"); `just ledger-fechar` (G-LED) com allowlist unica AB-950.
- **Determinismo por render 2x** (F1-12): `just int-composicao` — incluindo a
  sonda do cassete real do estagio grafico, corrigida neste card (ver secao
  "Decisoes do F6-05").
- **Estagios de resolucao**: `res-offline` derruba se um estagio descoberto
  no disco estiver sem cassete (Regra 6 do AGENTS.md — nunca pulado em
  silencio).

---

## O que morreu

| O que morreu | Quando | Registro |
|---|---|---|
| O cassete `.mov` qtrle/argb do estagio grafico (o `video/quicktime` com alfa) | 2026-08-13 | ADR-0009 D3, AB-490 |
| A expectativa provisoria `vp9/yuva420p` (alfa no webm) — FALSIFICADA: o bitstream sai yuv420p | 2026-08-13 | AB-397, ADR-0009 D3 |
| A sonda de ARVORE do cassete real (`renderToStaticMarkup` recusando o formato do cassete com `ErroDeGraficoOpaco`): o cassete real agora declara `video/webm`, que passa na guarda — a recusa em arvore nao tem mais o que recusar | 2026-08-13 | AB-390/AB-490 + este documento (sonda corrigida, ver secao de decisoes) |
| O comparador **byte a byte** do determinismo do video sob webm (`--conferir`): o libvpx-vp9 desta cadeia nao e determinista (medido) — o determinismo do video passou a ser provado na cadeia commitada | 2026-08-13 | AB-396, AB-682 |
| O gate de expiracao de tokens do app Google "nao verificado" como automatismo — vira reconferencia manual no dia do primeiro upload | 2026-08-13 | AB-871, runbook §6 |
| O numero "1.600 units por upload" como fato corrente — era verdade ate ~2025-12-04; hoje e bucket dedicado (2-0) | 2026-08-13 | AB-870, ADR-0046 |
| A verificacao do G-LED **no estado mergeado** — o F6-04 rodou o gate na propria worktree, ANTES dos irmaos F6-02/F6-03 mergearem; o estado mergeado nunca foi reverificado por maquina | 2026-08-13 | este documento, secao "O que ninguem conferiu" (item G-LED) |
| O `.mov` do golden — o golden compara frames decodificados do master QTRLE; o master mov morreu com o cartucho (o webm nao e usado no golden; o golden compara o PNG/audio da cadeia commitada) | 2026-08-13 | ADR-0044, naoCobre do golden |

Nada disto foi esquecido: cada linha acima tem o ADR, o item de ledger ou o
documento que registra a morte.

---

## O que virou manual

Esta e a secao que o ∅-crit do card exige: **toda regra cujo verificador
automatico foi removido declara aqui que virou manual**. A ausencia de um
verificador e indistinguivel de conformidade — por isso o registro e por
escrito, neste arquivo, com o verificador removido e o que o substitui.

1. **A comparacao byte a byte do video sob webm virou manual** (AB-396,
   AB-682). O verificador (`--conferir` comparando bytes) foi removido porque
   o libvpx-vp9 desta cadeia nao e determinista (medido). O que substitui: o
   determinismo e provado por render 2x na cadeia commitada (provar do F1-12,
   golden da F5-08) e o retorno a comparacao byte a byte fica **condicionado a
   um encoder determinista** — condicao registrada no ADR-0009 e no AB-396,
   verificada por quem trocar o encoder, nao por maquina hoje.
2. **A recusa do formato do cassete real em ARVORE virou manual** (AB-390,
   AB-490). O verificador (sonda qtrle antiga, `renderToStaticMarkup` da
   arvore integrada com o descritor do cassete) foi corrigido neste card: a
   recusa em arvore morreu com o `.mov`. O que permanece AUTOMATICO e a
   recusa em nivel de **guarda** (a funcao `conferirAssetDeGrafico` recusa
   `video/quicktime` nomeando o no — sondada no controle negativo da sonda
   corrigida); o que virou manual e a conferencia de que o **bitstream** do
   cassete tem alfa — hoje se sabe que nao tem (yuv420p, AB-397) e o caminho
   com alfa usa PNG RGBA (`resolvido-com-alfa.json`), decisao registrada, nao
   verificada por maquina.
3. **A verificacao do G-LED apos cada merge virou manual** (descoberta deste
   card). O F6-04 rodou `just ledger-fechar` na propria worktree e saiu
   VERDE; os itens dos irmaos F6-02/F6-03 (AB-870..898) mergearam depois e o
   estado mergeado hoje reporta 11 abertos em categorias bloqueantes (ver
   "O que ninguem conferiu"). Nenhum automatismo do orquestrador re-roda o
   G-LED entre merges — a reexecucao virou manual, e este documento e o
   registro de que ela e exigida (item AB-930).
4. **As reconferencias do dia do primeiro upload viraram manual** (AB-870,
   AB-871, runbook secao "O que ninguem conferiu"). O runbook as lista como
   passos de reconferencia — o verificador automatico nao existe porque a
   resposta so existe no dia do upload real.
5. **A norma de legendagem pt-BR virou citacao manual, nao assertacao**
   (AB-580). O verificador que grep-ava a citacao no ADR-0027 foi alinhado ao
   padrao de fechamento do F6-04 (evidencia anexada); a norma ABNT NBR
   15290:2016 esta anexada como evidencia e citada — nao ha teste que re-leia
   a norma.

---

## O que ninguem conferiu

Esta secao existe porque "o que ninguem conferiu" e tao parte do arquivamento
quanto o que foi conferido. Nenhum item abaixo foi fechado, deduzido ou
varrido para debaixo do tapete:

| Item | O que nao foi conferido | Dono da resposta | Registro |
|---|---|---|---|
| AB-871 | Disputa da **expiracao de tokens** do app Google: fonte terceira diz 7 dias (1-0), fonte oficial pode ser 2 anos (2-0) — reconferir no dia do primeiro upload | plataforma (dia do upload) | runbook §6, F6-02 |
| AB-870 | **Data exata da mudanca de quota** (2025-12-04) — fonte unica secundaria (1-0); paginas oficiais nao datam a mudanca | plataforma | runbook §6, F6-02 |
| AB-873 | Canal concreto do upload (YouTube via Data API v3) — fase de demonstracao com o canal real nunca disparada | plataforma | F6-02 |
| AB-874 | Audit de conformidade ToS do projeto de API — projeto nao auditado so publica private | operacao | F6-02 |
| AB-875 | A alavanca-mestra materializada como flag real — nunca executada num upload real | operacao | F6-02 |
| AB-849 | **Bytes de `assets/fontes/*.woff2` fora da chave C7** do cache de render — trocar uma fonte com o mesmo nome de familia muda o pixel e NAO muda a chave; correcao em `src/render/cache/chave.ts`, transferido ao dono F5-09 | dono | F5-08, aberto |
| AB-652/655 | **Limites reais da Anthropic** (degradacao silenciosa >5 niveis, request limits 20/24/16) e cassete do sosia — pendentes de credencial, nunca exercitados | dono (dia da credencial) | F4-04, aberto |
| AB-410/411/412 | **Bytes de voz reais** — cassete de locucao gravado contra sosia local; fidelidade de voz e canais de bytes do store nunca verificados com o provedor real | plataforma → dono | F2-03, aberto |
| AB-991/993/994/996/999 | Papeis documentais, clausula de nao-previsto, ciclo de negocio, reavaliacao juridica apos gatilho e disclosure de voz — decisoes do dono/juridico | dono/juridico | I-04, abertos |
| AB-392/393, AB-451, AB-573/574 | **5 itens `NAO_EXERCITADO`** — sonda nunca rodada por ambiente ausente (Manim, S-1 fechado, credencial TTS); estado honesto, nao fechamento por deducao | plataforma | fechamento F6-04 |
| **G-LED no estado mergeado** | **`just ledger-fechar` esta VERMELHO hoje** (11 itens ABERTO em categorias bloqueantes: AB-870, 871, 873, 874, 875, 891, 893, 894, 895, 896, 898 — faixas F6-02/F6-03). O F6-04 verificou o gate na worktree, antes do merge dos irmaos; o estado mergeado nunca foi reverificado. Nenhum destes 11 itens foi fechado aqui (fechar exigiria evidencia real que nao existe) nem teve `responde` alterado (os cards donos os classificaram assim). Decisao exigida do orquestrador no COMMIT-FINAL: fechar com evidencia real, marcar NAO_EXERCITADO com motivo, ou rever a classificacao com os donos — ver AB-930 | dono | este documento + AB-930 |

**Descoberta deste card (G-LED):** a ausencia de verificador e indistinguivel
de conformidade na pratica, nao so na teoria: o G-LED passou na worktree do
F6-04 e o estado mergeado, construido pela integracao dos irmaos, diverge
dele. A evidencia da divergencia:

```
$ python3 tools/validate-ledger.py --exigir-fechados --categoria plataforma,infra,operacao --permitir-aberto AB-950
Ledger: 271 itens (41 arquivo(s) de inbox)
11 erro(s) de fechamento:
  - AB-870: item ABERTO em categoria bloqueante (responde: operacao) ...
  - AB-871, AB-873, AB-874, AB-875, AB-891, AB-893, AB-894, AB-895, AB-896, AB-898 ...
```

---

## Escopo negativo — o que o programa NAO cobre (congelado)

| Nao coberto | Por que | Registro |
|---|---|---|
| O **MP4 final byte a byte** — o golden compara frames decodificados, nunca bytes do MP4 (o container carrega a versao do encoder) | falso oraculo | naoCobre do golden (F5-08) |
| **9:16** — o estrito e 16:9-only; nenhum artefato vertical existe | ADR-0042 decisao 4 | naoCobre do golden |
| **Windows / bundle self-contained** — o symlink de fontes aponta para o disco local; o golden e da maquina pinada | AB-272 (aceito para a maquina pinada) | fechamento F6-04 |
| **Rede em tempo de render** — o render estrito e offline por construcao; o golden nao bloqueia rede (o offline-guard cobre) | fronteira de rede | naoCobre do golden, ADR-0026 |
| **Comparecer em juizo / licenca comercial** — uso pessoal (ADR-0003); o gatilho de reabertura e o AB-950, aberto por desenho | escopo pessoal | ADR-0003, AB-950 |
| **Legenda queimada vs sidecar alem do inicio_s** — a coerencia e de inicio_s ONDE a queimada existe; duracao total nunca e comparada | AB-779 (fechado com decisao) | F5-03 |
| **Norma publica de legendagem alem da ABNT NBR 15290:2016** — CPL remetida a NBR 15610-1, nao medida | AB-580 | F3-02 |
| **Voz humana real** — o pipeline roda offline com cassete sosia; a voz real e fidelidade para o dia da credencial | AB-410 | F2-03 |
| **Encoder determinista do webm** — aceito nao-determinista com aviso; retorno condicionado a encoder determinista | AB-396 | ADR-0009 |

---

## Divida historica do ledger — migracao (decisao do F6-05)

A decisao (a) do F6-04 (ledger/fechamento.md) exigia: *"cada item da lista de
100 erros tem de migrar `categoria`/`responde`/`antecedencia` para o
vocabulario fechado, item a item, com o fechamento registrado"*. **Executado
neste card** — o modo schema saiu de VERMELHO (100 erros em 71 itens) para
VERDE:

```
$ python3 tools/validate-ledger.py
Ledger: 271 itens (41 arquivo(s) de inbox)
  ABERTO: 148 | FECHADO: 118 | NAO_EXERCITADO: 5 | INVIAVEL: 0
Validacao: OK
```

**Regra de mapeamento aplicada** (o conteudo de cada item — pergunta,
decisao provisoria, verificacao, impacto — NAO foi tocado; so os tres campos
de vocabulario e o campo ausente):

- `categoria` = a particao do panorama §7 cujo **subjeto** da pergunta mais se
  aproxima: maquina/rede/runtime/provedor-LLM → `ambiente` (precedente
  AB-650..655 do proprio fechamento F6-04); codec/formato/encode/composicao/
  desenho → `render`; Manim → `manim-bridge`; audio/legenda/TTS/locucao →
  `audio`; assets/licenca/store → `assets-licenca`; gates/CI/ferramentas de
  agente → `agentes-worktrees`.
- `responde` com id de card (F3-01, F4-04, F5-07, F5-01, F5-04, F1-12,
  PREP-w7, dono-de-tokens) → `dono` (o card respondeu — precedente AB-651/653);
  AB-410 (voz real, dia da credencial) → `plataforma → dono`.
- `antecedencia: merge` → `onda` (AB-394/395: o item nasceu da integracao da
  onda) / `commit` (AB-506: ancorado no commit 2444d44).
- AB-390/AB-580 (FECHADO com evidencia real, `evidencia.cmd !=
  verificacao.cmd`): o `verificacao.cmd` apontava para estado superado
  (cartucho qtrle / pesquisa) — corrigido para o comando da evidencia, na
  forma do proprio fechamento F6-04.
- AB-581/AB-584 (campo obrigatorio `decisao_provisoria` ausente): preenchido
  com a decisao provisoria corrente (CPS 20 herdado ate medicao pt-BR; safe
  area 9:16 provisional ate AB-071 fechar).

Distribuicao final: `ambiente` 19 · `render` 23 · `manim-bridge` 2 ·
`audio` 9 · `assets-licenca` 12 · `agentes-worktrees` 6 — 71 itens em
13 arquivos de inbox, 100 erros zerados. O selftest do validador
(`tools/validate-ledger_selftest.py`) permanece VERDE.

---

## Decisoes do F6-05

1. **Sonda `int-composicao-qtrle` corrigida para o cassete webm** (regressao
   registrada pelo F6-04, AB-490). A sonda nasceu na era do `.mov` qtrle/argb
   e o nome e historico (nao renomeada para nao tocar no bloco F1-12 do
   justfile). O contrato novo: a guarda do no aceita o descritor do cassete
   real (`video/webm` — o gap mimeType-vs-bitstream do AB-397), o controle
   negativo prova que a recusa do `.mov` aposentado permanece na guarda, e o
   render de verdade sai com conteudo (oraculo de entropia, C1 — o caminho de
   consumo e o PNG RGBA resolvido). `just int-composicao` voltou a VERDE.
   **Nao arquivada como "virou manual"** porque o verificador sobreviveu —
   so o contrato de arvore morreu (registrado na secao "O que virou manual",
   item 2).
2. **Divida historica do ledger migrada** (decisao (a) do F6-04, executada —
   secao acima).
3. **Item AB-930 aberto** (ledger/inbox/F6-05.json): o G-LED no estado
   mergeado — quem resolve os 11 itens abertos em categorias bloqueantes.
4. **ADR-0049** registra as decisoes com guarda executavel (`just arquivar`).

---

## O que este documento NAO cobre

- O runbook de publicacao (F6-02), os gates P-1..P-5 (F6-03) e o dossie
  (F6-01) — documentos proprios, vivos, nao arquivados.
- O fechamento do ledger (F6-04) — `ledger/fechamento.md`, com a allowlist
  e as decisoes item a item.
- A politica editorial (I-04) e o enquadramento de uso (ADR-0003, AB-950).
- O conteudo dos itens de ledger migrados — este documento registra o
  mapeamento de vocabulario, nao reescreve os itens.
