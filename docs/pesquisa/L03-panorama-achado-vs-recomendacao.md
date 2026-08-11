# L03 — Dissecação do panorama: achado × recomendação × alucinação

**Escopo deste cluster:** este é um cluster de **reconhecimento local**. Ele não pesquisa a web,
não abre nenhuma URL e por isso **não fecha placar de corroboração de nada**. Ele faz uma coisa
só: separar fisicamente, dentro do panorama existente, o que é **achado**, o que é
**recomendação** e o que é **afirmação-de-API** — e transformar cada uma numa linha
falsificável endereçada ao cluster de pesquisa que tem de derrubá-la ou confirmá-la.
O que ele **não** faz: dizer se `pushCut()` existe. Isso é trabalho de R02.

> Regra do playbook que este arquivo executa: *"Não gaste tempo refinando escolhas de tecnologia
> no panorama — gaste em **enumerar as lacunas** e o **blast radius**, que é o que vai derrubar as
> escolhas."* — `docs/PLAYBOOK-REFERENCIA.md:78-80`

## Legenda de citação

| Sigla | Arquivo |
|---|---|
| `RM:n` | `/home/ondokai/Projects/ai-video-maker/Roadmap Editor de Vídeo IA.md`, linha n |
| `PB:n` | `/home/ondokai/Projects/ai-video-maker/docs/PLAYBOOK-REFERENCIA.md`, linha n |
| `CP:n` | `/home/ondokai/Projects/ai-video-maker/docs/CONTRATO-DE-PESQUISA.md`, linha n |
| `CS:n` | `/home/ondokai/Projects/ai-video-maker/docs/CONTRATO-DE-SKILL.md`, linha n |

## Aviso de método — o mapa R01..R16 aqui usado é INFERIDO

O prompt deste cluster manda mapear cada claim para um cluster `R01..R16` "veja a lista abaixo",
mas **nenhuma lista de clusters chegou junto com a tarefa**. A lista canônica não existe em
nenhum arquivo do repositório: o único lugar onde os ids `R01..R16` aparecem é a coluna
"Insumo de pesquisa a ler" do mapa de propriedade de skills (`CS:118-133`). O mapa abaixo foi
**derivado** dessa coluna, casando cada `R` com o domínio da skill que o consome.

| id | Tema inferido | Derivado de |
|---|---|---|
| R01 | Remotion — modelo de tempo, composição, `<Sequence>`/`<Series>`, `staticFile` | `CS:124` (S09 remotion-core) |
| R02 | Remotion — animação (`spring`, `interpolate`, easing) e transições | `CS:123-124`, `CS:132` |
| R03 | Transcrição e legendas (whisper.cpp, `Caption`, estilo TikTok) | `CS:127` (S12) |
| R04 | Áudio — mixagem, ducking, sample rate, drift | `CS:127` (S12) |
| R05 | Pipeline de render do Remotion — CLI, GPU/NVENC, encoding | `CS:125` (S10) |
| R06 | Agentes de código — Claude Code, Agent Skills, CLIs de skill | `CS:131` (S16) |
| R07 | Manim — renderers, alfa, CLI, dependências de sistema | `CS:126` (S11) |
| R08 | Aquisição de assets — Giphy, stock, licenciamento de conteúdo | `CS:128` (S13) |
| R09 | Animação de código — Code Hike, Shiki, `@remotion/code` | `CS:129` (S14) |
| R10 | FFmpeg — containers, codecs, alfa, taxas de amostragem | `CS:130` (S15) |
| R11 | Verificação de vídeo — golden master, caracterização, gates | `CS:122`, `CS:120` (S07, S05) |
| R12 | Performance, cache e concorrência do render | `CS:125` (S10, par com R05) |
| R13 | TTS / locução | `CS:133` (S18 tts-voiceover) |
| R14 | Sistema de design de movimento — tipografia, cor, ritmo "Fireship" | `CS:132` (S17) |
| R15 | Worktrees paralelas e infraestrutura de agentes | `CS:118` (S03) |
| R16 | Manifesto/schema e autoria por LLM | `CS:123`, `CS:131` |

**Se a lista canônica existir e divergir**, esta é uma premissa do tipo (i) do playbook
(`PB:337`): o card cumpre o que quis — reendereçar as linhas é uma edição de uma coluna.
Custo de reversão em unidade contável: **1 coluna, ~110 células, 1 arquivo**.

---

## 1. Tabela completa de afirmações técnicas

**Como ler `tipo`:**

- **ACHADO** — afirmação sobre como o mundo é. Pode ser verdadeira ou falsa; é falsificável por
  observação. Se for falsa, um card construído em cima dela produz software que não roda.
- **RECOMENDACAO** — afirmação sobre o que *deveríamos* fazer. Não é falsificável por
  observação, é discutível por critério. Se for ruim, o software roda e é pior.
- **AFIRMACAO-DE-API** — subclasse dura de ACHADO: nome de pacote, função, flag, endpoint,
  componente ou valor default. **É a classe de maior risco de alucinação**, porque erra em
  silêncio: o texto lê como documentação e um agente a copia literalmente para dentro do código.

**Suspeita de alucinação** é sobre *este documento*, não sobre a tecnologia: mede o quanto a
afirmação tem cara de API real sem trazer nada que a ancore.

| id | seção (RM) | afirmação literal (curta) | tipo | cluster | suspeita | porquê |
|---|---|---|---|---|---|---|
| C01 | Introdução `RM:5` | "a edição programática trata o vídeo como uma função de estado" | RECOMENDACAO | R01 | baixa | premissa de arquitetura, não afirmação sobre o mundo |
| C02 | Introdução `RM:6` | "custo de renderização local praticamente nulo" | ACHADO | R05, R12 | **alta** | claim econômico central do documento, sem nenhum número; ancorado na referência 1 (`RM:190`), blog de fornecedor; ignora tempo de máquina, energia e licença |
| C03 | Introdução `RM:6` | o alvo é replicar o estilo "Fireship": "100 segundos", cortes secos, cadência milimétrica | ACHADO editorial | R14 | baixa | descreve um alvo público, mas nunca vira restrição numérica em nenhuma fase |
| C04 | Introdução `RM:6` | o vídeo resultante é "determinístico, repetível e versionável" | ACHADO | R11 | **alta** | determinismo é *afirmado*, nunca *construído*; conflita com busca ao vivo na Giphy (`RM:32`, `RM:74`) |
| C05 | Introdução `RM:7` | a arquitetura exige dois runtimes: Node.js/React e Python | ACHADO | R07 | baixa | consequência direta de usar Remotion + Manim |
| C06 | Introdução `RM:7` | Claude Code é "a ponte orquestradora" entre os dois ecossistemas | RECOMENDACAO | R06 | média | atribui papel de runtime a um agente; nada diz o que roda quando o agente não está na sala |
| C07 | Vibe Coding `RM:11` | Claude Code é agente de codificação operado localmente via CLI | AFIRMACAO-DE-API | R06 | baixa | verificável trivialmente |
| C08 | Vibe Coding `RM:15` | Agent Skills são regras Markdown "pré-carregadas no contexto de raciocínio do modelo antes da execução" | AFIRMACAO-DE-API | R06 | média | o mecanismo declarado (pré-carregamento total) é o oposto de carregamento sob demanda; se estiver errado, o dimensionamento de contexto de todas as 20 skills muda |
| C09 | Vibe Coding `RM:16` | o comando é `npx skills add remotion-dev/skills` | AFIRMACAO-DE-API | R06 | **alta** | pacote npm `skills` genérico + subcomando `add` + slug de repositório: forma plausível, nenhuma ancoragem |
| C10 | Vibe Coding `RM:16` | esse comando "integra o pacote remotion-best-practices" | AFIRMACAO-DE-API | R06 | **alta** | nome de pacote aparece também como slug de terceiro em `RM:197`; duas coisas diferentes tratadas como uma |
| C11 | Vibe Coding `RM:16` | "injetando dezenas de ficheiros de regras especializadas" | ACHADO quantitativo | R06 | **alta** | "dezenas" é número sem fonte e sem denominador |
| C12 | Vibe Coding `RM:16` | animações usam `useCurrentFrame()` com `interpolate()` e `spring()` | AFIRMACAO-DE-API | R01, R02 | baixa | núcleo público do Remotion |
| C13 | Vibe Coding `RM:16` | transições CSS e `setTimeout` "quebram o determinismo da renderização" | ACHADO | R01 | baixa | consequência de renderizar frame a frame; verificável com um teste |
| C14 | Vibe Coding `RM:17` | existe o pacote de skills `davila7-claude-code-templates-manim` | AFIRMACAO-DE-API | R06 | média | slug vindo de agregador (`RM:191`), não do autor |
| C15 | Vibe Coding `RM:17` | Manim expõe as classes `Scene`, `Mobject`, `Write` | AFIRMACAO-DE-API | R07 | baixa | vocabulário público |
| C16 | Vibe Coding `RM:17` | existe o comando generalista `/remotion-video` | AFIRMACAO-DE-API | R06 | **alta** | slash-command nomeado, sem fonte; a forma é indistinguível de invenção |
| C17 | Vibe Coding `RM:17` | fluxo: LLM cria composição → estrutura dados → compila no Studio → exporta MP4 | RECOMENDACAO | R06 | baixa | descreve intenção, não API |
| C18 | Modelo de dados `RM:21` | o fluxo parte de "um esquema JSON estrito" | RECOMENDACAO | R16 | baixa | o adjetivo "estrito" não é acompanhado de nenhum schema |
| C19 | Modelo de dados `RM:24-30` | existem 5 tipos de nó: `topic_header`, `text_highlight`, `meme_gif`, `manim_graphic`, `code_walkthrough` | RECOMENDACAO | R16 | baixa | taxonomia proposta; nenhum campo de duração, ordem, id ou versão |
| C20 | Tabela `RM:26` | `<TitleSequence />` faz entrada com spring e *overshoot*, saída por fade | RECOMENDACAO | R02, R14 | baixa | nome de componente do projeto, não de biblioteca |
| C21 | Tabela `RM:27` | `<HighlightText />` avança "palavra a palavra através de um recorte animado", sincronizado à locução | RECOMENDACAO | R02, R03 | média | pressupõe timings por palavra que só existem se C70/C71 forem verdade |
| C22 | Tabela `RM:28` | meme dura "1-2 segundos" e usa `@remotion/gif` | RECOMENDACAO + AFIRMACAO-DE-API | R08 | média | pacote é plausível; a janela 1-2 s é número sem fonte |
| C23 | Tabela `RM:29` | `manim_graphic` entra como "vídeos transparentes (WebM)" sobre o fundo global | ACHADO | R07, R10 | média | depende de alfa sobreviver ao encode *e* ao decode no Chrome |
| C24 | Tabela `RM:30` | `code_walkthrough` renderiza via `<CodeHikeBlock />` | AFIRMACAO-DE-API | R09 | média | nome com cara de componente exportado; provavelmente é componente do projeto |
| C25 | Modelo de dados `RM:32` | um runner Node.js analisa o manifesto **antes** de acionar o bundler | RECOMENDACAO | R16, R12 | baixa | é o coração operacional do sistema e **nenhuma fase o constrói** (ver refutação I-09) |
| C26 | Modelo de dados `RM:32` | o render principal só inicia "quando a grelha de dependências externas estiver resolvida" | RECOMENDACAO | R12 | baixa | boa regra; sem definição de falha parcial |
| C27 | Remotion `RM:36` | Remotion é ambiente de render por código onde a timeline "avança numericamente" | ACHADO | R01 | baixa | descrição correta do modelo |
| C28 | Remotion `RM:40` | `spring()` é primitiva baseada em física | AFIRMACAO-DE-API | R02 | baixa | público |
| C29 | Remotion `RM:41` | `spring()` aceita `mass`, `damping`, `stiffness` | AFIRMACAO-DE-API | R02 | baixa | público |
| C30 | Remotion `RM:41` | diminuir `damping` gera bounce; aumentar `stiffness` gera velocidade terminal no início | ACHADO | R02 | baixa | comportamento de oscilador; verificável por amostragem numérica |
| C31 | Remotion `RM:41` | `interpolate()` aceita `extrapolateLeft:'clamp'` e `extrapolateRight:'clamp'` | AFIRMACAO-DE-API | R02 | baixa | público |
| C32 | Remotion `RM:45` | existe `<Sequence from={x} durationInFrames={y}>` | AFIRMACAO-DE-API | R01 | baixa | público |
| C33 | Remotion `RM:45-46` | `<Series>` empilha cenas consecutivamente de forma automática | AFIRMACAO-DE-API | R01 | baixa | público |
| C34 | Remotion `RM:46` | `@remotion/transitions` disponibiliza `<TransitionSeries>` | AFIRMACAO-DE-API | R02 | baixa | público |
| C35 | Remotion `RM:47` | `pushCut()` é uma *presentation* de transição | AFIRMACAO-DE-API | R02 | **ALTA** | ver §2, S-01 |
| C36 | Remotion `RM:47` | `slide()`, `wipe()`, `flip()` são presentations | AFIRMACAO-DE-API | R02 | baixa-média | plausíveis; conferir a lista fechada |
| C37 | Remotion `RM:47` | `springTiming` e `linearTiming` são timings | AFIRMACAO-DE-API | R02 | baixa | plausíveis |
| C38 | Remotion `RM:47` | existe o parâmetro `durationRestThreshold` e **o default é 0.005** | AFIRMACAO-DE-API (valor default) | R02 | **ALTA** | ver §2, S-02. Default declarado em prosa é a linha 527 do catálogo de falso verde (`PB:527`) |
| C39 | Remotion `RM:47` | 0.005 significa "animação declarada completa aos 99.5% do seu trajeto" | ACHADO interpretativo | R02 | **alta** | traduz um limiar de repouso em porcentagem de trajeto; a equivalência não é dada por ninguém |
| C40 | Remotion `RM:47` | baixar para 0.001 "prolonga microscopicamente a cauda" e elimina o cutoff percetível | RECOMENDACAO | R02 | média | direção plausível; o efeito perceptual não é medido nem mensurável como escrito |
| C41 | Manim `RM:51` | Manim foi criado por Grant Sanderson e é intrinsecamente Python | ACHADO | R07 | baixa | público |
| C42 | Manim `RM:51` | "não há via nativa para injetar código Manim diretamente numa árvore do DOM" | ACHADO | R07 | baixa | é a justificativa da ponte por arquivo; verificável por ausência |
| C43 | Manim `RM:52` | Manim atua como gerador *headless* na pré-compilação, não como serviço | RECOMENDACAO | R07 | baixa | decisão de arquitetura |
| C44 | Manim `RM:56` | ManimCE é baseado em Cairo e "utiliza estritamente o CPU" | AFIRMACAO-DE-API | R07 | média | "estritamente" colide com o próprio `--renderer=opengl` citado em `RM:57` para o mesmo binário |
| C45 | Manim `RM:56` | Cairo oferece "reprodutibilidade perfeita num leque alargado de sistemas" | ACHADO | R07, R11 | **ALTA** | reprodutibilidade bit-a-bit entre SOs é a afirmação mais forte do documento e a única que, se falsa, mata o golden master antes de ele existir |
| C46 | Manim `RM:57` | OpenGL é "potencialmente ordens de magnitude mais rápido" | ACHADO quantitativo | R07, R12 | **alta** | "ordens de magnitude" sem benchmark, sem cena, sem máquina |
| C47 | Manim `RM:57` | as flags são `--renderer=opengl --use_projection_stroke_shaders` | AFIRMACAO-DE-API | R07 | **ALTA** | ver §2, S-03 |
| C48 | Manim `RM:62` | a transparência se ativa com `-t` / `--transparent` | AFIRMACAO-DE-API | R07 | baixa | plausível e documentado na fonte 12 (`RM:201`) |
| C49 | Manim `RM:63` | "as codificações padrão em H.264 não contêm um formato alfa" | ACHADO | R10 | baixa-média | verdadeiro para o perfil comum; o texto generaliza ("contentores padrão") sem qualificar |
| C50 | Manim `RM:63` | por isso é obrigatório `--format=webm` | AFIRMACAO-DE-API + RECOMENDACAO | R07, R10 | média | webm não é a única saída com alfa; a obrigatoriedade é imposta sem alternativa examinada |
| C51 | Manim `RM:67` | comando literal `manim render src/scripts/architecture.py GraphScene -t --format=webm -ql -o ./public/assets/graph.webm` | AFIRMACAO-DE-API | R07 | média | combinação exata de flags (`-ql` com `--format`, `-o` com caminho relativo) precisa rodar de verdade |
| C52 | Manim `RM:69` | Remotion consome o WebM via `<Video src={staticFile('assets/graph.webm')} />` | AFIRMACAO-DE-API | R01, R10 | **ALTA** | ver §2, S-10. Componente escolhido para alfa é a decisão que mais silenciosamente sai errada (fundo preto no lugar de transparência) |
| C53 | Manim `RM:69` | assets ficam em `public/assets/` e `staticFile()` resolve | AFIRMACAO-DE-API | R01 | baixa | público |
| C54 | Giphy `RM:74` | a SDK é `@giphy/js-fetch-api` | AFIRMACAO-DE-API | R08 | baixa | plausível |
| C55 | Giphy `RM:74` | o acesso usa `api_key` guardada em `.env` | ACHADO | R08 | baixa | mas nada diz sobre a chave ser exposta no bundle do browser (o render roda em browser) |
| C56 | Giphy `RM:74` | o endpoint de busca é `/v1/gifs/search` | AFIRMACAO-DE-API | R08 | baixa | plausível |
| C57 | Giphy `RM:74` | a resposta traz múltiplas *renditions* e é preciso filtrar por qualidade | ACHADO | R08 | baixa | plausível; nomes das renditions não são dados |
| C58 | Giphy `RM:74` | adicionar `'transparent'` ou `'stickers'` **à interrogação** devolve sticker transparente | RECOMENDACAO | R08 | média | confunde palavra-chave de busca com endpoint/parâmetro de recurso |
| C59 | Giphy `RM:78-79` | usar `<img>` num render determinístico dessincroniza o GIF | ACHADO | R08 | baixa | consequência do modelo de frames |
| C60 | Giphy `RM:79` | `@remotion/gif` expõe `<Gif>` que avança em função de `useCurrentFrame()` | AFIRMACAO-DE-API | R08 | baixa | plausível |
| C61 | Giphy `RM:79` | "é imperativo executar um pedido GET ao `onload.url`" para pingback | AFIRMACAO-DE-API + obrigação contratual | R08 | **alta** | nome do campo *e* a obrigatoriedade (que é cláusula de termo de uso, não de API) num mesmo período |
| C62 | Code Hike `RM:84` | o preset se instala com `npx create-video@latest --code-hike` | AFIRMACAO-DE-API | R09 | **ALTA** | ver §2, S-05 |
| C63 | Code Hike `RM:84` | o preset usa "o motor de sintaxe universal Shiki" | AFIRMACAO-DE-API | R09 | baixa-média | plausível; "universal" é adorno |
| C64 | Code Hike `RM:85` | as animações focam linhas e reduzem a opacidade das demais | RECOMENDACAO | R09, R14 | baixa | descrição estética |
| C65 | Code Hike `RM:85` | temas do VS Code são replicáveis "a um grau impossível de distinguir de uma captura de ecrã" | ACHADO | R09 | média | como escrito não é falsificável; precisaria virar um critério de pixel |
| C66 | Code Hike `RM:81` × `RM:84-85` | o título da seção promete `@remotion/code`, o corpo nunca o usa | INCONSISTÊNCIA interna | R09 | **alta** | ver refutação I-01 |
| C67 | Áudio `RM:93` | legendas estilo TikTok exigem saber "com resolução de milissegundos quando um fonema se inicia" | ACHADO | R03 | baixa | requisito bem posto; "fonema" é impreciso (o resto do texto fala de palavra/token) |
| C68 | Áudio `RM:94` | whisper.cpp roda local, "sem dependência de nuvem" | ACHADO | R03 | baixa | verificável |
| C69 | Áudio `RM:94` | existe `@remotion/install-whisper-cpp` | AFIRMACAO-DE-API | R03 | baixa | plausível, com doc citada (`RM:229`) |
| C70 | Áudio `RM:94` | `tokenLevelTimestamps: true` "força a ativação algorítmica" do DTW | AFIRMACAO-DE-API | R03 | média | o nome da opção é plausível; a ligação causal com DTW é o passo frágil |
| C71 | Áudio `RM:94` | a extração produz a chave `t_dtw` | AFIRMACAO-DE-API | R03 | **ALTA** | ver §2, S-04 |
| C72 | Áudio `RM:94` | "sugere-se 16 kHz a 16-bit" e modelos `base.en` ou `medium` | RECOMENDACAO + AFIRMACAO-DE-API | R03 | média | 16 kHz é requisito do whisper, não sugestão; e `base.en` é modelo **só inglês** num projeto sem idioma declarado |
| C73 | Áudio `RM:95` | existe o tipo `Caption` do Remotion | AFIRMACAO-DE-API | R03 | baixa | doc citada (`RM:228`) |
| C74 | Áudio `RM:95` | existe `createTikTokStyleCaptions()` | AFIRMACAO-DE-API | R03 | média | ver §2, S-06 |
| C75 | Áudio `RM:95` | essa função "protege os limites da área visual (bounding boxes)" e impede overflow | ACHADO funcional | R03 | **ALTA** | atribui a uma função de agrupamento temporal um comportamento de layout; se falso, as legendas estouram a tela e nada acusa |
| C76 | Áudio `RM:99` | os SFX são "frequentemente recolhidos do `@remotion/sfx`" | AFIRMACAO-DE-API | R04 | **ALTA** | ver §2, S-07 |
| C77 | Áudio `RM:100` | o ducking é implementado "em tempo de compilação gráfica", sem ferramenta externa | RECOMENDACAO | R04 | baixa | decisão de arquitetura defensável |
| C78 | Áudio `RM:100` | `<Html5Audio>` "falha em contextos iterativos restritos e SSR" | ACHADO | R04 | **alta** | mecanismo de falha vago; e o próprio documento diz que o render roda em browser (`RM:79`, `RM:85`), onde "SSR" não se aplica — ver I-06 |
| C79 | Áudio `RM:100` | `<Audio>` vem "diretamente do manifesto `@remotion/media`" | AFIRMACAO-DE-API | R04 | **ALTA** | ver §2, S-08 |
| C80 | Áudio `RM:100` | esse `<Audio>` "garante reprodução através de chamadas estritas a FFmpeg durante o empacotamento" | ACHADO de mecanismo | R04, R10 | **ALTA** | descreve o interior de uma implementação; é o tipo de frase que nenhuma doc costuma dizer |
| C81 | Áudio `RM:101` | `volume` aceita função avaliada por frame (via `interpolate()`) | AFIRMACAO-DE-API | R04 | baixa | plausível, doc citada (`RM:233`) |
| C82 | Áudio `RM:101` | duck de 0.8 → 0.2 ao longo de "dez a trinta frames" antes da fala | RECOMENDACAO numérica | R04 | média | números sem origem; e "antes da enunciação" exige lookahead que o manifesto não define |
| C83 | Áudio `RM:102` | o "trim mismatch" é provocado "pelo preenchimento silencioso da onda mp3" | ACHADO | R04, R10 | média | causa específica (padding de encoder) declarada como se fosse a única |
| C84 | Áudio `RM:102` | normalizar tudo para **48000 Hz** antes de codificar elimina o desvio | RECOMENDACAO | R04, R10 | média | conflita com o 16 kHz de C72 sem que o documento diga qual arquivo vai para qual taxa — ver I-03 |
| C85 | Render `RM:106` | o pipeline depende "do FFmpeg instalado no aparelho" | AFIRMACAO-DE-API | R05, R10 | **ALTA** | ver §2, S-09; se falso, a Fase 1 inteira instala coisa desnecessária e mascara a versão real usada |
| C86 | Render `RM:110` | com NVENC o fardo sai do CPU | ACHADO | R05 | baixa | plausível |
| C87 | Render `RM:110` | a flag é `--hardware-acceleration` com valores `required` \| `if-possible` | AFIRMACAO-DE-API | R05 | baixa-média | plausível, doc citada (`RM:238`); conferir o conjunto completo de valores |
| C88 | Render `RM:113-118` | comando literal com `--codec h264 --hardware-acceleration required --video-bitrate 18M --bundle-cache --log info` | AFIRMACAO-DE-API | R05 | média | cinco flags num só bloco; cada uma é um ponto de falha independente |
| C89 | Render `RM:120` | o encoder de hardware "proíbe" CRF e "dita o uso exclusivo" de `--video-bitrate` | ACHADO | R05 | média | plausível, mas escrito como lei universal em vez de restrição do encoder |
| C90 | Render `RM:120` | bitrate entre 12M e 25M para texto vetorial | RECOMENDACAO numérica | R05, R14 | média | faixa sem experimento; nenhum critério de qualidade associado |
| C91 | Render `RM:120` | existe a flag `--buffer-size` | AFIRMACAO-DE-API | R05 | **ALTA** | ver §2, S-11 |
| C92 | Render `RM:120` | AV1 é "maciçamente moroso" no CPU e por isso inadequado à iteração diária | ACHADO | R05 | média | plausível; sem número e sem menção a encoder de hardware AV1 |
| C93 | Roadmap `RM:124` | "o desenvolvimento obedece a sete fases incrementais" | RECOMENDACAO | — | média | as fases são ordenadas **por camada tecnológica**, o que contraria o eixo do playbook (`PB:96`: "o eixo é ordem de risco, não camada") — ver I-07 |
| C94 | Fase 1 `RM:130` | é preciso Node.js LTS "que acomoda os pacotes ES6 requeridos" | RECOMENDACAO | R01 | média | nenhuma versão nomeada; "ES6" é justificativa datada |
| C95 | Fase 1 `RM:131` | o FFmpeg precisa estar "completamente associado na variável PATH" | RECOMENDACAO | R05, R10 | **alta** | mesma raiz de C85 |
| C96 | Fase 1 `RM:132` | é preciso LaTeX (MiKTeX/MacTeX) | ACHADO | R07 | média | verdadeiro só para cenas com `Tex`/`MathTex`; posto como pré-requisito universal |
| C97 | Fase 1 `RM:132` | é preciso SoX ("extensão temporal acústica de interceção") | ACHADO | R07 | média | dependência opcional do Manim tratada como obrigatória; a descrição é ininteligível |
| C98 | Fase 1 `RM:132` | é preciso Cairo em distribuição binária "se o ambiente nativo exigir a versão CPU" | ACHADO | R07 | média | condicional bem posta, mas a condição não é decidida em lugar nenhum |
| C99 | Fase 1 `RM:133` | isolar Python com `python -m venv .venv` | AFIRMACAO-DE-API | R07 | baixa | trivial |
| C100 | Fase 2 `RM:139` | `npx create-video@latest nome-do-projeto --code-hike` | AFIRMACAO-DE-API | R09 | **ALTA** | forma com argumento posicional **e** flag de template; difere de `RM:84`, que não passa nome |
| C101 | Fase 2 `RM:140` | "assegurar a presença do `/remotion-markup`" | AFIRMACAO-DE-API | R06 | **ALTA** | segundo slash-command nomeado, distinto de C16, também sem fonte |
| C102 | Fase 3 `RM:148` | `manim render grafico.py -t --format=webm --renderer=opengl` (sem nome de cena) | AFIRMACAO-DE-API | R07 | **alta** | contradiz `RM:67`, que passa `GraphScene` — ver I-02 |
| C103 | Fase 3 `RM:148` | o `child_process` aciona "a compilação paralela" | RECOMENDACAO | R12 | média | paralelismo afirmado sem grau, sem limite e sem contenção de GPU |
| C104 | Fase 3 `RM:149` | o diretório é visível ao "servidor Webpack ou Vite interno do projeto" | AFIRMACAO-DE-API | R01, R12 | **ALTA** | ver §2, S-12 |
| C105 | Fase 4 `RM:156` | as buscas usam "prioridades de compressões adequadas para quadros por segundo" | RECOMENDACAO | R08 | média | frase sem operação definida; é a única menção a fps no documento inteiro |
| C106 | Fase 4 `RM:157` | os retornos entram exclusivamente via `<Gif src={...} />` | AFIRMACAO-DE-API | R08 | baixa | consistente com C60 |
| C107 | Fase 5 `RM:165` | a chave do `Caption` orquestra "destaque colorido palavra a palavra" | RECOMENDACAO | R03, R14 | baixa | consistente com C21 |
| C108 | Fase 6 `RM:171` | substituir `<Sequence>` por uma "`<TransitionSeries>` paralela" | RECOMENDACAO | R02 | média | "paralela" não tem significado definido nesse contexto |
| C109 | Fase 6 `RM:172` | usar `presentation={pushCut()}` com `timing={springTiming({...})}` e `durationRestThreshold` ≈ 0.001 | AFIRMACAO-DE-API + RECOMENDACAO | R02 | **ALTA** | reafirma C35 e C38 como instrução executável de card |
| C110 | Fase 6 `RM:173` | auditar no Studio invocando `npm run dev` | AFIRMACAO-DE-API | R01 | média | o comando canônico do produto é outro; `npm run dev` depende de o template definir esse script |
| C111 | Fase 7 `RM:179` | fazer "tests exaustivos nos excertos" para achar distorção temporal | RECOMENDACAO | R11 | **alta** | é o **único** lugar do documento que fala em teste, e não define artefato, comando nem critério |
| C112 | Fase 7 `RM:180` | `npx remotion render --hardware-acceleration if-possible --video-bitrate 18M` (sem id de composição) | AFIRMACAO-DE-API | R05 | média | difere de `RM:113`, que passa o id `ArquiteturaVibeCode` |
| C113 | Fase 7 `RM:181` | ao fim, "o vídeo repousará finalizado no diretório alvo local, pronto para divulgação" | RECOMENDACAO | — | média | "pronto para divulgação" é o critério de aceitação do programa inteiro e não é falsificável |
| C114 | Síntese `RM:185` | tudo isso é possível "sem o mínimo toque num software de edição sequencial gráfico manual" | RECOMENDACAO/conclusão | — | média | tese do documento; sem contraexemplo examinado (correção de um erro num único frame) |
| C115 | Síntese `RM:186` | a execução é "compilação local (sem perdas processuais)" | ACHADO | R05, R10 | **alta** | "sem perdas" é falso por construção num pipeline que termina em H.264 com bitrate fixo (`RM:120`) |
| C116 | Referências `RM:188-246` | 57 referências numeradas sustentam o documento | ACHADO estrutural | todos | **alta** | pela regra do contrato (`CP:39`, "duas páginas do mesmo domínio contam como uma"), as 57 referências colapsam em **20 fontes**; `remotion.dev` sozinho responde por 26 das 57 e vale **1** |
| C117 | Referências `RM:190` | a referência 1 (`pexo.ai/blog/remotion-alternatives`) sustenta C02 | ACHADO estrutural | R05 | **alta** | fonte secundária de parte interessada ancorando o claim econômico central; pelo contrato (`CP:38`) nenhum claim fecha só com secundárias |
| C118 | Referências `RM:195` | a referência 6 é um PDF `mavgpt.ai/.../The_Complete_Remotion_Setup_Guide_2026.pdf` | ACHADO estrutural | R06 | **alta** | fonte de agregador com nome de conteúdo gerado; usada para embasar o parágrafo do Vibe Coding (`RM:11`) |

**Contagem:** 118 linhas. Destas, **58 são AFIRMACAO-DE-API** (a classe que vira código
literal), 39 RECOMENDACAO, 18 ACHADO e 3 estruturais/inconsistências.
**23 linhas estão marcadas com suspeita ALTA.**

---

## 2. Suspeitas fortes — nomes que soam plausíveis e não estão ancorados

Regra que gera esta lista (`CP:109-110`): *"Nunca invente nome de API, flag ou pacote. Se você
não viu na doc, o claim é NÃO VERIFICADO."* O documento não diz, em nenhum ponto, ter visto.

Cada item traz: **o que o texto afirma** · **por que é suspeito** · **o que exatamente conferir**
(o teste que fecha) · **o que quebra se cair**.

### S-01 — `pushCut()` como presentation de transição · `RM:47`, `RM:172` · cluster R02
- **Suspeito porque:** aparece numa lista ao lado de `slide()`, `wipe()` e `flip()`, que têm cara
  de nomes reais, e é o **único** dos quatro que o documento escolhe como padrão na Fase 6
  (`RM:172`). Um nome inventado herda credibilidade dos vizinhos verdadeiros. "Push" e "cut" são
  dois conceitos distintos de edição colados num identificador — a forma é de invenção.
- **Conferir:** a lista **fechada** de presentations exportadas pelo pacote de transições na
  versão que será instalada, não uma busca por "pushCut". Se a página de referência enumera
  todas e essa não está lá, é `REFUTADO` com evidência positiva (`CP:113-116`).
- **Quebra se cair:** o padrão visual de toda transição do projeto (a "cadência de cortes secos"
  de `RM:6`) e o card que escrever o componente de cena.

### S-02 — `durationRestThreshold` com default **0.005** · `RM:47` · cluster R02
- **Suspeito porque:** é um **valor default declarado em prosa**, exatamente a entrada
  "default de flag declarado duas vezes" do catálogo de falso verde (`PB:527`). Pior: o
  documento declara o default (0.005) e, três parágrafos depois, manda usar outro valor
  (0.001, `RM:172`) — se o default real já for 0.001, metade do texto é ruído e ninguém percebe,
  porque o resultado fica igual. A frase "declarada completa aos 99.5% do seu trajeto" (`RM:47`)
  é uma **segunda** afirmação embutida na primeira, e é interpretativa.
- **Conferir:** (a) o parâmetro existe e em qual função — `springTiming` ou `spring`? (b) o valor
  default na versão instalada; (c) a semântica: limiar sobre a *distância ao repouso* ou
  percentual de trajeto?
- **Quebra se cair:** a recomendação de `RM:172` vira no-op silencioso, e o card que "otimiza a
  transição" passa sem fazer nada — falso verde clássico.

### S-03 — `--use_projection_stroke_shaders` · `RM:57` · cluster R07
- **Suspeito porque:** flag longa, com underscore, num CLI cujas outras flags citadas usam hífen
  (`--renderer=opengl`, `--transparent`, `--format=webm`). Mistura de convenções na mesma linha
  é sinal de que uma das duas veio de outro lugar (config file × linha de comando). Além disso,
  ela é apresentada como aceleradora, mas shaders de projeção são uma opção de *qualidade de
  traço*, não de velocidade — a justificativa não casa com o nome.
- **Conferir:** se o nome existe **como flag de CLI** ou apenas como chave de arquivo de
  configuração; e se ela é aceita junto de `-t` e `--format=webm`.
- **Quebra se cair:** o comando da Fase 3 (`RM:148`) falha no primeiro uso, e a premissa de
  velocidade do Vibe Coding (`RM:57`) perde o apoio.

### S-04 — a chave `t_dtw` · `RM:94` · cluster R03
- **Suspeito porque:** é um nome de campo de **struct interna de baixo nível** (prefixo `t_`
  típico de C) sendo apresentado como algo que "a extração produzirá" para o consumo do
  componente React. Entre a struct C e o JSON que o React lê há pelo menos duas camadas de
  serialização, e cada uma pode renomear, agregar ou descartar o campo. O documento pula as duas.
- **Conferir:** o **tipo de retorno** da função de transcrição do wrapper com
  `tokenLevelTimestamps: true` — qual é o nome real do campo no objeto entregue ao JS, e se ele
  é por token ou por palavra.
- **Quebra se cair:** o `text_highlight` (`RM:27`) — o efeito visual mais característico do
  estilo alvo — não tem de onde tirar o tempo por palavra.

### S-05 — `npx create-video@latest --code-hike` · `RM:84`, `RM:139` · cluster R09
- **Suspeito porque:** o documento escreve o comando de **duas formas diferentes** — sem nome de
  projeto (`RM:84`) e com nome posicional antes da flag (`RM:139`). Quando o mesmo comando
  aparece duas vezes com sintaxes distintas, pelo menos uma foi reconstruída de memória.
  Além disso, seleção de template por flag ad-hoc (uma flag por template) é um padrão
  incomum de CLI.
- **Conferir:** como o CLI de scaffold seleciona template (flag dedicada, `--template=<nome>`,
  ou prompt interativo) e qual é o identificador exato do template de Code Hike.
- **Quebra se cair:** a Fase 2 inteira (`RM:139`), que é o card raiz do repositório.

### S-06 — `createTikTokStyleCaptions()` e a alegação de *bounding box* · `RM:95` · cluster R03
- **Suspeito porque:** o **nome** é plausível, mas a **função atribuída** não é. O texto diz que
  ela "protege os limites da área visual (bounding boxes) quebrando longas extensões de
  vocabulário em sucessivas páginas". Uma função que recebe legendas e devolve páginas não tem
  como conhecer largura de tela, fonte ou tamanho de texto — as três variáveis que definem uma
  bounding box. A alegação exige informação que a assinatura provavelmente não recebe.
- **Conferir:** (a) o pacote que exporta a função; (b) a assinatura — quais parâmetros ela recebe
  (se recebe milissegundos, o agrupamento é **temporal**, não espacial); (c) se existe qualquer
  parâmetro de largura/limite de caracteres.
- **Quebra se cair:** legendas estouram o quadro em produção e **nenhum gate acusa**, porque
  overflow visual não muda o código de saída do render. Isto tem de virar item explícito de R11.

### S-07 — `@remotion/sfx` como fonte de efeitos sonoros · `RM:99` · cluster R04
- **Suspeito porque:** o texto diz que os SFX são "recolhidos do `@remotion/sfx`", isto é, trata
  o pacote como **biblioteca de conteúdo** (um acervo de sons). É muito mais provável que um
  pacote com esse nome, se existir, seja *código* (tocar/mixar), não *áudio licenciado*.
  A confusão biblioteca-de-código × acervo-de-mídia é a que gera problema jurídico depois.
  Reforça a suspeita o fato de a referência 41 (`RM:230`) apontar para uma página de
  *contribuição* ("Adding a sound effect"), que é sobre contribuir com o projeto, não sobre
  consumir sons num vídeo próprio.
- **Conferir:** (a) o pacote existe no registry? (b) se existe, ele **distribui arquivos de
  áudio** ou apenas API? (c) sob qual licença cada som pode ir para um vídeo monetizado?
- **Quebra se cair:** todo o eixo de SFX do estilo alvo fica sem fonte, e o card de áudio precisa
  de um provedor que o panorama nunca nomeou (ver lacuna G-05).

### S-08 — `<Audio>` de `@remotion/media` e o mecanismo "chamadas estritas a FFmpeg" · `RM:100` · R04
- **Suspeito porque:** são **três afirmações empilhadas numa frase**: (1) existe o pacote
  `@remotion/media`; (2) ele exporta `<Audio>`; (3) esse `<Audio>` funciona chamando FFmpeg
  durante o empacotamento. A terceira é uma descrição de *interior de implementação* — o tipo de
  detalhe que documentação raramente afirma e que, quando aparece em texto gerado, costuma ser
  racionalização. Some-se a isso a alegação irmã de que `<Html5Audio>` "falha em SSR" (C78), que
  não faz sentido num pipeline que o próprio documento descreve como rodando em browser
  (`RM:79`, `RM:85`).
- **Conferir:** (a) o pacote e o export existem na versão alvo; (b) qual é a diferença
  **documentada** entre os dois componentes de áudio e em que condição cada um é recomendado;
  (c) a partir de qual versão — este parece ser um pacote novo, e o projeto ainda não pinou versão
  nenhuma.
- **Quebra se cair:** o ducking (`RM:101`), a sincronia de fala (`RM:102`) e o card de áudio
  inteiro trocam de componente base.

### S-09 — "o FFmpeg instalado no aparelho" · `RM:106`, `RM:131` · cluster R05/R10
- **Suspeito porque:** é uma afirmação sobre **de onde vem um binário**, e ferramentas de render
  modernas frequentemente **embarcam** o próprio FFmpeg justamente para eliminar a variabilidade
  que o PATH introduz. Se o Remotion embarca, então: a Fase 1 instala algo desnecessário, a
  versão realmente usada no encode é **outra** que a instalada, e qualquer investigação de
  divergência de bytes vai olhar para o binário errado. Este é o erro mais caro da lista porque
  ele não quebra nada — ele apenas faz o diagnóstico apontar para o lugar errado.
- **Conferir:** se o render usa FFmpeg do sistema, embarcado, ou ambos conforme o caso; e **como
  imprimir a versão efetivamente usada** durante um render.
- **Quebra se cair:** o pré-requisito 2 da Fase 1 (`RM:131`) e a reprodutibilidade declarada em
  `RM:6` (que depende de saber qual encoder rodou).

### S-10 — `<Video>` para WebM com canal alfa · `RM:69` · cluster R01/R10
- **Suspeito porque:** o documento escolhe **um** componente de vídeo sem discutir alternativas,
  num caso de uso (alfa) que é notoriamente o que separa os componentes de vídeo entre si.
  Transparência é a feature que costuma exigir o caminho de decodificação diferente. E o modo de
  falha é o pior possível: **o vídeo aparece com fundo preto** — renderiza, não erra, não alerta.
- **Conferir:** (a) qual componente de vídeo preserva alfa no render final; (b) se é preciso uma
  prop explícita de transparência; (c) se o codec do WebM produzido pelo Manim (`RM:67`) é o
  mesmo que esse componente decodifica com alfa (`ffprobe` do arquivo: `pix_fmt` com `a`).
- **Quebra se cair:** todo nó `manim_graphic` (`RM:29`) e a tese de composição em camadas
  (`RM:61`).

### S-11 — a flag `--buffer-size` · `RM:120` · cluster R05
- **Suspeito porque:** aparece numa frase de justificativa técnica genérica ("alinhar buffers
  interligados"), sem valor de exemplo, sem unidade e sem aparecer em nenhum dos dois comandos
  literais do documento (`RM:113-118`, `RM:180`). Flag citada em prosa e ausente do exemplo é
  sinal de que ela foi *lembrada*, não *usada*. `bufsize` é um conceito de FFmpeg; a suspeita é
  de vazamento de vocabulário do FFmpeg para o CLI do Remotion.
- **Conferir:** a lista de flags do subcomando de render na versão alvo; se a opção existe, seu
  nome exato, unidade e interação com `--video-bitrate`.
- **Quebra se cair:** apenas uma linha de recomendação — é o item de menor blast radius da lista,
  e por isso serve de **sonda negativa**: se um cluster "confirmar" esta sem evidência, o cluster
  está confirmando por plausibilidade.

### S-12 — "servidor Webpack ou Vite interno do projeto" · `RM:149` · cluster R01/R12
- **Suspeito porque:** a disjunção "ou" é a assinatura da alucinação: quem sabe qual bundler o
  produto usa não escreve "ou". O documento também nunca decide, e a decisão importa (é o que
  define se `public/` é servido, com qual cache e a partir de qual raiz).
- **Conferir:** qual bundler o produto usa hoje, se é substituível, e a regra exata de servir
  `public/` (que é onde o Manim escreve, `RM:67`).
- **Quebra se cair:** a Fase 3 passo 3 (`RM:149`) e o contrato de caminho entre Manim e Remotion.

### S-13 — os slash-commands `/remotion-video` e `/remotion-markup` · `RM:17`, `RM:140` · R06
- **Suspeito porque:** são **dois** nomes diferentes, em duas seções diferentes, para a mesma
  coisa presumida (comandos que viriam do pacote de skills), sem que o documento note a
  diferença. Um deles quase certamente não existe; possivelmente nenhum.
- **Conferir:** o conteúdo real do pacote de skills (se o pacote existir, S-14): quais
  comandos/skills ele instala e com que nomes.
- **Quebra se cair:** a Fase 2 passo 2 (`RM:140`) tem um critério de aceitação impossível
  ("assegurar a presença do `/remotion-markup`").

### S-14 — `npx skills add remotion-dev/skills` e o pacote `remotion-best-practices` · `RM:16`, `RM:140` · R06
- **Suspeito porque:** postula um **gerenciador de skills genérico** (`skills`) com sintaxe de
  slug de repositório GitHub. É exatamente a forma que um modelo produz quando extrapola de
  `npx shadcn add` / `gh repo`. E a única "fonte" que o parágrafo cita é um agregador de terceiro
  (`RM:192`, `RM:197`), não o autor.
- **Conferir:** (a) existe o pacote `skills` no registry com subcomando `add`? (b) qual é o
  método **oficialmente documentado** de instalar as skills desse produto? (c) o slug
  `remotion-dev/skills` existe?
- **Quebra se cair:** as Fases 2 (`RM:139-141`) e todo o pressuposto de "injeção de contexto"
  (`RM:15`) — que é a tese do documento sobre por que o agente saberia escrever Remotion.

### S-15 — `<CodeHikeBlock />`, `<TitleSequence />`, `<HighlightText />`, `<GifReaction />`, `<MathVisualizer />` · `RM:26-30` · R09/R16
- **Suspeito porque:** a tabela mistura, na **mesma coluna**, componentes que o projeto vai
  escrever com pacotes que o projeto vai instalar (`@remotion/gif` aparece na coluna ao lado,
  `RM:28`). Um leitor — humano ou agente — não tem como distinguir "isto eu importo" de "isto eu
  crio". Um agente vai tentar importar `<CodeHikeBlock />`.
- **Conferir:** nada externo. Isto se resolve **no repositório**: a tabela precisa de uma coluna
  "origem: projeto | pacote".
- **Quebra se cair:** cinco cards começam com um import que não resolve.

### S-16 — `onload.url` como pingback obrigatório · `RM:79` · cluster R08
- **Suspeito porque:** junta um **caminho de campo** (`onload.url`) a uma **obrigação
  contratual** ("é imperativo") numa frase só. A obrigação, se existir, mora nos termos de uso —
  fonte diferente da referência de API que o documento cita (`RM:223`). Quando um texto funde
  API e contrato, normalmente inferiu um dos dois.
- **Conferir:** (a) o campo existe na resposta e qual seu caminho exato; (b) os termos de uso
  exigem o disparo — e exigem também atribuição visual ("Powered by GIPHY"), que o documento
  **nunca menciona** (ver lacuna G-06).
- **Quebra se cair:** risco jurídico e de bloqueio de chave, não risco técnico — a classe que
  `CP:24` e `CP:27-28` mandam tratar como PERGUNTA-DONO, nunca como dedução.

---

## 3. Q8 — o que **não veio** no material

> *"Q8 — O que **não veio** no material? Sem ela: planeja-se sobre buraco."* — `PB:49`

Método: cada lacuna abaixo foi confirmada por contagem no texto, não por impressão. Onde escrevo
"zero ocorrências", o comando que prova é
`grep -ic "<termo>" "/home/ondokai/Projects/ai-video-maker/Roadmap Editor de Vídeo IA.md"`.

Cada linha é candidata a **card da fase 0**.

| id | Lacuna | Evidência da ausência | Por que é fase 0 | Card sugerido |
|---|---|---|---|---|
| G-01 | **Geração da locução (TTS)** — o documento pressupõe narração pronta em três lugares (`RM:27`, `RM:94`, `RM:101`) e nunca diz de onde ela vem | zero ocorrências de `TTS`, `text-to-speech`, `voz`, e nenhum provedor nomeado; "locução" aparece só em `RM:27` e `RM:101` | sem áudio de fala não há timing, e **todo** o pipeline visual é escravo do timing | Decidir e provar uma fonte de locução (TTS local × TTS pago × gravação), com um WAV de 10 s produzido nesta máquina |
| G-02 | **Fonte do roteiro** — o manifesto JSON aparece já pronto (`RM:21`, `RM:32`); quem o escreve, a partir de quê, com qual verificação factual? | "roteiro" só em `RM:141` ("roteiro literário"), sem entrada, sem prompt, sem revisão | é a entrada do sistema; sem contrato de entrada não há fatia vertical (Q2) | Definir o contrato de entrada: de tema → roteiro → manifesto, com um exemplo pinado |
| G-03 | **B-roll / imagens de stock** | zero ocorrências de `B-roll`, `stock`, `Pexels`, `Unsplash` | 100 s de vídeo não se sustentam com título + código + meme; a lacuna aparece na primeira produção real | Decidir a política de imagem de fundo/apoio e sua origem |
| G-04 | **Música de fundo** — citada como problema de mixagem (`RM:99`) e nunca como asset a adquirir | `música` zero ocorrências; `music` só em `RM:99` e numa referência (`RM:234`) | o ducking (`RM:101`) não tem o que abaixar | Escolher acervo e formato da trilha, com um arquivo de exemplo no repo |
| G-05 | **Licenciamento de tudo** — do Remotion, dos GIFs, das músicas, dos SFX, das fontes, dos modelos Whisper | **zero ocorrências de `licen`, `copyright`, `direitos`** em todo o documento | licença é decisão de dono (`CP:24`), tem prazo jurídico e **pode inviabilizar a stack inteira depois de 40 cards** | Levantar a matriz de licenças de cada dependência e cada asset; virar ADR com sign-off |
| G-06 | **Atribuição obrigatória de plataforma** (ex.: marca da fonte de GIFs no vídeo) | `RM:79` cita pingback mas nada sobre atribuição visual | é requisito de **saída visual**, muda a composição | Conferir os termos e, se exigido, criar o componente de atribuição |
| G-07 | **Thumbnails** | zero ocorrências de `thumbnail`/`miniatura` | é um artefato de saída distinto do vídeo e o de maior impacto no alvo declarado (YouTube, `RM:6`) | Gerar thumbnail a partir de um frame nomeado da composição |
| G-08 | **Legendas queimadas × sidecar** | zero ocorrências de `SRT`, `VTT`, `sidecar`, `queimad` | o documento só descreve legenda **queimada** (`RM:93-95`) e nunca decide; sidecar é requisito de acessibilidade e de SEO | Decidir e produzir os dois artefatos, ou registrar a decisão de não produzir |
| G-09 | **Formato vertical / shorts / multi-aspecto** | zero ocorrências de `vertical`, `shorts`, `9:16`, `aspect` | reaproveitar o mesmo manifesto em 9:16 muda **layout de todos os componentes**; decidir depois é reescrever a fase 6 | Declarar os formatos alvo e provar que a composição parametriza largura/altura |
| G-10 | **Resolução, fps e duração — nenhum número existe** | zero ocorrências de `1920`, `1080`, `fps`; `resolução` só em `RM:93` (sobre milissegundos); "quadros por segundo" só em `RM:156` | são os **três parâmetros que definem qualquer composição**; sem eles não há como escrever nem o card raiz | Fixar `width/height/fps/durationInFrames` no config e no manifesto |
| G-11 | **Versionamento e proveniência de assets** | `versionamento` só em `RM:186`, como *benefício retórico* | GIFs vêm da rede (`RM:32`), WebMs são gerados (`RM:67`): sem hash e lockfile, o "determinístico" de `RM:6` é falso | Lockfile de assets: url/id → hash → caminho local, verificado no gate |
| G-12 | **Cache de render** | `cache` aparece **uma vez**, como a flag `--bundle-cache` (`RM:117`) | Manim é caro (`RM:57`) e nada evita re-render de gráfico inalterado; sem chave de cache, a iteração diária morre | Cache por hash de entrada para saídas do Manim, do Giphy e do Whisper |
| G-13 | **Custo de LLM** | `custo` aparece **uma vez**, em `RM:6`, para dizer que é ~zero | o custo real deste sistema é token de LLM, não CPU; o documento inverte o eixo econômico | Instrumentar custo por vídeo (tokens de roteiro + iterações de código) |
| G-14 | **Observabilidade** | zero ocorrências de `observabilidade`, `métrica` fora de contexto de analytics de GIF | um render de 100 s que falha aos 80% sem log útil custa a iteração inteira | Log estruturado por etapa (manifesto → assets → render) com duração e código de saída |
| G-15 | **Teste automatizado do vídeo produzido** | `RM:179` ("tests exaustivos", sem definição) e `RM:173` (auditoria **visual manual** no Studio) são as duas únicas menções | o playbook define "iniciado" por golden master pinado (`PB:204-206`); aqui não há oráculo nenhum — ver §5 | Construir o oráculo mínimo (ver §5) **antes** do primeiro card de composição |
| G-16 | **Falha, retomada e idempotência** | zero ocorrências de `retry`, `concorr`; `falha` só em `RM:100` (em outro sentido) | Manim quebra, a rede da Giphy dá 429, o Whisper trava: o pipeline "síncrono" de `RM:69` não define nada disso | Definir a máquina de estados do runner: o que é retomável, o que é fatal |
| G-17 | **Revisão humana / aprovação** | **zero ocorrências de `revisão`, `humano`, `aprovação`** | o playbook exige sign-off nominal e datado onde há mandato (`PB:65-67`); publicar vídeo é irreversível | Definir o gate humano: quem assina que um vídeo pode sair, e sobre qual evidência |
| G-18 | **Publicação** | **zero ocorrências de `publica`, `upload`** — o documento termina com o arquivo "no diretório alvo local" (`RM:181`) | o valor só existe publicado; e publicação carrega metadados (título, descrição, tags, capítulos) que ninguém gera | Decidir manual × automatizado e listar os metadados exigidos |
| G-19 | **Idioma e acessibilidade** | zero ocorrências de `idioma`, `i18n`, `acessibilidade`; o único modelo nomeado é `base.en` (`RM:94`), **só inglês** | o dono do repositório escreve em pt-BR; um pipeline calibrado para inglês é retrabalho garantido | Declarar o idioma de produção e escolher o modelo compatível |
| G-20 | **Determinismo real (fontes, emoji, relógio, seed)** | `determinis` aparece em `RM:16` (sobre `setTimeout`); nada sobre carregamento de fontes, emoji, timezone, `Math.random` | o playbook manda congelar o relógio como camada própria de caracterização (`PB:212-213`) | Enumerar e neutralizar cada fonte de não-determinismo, uma por card |
| G-21 | **Segurança de credenciais** | `.env` citado uma vez (`RM:74`); nada sobre a chave vazar no bundle do browser onde o render roda | o render é um browser: variável mal exposta vira chave pública no artefato | Definir a fronteira: o que resolve no Node, o que chega ao browser |
| G-22 | **Ambiente-alvo real** | a Fase 1 fala de Windows/MiKTeX (`RM:132`); a máquina deste repositório é Linux | instruções escritas para o SO errado produzem uma fase 1 que ninguém consegue executar | Fixar o ambiente-alvo e reescrever os pré-requisitos para ele |
| G-23 | **Pinagem de versões** | nenhuma versão de nada é declarada no documento inteiro | `CP:111-112`: *"'Funciona' sem versão é afirmação sobre nada"*; e todo claim de API depende da versão | Pinar e registrar versões (Node, Python, Remotion, Manim, whisper.cpp, FFmpeg) |
| G-24 | **Gestão de dois gerenciadores de dependência** | `.venv` (`RM:133`) e npm coexistem sem contrato | dois lockfiles, dois caches, dois pontos de singleton (`PB:148-150`) | Definir a fronteira e o comando único que provisiona os dois |
| G-25 | **Loudness / normalização de áudio** | zero menções (`RM:99-102` fala de mixagem relativa, não de nível absoluto) | plataformas normalizam; áudio fora de faixa é reprovado por ouvido, não por gate | Definir alvo de loudness e medi-lo no gate |
| G-26 | **Formato de pixel e cor** | zero menções a `yuv420p`, gama, range | é a classe de bug que só aparece no player do espectador | Fixar pixel format e provar num arquivo de saída |
| G-27 | **Tipografia** | "tipografia" em `RM:26` e `RM:61` como estilo; nenhuma fonte nomeada, nenhuma licença, nenhum carregamento determinístico | fonte ausente no host = layout diferente a cada máquina = golden master inútil | Escolher, licenciar e embarcar as fontes; provar carregamento no render |
| G-28 | **Fallback sem GPU** | `RM:110` condiciona ("se o dispositivo dispor"), mas nenhuma fase constrói o caminho sem GPU | metade das máquinas não tem NVENC; sem fallback o pipeline não roda no CI | Caminho de render por software com tempo medido |
| G-29 | **Limites de escala do render** | zero menções a memória, concorrência de abas, duração máxima | composições longas estouram memória do browser headless — falha tardia e cara | Medir teto de duração/concorrência nesta máquina |
| G-30 | **Identidade estável do manifesto** | os nós não têm `id` (`RM:24-30`) | sem id estável não há re-render parcial, não há diff entre versões, não há cache (G-12) | Adicionar id e versão ao schema do manifesto |
| G-31 | **Critério de "pronto"** | `RM:181` diz "pronto para divulgação analítica global" | é o critério de aceitação do programa e não é falsificável (`PB:383`) | Escrever o critério de aceitação do vídeo como comando que sai `exit 0` |
| G-32 | **O documento que vence em caso de conflito** | o panorama não se declara superável nem nomeia sucessor | `PB:76-82` exige nomear o documento canônico **antes da primeira onda paralela** | Publicar o canônico que declara "supero `Roadmap Editor de Vídeo IA.md` §n" |

---

## 4. Q1..Q9 traduzidas para "construir um editor de vídeo programático do zero"

O playbook foi escrito para modernizar legado. Aqui não há legado — logo, cada pergunta troca
"o sistema que existe" por "o sistema que vamos construir **e** os sistemas de terceiros de que
ele depende". A tradução abaixo preserva a função de cada pergunta (`PB:40-51`).

### Q1 — De que o sistema é feito?
**Tradução:** quais runtimes, binários, pacotes e serviços externos compõem o pipeline, **em
quais versões**, e qual é o inventário do que precisa existir na máquina antes de qualquer card.
- **O panorama responde:** dois ecossistemas (`RM:7`); lista de pré-requisitos em `RM:130-133`
  (Node, FFmpeg, LaTeX, SoX, Cairo, venv); os pacotes citados ao longo do texto.
- **Fica em aberto:** **nenhuma versão** (G-23); quais dependências são obrigatórias × condicionais
  (`RM:132` mistura as duas); e se FFmpeg é mesmo do sistema (S-09). Sem isso não dá para escrever
  o card raiz sem citar tecnologia de destino — que é o critério de parada de `PB:53-54`.

### Q2 — Como o usuário atravessa o sistema?
**Tradução:** qual é a fatia vertical mínima — da intenção ("quero um vídeo de 100 s sobre X") ao
MP4 no disco — e quem é o usuário (o dono, sozinho, no terminal?).
- **O panorama responde:** um encadeamento tecnológico em `RM:32` (manifesto → assets → render) e
  as sete fases (`RM:124-181`).
- **Fica em aberto:** a travessia **começa** antes do manifesto (G-02) e **termina** depois do MP4
  (G-18), e nenhuma das duas pontas existe. Também não há a fatia vertical mais fina possível:
  um vídeo de 5 segundos com **um** nó de cada tipo, ponta a ponta. Esse deveria ser o card 1.

### Q3 — Quais regras não são inferíveis do nome?
**Tradução:** quais comportamentos destas bibliotecas um programador competente **erraria por bom
senso** — que é a definição de conhecimento negativo do playbook (`PB:110-113`).
- **O panorama responde:** cinco candidatos reais e valiosos — `<img>` dessincroniza GIF
  (`RM:79`); `setTimeout`/CSS quebram determinismo (`RM:16`); H.264 não carrega alfa (`RM:63`);
  `clamp` nas extrapolações evita escala negativa (`RM:41`); padding de mp3 gera offset (`RM:102`).
- **Fica em aberto:** **nenhum deles tem placar** (`CP:16-17`), e três dos cinco vizinhos imediatos
  são suspeitos altos (S-02, S-08, S-10). É exatamente a situação que `PB:44` descreve: *"um agente
  escreve lógica plausível e errada"* — só que aqui a lógica plausível e errada está **no
  panorama**, pronta para ser copiada.

### Q4 — Qual o modelo de dados?
**Tradução:** qual é o schema do manifesto — o único artefato que atravessa todos os subsistemas.
- **O panorama responde:** cinco tipos de nó e o componente de cada um (`RM:24-30`).
- **Fica em aberto:** não há schema, não há tipos, não há campo obrigatório, não há id (G-30), não
  há duração, não há ordem explícita, não há versão do schema, e não há um exemplo completo de
  manifesto **em lugar nenhum do documento**. Sem isso não há fixture e não há mock (`PB:45`).

### Q5 — Quem mais depende do que vamos mexer?
**Tradução (a que mais muda no greenfield):** não há sistema alheio a quebrar; o blast radius é
**interno e futuro**. Duas leituras: (a) quais artefatos, uma vez publicados, viram contrato para
os cards descendentes; (b) quais **recursos singleton** limitam o paralelismo (`PB:148-150`).
- **O panorama responde:** nada — não é uma pergunta que um panorama tecnológico faça.
- **Fica em aberto, e é acionável agora.** Singletons visíveis já no texto: `package.json` e o
  lockfile; `remotion.config.ts`; o arquivo de entrada de composições (`RM:171` manda substituir
  `<Sequence>` por `<TransitionSeries>` — edição no arquivo mais disputado do projeto); o
  diretório `public/assets/` (`RM:67`, `RM:149`, escrito pelo Manim **e** pelo Giphy); o `.venv`;
  a porta do Studio; o `.env` (`RM:74`); e o próprio manifesto JSON. **Cada um vira dono exclusivo
  ou sequência** — é o teto real de paralelismo do programa.

### Q6 — Como o sistema recebe identidade?
**Tradução:** quais credenciais o pipeline precisa e como cada uma chega ao processo certo.
- **O panorama responde:** uma — a chave do Giphy em `.env` (`RM:74`).
- **Fica em aberto:** a credencial do LLM (o documento inteiro depende dela e nunca a menciona), a
  do TTS (G-01), a de publicação (G-18); e a fronteira Node × browser (G-21) — o render é um
  browser, e o documento nunca diz o que pode atravessar essa fronteira.

### Q7 — O que é risco e o que é dívida?
**Tradução:** o que, se estiver errado, **derruba a arquitetura** (risco) × o que apenas custa
retrabalho localizado (dívida).
- **Risco (derruba a arquitetura):** alfa não sobreviver Manim→WebM→Remotion (S-10, C23);
  não haver timing por palavra (S-04); determinismo não existir (C04, G-20); licença comercial
  proibir o uso (G-05); não haver oráculo (G-15, §5).
- **Dívida (retrabalho local):** nomes de componentes (S-15); a faixa de bitrate (C90); o valor
  de `durationRestThreshold` (S-02); a janela de 1-2 s do meme (C22); a escolha de presentation
  (S-01, se houver substituto).
- **O panorama responde:** nada — ele apresenta todos os itens com o mesmo peso retórico, que é
  precisamente o defeito que `PB:48` nomeia ("não há critério para priorizar ondas").

### Q8 — O que não veio?
Respondida na §3: **32 lacunas**, das quais 11 com **zero ocorrências** do termo no documento.

### Q9 — O que dá para verificar aqui × o que exige ambiente real?
**Tradução:** separar o que um agente fecha sozinho, hoje, nesta máquina, sem rede.

| Classe | Exemplos | Regime (`CP:21-28`) |
|---|---|---|
| Verificável **offline, nesta máquina** | existência de export/flag (`--help`, `node -e "require(...)"`), schema do manifesto, render de 1 s, `ffprobe` do WebM do Manim, dois renders produzindo o mesmo hash | LEDGER-SEED que fecha rápido |
| Verificável **só com rede** | comportamento da API de GIFs, rate limit, formato das renditions, existência dos pacotes no registry | PESQUISAR (clusters R01..R16) |
| Verificável **só com este hardware** | NVENC disponível, tempo real de render, teto de memória, ganho do OpenGL (C46) | LEDGER-SEED com comando e denominador |
| **Não verificável — exige o dono** | licença comercial, orçamento de LLM, idioma, plataformas alvo, apetite de risco quanto a determinismo | PERGUNTA-DONO; nunca deduzir (`CP:27-28`) |
| **Não verificável por ninguém como está escrito** | "indistinguível de uma captura de ecrã" (C65); "pronto para divulgação" (C113); "sem perdas processuais" (C115) | reescrever como critério ou descartar |

---

## 5. Qual é o oráculo deste projeto?

No playbook o oráculo é o sistema legado: *"Nenhuma conversão de uma unidade legada começa sem um
golden master pinado dessa unidade"* (`PB:204-206`), e golden master é definido como **bytes de
saída + diff de estado**, com normalização **por posição, nunca por valor** (`PB:224-225`).

Aqui não há legado. **E há um problema mais duro que a ausência:** o produto é um vídeo, cuja
qualidade final é um julgamento estético humano. Não existe um artefato prévio que diga "o certo é
este". Se importarmos a regra ingenuamente, o programa nunca começa.

A saída não é abandonar a regra — é reconhecer que **o oráculo se decompõe em camadas**, e que
cada camada tem um custo e um limite. E há uma restrição que atravessa todas elas:

> *"O oráculo e a implementação não podem derivar da mesma premissa não verificada."* — `PB:322`

Isso **elimina de saída** o oráculo mais tentador: gerar o vídeo a partir do manifesto e conferir o
vídeo contra o mesmo manifesto. As duas cópias erram juntas (`PB:528`).

### Candidato A — Timeline resolvida como artefato textual pinado
**O que é:** o runner (`RM:32`) não deve ir direto do manifesto ao render. Ele deve emitir um
artefato intermediário — a **timeline resolvida**: para cada nó, `id`, frame inicial, frame final,
assets referenciados **com hash**, e parâmetros de animação já calculados. Esse JSON é
determinístico, diffável, e `git diff --exit-code` funciona nele.
- **Por que é o melhor primeiro oráculo:** é barato (texto), roda em milissegundos, cobre a classe
  de erro mais frequente (deslocamento de tempo), e falha **antes** de gastar minutos de render.
- **Custo:** exige construir o runner como etapa separada — trabalho que o panorama descreve
  (`RM:32`) mas que **nenhuma fase constrói** (I-09). Ordem de grandeza: um card.
- **Limite duro:** prova aritmética de tempo, **não prova pixel nem som**. E cai na armadilha de
  `PB:322` se a timeline for gerada pelo mesmo código que renderiza — a asserção tem de vir de uma
  **expectativa escrita à mão** para a fixture, não de outra execução do mesmo motor.
- **Armadilha:** `git diff --exit-code` num diretório de saída **não enxerga arquivo não
  rastreado** (`PB:523`). A captura tem de falhar se o arquivo esperado não existir.

### Candidato B — Vídeo canário: bytes pinados de uma composição mínima
**O que é:** uma composição de ~5 s que exercita **um nó de cada tipo** (`RM:24-30`), com todos os
insumos congelados no repositório (WAV de locução fixo, WebM do Manim commitado, GIF baixado e
commitado, trecho de código fixo). Renderiza-se uma vez, pina-se o hash do arquivo **e** o
relatório de `ffprobe`. Qualquer bump de versão que mude o resultado fica vermelho.
- **É o mais próximo de um golden master no sentido do playbook** (bytes de saída, `PB:224`).
- **Custo:** (a) precisa dos insumos congelados, o que depende de resolver G-01, G-11 e G-27
  primeiro; (b) precisa de tempo de máquina a cada execução do gate; (c) **precisa ser recapturado
  a cada atualização de Remotion, Chrome, FFmpeg ou driver de GPU** — e o playbook exige declarar
  por escrito o dia em que a caracterização deixa de ser reproduzível (`PB:219-220`).
- **Limite duro:** encoders **não são bit-a-bit determinísticos** entre versões e entre
  hardware — em particular com NVENC (`RM:110`). Um hash de MP4 pode falhar por motivo irrelevante
  e ensinar a equipe a ignorar o alarme, que é o pior desfecho possível (`PB:532`). Mitigação:
  pinar bytes **do frame PNG**, não do container, e usar encoder por software no gate mesmo quando
  a produção usa GPU — declarando essa diferença por escrito.
- **Falso verde específico:** se o canário renderizar com fundo preto porque o alfa se perdeu
  (S-10), o hash é estável e verde — e o defeito passa. Por isso o canário precisa de **uma
  asserção positiva de conteúdo**, não só de estabilidade: por exemplo, "no frame 40 o pixel
  (10,10) tem a cor do fundo global, não preto" (`PB:255-256`: *assertar conteúdo, não status*).

### Candidato C — Oráculo estrutural por `ffprobe` (o mais barato e o mais subestimado)
**O que é:** um gate que lê o artefato de saída e asserta propriedades estruturais: duração exata
em frames, fps, resolução, codec, `pix_fmt`, número de trilhas, taxa de amostragem, presença de
canal alfa nos intermediários do Manim.
- **Custo:** quase nulo; roda em segundos; não depende de nenhuma decisão estética.
- **Por que importa mais do que parece:** cobre G-10, G-26, e detecta S-10 diretamente no
  intermediário (`ffprobe` do WebM revela se o `pix_fmt` tem canal alfa **antes** de o vídeo
  chegar ao Remotion). É o oráculo que pega o erro na fronteira certa.
- **Limite duro:** um vídeo de 100 s totalmente preto passa em todos os critérios. Este oráculo
  **nunca** pode ser o único — é a definição de "o smoke passaria com uma página em branco?"
  (`PB:326-327`).

### Candidato D — Oráculos de propriedade (invariantes, não valores)
**O que é:** asserções sobre o vídeo que são verdadeiras por construção e falsificáveis por
máquina, sem depender de um artefato de referência: nenhum frame 100% preto fora dos cortes
declarados; a soma das durações dos nós é igual à duração da composição; nenhuma legenda ultrapassa
a área segura (fecha S-06/C75, que **nenhum outro oráculo pega**); pico de áudio abaixo de 0 dBFS;
todo nó do manifesto tem ao menos um frame em que é visível.
- **Custo:** cada invariante é um pequeno programa; a extração de frames custa tempo de render.
- **Limite duro:** invariantes provam que o vídeo **não está quebrado**, nunca que está **bom**.
  E são escritas pela mesma pessoa que escreve o motor — mitigação: o playbook manda que as
  perguntas venham do card, escritas por quem orquestra, **antes** (`PB:329-331`).

### Candidato E — Round-trip: transcrever o vídeo renderizado de volta
**O que é:** rodar o Whisper **sobre o MP4 final** e comparar o texto obtido com o roteiro de
entrada, e os tempos com a timeline resolvida (Candidato A).
- **Por que é forte:** é o único candidato cujo oráculo **não deriva da mesma premissa** que a
  implementação (`PB:322`) — ele mede o artefato final pelo sentido, não pela receita.
- **Custo:** minutos por execução; exige o Whisper funcionando (que é ele mesmo um item em
  disputa, S-04); e é **sensível à locução**, não ao visual.
- **Limite duro:** o Whisper não é determinístico entre versões, threads e quantizações. A
  comparação tem de ser por **distância tolerada** (ex.: taxa de erro de palavra abaixo de um
  limiar), nunca por igualdade — e um limiar frouxo demais é decorativo (`PB:383`).

### Candidato F — O vídeo do Fireship como referência estética
**O que é:** o alvo declarado do documento (`RM:6`).
- **Custo/limite — e por isso ele está por último:** não é reproduzível (não temos o projeto que o
  gerou), não é falsificável por máquina (semelhança estética não tem métrica aceita), e é
  **conteúdo de terceiro** — usá-lo como fixture no repositório é um problema de direitos
  (G-05). Ele serve como **referência de briefing para humano**, jamais como gate.
- **Registrá-lo como NÃO EXECUTADO é o desfecho honesto** (`PB:224-226`): a regra estética existe,
  roda fora do sistema, e a ausência de verificador tem de ficar escrita — porque *"a ausência de
  um verificador é indistinguível de conformidade"* (`PB:229`).

### Recomendação de composição

Nenhum candidato sozinho é o oráculo. A pilha mínima defensável, em ordem de construção:

1. **C (ffprobe)** — primeiro, porque é o mais barato e pega a falha de alfa na fronteira certa.
2. **A (timeline resolvida)** — segundo, porque força a existência do runner, que é a peça que o
   panorama descreve e não constrói.
3. **D (invariantes)** — terceiro, com pelo menos **um critério que falhe por ausência**
   (`PB:386`): se o diretório de frames capturados estiver vazio, o gate fica **vermelho**,
   não verde.
4. **B (canário)** — quarto, pinando **frames PNG**, não o MP4, e com encoder por software no gate.
5. **E (round-trip)** — quando o áudio existir (G-01), rodando fora do gate rápido.
6. **F** — nunca como gate; registrado por escrito como regra manual.

E o estado que **não pode existir**: um veredito `CONFERE` sem evidência anexada (`PB:503-504`).
Enquanto a pilha não estiver de pé, o rótulo correto de cada card de composição é
`NÃO_COLETADO` — que, pela regra, **nunca** vira `CONFERE` sozinho.

---

## 6. Refutações internas — o que o próprio documento derruba

Estas **não dependem de pesquisa web**: são contradições provadas comparando duas linhas do mesmo
arquivo. São o material mais sólido deste cluster.

| id | O que o panorama diz | Onde ele se contradiz | Consequência |
|---|---|---|---|
| I-01 | O título da seção é "Code Hike **e `@remotion/code`**" (`RM:81`) | o corpo da seção (`RM:83-85`) nunca menciona `@remotion/code`; só Code Hike e Shiki | ou a seção está incompleta, ou o pacote entrou no título por associação; um card que "implemente a seção" não sabe qual das duas coisas usar |
| I-02 | `manim render src/scripts/architecture.py **GraphScene** -t --format=webm -ql -o ...` (`RM:67`) | `manim render grafico.py -t --format=webm --renderer=opengl` (`RM:148`), **sem nome de cena** | um dos dois comandos não roda; ambos são copiáveis; ambos aparecem como instrução executável |
| I-03 | o áudio do Whisper deve ser **16 kHz** (`RM:94`) | "compilação cruzada universal prévia à codificação com FFmpeg para uma taxa uniforme estrita nos **48000 Hz**" (`RM:102`) | "universal" e "estrita" tornam as duas regras incompatíveis; ninguém diz qual arquivo vai para qual taxa |
| I-04 | "custo de renderização local praticamente nulo" (`RM:6`) | o documento exige GPU NVENC, bitrate de 18M e descarta o AV1 por ser **lento demais** (`RM:110-120`) | o custo é tempo de máquina e ele é o fator que decide o codec — logo não é nulo. O claim econômico central é derrubado pelo próprio texto |
| I-05 | Fase 7 se intitula "Emissão do Artefato Mestre com Suporte à **Nuvem**/GPU Local" (`RM:175`) | `RM:106` define o pipeline por "desvios explícitos às renderizações paradas na nuvem (AWS Lambda ou Vercel)" | o título anuncia uma capacidade que o corpo rejeita; nenhuma fase constrói caminho de nuvem |
| I-06 | `<Html5Audio>` "falha em contextos iterativos restritos e **SSR**" (`RM:100`) | o documento afirma que o render roda num "browser invisível" (`RM:79`) e em "ambiente de browser total" (`RM:85`) | SSR não é o regime descrito; a justificativa para trocar de componente não se sustenta **com as próprias premissas do documento** |
| I-07 | "o desenvolvimento obedece a **sete fases incrementais**" (`RM:124`), ordenadas Node→Manim→Giphy→Whisper→Composição→Render | o método normativo diz que "o eixo é **ordem de risco**, não camada" (`PB:96`) e exige trilhas transversais fora das fases (`PB:98-101`) | o faseamento é por camada tecnológica: os riscos que matam o projeto (alfa, determinismo, licença, oráculo) só apareceriam nas fases 3, 6, 7 — ou nunca |
| I-08 | `<Series>` é apresentado como "a arquitetura preconizada" (`RM:45-46`) | duas linhas depois `<TransitionSeries>` é "a evolução natural" (`RM:46`), e a Fase 6 manda substituir (`RM:171`) | a recomendação se anula no mesmo parágrafo; um card não sabe qual implementar |
| I-09 | "Um processo utilitário (Node.js *runner*) analisa preventivamente este manifesto" (`RM:32`) | **nenhuma das sete fases** (`RM:126-181`) constrói esse runner; as fases 3 e 4 descrevem os passos como ações do operador | a peça central da arquitetura não tem card, e é justamente a peça de que o oráculo A depende |
| I-10 | o vídeo é "determinístico, repetível" (`RM:6`) | o pipeline consulta a API de GIFs em tempo de build (`RM:32`, `RM:74`), cujo resultado de busca muda entre execuções | determinismo e busca ao vivo são incompatíveis sem um lockfile de assets, que não existe (G-11) |
| I-11 | a arquitetura escolhe o renderer OpenGL para ganhar velocidade (`RM:57`, `RM:148`) | o mesmo texto atribui a "reprodutibilidade perfeita" ao caminho **Cairo/CPU** (`RM:56`) | o documento escolhe, para um projeto que se vende como reprodutível (`RM:6`), justamente o caminho que ele próprio classifica como o menos reprodutível |
| I-12 | `durationRestThreshold` "por predefinição situado nos 0.005" (`RM:47`) | a Fase 6 manda usar "cerca de 0.001" (`RM:172`) — e "cerca de" num valor de limiar não é um valor | o default aparece em prosa e a recomendação é aproximada: se o default real já for 0.001, a otimização é no-op e o card passa verde sem efeito (`PB:527`) |
| I-13 | 57 referências numeradas (`RM:188-246`) dão ao documento aparência de trabalho corroborado | pela regra do próprio contrato deste programa (`CP:39`), elas colapsam em **20 domínios**; `remotion.dev` responde por 26 das 57 e vale **1 fonte** | a densidade de citação é 3× maior que a densidade de corroboração — e nenhum claim do documento traz placar |
| I-14 | a tese econômica de `RM:6` é ancorada na referência 1 | a referência 1 é `pexo.ai/blog/remotion-alternatives` (`RM:190`), blog comercial de um concorrente/fornecedor no mesmo mercado | `CP:38`: nenhum claim fecha só com secundárias — e esta é secundária **e** parte interessada |

---

## 7. Saída para o orquestrador

**Sementes de ledger** (só a máquina responde) e **perguntas-dono** (só o humano responde) estão
no resumo estruturado devolvido ao orquestrador, não duplicadas aqui — `PB:410` proíbe redigitar
estado derivado.

**O que este arquivo entrega para as ondas seguintes:**
- 118 claims endereçados por cluster (§1) — nenhum deles pode virar card sem placar (`CP:16-17`).
- 16 suspeitas fortes com o teste que fecha cada uma (§2) — a fila de trabalho de R01..R16.
- 32 lacunas de fase 0 (§3).
- 14 refutações internas (§6) — **estas já estão fechadas** e não precisam de web.
- Uma pilha de oráculos em 6 camadas com ordem de construção (§5).

---

## Não verificado

Tudo nesta seção entrou **sem citação `arquivo:linha`** e **sem placar**. É memória do agente, não
evidência. Nenhuma linha daqui pode virar card, e nenhuma pode ser tratada como refutação —
o rótulo correto de todas é `NÃO VERIFICADO` (`CP:45`). Cada uma existe aqui por um motivo só:
dizer ao cluster de pesquisa **onde procurar primeiro**.

| # | Hipótese não verificada (memória do agente, sem fonte) | Cluster | Comando/consulta que fecha |
|---|---|---|---|
| NV-01 | Suspeito que ferramentas de render modernas embarquem o próprio FFmpeg, tornando o pré-requisito de `RM:131` desnecessário | R05, R10 | conferir a doc oficial de instalação; e na máquina, comparar `ffmpeg -version` com a versão relatada no log de um render |
| NV-02 | Suspeito que exista um componente de vídeo alternativo ao `<Video>` recomendado para arquivos com alfa | R01, R10 | página de referência dos componentes de mídia da versão instalada |
| NV-03 | Suspeito que a função de legendas estilo TikTok agrupe por **janela de tempo**, não por caixa visual | R03 | assinatura e parâmetros da função na doc; testar com uma frase longa |
| NV-04 | Suspeito que `t_dtw` seja campo de struct C do whisper.cpp, possivelmente não exposto no retorno JS | R03 | tipo de retorno do wrapper; `console.log` de uma transcrição real |
| NV-05 | Suspeito que o renderer OpenGL do Manim tenha suporte a transparência diferente (ou ausente) em relação ao Cairo | R07 | rodar `-t --renderer=opengl --format=webm` e conferir `pix_fmt` com `ffprobe` |
| NV-06 | Suspeito que `use_projection_stroke_shaders` seja chave de arquivo de configuração, não flag de CLI | R07 | `manim render --help` e a doc de configuração |
| NV-07 | Suspeito que exista licença comercial paga para uso do Remotion por empresas acima de certo porte | R05, **PERGUNTA-DONO** | página oficial de licenciamento; e a decisão é do dono, não do agente |
| NV-08 | Suspeito que stickers transparentes tenham endpoint próprio, e não sejam obtidos por palavra-chave na busca de GIFs | R08 | lista de endpoints da API |
| NV-09 | Suspeito que exista um pacote oficial de fontes que resolve o carregamento determinístico no render (G-27) | R14 | catálogo de pacotes oficiais |
| NV-10 | Suspeito que o comando canônico para abrir o Studio não seja `npm run dev` (`RM:173`), e que esse script dependa do template | R01 | doc do CLI; e `cat package.json` depois do scaffold |
| NV-11 | Suspeito que encoders de hardware não produzam saída bit-a-bit idêntica entre execuções/drivers, o que inviabiliza hash de MP4 como golden master (§5, candidato B) | R05, R11 | renderizar duas vezes o mesmo projeto e comparar `sha256sum` |
| NV-12 | Suspeito que a lista de presentations de transição seja fechada e pequena, o que tornaria a ausência de `pushCut` uma refutação por evidência positiva (`CP:113-116`) | R02 | página de referência que enumera todas as presentations |

**Escopo negativo deste arquivo:** ele não confirma nem refuta nenhuma API externa; não decide
stack; não escreve cards; e não é o documento canônico do programa — o canônico ainda não existe
(lacuna G-32), e `PB:82` exige que ele seja nomeado **antes da primeira onda paralela**.
