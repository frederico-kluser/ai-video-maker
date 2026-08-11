---
name: project-router
description: Routes EVERY task of this program to the correct tier and skill before any file is written, runs the fixed clarifying questionnaire in Brazilian Portuguese, and enforces the two mandatory skill loads. Use whenever the user asks for any change, card, fix, feature, render, plan, analysis or refactor, even if the user never mentions skills, routing, waves or a card id. Triggers — "implementa", "corrige isso", "renderiza", "cria a cena", "roda o card", "planeja a onda", "qual skill uso", "por onde comeco", "start this task", "which skill", "run card", "next wave", "monta o pipeline".
metadata:
  type: router
  tier: router
  verification_signal: "for s in project-router wave-planning parallel-worktrees adversarial-review falsifiable-gates uncertainty-ledger video-characterization timeline-manifest remotion-core remotion-render-pipeline manim-bridge audio-captions-sync asset-acquisition code-animation ffmpeg-media-ops llm-authoring motion-design-system tts-voiceover meta-skill-evolution meta-skill-consolidate; do test -f .agents/skills/$s/SKILL.md || { echo MISSING $s; exit 1; }; done && test $(ls -d .agents/skills/*/ | wc -l) -eq 20"
---
# Roteador do programa — Editor de Vídeo IA

Todas as perguntas ao usuário são feitas em **português brasileiro**. Este arquivo é a primeira
coisa carregada em qualquer tarefa e a última a ser consultada antes de encerrar.

## Quando carregar

- Qualquer pedido de trabalho neste repositório, antes de ler o segundo arquivo: escrever card,
  executar card, corrigir cena, ajustar render, medir, planejar onda, propor skill.
- Quando o usuário cola um **prompt de card** — o caminho é diferente do pedido avulso, e a
  diferença está descrita abaixo (§ Caso B).
- Quando a premissa de um card cai no meio da execução: o roteador decide se o caso é (i)..(iv)
  do playbook e quem recebe a refutação.
- **Não carregar** para responder pergunta factual pura sobre uma tecnologia ("o que faz
  `interpolate`?"): isso é conhecimento do modelo. E não carregar como substituto de
  `wave-planning` — o roteador escolhe skill, não escreve grafo nem tabela de ondas.

## Conhecimento injetado

Cada linha abaixo é **fato** (com placar `N-M` e fonte) ou **norma** (prescrição deste programa,
com `arquivo:linha`, sem placar — norma não é claim sobre o mundo).

**Convenção de âncora:** citação com prefixo `3b1b:` é caminho no repositório de **referência**
`/home/ondokai/Projects/3blue1brown`, não neste repositório. Aqui `.agents/scripts/` **não
existe** e `.agents/skills/validation-report.md` **não existe** — resolver esses caminhos contra
este repo dá arquivo ausente, ou pior, aponta para este próprio `SKILL.md`.

### Por que o roteamento é em dois níveis

Com 20 skills, escolher por casamento de palavra-chave num único passo é o desenho errado, e há
dois motivos de natureza diferente:

- No startup do agente entram **apenas `name` + `description`** de cada skill (~100 tokens cada);
  o corpo só entra na ativação e os recursos custam zero até serem lidos. — **Placar (3-0)** —
  fonte: https://agentskills.io/specification ·
  https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview ·
  https://code.claude.com/docs/en/skills. Consequência dura: a decisão de roteamento acontece
  contra **20 descrições**, nunca contra 20 corpos. Descrição vaga é skill invisível.
- Skill **aninhada** abaixo do cwd só carrega depois que o agente lê ou edita um arquivo naquele
  subdiretório. **Um só publicador afirma isso** — **Placar (1-0)**, fonte:
  https://code.claude.com/docs/en/skills (os outros dois publicadores da linha acima descrevem
  *onde* a skill mora, não a regra de cwd — não somam placar aqui). Mesmo assim o catálogo é
  plano — `.agents/skills/<nome>/SKILL.md`, um nível, sem grupos — porque a linha seguinte, essa
  sim executada, já basta. — **norma** — `docs/CONTRATO-DE-SKILL.md:114-135`.
- O linter varre **um nível só** (`glob("*/SKILL.md")`): skill aninhada com `type` inválido é
  pulada em silêncio, sem aparecer na saída. — **Placar (2-0)** — fonte:
  `3b1b:.agents/scripts/skill_lint.py:115` · sonda sintética E7 de
  `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:143-171`.
- **Norma:** o contrato obriga o roteamento em dois níveis e obriga esta skill a declarar a
  limitação no próprio corpo — `docs/CONTRATO-DE-SKILL.md:146-152`. O número que justifica a
  regra (`~15 skills`) é prosa de documento de desenho e **não foi medido**: ver
  `## Não verificado`.

**Nível 1 — escolha o tier pela natureza da tarefa, não pelo assunto.**

| Tier | A tarefa é… | Skills |
|---|---|---|
| `metodo` | sobre **como** trabalhar: planejar, isolar, revisar, gatear, registrar incerteza, caracterizar saída | S02, S03, S04, S05, S06, S07 |
| `dominio` | sobre **o que** o produto faz: manifesto, composição, render, Manim, áudio, assets, código, FFmpeg, LLM, motion, TTS | S08–S18 |
| `meta` | sobre o **próprio catálogo**: propor skill nova, consolidar, aposentar | S19, S20 |
| `router` | classificar, desambiguar, montar a cadeia | S01 (esta) |

Sempre há **≥1 skill de `metodo`** na cadeia. Uma cadeia só de `dominio` é sinal de que a tarefa
foi classificada como técnica quando é de execução — reclassifique.

**Nível 2 — dentro do tier escolhido, o mapeamento domínio → skill.** A subordinação é mecânica,
não retórica: leia **apenas as linhas cuja coluna `Tier` casa o tier fechado no Nível 1**, e leia
o tier inteiro antes de escolher. Varrer as 20 linhas de uma vez é roteamento de **um** nível com
uma etapa decorativa a mais — é exatamente a degradação que esta seção existe para evitar, e ela
não deixa rastro: a cadeia sai plausível e a skill de `metodo` que faltava nunca é notada.

| Se a tarefa toca em… | Carregar | Tier |
|---|---|---|
| grafo de dependências, nível, onda, largura, ordem de merge | `wave-planning` | metodo |
| worktree, branch, symlink de insumo, barreira, teardown, propriedade de arquivo | `parallel-worktrees` | metodo |
| revisão de contexto fresco, perguntas falsificáveis, refutação antes de encerrar | `adversarial-review` | metodo |
| critério de aceitação, sonda negativa, gate local, três estados, tripwire | `falsifiable-gates` | metodo |
| pergunta sem resposta, pressuposto, `// ABERTO`, faixa de id, inbox por card | `uncertainty-ledger` | metodo |
| golden master, `framemd5`, `ffprobe`, baseline visual, invariante, determinismo | `video-characterization` | metodo |
| manifesto, schema, timeline resolvida, versionamento por objeto, migração | `timeline-manifest` | dominio |
| `<Composition>`, `<Series>`, `<TransitionSeries>`, `spring`, `interpolate`, props | `remotion-core` | dominio |
| `renderMedia`, concorrência, chunking, codec, hwaccel, Chrome empacotado | `remotion-render-pipeline` | dominio |
| cena Manim, alfa, `-t`, `--format`, `media_dir`, ponte Manim→Remotion | `manim-bridge` | dominio |
| whisper, `--dtw`, `Caption[]`, alinhamento, sincronia legenda↔áudio | `audio-captions-sync` | dominio |
| GIF, sticker, stock, licença de asset, atribuição, lockfile de assets | `asset-acquisition` | dominio |
| destaque de sintaxe, Code Hike, tokens, transição de código, fonte mono | `code-animation` | dominio |
| concat, loudness, `ebur128`, `bitexact`, remux, medição de mídia | `ffmpeg-media-ops` | dominio |
| prompt, saída estruturada, `output_config.format`, cache de prompt, subset de schema | `llm-authoring` | dominio |
| duração de texto, safe area, contraste, flashes, presets de mola, `motion-invariants.json` | `motion-design-system` | dominio |
| voz, provedor de TTS, timing nativo, licença de peso, consentimento, disclosure | `tts-voiceover` | dominio |
| nenhuma skill cobre; o conhecimento é novo e verificado | `meta-skill-evolution` | meta |
| duas skills se sobrepõem; catálogo inchou; citação apodreceu | `meta-skill-consolidate` | meta |
| classificar, desambiguar, montar a cadeia | `project-router` | router |

**Colisões conhecidas deste catálogo** (resolva pelo *arquivo escrito*, não pela palavra):
"animação" casa `remotion-core`, `motion-design-system` e `code-animation`; "render" casa
`remotion-render-pipeline`, `manim-bridge` e `ffmpeg-media-ops`; "legenda" casa
`audio-captions-sync` e `motion-design-system`. **Norma:** o eixo é *quem escreve em qual
arquivo*, nunca *quem trabalha em qual assunto* — `docs/PLAYBOOK-REFERENCIA.md:145-147`.

### Caso A — pedido avulso: o questionário fixo, antes de tocar arquivo

Sete perguntas, sempre em português, sempre antes da primeira escrita. Cada uma existe por uma
armadilha **deste** projeto, não por higiene.

| # | Pergunta | Armadilha que ela cobre |
|---|---|---|
| Q1 | Esta tarefa altera **pixel ou som** do artefato final? Se sim, qual camada do oráculo cobre a mudança e quem autoriza re-baseline? | A versão do Remotion **pina a versão do Chrome** (`TESTED_VERSION`): bump de Remotion = novo rasterizador = recaptura de 100% das fixtures visuais. — **Placar (3-0)** — fonte: https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell |
| Q2 | O escopo **continua pessoal**? Se esta tarefa publica ou monetiza sob uma entidade, qual? | O enquadramento **já está decidido e assinado**: uso **pessoal**, ADR `0003`, a partir de `I-01` — **norma** — `PROGRAMA.md §III-14 · card I-01` · `PROGRAMA.md Apêndice C · ADR-0003`. Logo Q2 **não é gate de licença e não bloqueia card nenhum**; é o *tripwire* do único item permanentemente aberto do ledger (`AB-950`, `PROGRAMA.md §III-14 · card I-01, campo ledger`). O que a resposta muda: o gatilho de "organização com fins lucrativos e **mais de 3 empregados**" é real e é **(3-0)** (https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), mas **condicionado a escopo não-pessoal** — enquanto o uso for pessoal ele **não se aplica** — `[R01-02 (3-0)]`, condição em `PROGRAMA.md §I-3`. Por que perguntar mesmo assim: **não existe diferença de funcionalidade entre free e pago**, então uma mudança de escopo **não produz nenhum sinal técnico** — o pipeline continua verde — **Placar (2-0)** — fonte: https://www.remotion.dev/docs/license/faq |
| Q3 | Quais **caminhos de arquivo** você vai escrever, e quem mais escreve neles nesta onda? | Cards da mesma onda nascem de worktrees isoladas sobre a mesma base: o git **mergeia em silêncio** código que discorda. — **norma** — `docs/PLAYBOOK-REFERENCIA.md:159-161` |
| Q4 | O que esta tarefa **não** deve fazer, e qual card é dono do que ficou de fora? | Fronteira negativa com o **nome do card dono** é campo obrigatório do card. — **norma** — `docs/PLAYBOOK-REFERENCIA.md:110-118` |
| Q5 | Rede é permitida — em tempo de autoria, em tempo de render, em nenhum dos dois? | Quatro coisas são rede e a promessa "roda localmente" não as cobre, cada uma com fonte própria: `/remotion-docs` faz POST na Algolia — **(2-0)**, https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-docs/SKILL.md; `@remotion/sfx` exporta URLs `remotion.media` — **(2-0)**, https://github.com/remotion-dev/remotion/blob/main/packages/sfx/src/index.ts; `twoslash-cdn` baixa types em runtime — **(2-0)**, https://twoslash.netlify.app/packages/cdn; `@remotion/google-fonts` resolve para `fonts.gstatic.com` **no render** — **(2-0)**, https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/google-fonts/src/JetBrainsMono.ts. Instalar skills por `npx` também exige rede — **(2-0)**, https://www.remotion.dev/docs/ai/skills.md |
| Q6 | Qual comando prova a tarefa, e **o que ele imprime se a tarefa não fizer nada**? | O runner sai verde quando o filtro não casa teste nenhum; 25 de 42 cards do programa de origem já passavam antes da primeira linha escrita. — **norma** — `docs/PLAYBOOK-REFERENCIA.md:374-385` |
| Q7 | Isto é **caracterização** ou **TDD**? (comportamento que já existe × comportamento que não existe) | A disciplina é decidida na escrita do card, não pelo agente. — **norma** — `docs/PLAYBOOK-REFERENCIA.md:242-249` |

Não avance enquanto Q1, Q3 e Q6 estiverem sem resposta: são as três cujo erro só aparece no
merge ou na publicação, quando já é caro.

### Caso B — prompt de card: o card **já é** a especificação

Esta é a assimetria que mais se perde. **Norma:** *"Quando existe spec a montante, o ritual de
entrada não é 'perguntar', é diferença: perguntar só o delta, e ler o histórico das
dependências"* — `docs/PLAYBOOK-REFERENCIA.md:270-272`.

Com um card na mão, o protocolo muda assim:

1. **Não repita o questionário.** O card traz `contexto`, `entradas`, `restricoes`,
   `criterios_aceitacao` e a fronteira negativa. Reperguntar isso queima contexto e convida o
   usuário a improvisar uma resposta que contradiz o card.
2. **Pergunte só o delta**: o que o card assume e você não consegue observar; o que mudou no
   repositório desde que o card foi escrito; qual ancestral ainda não mergeou.
3. **Leia o handoff de TODA a cadeia de ancestrais**, não só do pai. No programa de origem,
   49 de 49 handoffs foram preenchidos e **zero** disseram "nada a propagar" — sem teto e sem
   campo de destinatário, o handoff vira ruído que ninguém lê. — **norma** —
   `docs/PLAYBOOK-REFERENCIA.md:545-548`. E irmãos da mesma onda são **cegos entre si por
   construção**: o que o irmão descobriu não chega a você — `docs/PLAYBOOK-REFERENCIA.md:549`.
4. **Se a premissa do card cair**, o executor não reescreve o card: cumpre pelo que o card quis,
   entrega menos e **nomeia a diferença** no handoff, endereçada ao descendente nomeado que vai
   tropeçar nela. — **norma** — `docs/PLAYBOOK-REFERENCIA.md:336-352`.
5. O card é uma **hipótese**; o que vincula é o critério de aceitação, não a premissa. Nada para.

### O plano descartável e os artefatos que nunca se apagam

`TASK_PLAN.md` é escrito em português, fica **gitignorado**, e é **apagado ao concluir**. Ele
registra o acordo da desambiguação, a cadeia de skills escolhida e os critérios; não é entregável.

**Apagar o plano não é concluir a tarefa** — é o último passo depois do gate verde.

Nunca apague, nunca reescreva "para arrumar", nunca mova — esta lista é nominal e fechada:

| Artefato permanente | Por quê |
|---|---|
| `docs/00-panorama-verificado.md` | lei factual do programa — **vence sobre FATO**; dono exclusivo é o agente de síntese |
| `docs/PLAYBOOK-REFERENCIA.md` | método normativo — **vence sobre MÉTODO e sobre qualquer skill**, e é **subordinado ao `PROGRAMA.md`** (`:8-10`) |
| `docs/CONTRATO-DE-SKILL.md`, `docs/CONTRATO-DE-PESQUISA.md` | contratos de onda, commitados antes dos agentes |
| `docs/pesquisa/**` (19 arquivos) | fontes literais e comandos de reconferência; o panorama é só o índice |
| `PROGRAMA.md` | documento canônico do programa — **vence sobre PLANO** (cards, ondas, grafo, ordem) e declara o que supera (`README.md:29-32`, `PROGRAMA.md §preâmbulo canônico`) |
| `Roadmap Editor de Vídeo IA.md` | panorama **histórico** — superado no que diverge; nunca editar, nunca citar como fato corrente |
| `.agents/skills/**/SKILL.md` | *o arquivo de skill **é** a memória — não há arquivo de aprendizados e não há buffer* (`docs/PLAYBOOK-REFERENCIA.md:422`) |
| `.agents/skills/catalog.md`, `.agents/skills/skill-map.md` | pontos de composição; escritos por quem orquestra, gerados, nunca redigitados em paralelo |
| ADRs (`Guarda executável`, `Supera`, `O que o sign-off NÃO autoriza`) | decisão sem guarda é intenção |
| Ledger de incerteza (inbox por card, ids nunca reciclados) | fila de trabalho para o dia do acesso, não registro de riscos |
| Baselines aprovados, `tool-versions.lock`, `motion-invariants.json` | identidade do oráculo; execução vermelha escreve em `*.received/` e **nunca** sobrescreve a linha de base (`docs/PLAYBOOK-REFERENCIA.md:257`) |
| Handoffs de card | é o único canal entre ondas |

### As duas regras não negociáveis de carregamento

Duas, não vinte — e são estas duas porque as falhas que elas cobrem são **silenciosas e
confirmatórias**: o pipeline retorna sucesso e o artefato errado parece certo.

A classe de tarefa que dispara cada uma é **decidível sem julgamento**: no Caso A é literalmente a
resposta de **Q1** (Regra 1) e a de **Q3** (Regra 2); no Caso B são os campos `entradas` e a
fronteira negativa do card. "Quando fizer sentido" não é gatilho — se a classe não foi decidida, a
tarefa ainda não começou.

**Regra 1 — classe de tarefa: escreve, regrava ou reordena qualquer coisa que chegue ao pixel ou
ao áudio do artefato final (Q1 = sim). Essa tarefa carrega `video-characterization` antes de
implementar.**

- No Manim CE, `--format=mp4` combinado com `-t` entrega **`.mov` silenciosamente**, com exit 0
  — a extensão é resolvida pelo `-t`, não pelo `--format`. — **Placar (3-0)** — fonte:
  https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/_config/utils.py
- **Escopo: só no caminho `--format=webm`.** O Manim só põe alfa no webm quando
  `config.transparent` **e** extensão `.webm` valem ao mesmo tempo; perder o `-t` derruba o
  `pix_fmt` de `yuva420p` para `yuv420p` e o vídeo entra com **fundo preto**, sem erro. No
  caminho `.mov` o codec é `qtrle`+`argb`, outro modo de falha. Não generalize a regra para
  "Manim sem `-t` = fundo preto". — **Placar (2-0)** — fonte:
  https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py
- `createTikTokStyleCaptions()` quebra página por **duas** condições juntas — o `text` do caption
  começar com **espaço** *e* o acumulado passar de `combineTokensWithinMilliseconds`. Não recebe
  largura, fonte nem viewport, logo não pode saber de overflow — e overflow **não muda o exit code
  do render**. Guardar a metade temporal e esquecer a lexical é o erro caro: um `.trim()` em
  qualquer passo a montante colapsa tudo numa página só, e o sintoma é visual. — **Placar (2-0)**
  — fonte:
  https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/create-tiktok-style-captions.ts
- Um vídeo de 100 s totalmente preto passa em todos os critérios estruturais de `ffprobe`.
  — **norma** — `docs/00-panorama-verificado.md §9.2, Camada 0`.
- Dos dois fornecedores conferidos, **nenhum** garante saída idêntica: a Anthropic documenta que
  nem com `temperature: 0.0` o resultado é determinístico e não expõe `seed`; a OpenAI chama
  `seed` de best-effort. (Escopo: dois fornecedores, não "todo LLM".) A fixture de regressão é o
  **manifesto congelado**, nunca saída de LLM contra saída de LLM. — **Placar (2-0)** — fonte:
  https://platform.claude.com/docs/en/api/messages.md ·
  https://developers.openai.com/cookbook/examples/reproducible_outputs_with_the_seed_parameter

**Regra 2 — classe de tarefa: escreve em algum caminho que outro card da mesma onda também
escreve, ou roda em worktree/branch que vai mergear (Q3 lista mais de um dono). Essa tarefa
carrega `parallel-worktrees` antes de implementar.**

- `git worktree add` materializa **apenas o conteúdo rastreado**: `node_modules/`, `.env` e
  assets gerados não vão junto, e o ambiente que falha em silêncio produz agente confiante e
  errado. — **Placar (3-0)** — fonte: https://git-scm.com/docs/git-worktree ·
  https://code.claude.com/docs/en/worktrees
- `claude --worktree` ramifica do **branch default do remoto**, não do `HEAD` — é a diferença
  entre a onda N+1 ver ou não o trabalho da onda N. — **Placar (2-0)** — fonte:
  https://code.claude.com/docs/en/worktrees
- Um padrão de `.gitignore` **com barra final** (`assets/`) não casa um symlink de mesmo nome:
  ele fica untracked e `git add -A` o commita com caminho absoluto. — **Placar (2-0)** — fonte:
  https://git-scm.com/docs/gitignore
- Mesclar mais de um branch usa **octopus** por padrão, que desiste do lote inteiro no primeiro
  conflito; e `revert -m 1` desfaz todos os contribuintes de uma vez. Merge é um a um, com gate
  completo entre cada. — **Placar (2-0)** — fonte: https://git-scm.com/docs/git-merge ·
  https://git-scm.com/docs/git-revert

Se a tarefa cai nas duas classes, as duas skills entram — não há "a mais relevante".

### Ao concluir

1. Rode o gate declarado no Q6 e cole a **saída**, não a conclusão.
2. Execute o `<evolution>` de cada skill envolvida (§ Evolution abaixo). Se nada importante e
   verificado foi aprendido, **não escreva nada** — esse é o desfecho saudável.
3. Escreva o handoff com teto de tamanho e **campo `destinatários:` preenchido** (vale escrever
   "nada a propagar").
4. Apague `TASK_PLAN.md`. Confira contra a tabela de artefatos permanentes antes de apagar
   qualquer outra coisa.
5. O agente **nunca** remove a própria worktree — quem orquestra remove, de fora, sob lock.

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Não copie o protocolo do `project-router` do repositório de referência.** O passo 1 dele
  manda *"FAÇA MUITAS PERGUNTAS"* incondicionalmente
  (`3b1b:.agents/skills/project-router/SKILL.md:12`). Com card a montante isso é errado por
  norma: pergunta-se o delta (`docs/PLAYBOOK-REFERENCIA.md:270-272`).
- **Não confie no `metadata.verification_signal` como gate.** Nenhum script do corpus de
  referência executa o comando declarado; ele é decorativo. — **Placar (2-0)** — fonte:
  `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:386-404`. O signal desta skill existe para ser
  rodado à mão até que um gate o execute.
- **Não escreva uma cópia da tabela de roteamento dentro de um teste.** No corpus de referência
  o `ROUTING_MAP` do eval não é o roteador — o roteador é a prosa do `SKILL.md` — e 15/15 verde
  não diz nada sobre o roteador que roda. — **Placar (2-0)** — fonte:
  `3b1b:.agents/scripts/run_skill_evals.py:286-303` ×
  `3b1b:.agents/skills/project-router/SKILL.md:37-44`. O oráculo tem de **ler esta tabela**,
  não duplicá-la.
- **Não use `exit 1` num hook de política.** Em `PreToolUse`/`PostToolUse`/`Stop` só o `2`
  bloqueia; qualquer outro código é erro **não-bloqueante** e a ação prossegue — o log mostra
  erro, o agente segue, o commit entra. — **Placar (3-0)** — fonte:
  https://code.claude.com/docs/en/hooks.md · https://www.schemastore.org/claude-code-settings.json
  **Duas exceções de escopo que somem se você memorizar "só 2 bloqueia":** em `WorktreeCreate`
  **qualquer** código diferente de zero aborta, e em `PostToolUse` o `2` **não desfaz** a
  escrita — só mostra o stderr ao modelo, depois de o arquivo já estar em disco. — **Placar
  (2-0)** — fonte: https://code.claude.com/docs/en/hooks.md
- **Não trate a denylist de bash do repositório de referência como defesa**: ela não bloqueia
  `rm -rf /`, `rm -rf ~` nem `sudo rm -rf /` — o caso literalmente nomeado na descrição do hook
  é o que passa. — **Placar (2-0)** — fonte: `3b1b:.agents/scripts/bash_guardrail.py:9-20` ·
  execução E5 em `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:671-713`.
- **Não trate a blocklist AST do `manim-api` como sandbox**: ela bloqueia **nomes**
  (`3b1b:manim-api/services/openai_service.py:21-35`), não capacidades, e o subprocess roda
  na conta do usuário com `os.environ` inteiro — enquanto o prompt afirma ao modelo que o
  ambiente é isolado. — **Placar (3-0)** — fonte:
  `3b1b:manim-api/services/manim_executor.py:63,144-151,218-220` · `3b1b:manim-api/prompts.py:4`.
- **Não bloqueie card por licenciamento comercial, e não reabra as quatro perguntas de licença
  como se estivessem abertas.** O panorama as levantou como quatro assinaturas separadas
  (`docs/00-panorama-verificado.md §6.1 · P-01..P-04`) — e **`I-01` fechou as quatro de uma vez**
  num único ADR `0003`, `ACEITO`, com quatro decisões numeradas: uso **pessoal**. — **norma** —
  `PROGRAMA.md §III-14 · card I-01` · `PROGRAMA.md Apêndice C · ADR-0003`. As cláusulas que
  mordiam são todas **condicionadas a uso comercial** e por isso não alcançam este programa: o
  gatilho de >3 empregados do motor `[R01-02 (3-0)]`, o *"exploit any content for commercial
  use"* do provedor de GIF `[R08-05 (2-0)]`, os pesos de TTS sob licença não-comercial
  `[R13-20 (2-0)]` `[R13-21 (2-0)]`. Esse conhecimento **continua verdadeiro e continua útil** — é
  a condição de escopo que o torna verdadeiro. O que sobra são limites **técnicos**, não jurídicos
  (ex.: 1 req/s + cache de 24 h no provedor de GIF — `[§8.1 (1-0)]`, tabulado em
  `PROGRAMA.md §I-3`). O erro simétrico e igualmente caro: **estender o sign-off** para além do
  escopo pessoal sem reabrir — o item `AB-950` nasce aberto exatamente para isso
  (`PROGRAMA.md §III-14 · card I-01, campo ledger`).
- **Não roteie por semelhança de nome.** "manim" numa pergunta sobre ManimGL casaria a skill de
  render do corpus de referência — fragilidade registrada pelo próprio relatório de validação
  (`3b1b:.agents/skills/validation-report.md:189`). Neste catálogo o mesmo defeito mora em
  "animação" e "render": desempate pelo arquivo escrito.
- **Não crie skill aninhada nem renomeie diretório sem renomear `name`.** `name` tem de ser
  idêntico ao diretório pai, e o glob de um nível pula o resto em silêncio. — **Placar (2-0)** —
  fonte: `3b1b:.agents/scripts/skill_lint.py:54-55,115`.
- **Não deixe o executor reescrever o card** quando a premissa cai: o mandato dele é marcar
  concluído e escrever o handoff; reescrita é branch `PREP-<slug>`, fora da onda. — **norma** —
  `docs/PLAYBOOK-REFERENCIA.md:344-346`.
- **Não escale conflito entre `PROGRAMA.md` e o panorama como se a precedência ainda fosse
  lacuna.** O panorama declara essa lacuna sobre si mesmo (`docs/00-panorama-verificado.md §10,
  item 5`, escrito quando `PROGRAMA.md` ainda não tinha sido lido) — e ela **já está fechada**:
  `PROGRAMA.md` vence sobre **plano** (cards, ondas, grafo, ordem); o panorama vence sobre **fato**
  (qualquer afirmação técnica com placar); o playbook vence sobre **método**, subordinado ao
  `PROGRAMA.md`. — **norma** — `README.md:29-32` · `PROGRAMA.md §preâmbulo canônico` ·
  `docs/PLAYBOOK-REFERENCIA.md:8-10`.
  Consequência de roteamento: divergência **não** para a tarefa; ela é resolvida pelo eixo do
  conflito. Citar o `§10, item 5` como se fosse o estado atual é o modo de falha aqui — o texto do
  panorama continua lá e continua convincente.

## Falso verde deste domínio

Nenhuma linha desta tabela tem hoje um detector que fique vermelho — por isso a terceira coluna
nomeia a **sonda que você precisa escrever** para que passe a ficar. Célula com "nada" e mais nada
seria decoração; a sonda é o entregável.

| O que parece verde | Por quê não é | O que fica vermelho se sumir (sonda que falta) |
|---|---|---|
| Roteador que não casa skill nenhuma passa em todos os quase-erros | a asserção é `not any(forbidden)`, com `or len(matched) == 0` — nunca casar satisfaz o teste | asserção extra `len(matched) >= 1` em **todo** quase-erro; um quase-erro que casa zero skills é falha, não sucesso |
| Linter verde num `SKILL.md` cujo frontmatter **não é YAML válido** | o linter é regex, não parser: um `description:` em escalar simples que contenha um segundo `: ` (o `Triggers: "x"` do esqueleto do contrato) faz o YAML abortar com *mapping values are not allowed here*, e o linter não vê nada. A spec exige frontmatter YAML — **(2-0)**, https://agentskills.io/specification + `yaml.safe_load` sobre o catálogo. O que o loader faz com YAML malformado (carregar o corpo com metadata vazia, sem `description` para casar) é **(1-0)**, não verificado | `python3 -c "import sys,yaml; yaml.safe_load(open(sys.argv[1]).read().split('---',2)[1])"` por skill, no mesmo gate do linter. Sem essa sonda, "linter verde" e "skill carregável" são coisas diferentes |
| Linter verde numa skill sem uma única citação de proveniência | o linter não procura `arquivo:linha` em grau nenhum — **Placar (2-0)**, `3b1b:.agents/scripts/skill_lint.py` inteiro + sonda E7 (`docs/pesquisa/L02-reuso-3b1b-infra-skills.md:143-171`: corpo sem nenhuma citação ⇒ exit 0) | dois `grep -cE` no corpo — um por `arquivo:linha`, outro por `https?://` — somados, com piso por seção, no mesmo gate do linter. Escrever a alternância num regex só é o que quebra: o pipe literal vira coluna de tabela e a sonda desaparece da linha que a pede |
| Frontmatter sem `metadata.type` | o linter faz `type_match = re.search(...)` e só valida `if type_match:` — ausência da chave é **silêncio**, não erro — **Placar (2-0)** — `3b1b:.agents/scripts/skill_lint.py:72-77` + sonda executada (skill sem `type:` ⇒ linter exit **0**) | asserção de **presença** antes da de valor: `type:` ausente ⇒ erro, não silêncio |
| `description` dentro do limite de 1024 porque o linter passou | o regex do linter é `description:\s*(.+)` e `.` **não casa `\n`**: ele mede **só a primeira linha física**. Sonda executada: descrição real de 1.215 chars (614 na primeira linha) ⇒ linter exit **0**, spec violada — **Placar (2-0)** — `3b1b:.agents/scripts/skill_lint.py:58` + sonda. Isto morde aqui mais que em qualquer outra skill: a `description` é a **única** superfície de roteamento no startup | medir com `yaml.safe_load(...)['description']`, não com o regex; e falhar se o empacotador da spec rejeitar. Sem isso, "linter verde" e "descrição válida" são coisas diferentes, e a skill some do roteamento sem nenhum sinal |
| Skill em subdiretório de grupo | glob de um nível; não é analisada e não aparece na saída | comparar `find .agents/skills -name SKILL.md` com `ls -d .agents/skills/*/` e falhar na divergência: cada `SKILL.md` a mais que diretórios de primeiro nível é uma skill invisível |
| "As 20 skills estão carregadas no contexto" | só `name` + `description` entram no startup; o corpo entra na ativação — **Placar (3-0)** | um marcador único no **corpo** de cada skill e um probe que pergunta por ele; se o agente não sabe, o corpo não entrou |
| `TASK_PLAN.md` apagado | apagar o plano não executa gate nenhum; é higiene, não aceitação | o gate do Q6 tem de gravar sua saída antes; ausência do registro de gate ⇒ falha, mesmo com o plano apagado |
| Hook de política que faz `exit 1` | não-bloqueante por especificação; imprime erro e libera | teste do hook que roda a ação proibida de verdade e exige que ela **não** tenha acontecido — nunca só ler o log |
| `git diff --exit-code` num diretório de saída | não enxerga arquivo **não rastreado**: a captura que não gravou nada passa | trocar por `git status --porcelain <dir>` vazio **e** contagem de arquivos esperada, ou versionar o diretório com allowlist |
| Agente que sai com código 0 | também é o desfecho de um agente barrado por permissão que desistiu — a assinatura é `permission_denials` não-vazio — **Placar (2-0)**, https://code.claude.com/docs/en/headless | exigir `--output-format json` e falhar a onda se `permission_denials` não for vazio ou `is_error` for verdadeiro |
| Ausência de reclamação do usuário sobre roteamento | ausência não é sinal; roteamento errado se manifesta como retrabalho, não como erro | registrar a cadeia escolhida no handoff e comparar com as skills que realmente foram lidas; divergência = roteamento errado |

## O que esta skill NÃO cobre

- **Grafo, níveis, ondas, largura e caminho crítico** → `wave-planning`.
- **Mecânica de worktree, symlink de insumo, barreira, ordem de merge e teardown** →
  `parallel-worktrees` (esta skill só decide *que* ela precisa ser carregada).
- **Como escrever critério de aceitação, sonda negativa e gate local** → `falsifiable-gates`.
- **Como capturar e comparar artefato de vídeo** → `video-characterization`.
- **Como formular as perguntas de refutação e conduzir a revisão** → `adversarial-review`.
- **Como abrir, ancorar e fechar item de incerteza** → `uncertainty-ledger`.
- **Qualquer fato de API** (Remotion, Manim, whisper, FFmpeg, TTS, schema) → a skill de `dominio`
  da tabela. O roteador nomeia a skill; não repete o conteúdo dela.
- **Propor, consolidar ou aposentar skill** → `meta-skill-evolution` / `meta-skill-consolidate`.
- **Decisão que depende de mandato** (licença, orçamento, sandbox, formato de baseline): não é
  roteável — vira pergunta ao dono com sign-off nominal em ADR.

## Não verificado

1. **O limiar "~15 skills" acima do qual o roteamento por palavra-chave degrada.** É prosa de
   documento de desenho, em duas linhas do mesmo corpus e do mesmo autor
   (`3b1b:.agents/skills/validation-report.md:34`, `3b1b:.agents/skills/skill-map.md:113` — o
   prefixo importa: sem ele os dois caminhos resolvem contra **este** repo, onde o primeiro não
   existe e o segundo é outro arquivo), **sem medição**.
   Placar honesto: **1-0**. Agrava: o mesmo relatório se autodeclara `PASS` em 12 de 12 critérios
   enquanto a execução dos verificadores o contradiz. Fecha com: 20 gatilhos + 10 quase-erros
   rodados contra o catálogo real, contando quase-erro que casa.
2. **Se o roteamento em dois níveis é melhor que o de um nível neste catálogo.** Nenhum
   experimento foi feito; a escolha é normativa (`docs/CONTRATO-DE-SKILL.md:150-152`), não
   medida. Fecha com o mesmo conjunto do item 1, executado nas duas configurações.
3. **Se os hooks do harness chegam a disparar neste ambiente.** Claim em disputa (**2-1**) —
   `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:971`: a favor, a forma do `settings.json` e um
   `SKILL.md` commitado com registro vermelho; contra, ninguém observou o harness. Fecha com:
   forçar um `Edit` sob o harness e observar `exit 2`. Enquanto estiver aberto, **nenhuma regra
   desta skill é garantida por máquina** — todas são nudge de contexto.
4. **Se `${path}` é interpolado pelo harness.** Se não for, todo hook que passa argumento no
   comando é no-op — e o gate de escrita de skill roda com `argv` vazio e sai **0**
   (`docs/pesquisa/L02-reuso-3b1b-infra-skills.md:278-280,606`). Fecha com: hook temporário que
   grava `sys.argv` num arquivo.
5. **Se a lista de 20 skills desta tabela corresponde ao que existe em disco.** O
   `verification_signal` desta skill é exatamente essa checagem — e nada o executa hoje
   (ver `## Conhecimento negativo`). Rodado à mão a partir da raiz do repo, ele sai **0** — o que
   não é gate: amanhã a mesma mão pode não rodar. Fecha com: ligá-lo a um gate.
6. **Se `.agents/skills/` chega a ser um caminho de carregamento.** Isto é o pressuposto de que
   tudo acima depende, e ele **não está verificado**. Os três publicadores nomeiam
   `~/.claude/skills/`, `.claude/skills/`, skill de plugin e managed settings — **(3-0)**,
   https://code.claude.com/docs/en/skills ·
   https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview ·
   https://agentskills.io/specification. Nenhum deles nomeia `.agents/skills/`, e este
   repositório **não tem** `.claude/`. A hipótese é que o instalador crie `.agents/skills` com
   symlink `.claude/skills` — ledger seed L-01 de `docs/pesquisa/R06-remotion-agentes-skills.md:497`,
   placar **1-0**; o repositório de referência é exatamente essa forma
   (`3b1b:.claude/skills -> ../.agents/skills`), o que mostra que a hipótese é **plausível**, não
   que ela valha aqui. Se for falso, nenhuma destas 20 descrições entra no startup e o roteamento
   em dois níveis é texto morto. Fecha com: `ln -s ../.agents/skills .claude/skills` seguido de
   `ls -la .claude/skills` e `/doctor` na sessão real. Enquanto estiver aberto, o roteador precisa
   ser **invocado por nome**, não esperado.

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
