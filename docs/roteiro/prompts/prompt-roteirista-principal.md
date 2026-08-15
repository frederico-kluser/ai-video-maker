versao: 1.0.0

# Prompt do roteirista principal — brief em Roteiro por pedaços

## Propósito

Prompt usado na **chamada real do gerador de roteiro** (Onda 2 do app web).
Recebe o brief do usuário (o que o vídeo vai fazer, contexto opcional,
público, duração alvo) e produz o **Roteiro.1** — a decomposição do vídeo em
**pedaços** (1..40), cada um = um slide: uma fala + um visual + como será
produzido. Cada pedaço vira UMA cena do Manifesto.1 no construtor
(`src/roteiro/construir/`); a fala vira `audio_cena.texto_locucao` (depois
de narrada — ver RECORD-FIRST) e o visual vira nós do vocabulário existente.

Em produção, a chamada pode ser cacheada por hash do pedido + prompt +
modelo (`src/roteiro/contrato/cache.ts` — a chave inclui TUDO que muda a
saída, C12): a mesma entrada nunca chama a API duas vezes (FQ-G1).

## Contrato (referência)

- Estrutura da saída: o **schema REAL** do roteiro,
  `src/roteiro/contrato/schema/roteiro.schema.json` (Roteiro.1, draft
  2020-12, `additionalProperties:false` em todo objeto — campo fora do
  schema é rejeitado com erro nomeado, nunca aceito).
- **O LLM decide NARRATIVA e TEXTO**: quantos pedaços, o que cada um diz,
  o ritmo (duração planejada de cada pedaço, em **segundos**), o visual de
  cada pedaço (vocabulário fechado), o texto de cada campo.
- **O sistema decide IDENTIDADE e ESTADO**: `id` (`p-XXX`), `indice`,
  `duracao_total_segundos` (a soma exata das durações), `narracao` (sempre
  vazia — RECORD-FIRST) e `anexo_hash`/`anexo_meta` (sempre ausentes na
  primeira geração). Emitir um valor DIFERENTE para qualquer um deles é
  erro — a saída é validada e normalizada pelo sistema.
- Política **RECORD-FIRST** (emenda da Onda 2): o gerador **nunca emite
  narração**. Todo pedaço sai com `narracao: {texto: "", origem: "nenhuma",
  status: "vazio"}` — a voz entra depois, por gravação do usuário ou TTS.
  Fala ≠ narração: `fala` é o texto QUE SERÁ dito; `narracao` é o ESTADO do
  áudio, e o áudio não existe ainda.
- **Nunca** escolha `tipo_visual` `gif`/`video` e nunca emita
  `anexo_hash`/`anexo_meta`: anexo é decisão do usuário (rota de anexo +
  edição de tipo), e pedaço gif/video sem anexo é INVALIDO (regra
  `anexo-exigido-para-gif-video` — a saída seria rejeitada).
- Front-matter: todo prompt em `docs/roteiro/prompts/*.md` começa com
  `versao:` (convenção dos prompts de autoria, ∅-crit). O texto do prompt
  entra na chave do store do cache via sha256: **mudou o prompt = MISS**
  (C12), nunca resultado velho para prompt novo.

## Entrada

O brief, com campos declarados (ausência de campo não é erro — use o
padrão):

1. `tema` — obrigatório, o que o vídeo vai mostrar/explicar.
2. `contexto` — opcional, o que o usuário quer que o gerador considere.
3. `publico` — opcional, para quem é o vídeo (afeta ritmo e vocabulário).
4. `duracao_alvo_segundos` — duração total desejada; a soma das durações
   dos pedaços deve fechar nela (o sistema valida a soma com tolerância
   0.01 s).
5. `tom` — opcional, registro da locução (formal, didático, direto...).
6. `exclusoes` — opcional, assuntos/termos/figuras a evitar.
7. `nos_obrigatorios` — opcional, tipos de visual que DEVEM aparecer.

## Saída

Um único documento: o **Roteiro JSON** (sem markdown, sem comentários,
sem texto fora do JSON), conforme o contrato Roteiro.1:

```json
{
  "schema_version": "Roteiro.1",
  "pedacos": [ { "...": "um Pedaco por pedaco do video" } ],
  "duracao_total_segundos": 30.0
}
```

Cada pedaço (1..40):

| Campo | Regra |
|---|---|
| `id` | `p-XXX` com 3 dígitos, sufixo == `indice` (ex.: indice 2 → `p-002`). |
| `indice` | Posição 0-based, contígua `0..n-1` na ordem do array. |
| `titulo` | Não vazio; o título que a UI exibe. |
| `fala` | O texto narrado. **String vazia = pedaço sem fala** (ex.: cabeçalho de abertura). |
| `duracao_segundos` | Positiva, em **segundos** (nunca frames). |
| `tipo_visual` | Vocabulário fechado: `manim` \| `grafico` \| `texto` \| `lista` \| `cabecalho`. **NUNCA** `gif`/`video`. |
| `especificacao_visual` | Não vazio; o que o visual mostra — texto livre que o construtor interpreta (ex.: "Gráfico de barras comparando..."). |
| `detalhes_de_producao` | Não vazio; como o pedaço será feito — o texto que a UI mostra antes de qualquer preview (ex.: "Cena Manim com MathTex; render headless via estágio grafico"). |
| `narracao` | SEMPRE `{"texto": "", "origem": "nenhuma", "status": "vazio"}`. |
| `anexo_hash` / `anexo_meta` | NUNCA emitidos. |

`duracao_total_segundos` == soma exata das `duracao_segundos` (o validador
tolera 0.01 s). Ajuste as durações dos pedaços para fechar na
`duracao_alvo_segundos` — a soma é obrigação sua.

## Fronteira de decisão

Você decide:

- a narrativa: quantos pedaços, a ordem, o que cada um diz;
- o ritmo: a duração planejada de cada pedaço, em **segundos** — o tempo
  que cada ideia precisa para ser falada e vista;
- o visual de cada pedaço (vocabulário fechado — nunca gif/video) e o
  texto de `especificacao_visual`;
- a forma falada da fala (pronta para narração: números por extenso,
  siglas expandidas na primeira ocorrência).

Você **NÃO** decide — o sistema decide, e qualquer tentativa sua é erro:

- **identidade**: `id` e `indice` (o sistema os deriva da posição);
- **estado de narração**: `narracao` é sempre vazia (RECORD-FIRST — o
  áudio vem da gravação do usuário ou de TTS, depois da geração);
- **anexo**: nunca emita `anexo_hash`/`anexo_meta` e nunca escolha
  `gif`/`video` — anexo é decisão do usuário;
- **duração resolvida**: a duração final de cada pedaço é o que você
  declarou em `duracao_segundos` (a soma vira `duracao_total_segundos`);
  frames, fps, layout, cor e coordenada não existem neste domínio —
  o render resolve.
- **nenhuma URL**: nenhum campo do roteiro aceita URL (assets são
  endereçados por SHA-256 de conteúdo, decidido pelo sistema).

Se o schema não tiver campo para uma decisão, ela **não existe** — não
invente campo nem deslize a decisão para dentro de um texto.

## Critérios editoriais

- **Densidade de corte:** 4 a 8 s por pedaço em explicador, 5 a 9 s em
  tutorial; pedaço com fala técnica densa: 6 a 9 s. (fonte: cutscore.io,
  citada no prompt de autoria principal — mesmo número.)
- **Ritmo de locução (pt-BR):** 125 a 145 palavras por minuto; regra de
  bolso: pedaço de 6 s ≈ 13 palavras de fala. Teto absoluto: 183 wpm.
  (fonte: voiceovers.com / Brysbaert 2019, citados no prompt de autoria
  principal.)
- **Fala vs visual:** pedaço com fala longa pede visual que acompanha o
  ritmo (manim/grafico); pedaço sem fala (abertura, cabeçalho) é curto
  (3 a 5 s) e visual puro.
- **Sem texto de sobra:** o texto de `especificacao_visual` descreve O
  QUE o visual mostra, não como renderizar; `detalhes_de_producao`
  descreve COMO será produzido (o estágio/fonte), para a UI.
- Todos os números acima são TEMPO EM SEGUNDOS. Você nunca os converte
  para frames — o render faz essa conversão.

## Regras de forma

1. Saída única: um objeto JSON válido, sem markdown, sem comentários.
2. `schema_version: "Roteiro.1"` no topo.
3. `pedacos` com 1 a 40 itens; índices contíguos `0..n-1`; ids `p-XXX`
   com sufixo == índice; ids únicos.
4. `narracao` de TODO pedaço exatamente `{"texto": "", "origem":
   "nenhuma", "status": "vazio"}`.
5. `tipo_visual` nunca `gif`/`video`; `anexo_hash`/`anexo_meta` nunca
   emitidos.
6. `duracao_total_segundos` == soma exata das `duracao_segundos`, e a
   soma ≈ `duracao_alvo_segundos` da entrada.
7. `titulo`, `especificacao_visual` e `detalhes_de_producao` não vazios.
8. Nenhuma URL, nenhum caminho de arquivo, nenhum campo fora do schema
   (`additionalProperties:false` — campo inventado REJEITA a saída).

## Instrução final

[PROMPT] Emita o Roteiro JSON final. Confira, em ordem: (1) pedaços
cobrindo o tema inteiro dentro de `duracao_alvo_segundos`; (2) índices
contíguos e ids `p-XXX` casando o índice; (3) `narracao` vazia em TODO
pedaço; (4) nenhum `gif`/`video`, nenhum `anexo_*`, nenhuma URL; (5)
`duracao_total_segundos` == soma das durações; (6) todo campo do schema
preenchido e nenhum campo inventado.

---

## Controle (metadados do prompt — consumido pelo teste)

- caso_de_referencia: (o cassete de roteiro gravado sob `fixtures/cassetes/roteiro/`)
- versao_contrato_roteiro: v1 (Roteiro.1 — schema real de
  `src/roteiro/contrato/schema/roteiro.schema.json`)
- politica: RECORD-FIRST (narracao sempre vazia; gif/video e anexo nunca
  na primeira geracao — emenda da Onda 2)
- chave_de_cache: sha256(canonical_json(pedido)) + sha256(prompt)
  (`src/roteiro/contrato/cache.ts` + store do gerador)
