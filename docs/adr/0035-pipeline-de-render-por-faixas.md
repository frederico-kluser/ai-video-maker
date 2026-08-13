# ADR-0035 — Pipeline de render por faixas: paralelismo com comparacao byte a byte

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F5-01 (W7, hub)
- **Depende de:** I-03 (tetos medidos, ADR-0032), F1-12 (fixture canonica
  integrada, o oraculo do render), F3-03 (envelope de ducking), F3-04
  (cadencia/ritmo), F0-07 (store de assets por hash), AB-550 (a ponte,
  este card), PREP-w7 (pintor promovido, AB-493)
- **Faixa de ledger:** AB-680..AB-699 (ledger/inbox/F5-01.json)
- **Numero pre-alocado:** docs/contrato-w7.md §10 (F5-01 -> 0035)
- **Porta TCP:** 4501 (docs/contrato-w7.md §11)

## Contexto

O F5-01 e o hub da W7: implementa o pipeline de render de ponta a ponta
sobre a fixture canonica integrada (composicao `integrado`, 727 frames,
1920x1080@30fps) e responde as quatro perguntas adversariais do card:

1. **A concatenacao de faixas produz o mesmo resultado que o render
   continuo?** Se nao, o paralelismo e ilusorio.
2. **A concorrencia excede o teto medido do I-03?** (workers <= 8, RAM <=
   24 GiB — ADR-0032; MemTotal lido em runtime, AB-986).
3. **Um worker que morre deixa o pipeline verde?**
4. **A ponte AB-550 esta aplicada** (campos preenchidos com fonte nomeada
   + integridade referencial cena.nos)?

## Decisoes

### 1. O ∅-crit (faixa == inteiro) e DELIMITADO ao codec deterministico (PNG/QTRLE); vp9 e MP4 ficam excluidos por declaracao, com o motivo no codigo

A comparacao byte a byte entre o render por faixa + concatenacao e o
render inteiro vale SOMENTE onde o encoder e deterministico. A delimitacao
vive em `src/render/pipeline/codificacoes.ts` — cada codec com o motivo ao
lado (`CODIFICADORES_DA_COMPARACAO`):

- **PNG (permitido):** o artefato da comparacao e a sequencia de frames —
  cada faixa e o render inteiro sao renderizados como PNG (`renderFrames`
  com `imageFormat: "png"`), e os bytes de CADA frame da concatenacao das
  faixas tem de ser identicos ao frame correspondente do render inteiro.
  PNG e codificacao intra-frame lossless sem metadado de container: a
  igualdade de bytes prova a propriedade que o card persegue, sem oraculo
  falso de container.
- **QTRLE (permitido):** o mesmo casamento e conferido em arquivos de
  video reais — cada faixa vira um `.mov` qtrle/argb (o codec
  deterministico do cassete de grafico do F2-02), os trechos sao
  concatenados com o concat demuxer do FFmpeg (`-c copy`, zero reencode)
  e a comparacao e por frame DECODIFICADO (`framemd5`, a camada 1 da
  video-characterization): 727/727 hashes tem de bater com o `.mov` do
  render inteiro.
- **WebM vp9 (EXCLUIDO por declaracao):** AB-396 (vp9 nao-determinista) e
  AB-397 (vp9 sai yuv420p sem alfa). Comparar bytes de vp9 e medir ruido
  do encoder, nao regressao da composicao.
- **MP4 final (EXCLUIDO por declaracao):** AB-396/AB-397 — o encoder muda
  (versao, parametros, metadado) e a comparacao byte a byte contra o
  render inteiro e falso oraculo; e o destino do cartucho F2-02.

O comparador chama `garantirCodecComparavel` antes de comparar qualquer
byte: codec sem declaracao ou declarado excluido PARA com a mensagem —
nunca compara em silencio.

### 2. O paralelismo e real: faixas em paralelo, fase apos fase, dentro do teto de workers

O plano de faixas (`planejarFaixas`) segue o procedimento de chunks do
Remotion (R12-09): cobertura de `[0, totalFrames)` sem buracos nem
sobreposicao, todos os chunks com o mesmo numero de frames exceto o
ultimo. O executor (`renderizarPorFaixas`) roda em duas fases:

1. o render inteiro (1 arvore, workers do orcamento);
2. as faixas em PARALELO (`Promise.all`), cada uma com a sua arvore do
   Remotion, dividindo o teto: `workersPorFaixa x numeroDeFaixas <=
   workers` (AB-988: o teto e por TOTAL de workers ativos, nunca por
   faixa isolada).

A comparacao da fase 2 contra a fase 1 e o ∅-crit: se o paralelismo
alterasse qualquer pixel, o gate fica VERMELHO no primeiro frame
divergente.

### 3. A concorrencia usa a formula do ADR-0032 com MemTotal em runtime (AB-986)

`calcularOrcamento` (src/render/pipeline/orcamento.ts) implementa a
decisao 3 do ADR-0032:

```
RAM_estimada = base(1,2 GiB) x arvores simultaneas
             + (workers_totais - 1) x 0,138 GiB
             + 1,1 GiB x encodes simultaneos
             + pico_gate (3,904 GiB) quando o gate roda junto
RAM_estimada <= memTotalGiB - 7,7 GiB
workers_totais <= 8
```

Duas adaptacoes declaradas, ambas mais conservadoras que a formula
original:

- **Base por arvore simultanea:** a formula original do ADR-0032 tem uma
  base unica (medida para UMA arvore). Com N faixas em paralelo ha N
  arvores (cada renderFrames abre o proprio Chrome), entao a base entra
  N vezes e o marginal so dos workers extras. No gate (4 faixas x 2
  workers): 4 x 1,2 + 7 x 0,138 + 3,904 = 9,67 GiB <= 23,2 GiB.
- **Limite derivado do MemTotal lido em runtime** de /proc/meminfo
  (AB-986): o limite e `memTotalGiB - 7,7 GiB` — a margem do host nunca e
  consumida pelo pipeline; maquina menor reduz a concurrency
  automaticamente. `lerMemTotalGiB` e injetavel para o teste.

O gate imprime os numeros (MemTotal, limite, RAM estimada, workers) — a
pergunta adversarial 2 tem resposta escrita a cada execucao.

### 4. Worker morto derruba o pipeline (nunca verde)

`renderizarPorFaixas` PROPAGA qualquer rejeicao de render (inteiro ou
faixa) com `ErroDeRender` nomeando a faixa; o executor nunca devolve
"parcialmente pronto". A sonda negativa do gate renderiza uma composicao
inexistente e exige exit nao-zero. O renderer e injetavel (`RendererDeFrames`)
— o teste de worker-morto roda sem navegador.

### 5. A ponte AB-550 (C2) preenche a fronteira com fonte nomeada e valida a integridade referencial

`atravessarPonte` (src/render/pipeline/ponte.ts) fecha a fronteira
resolucao/composicao no ponto de consumo do render:

- **frames** — da composicao: `planoDeComposicao` (aritmetica de F1-01),
  a MESMA do timing canonico e do envelope (AB-520);
- **cores** — dos tokens: `src/design/tokens.ts` (S-1, leitura, nunca
  edicao), com o nome do token registrado ao lado do valor;
- **hash** — dos bytes dos assets: SHA-256 re-calculado (store F0-07,
  C7); chave que mente e ERRO nomeando a regra;
- **licenca** — da procedencia de F0-07 (campo `license`), nunca digitada
  a mao na ponte;
- **integridade referencial (AB-631/AB-654)** — `cena.nos` so referencia
  no existente; a mensagem de erro nomeia a regra e o caminho:

  ```
  cena "c-003": referencia no inexistente "n-999" (regra
  integridade-referencial, campo cena.nos)
  ```

O ∅-crit do gate muta a c-005 da fixture para referenciar `n-999` e exige
VERMELHO com essa assinatura.

### 6. O audio do render usa a ANCORA ABSOLUTA (C4) e a emenda pelo hash NOVO (C3)

`posicionarAudio` (src/render/pipeline/audio.ts) consome a cadencia
(Ritmo.1, F3-04) e o envelope (DuckingEnvelope.1, F3-03) PELOS CAMPOS
ABSOLUTOS (`inicio_s`/`fim_s`), com as posicoes das cenas pela aritmetica
`frameInicial/fps` (AB-520/AB-600) — e NAO recebe o manifesto: a janela
visual da cena NAO e fonte de verdade de tempo de audio (a c-004 da
fixture canonica tem janela visual de 4 s e locucao de 8,505 s; a fala
carrega alem da janela, contrato C1). A emenda (C3, AB-617) e posicionada
pelo hash NOVO do mix (F3-05); se a emenda de uma cena nao existe, a cena
fica SEM faixa — nunca cai para o hash do audio-fonte que a cadencia
preserva.

### 7. Saidas de trabalho em /tmp e sonda de espaco antes do lote (AB-984)

O gate renderiza em diretorio temporario (`/tmp`), fora do filesystem do
repo, e limpa ao fim; antes do lote, a sonda exige `df /home` com >= 10
GiB livres (a regra pratica declarada no ADR-0032, decisao 4).

## Consequencias

- O F5-09 (W8, cache de render) e o F5-07 (W9, orquestrador de ponta a
  ponta) consomem `src/render/pipeline/**` pela fachada publica
  (`src/render/pipeline/index.ts`) — o cache e a orquestracao nao
  reimplementam ponte, faixas, orcamento nem executor.
- O F5-07 herda o orcamento (`calcularOrcamento`), o plano de faixas e a
  delimitacao de codec; o render FINAL (mp4) sai pela porta do F5-02 e a
  comparacao byte a byte NAO se aplica a ele (decisao 1).
- O F3-05 (mix) e o F5-01 derivam as MESMAS posicoes dos MESMOS inputs
  (timing canonico + envelope + cadencia) — a assercao de presenca no
  gate (`c-004` em [14,233..22,738]) e o MESMO numero nos dois lados
  (contrato-w7 §12).

## O que este ADR NAO decide

- **Perfis de encode e o encode final (mp4)** — F5-02.
- **Cache de render e invalidacao** — F5-09 (W8).
- **Orquestracao de ponta a ponta (tema -> entrega)** — F5-07 (W9).
- **Backend grafico (ANGLE/Vulkan vs SwiftShader)** — os tetos valem para
  o caminho medido (CPU/SwiftShader); trocar o backend re-mede antes
  (AB-982).
- **A politica de limpeza de saidas** — regra pratica aqui (decisao 7),
  politica de operacao nao.

## Alternativas descartadas

- **Comparar bytes do .mov qtrle inteiro vs concatenado (container):** o
  container .mov carrega offsets de chunk e metadados que divergem entre
  um arquivo unico e uma concatenacao, mesmo com os frames identicos —
  comparar o container mediria o muxer, nao a composicao. A comparacao e
  por frame (PNG bytes / framemd5), onde o determinismo do codec vale.
- **Usar o combineChunks do Remotion (h264-ts):** o h264 e codec do MP4
  final, excluido por declaracao (AB-396/397); o combineChunks existe para
  PLAYBACK correto, nao para igualdade de bytes com o render continuo. A
  concatenacao do gate e a de codec deterministico (PNG sequencia, .mov
  qtrle via concat demuxer).
- **Renderizar faixas com o default de concurrency do Remotion:** o
  default tem teto rigido de 8 (R05-10) — mas e o REMOTION que decide, e
  o teto pode sumir numa versao futura sem aviso. O pipeline passa a
  concurrency EXPLICITA do orcamento.
