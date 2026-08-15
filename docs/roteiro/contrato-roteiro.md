# Contrato do domínio de roteiro (Roteiro.1)

**Status: CONTRATO CONGELADO (Onda 1).** Este documento define **o que é** o
domínio de roteiro do app web; `src/roteiro/contrato/` define os tipos, o
schema e a validação; `docs/roteiro/api.md` define a superfície REST. A Onda
2 (gerador + construtor de manifesto) implementa contra **este** contrato; a
Onda 5 (servidor) persiste; a Onda 6 (SPA) exibe.

## 1. O domínio

O roteiro é a ponte entre o **usuário** e o pipeline de vídeo. O pipeline
existente é CLI-only: `Manifesto.1` → cinco estágios de resolução → ponte
AB-550 → render. O site acrescenta uma camada nova acima disso: o usuário
descreve o que vai fazer (brief), o **gerador** (LLM, Onda 3) produz um
**roteiro dividido em pedaços**, o **construtor de manifesto** (Onda 3)
transforma cada pedaço em **uma cena** do `Manifesto.1`, e o resto do
pipeline existente (resolução, composição, render) faz o vídeo.

Um **pedaço** é o slide do site: **uma fala** (o texto narrado) + **um
visual** (animação estilo 3blue1brown, gráfico, gif, vídeo anexado, ou
texto/lista/cabeçalho) + **como será produzido** (o texto que a UI mostra
antes de qualquer preview) + **o estado da narração**.

## 2. Pedaço — campos e regras

Tipos: `Pedaco`, `NarracaoPedaco` em `src/roteiro/contrato/contrato.ts`;
schema em `src/roteiro/contrato/schema/roteiro.schema.json` (`$defs/Pedaco`)
e `pedaco.schema.json` (alias isolado). Todo objeto tem
`additionalProperties: false` — **o schema é o único contrato** (FQ-C2).

| Campo | Regra |
|---|---|
| `id` | `p-<indice>` com 3 dígitos (ex.: `p-002`). Estável por posição: regenerar um pedaço **não** renumera os irmãos. O sufixo numérico tem de casar `indice` (regra `id-nao-casa-indice`). |
| `indice` | Posição 0-based; os índices do roteiro são contíguos `0..n-1` na ordem do array (regra `indices-nao-contiguos`). |
| `titulo` | Não vazio (a UI exibe). |
| `fala` | O texto narrado. **String vazia = sem fala** — e sem fala não há narração (regra `narracao-fala-vazia`). |
| `duracao_segundos` | Positiva. Em **segundos** (nunca frames — frame é derivado do fps no render; ADR-0010). |
| `tipo_visual` | Vocabulário fechado (seção 3). |
| `especificacao_visual` | O que o visual mostra (texto livre que o construtor interpreta). Não vazio. |
| `detalhes_de_producao` | O texto que a UI exibe sobre **como** o pedaço será feito. Não vazio. |
| `narracao` | Estado da narração (seção 7). |
| `anexo_hash` | SHA-256 do anexo do usuário (gif/vídeo). **Obrigatório** com `tipo_visual` `gif`/`video`, **proibido** nos demais (regras `anexo-exigido-para-gif-video` / `anexo-proibido-outros`) — C7: nada de URL, endereço por conteúdo. Mutável **somente** pela rota de anexo (`PUT/GET/DELETE anexo`) — análogo à narração, edição de texto não o mexe (regra `edicao-anexo-proibido`). |
| `anexo_meta` | Metadado do anexo, sempre junto de `anexo_hash`: `{tipo, tamanho_bytes, nome_original}` — `tipo` na allowlist fechada `image/gif \| video/mp4 \| video/webm` (regra `anexo-tipo-permitido`), `tamanho_bytes` ≤ 200 MB (regra `anexo-tamanho-limite`; constante `ANEXO_TAMANHO_MAXIMO_BYTES` em `contrato.ts` — fonte única). |

### As regras nomeadas de narração

Cada regra tem nome estável (constantes em `src/roteiro/contrato/validar.ts`)
e aparece na mensagem de rejeição — é o que o FQ-C1 exige ("erro nomeado"):

| Regra | O que exige |
|---|---|
| `narracao-fala-vazia` | `fala == ""` ⟹ narração `{texto: "", origem: "nenhuma", status: "vazio"}` |
| `origem-nenhuma-com-estado` | origem `nenhuma` ⟹ status `vazio` e texto `""` |
| `status-vazio-com-origem` | status `vazio` ⟹ origem `nenhuma` |
| `gravacao-sem-hash` | origem `gravacao` ⟹ `hash_audio` presente |
| `hash-sem-gravacao` | `hash_audio` presente ⟹ origem `gravacao` (TTS não tem hash no pedaço) |
| `gerado-sem-origem` | status `gerado` ⟹ origem `tts` ou `gravacao` |
| `gerado-dessincronizado` | status `gerado` ⟹ `narracao.texto == fala` (o áudio corresponde ao texto de que foi gerado) |
| `editado-sincronizado` | status `editado` ⟹ `narracao.texto != fala` (a fala mudou depois da geração — áudio stale) |
| `anexo-exigido-para-gif-video` | `tipo_visual` `gif`/`video` ⟹ `anexo_hash` + `anexo_meta` presentes (400 no PATCH que define gif/vídeo sem anexo) |
| `anexo-proibido-outros` | `tipo_visual` ≠ `gif`/`video` ⟹ `anexo_hash`/`anexo_meta` ausentes |
| `anexo-tipo-permitido` | `anexo_meta.tipo` ∈ `{image/gif, video/mp4, video/webm}` (allowlist fechada) |
| `anexo-tamanho-limite` | `anexo_meta.tamanho_bytes` ≤ `ANEXO_TAMANHO_MAXIMO_BYTES` (200 MB) |
| `edicao-anexo-proibido` | `EdicaoPedaco` nunca carrega `anexo_hash`/`anexo_meta` — anexo muda só pela rota de anexo |
| `juntar-fala-sem-narracao` | gate do juntar: pedaço com `fala != ""` e origem `nenhuma` → 409 listando os pedaços (nunca entrega fala muda — C1) |

## 3. Vocabulário fechado do visual

| `tipo_visual` | O que é | Para o construtor (Onda 3) |
|---|---|---|
| `manim` | Animação estilo 3blue1brown (formas, equações MathTex) | Cena via **estágio `grafico`** (`src/resolucao/grafico/estagio.ts` — o runner Manim headless; se o vocabulário de nós do Manifesto.1 não expressar a animação, o construtor resolve o mapeamento — é dele, não do contrato) |
| `grafico` | Gráfico de dados (barras/linha/pizza/área/dispersão) | `NoGrafico` (mesmo estágio `grafico`) |
| `gif` | GIF anexado pelo usuário | `NoMidia {tipo_midia: "gif", hash: anexo_hash}` — resolução `midia`; `anexo_meta` guarda tipo/tamanho/nome do arquivo original |
| `video` | Vídeo anexado (ex.: gravação de tela) | `NoMidia {tipo_midia: "video", hash: anexo_hash}` — resolução `midia`; `anexo_meta` guarda tipo/tamanho/nome do arquivo original |
| `texto` | Texto em destaque | `NoTexto` |
| `lista` | Lista de itens | `NoLista` |
| `cabecalho` | Cabeçalho/título (tipicamente sem fala) | `NoCabecalho` |

## 4. Roteiro — regras do documento

`Roteiro = { schema_version: "Roteiro.1", pedacos[1..40], duracao_total_segundos }`.

- **Indices contíguos** `0..n-1` na ordem do array (regra `indices-nao-contiguos`).
- **Ids únicos** (regra `ids-duplicados`); sufixo do id casa o índice
  (regra `id-nao-casa-indice`).
- **`duracao_total_segundos` == soma das `duracao_segundos`** (tolerância
  0.01s, regra `duracao-total-inconsistente`). O manifesto que o construtor
  monta carrega essa soma até a fronteira (FQ-M2 confere com tolerância 1s —
  a tolerância do manifesto é do construtor, a do roteiro é 0.01s).
- **Bump de versão = novo arquivo de schema**, nunca edição no lugar
  (mesma regra do Autoria.1): `Roteiro.1` → `Roteiro.2` com
  `roteiro.2.schema.json` + `migrate()`. O bump entra na chave de cache do
  gerador (FQ-C3).

## 5. Pedaço → cena do Manifesto.1 — e onde mora a ponte AB-550

**Cada pedaço vira UMA cena do Manifesto.1** (decisão D1 do plano):

- `cena.id` — derivado do pedaço (o construtor escolhe a forma; sugestão
  `c-<indice>`); `cena.nos` — os nós do vocabulário existente
  (seção 3); `cena.audio_cena` — presente **só quando
  `narracao.origem ∈ {tts, gravacao}`**, com `audio_cena.texto_locucao =
  narracao.texto` (é o campo que o estágio `locucao` consome —
  `src/resolucao/locucao/estagio.ts`).
- **RECORD-FIRST (emenda):** pedaço com fala ainda não narrada (origem
  `nenhuma` — o estado normal do roteiro recém-gerado) **não tem**
  `audio_cena`: a cena renderiza silenciosa no preview (a UI mostra o botão
  de gravação). A fala muda nunca chega ao vídeo final — o gate do juntar
  (seção 8) a bloqueia com 409 antes de montar o vídeo.
- **Nenhuma URL no manifesto resolvido (C7):** o gif/vídeo entra pelo
  `hash` dos bytes (`NoMidia.hash`), o áudio gravado entra pelo `hash_audio`
  resolvido na locução, e a licença vem da procedência do store (a ponte
  recusa asset sem licença — `REGRA_LICENCA_DE_PROCEDENCIA`).

**A ponte AB-550** (o nome que o ledger usa para a fronteira
RESOLUCAO/COMPOSICAO) mora em **`src/render/pipeline/ponte.ts`**:
`atravessarPonte()` recebe o `Manifesto.1` já montado (com assets e
procedências) e devolve o `ManifestoResolvido.1` que a composição consome —
validando integridade referencial (`cena.nos` → nós existentes),
recalculando o SHA-256 dos bytes de cada asset (chave declarada tem de
casar os bytes — C7) e recusando asset sem licença. O construtor da Onda 3
**não reimplementa** essa ponte: ele monta o `Manifesto.1` a partir do
`Pedaco[]` e entrega ao fluxo existente (`resolver()` do orquestrador de
resolução + `atravessarPonte`), reduzido a um pedaço para o preview
(FQ-M3: manifesto reduzido de um pedaço tem a duração do pedaço e só os
nós dele).

## 6. ProjetoRoteiro e as edições do usuário (C12)

`ProjetoRoteiro = { id, brief, roteiro?, pedacos_editados, criado_em, atualizado_em }`.

- `pedacos_editados` é `Record<id do pedaço, EdicaoPedaco>` — a **fonte de
  verdade das edições**, chaveada por id. O que o usuário pode editar:
  `titulo`, `fala`, `duracao_segundos`, `tipo_visual`,
  `especificacao_visual`, `detalhes_de_producao`. **Nunca**: `id`,
  `indice`, `narracao` (identidade e áudio mudam só pelos endpoints de
  narração) e `anexo_hash`/`anexo_meta` (o anexo muda só pela rota de
  anexo — regra `edicao-anexo-proibido`).
- A aplicação de uma edição é `editarPedaco` (`src/roteiro/contrato/edicao.ts`):
  valida o delta (delta inválido = rejeição nomeada), merge raso com as
  travas de identidade, e aplica as regras de narração quando a `fala`
  muda: pedaço **já narrado** (status `gerado`) vira `editado` (o áudio
  corresponde ao texto antigo — stale); pedaço **nunca narrado** continua
  `vazio`; **apagar a fala** limpa a narração inteira (volta a
  `{texto: "", origem: "nenhuma", status: "vazio"}` — os bytes do áudio
  permanecem no store por hash, S-8).
- **Sobrevivência:** regenerar um pedaço substitui **só ele**; as edições
  dos irmãos permanecem em `pedacos_editados` e são aplicadas no GET e
  **entram na chave do gerador** quando o usuário regenera um pedaço
  (FQ-G3: mudou a fala editada, mudou a saída — a edição faz parte do
  `pedido_atual` do `PedidoRegenerarPedaco`). Regenerar o roteiro INTEIRO
  renumera; edições órfãs (id que não existe mais) são podadas pelo
  servidor.
- O servidor persiste em `dados/projetos/<id>/` (JSON atômico S-8) e valida
  no load com `validarProjetoRoteiro`.

## 7. Narração — origem, estado e formato

- **POLÍTICA RECORD-FIRST (emenda):** o **gerador nunca emite narração** —
  todo pedaço gerado sai com `narracao {texto: "", origem: "nenhuma",
  status: "vazio"}` — e **nunca emite `gif`/`video`** na primeira geração:
  anexo é decisão do usuário, via rota de anexo + edição do `tipo_visual`
  (as regras `anexo-exigido-para-gif-video`/`anexo-proibido-outros` já
  tornariam gif/vídeo sem anexo inválido — o gerador nem tenta). A voz
  entra **depois**, por `gravacao` (a rota `narracao/audio`) ou por `tts`
  (se o provedor estiver configurado; o TTS real está indisponível neste
  ambiente — HTTP 429 `credit_balance_exhausted` — e o sosia é mock de
  gravação, então a narração gerada automaticamente não é um caminho
  obrigatório).
- `origem`: `tts` (provedor existente, se configurado) · `gravacao` (a voz
  do usuário) · `nenhuma` (pedaço sem fala ou sem narração — FQ-N4: pedaço
  sem narração não quebra preview; o **juntar** é quem bloqueia fala não
  narrada, seção 8).
- `status`: `vazio` (nada gerado) · `gerado` (áudio existe e corresponde a
  `narracao.texto == fala`) · `editado` (a `fala` mudou depois da geração —
  `narracao.texto` aponta para o texto antigo; o áudio está stale até
  regenerar/regravar). `editado` só existe quando **havia** narração —
  pedaço nunca narrado que tem a fala editada continua `vazio` (não há
  áudio para ficar stale; a regra `origem-nenhuma-com-estado` proíbe
  `editado` sem origem). A regra `gerado-dessincronizado` é a transposição da
  calibração de locução ("áudio novo com timing velho dessincroniza sem
  erro") para o nível do roteiro: **o áudio é sempre o do texto
  `narracao.texto`**, nunca o da `fala` corrente.
- **Formato do áudio gravado (congelado, D4):** o navegador grava com
  MediaRecorder (webm/opus); o servidor converte para **wav 48 kHz estéreo**
  (FORMATO_AUDIO_GRAVADO) e `hash_audio` é o SHA-256 **desse wav** — os
  bytes que o pipeline consome, com dedupe por hash (S-8, FQ-N1: mesmo
  arquivo 2x = mesmo hash). Conversão determinística (ffmpeg com parâmetros
  fixos — nunca timestamps de relógio).
- **Sem whisper para gravação (D4):** timing da gravação = duração do áudio;
  legendas não são derivadas de gravação (só de locução com timing — o
  estágio de alinhamento pt-BR continua intocado).
- Procedência do áudio do usuário: registrada com licença pessoal e origem
  declarada (FQ-N3) — o enquadramento é o ADR-0003 (uso pessoal).

## 8. Formatos congelados de vídeo

- **Preview de pedaço:** render do manifesto reduzido de um pedaço → **mp4
  h264 yuv420p 1920x1080 30fps + aac 48k** (FORMATO_VIDEO). Determinismo por
  conteúdo (C7): cache por hash(manifesto reduzido + versões das
  ferramentas); render 2x = bytes idênticos (FQ-P1). Nunca quadro preto
  aprovado: oráculo de conteúdo (C1, FQ-P2). Manim ausente = **erro claro**
  (FQ-P3).
- **Vídeo final:** mesmos parâmetros — concat dos previews por stream-copy
  (iguais por construção) + música opcional (amix) + normalização EBU R128
  (duas passadas; alvo é decisão de dono em ADR, teto −1 dBTP) + mux final +
  SRT por pedaço com offset (só quando há timing). Determinismo bitexact
  (FQ-J3); conferência por ffprobe **por stream** (C4, FQ-J1/J4).
- **GATE de narração antes de juntar (record-first):** `verificarJuntarFalaSemNarracao`
  (`src/roteiro/contrato/validar.ts`) — pedaço com `fala != ""` e origem
  `nenhuma` → o juntar **recusa** com 409 listando os pedaços (regra
  `juntar-fala-sem-narracao`). Nunca entregar fala muda: é o oráculo
  negativo do e2e para o modo de falha C1 (vídeo final sai "ok" e mudo).

## 9. A fronteira de determinismo

O roteiro fica **acima** da fronteira: é gerado por LLM (não determinístico,
cacheado por hash — FQ-G1) e editado por gente. Mas **nada que atravessa a
fronteira carrega impureza**:

- **Nenhuma URL** no roteiro, no manifesto, no manifesto resolvido (C7) —
  anexos e áudio por SHA-256 de conteúdo, trilha por caminho de disco do
  servidor.
- **Nenhum tempo relativo** — durações em segundos, convertidas para frames
  no render (ADR-0010); `duracao_total_segundos` é soma das durações.
- A chave de cache do gerador é `sha256(canonical_json(pedido))`
  (`src/roteiro/contrato/cache.ts`) — o pedido inteiro, incluindo as três
  versões (contrato, contrato do gerador, gerador): **bump de versão =
  MISS** (FQ-C3), e qualquer mudança de entrada (brief, duração, edição,
  resumo dos irmãos) = MISS (C12).
- O manifesto resolvido continua livre de URL — a ponte AB-550 (seção 5)
  é quem garante, recusando o que tentar atravessar.

## 10. CLIs de operação pesada (D11)

Toda operação pesada é um CLI com entrada JSON em stdin, saída JSON em
stdout e estado de progresso em arquivo (argumento `--estado <path>` ou env
`ROTEIRO_ESTADO_PATH`). A convenção completa está em `docs/roteiro/api.md`
§"CLIs de operação pesada" — este contrato de domínio a incorpora por
referência.
