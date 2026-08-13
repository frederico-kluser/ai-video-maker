# ADR-0036 — Perfis de encode: hardware e software nao se comparam pelo mesmo eixo

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F5-02 (W7)
- **Depende de:** F0-04 (tokens — nada de qualidade de encode vive la; este
  ADR e a fonte das constantes do modulo), I-03 (tetos medidos — ADR-0032)
- **Numero pre-alocado:** docs/contrato-w7.md §10
- **Porta TCP reservada:** 4502 (docs/contrato-w7.md §11)
- **Faixa de ledger:** AB-700..AB-719 (ledger/inbox/F5-02.json)

## Contexto

O programa encoda o master em perfis de entrega (MP4 h264). Dois motores
candidatos convivem: `libx264` (software, CPU) e `h264_nvenc` (hardware, GPU
da RTX 4070). O I-03 mediu os tetos da maquina (ADR-0032, decisoes 1-2: 4
NVENC + 4 libx264 simultaneos com fila explicita; ~522 fps agregados em 8
sessoes NVENC, 718 fps em 4 sessoes x264) e registrou o fato que governa
este ADR: **nenhum encoder de hardware tem CRF** (placar 3-0, ffmpeg-media-
ops). A emenda da W7 (contrato-w7 §6) acrescentou: o perfil **declara se o
encode e deterministico**, e goldens so existem em perfis deterministicos.

Tres perguntas adversariais do card governam as decisoes:

1. O perfil de hardware esta sendo comparado com o de software pelo MESMO
   eixo? Nao da — um nao tem CRF.
2. Metadado nao-deterministico (data, string do encoder) foi removido?
3. O fallback de hardware para software e silencioso?
4. O determinismo declarado por perfil e testado (2x bytes identicos)?

## Decisoes

### 1. O perfil e um OBJETO INTEIRO, e a linha de comando nasce de UM construtor unico

O perfil carrega `codec`, `motor`, alvo de qualidade, `preset`, `pixFmt` e
`argsExtra` (ffmpeg-media-ops, R10-01: "o perfil de encode ser objeto
inteiro (...) num construtor unico de linha de comando, nunca flag espalhada
pelos cards"). Trocar `libx264` por `h264_nvenc` mantendo `-crf` nao e
substituicao de encoder: e mudanca de CONTRATO DE QUALIDADE, e a flag
sobrando nao aborta o comando (exit 0, aviso no log, rate control default —
falso verde). O construtor (`src/render/encode/comando.ts`) recusa perfil
invalido antes de montar argv.

Consequencia: perfis novos sao descobertos por convencao (AGENTS.md, Regra
6) em `src/render/encode/perfis/<nome>.ts` com `export default`; um arquivo
invalido derruba `listarPerfis()` — nunca e pulado em silencio.

### 2. Eixos de qualidade SEPARADOS: CRF so no software; NVENC usa `-rc vbr -cq` ou `-rc constqp -qp`

- `libx264`: alvo = `-crf N` (0..51).
- `h264_nvenc`: alvo = `-rc vbr -cq N` (1..51; 0 e "automatico" = sem alvo,
  invalido) ou `-rc constqp -qp N` (0..51).

A validacao (`validarPerfil`) corta o eixo cruzado: `crf` num perfil de
hardware e invalido (a pergunta adversarial 1 em forma de erro), `cq`/`qp`
em software e invalido. Nenhum numero de CRF se compara a nenhum numero de
CQ — a escolha entre perfis e DECISAO DE PRODUTO (F5-07) por tamanho/SSIM
medido no conteudo real, nunca por igualar numeros (AB-701).

### 3. Determinismo DECLARADO por perfil; goldens so em perfis deterministicos (emenda da W7)

- `entrega-software` (libx264) declara `deterministico: true` — medido em
  ffmpeg 6.1.1-3ubuntu5: 2x execucoes do mesmo comando, bytes de arquivo
  identicos (R10-25/R11-11); x264 nao liga modo nao-deterministico por
  default (R11-12). O gate TESTA a declaracao ao vivo: 2x encodes = bytes
  identicos + framemd5 identico (pergunta adversarial 4).
- `entrega-nvenc` (h264_nvenc) declara `deterministico: false` — o NVENC
  depende da sessao do encoder e do driver; uma amostra unica identica
  (2026-08-13, 1 s) nao e garantia (AB-700). Goldens sao RECUSADOS por
  `registrarGolden` (testado).
- A declaracao e obrigatoria: perfil sem `deterministico` e invalido.
- Escopo da declaracao: vale para a cadeia PINADA (ffmpeg 6.1.1 + este
  modulo). Bump de versao invalida a declaracao sem aviso (AB-703).

### 4. Metadado nao-deterministico removido SEMPRE, no construtor, DEPOIS das entradas

Os tres flags canonicos `-fflags +bitexact -flags +bitexact -map_metadata
-1` sao emitidos em TODO comando (todos os perfis) e SEMPRE depois das
entradas (NV-5: antes do `-i` configuram o demuxer e o MP4 sai com
`TAG:encoder=Lavf...` mesmo assim, com exit 0). O oraculo da pergunta
adversarial 2: `ffprobe -show_entries format_tags` no artefato nao pode
conter as chaves volateis (`encoder`, `creation_time`, `date`, `timecode`);
as tags estruturais de brand do MP4 (major_brand, compatible_brands) sao
deterministicas e seguem no arquivo — nao sao o alvo do card.

### 5. Fallback de hardware para software e DECLARADO e estruturado — nunca silencioso

Quando o NVENC esta indisponivel, `escolherPerfil` devolve o perfil de
software da MESMA familia de codec (h264_nvenc -> libx264) com a declaracao
`{ ativo: true, motivo, solicitado }`; o executor loga em voz alta
(stderr) e devolve a declaracao no resultado — quem consome (procedencia
F5-06, orquestrador F5-07) le `resultado.fallback`. A troca NAO finge
equivalencia: o alvo muda de eixo de proposito (CQ -> CRF), e quem le o
resultado sabe. Sem destino no catalogo, lança `ESemPerfilDeFallback` —
nunca encoda com o perfil errado em silencio. Testado com deteccao fake
nos dois sentidos.

### 6. Deteccao de NVENC por smoke test de 1 s — nunca por presenca de driver (C8)

`nvidia-smi` presente != encoder disponivel para o processo; `ffmpeg
-encoders` lista o encoder compilado no build mesmo sem GPU (AB-008). A
deteccao roda um encode real de 1 s (lavfi testsrc2 320x180, mesma
metodologia do I-03) e declara `{ nvenc, motivo }` — a indisponibilidade e
um RESULTADO com motivo, nunca excecao muda. A sonda so roda quando o
perfil solicitado e de hardware.

### 7. Fila explicita de sessoes: 4 NVENC + 4 libx264 (S-10)

`criarFilaDeEncode` (default = teto medido do I-03) bloqueia `adquirir`
alem do limite, por motor, FIFO; o executor adquire e libera em finally.
Tetos injetaveis nos testes. Ver ADR-0032 (decisao 2) para a medicao que
sustenta os numeros.

### 8. Verificacao do artefato: estrutura por stream (C4), entropia (C1), framemd5 (camada 1)

`verificarSaida` le o artefato por `-select_streams v:0 -count_frames`
(duracao do container nao entra na comparacao — C4), exige parse NAO-vazio
antes de comparar valor (falsifiable-gates), confere codec/resolucao contra
o perfil que produziu o arquivo, exige entropia (signalstats YAVG) acima do
piso nomeado e confere a ausencia de metadado volatel. `calcularFramemd5`
expoe o oraculo de frames decodificados (camada 1) para a prova de
determinismo; o muxer framemd5 e conferido no ambiente (build-dependente).

## Consequencias

- O F5-01 (pipeline, irmao da W7) e o F5-07 (orquestrador, W9) consomem a
  API publica de `src/render/encode/index.ts` — perfis por convencao,
  execucao com fila explicita e fallback declarado, verificacao estrutural.
- O F5-06 (procedencia, irmao) le `resultado.fallback` para registrar o
  motor que de fato encodou.
- `just encode-perfis` e o gate do card: tsc + suite (∅-crit, adversariais,
  presenca, encodes reais) + ∅-crit ao vivo sobre o disco + deteccao NVENC
  + prova de determinismo 2x ao vivo.
- A porta 4502 fica RESERVADA ao F5-02 (nada a escuta nesta fase — o
  modulo nao abre socket; o registro e para o Studio/preview futuros).

## O que este ADR NAO decide

- **Qual perfil o pipeline usa por padrao** (nvenc vs software) — decisao
  de produto do F5-07, com evidencia de tamanho/SSIM por conteudo real
  (AB-701) e o teto de sessoes do I-03.
- **Bitrate/SSIM de cada alvo** — os valores (crf 18, cq 23) sao pontos de
  partida declarados no perfil; calibracao formal e do F5-07.
- **NVENC deterministico um dia?** — exigiria cerimonia de medicao formal
  (AB-700) e trocar a declaracao no perfil por escrito; hoje e `false`.
- **HEVC/AV1** — os perfis deste card sao h264; a forma (objeto inteiro +
  construtor unico) ja cobre libx265/hevc_nvenc/av1_nvenc.
- **Onde os goldens de bytes moram** (fixtures/gm) — o guarda existe
  (`registrarGolden`); a pinagem dos baselines do pipeline final e do
  F5-07.

## Alternativas descartadas

- **Perfil como lista de flags espalhada** (cada card monta o seu ffmpeg) —
  o falso verde da troca de encoder sem nada acusar; o construtor unico e
  a decisao 1.
- **Traduzir CRF <-> CQ por formula** — nao existe equivalencia; numeros
  de escalas diferentes se comparam so por medição de saida (AB-701).
- **Declarar NVENC deterministico** — uma amostra unica identica nao e
  garantia; declaracao falsa transforma o golden em oraculo que pisca por
  motivo irrelevante (video-characterization: limiar afrouxado = oraculo
  morto).
- **Fallback silencioso** ("se NVENC falhar, encoda em x264 e segue") —
  a procedencia mentiria sobre o motor real; a decisao 5 existe para isso.
- **Detectar NVENC por `nvidia-smi` ou por listagem de encoders** — C8 e
  AB-008: presenca de driver/compilacao nao prova inicializacao.
