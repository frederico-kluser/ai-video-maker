# ADR-0007: Resolucao de destaque de codigo — pre-computacao acima da fronteira, zero rede

**Status:** ACEITO
**Data:** 2026-08-13
**Card:** `F2-05` (W4)
**Depende de:** `F2-01` (contrato de estagio e cassete), `F0-07` (store por SHA-256), ADR-0001 (oraculo), ADR-0006 (contrato de estagio e cassete)
**Consumida por:** `F2-07` (W5, suite offline), `F1-08` (no de codigo da composicao, W4)

**Guardas executaveis:**

```sh
just res-codigo                                        # gate do card
bash tools/resolucao/offline.sh --estagio codigo       # suite com a rede bloqueada de verdade
npx tsx tools/resolucao/chave.ts --estagio codigo      # um parametro por vez, cache miss em cada
npx tsx tools/resolucao/regravar-e-diffar.ts --estagio codigo  # determinismo do cassete + sonda negativa
```

## Contexto

O template de codigo do Remotion (`template-code-hike`) usa `twoslash-cdn`,
que baixa declaracoes de tipo de um host de terceiro em tempo de execucao,
com cache so em memoria por padrao. Se isso rodasse no render, o video
deixaria de ser funcao pura do manifesto (C7, AGENTS.md Regra 1): dois
renders da mesma entrada, em dias diferentes, dariam frames diferentes, e
o segundo dependeria de um host alheio estar de pe. A restricao "sem CDN"
e nossa, motivada por render local e reprodutibilidade — nao recomendacao
do Remotion.

Este card resolve o problema por **eliminacao**: a gramatica mora no
repositorio, nao ha chamada para cachear, e o cassete gravado tem zero
chamadas de rede — verificado, nao prometido. O destaque e pre-computado
ACIMA da fronteira de determinismo, e o no de composicao (F1-08) so
consome tokens prontos, com a cor final ja resolvida.

## Decisao

### D1 — O destaque e pre-computado no estagio; o no de composicao so consome tokens

O estagio tokeniza o codigo de cada no `Codigo.*` e publica o resultado
como artefato enderecado por SHA-256 (`nos_codigo[<no>] = <hash>`). A
estrutura publicada (`TokensDeDestaque.1`) contem a **cor final** de cada
trecho, resolvida a partir de `src/design/tokens.ts`, nunca a classe
sozinha: se o no mapeasse classe -> cor, trocar o tema mudaria o pixel
ABAIXO da fronteira sem mudar chave de cache nenhuma, e o cassete gravado
continuaria valendo para um video diferente. Com a cor dentro do artefato
e o `hashDoTema` dentro da chave, trocar o tema e um cache miss
barulhento (C12).

### D2 — Zero rede por construcao, nao por convencao

O template que fala com host de terceiro em runtime e a alternativa
explicitamente rejeitada. A gramatica mora em `gramaticas.ts`, versionada
(`versaoDasGramaticas` entra nos parametros e na chave). O cassete tem
zero chamadas de rede, e isso e verificado de tres jeitos: o cabecalho
declara `quantidadeChamadas: 0`, `chamadas.json` esta vazio, e nao existe
diretorio `corpos/`. Alem disso, um teste varre o subtree
`src/resolucao/codigo/**` inteiro atras de vocabulario de rede (fetch,
http, cdn, unpkg, jsdelivr, esm.sh, twoslash, `://`, XMLHttpRequest,
WebSocket, node:https/net/dns) e falha se achar — a busca no texto
normalizado, inclusive comentario (C11). A sonda negativa do varredor e
executada no mesmo teste.

### D3 — Motor: lexer local proprio, sem dependencia nova em package.json

`package.json` e singleton S-1, PROIBIDO para este card. Um motor de
verdade (TextMate/Oniguruma via Shiki ou lighter) exigiria dependencia
nova — decidido adiar, ver AB-450. O motor adotado e um lexer sticky-regex
escrito no repositorio (`destacador.ts`), deterministico por construcao:
regras ordenadas, primeira que casa vence, nenhum relogio, nenhum ambiente.

Limitacoes declaradas em voz alta: nao entende literal de regex em JS,
nao resolve tipos, nao distingue `<` de abertura de JSX de `<` de
comparacao. Linguagem sem gramatica local NAO e erro e NAO e silencio: cai
para a gramatica `texto` com o motivo gravado no proprio artefato
(`gramatica: "texto@1.0.0 (queda: linguagem ...)"`, `gramaticaExata:
false`).

### D4 — Tema por composicao de tokens existentes (S-5 proibido)

`src/design/tokens.ts` e singleton S-5, PROIBIDO para este card. O tema
(`tema.ts`) nao inventa nenhuma cor: cada classe mapeia para um token que
ja existe (palette, text, background, fontFamily). O mapeamento inteiro e
hasheado (`hashDoTema` = SHA-256 do JSON canonico do tema) e o hash entra
nos parametros e na chave de cache: mudar QUALQUER cor — inclusive por
alguem mexer em tokens.ts la longe — invalida o cassete sozinho, sem
depender de memoria humana.

O vocabulario de classes e fechado (11 classes), e o teste exige cobertura
total do tema, contraste AA (4.5:1) contra os DOIS fundos possiveis (bloco
e linha destacada), e que toda cor seja um valor que existe em
`src/design/tokens.ts`. O que isso custa: a paleta de destaque nao tem
nome proprio no design system ainda (AB-452).

### D5 — Artefato dentro do cassete, com endereco conferido na leitura

O contrato de estagio (F2-01) devolve `parcial` + `procedencia`, e mais
nada: nao ha campo por onde devolver o CONTEUDO enderecado pelo hash.
`persistirNoStore` pula asset que nao esta no store, e o store e
`.gitignore` — um clone limpo teria o cassete e nao teria os bytes, e
`res-offline` passaria assim mesmo. A escolha deste card: os bytes moram
dentro do proprio cassete, em `<cassete>/artefatos/<sha256>.json`. O
cassete ja e a fonte de verdade offline, ja e versionado e ja e diffado
byte a byte por `res-cassete`; um artefato que entra nele herda as tres
propriedades de graca. A leitura (`lerArtefato`) CONfere o hash (o conteudo
tem de hashear para o proprio nome, C7) e o `formato` declarado. A ponte
cassete -> store para a composicao fica aberta (AB-455).

### D6 — Normalizacao da entrada com invariante testado

Tres normalizacoes, cada uma por motivo de determinismo: CRLF/CR viram LF
(o mesmo codigo salvo em Windows e Linux tem de produzir o MESMO hash),
BOM inicial some, e tabulacao vira N espacos (o render nao tem tab stop; a
coluna nao pode depender do motor de layout do navegador, C5). O
invariante que sustenta o resto: concatenar os `texto` de todos os tokens
de todas as linhas reproduz o texto normalizado, byte a byte. Testado em
11 casos (incluindo bloco vazio, so quebras, acentuacao e emoji).

### D7 — Normalizacao de `linhas_destaque` do manifesto

`linhas_destaque` e escrito por LLM e vai errar numero: fora de ordem,
repetido, ou fora do intervalo. O estagio normaliza (ordena, deduplica,
ignora fora do intervalo) e o teste exige que `[0, 2, 99, -1]` num bloco
de 2 linhas produza exatamente `[false, true]`. Uma linha fantasma ou uma
excecao por numero errado derrubaria o pipeline por causa da cor de um
bloco.

### D8 — O ∅-crit da licenca, com a forma corrigida do `rg -L`

O PROGRAMA escreve `rg -L '"licenca"' fixtures/cassetes/codigo/**/procedencia.json -> vazio`.
Em ripgrep, `-L` e `--follow` (seguir symlinks) — o comando literal sai
vazio EXATAMENTE quando nenhum arquivo declara licenca, e `--files-without-match`
nao tem forma curta. A receita `res-codigo-licenca` converte para a forma
que exprime a intencao (`rg --files-without-match`), com denominador
(1+ arquivos) e sonda negativa (um procedencia.json sem licenca TEM de ser
acusado). O defeito de ferramenta e documentado na skill
`falsifiable-gates` e afeta 13 ∅-crit ja escritos no PROGRAMA.

## Consequencias

**Positivas**

- Cache quente ou frio, rede aberta ou fechada, a saida e a mesma — e os
  dois lados sao testados (fetch que explode no cache frio; guarda de rede
  em processo e namespace do kernel no cache quente).
- Trocar tema, gramatica, motor, fonte ou tabulacao e cache miss
  barulhento: o parametro esta na chave, o cassete deixa de ser encontrado.
- O cassete e sosia por vacuidade verificavel: zero chamadas gravadas, zero
  corpo, nada a "consertar".
- O artefato e auto-contido: F1-08 importa o tipo e le o JSON, sem importar
  tema, gramatica ou este estagio.

**Negativas**

- O destaque e de qualidade menor que um motor real (D3): trechos que um
  lexer verdadeiro classificaria ficam em `texto`/`identificador`. A troca
  fica para quando S-1 abrir (AB-450), com diff de tokens como gate
  (AB-451).
- A paleta de destaque nao tem nome proprio no design system (AB-452).
- Os bytes dos artefatos vivem dentro do cassete, nao no store — um clone
  tem o cassete, e a composicao (W5+) precisa da ponte (AB-455).
- O custo cold-start do lexer para blocos grandes nao tem teto medido
  (AB-453), e a cobertura de linguagens da fixture canonica e um unico
  no de TypeScript (AB-456).

**Riscos**

- O tripwire de vocabulario de rede e a guarda de rede sao a superficie de
  erosao deste ADR: um `fetch` novo dentro de `src/resolucao/codigo/**` ou
  uma porta de fuga no guarda passariam despercebidos sem as sondas
  negativas que os acompanham. Elas existem nos dois lados (teste e
  receita) e sao executadas na suite offline.
- `identidade.versao` e disciplina humana, como em todo estagio; o gate
  `res-codigo` pega o caso em que a saida mudou e o cassete nao foi
  regravado (frescor).

## Itens de ledger ligados

- **AB-450** — motor de destaque e lexer caseiro; quando package.json
  (S-1) abrir, avaliar motor TextMate/Oniguruma.
- **AB-451** — equivalencia de tokens entre o lexer deste card e um motor
  real nunca medida.
- **AB-452** — paleta de destaque sem nome proprio no design system;
  quando S-5 abrir, criar grupo `sintaxe` em tokens.ts.
- **AB-453** — custo cold-start do destacador para ~60 linhas sem teto em ms.
- **AB-454** — a pilha `fontFamily.mono` precisa resolver para as fontes
  locais embutidas; conferencia no render.
- **AB-455** — o contrato nao tem campo para o conteudo enderecado; os
  bytes moram no cassete, ponte para o store pendente.
- **AB-456** — cobertura de linguagens do lexer vs manifestos reais da
  autoria (W6+).

## Reafirmacoes

- **ADR-0001** (oraculo): cada checagem do gate tem sonda negativa ou
  denominador — mutacao detectada, sonda de credencial, denominador de
  arquivos, denominador de nos.
- **ADR-0005** (segredos): o gravador varre credencial e recusa gravar; o
  cassete e revarrido byte a byte pelo gate.
- **ADR-0006** (contrato de estagio): contrato cumprido — `entrada.fetch`
  (nunca usado; e o ponto do card), `identidade.versao` bumpada se
  `resolver()` mudar, `procedencia.licenca` obrigatoria, zero URL na
  parcial (C7), `paraProcedenciaDoStore()` via cassete.
- **AGENTS.md Regra 2**: nenhuma cor inventada fora de `src/design/tokens.ts`.
- **AGENTS.md S-1, S-4, S-5**: nao tocados por este card.
