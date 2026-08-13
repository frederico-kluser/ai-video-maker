# O dossiê de revisão — formato, geração e o ∅-crit (card F6-01, W10)

- **O que é:** o documento de revisão **por entrega** — o registro da fase 1
  da política editorial (docs/politica-editorial.md §1). É a prova de que o
  vídeo passou na revisão humana com aprovação nominal; sem ele, a publicação
  é impossível (gate `G-HUM`, PROGRAMA.html:2994).
- **Onde vive:** `docs/revisao/dossie-<entrega>.md` (a entrega é o
  identificador passado a `just revisar`; default: `canonico`).
- **Quem gera:** `just revisar` (rascunho). **Quem completa:** um humano,
  operando cada papel nomeado. **Quem bloqueia:** `just revisar-bloqueia`.
- **Decisão canônica:** ADR-0045.

## 1. O que o dossiê contém

O dossiê gerado tem **sete seções obrigatórias**, nesta ordem:

1. **Identidade da entrega** — fixture/modo, sucesso do `relatorio-final.json`,
   hash SHA-256 do `relatorio-procedencia.json` da entrega e do próprio
   relatório embutido.
2. **Gaps de data visíveis** — a lista `gapsDeData` do relatório do F5-06,
   explícita na primeira página: cada gap é conhecido e aceito, nunca omitido
   (AB-746: gap visível, não bloqueio — a decisão "quando vira bloqueio" é do
   dono, registrada aqui).
3. **Relatório de procedência (F5-06)** — o JSON completo produzido por
   `gerarRelatorio` (src/entrega/procedencia/relatorio.ts), com o resumo dos
   vereditos: `semOrigem` (∅-crit do F5-06: vazio = liberado), diretos,
   transitivos, enquadramento. O dossiê também registra a **regeneração**:
   `regeneracao: CONSISTENTE` quando o relatório regenerado dos mesmos
   commitados (sem re-renderizar — AB-748) coincide nos vereditos essenciais
   com o relatório da entrega; `DIVERGENTE` quando não.
4. **Declaração de enquadramento (AB-993)** — uso pessoal / ADR-0003 e o
   estado do gatilho: "AB-950 continua fechado" ou "AB-950 disparou", **nunca
   omitido** (ADR-0003). Referencia a cláusula do caso não previsto da política
   §7 ("o que não está escrito não está decidido").
5. **Disclosure de voz sintética (AB-999)** — se a entrega contém voz
   sintética (locução via TTS), a obrigação de disclosure do provedor e como
   foi atendida; assinado pelo Revisor jurídico.
6. **Checklist por papel** — os itens E1..E5, J1..J4, R1..R2, P1..P2 de
   `docs/revisao/checklist.md`, agrupados pelo papel que os assina, cada um com
   campo de veredito (`CONFERE` / `REPROVADO` + motivo / `NÃO_APLICÁVEL` +
   justificativa).
7. **Assinaturas por papel** — quatro blocos, um por papel nomeado
   (Revisor editorial, Revisor jurídico, Operador de reversão, Operador de
   publicação), cada um com nome + data + veredito global.

## 2. `just revisar` — geração do rascunho

```
just revisar [--entrega <id>] [--saida <dir>] [--dossie <caminho>]
```

- Lê a entrega em `<dir>` (default `output/`): `relatorio-final.json`,
  `relatorio-procedencia.json`, `manifesto-resolvido.json`. Se a entrega não
  existir no disco, o gerador monta a **entrega de fixture** dos cassetes
  commitados (`fixtures/cassetes/**`) sobre o manifesto canônico
  (`fixtures/canonico/manifesto-valido.json`) — o mesmo material que o gate do
  F5-06 usa como "vídeo final" — e gera o dossiê a partir dela.
- Regenera o relatório com `gerarRelatorio` (offline, sem store) e registra
  `regeneracao: CONSISTENTE/DIVERGENTE` comparando os vereditos essenciais com
  o relatório da entrega (ou da fixture).
- Escreve o dossiê como **rascunho**: seções 1..5 preenchidas pela máquina,
  seções 6..7 em branco (`PENDENTE`).
- **Nunca assina nada.** Um dossiê recém-gerado é inválido por construção —
  e é exatamente isso que o ∅-crit exige (gerar ≠ aprovar).
- Recusa sobrescrever um dossiê que já contém assinatura (proteção do registro
  de aprovação humana).

## 3. A assinatura humana

O humano (o dono do programa, operando cada papel — separação documental,
AB-991) abre o dossiê e:

1. Assiste o artefato final da entrega e preenche os vereditos do papel que
   está operando (Revisor editorial: itens E; Revisor jurídico: itens J;
   Operador de reversão: itens R; Operador de publicação: itens P);
2. Assina cada bloco com **nome + data + veredito**;
3. Não pode assinar dois papéis no mesmo ato — o registro distingue os papéis
   (política §3, regra 4).

## 4. `just revisar-bloqueia` — o ∅-crit executável (gate G-HUM)

```
just revisar-bloqueia [--entrega <id>] [--saida <dir>] [--dossie <caminho>]
```

A **alavanca-mestra** da política é a flag que desliga a publicação inteira
(política §2); o gate G-HUM é o ponto em que o dossiê entra nela: **a
publicação exige dossiê assinado — sem dossiê, bloqueia**. O comando falha
(exit ≠ 0, VERMELHO) quando, para a entrega pedida:

- o arquivo do dossiê **não existe** — "entrega sem dossiê" (o ∅-crit: é
  pré-condição, não pós-condição);
- o dossiê não declara a **identidade da entrega** pedida;
- o **relatório de procedência** embutido está ausente, ilegível, ou o hash
  do relatório embutido não fecha com o `relatorio-procedencia.json` da
  entrega (quando a entrega existe no disco);
- a **regeneração** está `DIVERGENTE`;
- a **declaração de enquadramento** (AB-993) está ausente;
- o **disclosure de voz sintética** (AB-999) está ausente;
- algum item obrigatório do **checklist** está sem veredito (nomeia o item);
- alguma das **quatro assinaturas** está ausente, sem nome ou sem data
  (nomeia o papel).

Quando a entrega pedida não existe em `<dir>`, o comando falha com "entrega
ausente" — nada a publicar, bloqueado (a ausência nunca aprova). Quando tudo
fecha, imprime `VERDE` e a publicação pode seguir para os gates P-1..P-5
(F6-03, W11).

## 5. O que este documento NÃO cobre

- A execução da publicação (runbook do F6-02, gates numerados do F6-03,
  materialização da alavanca-mestra como flag real) — W11.
- O fechamento do ledger (F6-04) e o arquivamento (F6-05) — W11/W12.
- A revisão do checklist em si — ver `docs/revisao/checklist.md`.
