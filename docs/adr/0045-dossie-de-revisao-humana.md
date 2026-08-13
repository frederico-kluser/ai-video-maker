# ADR-0045 — O dossiê de revisão humana (F6-01): o registro da fase 1, assinado por papel nomeado, pré-condição da publicação

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F6-01 (W10, 🔴 crítico, tdd) — checklist de revisão humana;
  entrega sem dossiê bloqueia a publicação.
- **Numero pre-alocado:** PROGRAMA.html §III-12 (F6-01 -> 0045; 0044 fica
  reservado ao F5-08/W10, golden master).
- **Faixa de ledger:** AB-850..AB-869 (ledger/inbox/F6-01.json; itens
  abertos AB-850..AB-858).
- **Depende de:** I-04 (docs/politica-editorial.md — os papéis, as fases, a
  alavanca-mestra, AB-993/999; ADR-0033), F5-06 (relatório de procedência
  transitivo — `gerarRelatorio`, ADR-0039), F5-07 (a entrega ponta a ponta e
  os artefatos do `output/`), ADR-0003 (enquadramento de uso pessoal, AB-950).
- **Consumida por:** F6-02 (W11, runbook de publicação — chama
  `just revisar-bloqueia`; materializa a alavanca-mestra como flag real,
  AB-990), F6-03 (W11, gates P-1..P-5 — o dossiê assinado é pré-requisito),
  F6-04 (W11, fechamento do ledger).
- **Guarda executavel:** `just revisar-gate` com exit 0 (sondas negativas
  incluídas) e `just revisar-bloqueia` VERMELHO contra o rascunho canônico
  commitado — o ∅-crit morde no artefato de demonstração do próprio card.

## Contexto

O oráculo prova que o vídeo **é o que foi aprovado**; ele não decide se o
vídeo **presta** (PROGRAMA.html:1897). A política editorial (I-04) responde
"o que conta como vídeo publicável, em nome de quem" com quatro papéis
nomeados e uma alavanca-mestra: uma flag única que desliga a publicação
inteira (política §2). Enquanto a alavanca não é flag real (W11/F6-02), a
fase 0 é o único estado alcançável (política §2.4) — e o F6-01 é o ponto em
que a revisão humana entra no caminho da publicação: **a publicação exige
dossiê assinado; sem dossiê, bloqueia** (gate G-HUM, PROGRAMA.html:2994).

Três perguntas adversariais do card governam este ADR:

1. **O checklist é assinável por papel nomeado, ou por "o time"?** Por papel
   nomeado — os MESMOS quatro papéis da política §3, nunca o coletivo. A
   separação é documental, não física (AB-991): o mesmo humano opera vários
   papéis, mas cada ato é registrado no papel certo, e nenhum ato em dois
   papéis ao mesmo tempo.
2. **Ele inclui os itens que só um humano pega?** Sim — conformidade visual
   (marcador, vinheta, safe area — território declarado pelo F5-07/AB-804),
   qualidade narrativa, adequação editorial, legibilidade e acabamento. São
   itens sem oráculo: o gate exige veredito humano em cada um e rejeita
   `NÃO_APLICÁVEL` fora do item condicional (J2).
3. **Existe caminho que publica sem passar por aqui?** Não — a resposta é
   executável: `just revisar-bloqueia` falha quando não existe dossiê válido
   para a entrega, e o runbook do F6-02 (W11) não pode criar atalho
   (política §5).

## Decisões

### 1. O dossiê é o registro da fase 1 — documento de revisão POR ENTREGA

Cada entrega tem um dossiê (`docs/revisao/dossie-<entrega>.md`) com sete
seções obrigatórias: (1) identidade da entrega, (2) gaps de data visíveis,
(3) relatório de procedência do F5-06 embutido, (4) declaração de
enquadramento (AB-993), (5) disclosure de voz sintética (AB-999),
(6) checklist por papel, (7) assinaturas por papel. O dossiê é a prova de
que a entrega passou na fase 1 da política; sem ele, a publicação é
impossível.

### 2. Assinatura por papel nomeado — o vocabulário fecha com a política

Os quatro blocos de assinatura usam os MESMOS nomes da política §3 (com
acentuação), vivendo em `tools/revisao/formato.ts` como vocabulário único
compartilhado por gerador, verificador e gate. Um papel ausente, sem nome ou
sem data torna o dossiê inválido; o gate nomeia o papel faltante. Veredito
`REPROVADO` em qualquer item ou papel = entrega reprovada, publicação
bloqueada.

### 3. Itens só-humanos com veredito exigido — e `NÃO_APLICÁVEL` restrito

Os itens E1..E5 (Revisor editorial), J1..J4 (Revisor jurídico), R1..R2
(Operador de reversão) e P1..P2 (Operador de publicação) exigem veredito
`CONFERE`/`REPROVADO`/`NÃO_APLICÁVEL`; `PENDENTE` ou ausente = dossiê
inválido. `NÃO_APLICÁVEL` só é aceito no J2 (disclosure de voz sintética
para entrega sem locução) — os demais itens se aplicam a toda entrega.

### 4. Gerar ≠ aprovar — o gerador nunca assina, e o rascunho é rejeitado

`just revisar` gera o RASCUNHO (seções 1..5 preenchidas pela máquina, 6..7
em branco) e recusa sobrescrever um dossiê já assinado. O gate prova por
sonda que o rascunho gerado é REJEITADO por `just revisar-bloqueia` — a
aprovação é ato humano, e nenhuma ferramenta a emite. O rascunho canônico
commitado (`docs/revisao/dossie-canonico.md`) é verificado de propósito: ele
existe (criterio 1) e o ∅-crit o rejeita (criterio 2) — a entrega canônica
continua em fase 0 até um humano assinar.

### 5. O relatório embutido fecha por hash e a regeneração é registrada

O dossiê embute o JSON do relatório do F5-06 com o hash SHA-256 do
`relatorio-procedencia.json` da entrega; `just revisar-bloqueia` confere o
hash contra o artefato da entrega e exige `regeneracao: CONSISTENTE` — o
relatório regenerado dos mesmos commitados (AB-748, sem re-renderizar)
coincide nos vereditos essenciais (semOrigem, gaps, diretos, transitivos,
enquadramento). Hash divergente ou regeneração DIVERGENTE = dossiê inválido:
a reavaliação sob AB-950 nunca usa uma base mentirosa.

### 6. O ∅-crit é executável antes do runbook

Enquanto a alavanca-mestra não é flag real (AB-990, W11), o bloqueio é o
comando `just revisar-bloqueia` (gate G-HUM): falha quando o dossiê da
entrega não existe, não é assinado, não declara enquadramento/disclosure,
não fecha o hash do relatório ou não corresponde a uma entrega existente no
disco — a ausência nunca aprova. O runbook do F6-02 herda o comando; a W11
liga o dossiê à alavanca real e aos gates P-1..P-5.

## Consequências

- **Positivas:** a revisão humana tem registro estável, assinável e
  verificável por comando; o ∅-crit do card vira a primeira etapa executável
  da alavanca-mestra; a reavaliação sob AB-950 tem base verificada por hash.
- **Negativas:** o dossiê não aprova nada sozinho — a publicação de uma
  entrega exige o ciclo completo (gerar → assistir → assinar → gate verde),
  e o gate é VERMELHO por default até esse ciclo acontecer (por construção).
- **Não afetadas:** `src/**` não é editado (o dossiê consome
  `gerarRelatorio`/`adaptarStore` e a política; nada disso é alterado);
  `docs/politica-editorial.md` e `docs/runbooks/**` permanecem do I-04 e do
  F6-02 (W11).

## O que este ADR NÃO cobre

- A materialização da alavanca-mestra como flag real e o runbook de
  publicação — F6-02 (W11).
- Os gates numerados P-1..P-5 com evidência anexada — F6-03 (W11).
- O fechamento do ledger (a dívida de categorias inválidas do F5-07,
  AB-804..808, é fechada lá) e o arquivamento — F6-04/F6-05 (W11/W12).
