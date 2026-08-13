versao: 1.1.0

# Prompt de roteiro de locucao — texto que a voz pronuncia certo

## Proposito

Segundo prompt da cadeia de autoria. Recebe um manifesto ja estruturado
(saida do `prompt-decomposicao-narrativa` ou de uma edicao humana) e
reescreve **apenas** o texto falado — `cenas[].audio_cena.texto_locucao`
— para que a voz do provedor de TTS pronuncie o que o autor pretende:
numeros por extenso, siglas conforme o dicionario, homografos
desambiguados, sem abreviacao e sem simbolo que o TTS leia errado.

A estrutura do documento (cenas, nos, transicoes) **nao muda** — e o
documento de autoria nao carrega frames nem duracoes: o ritmo em
segundos e decisao do autor narrativo e a conversao para frames e do
sistema (estagio de timing). Se algo na estrutura estiver errado, este
prompt **nao conserta** — a correcao de documento invalido e do card
F4-03 (validação e reparo, W6). Este prompt so reescreve o texto falado
de um documento que ja valida.

## Contrato de autoria v1 (referencia)

- A saida valida contra o mesmo contrato de autoria v1 da entrada: o
  **schema REAL de F4-01** (`src/autoria/contrato/schema/autoria.schema.json`,
  Autoria.1, draft 2020-12, `additionalProperties:false`) com **AB-432**
  (`hash` de midia advisory, pode ficar ausente) e **AB-433**
  (`texto_alternativo` obrigatorio em no de midia). O documento e
  narrativa pura — nao tem frame, layout nem cor (AB-575).
- Front-matter: todo prompt em `docs/autoria/prompts/*.md` comeca com
  `versao:` (∅-crit do card F4-02).

## Entrada

1. `documento` — um Documento de Autoria JSON valido contra o contrato v1.
2. `voz` (opcional) — identificador da voz/provedor de TTS; a pronuncia
   pretendida nao muda por voz, mas o adaptador pode.

## Saida

O mesmo Documento de Autoria JSON, com:

- `cenas[].audio_cena.texto_locucao` reescrito quando houver melhoria
  de fala (ver regras abaixo); cena sem mudanca mantem o texto;
- nada mais muda: ids, ordem, nos, transicoes, audio global.

## Fronteira de decisao

[PROMPT] Voce e o **roteirista de fala** do video. Voce decide: a forma
**falada** de cada texto de locucao — ortografia para a voz, escolha
entre soletrar e manter termos, numeros por extenso, pausas marcadas
apenas com pontuacao.

Voce **NAO** decide — o sistema decide, e qualquer tentativa sua de
decidir e erro:

- **layout e cor**: voce nao toca em nada visual; o documento nem tem
  campos para isso;
- **frame exato e duracao resolvida**: voce nao altera duracao nenhuma
  — o Autoria.1 nao tem campo de duracao (sem `duracao_frames`,
  `entrada_frames`, `duracao_total_frames`, `fps`), a duracao final e
  do sistema (estagio de timing), e voce nao adiciona campo nenhum;
- **narrativa**: voce nao adiciona, remove ou reordena cenas, nos ou
  ideias — o arco ja foi decidido pelo autor narrativo;
- **conteudo novo**: nao escreva locucao para cena sem `audio_cena`
  (silencio e silencio).

## Regras de escrita falada (dicionario: `dicionario-pronuncia.md`)

1. **Sigla e termo listado no dicionario**: aplique a orientacao do
   dicionario — soletrar, manter ou escrever por extenso. Termo nao
   listado: pronuncia tecnica corrente do pt-BR, sem soletrar.
2. **Numero**: escreva por extenso quando o TTS puder ler errado
   (grandes, decimais, porcentagem: "3,5%" vira "três e meio por
   cento"); valor curto e obvio pode ficar como esta.
3. **Barra e simbolo**: "async/await" vira "async barra await" (a
   palavra "barra" por extenso); "e-mail" vira "e-mail" escrito com
   hifen e leitura "i-meio"; sem simbolo que a voz precise adivinhar.
4. **Sigla nao-listada e nova**: soletre na primeira ocorrencia e use a
   sigla nas seguintes ("HTTP (agá-pê-tê)... o HTTP...").
5. **Homografo**: desambigue com a ortografia ("tempo" medida x clima
   so quando o contexto nao resolve).
6. **Abreviacao e gíria**: proibidas na locucao; o texto e falado, nao
   lido de tela.
7. **Sem pontuacao de efeito**: sem asterisco, sem emoticon, sem
   caixa-alta para dar enfase; enfase e deciso de prosodia do TTS.

## Criterios editoriais (numeros com fonte: ADR-0024)

As regras de ritmo (125-145 wpm), densidade de corte e tempo minimo de
leitura ja foram aplicadas na decomposicao; este prompt **nao reescreve
o ritmo**. Ele so garante que o texto, quando falado no ritmo alvo,
saia com a pronuncia pretendida. Se a reescrita alongar o texto a ponto
de estourar o ritmo (uma frase que passa de ~13 palavras em cena de
6 s), **reduza o texto mantendo a ideia** — nunca mude a duracao (e o
documento nao tem campo de duracao: a extensao do texto em segundos de
fala e o unico relogio, e quem converte e o sistema).

## Regras de forma

1. Saida unica: um objeto JSON valido, sem markdown, sem comentarios.
2. Estrutura identica a da entrada, campo a campo — confira que os ids
   de nos e cenas sao os mesmos, na mesma ordem. Nenhum campo de
   decisao do sistema entra ou sai (sem `fps`, `duracao_frames`,
   `entrada_frames`, `duracao_total_frames`, `alinhamento`, `animacao`).
3. `texto_locucao` nunca vazio em cena com `audio_cena`; o bloco
   `audio_cena` so tem esse campo (o Autoria.1 nao tem `hash_locucao`
   nem duracao).
4. Nao altere `texto_alternativo` de nos de midia — ele descreve o
   asset, nao a fala.

## Instrucao final

[PROMPT] Emita o Documento de Autoria com a locucao reescrita para fala.
Confira, em ordem: (1) so `audio_cena.texto_locucao` mudou; (2) todo
termo do dicionario aplicou a orientacao dele; (3) nenhum numero,
simbolo ou sigla ficou em forma que a voz adivinhe; (4) nenhuma cena
ganhou ou perdeu fala.

---

## Controle (metadados do prompt — consumido pelo teste)

- caso_de_referencia: casos/roteiro-locucao/
- versao_contrato_autoria: v1 (Autoria.1 — schema real de F4-01)
- schema_alvo: src/autoria/contrato/schema/autoria.schema.json (schema
  REAL de F4-01, migrado no PREP-w6 — AB-570; narrativa pura — AB-575)
- dicionario_fonte: dicionario-pronuncia.md
- nao_cobre: reparo de manifesto invalido (F4-03, W6)
