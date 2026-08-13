versao: 1.0.0

# Indice da biblioteca de prompts — autoria (card F4-02, W5)

Biblioteca de prompts da **autoria** (estagio 1 do pipeline): o que o
LLM decide (narrativa, ritmo, nos, texto) e o que ele **nunca** decide
(layout, cor, frame exato, duracao resolvida — o sistema decide).

## Regra do diretorio (∅-crit do card)

**Todo arquivo `.md` em `docs/autoria/prompts/` comeca com a linha
`versao:`** — e a base do critério de aceitacao do card (forma
corrigida: `rg --files-without-match "^versao:" docs/autoria/prompts/`
vazio; armadilha 9.2: `rg -L` e `--follow`, nao
`--files-without-match`). Um prompt sem `versao:` fica VERMELHO.

## Arquivos

| Arquivo | Papel | Saida |
|---|---|---|
| `prompt-decomposicao-narrativa.md` | tema em arco: cenas, ordem, locucao, nos | Documento de Autoria (Autoria.1) |
| `prompt-roteiro-locucao.md` | texto falado com pronuncia aplicada (TTS) | Documento de Autoria (mesma estrutura) |
| `prompt-autoria-principal.md` | brief completo em Documento de Autoria final (chamada real) | Documento de Autoria (Autoria.1) |
| `dicionario-pronuncia.md` | fonte unica de pronuncia pt-BR de termos tecnicos | dados (tabela termo -> pronuncia) |

`indice.md` (este arquivo) nao e prompt: nao tem caso de referencia.
Todo arquivo `prompt-*.md` tem caso de referencia em `casos/<slug>/`
com a saida validando contra o schema REAL do contrato de autoria (ver
`tests/prompts/prompts.test.ts`).

## Contrato de autoria v1 (schema real de F4-01)

- Estrutura da saida: `src/autoria/contrato/schema/autoria.schema.json`
  (Autoria.1, draft 2020-12, `additionalProperties:false` em todo
  objeto — narrativa pura, sem frame/layout/cor; AB-575).
- **AB-432** — `hash` de no de midia e ADVISORY: a autoria pode omitir
  (a resolucao preenche); omissao nao e erro.
- **AB-433** — `texto_alternativo` OBRIGATORIO em no de midia:
  ausencia e erro.
- Fronteira de decisao: o LLM decide narrativa, ritmo (em segundos,
  materializado na extensao do texto), nos e texto; o sistema decide
  frame exato, layout, cor e duracao resolvida — a conversao de ritmo
  para frames e do estagio de timing. Campos de decisao do sistema nao
  existem no schema.

A migracao para o schema real foi executada no PREP-w6 (item AB-570 do
ledger): os casos de referencia e os prompts apontam para o Autoria.1.

## Criterios editoriais

Numeros com fonte (ou marcados como opiniao) em
`docs/adr/0024-*.md`: ritmo de locucao 125-145 wpm pt-BR, densidade de
corte 4-9 s por cena, tempo minimo de leitura `max(0,833 s;
caracteres/20)` com meta de 13 cps para texto denso.

## Como adicionar um prompt

1. Crie `prompt-<slug>.md` comecando com `versao:` e com a secao
   `## Fronteira de decisao` declarando o que o modelo NAO decide.
2. Crie `casos/<slug>/` com a entrada e a saida de referencia (a saida
   valida contra o contrato v1).
3. Rode `just prompts-testar` — o teste descobre o prompt, exige o
   caso de referencia e valida a saida.
