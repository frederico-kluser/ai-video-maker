# ADR-0008 — Fontes locais embutidas e assercao da familia resolvida

- **Status:** aceito
- **Data:** 2026-08-11
- **Card:** F1-03
- **Depende de:** ADR-0001 (todo card tem oraculo), F0-04 (tokens), T-01 (esqueleto)

## Contexto

`AGENTS.md`, C6: *"Uma fonte que nao carregou cai para fallback sem erro."*

Esse e o modo de falha mais barato de introduzir e o mais caro de detectar neste
projeto. O render sai com exit 0, o quadro tem pixel, o video tem texto legivel —
e a tipografia esta errada. Nenhum gate baseado em "renderizou?" enxerga isso.

Pior: a deteccao ingenua tambem nao enxerga. Comparar o quadro renderizado com um
quadro de referencia so responde *"ficou diferente?"*. Duas fontes grotescas
parecidas (Inter e Roboto, Helvetica e Liberation Sans) produzem quadros que
passam por qualquer limiar razoavel — e, no Linux do CI, o fontconfig substitui
`Helvetica` por `Liberation Sans` em silencio, produzindo um quadro perfeitamente
plausivel a partir de uma fonte que nunca foi carregada.

## Decisao

### 1. Carregamento: `@remotion/fonts` `loadFont()`, nunca `@font-face` puro

`loadFont()` abre um `delayRender()` antes de buscar o arquivo e so chama
`continueRender()` depois de `FontFace.load()` resolver; no `catch`, chama
`cancelRender(err)`.

Consequencias, nesta ordem de importancia:

1. O render **espera** a fonte. A doc e explicita: *"Automatically blocks the
   render until the font is ready."*
   (https://www.remotion.dev/docs/fonts-api/load-font)
2. Uma fonte que **nao carrega derruba o render**. Nao existe o caminho
   "seguiu em frente com fallback".

Um `@font-face` em CSS nao oferece nenhuma das duas. O Remotion nao tem como
saber que ha uma fonte pendente e captura o quadro quando bem entender. Nao ha
aviso na documentacao sobre isso — e justamente por isso a escolha vira ADR.

### 2. Localizacao dos bytes: `assets/fontes/`, exposta por link simbolico

Os `.woff2` canonicos vivem em `assets/fontes/`, junto das fichas de licenca.
`public/fontes` e um link simbolico relativo para `../assets/fontes`.

Alternativas descartadas:

- **Copiar os arquivos para `public/fontes/`** — duas copias dos mesmos bytes,
  que divergem no primeiro merge.
- **`bundle({ publicDir: "assets" })` + `remotion.config.ts`** — funciona, mas
  exige criar um arquivo de configuracao compartilhado que nenhum card possui
  ainda, e que colidiria com irmaos da mesma onda. Com o link simbolico,
  `staticFile()` funciona com a configuracao padrao do Remotion (Studio, CLI e
  `bundle()` programatico) sem tocar em nenhum arquivo compartilhado.

Custo aceito: repositorio com link simbolico nao funciona em Windows sem modo
desenvolvedor. O projeto ja depende de `bash`, `ffmpeg` e `just`.

### 3. Peso e estilo fazem parte da identidade

"Inter" nao e uma fonte. `FONTES_LOCAIS` registra *familia + peso + estilo +
formato*, e cada entrada declara tambem o que o binario deve dizer
(`OS/2.usWeightClass`, `name` ID 2). O formato e declarado explicitamente em vez
de ser inferido pela extensao da URL.

Sem isso, pedir `font-weight: 700` de uma familia registrada so em 400 faz o
Chrome **sintetizar** o negrito. O texto fica negrito, o quadro fica plausivel, e
a fonte que o designer escolheu nunca apareceu.

### 4. O oraculo: ler a familia resolvida, nunca comparar pixels

`tests/design/font-resolve.test.ts` renderiza um still de verdade
(`renderStill`) e, no MESMO render, colhe evidencia de dentro do navegador por um
`<Artifact>`, entregue ao Node pelo callback `onArtifact`.

A evidencia nao contem imagem. Contem **nomes**:

- o `FontFaceSet` do documento (`family`, `weight`, `style`, `status`) — e
  `status === "loaded"` so acontece depois que o navegador baixou e parseou o
  arquivo;
- por sonda: a pilha CSS **computada** no elemento, percorrida na ordem em que o
  motor de matching a percorre, ate a primeira familia com `FontFace` registrada
  e carregada — esse e o nome da familia efetivamente resolvida;
- a resposta de `document.fonts.check(shorthand, texto)` com o shorthand
  computado do proprio elemento e o texto exato dele, ou seja, o algoritmo de
  matching do navegador respondendo sobre aquele elemento.

As sondas partem dos **tokens** (`fontFamily.sans`, `fontFamily.display`,
`fontFamily.mono`), nao de strings escritas a mao no teste. Trocar o token por
uma familia nao embutida deixa o gate vermelho.

### 5. Duas sondas negativas, porque um oraculo que so diz "sim" nao e oraculo

- **Sonda de controle, no mesmo still:** um elemento com familia jamais
  registrada. A leitura tem de devolver "nenhuma familia resolvida". Sem ela, um
  leitor que respondesse "resolveu" para qualquer coisa passaria no gate (C2).
- **Composicao `fontes-arquivo-ausente`:** pede um arquivo que nao existe. O
  `renderStill` **tem de rejeitar**. Se esse render sobrevivesse, uma fonte
  faltando cairia em fallback e todo o resto do arquivo seria decorativo.

### 6. Licenca: o direito de embutir e verificado, nao so declarado

Embutir e uma permissao **separada** de usar e de redistribuir. Duas fontes de
verdade, ambas conferidas por teste:

- **`OS/2.fsType` dentro do binario.** `0x0000` = *Installable Embedding*, sem
  restricao. `0x0002` (*Restricted License Embedding*) proibiria. `tools/woff2-inspect.ts`
  abre o `.woff2` (brotli do `node:zlib`, zero dependencia nova) e le o bit.
- **SIL OFL 1.1**, cuja clausula PERMISSION lista `embed` explicitamente, e cuja
  FAQ 1.1 cita *video titling* como uso permitido e 1.12 autoriza embutir em
  documento.

Cada familia tem ficha em `assets/fontes/*.md` com `licenca:`,
`direito_de_embutir:`, `os2_fstype:` e o **sha256 de cada arquivo**. O teste
compara o hash declarado com o arquivo no disco: trocar a fonte sem reexaminar a
licenca deixa o gate vermelho.

Como o bundler serve o `.woff2` inteiro por HTTP local — o que a OFL-FAQ 1.15
trata como *bundling*, nao *embedding* puro — a clausula 2 da OFL se aplica e
`assets/fontes/OFL.txt` viaja junto com os binarios. O teste confere que o
`OFL.txt` traz o aviso de copyright que cada binario declara em `name` ID 0.

## Consequencias

- Toda fonte nova entra por `FONTES_LOCAIS` **e** por uma ficha `.md`. O teste
  falha nos dois sentidos: fonte sem ficha e ficha sem fonte.
- O gate depende de Chrome Headless Shell (o mesmo do render — C5). Ambiente sem
  navegador fica vermelho, nao pulado.
- `tools/woff2-inspect.ts` so le tabelas nao transformadas (`name`, `OS/2`,
  `head`, `post`). Uma fonte com `glyf`/`loca` transformadas continua legivel;
  uma com `name` transformada lancaria — nao acontece na pratica.

## Verificacao

```
just fontes-testar     # still + familia resolvida + sondas negativas
just fontes-licenca    # ficha por familia + OS/2.fsType + sha256
just fontes-offline    # zero fonte remota em src/
```

Sonda de mutacao executada na entrega (as duas ficaram vermelhas, como devem):

| mutacao | efeito no pixel | resultado do gate |
|---|---|---|
| `fontFamily.sans` -> `"Helvetica, Arial, ..."` | quadro plausivel (fontconfig substitui) | `sonda "sans-regular"`: *o motor de fontes resolveu null* |
| `Inter-Bold.woff2` registrada com peso 400 | negrito sintetizado, quase identico | `peso e estilo ... batem com o binario` + `sonda "display-bold"` vermelhas |

## Nota sobre o nome das receitas

O card pediu `just fontes:testar`. `just` 1.42 nao aceita `:` em nome de receita
— ele le `a:b` como *"receita a depende de b"*. O `justfile` deste repositorio ja
esta impossivel de parsear desde antes deste card (`validar-grafo:selftest:`,
linha 138, e mais nove receitas no mesmo padrao). O bloco `# === F1-03 ===` usa a
convencao que funciona no mesmo arquivo (`design-gerar`, `design-testar`):
hifen. Ver `ledger/inbox/F1-03.json`, item AB-271.
