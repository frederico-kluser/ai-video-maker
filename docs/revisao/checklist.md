# Checklist de revisão humana — assinável por papel nomeado (card F6-01, W10)

- **Card de origem:** `F6-01` (W10, 🔴 crítico, tdd). Depende de: `F5-07` (a
  entrega ponta a ponta), `F5-06` (o relatório de procedência).
- **Política consumida:** `docs/politica-editorial.md` (I-04, W9.5) — os papéis
  nomeados da §3, as fases da §1, a **alavanca-mestra** da §2, o enquadramento da
  §8 (`AB-950`) e o caso não previsto da §7 (`AB-993`).
- **Decisão canônica:** ADR-0033 e ADR-0045 (`docs/adr/0045-*.md`).
- **Fase de revisão:** a fase 1 da política — "revisão humana obrigatória".
  Nenhuma publicação sem aprovação nominal (política §1). O registro dessa
  aprovação é o **dossiê** (ver `docs/revisao/dossie.md`).
- **Gate:** `G-HUM` — nenhuma publicação sem dossiê assinado (PROGRAMA.html:2994).

## 0. O que esta checklist cobre — e o que ela NÃO cobre

O pipeline prova que o vídeo **é o que foi aprovado**; ele não decide se o vídeo
**presta** (PROGRAMA.html:1897). Nenhuma camada do oráculo tem opinião sobre
qualidade narrativa, conformidade visual percebida ou adequação editorial —
esses itens só um humano pega, e é para isso que esta checklist existe
(PROGRAMA.html:2415-2419). Os itens que a máquina já garante (determinismo,
procedência, loudness, safe area por geometria, contraste do thumbnail) **não
são re-checados aqui por completo**: são conferidos por presença e por amostra,
porque o oráculo já os cobre. A decisão "o vídeo presta" é o que nunca vira
automática (PROGRAMA.html:2415: "não deixar essa parte virar automática por
descuido").

## 1. Quem assina o quê — os quatro papéis da política

A política do I-04 nomeia quatro papéis (política §3): **Revisor editorial**,
**Operador de reversão**, **Operador de publicação** e **Revisor jurídico**.
Esta checklist é assinável **por papel nomeado**, nunca por "o time" — a
separação é documental, não física (AB-991): o mesmo humano pode operar vários
papéis, mas nenhum ato é registrado em dois papéis ao mesmo tempo, e nenhum
ato de um papel é assinado como se fosse de outro (quem reverte não decide o
que é válido; quem publica não autoaprova).

| Papel | Decide | O que assina no dossiê |
|---|---|---|
| **Revisor editorial** | o que é **válido** — aprova ou rejeita o vídeo como conteúdo | os itens E1..E5 desta checklist + o veredito de aprovação |
| **Operador de reversão** | nada sobre o conteúdo — opera a alavanca de tráfego | o item R1 (nenhum ato de reversão registrado como dossiê) e o item R2 (estado da alavanca-mestra) |
| **Operador de publicação** | **publica** — executa o runbook e aciona os gates P-1..P-5 (W11) | o item P1 (G-HUM: não publica sem este dossiê) e o item P2 (identidade da entrega coberta) |
| **Revisor jurídico** | a **suficiência jurídica** — licenças, enquadramento, disclosure | os itens J1..J4 desta checklist (enquadramento AB-993, disclosure de voz AB-999, procedência, reavaliação AB-950) |

## 2. Itens que só um humano pega — Revisor editorial

Vereditos possíveis por item: `CONFERE` / `REPROVADO` (com motivo) /
`NÃO_APLICÁVEL` (com justificativa). Veredito vazio ou `PENDENTE` = dossiê
inválido, publicação bloqueada.

### E1 — Conformidade visual do artefato final (marcador, vinheta, safe area)

O território visual é declarado pelo F5-07/AB-804 (oráculo de conteúdo do
pipeline) e pelo ADR-0043 (safe area por plataforma). A máquina garante a
geometria; o humano assiste o artefato final (`entregavel-final.mp4`,
`variante-16x9.json` e `thumbnail.png` da entrega) e confere:

- **Marcador** — o marcador visual previsto está presente, no lugar declarado,
  sem sobreposição a conteúdo legível;
- **Vinheta** — abertura/fechamento sem recorte, sem artefato de transição,
  sem quadro preto acidental (C1: exit 0 de render não prova que saiu imagem);
- **Safe area** — nenhum texto, marca ou elemento essencial fora do retângulo
  útil da plataforma-alvo (EBU R 95 / zonas das plataformas — ADR-0043); nas
  variantes, o mesmo conteúdo cabe sem cortes.

### E2 — Qualidade narrativa

- A narração é coerente do início ao fim, sem cortes abruptos de frase, sem
  leitura errada de nome/próprio, com cadência aceitável;
- A trilha não abafa a locução em nenhum trecho (o ducking é conferido por
  máquina; o humano confere o resultado percebido);
- As legendas casam com o que é dito, no tempo certo (a sincronia por
  alinhamento é conferida por máquina; o humano confere a legibilidade e o
  ritmo de quebra de página).

### E3 — Adequação editorial

- O vídeo "presta" para o propósito declarado: tema fiel ao brief, sem
  contradição entre texto, imagem e áudio;
- O conteúdo é adequado ao canal/público-alvo da entrega (fase 2+ da política);
- Nenhuma cena permanece com placeholder (mídia/música/gem de exemplo).

### E4 — Legibilidade e acabamento

- Thumbnail: o frame escolhido conta a história certa e o título é legível na
  miniatura (contraste é conferido por máquina, F5-05; a escolha do frame é
  humana);
- Sem "feio de propósito": alinhamento, respiros, cortes de fim de cena.

### E5 — O que a revisão NÃO passou por omissão

- O revisor editorial confere que nenhum item E1..E4 foi marcado
  `NÃO_APLICÁVEL` sem justificativa escrita.

## 3. Revisor jurídico — enquadramento, disclosure e procedência

### J1 — Enquadramento declarado (AB-993)

O dossiê declara o enquadramento: **uso pessoal, ADR-0003**, e o estado do
gatilho — "AB-950 continua fechado" ou "AB-950 disparou" — **nunca omitido**
(ADR-0003: omissão é falha de gate). Se o gatilho disparou, o ADR-0003 é
reaberto e esta política é reavaliada por inteiro antes de qualquer publicação
nova (política §8).

### J2 — Disclosure de voz sintética (AB-999)

Se a entrega contém voz sintética (locução via TTS), o dossiê declara a
obrigação de disclosure do provedor e como ela foi atendida — obrigação do
provedor, independente do enquadramento (ADR-0003 D4). `NÃO_APLICÁVEL` só com
justificativa (entrega sem locução sintética).

### J3 — Procedência (F5-06)

- O relatório de procedência embutido no dossiê tem `semOrigem` **vazio** —
  todo byte do vídeo final com licença e provedor declarados (∅-crit do
  F5-06);
- Os **gaps de data** listados na primeira página do dossiê são conhecidos e
  aceitos (não bloqueantes por contrato — AB-746 — mas **visíveis**, nunca
  omitidos);
- O revisor jurídico confere por amostra que a origem de um ou dois assets
  críticos bate com o registro (o relatório regenera dos mesmos commitados —
  AB-748).

### J4 — Reavaliação sob AB-950 (quando disparado)

Quando o gatilho dispara, o registro de reavaliação da suficiência jurídica é
feito **com o dossiê e o relatório como base** (AB-748), assinado pelo Revisor
jurídico — a decisão de manter ou despublicar o que já saiu é registro com
evidência, nunca reversão automática (política §8.4).

## 4. Operador de reversão — a alavanca e a separação documental

### R1 — Nenhum ato de reversão é registrado como dossiê

Reverter tráfego é ato de configuração; corrigir conteúdo é ato editorial.
O registro da reversão nunca é assinado como dossiê, e o dossiê nunca é
assinado como reversão (política §3, regra 1 — AB-991).

### R2 — Estado da alavanca-mestra

A **alavanca-mestra** é a flag que desliga a publicação inteira (política §2);
enquanto o F6-02 (W11) não a materializa como flag real, **a fase 0 é o único
estado alcançável** (política §2.4, AB-990). O Operador de reversão atesta no
dossiê: (a) o estado atual da publicação (fase 0 = nada publicado); (b) se
houver ato de reversão, ele está no registro da alavanca — nunca aqui.

## 5. Operador de publicação — o gate e a identidade da entrega

### P1 — G-HUM: nenhuma publicação sem este dossiê

O Operador de publicação assina o compromisso de que a publicação (fase 2+)
só acontece com este dossiê assinado (G-HUM — PROGRAMA.html:2994). Não existe
atalho: sem dossiê assinado não há publicação, e o runbook do F6-02 não pode
criar um caminho que contorne o F6-01 (política §5).

### P2 — Identidade da entrega coberta

O dossiê identifica a entrega que cobre (fixture/modo + hash do
`relatorio-final.json` e do `relatorio-procedencia.json`). O Operador de
publicação confere que a entrega que vai publicar é **esta** — a identidade
fecha (hash) — e não outra.

## 6. Assinatura

Cada papel assina com **nome + data + veredito** por item. Formato exigido no
dossiê:

```
- [ ] E1 — conformidade visual (marcador/vinheta/safe area) — veredito: ____
- [ ] E1 — assinado por: ______ (Revisor editorial), em ____
```

Um dossiê com veredito vazio, sem nome ou sem data em qualquer item
**obrigatório** é inválido: `just revisar-bloqueia` falha nomeando o papel e o
item ausentes (∅-crit — ver `docs/revisao/dossie.md` §4).

## 7. O que esta checklist NÃO cobre

- A execução da publicação (runbook, gates P-1..P-5, alavanca como flag real) —
  é do F6-02/F6-03 (W11).
- O fechamento do ledger — é do F6-04 (W11).
- O arquivamento e escopo negativo — é do F6-05 (W12).
- Re-checagem completa do que a máquina já prova (determinismo, loudness,
  geometria de safe area, contraste do thumbnail) — esses oráculos vivem nos
  gates dos cards F0-06/F5-01/F5-03/F5-04/F5-05/F5-07/F5-08; aqui se confere
  por presença e por amostra.
