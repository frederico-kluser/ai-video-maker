# ADR-0025: Suite integrada de composicao — a fiacao, o pintor real e o oraculo do quadro composto

**Status:** ACEITO
**Data:** 2026-08-13
**Card:** `F1-12` (W5)
**Depende de:** F1-01 (raiz e aritmetica de tempo), F1-04..F1-11 (os oito nos da W4), F2-02 (estagio `grafico`, cassete qtrle), S-4 (schema do manifesto), S-5 (tokens)
**Consumida por:** F5-01 (W7) e quem renderizar o manifesto canonico inteiro de verdade — e o primeiro render que atravessa a fronteira de determinismo com os oito nos juntos

**Guardas executaveis:**

- `just int-composicao` — a aceitacao inteira do card, em ordem
- `just det-provar-integrado` — o `det:provar --integrado` do PROGRAMA: render 2x, bytes identicos, oraculo de conteudo, snapshot aprovado
- `just int-composicao-ausencia` — ∅-crit: remover um no da fixture fica VERMELHO por ausencia
- `just int-composicao-aprovar` — (re)grava os snapshots. Ato explicito.

## Contexto

Os oito nos da W4 foram entregues como componentes puros de `(no, frame,
fps, width, height)`, as camadas como modulos registrados, as transicoes como
um `SequenciaComTransicoes` que recebe o pintor de cena INJETADO por prop
(AB-374), e a raiz como um `ManifestoRaiz` que renderiza todas as faixas sem
saber de cenas nem de fronteiras (AB-383). Nada disso se conhecia: o join e
este card.

Tres coisas so existiam como SUPOSICAO declarada nos handoffs da W4, e
nenhuma delas podia ser escrita pela W4 (dependencia lateral proibida):

1. a **fiacao** — anexar ao no `grafico` o descritor do asset que mora fora
   dele (AB-364);
2. o **pintor de cena real** — quem injeta no `SequenciaComTransicoes` o
   pintor do registro de nos de verdade (AB-374);
3. a **composicao das camadas com a timeline de nos** (AB-383).

Este ADR registra as decisoes do join e os dois achados que o join produziu:
o caminho de `fonte` passa pelo runtime (`staticFile`), e o cassete REAL do
estagio `grafico` (`.mov` qtrle/argb) e recusado pelo proprio no — com
evidencia.

## D1 — A fiacao anexa `grafico_resolvido` ao no, e a `fonte` sai do runtime, nunca digitada

O no `grafico` (F1-09) declarou em AB-364 a forma da fiacao: o descritor do
asset (`assets[nos_grafico[no.id]]`) anexado ao proprio no como
`grafico_resolvido`, com `fonte` — o caminho local derivado do hash pela
fiacao, nunca gravado no manifesto resolvido (C7).

O JOIN descobriu que o caminho de `fonte` nao pode ser escrito a mao:
`"/grafico-integrado.png"` funciona no Studio e quebra no render — o bundle
serve os arquivos de `public/` sob o prefixo de runtime (`/public/...`), e
quem traduz o nome para o caminho certo do bundle e o `staticFile()` do
Remotion, que resolve o nome contra o manifesto de arquivos estaticos do
bundle (`window.remotion_staticFiles`). O primeiro render da suite 404ou
exatamente por isso — o erro ficou como achado (AB-491) e o resolvedor padrao
da fiacao passou a ser `staticFile(nomeDoArquivo)`.

A fixture integrada serve o asset por CONTEUDO (C7): `nos_grafico` aponta
para o SHA-256 dos bytes reais de `grafico-integrado.png`, e um teste confere
o hash contra o arquivo em disco.

## D2 — O pintor de cena de producao vive na fiacao, e o ponto de injecao e este card

`SequenciaComTransicoes` recebe o pintor por prop (AB-374). O pintor de
producao — o que pinta os nos do registro dentro da janela da cena, com o
frame local de cada no derivado do relogio da cena — foi escrito neste card,
em `tests/integracao/composicao/fiar.tsx`, junto da fiacao.

Ele pinta na ordem declarada em `cena.nos` (a mesma ordem do plano da raiz),
recusa no inexistente e no sem componente, e nunca desenha fora da janela do
no. A suite provaria que o pintor injetado e o do REGISTRO DE NOS (os
`data-no` so existem porque o registro de producao foi consultado — um
pintor chapado nao emitiria nenhum).

**Nota de producao:** `src/composicao/` continua sem a camada de cena — o
pintor real mora na suite (a regra de onda proibia tocar em `src/**`).
Produzir a camada (mover `fiar.tsx` para `src/composicao/`) e PREP da onda
seguinte, registrado em AB-493.

## D3 — A composicao das camadas: fundo abaixo, sobreposicoes acima, nos no meio

A arvore integrada e:

```
<AbsoluteFill bg={background.primary}>
  <CAMADAS.../>                    <- fundo (z background), grade e vinheta (z overlay)
  <SequenciaComTransicoes Cena={pintorReal}/>  <- as cenas, com fronteiras
</AbsoluteFill>
```

As camadas se posicionam por z-index (tokens.zIndex.background/overlay); o
palco das transicoes fica entre as duas — por isso a vinheta cobre o conteudo
e o fundo nao. As camadas cobrem a composicao inteira (duracaoEmFrames =
total da timeline); os nos cobrem a janela de cada cena. Resposta executavel
para AB-383.

**Caracterizacao registrada:** nos multi-cena, a ordem de pintura (DOM) e a
ordem de `cena.nos`, e os nos `cabecalho`, `texto` e `codigo` pintam fundo
opaco de quadro inteiro — um no desenhado antes fica coberto pelo irmao
opaco desenhado depois (o marcador de midia de c-003 e c-005 nao aparece na
fixture inteira; o no de grafico de c-004 divide o frame com os irmaos). E o
comportamento atual da composicao, caracterizado nos snapshots aprovados —
nao e um bug desta suite. Quem quiser semantica de camada POR NO (z-order
declarado, ou pintores que nao tapam o alfa do vizinho) e trabalho de um
futuro card (AB-492).

## D4 — O oraculo de conteudo do quadro composto (AB-344, AB-390)

A W4 deixou enderecado ao join (AB-344): renderizar a cena composta e
reaplicar a contagem de alfa sobre o quadro inteiro. O oraculo da suite faz
isso em tres niveis:

1. **Entropia do quadro inteiro** (C1): um quadro preto ou uniforme
   renderiza com exit 0 — o gate conta cores distintas (>= 8) em todo still.
2. **Regiao do marcador de midia** (composicao `integrado-midia`, uma cena,
   um no): o interior da caixa tem de mostrar a tinta do marcador E o fundo
   em multiplos tons (as faixas da camada de fundo) — uma regiao chapada e a
   assinatura de "o compositor pintou um retangulo opaco por cima do alfa".
3. **Regiao do grafico** (composicao `integrado-grafico-asset`, uma cena,
   um no com o asset fiado): as cinco cores das barras do asset tem de
   aparecer (o grafico REAL esta no quadro, nao saiu deterministicamente
   preto) e a regiao nao pode ser chapada (o alfa do asset sobreviveu).

As composicoes de uma cena e um no existem porque na fixture inteira o
marcador de midia fica coberto por irmaos opacos (D3) — o oraculo de regiao
precisa de um quadro onde a regiao so pode ter vindo do proprio no.

**Limite do gate de bytes (AB-363):** o que este oraculo cobre e PNG, o
formato da fixture integrada. WebM, SVG, GIF e APNG — formatos que o no
aceita — seguem "consistente-mas-possivelmente-errado": um asset desses pode
renderizar errado sem o gate acusar. Fechar exige os leitores de bytes que a
W4 deixou pendentes (AB-363, AB-496).

## D5 — O cassete REAL do estagio grafico (.mov qtrle/argb) e recusado — com evidencia

O criterio da revisao de plano pedia: o render integrado com o no grafico
REAL (cassete do F2-02, `.mov` qtrle/argb) TEM de mostrar o grafico; se o
qtrle nao decodificar no navegador do render, REGISTRE a evidencia (o
orquestrador executa o cartucho webm).

A sonda `tests/integracao/composicao/qtrle.ts` faz exatamente isso: fia o no
`n-009` com o DESCRITOR REAL do cassete (`mimeType: video/quicktime`, lido
do `resultado.json` do proprio cassete) e tenta renderizar nos dois caminhos:

- arvore pura: `ErroDeGraficoOpaco` nomeando o no — `formato "video/quicktime"
  ate tem alfa, mas o navegador do render nao o reproduz (qtrle/argb tem
  alfa, mas o navegador do render nao reproduz .mov)`;
- render de verdade (Chrome headless, swangle): o mesmo erro derruba o
  render, com a evidencia gravada.

Conclusao: com o cassete REAL de F2-02 (video/quicktime) o render integrado
NAO mostra o grafico — ele PARA, de proposito (a guarda de F1-09, ADR-0019),
em vez de pintar um buraco ou um retangulo. O cartucho de saida que o
orquestrador executa e o WebM com alfa (`F2-02 --format=webm`,
vp9/yuva420p), que esta na lista de permissao do no com
`reproduzivelNoNavegador: true` — registrado em AB-490, ligado a AB-390.

## D6 — O ∅-crit e presenca do no, ancorado no MANIFESTO CANONICO

O criterio do PROGRAMA: "remover um no da fixture TEM de ficar vermelho por
ausencia, e nao passar por 'menos frames para comparar'".

A assercao de presenca (`tests/integracao/composicao/presenca.test.ts`) e
por no, uma por no, e a lista esperada sai do MANIFESTO CANONICO
(fixtures/canonico, imutavel) — nunca da fixture integrada. Se a lista saisse
da fixture mutada, remover o no removeria tambem a expectativa e o gate
passaria com "menos nos para cobrar": o falso verde exato que o criterio
proibe. Com a lista ancorada no canonico, remover um no da fixture integrada
deixa a assercao daquele no ORFA — o render nao mostra o no, e a falha
NOMEIA O NO.

O script `ausencia.ts` prova o criterio por mutacao: remove cada um dos 15
nos da fixture (mantendo o manifesto valido), roda o GATE de verdade
(vitest, presenca.test.ts — o mesmo arquivo do `just int-composicao`), exige
VERMELHO com o id do no na saida, restaura byte a byte e exige VERDE. Os dois
controles positivos (antes e depois) fecham as duas pontas.

## Decisoes menores

- **Frames dos snapshots** escolhidos para cruzar os estados da composicao:
  cena sozinha (30), fronteira com as duas cenas (82), cena multino (300),
  cena de graficos (460), cena final (580) e o ULTIMO frame (726) — a prova
  de que nao existe cauda preta depois da ultima cena.
- **A duracao e a da aritmetica subtrativa** (727 = 780 - 53), calculada a
  mao no teste, nunca lida do motor.
- **Porta 4112** do Studio da suite (faixa deste card, contrato-w5 §9).
- **Registro das fontes** no escopo de modulo da entrada (AB-313): sem isso
  o Chrome do render cai para fallback sem erro (C6). O publicDir da suite
  serve `fontes/` por symlink commitado e o asset de grafico.
