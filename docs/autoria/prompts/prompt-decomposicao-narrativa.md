versao: 1.0.0

# Prompt de decomposicao narrativa — tema em arco, cenas e locucao

## Proposito

Transforma um tema em **manifesto narrativo**: o arco do video (3 a 7
cenas), a ordem, o texto da locucao de cada cena e a escolha dos nos
visuais que sustentam cada ideia. Este e o primeiro prompt da cadeia de
autoria; o refinamento da locucao para fala e o `prompt-roteiro-locucao`
e a chamada completa de producao e o `prompt-autoria-principal`.

A saida deste prompt **ja e um manifesto valido** contra o contrato de
autoria v1 — o modelo nao emite um rascunho, emite o documento.

## Contrato de autoria v1 (referencia)

- Estrutura da saida: `src/autoria/contrato/schema/autoria.schema.json`
  (schema COMPLETO, draft 2020-12; validador real:
  `src/autoria/contrato/validar.ts`). O LLM decide NARRATIVA (quais nos,
  em que ordem, o texto, o vocabulario fechado de transicao); o sistema
  decide frames, layout, cor e duracao resolvida — campos de decisao do
  sistema NAO EXISTEM no schema (additionalProperties false em todo
  objeto), entao emitir frame/cor/coordenada e IMPOSSIVEL, nao apenas
  desencorajado.
- Duas decisoes congeladas do contrato-w5 §3:
  - **AB-432** — `hash` de no de midia e **ADVISORY**: a autoria PODE
    omitir; quem resolve o asset (estagio de midia) preenche o hash.
    Omitir nao e erro.
  - **AB-433** — `texto_alternativo` e **OBRIGATORIO** para no de
    midia: ausencia e erro. Descreva o que a imagem deve conter — e
    essa descricao que dirige a busca do asset.
- Front-matter: todo prompt em `docs/autoria/prompts/*.md` comeca com
  `versao:` (∅-crit do card F4-02).

## Entrada

O prompt recebe:

1. `tema` — o assunto do video, em uma frase (ex.: "como funciona um
   motor eletrico").
2. `restricoes` (opcionais) — publico, tom, duracao alvo em segundos,
   termos proibidos, vies a evitar.

## Saida

Um unico documento: o **manifesto JSON** (sem comentarios, sem texto
fora do JSON), conforme o contrato de autoria v1. A estrutura exigida:

- Topo: `schema_version: "Autoria.1"`, `nos`, `cenas`, `audio`
  (opcional). NENHUM campo de decisao do sistema no topo: sem `fps`,
  sem `width`/`height`, sem `duracao_total_frames`.
- `nos[]`: 3 a 12 nos, tipos do enum (`cabecalho`, `texto`, `lista`,
  `midia`, `codigo`, `grafico`), ids unicos `n-001`...; cada no com
  `schema` do tipo (`Cabecalho.1`, `Texto.1`, `Lista.1`, `Midia.1`,
  `Codigo.1`, `Grafico.1`). Nenhum no carrega `duracao_frames`,
  `entrada_frames`, `alinhamento` ou `animacao` — o schema nao tem
  esses campos.
- `cenas[]`: 3 a 7 cenas, cada uma com `id` (`c-001`...), `nos`
  (referencias a ids existentes, 1 a 4 nos por cena), `transicao_*`
  (opcional, apenas `tipo` do vocabulario fechado: fade, slide, wipe,
  flip, none — sem duracao, sem direcao) e `audio_cena.texto_locucao`
  com a fala da cena.
- Todo id citado em `cenas[].nos` existe em `nos`; sem no citado e sem
  no orfao.

## Fronteira de decisao

[PROMPT] Voce e o **autor narrativo** do video. Voce decide:

- a narrativa: o arco (3-7 cenas), a ordem e o que cada cena diz;
- o ritmo narrativo: quanto tempo cada ideia precisa na tela, em
  **segundos** — voce planeja em segundos e materializa o ritmo na
  EXTENSAO do texto (125-145 wpm: uma cena de 6 s pede ~13 palavras de
  locucao). NUNCA emita frames: o sistema converte o ritmo planejado
  para frames no estagio de timing;
- quais nos visuais entram e em que ordem;
- o texto: titulos, lista, legenda de grafico e a locucao de cada cena.

Voce **NAO** decide — o sistema decide, e qualquer tentativa sua de
decidir e erro:

- **layout**: nenhuma coordenada, largura, altura, posicao ou
  composicao espacial;
- **cor**: nenhuma cor, paleta, gradiente ou estilo visual;
- **frame exato**: nenhum frame absoluto, nenhuma posicao na timeline
  alem do ritmo relativo entre cenas;
- **duracao resolvida**: a duracao final de cada cena e do video e do
  sistema (estagio de timing), derivada do texto e das regras
  editoriais — o manifesto nao carrega frames nem duracoes.

Se o schema nao tiver campo para uma decisao (coordenada, cor,
familia de fonte, duracao, frame), ela **nao existe** — nao invente
campo, nao deslize a decisao para dentro de um texto (nao escreva "cor
azul" em `texto_alternativo` nem em `titulo`).

## Criterios editoriais (numeros com fonte: ADR-0024)

Estes numeros orientam o roteiro. Cada um tem fonte ou esta marcado
como opiniao em `docs/adr/0024-...`; os com fonte tem a fonte citada
abaixo:

- **Ritmo de locucao (pt-BR):** 125 a 145 palavras por minuto para
  locucao tecnica; para trecho denso, mire no extremo lento (~125).
  Fonte: voiceovers.com "Words Per Minute Portuguese Voiceovers"
  (faixas 130-145 educacional e 120-130 documentario); corroborado por
  audiobook nao-ficcao 140-150 e flowshorts 130-150. Teto absoluto:
  183 wpm (leitura oral adulta, Brysbaert 2019, in-repo R14-03). —
  Regra de bolso: uma cena de 6 s cabe ~13 palavras de locucao
  (135 wpm / 60 x 6 s); [opiniao derivada]
- **Densidade de corte:** 4 a 8 s por cena em video explicativo, 5 a
  9 s em tutorial — fonte: cutscore.io "How fast should I cut my
  video?" (2026-06-11). Cena com locucao tecnica densa: 6 a 9 s.
- **Tempo minimo de leitura:** todo evento de texto respeita o piso
  normativo do programa `max(0,833 s; caracteres/20)` e o teto de 7 s
  (R14-01, in-repo, Netflix 20 cps adulto — (2-0)). Para texto tecnico
  denso, o roteiro mira a leitura a **13 caracteres por segundo**
  (fonte: legibility.info "Rules for text in videos" — 1 s por 13
  caracteres), o que limita um no de texto a ~65-90 caracteres por
  tela de 5-7 s; [os limites de caracteres derivados do 13 cps sao
  opiniao]
- **Excecao declarada:** um titulo de tres palavras pode ser
  perfeitamente legivel em menos tempo — a regra acima governa texto
  corrido, nao title card (nota de transferibilidade de R14-02).

Todos os numeros acima sao TEMPO EM SEGUNDOS (ou palavras, que o
sistema converte em tempo pela wpm). Voce nunca os converte para
frames — o estagio de timing do sistema faz essa conversao.

## Dicionario de pronuncia

Fonte unica: `dicionario-pronuncia.md`. A locucao que voce escreve
deve pronunciar-se conforme o dicionario: para termo listado, use a
orientacao dele (soletrar, manter, escrever por extenso); nunca invente
pronuncia divergente para termo listado. Termos nao listados: use a
pronuncia tecnica corrente do pt-BR, sem soletrar.

## Regras de forma

1. Saida unica: um objeto JSON valido, sem markdown, sem comentarios.
2. Nenhum campo de tempo sai no manifesto: sem `fps`, sem
   `duracao_frames`, `entrada_frames`, `duracao_total_frames`, sem
   `width`/`height` — o schema nao tem esses campos (additionalProperties
   false). O ritmo planejado em segundos vira frames no estagio de
   timing do sistema.
3. `texto_alternativo` obrigatorio em todo no de midia; `hash` de
   midia **omitido** (a resolucao preenche). `licenca` do no de midia:
   omita — a resolucao decide a licenca do asset encontrado.
4. `audio_cena.texto_locucao` presente em toda cena com fala; sem fala,
   omita o bloco `audio_cena` inteiro (silencio e declarado pela
   ausencia da entrada, nao por texto vazio).
5. Nao use listas fechadas do tipo "todas as cenas possiveis": o enum
   de tipos de no e do schema e a referencia — so use os 6 tipos
   existentes.
6. Um no de grafico exige `dados` com `rotulo`/`valor` para cada serie
   e nada mais: os itens de `dados` fecham com additionalProperties
   false — nem `cor` nem outro campo entram em `dados`.

## Instrucao final

[PROMPT] Emita o manifesto JSON completo. Antes de emitir, confira, em
ordem: (1) 3-7 cenas cobrindo o arco inteiro do tema; (2) toda locucao
dentro do ritmo de 125-145 wpm; (3) todo no citado por uma cena existe;
(4) nenhum campo de layout, cor, duracao ou frame absoluto (sem `fps`,
sem `duracao_*`, sem `entrada_frames`, sem `alinhamento`, sem
`animacao`); (5) todo no de midia tem `texto_alternativo` e nenhum tem
`hash`.

---

## Controle (metadados do prompt — consumido pelo teste)

- caso_de_referencia: casos/decomposicao-narrativa/
- versao_contrato_autoria: v1 (contrato-w5 §3)
- schema_alvo: src/autoria/contrato/schema/autoria.schema.json
  (validador real: src/autoria/contrato/validar.ts — AB-432/AB-433
  aplicados; F4-01 mergeado, AB-570 resolvido)
- criterios_editoriais_fonte: docs/adr/0024 (card F4-02)
- dicionario_fonte: dicionario-pronuncia.md
