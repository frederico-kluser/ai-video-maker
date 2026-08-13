# ADR-0041 — Cache de render por conteudo: chave C7, fronteira de codec e unidade por frame absoluto

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F5-09 (W8, render)
- **Numero pre-alocado:** docs/contrato-w8.md §5 (F5-09 -> 0041)
- **Porta TCP reservada:** 4509 (docs/contrato-w8.md §5)
- **Faixa de ledger:** AB-790..AB-799 (ledger/inbox/F5-09.json)
- **Depende de:** F5-01 (pipeline, W7 — `CODIFICADORES_DA_COMPARACAO` de
  `src/render/pipeline/codificacoes.ts`, leitura), F0-07 (store
  enderecado por conteudo), ADR-0032 (tetos medidos, decisao 4 — teto de
  disco), ADR-0035 (delimitacao da comparacao byte a byte por codec),
  ADR-0036 (determinismo declarado por perfil), AB-684, AB-685, AB-691,
  AB-700
- **Guarda executavel:** `just render-cache` com exit 0, sonda de
  cache-miss incluida (o gate do proprio card)

## Contexto

O F5-09 cria o cache de render e sua invalidacao. O card define o
∅-crit: **mudar um token de design tem de invalidar o cache de render**
(PROGRAMA.html), e as perguntas adversariais mandam: a chave inclui a
versao do compositor e a do navegador? Um cache acertando pelo motivo
errado e detectavel? A invalidacao e por conteudo ou por data — **por
data e falso verde**.

Tres itens de ledger do irmao F5-01 (W7) governam a forma:

- **AB-691** — o `renderFrames` do Remotion nomeia os frames pelo frame
  ABSOLUTO (`frame-[frame].png`); o pipeline fixa esse pattern e compara
  por indice absoluto. A unidade do cache herda isso: frame, nao faixa.
- **AB-685** — um worker morto deixa o pipeline VERDE se o gate so prova
  com cache quente; a sonda de cache-miss do gate e a camada que detecta
  "acertar a chave e nao re-renderizar".
- **AB-684** — `memTotal` lido em runtime difere da referencia do I-03; o
  orcamento deriva o limite em runtime. Nao e conteudo — decisao 2.

## Decisoes

### 1. A chave e por CONTEUDO (C7): cinco componentes obrigatorios

`chave = H(manifesto resolvido) + H(assets) + H(tokens consumidos) + H(versao do codigo/compositor/navegador) + pin das ferramentas`

1. **`H(manifesto resolvido)`** — hash do manifesto resolvido que o
   render consome;
2. **`H(assets)`** — re-hash dos BYTES dos assets referenciados. O cache
   nao confia no hash declarado no manifesto: o que importa sao os bytes
   que serao LIDOS do store de F0-07, e eles sao hasheados na chave;
3. **`H(tokens consumidos)`** — o cache importa os valores de S-5
   (`src/design/tokens.ts`) que o render consome, por LEITURA, e os
   hasheia. Mudar um token de design invalida o cache (o ∅-crit do card)
   — e a invalidacao acontece pela chave, nao por comparacao de data;
4. **`H(versao do codigo / compositor / navegador)`** — a versao do
   compositor e a do navegador (Chrome empacotado do Remotion) entram na
   chave: bump de Remotion = novo rasterizador = bytes diferentes, e a
   chave tem de acender o miss sozinha;
5. **`pin das ferramentas`** — versoes pinadas (node, ffmpeg) na chave,
   mesmo padrao de `MixDocument.ferramentas` (F3-05): determinismo entre
   versoes e declarado, nunca assumido.

### 2. NUNCA na chave: data, `memTotal`, workers, plano de faixas, porta, env de agendamento

- **data/hora e mtime** — por data e o falso verde do card: tocar um
  arquivo sem mudar conteudo nao e mudanca de saida;
- **`memTotal` (AB-684)** — a leitura em runtime do orcamento muda a
  CONCORRENCIA (workers derivados de RAM), nunca o CONTEUDO da saida.
  Dois renders do MESMO conteudo em maquinas com RAM diferente tem de
  acertar o MESMO cache; incluir `memTotal` na chave transformaria o
  cache em identidade de ambiente e o miss seria o default. O AB-684
  permanece aberto com o F5-01 (tripwire visivel no gate);
- **numero de workers e plano de faixas** — particionamento de execucao,
  nao conteudo;
- **porta TCP e env de agendamento** — ambiente de execucao, nao entrada
  de render.

Qualquer um desses na chave faz o cache mentir: dois renders do MESMO
conteudo divergindo por ambiente e o falso-verde que o ∅-crit persegue.

### 3. Cache de bytes delimitado pela fronteira de codec

O cache de bytes de frame so existe onde a comparacao byte a byte vale:
o card consome **`CODIFICADORES_DA_COMPARACAO`** de
`src/render/pipeline/codificacoes.ts` (F5-01, W7) por leitura — **png e
qtrle somente**. vp9/webm e mp4/h264 **nunca** viram cache de bytes,
exclusao declarada com o motivo (AB-396: vp9 nao-determinista; AB-397:
vp9 sai `yuv420p` sem alfa; MP4: encoder muda — ADR-0035). A lista de
codecs cacheaveis NAO e uma lista fechada deste card: `CODIFICADORES_DA_COMPARACAO`
pode crescer (contrato-w8 §7 — presenca, nunca lista completa).

### 4. Perfis `deterministico: false` nunca viram cache de bytes

Sem garantia de determinismo, sem golden, sem cache de bytes de frame —
NVENC (AB-700, ADR-0036 decisao 3): uma amostra unica de bytes identicos
nao e garantia. Virar cache de bytes de um perfil nao-determinista
exigiria a cerimonia de determinismo do AB-700 e a troca da declaracao
por escrito no perfil. Cache de metadado/derivado pode existir; cache de
BYTES do frame, nao.

### 5. Unidade: FRAME por indice absoluto (AB-691), nao a faixa

O cache indexa FRAMES pelo indice absoluto (`frame-[frame].png`), o
mesmo pattern fixado pelo pipeline do F5-01. O parser de nomes extrai o
indice do nome — robusto a padding entre faixas de tamanhos diferentes.
Se o Remotion mudar o naming, o parser acusa frame ausente (verde vira
vermelho) — nunca compara errado em silencio.

### 6. Teto de disco: as regras praticas da decisao 4 do ADR-0032

O cache de render e um caso de saida de render e herda as regras
praticas da decisao 4 do ADR-0032: saidas em `/tmp` (fora do filesystem
do repo), limpeza pos-render e `df /home` com >= 10 GiB livres antes de
lotes de render. Politica de evicao automatica nao e deste ADR.

### 7. Sonda de cache-miss obrigatoria (AB-685)

Um gate com cache QUENTE nao prova render: acertar a chave e nao
re-renderizar mascara um worker morto (AB-685). O gate do F5-09:

- **forca o miss** (chave fria), re-renderiza e compara contra o render
  sem cache — um cache acertando pelo motivo errado tem de ser
  detectavel;
- **mutacao:** token de design MUDADO com cache QUENTE fica VERMELHO (o
  ∅-crit do PROGRAMA exercitado com o cache cheio — a chave tem de mudar,
  e o miss tem de ser observado).

## Consequencias

- O F5-09 consome `src/render/pipeline/codificacoes.ts` por LEITURA e os
  tokens por LEITURA (S-5) — nunca edita arquivo do F5-01 nem do F0-04.
- O F5-07 (W9) consome o cache com a chave C7: a retomada por estagio usa
  a chave, e "cache velho quando a entrada mudou" (pergunta adversarial 3
  do F5-07) e detectado pela comparacao de chaves, nao por data.
- `just render-cache` falha se: token mudado com cache quente, cache
  quente sem re-renderizacao provando render, codec fora de
  `CODIFICADORES_DA_COMPARACAO` virando cache de bytes — todos VERMELHO.
- AB-684 fica registrado aqui como decidido (fora da chave) e permanece
  aberto com o F5-01 (a leitura em runtime do orcamento continua sendo a
  fonte de concurrency).

## O que este ADR NAO decide

- **Onde o cache de bytes vive** (dentro do store de F0-07 vs diretorio
  proprio) — decisao do card, dentro do teto de disco (decisao 6).
- **Politica de evicao e limpeza automatica** — operacao, nao gate.
- **Golden de bytes do pipeline final** — e do F5-07 (W9)/W10.
- **Como o F5-07 decide o que re-renderizar** — a politica de retomada
  por estagio e dele, com a chave C7 como comparacao.

## Alternativas descartadas

- **Chave por data/mtime** — falso verde do card: tocar um arquivo sem
  mudar conteudo invalida (ou nao invalida) o cache pelos motivos
  errados; dois renders do mesmo conteudo nunca acertam se o filesystem
  gravou mtime diferente.
- **Chave pelo hash declarado no manifesto sem re-hash de bytes** — o
  store de F0-07 e enderecado por conteudo, mas o cache nao pode confiar
  na declaracao: os bytes que serao LIDOS sao os que importam (decide o
  H(assets)).
- **Cache de bytes para NVENC** — uma amostra unica de bytes identicos
  nao e garantia (AB-700); o cache de bytes de perfil nao-determinista
  piscaria vermelho por motivo de sessao/driver, nao por regressao.
- **Cache por faixa em vez de frame** — a faixa e particionamento de
  execucao; o frame absoluto (AB-691) e a unidade que sobrevive a
  mudanca de particionamento entre execucoes.
