# ADR-0046 — Canal de publicação (YouTube, via Data API v3) e as obrigações de plataforma (F6-02): quota, verificação do app e conteúdo sintético

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F6-02 (W11, 🔴 crítico, pesquisa) — runbook de publicação; nasce
  **ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO**: o procedimento está escrito e
  gateado, nenhum vídeo foi publicado.
- **Numero pre-alocado:** PROGRAMA.html §III-12 (F6-02 -> 0046; 0045 foi o
  dossiê do F6-01/W10).
- **Faixa de ledger:** AB-870..AB-889 (ledger/inbox/F6-02.json; itens abertos
  AB-870..AB-875).
- **Depende de:** ADR-0033/I-04 (política editorial — papéis, fases, alavanca-
  mestra, AB-995: o canal é decisão do F6-02), ADR-0045/F6-01 (dossiê — o
  runbook chama `just revisar-bloqueia`, AB-852), ADR-0044/F5-08 (golden
  master), ADR-0003 (enquadramento de uso pessoal, AB-950).
- **Consumida por:** F6-03 (W11, gates P-1..P-5 — o runbook referencia os
  nomes, não os implementa), F6-04 (W11, fechamento do ledger), F6-05 (W12,
  arquivamento).
- **Guarda executavel:** `just runbook-publicacao` com exit 0 — presença,
  ∅-crit corrigido do runbook (sweep com guarda de denominador), GATE P-1,
  status NÃO DISPARADO, alavanca-mestra citada, ADR e ledger válidos.

## Contexto

A política editorial (ADR-0033, I-04) responde **o que** é publicável e **em
nome de quem**; **onde** (o canal) ficou declaradamente em aberto: o AB-995 do
I-04 registra *"o F6-02 (W11) decide o canal concreto e as obrigações
específicas dele"*. Este ADR decide o canal — **YouTube, via YouTube Data API
v3, canal único** — e registra as obrigações de plataforma que a pergunta de
pesquisa do card exige (PROGRAMA.html:1724): custo em quota de um upload e
quota diária default; se o escopo exige verificação do app e qual o prazo
dela; e **qual campo do payload declara conteúdo sintético** — este último
marcado no card como *"não é opcional — é obrigação de plataforma"*.

A escolha do canal foi orientada pelas próprias perguntas de pesquisa do card,
que só fazem sentido para o YouTube (quota em *units*, verificação de app do
Google Cloud, campo de disclosure de conteúdo alterado/sintético) e pelo
mapeamento das fases da política (§1) aos estados de privacidade do YouTube
(fase 2 privada = `private`; fase 3 listada = `unlisted`; fase 4+ cadência =
`public`). **A escolha não é comparação exaustiva de plataformas** — nenhuma
outra plataforma foi pesquisada; está na seção "o que ninguém conferiu" do
runbook e no AB-873.

## Pesquisa — data e placar (2026-08-13)

Pesquisa feita com o sistema de busca do deep-orchestrator
(scripts/search.sh — cadeia surf-skill → Brave → DuckDuckGo), com verificação
direta das páginas oficiais por leitura da fonte. Placar no formato do
programa: `N-M` = N fontes independentes a favor, M contra.

### 1. Custo em quota de um upload e quota diária default

**Resposta:** a quota diária default de um projeto com a YouTube Data API v3 é
**10.000 units/dia** (pool geral), e o upload (`videos.insert`) tem um
**bucket dedicado "Video Uploads" de 100 chamadas/dia, a 1 unit por chamada**.
O `search.list` também tem bucket próprio de 100 chamadas/dia. As 10.000
units/dia cobrem os demais endpoints.

- Estrutura atual (bucket dedicado de 100 uploads/dia a 1 unit + pool de
  10.000 units/dia): **placar (2-0)** — duas leituras diretas da página
  oficial `developers.google.com/youtube/v3/determine_quota_cost` e da página
  do método `developers.google.com/youtube/v3/docs/videos/insert` ("A call to
  this method has a quota cost of 1 unit in the Video Uploads quota bucket" /
  "Quota impact: 100 calls per day"), em 2026-08-13.
- Histórico (videos.insert custava **1.600 units** por chamada): **placar
  (3-0)** — Stack Overflow, Reddit e múltiplos guias independentes
  (getphyllo, outlierkit, blotato) concordam no valor de 1.600 por chamada
  durante anos.
- Data da mudança (1.600 → bucket dedicado em **2025-12-04**): **placar
  (1-0)** — fonte única secundária (getphyllo); as páginas oficiais não datam
  a mudança. A data fica registrada como 1-0, não como fato correntio.
- Consequência de dimensionamento: com 1.600 units/upload e pool única, o
  teto era 6 uploads/dia; com o bucket dedicado, o teto é 100 uploads/dia
  dentro do bucket — a cadência da fase 4 (N por semana) cabe com folga nos
  dois regimes, mas o orçamento de units restante para os demais endpoints
  (verificação pós-upload, listagens) é o que limita o volume, não o upload
  em si.

### 2. Verificação do app — escopo pessoal dispensa, e os dois prazos que importam

**Resposta:** o escopo **não exige verificação OAuth do app**: apps de uso
pessoal com **menos de 100 usuários** usam o Google sem verificação — os
usuários passam pelo aviso de "app não verificado" durante o sign-in
(support.google.com/cloud/answer/13464323, **placar (2-0)**). Não há prazo a
cumprir nesse caso. Dois prazos/restrições que importam de fato:

1. **Modo Testing expira refresh tokens em 7 dias** e limita a 100 usuários
   de teste (support.google.com/cloud/answer/15549945, **placar (2-0)**). O
   runbook adota **"In production" sem verificação** (permitido no escopo
   pessoal): as fontes oficiais indicam que em produção os refresh tokens
   não expiram salvo revogação ou inatividade prolongada (~6 meses)
   (developers.google.com/health/setup, **placar (2-0)**).
2. **Disputa registrada:** uma fonte terceira (unipile.com, 2026-07) afirma
   que o Google passou a expirar **todos** os refresh tokens de apps **não
   verificados** após 7 dias, mesmo em produção (**placar (1-0)**) — contraria
   as fontes oficiais citadas acima. A disputa não é resolvida aqui; o runbook
   registra a divergência e o passo de reconferência que a fecha (anexo).

**Restrição de plataforma (YouTube):** projetos de API **criados após
2020-07-28** sem audit de conformidade com os Termos de Serviço do YouTube
API Services têm `videos.insert` restrito a **private viewing mode** — o
upload nasce privado até o projeto passar pelo audit (página oficial do
recurso videos + guia `quota_and_compliance_audits`, **placar (2-0)**). O
audit é solicitado por formulário oficial (support.google.com/youtube/contact/
yt_api_form) e libera upload público. **Não foi encontrado SLA oficial do
audit** — a duração está na seção "o que ninguém conferiu" (AB-874).

### 3. Campo do payload que declara conteúdo sintético — obrigação de plataforma

**Resposta:** `status.containsSyntheticMedia` — **boolean** do recurso
`videos`, setado em `videos.insert`/`videos.update`, adicionado à API em
**2024-10-30** (revision history oficial, **placar (2-0)**). A definição
oficial: permite ao dono do canal divulgar que o vídeo contém conteúdo
realista **Alterado ou Sintético (A/S)** — fazer uma pessoa real parecer
dizer/fazer o que não disse/fiz, alterar gravação de evento ou lugar real, ou
gerar cena realista que não ocorreu. **Não é opcional**: o runbook torna o
campo parte obrigatória do payload de upload quando a entrega contém conteúdo
A/S, com verificação pós-upload por `videos.list`.

## Decisões

### D1 — Canal único: YouTube, via YouTube Data API v3

Canal de publicação é **um só**: YouTube, via YouTube Data API v3
(`videos.insert`/`videos.update`/`videos.list`). O mapeamento das fases da
política (§1) aos estados de privacidade do YouTube:

| Fase da política | privacyStatus | Reverter |
|---|---|---|
| 2 — publicação privada / não listada | `private` (canal de teste, audiência zero) | apagar |
| 3 — publicação listada, um vídeo | `unlisted` (menor exposição) | despublicar |
| 4+ — cadência regular | `public` | pausar a cadência |

A alavanca-mestra continua **uma só** (política §2, propriedade 1): o canal
novo não ganha alavanca própria; a escolha do canal é registro (este ADR +
AB-873), e a troca de plataforma entra por registro, nunca por decisão
isolada no ato de publicar.

### D2 — A alavanca-mestra vira flag real, executada pelo GATE P-1 (AB-990, AB-875)

A flag é `ALAVANCA_MESTRA` (em `.env`, default **`off`**), estados válidos
`on|off`. O **GATE P-1** — a primeira porta do fluxo de publicação — a lê: se
`off`, a publicação inteira é bloqueada **antes de qualquer outro passo**, e
a fase 0 é o único estado alcançável (política §2.4: "sem alavanca, não há
publicação"). Edição inválida (valor fora de `on|off`) é **recusada e
logada**, com a configuração anterior continuando a valer (AB-998). O gate do
card (`just runbook-publicacao`) verifica por comando que a flag e o GATE P-1
existem no runbook — a materialização não fica só na prosa (AB-875).

### D3 — O dossiê do F6-01 entra na alavanca pelo G-HUM, antes dos gates P-1..P-5

O runbook chama `just revisar-bloqueia --entrega <id>` (gate G-HUM do F6-01,
AB-852) como passo obrigatório do fluxo: **sem dossiê assinado por papel
nomeado, bloqueia** — o runbook não cria atalho que contorne o F6-01
(política §5). Os gates numerados **P-1..P-5** são do F6-03 (W11,
`docs/gates/**`): este ADR e o runbook os **referenciam pelos nomes**, não os
implementam.

### D4 — Obrigação de plataforma: `containsSyntheticMedia` no payload

Todo upload via este runbook declara `status.containsSyntheticMedia` com o
valor correto para a entrega — `true` quando ela contém conteúdo realista
alterado ou sintético (inclusive voz sintética realista, na extensão em que o
campo cobre mídia), `false` quando não contém. A omissão do campo é **falha
de publicação** (não é opcional). A verificação pós-upload (`videos.list`
devolvendo o campo) faz parte do passo de evidência do runbook.

### D5 — OAuth em "In production" sem verificação, e o audit como pré-requisito das fases 3+

O consent screen do OAuth client é publicado como **"In production"** sem
verificação (permitido no escopo pessoal, <100 usuários — D2 da pesquisa);
tokens emitidos em modo Testing (7 dias) são recusados pelo runbook. O audit
de conformidade ToS (projetos pós-2020-07-28) é **pré-requisito declarado das
fases 3+** (unlisted/public); a fase 2 (private) é alcançável sem audit. O
audit é acionado por registro quando a fase 2 for aprovada; sem SLA oficial, a
espera é declarada, nunca prometida (AB-874).

## Alternativas consideradas / descartadas

### Alternativa A: "Canal único TikTok (ou Vimeo, ou Odysee)"

**Descartada por escopo, não por mérito.** As três perguntas de pesquisa do
card (quota em units, verificação de app Google, campo de conteúdo sintético
no payload) são vocabulário do YouTube/Google Cloud; as fases da política
(privada → listada → cadência) mapeiam 1:1 para `private`/`unlisted`/`public`
do YouTube. Nenhuma outra plataforma foi pesquisada — o custo é assumido e
registrado (AB-873, seção "o que ninguém conferiu" do runbook).

### Alternativa B: "Deixar o canal em aberto no runbook"

**Descartada.** O runbook sem canal não tem passo de publicação real: não
saberia escrever payload, quota, verificação nem disclosure — e a pergunta de
pesquisa do card ficaria sem resposta aplicável. O AB-995 do I-04 delegou a
decisão a este card exatamente para o runbook nascer executável por quem não
participou.

### Alternativa C: "Exigir verificação OAuth do app"

**Descartada.** O escopo pessoal (<100 usuários) está isento (fonte oficial,
2-0); exigir verificaria um processo que a política de plataforma não pede
deste escopo, atrasaria a fase 2 sem ganho de admissão — e não eliminaria a
restrição do audit de projetos (D5), que é independente da verificação OAuth.

## Consequências

### Positivas

1. **O canal deixa de ser linha em aberto (AB-995):** YouTube via Data API
   v3, com fases mapeadas a `privacyStatus` e obrigações de plataforma
   registradas com data (2026-08-13) e placar.
2. **A alavanca-mestra deixa de ser só conceito (AB-990):** flag real
   `ALAVANCA_MESTRA` (default off) lida pelo GATE P-1, com recusa-e-log e
   configuração anterior valendo (AB-998).
3. **A obrigação não opcional tem nome:** `status.containsSyntheticMedia`
   entra como campo obrigatório do payload, não como boa intenção.
4. **O audit e a expiração de tokens deixam de ser descobertas do dia do
   primeiro upload:** o runbook os trata como pré-requisito (fases 3+) e como
   regra de modo (Testing), respectivamente.

### Custos e desvios registrados

1. **O runbook nasce NÃO DISPARADO.** Nenhum passo de publicação foi
   executado; o payload de exemplo é procedimento escrito, não prática
   validada. O primeiro upload real pode revelar detalhe que o anexo de
   reconferência não cobre — o custo é assumido (cabeçalho do runbook).
2. **A data da mudança de quota (2025-12-04) é 1-0** — fonte única
   secundária; a estrutura atual é 2-0 (oficial). A divergência fica visível
   no runbook, nunca apagada.
3. **A disputa do token de 7 dias para apps não verificados em produção é
   1-0 vs 2-0** — não resolvida; o runbook registra a divergência e o passo
   de reconferência (AB-871).

## O que este ADR NÃO cobre

- **Não implementa os gates P-1..P-5 numerados.** Isso é o F6-03 (W11) —
  `docs/gates/**`, `just gates:validar`. Este ADR e o runbook referenciam os
  nomes apenas.
- **Não executa publicação.** Este ADR e o runbook nascem NÃO DISPARADOS;
  nada aqui autoriza o primeiro upload sem dossiê assinado, alavanca `on` e
  gates verdes.
- **Não decide o que é publicável, em nome de quem.** Isso é o ADR-0033/I-04;
  este ADR decide onde, dentro da política.
- **Não altera `src/` nem `schema/`** (S-4), `package.json` (S-1) nem
  `src/design/tokens.ts` (S-5) — card de infra e pesquisa, documentos apenas.
- **Não resolve a disputa do token de 7 dias nem o SLA do audit** — registra
  e nomeia o passo de reconferência (AB-871, AB-874).
- **Não cobre outras plataformas** — canal único YouTube (AB-873).

## Condição de escopo

Todas as decisões D1..D5 são verdadeiras **sob a condição de que o uso do
programa continua sendo pessoal, por uma pessoa física, fora do escopo de
trabalho, sem vínculo a organização com fins lucrativos com mais de 3
empregados** (condição de escopo do ADR-0003; é o que mantém a dispensa de
verificação OAuth do app, D2 da pesquisa). Se a condição deixar de ser
verdadeira, este ADR cai junto com o ADR-0033 e o ADR-0003.

## Gatilho de reabertura (AB-950)

O mesmo do ADR-0033: **"organização com fins lucrativos e mais de 3
empregados"** reabre o ADR-0003 e o ADR-0033; este ADR é reavaliado junto com
a política, e a suficiência jurídica do que já saiu é reavaliada pelo papel
nomeado (Revisor jurídico), com dossiê + relatório de procedência como base,
sem re-renderizar (AB-748). **O que NÃO dispara:** monetização do vídeo no
YouTube, publicação em qualquer plataforma, mudança de provedor de TTS/GIF/
música (ADR-0003).

## Limites do que é verificável aqui

1. **A guarda verifica presença, não execução.** `just runbook-publicacao`
   prova que a flag, o GATE P-1 e o campo `containsSyntheticMedia` estão
   escritos no runbook; nenhum comando prova que um upload real saiu certo —
   isso é a fase 2, e ela só acontece com alavanca `on` e gates verdes.
2. **A data da mudança de quota é 1-0 e a disputa do token é 1-0 vs 2-0.**
   As duas divergências estão registradas com placar; o anexo do runbook tem
   o passo que as reconfere no dia em que alguém precisar.
3. **Nenhuma outra plataforma foi pesquisada.** A escolha do YouTube é escopo
   mínimo orientado pelas perguntas do card, não comparação exaustiva
   (AB-873).
