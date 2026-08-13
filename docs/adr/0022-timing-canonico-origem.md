# ADR-0022 — Origem do timing canonico: dois saltos, oraculo independente

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F3-01 (W5, caminho critico)
- **Depende de:** ADR-0010 (timing de locucao, F2-03), ADR-0007 (contrato de
  estagio e cassete), ADR-0001 (todo card tem oraculo)
- **Consumido por:** F3-02 (legendas), F3-03 (ducking), F3-04 (ritmo) — W6

> **Consolida o ADR-0009 do PROGRAMA.html** ("Origem do timing (provedor ×
> alinhamento)", card F3-01, sign-off pendente). A renumeracao do PREP deu
> a F3-01 o numero 0022; este arquivo e o lugar onde a decisao de origem do
> timing canonico fica registrada com data e placar.

## Contexto

O programa precisa de UMA fonte canonica de tempo para a sincronia de
legenda, ducking e ritmo — tres consumidores, uma fonte. A disputa D-05
(panorama §4, R13 × R04) perguntava, na data de execucao: qual provedor
devolve timing por PALAVRA em pt-BR nativamente, e em que unidade? Se
nenhum devolver, qual caminho alternativo existe e o que ele custa?

A disputa F2-03 foi fechada na W4 a favor do caminho local de alinhamento
(ADR-0010, D-05: inspecao do fonte do Kokoro, 2026-08-13, placar 2-0 — o
ramo pt-BR nao devolve tokens; o modelo alinha em ingles). O que faltava
registrar era a consequencia para a ORIGEM do documento canonico, com a
pesquisa da data de execucao e o custo do caminho alternativo.

## Pesquisa da data de execucao (2026-08-13) — caminhos alternativos e custo

Pergunta: se o provedor de sintese nao fornece alinhamento (e ele nao
fornece — o schema do endpoint de fala nao tem campo de timestamp,
ADR-0010 decisao 1), qual caminho alternativo existe e o que ele custa?
Pesquisa via deep-orchestrator scripts/search.sh (tier Brave, 2026-08-13):

| Caminho | O que e | Timing por palavra | Custo |
|---|---|---|---|
| transcricao hospedada (implementado, F2-03) | endpoint de transcricao com `timestamp_granularities[]=word` | sim, segundos float | um salto extra de rede (audio → texto+tempos); idioma tem de ser enviado explicitamente; juncao obrigatoria em pt-BR |
| WhisperX (m-bain) | faster-whisper + **wav2vec2 de alinhamento forcado** (o timing NAO vem do ASR — vem do estagio de alinhamento, confirmado em discussao #1228) | sim, por palavra | local: modelo wav2vec2 (~350 MB) + CPU/GPU; sem rede |
| whisper-timestamped (linto-ai) | timestamps por palavra via cross-attention do Whisper | sim | local: modelo Whisper inteiro |
| stable-ts (jianfch) | transcricao + alinhamento forcado + timestamps | sim | local |
| aeneas (readbeyond) | Python/C, DTW de texto-conhecido contra audio — o `--dtw` da skill audio-captions-sync; feito para audio de TTS com texto conhecido | sim, por fragmento/palavra | local; projeto parado desde ~2021 (1.7.3) |

Placar honesto: a existencia e o mecanismo dos caminhos locais sao
corroborados por multiplas fontes primarias (READMEs e discussao oficial
do WhisperX) — **3-0** para "existe caminho local de alinhamento forcado
com timing por palavra"; **2-0** para "o timing do WhisperX vem do estagio
de alinhamento, nao do ASR" (fonte: m-bain/whisperx README + discussion
#1228); **1-0** para aeneas (fonte unica: o proprio projeto). O custo em
NUMEROS (tempo de CPU por minuto de audio, MB por modelo) NAO foi medido
nesta data — o que muda a escolha, nao o desenho: o caminho local troca o
salto de rede por download de modelo + CPU, e a arquitetura ja isola a
troca em `provedor.ts`/`alinhamento.ts` (mudar o provedor muda a chave do
cassete, nunca o formato do documento).

## Decisao

### 1. A origem do timing canonico e o caminho de DOIS SALTOS — sintese + alinhamento por transcricao

Nenhum provedor de uso geral devolve audio E timing por palavra na mesma
resposta em pt-BR (tabela da data de execucao em ADR-0010). O caminho
implementado e o mesmo da armadilha de dominio do AGENTS.md ("o caminho
local de transcricao devolve timing por palavra em qualquer idioma") —
hospedado hoje, local amanha, com o MESMO codigo de juncao: sintese
(audio) e depois alinhamento por transcricao com granularidade de
palavra. O documento canonico deriva desse timing por casamento por
CONTEUDO (`casarTimings()`, campo `audio`), em segundos, chaveado por cena
(contrato-w5 §2).

### 2. Em pt-BR o estagio de alinhamento NAO pode ser deletado

A ferramenta de transcricao decodifica como ingles por DEFAULT (tres
lugares independentes, D1/D2/D3 de `alinhamento.ts`), a juncao dela
reconhece so pontuacao ASCII (e `…`, `—`, `«`, `“` viram token proprio em
pt-BR), e o idioma tem de ser enviado explicitamente ao provedor. A regra
R6 de `validarTiming()` (F2-03) reprova qualquer caminho que pule a
juncao. Fechado por inspecao do fonte em 2026-08-13 — placar 2-0.

### 3. O oraculo do timing canonico mede o audio, nao confia no produtor

O oraculo de F3-01 (src/sincronia/timing/validar.ts + construir.ts) nao
deriva da premissa do produtor: mede a duracao do audio no PCM (C4),
confere o hash dos bytes contra o hash do asset, re-deriva a geometria
(monotonicidade, sobreposicao, duracao) em segundos, e cobra o invariante
de cobertura (palavras + silencio = [0, duracao_s]) que NENHUM produtor
calcula. "Timing descreve outro audio" fica VERMELHO aqui mesmo quando o
oraculo do produtor passa — provado por teste (duracao mentirosa aceita
por `validarTiming()` e rejeitada por `construirTimingCanonico()`).

## Consequencias

- O custo do caminho alternativo local e um parametro, nao um redesign:
  trocar o endpoint hospedado por WhisperX/aeneas muda `endpoint_base` e
  `provedor` (a chave do cassete muda — C12), nunca o formato do
  documento canonico nem o contrato dos consumidores.
- A fixture golden `fixtures/canonico/timing-canono.json` e derivada do
  cassete COMMITADO; regravou o cassete (AB-410), regravou o golden
  (AB-521) — o determinismo (Fase 3) fica VERMELHO enquanto isso nao
  acontecer.
- O schema `schema/timing.schema.json` e o oraculo em `validar.ts` sao as
  duas metades da mesma garantia: o schema e a forma (inclusive a
  condicional locucao/silencio), o oraculo e a geometria (fim >= inicio,
  ordem, sobreposicao, cobertura). Duas implementacoes de validador de
  schema (ajv no vitest, jsonschema no pytest) validam o mesmo arquivo.

## Guardas executaveis

```sh
just timing-testar          # schema + casarTimings + ∅-crit + golden byte a byte
just timing-determinismo    # 2x em processos separados + sonda de mutacao
npx vitest run tests/sincronia/timing.test.ts   # oraculo + adversariais 1/2/3
python3 -m pytest tests/sincronia/test_schema_timing.py -q   # segunda implementacao
```

## Sign-off

O ADR-0009 original (PROGRAMA.html) marcava sign-off **pendente**. Este
ADR registra a decisao tecnica como aceita; o sign-off nominal (escopo de
uso, pesos nao-comerciais do caminho local) continua pendente e entra na
onda que escolher o provedor local de alinhamento.
