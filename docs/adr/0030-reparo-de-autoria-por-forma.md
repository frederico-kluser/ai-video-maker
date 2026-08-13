# ADR-0030 — Reparo de autoria por forma: reparável é forma, irreparável é rejeição definitiva

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F4-03 (W6)
- **Depende de:** ADR-0001 (todo card tem oraculo), ADR-0023 (contrato de
  autoria), F4-01 (schema `Autoria.1`, validador e rejeicao — W5),
  AB-432 (hash de midia ADVISORY), AB-433 (texto_alternativo obrigatorio),
  AB-555 (vocabulario v1 fade/slide/wipe/flip/none)
- **Porta TCP:** 4403 (docs/contrato-w6.md §9)
- **Faixa de ledger:** AB-630..AB-649 (ledger/inbox/F4-03.json)

## Contexto

A autoria e o unico estagio em que um LLM decide (narrativa, ritmo, texto,
vocabulario fechado). A saida estruturada pode violar o schema `Autoria.1`
de duas formas qualitativamente diferentes:

- **FORMA** — o conteudo narrativo esta certo, a expressao e que falha:
  brancos, sequencia de escape, case de enum, ordem, duplicata;
- **SEMANTICA** — o conteudo narrativo viola uma regra dura: tipo de no
  desconhecido, no de midia sem descricao (AB-433), hash de midia nao-
  string (AB-432), transicao fora do vocabulario v1 (AB-555).

O contrato-w6 §3 congela a fronteira: o reparo so toca forma; semantica e
**rejeicao definitiva** — "um manifesto irreparavel tem de ser rejeitado,
nunca 'melhorado' ate passar" (∅-crit do card). Este ADR registra como a
camada `src/autoria/reparo/**` executa essa fronteira.

## Decisoes

### 1. REPARAVEL = as cinco categorias de forma, e so elas

Espaco, escape, case de enum do vocabulario fechado, ordem e duplicata.
Tudo o mais — inclusive qualquer erro Ajv fora dessas categorias — e
irreparavel. A lista de rejeicao do contrato §3 e **exemplar**, nao
exaustiva: o principio e que o reparo nao pode tocar em nada alem das
cinco categorias, e o que ele nao pode tocar nao pode ser "consertado".

Consequencias concretas, todas testadas:

- `"texto": ""` em campo obrigatorio e irreparavel (o reparo nao inventa
  texto — inventar e o LLM decidindo duas vezes);
- `dados[].valor` string, `destaque` string, array vazio em `itens`/
  `dados` e irreparavel (nao ha normalizacao de forma que crie conteudo
  correto);
- emissao de `duracao_frames`/`cor`/`layout` (additionalProperties) e
  irreparavel: o schema reprova a emissao **de proposito** (contrato-w6
  §13) e um reparo que removesse o campo derrotaria a protecao;
- `schema_version` diferente de `Autoria.1` e irreparavel (outro
  contrato, nao uma variante de forma).

### 2. A varredura estrutural alem do Ajv

O schema nao expressa tudo. A camada roda uma varredura propria com as
regras duras do ledger e as do vocabulario fechado:

- AB-433: `texto_alternativo` ausente **ou so com brancos** — o schema
  (minLength) aceita brancos, a regra do ledger nao; o documento e
  semanticamente invalido mesmo validando no Ajv, e e REJEITADO;
- AB-432: `hash` presente tem de ser string;
- AB-555: transicao fora de fade/slide/wipe/flip/none (e os enums de
  `tipo_midia`/`tipo_grafico` — mesmos conjuntos derivados do schema);
- **ids duplicados** (o schema nao exige unicidade) — reparavel
  (duplicata), normalizado mantendo a primeira ocorrencia;
- **referencia inexistente** em `cena.nos` (o schema nao exige
  existencia) — irreparavel: remover a referencia muda a composicao da
  cena (decisao narrativa) e inventar o no e conteudo — as duas coisas
  sao semantica.

Conjuntos fechados e ordens canonicas sao **derivados do proprio schema**
(`derivar.ts`), nunca digitados: se o schema mudar, a camada muda junto.

### 3. Rejeicao definitiva ANTES de qualquer tentativa — e no meio do loop

A classificacao roda antes de a primeira tentativa existir; violacao
semantica presente (ou introduzida pelo reparador entre tentativas) e
rejeicao imediata com `ErroReparoAutoria`. O reparador nunca e invocado
para semantica — o ∅-crit o prova com contador de invocacao, inclusive no
caso-armadilha: documento com erro de forma E erro de semantica juntos e
rejeitado sem nenhuma tentativa.

As "tres tentativas e depois rejeicao" do contrato regem o caminho de
FORMA. Um documento que nunca podera passar nao gasta tentativas: a
semantica e definitiva em qualquer ponto.

### 4. Tres tentativas com simplificacao progressiva: T1 ⊃ T2 ⊃ T3

A simplificacao reduz o **escopo do pedido** (o formato do pedido, nunca
o documento): T1 pede todas as cinco categorias, T2 so espaco/escape/case,
T3 so case. A cada tentativa o pedido carrega os erros com o caminho JSON
(mesma disciplina do `rejeitar.ts` de F4-01 — o reparador sabe o que
falhou e onde). Esgotadas as tres, `ErroReparoAutoria` com
`motivo: "tentativas_esgotadas"` nomeando a regra que ainda falha.

### 5. Reparador mecanico deterministico como default; costura injetavel

As cinco categorias sao normalizacoes deterministicas — o reparador
mecanico (`reparador-mecanico.ts`) as implementa sem rede, sem LLM e sem
inventar conteudo, gateadas pelo escopo do pedido. Ele e o default da
camada; o F4-04/F5-07 pode injetar um reparador de chamada LLM na mesma
assinatura `(documento, pedido) => documento`, protegido pela
reclassificacao a cada tentativa.

Limites do reparador mecanico, testados:

- nunca toca `hash` (AB-432: advisory, endereco por conteudo resolvido a
  jusante);
- campo com minLength no schema NAO e aparado ate a string vazia: uma
  string so com brancos era VALIDA no schema, e esvazia-la tornaria o
  documento invalido sem conteudo de reposicao. Posicoes removiveis
  (campo opcional vazio, item de lista vazio) sao removidas;
- `\r\n -> \n`, trim consistente de ids/referencias, decodificacao de
  escape `\n \t \r \\ \"` em campo textual, ordem canonica de campos
  (required primeiro, ordem de declaracao do schema) e dedupe
  keep-first de ids e referencias.

### 6. O erro final nomeia a regra e o caminho — nunca so "invalido"

`ErroReparoAutoria` carrega os desvios (`regra`, `caminho`, `detalhe`) e
a mensagem os imprime; `motivo` distingue `irreparavel` (semantica) de
`tentativas_esgotadas` (forma nao sanada pelo reparador) para o pipeline
decidir o que fazer.

### 7. O reparo NAO preenche duracao, layout, cor, hash nem licenca

Esses campos nao existem no `Autoria.1`; quem os preenche e a ponte para
o S-4 na fronteira de resolucao/composicao — AB-550 (aberto, destino
F5-01 na W7). Um reparo que "completasse" o documento estaria fora do
contrato (o schema reprova a emissao, de proposito).

## Respostas as perguntas adversariais do card

1. **O reparo altera semantica ou so forma?** So forma — a classificacao
   rejeita semantica antes de qualquer reparo, e o reparador mecanico
   implementa exatamente as cinco categorias, com limites testados
   (hash, minLength, dedupe keep-first).
2. **Tres tentativas com simplificacao progressiva terminam?** Sim — o
   loop e limitado por `maxTentativas` (default 3); teste com reparador
   que nunca repara prova exatamente 3 invocacoes e depois rejeicao.
3. **O erro final diz qual regra falhou?** Sim — regra + caminho JSON em
   `ErroReparoAutoria`; teste afirma o texto da mensagem, nao so o exit.
4. **Um documento que nunca deveria ser aceito e rejeitado com teste?**
   Sim — `vazio-crit.test.ts`: o ∅-crit com contador de invocacao do
   reparador, incluindo o caso-armadilha forma+semantica juntos.

## Falso verde deste dominio

| O que parece verde | Por que nao e | O que fica vermelho se sumir |
|---|---|---|
| O reparo passou em documentos de forma | O reparador injetado (LLM) poderia "resolver" semantica sem a camada notar | `vazio-crit.test.ts`: reparador-espião com contador; documento irreparavel tem de lancar sem NENHUMA invocacao |
| O ∅-crit existe no codigo | Existir nao e rodar; e o gate que roda | Receita `autoria-reparo` com `test -f` de `vazio-crit.test.ts` + os outros arquivos (C2 — apagar teste deixa VERMELHO por ausencia) |
| O documento passou no schema Ajv | O schema nao expressa AB-433-com-brancos nem referencia inexistente | A varredura estrutural (scan) roda sempre — paridade com `validarSaidaAutoria` testada em `classificar.test.ts` |

## O que este ADR NAO decide

- A chamada real ao LLM no reparo (quem injeta o reparador e como) — F4-04
  (executor, W6) e F5-07 (pipeline, W9).
- A ponte autoria -> manifesto completo (frames, layout, cor, hash,
  licenca) — AB-550, fronteira de resolucao/composicao, F5-01 (W7).
- A politica de retry do orquestrador diante de `ErroReparoAutoria` —
  F5-07.
