# R01 — Remotion: licença, versões, requisitos de runtime

**Escopo desta pesquisa:** fecha o modelo de licenciamento do Remotion (quem paga, quanto, sob
que gatilho), a versão estável corrente com sua política de compatibilidade, os requisitos de
Node/SO/bibliotecas Linux para render local, e o inventário real de pacotes `@remotion/*`.
NÃO responde: custo de render em nuvem (Lambda/Cloudrun/Vercel), performance de encoding,
API de composição/timeline, nem a decisão jurídica de qual tier contratar — isso é R05/R12 e
`PERGUNTA-DONO`.

> **Convenção de contagem usada aqui (importante para ler os placares).**
> Licenciamento tem um único fornecedor: não existe "fonte independente" no sentido forte.
> Contei como fontes distintas apenas documentos com **função distinta**:
> (a) `LICENSE.md` no repositório — texto legal vigente;
> (b) `remotion.dev/docs/license/*` — FAQ + Terms (mesmo domínio ⇒ **uma** fonte);
> (c) `remotion.pro/license` — página comercial;
> (d) `registry.npmjs.org` — registro público, autoridade sobre o que existe publicado;
> (e) `github.com/remotion-dev/remotion` — árvore de pacotes, releases, `package.json`,
> Dockerfiles (artefatos executáveis, não prosa).
> Arquivos `raw.githubusercontent.com` que **geram** uma página de `remotion.dev`
> (ex.: `docs/license/faq.mdx`) foram contados como a **mesma** fonte que a página — são
> a mesma testemunha, não duas.
> Data de coleta de todas as fontes: **2026-08-10**. Versão de referência: **Remotion 4.0.507**.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R01-01 | Remotion **não é open-source**: é *source-available* sob licença proprietária própria, e a documentação oficial afirma isso literalmente. | (3-0) | CONFIRMADO | https://www.remotion.dev/docs/license/faq |
| R01-02 | Na licença vigente (linha 4.x), uma organização **com fins lucrativos com mais de 3 empregados** não é elegível à Free License e é obrigada a obter uma Company License paga. | (3-0) | CONFIRMADO | https://github.com/remotion-dev/remotion/blob/main/LICENSE.md |
| R01-03 | O critério de contagem **muda** entre o texto vigente e o texto do 5.0: `LICENSE.md` conta *empregados da organização*; os Terms que entram em vigor no 5.0 contam *pessoal que opera o software*. | (1-1) | EM DISPUTA | https://www.remotion.dev/docs/license/terms |
| R01-04 | Os tiers pagos publicados são: **Creators US$ 25/Seat/mês** (sem mínimo), **Automators US$ 0,01/Render com Minimum Spend de US$ 100/mês**, **Enterprise a partir de US$ 500/mês**. | (2-0) | PROVÁVEL | https://www.remotion.pro/license |
| R01-05 | **Não há diferença de funcionalidade** entre a versão gratuita e a paga — a discriminação é só de preço por perfil de usuário. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/license/faq |
| R01-06 | Uso comercial é amplamente permitido (inclui vídeo interno e de marketing); o proibido é vender/relicenciar um derivado do próprio Remotion. | (3-0) | CONFIRMADO | https://github.com/remotion-dev/remotion/blob/main/LICENSE.md |
| R01-07 | É **explicitamente permitido** construir um serviço que gera código Remotion com IA em nome do usuário e o renderiza; é **proibido** deixar o usuário subir código/projeto Remotion próprio para renderizar no seu servidor. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/license/faq |
| R01-08 | A definição oficial de "automation" enumera 18 gatilhos e inclui `npx remotion render` **e** o componente `<Player>`. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/license/faq |
| R01-09 | A mesma FAQ classifica render local de baixo volume como Creators (sem comprar Renders) **e** classifica `npx remotion render` como automation — as duas leituras se contradizem para o nosso caso de uso. | (1-1) | EM DISPUTA | https://www.remotion.dev/docs/license/faq |
| R01-10 | A versão estável corrente é **4.0.507**; não existe nenhuma release 5.x publicada no npm. | (2-0) | PROVÁVEL | https://registry.npmjs.org/remotion/latest |
| R01-11 | **Remotion 5.0 não foi lançado** até 2026-08-10; a página de migração declara a lista de breaking changes como incompleta e planejada. | (3-0) | CONFIRMADO | https://www.remotion.dev/docs/5-0-migration |
| R01-12 | Toda a linha 4 é **patch-only**: as releases vão de 4.0.0 a 4.0.507 sem nenhum incremento de *minor*. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/releases |
| R01-13 | A política declarada é semver por *major* ("mesmo primeiro número ⇒ retrocompatível"), com exceção explícita para APIs marcadas como experimentais. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/upgrading |
| R01-14 | O 5.0 planeja **remover** `@remotion/media-parser` e `@remotion/webcodecs` (substituídos por Mediabunny) e `@remotion/light-leaks` / `@remotion/starburst` (absorvidos por `@remotion/effects`). | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/5-0-migration |
| R01-15 | O mínimo declarado é **Node ≥ 16** (ou Bun ≥ 1.0.3) na linha 4.x, e sobe para Node 18.0.0 no 5.0. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/package.json |
| R01-16 | Nenhum pacote publicado (`remotion`, `@remotion/cli`, `@remotion/renderer`, `@remotion/player`, `create-video` @ 4.0.507) declara campo `engines`, portanto o gerenciador de pacotes **não bloqueia** um Node incompatível na instalação. | (1-0) | NÃO VERIFICADO | https://registry.npmjs.org/remotion/latest |
| R01-17 | Requisitos de SO declarados: **macOS 15 (Sequoia)+**, **Linux com glibc ≥ 2.35**, **Windows apenas x64**; **Alpine e NixOS não são suportados**. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/4-0-migration |
| R01-18 | Em Debian/Ubuntu o render exige 14 bibliotecas de sistema para o Chrome Headless Shell (`libnss3`, `libdbus-1-3`, `libatk1.0-0`, `libgbm-dev`, `libasound2`, `libxrandr2`, `libxkbcommon-dev`, `libxfixes3`, `libxcomposite1`, `libxdamage1`, `libatk-bridge2.0-0`, `libpango-1.0-0`, `libcairo2`, `libcups2`). | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/dockerfiles/Dockerfile.debian |
| R01-19 | O Remotion baixa o **Chrome Headless Shell** automaticamente para `node_modules/.remotion/chrome-headless-shell/…`; a versão fixada em 4.0.452+ é a 149.0.7790.0 e o modo alternativo se seleciona com `--chrome-mode="chrome-for-testing"` / `chromeMode: 'chrome-for-testing'` / `Config.setChromeMode()`. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell |
| R01-20 | FFmpeg **não é dependência externa**: está embutido dentro do pacote `@remotion/renderer` desde o 4.0. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/4-0-migration |
| R01-21 | **Todos os 30 pacotes `@remotion/*` citados no panorama existem** e estão documentados; a lista oficial de referência traz 41 pacotes. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/docs/components/TableOfContents/api.tsx |
| R01-22 | `@remotion/sfx` **existe** (npm 4.0.507, `packages/sfx` no monorepo, listado na referência de API) — não é um pacote inventado. | (3-0) | CONFIRMADO | https://registry.npmjs.org/@remotion/sfx |
| R01-23 | O campo `license` no npm é **inconsistente entre pacotes do mesmo monorepo** (`remotion` = "SEE LICENSE IN LICENSE.md", `@remotion/sfx` = "MIT", `@remotion/effects` = "UNLICENSED") e portanto não é fonte confiável do licenciamento. | (1-0) | NÃO VERIFICADO | https://registry.npmjs.org/@remotion/sfx |
| R01-24 | O **Editor Starter** é um produto pago à parte (US$ 600), incluído no Enterprise, e não substitui a Company License. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/editor-starter/buy |
| R01-25 | Existe pacote oficial de **Agent Skills** para agentes de código (12 skills, `npx skills add remotion-dev/skills`) e um plugin oficial de Claude Code no monorepo. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/ai/skills |

---

## 2. Detalhe por claim

### R01-01 — Remotion não é open-source, é source-available sob licença proprietária

- **Verdade operacional:** o código está público no GitHub e isso engana. A FAQ oficial nega
  explicitamente a condição de open-source. Não existe fork legítimo, nem "usar a versão MIT",
  nem vendoring do renderer para escapar do gatilho de licença.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md | head -40`
  e `curl -s https://registry.npmjs.org/remotion/latest | jq -r .license`
- **O que quebra se divergir:** o card de bootstrap do projeto e qualquer card que assuma
  redistribuição do bundle. Se alguém "descobrir" uma licença OSI, é fork não-oficial — o gate
  de aceite deve exigir que `node_modules/remotion/package.json` traga
  `"license": "SEE LICENSE IN LICENSE.md"`.
- **Fontes:**
  - https://www.remotion.dev/docs/license/faq (primária) — verbatim: *"No. Remotion is
    source-available software, but it is not open-source software according to the Open Source
    Initiative's Open Source Definition. The Remotion source code is publicly available, but its
    use is governed by the proprietary Remotion License, which includes conditions that are not
    part of OSI-approved open-source licenses."*
  - https://github.com/remotion-dev/remotion/blob/main/LICENSE.md (primária) — o arquivo é uma
    licença própria; linha de copyright verbatim: *"Copyright © 2026 Remotion"*.
  - https://registry.npmjs.org/remotion/latest (primária) — `"license": "SEE LICENSE IN LICENSE.md"`,
    ou seja, o npm não carrega identificador SPDX de licença livre.
  - https://github.com/remotion-dev/remotion (primária, README) — verbatim: *"Be aware of that
    Remotion has a special license and requires obtaining a company license in some cases."*

### R01-02 — Empresa com fins lucrativos e mais de 3 empregados precisa de licença paga

- **Verdade operacional:** este é o claim que decide o projeto. O texto legal vigente
  (`LICENSE.md`, linha 4.x) lista quem pode usar de graça e a única entrada corporativa é
  *"a for-profit organization with up to 3 employees"*. Uma empresa grande **não é elegível à
  Free License**, mesmo que só uma pessoa escreva o código Remotion.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md | grep -n -A6 "eligible to use Remotion for free"`
- **O que quebra se divergir:** todos os cards. Se o gatilho for a organização (leitura vigente),
  o projeto **nasce** com dependência de contrato comercial e o card zero é "obter licença ou
  obter decisão formal do dono". Se for só quem opera (leitura 5.0), o projeto pode rodar sob
  Free License com 1-3 operadores. As duas leituras produzem programas diferentes — ver R01-03.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/LICENSE.md (primária) — verbatim:
    *"You are eligible to use Remotion for free if you are: an individual / a for-profit
    organization with up to 3 employees / a non-profit or not-for-profit organization /
    evaluating whether Remotion is a good fit, and are not yet using it in a commercial way"*
    e *"You are required to obtain a Company License to use Remotion if you are not within the
    group of entities eligible for a Free License."*
  - https://www.remotion.dev/docs/license/faq (primária) — verbatim: *"You are eligible to use
    Remotion for free if you are: an individual; an organization or team of individuals with up
    to 3 people; a non-profit or not-for-profit organization; evaluating whether the Remotion
    Software is a good fit, and are not yet using it in a commercial way."*
  - https://www.remotion.pro/license (primária) — Free License: *"For individuals and companies
    of up to 3 people"*; Company License: *"For collaborations and companies of 4+ people"*.

### R01-03 — O critério de contagem diverge entre a licença vigente e os Terms do 5.0

- **Verdade operacional:** duas frases oficiais, dois gatilhos diferentes.
  **Vigente (4.x):** *"a for-profit organization with up to 3 employees"* — conta empregados da
  organização.
  **Futuro (5.0):** *"A license is mandatory when the total number of personnel across all
  involved parties that operate the Remotion Software reaches the threshold of four or more."*
  — conta quem **opera** o software. E ainda: *"For the Company License under the Remotion for
  Creators option, a Seat is only required for those individuals, across all involved parties,
  who are directly engaged in the project using the Remotion Software."*
  Não é possível deduzir qual vale para nós sem decisão jurídica: os próprios Terms declaram
  *"These Terms and Conditions will take effect upon the release of Remotion 5.0 and will apply
  to version 5.0 and all subsequent versions."*
- **Como reconferir:** abrir https://www.remotion.dev/docs/license/terms e
  https://github.com/remotion-dev/remotion/blob/main/LICENSE.md **lado a lado** e comparar as
  duas frases acima palavra a palavra. Ambas mudam sem aviso.
- **O que quebra se divergir:** o card zero (aquisição de licença) e o gate de compliance do
  release. Uma leitura errada aqui é a única falha deste cluster que não aparece em teste — só
  aparece no jurídico.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/LICENSE.md (primária) — conta *employees*;
    primeira linha do arquivo, verbatim: *"In Remotion 5.0, the license will slightly change."*
  - https://www.remotion.dev/docs/license/terms (primária) — conta *personnel that operate the
    Remotion Software*; declara vigência a partir do 5.0.
  - Nota: as duas não se contradizem no tempo (uma sucede a outra), mas **contradizem-se hoje**
    para quem precisa decidir agora, porque o produto instalado é 4.0.507 e a página pública de
    Terms já descreve o regime 5.0.

### R01-04 — Tiers e preços publicados

- **Verdade operacional:** três produtos, dois eixos de cobrança.
  **Remotion for Creators:** US$ 25 por Seat/mês, sem número mínimo de Seats e sem Minimum
  Spend quando comprado sozinho. Um Seat = uma pessoa que escreve código Remotion **ou usa
  ferramentas de codificação agênticas** — a FAQ inclui agentes de IA no cômputo do Seat da
  pessoa, não como licença separada.
  **Remotion for Automators:** US$ 0,01 por Render, com Minimum Spend de US$ 100/mês
  (≈ 10.000 renders inclusos no piso).
  **Enterprise:** a partir de US$ 500/mês, com Editor Starter incluído, Slack/Discord privado,
  sessão mensal de consultoria e termos customizados.
  Combinando Creators + Automators, o Minimum Spend é US$ 100/mês.
- **Como reconferir:** abrir https://www.remotion.pro/license (a página
  `remotion.dev/docs/license/pricing` é só um componente `<Pricing />` e **não** serve preço em
  HTML estático — não use ela para verificação automatizada).
- **O que quebra se divergir:** o card de orçamento e o desenho do pipeline. A diferença entre
  US$ 25/mês e US$ 100/mês de piso é o que decide se o gerador roda como automação servidora ou
  como ferramenta de autor local.
- **Fontes:**
  - https://www.remotion.pro/license (primária) — *"$25/mo per seat"*, *"$0.01 per render,
    $100/mo minimum"*, *"Starting at $500 per month"*, *"$250 Mux credits"*.
  - https://www.remotion.dev/docs/license/faq + /docs/license/terms (primária, mesmo domínio =
    1 fonte) — *"$25 per Seat per month, with no minimum number of Seats and no Minimum Spend
    when purchased alone"*; *"$0.01 per Render, with a Minimum Spend of $100 per month"*;
    *"A Seat covers one person who writes Remotion code themselves or uses agentic coding tools"*.

### R01-05 — Não há diferença de funcionalidade entre free e pago

- **Verdade operacional:** não existe feature-gate no software. Nada no código muda ao comprar.
  Isso tem uma consequência incômoda: **não existe sinal técnico de não-conformidade** — o
  sistema roda igual licenciado ou não. Compliance aqui é decisão, não teste.
- **Como reconferir:** https://www.remotion.dev/docs/license/faq, pergunta *"What is the
  difference in functionality between the free and paid version?"*.
- **O que quebra se divergir:** o gate de compliance. Se algum dia houver feature-gate, o gate
  passa a ser executável (hoje não pode ser).
- **Fontes:**
  - https://www.remotion.dev/docs/license/faq (primária) — verbatim: *"There is no difference
    between the free and paid version. We discriminate the price of the same software for
    various users: Remotion is free for individuals and small organizations, but paid for
    bigger organizations."*
  - https://www.remotion.pro/license (primária) — o tier Free lista *"Create and automate"*,
    *"Commercial use allowed"*, *"Unlimited use"*; o pago adiciona apenas serviços
    (*"Prioritized Support"*, créditos Mux), não funcionalidade.

### R01-06 — Uso comercial amplo permitido; proibido é revender o Remotion

- **Verdade operacional:** vídeo institucional, marketing, treinamento interno, entrega para
  cliente — tudo cabe. A cerca é sobre o produto Remotion em si, não sobre o vídeo produzido.
- **Como reconferir:** `grep -n "commercial use" ` na FAQ e a cláusula de restrição do
  `LICENSE.md`.
- **O que quebra se divergir:** o card de publicação/distribuição dos vídeos gerados e qualquer
  card que embuta o Studio num produto entregue a terceiros.
- **Fontes:**
  - https://www.remotion.dev/docs/license/faq (primária) — verbatim: *"Any commercial use case
    is allowed as long as you are not selling Remotion as a product itself or allowing people to
    circumvent cases where they would have to buy a license themselves."*
  - https://github.com/remotion-dev/remotion/blob/main/LICENSE.md (primária) — proibido
    *"copy or modify Remotion code for the purpose of selling, renting, licensing, relicensing,
    or sublicensing your own derivate of Remotion"*; permitido *"use the software
    non-commercially or commercially for the purpose of creating videos and images and to modify
    the software to their own liking"*.
  - https://www.remotion.pro/license (primária) — *"Commercial use allowed"* já no tier Free.

### R01-07 — Gerar código Remotion com LLM em nome do usuário é permitido; receber código do usuário não é

- **Verdade operacional:** esta é a cláusula que cerca exatamente a arquitetura deste projeto.
  Permitido: um serviço que **gera** código Remotion por IA e renderiza; o usuário pode até
  editar o código gerado. Proibido: o usuário **trazer/subir** o projeto Remotion dele para o
  seu servidor renderizar. A fronteira é "de quem é o código", não "quem apertou o botão".
- **Como reconferir:** https://www.remotion.dev/docs/license/faq, pergunta *"Can I use an LLM to
  generate Remotion code on behalf of a user?"*.
- **O que quebra se divergir:** o card de "entrada do usuário". Se o produto algum dia aceitar
  um `.tsx` de composição vindo de fora, ele cruza a cerca. O gate correspondente é uma asserção
  no ingestor: nenhuma fonte TSX externa entra no bundle de render.
- **Fontes:**
  - https://www.remotion.dev/docs/license/faq (primária) — *"it is allowed to build a service
    that generates Remotion code using artificial intelligence"* e *"it is not allowed to let
    users bring or upload their own Remotion code to your service for rendering"*.
  - **Fonte única.** Não achei segundo documento com função distinta que repita a regra;
    `LICENSE.md` e `remotion.pro/license` não a mencionam. Vai para PERGUNTA-DONO (jurídico).

### R01-08 — A definição de "automation" inclui `npx remotion render` e `<Player>`

- **Verdade operacional:** a FAQ enumera os gatilhos de automação:
  `renderMedia()`, `renderStill()`, `renderFrames()`, `renderMediaOnLambda()`,
  `renderStillOnLambda()`, `renderMediaOnCloudrun()`, `renderStillOnCloudrun()`,
  `renderMediaOnVercel()`, `renderStillOnVercel()`, `renderMediaOnWeb()`, `renderStillOnWeb()`,
  `npx remotion render`, `npx remotion still`, `npx remotion lambda render`,
  `npx remotion lambda still`, `npx remotion cloudrun render`, `npx remotion cloudrun still`,
  `<Player>`.
  O item que surpreende é `<Player>`: **embutir o player num produto conta como automação**,
  mesmo sem render. E `npx remotion render` — o comando central deste projeto — está na lista.
  1 Render é definido como *"the successful generation of a video, audio, GIF, PDF or still
  image"*; previews do Studio e do Player **não** contam.
- **Como reconferir:** https://www.remotion.dev/docs/license/faq, perguntas *"What is considered
  an automation?"* e *"How is 1 Render defined?"*.
- **O que quebra se divergir:** o desenho da UI. Se o editor local expuser `<Player>`, ele já
  é automação pela letra do texto — o que empurra para o tier Automators (piso US$ 100/mês)
  em vez de Creators (US$ 25/Seat).
- **Fontes:**
  - https://www.remotion.dev/docs/license/faq (primária) — lista enumerada acima, colhida
    literalmente da página. **Fonte única.**

### R01-09 — A FAQ se contradiz para o caso "render local automatizado de baixo volume"

- **Verdade operacional:** duas afirmações da **mesma** página apontam para tiers diferentes
  no nosso cenário exato (agentes locais chamando `npx remotion render` algumas dezenas de
  vezes por dia):
  1. *"Low-volume video production, such as rendering locally or one-off renders on a server,
     fall under the Remotion for Creators option and do not require purchasing Renders."*
     → Creators, US$ 25/Seat/mês.
  2. *"An automation is defined as owning code that programmatically calls …
     `npx remotion render` …"* → Automators, US$ 0,01/Render com piso de US$ 100/mês.
  Um pipeline dirigido por agente é literalmente "código que chama programaticamente
  `npx remotion render`", e ao mesmo tempo é literalmente "render local de baixo volume".
  Não há como escolher por dedução.
- **Como reconferir:** ler as duas respostas na mesma página e confirmar que a tensão persiste;
  se o texto for reescrito, o claim morre.
- **O que quebra se divergir:** a linha de orçamento (US$ 25 vs US$ 100 de piso mensal) e a
  necessidade — ou não — de instrumentar contagem de renders no pipeline desde o card 1.
- **Fontes:**
  - https://www.remotion.dev/docs/license/faq (primária, ambas as frases). Placar (1-1): a
    contradição é **interna à fonte**, não entre fontes. Vira PERGUNTA-DONO.

### R01-10 — Versão estável corrente: 4.0.507

- **Verdade operacional:** `dist-tags` do npm em 2026-08-10: `latest = 4.0.507`,
  `canary = 4.0.0-alpha.217`, `alpha = 4.1.0-alpha12`. Todos os pacotes do monorepo publicam
  em lockstep: `remotion`, `@remotion/cli`, `@remotion/renderer`, `@remotion/player`,
  `@remotion/effects`, `@remotion/sfx` e `create-video` estão todos em 4.0.507.
  A tag `v4.0.507` no GitHub aparece como publicada em **7 de agosto** (o ano não é renderizado
  pelo GitHub para releases do ano corrente — ver R01-26 no LEDGER-SEED).
  Cadência observada: 10 releases entre 23 de julho e 7 de agosto — **quase diária**.
- **Como reconferir:**
  `curl -s https://registry.npmjs.org/remotion | jq -r '."dist-tags"'`
- **O que quebra se divergir:** o lockfile e qualquer fixture que grave saída de `--version`.
  Com cadência diária, um card que diz "usar a última" produz builds não reproduzíveis entre
  worktrees paralelas.
- **Fontes:**
  - https://registry.npmjs.org/remotion/latest (primária) — `"version": "4.0.507"`.
  - https://github.com/remotion-dev/remotion/releases (primária) — v4.0.507 no topo.
  - https://www.remotion.dev/changelog **redireciona (307)** para a página de releases do
    GitHub — não é fonte separada.

### R01-11 — Remotion 5.0 ainda não existe

- **Verdade operacional:** o 5.0 é um plano, não um produto. Isso significa que (a) a licença
  vigente é a do `LICENSE.md` atual, (b) os Terms publicados descrevem um regime futuro, e
  (c) o conjunto de breaking changes ainda pode mudar — a própria página diz que a lista é
  incompleta.
- **Como reconferir:**
  `curl -s https://registry.npmjs.org/remotion | jq -r '."dist-tags".latest'` → deve começar com `4.`
- **O que quebra se divergir:** todo o cluster. No dia que 5.0 sair, R01-03, R01-14, R01-15 e
  R01-04 mudam juntos. Este é o evento de re-pesquisa obrigatória do cluster.
- **Fontes:**
  - https://www.remotion.dev/docs/5-0-migration (primária) — verbatim: *"Remotion 5.0 is not yet
    released. This is an incomplete list of breaking changes that are planned for the release."*
  - https://github.com/remotion-dev/remotion/blob/main/LICENSE.md (primária) — primeira linha:
    *"In Remotion 5.0, the license will slightly change."* (futuro).
  - https://registry.npmjs.org/remotion (primária) — nenhuma tag 5.x em `dist-tags`.

### R01-12 — A linha 4 é patch-only: 4.0.0 → 4.0.507, sem minor

- **Verdade operacional:** "semver" no Remotion significa, na prática, que **tudo** é patch.
  Não existe 4.1.0 estável — só `4.1.0-alpha12` na tag `alpha`. A consequência prática:
  `^4.0.0` e `~4.0.507` capturam faixas radicalmente diferentes, e `~` é o único que dá
  reprodutibilidade útil. Um `^4.0.0` num `package.json` de worktree pode instalar uma versão
  publicada horas depois da worktree irmã.
- **Como reconferir:**
  `curl -s https://registry.npmjs.org/remotion | jq -r '.versions | keys[]' | grep -E '^4\.[1-9]' | grep -v alpha`
  (saída vazia = claim vale)
- **O que quebra se divergir:** o card de setup e o gate de reprodutibilidade entre worktrees.
  Se aparecer 4.1.x estável, a política de pin precisa mudar de `~4.0.x` para pin exato.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/releases (primária) — tags consecutivas
    v4.0.498…v4.0.507, todas patch.
  - https://registry.npmjs.org/remotion (primária) — `dist-tags` sem minor estável;
    `alpha = 4.1.0-alpha12` fora do canal `latest`.

### R01-13 — Política de breaking changes: semver por major, exceto APIs experimentais

- **Verdade operacional:** *"Remotion follows semantic versioning. This means if the first
  number of the version is the same, you can upgrade and your code is backwards-compatible."*
  Exceção declarada: *"Exceptions to the breaking change rule are APIs that are marked as
  experimental."* Comando oficial de upgrade: `npx remotion upgrade`.
  Combinado com R01-12, a promessa cobre 507 releases seguidas — o que é forte, mas é
  **promessa de fornecedor**, não um invariante testado por nós.
- **Como reconferir:** https://www.remotion.dev/docs/upgrading — procurar as duas frases.
- **O que quebra se divergir:** a decisão de permitir `npx remotion upgrade` automático em CI.
  Se a promessa falhar uma vez, todo card que dependa de API não-experimental precisa de pin.
- **Fontes:**
  - https://www.remotion.dev/docs/upgrading (primária). **Fonte única** — não achei segundo
    documento com função distinta que declare a política. Vira LEDGER-SEED: o teste real é
    rodar o pipeline contra duas versões e comparar a saída.

### R01-14 — O 5.0 remove pacotes que hoje parecem escolhas seguras

- **Verdade operacional:** a página de migração do 5.0 lista como **removidos**:
  `@remotion/light-leaks` (usar `@remotion/effects`), `@remotion/starburst` (usar
  `@remotion/effects`), `@remotion/media-parser` (usar Mediabunny) e `@remotion/webcodecs`
  (usar Mediabunny). Outras mudanças planejadas relevantes para render determinístico:
  `colorSpace` passa a `"bt709"` (era `"bt601"`), sequências passam a fazer premount de 1s por
  padrão, WebGL/WebGPU habilitados por padrão (`angle` com fallback `swangle`), telemetria
  obrigatória para o tier Automators, e contractors passam a contar no tamanho do time.
- **Como reconferir:** https://www.remotion.dev/docs/5-0-migration (a lista é declaradamente
  incompleta — reler a cada release candidate).
- **O que quebra se divergir:** qualquer card que escolha `@remotion/media-parser` ou
  `@remotion/webcodecs` como base de análise de mídia. A mudança de `colorSpace` quebra
  fixtures de comparação de frames — é falso vermelho garantido na migração.
- **Fontes:**
  - https://www.remotion.dev/docs/5-0-migration (primária). **Fonte única**; corroboração
    parcial em https://www.remotion.dev/docs/effects/api (mesmo domínio) que confirma
    `@remotion/effects` existindo desde **v4.0.464**.

### R01-15 — Node mínimo: ≥ 16 na linha 4.x (Bun ≥ 1.0.3); 18.0.0 no 5.0

- **Verdade operacional:** o `package.json` da raiz do monorepo declara
  `"engines": { "node": ">=16" }` e `"packageManager": "bun@1.3.3"`. A doc diz *"To use
  Remotion, you need at least Node 16 or Bun 1.0.3"* e o guia de migração do 4.0 diz *"The
  minimum Node version is now 16.0.0."*. Na prática o fornecedor testa em **Node 22**: tanto o
  Dockerfile recomendado quanto os Dockerfiles do repositório usam `node:22-bookworm-slim`.
  Node 16 é o mínimo legal; Node 22 é o caminho batido.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/package.json | jq .engines`
  e `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/dockerfiles/Dockerfile.debian | head -3`
- **O que quebra se divergir:** o card de setup do ambiente e o `.nvmrc` do projeto. Escolher
  Node 16 porque "é o mínimo" é escolher a configuração menos testada pelo fornecedor.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/package.json (primária) —
    `"engines": {"node": ">=16"}`, `"packageManager": "bun@1.3.3"`.
  - https://www.remotion.dev/docs (primária) — *"To use Remotion, you need at least Node 16 or
    Bun 1.0.3."*; https://www.remotion.dev/docs/5-0-migration (mesmo domínio) — mínimo sobe
    para 18.0.0 no 5.0.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/dockerfiles/Dockerfile.debian
    (primária, artefato executável) — `node:22-bookworm-slim`.

### R01-16 — Os pacotes publicados não declaram `engines`

- **Verdade operacional:** o `engines: {node: ">=16"}` está no `package.json` **da raiz do
  monorepo**, que não é publicado. Os manifests publicados de `remotion`, `@remotion/cli`,
  `@remotion/renderer`, `@remotion/player` e `create-video` (todos 4.0.507) **não** trazem
  `engines`. Consequência: `npm install` num Node 14 não emite `EBADENGINE` — a falha só
  aparece em runtime, provavelmente como erro obscuro do compositor nativo.
- **Como reconferir:**
  `curl -s https://registry.npmjs.org/remotion/latest | jq '.engines // "ausente"'`
- **O que quebra se divergir:** o gate de ambiente. Como o gerenciador não protege, o projeto
  precisa de uma verificação própria de versão de Node no bootstrap — não dá para delegar.
- **Fontes:**
  - https://registry.npmjs.org/… (primária) — quatro manifests verificados, nenhum com `engines`.
    **Fonte única** (um registro).

### R01-17 — Requisitos de sistema operacional

- **Verdade operacional:** plataformas suportadas: **Windows x64**, **macOS**, **Linux**
  (do guia 4.0: *"Only the following platforms are supported: Windows (x64 only), macOS,
  Linux."*). Restrições: **macOS 15 (Sequoia) ou superior** — *"Older versions are not
  supported."*; **Linux com glibc ≥ 2.35** — *"Linux distros with glibc need to have at least
  version 2.35."*. **Alpine Linux e NixOS não são suportados**: Alpine por faltar símbolos da
  libc, NixOS por conflito com a arquitetura imutável.
  Contraste relevante: o repositório **tem** `packages/dockerfiles/Dockerfile.nix` e
  `remotion.nix`, ou seja, existe trabalho de compatibilidade Nix apesar da doc dizer que não
  é suportado — não trate a presença desses arquivos como suporte.
- **Como reconferir:** `ldd --version` na máquina alvo (precisa ≥ 2.35) e
  https://www.remotion.dev/docs/miscellaneous/linux-dependencies para a lista de distros.
- **O que quebra se divergir:** o card de ambiente e a escolha de imagem base de container.
  Alpine é a escolha instintiva para imagem pequena e é exatamente a que não funciona.
- **Fontes:**
  - https://www.remotion.dev/docs/4-0-migration + /docs + /docs/miscellaneous/linux-dependencies
    (primária, mesmo domínio = **1 fonte**).
  - https://github.com/remotion-dev/remotion/tree/main/packages/dockerfiles (primária) —
    a existência de `Dockerfile.al2023`, `Dockerfile.debian`, `Dockerfile.nix`,
    `Dockerfile.ubuntu22`, `Dockerfile.ubuntu24` documenta quais alvos o fornecedor exercita.

### R01-18 — As 14 bibliotecas de sistema exigidas em Debian/Ubuntu

- **Verdade operacional:** sem elas o Chrome Headless Shell não sobe e o render falha com erro
  de biblioteca compartilhada, não com erro de Remotion. Lista Debian (idêntica no Dockerfile
  do repositório e na doc):
  `libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev libxfixes3
  libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2`.
  **Ubuntu 24.04 e 22.04 trocam `libasound2` por `libasound2t64`** — este é o detalhe que
  quebra um `apt install` copiado da página errada. Amazon Linux 2023 usa `yum` com nomes
  totalmente diferentes (`mesa-libgbm`, `nss`, `cups-libs`, `at-spi2-core`, `alsa-lib`…).
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/dockerfiles/Dockerfile.debian`
  e https://www.remotion.dev/docs/miscellaneous/linux-dependencies
- **O que quebra se divergir:** o card de provisionamento de máquina/worktree e o primeiro
  render de fumaça. Como o projeto roda **localmente**, esse é o primeiro ponto de falha real.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/dockerfiles/Dockerfile.debian
    (primária, artefato executável) — lista idêntica + `git curl unzip`.
  - https://www.remotion.dev/docs/miscellaneous/linux-dependencies (primária) — variantes por
    distro, incluindo `libasound2t64` no Ubuntu 22/24 e a nota de não-suporte a Alpine/NixOS.

### R01-19 — Chrome Headless Shell é baixado automaticamente

- **Verdade operacional:** *"Remotion is automatically installing 'Chrome Headless Shell' into
  your `node_modules` in order to render videos."* Destino:
  `node_modules/.remotion/chrome-headless-shell/[platform]/chrome-headless-shell-[platform]`.
  Introduzido em **v4.0.247**; versão fixada **149.0.7790.0** a partir de **v4.0.452**.
  Alternativa "Chrome for Testing" (mais rápido para render GPU-bound) via
  `--chrome-mode="chrome-for-testing"` (CLI), `chromeMode: 'chrome-for-testing'` (API) ou
  `Config.setChromeMode('chrome-for-testing')` (`remotion.config.ts`).
- **Como reconferir:** após `npm i`, `ls node_modules/.remotion/chrome-headless-shell/` e
  https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell
- **O que quebra se divergir:** o tamanho e o tempo de bootstrap de **cada worktree paralela** —
  se cada worktree tiver seu próprio `node_modules`, cada uma baixa um Chrome. Isso é uma
  decisão de arquitetura de worktrees (ver R15), não um detalhe.
- **Fontes:**
  - https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell (primária).
    **Fonte única** — os nomes de flag acima não foram cruzados com uma segunda fonte de função
    distinta; confirmar com `npx remotion render --help` antes de gravar em card.

### R01-20 — FFmpeg vem embutido no `@remotion/renderer`

- **Verdade operacional:** *"FFmpeg is now baked into the `@remotion/renderer` package."* — não
  há passo de instalação de FFmpeg para o render do Remotion. O `@remotion/renderer` publica
  binários nativos por plataforma como `optionalDependencies`
  (`compositor-darwin-arm64`, `compositor-darwin-x64`, `compositor-linux-x64-gnu`,
  `compositor-linux-x64-musl`, `compositor-linux-arm64-gnu`, `compositor-linux-arm64-musl`,
  `compositor-win32-x64-msvc`, todos em 4.0.507).
  **Escopo:** isso cobre o render do Remotion. Se o pipeline usar FFmpeg para concatenar,
  extrair áudio ou converter entradas (Manim, TTS), esse FFmpeg é externo e é problema do R10.
- **Como reconferir:**
  `curl -s https://registry.npmjs.org/@remotion/renderer/latest | jq '.optionalDependencies'`
- **O que quebra se divergir:** o card de setup (um passo a menos) e a suposição de que "existe
  um ffmpeg no PATH" — não existe necessariamente.
- **Fontes:**
  - https://www.remotion.dev/docs/4-0-migration (primária) — frase do FFmpeg embutido.
  - https://registry.npmjs.org/@remotion/renderer/latest (primária) — `optionalDependencies` com
    os sete compositors nativos, e descrição *"Render Remotion videos using Node.js or Bun"*.

### R01-21 — Todos os 30 pacotes citados no panorama existem

- **Verdade operacional:** a referência de API oficial lista **41** pacotes. Os 30 citados no
  panorama estão todos presentes (29 na lista de referência + `@remotion/cli`, que é documentado
  em `/docs/cli` e existe no npm em 4.0.507).
  **Lista oficial de referência (41):** `@remotion/animated-emoji`, `@remotion/animation-utils`,
  `@remotion/bundler`, `@remotion/captions`, `@remotion/cloudrun`, `@remotion/elevenlabs`,
  `@remotion/enable-scss`, `@remotion/fonts`, `@remotion/gif`, `@remotion/google-fonts`,
  `@remotion/install-whisper-cpp`, `@remotion/lambda`, `@remotion/layout-utils`,
  `@remotion/licensing`, `@remotion/light-leaks`, `@remotion/lottie`, `@remotion/media`,
  `@remotion/media-parser`, `@remotion/media-utils`, `@remotion/motion-blur`, `@remotion/noise`,
  `@remotion/openai-whisper`, `@remotion/paths`, `@remotion/player`, `@remotion/preload`,
  `@remotion/renderer`, `@remotion/rive`, `@remotion/rough-notation`, `@remotion/sfx`,
  `@remotion/shapes`, `@remotion/skia`, `@remotion/starburst`, `@remotion/studio`,
  `@remotion/studio-protocol`, `@remotion/tailwind`, `@remotion/tailwind-v4`, `@remotion/three`,
  `@remotion/transitions`, `@remotion/vercel`, `@remotion/webcodecs`, `@remotion/zod-types`.
  **Existem e não estão nessa lista:** `@remotion/cli` (documentado em `/docs/cli`),
  `@remotion/effects` (desde v4.0.464), `@remotion/web-renderer` (citado na doc de
  `@remotion/licensing`), além de pastas do monorepo como `mcp`, `convert`, `serverless`,
  `streaming`, `eslint-plugin`, `babel-loader`, `claude-code-plugin`, `codex-plugin`, `skills`.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/docs/components/TableOfContents/api.tsx | grep -o '@remotion/[a-z0-9-]*' | sort -u`
  (a página https://www.remotion.dev/docs/api renderiza esse componente e **não serve** a lista
  em HTML estático — não use a URL para verificação automatizada)
- **O que quebra se divergir:** todo card que importe um pacote. Um import de pacote inexistente
  é falha de build imediata (barato); um import de pacote **marcado para remoção no 5.0**
  (R01-14) é falha diferida (caro).
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/docs/components/TableOfContents/api.tsx
    (primária) — a lista de 41.
  - https://github.com/remotion-dev/remotion/tree/main/packages (primária) — pastas do monorepo,
    incluindo `sfx`, `effects`, `mcp`, `skills`, `claude-code-plugin`.
  - https://registry.npmjs.org/@remotion/cli/latest (primária) — existe, 4.0.507, bin
    `remotion`/`remotionb`/`remotiond`.

### R01-22 — `@remotion/sfx` existe

- **Verdade operacional:** o pacote é real: npm `@remotion/sfx@4.0.507`, descrição
  *"Sound effect library"*, pasta `packages/sfx` no monorepo, e consta na referência de API.
  Se o panorama listou `@remotion/sfx` como suspeito de invenção, o suspeito estava certo o
  tempo todo.
- **Como reconferir:** `curl -s https://registry.npmjs.org/@remotion/sfx | jq -r '."dist-tags".latest'`
- **O que quebra se divergir:** o card de trilha sonora/efeitos. Se o pacote não existisse, o
  card viria com uma dependência externa desnecessária.
- **Fontes:**
  - https://registry.npmjs.org/@remotion/sfx (primária) — existe, 4.0.507.
  - https://github.com/remotion-dev/remotion/tree/main/packages (primária) — pasta `sfx`.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/docs/components/TableOfContents/api.tsx
    (primária) — listado na referência.

### R01-23 — O campo `license` no npm é inconsistente e não serve de prova

- **Verdade operacional:** três pacotes do **mesmo** monorepo declaram três coisas diferentes:
  `remotion` → `"SEE LICENSE IN LICENSE.md"`; `@remotion/sfx` → `"MIT"`;
  `@remotion/effects` → `"UNLICENSED"`. Nenhum scanner de licença (SCA) vai produzir a resposta
  certa a partir desses metadados. O documento que governa é o `LICENSE.md` do repositório.
- **Como reconferir:**
  `for p in remotion @remotion/sfx @remotion/effects @remotion/renderer; do echo -n "$p "; curl -s "https://registry.npmjs.org/$p/latest" | jq -r .license; done`
- **O que quebra se divergir:** o gate de compliance automatizado. Se o programa adotar um
  scanner de licenças, ele vai relatar "MIT" para parte do Remotion e isso é **falso verde**.
- **Fontes:**
  - https://registry.npmjs.org/… (primária, um registro = **1 fonte**). Quatro manifests
    verificados individualmente.

### R01-24 — Editor Starter é produto pago à parte (US$ 600)

- **Verdade operacional:** template pago de editor de vídeo, US$ 600, incluído no tier
  Enterprise. A página de compra **não** afirma que ele dispensa a Company License. Relevante
  aqui porque o projeto é justamente "um editor" — vale saber que existe uma base pronta.
- **Como reconferir:** https://www.remotion.dev/docs/editor-starter/buy
- **O que quebra se divergir:** a decisão build-vs-buy do editor. Se o Enterprise já inclui, a
  conta muda.
- **Fontes:**
  - https://www.remotion.dev/docs/editor-starter/buy (primária) — *"$600"*, *"The Editor Starter
    is included in the Enterprise License."* **Fonte única**; https://www.remotion.pro/license
    corrobora o "incluído no Enterprise" mas é o mesmo fornecedor em outra página comercial.

### R01-25 — Existe pacote oficial de Agent Skills e plugin de Claude Code

- **Verdade operacional:** 12 skills oficiais publicadas para agentes de código:
  `/remotion-best-practices`, `/remotion-create`, `/remotion-markup`, `/remotion-studio`,
  `/remotion-render`, `/remotion-maps`, `/remotion-captions`, `/remotion-saas`,
  `/remotion-interactivity`, `/remotion-docs`, `/remotion-upgrade`, `/remotion-multimedia`.
  Instalação documentada: `npx skills add remotion-dev/skills`. O monorepo tem
  `packages/skills`, `packages/claude-code-plugin`, `packages/codex-plugin`, `packages/mcp`.
  **Escopo:** isto é um insumo direto para o contrato de skills deste projeto (S09/S10) — o
  fornecedor já publicou conhecimento estruturado que pode ser lido antes de reescrever.
- **Como reconferir:** https://www.remotion.dev/docs/ai/skills e
  https://github.com/remotion-dev/remotion/tree/main/packages (pastas `skills`, `mcp`,
  `claude-code-plugin`).
- **O que quebra se divergir:** os cards das skills `remotion-core` e
  `remotion-render-pipeline` — se as skills oficiais cobrem X, a nossa skill deve conter só o
  delta, não repetir X.
- **Fontes:**
  - https://www.remotion.dev/docs/ai/skills (primária) — lista das 12 e o comando.
  - https://github.com/remotion-dev/remotion/tree/main/packages (primária) — as pastas existem.

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| `@remotion/sfx` não existe / é nome inventado | REFUTADO | Existe: npm `@remotion/sfx@4.0.507`, *"Sound effect library"*, pasta `packages/sfx`, listado na referência de API oficial | https://registry.npmjs.org/@remotion/sfx |
| Remotion é open-source / dá para usar como projeto livre | REFUTADO | A FAQ oficial nega literalmente: *"No. Remotion is source-available software, but it is not open-source software according to the Open Source Initiative's Open Source Definition."* Não existe alternativa de licença OSI para o Remotion | https://www.remotion.dev/docs/license/faq |
| Basta ter ≤3 pessoas mexendo no Remotion para a empresa usar de graça | REFUTADO (para a licença **vigente**) | O `LICENSE.md` da linha 4.x qualifica *"a for-profit organization with up to 3 employees"* — o gatilho é o tamanho da organização, não o número de operadores. A leitura "só quem opera" só aparece nos Terms que entram em vigor **no 5.0**, ainda não lançado | https://github.com/remotion-dev/remotion/blob/main/LICENSE.md |
| A versão paga tem recursos que a gratuita não tem | REFUTADO | *"There is no difference between the free and paid version."* O que o pago adiciona é serviço (suporte priorizado, créditos Mux), não funcionalidade | https://www.remotion.dev/docs/license/faq |
| É preciso instalar FFmpeg para renderizar com Remotion | REFUTADO | *"FFmpeg is now baked into the `@remotion/renderer` package."* desde o 4.0; binários nativos vêm como `optionalDependencies` por plataforma | https://www.remotion.dev/docs/4-0-migration |
| Dá para rodar o render em Alpine (imagem pequena) | REFUTADO | A doc oficial declara Alpine e NixOS incompatíveis; Alpine por falta de símbolos da libc | https://www.remotion.dev/docs/miscellaneous/linux-dependencies |
| Remotion 5.0 já saiu / a licença nova já vale | REFUTADO | *"Remotion 5.0 is not yet released."*; `dist-tags.latest = 4.0.507`; os Terms declaram *"will take effect upon the release of Remotion 5.0"* | https://www.remotion.dev/docs/5-0-migration |
| A página `remotion.dev/docs/license/pricing` serve os preços | REFUTADO | A página contém apenas um componente `<Pricing />`; os preços só aparecem renderizados. A fonte estática utilizável é `remotion.pro/license` | https://www.remotion.dev/docs/license/pricing |
| A página `remotion.dev/docs/api` lista os pacotes em HTML | REFUTADO | A página é só um `<TableOfContents />`; a lista está no componente-fonte no repositório | https://www.remotion.dev/docs/api |
| `remotion.dev/changelog` é um changelog próprio | REFUTADO | Responde 307 e redireciona para `github.com/remotion-dev/remotion/releases` | https://www.remotion.dev/changelog |
| `@remotion/media-parser` e `@remotion/webcodecs` são apostas seguras de longo prazo | REFUTADO como "seguras" | Ambos estão na lista de **remoção** planejada para o 5.0, substituídos por Mediabunny (biblioteca de terceiro) | https://www.remotion.dev/docs/5-0-migration |
| Existe pacote `@remotion/captions` só na nuvem / não existe local | REFUTADO | `@remotion/captions` e `@remotion/install-whisper-cpp` estão ambos na referência oficial de API, viabilizando legenda local | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/docs/components/TableOfContents/api.tsx |

---

## 4. Armadilhas (falso verde deste domínio)

- **O repositório está no GitHub e o build passa** → não é prova de licença livre: o produto é
  *source-available* e o gatilho de pagamento é o tamanho da organização, não uma checagem no
  código → fica vermelho se a linha `"license": "SEE LICENSE IN LICENSE.md"` sumir do
  `node_modules/remotion/package.json` (aí é fork, não Remotion).

- **Um scanner de dependências reporta "MIT"** → não é prova: `@remotion/sfx` declara MIT e
  `@remotion/effects` declara UNLICENSED no npm, enquanto o `LICENSE.md` do repositório governa
  os dois → fica vermelho se o gate de compliance parar de citar explicitamente o `LICENSE.md`
  como fonte de verdade.

- **O render funciona na máquina do dono** → não é prova de que funciona nas worktrees
  paralelas: cada `node_modules` baixa seu próprio Chrome Headless Shell, e a versão pinada
  (149.0.7790.0 desde 4.0.452) muda com o Remotion → fica vermelho se o smoke render deixar de
  rodar em worktree recém-criada, do zero, sem cache.

- **`npm install` não reclamou do Node** → não é prova de compatibilidade: nenhum pacote
  publicado declara `engines`, então o npm nunca emite `EBADENGINE`; a falha aparece depois,
  como erro do compositor nativo → fica vermelho se a checagem própria de versão de Node sair
  do bootstrap.

- **O `apt install` da doc funcionou no meu Ubuntu** → não é prova para outra distro: Ubuntu
  22/24 usam `libasound2t64` e as versões anteriores usam `libasound2`; Amazon Linux usa nomes
  completamente distintos → fica vermelho se o provisionamento deixar de casar a lista de
  pacotes com a distro detectada.

- **"Estamos em `^4.0.0`, é semver, está seguro"** → não é prova de reprodutibilidade: a linha 4
  é patch-only com release quase diária, então `^4.0.0` deixa duas worktrees irmãs em versões
  diferentes no mesmo dia → fica vermelho se o lockfile não estiver commitado e compartilhado
  entre worktrees.

- **"Renderizamos localmente, é baixo volume, é Creators"** → não é prova de enquadramento: a
  mesma FAQ define `npx remotion render` chamado por código como *automation* → fica vermelho
  se o pipeline deixar de contar renders (sem contagem não há como demonstrar volume nem
  reagir a uma cobrança por Render).

- **`<Player>` é só preview, não renderiza** → não é prova de estar fora do tier Automators: o
  `<Player>` está explicitamente na lista de automações da FAQ → fica vermelho se a UI local
  passar a embutir `<Player>` sem revisitar o enquadramento de licença.

- **A doc diz que NixOS não é suportado, mas o repo tem `Dockerfile.nix`** → a presença do
  arquivo não é suporte: é banco de teste do fornecedor → fica vermelho se alguém basear o
  ambiente de produção nesse arquivo.

- **Achei a resposta na página de preços da doc** → aquela página não tem preço em HTML; se o
  seu scraper "leu" um preço lá, ele alucinou → fica vermelho se a verificação automatizada de
  preço apontar para `remotion.dev/docs/license/pricing` em vez de `remotion.pro/license`.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| R01-LS-01 | A glibc desta máquina atinge o mínimo de 2.35? | assumir que sim (Linux 6.18, distro recente) | `ldd --version \| head -1` | se < 2.35, o render nunca sobe: o card de ambiente vira "conteinerizar" antes de qualquer outro |
| R01-LS-02 | Quais das 14 libs Chrome já estão instaladas aqui? | instalar a lista completa no bootstrap, idempotente | `for l in libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 libxrandr2 libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2; do ldconfig -p \| grep -q "$l" \|\| echo "FALTA $l"; done` | falta silenciosa ⇒ primeiro render falha com erro de `.so`, não com erro de Remotion — diagnóstico caro |
| R01-LS-03 | `libasound2` ou `libasound2t64` nesta distro? | detectar em runtime, não hardcodar | `apt-cache policy libasound2t64 libasound2 2>/dev/null` | script de provisionamento falha inteiro por um nome de pacote |
| R01-LS-04 | Qual versão de Node está no PATH e ela bate com a política do projeto? | fixar Node 22 (o que o fornecedor testa), não Node 16 (o mínimo legal) | `node -v && cat .nvmrc 2>/dev/null` | comportamento divergente entre worktrees; `engines` não protege (R01-16) |
| R01-LS-05 | Cada worktree paralela baixa seu próprio Chrome Headless Shell? Qual o custo em disco e em tempo de bootstrap? | medir antes de decidir por `node_modules` compartilhado | `du -sh node_modules/.remotion/ && ls node_modules/.remotion/chrome-headless-shell/` | N worktrees × ~centenas de MB; se o custo for alto, a arquitetura de worktrees (R15) muda |
| R01-LS-06 | A promessa de retrocompatibilidade patch-only se sustenta no nosso código? | pinar `~4.0.507` e testar upgrade num branch descartável | `npx remotion upgrade` numa worktree isolada + rodar o render de referência e comparar hash dos frames | se quebrar, `npx remotion upgrade` sai do CI e vira tarefa manual com gate |
| R01-LS-07 | Quantos renders/dia o pipeline realmente faz? | instrumentar contagem desde o card 1, mesmo sem licença paga | contador no wrapper de render, agregado por dia | é o único dado que resolve Creators vs Automators (R01-09) e ele só existe se for coletado desde o início |
| R01-LS-08 | O `licenseKey` é aceito por `renderMedia()` na 4.0.507 e a telemetria é de fato opcional aqui? | assumir opcional na 4.x, obrigatório no 5.0 para Automators | rodar `renderMedia()` sem `licenseKey` e confirmar que completa; a doc afirma *"Telemetry never blocks or fails a render"* | se render passar a falhar sem chave, o gate de render offline quebra |
| R01-LS-09 | `npx remotion render --help` confirma a flag `--chrome-mode`? | assumir que sim (doc), confirmar antes de gravar em card | `npx remotion render --help \| grep -i chrome-mode` | R01-19 é fonte única; nome de flag errado num card = card morto |
| R01-LS-10 | O ano da release v4.0.507 é 2026? | assumir 2026-08-07 | `curl -s https://api.github.com/repos/remotion-dev/remotion/releases/tags/v4.0.507 \| jq -r .published_at` | só afeta a datação do dossiê, não o comportamento — mas uma data errada envelhece o documento em silêncio |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| Este projeto é da empresa (o email corporativo sugere isso) ou é pessoal do dono, fora do escopo de trabalho? | É um fato sobre mandato, não sobre software. O `LICENSE.md` vigente qualifica pela organização (*"a for-profit organization with up to 3 employees"*), e uma empresa grande não é elegível | **Empresa:** Company License obrigatória desde o primeiro render comercial; card zero é jurídico/compras. **Pessoal:** Free License cobre integralmente e o programa começa direto no técnico |
| Se for da empresa: o jurídico lê o gatilho como "empregados da organização" (LICENSE.md 4.x) ou como "pessoal que opera o software" (Terms 5.0)? | Os dois textos são oficiais e dizem coisas diferentes; a escolha é interpretação contratual (R01-03) | Leitura organização ⇒ licença obrigatória independentemente do time. Leitura operadores ⇒ possível operar sob Free License com ≤3 pessoas até o 5.0 sair |
| Se houver licença: Creators (US$ 25/Seat/mês) ou Automators (US$ 0,01/render, piso US$ 100/mês)? | A FAQ se contradiz para o nosso cenário: render local de baixo volume é Creators, mas `npx remotion render` chamado por código é *automation* (R01-09) | Creators ⇒ custo fixo baixo, mas risco de reenquadramento. Automators ⇒ piso de US$ 100/mês e necessidade de contar renders desde o card 1. Enterprise (US$ 500/mês) ⇒ Editor Starter incluído, muda build-vs-buy |
| Contamos com o `<Player>` na interface local do editor? | É escolha de produto, e a FAQ lista `<Player>` como automação (R01-08) — a decisão de UI arrasta a decisão de licença | Com `<Player>` ⇒ enquadramento tende a Automators. Sem ⇒ preview só via Studio, o que é pior de usar mas mais barato de enquadrar |
| O produto vai aceitar código Remotion vindo de fora (usuário/cliente sobe um `.tsx`)? | É decisão de escopo de produto; a FAQ proíbe explicitamente receber projeto Remotion de terceiro para renderizar (R01-07) | Se sim ⇒ viola a licença e precisa de termos customizados (Enterprise). Se não ⇒ o card de ingestão ganha um gate: nenhuma fonte TSX externa entra no bundle |
| Compramos o Editor Starter (US$ 600) ou construímos o editor do zero? | É decisão de orçamento e de apetite por dependência de template de terceiro | Comprar ⇒ menos cards de UI, mas acopla o projeto a um template pago por projeto. Construir ⇒ mais cards, controle total. Enterprise já o inclui |
| Qual a data-limite para re-rodar esta pesquisa? | Cadência de release é quase diária e o 5.0 muda licença, pacotes e Node mínimo de uma vez | Sem data-limite, este dossiê vira folclore. Sugestão: re-rodar quando `dist-tags.latest` deixar de começar com `4.0.` — esse é o evento, não uma data |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** a versão do Remotion. Pinar `remotion` e todo o escopo
  `@remotion/*` em **`4.0.507` exato** (não `^`, não `~`) num único lugar — o `package.json`
  raiz mais o lockfile commitado. Reverter para outra versão é editar **uma linha por pacote em
  um arquivo** e regenerar o lock. Dado que a linha 4 é patch-only com release quase diária
  (R01-12), esse pin é o que impede duas worktrees paralelas de instalarem versões diferentes
  no mesmo dia — o falso vermelho mais provável de toda a onda.

- **Ponto de troca cara (registre agora, não depois):** o enquadramento de licença. Não é
  reversível por código; é contrato. Se o programa começar assumindo Free License e o jurídico
  disser "empresa", o custo não é técnico — é retroativo.

- **Skills que devem carregar este conhecimento:**
  - `remotion-core` (S09) — R01-10, R01-12, R01-13, R01-14, R01-21, R01-22, R01-23 e as
    armadilhas de versionamento e de campo `license`.
  - `remotion-render-pipeline` (S10) — R01-15 a R01-20 e as armadilhas de Chrome Headless
    Shell, libs Linux e FFmpeg embutido.
  - `project-router` (S01) — só o gatilho: "questão de licença Remotion ⇒ não deduza, leia R01
    e escale para PERGUNTA-DONO".
  - Nenhuma skill deve carregar preço ou tier: preço envelhece rápido e a regra 7 do contrato de
    skill proíbe datar o corpo. Preço vive **aqui**, neste dossiê datado.

- **Cards que este cluster condiciona:**
  1. **Card zero, bloqueante:** resolver o enquadramento de licença com o dono antes de
     qualquer render comercial. Saída: uma decisão escrita, não uma dedução.
  2. **Bootstrap de ambiente:** verificar glibc ≥ 2.35, instalar as libs Chrome com nome de
     pacote resolvido por distro, e verificar versão de Node com script próprio (o npm não
     verifica — R01-16).
  3. **Pin de dependências e compartilhamento entre worktrees:** decidir, com medição
     (R01-LS-05), se cada worktree tem `node_modules` próprio ou se há store compartilhado —
     o Chrome baixado por worktree é o custo que decide.
  4. **Wrapper de render com contagem:** todo render passa por um único ponto que conta e
     registra. Sem isso, a pergunta Creators-vs-Automators nunca fecha.
  5. **Gate de ingestão:** asserção de que nenhuma fonte TSX externa entra no bundle de render
     (cerca da R01-07).
  6. **Card de fronteira 5.0:** não usar `@remotion/media-parser` nem `@remotion/webcodecs`
     como base de nada estrutural; preferir `@remotion/media` / `@remotion/effects`, que
     sobrevivem à migração.
  7. **Card de leitura das skills oficiais:** ler `remotion-dev/skills` antes de escrever
     S09/S10, para que as nossas skills contenham só o delta.
