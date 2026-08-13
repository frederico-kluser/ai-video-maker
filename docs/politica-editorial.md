# Política editorial — o que conta como vídeo publicável, em nome de quem

- **Status:** ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO (2026-08-13). Nenhum vídeo
  deste programa foi publicado. Este documento é desenho revisado, não prática
  validada — e o cabeçalho não é apagado quando o primeiro vídeo sair: o status
  muda, a confissão fica (PROGRAMA.html:2240-2247).
- **Card de origem:** `I-04` (onda W9.5, infra). Depende de: `I-01` (ADR-0003).
- **Consumida por:** `F6-01` (W10, revisão humana e dossiê), `F6-02` (W11, runbook
  de publicação), `F6-03` (W11, gates numerados P-1..P-5), `F6-04` (W11, fechamento
  do ledger), `F6-05` (W12, arquivamento).
- **Decisão canônica:** ADR-0033 (`docs/adr/0033-canal-e-politica-editorial.md`).
  Este arquivo é a política operacional; o ADR é a decisão. Conflito entre os dois
  resolve-se pelo ADR.
- **Guarda executável (∅-crit corrigido do I-04):** `rg --files-without-match
  "alavanca-mestra" docs/politica-editorial.md docs/adr/0033-*.md` → saída vazia.
  (`rg -L` é `--follow`, não `--files-without-match` — docs/criterios-de-aceitacao-
  corrigidos.md §1.)

---

## 0. A pergunta que nenhum agente pode responder

O pipeline prova que o vídeo **é o que foi aprovado** — ele não decide se o vídeo
**presta** (PROGRAMA.html:1897: "nenhuma camada tem opinião sobre isso"). A
pergunta "o que conta como vídeo publicável, em nome de quem" não é respondida por
nenhuma camada técnica: é respondida por esta política, que nomeia os papéis que
decidem e registra o evento que pode reabrir a decisão.

Duas distinções fundadoras:

1. **"Produzir um arquivo" ≠ "publicar".** A saída em arquivo é a fase 0 — o piso
   seguro. A irreversibilidade não está no código, está na publicação: um vídeo
   publicado com asset de licença errada, com voz clonada sem consentimento ou
   com áudio fora de norma **não se despublica sem custo** (PROGRAMA.html:2250-2253).
2. **A decisão de uso (ADR-0003) não é a decisão de publicação.** O enquadramento
   "uso pessoal" fecha a pergunta de licença; a publicação continua exigindo
   revisão humana (`F6-01`), política (este documento) e gates numerados (`F6-03`).

## 1. As fases 0..6 — e quem decide a passagem

As fases são as do PROGRAMA.html:2258-2271. Toda etapa reversível vem antes da
primeira irreversível, e a fronteira é declarada.

| # | Fase | Mecanismo | Reverter |
|---|---|---|---|
| 0 | **Saída em arquivo, nada publicado** | o piso seguro | — é o estado base |
| 1 | **Revisão humana obrigatória** | a entrega inclui o relatório de procedência e o checklist; nenhuma publicação sem aprovação nominal | não se publica |
| 2 | **Publicação privada / não listada** | canal de teste, audiência zero | apagar |
| 3 | **Publicação listada, um vídeo** | um item, escolhido por menor exposição | despublicar (não apaga o que já foi visto) |
| 4 | **Cadência regular** | N por semana, com portões datados | pausar a cadência |
| 5 | **Soak** — um ciclo de negócio real | — | ainda reversível |
| 6 | **Automação de ponta a ponta sem revisão humana** | ★ **a primeira etapa irreversível** | **deixa de ser edição** |

Regras de passagem:

- **Quem decide a passagem de fase é a política; quem revisa é o F6-01; quem
  publica é o F6-02 + F6-03.** A política define o que é publicável (§4); o dossiê
  do F6-01 é a prova de que o vídeo passou na revisão humana (fase 1); o runbook
  do F6-02 e os gates P-1..P-5 do F6-03 são a execução.
- **Da fase 1 em diante, nada sobe sem aprovação nominal** — o checklist do F6-01
  é assinável por **papel nomeado**, nunca por "o time".
- **A fase 6 não é alcançada por decisão isolada.** A janela entre 5 e 6 é
  declarada explicitamente e **não é redonda**: é um ciclo de negócio completo,
  justificado — menos que isso não cobre o caso raro; mais que isso mantém dois
  processos vivos sem aprender nada novo (PROGRAMA.html:2273-2277, ledger AB-994).

## 2. A alavanca-mestra — o conceito central

**Uma alavanca por fase, e uma alavanca-mestra** (PROGRAMA.html:2279-2282). A
**alavanca-mestra** é a flag que desliga a **publicação inteira**, citada em
**todos** os runbooks subordinados.

Propriedades da alavanca-mestra:

1. **É uma só.** Não há uma alavanca por canal, por fase ou por card — há uma flag
   única que desliga tudo. Se existir mais de uma, "desligar a publicação" deixa
   de ser uma operação e volta a ser uma conversa.
2. **Reversão é edição de configuração, sem redeploy** — desligar, reverter,
   pausar e restaurar são atos de configuração, e edição inválida é **recusada e
   logada**, com a configuração anterior continuando a valer
   (PROGRAMA.html:2280-2282).
3. **Todo runbook subordinado a cita.** O ∅-crit do F6-02 (W11) herda o sweep
   corrigido: cada `docs/runbooks/*.md` cita a **alavanca-mestra** na seção
   inicial (criterios-de-aceitacao-corrigidos.md §1, itens 2 e 3). A citação não é
   decoração: é o que permite que quem executa o runbook saiba, na primeira seção,
   que existe uma flag que desliga o que ele está prestes a fazer.
4. **Hoje ela é conceito com guarda de presença; na W11 ela é flag real.** Até o
   runbook do F6-02 nascer, a guarda executável garante que a política e o
   ADR-0033 citam a **alavanca-mestra**; o F6-02 a materializa como flag real de
   configuração no runbook (ledger AB-990). Enquanto ela não existe como flag,
   **a fase 0 é o único estado alcançável** — sem alavanca, não há publicação.

## 3. Papéis nomeados — quem decide ≠ quem reverte ≠ quem publica

Um vídeo publicável tem quatro atos distintos, e cada ato tem um papel nomeado:

| Papel | Ato | Registro | Executado por |
|---|---|---|---|
| **Revisor editorial** | decide o que é **válido** — aprova ou rejeita o vídeo como conteúdo | assina o dossiê (F6-01) e o veredito dos gates P-1..P-5 (F6-03) | `F6-01` (W10) gera o dossiê; o dono do programa assina como papel, nunca como "o time" |
| **Operador de reversão** | **reverte tráfego** — despublica, restaura a configuração anterior, pausa a cadência | ato de configuração no registro da alavanca (edição válida, recusada ou logada) | quem executa o runbook do F6-02 (W11) |
| **Operador de publicação** | **publica** — executa o runbook e aciona os gates P-1..P-5 | veredito `CONFERE` com evidência anexada (F6-03) | `F6-02` + `F6-03` (W11) |
| **Revisor jurídico** | reavalia a **suficiência jurídica** quando o gatilho `AB-950` dispara | registro de reavaliação com o dossiê do F6-01 e o relatório de procedência (F5-06) | o dono, com o dossiê como base (AB-748) |

Regras de separação:

1. **Quem reverte não decide o que é válido.** Reverter tráfego é um ato de
   configuração; corrigir conteúdo é um ato editorial. Se o mesmo humano opera os
   dois papéis (programa pessoal), os **atos são separados e registrados por
   papel** — o registro da reversão nunca é assinado como dossiê, e o dossiê nunca
   é assinado como reversão.
2. **Quem publica não autoaprova.** O veredito `CONFERE` do F6-03 exige evidência
   anexada, e o dossiê do F6-01 é assinado por papel distinto do operador de
   publicação.
3. **Reverter ≠ corrigir conteúdo** (AB-748). Despublicar um vídeo e apagar os
   assets são dois atos, com raios de alcance diferentes — tabela
   *ato × o que quebra × reversível* (PROGRAMA.html:2316-2321). Corrigir conteúdo
   exige novo dossiê; reverter não altera o que foi aprovado.
4. **A separação é documental, não física** — num programa pessoal não há como
   exigir pessoas físicas distintas. O que a política exige é que o **registro**
   distinga os papéis: o mesmo humano pode operar vários papéis, mas nenhum ato é
   registrado em dois papéis ao mesmo tempo (ledger AB-991).

## 4. O que conta como vídeo publicável

Um vídeo é publicável **somente se todas** as condições abaixo valem:

1. **Passou na fase 1**: dossiê do F6-01 assinado por papel nomeado (gate `G-HUM`:
   nenhuma publicação sem dossiê assinado — PROGRAMA.html:2994).
2. **Procedência declarada**: relatório transitivo do F5-06 sem origem ausente —
   o que está embutido no vídeo tem licença, termos, data e origem declarados.
3. **`AB-950` declarado** — "AB-950 continua fechado" ou "AB-950 disparou", nunca
   omitido (ADR-0003).
4. **Gates P-1..P-5 com veredito `CONFERE` e evidência anexada** (F6-03). Um
   veredito sem evidência falha.
5. **Áudio dentro de norma** — o entregável do F5-03 (loudness, teto) é o
   documento da norma.
6. **Disclosure de voz sintética quando aplicável** — obrigação do provedor,
   independente do enquadramento (ADR-0003 D4).
7. **Em nome da pessoa física, sob uso pessoal** — esta é a resposta de "em nome
   de quem": o programa publica em nome de uma pessoa física operando fora do
   escopo de trabalho. Publicar em nome de organização com fins lucrativos e mais
   de 3 empregados **dispara o gatilho `AB-950`** e invalida esta política (§8).

## 5. O que NÃO é publicável

- **A entrega em arquivo (fase 0) não é publicação** — e não autoriza ninguém a
  tratar o arquivo como publicado.
- **Vídeo com asset de licença errada, voz clonada sem consentimento ou áudio
  fora de norma** (PROGRAMA.html:2252-2253) — o custo de despublicar é real e o
  gate de publicação não pode existir para depois.
- **Nenhum caminho que contorne o F6-01 existe.** A pergunta 3 do F6-01 é
  "existe caminho que publica sem passar por aqui?" — a resposta desta política é
  **não**: sem dossiê assinado, não há publicação, e o runbook do F6-02 não pode
  criar um atalho.
- **Publicar em nome de quem não é o dono do programa.** A publicação é um ato da
  pessoa física; nenhum agente, ferramenta ou runbook "publica por conta própria".

## 6. Reverter ≠ corrigir conteúdo — atos separados

Dois atos que parecem um só e não são (PROGRAMA.html:2316-2321):

| Ato | O que quebra | Reversível? | Quem executa |
|---|---|---|---|
| Despublicar o vídeo | a visibilidade do vídeo (o que já foi visto não se apaga) | sim, republicável | Operador de reversão |
| Apagar os assets | a procedência de tudo já publicado (o store mora nela) | **não** — nunca apague: renomeie com prefixo de depreciação e espere um ciclo completo | ninguém, sem novo dossiê |
| Pausar a cadência | o ritmo de publicação | sim | Operador de reversão |
| Corrigir conteúdo | o que foi aprovado | exige **novo dossiê** | Revisor editorial |

Regra de ouro: **desativar é reversível, apagar não é** (PROGRAMA.html:2323-2324).
O store de assets, o registro de licenças, os snapshots aprovados e o ledger são
o que **não pode ser desligado** (PROGRAMA.html:2306-2310) — sem eles nenhuma
regressão futura é detectável e a reavaliação sob `AB-950` fica cega.

## 7. O caso em que ninguém pensou

A pergunta adversarial 2 do I-04: *a política diz o que fazer no caso em que
ninguém pensou?* — Sim, e a regra tem três partes:

1. **O que não está escrito não está decidido.** Um caso não previsto não é
   resolvido por improviso nem por omissão: é **enquadrado por registro** — item
   novo no ledger (faixa do card que o encontrou), decisão provisória com
   verificação executável, e o ADR-0033 **reaberto** se a decisão contrariar o
   texto desta política. Decisão por registro, nunca por "ninguém reclamou".
2. **Reversão nunca é bloqueada por caso não previsto.** Se o caso não previsto
   envolve risco de irreversibilidade, a **alavanca-mestra é puxada primeiro** e o
   enquadramento vem depois. Reverter é sempre permitido e nunca precisa de
   aprovação editorial.
3. **Publicação nova é bloqueada até o enquadramento.** Enquanto o caso não
   previsto não estiver registrado (item de ledger + decisão provisória), nenhum
   vídeo novo sobe da fase 0. O bloqueio é por **ausência de registro**, não por
   ausência de reclamação — ausência de reclamação não é sinal (PROGRAMA.html:
   2284-2293, a armadilha do denominador).

## 8. O gatilho de reabertura AB-950 — condição de escopo e evento

Esta política é verdadeira **sob a condição de escopo** do ADR-0003: o uso do
programa continua pessoal, por uma pessoa física, fora do escopo de trabalho, sem
vínculo a organização com fins lucrativos com mais de 3 empregados.

**Evento que reabre (AB-950):** "organização com fins lucrativos e mais de 3
empregados". Quando o evento dispara:

1. **O ADR-0003 é reaberto** (as quatro decisões D1..D4 voltam a PROPOSTO).
2. **Esta política é reavaliada por inteiro** antes de qualquer publicação nova.
3. **Quem reavalia a suficiência jurídica é o Revisor jurídico** (papel nomeado
   na §3) — o dono, com o dossiê do F6-01 e o relatório de procedência do F5-06
   como base técnica (AB-748). O relatório é regenerado a partir dos mesmos
   commitados — **sem re-renderizar** — e a decisão de manter ou despublicar o que
   já saiu é registro com evidência, nunca reversão automática.
4. **Reverter ≠ corrigir conteúdo:** o gatilho não despublica nada sozinho. Ele
   dispara **reavaliação**; a despublicação é uma decisão registrada do Revisor
   jurídico, executada pelo Operador de reversão.

**Como o evento é detectado:** não há sinal técnico da mudança de escopo
(ADR-0003, R01-05: não existe diferença de funcionalidade entre free e pago). A
detecção é por **declaração**: todo gate de publicação, relatório de procedência
e handoff de card de composição declara "AB-950 continua fechado" ou "AB-950
disparou" — a omissão é falha de gate. O item nunca é fechado; ele é verificável
por estar sempre presente, nunca por estar ausente
(`python3 tools/validate-ledger.py --id AB-950 --exigir-gatilho` — o item existe e
declara o evento que o reabre).

**O que NÃO dispara o gatilho** (ADR-0003): abertura de CNPJ sem empregados (ou
com até 3), monetização do vídeo no YouTube, publicação em qualquer plataforma,
mudança de provedor de TTS/GIF/música.

## 9. O que não pode ser desligado

O checklist do "não pode" vem primeiro em esforço, com origem citada para cada
item (PROGRAMA.html:2295-2324):

- **O store de assets** — a procedência de tudo já publicado mora nele.
- **O registro de licenças.**
- **Os snapshots aprovados** — sem eles nenhuma regressão futura é detectável.
- **O ledger** — o mecanismo de reabertura (`AB-950`) e de enquadramento (§7).

Estes podem ser desligados **depois do soak, item a item, com o ato separado do
efeito** (PROGRAMA.html:2301-2303) — o soak provou o que é dispensável; o resto
fica.

## 10. Runbooks subordinados — para quem não estava lá

Todo runbook de publicação (`docs/runbooks/*.md`, nascidos na W11 com o F6-02)
carrega obrigatoriamente (PROGRAMA.html:2331-2342):

1. **A citação da alavanca-mestra na seção inicial** — o ∅-crit do F6-02
   (`rg --files-without-match "alavanca-mestra" docs/runbooks/*.md` com guarda de
   denominador) exige a citação em **todo** runbook subordinado.
2. O anexo **"como reconferir tudo isto você mesmo"**, com os comandos prontos.
3. **Correções de citação antecipadas**, para o leitor não concluir errado.
4. **Perguntas segregadas por interlocutor** — o risco concreto é queimar a
   sessão de um interlocutor caro com pergunta que era de outro.
5. A seção final **"o que ninguém conferiu"** — para a lista não precisar ser
   reconstruída por arqueologia.
6. O cabeçalho que declara **o que não foi executado**.
7. O **escopo negativo** como parte do entregável: termine com "o que este
   documento NÃO cobre" (∅-crit do F6-02).

**Guarda de denominador (armadilha 9.2):** `--files-without-match` sai vazio tanto
quando todo arquivo casa quanto quando não existe arquivo nenhum. O sweep de
subordinação só é vivo quando `docs/runbooks/*.md` existe — denominador zero
**nunca** aprova por ausência (criterios-de-aceitacao-corrigidos.md §1, item 2).
Hoje (W9.5) o diretório ainda não existe: o sweep fica inativo e nomeia o motivo;
o F6-02 (W11) herda o comando com a guarda e o denominador zero passa a ser
VERMELHO.

## 11. O que esta política garante por comando

| Garantia | Comando | Vermelho quando |
|---|---|---|
| A política e o ADR citam a **alavanca-mestra** | `rg --files-without-match "alavanca-mestra" docs/politica-editorial.md docs/adr/0033-*.md` | algum dos dois não cita (saída não vazia) |
| O gatilho `AB-950` existe e declara o evento que reabre | `python3 tools/validate-ledger.py --id AB-950 --exigir-gatilho` | item ausente ou sem `gatilho` |
| O ledger inteiro valida (schema, ids únicos, evidências) | `python3 tools/validate-ledger.py` | qualquer item fora do schema |
| Todo runbook subordinado cita a **alavanca-mestra** (vivo a partir da W11) | `test $(ls docs/runbooks/*.md 2>/dev/null \| wc -l) -gt 0` + sweep | runbook sem a citação; denominador zero é bloqueio na W11 |

Limites honestos: a guarda verifica a **presença da citação**, não a
materialização da flag (AB-990); a separação de papéis é **documental**, não
física (AB-991); o caso não previsto não tem detector — a regra é de **registro**
(AB-993).
