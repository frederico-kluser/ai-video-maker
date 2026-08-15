versao: 1.0.0

# Prompt do roteirista — regenerar UM pedaço

## Propósito

Prompt usado na **chamada de regeneração do gerador de roteiro** (Onda 2
do app web): o usuário não gostou de um pedaço (ou o editou) e pede para
**reescrever só ele**. O gerador recebe o brief, o **pedaço alvo** (com as
edições do usuário já aplicadas) e o **resumo dos irmãos**, e produz UM
novo Pedaco. Os irmãos ficam byte a byte INTACTOS no roteiro (FQ-G2).

## Contrato (referência)

- Estrutura da saída: o **schema REAL** do pedaço,
  `src/roteiro/contrato/schema/pedaco.schema.json` (referencia o
  Roteiro.1, draft 2020-12, `additionalProperties:false`).
- O LLM decide o **conteúdo novo** do pedaço: título, fala, duração
  planejada, visual (vocabulário fechado), especificação e detalhes.
- O sistema decide **identidade e estado** — e REAPLICA sobre a sua
  saída: `id` e `indice` (sempre os do pedaço alvo — regra
  `id-nao-casa-indice`), `narracao` (sempre vazia — RECORD-FIRST) e o
  anexo do usuário (se o pedaço for gif/video, o sistema reaplica
  `anexo_hash`/`anexo_meta` do alvo; você NUNCA emite anexo).
- Política **RECORD-FIRST** (emenda da Onda 2): o gerador nunca emite
  narração. O pedaço regenerado sai com `narracao: {texto: "", origem:
  "nenhuma", status: "vazio"}` — a narração anterior (se havia) fica
  órfã; o usuário grava de novo se quiser.
- Front-matter: `versao:` na primeira linha (convenção da biblioteca de
  prompts). O texto do prompt entra na chave do store do cache via sha256
  (C12).

## Entrada

1. **Brief** — os campos declarados do brief (tema, contexto, público,
   tom, exclusões, `duracao_alvo_segundos`).
2. **Pedaco alvo** — o pedaço a regenerar, com as edições do usuário já
   aplicadas (inclusive `fala` editada, `duracao_segundos` editada,
   `tipo_visual` editado e, se for gif/video, o anexo do usuário).
3. **Resumo dos irmãos** — a serialização canônica dos demais pedaços do
   roteiro (contexto para manter o tom e NÃO repetir conteúdo).

## Saída

Um único objeto: o **Pedaco JSON** (sem markdown, sem comentários), com
TODOS os campos do schema:

| Campo | Regra |
|---|---|
| `id` | O MESMO do pedaço alvo (o sistema reaplica; errou = corrigido — mas não conte com isso). |
| `indice` | O MESMO do pedaço alvo. |
| `titulo` | Não vazio; pode repetir o do alvo se ainda servir. |
| `fala` | O texto narrado NOVO — **diferente do atual** (regenerar = reescrever; a mesma fala indica que nada mudou). Pode ser vazia (pedaço sem fala). |
| `duracao_segundos` | Positiva, em segundos; próxima da do alvo (ou ajustada ao ritmo novo). |
| `tipo_visual` | Do vocabulário fechado. **Se o alvo é `gif`/`video`, MANTER** (o anexo do usuário só vale para esses tipos — trocar para outro tipo descarta o anexo). Nunca escolha `gif`/`video` se o alvo não é. |
| `especificacao_visual` | Não vazio; o visual NOVO (ou refinado). |
| `detalhes_de_producao` | Não vazio; como o pedaço novo será feito. |
| `narracao` | SEMPRE `{"texto": "", "origem": "nenhuma", "status": "vazio"}`. |
| `anexo_hash` / `anexo_meta` | NUNCA emitidos (o sistema reaplica o do alvo). |

## Regras da regeneração

1. **Regenerar é reescrever**: a fala nova deve ser uma REDACAO NOVA da
   mesma ideia (ou da ideia editada pelo usuário) — não a cópia da atual.
   Respeite a `fala` editada pelo usuário como a direção da nova versão.
2. **Não repita os irmãos**: leia o resumo; o pedaço novo não deve repetir
   conteúdo, exemplo ou fala que um irmão já cobre — complemente.
3. **Mantenha a identidade**: `id` e `indice` do alvo, sempre.
4. **Nunca emita narração, anexo, URL, gif/video (se o alvo não é) nem
   campo fora do schema**.
5. **Duração**: a soma do roteiro continua válida por construção (o
   sistema apenas substitui o pedaço; a soma não é recalculada por você —
   ela era do roteiro antigo e o servidor a revalida).

## Instrução final

[PROMPT] Emita o Pedaco JSON final. Confira, em ordem: (1) `id` e
`indice` iguais aos do alvo; (2) fala NOVA (ou editada pelo usuário
incorporada), diferente da atual; (3) `narracao` vazia; (4) `tipo_visual`
coerente com o alvo (gif/video do alvo mantido; gif/video nunca inventado
do zero); (5) nenhum `anexo_*`, nenhuma URL, nenhum campo fora do schema;
(6) `titulo`, `especificacao_visual` e `detalhes_de_producao` não vazios.

---

## Controle (metadados do prompt — consumido pelo teste)

- versao_contrato_roteiro: v1 (Roteiro.1 — schema real de
  `src/roteiro/contrato/schema/pedaco.schema.json`)
- politica: RECORD-FIRST (narracao sempre vazia; anexo reapicado pelo
  sistema, nunca emitido pelo modelo)
- garantia: FQ-G2 (irmãos intocados) + FQ-G3 (edição do usuário entra na
  chave e no prompt)
