# CONTRATO DE API — App Web "Editor de Vídeo IA"

**Status: CONTRATO CONGELADO (Onda 1).** O servidor da Onda 4 implementa
**exatamente** as rotas abaixo; a SPA da Onda 5 consome **exatamente** as
mesmas. Nada é inventado no caminho: o teste FQ-C4 (tests/roteiro/contrato.test.ts)
cruza este documento com `src/roteiro/contrato/rotas.ts` — rota documentada
sem constante (ou constante sem rota no documento) é **FALHA**.

Qualquer mudança neste contrato é **bump de contrato**: novo documento, novo
código, e a SPA antiga para de funcionar contra o servidor novo — nunca uma
edição no lugar.

## Porta e base

- Porta do servidor: **4610** (S-9 — declarada aqui e na Onda 4). Colisão de
  porta é erro claro no startup, nunca silêncio (FQ-S4).
- Base: `http://localhost:4610`.
- Tudo abaixo de `/api/` fala JSON (`Content-Type: application/json`); os
  endpoints de arquivo (`narracao/audio` PUT/GET, `anexo` PUT/GET e
  `*.mp4`) falam bytes.

## Envelope de erro

Todo erro tem o mesmo shape (nunca texto solto):

```json
{ "erro": { "codigo": "projeto-nao-encontrado", "mensagem": "projeto \"x\" nao existe", "detalhes": ["..."] } }
```

- `codigo` — identificador estável (a SPA casa por ele, nunca por texto).
- `mensagem` — para o usuário, em pt-BR.
- `detalhes` — opcional; problemas do validador (regras nomeadas de
  `src/roteiro/contrato/validar.ts`).

Códigos HTTP: `200` ok · `201` criado · `202` job aceito · `204` sem corpo ·
`400` corpo inválido (schema/validação — FQ-C1: nunca aceita em silêncio) ·
`404` recurso inexistente · `405` verbo errado na rota certa · `409` estado
conflitante (ex.: preview pedido sem roteiro gerado) · `422` payload semântico
inválido · `500` erro interno com `mensagem` honesta (nunca "ok" mentiroso —
FQ-S1: rota inválida nunca vira 500 silencioso).

## Jobs assíncronos

Toda operação pesada (gerar roteiro, regenerar pedaço, render de preview,
juntar) é um **job**: o POST devolve `202` + `Location: /api/jobs/<jobId>`; a
UI **polla** `GET /api/jobs/:jobId` (nunca trava a requisição). Estado do job:

```json
{
  "id": "job-9f8e7d6c5b4a39281706f5e4d3c2b1a0",
  "tipo": "gerar-roteiro | regenerar-pedaco | preview-pedaco | juntar-video",
  "estado": "pendente | rodando | ok | erro",
  "progresso": 0.45,
  "mensagem": "Renderizando frames 240-480...",
  "erro": null,
  "criado_em": "2026-08-14T10:00:00.000Z",
  "atualizado_em": "2026-08-14T10:00:03.000Z",
  "artefato": { "tipo": "roteiro-json | video-mp4 | audio-wav", "caminho": "/api/projetos/proj-001/video-final.mp4" }
}
```

- `estado`: `pendente` (enfileirado) → `rodando` (progresso sobe) → `ok` ou
  `erro`. Estado terminal com `erro` **sempre** traz a saída real do CLI
  (FQ-S3).
- `progresso`: 0..1 (opcional — CLIs que não reportam etapas deixam nulo).
- `artefato.caminho`: a rota **pública** de download do artefato (o caminho
  de disco nunca vaza para a SPA — C7: endereço por conteúdo, não por
  localização).

## CLIs de operação pesada (D11) — a convenção

Toda operação pesada é um **CLI executável**; o servidor só faz
`child_process`. Contrato **único** para todos os CLIs do domínio:

1. **Entrada: JSON em stdin.** O pedido completo (ex.: `PedidoGerarRoteiro`
   de `src/roteiro/contrato/contrato.ts`, com as `versao_*` preenchidas pelo
   servidor — o cliente da API nunca as envia).
2. **Saída: JSON em stdout.** Resultado final (`Roteiro` completo, o pedaço
   regenerado, `{caminho, duracao_segundos}` do preview, `{caminho,
   duracao_total_segundos}` do juntar). Exit 0 = sucesso; exit != 0 = erro,
   com a mensagem em stderr (a saída JSON é só sucesso).
3. **Progresso: arquivo.** O CLI recebe o caminho do arquivo de estado por
   **argumento** (`--estado <path>`) ou **env** (`ROTEIRO_ESTADO_PATH`) e o
   reescreve (JSON de `JobStatus` sem `id`/`artefato`) à medida que avança —
   o servidor relê o arquivo a cada poll. Escrita atômica (tmp + rename,
   S-8): o poll nunca lê o arquivo pela metade.
4. **Mídia entra por caminho, nunca por stdin.** Operação que recebe mídia
   (conversão webm→wav, juntar com música) recebe **caminhos** no JSON de
   entrada — os bytes já estão no disco do servidor, endereçados por hash
   (C7). O CLI nunca baixa nada, nunca toca a rede.

Exemplo (gerar roteiro):

```bash
printf '%s' "$PEDIDO_JSON" | npx tsx src/roteiro/gerador/cli.ts --estado /tmp/job-1.json
```

## Rotas — lista canonica

```http
GET  /
GET  /assets/*
POST /api/projetos
GET  /api/projetos
GET  /api/projetos/:id
PATCH /api/projetos/:id
DELETE /api/projetos/:id
POST /api/projetos/:id/roteiro/gerar
POST /api/projetos/:id/pedacos/:pedacoId/regenerar
PATCH /api/projetos/:id/pedacos/:pedacoId
PUT /api/projetos/:id/pedacos/:pedacoId/narracao/audio
GET /api/projetos/:id/pedacos/:pedacoId/narracao/audio
DELETE /api/projetos/:id/pedacos/:pedacoId/narracao
PUT /api/projetos/:id/pedacos/:pedacoId/anexo
GET /api/projetos/:id/pedacos/:pedacoId/anexo
DELETE /api/projetos/:id/pedacos/:pedacoId/anexo
POST /api/projetos/:id/pedacos/:pedacoId/preview
GET /api/projetos/:id/pedacos/:pedacoId/preview.mp4
POST /api/projetos/:id/juntar
GET /api/projetos/:id/video-final.mp4
GET /api/jobs/:jobId
```

**Matcher de rotas (Onda 4):** segmento literal vence `:param` (ex.:
`/api/jobs/status` nunca é o `:jobId` de outra rota — na dúvida, 404 com
`codigo: rota-nao-encontrada`, nunca 500).

## Detalhe por rota

### GET / — index da SPA

Serve o `index.html` da SPA. Qualquer GET fora de `/api/` e de `/assets/*`
serve o index (fallback do roteamento do cliente). 200.

### GET /assets/* — estáticos da SPA

Arquivos do build (js/css/fontes locais — C6: nenhuma fonte remota no
render). 200 com o tipo do arquivo; 404 se não existe.

### POST /api/projetos — cria projeto

Corpo (o servidor completa com `id`, `criado_em`, `atualizado_em`):

```json
{ "brief": { "tema": "Como funciona um cache", "contexto": "para iniciantes", "duracao_alvo_segundos": 30 } }
```

Resposta `201`: o `ProjetoRoteiro` completo (shape de
`src/roteiro/contrato/contrato.ts`, `roteiro` ausente até gerar).
`400` com as regras de `validarBriefRoteiro` se o brief for inválido
(FQ-C1: brief sem tema é rejeitado, nunca aceito).

### GET /api/projetos — lista projetos

Resposta `200`:

```json
{ "projetos": [ { "id": "proj-001", "tema": "Como funciona um cache", "criado_em": "...", "atualizado_em": "..." } ] }
```

### GET /api/projetos/:id — obtém o projeto

Resposta `200` — envelope com o projeto (roteiro **com as edições do
usuário aplicadas** — `pedacos_editados` mergeado via
`editarPedaco` de `src/roteiro/contrato/edicao.ts`) e os jobs recentes por
alvo:

```json
{
  "projeto": { "id": "...", "brief": { "...": "..." }, "roteiro": { "...": "..." }, "pedacos_editados": { "p-001": { "fala": "..." } }, "criado_em": "...", "atualizado_em": "..." },
  "jobs": {
    "gerar_roteiro": null,
    "previews": { "p-001": { "job_id": "job-...", "estado": "ok", "progresso": 1 } },
    "juntar": null
  }
}
```

`404` com `codigo: projeto-nao-encontrado` (FQ-S1). O `jobs` é derivado do
estado dos jobs — nunca persiste no projeto.

### PATCH /api/projetos/:id — atualiza o brief

Corpo: `{ "brief": { ...novo brief... } }`. Resposta `200` com o projeto
atualizado. `400` se o brief novo for inválido.

### DELETE /api/projetos/:id — apaga o projeto

Resposta `204`. Remove o diretório do projeto e os jobs pendentes dele.

### POST /api/projetos/:id/roteiro/gerar — job: gera o roteiro completo

Corpo:

```json
{ "brief": { "tema": "...", "contexto": "..." }, "duracao_alvo_segundos": 30 }
```

- O servidor monta o `PedidoGerarRoteiro` (brief + `duracao_alvo_segundos`
  efetiva + `versao_contrato`/`versao_contrato_gerador`/`versao_gerador` do
  contrato corrente) e o entrega ao CLI do gerador (stdin).
- `202` + `Location: /api/jobs/<jobId>`. Job `ok` → `artefato.tipo:
  roteiro-json` e o roteiro novo **substitui** o do projeto (e os
  `pedacos_editados` com id que não existe mais no roteiro novo são podados).
- Regenerar o roteiro inteiro NÃO invalida o cache de preview dos pedaços
  idênticos byte a byte (FQ-G2/FQ-P1: determinismo por conteúdo).

### POST /api/projetos/:id/pedacos/:pedacoId/regenerar — job: regenera UM pedaço

Corpo: vazio. O servidor monta o `PedidoRegenerarPedaco`:

- `pedaco_atual`: o pedaço com as edições do usuário **já aplicadas**
  (FQ-G3: edição entra na chave do gerador);
- `resumo_demais_pedacos`: `resumoDePedacos` dos irmãos
  (`src/roteiro/contrato/canonicalizar.ts` — determinístico por construção);
- versões do contrato corrente.

`202` + `Location`. Job `ok` → o pedaço novo **substitui somente ele** no
roteiro (id e indice preservados; os irmãos ficam byte a byte intactos —
FQ-G2) e o `pedacos_editados[pedacoId]` é limpo (a edição foi dobrada no
pedaço regenerado). `404` se o pedaço não existe; `409` sem roteiro.

### PATCH /api/projetos/:id/pedacos/:pedacoId — edita pedaço

Corpo: `EdicaoPedaco` (`src/roteiro/contrato/contrato.ts` — só os campos
editáveis; `id`, `indice`, `narracao` e `anexo_hash`/`anexo_meta` **nunca**
vêm daqui).

- O servidor valida o delta (`validarEdicaoPedaco` — FQ-C1: delta inválido
  é 400 com a regra nomeada) e grava em `pedacos_editados[pedacoId]`
  (fonte de verdade da edição). O GET do projeto serve o roteiro com a
  edição aplicada.
- Edição que toca `fala` aplica as regras de narração do contrato:
  pedaço **já narrado** vira `editado` (regra
  `status-editado-dessincronizado` — o áudio antigo corresponde ao texto
  antigo e fica stale até regenerar/regravar; **o áudio em si não é
  apagado** — dedupe por hash, S-8); pedaço **nunca narrado** continua
  `vazio`; **apagar a fala** (`fala: ""`) limpa a narração inteira.
- **Anexo não entra por PATCH** (regra `edicao-anexo-proibido` — 400): o
  anexo muda somente pela rota de anexo. Edição que define `tipo_visual`
  `gif`/`video` sem anexo no pedaço é 400 (regra
  `anexo-exigido-para-gif-video`) — o fluxo é **upload primeiro, tipo
  depois**: `PUT anexo` → `PATCH tipo_visual` (ver rota de anexo abaixo).
- `404` pedaço inexistente; `400` delta inválido.

### PUT /api/projetos/:id/pedacos/:pedacoId/narracao/audio — envia a gravação

- `Content-Type`: `audio/webm` (a saída do MediaRecorder do navegador) **ou**
  `audio/wav`. Corpo: os bytes crus do áudio.
- O servidor converte para o formato congelado **wav 48 kHz estéreo**
  (FORMATO_AUDIO_GRAVADO — Onda 3), calcula o SHA-256 do wav final e grava
  no store (append-only por hash, S-8; mesmo arquivo 2x = mesmo hash, FQ-N1).
- Atualiza a narração do pedaço: `{ texto: fala, origem: "gravacao",
  hash_audio: <sha256 do wav>, status: "gerado" }` (a fala do pedaço vira o
  texto narrado — D4: sem whisper, sem legendas derivadas de gravação).
- `201` com a narração nova. `409` se o pedaço não tem fala (sem fala não
  há o que narrar — FQ-U3) ou o pedaço não existe.

### GET /api/projetos/:id/pedacos/:pedacoId/narracao/audio — baixa a gravação

Resposta `200` com o wav (bytes, `Content-Type: audio/wav`). `404` com
`codigo: narracao-nao-gravada` se não há gravação.

### DELETE /api/projetos/:id/pedacos/:pedacoId/narracao — remove a narração

Volta a narração para `{ texto: "", origem: "nenhuma", status: "vazio" }`
(os bytes do wav **permanecem** no store — append-only, S-8). `204`. `404`
se não há narração para remover.

### PUT /api/projetos/:id/pedacos/:pedacoId/anexo — envia o anexo (gif/vídeo)

- `Content-Type`: `image/gif` | `video/mp4` | `video/webm` (a allowlist
  fechada de `VOCABULARIO_TIPO_ANEXO`). Corpo: os bytes crus do arquivo.
- O servidor valida o arquivo: tipo na allowlist (regra
  `anexo-tipo-permitido`) e tamanho ≤ **200 MB** (regra
  `anexo-tamanho-limite`; constante `ANEXO_TAMANHO_MAXIMO_BYTES` em
  `src/roteiro/contrato/contrato.ts` — fonte única, nunca redigitado) —
  violação é `400` com a regra nomeada (FQ-C1).
- Calcula o SHA-256 dos bytes e grava no store (append-only por hash,
  S-8; mesmo arquivo 2x = mesmo hash, FQ-N1). Atualiza o pedaço:
  `anexo_hash = <sha256>` e `anexo_meta = { tipo, tamanho_bytes,
  nome_original }` (nome_original vem do upload).
- **O upload NÃO muda `tipo_visual`** — o anexo é o asset do usuário; a
  decisão de usá-lo (gif/vídeo) é do usuário, via PATCH. O fluxo é
  **upload primeiro, tipo depois**: `PUT anexo` em pedaço de qualquer
  `tipo_visual`, depois `PATCH tipo_visual: "gif"|"video"` — a edição só
  passa quando o anexo já existe (regra `anexo-exigido-para-gif-video`).
  Enquanto o par (anexo, tipo_visual) não está consistente, o pedaço não
  valida (regras `anexo-exigido-para-gif-video` /
  `anexo-proibido-outros`).
- `201` com o anexo novo:
  ```json
  { "hash": "<sha256>", "tipo": "image/gif", "tamanho": 98765, "nome_original": "reacao.gif" }
  ```
  (substitui o anexo anterior do pedaço, se houver — o byte antigo
  permanece no store por hash, S-8). `404` pedaço inexistente.

### GET /api/projetos/:id/pedacos/:pedacoId/anexo — baixa o anexo

Resposta `200` com os bytes do anexo (`Content-Type` = `anexo_meta.tipo`).
`404` com `codigo: anexo-inexistente` se não há anexo.

### DELETE /api/projetos/:id/pedacos/:pedacoId/anexo — remove o anexo

Remove `anexo_hash` + `anexo_meta` do pedaço (os bytes **permanecem** no
store — append-only, S-8). **Não** muda `tipo_visual`: se o pedaço era
gif/vídeo, ele fica em estado inconsistente (regra
`anexo-exigido-para-gif-video`) até o usuário editar `tipo_visual` para
outro valor — a UI oferece a troca logo após o DELETE. `204`. `404` se não
há anexo para remover.

### POST /api/projetos/:id/pedacos/:pedacoId/preview — job: render do preview

Corpo: vazio. `202` + `Location`. Job `ok` → `artefato.caminho` aponta para
`/api/projetos/:id/pedacos/:pedacoId/preview.mp4`.

- O preview é o render do **manifesto reduzido de UM pedaço** (Onda 3) no
  formato congelado (1080p30 h264 yuv420p + aac 48k); cache por conteúdo
  (C7): mesmo pedaço + mesmas versões = HIT sem re-render.
- **Record-first:** `audio_cena` só existe no manifesto quando
  `narracao.origem ∈ {tts, gravacao}` — pedaço com fala ainda não narrada
  renderiza **silencioso** no preview (isso é o estado normal do roteiro
  recém-gerado; a UI mostra o botão de gravação). O preview nunca é
  bloqueado por fala não narrada — o bloqueio é do juntar.
- `409` se o pedaço não tem visual produzível; pedaço com visual manim sem
  Manim instalado → job `erro` com mensagem clara (FQ-P3: nunca sucesso com
  quadro preto — C1).

### GET /api/projetos/:id/pedacos/:pedacoId/preview.mp4 — o mp4 do preview

`200` bytes (`Content-Type: video/mp4`). `404` se nunca foi renderizado ou
o pedaço não existe; `409` se o render está em andamento (a UI usa o poll
do job para esperar — nunca mostra sucesso sem resposta real, FQ-U2).

### POST /api/projetos/:id/juntar — job: junta tudo e entrega o vídeo final

Corpo: `{ "musica_caminho": "/dados/trilha/ab-123.wav" }` opcional (trilha é
passo manual permanente — a YouTube Audio Library não tem API; o caminho é
do disco do servidor, nunca URL). `202` + `Location`. Job `ok` →
`artefato.caminho` aponta para `/api/projetos/:id/video-final.mp4`.

- Juntar = concat dos previews (stream-copy, params idênticos por
  construção) + música opcional (amix) + EBU R128 (duas passadas) + mux
  final + SRT por pedaço com offset (só quando há timing — legendas não são
  derivadas de gravação, D4).
- **GATE de narração (record-first):** antes de montar o vídeo, o juntar
  roda `verificarJuntarFalaSemNarracao`
  (`src/roteiro/contrato/validar.ts`): pedaço com `fala != ""` e
  `narracao.origem == "nenhuma"` → `409` listando os pedaços (regra
  `juntar-fala-sem-narracao`) — **nunca entrega fala muda** (modo de
  falha C1: o vídeo final sai "ok" e mudo; oráculo negativo do e2e).
- `409` se não há roteiro, algum pedaço sem preview, algum pedaço com fala
  não narrada, algum pedaço com visual gif/vídeo sem anexo (regra
  `anexo-exigido-para-gif-video`), ou um job de juntar já está em
  andamento.

### GET /api/projetos/:id/video-final.mp4 — o vídeo final

`200` bytes. `404` se ainda não foi juntado; `409` se em andamento.

### GET /api/jobs/:jobId — estado do job (o poll da UI)

`200` com o `JobStatus` completo. `404` se o job não existe (jobs são
efêmeros; a UI trata 404 como "job expirou" e re-pede a operação).

## Formatos congelados (fonte única: src/roteiro/contrato/contrato.ts)

| Artefato | Formato |
|---|---|
| áudio gravado (wav normalizado) | wav 48 kHz estéreo (FORMATO_AUDIO_GRAVADO) |
| preview de pedaço | mp4 h264 yuv420p 1920x1080 30fps + aac 48k (FORMATO_VIDEO) |
| vídeo final | mesmos parâmetros do preview (concat por stream-copy: iguais por construção) |

Nenhum destes números se redigita na Onda 3/4/5: importe as constantes.
