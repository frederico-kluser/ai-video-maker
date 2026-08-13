# ADR-0007 — Timing de locucao por palavra: formato, origem e a juncao obrigatoria

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F2-03 (W4, caminho critico)
- **Depende de:** ADR-0006 (contrato de estagio e cassete), ADR-0003 (uso pessoal)
- **Consumido por:** F3-01 (W5, timing canonico), F2-07 (W5, suite offline)

## Contexto

O card F2-03 produz **audio** e **timing por palavra** da locucao. O timing e
insumo direto do F3-01 (W5) e de toda a cadeia de legenda e ducking. Este ADR
registra tres decisoes que o codigo do estagio ja executa, para que quem
chegar depois nao precise reabrir o codigo para saber por que o formato e
este, por que a origem e a transcricao, e por que a juncao nao pode ser
deletada em pt-BR.

## Pesquisa da data de execucao (2026-08-13) — timing por palavra por provedor

Pergunta do card: qual provedor devolve timing por **PALAVRA** em pt-BR
nativamente, e em que unidade? A resposta, tabulada por provedor (placar e
fonte no corpo da skill `tts-voiceover` e em `docs/pesquisa/R13-tts-locucao.md`):

| Provedor | Timing nativo em pt-BR | Unidade |
|---|---|---|
| OpenAI `/v1/audio/speech` | **nenhum** — schema sem timestamp, sem seed | — |
| ElevenLabs `/with-timestamps` | por **caractere**, na mesma resposta | segundos |
| Cartesia Sonic (WebSocket) | por **palavra e fonema**, no stream | segundos |
| AWS Polly (speech marks) | por palavra, **chamada separada**, sem audio | offsets em **byte** |
| Azure Speech (WordBoundary) | por palavra, via SDK | ticks de 100 ns |
| Google TTS | so `<mark>` SSML, v1beta1 | segundos |
| Kokoro-82M (local) | **so no ramo ingles** — ver D-05 abaixo | ms (ingles) |
| Piper (local) | alinhamento **experimental por fonema** | amostras |

Nenhum provedor de uso geral devolve audio **e** timing por palavra na mesma
resposta em pt-BR. O caminho implementado tem dois saltos: sintese (audio) e
depois alinhamento por transcricao com granularidade de palavra. A unidade
canonica do programa e **milissegundo inteiro**, porque float serializa de
modo nao-deterministico e o cassete exige bytes identicos ao regravar.

### D-05 — o caminho local ainda e guardado por idioma ingles (verificado no fonte)

A disputa R13 × R04 sobre o Kokoro (`docs/00-panorama-verificado.md §4`) esta
fechada por inspecao do fonte na data de execucao: `kokoro/pipeline.py` chama
`join_timestamps` **somente** quando `self.lang_code in 'ab'` (ingles); o ramo
nao-ingles (`lang_code='p'`, pt-BR) devolve `Result` sem `tokens`, portanto
sem `start_ts`/`end_ts`. O R04 estava certo no mecanismo (2-0); o R13 estava
certo no escopo (o modelo alinha em ingles). A consequencia de planejamento
nao muda: **em pt-BR nao existe caminho local pronto de timestamp por palavra
hoje**, e o estagio de alinhamento nao pode ser deletado. Placar 2-0,
verificado 2026-08-13 contra `https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py`.

## Decisoes

### 1. O timing e um asset de dados separado, ligado ao audio por conteudo

`ParcialResolvido` (F2-01) nao tem campo de timing e este card nao edita o
arquivo de outro dono. O documento de timing e um asset `tipo: "dados"` com
`mimeType: application/vnd.editor-video-ia.timing-locucao+json`, enderecado
pelo SHA-256 dos proprios bytes canonicos. A ligacao timing→audio vive no
campo `audio` do documento. F3-01 casa por conteudo (`casarTimings()`), nunca
por posicao.

### 2. A unidade e milissegundo inteiro, ancorado no byte zero do audio

Nenhum tempo de parede (C9): `inicio_ms` e offset dentro do proprio audio.
A duracao total sai do PCM (C4), nao de container nem do provedor.

### 3. A juncao roda SEMPRE e a regra R6 a prova

Em pt-BR o estagio de alinhamento nao pode ser deletado, por tres motivos
independentes: (a) o caminho de transcricao decodifica como ingles por
default; (b) a juncao da ferramenta reconhece so pontuacao ASCII, e `…`, `—`,
`«`, `»`, `“`, `”` viram token proprio; (c) o idioma e sempre enviado
explicitamente ao provedor. `montarTiming()` roda a juncao incondicionalmente
e a regra R6 de `validarTiming()` reprova qualquer caminho que a pule.

## Consequencias

- O timing e versionado por conteudo: mudou o formato, mudou o hash, e o
  bump de `identidade.versao` do estagio invalida o cassete (C12).
- A credencial do provedor nao entra na chave nem no cassete: o gravador
  redige `authorization`, e a chave de cache carrega `endpoint_base`, que e
  o que identifica o produtor dos bytes.
- Cassete gravado contra o sosia local (AB-410) enquanto nao houver credito
  no provedor real: regravar com credito e trocar `endpoint_base` e
  `provedor` nos parametros — a chave muda, o cassete de sosia nao e servido
  no lugar do real.
