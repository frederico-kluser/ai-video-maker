# Os gates numerados de publicação — P-1..P-5 (card F6-03, W11)

- **Card de origem:** `F6-03` (W11, 🔴 crítico) — gates numerados de
  publicação; um veredito `CONFERE` sem evidência anexada falha.
- **Política consumida:** `docs/politica-editorial.md` (I-04, W9.5) — os
  papéis nomeados da §3, as fases da §1, a **alavanca-mestra** da §2, o
  enquadramento da §8 (`AB-950`) e o caso não previsto da §7 (`AB-993`).
- **Pré-requisito da publicação:** o dossiê do F6-01 (`docs/revisao/**`,
  W10) — o gate P-1 o consome via `just revisar-bloqueia`.
- **Consumidos por:** `F6-02` (W11, runbook de publicação — o runbook
  referencia `GATE P-1` e executa os cinco), `F6-04` (W11, fechamento do
  ledger) e `F6-05` (W12, arquivamento).
- **Decisão canônica:** ADR-0047 (`docs/adr/0047-*.md`).
- **Estado:** ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO — os cinco gates
  estão commitados com veredito `NÃO_COLETADO`; nenhuma evidência foi
  coletada e nenhum vídeo foi publicado. `just gates-bloqueia` é VERMELHO
  por construção (o cabeçalho não é apagado quando o primeiro vídeo sair:
  o status muda, a confissão fica).

## O que são

Os **pré-requisitos numerados de publicação** (PROGRAMA.html:2995) — a
execução da fase 2+ da política. O dossiê do F6-01 prova que a entrega
passou na revisão humana (fase 1); os gates P-1..P-5 provam, em ordem e com
evidência anexada, que a entrega pode **sair**. Cada gate segue a forma do
Apêndice G do PROGRAMA.html, com os quatro elementos obrigatórios:

1. **condição de entrada** — quando o gate roda;
2. **evidência exigida** — saída de comando **salva**, nunca afirmação;
3. **artefato nominal** — onde a evidência mora
   (`docs/gates/evidencias/<entrega>/P-N.txt` + o bloco anexado no documento);
4. **quem assina, por papel nomeado** — os MESMOS quatro papéis da política
   §3 (acentuados, vocabulário único em `tools/revisao/formato.ts`), nunca
   "o time".

## Os cinco gates

| Gate | Asserção (o que prova) | Dano concreto que previne | Quem assina |
|---|---|---|---|
| **P-1** | Revisão humana nominal — dossiê assinado e validado (G-HUM) | publicar vídeo que nenhum humano aprovou — o que já foi visto não se despublica | Operador de publicação |
| **P-2** | Procedência completa — nenhuma origem ausente (G-PROC) | publicar asset com licença errada ou origem desconhecida — reavaliação jurídica fica cega | Revisor jurídico |
| **P-3** | Enquadramento declarado — AB-950 e disclosure de voz (ADR-0003) | publicar sob o gatilho de escopo sem reavaliação — política inteira perde a condição de escopo | Revisor jurídico |
| **P-4** | Áudio dentro de norma (F5-03) | publicar vídeo com loudness fora do alvo ou teto estourado — reprovação e re-encode pós-publicação | Operador de publicação |
| **P-5** | Autorização consolidada — veredito dos gates P-1..P-5, alavanca-mestra e identidade | disparar a publicação com pré-requisito pendente ou com a publicação desligada — o ato irreversível sai contra o estado declarado | Revisor editorial |

A cadeia: `P-1` (dossiê) → `P-2` (procedência) → `P-3` (enquadramento) →
`P-4` (áudio) → `P-5` (autorização consolidada). Cada gate só é acionado com
o anterior `CONFERE`. O Operador de reversão participa da cadeia no item R2
do dossiê (estado da alavanca-mestra, consumido pelo P-5) — separação
documental, não física (AB-991).

## Vereditos — e o veredito que não pode existir

Cada gate tem três vereditos possíveis:

- **`CONFERE`** — a condição foi verificada **e a evidência está anexada**
  (saída de comando salva no documento ou em `docs/gates/evidencias/`).
  `CONFERE` sem evidência anexada **é falha** (∅-crit do F6-03 —
  PROGRAMA.html, Apêndice G: "um veredito que não pode existir"). É pior que
  `ABERTO`: ele para de ser reperguntado e vira premissa invisível.
- **`REPROVADO`** — a condição foi verificada e reprovou. **Bloqueia a
  publicação**.
- **`NÃO_COLETADO`** — a condição não foi verificada ou a saída não foi
  salva. **Bloqueia a publicação** e **nunca vira `CONFERE` sozinho**: só a
  execução do comando com a saída salva troca o veredito.

## Comandos

- **`just gates-validar`** — o gate do próprio card F6-03 (acceptance):
  presença per-item dos artefatos, validação estrutural dos documentos e as
  sondas do ∅-crit (cada mutação — `CONFERE` sem evidência, `REPROVADO`,
  `NÃO_COLETADO`, papel não nomeado, gate ausente, diretório vazio — tem de
  falhar VERMELHO nomeando o motivo; sonda positiva: os cinco gates
  `CONFERE` com evidência → VERDE). Sai 0.
- **`just gates-bloqueia`** — o verificador consolidado
  (`tools/gates/verificar-gates.ts`), consumido pelo runbook F6-02 no
  fechamento: valida o estado corrente de `docs/gates/**`. Falha (exit 1,
  VERMELHO) quando: algum gate P-1..P-5 está ausente; algum veredito é
  `REPROVADO` ou `NÃO_COLETADO`; algum `CONFERE` está sem evidência anexada;
  a assinatura não nomeia um dos quatro papéis (acentuados, de
  `tools/revisao/formato.ts`) ou a assinatura está sem nome/data. Imprime
  `VERDE` (exit 0) só quando os cinco gates são `CONFERE` com evidência
  anexada — a publicação autorizada.

> **Nota de divergência:** o PROGRAMA.html cita `just gates:validar` (com
> dois-pontos); este justfile não suporta dois-pontos em nome de receita
> (just 1.42.4), então o gate é `just gates-validar` (hífen, a convenção das
> demais receitas — mesmo caso do `gm-e2e` do F5-08). A divergência está
> nomeada no ADR-0047.

## Evidências anexadas

Cada `CONFERE` exige a **saída de comando salva** — o bloco anexado no
documento do gate (marcador de evidência anexada `F6-03:evidencia-anexada`
seguido da saída em bloco de código) e/ou o arquivo em
`docs/gates/evidencias/<entrega>/P-N.txt` (referenciado pelo marcador de
arquivo `F6-03:evidencia-arquivo`). A exceção estrutural é o P-5
(marcador `F6-03:evidencia-auto`): o fecho consolidado é a
própria verificação — a evidência dele é a saída da rodada final do
verificador, salva pelo operador no ato. Nenhum outro gate admite
auto-evidência.

## O que este documento NÃO cobre

- A execução da publicação — runbook do F6-02 (W11) e a materialização da
  alavanca-mestra como flag real (AB-990).
- A revisão humana e o dossiê — `docs/revisao/**` (F6-01, W10).
- O fechamento do ledger (F6-04) e o arquivamento (F6-05) — W11/W12.
