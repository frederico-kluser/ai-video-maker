# ADR-0049 — Arquivamento e escopo negativo (F6-05): o que morreu fica registrado, o que virou manual fica escrito

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F6-05 (W12, o corte) — congela por escrito o que era vivo, o que
  morreu e o que virou manual.
- **Artefatos:** `docs/arquivamento.md` (o congelamento), `ledger/inbox/F6-05.json`
  (item AB-930), correcao de `tests/integracao/composicao/qtrle.ts` (a sonda
  do cassete real apontada para o webm v1.1.0), migracao de 71 itens do ledger
  (100 erros de schema zerados).
- **Comando de aceitacao:** `just arquivar` com exit 0 — ∅-crit do card
  (armadilha 9.2): se existe gate removido, o documento TEM de conter
  "virou manual"; a forma correta e `rg --files-without-match` (em ripgrep,
  `-L` e `--follow`, nao `--files-without-match`).
- **Numero pre-alocado:** F6-05 -> 0049 (o 0048 permanece reservado ao
  fechamento do ledger F6-04, que nao precisou dele — ver ledger/fechamento.md).
- **Faixa de ledger:** AB-930..AB-949 (ledger/inbox/F6-05.json; a faixa
  910..929 e do F6-04, que nao abriu itens; este card abre o 930, o primeiro
  da propria faixa).
- **Depende de:** F6-02 (runbook), F6-03 (gates), F6-04 (fechamento do
  ledger — a divida de schema e a regressao da sonda qtrle), F5-08 (golden e
  naoCobre).
- **Consumida por:** o orquestrador no COMMIT-FINAL (decisao dos 11 itens do
  G-LED no estado mergeado, item AB-930), e qualquer agente futuro que
  precise saber o que morreu sem reler o historico inteiro.

## Contexto

O programa termina: 57 cards, gate VERDE (5 etapas), golden, dossie, runbook,
gates de publicacao e ledger fechado nas categorias bloqueantes. Tres coisas
morreram no caminho sem que a morte ficasse registrada num so lugar — o
cartucho `.mov` qtrle/argb (ADR-0009 D3), o comparador byte a byte sob webm
(AB-396) e a recusa em arvore do cassete real pela sonda do F1-12 (AB-490). E
uma quarta coisa nunca foi verificada no estado mergeado: o G-LED (F6-04)
rodou na worktree do proprio card, antes do merge dos irmaos F6-02/F6-03 —
hoje, no estado mergeado, `just ledger-fechar` reporta 11 itens ABERTO em
categorias bloqueantes (AB-870, 871, 873, 874, 875, 891, 893, 894, 895, 896,
898). O F6-05 existe para que nenhuma dessas mortes seja silenciosa.

A regra que governa: *"se um dia o script for removido do gate, registre por
escrito que a regra virou manual — a ausencia de um verificador e
indistinguivel de conformidade"* (playbook, `:228-229`).

## Decisoes

### 1. `docs/arquivamento.md` congela o que era vivo, o que morreu e o que virou manual

O documento tem as secoes obrigatorias: "O que era vivo" (gate.sh 5 etapas,
42 blocos de gates por card no justfile, oraculos vivos), "O que morreu"
(com ADR/item de ledger por linha), "O que virou manual" (cada verificador
removido nomeado, com o que o substitui), "O que ninguem conferiu" (as
disputas abertas e a descoberta do G-LED no estado mergeado) e "Escopo
negativo". O ∅-crit do card e executavel (`just arquivar`): `rg
--files-without-match "virou manual" docs/arquivamento.md` tem de ser vazio —
a armadilha 9.2 do RETOMAR-AQUI e que `rg -L` em ripgrep e `--follow`, nao
"files without match".

### 2. A sonda do cassete real (F1-12) e corrigida, nao arquivada

A regressao registrada pelo F6-04 (AB-490) tinha duas saidas: apontar a sonda
para o cassete webm ou arquiva-la com registro. Corrigir e a saida honesta: o
verificador sobrevive (a sonda e parte da aceitacao do F1-12) e o que morreu
foi o CONTRATO de arvore — o `.mov` qtrle/argb nao existe mais e o cassete
real (webm v1.1.0) passa na guarda do no. A sonda nova asserta: (1) a guarda
aceita o descritor do cassete real (`video/webm` — o gap mimeType-vs-bitstream
do AB-397), (2) controle negativo: a guarda continua recusando `video/quicktime`
nomeando o no (a recusa do AB-490 permanece), (3) o render de verdade sai com
conteudo (oraculo de entropia, C1 — o caminho de consumo e o PNG RGBA
resolvido, decisao do AB-397). `just int-composicao` voltou a VERDE. O nome
do arquivo (`qtrle.ts`) e historico e foi mantido para nao tocar no bloco
F1-12 do justfile, que e dono do arquivo.

### 3. A divida historica do ledger e migrada, nao arquivada como divida

A decisao (a) do F6-04 exigia a migracao item a item. Os 71 itens (100 erros
de schema: `categoria`/`responde`/`antecedencia` fora do vocabulario fechado,
evidencia divergente em AB-390/AB-580, `decisao_provisoria` ausente em
AB-581/AB-584) foram migrados para o vocabulario fechado, com a regra de
mapeamento registrada em `docs/arquivamento.md`. O modo schema
(`python3 tools/validate-ledger.py`) sai de 100 erros para `Validacao: OK`;
o selftest permanece verde. O conteudo dos itens nao foi tocado.

### 4. O G-LED no estado mergeado e um achado, nao um fechamento

Os 11 itens abertos em categorias bloqueantes (faixas F6-02/F6-03) NAO foram
fechados nem reclassificados aqui — fechar exigiria evidencia real que nao
existe, e a classificacao e dos cards donos. O achado fica registrado em
`docs/arquivamento.md` ("O que ninguem conferiu") e como item de ledger
AB-930, enderecado ao orquestrador no COMMIT-FINAL: fechar com evidencia,
marcar NAO_EXERCITADO com motivo, ou rever a classificacao com os donos.
Nenhuma dessas tres saidas e feita por maquina hoje — a reexecucao do G-LED
apos merges virou manual (registro na secao "O que virou manual", item 3).

## Consequencias

- Um agente futuro le `docs/arquivamento.md` e sabe, sem reler o historico,
  que o `.mov` morreu, que o byte-compare sob webm virou manual, e que o
  G-LED no estado mergeado tem 11 abertos a resolver (AB-930).
- O `just arquivar` e o guarda executavel desta decisao: falha se o documento
  sumir ou se a frase "virou manual" sumir dele.
- O 0048 continua livre (reservado ao F6-04, que nao precisou dele).

## O que este documento NAO cobre

- O conteudo do arquivamento em si — `docs/arquivamento.md` e o artefato; este
  ADR registra as decisoes e o guarda.
- O fechamento do ledger (F6-04) — `ledger/fechamento.md`.
