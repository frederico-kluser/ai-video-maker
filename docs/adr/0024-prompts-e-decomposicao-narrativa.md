# ADR-0024 — Biblioteca de prompts, decomposicao narrativa e os numeros editoriais com fonte

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F4-02
- **Depende de:** F0-01 (vocabulario), F0-02 (schema do manifesto), F4-01
  (contrato de autoria v1, W5 — decisao congelada em contrato-w5 §3),
  R14-01/R14-03 (normas de legenda e leitura, in-repo)

## Contexto

A autoria e o estagio em que o LLM transforma um tema em `manifesto.json`.
Dois vazios se abrem antes do primeiro prompt existir:

1. **Nenhum prompt existia.** O que o modelo decide e o que o sistema
   decide nao estava escrito em lugar nenhum; o dicionario de pronuncia
   que a locucao (F2-03) consome era so um contrato em prosa na skill
   tts-voiceover ("arquivo de fonte unica, produzido pela autoria").
2. **Nenhum numero editorial tinha fonte.** A pergunta de pesquisa do
   proprio card: "palavras por minuto para locucao tecnica em pt-BR,
   densidade de corte, tempo minimo de leitura" — o card exige "numeros
   com fonte, ou opiniao" na propria refutacao, e nao havia fonte para
   nenhum.

O modo de falha que este card persegue: um prompt que peca ao modelo que
**decida o que o sistema decide** (layout, cor, frame exato, duracao
resolvida) — decisao plausivel, nao falsificavel, e cara depois: o
compositor nao pode conferir uma coordenada, mas pode conferir um enum.

## Decisao

### 1. Fronteira de decisao: o LLM decide narrativa; o sistema decide frames, layout, cor e duracao

O LLM decide **narrativa, ritmo, quais nos entram, em que ordem e o
texto** (locucao inclusive). O sistema decide **frame exato, layout, cor
e duracao resolvida**. Todo prompt da biblioteca declara a secao
`## Fronteira de decisao` com as quatro decisoes do sistema nomeadas —
o teste exige a secao e os quatro termos, e o validador do contrato
reprova qualquer campo inventado (o schema nao tem campo de layout/cor;
uma coordenada emitida pelo modelo e erro de contrato, nao gosto).

Consequencia operacional: `duracao_frames` do manifesto e **pedido de
ritmo**, nao ordem — o estagio de timing (F3-01) resolve a duracao
final. O prompt converte segundos em frames no fps declarado apenas
para produzir manifesto valido contra o schema v1.

### 2. A biblioteca: quatro arquivos, casos de referencia por prompt

`docs/autoria/prompts/`:

| Arquivo | Papel |
|---|---|
| `prompt-decomposicao-narrativa.md` | tema em arco: cenas, ordem, locucao, nos |
| `prompt-roteiro-locucao.md` | texto falado com pronuncia aplicada (TTS) |
| `prompt-autoria-principal.md` | brief completo em manifesto final (chamada real) |
| `dicionario-pronuncia.md` | fonte unica de pronuncia pt-BR de termos tecnicos |
| `indice.md` | indice da biblioteca (nao e prompt) |

Todo `.md` comeca com a linha `versao:` — base do ∅-crit do card, na
forma corrigida da armadilha 9.2 (`rg --files-without-match`, nunca
`rg -L`, que em ripgrep e `--follow`). Todo `prompt-*.md` tem caso de
referencia em `casos/<slug>/` cuja saida valida contra o contrato de
autoria v1 (contrato-w5 §3; ver decisao 4).

### 3. Numeros editoriais: com fonte, ou marcados como opiniao

Cada numero usado pelos prompts tem fonte abaixo, com data e placar
(fontes independentes contadas nesta pesquisa). Numero sem fonte nao
entra nos prompts; os derivados aritmeticos sao marcados **opiniao**.

| Numero | Valor | Fonte | Data | Placar |
|---|---|---|---|---|
| Locucao pt (voiceover, geral) | 125-150 wpm | voiceovers.com (blog) | nao visivel | (1-0) |
| Locucao pt (educacional) | 130-145 wpm | idem | nao visivel | (1-0) |
| Locucao pt (documentario) | 120-130 wpm | idem | nao visivel | (1-0) |
| Audiobook nao-ficcao | 140-150 wpm | wordstotime.netlify.app | nao visivel | (1-0) |
| Fala conversacional pt | 181 wpm | voices.com | 2024-11-06 | (1-0) |
| Leitura oral adulta (teto) | 183 wpm | Brysbaert 2019 (in-repo R14-03) | 2019 | (2-0) |
| Densidade: explicador/talking head | 4-8 s por corte | cutscore.io | 2026-06-11 | (1-0) |
| Densidade: tutorial/how-to | 5-9 s por corte | cutscore.io | 2026-06-11 | (1-0) |
| Densidade: short-form | 1-2 s por corte | cutscore.io | 2026-06-11 | (1-0) |
| Piso de evento de texto | max(0,833 s; caracteres/20) | in-repo R14-01 (Netflix + DCMP) | 2024 | (2-0) |
| Teto de evento de texto | 7 s | in-repo R14-01 (Netflix) | 2024 | (2-0) |
| Dwell de texto estatico na tela | 1 s por 13 caracteres | legibility.info | nao visivel | (1-0) |
| Texto legivel 2x a 200 wpm | "leave it on screen long enough to be read at least 2 times" | ssw.com.au | nao visivel | (1-0) |
| Leitura de legenda por publico | 12-15 cps (SUBTLE) · 17 cps padrao, 15 jovem, 20 experiente (subtitling.net) | subtle-subtitlers.org.uk (PDF) · subtitling.net | 2023-01 · 2026-05-31 | (1-0) cada |

**Escolhas que os prompts carregam:**

- **Ritmo de locucao tecnica pt-BR: 125-145 wpm**, default 135 —
  faixa "educacional" da fonte primaria (voiceovers.com), corroborada
  pela banda de audiobook nao-ficcao (140-150) e pela geral (125-150);
  trecho denso no extremo lento. Teto absoluto 183 wpm (R14-03).
  Regra de bolso derivada (opiniao): cena de 6 s ~ 13 palavras de
  locucao a 135 wpm.
- **Densidade de corte: 4-9 s por cena** — 4-8 s explicador, 5-9 s
  tutorial; cena com locucao tecnica densa na banda alta (6-9 s).
- **Tempo minimo de leitura:** o piso normativo do programa
  `max(0,833 s; caracteres/20)` e o teto de 7 s (R14-01) governam
  evento de texto — ja eram lei; este ADR nao os reabre. Para texto
  tecnico denso, o roteiro mira **13 caracteres por segundo**
  (legibility.info), o que limita um no de texto a ~65-90 caracteres
  por tela de 5-7 s — estes limites derivados sao **opiniao**.
  Excecao declarada: title card curto (nota de transferibilidade
  R14-02).

Nota de qualidade: a fonte primaria de locucao pt (voiceovers.com) nao
expoe data de publicacao; as faixas dela estao marcadas com a data como
"nao visivel" e o placar (1-0) — corroboracao lateral existe (audiobook
e a banda geral), mas a verificacao de uma data de publicacao fica em
AB-571.

### 4. O contrato de autoria v1 e o teste

As saidas de referencia validam contra o contrato de autoria v1
**descrito** (contrato-w5 §3): estrutura de
`schema/manifesto.llm.schema.json` com **AB-432** (hash de midia
advisory — a saida de referencia demonstra no de midia sem hash) e
**AB-433** (`texto_alternativo` obrigatorio — toda saida tem, e o
validador reprova ausencia com a mensagem `AB-433`). O schema real de
autoria (F4-01, `src/autoria/contrato/**`) nao estava na base desta
worktree; o teste implementa o contrato descrito e migra para o schema
real no merge do F4-01 (AB-570).

### 5. Dicionario de pronuncia: fonte unica, sem duplicata

`dicionario-pronuncia.md` e a **fonte unica** dos termos tecnicos com
pronuncia nao-obvia: guarda termo e pronuncia pretendida em ortografia
pt-BR simples (o adaptador do provedor serializa — nunca SSML pronto).
Nenhum outro arquivo do repositorio define `| termo |` em tabela —
testado. Prompts referenciam o dicionario por caminho e nao duplicam a
tabela — testado. A frase-canario de R13
("O Kubernetes orquestra containers e o PostgreSQL usa async/await")
esta no arquivo. As pronuncias registradas sao **provisorias** ate a
audicao no provedor real de TTS (AB-573).

### 6. Receita e gate

`just prompts-testar` roda vitest sobre `tests/prompts/` e o ∅-crit do
front-matter na forma corrigida, com denominador (biblioteca vazia e
VERMELHO). A receita usa hifen — `prompts:testar` nao parseia no just
1.42 (armadilha 9.1).

## Consequencias

- **Nenhum codigo em src/ foi tocado** — o card e docs + testes; o
  schema F4-01 nao existia na base (AB-570).
- **O dicionario de pronuncia agora tem casa** — a locucao (F2-03) e a
  skill tts-voiceover apontam para `docs/autoria/prompts/
  dicionario-pronuncia.md` como a fonte unica que o contrato exigia.
- **F4-03 (W6) nao herdara um prompt de "reparo"** — `prompt-roteiro-
  locucao.md` declara explicitamente que nao conserta manifesto
  invalido; reparo e do F4-03.
- **A pergunta obrigatoria da W5 (§10)**: nenhuma assercao deste diff e
  sobre lista completa de cenas, nos, estagios ou prompts — o teste
  assere a presenca dos itens do proprio card (cada prompt, cada caso,
  cada termo do dicionario) e a ausencia de duplicata do dicionario
  como invariante de fonte unica.

## Guarda executavel

`just prompts-testar` fica VERMELHO se: (a) um `.md` da biblioteca
perder o `versao:` inicial; (b) um prompt perder o caso de referencia;
(c) uma saida de referencia deixar de validar contra o contrato v1
(AB-432/AB-433); (d) um prompt perder a secao `## Fronteira de decisao`
ou alguma das quatro decisoes do sistema; (e) o dicionario for
duplicado em outro arquivo, perder termo ou ganhar termo duplicado.

## Alternativas descartadas

1. **"Numeros sem fonte, com bom senso"** — o card exige numeros com
   fonte ou opiniao nomeada; bom senso sem marca e opiniao disfarcada
   de fato.
2. **Dicionario de pronuncia dentro do prompt principal** — a tabela
   duplicaria o arquivo-fonte e divergiria no primeiro ajuste; o teste
   de fonte unica fecharia a porta de qualquer jeito.
3. **Prompt de "revisao editorial" que devolve manifesto corrigido** —
   sobrepoe o reparo do F4-03 (W6); a fronteira negativa do card
   proibiu.
4. **Validar as saidas de referencia com ajv importado de node_modules**
   — ajv e dependencia transitiva (nao declarada no package.json,
   singleton S-5); o validador estrutural do teste nao depende de nada.
