# R06 — Remotion + agentes de codificação: skills, MCP, llms.txt, subagents e hooks

**Escopo desta pesquisa:** fecha o que é *formato verificável* do acoplamento entre Remotion e
agentes de codificação (skills oficiais, CLI de instalação, MCP, llms.txt, plugin de Claude Code) e
o *formato oficial* dos três artefatos que vamos escrever no nosso repositório: `SKILL.md`,
`.claude/agents/*.md` e hooks em `settings.json`. **Não** responde nada sobre qualidade/eficácia das
skills do Remotion, nem sobre Manim, nem sobre custo de tokens desta máquina.

---

## 0. Nota de contagem (leia antes do placar)

O contrato enumera como **primária** quatro artefatos distintos: *documentação oficial*,
*repositório oficial*, *changelog oficial* e *página de licença/preço*. Contei-os como fontes
separadas mesmo quando o publicador é o mesmo, porque atestam de forma independente (a doc pode
mentir sobre o código; o código-fonte e o changelog não). Somei também dois registros públicos
verificáveis: **npm registry** e **SchemaStore** (`json.schemastore.org`, publicador independente da
Anthropic e do Remotion).

**Onde isso não vale, eu digo.** Vários fatos sobre o Claude Code só existem em
`code.claude.com` — publicador único, sem segunda atestação possível. Esses claims saem com
`(1-0)` / `NÃO VERIFICADO` mesmo sendo doc oficial de referência, exatamente como o contrato manda,
e cada um vira `LEDGER-SEED` com receita de verificação local em minutos. Não inflei placar.

**Data de todas as medições: 2026-08-10.**
Versões de referência: Remotion **4.0.507** (2026-08-07), pacote npm `skills` **1.5.22**
(pinado em `1.5.20` pelo CLI do Remotion), Claude Code local **2.1.226**, Node **v24.15.0**.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R06-01 | O Remotion publica documentação oficial para agentes em `remotion.dev/docs/ai/*`, com 7 páginas vivas: `skills`, `mcp`, `coding-agents`, `claude-code-plugin`, `cursor-plugin`, `system-prompt`, `generate` (mais o índice em `/docs/ai/`). | (3-0) | CONFIRMADO | https://www.remotion.dev/docs/ai/skills.md |
| R06-02 | O comando oficial documentado hoje para instalar as skills do Remotion é `npx skills add remotion-dev/skills`; o wrapper próprio do Remotion é `npx remotion skills add` / `npx remotion skills update`. | (4-0) | CONFIRMADO | https://www.remotion.dev/docs/cli/skills.md |
| R06-03 | `npx remotion skills add` não implementa nada: faz `spawn` de `npx --loglevel=error skills@1.5.20 add remotion-dev/skills <args> --yes`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/cli/src/skills.ts |
| R06-04 | `npx remotion skills add` foi introduzido no Remotion **v4.0.410**, publicado em 2026-01-26. | (3-0) | CONFIRMADO | https://api.github.com/repos/remotion-dev/remotion/releases/tags/v4.0.410 |
| R06-05 | O repositório oficial `github.com/remotion-dev/skills` existe, é espelho de `packages/skills` do monorepo, e contém exatamente **12** skills (12 `SKILL.md`, 13 `REFERENCE.md`, 161 arquivos `.md`, 271 blobs sob `skills/`). | (3-0) | CONFIRMADO | https://api.github.com/repos/remotion-dev/skills/git/trees/main?recursive=1 |
| R06-06 | O CLI `npx skills` **não é da Anthropic nem do Remotion**: é o pacote npm `skills`, de `vercel-labs/skills`, licença MIT, `latest` 1.5.22. | (3-0) | CONFIRMADO | https://registry.npmjs.org/skills |
| R06-07 | Os `SKILL.md` do Remotion carregam um campo de frontmatter `version:` com a versão do Remotion (`version: 4.0.507`) — campo **fora** da spec Agent Skills. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-best-practices/SKILL.md |
| R06-08 | A skill `/remotion-docs` **exige rede**: instrui o agente a fazer POST na API Algolia pública do Remotion e depois buscar as páginas com sufixo `.md`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-docs/SKILL.md |
| R06-09 | Existe MCP oficial (`@remotion/mcp`), mas ele está **depreciado**: a doc diz "new installations are not recommended" e que o servidor hospedado desliga **não antes de 2026-08-31**. | (3-0) | CONFIRMADO | https://www.remotion.dev/docs/ai/mcp.md |
| R06-10 | `https://www.remotion.dev/llms.txt` existe e responde HTTP 200, `text/plain`, **10.941 bytes** (medido 2026-08-10). | (2-0) | PROVÁVEL | https://www.remotion.dev/llms.txt |
| R06-11 | O `llms.txt` do Remotion é um **system prompt monolítico** (começa em `# About Remotion`, contém código de exemplo), não um índice de links no formato llmstxt.org — ele lista apenas 3 URLs, todas na seção de Lambda. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/ai/system-prompt |
| R06-12 | A doc do Remotion serve markdown por sufixo `.md` **e** por content negotiation (`Accept: text/markdown` → 200 `text/markdown`, 2.892 bytes contra 68.223 do HTML na mesma URL). | (3-0) | CONFIRMADO | https://www.remotion.dev/docs/ai/index.md |
| R06-13 | O plugin oficial de Claude Code instala-se com `claude plugin marketplace add remotion-dev/claude-code-plugin` seguido de `claude plugin install remotion@remotion`; licença MIT declarada no `marketplace.json`. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/remotion-dev/claude-code-plugin/main/.claude-plugin/marketplace.json |
| R06-14 | A spec Agent Skills exige `name` (≤64 chars, só `a-z0-9-`, sem hífen inicial/final, sem `--`, **igual ao nome do diretório pai**) e `description` (1–1024 chars, não vazia) no frontmatter YAML do `SKILL.md`. | (3-0) | CONFIRMADO | https://agentskills.io/specification |
| R06-15 | A spec Agent Skills define exatamente **seis** campos: `name`, `description`, `license`, `compatibility` (≤500), `metadata` (map), `allowed-tools` (experimental) — qualquer outro campo faz o empacotamento para claude.ai/API falhar com erro duro. | (2-0) | PROVÁVEL | https://agentskills.io/specification |
| R06-16 | Progressive disclosure tem 3 níveis: metadata (`name`+`description`, ~100 tokens, carregada sempre no startup), corpo do `SKILL.md` (<5.000 tokens recomendado, carregado só na ativação), recursos (custo zero até serem lidos). Recomendação: `SKILL.md` < 500 linhas. | (3-0) | CONFIRMADO | https://agentskills.io/specification |
| R06-17 | No Claude Code as skills moram em `~/.claude/skills/<nome>/SKILL.md` (pessoal), `.claude/skills/<nome>/SKILL.md` (projeto), `<plugin>/skills/<nome>/SKILL.md` (plugin) e no diretório de managed settings (enterprise). | (3-0) | CONFIRMADO | https://code.claude.com/docs/en/skills |
| R06-18 | No Claude Code, o **nome do comando** de uma skill de projeto/pessoal vem do **nome do diretório**, não do campo `name` do frontmatter — e todos os campos do frontmatter são opcionais lá. | (1-0) | NÃO VERIFICADO | https://code.claude.com/docs/en/skills |
| R06-19 | `allowed-tools` no Claude Code pré-aprova ferramentas **apenas durante o turno que invoca a skill**; a concessão expira quando o usuário envia a próxima mensagem, embora o conteúdo da skill fique no contexto. | (1-0) | NÃO VERIFICADO | https://code.claude.com/docs/en/skills |
| R06-20 | Subagents do Claude Code são arquivos `.md` em `.claude/agents/` (projeto) e `~/.claude/agents/` (usuário), com frontmatter YAML e corpo = system prompt. | (2-0) | PROVÁVEL | https://code.claude.com/docs/en/sub-agents |
| R06-21 | No frontmatter de subagent, **só `name` e `description` são obrigatórios**; os opcionais incluem `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `effort`, `isolation`, `color`, `initialPrompt`. | (1-0) | NÃO VERIFICADO | https://code.claude.com/docs/en/sub-agents |
| R06-22 | Um subagent (não-fork) começa com janela de contexto própria e **não vê** o histórico da conversa principal; recebe system prompt próprio + mensagem de delegação + CLAUDE.md + git status (Explore e Plan pulam CLAUDE.md e git status). | (1-0) | NÃO VERIFICADO | https://code.claude.com/docs/en/sub-agents |
| R06-23 | O Claude Code expõe **31** eventos de hook, e todos os oito citados no cluster existem: `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `UserPromptSubmit`, `SessionStart`, `PreCompact`, `Notification`. | (2-0) | PROVÁVEL | https://www.schemastore.org/claude-code-settings.json |
| R06-24 | Semântica de exit code de hook: **0** = sucesso e stdout é parseado como JSON; **2** = erro bloqueante, JSON ignorado, stderr vai para o modelo; **qualquer outro** = erro não-bloqueante, a ação prossegue. | (3-0) | CONFIRMADO | https://code.claude.com/docs/en/hooks.md |
| R06-25 | Exit **1 não bloqueia nada** (é tratado como erro não-bloqueante); e exit 2 em `PostToolUse` não desfaz nada, apenas mostra o stderr ao modelo. Exceção: em `WorktreeCreate` qualquer código diferente de zero aborta. | (2-0) | PROVÁVEL | https://code.claude.com/docs/en/hooks.md |

---

## 2. Detalhe por claim

### R06-01 — O Remotion publica doc oficial para agentes em `remotion.dev/docs/ai/*`
- **Verdade operacional:** existe uma seção `AI` inteira na doc, com página dedicada a skills, a
  coding agents, a plugin de Claude Code, a plugin de Cursor, a MCP (depreciada) e ao system prompt.
  Não é blog: é doc versionada no monorepo, com frontmatter e imagem gerada.
- **Como reconferir:**
  `for p in skills mcp coding-agents claude-code-plugin cursor-plugin system-prompt generate; do printf "%-20s " $p; curl -sSo /dev/null -w "%{http_code}\n" -L https://www.remotion.dev/docs/ai/$p; done`
  (esperado: sete `200`. `/docs/ai/index` dá **404** — o índice é `/docs/ai/` com barra.)
- **O que quebra se divergir:** o card "instalar skills do Remotion na worktree" perde a referência
  canônica e vira folclore de blog. O gate de bootstrap que faz `curl` da doc como fixture falha.
- **Fontes:**
  - https://www.remotion.dev/docs/ai/index.md (primária) — lista os três mecanismos AI-ready da doc.
  - https://www.remotion.dev/docs/ai/skills.md (primária) — conteúdo integral da página de skills.
  - https://api.github.com/repos/remotion-dev/remotion/releases/tags/v4.0.507 (primária, changelog) —
    "Skills: Add Cursor Agent Plugin (remotion.dev/docs/ai/cursor-plugin)", atestando a página nova.

### R06-02 — `npx skills add remotion-dev/skills` é o comando documentado; `npx remotion skills add` é o wrapper
- **Verdade operacional:** os dois existem e fazem a mesma coisa. A página `/docs/ai/skills` e o
  README do repo publicam **`npx skills add remotion-dev/skills`**. A página `/docs/cli/skills`
  publica **`npx remotion skills add`** e **`npx remotion skills update`** (só esses dois
  subcomandos; qualquer outro imprime o help). O `bun create video` também oferece instalar.
- **Como reconferir:** `curl -sSL https://www.remotion.dev/docs/cli/skills.md`
- **O que quebra se divergir:** o card de bootstrap da worktree e o script de setup. Se o wrapper
  sumir, o fallback `npx skills add remotion-dev/skills` continua válido — é o comando de baixo nível.
- **Fontes:**
  - https://www.remotion.dev/docs/ai/skills.md (primária) — `npx skills add remotion-dev/skills`.
  - https://www.remotion.dev/docs/cli/skills.md (primária) — `add` e `update`, e nada mais.
  - https://raw.githubusercontent.com/remotion-dev/skills/main/README.md (primária, repo) — mesmo comando.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/cli/src/skills.ts (primária, código) —
    `if (!subcommand || !['add','update'].includes(subcommand)) { printSkillsHelp(...) }`.

### R06-03 — `npx remotion skills add` faz spawn de `npx skills@1.5.20 add remotion-dev/skills --yes`
- **Verdade operacional:** o wrapper é dez linhas de `spawn`. Isso significa três coisas para nós:
  (a) instalar skills **exige rede e npx**, não é offline; (b) a versão do CLI de terceiro está
  **pinada em `1.5.20`** só no caminho `add` — o caminho `update` chama `skills` sem pin, ou seja,
  pega o `latest`; (c) o `--yes` é injetado, então o wrapper não pergunta nada.
- **Como reconferir:**
  `curl -sS https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/cli/src/skills.ts | sed -n '45,65p'`
- **O que quebra se divergir:** o card "instalação determinística de skills". Um pin no `add` e
  nenhum pin no `update` é uma assimetria real: `update` pode puxar comportamento novo do
  vercel-labs sem bump do Remotion. Qualquer gate que assuma "a instalação é reprodutível" está
  vermelho aqui.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/cli/src/skills.ts (primária, código-fonte).
  - https://api.github.com/repos/remotion-dev/remotion/releases/tags/v4.0.502 (primária, changelog) —
    "`@remotion/cli`: Pin skills CLI to 1.5.20".

### R06-04 — `npx remotion skills add` chegou no Remotion v4.0.410 (2026-01-26)
- **Verdade operacional:** antes da 4.0.410 só existia o caminho `npx skills add remotion-dev/skills`.
  Se o card fixar uma versão mínima de Remotion, é essa.
- **Como reconferir:**
  `curl -sS https://api.github.com/repos/remotion-dev/remotion/releases/tags/v4.0.410 | grep -i skills`
- **O que quebra se divergir:** o requisito de versão mínima no `package.json` do template e a
  mensagem de erro do bootstrap.
- **Fontes:**
  - https://api.github.com/repos/remotion-dev/remotion/releases/tags/v4.0.410 (primária, changelog) —
    "**`@remotion/cli`: `npx remotion skills add`** by @tiwariaayu in .../pull/6368", publicado 2026-01-26T18:01:58Z.
  - https://github.com/remotion-dev/remotion/issues/6364 (primária, repo) — issue original, fechada 2026-01-26.
  - https://registry.npmjs.org/remotion (primária, registro) — `4.0.410` publicada 2026-01-26T17:53:36Z.

### R06-05 — `remotion-dev/skills` existe e tem 12 skills
- **Verdade operacional:** repo criado em 2026-01-19, último push 2026-08-07, 4.259 estrelas,
  **sem campo de licença** na API do GitHub e `"private": true` no `package.json`. Doze diretórios:
  `remotion-best-practices`, `remotion-captions`, `remotion-create`, `remotion-docs`,
  `remotion-interactivity`, `remotion-maps`, `remotion-markup`, `remotion-multimedia`,
  `remotion-render`, `remotion-saas`, `remotion-studio`, `remotion-upgrade`.
  `remotion-best-practices` é um **roteador**: seu `SKILL.md` tem 2.483 bytes e só faz "se X, carregue
  `./remotion-<y>/REFERENCE.md`". Ele bundla também um diretório `agents/` com um único
  `openai.yaml` (311 bytes).
- **Como reconferir:**
  `curl -sS https://api.github.com/repos/remotion-dev/skills/contents/skills | python3 -c "import sys,json;[print(x['name']) for x in json.load(sys.stdin)]"`
- **O que quebra se divergir:** o card do catálogo de skills e o gate "as 12 skills estão instaladas".
  A **ausência de licença declarada** é um risco jurídico separado — ver PERGUNTA-DONO.
- **Fontes:**
  - https://api.github.com/repos/remotion-dev/skills (primária, repo) — metadados.
  - https://api.github.com/repos/remotion-dev/skills/git/trees/main?recursive=1 (primária, repo) — 271 blobs, 12 `SKILL.md`.
  - https://www.remotion.dev/docs/ai/skills.md (primária, doc) — mesma lista de 12, com descrição de cada.

### R06-06 — O CLI `npx skills` é do vercel-labs, não da Anthropic nem do Remotion
- **Verdade operacional:** `npx skills add remotion-dev/skills` executa código de um terceiro
  (`vercel-labs/skills`, MIT, 28.579 estrelas, `latest` 1.5.22, modificado 2026-08-05). Ele suporta
  75+ agentes e escolhe diretórios diferentes por agente. Isso é uma dependência de supply chain
  que o roadmap não pode tratar como "comando do Remotion".
- **Como reconferir:**
  `curl -sS https://registry.npmjs.org/skills | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['dist-tags'],d['repository'])"`
- **O que quebra se divergir:** o gate de auditoria de dependências e a decisão "instalar skills via
  CLI de terceiro vs. copiar os arquivos para dentro do repo". Ver Ponto de troca barata na seção 7.
- **Fontes:**
  - https://registry.npmjs.org/skills (primária, registro) — `repository: git+https://github.com/vercel-labs/skills.git`.
  - https://api.github.com/repos/vercel-labs/skills (primária, repo) — licença MIT, "The open agent skills tool - npx skills".
  - https://raw.githubusercontent.com/vercel-labs/skills/main/README.md (primária, repo) — comandos `add`, `use`, `list`, `find`, `update`, `remove`, `init`; flags `-g/--global`, `-a/--agent`, `-s/--skill`, `-y/--yes`, `--all`.

### R06-07 — Os `SKILL.md` do Remotion usam um campo `version:` fora da spec
- **Verdade operacional:** o frontmatter real é
  `name: remotion-best-practices` / `description: Router for all Remotion skills` / `version: 4.0.507`.
  A spec Agent Skills **não tem** um campo `version` de topo — versão deveria ir dentro de
  `metadata:`. Consequência prática: um `SKILL.md` no formato Remotion **não passa** no empacotamento
  para claude.ai/Skills API (erro duro de chave inesperada). No Claude Code local ele carrega sem
  reclamar. Nosso catálogo precisa escolher um dos dois alvos, não os dois.
- **Como reconferir:**
  `curl -sS https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-docs/SKILL.md | head -5`
- **O que quebra se divergir:** o gate de lint do nosso catálogo de skills. Se copiarmos o padrão do
  Remotion, o caminho "subir skill para claude.ai" fecha.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-best-practices/SKILL.md (primária, repo) — `version: 4.0.507`.
  - https://agentskills.io/specification (primária, spec) — tabela de campos sem `version`.

### R06-08 — `/remotion-docs` exige rede (Algolia + `.md`)
- **Verdade operacional:** o corpo da skill instrui literalmente:
  `POST https://plsduol1ca-dsn.algolia.net/1/indexes/*/queries?x-algolia-api-key=...&x-algolia-application-id=PLSDUOL1CA`
  com `indexName: "remotion"`, e depois "Append `.md` to any Remotion docs URL". Ou seja: a
  substituta oficial do MCP **também é online**. Num pipeline "roda LOCALMENTE", `/remotion-docs`
  degrada para nada sem internet, e o agente cai de volta em conhecimento memorizado — que é
  exatamente o que a skill manda evitar ("Implement using the current documentation rather than
  memorized API knowledge").
- **Como reconferir:**
  `curl -sS https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-docs/SKILL.md`
- **O que quebra se divergir:** o card "agente consulta a doc antes de escrever API" e a promessa de
  operação offline. Precisamos de um espelho local da doc, ou de aceitar rede nesse ponto.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-docs/SKILL.md (primária, repo).
  - https://www.remotion.dev/docs/ai/skills.md (primária, doc) — "Search the Remotion documentation and fetch any page as Markdown".

### R06-09 — O MCP do Remotion existe e está depreciado
- **Verdade operacional:** o título da página é literalmente "Remotion's Model Context Protocol
  (deprecated)". A doc lista as razões (doc atrasada, custo de token pago pela Remotion, MCP difícil
  de instalar e invocado de forma não confiável pelos agentes, sobreposição com `/remotion-docs`) e
  a migração: remover `remotion-documentation` da config de MCP, rodar `npx remotion skills add`,
  usar `/remotion-docs`. O pacote npm `@remotion/mcp` continua publicado (`latest` 4.0.507, 226
  versões) e **não** está marcado como `deprecated` no registro npm — a depreciação é editorial.
- **Como reconferir:**
  `curl -sSL https://www.remotion.dev/docs/ai/mcp.md | head -20` e
  `curl -sS https://registry.npmjs.org/@remotion/mcp | python3 -c "import sys,json;print(json.load(sys.stdin)['dist-tags'])"`
- **O que quebra se divergir:** qualquer card que planeje "instalar o MCP do Remotion" nasce morto.
  Se a data de 2026-08-31 passar (falta menos de um mês da data desta pesquisa), um card que dependa
  do MCP hospedado quebra sem aviso.
- **Fontes:**
  - https://www.remotion.dev/docs/ai/mcp.md (primária, doc) — aviso e data "no earlier than August 31, 2026".
  - https://github.com/remotion-dev/remotion/issues/9055 (primária, repo) — "Deprecate the Remotion MCP after adding /remotion-docs", fechada 2026-07-16, com as razões.
  - https://registry.npmjs.org/@remotion/mcp (primária, registro) — `latest: 4.0.507`, `bin: {remotion-mcp: ...}`, sem flag `deprecated`.

### R06-10 / R06-11 — `llms.txt` existe (10.941 bytes) e é um system prompt, não um índice
- **Verdade operacional:** `https://www.remotion.dev/llms.txt` → HTTP 200, `text/plain; charset=utf-8`,
  10.941 bytes. `https://remotion.dev/llms.txt` (sem `www`) devolve o mesmo. O conteúdo abre em
  `# About Remotion` e é prosa + código TypeScript ensinando `registerRoot`, `Composition`,
  `useCurrentFrame`, etc. Ele contém apenas 3 URLs, todas de Lambda. Não é o "índice de links" que a
  convenção llmstxt.org descreve — é um prompt para colar num modelo.
- **Como reconferir:**
  `curl -sSL -o /dev/null -w "%{http_code} %{size_download} %{content_type}\n" https://www.remotion.dev/llms.txt`
- **O que quebra se divergir:** um card que planeje "dar o llms.txt ao agente como mapa de navegação
  da doc" está errado de premissa: ele é ~11 KB de contexto fixo, não um índice. Para navegação,
  o mecanismo real é `.md` + Algolia (R06-08/R06-12).
- **Fontes:**
  - https://www.remotion.dev/llms.txt (primária, arquivo) — conteúdo e tamanho medidos.
  - https://www.remotion.dev/docs/ai/system-prompt (primária, doc) — declara a URL e cita llmstxt.org como convenção.

### R06-12 — Content negotiation: `.md` e `Accept: text/markdown`
- **Verdade operacional:** medido na mesma URL `https://www.remotion.dev/docs/ai/skills`:
  sem header → `text/html`, 68.223 bytes; com `Accept: text/markdown` → `text/markdown`, 2.892 bytes.
  Fator ~23x de economia. Adicionar `.md` ao caminho também funciona.
- **Como reconferir:**
  `curl -sS -H "Accept: text/markdown" -o /dev/null -w "%{content_type} %{size_download}\n" -L https://www.remotion.dev/docs/ai/skills`
- **O que quebra se divergir:** o card do fetcher de doc do nosso agente. Se a negociação sumir,
  o fallback `.md` no caminho ainda serve; se os dois sumirem, o custo por consulta multiplica.
- **Fontes:**
  - https://www.remotion.dev/docs/ai/index.md (primária, doc) — descreve os três mecanismos.
  - https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-docs/SKILL.md (primária, repo) — usa o `.md` como parte do workflow.
  - Medição HTTP direta (verificação, não fonte) — números acima.

### R06-13 — Plugin oficial de Claude Code
- **Verdade operacional:** `marketplace.json` declara marketplace `name: "remotion"` contendo um
  plugin `name: "remotion"` — daí o `remotion@remotion` do install. `license: "MIT"`,
  `source: {source: "github", repo: "remotion-dev/claude-code-plugin"}`. O repo tem só
  `.claude-plugin/`, `README.md` (que diz "This is an internal package and has no documentation")
  e `skills/`. Ou seja: **o plugin é só um empacotamento das mesmas skills**, não traz agentes nem
  hooks próprios. Existe o equivalente para Cursor, instalado por `git clone` em
  `~/.cursor/plugins/local/remotion`.
- **Como reconferir:**
  `curl -sS https://raw.githubusercontent.com/remotion-dev/claude-code-plugin/main/.claude-plugin/marketplace.json`
- **O que quebra se divergir:** o card "bootstrap do Claude Code na worktree" pode escolher plugin
  **ou** `npx remotion skills add`. Não precisa dos dois — e usar os dois duplica skills.
- **Fontes:**
  - https://www.remotion.dev/docs/ai/claude-code-plugin.md (primária, doc) — os dois comandos, "Restart Claude Code after installing".
  - https://raw.githubusercontent.com/remotion-dev/claude-code-plugin/main/.claude-plugin/marketplace.json (primária, repo) — MIT, nomes.
  - https://www.remotion.dev/docs/ai/cursor-plugin.md (primária, doc) — variante Cursor, prova que o padrão é "plugin = wrapper de skills".

### R06-14 / R06-15 / R06-16 — A spec Agent Skills (isto define o formato do nosso catálogo)
- **Verdade operacional:** uma skill é **um diretório** com `SKILL.md` na raiz. Frontmatter YAML,
  seis campos e nada mais:

  | Campo | Obrigatório | Restrição literal |
  |---|---|---|
  | `name` | sim | 1–64 chars, só `a-z`, `0-9`, `-`; não inicia nem termina com `-`; sem `--`; **deve casar com o nome do diretório pai** |
  | `description` | sim | 1–1024 chars, não vazia; deve dizer *o que faz* **e** *quando usar* |
  | `license` | não | nome da licença ou referência a arquivo empacotado |
  | `compatibility` | não | 1–500 chars |
  | `metadata` | não | mapa string→string |
  | `allowed-tools` | não | string separada por espaço; **experimental**, suporte varia por agente |

  Diretórios convencionais: `scripts/`, `references/`, `assets/`. Referências a arquivos devem ser
  **relativas à raiz da skill e de um nível só** ("Keep file references one level deep from
  `SKILL.md`"). Validação oficial: `skills-ref validate ./my-skill`.
  Progressive disclosure: nível 1 metadata (~100 tokens, sempre no system prompt); nível 2 corpo
  (<5.000 tokens recomendado, entra no contexto só quando a skill ativa); nível 3 recursos (custo
  zero até serem lidos; script executado por bash não põe o código no contexto, só a saída).
- **Como reconferir:**
  `curl -sSL https://agentskills.io/specification` e
  `curl -sSL https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview`
- **O que quebra se divergir:** **tudo**. Este é o formato do nosso catálogo. Se `name` não casar
  com o diretório, ou se passar de 64 chars, ou se a `description` estourar 1024, o lint do catálogo
  reprova e a skill não é descoberta. O limite de <5k tokens no corpo é o que decide se nosso
  conhecimento de Remotion/Manim cabe no `SKILL.md` ou vira `references/`.
- **Fontes:**
  - https://agentskills.io/specification (primária, spec) — tabela de campos, limites, `skills-ref`.
  - https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview (primária, doc Anthropic) — "Required fields: `name` and `description`"; `name` máx 64, só minúsculas/números/hífens, sem tags XML, **sem as palavras reservadas "anthropic" e "claude"**; `description` máx 1024; tabela dos 3 níveis com "~100 tokens per Skill" e "Under 5k tokens".
  - https://code.claude.com/docs/en/skills (primária, doc Claude Code) — cita a mesma spec e reproduz o erro literal do empacotador: `Unexpected key(s) in SKILL.md frontmatter: argument-hint. Allowed properties are: allowed-tools, compatibility, description, license, metadata, name`.

  > **Fechamento parcial declarado:** `platform.claude.com` acrescenta uma restrição que
  > `agentskills.io` **não** tem — `name` não pode conter as palavras reservadas "anthropic" e
  > "claude". Essa metade é `(1-0)` / NÃO VERIFICADO e virou LEDGER-SEED `L-06`.

### R06-17 — Onde as skills moram no Claude Code
- **Verdade operacional:** quatro escopos. Precedência quando o nome colide: **enterprise > pessoal >
  projeto**, e qualquer um desses sobrepõe uma skill bundled de mesmo nome. Skills de plugin usam
  namespace `plugin-name:skill-name` e por isso nunca colidem. Skills também carregam de
  `.claude/skills/` **aninhados** abaixo do diretório de trabalho — mas só a partir do momento em que
  o Claude lê ou edita um arquivo naquele subdiretório; até lá elas nem aparecem no autocomplete.
  Diretórios passados com `--add-dir` são exceção: seu `.claude/skills/` **é** carregado (o setting
  `permissions.additionalDirectories` **não** carrega). Um `<skill-name>` pode ser symlink.
- **Como reconferir:** `ls -la ~/.claude/skills/ .claude/skills/ 2>/dev/null` e, dentro do Claude
  Code, `/doctor`.
- **O que quebra se divergir:** o card "catálogo de skills versionado no repo" (`.claude/skills/`,
  commitado) e o card "skills por pacote no monorepo" (aninhadas). Se o monorepo do vídeo tiver
  `packages/manim/.claude/skills/`, elas **não** existem no início da sessão — isso muda o desenho
  da onda de agentes em worktrees.
- **Fontes:**
  - https://code.claude.com/docs/en/skills (primária, doc) — tabela de localizações e regra de precedência.
  - https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview (primária, doc) — "place them in `~/.claude/skills/` (personal) or `.claude/skills/` (project)".
  - https://raw.githubusercontent.com/vercel-labs/skills/main/README.md (primária, repo de terceiro) — o instalador usa `.claude/skills/` (projeto) e `~/.claude/skills/` (global) para o alvo Claude Code.

### R06-18 — Nome do comando vem do diretório; frontmatter é todo opcional no Claude Code
- **Verdade operacional:** aqui o Claude Code **diverge da spec**. A doc diz: "All fields are
  optional. Only `description` is recommended". E: numa skill pessoal ou de projeto, `name` é só o
  rótulo de exibição — o comando vem do nome do diretório (`.claude/skills/deploy-staging/SKILL.md`
  → `/deploy-staging`). Só em skill de plugin o `name` define o último segmento do comando
  (`my-plugin/skills/review/SKILL.md` com `name: fancy` → `/my-plugin:fancy`). Se o YAML estiver
  malformado, a skill carrega o corpo com metadata vazia: `/nome` funciona e o Claude fica sem
  `description` para casar — falha silenciosa clássica.
- **Como reconferir:** criar `.claude/skills/teste-nome/SKILL.md` com `name: outro-nome`, rodar
  `claude --debug` e ver se o comando é `/teste-nome` ou `/outro-nome`.
- **O que quebra se divergir:** o lint do catálogo. Se escrevermos assumindo "o nome vem do
  frontmatter", os slash-commands do time saem errados. Como a spec **exige** que `name` case com o
  diretório, a regra segura é: **sempre iguais** — assim os dois mundos concordam.
- **Fontes:** https://code.claude.com/docs/en/skills (primária, doc). **Fonte única — publicador único.**

### R06-19 — `allowed-tools` dura um turno
- **Verdade operacional:** a concessão vale só no turno que invoca a skill e some na próxima
  mensagem do usuário, mesmo com o conteúdo da skill ainda em contexto. Ela **não restringe**: todas
  as outras ferramentas continuam chamáveis sob as permissões normais. Para restringir existe
  `disallowed-tools`, que também expira na próxima mensagem. Em skill de projeto (`.claude/skills/`
  commitada) o `allowed-tools` só passa a valer depois de aceitar o diálogo de confiança do
  workspace — uma skill pode conceder acesso amplo a si mesma, e a doc avisa para revisar antes de
  confiar no repositório.
- **Como reconferir:** `/permissions` dentro da sessão; e inspecionar a concessão em dois turnos
  seguidos com uma skill que declare `allowed-tools: Bash(git status *)`.
- **O que quebra se divergir:** o card "skill de render sem prompt de permissão". Se a concessão for
  por turno, um render multi-turno **vai** pedir permissão de novo — o desenho tem que usar
  `permissions.allow` no `settings.json`, não `allowed-tools`.
- **Fontes:** https://code.claude.com/docs/en/skills (primária, doc). **Fonte única.**

### R06-20 / R06-21 / R06-22 — Subagents
- **Verdade operacional:** arquivo `.md`, frontmatter YAML, corpo = system prompt. Escopos por
  prioridade: managed settings (1) > `--agents` JSON de CLI (2) > `.claude/agents/` (3) >
  `~/.claude/agents/` (4) > `agents/` de plugin (5). Só `name` e `description` são obrigatórios.
  `name` não pode conter `:` (reservado para plugin). O diretório é varrido **recursivamente**, mas
  a identidade vem só do `name` — dois arquivos com o mesmo `name` no mesmo escopo: só um carrega,
  por ordem do filesystem. Invocação: linguagem natural, `@agent-<nome>`, ou sessão inteira com
  `claude --agent <nome>` / setting `agent`. Isolamento: janela de contexto própria, sem histórico,
  sem output style, sem auto memory; **com** CLAUDE.md e git status (Explore e Plan pulam os dois).
  Limite de **20** subagents concorrentes por sessão por padrão
  (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`). `isolation: worktree` roda o subagent numa git worktree
  temporária, ramificada do **branch default**, não do `HEAD` do pai.
  Subagents de **plugin ignoram** `hooks`, `mcpServers` e `permissionMode` — por segurança.
- **Como reconferir:** `ls ~/.claude/agents/ .claude/agents/` e, na sessão, `/doctor`.
- **O que quebra se divergir:** o desenho inteiro das ondas paralelas em worktrees. Em especial:
  (a) o teto de 20 concorrentes é o limite superior da largura de uma onda; (b) `isolation: worktree`
  ramificando do branch default e não do HEAD **é** a diferença entre uma onda que vê o trabalho da
  onda anterior e uma que não vê.
- **Fontes:**
  - https://code.claude.com/docs/en/sub-agents (primária, doc) — tudo acima.
  - https://www.schemastore.org/claude-code-plugin-manifest.json (primária, registro independente) —
    propriedade `agents`: "Path to additional agent file (in addition to those in the `agents/`
    directory, if it exists), relative to the plugin root", com padrão `.*\.md$`. Corrobora
    "subagent = arquivo `.md`", mas **não** a lista de campos do frontmatter, que segue com fonte única.

### R06-23 — 31 eventos de hook
- **Verdade operacional:** o JSON Schema publicado no SchemaStore lista exatamente estes 31 nomes
  sob `properties.hooks.properties`:
  `ConfigChange, CwdChanged, DirectoryAdded, Elicitation, ElicitationResult, FileChanged,
  InstructionsLoaded, MessageDisplay, Notification, PermissionDenied, PermissionRequest, PostCompact,
  PostToolBatch, PostToolUse, PostToolUseFailure, PreCompact, PreToolUse, SessionEnd, SessionStart,
  Setup, Stop, StopFailure, SubagentStart, SubagentStop, TaskCompleted, TaskCreated, TeammateIdle,
  UserPromptExpansion, UserPromptSubmit, WorktreeCreate, WorktreeRemove`.
  Os oito citados no cluster estão todos lá. Formato: três níveis — evento → grupo de matcher →
  handlers. Cinco tipos de handler: `command`, `http`, `mcp_tool`, `prompt`, `agent`.
  Locais: `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`,
  managed policy, `hooks/hooks.json` de plugin, e **frontmatter de skill ou de subagent**.
  Hooks **mesclam** entre níveis, não substituem.
- **Como reconferir:**
  `curl -sSL https://www.schemastore.org/claude-code-settings.json | python3 -c "import sys,json;print(sorted(json.load(sys.stdin)['properties']['hooks']['properties']))"`
- **O que quebra se divergir:** os gates do programa. `SubagentStop` é a barreira de onda;
  `PostToolUse` é o lint automático pós-edição; `Stop` é o "não termine sem rodar o render".
- **Fontes:**
  - https://www.schemastore.org/claude-code-settings.json (primária, registro independente) — os 31 nomes.
  - https://code.claude.com/docs/en/hooks.md (primária, doc) — mesma lista, mais matchers por evento.

### R06-24 / R06-25 — Exit codes: isto é o que transforma conselho em garantia
- **Verdade operacional, literal da doc:**
  - **Exit 0** = sucesso. O stdout é parseado como **JSON output** (JSON só é processado em exit 0).
    Para a maioria dos eventos o stdout vai para o debug log e não aparece no transcript; as exceções
    são `UserPromptSubmit`, `UserPromptExpansion` e `SessionStart`, onde o stdout **vira contexto que
    o Claude vê**. Stderr em exit 0 vai só para o debug log — o Claude nunca vê.
  - **Exit 2** = erro bloqueante. Stdout e qualquer JSON são **ignorados**; o **stderr** é entregue ao
    Claude como mensagem de erro.
  - **Qualquer outro código** = erro não-bloqueante: a ação prossegue e o transcript mostra
    `Failed with non-blocking status code:` + primeira linha do stderr.
  - **Exit 1 não bloqueia.** A doc traz o aviso explícito: "Claude Code treats exit code 1 as a
    non-blocking error and proceeds with the action, even though 1 is the conventional Unix failure
    code. If your hook is meant to enforce a policy, use `exit 2`." Única exceção:
    `WorktreeCreate`, onde qualquer não-zero aborta.
  - Bloqueiam com exit 2: `PreToolUse`, `PermissionRequest`, `UserPromptSubmit`,
    `UserPromptExpansion`, `Stop`, `SubagentStop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`,
    `ConfigChange`, `PostToolBatch`, `PreCompact`, `Elicitation`, `ElicitationResult`,
    `WorktreeCreate`. **Não** bloqueiam: `PostToolUse`, `PostToolUseFailure` (só mostram stderr ao
    modelo — a ferramenta já rodou), `SessionStart`, `Setup`, `SubagentStart`, `SessionEnd`,
    `Notification`, `CwdChanged`, `DirectoryAdded`, `FileChanged`, `PostCompact`, `StopFailure`,
    `PermissionDenied`, `InstructionsLoaded`, `MessageDisplay`, `WorktreeRemove`.
  - JSON de saída (só em exit 0): universais `continue` (false = para tudo, tem precedência sobre
    qualquer decisão de evento), `stopReason`, `suppressOutput`, `systemMessage`, `terminalSequence`;
    `decision`/`reason` no topo para alguns eventos; e `hookSpecificOutput` (exige `hookEventName`)
    com, em `PreToolUse`, `permissionDecision: allow|deny|ask|defer`, `permissionDecisionReason`,
    `updatedInput`, `additionalContext`.
  - **Escolha um dos dois por hook**: ou exit codes, ou exit 0 + JSON. Nunca os dois.
  - Saídas de hook (`additionalContext`, `systemMessage`, stdout) são cortadas em **10.000 caracteres**.
- **Como reconferir:** `curl -sSL https://code.claude.com/docs/en/hooks.md | sed -n '742,815p'`
- **O que quebra se divergir:** todo gate determinístico do programa. Um hook de lint que faz
  `exit 1` **não bloqueia nada** e produz falso verde perfeito: o log mostra erro, o agente segue,
  o commit entra. Este é o item mais caro deste cluster.
- **Fontes:**
  - https://code.claude.com/docs/en/hooks.md (primária, doc) — seção "Exit code output" e tabela "Exit code 2 behavior per event".
  - https://www.schemastore.org/claude-code-settings.json (primária, registro independente) — formato do bloco `hooks`, tipos de handler.
  - https://hidekazu-konishi.com/entry/claude_code_hooks_complete_guide.html (secundária, 2026-06-07) — reproduz as três semânticas e a lista de eventos bloqueantes de forma independente.

---

## 3. Refutações — o que o panorama afirma e não se sustenta

O panorama de referência é `Roadmap Editor de Vídeo IA.md` (raiz do repositório).

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| Linha 15: as Agent Skills "são pré-carregados no contexto de raciocínio do modelo **antes** da execução de qualquer comando de geração". | **REFUTADO** | O contrário é o mecanismo central. No startup entram **apenas** `name` + `description` (~100 tokens por skill). O corpo do `SKILL.md` só entra no contexto quando a skill é **ativada**. Recursos em `references/`/`scripts/` custam zero até serem lidos. Isso é a definição de progressive disclosure, nos três publicadores. | https://agentskills.io/specification ; https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview |
| Linha 16: `npx skills add remotion-dev/skills` "integra o pacote remotion-best-practices". | **PARCIAL — corrigido** | O comando instala as **12** skills, não um pacote. `remotion-best-practices` é apenas o **roteador** (2.483 bytes) que aponta para as outras via `./remotion-<x>/REFERENCE.md`. Chamar o conjunto de "pacote remotion-best-practices" leva a um card que instala/valida a coisa errada. | https://api.github.com/repos/remotion-dev/skills/contents/skills ; https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-best-practices/SKILL.md |
| Linha 16: "injetando dezenas de ficheiros de regras especializadas". | **CONFIRMADO** (raro, mas é) | 161 arquivos `.md` sob `skills/`, 271 blobs no total. "Dezenas" é conservador. | https://api.github.com/repos/remotion-dev/skills/git/trees/main?recursive=1 |
| Linha 140: "adotando a habilidade **global** na árvore recém descarregada através do mandato `npx skills add remotion-dev/skills`". | **EM DISPUTA** | O comando **sem** `-g/--global` instala **no projeto**, não globalmente. "Global" exige a flag `-g`. Além disso, o wrapper do Remotion (`npx remotion skills add`) instala no projeto e injeta `--yes`. Um card que diga "instale globalmente" e rode o comando sem `-g` produz um estado que não é nem um nem outro. | https://raw.githubusercontent.com/vercel-labs/skills/main/README.md ; https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/cli/src/skills.ts |
| Implícito no panorama (seção de arquitetura): o Claude Code é a "ponte orquestradora" e o MCP do Remotion faz parte do ferramental. | **REFUTADO** para o MCP | Não existe MCP do Remotion viável para um projeto novo: a doc oficial diz "new installations are not recommended" e marca desligamento do hospedado para não antes de **2026-08-31** — três semanas depois desta pesquisa. O substituto é a skill `/remotion-docs`. | https://www.remotion.dev/docs/ai/mcp.md ; https://github.com/remotion-dev/remotion/issues/9055 |
| Implícito: "roda LOCALMENTE" + skills do Remotion como fonte de verdade de API. | **PARCIAL** | As 12 skills são arquivos locais e funcionam offline, **exceto** `/remotion-docs`, que depende de POST na Algolia e de fetch em `remotion.dev`. A promessa "local" não cobre a consulta à documentação corrente. | https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-docs/SKILL.md |
| Não afirmado, mas presumido pelo uso: `npx skills` é ferramenta do ecossistema Anthropic/Remotion. | **REFUTADO** | É o pacote npm `skills`, de **vercel-labs**, MIT. Terceiro na cadeia de suprimentos entre nós e o Remotion. | https://registry.npmjs.org/skills ; https://api.github.com/repos/vercel-labs/skills |
| Não afirmado: existência de `llms-full.txt` do Remotion (padrão comum em docs Mintlify). | **REFUTADO** | `https://www.remotion.dev/llms-full.txt` responde **HTTP 404** com corpo HTML. Só `llms.txt` existe. Evidência positiva: os dois foram requisitados na mesma sessão; um deu 200 `text/plain`, o outro 404. | Medição HTTP 2026-08-10 contra https://www.remotion.dev/llms.txt e `/llms-full.txt` |

---

## 4. Armadilhas (falso verde deste domínio)

- **Hook que faz `exit 1`** → *parece funcionar*: o script detecta o erro, imprime no stderr, o log
  fica vermelho. *Por que não é prova*: exit 1 é **não-bloqueante** no Claude Code; a ferramenta roda,
  o agente segue, o commit entra. *O que fica vermelho se sumir*: nada — é justamente o problema.
  Todo hook de política tem que ser `exit 2` (ou `exit 0` + JSON com `permissionDecision: "deny"`).

- **Hook que faz `exit 2` e também imprime JSON** → *parece funcionar*: bloqueia. *Por que não é
  prova*: o JSON é **ignorado** em exit 2, então qualquer `permissionDecisionReason`,
  `updatedInput` ou `additionalContext` que você escreveu é jogado fora e o modelo recebe só o
  stderr. *O que fica vermelho*: nada visível — só o comportamento fica pela metade.

- **Skill instalada e listada no `/skills`** → *parece funcionar*: aparece no menu, `/nome` roda.
  *Por que não é prova*: se o YAML estiver malformado, o Claude Code carrega o corpo com metadata
  **vazia** — o comando manual funciona e a ativação automática nunca acontece, porque não há
  `description` para casar. *O que fica vermelho se sumir*: nada. Só `claude --debug` mostra o erro
  de parse.

- **Catálogo com muitas skills** → *parece funcionar*: todas listadas. *Por que não é prova*: o
  listing tem orçamento de **1% da janela de contexto**; quando estoura, o Claude Code **corta as
  descrições** começando pelas skills menos invocadas. As skills continuam listadas por nome, mas
  sem os termos que fariam o modelo escolhê-las. *O que fica vermelho*: nada — `/doctor` estima o
  custo, mas ninguém roda `/doctor`.

- **Skill em `packages/x/.claude/skills/` num monorepo** → *parece funcionar*: o arquivo está lá,
  commitado. *Por que não é prova*: skills aninhadas **abaixo** do diretório de início **não carregam
  no startup**; só entram depois que o Claude lê ou edita um arquivo naquele subdiretório. Até lá
  não aparecem no autocomplete e não podem ser invocadas por nome. *O que fica vermelho*: nada —
  o agente simplesmente não usa a skill e escreve o código do jeito dele.

- **`/remotion-docs` instalada** → *parece funcionar*: a skill existe, o agente a invoca. *Por que
  não é prova*: ela **exige rede** (Algolia + fetch). Sem internet o agente segue e cai no
  conhecimento memorizado — que é a falha exata que a skill existe para prevenir. *O que fica
  vermelho*: nada. O código sai plausível e desatualizado.

- **`npx remotion skills update` num pipeline reprodutível** → *parece funcionar*: atualiza.
  *Por que não é prova*: só o caminho `add` está pinado em `skills@1.5.20`; o `update` chama
  `skills` sem pin e pega `latest` do npm. Duas máquinas no mesmo commit podem divergir.
  *O que fica vermelho*: nada, até o dia em que o `latest` muda o layout de instalação.

- **Subagent com `isolation: worktree` "vê o que a onda anterior fez"** → *parece funcionar*: é uma
  worktree do mesmo repo. *Por que não é prova*: a worktree é ramificada do **branch default**, não
  do `HEAD` da sessão pai. O trabalho não commitado — e o commitado num branch de feature — não está
  lá. *O que fica vermelho*: o build, mas tarde, e com uma mensagem que não aponta para a causa.

- **`allowed-tools` numa skill de render** → *parece funcionar*: o primeiro turno não pede permissão.
  *Por que não é prova*: a concessão **expira na próxima mensagem do usuário**. Um render em vários
  turnos volta a pedir. *O que fica vermelho*: um prompt de permissão no meio de um pipeline
  não-interativo — que em modo background pode virar negação silenciosa.

- **`SKILL.md` copiado do padrão Remotion** → *parece funcionar*: carrega no Claude Code.
  *Por que não é prova*: o `version:` de topo é campo fora da spec; o caminho de empacotamento para
  claude.ai/Skills API falha com erro duro de chave inesperada. *O que fica vermelho*: só quando
  alguém tentar publicar a skill fora do Claude Code local.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| L-01 | `npx skills add remotion-dev/skills` nesta máquina instala em `.agents/skills` com symlink `.claude/skills`, ou direto em `.claude/skills`? A doc do Remotion diz uma coisa; o README do vercel-labs sugere outra por agente. | Assumir `.agents/skills` + symlink `.claude/skills` (é o que a doc do CLI do Remotion afirma e o que o PR "Symlink Claude skills to agent skills" implementou na v4.0.501). | `cd $(mktemp -d) && npm init -y >/dev/null && npx -y skills@1.5.20 add remotion-dev/skills --yes && find . -maxdepth 3 -name SKILL.md -o -type l -name skills \| head` | O card de bootstrap e o `.gitignore`. Se for symlink, o git commita o link e não os arquivos — o catálogo do time some no CI. |
| L-02 | Quantos tokens as 12 skills do Remotion custam no listing desta máquina, e o listing estoura o orçamento de 1%? | Assumir que 12 skills cabem sem corte. | Dentro do Claude Code: `/doctor` (dá estimativa do custo do listing e maiores contribuintes) e `/context` (linha "Skills"). | Se estourar, as descrições são cortadas e o agente para de escolher as skills certas — falso verde silencioso (ver seção 4). |
| L-03 | O `exit 1` num hook desta versão (Claude Code 2.1.226) realmente não bloqueia? | Assumir que não bloqueia (doc explícita). | Hook `PreToolUse` matcher `Bash` com `echo x >&2; exit 1`; rodar um `Bash` trivial; ver se executa. Repetir com `exit 2`. | Todo gate determinístico do programa. Se o gate não bloqueia, o pipeline inteiro é conselho, não garantia. |
| L-04 | `SubagentStop` funciona como barreira de onda confiável quando os subagents rodam em background (padrão desde v2.1.198)? | Assumir que sim, mas com timeout próprio. | Hook `SubagentStop` que escreve `date +%s%N >> /tmp/barrier.log`; disparar 3 subagents; contar linhas. | O desenho das ondas paralelas. Se a barreira falhar, ondas se sobrepõem e as worktrees colidem no merge. |
| L-05 | Qual é o teto real de subagents concorrentes nesta instalação — 20 (default) ou outro via `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`? | Assumir 20. | `env \| grep CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` e testar largura crescente. | A largura máxima de uma onda. Passar do teto devolve `Concurrent subagent limit reached` e a doc diz que o erro instrui o modelo a **não** tentar de novo — trabalho perdido sem retry. |
| L-06 | `name` de skill realmente não pode conter "claude" ou "anthropic"? (Só `platform.claude.com` afirma; `agentskills.io` e `code.claude.com` não repetem.) | Evitar essas palavras em nomes de skill. Custo zero. | Criar `.claude/skills/claude-teste/SKILL.md` e ver se carrega no Claude Code; e tentar empacotar com `package_skill.py` de `anthropics/skills`. | Nomes do nosso catálogo. Custo de reverter: renomear um diretório. |
| L-07 | `isolation: worktree` ramifica do branch default mesmo quando a sessão pai já está numa worktree vinculada? | Assumir que sim (doc explícita) e passar o base branch por prompt. | Criar subagent com `isolation: worktree`, rodar de um branch de feature, e dentro dele `git rev-parse --abbrev-ref HEAD` + `git log -1 --oneline`. | O desenho de ondas encadeadas: a onda N+1 não veria o trabalho da onda N. |
| L-08 | O `/remotion-docs` funciona sem internet? E qual é o custo/latência de um ciclo Algolia + fetch `.md`? | Assumir que **não** funciona offline. | `curl -sS -m 5 -X POST 'https://plsduol1ca-dsn.algolia.net/1/indexes/*/queries?x-algolia-api-key=$SEARCH_KEY&x-algolia-application-id=$APP_ID'  # (chave PUBLICA de busca, visivel no bundle do site; extraia com: curl -s https://www.remotion.dev/docs | grep -o 'algolia[^"]*' -d '{"requests":[{"query":"useCurrentFrame","indexName":"remotion"}]}'` | A promessa de operação local. Se depender de rede, precisamos de espelho local da doc ou de aceitar a dependência explicitamente num card. |
| L-09 | Os arquivos instalados por `npx skills add remotion-dev/skills` carregam alguma licença? O repo não declara nenhuma e o `package.json` é `"private": true`. | Não redistribuir; tratar como "instalado, não vendorizado", até resposta do dono. | `find .agents .claude -iname 'LICENSE*' -o -iname 'COPYING*' 2>/dev/null` após instalar. | Se vendorizarmos as skills no nosso repo sem licença, isso é um problema jurídico, não técnico. Ver PERGUNTA-DONO. |
| L-10 | O `PostToolUse` consegue rodar `tsc`/lint por edição sem estourar o cap de 10.000 caracteres da saída de hook? | Assumir que estoura em erro grande; truncar no próprio script. | Hook `PostToolUse` matcher `Edit\|Write` que roda o typecheck e conta bytes do stderr. | O gate de tipo. Saída truncada com "preview + file path" pode fazer o modelo agir sobre um erro parcial. |
| L-11 | O MCP hospedado do Remotion já foi desligado? (data anunciada: não antes de 2026-08-31; hoje é 2026-08-10) | Não usar o MCP. Nenhum card depende dele. | `npx -y @remotion/mcp` e observar; ou acompanhar https://github.com/remotion-dev/remotion/issues/9055 | Nada nosso, se seguirmos a recomendação. Só vira problema se alguém reintroduzir o MCP num card. |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| Vendorizamos as 12 skills do Remotion dentro do nosso repositório, ou instalamos por CLI a cada bootstrap? | O repo `remotion-dev/skills` **não declara licença** (API do GitHub devolve `license: null`, `package.json` com `"private": true`). Copiar código de terceiro sem licença declarada é decisão jurídica, não técnica. | **Vendorizar:** build reprodutível, offline, mas exposição jurídica e skills que envelhecem em silêncio. **Instalar por CLI:** sempre atualizado, sem cópia, mas exige rede no bootstrap e depende de `vercel-labs/skills` (`update` sem pin). |
| Aceitamos a dependência de `vercel-labs/skills` (terceiro, MIT) na cadeia de bootstrap, ou reimplementamos o `add` como um `git clone` + `cp`? | É apetite de risco de supply chain: um pacote npm de terceiro que escreve em `.claude/`/`.agents/` do projeto, executado por `npx` com `--yes`. | **Aceitar:** menos código nosso, comando alinhado com a doc oficial. **Reimplementar:** ~20 linhas de script, zero terceiros, mas divergimos do caminho documentado e perdemos `update`. |
| O sistema tem que funcionar **sem rede**, ou rede é aceitável no ciclo de autoria? | O panorama diz "rodando LOCALMENTE", o que pode significar "sem nuvem de renderização" ou "sem nenhuma chamada externa". `/remotion-docs` (Algolia), instalação de skills (npm) e Giphy (citado no panorama) são todos rede. | **Offline duro:** precisa de espelho local da doc do Remotion, skills vendorizadas, e o card do Giphy morre. **Rede aceitável:** o caminho oficial do Remotion funciona como documentado e não escrevemos infra de espelho. |
| Qual é o alvo de distribuição do **nosso** catálogo de skills: só Claude Code local, ou também claude.ai/Skills API? | Os dois formatos são incompatíveis: Claude Code aceita ~20 campos de frontmatter; o empacotamento para claude.ai/API aceita só os **6** da spec e falha com erro duro em qualquer extra. | **Só Claude Code:** podemos usar `context: fork`, `disable-model-invocation`, `allowed-tools`, `paths`, `hooks` — o que dá gates de verdade. **Portável:** perdemos todos esses e o catálogo vira só texto. |
| Vamos fixar a versão do Remotion e das skills (pin) ou seguir `latest`? | É apetite de risco: as skills declaram `version: 4.0.507` casada com o Remotion, e a cadência do Remotion é de vários releases por semana (4.0.498→4.0.507 em ~15 dias). | **Pin:** builds reprodutíveis; skills e API sempre casadas; custo de manter o bump. **Latest:** API sempre atual; risco de a skill e o pacote divergirem no meio de uma onda de agentes. |
| Os hooks de gate ficam em `.claude/settings.json` (commitado, vale para o time) ou no frontmatter das skills/agents (escopo do componente)? | É decisão de mandato: hook em settings vale para tudo e para todos; hook em frontmatter vale só enquanto o componente está ativo e, em subagent de projeto, só depois de aceitar o diálogo de confiança do workspace. | **Settings commitado:** garantia uniforme, mas todo mundo paga o custo em toda sessão. **Frontmatter:** cirúrgico, mas um agente que não carrega a skill não tem o gate — e isso é indistinguível de "o gate passou". |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** a escolha entre **instalar as skills por CLI** e **vendorizá-las** é
  reversível por **uma variável** no script de bootstrap: `SKILLS_MODE=cli|vendor`. Custo da
  reversão: 1 arquivo (`scripts/bootstrap-skills.sh`), ~30 linhas, e uma entrada no `.gitignore`.
  Comece por `cli` (é o caminho documentado e não copia código sem licença) e mude para `vendor`
  no dia em que L-09 ou o requisito offline forçar.

  Um segundo ponto de troca barata: **o alvo de distribuição do nosso catálogo**. Se escrevermos
  os `SKILL.md` usando **apenas os 6 campos da spec** desde o começo, migrar para claude.ai/API
  depois custa zero. Usar `context: fork` ou `disable-model-invocation` no dia 1 fecha essa porta
  e reabri-la custa reescrever cada frontmatter. Recomendo: **corpo e frontmatter na spec; os
  campos exclusivos do Claude Code só em skills declaradamente locais**, num subdiretório separado.

- **Skills que devem carregar este conhecimento** (nomes conforme `docs/CONTRATO-DE-SKILL.md`;
  se algum não existir lá, é para criar):
  - a skill de **bootstrap de ambiente/worktree** — comandos literais de R06-02/R06-03, o pin
    `skills@1.5.20`, e o aviso de que `update` não é pinado.
  - a skill de **autoria de skills** (formato do catálogo) — a tabela dos 6 campos de R06-14/R06-15,
    os 3 níveis de progressive disclosure de R06-16, o limite de 500 linhas, e a regra
    "`name` == nome do diretório, sempre".
  - a skill de **gates e hooks** — a tabela de exit codes de R06-24/R06-25, com a frase
    "`exit 1` não bloqueia" em destaque, e a regra "exit codes **ou** JSON, nunca os dois".
  - a skill de **orquestração em worktrees** — teto de 20 subagents concorrentes, `isolation:
    worktree` ramificando do branch default, `SubagentStop` como barreira.
  - a skill de **consulta à doc do Remotion** — `.md` no caminho, `Accept: text/markdown`, e o
    aviso de que `/remotion-docs` exige rede.

- **Cards que este cluster condiciona:**
  1. **Bootstrap da worktree**: instalar Remotion ≥ 4.0.410, rodar `npx remotion skills add`,
     verificar que os 12 `SKILL.md` chegaram, e registrar onde eles caíram (fecha L-01).
  2. **Catálogo de skills do projeto**: escrever nossos `SKILL.md` na spec, com lint que verifica
     `name` (≤64, regex, == diretório), `description` (≤1024), ausência de campos fora dos 6, e
     contagem de linhas < 500.
  3. **Gates determinísticos**: `PostToolUse` para typecheck/lint por edição; `Stop`/`SubagentStop`
     para "não termine sem render de smoke"; `PreToolUse` para bloquear escrita fora da worktree.
     Todos com `exit 2` ou JSON — nunca `exit 1`.
  4. **Barreira de onda**: hook `SubagentStop` escrevendo num arquivo de barreira, com o teto de 20
     concorrentes como largura máxima da onda.
  5. **Card negativo (não fazer)**: **não** instalar o MCP do Remotion. Registrar a razão
     (depreciado, desligamento anunciado para não antes de 2026-08-31) para que ninguém o
     reintroduza em três meses.
  6. **Card de decisão offline**: espelhar a doc do Remotion localmente **ou** documentar
     explicitamente a dependência de rede de `/remotion-docs` (depende da PERGUNTA-DONO sobre rede).
  7. **Card jurídico/administrativo**: resolver a licença de `remotion-dev/skills` antes de
     qualquer vendorização.
