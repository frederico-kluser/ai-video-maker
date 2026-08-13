# ADR-0007: Musica e efeitos — licenca por som, URL remota vira hash no store

**Status:** ACEITO
**Data:** 2026-08-13
**Card:** `F2-06` (W4)
**Depende de:** `F2-01` (contrato de estagio e cassete), `F0-07` (store por SHA-256), ADR-0003 (enquadramento de uso pessoal, D1), ADR-0006
**Consumida por:** `F2-07` (suite offline, W5), `F3-05` (mix de audio, W5+), `F5-06` (relatorio de procedencia/publicacao), a composicao

**Guardas executaveis:**

```sh
npx tsx tools/musica/verificar.ts                              # res-musica: o oraculo do card
bash tools/resolucao/offline.sh --estagio musica               # suite com a rede bloqueada
npx tsx tools/resolucao/chave.ts --estagio musica              # C12: um parametro por vez
rg --files-without-match '"licenca"' fixtures/cassetes/musica/**/procedencia.json   # ∅-crit: vazio
```

## Contexto

A pergunta que este card fecha, na forma exata do PROGRAMA:

> Qual a licenca de **cada som** exportado pelo pacote de efeitos? O pacote
> e MIT mas exporta **URLs remotas**, e a licenca e **por som** — so um foi
> lido ate hoje. E a biblioteca de trilha: continua sem API e exclusiva do
> estúdio da plataforma?

A pesquisa obrigatoria (registrada abaixo, com URL, data e placar)
respondeu as duas metades:

1. **Licenca por som, confirmada.** O pacote `@remotion/sfx` e MIT como
   *pacote*, mas cada som exportado tem a propria licenca, declarada na
   lista de atribuicao do repositorio `remotion-dev/remotion.media`
   (campo `attribution` de cada entrada de `soundEffects` em
   `generate.ts`). Dos **11 sons** exportados, **7 declaram "Creative
   Commons 0"** e **4 nao declaram licenca nenhuma** (bruh, windows-xp-
   error, vine-boom, ding). Para este programa, "nao declara licenca" e
   exatamente o que o ∅-crit existe para impedir: um asset sem licenca
   declarada nao entra. Quatro em onze inutilizaveis e um pacote com o
   qual o card nao se fecha.
2. **A biblioteca de trilha continua sem API e exclusiva do estúdio.**
   A biblioteca de musica do Remotion Recorder (tres faixas: "Nature",
   "I Woke Up In A Dream", "Rhythmic Reverie") e selecionada pela UI do
   editor (prop `music`), nao tem API programatica, e as faixas foram
   produzidas pela Utope Music **"exclusively for the Recorder and are
   cleared for your videos produced by the Recorder"** — licenca amarrada
   ao produto. O enquadramento de uso pessoal (ADR-0003, D1) desbloquearia
   *o uso* dessas faixas num video pessoal, mas nao muda o problema
   estrutural: sem API, a trilha nao entra num pipeline declarativo.

A resposta deste ADR para as duas: **trocar o fornecedor por um que
declare a licenca de cada arquivo — o Wikimedia Commons, pela Action API**.

## Decisao

### D1 — Fornecedor: Wikimedia Commons (Action API), e o catalogo e por titulo de arquivo

`src/resolucao/musica/pacote.ts` declara cinco itens (`commons-efeitos-base
v1.0.0`): quatro efeitos e uma trilha. O que o pacote guarda e o
**titulo** do arquivo no Commons (`File:...`), nunca a URL — a URL e
devolvida pela API em tempo de resolucao, com parametros de campanha que o
proprio fornecedor acrescenta (`?utm_source=...`). Fixar a URL no catalogo
daria a impressao de que ela e estavel, e a premissa falsa de C7.

A escolha tem tres propriedades que os outros candidatos nao reuniam:

1. **A API nao usa credencial.** A Action API responde sem chave, em
   header ou em query. A pergunta adversarial "o cassete contem alguma
   credencial?" passa a ter resposta **estrutural** (nao ha o que vazar),
   em vez de resposta por redacao (havia, e foi mascarada).
2. **A licenca de cada arquivo e declarada pelo proprio fornecedor**, em
   `extmetadata.LicenseShortName` ("CC BY 3.0", "CC0", "Public domain").
   E um NOME, e a URL do deed vem num campo separado (`LicenseUrl`). No
   Freesound, ao contrario, o campo `license` e a *deed URL* — e gravar
   `licenca: resposta.license` poria uma URL abaixo da fronteira, que o
   schema rejeita.
3. **Cada arquivo traz dois oraculos de integridade independentes** — o
   tamanho (`size`) e o SHA-1 (`sha1`) — que o estagio confere contra os
   bytes baixados antes de qualquer asset entrar no store. Um proxy que
   devolve pagina de erro com status 200 passa em teste que so olha
   `resposta.ok`; nao passa aqui.

### D2 — `@remotion/sfx` descartado: pacote MIT, sons por-som, e 4 em 11 sem licenca

O pacote que motivou a pergunta do card foi avaliado e **nao entra**. O
pacote e MIT (fonte: docs do Remotion), mas os sons individuais sao obras
de terceiros com licencas proprias, e a pesquisa de 2026-08-13 enumerou
todas as 11: sete CC0 e quatro **sem licenca declarada**. O ∅-crit da W4
comeca na origem (fornecedor.ts rejeita item sem `LicenseShortName`):
"preciso checar" nao e licenca. Um pacote cujo terco dos sons nao declara
licenca nao fecha o card.

### D3 — A trilha vem do mesmo fornecedor; a biblioteca do estúdio fica fora

A trilha sonora (`trilha_sonora`) e "Kevin MacLeod - Lift Motif.ogg",
CC BY 3.0, 44,4 s, declarada pelo Commons. A biblioteca do Recorder
permanece registrada como indisponivel por API (fonte abaixo) — o ADR-0003
desbloqueia o uso pessoal, mas nao cria API onde nao existe, e a decisao
deste card e nao amarrar o pipeline a um asset cuja unica via de entrada e
a UI de um editor.

### D4 — Licenca POR SOM, na procedencia e no asset; o ∅-crit da W4 em codigo

A licenca nao e uma propriedade do pacote nem do cassete: e de **cada
arquivo**, e cada arquivo desce com a sua. `procedencia.assets[].licenca`
e `assets[hash].licenca` sao preenchidos item a item a partir da declaracao
do fornecedor; o `licenca` do topo da procedencia lista **todas** as
distintas, em ordem lexicografica (`CC BY 3.0 + CC0 + Public domain`) —
escolher "a mais comum" esconderia justamente a mais restritiva, que e a
que manda. Item sem licenca declarada e rejeitado **antes** de virar asset
(`normalizarPagina` lanca), e o gravador impede cassete sem licenca de
chegar ao disco (`ECasseteInvalido`). O ∅-crit de disco e a segunda
barreira.

### D5 — A URL remota vira hash no store; o credito e partido em T+A+L + S

O caminho de um efeito, deste card ate o video:

```
titulo no pacote
  -> API do fornecedor (entrada.fetch)   -> URL remota   [gravada no cassete]
  -> download (entrada.fetch)            -> bytes        [gravados em corpos/]
  -> sha256(bytes)                       -> HASH
  -> store por conteudo (F0-07)          -> .cache/store/<ab>/<hash>
  -> parcial.nos_musica[no] = HASH                        <- so o hash cruza
     parcial.assets[HASH]   = { licenca, atribuicao, ... }
  -> procedencia.assets[].origem = URL                    <- a URL fica ACIMA
```

Nenhuma URL desce — nao por disciplina: `$defs.SemURLProfundo` do schema
do manifesto resolvido rejeita URL em qualquer profundidade, valor ou nome
de propriedade. O estagio ainda roda `encontrarURLs(parcial)` por conta
propria antes de devolver, porque um erro que estoura no estagio nomeia o
campo, e um erro que estoura no schema diz so "o documento nao valida".

O credito que atravessa a fronteira usa o modelo TASL (Title, Author,
Source, License) da Creative Commons, partido em dois: **T+A+L descem**
em `assets[].atribuicao` (texto sem URL), e o **S (fonte) fica acima**, em
`procedencia.assets[].origem`/`idNoProvedor`. O motivo e uma descoberta
publicada por este card para F3-05 e F5-06: a CC BY 4.0, secao 3(a)(1)(E),
exige "a URI or hyperlink to the Licensed Material to the extent
reasonably practicable" — o credito juridicamente completo CONTEM uma URI,
e `$defs.TextoSemURL` proibe URL no campo `atribuicao`. As duas exigencias
sao verdadeiras e incompativeis no mesmo campo. A saida e a propria secao
3(a)(2), que permite satisfazer 3(a)(1) "by providing a URI or hyperlink
to a resource that includes the required information": o credito e partido,
e **F5-06 junta as duas metades na publicacao**. Creditamos SEMPRE,
inclusive CC0 (que nao exige): a Creative Commons recomenda o credito para
material CC0 por norma profissional, e um pipeline com dois caminhos de
credito tem um caminho que ninguem testa.

### D6 — Curadoria com mistura de licencas, de proposito

Os cinco itens somam ~1,2 MB (o cassete e versionado no git, e o git nao
esquece — AB-280) e misturam tres licencas: CC0 (abertura, campainha),
CC BY 3.0 (conquista, trilha) e Public domain (caixa-de-musica). A
mistura e deliberada: um pacote so de CC0 deixaria o caminho de
atribuicao obrigatoria sem exercicio — e o caminho sem exercicio e o que
quebra na primeira vez que alguem precisa dele. O item "campainha" ainda
traz o credito bruto com URL relativa a protocolo (`//commons...`),
exercitando a limpeza que o schema cobra.

### D7 — O que este card entrega para F3-05 (mix) e F5-06 (publicacao)

- Para **F3-05**: `assets[hash].duracaoSegundos` por asset (duracao
  declarada pelo fornecedor), `trilha_sonora` como hash da trilha, e
  `nos_musica[noId]` por no. Este estagio NAO normaliza loudness e NAO
  decide cobertura (quantas repeticoes da trilha cabem no video): o
  contrato cita `loudnessAlvo` como parametro tipico de musica, e ele foi
  deliberadamente omitido de `parametros` — declarar um parametro que nao
  muda a saida passaria em `res-chave` e mentiria sobre o desenho. A
  duracao minima da trilha (30 s) e criterio de CURADORIA e esta em
  `parametros` (entra na chave de cache).
- Para **F5-06**: `procedencia.json` do cassete, com a URL de origem de
  cada som acima da fronteira e a metade S do TASL; o `notas` do cassete
  explica o particionamento e a base legal (CC BY 3(a)(2)).

## Alternativas consideradas / descartadas

| Alternativa | Por que descartada |
|---|---|
| `@remotion/sfx` (o pacote do enunciado) | Pacote MIT, mas 4 dos 11 sons sem licenca declarada (pesquisa 2026-08-13). URL remota em `remotion.media` exigiria download na resolucao — viavel tecnicamente, inviavel juridicamente para o terco sem licenca |
| Freesound API | O campo `license` da resposta e a *deed URL*, nao o nome — `licenca: resposta.license` poria URL abaixo da fronteira, que o schema rejeita; exigiria uma segunda camada de traducao por item, com tabela que divergiria da API |
| Biblioteca de trilha do Recorder | Sem API programatica; faixas licenciadas "exclusively for the Recorder"; a unica via de entrada e a UI do editor |
| Trilha gerada por sintese (tone, no-loop) | Nao e "musica"; nao exercita licenca, atribuicao nem integridade de download — o caminho sem exercicio quebra no dia em que precisar |

## Pesquisa obrigatoria (registro)

| Pergunta | Resposta | Fonte (URL, data) | Placar |
|---|---|---|---|
| O pacote `@remotion/sfx` e MIT? | Sim, como pacote; "See license of each sound effect by clicking on it" | https://www.remotion.dev/docs/sfx/ (2026-08-13) | 2-0 (remotion.dev + repositorio remotion.media corroboram) |
| Qual a licenca de CADA som exportado? | 11 sons: 7 CC0, 4 sem licenca declarada — enumerados um a um na lista de atribuicao | https://raw.githubusercontent.com/remotion-dev/remotion.media/main/generate.ts (2026-08-13) | 1-0 (uma fonte primaria, o proprio repositorio do CDN) |
| A biblioteca de trilha tem API? | Nao. Tres faixas exclusivas do Remotion Recorder, selecionadas por UI; produzidas pela Utope Music "exclusively for the Recorder" | https://www.remotion.dev/docs/recorder/editing/music (2026-08-13) | 1-0 (uma fonte primaria) |
| A Action API do Wikimedia usa credencial? | Nao. O cassete gravado neste card carrega 6 chamadas sem header de autenticacao e sem chave em query | https://www.mediawiki.org/wiki/API:Main_page (2026-08-13), confirmado por execucao (cassete) | 1-0 + verificacao por execucao |

Placar por dominio primario independente, conforme o contrato de pesquisa
do programa (remotion.dev, github.com/remotion-dev/remotion.media e
mediawiki.org sao dominios distintos; as respostas 2 e 3 sao fatos de
fonte unica e estao marcadas como tal).

## Consequencias

### Positivas

- A pergunta adversarial "o cassete contem credencial?" tem resposta
  estrutural: a API nao tem chave para vazar.
- A pergunta "a licenca e por som?" esta respondida em codigo: cada
  asset carrega a sua, do proprio fornecedor.
- O efeito remoto vira conteudo enderecado por hash (C7): o render nao
  depende de URL viva, e dois renders em datas diferentes produzem o
  mesmo manifesto resolvido.
- O cassete inteiro pesa ~1,2 MB e cabe no teto de AB-280.

### Custos e desvios registrados

- **AB-473** — `res-cassete --estagio musica` contra a rede real e
  refutado pelos headers volateis do fornecedor (`date`, `age`,
  `x-request-id`) que entram em `chamadas.json`. O determinismo do
  estagio e medido regravando a partir do cassete (fase 6 do oraculo),
  que isola o que se quer medir: o estagio, nao o relogio do fornecedor.
- **AB-474** — o bucket anonimo do IP do gravador devolveu 429 em rajada
  durante a W4 (outros agentes batem no mesmo provedor). Mitigacao atual:
  `tools/musica/gravar.ts --pausa <ms>`; retry com backoff no estagio fica
  como pergunta aberta (mudaria `resolver()` e exigiria bump + regravacao).
- **AB-475** — `chamadas.json` grava o header `x-client-ip` da resposta
  (o IP publico da maquina que gravou). NAO e credencial, mas e um dado
  da maquina do operador versionado para sempre no git. `HEADERS_SENSIVEIS`
  (F2-01) nao o cobre; o dono do cassete decide se entra na lista.

## Revisao adversarial

- **"Por que nao guardar a URL no catalogo e pular a chamada de API?"**
  Porque a URL com parametros de campanha e devolvida pela API; fixa-la
  em `src/` daria a impressao de estabilidade (premissa falsa de C7) e o
  cassete deixaria de provar a conversao titulo -> URL -> bytes.
- **"O cassete grava o corpo do catalogo com HTML e URL nos creditos —
  nao vaza nada?"** O corpo fica em `corpos/`, acima da fronteira; a
  limpeza e do ESTAGIO e roda identica no replay (sosia, nao sucessor) —
  a fase 5 do oraculo prova que o corpo gravado AINDA tem HTML cru e que
  o resultado limpo sai dele.
- **"Quatro sons do `@remotion/sfx` sem licenca — e se eles forem CC0
  na pratica?"** "Na pratica" nao e licenca. O fornecedor que nao declara
  nao entra; a regra vale igual para o Commons (item sem
  `LicenseShortName` e rejeitado).

## O que este ADR NAO decide / explicitamente fora de escopo

- O mix de audio (ducking, loudness, cobertura da trilha) — `F3-05`.
- A publicacao do relatorio de procedencia — `F5-06`.
- O retry com backoff em 429 — aberto (AB-474).
- A politica de `HEADERS_SENSIVEIS` do cassete — `F2-01`/`F2-07`.
