# ADR-0033: Canal e política editorial — o que conta como vídeo publicável, em nome de quem

- **Status:** ACEITO (sign-off de fredericokluser, 2026-08-13). O documento que
  esta decisão autoriza (`docs/politica-editorial.md`) nasce **ENCERRADO COMO
  CONSTRUÍDO E NÃO DISPARADO**: nenhum vídeo foi publicado.
- **Data:** 2026-08-13
- **Card:** `I-04` (onda W9.5, infra). Depende de: `I-01` (ADR-0003). Consumida
  por: `F6-01` (W10, dossiê de revisão), `F6-02` (W11, runbook de publicação),
  `F6-03` (W11, gates P-1..P-5), `F6-04` (W11, fechamento do ledger), `F6-05`
  (W12, arquivamento).
- **Supera, no que diverge:** nenhum documento anterior (disciplina nova — canal
  e política editorial não tinham dono antes deste ADR).
- **Reafirma explicitamente:** ADR-0001 §Guarda executável, ADR-0002 §Restrições
  (fronteira negativa), ADR-0003 §Condição de escopo e §Gatilho de reabertura
  (AB-950), ADR-0039 §Escopo do relatório (o relatório é a base da reavaliação,
  não o detector).
- **Guarda executável (forma corrigida do ∅-crit):** `rg --files-without-match
  "alavanca-mestra" docs/adr/0033-*.md` — se este ADR não contiver
  "alavanca-mestra", a saída lista o arquivo e o gate falha; se contiver, a
  saída é vazia e o gate passa. **Atenção:** `rg -L` é `--follow`, NÃO é
  `--files-without-match` — a forma com `-L` passa exatamente quando a
  propriedade que deveria garantir está ausente (docs/criterios-de-aceitacao-
  corrigidos.md §1).
- **Itens de ledger ligados:** `AB-950` (gatilho de reabertura, materializado
  por este card — ver Contexto), `AB-748` (suficiência jurídica da reavaliação),
  `AB-990`..`AB-999` (faixa deste card, ledger/inbox/I-04.json).

## Contexto

O PROGRAMA.html §Publicação (linhas 2240-2342) define o análogo do *strangler*
deste programa: passar de "o pipeline produz um arquivo" para "o pipeline
**publica em nome de alguém**". A irreversibilidade não está no código, está na
publicação — um vídeo publicado com asset de licença errada, com voz clonada sem
consentimento ou com áudio fora de norma **não se despublica sem custo**.

O desenho do PROGRAMA estabelece:

- **Sete fases (0..6)**, da saída em arquivo (piso seguro) à automação sem
  revisão humana (a primeira etapa irreversível), com uma **alavanca por fase e
  uma alavanca-mestra** — a flag que desliga a publicação inteira, citada em
  **todos** os runbooks subordinados.
- **A armadilha do denominador** (9.2): "zero vídeos rejeitados na revisão" é
  verdade quando o gerador está perfeito **e** quando ninguém está revisando —
  zero não é sinal sozinho, precisa de denominador.
- **O que não pode ser desligado**: o store de assets, o registro de licenças,
  os snapshots aprovados e o ledger.

O enquadramento de uso (ADR-0003, I-01) fechou as perguntas P-01..P-04 sob uso
pessoal, mas a decisão é sobre **uso**, não sobre **publicação** — a pergunta
adversarial 2 do I-01 nomeia isso: "algum card assume 'pode publicar' a partir
daqui? A decisão é sobre uso, não sobre publicação — `F6-01` e `I-04` continuam
existindo". Este ADR responde à pergunta que nenhum agente pode responder: **o
que conta como vídeo publicável, em nome de quem**.

**Materialização do AB-950:** o ADR-0003 e o PROGRAMA (I-01) pre-alocaram o item
`AB-950` ("organização com fins lucrativos e mais de 3 empregados") como o
mecanismo de reabertura do enquadramento de uso, e o ∅-crit do I-01 exige
`python3 tools/validate-ledger.py --id AB-950 --exigir-gatilho`. O item **nunca
foi materializado** no ledger (verificado neste card: nenhum `ledger/inbox/*.json`
contém `"id": "AB-950"`, e o comando falha com "Item AB-950 nao encontrado no
inbox"). Como este ADR depende da verificabilidade do gatilho (pergunta
adversarial 4), o I-04 materializa o item no seu inbox — id pre-alocado pelo
I-01, nunca reciclado, escrito agora porque a política editorial não pode
referenciar um gatilho que não existe para o validador.

## Decisão

### D1 — O que conta como vídeo publicável

Um vídeo é publicável **somente se** todas as condições valem (detalhe
operacional em `docs/politica-editorial.md` §4):

1. dossiê do F6-01 assinado por **papel nomeado** (gate `G-HUM` — nenhuma
   publicação sem dossiê assinado);
2. procedência transitiva do F5-06 sem origem ausente;
3. `AB-950` declarado ("continua fechado" ou "disparou") — nunca omitido;
4. gates P-1..P-5 do F6-03 com veredito `CONFERE` **e evidência anexada**;
5. áudio dentro de norma (entregável do F5-03);
6. disclosure de voz sintética quando aplicável (ADR-0003 D4);
7. em nome da pessoa física, sob uso pessoal.

**A entrega em arquivo (fase 0) não é publicação** e não autoriza ninguém a
tratar o arquivo como publicado. **Nenhum caminho que contorne o F6-01 existe** —
a resposta à pergunta 3 do F6-01 é não, e o runbook do F6-02 não pode criar um
atalho.

### D2 — Em nome de quem

O programa publica **em nome de uma pessoa física**, operando fora do escopo de
trabalho, sob uso pessoal (ADR-0003). Publicar em nome de organização com fins
lucrativos e mais de 3 empregados **dispara o gatilho `AB-950`** e invalida esta
decisão (ver Gatilho de reabertura). Nenhum agente, ferramenta ou runbook
"publica por conta própria": publicar é um ato da pessoa física, registrado por
papel nomeado.

### D3 — Papéis nomeados: quem decide ≠ quem reverte ≠ quem publica

Quatro papéis, quatro atos, quatro registros:

| Papel | Ato | Registro | Executado por |
|---|---|---|---|
| **Revisor editorial** | decide o que é **válido** | dossiê (F6-01) + veredito dos gates (F6-03), assinados por papel nomeado, nunca por "o time" | F6-01 (W10) + dono |
| **Operador de reversão** | **reverte tráfego** | edição de configuração na alavanca (válida, recusada ou logada) | F6-02 (W11) |
| **Operador de publicação** | **publica** | veredito `CONFERE` com evidência anexada | F6-02 + F6-03 (W11) |
| **Revisor jurídico** | reavalia a **suficiência jurídica** sob `AB-950` | registro de reavaliação com dossiê + relatório de procedência | dono, com base técnica do F5-06/F6-01 (AB-748) |

Regras: (a) **quem reverte não decide o que é válido** — reverter tráfego e
corrigir conteúdo são papéis diferentes; (b) **quem publica não autoaprova**;
(c) **reverter ≠ corrigir conteúdo** — despublicar é ato de configuração,
corrigir exige novo dossiê; (d) a separação é **documental, não física** — num
programa pessoal o mesmo humano opera vários papéis, mas nenhum ato é registrado
em dois papéis ao mesmo tempo (ledger AB-991).

### D4 — A alavanca-mestra é o conceito central de subordinação

**Uma alavanca por fase, e uma alavanca-mestra** (PROGRAMA.html:2279-2282). A
**alavanca-mestra** é a flag que desliga a **publicação inteira**, citada em
**todos** os runbooks subordinados. Reversão é sempre **edição de configuração,
sem redeploy**; edição inválida é **recusada e logada**, e a configuração
anterior continua valendo.

- O ∅-crit do I-04 (W9.5), na forma corrigida, assere **presença** da citação em
  `docs/politica-editorial.md` e em `docs/adr/0033-*.md`.
- O ∅-crit do F6-02 (W11) exige que **cada runbook** `docs/runbooks/*.md` cite a
  **alavanca-mestra** — o sweep corrigido com guarda de denominador
  (criterios-de-aceitacao-corrigidos.md §1, itens 2 e 3).
- A materialização da flag real é do F6-02 (W11) (ledger AB-990); até lá, a fase
  0 é o único estado alcançável — **sem alavanca, não há publicação**.

### D5 — AB-950: o gatilho de reabertura e a reavaliação

Todas as decisões D1..D6 são verdadeiras **sob a condição de escopo** do
ADR-0003 (uso pessoal). O evento que reabre — "organização com fins lucrativos e
mais de 3 empregados" — dispara, em conjunto:

1. a reabertura do ADR-0003 (D1..D4 voltam a PROPOSTO);
2. a **reavaliação por inteiro** desta política antes de qualquer publicação
   nova;
3. a reavaliação da **suficiência jurídica** do que já foi publicado, pelo
   **Revisor jurídico** (papel nomeado, D3), com o dossiê do F6-01 e o relatório
   de procedência do F5-06 como base — relatório regenerado a partir dos mesmos
   commitados, **sem re-renderizar** (AB-748).

**Reverter ≠ corrigir conteúdo:** o gatilho não despublica nada automaticamente.
Ele dispara **reavaliação**; a despublicação é decisão registrada do Revisor
jurídico, executada pelo Operador de reversão.

**Verificabilidade:** não há sinal técnico da mudança de escopo (ADR-0003,
R01-05); a detecção é por **declaração** — todo gate de publicação, relatório de
procedência e handoff declara "AB-950 continua fechado" ou "AB-950 disparou", e a
omissão é falha de gate. O item nunca é fechado; ele é verificável por estar
sempre presente, nunca por estar ausente (`python3 tools/validate-ledger.py --id
AB-950 --exigir-gatilho`).

### D6 — O caso em que ninguém pensou

1. **O que não está escrito não está decidido.** Caso não previsto é enquadrado
   por **registro** — item novo no ledger com decisão provisória e verificação
   executável, e este ADR **reaberto** se a decisão contrariar o texto. Decisão
   por registro, nunca por "ninguém reclamou".
2. **Reversão nunca é bloqueada por caso não previsto** — a **alavanca-mestra é
   puxada primeiro**, o enquadramento vem depois.
3. **Publicação nova é bloqueada até o enquadramento** — bloqueio por **ausência
   de registro**, nunca por ausência de reclamação (armadilha do denominador,
   PROGRAMA.html:2284-2293).

## Alternativas consideradas / descartadas

### Alternativa A: "Publicação é só rodar o pipeline"

**Descartada.** O pipeline prova que ninguém mudou o que foi aprovado, e nada
além (PROGRAMA.html:1897). Nenhuma camada técnica tem opinião sobre se o vídeo
presta; a aprovação nominal (F6-01) é a única que tem. Publicar sem dossiê é
exatamente o falso-verde que a fase 1 existe para bloquear.

### Alternativa B: "Um papel único que decide, reverte e publica"

**Descartada.** Reverter tráfego e corrigir conteúdo são papéis diferentes por
natureza: a reversão precisa ser possível **sem julgamento editorial** (para não
depender de quem decidiu), e a correção precisa de **novo dossiê** (para não ser
um reverter disfarçado). Um papel único transforma "despublicar" em "discutir o
conteúdo", que é o ato mais caro no momento de maior pressa.

### Alternativa C: "Deixar a política em aberto até a W11"

**Descartada.** O F6-02 (runbook) e o F6-03 (gates) precisam da política como
contrato a montante: o runbook é **execução**, não decisão. Sem a política, o
runbook nasceria decidindo o que deveria estar decidido aqui — e a pergunta "o
que é publicável" voltaria para o agente que não pode respondê-la.

## Consequências

### Positivas

1. **A pergunta que nenhum agente pode responder ganha dono.** O que é
   publicável, em nome de quem, com papéis nomeados e evento de reabertura.
2. **O gatilho AB-950 fica verificável.** O item que o I-01 pre-alocou e nunca
   materializou passa a existir com `gatilho` — o ∅-crit do I-01
   (`--id AB-950 --exigir-gatilho`) passa a rodar verde, e o F6-04 (W11) pode
   fazer `--permitir-aberto AB-950` com justificativa exigida.
3. **O ∅-crit corrigido vira receita.** `just politica-editorial` assere
   presença da **alavanca-mestra** (nunca `rg -L`) e carrega o sweep de
   subordinação com guarda de denominador para o F6-02 herdar na W11.
4. **Fronteiras de custo declaradas.** Reversão (configuração), correção
   (conteúdo) e reavaliação (jurídica) são atos separados com registros
   separados — o "despublicar" deixa de ser confundido com "consertar".

### Custos e desvios registrados

1. **A política nasce NÃO DISPARADO.** Nenhuma linha dela foi validada por um
   vídeo publicado de verdade. O custo é assumido: o primeiro vídeo que passar
   pela fase 1 atualiza o status sem apagar a confissão.
2. **A separação de papéis é documental num programa pessoal.** Não há como
   exigir pessoas físicas distintas; o que existe é registro por papel e a regra
   de que nenhum ato é registrado em dois papéis ao mesmo tempo (AB-991).
3. **O AB-950 foi escrito pelo I-04, fora da faixa 990..999.** Id pre-alocado
   pelo I-01 (faixa 950..969) que nunca foi materializado; escrito neste card
   porque a política depende da verificabilidade do gatilho. Na consolidação, o
   orquestrador pode movê-lo para um inbox do I-01 — o id não muda, ids nunca
   são reciclados.

## Revisão adversarial

**Pergunta 1 (do card):** Quem reverte é a mesma pessoa que decide o que é
válido? Não deveria — reverter tráfego e corrigir conteúdo são papéis diferentes.

**Resposta:** Não é — D3 nomeia quatro papéis: o Revisor editorial decide o que
é válido (dossiê + veredito), o Operador de reversão reverte tráfego (edição de
configuração, sem julgamento de conteúdo). Quando o mesmo humano operaria os
dois (programa pessoal), os atos são separados e registrados por papel: o
registro da reversão nunca é assinado como dossiê, e o dossiê nunca é assinado
como reversão (AB-991).

**Pergunta 2 (do card):** A política diz o que fazer no caso em que ninguém
pensou?

**Resposta:** Sim — D6 em três partes: enquadramento por registro (nunca
improviso), reversão nunca bloqueada (a **alavanca-mestra** se puxa primeiro) e
publicação nova bloqueada até o registro existir. O bloqueio é por ausência de
registro, nunca por ausência de reclamação (armadilha do denominador).

**Pergunta 3 (do card):** A alavanca-mestra existe como conceito e todo runbook
subordinado a cita?

**Resposta:** Sim — D4. O conceito vem do PROGRAMA.html:2279-2282; o ∅-crit do
I-04 (corrigido) assere presença da citação na política e neste ADR; o ∅-crit do
F6-02 (W11) exige a citação em **todo** runbook, com o sweep corrigido e a guarda
de denominador (criterios-de-aceitacao-corrigidos.md §1). A materialização da
flag real é do F6-02 (AB-990) — até lá, fase 0 é o único estado.

**Pergunta 4 (do card):** O gatilho de reabertura AB-950 é verificável (condição
de escopo + evento que reabre)?

**Resposta:** Sim — D5 + materialização do item. O item `AB-950` existe no
ledger, declara o evento ("organização com fins lucrativos e mais de 3
empregados"), a condição de escopo (uso pessoal) e o que **não** dispara o
gatilho; `python3 tools/validate-ledger.py --id AB-950 --exigir-gatilho` sai 0.
O padrão é o do I-01: a decisão registra o evento que a reabre — nunca "decisão
eterna".

## O que este ADR NÃO decide / explicitamente fora de escopo

- **Não decide o checklist do dossiê nem a assinatura nominal.** Isso é `F6-01`
  (W10) — `docs/revisao/**`, `just revisar`.
- **Não decide o runbook nem o canal/plataforma concreto.** Isso é `F6-02`
  (W11) — que também materializa a **alavanca-mestra** como flag real de
  configuração (AB-990).
- **Não decide os gates P-1..P-5 numerados.** Isso é `F6-03` (W11).
- **Não executa publicação.** Este ADR e a política nascem NÃO DISPARADOS;
  nenhum vídeo foi publicado, e nada aqui autoriza o primeiro a sair sem dossiê.
- **Não reabre o ADR-0003 nem decide licença por licença.** Isso é o gatilho
  `AB-950` + F6-01/F5-06 (AB-748).
- **Não decide a janela entre as fases 5 e 6** (o ciclo de negócio completo,
  PROGRAMA.html:2273-2277). O dono a declara, datada e justificada, quando a
  fase 5 terminar (AB-994).
- **Não altera `src/` nem `schema/`** (S-4), `package.json` (S-1) nem
  `src/design/tokens.ts` (S-5) — card de infra, documentos apenas.

## Condição de escopo

Todas as decisões D1..D6 são verdadeiras **sob a condição de que o uso do
programa continua sendo pessoal, por uma pessoa física, fora do escopo de
trabalho, sem vínculo a organização com fins lucrativos com mais de 3
empregados** (condição de escopo do ADR-0003).

Se esta condição deixar de ser verdadeira, as decisões de publicação deste ADR
caem junto com as do ADR-0003: o ADR-0033 é reaberto, a reavaliação da
suficiência jurídica é obrigatória antes de qualquer publicação nova, e o que já
foi publicado é reavaliado pelo Revisor jurídico (reverter ≠ corrigir conteúdo —
D5). O item `AB-950` é o mecanismo de reabertura.

## Gatilho de reabertura (AB-950)

**Evento:** "organização com fins lucrativos e mais de 3 empregados".

**O que o evento dispara:** reabertura do ADR-0003 **e** deste ADR; reavaliação
por inteiro desta política antes de qualquer publicação nova; reavaliação da
suficiência jurídica do que já foi publicado pelo papel nomeado (Revisor
jurídico), com dossiê + relatório de procedência como base, sem re-renderizar.

**Como o evento é detectado:** por declaração do dono (não há sinal técnico,
R01-05). Todo gate de publicação, relatório de procedência e handoff declara
"AB-950 continua fechado" ou "AB-950 disparou" — a omissão é falha de gate. O
item nunca é fechado; ele é verificável por estar sempre presente
(`python3 tools/validate-ledger.py --id AB-950 --exigir-gatilho`).

**O que NÃO dispara o gatilho:** abertura de CNPJ sem empregados (ou com até 3);
monetização do vídeo no YouTube (R01-06); publicação em qualquer plataforma;
mudança de provedor de TTS, GIF ou música (ADR-0003).

## Limites do que é verificável aqui

1. **A guarda verifica a presença da citação, não a materialização da flag.**
   `rg --files-without-match "alavanca-mestra"` prova que a política e este ADR
   citam o conceito; a flag real de configuração só existe quando o F6-02 a
   materializar (AB-990).
2. **A separação de papéis é documental, não física.** Nenhum validador distingue
   a pessoa que decide da que reverte; o que existe é registro por papel e a
   regra de atos separados (AB-991).
3. **O caso não previsto não tem detector.** A regra é de registro: publicação
   nova exige enquadramento registrado, e a omissão é falha de gate — o mesmo
   padrão do AB-950 (verificável por declaração, nunca por detecção).
4. **O denominador do sweep é zero até a W11.** O sweep de subordinação sobre
   `docs/runbooks/*.md` só fica vivo quando os runbooks existirem; até lá ele
   não aprova nada (guarda de denominador, criterios-de-aceitacao-corrigidos.md
   §1 item 2).

## Adendo do sign-off (2026-08-13)

### O que o aceite autoriza

- Publicar `docs/politica-editorial.md` e este ADR como o contrato do canal de
  publicação, com status NÃO DISPARADO.
- Bloquear qualquer publicação nova até o dossiê do F6-01 existir (fase 1
  obrigatória) — inclusive, e principalmente, a que este documento não previu
  (D6).
- Exigir a citação da **alavanca-mestra** em todo runbook subordinado, com o
  ∅-crit corrigido e a guarda de denominador.
- Materializar o item `AB-950` no ledger (id pre-alocado do I-01, nunca
  materializado) com o campo `gatilho` — tornando verificável o ∅-crit do I-01.
- Nomear os papéis (Revisor editorial, Operador de reversão, Operador de
  publicação, Revisor jurídico) e a regra de que reverter ≠ corrigir conteúdo.

### O que o sign-off NÃO autoriza

- **Publicar qualquer vídeo sem dossiê assinado por papel nomeado.** Nenhum
  atalho no runbook do F6-02 pode contornar o F6-01.
- **Tratar "uso pessoal" como autorização de publicação.** A decisão do
  ADR-0003 é sobre uso; a publicação tem política própria, e esta.
- **Desligar a publicação "um pouco".** A **alavanca-mestra** é uma só; desligar
  por canal, por fase ou por vídeo sem passar por ela é violação desta decisão.
- **Reverter e corrigir no mesmo ato.** Despublicar (configuração) e corrigir
  conteúdo (novo dossiê) são atos separados com registros separados.
- **Ignorar o gatilho `AB-950`.** Organização com fins lucrativos e mais de 3
  empregados reabre este ADR e o ADR-0003; operar sob o novo enquadramento sem
  reavaliação registrada é violação desta decisão.
- **Decidir o caso não previsto por omissão.** "Ninguém pensou nisso" não é
  decisão; é bloqueio de publicação nova até o enquadramento registrado.
- **Estender esta política a outro repositório ou programa.** O canal é deste
  programa, em nome da pessoa física dona deste programa.
