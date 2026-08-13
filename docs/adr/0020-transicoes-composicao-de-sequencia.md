# ADR-0020: Transicoes e composicao de sequencia -- a transicao e um par de apresentacoes

**Status:** ACEITO
**Data:** 2026-08-13
**Card:** `F1-10` (W4)
**Depende de:** F1-01 (contrato de no e aritmetica de tempo), F0-04 (tokens), S-4 (schema do manifesto), S-5 (tokens.ts singleton)
**Consumida por:** quem for compor duas cenas em uma fronteira, quem for escrever o proximo tipo de transicao, e o estagio de autoria que declarar `Transicao.tipo` no manifesto

**Guardas executaveis:**

- `just transicoes` -- a aceitacao inteira do card, em ordem
- `just transicoes-provar` -- render 2x em processos separados, `cmp` byte a byte, oraculo de pixel (C1), `git diff --exit-code` **e** `git status --porcelain` limpos (C3)
- `just transicoes-aprovar` -- regrava os 9 snapshots aprovados. Ato explicito.
- `just transicoes-ausencia` -- ∅-crit: apagar um snapshot aprovado fica VERMELHO pelo motivo certo

## Contexto

O card pede o que o video faz entre duas cenas. A tentacao e modelar
transicao como "um efeito aplicado no meio das duas" -- um filtro que pega as
duas cenas ja compostas e as mistura. E o modelo errado para este programa
por um motivo concreto: **se so um lado desenha, o que existe e um corte, nao
uma transicao** -- e o video fica com um flash preto ou um salto invisivel no
diff de bytes. O oraculo do programa e o pixel (AGENTS.md, C1), e o pixel nao
perdoa lado faltando: ele produz outra cor, e o gate acusa pelo valor.

A fonte de referencia e a presentation do Remotion: ela recebe
`presentationProgress` e `presentationDirection` ("entering" | "exiting") e
envolve os DOIS lados ao mesmo tempo. Adotamos a mesma forma, com o progresso
por prop.

## D1 -- Transicao e um PAR de apresentacoes sobre as duas cenas, nunca um efeito no meio

`Apresentacao` e uma funcao pura de props que recebe os dois lados da
fronteira (`saindo` e `entrando`), o progresso e a direcao, e devolve a
arvore. Uma transicao e o PAR dessas apresentacoes aplicado as DUAS cenas
sobre a mesma janela de frames. So existe apresentacao; nao existe "camada de
transicao" por cima da composicao.

Consequencia pratica: o registro de apresentacoes (D4) e a unica ponte entre
o schema (`Transicao.tipo`) e o que desenha. Um tipo sem apresentacao e
**recusado** -- a composicao lanca `Sem apresentacao` em vez de renderizar
corte seco em silencio.

Implementacao: `src/composicao/transicoes/contrato.ts`,
`src/composicao/transicoes/registro.ts`.

## D2 -- O progresso chega por PROP, derivado do frame absoluto -- o tempo e do frame, nunca do navegador

`presentationProgress` e derivado do frame absoluto pela aritmetica de
`../tempo.ts`, e chega por prop. Nenhum `useCurrentFrame`, nenhum relogio,
nenhuma animacao CSS com tempo proprio. A unica camada que fala com o runtime
do Remotion e `entrada.tsx`; todo o resto e funcao pura de props,
renderizavel em node com react-dom/server -- e e por isso que o gate consegue
reprovar de verdade, sem navegador.

O progresso e publicado com casas decimais fixas (`CASAS_DECIMAIS`) e nunca
chega a 1: no ultimo frame da janela vale `(D-1)/D`, porque a fronteira
termina no primeiro frame em que a cena anterior nao existe mais.

Implementacao: `src/composicao/transicoes/contrato.ts` (progresso),
`src/composicao/transicoes/entrada.tsx` (unica camada com o runtime).

## D3 -- A aritmetica de fronteiras NAO e reimplementada: e consumida de F1-01

`fronteiras.ts` consome `calcularDuracao()` de `../tempo.ts` (card F1-01) e
usa o campo `origem` de cada fronteira para saber QUAL lado do manifesto
venceu a precedencia. A regra "a `transicao_saida` da anterior manda" tem uma
unica implementacao, e ela nao esta aqui.

Reimplementar a precedencia teria sido o bug caro da onda: as duas copias
concordariam na fixture canonica e divergiriam em silencio no primeiro
manifesto que declarasse a fronteira pelo outro lado. A janela da fronteira i
e `[fim(cena i) - D, fim(cena i))` -- e por isso que a transicao ENCURTA o
video: os D frames sao contados uma vez, nao duas.

A timeline produzida aqui tem de concordar com a de `../tempo.ts` byte a
byte; o teste cobra isso como invariante.

Implementacao: `src/composicao/transicoes/fronteiras.ts`.

## D4 -- Registro de apresentacoes: espelho SEM DISCO, cobertura por PRESENCA contra o schema

O bundle de render nao tem `node:fs`, e o gate de pureza so autoriza a
camada de descoberta a falar com o disco. Entao `registro.ts` e um espelho
manual do diretorio `apresentacoes/` -- e a VERDADE continua sendo o disco:
o teste varre `apresentacoes/` e reprova se o espelho divergir do que esta
la.

A cobertura e cobrada contra o SCHEMA, nunca contra uma lista fechada de
tipos (docs/contrato-w4.md §5): para cada `Transicao.tipo` declarado por
`schema/manifesto.schema.json` (singleton S-4), o registro tem uma
apresentacao com meta valida (`sobrepostos` | `repartidos` | `alternados`).
Um tipo novo no schema sem apresentacao deixa o gate VERMELHO em vez de
renderizar corte seco em silencio.

O schema declara 7 tipos: `clockWipe`, `cube`, `fade`, `flip`, `none`,
`slide`, `wipe` -- e as 7 apresentacoes existem (ver
`src/composicao/transicoes/apresentacoes/`). `none` e o corte seco
REGISTRADO: o que entra cobre o que sai, sem transformacao visual -- a
ausencia explicita de transicao, nao a ausencia de apresentacao.

Implementacao: `src/composicao/transicoes/registro.ts`,
`src/composicao/transicoes/contrato.ts` (`TIPOS_DE_TRANSICAO` espelha o enum
do schema, `validarMetaDeApresentacao`).

## D5 -- Sequencia pura: o que este componente decide, e nada mais

`SequenciaComTransicoes` recebe `manifesto` e `frame` por prop e decide
exatamente tres coisas:

1. quais cenas existem no frame (uma fora da fronteira, DUAS dentro);
2. qual apresentacao envolve cada lado;
3. em que ordem elas pintam: a que sai primeiro, por BAIXO; a que entra por
   cima. Quem entra por baixo estaria ENCOBERTO, nao sobreposto.

Quem PINTA a cena e injetado (`Cena`) -- isso mantem esta camada
independente do registro de nos, que e de outro card: nenhuma dependencia
lateral com os seis irmaos desta onda.

Implementacao: `src/composicao/transicoes/sequencia.tsx`.

## D6 -- A perspectiva 3D fica no envoltorio de cada lado, nunca no palco

Em CSS, `perspective` so vale para os FILHOS DIRETOS do elemento que a
declara, e o filho direto do envoltorio e justamente a apresentacao. Pular a
camada do envoltorio e o bug silencioso classico de `cube` e `flip`: o palco
ganha perspectiva, as faces nao -- e o snapshot de quina some. As transicoes
`cube` e `flip` (contribuicao `repartidos` / `alternados`) vivem de quina e
de backface, e o snapshot `cube-meio` / `flip-quarto` reprova exatamente a
perda da perspectiva.

Implementacao: `src/composicao/transicoes/sequencia.tsx` (envoltorio),
`src/composicao/transicoes/apresentacoes/cube.tsx`,
`src/composicao/transicoes/apresentacoes/flip.tsx`.

## D7 -- O snapshot e PIXEL DO RENDER, com cor chapada de token e uma MARCA posicional

AGENTS.md C5 proibe aprovar pixel vindo do Studio: o Chrome do Studio nao e
o Chrome do render. Os snapshots sao gravados pelo mesmo caminho que o
`remotion still` usa por baixo (`@remotion/bundler` + `@remotion/renderer`),
com `gl: swangle` -- rasterizacao por SOFTWARE, para o pixel nao depender da
GPU da maquina. (Ver `tools/transicoes/renderizar.ts`.)

A demonstracao pinta duas cenas com cores CHAPADAS de token e uma marca
posicional (retangulo preso a posicao dentro da cena). A cor chapada torna o
pixel do meio da fronteira PREVISTO:

- `fade` (sobrepostos) -> o pixel central e a mistura 50/50 das duas cores,
  que NENHUM lado produz sozinho;
- `wipe` / `clockWipe` / `slide` (repartidos) -> metade da tela e uma cor
  inteira, metade e a outra.

A MARCA e o que distingue recortar de transladar: com cenas de cor chapada,
`wipe` e `slide` produzem EXATAMENTE o mesmo quadro (medido: mesmo md5);
recortar esconde a marca, transladar a leva junto. Os 9 quadros aprovados
estao em `fixtures/snapshots/transicoes/`, e cada um e capaz de REPROVAR
alguma coisa (a lista e a razao estao em `tools/transicoes/quadros.ts`) --
frame antes/depois da fronteira, meio exato, quina 3D, backface do flip.

O oraculo de pixel roda nos dois lados: a suite de testes decodifica os PNGs
aprovados e asserta o valor (`tests/composicao/transicoes.test.ts`), e o
provar roda o MESMO oraculo no render recem-produzido
(`tools/transicoes/pixels.ts`) ANTES de comparar bytes -- regressao que
compara preto com preto continua preta.

## D8 -- Determinismo em DOIS processos, ausencia sempre VERMELHA, aprovar explicito

O determinismo e provado com dois renders em PROCESSOS SEPARADOS
(`provar.sh` chama `renderizar.ts` duas vezes), nao em duas chamadas na
mesma memoria: ordem de chave, semente de hash e relogio nao sobrevivem ao
segundo processo.

Diferente do canario de F0-06, que trata "snapshot ausente" como primeira
execucao e grava sozinho, aqui **ausencia e VERMELHO, sempre** -- o teste de
∅-crit so e possivel porque apagar o arquivo nao recria nada. Gravar exige
`--aprovar`, e o re-baseline so vale depois de `git add` + commit: enquanto
o snapshot estiver nao rastreado, a conferencia continua VERMELHA (C3).

## Itens de ledger

As incertezas deixadas por este card estao em `ledger/inbox/F1-10.json`
(faixa AB-370..AB-379): a coreografia dos dois lados como responsabilidade
da camada de composicao (AB-370), a precedencia entre `transicao_saida` e
`transicao_entrada` declarada dos dois lados (AB-371), o progresso por prop
contra animacao por hook (AB-372), o registro espelho sem disco contra
descoberta por filesystem (AB-373), o pintor de cena injetado e quem o
injetara com o registro de nos real (AB-374), as cores chapadas + marca como
oraculo e a sensibilidade a mudanca de token (AB-375), o corte seco `none`
como apresentacao registrada (AB-376), a rasterizacao por software e o
determinismo em GPU (AB-377), a direcao padrao `from-left` na autoria
(AB-378) e a resolucao do oraculo 480x270 contra o manifesto real (AB-379).

## Consequencias

- Um tipo novo no schema sem apresentacao **derruba o build**, com o nome do
  tipo na mensagem. Isso e intencional: a ausencia seria corte seco em
  silencio.
- Mudar uma cor de token muda todos os snapshots que a usam. E o
  comportamento desejado de S-5: alteracao de token recaptura snapshot, via
  `just transicoes-aprovar`.
- Dois renders do mesmo frame agora tem de ser byte a byte identicos -- em
  qualquer maquina que rastreie por software. A primeira GPU do CI (ou um
  bump de Remotion, que pina o Chrome) recaptura os 9 snapshots.
- A aritmetica de tempo continua sendo propriedade de F1-01: quem discordar
  da precedencia mexe em `../tempo.ts`, nao aqui.

## O que este documento NAO cobre

- Como a aritmetica de tempo e a precedencia funcionam -- ver F1-01
  (`src/composicao/tempo.ts`)
- Como os nos sao descobertos e registrados -- ver `docs/adr/0006-composicao-raiz.md`
- Transicoes entre CAPITULOS ou entre videos (as cenas deste card sao a
  unidade); cortes por edicao fora do manifesto
- Audio atravessando a fronteira (ducking, crossfade de audio): o par de
  apresentacoes e visual; audio e outro card
