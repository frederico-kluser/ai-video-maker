# ADR-0032 — Teto de concorrencia medido: a maquina de render do programa

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** I-03 (W6.5, infra)
- **Depende de:** T-08 (medir.py — o registro da medicao da onda usa o formato
  dele), F1-12 (fixture canonica integrada, a entrada de todos os renders
  desta medicao), AB-550 (ponte, F5-01 na W7 — consumidor dos tetos)
- **Faixa de ledger:** AB-980..AB-989 (ledger/inbox/I-03.json)
- **Numero pre-alocado:** PROGRAMA.html §III-12 (I-03 -> 0032), docs/contrato-w6.md §8

## Contexto

O programa precisa de tetos de concorrencia MEDIDOS antes da fase 5: o
F5-01 (pipeline de render por faixa + concatenacao, W7) e o F5-02 (perfis de
encode, W7) declaram dependencia de I-03 — "perfil de encode escolhido antes
da medicao e chute". Este ADR registra a decisao de teto; a medicao que a
sustenta (comando por numero, data e tolerancia) vive em
`docs/medicao/maquina.md` e e conferida pelo `just medir-maquina --conferir`.

Tres perguntas adversariais do card governam o que segue:

1. **Nenhum numero foi copiado de documentacao** — todo numero abaixo foi
   medido nesta maquina com o comando que o reproduz (evidencia em
   `docs/medicao/maquina.md`).
2. **A medicao de sessoes de encode testou o LIMITE** — a sonda de NVENC
   sobe o numero de sessoes ate a inicializacao falhar, nunca para antes
   (medicao M3).
3. **O teto deixa margem para o gate rodar ao mesmo tempo** — o pico de RSS
   do gate local foi medido (M5) e entra na conta do orcamento de RAM.

## A maquina (M0 — inventario medido em 2026-08-13)

| Fato | Valor medido | Comando |
|---|---|---|
| CPU | Intel Core i9-14900HX, 32 threads (24 cores) | `lscpu` |
| RAM total | 32.553 MiB (~31,8 GiB) | `free -h` / `grep MemTotal /proc/meminfo` |
| GPU | NVIDIA GeForce RTX 4070 Laptop, 8.188 MiB, driver 580.159.03 | `nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader` |
| Disco | NVMe /dev/nvme1n1p2, 915 GiB, **96% usado (41 GiB livres)** | `df -h` |
| Runtime | node v24.15.0, ffmpeg 6.1.1, just 1.42.4, Linux 6.18.7 (pop-os) | `node --version` etc. |
| Host | **compartilhado** — loadavg 3-6, ~18 GiB usados por processos alheios (outros agentes) | `uptime` / `ps aux --sort=-rss` |

Duas consequencias de maquina:

- **O render do Remotion NAO usa a GPU.** Verificado por `nvidia-smi` durante
  renders com `--gl` default e com `--gl=swangle`: 0% de utilizacao nos dois.
  O Chrome headless cai no SwiftShader (software) — o render e CPU-bound e
  a RTX fica livre para o NVENC do F5-02. Os tetos de render abaixo valem
  para o caminho CPU (ver AB-982).
- **O host e compartilhado.** Os numeros sao o piso de uma maquina sob
  carga; tolerancias declaradas absorvem o ruido, e a conferencia curta
  (`medir-maquina --conferir`) e o tripwire (AB-980).

## Decisoes

### 1. Teto de concurrency do render: 8 workers; ponto de saturacao medido em 16

Medicao M2 (curva tempo-por-frame x concurrency, frames 0-239 da composicao
`integrado`, 1920x1080@30fps, mediana de 2 repeticoes, modo mp4 — o caminho
real do pipeline): o tempo por frame cai de 76,5 ms (c=1) para 31,4 ms
(c=8) e 28,4 ms (c=16); dobrar workers a partir de 16 ganha menos de 15%
(definicao do ponto de saturacao: menor c onde dobrar c ganha <15% sobre a
mediana — de 8 para 16 o ganho medido foi 10%, de 16 para 32 piora 7%).

- **Ponto de saturacao (medido): 16** — a regiao de ganho real termina aí.
- **Teto de concurrency DECLARADO: 8** — metade do ponto de saturacao, com
  tres motivos: (a) host compartilhado: a curva e ruidosa sob carga (a
  primeira medicao, de repeticao unica, teve amostras fora da tendencia) e
  o teto fica fora da regiao ruidosa; (b) o gate roda junto: em c=8 o
  render consome ~1,6 GiB da arvore e ~8 threads, deixando o resto do host
  para o gate e os outros agentes; (c) a medicao usou os frames 0-239
  (cenas leves) — cenas com grafico/midia podem custar mais por frame
  (AB-983).

O F5-01 NAO pode exceder `min(8, teto de RAM da decisao 3)` workers ativos
de render. A regra de conversao para o pipeline por faixas (N faixas x M
workers) esta na decisao 3.

### 2. Teto de sessoes de encode: 4 NVENC + 4 libx264 simultaneos, com fila explicita

Medicao M3: o NVENC da RTX 4070 (driver 580.159.03) inicializa **8 sessoes
simultaneas** e, a partir de 10 lancadas em paralelo, sessoes FALHAM na
inicializacao (n=10: 2 falhas; n=16: 8 falhas — limite real testado ate a
falha, pergunta adversarial 2). Em 8 paralelas o agregado chega a ~522 fps
(~65 fps por sessao, degradacao ~80% vs isolada); cada sessao usa ~340 MiB
de RSS.

- **Teto declarado: 4 sessoes NVENC simultaneas** — metade do limite medido:
  (a) margem para bump de driver (AB-981); (b) o F5-02 pode rodar encodes
  mais pesados que 720p (VRAM — AB-987); (c) o gate e o render rodam junto.
- **libx264 (software): 4 sessoes simultaneas** — a medicao mostra agregado
  de 718 fps em 4 sessoes paralelas (449 isolada; ~440 MiB de RSS por
  sessao); de 4 para 8 sessoes o agregado sobe so 2% (730) — saturacao de
  CPU, o mesmo nucleo que o render usa.
- O F5-02 usa **fila explicita** (nunca lancar mais que o teto); o gate
  declara o teto, medido por este card (PROGRAMA.html §IV-9, linha 3).

### 3. Orcamento de RAM: render + encode + gate <= 24 GiB dos ~31,8 GiB

Medicao M1 (RAM por worker, modo sequence — so a fase de render): a arvore
do render pico em **~1.200 MiB com 1 worker** (node ~520 MiB + chrome
headless ~215 MiB + renderers) e **~3.260 MiB com 16 workers**; marginal
**~138 MiB por worker** (renderers chrome de ~120 MiB cada). A fase de
encode do mp4 adiciona **~1.140 MiB por processo ffmpeg** (medido no pico da
arvore em modo mp4; o ffmpeg standalone de encode 720p usa ~340 MiB nvenc /
~440 MiB x264 — o conservador de 1,1 GiB e o do caminho real). O gate local
pico em **3.904 MiB em 12,8 s** (M5, 5 PASS / 0 FAIL).

Formula de conversao para o F5-01 (faixas x workers):

```
RAM_estimada = base(1 worker ~= 1,2 GiB)
             + (workers_totais - 1) x 0,138 GiB
             + 1,1 GiB por encode ffmpeg simultaneo
             + pico_gate (quando o gate roda junto)
RAM_estimada <= 24 GiB   (sobra >= ~7,8 GiB para o resto do host)
workers_totais <= 8      (decisao 1)
```

O teto de 24 GiB usa o TOTAL da maquina (31,8 GiB), nunca o MemAvailable
(oscilou 12-13,3 GiB durante as medicoes por causa de outros processos —
AB-986). O F5-01 deve ler `MemTotal` em runtime e reduzir concurrency se a
maquina mudar (VM, upgrade).

### 4. Teto de disco: throughput e espaco

Medicao M4 (dd real, 2 GiB, fdatasync): escrita 724 MiB/s e leitura
5.790 MiB/s no diretorio de trabalho (store: 1.807/4.501 MiB/s) — o NVMe
nao e o gargalo do pipeline. O gargalo de disco e o **ESPACO**: o
filesystem esta a 96% (41 GiB livres). Regras praticas declaradas: saidas
de render em `/tmp` (fora do filesystem do repo), limpeza pos-render, e
antes de um lote de renders exigir `df /home` com >= 10 GiB livres
(AB-984).

### 5. A conferencia e parte do gate do programa

`just medir-maquina --conferir` re-mede em CURTO (60-120 frames por
render) RAM por worker (±30%), o par (teto, ponto de saturacao) por FORMA
(a definicao de 15% da cerimonia completa nao e verificavel em renders
curtos — o startup domina e esmaga os ganhos; o check curto exige
`tf(sat) >= 0.85 x tf(teto)` e `tf(teto) <= 1.10 x tf(4)`), sessoes NVENC
(todas inicializam), libx264 paralelo (>= 70% do agregado) e disco
(escrita como piso de 75% — a re-escrita curta pega page cache quente e
mede ate 3,5x o caso frio declarado; leitura em faixa ±25%), comparando
com os numeros declarados em `docs/medicao/maquina.md` (fonte unica — o
script le a tabela do documento) e falhando alem da tolerancia declarada.
O `conferir` roda renders reais (fixture canonica) — e a mesma medicao,
em curto, nao um substituto sintetico. O pico do gate (M5) e re-medido na
cerimonia completa, nunca no curto.

## Consequencias

- O F5-01 (W7) recebe tetos NUMERICOS com comando de reproducao: workers <=
  8, RAM <= 24 GiB pela formula acima, faixas de frames nao escalam
  paralelismo alem do teto (a pergunta adversarial 2 do card F5-01 pergunta
  exatamente "a concorrencia excede o teto medido em I-03?" — a resposta
  vem desta decisao).
- O F5-02 (W7) recebe o teto de sessoes de encode (4 NVENC + 4 libx264) com
  fila explicita e o registro de que NVENC nao tem CRF (perfis por
  qualidade, nao por bitrate).
- O gate local continua verde durante renders dentro do teto: o pico do
  gate (M5) entra no orcamento da decisao 3.
- A medicao da onda W6.5 e registrada no formato do T-08
  (`python3 tools/medir.py registrar --onda W6.5 ...` ->
  `docs/medicao/W6.5.json`) — nenhum numero deste ADR foge do formato.

## O que este ADR NAO decide

- **O backend grafico do pipeline** (ANGLE/Vulkan na GPU vs SwiftShader):
  os tetos valem para o caminho medido (CPU); se o F5-01 trocar o backend,
  re-medir antes de subir tetos (AB-982).
- **Perfis de encode (qualidade, bitrate, codec)** — e o F5-02.
- **Quantas faixas** o pipeline corta — e o F5-01, dentro dos tetos aqui.
- **Espaco em disco por render** (tamanho maximo de saida) — regras
  praticas sim (decisao 4), politica de limpeza nao (F5-01/operacao).
- **Tetos de LLM/credencial** — outros cards (F4-01/F4-04).

## Alternativas descartadas

- **Copiar tetos de documentacao (Remotion docs, NVIDIA docs)** — a
  pergunta adversarial 1 do card; documentacao de Remotion fala de
  "1 worker ~= 1 GB" sem numero de maquina, e o limite de sessoes NVENC do
  GeForce que as docs mais citadas declaram (5) NAO vale neste driver:
  medimos 8 sessoes inicializando no 580.159.03 (e 9+ falhando). Todo teto
  aqui tem comando e saida — documentacao orienta, nao declara.
- **Teto de concurrency no ponto de saturacao (16)** — sem margem para o
  host compartilhado e o gate; a medicao da curva em c=12/c=16 tem ruido
  acima da tendencia, e o custo de 16 vs 8 workers e o mesmo em RAM (~138
  MiB x 8 extras) com ganho de tempo <20% — o teto em 8 entrega quase todo
  o desempenho com metade da ocupacao.
- **Medir RAM por worker por processo (amostrar so os renderers chrome)**
  — o numero que o pipeline precisa e o pico da ARVORE inteira (o que a
  maquina tem de caber), nao o RSS de um processo isolado; o pico por
  arvore e o declarado (M1). A medicao em modo mp4 sem separar a fase de
  encode dava um numero enganoso (o ffmpeg de ~1,1 GiB dominava o pico) —
  por isso M1 usa modo sequence (frames, sem encode) e o ffmpeg e medido a
  parte.
