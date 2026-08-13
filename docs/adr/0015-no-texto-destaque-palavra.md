# ADR-0015: No de texto — destaque palavra a palavra com degradacao declarada para frase

**Status:** ACEITO
**Data:** 2026-08-13
**Card:** F1-05 (W4)
**Depende de:** F1-01 (contrato de no), F0-04 (tokens), F1-02/F1-03 (tipografia e fontes)
**Consumida por:** F2-03 (locucao), F1-12 (join da W5) e o estagio de montagem

**Guardas executaveis:**

- just no-texto — gate do card: testes dos dois caminhos, render 2x, snapshots aprovados e o crit de ausencia
- npx tsc --noEmit -p tsconfig.composicao.json — type-check escopado
- bash tools/no-texto/ausencia.sh — apagar um snapshot aprovado tem de ficar VERMELHO

## Contexto

O no de texto herdado de F1-01 era um no de mentira: desenhava o texto com destaque estatico e nada mais. O card F1-05 pede destaque PALAVRA A PALAVRA, e esse destaque depende de um timing por palavra que so existe quando o estagio de locucao (F2-03) roda — um card IRMAO desta onda, que nao existe no disco ainda. Dependencia lateral e proibida por construcao (contrato-w4 §1): este card nao pode importar o modulo do vizinho nem inventar o artefato dele. As decisoes abaixo sao o que sobrou depois dessa restricao.

## D1 — O timing por palavra e uma SUPOSICAO DECLARADA, validada em tempo de render

### O problema

O formato do timing de locucao ainda nao existe no disco. Se este card importasse o tipo do vizinho, o merge da onda quebraria no primeiro dia; se chutasse o formato em silencio, o video sairia com destaque errado e ninguem saberia por que.

### A decisao

O componente declara o formato no proprio corpo e o valida em tempo de render:

    no.timing_palavras: { texto: string; inicio_ms: number; fim_ms: number }[]

- Milissegundos, nao frames: a fronteira de resolucao nao conhece o fps da composicao; a conversao acontece uma vez, no componente, por msToFrames().
- Origem do tempo: o frame LOCAL 0 do no — o unico zero que o contrato de no entrega. Reancoragem e trabalho do estagio de montagem, nao do no.
- Uma entrada por palavra de no.texto, na mesma ordem.

### O que isso custa

Se F2-03 entregar outro formato, o destaque palavra a palavra degrada para frase sem erro — registrado em AB-320, incluindo a mudanca de schema (S-4) que o campo exige (NoTexto tem unevaluatedProperties: false).

## D2 — Degradar para frase e trocar a granularidade, nunca desenhar torto

### O problema

Timing ausente, lista vazia, entrada malformada, palavras sobrepostas ou timing que descreve outra frase: cada uma dessas condicoes poderia ser tolerada com um destaque parcial. Um destaque meio certo nao e um video meio certo — e uma palavra realcada na hora errada, que ninguem ve no gate e todo mundo ve no video.

### A decisao

QUALQUER desvio do formato degrada para destaque por FRASE — e por frase inteira, usando o campo booleano destaque que o schema do manifesto ja declara. A degradacao nao inventa informacao: troca a granularidade do realce, de palavra (derivada do timing) para frase (declarada no manifesto).

O MOTIVO da degradacao sai no DOM (data-degradacao), porque degradou e degradou pelo motivo certo sao afirmacoes diferentes — um componente que degradasse sempre passaria no primeiro teste e falharia o segundo. Os motivos sao nominais: ausente, nao-lista, vazio, malformado, fora-de-ordem, desalinhado.

### O que isso compra

O teste do card prova as duas implicacoes: tirar o timing da fixture com timing produz, byte a byte, a saida da fixture sem timing, e por o timing na fixture sem timing produz a saida da com timing. O par de fixtures difere EXATAMENTE por um campo, conferido pelo proprio teste.

## D3 — A janela do no e lei: fora dela, nada desenha

### O problema

O modo classico de um no funcionar e mesmo assim aparecer onde nao devia: o envelope de sequencia termina, o componente continua desenhando, e o gate de tempo nao ve nada.

### A decisao

O componente devolve null fora de [0, duracao_frames): antes do frame 0, no frame da duracao e depois, e para duracao ausente, zero ou negativa. O teste cobra as duas bordas da janela e os dois caminhos do componente.

## D4 — Harness proprio dentro da propriedade do card (AB-321)

O criterio de aceitacao dos cards de W4 escreve o comando det:provar, mas ele nao existe: o harness do canario (tools/determinismo) esta amarrado a composicao canario, e tools/ nao e compartilhado nesta onda. F1-05 traz o proprio harness em fixtures/snapshots/no-texto/provar.ts, com as mesmas invariantes do canario mais tres:

1. os dois caminhos (com e sem timing) produzem imagens DIFERENTES — se sairem iguais, o componente ignorou o timing;
2. frames diferentes do mesmo caminho produzem imagens DIFERENTES — se sairem iguais, o componente ignorou o frame;
3. nenhum still e igual ao CONTROLE VAZIO — o quadro que sairia com o componente devolvendo null, renderizado de verdade em vez de imaginado (C1 do AGENTS.md).

O snapshot aprovado sai do RENDER (gl swangle fixado), nunca do Studio (C5). O crit roda por mutacao: some com cada aprovado, um por vez, e exige VERMELHO; restaura e exige VERDE de novo. O comando do card, bash tools/no-texto/ausencia.sh, delega para esse modo.

## D5 — Nenhum literal de token neste arquivo

Cor (highlight.primary, text.primary/secondary, background.primary), peso (fontWeight.bold/semibold/regular), tamanho (typeScale.body), entrelinha (lineHeight.relaxed), largura de linha (maxCharsPerLine), espacamento (spacing) e duracao de entrada (transitionDuration.base) vem dos tokens; o gate design-varrer permanece verde com este arquivo na arvore. A pergunta adversarial 3 do card responde: nenhum literal redeclarado.
