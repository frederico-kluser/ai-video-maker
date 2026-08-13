# ADR-0047 — Gates numerados de publicação (F6-03): o veredito CONFERE exige evidência anexada

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F6-03 (W11, 🔴 crítico) — gates numerados de publicação; um
  veredito `CONFERE` sem evidência anexada falha.
- **Artefatos:** `docs/gates/**` (README + os cinco gates P-1..P-5 +
  `evidencias/`), `tools/gates/` (verificar-gates.ts + gate.ts)
- **Comando de aceitacao:** `just gates-validar` com exit 0 (sondas do ∅-crit
  incluídas) e `just gates-bloqueia` VERMELHO contra os documentos commitados
  — o ∅-crit morde no artefato de demonstração do próprio card.
- **Numero pre-alocado:** PROGRAMA.html §III-12 (F6-03 -> 0047; 0046 fica
  reservado ao F6-02/W11, runbook de publicação).
- **Faixa de ledger:** AB-890..AB-909 (ledger/inbox/F6-03.json; itens
  abertos AB-890..AB-898).
- **Depende de:** I-04 (docs/politica-editorial.md — os papéis, as fases, a
  alavanca-mestra; ADR-0033), F6-01 (o dossiê e o gate G-HUM, ADR-0045),
  F5-06 (procedência, ADR-0039), F5-03 (áudio, ADR-0040), ADR-0003
  (enquadramento de uso pessoal, AB-950).
- **Consumida por:** F6-02 (W11, runbook de publicação — executa os gates
  P-1..P-5, referencia `GATE P-1`), F6-04 (W11, fechamento do ledger),
  F6-05 (W12, arquivamento).

## Contexto

A política editorial (I-04) define o que é publicável (§4) e nomeia quatro
papéis (§3); o dossiê do F6-01 prova a fase 1 (revisão humana). O que faltava
era a **execução** da passagem de fase: os **pré-requisitos numerados de
publicação** (PROGRAMA.html:2995) — cinco gates P-1..P-5 assinados por papel,
na forma do Apêndice G do PROGRAMA.html, com os quatro elementos
obrigatórios (condição de entrada · evidência exigida · artefato nominal ·
quem assina por papel nomeado).

Três perguntas adversariais do card governam este ADR:

1. **"Algum gate diz 'boas práticas' em vez do dano concreto?"** Não. Cada
   gate abre com a seção "O dano que este gate previne" e nomeia o dano —
   publicar vídeo que ninguém aprovou (P-1), asset com licença errada ou
   origem desconhecida (P-2), publicação sob o gatilho de escopo sem
   reavaliação (P-3), áudio fora de norma (P-4), publicação disparada com
   pré-requisito pendente ou alavanca desligada (P-5). "Boas práticas" não é
   dano e não passa no gate.
2. **"Existe `NÃO_COLETADO` que pode virar `CONFERE` sem evidência?"** Não —
   e a resposta é executável. O verificador (`just gates-bloqueia`) falha com
   `CONFERE` sem evidência anexada (o ∅-crit) e falha com `REPROVADO`/
   `NÃO_COLETADO` (bloqueiam). `NÃO_COLETADO` só vira `CONFERE` pela execução
   do comando do gate com a saída salva anexada — nunca por edição do
   veredito (o próprio gate prova isso por sonda).
3. **"Quem assina está nomeado por papel?"** Sim — os MESMOS quatro papéis
   acentuados da política §3 (vocabulário único em
   `tools/revisao/formato.ts`, `PAPEIS_DO_DOSSIE`), nunca "o time". O papel
   por gate é contrato deste ADR (§3).

## Decisões

### 1. Cinco gates P-1..P-5, na forma do Apêndice G, com os quatro elementos

Cada gate (`docs/gates/P-N.md`) declara: número e nome (cabeçalho
`# GATE P-N — ...`, que casa com o `rg -q "GATE P-1"` do ∅-crit do F6-02),
o dano concreto que previne, a condição de entrada, os três vereditos
possíveis, o comando literal de verificação, a evidência exigida, o artefato
nominal (`docs/gates/evidencias/<entrega>/P-N.txt` + o bloco anexado) e a
assinatura por papel nomeado. A cadeia é estrita: P-1 (dossiê G-HUM) →
P-2 (procedência G-PROC) → P-3 (enquadramento AB-950/AB-999) → P-4 (áudio
F5-03) → P-5 (autorização consolidada); cada gate só é acionado com o
anterior `CONFERE`.

### 2. O veredito `CONFERE` exige evidência anexada — saída de comando salva, nunca afirmação

O ∅-crit do card: **um gate com veredito `CONFERE` sem evidência anexada tem
de falhar** (PROGRAMA.html, Apêndice G — "um veredito que não pode existir";
é pior que `ABERTO`: para de ser reperguntado e vira premissa invisível). A
evidência é a **saída de comando salva**: bloco anexado no documento do gate
(marcador `F6-03:evidencia-anexada` + bloco de código) ou arquivo em
`docs/gates/evidencias/` (marcador `F6-03:evidencia-arquivo`, existente e
não vazio). `REPROVADO` e `NÃO_COLETADO` **bloqueiam** a publicação;
`NÃO_COLETADO` nunca vira `CONFERE` sozinho. Exceção estrutural, só no P-5
(marcador `F6-03:evidencia-auto`): o fecho consolidado é a própria
verificação — a evidência dele é a saída da rodada final do verificador,
salva pelo operador no ato (`tee`). Não existe comando externo que produza a
evidência do fecho sem circularidade; nenhum outro gate admite auto-evidência.

### 3. Assinatura por papel nomeado — o vocabulário fecha com a política

Os MESMOS quatro papéis acentuados de `tools/revisao/formato.ts` (Revisor
editorial, Revisor jurídico, Operador de reversão, Operador de publicação),
nunca "o time" — separação documental, não física (AB-991). O papel por gate:
P-1 e P-4 assinam pelo **Operador de publicação** (executa o runbook e aciona
os gates — política §3); P-2 e P-3 pelo **Revisor jurídico** (licenças,
origens, enquadramento — itens J1/J3 do F6-01); P-5 pelo **Revisor
editorial**, que "assina o veredito dos gates P-1..P-5" (política §3) — o
veredito consolidado do conjunto. O **Operador de reversão** participa da
cadeia pelo item R2 do dossiê (estado da alavanca-mestra, consumido pelo
P-5): quem reverte não decide o que é válido (política §3, regra 1).

### 4. O dossiê do F6-01 é o pré-requisito do P-1 — e a execução é por comando

O gate P-1 consome o dossiê via `just revisar-bloqueia`
(`tools/revisao/verificar-dossie.ts` — ADR-0045): sem dossiê válido, o P-1
não tem como passar. Cada gate consome o gate anterior do próprio conjunto —
nenhum caminho de publicação contorna os cinco (política §5).

### 5. Estado commitado: NÃO_COLETADO por construção — nada foi publicado

Os cinco gates estão commitados com veredito `NÃO_COLETADO` (nenhuma
evidência coletada — status ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO, como
a política e o runbook). `just gates-bloqueia` contra os documentos
commitados é VERMELHO de propósito — o mesmo padrão do dossiê-rascunho
canônico do F6-01 (ADR-0045, decisão 4): o gate de demonstração do próprio
card é rejeitado pelo ∅-crit que ele define.

### 6. `just gates-validar` (hífen) — divergência nomeada com o PROGRAMA.html

O PROGRAMA.html cita `just gates:validar` (dois-pontos); o justfile deste
repositório não suporta dois-pontos em nome de receita (just 1.42.4), então o
gate é `just gates-validar` (hífen, a convenção das demais receitas — o mesmo
caso do `gm-e2e` do F5-08, divergência nomeada no ADR-0044). O comando roda o
gate do card (`tools/gates/gate.ts`): presença per-item, estrutura dos
documentos e as sondas do ∅-crit; sai 0. `just gates-bloqueia` roda o
verificador (`tools/gates/verificar-gates.ts`), consumido pelo runbook F6-02
no fechamento.

### 7. Presença por gate, nunca lista fechada

A pergunta obrigatória da W10: o verificador e o gate do card asseguram
**presença** de cada artefato — cada um dos cinco gates, cada item do ledger,
cada receita — e falham com diretório vazio ou zero itens parseados
(`all([])` não aprova nada). "Ausente" e "passou" nunca imprimem a mesma
conclusão.

## Consequências

- **Positivas:** a publicação tem uma sequência executável de pré-requisitos
  com evidência anexada e assinatura por papel; o ∅-crit vira sonda por alvo
  (cada mutação do gate do card falha VERMELHO nomeando o gate e o motivo); o
  runbook F6-02 herda os comandos prontos e o token `GATE P-1`.
- **Negativas:** os gates não aprovam nada sozinhos — a publicação exige o
  ciclo completo (executar → salvar saída → anexar → assinar → verificação
  consolidada VERDE), e o verificador é VERMELHO por default até o ciclo
  acontecer (por construção).
- **Não afetadas:** `src/**` não é editado; `docs/politica-editorial.md` e
  `docs/runbooks/**` permanecem do I-04 e do F6-02 (W11); o F6-01 e o dossiê
  são consumidos, nunca alterados.

## O que este ADR NÃO cobre

- A execução da publicação e a materialização da alavanca-mestra como flag
  real — F6-02 (W11, runbook; AB-990).
- O fechamento do ledger e o arquivamento — F6-04/F6-05 (W11/W12).
- A revisão humana e o dossiê — F6-01 (W10, ADR-0045).
