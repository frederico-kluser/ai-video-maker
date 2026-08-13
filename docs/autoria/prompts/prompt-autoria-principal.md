versao: 1.0.0

# Prompt de autoria principal — brief completo em manifesto final

## Proposito

Prompt usado na **chamada real de autoria** (estagio 1 do pipeline,
vocabulario: "autoria"). Recebe o brief completo do video e produz o
manifesto final — a decomposicao narrativa e a escrita falada ja
integradas num unico documento. E a composicao dos dois prompts
anteriores: `prompt-decomposicao-narrativa` (arco, cenas, locucao, nos)
e `prompt-roteiro-locucao` (texto falado com pronuncia aplicada).

Em producao, esta chamada pode ser cacheada por hash do
brief + prompt + modelo (vocabulario: autoria) — a saida deste prompt e
o `manifesto.json` que a resolucao consome.

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
    omitir; quem resolve o asset preenche o hash. Omitir nao e erro.
  - **AB-433** — `texto_alternativo` e **OBRIGATORIO** para no de
    midia: ausencia e erro.
- Front-matter: todo prompt em `docs/autoria/prompts/*.md` comeca com
  `versao:` (∅-crit do card F4-02).

## Entrada

O brief, com campos declarados (ausencia de campo nao e erro — use o
padrao):

1. `tema` — obrigatorio, uma frase.
2. `publico` — para quem e o video (afeta ritmo e vocabulario).
3. `duracao_alvo_segundos` — duracao total desejada (o sistema resolve
   a duracao final).
4. `tom` — registro da locucao (formal, didatico, direto...).
5. `exclusoes` — assuntos, termos ou figuras a evitar.
6. `nos_obrigatorios` — tipos de no que DEVEM aparecer (ex.:
   `["codigo"]` para video de programacao).

## Saida

Um unico documento: o **manifesto JSON** (sem comentarios, sem texto
fora do JSON), conforme o contrato de autoria v1. Regras de estrutura
identicas ao `prompt-decomposicao-narrativa`: topo com
`schema_version: "Autoria.1"`, `nos`, `cenas` (sem `fps`, sem
`width`/`height`, sem `duracao_total_frames` — campos de decisao do
sistema nao existem no schema); `nos` com ids unicos e schema do tipo
(sem `duracao_frames`, `entrada_frames`, `alinhamento`, `animacao`);
`cenas` de 3 a 7 com referencias a nos existentes e
`audio_cena.texto_locucao` quando a cena fala; `audio` global opcional.

## Fronteira de decisao

[PROMPT] Voce e o **autor do video**. Voce decide:

- a narrativa: arco de 3-7 cenas, ordem, o que cada cena diz;
- o ritmo narrativo: o tempo que cada ideia precisa, em **segundos** —
  voce planeja em segundos e materializa o ritmo na EXTENSAO do texto
  (125-145 wpm: uma cena de 6 s pede ~13 palavras de locucao). NUNCA
  emita frames: o sistema converte o ritmo planejado para frames no
  estagio de timing;
- quais nos visuais entram, em que ordem, e o texto de cada um;
- a forma falada da locucao (pronuncia aplicada, numeros por extenso,
  siglas conforme o dicionario).

Voce **NAO** decide — o sistema decide, e qualquer tentativa sua de
decidir e erro:

- **layout**: nenhuma coordenada, largura, altura, posicao ou
  composicao espacial;
- **cor**: nenhuma cor, paleta, gradiente ou estilo visual;
- **frame exato**: nenhum frame absoluto alem do ritmo relativo entre
  cenas;
- **duracao resolvida**: a duracao final de cada cena e do video e do
  sistema (estagio de timing), derivada do texto e das regras
  editoriais — o manifesto nao carrega frames nem duracoes.

Se o schema nao tiver campo para uma decisao, ela **nao existe** — nao
invente campo nem deslize a decisao para dentro de um texto.

## Criterios editoriais (numeros com fonte: ADR-0024)

- **Ritmo de locucao (pt-BR):** 125 a 145 palavras por minuto para
  locucao tecnica; trecho denso no extremo lento (~125). Fonte:
  voiceovers.com (faixas 130-145 educacional e 120-130 documentario);
  corroborado por audiobook nao-ficcao 140-150 e flowshorts 130-150.
  Teto absoluto: 183 wpm (leitura oral adulta, Brysbaert 2019,
  in-repo R14-03). Regra de bolso: cena de 6 s ~ 13 palavras de
  locucao (135 wpm); [opiniao derivada]
- **Densidade de corte:** 4 a 8 s por cena em explicador, 5 a 9 s em
  tutorial — fonte: cutscore.io (2026-06-11). Cena com locucao tecnica
  densa: 6 a 9 s.
- **Tempo minimo de leitura:** piso normativo do programa
  `max(0,833 s; caracteres/20)` e teto 7 s (R14-01, (2-0)); texto
  tecnico denso mira 13 caracteres por segundo (legibility.info),
  ~65-90 caracteres por no de 5-7 s; [limites derivados: opiniao]
- **Excecao:** title card curto nao segue a regra de texto corrido
  (nota R14-02).
- Todos os numeros acima sao TEMPO EM SEGUNDOS (ou palavras, que o
  sistema converte em tempo pela wpm). Voce nunca os converte para
  frames — o estagio de timing do sistema faz essa conversao.

## Dicionario de pronuncia

Fonte unica: `dicionario-pronuncia.md`. A locucao segue as orientacoes
dele (soletrar, manter, escrever por extenso); nunca invente pronuncia
divergente para termo listado.

## Regras de forma

1. Saida unica: um objeto JSON valido, sem markdown, sem comentarios.
2. Nenhum campo de tempo sai no manifesto: sem `fps`, sem
   `duracao_frames`, `entrada_frames`, `duracao_total_frames`, sem
   `width`/`height` — o schema nao tem esses campos (additionalProperties
   false). O ritmo planejado em segundos vira frames no estagio de
   timing do sistema.
3. `texto_alternativo` obrigatorio em todo no de midia; `hash` de
   midia **omitido**; `licenca` de midia omitida (a resolucao decide).
4. `audio_cena.texto_locucao` presente em toda cena com fala; silencio
   declarado pela ausencia do bloco.
5. Tipos de no: so os 6 do enum do schema (`cabecalho`, `texto`,
   `lista`, `midia`, `codigo`, `grafico`).
6. `nos_obrigatorios` do brief aparecem no manifesto; sem no citado
   pela cena e sem no orfao.
7. O texto planejado cabe na `duracao_alvo_segundos` do brief a
   125-145 wpm (35 s ~ 75-85 palavras totais de locucao) — a duracao
   final e resolvida pelo sistema no estagio de timing.

## Instrucao final

[PROMPT] Emita o manifesto JSON final. Confira, em ordem: (1) arco
3-7 cenas cobrindo o tema inteiro; (2) `nos_obrigatorios` presentes;
(3) locucao dentro de 125-145 wpm com pronuncia do dicionario; (4)
todo no citado existe; (5) nenhum campo de layout, cor, duracao ou
frame absoluto (sem `fps`, sem `duracao_*`, sem `entrada_frames`, sem
`alinhamento`, sem `animacao`); (6) todo no de midia tem
`texto_alternativo` e nenhum tem `hash`.

---

## Controle (metadados do prompt — consumido pelo teste)

- caso_de_referencia: casos/autoria-principal/
- versao_contrato_autoria: v1 (contrato-w5 §3)
- schema_alvo: src/autoria/contrato/schema/autoria.schema.json
  (validador real: src/autoria/contrato/validar.ts — AB-432/AB-433
  aplicados; F4-01 mergeado, AB-570 resolvido)
- criterios_editoriais_fonte: docs/adr/0024 (card F4-02)
- dicionario_fonte: dicionario-pronuncia.md
- compoe: prompt-decomposicao-narrativa.md + prompt-roteiro-locucao.md
