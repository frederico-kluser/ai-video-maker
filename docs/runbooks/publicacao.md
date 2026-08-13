# Runbook de publicação — YouTube (canal único decidido pelo F6-02)

- **Status: ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO (2026-08-13).** Nenhum
  vídeo deste programa foi publicado; nenhum upload foi executado. Este
  runbook é procedimento escrito e gateado, não prática validada — e o
  cabeçalho **não é apagado** quando o primeiro vídeo sair: o status muda, a
  confissão fica (PROGRAMA.html:2240-2247).
- **Card de origem:** `F6-02` (W11, 🔴 crítico, pesquisa). Depende de: `F6-01`
  (W10, dossiê e `just revisar-bloqueia`), `F5-08` (W10, golden master).
- **Decisão canônica:** ADR-0046 (`docs/adr/0046-canal-de-publicacao-
  youtube.md` — canal, quota, verificação do app, conteúdo sintético, com
  data e placar). A política é o ADR-0033 (`docs/politica-editorial.md`).
- **Consumido por:** `F6-03` (W11, gates numerados P-1..P-5 — este runbook os
  referencia pelos nomes, não os implementa), `F6-04` (W11, fechamento do
  ledger), `F6-05` (W12, arquivamento).
- **Guarda executável do card (∅-crit corrigido, armadilha 9.2):**
  - `rg --files-without-match "## O que este documento NÃO cobre" docs/runbooks/*.md` → saída vazia — e o denominador **agora existe** (este diretório nasceu com este card): denominador zero é VERMELHO, nunca aprova (docs/criterios-de-aceitacao-corrigidos.md §1).
  - `rg -q "GATE P-1" docs/runbooks/publicacao.md` → presente.
  - `rg -q "alavanca-mestra" docs/runbooks/publicacao.md` → presente (sweep do I-04, que agora roda vivo).

---

## 0. A alavanca-mestra — leia isto primeiro

**A alavanca-mestra é a flag que desliga a publicação inteira.** Ela é **uma
só** — não há alavanca por canal, por fase ou por card (política
`docs/politica-editorial.md` §2, propriedade 1). Reversão é sempre **edição de
configuração, sem redeploy**; edição inválida é **recusada e logada**, e a
configuração anterior continua valendo (§2, propriedade 2 — AB-998). A
política §2.3 (propriedade 3) exige que **todo runbook subordinado a cite** —
esta seção existe por causa disso: quem executa este runbook sabe, na primeira
seção, que existe uma flag que desliga o que ele está prestes a fazer.

**A flag real (materializada por este card — AB-990, AB-875):**

```
# .env (raiz do repositório — nunca commitado)
ALAVANCA_MESTRA=off
```

- Estados válidos: `on` | `off`. Qualquer outro valor é **edição inválida**:
  recusada e logada, com a configuração anterior valendo.
- **Default: `off`.** Enquanto `off`, a **fase 0 é o único estado alcançável**
  — "sem alavanca, não há publicação" (política §2.4). Este runbook nasce com
  a flag desligada e o cabeçalho NÃO DISPARADO: nada abaixo foi executado.
- Quem a executa: **GATE P-1** (seção 4, passo 0) — a primeira porta do fluxo
  de publicação. `off` bloqueia a publicação inteira antes de qualquer outro
  passo, inclusive o dossiê e os gates numerados.

A alavanca se liga ao dossiê no **G-HUM** (AB-852): `just revisar-bloqueia`
é o ponto em que o dossiê do F6-01 entra na alavanca — **sem dossiê assinado,
a publicação bloqueia**. Não existe atalho: este runbook não cria caminho que
contorne o F6-01 (política §5).

## 1. O que este runbook decide e o que ele executa

Este runbook executa a publicação **no canal decidido por este card**:
**YouTube, via YouTube Data API v3**, canal único (AB-995: a política decide o
que é publicável e em nome de quem; o **onde** é decisão do F6-02 — ADR-0046
D1). O mapeamento das fases da política (§1) para o YouTube:

| Fase da política | Mecanismo | privacyStatus | Reverter |
|---|---|---|---|
| 2 — publicação privada / não listada | canal de teste, audiência zero | `private` | apagar |
| 3 — publicação listada, um vídeo | menor exposição | `unlisted` | despublicar |
| 4+ — cadência regular | N por semana | `public` | pausar a cadência |

As obrigações de plataforma (pesquisa 2026-08-13, placar no ADR-0046):

1. **Quota de upload:** `videos.insert` tem bucket dedicado "Video Uploads" de
   **100 chamadas/dia a 1 unit cada**; a pool geral do projeto é de
   **10.000 units/dia** (era 1.600 units por upload até ~2025-12-04 — data
   1-0, ver correções de citação §6 e ADR-0046).
2. **Verificação do app:** o escopo pessoal (<100 usuários) **não exige**
   verificação OAuth; o consent screen sai como **"In production"** sem
   verificação. Tokens emitidos em modo **Testing expiram em 7 dias** — são
   recusados por este runbook (AB-871).
3. **Conteúdo sintético (obrigação de plataforma, não opcional):** o payload
   de upload declara `status.containsSyntheticMedia` (boolean, adicionado em
   2024-10-30) com o valor correto da entrega.
4. **Audit de conformidade:** projetos de API criados após **2020-07-28** sem
   audit dos Termos de Serviço têm upload restrito a `private` — pré-requisito
   das fases 3+ (AB-874).

## 2. Os papéis nomeados — quem faz o quê

Os **mesmos quatro papéis da política §3**, com o vocabulário de
`tools/revisao/formato.ts` (os nomes fecham por string literal — alterar um
quebra o fecho de propósito). Nenhum ato é registrado em dois papéis ao mesmo
tempo; separação documental, não física (AB-991).

| Papel | Ato neste runbook | Registro |
|---|---|---|
| **Revisor editorial** | decide o que é **válido** — a montante, no dossiê (E1..E5) e nos gates P-1..P-5 | dossiê (F6-01) + veredito dos gates (F6-03) |
| **Revisor jurídico** | confere licenças, enquadramento (AB-993), disclosure de voz (AB-999) — J1..J4 | dossiê |
| **Operador de reversão** | **reverte tráfego**: puxa a alavanca-mestra, despublica, pausa cadência | edição de configuração da alavanca (válida, recusada ou logada) |
| **Operador de publicação** | **publica**: executa este runbook e aciona os gates P-1..P-5 | veredito `CONFERE` com evidência anexada (F6-03) + o registro de publicação (seção 4, passo 5) |

Regras que este runbook não negocia: **quem reverte não decide o que é
válido**; **quem publica não autoaprova** (o dossiê é assinado por papel
distinto); **reverter ≠ corrigir conteúdo** (despublicar é configuração,
corrigir exige novo dossiê).

## 3. Antes de começar — pré-requisitos com a evidência de cada um

Quem executa este runbook (provavelmente alguém que **não participou** da
construção) confere cada pré-requisito pelo comando, não por confiança:

| # | Pré-requisito | Evidência (comando) |
|---|---|---|
| 1 | A entrega existe em disco, com os artefatos de entrega | `ls output/relatorio-final.json output/relatorio-procedencia.json output/manifesto-resolvido.json` — os três presentes |
| 2 | O golden master da entrega foi aprovado (F5-08) | `just gm:e2e` — 2× idêntico, sem diff |
| 3 | O dossiê da entrega existe e está **assinado pelos 4 papéis** | seção 4, passo 1 (`just revisar-bloqueia`) — o próprio comando é a evidência |
| 4 | `AB-950` declarado ("continua fechado" ou "disparou") | `python3 tools/validate-ledger.py --id AB-950 --exigir-gatilho` — exit 0 |
| 5 | O ledger inteiro valida | `python3 tools/validate-ledger.py` — "Validacao: OK" |
| 6 | O canal está configurado (credenciais OAuth + projeto) | ver anexo A.3 — tokens **fora** do modo Testing (7 dias) |

Se **qualquer** pré-requisito falhar: **pare**. Não há "seguir mesmo assim":
cada um deles existe porque o custo de publicar sem ele é irreversível
(política §5).

## 4. O fluxo passo a passo — dossiê → gates → publicação

> **Aviso de denominador.** Este fluxo inteiro é NÃO DISPARADO: nenhum passo
> abaixo foi executado em produção. Cada passo traz **o que fazer**, **o
> comando** e **a evidência** — o que confere que o passo funcionou. Se a
> evidência não aparecer, o passo não aconteceu.

### Passo 0 — GATE P-1: a alavanca-mestra (a primeira porta)

**O que fazer:** conferir a flag antes de qualquer outra coisa — inclusive
antes de abrir o dossiê. Este é o ponto em que a alavanca-mestra é **executada**
por este runbook (AB-875): `off` desliga a publicação inteira.

```bash
# .env na raiz do repositório
grep -q "^ALAVANCA_MESTRA=off$" .env && echo "GATE P-1: VERMELHO — publicação inteira desligada (fase 0)" && exit 1
grep -q "^ALAVANCA_MESTRA=on$" .env && echo "GATE P-1: VERDE — alavanca liberada" || echo "GATE P-1: FALHA — flag ausente ou valor inválido (off|on); edição inválida é recusada e logada (AB-998)"
```

**Evidência:** a linha `ALAVANCA_MESTRA=on` no `.env`, com o valor exato —
ausência e valor inválido são a **mesma coisa**: bloqueio (a ausência nunca
aprova; o valor inválido é recusado e logado, e a configuração anterior —
`off` — continua valendo, AB-998).

**Se `off`:** fim. Nada abaixo pode ser executado. **Este runbook nasce com
`off`** — é por isso que o cabeçalho é NÃO DISPARADO.

> O F6-03 (W11) cria a formalização numerada dos gates P-1..P-5 em
> `docs/gates/**` (veredito `CONFERE` com evidência anexada — um veredito sem
> evidência falha). Este runbook executa o **GATE P-1** aqui — é a porta em
> que a alavanca desliga tudo — e os passos 2.1..2.4 abaixo **referenciam**
> P-2..P-5 pelos nomes, sem os implementar.

### Passo 1 — G-HUM: o dossiê entra na alavanca (F6-01, AB-852)

**O que fazer:** rodar o ∅-crit do F6-01 contra a entrega que vai ser
publicada. O operador de publicação **não** pode autoaprovar: o dossiê já veio
assinado por papel distinto (seção 2).

```bash
just revisar-bloqueia --entrega <id>
```

**Evidência:** a última linha imprime `revisar-bloqueia: VERDE — dossiê
válido para a entrega <id>` e `G-HUM liberado: a publicação pode seguir para
os gates P-1..P-5 (F6-03, W11)`. **Qualquer** VERMELHO (dossiê ausente, papel
sem assinatura, enquadramento ou disclosure ausentes, hash do relatório
adulterado, regeneração DIVERGENTE, entrega inexistente no disco) = bloqueio,
com o motivo nomeado. `VERMELHO` é o estado de repouso: um dossiê rascunho
(gerado por `just revisar`, sem assinatura) é rejeitado por construção —
gerar ≠ aprovar.

### Passo 2 — Os gates P-2..P-5 (F6-03, W11)

**O que fazer:** acionar os gates numerados restantes, criados pelo F6-03 em
`docs/gates/**` — este runbook **não os implementa** e não pode criá-los por
atalho (política §5). Os **nomes** P-1..P-5 são do F6-03; a sugestão de
alinhamento abaixo é provisória e aponta para os pré-requisitos que a política
§4 já lista — o F6-03 é o dono da definição:

| Gate | Pré-requisito (sugestão de alinhamento — definição é do F6-03) | Por papel |
|---|---|---|
| P-2 | a sucessão do G-HUM: dossiê assinado por papel nomeado | Operador de publicação |
| P-3 | procedência transitiva sem origem ausente (F5-06) | Revisor editorial |
| P-4 | `AB-950` declarado — nunca omitido (ADR-0003) | Revisor jurídico |
| P-5 | evidência anexada a cada veredito `CONFERE` | Revisor editorial |

**Evidência:** `just gates:validar` (F6-03) com todos os vereditos `CONFERE`
**e evidência anexada** — um `CONFERE` sem evidência falha.

### Passo 3 — O upload (YouTube Data API v3)

**O que fazer:** publicar a entrega no YouTube, na visibilidade da fase
corrente da política (§1). Executa **o Operador de publicação**, com o OAuth
client **"In production"** (escopo pessoal dispensa verificação — AB-871) e o
projeto já auditado se a fase for 3+ (AB-874).

**3.1. Montar o payload — com o campo obrigatório de conteúdo sintético**

```json
{
  "snippet": {
    "title": "<título da entrega, do relatório da entrega>",
    "description": "<descrição, com o disclosure de voz sintética quando houver locução TTS (AB-999)>",
    "categoryId": "28"
  },
  "status": {
    "privacyStatus": "private",
    "containsSyntheticMedia": true
  },
  "recordingDetails": {
    "recordingDate": "2026-08-13"
  }
}
```

- **`status.containsSyntheticMedia`** é **obrigatório** (não é opcional —
  obrigação de plataforma, pesquisa 2026-08-13, ADR-0046): `true` quando a
  entrega contém conteúdo realista alterado ou sintético (pessoa real
  parecendo dizer/fazer o que não disse/fez; gravação de evento ou lugar real
  alterada; cena realista que não ocorreu — inclusive voz sintética realista).
  **A omissão do campo é falha de publicação.**
- `privacyStatus` segue a fase da política: fase 2 = `private`; fase 3 =
  `unlisted`; fase 4+ = `public`.
- `categoryId` segue o quadro oficial de categorias (anexo A.6).
- `recordingDate` é o dia do render da entrega — registrado no relatório da
  entrega, nunca `Date.now()` no ato (o vídeo é função pura de um manifesto).

**3.2. Enviar o upload (protocolo resumable — anexo A.7)**

```bash
# 1) Iniciar a sessão resumable — resposta traz o header Location
curl -sS -X POST \
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,recordingDetails" \
  -H "Authorization: Bearer $YOUTUBE_TOKEN" \
  -H "Content-Type: application/json; charset=UTF-8" \
  -d @payload.json -D - | grep -i "^location:"
# 2) Enviar os bytes do arquivo para o Location retornado
curl -sS -X PUT "<LOCATION>" \
  -H "Authorization: Bearer $YOUTUBE_TOKEN" \
  -H "Content-Type: video/*" \
  --data-binary @output/video.mp4
```

**Evidência:** o JSON de resposta do PUT com `id` do vídeo, `status.privacyStatus`
e `status.containsSyntheticMedia` refletidos. Sem o `id` do vídeo, o passo não
aconteceu (C1: exit 0 de um HTTP não prova conteúdo — a resposta é a prova).

### Passo 4 — Verificação pós-upload (o vídeo publicado é este)

**O que fazer:** ler o vídeo de volta da API e conferir os três campos da
identidade da publicação — nunca confiar no que o passo 3 imprimiu.

```bash
curl -sS "https://www.googleapis.com/youtube/v3/videos?id=<id>&part=status,snippet" \
  -H "Authorization: Bearer $YOUTUBE_TOKEN" | jq -r '.items[0] | [.id, .status.privacyStatus, .status.containsSyntheticMedia, .snippet.title] | @tsv'
```

**Evidência:** a linha TSV com (a) o `id` esperado, (b) `privacyStatus` igual
ao da fase, (c) `containsSyntheticMedia` igual ao do payload, (d) `title`
igual ao da entrega. **Qualquer divergência = despublicar (Operador de
reversão) e reabrir o passo**, nunca "aceitar a diferença" (C4: a API devolve
o que foi gravado, não o que foi pedido).

### Passo 5 — O registro da publicação

**O que fazer:** registrar o ato no papel do **Operador de publicação**:
entrega, id do vídeo, privacyStatus, `containsSyntheticMedia`, data, e o
veredito dos gates P-1..P-5 com as evidências anexadas (F6-03). O registro é o
rastro da reavaliação sob AB-950 (AB-748) — sem ele, a publicação não
aconteceu.

## 5. Perguntas segregadas por interlocutor

O risco real: queimar a sessão de um interlocutor caro com pergunta que era de
outro. Cada interlocutor só recebe as perguntas da sua alçada; o anexo
responde o resto sem perguntar.

| Interlocutor | Perguntas (e só estas) |
|---|---|
| **Dono do programa** (pessoa física) | O escopo continua pessoal (ADR-0003)? `AB-950 continua fechado` ou `AB-950 disparou`? Qual fase a publicação atual (2, 3, 4+)? |
| **Revisor editorial** | O vídeo presta (E1..E5 do dossiê)? A fase pode subir (2→3→4+)? |
| **Revisor jurídico** | Licenças fecham (J1..J4)? Disclosure de voz sintética declarado (AB-999)? A entrega contém conteúdo realista alterado/sintético — `containsSyntheticMedia` verdadeiro ou falso? |
| **Operador de publicação** | Qual entrega e qual `--entrega <id>`? O dossiê assinado é desta entrega (P1..P2)? A flag está `on`? |
| **Operador de reversão** | A flag foi puxada alguma vez (log da alavanca)? Quem despublicou e quando? |
| **Plataforma (Google/YouTube)** | Somente o que o anexo não responde: status do audit de conformidade do projeto; se a política de expiração de tokens para apps não verificados mudou (disputa 1-0 vs 2-0, AB-871). |

## 6. Correções de citação antecipadas — para o leitor não concluir errado

1. **`rg -L` NÃO é "arquivos sem correspondência".** É `--follow` (seguir
   symlinks). O ∅-crit deste runbook usa `rg --files-without-match` **com
   guarda de denominador**: `docs/runbooks/` existe (nasceu com este card) —
   denominador zero é VERMELHO (docs/criterios-de-aceitacao-corrigidos.md §1).
2. **`status.selfDeclaredMadeForKids` ≠ `status.containsSyntheticMedia`.** O
   primeiro é conteúdo para crianças; o segundo é conteúdo realista alterado
   ou sintético. São dois campos de `status`, mas um não substitui o outro —
   este runbook exige o segundo, e a conferência de um não aprova a ausência
   do outro.
3. **O bucket "Video Uploads" (100 chamadas/dia) não é descontado da pool de
   10.000 units/dia.** São contadores separados: `videos.insert` gasta 1 unit
   do bucket dedicado; a pool de 10.000 cobre os demais endpoints (listagens,
   verificações). Não some um do outro.
4. **"1.600 units por upload" era verdade até ~2025-12-04** (data 1-0 —
   fonte única secundária; ver ADR-0046). Hoje o upload custa 1 unit em bucket
   dedicado de 100/dia (2-0, oficial). Um guia antigo dizendo 1.600 não
   contradiz este runbook — ele está datado.
5. **Monetização no YouTube NÃO dispara o gatilho AB-950.** O gatilho é
   "organização com fins lucrativos e mais de 3 empregados"; monetizar o vídeo
   é explicitamente não-disparo (ADR-0003, ADR-0033).
6. **O aviso de "app não verificado" no sign-in não é bloqueio.** No escopo
   pessoal (<100 usuários) o Google permite o uso sem verificação; o aviso é
   o mecanismo oficial de advertência (2-0). Bloqueio real: tokens de modo
   Testing (7 dias) e projeto não auditado (private-only).
7. **"Publicação privada" (fase 2) ≠ "não listada" no YouTube.** A fase 2 é
   `private` (audiência zero) e a fase 3 é `unlisted` — os termos da política
   e os do YouTube não são sinônimos; o mapeamento está na seção 1.

## 7. O que ninguém conferiu — para a lista não precisar ser reconstruída por arqueologia

1. **Duração do audit de conformidade do YouTube** — nenhuma fonte oficial
   publica SLA; o runbook não promete prazo (AB-874).
2. **Disputa da expiração de tokens: 1-0 vs 2-0.** Uma fonte terceira
   (unipile, 2026-07) afirma que o Google expira refresh tokens de apps **não
   verificados** em produção após 7 dias; as fontes oficiais lidas em
   2026-08-13 dizem que o limite de 7 dias é do modo Testing. **Não resolvido
   — reconferir no dia do primeiro upload** (anexo A.4; AB-871).
3. **Data exata da mudança de quota (2025-12-04)** — fonte única secundária
   (1-0); as páginas oficiais não datam a mudança (AB-870).
4. **`containsSyntheticMedia` na interface do YouTube Studio** — só a API foi
   lida; ninguém conferiu como o campo aparece na UI (irrelevante para o
   upload via API, mas a conferência é visual e não foi feita).
5. **A leitura de `.env` pelo harness do projeto** — `ALAVANCA_MESTRA` é
   configuração declarada; ninguém rodou o pipeline com a flag para provar a
   recusa-e-log (AB-998). O `.env.example` existe e é o espelho da flag; a
   leitura de `.env` é protegida por hook do harness.
6. **Nenhuma outra plataforma foi pesquisada** (TikTok, Vimeo, Odysee) — a
   escolha do YouTube é escopo mínimo orientado pelas perguntas do card, não
   comparação exaustiva (AB-873).
7. **A restrição de private-only de projetos não auditados** — lida na
   documentação oficial (2-0), nunca observada num upload real (nada foi
   publicado).
8. **`categoryId` "28"** (Science & Technology) — quadro oficial não relido na
   data da pesquisa; reconferir no anexo A.6.

## Anexo — como reconferir tudo isto você mesmo

### A.1. Os ∅-crits e os gates (offline, qualquer máquina)

```bash
# ∅-crit do F6-02 (sweep corrigido + guarda de denominador — o diretório existe)
test "$(ls docs/runbooks/*.md | wc -l)" -gt 0 || { echo "denominador zero: VERMELHO"; exit 1; }
rg --files-without-match "## O que este documento NÃO cobre" docs/runbooks/*.md | tee /dev/stderr | grep -q . && { echo "FALHOU"; exit 1; } || true
# ∅-crit do F6-02: GATE P-1 presente e status NÃO DISPARADO
rg -q "GATE P-1" docs/runbooks/publicacao.md
rg -q "ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO" docs/runbooks/publicacao.md
# sweep de subordinação do I-04 (agora roda vivo: todo runbook cita a alavanca-mestra)
rg --files-without-match "alavanca-mestra" docs/runbooks/*.md | tee /dev/stderr | grep -q . && { echo "FALHOU"; exit 1; } || true
# o gate do card
just runbook-publicacao
# os gates dos cards a montante
just politica-editorial
just revisar-bloqueia --entrega canonico   # espera VERMELHO: o rascunho canônico é rejeitado por construção
# NOTA: `python3 tools/validate-ledger.py` (ledger inteiro) está VERMELHO por
# dívida pré-existente de categorias inválidas de itens legados (AB-350..AB-808)
# — fechamento é do F6-04 (W11). Para validar o inbox DESTE card:
mkdir -p .tmp-inbox-f6-02 && cp ledger/inbox/F6-02.json .tmp-inbox-f6-02/ && \
  LEDGER_INBOX_OVERRIDE=.tmp-inbox-f6-02 python3 tools/validate-ledger.py
```

### A.2. A alavanca-mestra

```bash
grep -n "^ALAVANCA_MESTRA=" .env            # off|on — ausência ou valor inválido = bloqueio
```

### A.3. Quota de upload — reconferência na fonte oficial

```bash
# Estrutura atual: bucket "Video Uploads" de 100 chamadas/dia, 1 unit cada; pool de 10.000 units/dia
#   https://developers.google.com/youtube/v3/determine_quota_cost   (tabela "Quota cost per method")
#   https://developers.google.com/youtube/v3/docs/videos/insert     ("Quota impact: 100 calls per day")
# Histórico 1.600 units: múltiplas fontes independentes (3-0) — ver ADR-0046 §Pesquisa
```

### A.4. Verificação do app e tokens — reconferência na fonte oficial

```bash
# Escopo pessoal (<100 usuários) dispensa verificação:      support.google.com/cloud/answer/13464323
# Modo Testing expira tokens em 7 dias:                     support.google.com/cloud/answer/15549945
# Disputa 1-0 vs 2-0 (expiram em produção?): reconferir as duas páginas acima no dia do primeiro upload
```

### A.5. Conteúdo sintético — reconferência na fonte oficial

```bash
# status.containsSyntheticMedia (boolean, videos.insert/videos.update, adicionado 2024-10-30):
#   https://developers.google.com/youtube/v3/revision_history
#   https://developers.google.com/youtube/v3/docs/videos   (seção status.containsSyntheticMedia)
```

### A.6. Audit de conformidade e categorias

```bash
# Audit (projetos pós-2020-07-28 sem audit = upload restrito a private):
#   https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
#   formulário oficial: https://support.google.com/youtube/contact/yt_api_form
# Quadro de categorias (categoryId):
#   https://developers.google.com/youtube/v3/docs/videoCategories/list
```

### A.7. Protocolo de upload resumable

```bash
#   https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
```

---

## O que este documento NÃO cobre

- **Os gates numerados P-1..P-5 com veredito e evidência.** Isso é o `F6-03`
  (W11) — `docs/gates/**`, `just gates:validar`. Este runbook executa o
  GATE P-1 (a alavanca-mestra) e referencia P-2..P-5 pelos nomes.
- **A decisão do que é publicável e em nome de quem.** Isso é a política do
  I-04 (ADR-0033) — este runbook executa, não decide.
- **O checklist e o dossiê em si.** Isso é o `F6-01` (W10) —
  `docs/revisao/**`, `just revisar` / `just revisar-bloqueia`.
- **O fechamento do ledger e o arquivamento.** Isso é o `F6-04` (W11,
  `ledger/fechamento.md`) e o `F6-05` (W12, `docs/arquivamento.md`).
- **A fase 6 (automação ponta a ponta sem revisão humana).** A primeira etapa
  irreversível; a janela 5→6 é declarada pelo dono (AB-994), nunca por este
  runbook.
- **Outras plataformas** (TikTok, Vimeo, Odysee) — canal único YouTube
  (AB-873); a entrada de outra plataforma é registro (ADR + ledger), nunca
  decisão no ato de publicar.
- **A gestão do Google Cloud Console** (criação de projeto, OAuth client,
  cotas) — é operação da conta, fora do repositório; este runbook só consume
  o que ela produz (credenciais, status de audit).
- **A correção de conteúdo já publicado.** Corrigir exige novo dossiê (F6-01);
  despublicar é o único ato deste runbook para vídeo já publicado (seção 2 —
  reverter ≠ corrigir).
