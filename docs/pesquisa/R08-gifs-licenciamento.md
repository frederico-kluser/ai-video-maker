# R08 — GIFs, memes e stock: APIs, licenciamento e determinismo

**Escopo desta pesquisa:** fecha o que é público e datável sobre GIPHY/Tenor (endpoints, limites,
termos), `@remotion/gif` e alternativas de licença limpa, stock programático (Pexels/Pixabay/
Unsplash/Openverse) e trilha sonora para YouTube monetizado. **NÃO** responde se o dono aceita o
risco jurídico de cada fonte — isso é `PERGUNTA-DONO`, e é onde mora o item mais caro do cluster.

**Data da coleta:** 2026-08-10. Toda URL desta página foi aberta com WebFetch/curl nesta data.

---

### Nota de contagem (leia antes da tabela)

O contrato manda: *"duas páginas do mesmo domínio contam como uma fonte"*. Apliquei isso
**literalmente**, inclusive para fornecedores. Consequência importante e deliberada:

> Uma cláusula de licença **lida literalmente** no documento vinculante do próprio licenciante
> ainda assim marca `(1-0) NÃO VERIFICADO` — porque existe **uma** fonte, não porque eu duvide do
> texto. Nessas linhas a coluna **"citação literal"** diz `sim`: o texto entre aspas na seção 2
> foi lido no documento. O que falta é corroboração independente (parecer jurídico, contrato
> assinado, política escrita do fornecedor endereçada ao nosso caso de uso).

Isso é o comportamento correto para um cluster de licenciamento: **nenhum agente deve transformar
"eu li o ToS" em "está liberado"**. Por isso as decisões de licença aparecem na seção 6, não como
card.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Citação literal | Fonte primária |
|---|---|---|---|---|---|
| R08-01 | A API GIPHY v1 tem base `https://api.giphy.com/v1` e expõe `/gifs/search`, `/gifs/trending`, `/gifs/translate`, `/gifs/random`, `/gifs/<gif_id>`, `/gifs` (até 100 `ids`) e os espelhos `/stickers/{search,trending,translate,random}`, todos autenticados pelo query param `api_key`. | (2-0) | PROVÁVEL | sim | https://developers.giphy.com/docs/api/endpoint/ |
| R08-02 | A chave beta da GIPHY é limitada a **100 chamadas de API por hora**, é gratuita, e a chave de produção exige aplicação pelo dashboard e é **paga com preço negociado caso a caso**. | (2-0) | PROVÁVEL | sim | https://support.giphy.com/api/v2/help_center/en-us/articles/10389869671322.json |
| R08-03 | O teto adicional de "1.000 chamadas por dia" na chave beta é afirmado por terceiros mas **não aparece** em nenhum documento oficial GIPHY que abri. | (1-1) | EM DISPUTA | sim | https://developers.giphy.com/docs/api/ vs https://jentic.com/apis/giphy |
| R08-04 | O GIPHY API ToS (efetivo 2018-05-23, atualizado 2024-08-21) concede licença **sobre a API**, não sobre o conteúdo: o grant é "to access and use the API" e a propriedade declarada é "The API, and all intellectual property rights therein". | (1-0) | NÃO VERIFICADO | sim | https://support.giphy.com/api/v2/help_center/en-us/articles/360028134111.json |
| R08-05 | O GIPHY User ToS proíbe expressamente exploração comercial do conteúdo: *"you shall not copy, modify, publish, transmit, distribute, perform, or display any content, nor shall you sell, license, rent, or otherwise use or exploit any content for commercial use"*. | (2-0) | PROVÁVEL | sim | https://support.giphy.com/api/v2/help_center/en-us/articles/360020027752.json |
| R08-06 | A GIPHY exige atribuição conspícua "Powered By GIPHY" em todo app que usa a API, e cita isso como condição de aprovação da production key. | (1-0) | NÃO VERIFICADO | sim | https://developers.giphy.com/docs/api/ |
| R08-07 | O Action Register (pingback) da GIPHY é um endpoint documentado com eventos `onload`, `onclick`, `onsent` e params `customer_id` + `ts`; **nenhum documento que abri o declara obrigatório**. | (1-0) | NÃO VERIFICADO | sim | https://developers.giphy.com/docs/api/endpoint/ |
| R08-08 | GIPHY Clips (`GET /v1/clips/search`, `GET /v1/clips/trending`) só é liberado mediante aprovação: *"Access to Clips endpoints is only available upon approval. Please reach out to clips@giphy.com"*. | (1-0) | NÃO VERIFICADO | sim | https://developers.giphy.com/docs/clips/ |
| R08-09 | A Tenor API v2 tem base `https://tenor.googleapis.com/v2` e expõe `/search`, `/featured`, `/categories`, `/search_suggestions`, `/autocomplete`, `/trending_terms`, `/registershare`, autenticada por `key` (com `client_key` "strongly recommended"). | (1-0) | NÃO VERIFICADO | sim | https://developers.google.com/tenor/guides/endpoints |
| R08-10 | Tenor: *"Tenor API keys have a default rate limit of 1 API request per second (RPS)"* e *"API requests made above the 1 RPS threshold will fail"*; URLs de conteúdo em cache *"must refresh the cache at least once each 24 hours"*. | (1-0) | NÃO VERIFICADO | sim | https://developers.google.com/tenor/guides/rate-limits-and-caching |
| R08-11 | Tenor exige atribuição: *"You must properly attribute all content retrieved from Tenor"*, com três marcas: "Powered By Tenor" (browsing), "Search Tenor" (placeholder da busca), "Via Tenor" (rodapé do GIF compartilhado). | (1-0) | NÃO VERIFICADO | sim | https://developers.google.com/tenor/guides/attribution |
| R08-12 | O Tenor API ToS (última atualização 2021-03-03) **permite explicitamente** usos comerciais como cobrar pelo acesso ao API Client e exibir Content em app/blog/site com anúncios, e **proíbe sem aprovação escrita** "sell advertising, sponsorships, or promotions on or through the Content". | (1-0) | NÃO VERIFICADO | sim | https://developers.google.com/tenor/guides/api-terms |
| R08-13 | Tenor ToS §3.3 proíbe *"modify or replace the text, images, or other content of the Tenor search results"* — cláusula ambígua quanto a recortar/compor o GIF dentro de um vídeo. | (1-0) | NÃO VERIFICADO | sim | https://developers.google.com/tenor/guides/api-terms |
| R08-14 | `@remotion/gif` (v4.0.507) exporta **exatamente** `Gif`, `GifProps`, `getGifDurationInSeconds`, `preloadGif`, `GifFillMode`, `RemotionGifProps` — **não existe `useGif`**. | (3-0) | CONFIRMADO | sim | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/index.ts |
| R08-15 | O `<Gif>` é determinístico porque `useCurrentGifIndex` calcula o índice do quadro do GIF a partir de `useCurrentFrame()` + `useVideoConfig().fps` + o array `delays`, e o carregamento é bloqueado por `delayRender()` antes de pintar num `<canvas>`. | (2-0) | PROVÁVEL | sim | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/useCurrentGifIndex.tsx |
| R08-16 | A doc oficial da Remotion diz *"Don't use the `<Img>` tag for GIFs, use `@remotion/gif` instead"*, e justifica o `<Img>` por garantir que a imagem carregue antes do frame ("avoid flickers"). | (1-0) | NÃO VERIFICADO | sim | https://www.remotion.dev/docs/img |
| R08-17 | O `@remotion/gif` mantém GIFs **inteiramente decodificados em memória**: `volatileGifCache` é um `QuickLRU` de `maxSize: 30`, `manuallyManagedGifCache` é um `Map` sem teto, e `preloadGif()` devolve `free()` que *"will cancel preloading or free up the memory"*. | (2-0) | PROVÁVEL | sim | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/gif-cache.ts |
| R08-18 | `<AnimatedImage>` vem do pacote `remotion` (v4.0.246+), cobre GIF/APNG/AVIF/WebP animado, mas *"Relies on the ImageDecoder Web API, meaning it only works in Google Chrome and Firefox"*; o `<Gif>` usa decoder JS e roda no Safari, sem AVIF/WebP. | (1-0) | NÃO VERIFICADO | sim | https://www.remotion.dev/docs/animatedimage |
| R08-19 | `@remotion/animated-emoji` (v4.0.507) existe, exporta `AnimatedEmoji`, `getAvailableEmojis` (com "s"), `CalculateEmojiSrc`, e os assets são vídeos pré-renderizados do Google Fonts Animated Emoji **licenciados em CC BY 4.0**, copiados para o `public/` do projeto. | (3-0) | CONFIRMADO | sim | https://github.com/remotion-dev/animated-emoji |
| R08-20 | Pexels API: auth por header `Authorization`, *"rate-limited to 200 requests per hour and 20,000 requests per month"*, endpoints de vídeo em `https://api.pexels.com/v1/videos/{search,popular}`, e as guidelines exigem *"a prominent link to Pexels"* mesmo a licença dizendo que atribuição não é obrigatória. | (2-0) | PROVÁVEL | sim | https://www.pexels.com/api/documentation/ |
| R08-21 | Pixabay API: auth por param `key`, *"up to 100 requests per 60 seconds"*, *"Requests must be cached for 24 hours"* e *"Permanent hotlinking of images (using Pixabay URLs in your app) is not allowed"* — imagens devem ser baixadas para servidor próprio. | (1-0) | NÃO VERIFICADO | sim | https://pixabay.com/api/docs/ |
| R08-22 | Unsplash API: auth por `Authorization: Client-ID`, demo = 50 req/h, produção = 1000 req/h após aprovação, e **é obrigatório** disparar `GET /photos/:id/download` a cada download e **hotlinkar** as URLs devolvidas pela API. | (2-0) | PROVÁVEL | sim | https://unsplash.com/documentation |
| R08-23 | As licenças Pexels, Unsplash e Pixabay permitem uso comercial sem atribuição obrigatória, mas as três proíbem redistribuir/vender o conteúdo em estado essencialmente inalterado ou montar serviço concorrente, e **nenhuma garante model release nem indeniza o usuário**. | (4-0) | CONFIRMADO | sim | https://www.pexels.com/license/ + https://unsplash.com/license + https://pixabay.com/service/license-summary/ |
| R08-24 | Openverse API: `GET /v1/images/` e `GET /v1/audio/`, filtros `license` (`by`, `by-sa`, `cc0`, `pdm`, …) e `license_type` (`all`, `all-cc`, `commercial`, `modification`), OAuth2 `client_credentials` via `/v1/auth_tokens/register/` + `/v1/auth_tokens/token/`; **os números de rate limit não estão publicados** na spec nem na doc. | (1-0) | NÃO VERIFICADO | sim | https://api.openverse.org/v1/schema/ |
| R08-25 | YouTube Audio Library: *"Copyright-safe music and sound effects downloaded from the Audio Library won't be claimed by a rights holder through the Content ID system"*, é monetizável no YPP, e tem dois tipos de licença (padrão sem atribuição / CC BY com crédito na descrição). | (2-0) | PROVÁVEL | sim | https://support.google.com/youtube/answer/3376882 |

---

## 2. Detalhe por claim

### R08-01 — Superfície da API GIPHY v1

- **Verdade operacional:** um cliente HTTP simples resolve tudo; não há SDK obrigatório. Todos os
  endpoints aceitam `customer_id`, `country_code`, `region`, `rating`. `translate` usa `s` (não
  `q`); `search` usa `q`; `random` usa `tag`. Emoji fica em `v2`: `api.giphy.com/v2/emoji` e
  `api.giphy.com/v2/emoji/{gif_id}/variations`. Upload é outro host: `upload.giphy.com/v1/gifs`,
  com "10 uploads per day" em chave limitada.
- **Como reconferir:**
  `curl -s "https://api.giphy.com/v1/gifs/search?api_key=$GIPHY_KEY&q=test&limit=1" | jq '.meta'`
- **O que quebra se divergir:** o card do provider de GIF (cliente HTTP + tipos da resposta) e a
  fixture de resposta usada nos testes offline do pipeline.
- **Fontes:**
  - https://developers.giphy.com/docs/api/endpoint/ — lista completa de endpoints e parâmetros (primária)
  - https://jentic.com/apis/giphy — repete base URL, auth por `api_key` e os 10 endpoints (secundária)

### R08-02 — Chave beta = 100 chamadas/hora; produção é paga

- **Verdade operacional:** *"There is no fee to use a beta key, which are rate limited (100
  searches/API calls per hour)."* e *"There is a fee to upgrade to an unlimited Production Key.
  Once your application is submitted, a member of the GIPHY team will be in touch to discuss
  pricing."* Para um gerador de vídeo local que faz 1-3 buscas por roteiro, 100/h é folgado. Para
  N agentes em worktrees paralelas com retry, 100/h estoura rápido — **o limite é por chave, não
  por processo**.
- **Como reconferir:** rodar 101 chamadas em uma hora e ler o corpo/HTTP status da 101ª:
  `for i in $(seq 1 101); do curl -s -o /dev/null -w "%{http_code}\n" "https://api.giphy.com/v1/gifs/trending?api_key=$GIPHY_KEY&limit=1"; done | sort | uniq -c`
- **O que quebra se divergir:** o gate de concorrência do pool de agentes e o card de cache de
  busca. Sem cache local, a onda paralela derruba a chave.
- **Fontes:**
  - https://support.giphy.com/api/v2/help_center/en-us/articles/10389869671322.json — "Is there a fee…", atualizado 2026-07-31 (primária)
  - https://support.giphy.com/api/v2/help_center/en-us/articles/360035527611.json — "These beta keys are rate limited to a maximum of 100 API calls an hour", atualizado 2026-07-16 (mesma fonte, mesmo domínio)
  - https://developers.giphy.com/docs/api/ — mesma frase no quickstart (mesmo domínio)
  - https://jentic.com/apis/giphy — corrobora 100/h (secundária)

### R08-03 — "1.000/dia" na chave beta: em disputa

- **Verdade operacional:** a jentic.com afirma *"100 requests per hour and 1,000 per day"*. Os três
  documentos GIPHY que abri (quickstart, FAQ de preço, FAQ da beta key) só falam de **100/hora** e
  nunca mencionam teto diário. Não trate 1.000/dia como fato nem como ausência: **trate como
  desconhecido e instrumente**.
- **Como reconferir:** logar `X-RateLimit-*` de toda resposta GIPHY por 48h e olhar o header:
  `curl -sD - -o /dev/null "https://api.giphy.com/v1/gifs/trending?api_key=$GIPHY_KEY&limit=1" | grep -i ratelimit`
- **O que quebra se divergir:** o orçamento de chamadas do pipeline em lote (render de 20 vídeos
  numa noite). Um teto diário invisível transforma o job noturno em falha silenciosa às 3h.
- **Fontes:**
  - https://developers.giphy.com/docs/api/ — só 100/hora (primária, **contradiz** o teto diário por omissão)
  - https://jentic.com/apis/giphy — afirma 1.000/dia (secundária)

### R08-04 — O API ToS licencia a API, não o GIF

- **Verdade operacional:** este é o achado estrutural do cluster. O GIPHY API ToS é curto e trata
  de: licença **da API**, limitações, marca, atribuição e contato. O grant é
  *"non-exclusive, non-transferable, non-assignable, non-sublicensable, revocable, worldwide,
  limited"* para *"access and use the API solely to allow for the creation of software
  applications that interface with Giphy's products and services"*. A única declaração de
  propriedade é *"The API, and all intellectual property rights therein, are and shall at all
  times remain our and our licensors' sole and exclusive property."* Uma varredura do documento
  atrás das palavras `download`, `store`, `cache`, `redistribute`, `derivative`, `video`,
  `monetiz`, `indemnif` **não encontrou ocorrências**. Ou seja: **nada no API ToS diz que você
  pode embutir o GIF num MP4 e publicar.** A ausência de permissão não é permissão.
- **Como reconferir:**
  `curl -s https://support.giphy.com/api/v2/help_center/en-us/articles/360028134111.json | python3 -c "import sys,json,re,html; b=json.load(sys.stdin)['article']['body']; print(re.sub('<[^>]+>','',html.unescape(b)))"`
- **O que quebra se divergir:** se surgir uma cláusula de licença de conteúdo, o card "GIF de
  reação via GIPHY" muda de status: hoje ele nasce **bloqueado por decisão do dono**.
- **Fontes:**
  - https://support.giphy.com/api/v2/help_center/en-us/articles/360028134111.json — GIPHY API ToS, efetivo 2018-05-23, atualizado 2024-08-21 (primária)

### R08-05 — O User ToS proíbe uso comercial do conteúdo

- **Verdade operacional:** a cláusula é direta e é a que vale para o *conteúdo*:
  *"you shall not copy, modify, publish, transmit, distribute, perform, or display any content,
  nor shall you sell, license, rent, or otherwise use or exploit any content for commercial use"*.
  Um MP4 exportado com um GIF da GIPHY dentro, publicado num canal do YouTube monetizado ou usado
  como material de marketing, cai em **copy + modify + publish + distribute + display + exploit
  for commercial use** ao mesmo tempo. Some a isso R08-04: a GIPHY não pode licenciar o que
  frequentemente não é dela (frame de série/filme). O `giphy.com/terms` redireciona 301 para este
  documento — é o termo de fato.
- **Como reconferir:**
  `curl -sI https://giphy.com/terms | grep -i location` e depois o mesmo comando de R08-04 com o id `360020027752`.
- **O que quebra se divergir:** o card inteiro de "biblioteca de reações". Se este claim se
  sustentar (e ele se sustenta no texto), o card correto não é "integrar GIPHY" — é "biblioteca
  de reação própria/CC BY".
- **Fontes:**
  - https://support.giphy.com/api/v2/help_center/en-us/articles/360020027752.json — GIPHY User ToS, atualizado 2026-08-08 (primária)
  - https://gifyard.com/giphy-art-intellectual-property-and-copyright-issues/ (2023-05-26) — *"You need the copyright holder's permission to use their GIPHY artwork in promotional materials"* (secundária)

### R08-06 — "Powered By GIPHY" é exigência, não cortesia

- **Verdade operacional:** *"We require all apps that use the GIPHY API to conspicuously display
  'Powered By GIPHY' attribution marks where the API is utilized."* O artigo de condições da
  production key repete isso e aponta para a Seção 5A do ToS. O API ToS acrescenta o dever de
  *"properly attribute all pieces of content"* e exibir *"Giphy user and/or source attribution
  where available"*. Para nós isso significa: se um GIF da GIPHY entrar no vídeo, a marca precisa
  entrar **no vídeo**, não numa tela de configuração que ninguém vê.
- **Como reconferir:** https://developers.giphy.com/docs/api/ (seção de atribuição) e o JSON do
  artigo `360035158592`.
- **O que quebra se divergir:** o card de composição do rodapé/watermark e o template de créditos
  finais.
- **Fontes:**
  - https://developers.giphy.com/docs/api/ — texto da exigência (primária)
  - https://support.giphy.com/api/v2/help_center/en-us/articles/360035158592.json — condições da production key (mesmo domínio)

### R08-07 — Pingback: existe, obrigatoriedade não comprovada

- **Verdade operacional:** o Action Register é documentado com três eventos — `onload` (*"Call
  once, immediately after the asset is visible"*), `onclick`, `onsent` — e a URL de pingback é
  montada anexando `customer_id` e `ts` (Unix ms) às tracking URLs do objeto `analytics` da
  resposta. **Nenhum documento que li usa a palavra "required" para o pingback.** Para um
  renderizador offline os três eventos são semanticamente estranhos (não há usuário clicando), o
  que reforça que isso foi desenhado para app de mensagem, não para pipeline de vídeo.
- **Como reconferir:** ler o campo `analytics` de uma resposta real:
  `curl -s "https://api.giphy.com/v1/gifs/trending?api_key=$GIPHY_KEY&limit=1" | jq '.data[0].analytics'`
- **O que quebra se divergir:** se pingback virar condição de production key, some um card de
  "telemetria de uso" que hoje não existe.
- **Fontes:**
  - https://developers.giphy.com/docs/api/endpoint/ — Action Register e parâmetros (primária)
  - https://developers.giphy.com/docs/api/ — descrição dos três eventos (mesmo domínio)

### R08-08 — GIPHY Clips é murado

- **Verdade operacional:** *"Access to Clips endpoints is only available upon approval. Please
  reach out to clips@giphy.com to request permission."* O objeto clip estende o objeto gif com uma
  propriedade `video` contendo renditions 360p/480p/720p/1080p/4k, captions SRT/WebVTT por código
  ISO 639-1 e o idioma nativo. Ou seja: tecnicamente é o formato mais conveniente para um pipeline
  de vídeo (MP4 pronto, com legenda) e **é justamente o mais fechado**.
- **Como reconferir:** `curl -s "https://api.giphy.com/v1/clips/search?api_key=$GIPHY_KEY&q=test&limit=1" | jq '.meta'` — sem aprovação a resposta não deve ser 200 com dados.
- **O que quebra se divergir:** nada hoje; se aprovado, abre um card de "clipe com áudio" que
  substituiria o card de GIF mudo.
- **Fontes:**
  - https://developers.giphy.com/docs/clips/ — endpoints, aprovação e objeto clip (primária)

### R08-09 / R08-10 / R08-11 — Tenor: superfície, limites, atribuição

- **Verdade operacional:** a Tenor v2 é servida pelo Google (`tenor.googleapis.com/v2`) e o limite
  padrão é brutalmente baixo para automação: **1 requisição por segundo**, e acima disso a
  requisição **falha** (não enfileira). A doc manda respeitar os `Cache-Control` das respostas,
  recomenda atualizar registros com frequência e **obriga** a renovar cache de URLs de conteúdo a
  cada 24h — o que significa que **guardar a URL de um GIF no roteiro por mais de um dia é
  violação de termo**, ainda que a URL continue respondendo. Atribuição é obrigatória com uma das
  três marcas oficiais.
- **Como reconferir:**
  `for i in 1 2 3; do curl -s -o /dev/null -w "%{http_code} " "https://tenor.googleapis.com/v2/search?key=$TENOR_KEY&q=test&limit=1"; done`
  (três chamadas no mesmo segundo devem produzir pelo menos uma falha)
- **O que quebra se divergir:** o card do provider Tenor precisa de throttle serializado de 1 rps
  **e** de um passo de "baixar o arquivo agora, não guardar a URL". Sem isso, um roteiro
  reprocessado semana que vem quebra ou vira violação.
- **Fontes:**
  - https://developers.google.com/tenor/guides/endpoints — endpoints e params (primária)
  - https://developers.google.com/tenor/guides/rate-limits-and-caching — 1 RPS e cache 24h (mesmo domínio)
  - https://developers.google.com/tenor/guides/attribution — três marcas (mesmo domínio)
  - https://tenor.com/gifapi — *"Access it now for free."*, aponta para developers.google.com/tenor (segundo domínio, mas só confirma gratuidade)

### R08-12 / R08-13 — Tenor: uso comercial permitido, edição do resultado proibida

- **Verdade operacional:** aqui a Tenor é **materialmente mais permissiva que a GIPHY**. O §3.1
  lista como permitido: *"charging fees to access your API Client or the online service that uses
  your API Client"*, *"using the Tenor API to show Content on an ad-enabled API Client (such as an
  ad-enabled app, blog, or website)"* e *"placing your own branding on the API Client, as long as
  it does not interfere with the display of any Content"*. O §3.2 exige aprovação escrita apenas
  para *"sell advertising, sponsorships, or promotions on or through the Content"*.
  **Mas** o §3.3 proíbe *"modify or replace the text, images, or other content of the Tenor search
  results"* — e um pipeline que corta, redimensiona e compõe o GIF sobre um fundo está
  literalmente modificando imagens vindas do resultado de busca. A leitura benigna é que §3.3 fala
  de **integridade do resultado de busca exibido ao usuário**, não de edição do asset. A leitura
  hostil é a literal. **Não decida isso por dedução.**
  Nota importante de escopo: o documento define `Content` como *"data, content (including
  audiovisual content) and information provided to API Clients through the Tenor API services"* e
  **remete** a Google APIs ToS e Tenor Developer Policies — que eu **não** li. Última atualização
  da página: 2021-03-03.
- **Como reconferir:** https://developers.google.com/tenor/guides/api-terms, §3.1–3.3, e as duas
  políticas referenciadas na §1.
- **O que quebra se divergir:** se §3.3 for lida na versão literal, o card "GIF do Tenor
  redimensionado no canto da tela" morre e sobra só "GIF exibido em seu tamanho nativo".
- **Fontes:**
  - https://developers.google.com/tenor/guides/api-terms — §2 definições, §3.1/3.2/3.3 (primária)

### R08-14 — Superfície real do `@remotion/gif`

- **Verdade operacional:** o `index.ts` do pacote é a lista **fechada** de exports:
  ```ts
  export {getGifDurationInSeconds} from './get-gif-duration-in-seconds';
  export {Gif, type GifProps} from './Gif';
  export {preloadGif} from './preload-gif';
  export {GifFillMode, RemotionGifProps} from './props';
  ```
  Isso é evidência **positiva** de ausência: `useGif` não existe, nunca existiu neste arquivo.
  Props do `<Gif>` documentadas: `src` (obrigatória, remoto exige CORS), `width`, `height`,
  `fit` (`'fill' | 'contain' | 'cover'`, default `'fill'`), `playbackRate` (v4.0.44+),
  `loopBehavior` (`'loop' | 'pause-after-finish' | 'unmount-after-finish'`, v3.3.4+),
  `onLoad` (recebe `{width, height, delays: number[], frames: ImageData[]}`), `ref` para
  `HTMLCanvasElement` (v3.3.88+), `effects` (v4.0.464+), `cropLeft/Right/Top/Bottom` (v4.0.500+),
  `premountFor`/`postmountFor` (v4.0.497+), `delayRenderTimeoutInMilliseconds` (v4.0.403+,
  default 30000), `requestInit` (v4.0.471+).
  `getGifDurationInSeconds(src, options?): Promise<number>` — v3.2.22+, `options` desde v4.0.471,
  devolve a duração *sem* considerar loop.
  `preloadGif(src, options?)` — v3.3.38+, devolve `{waitUntilDone(): Promise<void>; free(): void}`.
- **Como reconferir:**
  `curl -sL https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/index.ts`
  e `curl -s https://registry.npmjs.org/@remotion/gif/latest | jq '.version, .license'`
- **O que quebra se divergir:** qualquer card que escreva `useGif` gera código que não compila.
  Este claim é a trava contra alucinação de API no gerador de composições.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/index.ts — export list literal (primária)
  - https://www.remotion.dev/docs/gif/gif + /docs/gif/get-gif-duration-in-seconds + /docs/gif/preload-gif — props e assinaturas (primária, segundo domínio)
  - `registry.npmjs.org/@remotion/gif/latest` → `"version":"4.0.507"`, `"license":"SEE LICENSE IN LICENSE.md"` (primária, terceiro domínio)

### R08-15 / R08-16 — Por que `<img>` quebra o determinismo e o que o `<Gif>` faz

- **Verdade operacional:** um `<img src="x.gif">` anima segundo o **relógio de parede do
  navegador**. O renderizador da Remotion não avança em tempo real: ele posiciona o frame `N`,
  tira o screenshot e pula para `N+1`, possivelmente fora de ordem e em várias abas paralelas. O
  GIF do `<img>` não sabe disso — ele mostra o quadro que der. Resultado: mesmo input, saída
  diferente a cada render. O código do `<Gif>` resolve por três mecanismos verificáveis no fonte:
  1. **Bloqueio de carga:** `GifForRendering` chama `delayRender('Rendering <Gif/> with src=…')`
     e só libera quando o GIF está parseado — sem isso o frame sai em branco.
  2. **Índice puro do timeline:** `useCurrentGifIndex` faz
     `const currentFrame = useCurrentFrame(); const time = (currentFrame / (1/playbackRate) / videoConfig.fps) * 1000;`
     e escolhe o quadro somando o array `delays`. É função pura de `(frame, fps, playbackRate,
     delays)` — nenhum `Date.now()`.
  3. **Pintura em canvas:** o quadro escolhido é desenhado num `<canvas>`, não delegado ao
     decodificador animado do navegador.
  A doc oficial fecha o loop com *"Don't use the `<Img>` tag for GIFs, use `@remotion/gif`
  instead."*
- **Como reconferir:**
  `curl -sL https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/useCurrentGifIndex.tsx`
  e `.../GifForRendering.tsx` (procure `delayRender` e `Canvas`).
  Teste empírico: renderizar a mesma composição 2× e comparar hash — `ffmpeg -i out.mp4 -f md5 -`.
- **O que quebra se divergir:** o gate de determinismo do pipeline (render duas vezes, exigir
  bytes idênticos). Se `<Gif>` não for determinístico, esse gate vira falso vermelho permanente e
  alguém vai desligá-lo — que é exatamente o desastre a evitar.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/useCurrentGifIndex.tsx — cálculo do índice (primária)
  - https://www.remotion.dev/docs/img — *"Don't use the `<Img>` tag for GIFs"* (primária, segundo domínio)

### R08-17 — Memória: 30 GIFs decodificados, e um Map sem teto

- **Verdade operacional:** o arquivo `gif-cache.ts` inteiro é:
  ```ts
  export const volatileGifCache = new QuickLRU<string, GifState>({maxSize: 30});
  export const manuallyManagedGifCache = new Map<string, GifState>();
  ```
  `GifState` contém `frames` — os quadros **descomprimidos**. Um GIF de 480×270 com 60 quadros em
  RGBA custa ~31 MB descomprimido, vindo de um arquivo de talvez 2 MB. Trinta desses no LRU são
  ~1 GB. E o `manuallyManagedGifCache` (alimentado por `preloadGif`) **não tem teto** — só esvazia
  com `free()`. Em worktrees paralelas, cada processo de render tem seu próprio heap: o custo
  multiplica pelo número de agentes.
- **Como reconferir:**
  `curl -sL https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/gif-cache.ts`
  e medir: `/usr/bin/time -v npx remotion render <comp>` observando `Maximum resident set size`
  com 1 GIF vs 10 GIFs distintos na mesma composição.
- **O que quebra se divergir:** o card de concorrência (quantos renders simultâneos cabem na
  máquina) e o gate de OOM. Se o número real for muito pior, a política vira "no máximo 3 GIFs
  por composição" ou "converta GIF para MP4 antes".
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/gif-cache.ts — LRU 30 + Map (primária)
  - https://www.remotion.dev/docs/gif/preload-gif — `free()` *"will cancel preloading or free up the memory if the GIF is not being used anymore"* (primária, segundo domínio)

### R08-18 — `<AnimatedImage>` vs `<Gif>`

- **Verdade operacional:** `<AnimatedImage>` vem do pacote `remotion` (core, v4.0.246+), renderiza
  *"animated GIF, PNG, AVIF or WebP"* e *"Relies on the ImageDecoder Web API, meaning it only works
  in Google Chrome and Firefox as of writing."* Como o render headless da Remotion roda em
  Chromium, **ImageDecoder está disponível no caminho de render** — o Safari só importa para o
  `<Player>` no navegador do usuário. `<AnimatedImage>` **não** tem `onLoad`; `<Gif>` tem, e é por
  ele que se descobre `delays`/`frames` sem baixar de novo.
- **Como reconferir:** https://www.remotion.dev/docs/animatedimage (lista de props e a frase do
  ImageDecoder).
- **O que quebra se divergir:** a escolha de componente no gerador de composições. Se o alvo
  incluir preview no Safari, `<Gif>`; se for só render local + WebP animado, `<AnimatedImage>`.
- **Fontes:**
  - https://www.remotion.dev/docs/animatedimage — formatos, ImageDecoder, props, v4.0.246+ (primária)

### R08-19 — `@remotion/animated-emoji`: a alternativa de licença limpa

- **Verdade operacional:** o pacote **existe** (v4.0.507 no registry, autor Yehor Misiats), a doc
  marca *"available from v4.0.187"*, e o export real é:
  ```ts
  export {AnimatedEmoji, AnimatedEmojiProps} from './AnimatedEmoji';
  export {CalculateEmojiSrc} from './calculate-emoji-src';
  export {EmojiName, getAvailableEmojis} from './get-available-emoji';
  ```
  **Atenção ao nome:** é `getAvailableEmojis()` com "s" — a URL da doc é
  `/docs/animated-emoji/get-available-emoji` (singular) e vários resumos de terceiros erram isso.
  O repo de assets diz: *"This repository contains prerendered videos of the Animated Emoji from
  Google Fonts"* e *"The Animated Emoji from Google are licensed under the CC BY 4.0 license."*
  Os arquivos são **copiados para o `public/` do projeto** (*"Copy the files from the `public`
  folder of this repo to your Remotion project's `public` folder"*), com `calculateSrc` para
  hospedar em outro lugar. CC BY 4.0 permite uso comercial (*"even commercially"*) mediante
  *"appropriate credit, provide a link to the license, and indicate if changes were made"*.
- **Como reconferir:**
  `curl -sL https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/animated-emoji/src/index.ts`
  e `curl -s https://registry.npmjs.org/@remotion/animated-emoji/latest | jq '.version'`
- **O que quebra se divergir:** este é o **plano B inteiro** para "reação/meme". Se o nome do
  export estiver errado, o card gera código quebrado; se a licença mudar, o plano B some junto com
  o plano A.
- **Fontes:**
  - https://github.com/remotion-dev/animated-emoji — origem e CC BY 4.0 dos assets (primária)
  - https://www.remotion.dev/docs/animated-emoji/ + /get-available-emoji — *"The animated Emoji are licensed under CC BY 4.0"*, v4.0.187+, exemplo com `getAvailableEmojis()` (primária, segundo domínio)
  - https://creativecommons.org/licenses/by/4.0/ — *"even commercially"* + texto da atribuição (primária, terceiro domínio)

### R08-20 / R08-21 / R08-22 — Pexels, Pixabay, Unsplash: as três APIs têm exigência técnica incompatível entre si

- **Verdade operacional:** cada uma impõe uma regra **operacional diferente** que muda o desenho do
  cache local:
  - **Pexels**: header `Authorization`; 200 req/h e 20.000/mês; *"You may contact us to request a
    higher limit… If you meet our API terms, you can get unlimited requests for free"*;
    *"Abuse of the Pexels API, including but not limited to attempting to work around the rate
    limit, will lead to termination"*. Guideline: *"Whenever you are doing an API request make
    sure to show a prominent link to Pexels"* — **mais estrito que a própria licença**, que diz
    atribuição não obrigatória. Vídeo em `https://api.pexels.com/v1/videos/{search,popular}`
    (`https://api.pexels.com/videos/` é deprecado).
  - **Pixabay**: param `key`; *"up to 100 requests per 60 seconds"*; *"Requests must be cached for
    24 hours"*; e o que mais nos afeta: *"Permanent hotlinking of images (using Pixabay URLs in
    your app) is not allowed. If you intend to use the images, please download them to your server
    first."* Vídeos podem ser embedados ou armazenados.
  - **Unsplash**: `Authorization: Client-ID <key>`; demo = 50 req/h, produção = 1000 req/h após
    aprovação; **obriga** `GET /photos/:id/download` a cada download; e **obriga hotlink**:
    *"we require the image URLs returned by the API to be directly used or embedded"*.
  A colisão é evidente: **Pixabay proíbe hotlink, Unsplash exige hotlink.** Um pipeline de render
  local precisa do arquivo em disco (Chromium headless + CORS + determinismo), o que é natural
  para Pixabay/Pexels e **está em tensão com a guideline da Unsplash**.
- **Como reconferir:**
  `curl -s -H "Authorization: $PEXELS_KEY" "https://api.pexels.com/v1/search?query=test&per_page=1" -D - -o /dev/null | grep -i ratelimit`
  `curl -s "https://pixabay.com/api/?key=$PIXABAY_KEY&q=test&per_page=3" | jq '.totalHits'`
  `curl -s -H "Authorization: Client-ID $UNSPLASH_KEY" "https://api.unsplash.com/photos/random" -D - -o /dev/null | grep -i ratelimit`
- **O que quebra se divergir:** o card do asset cache local. A política "sempre baixar para
  `public/`" satisfaz Pixabay e Pexels e **viola** a guideline da Unsplash — decida antes de
  escrever o downloader, não depois.
- **Fontes:**
  - https://www.pexels.com/api/documentation/ — auth, limites, guidelines, endpoints de vídeo (primária)
  - https://pixabay.com/api/docs/ — auth, 100/60s, cache 24h, proibição de hotlink (primária, segundo domínio)
  - https://unsplash.com/documentation — Client-ID, 50/1000 req/h, download trigger, hotlink (primária, terceiro domínio)
  - https://github.com/unsplash/unsplash-js — README repete download trigger, atribuição e hotlink como requisitos (primária Unsplash em quarto domínio)

### R08-23 — As três licenças de stock: permissivas, mas sem rede de proteção

- **Verdade operacional:**
  - Pexels: *"All photos and videos on Pexels are free to use"*, *"Attribution is not required"*,
    *"You can modify the photos and videos"*. Proibido: *"Don't sell unaltered copies of a photo
    or video"*, *"Don't redistribute or sell the photos and videos on other stock photo or
    wallpaper platforms"*, *"Identifiable people may not appear in a bad light"*.
  - Unsplash: uso comercial e não comercial permitido, atribuição não exigida; proibido vender sem
    modificação significativa e *"compile images from Unsplash to replicate a similar or competing
    service"*.
  - Pixabay: *"Use Content without having to attribute the author"*; proibido *"sell or distribute
    Content… on a Standalone basis"* onde *"no creative effort has been applied to the Content and
    it remains in substantially the same form"*, e uso comercial de conteúdo com marcas/logos
    reconhecíveis.
  **O ponto que importa para nós:** um vídeo técnico gerado, com narração, overlays e edição, é
  claramente "creative effort applied" e **não** é "unaltered copy" nem "competing stock service".
  As três licenças cobrem esse uso. O risco residual não é a licença — é **direito de imagem e
  marca**: nenhuma das três garante model release ou indeniza. A análise secundária resume:
  *"they disclaim all responsibility and liability for rights issues"*.
- **Como reconferir:** as três páginas de licença + a cláusula de release na de Pexels.
- **O que quebra se divergir:** a política de seleção de assets. Se rosto humano identificável
  entrar num vídeo com viés promocional, o problema é de direito de imagem, não de licença de
  stock — e nenhuma API resolve isso.
- **Fontes:**
  - https://www.pexels.com/license/ (primária)
  - https://unsplash.com/license (primária, segundo domínio)
  - https://pixabay.com/service/license-summary/ (primária, terceiro domínio)
  - https://www.licenseorg.com/blog/free-stock-photos-licensing-traps (2026-02-26) — análise de release e indenização (secundária)

### R08-24 — Openverse: o único com filtro de licença na query

- **Verdade operacional:** a spec OpenAPI (`/v1/schema/`, 111 KB) confirma `GET /v1/images/` e
  `GET /v1/audio/` — **áudio inclusive**, o que resolve trilha e imagem no mesmo cliente. Os
  filtros são: `license` ∈ {`by`, `by-nc`, `by-nc-nd`, `by-nc-sa`, `by-nd`, `by-sa`, `cc0`,
  `nc-sampling+`, `pdm`, `sampling+`} e `license_type` ∈ {`all`, `all-cc`, `commercial`,
  `modification`}. Auth: `POST /v1/auth_tokens/register/` (name, description, email) → `client_id`
  + `client_secret`; `POST /v1/auth_tokens/token/` com `grant_type=client_credentials`, **só
  `application/x-www-form-urlencoded`**. Existe `GET /v1/rate_limit/` devolvendo
  `requests_this_minute`, `requests_today`, `rate_limit_model`. A doc de throttling descreve três
  tiers (`standard`, `enhanced`, `exempt`) mas **não publica os números** — só o código-fonte tem.
  Ou seja: `license_type=commercial&license_type=modification` é o único mecanismo, entre todas as
  fontes deste cluster, que devolve *garantia de licença como filtro de consulta*.
- **Como reconferir:**
  `curl -s "https://api.openverse.org/v1/images/?q=cpu&license_type=commercial&page_size=1" | jq '.results[0].license, .results[0].license_url'`
  e `curl -s https://api.openverse.org/v1/rate_limit/`
- **O que quebra se divergir:** se o filtro não for confiável, some a única fonte auto-documentada
  de licença e todo asset volta a exigir checagem manual.
- **Fontes:**
  - https://api.openverse.org/v1/schema/ — endpoints, enums de `license`/`license_type`, auth (primária)
  - https://docs.openverse.org/api/reference/authentication_and_throttling.html — tiers sem números (mesmo domínio)

### R08-25 — Trilha: Audio Library é a única fonte com promessa explícita contra Content ID

- **Verdade operacional:** a frase que interessa é textual: *"Copyright-safe music and sound
  effects downloaded from the Audio Library won't be claimed by a rights holder through the Content
  ID system."* E: *"If you're in the YouTube Partner Program, you can monetize videos with music
  and sound effects from the Audio Library."* Duas licenças: a padrão (sem atribuição) e CC BY
  (*"you must credit the artist in your video's description"*). **Limitação operacional dura:**
  *"The Audio Library is found exclusively in YouTube Studio"* — **não há API**. Download é
  manual, por conta logada. Para um pipeline automatizado isso significa: baixar uma vez, guardar
  em `public/audio/` com o metadado de licença ao lado, e tratar como asset local — não como
  fonte consultável em tempo de geração.
  Sobre Content ID em si: uma reclamação pode *"Block a video from being viewed"*, *"Monetize the
  video by running ads against it and sometimes sharing revenue with the uploader"* ou *"Track the
  video's viewership statistics"*; é contestável. A fonte secundária registra que reclamações
  esporádicas acontecem mesmo com faixas da Audio Library e são disputáveis.
  Alternativa com API: **Jamendo**. Mas o termo é o oposto do que se quer —
  *"The API may be used freely for non-commercial uses. For any other type of use including but
  not limited to commercial uses please contact our sales team at licensing@jamendo.com"*, com
  `commercial use` definido como *"any use that is intended for or directed toward commercial
  advantage or any monetary compensation, including any revenue arising from affiliation programs
  or advertising"*. Um canal monetizado cai nessa definição. Jamendo também exige crédito aos
  membros, crédito ao Jamendo e *"a direct backlink from each Content in the Application"*.
- **Como reconferir:** https://support.google.com/youtube/answer/3376882 e
  https://devportal.jamendo.com/api_terms_of_use. Para Openverse áudio CC:
  `curl -s "https://api.openverse.org/v1/audio/?q=ambient&license_type=commercial&page_size=1" | jq '.results[0].license'`
- **O que quebra se divergir:** o card de trilha sonora. Se a Audio Library não puder ser usada
  fora do YouTube (a página **não** afirma isso; também não nega), a mesma trilha não serve para o
  mesmo vídeo publicado no LinkedIn — e o pipeline precisa de duas trilhas por vídeo.
- **Fontes:**
  - https://support.google.com/youtube/answer/3376882 — Audio Library, Content ID, licenças, monetização (primária)
  - https://support.google.com/youtube/answer/2797370 — como o Content ID age (mesmo domínio)
  - https://vidiq.com/blog/post/royalty-free-music-youtube-audio-library/ (atualizado 2026-02-16) — *"YouTube Audio Library License tracks are free to use on any platform, no attribution"*; reclamações esporádicas existem e são disputáveis (secundária)
  - https://devportal.jamendo.com/api_terms_of_use — cláusula comercial e crédito (primária, segundo domínio, sobre Jamendo)

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| Existe um hook `useGif()` no `@remotion/gif` | **REFUTADO** | O `index.ts` é a lista fechada de exports e contém só `Gif`, `GifProps`, `getGifDurationInSeconds`, `preloadGif`, `GifFillMode`, `RemotionGifProps`. Evidência positiva de ausência. | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/index.ts |
| A função de listar emoji chama-se `getAvailableEmoji()` | **REFUTADO** | O export real é `getAvailableEmojis()` (plural) e o exemplo da doc oficial usa o plural. A URL da doc é singular — é aí que o erro nasce. | https://www.remotion.dev/docs/animated-emoji/get-available-emoji |
| "Basta integrar a GIPHY e usar GIFs de reação no vídeo" | **REFUTADO como afirmação de licença** | O API ToS licencia **a API**, não o conteúdo, e o User ToS proíbe *"use or exploit any content for commercial use"*. Publicar um MP4 com GIF da GIPHY num canal monetizado não tem base de licença nos documentos lidos. | https://support.giphy.com/api/v2/help_center/en-us/articles/360020027752.json |
| A chave gratuita da GIPHY serve para produção | **REFUTADO** | A própria GIPHY chama de "beta key", limita a 100 chamadas/hora e cobra pela production key. | https://support.giphy.com/api/v2/help_center/en-us/articles/10389869671322.json |
| GIPHY e Tenor têm o mesmo regime de uso comercial | **REFUTADO** | A Tenor **lista usos comerciais permitidos** (cobrar acesso, app com anúncios); a GIPHY **proíbe** exploração comercial do conteúdo no User ToS. São regimes opostos. | https://developers.google.com/tenor/guides/api-terms §3.1 |
| "Atribuição a Pexels é opcional" | **PARCIALMENTE REFUTADO** | A **licença** diz que atribuição não é obrigatória; a **guideline da API** exige *"a prominent link to Pexels"* sempre que se faz request. Quem usa a API está sob as duas. | https://www.pexels.com/api/documentation/ |
| Pode-se cachear a URL do GIF do Tenor no roteiro | **REFUTADO** | *"you must refresh the cache at least once each 24 hours"* para URLs de conteúdo. Um roteiro versionado em git com URL do Tenor viola o termo já no segundo dia. | https://developers.google.com/tenor/guides/rate-limits-and-caching |
| Baixar as imagens para o `public/` resolve para todas as fontes | **REFUTADO** | Pixabay **exige** baixar (*"Permanent hotlinking… is not allowed"*); Unsplash **exige** hotlinkar (*"we require the image URLs returned by the API to be directly used or embedded"*). As duas regras não coexistem numa política única. | https://pixabay.com/api/docs/ e https://unsplash.com/documentation |
| A YouTube Audio Library pode ser consultada por API no pipeline | **REFUTADO** | *"The Audio Library is found exclusively in YouTube Studio"*. Não há endpoint. É download manual por conta logada. | https://support.google.com/youtube/answer/3376882 |
| A API do Pixabay dá acesso à música do Pixabay | **NÃO VERIFICADO, tendendo a refutado** | A página de referência da API documenta **apenas** `https://pixabay.com/api/` (imagens) e `https://pixabay.com/api/videos/` (vídeos), com seções "Search Images" e "Search Videos". Nenhum endpoint de áudio. A página de marketing menciona música só no rodapé do site. Vira LEDGER-SEED. | https://pixabay.com/api/docs/ |
| `@remotion/gif` é MIT como o resto do ecossistema JS | **REFUTADO** | O registry devolve `"license":"SEE LICENSE IN LICENSE.md"` para `@remotion/gif`, `@remotion/animated-emoji` **e** `remotion` (v4.0.507). É a Remotion License, não OSI-padrão. Fora do escopo deste cluster, mas condiciona o mesmo card. | `curl -s https://registry.npmjs.org/remotion/latest` |

---

## 4. Armadilhas (falso verde deste domínio)

- **O GIF aparece no preview → você acha que vai aparecer no render.** O `<Player>` roda em tempo
  real e tolera carga lenta; o render posiciona frames fora de ordem. Só o `delayRender()` do
  `GifForRendering` garante o quadro. *Fica vermelho se sumir:* o gate "renderizar 2× e comparar
  md5 do MP4" começa a alternar entre dois hashes.
- **`<img src="reaction.gif">` funciona no navegador → você acha que funciona no Remotion.** Funciona
  no Studio e produz vídeo diferente a cada render. *Fica vermelho se sumir:* nada — é exatamente
  esse o perigo. Precisa de lint próprio proibindo `.gif` dentro de `<img>`/`<Img>` no diretório de
  composições.
- **A chamada de API retorna 200 → você acha que a licença permite.** HTTP 200 é permissão de
  *acesso*, não de *uso*. A GIPHY responde 200 para um GIF que você não pode publicar
  comercialmente. *Fica vermelho se sumir:* nenhum teste automatizado — só um campo `license` obrigatório
  no manifesto de asset, que falha o build quando vazio.
- **O GIF é pequeno em disco → você acha que é barato em memória.** 2 MB comprimidos viram dezenas
  de MB de `ImageData`, e o LRU segura 30. *Fica vermelho se sumir:* o render OOM em worktrees
  paralelas, e o sintoma aparece no agente errado.
- **O termo de serviço é curto → você acha que leu tudo.** O Tenor ToS remete a Google APIs ToS **e**
  Tenor Developer Policies; o GIPHY API ToS remete ao User ToS. O documento que você abriu não é o
  contrato inteiro. *Fica vermelho se sumir:* nada. Só um checklist explícito de "documentos
  referenciados que ainda não foram lidos".
- **A licença de stock permite → você acha que a pessoa na foto permite.** Licença de conteúdo e
  direito de imagem são coisas diferentes; nenhuma das três plataformas garante release.
  *Fica vermelho se sumir:* nada, até a notificação extrajudicial.
- **"Atribuição não é obrigatória" na licença → você acha que não precisa creditar.** Pexels exige
  link na guideline da **API**, independentemente da licença. GIPHY e Tenor exigem marca visível.
  *Fica vermelho se sumir:* nada automático — precisa de um teste de composição que verifique a
  presença do bloco de créditos quando o manifesto tem asset de fonte com atribuição obrigatória.
- **A faixa veio da Audio Library → você acha que está imune ao Content ID.** A promessa da YouTube
  é explícita, mas é uma promessa sobre o sistema dela, e há relatos de reclamações esporádicas
  disputáveis. *Fica vermelho se sumir:* nada no pipeline — só no YouTube Studio, dias depois do
  upload.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| LS-R08-01 | A chave beta da GIPHY tem teto diário além de 100/h? | Assumir que sim (1.000/dia) e instrumentar; nunca depender de mais que isso | `for i in $(seq 1 120); do curl -sD - -o /dev/null "https://api.giphy.com/v1/gifs/trending?api_key=$GIPHY_KEY&limit=1" \| grep -i 'ratelimit\|^HTTP'; done` | Orçamento de chamadas do job em lote; render noturno de N vídeos |
| LS-R08-02 | Quantos MB de RSS custa cada GIF distinto numa composição? | Limite provisório: 3 GIFs por composição | `/usr/bin/time -v npx remotion render <comp> out.mp4` com 1, 3 e 10 GIFs distintos, comparando `Maximum resident set size` | Grau de paralelismo de worktrees; gate de OOM |
| LS-R08-03 | `<Gif>` é bit-a-bit determinístico entre dois renders na mesma máquina? | Assumir que sim; provar antes de confiar | `npx remotion render <comp> a.mp4 && npx remotion render <comp> b.mp4 && md5sum a.mp4 b.mp4` | O gate central de determinismo do programa |
| LS-R08-04 | O Chromium usado pelo render expõe a `ImageDecoder` API (habilita `<AnimatedImage>`)? | Assumir que sim (Chromium recente) e ter `<Gif>` como fallback | Composição de teste com `<AnimatedImage>` + `npx remotion render`; se falhar, o erro aponta ImageDecoder | Escolha do componente no gerador de composições |
| LS-R08-05 | A API do Pixabay expõe algum endpoint de música/áudio não documentado? | Assumir que **não**; usar Openverse `/v1/audio/` para áudio CC | `curl -s -o /dev/null -w "%{http_code}\n" "https://pixabay.com/api/music/?key=$PIXABAY_KEY&q=test"` e `.../api/audio/` | Card de trilha sonora: fonte única vs duas fontes |
| LS-R08-06 | Quais são os números reais de rate limit do Openverse por tier? | Anônimo: assumir ~1 req/s; registrado: medir | `curl -s https://api.openverse.org/v1/rate_limit/` autenticado e anônimo, comparando `requests_this_minute` / `rate_limit_model` | Throttle do provider de stock CC |
| LS-R08-07 | GIFs remotos passam no CORS do render local (`localhost:3000`)? | Assumir que **não** e baixar todo GIF para `public/` antes de compor | Compor `<Gif src="https://media.giphy.com/...">` e rodar `npx remotion render`; o erro de CORS é detectado por `is-cors-error` do pacote | Downloader de assets vira dependência dura do pipeline |
| LS-R08-08 | Quanto custa (segundos) `getGifDurationInSeconds()` — ele baixa o GIF inteiro? | Assumir que baixa tudo; chamar uma vez e cachear a duração no manifesto | Cronometrar a chamada com um GIF de 5 MB e comparar com o tempo de `curl -o /dev/null` do mesmo arquivo | Tempo de planejamento do roteiro (cada duração consultada é um download) |
| LS-R08-09 | O `manuallyManagedGifCache` (via `preloadGif`) vaza entre composições no mesmo processo? | Sempre chamar `free()` no cleanup | Renderizar 50 composições em um processo com `preloadGif` sem `free()` e observar crescimento monotônico de RSS | Estabilidade de renders longos em lote |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| **Podemos usar GIFs da GIPHY em vídeos publicados/monetizados?** O API ToS licencia a API, não o conteúdo; o User ToS proíbe *"exploit any content for commercial use"*. | É apetite de risco jurídico, não fato técnico. O texto é claro; o que varia é quanto risco o dono aceita e se ele quer buscar licença comercial direta com a GIPHY. | **Não** → o card de GIF de reação vira "biblioteca própria + `@remotion/animated-emoji`". **Sim, com risco aceito** → precisa de watermark "Powered By GIPHY" no vídeo e de um registro de decisão. **Buscar licença** → vira uma tarefa de negócio, não de engenharia. |
| **O canal é monetizado / o vídeo é material promocional da empresa?** | Muda a classificação de "uso comercial" em GIPHY, Tenor e Jamendo simultaneamente. Não é dedutível do código. | Monetizado → GIPHY fora, Jamendo exige contrato pago, Tenor precisa checar §3.2. Não monetizado e sem promoção → o espaço de fontes abre bastante. |
| **Aceitamos a leitura literal do Tenor §3.3** (*"modify or replace the … images … of the Tenor search results"*) **como impedimento a redimensionar/compor o GIF?** | É interpretação contratual. As duas leituras são defensáveis e o documento é de 2021-03-03, sem esclarecimento posterior que eu tenha achado. | Leitura literal → só GIF em tamanho nativo, sem crop nem overlay. Leitura benigna → composição livre, mantendo atribuição. |
| **Vamos ler e aceitar os documentos referenciados que não foram lidos** (Google APIs ToS, Tenor Developer Policies)? | Estão fora do escopo desta pesquisa e podem conter restrições que anulam R08-12. | Ler → possivelmente novas restrições em cards. Não ler → o card do Tenor carrega risco não quantificado. |
| **Qual política de asset local: baixar sempre ou hotlinkar?** Pixabay proíbe hotlink; Unsplash o exige. | Depende de qual fonte o dono quer priorizar e se aceita violar uma guideline (não é cláusula de licença, é guideline de API, com risco de revogação de chave). | Baixar sempre → Unsplash sai da lista ou entra com risco de revogação. Hotlinkar → Pixabay sai, e o render fica dependente de rede e de CORS. Duas políticas por fonte → mais um eixo de complexidade no downloader. |
| **Aceitamos exibir marcas de terceiros dentro do vídeo** ("Powered By GIPHY", "Via Tenor", "Photos provided by Pexels")? | É decisão de identidade visual e de contrato ao mesmo tempo. | Sim → precisa de um slot de créditos no template e de um teste que o valide. Não → GIPHY, Tenor e a guideline da API do Pexels ficam de fora; sobram Openverse, Pixabay, Unsplash-por-licença e assets próprios. |
| **Aceitamos a Remotion License** (`SEE LICENSE IN LICENSE.md` em `remotion`, `@remotion/gif`, `@remotion/animated-emoji` v4.0.507)? | Depende do tamanho da empresa e do uso; não é dedutível. Pertence a outro cluster mas condiciona **todos** os cards deste. | Se a licença exigir compra, ela precisa ser resolvida antes de qualquer card de composição existir. |
| **Trilha: baixar manualmente da YouTube Audio Library** (sem API) **ou usar Openverse `/v1/audio/` com filtro CC?** | Trade-off entre garantia contra Content ID (Audio Library, mas manual) e automação (Openverse, mas sem promessa de Content ID). | Audio Library → passo manual permanente no pipeline, com pasta de trilhas versionada. Openverse → totalmente automatizável, com atribuição CC obrigatória no vídeo e risco de Content ID não endereçado. |
| **O vídeo será publicado fora do YouTube?** | A página da Audio Library não afirma nem nega uso externo; só uma fonte secundária afirma que a licença padrão vale em qualquer plataforma. | Só YouTube → Audio Library resolve. Multiplataforma → precisa de trilha com licença explicitamente multiplataforma (CC BY via Openverse, ou catálogo pago). |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** a fonte de "reação/meme" deve ficar atrás de **uma** interface
  `ReactionProvider` com um único método (`find(term) → {localPath, license, attribution}`) e um
  campo `license` obrigatório no manifesto de asset. Custo de reversão medido: **um arquivo de
  provider + uma linha de configuração**. O default deve ser o provider de licença limpa
  (`@remotion/animated-emoji`, CC BY 4.0, assets em `public/`), porque ele não depende de rede, não
  tem rate limit, não tem chave e não tem cláusula comercial contra nós. GIPHY e Tenor entram, se
  entrarem, como providers alternativos ligados por flag — nunca como default, nunca sem a decisão
  da seção 6 registrada.

- **A regra de engenharia que sai deste cluster:** *nenhum asset entra numa composição sem um campo
  `license` preenchido no manifesto*. Isso transforma uma questão jurídica difusa num gate de build
  verificável, e é a única defesa real contra um agente de IA que "encontrou um GIF perfeito".

- **Skills que devem carregar este conhecimento:**
  - a skill de **composição Remotion** precisa de R08-14 a R08-19 (nomes exatos de export, proibição
    de `<img>` para GIF, `<AnimatedImage>` vs `<Gif>`, `getAvailableEmojis` com "s") — é o
    conjunto que impede alucinação de API;
  - a skill de **assets/mídia** precisa de R08-20 a R08-24 (auth, limites, hotlink vs download,
    filtro de licença do Openverse) e do gate de manifesto;
  - a skill de **revisão/adversarial** precisa da seção 3 (refutações) e da seção 4 (armadilhas),
    porque o falso verde aqui é silencioso;
  - qualquer skill que gere roteiro precisa saber que **não existe API da YouTube Audio Library**.

- **Cards que este cluster condiciona:**
  1. Provider de reação com interface única e default de licença limpa (`@remotion/animated-emoji`).
  2. Downloader/cache de assets para `public/` com manifesto obrigatório de licença e atribuição —
     bloqueado pela decisão hotlink-vs-download da seção 6.
  3. Lint de composições proibindo `.gif` em `<img>`/`<Img>` (R08-16) e proibindo `useGif` (R08-14).
  4. Gate de determinismo: render duplo + comparação de hash, com os GIFs presentes na cena
     (LS-R08-03).
  5. Gate de memória/concorrência calibrado pelo LRU de 30 GIFs decodificados (LS-R08-02).
  6. Slot de créditos/atribuição no template de vídeo, alimentado pelo manifesto — só existe se a
     resposta sobre marcas de terceiros for "sim".
  7. Provider de stock com throttle por fonte: 200/h (Pexels), 100/60s (Pixabay), 50 ou 1000/h
     (Unsplash), 1 rps (Tenor), desconhecido (Openverse → LS-R08-06).
  8. Pasta de trilhas locais versionada com metadado de licença, porque a Audio Library não tem API.
