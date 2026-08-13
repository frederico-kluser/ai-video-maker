# ADR-0017 — No de midia: hash nunca URL, alfa preservado, GIF por frame

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F1-07
- **Depende de:** ADR-0001 (todo card tem oraculo), F1-01 (contrato de no),
  F1-02 (design tokens), F1-03 (fontes locais), F0-07 (store de conteudo)

## Contexto

O no de midia e o primeiro no de composicao que representa um **asset**.
A fronteira de determinismo do projeto (AGENTS.md) diz: *"Nenhuma URL, nenhum
tempo relativo, nenhuma decisao pendente atravessa esta linha."* O asset e o
caso classico de C7: *"Um asset da rede muda de conteudo mantendo a URL"* —
dois renders do mesmo manifesto sairiam diferentes sem nada ficar vermelho.

Tres decisoes deste ADR sao sobre determinismo, e cada uma cobre um modo de
falha especifico:

1. **Enderecamento por hash** — o campo de endereco e SHA-256 de conteudo,
   nunca URL. A recusa e ativa: `validarNoDeMidia()` estoura `ErroDeMidia`
   para qualquer coisa que nao seja hash canonico.
2. **GIF avanca pelo frame** — o navegador anima `<img src="x.gif">` pelo
   relogio; o Remotion renderiza faixas em paralelo em abas diferentes, e o
   mesmo frame da composicao sairia num quadro do GIF numa aba e noutro na
   outra. O indice do quadro e funcao pura de `(frame, fps)`.
3. **Alfa preservado** — o no nao pinta fundo. Um fundo opaco apagaria os
   nos irmaos da cena em silencio e destruiria a transparencia de qualquer
   asset (as armadilhas do `.mov` qtrle/argb e do WebM alfa).

## Decisao

### 1. O endereco do asset e SHA-256 canonico, e nada alem

O componente aceita apenas `^[0-9a-f]{64}$` (hex minusculo). A recusa e
**ativa e completa**:

- hash ausente, maiusculo, curto, longo, numerico, caminho de disco ou nome
  de arquivo → `ErroDeMidia`;
- URL por qualquer porta — o proprio `hash`, `texto_alternativo`, `licenca`,
  ou uma propriedade com nome de endereco (`src`, `href`, `url`, `uri`,
  `link`, `path`, `caminho`, `endereco`) → `ErroDeMidia`;
- o detector de URL opera sobre o texto cru **e** o texto normalizado
  (tripwire, AGENTS.md C11): `h t t p s://x` e `HTTPS://x` caem;
- a recusa lista **todos** os problemas de uma vez, e a iteracao de campos e
  **ordenada** — iterar objeto sem ordenar seria nao-determinismo na propria
  mensagem de erro.

O schema do manifesto (S-4) so impoe 64 caracteres ao campo `hash`; a forma
canonica e a recusa de URL vivem no no (AB-345). A resolucao hash→bytes e do
estagio de resolucao de midia (F2-04, irmao desta onda): este componente
desenha o **marcador** do asset — rotulo, prefixo do hash e fita de cadencia —
e ja carrega a aritmetica de quadro que o asset usara quando chegar.

### 2. O GIF avanca pelo frame, nunca pelo relogio

`quadroDeGif(frame, fps)` e funcao pura: `floor(frame / framesPorQuadro)`.
A cadencia default e 100 ms por quadro de GIF (`transitionDuration.instant`,
o piso pratico do campo de delay do GIF89a), com parametro `msPorQuadro`
injetavel — quando F2-04 entregar a cadencia real do arquivo, nenhuma chamada
muda de forma (AB-341). Nao existe `Date.now()`, `performance.now()`, estado
nem efeito no caminho: o teste envenena o relogio global inteiro e exige que
o render nao mude um byte.

A fita de cadencia (oito celulas, uma acesa) e a prova visual: a celula acesa
e funcao do frame e de mais nada. Um GIF que andasse pelo relogio deixaria a
fita parada e o quadro do asset andando — divergencia invisivel em um frame
so, e exatamente por isso o provador de still renderiza o GIF em **dois
frames diferentes** e exige bytes diferentes (AB-340).

### 3. O alfa e preservado por construcao e por contagem de pixel

Por construcao: a raiz do no nao tem cor de fundo; nao ha `background-image`,
`mask-image`, `mix-blend-mode`, `filter`, `backdrop-filter`, `animation` nem
`transition`; a opacidade vem da entrada declarada no manifesto (fade de
`animacao.duracao_frames`, ou 1 para `none`/ausente). `cover`/`fill` ocupam o
quadro inteiro; `contain`/`none` deixam margem transparente.

Por prova: o still renderizado de verdade (Chrome headless do Remotion, nunca
o Studio — C5) sai em PNG RGBA com fundo nenhum, e o gate conta pixel:
opacos > 0 (nao e quadro vazio, C1), transparentes > 0.5 do quadro (o alfa
sobreviveu), cores distintas > 8 (nao e quadro chapado). O compositor final
(join da W5) deve re-provar o alfa no quadro composto — este card prova a
camada que ele desenha, e o endereco dessa verificacao esta em AB-344.

### 4. Provador proprio por no

O harness de determinismo de F0-06 (`tools/determinismo/`) e do canario e nao
aceita `--no <nome>`; seis cards de no rodam esta onda em paralelo e cegos
entre si. Cada card editar o mesmo script produziria o merge silencioso que o
contrato da W4 manda evitar — por isso o provador vive em
`tools/no-midia/provar.ts` (AB-340, AB-343). Generalizar o harness e trabalho
de PREP da onda seguinte, com um dono so.

## Alternativas descartadas

- **`<Img src={hash}>` com a resolucao em runtime** — passaria URL para o
  navegador do render (C7) e quebraria o determinismo.
- **GIF nativo do navegador** (`<img src="x.gif">`) — avanca pelo relogio;
  divergente entre abas do render por construcao.
- **Desenhar o asset no proprio card** — o asset e do estagio de resolucao
  (F2-04); dependencia lateral, proibida pelo contrato da W4.
- **Fundo preto no lugar do alfa** — e exatamente o modo de falha que o
  contrato de alfa existe para reprovar.

## Consequencias

- O manifesto resolvido (abaixo da fronteira) so endereca midia por hash.
- O no nunca desenha no torto: recusar e o comportamento, nao excecao
  silenciosa.
- Snapshot aprovado que sumir fica **vermelho** — `marcacao.ts`, o oraculo e
  o provador exigem presenca (∅-crit provado por `tools/no-midia/ausencia.sh`).
