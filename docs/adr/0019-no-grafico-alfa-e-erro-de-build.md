# ADR-0019 — No `grafico`: "o alfa nao e suportado" e erro de build

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F1-09
- **Depende de:** ADR-0001 (todo card tem oraculo), ADR-0006-composicao-raiz
  (contrato de no), F1-01 (descoberta), F2-01 (contrato de estagio, W3)

## Contexto

O grafico chega **renderizado** do estagio de resolucao (card F2-02, `grafico`)
e entra no video **por cima** da cena. Se o formato entregue nao carrega canal
alfa — um JPEG, um MP4, ou um PNG de tipo de cor 2 (RGB) — o que aparece no
video nao e o grafico: e um **retangulo opaco** cobrindo o fundo.

E nada nesse caminho acusa erro. O bundle passa. O render sai com exit 0. O
arquivo tem bytes. O snapshot ate fica estavel, porque o retangulo e
perfeitamente deterministico (C1: "um quadro preto tambem sai com exit 0"). O
defeito so aparece para quem ASSISTE o video — e ai o build ja disse tres vezes
que estava tudo certo.

Os modos de falha reais, da tabela "As 14 armadilhas de dominio" do AGENTS.md:

| Formato entregue | O que acontece no video |
|---|---|
| `image/jpeg`, `video/mp4` | retangulo opaco (formato nao tem alfa) |
| `image/png` tipo de cor 2 | retangulo opaco (nome certo, bytes sem alfa) |
| `video/quicktime` (qtrle/argb) | buraco no video: tem alfa, mas o navegador do render nao reproduz `.mov` |

## Decisao

### 1. Formato sem canal alfa e ERRO DE BUILD, e o erro NOMEIA O NO

Duas guardas, uma para cada momento em que o erro ainda e barato:

1. **`conferirGraficosResolvidos()`** — roda sobre o manifesto resolvido,
   **antes de abrir navegador** (`tools/no-grafico/conferir.ts`, etapa
   `no-grafico-conferir`). Confere, para cada no do tipo `grafico`, o
   `mimeType` do asset referenciado por `nos_grafico[no.id]` contra a tabela
   de permissao, e depois **confere os bytes do proprio arquivo** (localizado
   pelo SHA-256 na loja de conteudo, como o store — S-8): pega a mentira que o
   descritor nao pega, `image/png` verdadeiro com tipo de cor 2 dentro.

2. **O proprio componente** — lanca `ErroDeGraficoOpaco` **antes de emitir
   qualquer elemento**. Nao existe caminho "renderizou o retangulo opaco":
   nem por engano, nem por esquecimento de rodar a guarda 1.

### 2. Lista de PERMISSAO, nunca lista de proibicao

A lista de proibicao aprova por omissao: o formato que ninguem previu entra
calado, e a guarda vira decoracao. Aqui, formato ausente da tabela e RECUSADO
— inclusive `mimeType` vazio. A lista de permissao exige as **duas**
condicoes ao mesmo tempo: canal alfa **e** reproducao no navegador do render.

### 3. Formato nao verificado e VERMELHO, nunca "pulado"

A conferencia de bytes sabe abrir PNG (todos os tipos de cor) e WebP (bloco
ALPH / flag VP8X). O que ela ainda nao sabe abrir — JPEG, MP4, GIF, SVG, MOV —
aparece como **NAO-VERIFICADO e derruba o gate**: um alfa que ninguem olhou
nao e um alfa que existe (ledger AB-363).

### 4. O no desenha do manifesto quando o asset nao existe

Sem asset resolvido (`grafico_resolvido` ausente) o no desenha a serie
declarada no manifesto (cinco tipos: barras, linha, area, pizza, dispersao),
sobre fundo transparente — o no **nunca pinta fundo**: um `backgroundColor`
de tela cheia aqui seria o proprio retangulo opaco que o card existe para
proibir, escrito por nos em vez de recebido do estagio.

### 5. Determinismo e conteudo sao provados no pixel, nao no exit code

O oraculo (`tools/no-grafico/provar.ts`) renderiza 2x e exige **bytes
identicos**, e alem disso **mede o quadro**: exige tinta (nao e quadro
vazio), exige transparencia (nao e retangulo opaco), exige mais que oito
cores distintas (desenho de verdade, nao bloco chapado) e exige os quatro
cantos com alfa 0 (o no compoe sobre a cena, nao tapa a cena).

### 6. Fora da janela declarada o no NAO EXISTE — retorna null

A pergunta adversarial 4 da W4 e contrato de no: fora de `[0, duracao_frames)`
o no retorna `null`, e os sete irmaos (cabecalho, texto, lista, midia, codigo,
transicoes, camadas) fazem isso e testam `-1`, `duracao`, `duracao+60`. A
primeira versao deste no divergia: clampeava o frame
(`Math.min(Math.max(frame, 0), duracao_frames - 1)`) e continuava emitindo a
arvore inteira — SVG e opacidade 1 — congelada no ultimo estado valido. So a
mitigacao da raiz (`EnvelopeJanela` nunca chamar o no fora da janela) escondia
a divergencia: um pintor futuro (ex.: pintor de cenas das transicoes) pintaria
o grafico congelado por cima do conteudo seguinte sem nenhum gate acusar.

Decisao: a guarda de janela abre o componente — `frame < 0 || frame >=
grafico.duracao_frames` retorna `null` antes de qualquer desenho (e antes da
guarda de formato: fora da janela nenhum pixel e emitido, logo nao existe
caminho "retangulo opaco" a bloquear). O clamp morreu junto: dentro da janela
`frame` ja esta em `[0, duracao_frames)`, e as interpolacoes continuam com os
dois extrapolate explicitos. O teste do card trocou a assercao de congelamento
por markup vazio em `-1`, `duracao`, `duracao+60` e `duracao+5000`. Registrado
no ledger AB-362.

## Consequencias

- Um manifesto pedindo formato sem alfa **falha no build** com uma mensagem
  que nomeia o no, o formato e o motivo — antes de qualquer navegador abrir.
- O ∅-crit do PROGRAMA — "apagar um snapshot aprovado tem de ficar vermelho"
  — e coberto duas vezes: `tools/no-grafico/ausencia.sh` e a sonda ∅-1 de
  `tools/no-grafico/mutar.ts` (que tambem cobre snapshot trocado, formato
  ruim no descritor e nos bytes, no sem asset e render que deveria falhar).
- Custo aceito: a conferencia de bytes de formatos exoticos (GIF, SVG, MOV)
  continua NAO-VERIFICADO ate alguem escrever o leitor — e o gate fica
  vermelho nesses casos, nunca verde.

## Suposicoes declaradas (dependencia lateral com F2-02, proibida por contrato)

A fiacao da W5 anexa ao no o descritor do asset que hoje mora fora dele, em
`assets[nos_grafico[no.id]]`; o contrato de props e fechado — `(no, frame,
fps, width, height)` — entao `no` e o unico canal. `fonte` e o caminho local
ja resolvido a partir do hash pela fiacao, nunca gravado no manifesto
resolvido (C7). F2-02 declara `mimeType` no asset; sem `mimeType` o formato e
desconhecido, e desconhecido e recusado. Se F2-02 entregar outra forma, o
ajuste e na interface e no ponto de fiacao — a tabela de formatos e as
guardas nao mudam (ledger AB-361 e AB-364).
