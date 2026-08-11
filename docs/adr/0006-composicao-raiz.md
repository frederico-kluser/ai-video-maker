# ADR-0006: Composicao raiz -- frame por prop, fronteira de transicao e espelho do registro

**Status:** ACEITO
**Data:** 2026-08-11
**Card:** `F1-01` (W3)
**Depende de:** F0-02 (contrato do manifesto), F0-04 (tokens), F0-09 (fixture canonica), T-01 (esqueleto)
**Consumida por:** os oito cards de no de W4, e todo card que calcule duracao de composicao

**Guardas executaveis:**

- `just comp-pureza` -- reprova `Date.now`, `Math.random`, `setTimeout`, `fetch` sob `src/composicao/`
- `just comp-unicidade` -- reprova arquivo de no que nao case o contrato, id repetido, e divergencia entre `registro.ts` e o disco
- `just comp-testar` -- reprova timing errado e manifesto torto aceito

## Contexto

A composicao e a primeira coisa abaixo da fronteira de determinismo. Tres
decisoes precisavam ser tomadas antes de existirem os oito nos de W4, porque
todos eles herdam a resposta.

## D1 -- O frame chega ao no por PROP, nao por hook

### O problema

O caminho idiomatico do Remotion e o no chamar `useCurrentFrame()`. Esse hook
le dois contextos React (`CanUseRemotionHooks` e a posicao da timeline) e
**lanca excecao** fora de uma `<Composition>`:

```
useCurrentFrame() can only be called inside a component that was registered
as a composition.
```

Medido nesta maquina (remotion 4.0.507, react 19, `react-dom/server`):
`AbsoluteFill` renderiza fora do runtime; `<Sequence>` nao -- estoura
`No video config found`.

A consequencia pratica: se o no depende do hook, **nenhum teste consegue
renderizar o no** sem subir navegador. E um oraculo que nao roda nao reprova
(AGENTS.md, Regra 3).

### A decisao

`NoComponentProps` carrega `frame` (local), `fps`, `width`, `height`.
Nenhum componente sob `src/composicao/nos/` chama hook do Remotion.
`useCurrentFrame()` existe em **um unico lugar** do repositorio:
`src/composicao/raiz.tsx`, no adaptador `ComposicaoDoManifesto`.

### O que isso compra

`just comp-testar` renderiza a fixture canonica de verdade, com
`renderToStaticMarkup`, em sete frames escolhidos, e exige o conjunto exato de
nos visiveis com o frame local de cada um. Sem navegador, em 30 ms.

### O que isso custa

Um no nao pode mais "so usar `useCurrentFrame()`". W4 recebe o frame pronto.
Se algum no de W4 precisar de `<Audio>`/`<OffthreadVideo>` com deslocamento
correto, ele depende do envelope `<Sequence>` (D1b), nao do hook.

### D1b -- O janelamento e injetavel

A raiz nao decide sozinha como janelar o no no tempo: ela emite uma faixa por
no e delega ao `Envelope`.

- `EnvelopeJanela` (padrao, em `ManifestoRaiz.tsx`): `<div>` puro que some
  quando o frame esta fora da janela. E o que roda nos testes.
- `EnvelopeSequence` (em `raiz.tsx`): `<Sequence from durationInFrames name>`.
  E o que roda no render de verdade, e e o que da a W4 o deslocamento de
  midia e o nome de trilha no Studio.

Os dois recebem `inicio` e `duracao` do **mesmo plano**. O risco de o teste
verde nao provar o caminho de producao (C5) e coberto por um teste que percorre
a arvore construida com `EnvelopeSequence` e exige que cada `<Sequence>` tenha
`from`/`durationInFrames`/`name` iguais aos do plano.

## D2 -- A unidade de cobranca da transicao e a FRONTEIRA, nunca o campo

### O problema

A aritmetica e subtrativa: `total = soma(cenas) - soma(transicoes)`
(<https://www.remotion.dev/docs/transitions/transitionseries>, 2026-08-11).
Mas o schema do manifesto deixa a **mesma** sobreposicao ser declarada dos dois
lados: `cenas[i].transicao_saida` e `cenas[i+1].transicao_entrada`.

Somar os dois campos cobra a mesma sobreposicao duas vezes. Na fixture
canonica isso encurtaria o video de 727 para 674 frames -- sem erro nenhum,
so um final cortado.

E os dois lados **discordam** na fixture canonica de F0-09:

| fronteira | `transicao_saida` da anterior | `transicao_entrada` da seguinte |
|---|---|---|
| c-001 -> c-002 | `fade`, 15 | `slide`, 15 |
| c-002 -> c-003 | `wipe`, 20 | `flip`, 12 |
| c-003 -> c-004 | `clockWipe`, 18 | `cube`, 24 |
| c-004 -> c-005 | (ausente) | `none`, 0 |

Exigir que os dois lados concordem reprovaria a propria fixture canonica.

### A decisao

Existe **uma fronteira por par de cenas adjacentes**. A duracao dela sai, nesta
ordem: `transicao_saida` da cena anterior; se ausente, `transicao_entrada` da
cena seguinte; se nenhuma, corte seco (0).

`transicao_entrada` da primeira cena e `transicao_saida` da ultima nao tem par:
nao ha com o que sobrepor, entao **nao descontam nada**.

Uma fronteira maior que a cena que ela encerra e recusada, nao truncada.

### Verificacao

`calcularDuracao()` conserta a si mesma: se
`total != somaCenas - somaTransicoes`, ela estoura `ErroDeTempo` em vez de
devolver um numero. Na fixture canonica: `780 - 53 = 727` frames.

### O que fica em aberto

A ambiguidade e do **schema**, nao do calculo -- ver `AB-240`. A forma limpa
seria o manifesto declarar transicoes como lista de fronteiras entre cenas, e
nao como dois campos por cena. Isso muda `schema/manifesto.schema.json`, que e
singleton (S-4): vira PREP de onda, nao mudanca de card.

## D3 -- `registro.ts` e espelho do disco, e a divergencia e vermelha

### O problema

AGENTS.md, Regra 6: descoberta por convencao, nunca registro central. Mas o
bundle de render nao tem `node:fs`: se `raiz.tsx` importasse `descoberta.ts`,
o render quebraria no navegador.

### A decisao

Duas fronteiras distintas:

- **Fronteira de registro** (`descoberta.ts`): le disco, importa cada modulo,
  valida contra o contrato e **estoura** em qualquer desvio. So testes e
  ferramentas chamam.
- **Fronteira de render** (`registro.ts`): imports estaticos, zero disco. E o
  que a raiz usa.

O disco continua sendo a verdade. `just comp-unicidade` compara os dois e
reprova se divergirem -- em tipo, em `meta` ou em nome de componente. E
`just comp-pureza` reprova qualquer import de `node:fs` sob `src/composicao/`
que nao seja o de `descoberta.ts`.

Isto e um desvio consciente da Regra 6, com guarda executavel no lugar da
confianca -- registrado tambem como `AB-242`.

## D4 -- A raiz RECUSA; ela nao pula

`planoDeComposicao()` estoura `ErroDeComposicao` -- listando **todos** os
problemas de uma vez -- diante de: tipo de no fora do schema, tipo sem
componente registrado, `schema` divergente do tipo, id de no repetido,
cena apontando para no inexistente, cena vazia, `duracao_frames` nao positiva,
e no declarado que nenhuma cena usa.

O motivo e o modo de falha do dominio: um no pulado nao aparece no video e
nao aparece no log. O render sai `exit 0` com um buraco dentro (C1).

## Alternativas descartadas

1. **`<Sequence>` sempre, e teste so de arvore.** Provaria a fiacao sem provar
   que os nos renderizam. Rejeitada: o card pede render.
2. **Sem `<Sequence>` em lugar nenhum.** Quebraria o deslocamento de midia dos
   nos de W4.
3. **`require.context` / `import.meta.glob` para descobrir no bundle.** Amarra a
   composicao ao bundler (webpack no render, vite no teste), e nao roda no
   `tsc`. Rejeitada: troca um espelho verificado por magia nao verificavel.
4. **Exigir que `transicao_saida` e `transicao_entrada` concordem.** Reprovaria
   a fixture canonica de F0-09.
