# TUTORIAL — Editor de Vídeo IA: como usar

> **Escrito a partir da execução real de 2026-08-13** (Onda 3): autoria viva com
> `--provedor openai` + pipeline completo `--estrito` + gates verdes. Todos os
> tempos, hashes e tamanhos abaixo foram medidos nesta execução — nada foi
> inventado. Reproduza na sua máquina: os números dos arquivos podem divergir
> por hash (o LLM não é determinístico), os dos gates não.

---

## O que é a ferramenta

O **Editor de Vídeo IA** transforma um **tema** (uma frase de brief) em um **vídeo
entregue** — MP4 muxado com áudio normalizado e legendas — sem nenhuma edição
manual. O ponto de entrada é um único comando: `just produzir --fixture canonico
--estrito`. Internamente isso executa um pipeline orquestrado de **13 estágios**
(contrato-w9 §3 — variante e thumbnail compartilham o estágio 10; por isso o log
anuncia 14 avisos `[pipeline] estagio ...`, um por execução, sem contradição),
que produzem **11 artefatos** verificados (hash + tamanho, lista fechada do
contrato-w9 §2), com a autoria decidindo **o quê** contar e o sistema decidindo
**como** mostrar: o LLM produz só a narrativa (manifesto `Autoria.1`); frames,
layout, cor, timing e áudio são decisões do sistema, que não existem no schema
(fronteira de decisão do contrato de autoria).

Em uma visão macro, o pipeline tem **5 fases**:

| Fase | O que acontece | Saída |
|---|---|---|
| 1. **Autoria** | LLM vivo (OpenAI/Anthropic) escreve o manifesto a partir do brief | `manifesto.json` (Autoria.1) |
| 2. **Resolução** | URLs/asset por hash, offline por cassetes commitados | `manifesto-resolvido.json` + store SHA-256 |
| 3. **Composição + render** | Remotion renderiza os nós (cabeçalho, texto, lista, código, gráfico, camadas) | `master.mov` determinístico |
| 4. **Mix + pós** | Timing canônico, ducking, loudness -23 LUFS, legendas | `entregavel.m4a` + `entregavel.srt` + `pos-documento.json` |
| 5. **Entrega** | Variante 16:9, thumbnail, procedência, mux, relatório | `entregavel-final.mp4` + `relatorio-final.json` |

**A fronteira de determinismo** é a regra arquitetural que sustenta tudo: tudo que
chega ao pixel ou ao áudio é calculado **acima** da fronteira (tempo, tokens,
assets, fonte), e o render é determinístico — o mesmo manifesto produz os mesmos
bytes. A prova é a camada 1 do oráculo (render 2x com `-fflags +bitexact`, hash
por frame `framemd5`) e o cache por conteúdo (chave C7: manifesto, assets
re-hashados, tokens, versões de ferramentas — nunca data). Por isso o relatório
final carrega `escritoEm: 1970-01-01` — o relógio é congelado por design (ver
Limitações).

O **motor de render é o Remotion** (versão pinada 4.0.507), executado pelo
Chrome headless empacotado com a versão correspondente. O FFmpeg **6.1.1** é o
pin verificado de toda a cadeia de mídia (o pipeline falha se a versão corrente
divergir do pin — `just pos` e `just e2e` conferem).

---

## Pré-requisitos

| Requisito | Versão | Como verificar |
|---|---|---|
| Node.js (v24) | **24** (via `.nvmrc`) | `node --version` |
| npm | com `package-lock.json` | `npm ci` instala |
| just | 1.42+ | `just --version` |
| FFmpeg | **6.1.1** (pin verificado pelo pipeline) | `ffmpeg -version` |
| Python | 3.12 (ferramental: pytest, ruff, jsonschema) | `python3 --version` |

**Chaves de ambiente** (o `.env` NÃO é lido — as chaves vêm do ambiente):

- `OPENAI_API_KEY` — autoria com `--provedor openai` (default).
- `ANTHROPIC_AUTH_TOKEN` (fallback `ANTHROPIC_API_KEY`) — autoria com
  `--provedor anthropic`. Hoje o fetch anthropic é **sempre** o **SOSIA** local —
  a credencial só silencia o aviso ruidoso do stderr (ver Limitações, item iv).

Instalação:

```bash
npm ci
```

---

## Passo a passo REAL (execução de 2026-08-13)

### 1. Autoria viva — a cerimônia

```bash
just autoria-gravar --provedor openai
```

Saída real desta execução (9,5 s no total):

```
npx tsx src/autoria/executor/gravar-cassete.ts --provedor openai
cassete de autoria (openai): fixtures/cassetes/autoria/dfb7e0a33359d36408b9d5c76bd55f618dd15d6ed72179c444fb17e90d2ea709
  chave: dfb7e0a33359d36408b9d5c76bd55f618dd15d6ed72179c444fb17e90d2ea709
  origem: chamada
  chamadas gravadas: 1
  manifestos invalidos gravados: 7
```

A cerimônia chama o LLM real **uma vez**, valida o resultado contra o schema
completo (o gate roda **antes** do cache — P2), grava o cassete e o conjunto de
manifestos inválidos usado pelos testes de rejeição. **Regravar pode mudar o
conteúdo do cassete** (o LLM não é determinístico — nem com `temperature: 0`):
isso é normal e os gates não dependem do conteúdo. O que importa é a chave do
cassete (hash do brief) e a estrutura.

**Pronúncia da locução (fonte única):** a pronúncia de termos técnicos e
siglas em pt-BR é definida **uma única vez**, no dicionário oficial
`docs/autoria/prompts/dicionario-pronuncia.md` — os prompts de autoria o
aplicam por referência; nenhum outro arquivo do repositório define
`termo → pronúncia` (regra F4-02, gate em `tests/prompts/prompts.test.ts`).

### 2. Produção — o pipeline completo

```bash
just produzir --fixture canonico --estrito --saida <WORKTREE>/output-tutorial
```

Saída real (resumida; 29,5 s de parede, 326% CPU) — o CLI imprime
`arquivo: arquivo (hash, tamanho)` com o nome duplicado; abaixo, o formato foi
limpo:

```
=== produzir: pipeline de ponta a ponta (F5-07, W9) ===
npx tsc --noEmit
... (validação da fixture: 1 encontrada, 1 válida, 0 inválidas)
npx tsx src/pipeline/produzir.ts --fixture canonico --estrito --saida .../output-tutorial
[pipeline] estagio autoria...
[pipeline] estagio reparo-mecanico...
[pipeline] estagio resolucao-offline...
[pipeline] estagio timing...
[pipeline] estagio composicao...
[pipeline] estagio mix...
[pipeline] estagio render...
[pipeline] estagio encode...
[pipeline] estagio pos...
[pipeline] estagio variante...
[pipeline] estagio thumbnail...
[pipeline] estagio procedencia...
[pipeline] estagio mux...
[pipeline] estagio relatorio-final...
=== produzir: VERDE (11 artefatos conferidos) ===
  manifesto-resolvido.json: 1c0ea9f8a86d…, 17883B
  master-de-video-deterministico: master.mov 44bc866d0317…, 22995405B
  master-de-audio-do-mix: master.wav 64d172e6efec…, 9305644B + mix-documento.json eb709326cbef…, 1146B
  entregavel.m4a: 5370f578021c…, 568288B
  entregavel.srt: eef6f14c95d6…, 225B
  pos-documento.json: c860d68b27c8…, 970B
  variante-16x9.json: bed97b2df491…, 9730B
  thumbnail.png: ff2d57b8e0eb…, 40158B
  relatorio-procedencia.json: 901fce3cad01…, 14420B
  entregavel-final.mp4: 28171670eb8a…, 1156329B
```

`--estrito` significa: autoria **pulada** (usa a fixture canonica), reparo
**mecânico** (zero LLM), resolução **offline** por cassetes commitados com a rede
**bloqueada**, encode apenas com perfis `deterministico: true`, escopo 16:9 e o
pin ffmpeg 6.1.1 verificado.

### 3. Verificação — o que fazer com a saída

**Hash 1:1:** o `relatorio-final.json` declara sha256 + tamanho de cada artefato
(escrito **por último**, atomicamente — se o pipeline morrer no meio, ou fica o
relatório anterior ou nada). Confira contra os arquivos:

```bash
cd output-tutorial
sha256sum manifesto-resolvido.json master.mov master.wav mix-documento.json \
  entregavel.m4a entregavel.srt pos-documento.json variante-16x9.json \
  thumbnail.png relatorio-procedencia.json entregavel-final.mp4
```

Nesta execução: **11/11 arquivos conferem 1:1** (hash e tamanho) contra o
relatório.

**Conteúdo do vídeo (C1):** o piso do pipeline é o YAVG máximo por frame ≥ 32
(um vídeo inteiro preto fica em ~16–22; a fixture canônica calibrou em ~65):

```bash
ffprobe -v error -show_entries stream=index,codec_name,codec_type,width,height,r_frame_rate,duration -of compact entregavel-final.mp4
# stream|0|h264|video|1920x1080|30/1|24.233333   +   stream|1|aac|audio|48000|2|24.233000

ffmpeg -i entregavel-final.mp4 -vf signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=- -f null - 2>/dev/null \
  | grep -oP 'YAVG=\K[0-9.]+' | sort -n | tail -1
# 64.854  (piso 32 — vídeo com conteúdo real)
```

**Loudness (alvo -23 LUFS, teto -1 dBTP)** — medido pelo próprio pós e
registrado em `pos-documento.json`:

```json
"medicoes": { "integradoLufs": -23, "overshootDb": -3.55e-15, "truePeakDbtp": -19.3 },
"normalizacao": { "ganhoAplicadoDb": -7.6, "lufsDoMaster": -15.4 }
```

**Legendas:** o `entregavel.srt` descreve a timeline **pós-reconciliação** do mix
(P4): 2 cues sem sobreposição, separadas exatamente no corte do mix em 18,233 s
— a primeira termina no corte, a segunda começa nele.

```srt
1
00:00:14,233 --> 00:00:18,233
Nesta seção, apresentamos os dados de
desempenho do pipeline. Cada tipo de nó

2
00:00:18,233 --> 00:00:23,588
Concluindo, o manifesto é a peça central
do pipeline. Obrigado por assistir.
```

### 4. Gates

```bash
just autoria-suite      # 18 arquivos, 189 testes  — contrato, cache, normalização, rejeição, reparo
just autoria-cassete    # 5 testes — determinismo do cassete (regravar = bytes idênticos exceto voláteis)
just pos                # suite do pós + gate real com 8 sondas ∅-crit
just e2e                # R1 (cache frio) + R2 (idempotente) + R3 (chave C7 mutada) + ∅-crit de presença dos 11 artefatos
```

Resultados reais desta execução: `autoria-suite` 189/189 (605 ms), `autoria-cassete`
5/5, `pos` VERDE (8 sondas ∅-crit confirmando VERMELHO pelo motivo certo) e `e2e`
VERDE — 11 testes + gate real com R1/R2/R3, determinismo do perfil (2x encodes =
45.486 B idênticos + framemd5 idêntico) e pin ffmpeg 6.1.1 conferido no
MixDocument.

---

## Os 11 artefatos

Caem todos em `--saida` (por default, `output/`), **gitignored** — a entrega é em
disco, nunca no git. Tamanhos reais desta execução:

| # | Arquivo | Tamanho real | O que é |
|---|---|---|---|
| 1 | `manifesto-resolvido.json` | 17.883 B | ManifestoResolvido.1 — o manifesto com todos os assets resolvidos a hash |
| 2 | `master.mov` | 22.995.405 B | Master de vídeo determinístico (QTRLE, sem perdas) |
| 3 | `master.wav` | 9.305.644 B | WAV f32le do master de áudio do mix |
| 4 | `mix-documento.json` | 1.146 B | MixDocument.1 — plano de mix + pins de ferramentas |
| 5 | `entregavel.m4a` | 568.288 B | AAC 192 kbps 48 kHz estéreo, -23 LUFS, teto -1 dBTP conferido no codificado |
| 6 | `entregavel.srt` | 225 B | Legendas pós-reconciliação (2 cues, sem sobreposição) |
| 7 | `pos-documento.json` | 970 B | PosDocument.1 — alvo, ganho, medições, hashes, pins |
| 8 | `variante-16x9.json` | 9.730 B | Variante 16:9 derivada do mesmo manifesto |
| 9 | `thumbnail.png` | 40.158 B | Thumbnail com contraste e piso de legibilidade conferidos |
| 10 | `relatorio-procedencia.json` | 14.420 B | Procedência transitiva (todo asset com origem declarada) |
| 11 | `entregavel-final.mp4` | 1.156.329 B | MP4 final muxado (vídeo + áudio) — 1920x1080@30, 24,2 s |

Mais o `relatorio-final.json` (3.0 KB) — a declaração de sucesso com hash +
tamanho dos 11 itens acima, escrito por último. Um artefato faltando, renomeado
ou corrompido deixa o gate vermelho **nomeando o artefato** (∅-crit de ausência).

---

## Gates e verificação — o que cada um prova

| Gate | Comando | O que prova | Por que não é decorativo |
|---|---|---|---|
| Contrato de autoria | `just autoria-suite` (189 testes) | Schema completo + subset por fornecedor, cache HIT/MISS (C12), normalização null→ausente (P1), rejeição de inválido **antes** do pipeline **e** do cache (P2), vocabulário de transição, regras duras AB-432/AB-433 | Um inválido que passa derruba a suite (`rejeicao.test.ts`); filtro vazio sai 0 sem olhar nada — o runner exige o numerador |
| Determinismo do cassete | `just autoria-cassete` (5 testes) | Regravar reproduz bytes idênticos exceto os voláteis declarados, com sonda negativa | Sonda negativa: mutar o resultado TEM de ficar vermelho |
| Pós-processamento | `just pos` | Suite + gate real: medição (loudness/true peak), sidecar coerente com a queimada, pin ffmpeg 6.1.1 + node conferido | 8 sondas ∅-crit: sidecar divergindo, perfil `deterministico: false`, pin divergindo, normalização dupla — todas TEM de ficar vermelhas pelo motivo certo |
| Ponta a ponta | `just e2e` | R1 produção com chave FRIA (miss forçado), R2 re-executa integral idempotente (cache quente, 0 chamadas ao renderer, artefatos idênticos), R3 chave C7 mutada → MISS obrigatório; ∅-crit de presença (remover/corromper cada um dos 11 artefatos fica vermelho nomeando o artefato); determinismo do perfil (2x encodes = bytes + framemd5 idênticos); escopo 16:9 | O e2e é manual (`just e2e` — o CI não o roda) e, sob carga, o render Chrome tem um flake transitório conhecido — se falhar por isso, re-execute; cada execução faz 3 renders completos — a prova do join é cara de propósito |

---

## Limitações conhecidas

1. **Relógio congelado no relatório-final.** `escritoEm: 1970-01-01T00:00:00.000Z`
   — é determinismo R2 **por design**, não bug: data no artefato faria o hash
   mudar a cada execução. O relatório é estável byte a byte para a mesma entrada.
2. **O modo estrito é OFFLINE.** A rede é bloqueada durante a execução; a
   resolução acontece por **cassetes commitados** (F2-07) — sem TTS ao vivo, sem
   downloads, sem chamadas externas. Autoria e gravação de cassete são
   cerimônias manuais, com rede e credencial, fora do estrito.
3. **Regravar o cassete de autoria muda seu conteúdo.** O LLM não é
   determinístico (nem com `temperature: 0` a OpenAI garante; `seed` é
   best-effort). Os gates não dependem do conteúdo — dependem da chave e da
   estrutura; o `git diff` do cassete é esperado após cada cerimônia.
4. **`--provedor anthropic` grava SEMPRE do SOSIA — não há caminho de chamada
   real hoje.** O código constrói o gravador com
   `provedor === "anthropic" ? fetchSosia(...) : globalThis.fetch`: para
   anthropic o fetch é incondicionalmente o SOSIA local (resposta canônica
   pré-existente), com ou sem credencial. Exportar `ANTHROPIC_AUTH_TOKEN` (o
   código lê AUTH_TOKEN primeiro, com fallback para ANTHROPIC_API_KEY — P3)
   apenas silencia o aviso ruidoso do stderr — o conteúdo gravado continua
   sendo o SOSIA. A chamada real anthropic é trabalho pendente (AB-552).
5. **Golden master visual stale.** O golden master de pixel (`fixtures/gm`) está
   defasado em relação à **saída atual do pipeline** — não ao cassete de
   autoria: o fix P4 (Onda 2) mudou o `entregavel.srt` (308 B pré → 225 B
   pós-reconciliação) e o `pos-documento.json` ganhou o hash do sidecar. O
   golden antigo não reflete essas saídas; `gm-e2e` não é gate do fluxo de
   produção. Dívida pré-existente — re-baseline apenas quando um bug de
   divergência exigir, nunca por rotina.

---

## Problemas encontrados e corrigidos nesta rodada (P1–P4)

Todos foram encontrados na **Onda 1** (primeira execução de ponta a ponta) e
corrigidos na **Onda 2** (merges `0726ee9` + `8fa3986`). Esta rodada (Onda 3)
executou o fluxo já corrigido, de ponta a ponta, com todos os gates verdes.

| # | Problema (medido na Onda 1) | Causa | Correção (Onda 2) |
|---|---|---|---|
| **P1** | Manifesto de autoria com `transicao_*: null` era rejeitado pelo schema completo | O strict mode da OpenAI emula campo opcional com `anyOf [X, null]`; o schema completo só aceita **ausência** — null não valida | `src/autoria/contrato/normalizar.ts` (186 linhas): normalização `null → ausente` derivada do subset do fornecedor, no ponto único entre a extração/cache e o gate; o documento normalizado é o que o cache persiste e o pipeline consome |
| **P2** | Cache **antes** do gate: resposta inválida era persistida e a 2ª tentativa com a mesma entrada servia o **cache envenenado** (medido) | `escreverNoCache` rodava antes de `rejeitarSaidaInvalida` | Gate **antes** do cache: resposta rejeitada nunca é persistida; resposta cacheada (mesmo por caminho antigo) também passa pelo gate — cache envenenado não entra no pipeline |
| **P3** | `--provedor anthropic` com credencial presente gravava do **SOSIA em silêncio** | O código lia `ANTHROPIC_API_KEY`; o ambiente provisiona `ANTHROPIC_AUTH_TOKEN` | `resolverChaveDeApi`: AUTH_TOKEN primeiro, fallback API_KEY; `avisarSosiaSemCredencial`: aviso ruidoso no stderr quando anthropic explícito não tem credencial — o SOSIA deixa de ser invisível |
| **P4** | `entregavel.srt` com **cues sobrepostas** (serializava o documento de legendas, não a timeline real do mix) | O sidecar ignorava os cortes do mix | `reconciliarComOMix` (C1): cue que cruza o corte é truncada no corte; menos de 1 frame visível é removida; nenhuma cue sobrepõe a vizinha. SRT atual: `[14,233–18,233]` e `[18,233–23,588]` — o corte do mix em 18,233 s coincide com o fim da primeira janela |

---

## Solução de problemas

**`Waiting for registerRoot() to get called` ao rodar o Studio/CLI — JÁ CORRIGIDO.**
O entry `src/index.ts` era `export {}` e o CLI nunca via o registro da raiz. O
fix: `src/index.ts` importa e registra `registerRoot(RaizRemotion)` no escopo de
módulo (composição `id="manifesto"`), coberto por `tests/integracao/entry/
cli-entry.test.ts` (integração real com `npx remotion compositions` + autoteste
que asserta a mensagem literal). Se reaparecer, é regressão do entry — o teste
fica vermelho.

**`ErroContratoAutoria` na cerimônia de autoria.** A resposta do LLM não validou
contra o schema completo — foi rejeitada antes do pipeline **e** antes do cache
(P2), então o cassete não foi gravado. O que fazer: (a) confirmar que usa
`--provedor openai` (a normalização P1 cobre o `null` que o strict da OpenAI
emite); (b) revisar o campo rejeitado na mensagem do erro — se for uma
transição, é o P1; (c) repetir a cerimônia — o LLM não é determinístico e uma
resposta ruim pode sair boa na tentativa seguinte. A suite `autoria-rejeicao`
garante que um inválido **não** passa — o erro é o sistema funcionando.

**Cache envenenado.** Um cassete gravado por um caminho antigo (pré-P2) pode
conter resposta inválida. O gate atual o rejeita na hora do uso (cacheado
também passa pelo gate), mas se você quiser limpar: apague o diretório do
cassete em `fixtures/cassetes/autoria/<chave-do-brief>/` e regrave. O cache de
render fica em `/tmp/ai-video-maker/render-cache` por default (`--cache-dir`
para mudar) e é invalidado por conteúdo (C7) — nunca precisa de limpeza manual,
mas apagar é inócuo: a re-execuação é integral e idempotente.

**Gates vermelhos depois de nada ter mudado.** O `e2e` é manual (`just e2e` — o
CI não o roda) e tem um flake transiente conhecido do render Chrome sob carga:
se falhar por isso, re-execute uma vez antes de investigar. Qualquer outro
vermelho nomeia a causa: "nenhum teste selecionado"
significa filtro vazio (falso verde do runner — o gate exige o numerador);
saída vazia de `ffprobe` com exit 0 significa chave errada (o sinal é a saída,
não o código).
