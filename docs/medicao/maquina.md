# Maquina de render — medicao real da maquina (card I-03, W6.5)

- **Data da medicao:** 2026-08-13 (cerimonia completa; cada numero abaixo
  tem `comando:` que o reproduz, saida resumida, data e tolerancia)
- **Maquina:** Intel Core i9-14900HX (32 threads) · 32.553 MiB RAM · NVIDIA
  RTX 4070 Laptop 8.188 MiB (driver 580.159.03) · NVMe 915 GiB (96% usado) ·
  node v24.15.0 · ffmpeg 6.1.1 · just 1.42.4 · Linux 6.18.7 (pop-os)
- **Host compartilhado:** a medicao rodou com outros agentes ativos
  (loadavg 3-6, ~18 GiB usados por processos alheios). Tolerancias
  declaradas absorvem o ruido; a conferencia curta re-mede (AB-980).
- **Entrada da medicao:** a fixture canonica integrada do F1-12
  (`fixtures/snapshots/integrado/entrada.tsx`, composicao `integrado`,
  727 frames, 1920x1080@30fps) — o render REAL do programa, nao um
  sintetico. Render com `--gl=swangle` (a chave do baseline; verificado que
  a GPU fica a 0% nos dois backends — o render e CPU-bound, a RTX fica
  livre para o NVENC).
- **Teto declarado (consumidor: F5-01 e F5-02 da W7):** ver
  `docs/adr/0032-maquina-de-render.md` (decisoes 1-5).

## Tabela de numeros (a conferencia le EXATAMENTE esta tabela)

| chave | valor | unidade | tolerancia | comando |
|---|---|---|---|---|
| ram_worker | 138 | MiB/worker | 0.30 | `tools/medir-maquina.py rss --concurrency 16 --referencia 1 --frames 0-119 --sequencia --intervalo 0.1` |
| sat_ponto | 16 | concurrency | - | `tools/medir-maquina.py saturacao --frames 0-239 --niveis 1,2,4,8,16,32 --reps 2` |
| teto_concorrencia | 8 | concurrency | - | `tools/medir-maquina.py saturacao --frames 0-239 --niveis 1,2,4,8,16,32 --reps 2` (derivado no ADR-0032 decisao 1) |
| sessoes_nvenc | 8 | sessoes | - | `tools/medir-maquina.py encode --nvenc 1,2,4,6,8,10,12,16` |
| x264_paralelo | 718 | fps agregados (4 sessoes) | 0.30 | `tools/medir-maquina.py encode --soft 1,2,4,8,16` |
| disco_escrita | 724 | MiB/s | 0.25 | `tools/medir-maquina.py disco --tamanho-mib 2048 --com-store` |
| disco_leitura | 5790 | MiB/s | 0.25 | `tools/medir-maquina.py disco --tamanho-mib 2048 --com-store` |
| pico_gate | 3904 | MiB | 0.30 | `tools/medir-maquina.py gate-pico` |

> A tabela e a fonte unica da conferencia: `just medir-maquina --conferir`
> parseia estas linhas, re-mede em CURTO e falha alem da tolerancia.
> `sat_ponto` e `teto_concorrencia` sao conferidos juntos (o par define a
> regiao de ganho e a regiao achatada da curva).

---

## M0 — Inventario (contexto de todas as medicoes)

**comando:**

```
python3 tools/medir-maquina.py inventario
```

**saida resumida (2026-08-13T17:31:22Z, loadavg 3.29 4.06 4.04):**

```json
{"cpu_modelo": "Intel(R) Core(TM) i9-14900HX", "cpu_nproc": 32,
 "ram_kib": {"MemTotal": "32553328", "MemAvailable": "13305900"},
 "gpu": "NVIDIA GeForce RTX 4070 Laptop GPU, 8188 MiB, 580.159.03",
 "disco": ["/dev/nvme1n1p2  915G  828G   41G  96% /"],
 "node": "v24.15.0", "ffmpeg": "6.1.1", "just": "1.42.4"}
```

- RAM total 32.553 MiB; MemAvailable oscilou entre ~12,0 e ~13,3 GiB
  durante a cerimonia (host compartilhado — AB-986).
- Disco a 96%: **41 GiB livres** — o teto pratico de lotes e o espaco,
  nao o throughput (AB-984).

**comando (GPU durante render — o render nao usa a GPU):**

```
nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader   # durante:
npx remotion render fixtures/snapshots/integrado/entrada.tsx integrado /tmp/medir-maquina/calib-default.mp4 --frames=0-59 --concurrency=4
```

**saida resumida:** `0 %` durante o render (default gl) e `0 %` com
`--gl=swangle`. Chrome headless cai no SwiftShader: render e CPU-bound;
a RTX 4070 fica livre para o NVENC do F5-02 (AB-982). Os tetos de render
valem para este caminho.

---

## M1 — RAM por worker (pico da arvore do render)

O numero declarado e o **pico de RSS da ARVORE inteira** do render
(node + chrome-headless + renderers) — e o que a maquina tem de caber, nao
o RSS de um processo isolado. A amostragem caminha por PPID a partir do
processo do render (o chrome-headless abre sessao propria e NAO aparece em
`ps -g <pgid>` — armadilha descoberta nesta medicao).

**comando:**

```
python3 tools/medir-maquina.py rss --concurrency 16 --referencia 1 --frames 0-119 --sequencia --intervalo 0.1
```

(equivalente manual, render a render — saida em sequencia de frames para
separar a fase de render da fase de encode; o ffmpeg do mp4 dominaria o
pico com ~1,1 GiB e nao e "RAM por worker"):

```
npx remotion render fixtures/snapshots/integrado/entrada.tsx integrado /tmp/medir-maquina/rss-ref-c1-seq --frames=0-119 --concurrency=1 --gl=swangle --sequence
npx remotion render fixtures/snapshots/integrado/entrada.tsx integrado /tmp/medir-maquina/rss-alvo-c16-seq --frames=0-119 --concurrency=16 --gl=swangle --sequence
```

**saida resumida (2026-08-13T17:36Z):**

| concurrency | pico da arvore | processos no pico | tempo de parede |
|---|---|---|---|
| 1 | **1.196 MiB** | 9 (node ~522, chrome-headless 215+137+83+82) | 12,4 s / 120 frames |
| 16 | **3.262 MiB** | 24 (~20 renderers chrome de ~120 MiB) | 4,1 s / 120 frames |

**numero declarado:** `ram_worker = 138 MiB/worker` — marginal
(3.262 - 1.196)/15 = 137,8 MiB. **Tolerancia: ±30%** (host compartilhado).
Com 1 worker a base da arvore e ~1.200 MiB.

Fase de encode (medida no modo mp4): o processo ffmpeg do Remotion pico em
**~1.140 MiB** (amostra de M1 em modo mp4; detalhe em M3).

---

## M2 — Ponto de saturacao (curva tempo-por-frame x concurrency)

**Definicao (robusta a ruido de host compartilhado):** ponto de saturacao e
o menor c tal que dobrar c ganha MENOS de 15% sobre a mediana do nivel
anterior (mediana de repeticoes). Regiao de ganho termina aí.

**comando:**

```
python3 tools/medir-maquina.py saturacao --frames 0-239 --niveis 1,2,4,8,16,32 --reps 2
```

**saida resumida (mediana de 2 repeticoes por nivel, 240 frames, modo mp4 — o
caminho real do pipeline; 2026-08-13T17:41Z):**

```
tf_por_frame_mediana_s:
  c=1: 0.0765 | c=2: 0.0525 | c=4: 0.0401 | c=8: 0.0314 | c=16: 0.0284 | c=32: 0.0305
ponto_saturacao: 16   (8->16 ganhou 10% < 15%)
```

- c=1 -> c=4: tempo por frame cai 48% (0.0765 -> 0.0401 s).
- c=4 -> c=8: cai mais 22% (0.0401 -> 0.0314 s) — ultimo degrau de ganho
  real; 4x workers a partir de c=2 para 40% do tempo.
- c=8 -> c=16: 0.0314 -> 0.0284 (10%, dentro do ruido — dobrou sem ganho
  de 15%) — ponto de saturacao.
- c=16 -> c=32: 0.0284 -> 0.0305 (piora 7% — oversubscription de 32
  workers em 32 threads com o host compartilhado).

A regiao util de concorrencia e 4-8; a partir de 16 o paralelismo nao paga.

**numero declarado:** `sat_ponto = 16` (definicao acima). **Teto declarado
(ADR-0032, decisao 1): `teto_concorrencia = 8`** — metade do ponto de
saturacao, com margem para o host compartilhado, o gate rodando junto e
cenas pesadas nao medidas (AB-983). **Tolerancia: por forma, nao por
valor absoluto** — a definicao de 15% e da cerimonia completa (240 frames,
mediana); a conferencia curta valida a FORMA do par (ver secao "Como
conferir"): em 120 frames o startup domina o tempo-por-frame e esmaga os
ganhos, entao o check curto exige (a) `tf(sat) >= 0.85 x tf(teto)` e
(b) `tf(teto) <= 1.10 x tf(4)`.

---

## M3 — Sessoes de encode (limite testado ate a falha)

Entrada sintetica unica (gerada uma vez): 300 frames 1280x720@30fps
(`ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=30:duration=10`).
Cada sessao: `ffmpeg -i entrada -c:v h264_nvenc -preset p5 -b:v 4M out.mp4`.

**comando:**

```
python3 tools/medir-maquina.py encode --nvenc 1,2,4,6,8,10,12,16 --soft 1,2,4,8,16
```

**saida resumida (2026-08-13T17:42Z):**

```
NVENC (h264_nvenc):
  n=1:  1/1 sessoes OK | fps_agregado 273  | RSS ~341 MiB/sessao
  n=2:  2/2 OK         | 394              | ~341
  n=4:  4/4 OK         | 459              | ~340
  n=6:  6/6 OK         | 508              | ~339
  n=8:  8/8 OK         | 522              | ~337
  n=10: 8/10 — 2 FALHAM na inicializacao (limite do driver/GPU atingido)
  n=12: 8/12 — 4 FALHAM | n=16: 8/16 — 8 FALHAM

libx264 (software):
  n=1: 449 fps agregado | n=2: 638 | n=4: 718 | n=8: 730 | n=16: 830
  (agregado quase nao sobe de 4 para 8 sessoes: +2%; a CPU e o mesmo
   nucleo do render)
```

**numeros declarados:** `sessoes_nvenc = 8` (limite real: inicializacao
falha a partir de 10 — testado ATE a falha, pergunta adversarial 2; cada
sessao NVENC 720p ~340 MiB de RSS). `x264_paralelo = 718 fps agregados
com 4 sessoes` (RSS ~440 MiB/sessao). **Teto de uso (ADR-0032, decisao
2): 4 NVENC + 4 libx264 simultaneos** com fila explicita (margem para
driver novo — AB-981 — e VRAM — AB-987).

**RAM do ffmpeg do Remotion (fase de encode do render mp4):** o processo
ffmpeg que o Remotion lanca no fim do render pico em **~1.140 MiB**
(amostra de M1 em modo mp4, 120 frames 1080p) — bem acima do ffmpeg
standalone (~340 MiB nvenc / ~440 MiB x264 nos testes acima). O orcamento
de RAM usa o numero conservador de 1,1 GiB por encode simultaneo.

---

## M4 — Throughput de disco (diretorio de trabalho e store)

**comando:**

```
python3 tools/medir-maquina.py disco --tamanho-mib 2048 --com-store
```

(equivalente manual — dd real com fdatasync; o `dd` vive dentro da
ferramenta por causa do guardrail do repo):

```
dd if=/dev/zero of=<dir>/dd-test.bin bs=64M count=32 conv=fdatasync status=none
dd if=<dir>/dd-test.bin of=/dev/null bs=64M status=none
```

**saida resumida (2026-08-13T17:43Z):**

```
diretorio de trabalho (.cache/medir-maquina/disco, 2048 MiB):
  escrita: 724 MiB/s (dd, fdatasync)
  leitura: 5790 MiB/s
store (.cache/store, 2048 MiB):
  escrita: 1807 MiB/s | leitura: 4501 MiB/s
```

**numeros declarados:** `disco_escrita = 724 MiB/s`, `disco_leitura =
5790 MiB/s` (diretorio de trabalho — onde o pipeline escreve renders).
**Tolerancia: ±25%** (NVMe sob host compartilhado; a variacao entre
alvos, 724 vs 1807 MiB/s de escrita, e efeito de page cache/alocacao do
NVMe — os dois sao medidos e registrados). O gargalo de disco do
pipeline e o ESPACO (41 GiB livres), nao o throughput (AB-984).

---

## M5 — Pico de RSS do gate local (margem para rodar junto)

**comando:**

```
python3 tools/medir-maquina.py gate-pico
```

**saida resumida (2026-08-13, gate local completo: 5 PASS, 0 FAIL):**

```
pico_rss_grupo: 3904 MiB | wall: 12,8 s | exit: 0
```

**numero declarado:** `pico_gate = 3904 MiB`. **Tolerancia: ±30%.**
Entra no orcamento de RAM (ADR-0032, decisao 3): render + encode + gate
<= 24 GiB — com o gate junto, o orcamento sobra para
24 - 1,2 - 7 x 0,138 - 3,9 ~= 17,9 GiB de margem com 8 workers sem encode,
o que confirma a pergunta adversarial 3 (o teto deixa margem para o gate).

---

## Tetos declarados (consumidor: F5-01 e F5-02, W7)

| Teto | Valor | Comando que o reproduz |
|---|---|---|
| Workers de render simultaneos | 8 (min(8, teto de RAM)) | `tools/medir-maquina.py saturacao --frames 0-239 --niveis 1,2,4,8,16,32 --reps 2` |
| RAM da arvore de render | base ~1,2 GiB + 0,138 GiB/worker; total <= 24 GiB com encode e gate | `tools/medir-maquina.py rss --concurrency 16 --referencia 1 --frames 0-119 --sequencia --intervalo 0.1` |
| Sessoes NVENC | 4 simultaneas (limite medido: 8; fila explicita) | `tools/medir-maquina.py encode --nvenc 1,2,4,6,8,10,12,16` |
| Sessoes libx264 | 4 simultaneas | `tools/medir-maquina.py encode --soft 1,2,4,8,16` |
| Disco | espaco >= 10 GiB livres antes de lote; saidas em /tmp | `df -h /home` |

Formula de conversao (faixas x workers do F5-01):

```
RAM_estimada = 1,2 GiB + (workers_totais - 1) x 0,138 GiB
             + 1,1 GiB x encodes_ffmpeg_simultaneos + pico_gate
RAM_estimada <= 24 GiB
```

---

## Como conferir (a medicao curta que falha alem da tolerancia)

```
just medir-maquina --conferir
```

Re-mede em CURTO (60-120 frames por render, 512 MiB por dd) e compara com a
tabela deste documento:

- **RAM por worker** (±30%) — 60 frames, modo sequence (mesma metodologia
  de M1).
- **Par (teto, ponto de saturacao)** — 120 frames, por FORMA (a definicao
  de 15% da cerimonia completa nao e verificavel em curto: o startup
  domina o tempo-por-frame de renders curtos e esmaga os ganhos — medido:
  em 60 frames c=8 vs c=4 vira ruido de 1%): (a) `tf(sat) >= 0.85 x
  tf(teto)` — dobrar alem do teto ganha menos de 15%, a regiao achatada
  existe; (b) `tf(teto) <= 1.10 x tf(4)` — o teto nunca e pior que metade
  dele alem de ruido, o paralelismo nao quebrou. Uma maquina 2-3x mais
  lenta derruba a checagem de RAM antes.
- **Sessoes NVENC** — as 8 declaradas inicializam todas.
- **libx264 paralelo** — 4 sessoes com agregado >= 70% do declarado.
- **Disco** — escrita como PISO (>= 75% do declarado; a re-escrita curta
  pega page cache quente e mede ate 3,5x mais — o numero declarado e o
  caso FRIO, o da pipeline) e leitura em faixa (±25%).

Saida `=== VERDE ===` / `=== VERMELHO ===` com exit 0/1. O pico do gate
(M5) NAO entra na conferencia curta (a suite completa leva minutos) — e
re-medido na cerimonia completa com o comando de M5.

## Armadilhas registradas nesta medicao

- **`rg -L` no ∅-crit do card e ARMADILHA (9.2):** em ripgrep, `-L` e
  `--follow`, nao "files without match". O check correto e
  `rg --files-without-match "comando:" docs/medicao/maquina.md` (vazio
  quando todo numero tem comando). O literal `rg -L` do PROGRAMA.html,
  rodado, nao faz o que o texto diz.
- **`ps -g <pgid>` nao ve o chrome-headless:** o Remotion abre o Chrome em
  sessao propria (setsid); o pico de RAM medido por grupo de processos
  ignorava a memoria que domina (renderers). A amostragem por PPID
  (arvore) e a correta — usada em M1/M5.
- **O modo mp4 mistura a fase de encode no pico:** o ffmpeg do Remotion
  pico em ~1,1 GiB e dominava o "pico do render". RAM por worker e medida
  em modo sequence (frames); o ffmpeg e medido a parte (M3).
- **A curva de saturacao em modo sequence e inutilizavel para timing:**
  a escrita de PNGs domina o tempo por frame (0,42 s vs 0,085 s no mp4) —
  timing em mp4 (o caminho real), RAM em sequence.
- **`just medir:maquina` (dois-pontos) quebra o justfile inteiro**
  (criterios-de-aceitacao-corrigidos.md §2): a receita e `medir-maquina`
  (hifen).
