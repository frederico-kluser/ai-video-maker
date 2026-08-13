# ADR-0023 — Contrato de autoria v1: saída estruturada, cache e os limites do modo estrito por fornecedor

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F4-01
- **Depende de:** ADR-0001 (todo card tem oraculo), F0-02, F2-01, AB-432
  (hash de midia ADVISORY), AB-433 (texto_alternativo obrigatorio)
- **Porta TCP:** 4401 (docs/contrato-w5.md §9)
- **Faixa de ledger:** AB-550..AB-569 (ledger/inbox/F4-01.json)

## Contexto

O estagio de AUTORIA e o unico em que um LLM decide. A divisao de trabalho
e fixa: **o LLM decide narrativa** (quais nos, em que ordem, o texto, o
vocabulario fechado); **o sistema decide frame exato, layout, cor e duracao
resolvida**. A pergunta deste card e como o contrato torna essa divisao
executavel: um schema que torne as decisoes do sistema IMPOSSIVEIS de
emitir, um cache que seja a garantia de reprodutibilidade, e um gate que
rejeite saida invalida antes do pipeline.

Dois pontos ja decididos no ledger, irredutveis por este card
(docs/contrato-w5.md §3):

- **AB-432** — hash de midia e ADVISORY: a autoria pode omitir o hash; o
  schema nao pode reprovar a ausencia.
- **AB-433** — `texto_alternativo` OBRIGATORIO para no de midia: ausencia
  e erro, nao aviso.

O schema `manifesto.schema.json` (S-4) e congelado e nao pode servir de
schema de autoria: ele EXIGE `duracao_frames` em todo no (decisao do
sistema) e `hash` no no de midia (AB-432 violado), e trata
`texto_alternativo` como opcional (AB-433 violado). A v1 define portanto um
documento proprio — o **Documento de Autoria v1** (`Autoria.1`) — do qual o
manifesto completo e derivado a jusante (fronteira de resolucao + W6).

## Pergunta de pesquisa do card (F4-01 no PROGRAMA)

> Por fornecedor: quais chaves o modo estrito aceita e recusa, e quais os
> limites de profundidade, numero de propriedades e de enums? — a doc do
> fornecedor e a da plataforma gerenciada dao numeros diferentes para os
> mesmos limites.

Verificada em **2026-08-13** por fetch direto das fontes primarias (busca
3-tier via deep-orchestrator + leitura das docs):

### Anthropic (`output_config.format`, modo estrito) — chaves

| Chave | Aceita | Fonte |
|---|---|---|
| tipos basicos (object/array/string/integer/number/boolean/null) | sim | doc primaria |
| `enum` (so escalares — string, number, bool, null) | sim | doc primaria |
| `const` | sim | doc primaria |
| `anyOf` | sim | doc primaria |
| `allOf` | sim, EXCETO combinado com `$ref` | doc primaria |
| `$ref`/`$defs`/`definitions` (internos) | sim | doc primaria |
| `default` | sim | doc primaria |
| `required` + `additionalProperties:false` | sim (false exigido em objeto) | doc primaria |
| formatos de string (date-time, duration, uri, uuid, ...) | sim | doc primaria |
| `minItems` de array | so 0 ou 1 | doc primaria |
| recursao | **nao** | doc primaria |
| tipos complexos dentro de enum | **nao** | doc primaria |
| `$ref` externo | **nao** | doc primaria |
| constraints numericas (`minimum`/`maximum`/`multipleOf`) | **nao** | doc primaria |
| constraints de string (`minLength`/`maxLength`) | **nao** | doc primaria |
| constraints de array alem de minItems 0|1 (`maxItems`, `uniqueItems`, ...) | **nao** | doc primaria |
| `additionalProperties` != false | **nao** | doc primaria |
| `oneOf` | nao documentado — ausente por desenho | — |
| `pattern` | disputa (1-0, nao citado pelas duas docs primarias) — ausente por desenho | ADR-0023, skill llm-authoring |

**Placar (2-0, convencao A)** — plataforma.claude.com (structured-outputs) e
docs.aws.amazon.com/bedrock (structured-output), lidas hoje.

### Anthropic — limites numericos

- **Nenhum limite numerico documentado** de profundidade, propriedades ou
  enums na doc do provedor — **placar (2-0)**: fetch direto (a pagina nao
  publica numeros) + dottxt providers-comparison lista "None documented"
  para a Anthropic (contrastando com os 10 niveis da OpenAI).
- Alerta de terceiro (Instructor course): schemas com recursao alem de **5
  niveis "silenciosamente degradam para menos campos sem erro"** — **placar
  (1-0)**, fonte unica, nao verificado na API real (AB-552).
- Limites por request reportados na doc (20 strict tools, 24 parametros
  opcionais, 16 parametros de union) — **reportado via resumo de busca; o
  fetch direto truncou antes da tabela; NAO confirmado** (AB-552).
- Plataforma gerenciada (Bedrock): compilacao de gramatica na primeira
  chamada pode levar **minutos**, e o cache da gramatica dura **24 h desde o
  PRIMEIRO acesso** (literal na doc AWS) — isto resolve a divergencia da
  skill llm-authoring ("desde o ultimo uso" × "desde o primeiro acesso") a
  favor do primeiro acesso na plataforma gerenciada — **placar (1-0)**.

### OpenAI (strict, `response_format` json_schema) — chaves

| Chave | Aceita | Fonte |
|---|---|---|
| tipos basicos + `enum` + `anyOf` | sim | doc primaria |
| `$defs`/`$ref` (definitions suportadas) | sim | doc primaria |
| **recursao** | **sim** (o inverso exato da Anthropic) | doc primaria |
| `pattern`, `format` (lista fechada), `multipleOf`/`maximum`/`exclusiveMaximum`/`minimum`/`exclusiveMinimum`, `minItems`/`maxItems` | sim | doc primaria |
| uniao com null para opcional | sim (opcional = `["string","null"]`) | doc primaria |
| `allOf`, `not`, `dependentRequired`, `dependentSchemas`, `if`, `then`, `else` | **nao** (400) | doc primaria |
| raiz `anyOf` | **nao** (raiz tem de ser objeto) | doc primaria |
| `additionalProperties` != false | **nao** (false exigido em todo objeto) | doc primaria |
| campo fora de `required` | **nao** (todas as propriedades exigidas) | doc primaria |
| `oneOf`, `default` | nao documentados — ausentes por desenho | — |

**Placar (2-0, convencao A)** — developers.openai.com/api/docs/guides/
structured-outputs (lida hoje) + o mesmo guia citado pela plataforma
gerenciada (Azure) e por integradores.

### OpenAI — limites numericos: a divergencia que a pergunta do card nomeava

- **Doc ATUAL (2026):** ate **5000 propriedades de objeto no total, ate 10
  niveis de aninhamento, ate 1000 valores de enum** no total, soma dos
  nomes/defs/enums/consts <= 120.000 caracteres, soma dos enums <= 15.000
  caracteres quando ha > 250 — **placar (1-0, convencao A)**: numeros
  literais lidos hoje na doc primaria.
- **Docs de 2024 e integradores:** "ate **100 propriedades de objeto no
  total, com ate 5 niveis de aninhamento**" — corroborado por mensagens de
  erro reais da API ("103 parameters exceeds limit of 100"; "6 levels of
  nesting exceeds limit of 5") e por guias de terceiros (Jsonic: 100 props /
  5 niveis / 500 enums; Twilio SDK: 100 props / 10 niveis / 1000 enums —
  mistura das duas eras) — **placar (2-0)** para a existencia dos numeros
  antigos como limite vigente em 2024.
- **Conclusao de desenho:** projetar para a **INTERSECAO** (<= 5 niveis,
  poucas dezenas de propriedades) mantem o schema aceito pelas duas eras de
  doc, pelos integradores e pelo desenho da plataforma gerenciada; o teto
  real da API atual (10/5000/1000) so sera confirmado contra a conta real no
  dia do acesso (AB-551). O schema v1 usa <= 5 niveis por construcao.

## Decisoes

### 1. O Documento de Autoria v1 — narrativa apenas, decisao do sistema impossivel

`src/autoria/contrato/schema/autoria.schema.json` (completo, draft
2020-12) define `Autoria.1`: nos, cenas, vocabulario fechado — e NENHUM
campo de frame, cor, coordenada, layout ou resolucao. Em todo objeto,
`additionalProperties:false`: a emissao de `duracao_frames`, `cor`, `x/y`
etc. nao e desencorajada, e **impossivel pelo schema** (pergunta adversarial
1, testada com fixture que tenta). AB-432 (hash ausente = valido) e AB-433
(texto_alternativo ausente = invalido) sao regras do proprio schema,
testadas por nome de item (ab-432-ab-433.test.ts).

### 2. Dois schemas: o que viaja na chamada e o que valida a resposta

O subset estrito amputa constraints; a validacao precisa delas. A v1
mantem o padrao: **schema completo** (invariantes de negocio: teto de nos
40, itens de lista 12, dados 30, `minLength:1` em texto) contra o qual a
resposta e validada, e **schema podado por fornecedor** que viaja na
chamada — `autoria.llm.anthropic.json` e `autoria.llm.openai.json`, dois
arquivos, nunca um compartilhado (os subsets sao parcialmente opostos:
recursao/allOf/required). O podado OpenAI e mais estrito no FORMULARIO
(todas as chaves em `required`, opcional = null) e carrega as constraints
que a OpenAI aceita; o podado Anthropic e um relaxamento verdadeiro (sem
maxItems/minLength, minItems so 0|1). Teste por fornecedor em
subset.test.ts: chaves recusadas ausentes, `required` completo no OpenAI,
`additionalProperties:false` em todo objeto, `$ref` interno, e o circulo
completo: materializada (null) valida no podado OpenAI; desmaterializada
valida no completo.

### 3. Vocabulario de transicao gerado do pacote INSTALADO, nunca da doc

O enum de `Transicao` e congelado como a intersecao do enum do S-4 com os
exports do pacote instalado `@remotion/transitions` (4.0.507):
`fade, slide, wipe, flip, none`. Exclusoes com motivo: `cube` (tem pagina
na doc, NAO existe no pacote — pacote separado e pago) e `clockWipe` (o
pacote exporta `clock-wipe`, kebab — mapeamento de nomes e decisao de ponte,
AB-555). Teste de PRESENCA (contrato-w5 §10): cada valor do vocabulario
existe no exports instalado; `cube` nao esta no vocabulario.

### 4. O CACHE e a garantia de reprodutibilidade — temperatura zero nao e

Nenhum fornecedor garante saida identica, nem com `temperature: 0.0`
(doc da Anthropic literal; `seed` da OpenAI e "best effort"). A unica
reprodutibilidade real e cache de saida por hash da entrada
canonicalizada (skill llm-authoring):

`sha256(canonical_json({model, system, tools, messages, output_config,
schema_version}))` -> `.cache/manifests/<hash>.json`

- Canonicalizacao com chaves ordenadas recursivamente (canonicalizar.ts);
  ordem de array preservada (muda o conteudo).
- `output_config` carrega o schema podado — trocar de fornecedor muda a
  chave. `tentativa` entra na chave: o retry com simplificacao progressiva
  MUTA o prompt, e a saida depende de quantas vezes falhou.
- **Temperatura e deliberadamente FORA da chave**: o cache e o contrato de
  reproducao; parametros de amostragem nao fazem parte dele. Teste C12
  (cache.test.ts): muda UM componente por vez e exige MISS — model,
  system, tools, messages, output_config, schema_version, tentativa.
- Escrita atomica (tmp + rename); cache corrompido = MISS, nunca erro.
- O cliente do provedor entra por injecao (gerador): o contrato nao
  conhece fornecedor (a chamada real e do F4-02/F4-04).

### 5. Validacao e gate, antes do pipeline (∅-crit)

`rejeitarSaidaInvalida()` valida contra o schema completo e LANCA
`ErroContratoAutoria` com o caminho JSON dos campos que falharam — a saida
invalida nunca toca o pipeline (rejeitar.test.ts prova com stub de pipeline
que registra invocacao). Ordem: gerar -> validar -> rejeitar -> so entao
pipeline.

## Consequencias

- **A saida da autoria v1 NAO e um manifesto S-4 valido** (S-4 exige
  `duracao_frames` e `hash`; a v1 proibe/exime). A ponte autoria -> manifesto
  completo (frames, layout, cor, hash, licenca) e da fronteira de resolucao
  e da W6 — aberto como AB-550, com destinatario nomeado.
- F4-02 (W5, prompts) escreve os prompts contra este schema; F4-03/F4-04
  (W6) validam, reparam e cassetam contra o schema completo.
- Resposta a pergunta adversarial 3: **o custo por video NAO e medido** —
  nao existe modelo de custo no programa (faltam AB-002, AB-023, AB-073);
  os multiplicadores do prompt cache (1,25x/2x/0,1x) sao estimativa (1-0).
  O que se mede hoje e por sessao (`usage.input_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens`) — AB-553.
- O schema v1 nao usa `pattern`, `oneOf` nem `default` no caminho OpenAI:
  sao as chaves de suporte nao confirmado nas duas docs primarias.
- `schema/manifesto*.json` (S-4) e `src/design/tokens.ts` (S-1) nao foram
  tocados; nenhum literal de token novo foi criado.

## Alternativas descartadas

1. **Usar o manifesto S-4 como schema de autoria** — impossivel por
   construcao: exige duracao_frames (decisao do sistema), exige hash
   (AB-432) e nao exige texto_alternativo (AB-433); alem disso S-4 e
   singleton congelado.
2. **Schema unico compartilhado entre fornecedores** — os subsets sao
   parcialmente opostos (recursao, allOf, required-total): um schema unico
   seria 400 num dos dois ou gratuitamente pobre no outro.
3. **Temperatura zero como configuracao de reprodutibilidade** — as duas
   docs negam; duas amostras iguais sao coincidencia estatistica. O cache
   e a garantia, e so ele.
4. **Validar a resposta contra o schema podado** — o podado nao carrega as
   invariantes de negocio (na Anthropic nem pode carrega-las); o oraculo de
   rejeicao e o schema completo, sempre.
