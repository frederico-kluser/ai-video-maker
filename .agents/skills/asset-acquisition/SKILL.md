---
name: asset-acquisition
description: Provides the licensing, rate-limit and content-addressed cache rules for pulling third-party GIFs, memes, stock photos/videos and music into a video rendered locally under this program's signed personal-use framing (ADR-0003). Use whenever a task fetches, caches, references or credits any external media asset, even if the user never says "license", "attribution", "GIPHY", "Tenor" or "rate limit". Triggers: "gif", "meme", "reaction", "sticker", "stock photo", "stock video", "b-roll", "background music", "soundtrack", "royalty free", "giphy", "tenor", "pexels", "unsplash", "pixabay", "openverse", "audio library", "content id", "api key", "rate limit", "download asset", "asset cache", "attribution", "watermark", "credits"
metadata:
  type: knowledge
  tier: dominio
  verification_signal: 'test 0 -eq "$(curl -sL https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/index.ts | grep -c useGif)"'
---
# Aquisição de assets externos — licença, cache endereçado por conteúdo e determinismo

## Quando carregar

- A tarefa vai **buscar, baixar, cachear ou referenciar** qualquer mídia que não nasceu neste
  repositório: GIF de reação, meme, foto/vídeo de stock, trilha, efeito sonoro, emoji animado.
- A tarefa escreve o **downloader**, o **provider** de reação/stock, ou o campo de asset do
  manifesto.
- A tarefa monta o **bloco de créditos / watermark** do vídeo, ou decide se ele existe.
- A tarefa investiga **por que o render não é reproduzível** e há asset externo em cena.
- A tarefa vai afirmar que **uma cláusula de licença bloqueia um card** — a seção 0 já tem a
  resposta, e ela está assinada.
- **Não carregue** para: como o asset é *animado ou posicionado* dentro da composição
  (`remotion-core`); o **formato** do campo de asset no manifesto (`timeline-manifest`); a
  execução do gate de determinismo (`video-characterization`); conversão/normalização do arquivo
  baixado (`ffmpeg-media-ops`).

---

## Conhecimento injetado

### 0. A condição de escopo que muda a leitura de todo o resto

O enquadramento de uso deste programa está **decidido e assinado: uso pessoal** — ADR-0003, aceito
via `I-01` — fonte: `PROGRAMA.md Apêndice C · ADR-0003`. Três consequências, nenhuma delas opinião:

1. **Cláusula de ToS condicionada a *"for commercial use"* não bloqueia card algum aqui.** Ela
   continua verdadeira e continua nesta skill **com a condição de escopo escrita**, porque é a
   condição que a torna verdadeira. `P-01`, `P-02`, `P-03` e `P-04` *"perdem o objeto"* — fonte:
   `PROGRAMA.md Apêndice C · nota «Por que uma resposta fechou quatro perguntas»`. Uma skill que
   marque o card do GIPHY como bloqueado por licença comercial está contradizendo a decisão do dono,
   não sendo prudente.
2. **O que sobra é técnico, e é real:** `F2-04` (resolução de mídia externa) está **desbloqueado**,
   e o que resta são **1 req/s** e **cache obrigatório de 24 h** num dos provedores — fonte:
   `PROGRAMA.md §III-14 · card F2-04`. É a seção 3 desta skill, não a seção 2.
3. **A decisão é condicional, não permanente.** `AB-950` nasce aberto por desenho (*"o uso continua
   pessoal?"*) e reabri-lo reabre `P-01/P-03/P-04` e volta a bloquear `F2-04`, `F2-06` e `F5-06` —
   fonte: `PROGRAMA.md §III-14 · card I-01, campo ledger`. Por isso o texto literal das cláusulas
   fica gravado na **procedência** do asset: procedência existe para auditoria, não para licença
   (`PROGRAMA.md §III-14 · card F2-04`), e no dia em que o escopo mudar ela já existe em vez de
   precisar ser reconstruída asset por asset.

### 1. A regra que domina esta skill: o cache local é endereçado por conteúdo

**Fato que a força:** o próprio panorama declara que, sem lockfile de assets
(`url/id → hash → caminho local`, verificado no gate), *"a palavra 'deterministico' e falsa por
construcao"*, e que busca ao vivo em GIPHY/Tenor/stock muda entre execuções — o que **refuta** a
alegação de pipeline determinístico — fonte: `docs/00-panorama-verificado.md §9.4, item 4` e
`docs/00-panorama-verificado.md §3.1 · refutação I-10`. A timeline resolvida referencia *"assets
referenciados **com hash**"* — fonte: `docs/00-panorama-verificado.md §9.2, Camada 2`.

As regras abaixo são **regras de engenharia deste programa**, derivadas desses fatos. Elas não
carregam placar porque não são afirmações sobre o mundo; os fatos que as sustentam carregam.

1. **O nome do arquivo é o hash do conteúdo**, não o hash da URL nem o `id` do fornecedor. O mesmo
   `id` devolve bytes diferentes conforme a *rendition* escolhida e conforme o fornecedor
   re-encoda; a mesma URL pode ser reapontada. Só o digest dos bytes prova que o byte é o mesmo.
2. **Todo asset baixado é imutável.** Nada é sobrescrito no cache. Se o digest mudou, é **outro
   asset** e **outra entrada** no manifesto — nunca uma atualização no lugar. Sobrescrever move o
   baseline visual sem mover o manifesto, e o golden master passa a pinar outra coisa em silêncio.
3. **INVARIANTE — nada de URL no manifesto resolvido; só hash de conteúdo.** Não é preferência de
   desenho: é a regra de calibração `C7` do programa, reinjetada por hook a cada mensagem — fonte:
   `PROGRAMA.md Parte 0 · C7` (*"Um asset baixado da rede muda de conteúdo mantendo a URL"* → *"Nada
   de URL no manifesto resolvido: só hash de conteúdo"*), reforçada pela definição da timeline
   resolvida, que referencia *"assets referenciados **com hash**"*
   (`docs/00-panorama-verificado.md §9.2, Camada 2`). A URL entra numa coluna de *procedência*
   (`fetchedFrom`), que é prova de origem e **não** caminho de leitura. Um render que resolve URL é
   um render que depende de rede, de CORS e da política de cache do fornecedor — e o modo de falha
   nomeado em `C7` é justamente o silencioso: a URL continua respondendo enquanto os bytes já são
   outros.
4. **Endereço de conteúdo ≠ chave de ação.** O digest identifica o *byte de entrada*. A chave que
   decide se uma **saída derivada** pode ser reusada tem de incluir `tool-versions.lock` (Remotion,
   Chrome empacotado, FFmpeg, Manim, TeX) — mesma chave com ferramenta diferente é falso verde —
   fonte: `docs/00-panorama-verificado.md §5.2 · «Chave do cache de assets»`. Confundir os dois é o
   erro mais caro: corrigir a chave depois invalida o cache inteiro.
5. **Metadado gravado no ato do download, junto com o byte:** `license` (obrigatório),
   `attribution` (o texto exato exigido), `attributionRequired`, `source` (fornecedor + id),
   `fetchedFrom`, e as medidas que custam rede — duração, largura, altura. O campo `license` no
   manifesto de asset **não é opcional**: é a única defesa real contra um agente que "encontrou um
   GIF perfeito" — fonte: `docs/00-panorama-verificado.md §5.1 · «Provider de reação/meme»`.
6. **O gate que prova tudo isso é render com a rede desligada** — decisão provisória do ledger
   `AB-055`, cuja verificação literal é *"desligar a interface de rede e rodar
   `npx remotion render`"* (`docs/00-panorama-verificado.md §7.5 · AB-055`), e o único teste que
   distingue "o cache está completo" de "o cache está quente". `unshare -rn -- <comando de render>`
   é apenas a forma barata de obtê-lo por render sem derrubar a interface, e **não está provada
   nesta máquina** (o Chromium headless abre namespaces próprios) — prove antes de promovê-la a
   gate. E `sha256sum -c` sobre o diretório de cache pega o arquivo trocado à mão, que nenhum outro
   gate pega.

### 2. Licença: o acesso à API não licencia o conteúdo

- O **GIPHY User ToS** proíbe expressamente a exploração comercial do conteúdo: *"you shall not
  copy, modify, publish, transmit, distribute, perform, or display any content, nor shall you sell,
  license, rent, or otherwise use or exploit any content for commercial use"*. Um MP4 com um GIF da
  GIPHY dentro, publicado num canal monetizado, cai em **copy + modify + publish + distribute +
  display + exploit for commercial use** ao mesmo tempo — **Placar (2-0)** — fonte:
  https://support.giphy.com/api/v2/help_center/en-us/articles/360020027752.json ·
  `docs/pesquisa/R08-gifs-licenciamento.md:37`. **Duas condições de escopo, e as duas são o que
  torna a frase verdadeira.** *(a)* Isto é o *User* ToS, que fala do **conteúdo**; o *API* ToS é
  outro documento e fala da **API** (ver `## Não verificado`) — a ausência de permissão no segundo
  não é permissão. *(b)* A proibição é condicionada a **uso comercial**, e o uso deste programa está
  registrado como **pessoal** (ADR-0003): a cláusula **não bloqueia nenhum card aqui**
  (`PROGRAMA.md Apêndice C · nota «Por que uma resposta fechou quatro perguntas»`). Ela fica na
  skill por dois motivos operacionais: `AB-950` pode reabrir o enquadramento a qualquer momento
  (`PROGRAMA.md §III-14 · card I-01, campo ledger`), e a procedência do asset cita o termo
  **literalmente**, porque existe para auditoria e não para licença
  (`PROGRAMA.md §III-14 · card F2-04`).
- **Pexels, Unsplash e Pixabay** permitem uso comercial sem atribuição obrigatória, mas as três
  proíbem redistribuir/vender o conteúdo em estado essencialmente inalterado ou montar serviço
  concorrente, e **nenhuma garante model release nem indeniza o usuário** — **Placar (4-0)** —
  fonte: https://www.pexels.com/license/ · https://unsplash.com/license ·
  https://pixabay.com/service/license-summary/ · `docs/pesquisa/R08-gifs-licenciamento.md:55`.
  **Condição de escopo:** um vídeo técnico com narração, overlays e edição é "creative effort
  applied" e está coberto. O risco residual não é licença, é **direito de imagem e marca** — e
  nenhuma API resolve isso (`docs/00-panorama-verificado.md §9.3 · R08-23`).
- A **guideline da API do Pexels** exige *"a prominent link to Pexels"* a cada requisição, **mesmo
  a licença dizendo que atribuição não é obrigatória**: quem usa a API está sob os dois documentos
  — **Placar (2-0)** — fonte: https://www.pexels.com/api/documentation/ ·
  `docs/pesquisa/R08-gifs-licenciamento.md:52`.
- A **Unsplash** obriga disparar `GET /photos/:id/download` a cada download **e** obriga hotlinkar
  as URLs devolvidas pela API — **Placar (2-0)** — fonte: https://unsplash.com/documentation ·
  `docs/pesquisa/R08-gifs-licenciamento.md:54`. Isso colide de frente com o invariante `C7`: hotlink
  obrigatório e "nada de URL no manifesto resolvido" não coexistem. A colisão é entre uma
  **guideline de API** e um **invariante do programa** — não é cláusula de licença e não depende do
  enquadramento de uso, que já está fechado. Consequência operacional: **a Unsplash fica fora
  enquanto `C7` valer**, e o custo de desobedecer é revogação de chave, não infração de licença
  (`docs/pesquisa/R08-gifs-licenciamento.md:560`). O panorama registra a mesma colisão ao refutar
  *"baixar as imagens para o `public/` resolve para todas as fontes"*
  (`docs/00-panorama-verificado.md §3.3 · refutação R08-21+R08-22`).
- A **YouTube Audio Library** é a única fonte com promessa explícita — *"Copyright-safe music and
  sound effects downloaded from the Audio Library won't be claimed by a rights holder through the
  Content ID system"* — e é monetizável no YPP; **mas** *"The Audio Library is found exclusively in
  YouTube Studio"*: **não há API** — **Placar (2-0)** — fonte:
  https://support.google.com/youtube/answer/3376882 · `docs/pesquisa/R08-gifs-licenciamento.md:57`.
  Consequência: trilha é passo **manual permanente**, versionada como asset local com o metadado de
  licença ao lado. Um agente que "vai consultar a API da Audio Library" está alucinando. A **única
  alternativa automatizável** que a mesma fonte registra é Openverse `/v1/audio/` com filtro de
  licença CC, e o que se troca é exatamente a promessa: automação em lugar da garantia contra
  Content ID (`docs/00-panorama-verificado.md §2.6 · R08-25`). A superfície dessa API é (1-0) — ver
  `## Não verificado` — e a escolha entre as duas é do card `F2-06`
  (`PROGRAMA.md §III-14 · card F2-06`), não do agente. **Condição de escopo:** a promessa é sobre o
  Content ID **da própria YouTube** e a monetização é **dentro do YPP** — citar a frase sem as duas
  condições a transforma em garantia universal, que ela não é. A página não afirma nem nega uso fora
  do YouTube; **onde** o vídeo é publicado é `I-04` → **ADR-0007** (canal e política editorial),
  **pendente** (`PROGRAMA.md Apêndice C · ADR-0007`). Não existe "ADR-004 de trilha" no registro
  deste programa: `0004` é *absorver × integrar o projeto de origem*
  (`PROGRAMA.md Apêndice C · ADR-0004`).
- **`@remotion/animated-emoji` é o plano B de licença limpa**: exporta `AnimatedEmoji`,
  `getAvailableEmojis` (**com "s"** — a URL da doc é singular e é aí que o erro nasce),
  `CalculateEmojiSrc`; os assets são vídeos pré-renderizados do Google Fonts Animated Emoji sob
  **CC BY 4.0**, copiados para o `public/` do projeto — **Placar (3-0)** — fonte:
  https://github.com/remotion-dev/animated-emoji · https://creativecommons.org/licenses/by/4.0/ ·
  `docs/pesquisa/R08-gifs-licenciamento.md:51`. Sem chave, sem rede, sem rate limit, sem cláusula
  comercial contra nós — por isso é o **default** do `ReactionProvider`
  (`docs/00-panorama-verificado.md §5.1 · «Provider de reação/meme»`).

### 3. Rate limits — o que sobra de pé no escopo pessoal

Com o enquadramento fechado, **é esta seção que governa o card de mídia externa**: o programa
declara que o que resta de `F2-04` são **1 req/s** e **cache obrigatório de 24 h** num dos
provedores (`PROGRAMA.md §III-14 · card F2-04`). Regra de engenharia que sai daí, e ela **não**
depende de placar: os tetos do Tenor e do Pixabay entram no desenho do downloader mesmo estando em
`## Não verificado` com (1-0), porque o custo de errar é assimétrico e invisível — acima de 1 rps a
requisição do Tenor **falha em vez de enfileirar**, e a Pexels declara que contornar o limite é
causa de encerramento. Projete para o teto documentado; um teto que na prática seja mais generoso
não custa nada, e ignorá-lo custa a chave. Os tetos por fornecedor:

- **Tenor** (`key`, `client_key` recomendado): **1 requisição por segundo**, e URL de conteúdo em
  cache renovada a cada 24 h — placar (1-0), ver `## Não verificado`. O segundo item **não** é um
  TTL do arquivo baixado: é obrigação sobre a **URL guardada**, e o invariante `C7` já a satisfaz
  por não guardar URL nenhuma.
- **Pixabay** (`key`): 100 requisições/60 s, requisições cacheadas por 24 h e hotlink permanente
  proibido — placar (1-0), ver `## Não verificado`. É a fonte cuja exigência **coincide** com `C7`
  (baixar para disco), ao contrário da Unsplash.
- **Openverse:** números por tier **não publicados** — placar (1-0). Ausência de número publicado
  não é ausência de limite: instrumente `GET /v1/rate_limit/` antes de paralelizar.
- **GIPHY** (`api_key` na query, base `https://api.giphy.com/v1`): sticker transparente vem dos
  **endpoints espelhados** `/stickers/*`, que são recursos separados — **não** um parâmetro
  `transparent`/`stickers` na busca, que é a confusão registrada e refutada em
  `docs/00-panorama-verificado.md §3.2 · refutação R08-01` — **Placar (2-0)** — fonte:
  https://developers.giphy.com/docs/api/endpoint/ · `docs/pesquisa/R08-gifs-licenciamento.md:33`.
- **A chave gratuita da GIPHY é uma "beta key": 100 chamadas por hora.** A chave de produção exige
  aplicação pelo dashboard e é **paga, com preço negociado caso a caso** — **Placar (2-0)** — fonte:
  https://support.giphy.com/api/v2/help_center/en-us/articles/10389869671322.json ·
  `docs/pesquisa/R08-gifs-licenciamento.md:34`. **Condição de escopo que muda tudo:** o limite é
  **por chave**, não por processo. Um roteiro isolado faz 1–3 buscas e 100/h é folgado;
  **N worktrees paralelas com retry derrubam a chave**
  (`docs/00-panorama-verificado.md §2.6 · R08-01`).
  Daí a regra: a aquisição acontece **antes** da onda, num único processo serializado, e a onda só
  lê o cache.
- **Pexels:** autenticação por header `Authorization`; **200 requisições/hora e 20.000/mês**;
  contornar o rate limit é causa declarada de encerramento — **Placar (2-0)** — fonte:
  https://www.pexels.com/api/documentation/ · `docs/pesquisa/R08-gifs-licenciamento.md:52`.
- **Unsplash:** `Authorization: Client-ID <key>`; **demo = 50 req/h**, **produção = 1000 req/h após
  aprovação** — **Placar (2-0)** — fonte: https://unsplash.com/documentation ·
  `docs/pesquisa/R08-gifs-licenciamento.md:54`.

### 4. `@remotion/gif`: superfície fechada e por que `<img>` quebra o determinismo

- O `index.ts` do pacote é a lista **fechada** de exports: `Gif`, `GifProps`,
  `getGifDurationInSeconds`, `preloadGif`, `GifFillMode`, `RemotionGifProps`. **`useGif` não
  existe** — evidência *positiva* de ausência, não lacuna de busca — **Placar (3-0)** — fonte:
  https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/index.ts ·
  `docs/pesquisa/R08-gifs-licenciamento.md:46`.
- **Por que `<img src="x.gif">` é não-determinístico:** o GIF de um `<img>` anima pelo **relógio de
  parede do navegador**, e o renderizador não avança em tempo real — ele posiciona o frame `N`,
  captura, pula para `N+1`, possivelmente fora de ordem e em instâncias de página paralelas. O
  `<Gif>` corrige por três mecanismos verificáveis no fonte — **e a correção vive no componente do
  caminho de render (`GifForRendering`), não no `<Player>`**, que é exatamente por que o preview é
  falso verde: (a) `delayRender()` bloqueando a pintura até o GIF estar parseado;
  (b) índice puro `useCurrentGifIndex` =
  f(`frame`, `fps`, `playbackRate`, `delays`), **sem `Date.now()`**; (c) pintura em `<canvas>`, em
  vez de delegar ao decodificador animado do navegador — **Placar (2-0)** — fonte:
  https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/useCurrentGifIndex.tsx
  · `docs/pesquisa/R08-gifs-licenciamento.md:47`.
- **O GIF é pequeno em disco e caro em memória:** `volatileGifCache` é um `QuickLRU` de
  **`maxSize: 30`** e `manuallyManagedGifCache` é um `Map` **sem teto**, que só esvazia com o
  `free()` devolvido por `preloadGif()`. `GifState` guarda os quadros **descomprimidos** — **Placar
  (2-0)** — fonte:
  https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/gif/src/gif-cache.ts ·
  `docs/pesquisa/R08-gifs-licenciamento.md:49`.
  **Condição de escopo:** o custo é **por processo**. Em worktrees paralelas ele multiplica pelo
  número de agentes, e o OOM aparece no agente errado. O teto por composição é provisório e é item
  de ledger (`docs/00-panorama-verificado.md §7.5 · AB-057`).

### 5. Política de fallback quando a API está fora

Ordem obrigatória, e a razão de cada degrau:

1. **Cache local por hash.** Se o manifesto já traz o digest e o arquivo existe, a API estar fora é
   irrelevante — é exatamente para isso que o cache é endereçado por conteúdo.
2. **Provider de licença limpa** (`@remotion/animated-emoji`, CC BY 4.0, assets em `public/`):
   sem chave, sem rede, sem rate limit — **Placar (3-0)**, fonte da seção 2.
3. **Falhar o build**, imprimindo o termo de busca e o nó do manifesto que ficou sem asset.

Regras que valem em todos os degraus:

- **Fallback nunca troca a licença sem trocar a procedência.** Devolver um asset de outra fonte
  reaproveitando a mesma entrada de manifesto é precisamente como licenças incompatíveis se
  misturam sem ninguém notar.
- **`429` da GIPHY não é erro transitório dentro da mesma hora** — o limite é por chave e a janela
  é horária (2-0, seção 3). Backoff exponencial dentro de uma onda paralela queima o orçamento
  restante em vez de recuperá-lo. A resposta certa é serializar a aquisição fora da onda.
- **Degradar para "renderizar sem o asset" é proibido sem marcar o nó.** Um vídeo que sai completo
  com um buraco silencioso é o pior desfecho: nada fica vermelho.

---

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Não baixe asset no momento do render.** Busca ao vivo muda de resultado entre execuções e
  destrói o determinismo por construção (`docs/00-panorama-verificado.md §3.1 · refutação I-10` e
  `§9.4, item 4`) — e, com N worktrees, também derruba a chave (2-0, seção 3).
- **Não referencie URL remota no manifesto**, nem "só para o preview". O manifesto é o insumo do
  gate; uma URL nele torna o gate dependente de rede, de CORS e da política de cache do
  fornecedor.
- **Não trate "API gratuita" como "licença para redistribuir".** HTTP 200 é permissão de *acesso*,
  não de *uso*. A GIPHY responde 200 para conteúdo que o User ToS proíbe explorar comercialmente
  (2-0) — e frequentemente ela mesma não é dona do frame (série, filme).
- **Não misture assets de licença incompatível no mesmo vídeo sem procedência por asset.** A
  mistura não é detectável depois: um MP4 renderizado não carrega metadado de origem por região da
  tela. A procedência tem de existir **no ato do download**, por asset, ou não existe.
- **Não coloque a atribuição numa tela de configuração.** Quando a fonte exige marca, ela é devida
  no artefato que circula: um bloco de créditos que ninguém renderiza é conformidade encenada.
  **Condição:** se aceitamos **exibir** marca de terceiro dentro do vídeo é `P-17`, ainda aberto e
  sem ADR no registro do programa (`docs/00-panorama-verificado.md §6.2 · P-17`) — a saída legítima
  para um "não" é **descartar a fonte**, nunca usá-la sem a marca.
- **Não escreva `useGif`** — não existe (3-0). **Não escreva `getAvailableEmoji`** no singular — o
  export é `getAvailableEmojis`, e a URL singular da doc é a origem do erro (3-0).
- **Não use `<img>` nem `<Img>` para `.gif`.** Funciona no Studio, quebra no render, e **nada fica
  vermelho** — precisa de lint próprio no diretório de composições.
- **Não chame `getGifDurationInSeconds()` em tempo de planejamento de roteiro.** Cada chamada é um
  download; a duração deve ser gravada no manifesto no ato da aquisição (item de ledger,
  `docs/pesquisa/R08-gifs-licenciamento.md:547`).
- **Não use `preloadGif()` sem `free()` no cleanup.** O cache manual não tem teto (2-0); em lote,
  o RSS cresce monotonicamente.
- **Não implemente o "cache de 24 h" do fornecedor como TTL do arquivo baixado.** É o erro que um
  engenheiro cuidadoso comete *por* ler o termo: a obrigação é renovar a **URL de conteúdo**
  guardada, e traduzi-la para "re-baixar por cima a cada 24 h" troca o byte sem trocar a entrada do
  manifesto — o baseline visual anda e o golden master passa a pinar outra coisa em silêncio. Sob
  `C7` não há URL guardada; se o asset for readquirido, ele entra como **nova** entrada com **novo**
  digest.
- **Não reabra por dedução uma decisão assinada, e não a estenda.** O enquadramento é **pessoal**
  (ADR-0003, `PROGRAMA.md Apêndice C · ADR-0003`): nenhum card aqui nasce bloqueado por cláusula
  comercial, e um agente que "melhora" a skill marcando o card do GIPHY como bloqueado por licença
  está contradizendo o dono. O erro simétrico é pior: a decisão **não** autoriza uso comercial,
  **não** decide a leitura literal do §3.3 do Tenor e **não** decide marca de terceiro dentro do
  vídeo (`P-17`, `docs/00-panorama-verificado.md §6.2 · P-17`, sem ADR próprio no registro do
  programa). O gatilho que reabre tudo é `AB-950` (`PROGRAMA.md §III-14 · card I-01, campo ledger`),
  e nenhum agente transforma *"eu li o ToS"* em *"está liberado"*
  (`docs/00-panorama-verificado.md §8.1 · R08-04..R08-24`).
- **Não assuma que "baixar tudo para `public/`" resolve para todas as fontes.** Resolve para a
  maioria e **colide com a exigência de hotlink da Unsplash** (2-0). Uma política única para todas
  as fontes é uma violação em pelo menos uma delas.
- **Não guarde só o hash.** Hash sem registro de licença e procedência é um blob órfão: ninguém
  consegue reauditar nem re-licenciar o que já está no vídeo.

---

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| O GIF aparece no preview do `<Player>` | O Player roda em tempo real e tolera carga lenta; o render posiciona frames fora de ordem | O gate "renderizar 2× e comparar `framemd5`" passa a alternar entre dois resultados |
| `<img src="reaction.gif">` funciona no Studio | Produz vídeo diferente a cada render, sem erro | **Nada** — é exatamente o perigo; exige lint proibindo `.gif` em `<img>`/`<Img>` |
| A chamada de API retornou `200` | `200` é permissão de acesso, não de uso; a GIPHY responde 200 para conteúdo que o User ToS proíbe explorar comercialmente | **Nada automático** — só o campo `license` obrigatório no manifesto, falhando o build quando vazio |
| O GIF tem 2 MB em disco | Vira dezenas de MB de `ImageData`; o LRU segura 30 decodificados, **por processo**, e o OOM estoura no agente errado | **Nada hoje** — o custo em MB por GIF não está medido (`docs/00-panorama-verificado.md §7.5 · AB-057`); só um teto medido por composição, cobrado no gate: `/usr/bin/time -v npx remotion render <comp> out.mp4` com 1, 3 e 10 GIFs, comparando `Maximum resident set size` |
| O ToS é curto, então foi lido inteiro | O Tenor remete a Google APIs ToS e a Tenor Developer Policies; o GIPHY API ToS remete ao User ToS. O documento aberto não é o contrato inteiro | **Nada**, e nada é tolerável aqui só porque o escopo é pessoal (ADR-0003) — o que fica de pé é a lista de "documentos referenciados e não lidos" gravada na procedência da fonte, lida pelo relatório `F5-06`, que **bloqueia a entrega** de asset sem origem declarada (`PROGRAMA.md §III-14 · card F5-06`) |
| A licença de stock permite uso comercial | Licença de conteúdo e direito de imagem/marca são coisas diferentes; nenhuma plataforma garante release nem indeniza | **Nada** — até a notificação extrajudicial |
| A licença diz "atribuição não é obrigatória" | A guideline da **API** do Pexels exige link mesmo assim (2-0); GIPHY e Tenor exigiriam marca visível, mas isso é **(1-0)** — ver `## Não verificado`, não afirme como fato | **Nada** — só um teste de composição que exija o bloco de créditos quando o manifesto tem asset com atribuição obrigatória |
| A faixa veio da YouTube Audio Library | A promessa é sobre o sistema Content ID **da própria YouTube**; reclamações esporádicas existem e são disputáveis | **Nada no pipeline** — só no Studio, dias depois do upload |
| O render offline passou | Pode ter passado porque o cache estava quente, com o manifesto ainda apontando URL | O gate `AB-055` na forma literal do ledger — **desligar a interface de rede** e rodar o render (`docs/00-panorama-verificado.md §7.5 · AB-055`); com cache incompleto ele fica vermelho. `unshare -rn` é a variante barata e **ainda não provada nesta máquina**: usá-la sem prova troca um gate por um placebo |
| O cache tem o arquivo com o nome certo | Nome não prova conteúdo: arquivo trocado à mão mantém o nome | `sha256sum -c` sobre o diretório de cache, recomputando o digest e comparando com o nome |
| A busca devolveu o asset "certo" duas vezes seguidas | Resultado de busca de GIPHY/Tenor/stock não é estável entre execuções, e a instabilidade não é reproduzível sob demanda | **Nada** — render duplo na mesma hora não pega o que o fornecedor troca semana que vem; só o lockfile `url/id → hash → caminho` no manifesto transforma a troca em `git diff` |

---

## O que esta skill NÃO cobre

- **Como o asset é composto, animado ou cronometrado em cena** (props do `<Gif>`, `<Sequence>`,
  `interpolate`) → `remotion-core`.
- **O schema do campo de asset e a forma da timeline resolvida** (quais chaves, quais são
  opcionais, como o manifesto é validado) → `timeline-manifest`.
- **Executar e calibrar o gate de determinismo** (`framemd5`, render duplo, baseline visual,
  limiar) → `video-characterization` e `falsifiable-gates`.
- **Concorrência de render, chunking, consumo real de memória do processo** →
  `remotion-render-pipeline`.
- **Converter, redimensionar, normalizar ou re-encodar o arquivo baixado** → `ffmpeg-media-ops`.
- **Trilha como problema de áudio** (mixagem, ducking, offset, sincronia com legenda) →
  `audio-captions-sync`. Esta skill só cobre **de onde a trilha vem e sob qual licença**.
- **Voz sintética e licença dos pesos de TTS** → `tts-voiceover`.
- **A licença do próprio Remotion** (Company License, elegibilidade) → `remotion-core`.
- **Como registrar decisão do dono e manter o gatilho de reabertura vivo** (ADR-0003 já assinado,
  o que o sign-off **não** autoriza, `AB-950` aberto por desenho) → `uncertainty-ledger`.

---

## Não verificado

Tudo abaixo tem placar **< 2-0** e por isso **não pode ser citado como fato**. A razão dominante é
estrutural e deliberada: uma cláusula de licença lida **literalmente** no documento vinculante do
próprio fornecedor ainda marca (1-0), porque existe **uma** fonte — falta corroboração independente
(parecer jurídico, contrato, política escrita endereçada ao nosso caso). Ver
`docs/00-panorama-verificado.md §8.1 · R08-04..R08-24` e
`docs/pesquisa/R08-gifs-licenciamento.md:12-26`.

**Exceção operacional — e ela não promove placar nenhum:** os tetos técnicos do Tenor (1 rps) e do
Pixabay (100/60 s, cache 24 h) entram no **desenho** do downloader mesmo em (1-0), porque o programa
já os declara como o que resta de `F2-04` (`PROGRAMA.md §III-14 · card F2-04`) e porque errar para o
lado permissivo não produz falha de teste: a requisição falha ou a chave é revogada, ambos fora do
pipeline. "Não citável como fato" continua valendo — o que se cita é a regra de engenharia, não o
número.

| Afirmação | Placar | Comando que fecha a lacuna |
|---|---|---|
| O GIPHY **API** ToS licencia a **API**, não o conteúdo (varredura por `download`, `store`, `cache`, `redistribute`, `derivative`, `video`, `monetiz`, `indemnif` não encontrou ocorrências) | (1-0) | `curl -s https://support.giphy.com/api/v2/help_center/en-us/articles/360028134111.json` + parecer jurídico |
| A GIPHY exige a marca conspícua **"Powered By GIPHY"** onde a API é usada, e cita isso como condição da production key | (1-0) | `curl -s https://support.giphy.com/api/v2/help_center/en-us/articles/360035158592.json` |
| O **pingback** (Action Register: `onload`/`onclick`/`onsent`, params `customer_id`+`ts`) existe, mas **nenhum documento aberto o declara obrigatório** | (1-0) | `curl -s "https://api.giphy.com/v1/gifs/trending?api_key=$GIPHY_KEY&limit=1" \| jq '.data[0].analytics'` — e perguntar à GIPHY por escrito |
| A chave beta da GIPHY teria teto adicional de **1.000 chamadas/dia** (afirmado por terceiro, ausente na doc oficial) | (1-1) | logar `X-RateLimit-*` por 48 h: `curl -sD - -o /dev/null "https://api.giphy.com/v1/gifs/trending?api_key=$GIPHY_KEY&limit=1" \| grep -i ratelimit` |
| **GIPHY Clips** (`/v1/clips/*`) só é liberado mediante aprovação por e-mail | (1-0) | `curl -s "https://api.giphy.com/v1/clips/search?api_key=$GIPHY_KEY&q=test&limit=1" \| jq '.meta'` |
| **Tenor v2**: base `https://tenor.googleapis.com/v2`, auth por `key`, `client_key` recomendado | (1-0) | `curl -s "https://tenor.googleapis.com/v2/search?key=$TENOR_KEY&q=test&limit=1" \| jq 'keys'` |
| **Tenor**: limite padrão de **1 requisição por segundo**, e acima disso a requisição **falha** (não enfileira); URLs de conteúdo em cache devem ser renovadas a cada 24 h | (1-0) | `for i in 1 2 3; do curl -s -o /dev/null -w "%{http_code} " "https://tenor.googleapis.com/v2/search?key=$TENOR_KEY&q=test&limit=1"; done` |
| **Tenor**: atribuição obrigatória com uma de três marcas ("Powered By Tenor", "Search Tenor", "Via Tenor") | (1-0) | https://developers.google.com/tenor/guides/attribution + confirmação escrita |
| **Tenor**: o ToS **permite** usos comerciais listados (cobrar acesso, app com anúncios) — regime **oposto** ao da GIPHY; e o §3.3 proíbe *"modify or replace the text, images, or other content of the Tenor search results"*, cláusula ambígua quanto a recortar/compor | (1-0) | leitura de https://developers.google.com/tenor/guides/api-terms **mais** os documentos que ele remete (Google APIs ToS, Tenor Developer Policies), que não foram lidos → ADR-003 |
| A doc oficial da Remotion diz *"Don't use the `<Img>` tag for GIFs, use `@remotion/gif` instead"* | (1-0) | `curl -s https://www.remotion.dev/docs/img \| grep -i "don't use"` — o **mecanismo** por trás disso, porém, é (2-0) na seção 4 |
| `<AnimatedImage>` (pacote `remotion`) cobre GIF/APNG/AVIF/WebP animado mas depende da **ImageDecoder Web API** (Chrome/Firefox). **Escopo:** o render headless roda em Chromium, então a restrição morde o `<Player>` no Safari, **não** o caminho de render | (1-0) | compor `<AnimatedImage>` e renderizar; se falhar, o erro aponta `ImageDecoder` |
| **Pixabay**: auth por param `key`, **100 requisições/60 s**, *"Requests must be cached for 24 hours"* e **hotlink permanente proibido** (é preciso baixar) | (1-0) | `curl -sD - "https://pixabay.com/api/?key=$PIXABAY_KEY&q=test&per_page=3" -o /dev/null \| grep -i ratelimit` |
| **Openverse**: `GET /v1/images/` e `GET /v1/audio/` com filtros `license` e `license_type` (único mecanismo que devolve garantia de licença **como filtro de consulta**); rate limits por tier **não publicados** | (1-0) | `curl -s "https://api.openverse.org/v1/images/?q=cpu&license_type=commercial&page_size=1" \| jq '.results[0].license'` e `curl -s https://api.openverse.org/v1/rate_limit/` |
| Assets remotos **falham no CORS** do render local, forçando download prévio — item aberto **`AB-056`** (assumido, não medido) | assumido | fecha `AB-056`: compor `<Gif src="https://media.giphy.com/...">` e rodar o render; o pacote detecta com `is-cors-error` (`docs/00-panorama-verificado.md §7.5 · AB-056`) |
| Custo de RSS por GIF distinto numa composição; teto provisório de **3 GIFs por composição** — item aberto **`AB-057`** | assumido | fecha `AB-057`: `/usr/bin/time -v npx remotion render <comp> out.mp4` com 1, 3 e 10 GIFs distintos, comparando `Maximum resident set size` (`docs/00-panorama-verificado.md §7.5 · AB-057`) |
| A API do Pixabay exporia endpoint de música/áudio | tendendo a refutado | `curl -s -o /dev/null -w "%{http_code}\n" "https://pixabay.com/api/music/?key=$PIXABAY_KEY&q=test"` |

---

## Evolution

On task completion, if this skill was involved, run the memory pipeline
(see `meta-skill-evolution`):
1. **Importance** — non-obvious, non-inferable, non-volatile, and changes how future tasks
   in this area are done?
2. **Verification** — confirmed by a green test/lint/eval or explicit user confirmation?
   Without an external signal, discard.
3. **Conflict** — contradicts an existing passage? Replace it; never append a rival rule.
4. **Gating** — run the skill linter and this skill's eval set. Discard on regression.
5. **Update** — edit this file directly. No learnings file, no buffer.

If nothing important and verified was learned, write nothing — that is the healthy default.
