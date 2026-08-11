# R15 — Orquestração de agentes em paralelo: worktrees, barreiras, hooks

**Escopo desta pesquisa:** fecha a mecânica verificável de rodar N agentes de código em paralelo
nesta máquina — semântica exata de `git worktree`, superfície não-interativa do Claude Code
(`-p`, formatos de saída, exit codes), hooks como barreira durável, e integração por merge
sequencial com gate. **Não** responde quantos agentes esta máquina aguenta (isso é ledger),
nem qual conta/plano paga a conta (isso é pergunta-dono), nem nada sobre Remotion/Manim.

---

## Convenções desta pesquisa (leia antes do placar)

1. **`git-scm.com` e `kernel.org/.../git-worktree.html` publicam o MESMO texto upstream.**
   Conto os dois como **uma** fonte. Fetch feito nos dois só para provar que o texto citado é o
   texto oficial e não uma paráfrase.
2. **Todas as páginas sob `code.claude.com/docs` contam como UMA fonte** (mesmo domínio), por
   mais que eu tenha lido oito páginas diferentes. `platform.claude.com` conta separado.
3. **`REPRO` = verificação executada nesta máquina** em 2026-08-10, com
   `git 2.43.0` e `Claude Code 2.1.226`, Linux 6.18.7. Conto como fonte independente **porque o
   comando literal está na seção 2 e qualquer leitor pode falsificar em 30 segundos**. Um REPRO
   sem comando copiável não valeria nada e não existe neste arquivo.
4. **Aviso de método:** a cota de `WebSearch` da sessão estourou (200/200 consumidas antes deste
   agente começar) depois de 4 buscas. Compensei com **21 `WebFetch` de páginas primárias** e
   **7 experimentos locais**. As buscas que faltaram teriam servido para *achar* fontes, não para
   validá-las; onde não achei fonte primária, o item virou `LEDGER-SEED` ou `PERGUNTA-DONO` — não
   virou claim.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R15-01 | `git worktree add` materializa apenas o conteúdo **rastreado** do commit-ish: arquivos ignorados e untracked do checkout principal não vão junto. | (3-0) | CONFIRMADO | https://git-scm.com/docs/git-worktree |
| R15-02 | Numa worktree vinculada, `.git` é um **arquivo** contendo `gitdir: <repo>/.git/worktrees/<nome>`, e esse diretório administrativo guarda `gitdir`, `commondir`, `HEAD`, `index`, `logs`. | (2-0) | PROVÁVEL | https://git-scm.com/docs/git-worktree |
| R15-03 | `git worktree remove` recusa worktree com modificação ou untracked (`fatal: ... contains modified or untracked files, use --force to delete it`), exige `-f -f` para worktree travada, e a worktree principal não pode ser removida. | (2-0) | PROVÁVEL | https://git-scm.com/docs/git-worktree |
| R15-04 | `git worktree remove` **não apaga o branch** da worktree removida. | (2-0) | PROVÁVEL | REPRO + https://code.claude.com/docs/en/worktrees |
| R15-05 | Padrão de `.gitignore` com barra final (`assets/`) **não casa um symlink** de mesmo nome: o symlink fica untracked e é commitável por `git add -A`; sem a barra (`assets`) ele é ignorado. | (2-0) | PROVÁVEL | https://git-scm.com/docs/gitignore |
| R15-06 | `git worktree lock` cria o arquivo `locked` no diretório administrativo com o motivo em texto puro e bloqueia prune/move/remove; o Claude Code trava a worktree de um agente enquanto ele roda. | (3-0) | CONFIRMADO | https://git-scm.com/docs/git-worktree |
| R15-07 | `git worktree prune` remove metadados de worktrees cujo diretório sumiu; `git worktree list` marca `prunable`; expiração automática por `gc.worktreePruneExpire`. | (2-0) | PROVÁVEL | https://git-scm.com/docs/git-worktree |
| R15-08 | `git worktree list --porcelain` emite um bloco por worktree (`worktree <path>` / `HEAD <sha>` / `branch <ref>`) em formato estável entre versões — é a única leitura de estado apta a script. | (2-0) | PROVÁVEL | https://git-scm.com/docs/git-worktree |
| R15-09 | Claude Code 2.1.226 tem worktree **nativa**: `-w/--worktree [nome]` cria `.claude/worktrees/<nome>` no branch `worktree-<nome>`, e existe `--tmux` (exige `--worktree`). | (2-0) | PROVÁVEL | https://code.claude.com/docs/en/worktrees |
| R15-10 | `.worktreeinclude` (sintaxe `.gitignore`, na raiz do projeto) copia para cada worktree criada pelo Claude Code os arquivos que casam **e** são gitignorados — é a alternativa nativa ao symlink. | (1-0) | NÃO VERIFICADO | https://code.claude.com/docs/en/worktrees |
| R15-11 | Rodando com `-p`, o Claude Code **não** limpa a worktree ao sair; a remoção fica por conta do orquestrador. | (1-0) | NÃO VERIFICADO | https://code.claude.com/docs/en/worktrees |
| R15-12 | As flags não-interativas existem e são aceitas em 2.1.226: `-p`, `--output-format text\|json\|stream-json`, `--input-format`, `-r/--resume`, `-c/--continue`, `--session-id`, `--fork-session`, `--allowedTools`, `--disallowedTools`, `--permission-mode`, `--append-system-prompt`, `--agents <json>`, `--settings`, `--json-schema`, `--max-budget-usd`, `--no-session-persistence`, `--bare`. | (2-0) | PROVÁVEL | https://code.claude.com/docs/en/cli-reference |
| R15-13 | `--max-turns` é documentado e aceito pelo parser em 2.1.226, **mas não aparece em `claude --help`**. | (2-0) | PROVÁVEL | https://code.claude.com/docs/en/cli-reference |
| R15-14 | `--permission-mode default` é aceito em 2.1.226 embora a mensagem de erro do binário enumere só `acceptEdits, auto, bypassPermissions, manual, dontAsk, plan`. | (2-0) | PROVÁVEL | https://code.claude.com/docs/en/cli-reference |
| R15-15 | `claude -p` sai com **0** em sucesso, não-zero em falha, e **143** em SIGTERM (após abortar o turno e rodar `SessionEnd`). | (2-0) | PROVÁVEL | https://code.claude.com/docs/en/headless |
| R15-16 | `--output-format json` devolve **um** objeto; em 2.1.226 os campos observados incluem `is_error`, `subtype`, `num_turns`, `session_id`, `result`, `total_cost_usd`, `usage`, `modelUsage`, `permission_denials`, `terminal_reason`, `stop_reason`, `duration_api_ms`. | (2-0) | PROVÁVEL | https://code.claude.com/docs/en/headless |
| R15-17 | O hook `Stop` dispara **também em modo `-p`**, e o payload real em 2.1.226 traz `session_id`, `transcript_path`, `cwd`, `prompt_id`, `permission_mode`, `effort.level`, `hook_event_name`, `stop_hook_active`, `last_assistant_message`, `background_tasks`, `session_crons`. | (2-0) | PROVÁVEL | https://code.claude.com/docs/en/hooks |
| R15-18 | Uma **barreira durável** é um hook `Stop` do tipo `command` cujo comando anexa o JSON de stdin a um arquivo: funciona sem TTY, sem ler tela e deixa rastro em disco. | (2-0) | PROVÁVEL | https://code.claude.com/docs/en/hooks |
| R15-19 | O payload real de `SessionEnd` em 2.1.226 usa a chave **`reason`** (valor observado `other`); a referência de hooks descreve o campo como `end_reason`. | (1-1) | EM DISPUTA | REPRO vs https://code.claude.com/docs/en/hooks |
| R15-20 | `SubagentStop` dispara ao fim de um subagente, aceita matcher por tipo de agente e o payload inclui `agent_id`/`agent_type`. | (1-0) | NÃO VERIFICADO | https://code.claude.com/docs/en/hooks |
| R15-21 | O Claude Code sobrescreve um hook `Stop` depois de **8 bloqueios consecutivos**, e `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` eleva esse teto. | (1-0) | NÃO VERIFICADO | https://code.claude.com/docs/en/hooks-guide.md |
| R15-22 | Mesclar mais de um branch usa a estratégia `octopus` por padrão, que "refuses to do a complex merge that needs manual resolution": no primeiro conflito **o lote inteiro falha** e o `HEAD` não anda. | (2-0) | PROVÁVEL | https://git-scm.com/docs/git-merge |
| R15-23 | Reverter um merge exige `-m <parent-number>`; num commit octopus de N pais o revert é relativo a **um** pai e desfaz **todos** os outros contribuintes de uma vez. | (2-0) | PROVÁVEL | https://git-scm.com/docs/git-revert |
| R15-24 | O padrão publicado dominante de multi-agente é **worktree + tmux, um agente por worktree** (uzi, claude-squad) ou **container + branch por agente** (container-use, "early development"), e **nenhum** dos três READMEs documenta como o término de um agente é detectado. | (3-0) | CONFIRMADO | https://github.com/devflowinc/uzi , https://github.com/smtg-ai/claude-squad , https://github.com/dagger/container-use |
| R15-25 | O teto de paralelismo na API é por organização/modelo em RPM+ITPM+OTPM com `429` + `retry-after`; numa assinatura Pro/Max/Team o teto **não é RPM**, é janela de 5 h + janela semanal por assento. | (2-0) | PROVÁVEL | https://platform.claude.com/docs/en/api/rate-limits |

---

## 2. Detalhe por claim

### R15-01 — `git worktree add` só materializa o que está rastreado

- **Verdade operacional:** worktree é *checkout novo*, não cópia de diretório. `node_modules/`,
  `.env`, `assets/` gerados, cache de fontes, saída de render — nada disso aparece. Um agente
  lançado numa worktree limpa quebra no primeiro `import` se você não providenciar o insumo.
- **Como reconferir:**
  ```bash
  git init -q /tmp/wt/main && cd /tmp/wt/main && git config user.email a@b.c && git config user.name t
  mkdir -p src assets && echo hello > src/a.txt && printf 'assets/\n' > .gitignore && echo big > assets/ignored.bin
  git add -A && git commit -qm init
  git worktree add -b feat ../wt-feat
  test -e ../wt-feat/assets && echo PRESENTE || echo AUSENTE      # imprime AUSENTE
  ```
- **O que quebra se divergir:** o card "provisionar worktree de agente" some, e o card "bootstrap
  de insumo por worktree" (symlink ou `.worktreeinclude`) vira desnecessário. Se divergir para o
  outro lado — se um dia o git passar a copiar ignorados — o gate de "worktree limpa" passa a
  dar falso vermelho.
- **Fontes:**
  - https://git-scm.com/docs/git-worktree (primária) — "The new worktree is linked to the current
    repository, sharing everything except per-worktree files such as `HEAD`, `index`, etc."
  - https://code.claude.com/docs/en/worktrees (primária) — "A worktree is a fresh checkout, so
    untracked files like `.env` or `.env.local` from your main repository are not present."
  - REPRO acima, git 2.43.0.

### R15-02 — `.git` é arquivo, e o estado administrativo mora no repo principal

- **Verdade operacional:** apagar o diretório da worktree **não** apaga o registro. Sobram
  metadados em `<repo>/.git/worktrees/<nome>` até você rodar `prune`. Script de limpeza que só faz
  `rm -rf` deixa lixo que depois recusa reusar o mesmo nome de path.
- **Como reconferir:**
  ```bash
  cat ../wt-feat/.git                 # gitdir: /caminho/main/.git/worktrees/wt-feat
  ls /caminho/main/.git/worktrees/wt-feat   # gitdir commondir HEAD index logs ORIG_HEAD
  ```
- **O que quebra se divergir:** o passo `prune` do card de teardown; e o gate "nenhuma worktree
  órfã antes da próxima onda".
- **Fontes:** https://git-scm.com/docs/git-worktree (primária) — "Within a linked worktree,
  `$GIT_DIR` is set to point to this private directory ... These settings are made in a `.git`
  file located at the top directory of the linked worktree." + REPRO.

### R15-03 — `remove` é conservador de propósito

- **Verdade operacional:** o `remove` é o **gate implícito de perda de trabalho**. Se ele recusa,
  é porque tem coisa não commitada lá dentro. Um teardown que usa `--force` cegamente destrói
  silenciosamente o resultado de um agente que esqueceu de commitar.
- **Como reconferir:**
  ```bash
  echo dirty > ../w1/untracked.txt
  git worktree remove ../w1
  # fatal: '../w1' contains modified or untracked files, use --force to delete it   (rc=128)
  git worktree lock ../w1 --reason "agente rodando"
  git worktree remove --force ../w1
  # fatal: cannot remove a locked working tree, lock reason: agente rodando  (rc=128)
  git worktree remove --force --force ../w1        # rc=0
  ```
- **O que quebra se divergir:** o gate "worktree limpa ⇒ pode remover"; e a política de
  `--force` do script de teardown.
- **Fontes:** https://git-scm.com/docs/git-worktree (primária) — "Only clean worktrees (no
  untracked files and no modification in tracked files) can be removed. ... The main worktree
  cannot be removed." e "To remove a locked worktree, specify `--force` twice." + REPRO.

### R15-04 — remover a worktree não remove o branch

- **Verdade operacional:** depois de `git worktree remove ../wf`, o branch `feat` continua no
  repo. Onda de 6 agentes = 6 branches acumulando por onda, para sempre, se ninguém apagar.
- **Como reconferir:**
  ```bash
  git worktree add -q -b feat ../wf && git worktree remove ../wf && git branch --list
  # feat * main    <- feat sobreviveu
  ```
- **O que quebra se divergir:** o card de teardown perde o passo `git branch -D`; a listagem de
  branches vira ruído e o gate "só branches de onda ativa existem" fica impossível.
- **Fontes:** REPRO (git 2.43.0) + https://code.claude.com/docs/en/worktrees (primária), que
  descreve a limpeza **do próprio Claude Code** como "Removing deletes the worktree directory
  **and its branch**" — a distinção só faz sentido porque o `git worktree remove` puro não faz.

### R15-05 — a armadilha do symlink com `.gitignore` terminado em barra

- **Verdade operacional:** o padrão que você usa hoje para ignorar a pasta de insumos
  (`assets/`, `out/`, `media/`) **não** ignora o symlink que você criar com o mesmo nome dentro da
  worktree do agente. Resultado: `git status` acusa `?? assets`, e um agente instruído a
  "commitar tudo" faz `git add -A` e **commita o symlink** apontando para um caminho absoluto da
  sua máquina. O diff vira um arquivo de uma linha com um path de `/home/...`.
- **Como reconferir:**
  ```bash
  printf 'assets/\n' > .gitignore          # padrão com barra
  ln -s /caminho/main/assets ./assets
  git check-ignore -v assets ; echo rc=$?  # rc=1  -> NAO ignorado
  git status --porcelain                   # ?? assets
  git add -A && git status --porcelain     # A  assets   <- foi para o index
  printf 'assets\n' > .gitignore           # padrão SEM barra
  git check-ignore -v assets ; echo rc=$?  # .gitignore:1:assets  assets   rc=0
  ```
- **O que quebra se divergir:** o card "symlinkar insumo gitignorado na worktree" precisa carregar
  a regra *"o padrão do .gitignore do insumo não pode terminar em barra"*, senão o gate de diff
  limpo passa e o merge traz um symlink absoluto para dentro de `main`.
- **Fontes:** https://git-scm.com/docs/gitignore (primária) — "The pattern `foo/` will match a
  directory `foo` and paths underneath it, but will not match a regular file or a symbolic link
  `foo` (this is consistent with the way how pathspec works in general in Git)" + REPRO.
- **Alternativa nativa:** ver R15-10 (`.worktreeinclude`), que copia em vez de linkar e não sofre
  desse problema — mas só vale para worktrees criadas *pelo Claude Code*.

### R15-06 — `lock` é o mecanismo de exclusão mútua que já existe

- **Verdade operacional:** você não precisa inventar lockfile. `git worktree lock --reason` grava
  um arquivo `locked` legível e faz `prune`/`remove`/`move` recusarem. É exatamente o que o
  Claude Code faz na worktree de um subagente enquanto ele roda.
- **Como reconferir:**
  ```bash
  git worktree lock ../w1 --reason "onda 3 / agente remotion"
  cat .git/worktrees/w1/locked      # onda 3 / agente remotion
  git worktree list                 # mostra a worktree; prune não a remove
  git worktree unlock ../w1
  ```
- **O que quebra se divergir:** o card "varredura de worktrees órfãs" pode apagar a worktree de um
  agente vivo. Com `lock`, não pode.
- **Fontes:** https://git-scm.com/docs/git-worktree (primária) — "use the `git worktree lock`
  command, which adds a file named `locked` to the entry's directory. The file contains the reason
  in plain text."; https://code.claude.com/docs/en/worktrees (primária) — "While an agent is
  running, Claude runs `git worktree lock` on its worktree so that concurrent cleanup cannot
  remove it."; REPRO.

### R15-07 — `prune` e a expiração automática

- **Verdade operacional:** `git worktree list` já marca `prunable`; `prune -v` explica o motivo
  (`gitdir file points to non-existent location`). Existe expiração automática por
  `gc.worktreePruneExpire`, o que significa que **o registro some sozinho um dia** — não conte com
  ele como fonte de verdade histórica de "quais agentes rodaram".
- **Como reconferir:**
  ```bash
  git worktree add -q -b w2 ../w2 && rm -rf ../w2
  git worktree list          # ... [w2] prunable
  git worktree prune -v      # Removing worktrees/w2: gitdir file points to non-existent location
  ```
- **O que quebra se divergir:** o card de teardown e o gate "zero worktrees prunable antes da
  próxima onda".
- **Fontes:** https://git-scm.com/docs/git-worktree (primária), inclusive `--expire <time>` +
  REPRO.

### R15-08 — `list --porcelain` é a única leitura de estado apta a script

- **Verdade operacional:** a saída humana de `git worktree list` é alinhada por colunas e muda com
  o comprimento dos paths. O `--porcelain` é declarado estável e recomenda-se combinar com `-z`.
- **Como reconferir:** `git worktree list --porcelain` → blocos separados por linha em branco:
  ```
  worktree /caminho/main
  HEAD 221fff84629ac8e0af29887674c6f8ef22a7177f
  branch refs/heads/main
  ```
- **O que quebra se divergir:** o card do "monitor de ondas" que lê estado de worktrees; se ele
  fizer parsing da saída humana, quebra no primeiro path longo.
- **Fontes:** https://git-scm.com/docs/git-worktree (primária) — "This format will remain stable
  across Git versions and regardless of user configuration. It is recommended to combine this with
  `-z`." + REPRO.

### R15-09 — worktree nativa do Claude Code (o achado que muda o roadmap)

- **Verdade operacional:** o produto já faz o que a gente ia scriptar. `claude --worktree nome`
  cria `.claude/worktrees/nome/` no branch `worktree-nome`, ramificado do **branch default do
  remoto** (`worktree.baseRef: "fresh"`, o default) ou do `HEAD` local (`"head"`). Também existem:
  as ferramentas `EnterWorktree`/`ExitWorktree`, o frontmatter `isolation: worktree` para
  subagente, os hooks `WorktreeCreate`/`WorktreeRemove` (que **substituem** a lógica git), e um
  bloqueio ativo de edições/`cd`/redirecionamento de git para o checkout principal enquanto a
  sessão está isolada. `--tmux` cria a sessão tmux da worktree (exige `--worktree`).
- **Como reconferir:**
  ```bash
  claude --version                                # 2.1.226
  claude --help | grep -E -- '--worktree|--tmux'
  #  --tmux    Create a tmux session for the worktree (requires --worktree). ...
  #  -w, --worktree [name]   Create a new git worktree for this session (optionally specify a name)
  ```
- **O que quebra se divergir:** se a flag sumir numa versão futura, o card "lançador de onda"
  precisa voltar ao `git worktree add` manual + `cd` + `claude`. Fixe a versão no gate.
- **Fontes:** https://code.claude.com/docs/en/worktrees (primária, cita
  `.claude/worktrees/<name>/`, branch `worktree-<name>`, `worktree.baseRef`, `.worktreeinclude`,
  `isolation: worktree`, `WorktreeCreate`) + REPRO (`claude --help`, 2.1.226).
- **Nota de rechecagem (limite 2026-11-10):** a página de worktrees aponta `worktree.baseRef` para
  `settings#worktree-settings`, mas o fetch da referência de settings **não** trouxe essa seção.
  Ver LEDGER-SEED `LS-05`.

### R15-10 — `.worktreeinclude`

- **Verdade operacional:** arquivo na raiz do projeto, sintaxe `.gitignore`. Copia para cada
  worktree criada pelo Claude Code os arquivos que casam o padrão **e** são gitignorados
  (arquivos rastreados nunca são duplicados). Não é processado quando um hook `WorktreeCreate`
  assume a criação.
- **Como reconferir:** criar `.worktreeinclude` com `.env`, rodar `claude --worktree teste -p "ls -a"`
  e conferir se `.claude/worktrees/teste/.env` existe.
- **O que quebra se divergir:** o card "insumo gitignorado por worktree" volta a depender de
  symlink, e aí a armadilha R15-05 volta a valer.
- **Fontes:** https://code.claude.com/docs/en/worktrees (primária, única). **Uma fonte só ⇒ não
  vira card sem o teste de LS-01.**

### R15-11 — `-p` não limpa worktree

- **Verdade operacional:** o prompt de limpeza é uma coisa de sessão interativa. Em modo `-p` a
  worktree fica em disco. Numa onda de 6 agentes headless por dia, isso acumula 6 checkouts/dia.
- **Como reconferir:** rodar `claude -p --worktree ondaX "echo oi"` e depois `git worktree list`.
- **O que quebra se divergir:** se o `-p` passar a limpar sozinho, o teardown do orquestrador vira
  redundante e pode até brigar com o produto.
- **Fontes:** https://code.claude.com/docs/en/worktrees (primária, única) — "Non-interactive runs
  with `-p` have no exit prompt, so Claude doesn't clean up their worktrees. Remove them with
  `git worktree remove`."

### R15-12 — a superfície não-interativa

- **Verdade operacional:** a lista existe e é aceita pelo binário 2.1.226. Duas notas com dente:
  (a) `--bare` **desliga hooks**, então uma barreira por hook `Stop` e `--bare` são mutuamente
  exclusivos; (b) sem `--bare`, o `-p` carrega hooks, skills, plugins, MCP e `CLAUDE.md` do
  ambiente — a sessão que eu rodei reportou `permission_mode: "auto"` e `effort: xhigh` herdados
  das minhas settings, não do comando.
- **Como reconferir:** `claude --help` e, para as flags escondidas, `claude <flag> --version`
  (o parser valida antes de imprimir a versão; flag desconhecida vira
  `error: unknown option '--x'`).
- **O que quebra se divergir:** todo card de lançamento de onda.
- **Fontes:** https://code.claude.com/docs/en/cli-reference (primária) + REPRO.

### R15-13 — `--max-turns` documentado mas fora do `--help` (fechamento parcial)

- **Metade verificada:** documentado ("Limit the number of agentic turns (print mode only). Exits
  with an error when the limit is reached") e **aceito** pelo parser 2.1.226.
- **Metade que não fecha:** não aparece em `claude --help`. Ou seja, `--help` **não é** inventário
  de flags nesta versão — não use `--help` como prova de ausência.
- **Como reconferir:**
  ```bash
  claude --help | grep -c -- '--max-turns'      # 0
  claude --max-turns 1 --version                # 2.1.226 (Claude Code)  -> parser aceitou
  ```
- **O que quebra se divergir:** o card "orçamento de turnos por agente"; e qualquer gate que
  valide flags contra `--help`.
- **Fontes:** https://code.claude.com/docs/en/cli-reference (primária) + REPRO.

### R15-14 — `--permission-mode`: doc e binário discordam na lista, não no comportamento

- **Verdade operacional:** `default` é aceito; a mensagem de erro do binário lista outros seis
  valores e **não** lista `default`. `manual` é o nome que o binário exibe para o mesmo modo.
- **Como reconferir:**
  ```bash
  claude --permission-mode default --version   # ok
  claude --permission-mode bogus --version
  # error: option '--permission-mode <mode>' argument 'bogus' is invalid.
  # Allowed choices are acceptEdits, auto, bypassPermissions, manual, dontAsk, plan.
  ```
- **O que quebra se divergir:** o card de política de permissão por onda. Para CI/onda headless a
  doc recomenda `dontAsk` (nega o que não estiver em `permissions.allow` nem no conjunto
  read-only); `auto` **aborta** em `-p` se o classificador bloquear repetidamente.
- **Fontes:** https://code.claude.com/docs/en/cli-reference e /headless (primária, mesma fonte) +
  REPRO.

### R15-15 — exit codes: o sinal de término confiável

- **Verdade operacional:** o desfecho de uma sessão headless é **o exit code do processo**, não
  texto na tela. `wait $pid` num script de onda é a barreira mais barata e mais confiável que
  existe. O `143` (SIGTERM) é o caminho de cancelamento: o produto aborta o turno, mata a árvore
  de processos do Bash em execução e roda `SessionEnd` antes de sair.
- **Como reconferir:** `claude -p "diga OK" > out.json; echo $?` (observei `0`).
- **O que quebra se divergir:** a barreira da onda inteira. Se o exit code deixar de ser
  significativo, o orquestrador precisa cair para o arquivo de status do hook (R15-18).
- **Fontes:** https://code.claude.com/docs/en/headless (primária) — "Claude Code exits with code 0
  on success and a non-zero code when the run fails, so your scripts can branch on the exit
  status." e "...runs `SessionEnd` hooks, and exits with code 143." + REPRO parcial (só o 0).

### R15-16 — o objeto JSON de resultado

- **Verdade operacional:** um `claude -p --output-format json` de um turno trivial devolveu:
  ```json
  {"is_error":false,"duration_api_ms":1435,"num_turns":1,"stop_reason":"end_turn",
   "session_id":"3a5a4f8a-...","total_cost_usd":0.03435,"usage":{...},
   "modelUsage":{"claude-opus-5[1m]":{...}},"permission_denials":[],
   "terminal_reason":"completed","subtype":"success","api_error_status":null,"result":"OK"}
  ```
  `is_error`, `subtype`, `terminal_reason` e `permission_denials` são os quatro campos que um gate
  de onda deve checar — `permission_denials` não-vazio é a assinatura de "o agente foi barrado e
  fingiu que terminou".
- **Como reconferir:** o comando acima, com `jq -r '.is_error, .subtype, .permission_denials'`.
- **O que quebra se divergir:** o parser de resultado do orquestrador e o gate por agente.
- **Fontes:** https://code.claude.com/docs/en/headless (primária; documenta `result`,
  `session_id`, `total_cost_usd`, `structured_output`) + REPRO (lista completa observada).

### R15-17 / R15-18 — o hook `Stop` como barreira durável (o coração deste cluster)

- **Verdade operacional:** funciona, inclusive em `-p`, e é **exatamente** o mecanismo de barreira
  que a gente queria. Configuração mínima (passável por `--settings`, sem tocar no repo):
  ```json
  {
    "hooks": {
      "Stop": [
        { "hooks": [ { "type": "command", "command": "cat >> /caminho/status/stop.jsonl" } ] }
      ]
    }
  }
  ```
  O hook recebe o payload em **stdin**; `cat >>` já grava uma linha JSON por término. Para uma
  barreira legível por `grep`, use
  `jq -c '{agent:env.AGENT_ID, session:.session_id, msg:.last_assistant_message}' >> status.jsonl`.
  Payload real observado em 2.1.226:
  ```json
  {"session_id":"3a5a4f8a-...","transcript_path":"/home/.../3a5a4f8a-....jsonl",
   "cwd":"/tmp/.../hooklab","prompt_id":"80248ee8-...","permission_mode":"auto",
   "effort":{"level":"xhigh"},"hook_event_name":"Stop","stop_hook_active":false,
   "last_assistant_message":"OK","background_tasks":[],"session_crons":[]}
  ```
  Três consequências de projeto:
  1. `last_assistant_message` vem no payload — **não precisa ler o transcript**, que a própria doc
     avisa que "may lag current turn".
  2. `transcript_path` dá o caminho do `.jsonl` da sessão, então a barreira também é um índice de
     auditoria por agente.
  3. Todos os hooks que casam um evento rodam **em paralelo**; timeout default de hook `command`
     é 600 s.
- **Como reconferir (comando completo, roda em ~10 s):**
  ```bash
  D=/tmp/hooklab; mkdir -p $D; cd $D
  cat > settings.json <<EOF
  {"hooks":{"Stop":[{"hooks":[{"type":"command","command":"cat >> $D/stop.jsonl"}]}]}}
  EOF
  claude -p "Reply with exactly: OK" --settings $D/settings.json \
         --output-format json --max-turns 1 --tools "" < /dev/null > out.json
  echo "rc=$?"; cat $D/stop.jsonl
  ```
- **O que quebra se divergir:** o card "barreira de onda" inteiro, e com ele o card "disparar a
  onda N+1". Sem `Stop`, sobra `wait` no PID (R15-15) — que funciona, mas perde a durabilidade:
  se o orquestrador morrer, o `wait` some e o arquivo de status não.
- **Fontes:** https://code.claude.com/docs/en/hooks (primária) + REPRO.

### R15-19 — `SessionEnd`: `reason` vs `end_reason` (EM DISPUTA, leia as duas leituras)

- **Leitura A (documentação):** a referência de hooks descreve o payload de `SessionEnd` com o
  campo `end_reason`, e enumera os valores `clear`, `resume`, `logout`, `prompt_input_exit`,
  `bypass_permissions_disabled`, `other`.
- **Leitura B (execução em 2.1.226):** o payload gravado foi
  `{"session_id":"...","transcript_path":"...","cwd":"...","prompt_id":"...","hook_event_name":"SessionEnd","reason":"other"}`
  — chave **`reason`**, não `end_reason`. O valor (`other`) bate com a enumeração.
- **O que as separa:** ou a doc descreve outra versão, ou o resumo que li renomeou o campo, ou o
  binário mudou. Não dá para decidir sem abrir a doc byte a byte no mesmo dia da versão instalada.
- **Regra de projeto que sobrevive às duas leituras:** *um hook nunca deve assumir nome de campo;
  grave o payload cru primeiro e leia depois.* `cat >> arquivo` é imune a isso; `jq -r '.end_reason'`
  não é.
- **Fontes:** https://code.claude.com/docs/en/hooks (primária) vs REPRO.

### R15-20 — `SubagentStop`

- **Verdade operacional (documentada, não reproduzida):** dispara quando um subagente termina;
  aceita matcher pelo **tipo** do agente (`general-purpose`, `Explore`, `Plan` ou nome custom);
  payload inclui `agent_id` e `agent_type` além dos campos comuns; `decision: "block"` ou exit 2
  impedem o subagente de parar.
- **Como reconferir:** hook `SubagentStop` com `cat >> sub.jsonl` + um prompt que force um
  subagente; conferir se `agent_id` aparece e se dispara **uma vez por subagente**.
- **O que quebra se divergir:** se a barreira do orquestrador for por *subagente* em vez de por
  *sessão*, ela depende inteiramente disso. Recomendação: **não** dependa. Faça barreira por
  sessão (`Stop` + exit code) e trate subagentes como detalhe interno de cada agente.
- **Fontes:** https://code.claude.com/docs/en/hooks (primária, única).

### R15-21 — o teto de 8 bloqueios do hook `Stop`

- **Verdade operacional (documentada, não reproduzida):** um hook `Stop` que bloqueia o fim do
  turno é sobrescrito depois de **8 bloqueios consecutivos sem progresso**; o script deve ler
  `stop_hook_active` e sair cedo quando for `true`; `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` eleva o teto.
  O campo `stop_hook_active` **existe** e veio `false` no meu REPRO — essa metade está fechada.
- **Como reconferir:** hook `Stop` que sempre devolve exit 2 e contar quantas vezes reentra.
- **O que quebra se divergir:** o card "gate deterministic no fim do turno" (rodar teste antes de
  deixar o agente parar). Se o teto for menor que o número de iterações que o gate precisa, o
  agente para com trabalho incompleto e o orquestrador acha que terminou bem.
- **Fontes:** https://code.claude.com/docs/en/hooks-guide.md (primária, único domínio) + REPRO
  parcial (existência do campo).

### R15-22 — por que octopus é errado para uma onda de agentes

- **Verdade operacional:** octopus é a estratégia **default** quando você mescla mais de um branch,
  e ela desiste inteira no primeiro conflito. Reproduzi: três branches tocando a mesma linha,
  `git merge a b c` →
  ```
  fatal: merge program failed
  Automated merge did not work.
  Should not be doing an octopus.
  Merge with strategy octopus failed.
  ```
  `HEAD` continua em `base`; **nenhum** dos três entrou. Você perde o trabalho de integração dos
  três porque um deles conflitou. Com branches disjuntos funciona e produz um commit com 4 pais
  (`git rev-list --parents -n1 HEAD` devolve 4 hashes).
- **Como reconferir:** o script acima; `git merge a b c` num repo com conflito.
- **O que quebra se divergir:** o card de integração de onda. A regra que sai daqui:
  **merge um a um, com gate completo entre cada**, algo como
  ```bash
  for b in $(cat ordem.txt); do
    git merge --no-ff "$b" -m "integra $b" || { git merge --abort; echo "FALHOU: $b"; exit 1; }
    ./gate.sh || { git reset --hard HEAD~1; echo "GATE VERMELHO APÓS $b"; exit 1; }
  done
  ```
  (`--squash` é a variante que **não** cria commit nem move `HEAD` — útil quando você quer um
  commit único por agente, mas aí perde a granularidade de `reset --hard HEAD~1`.)
- **Fontes:** https://git-scm.com/docs/git-merge (primária) — "This resolves cases with more than
  two heads, but refuses to do a complex merge that needs manual resolution. ... This is the
  default merge strategy when pulling or merging more than one branch." + REPRO.

### R15-23 — por que octopus destrói a atribuição

- **Verdade operacional:** num octopus, desfazer um agente é impossível sem desfazer os outros.
  Reproduzi com três branches disjuntos mesclados em um commit de 4 pais:
  ```
  $ git revert HEAD
  error: commit 0b013d1... is a merge but no -m option was given.
  $ git revert -m 1 --no-edit HEAD
   y.txt | 1 -
   z.txt | 1 -
   2 files changed, 2 deletions(-)
  ```
  Pedi para reverter e ele reverteu **os dois outros contribuintes de uma vez**. Com merges
  um-a-um, cada agente é um commit de merge próprio: `git revert -m 1 <sha>` desfaz exatamente
  aquele agente, `git log --first-parent` lista a onda como uma linha por agente, e `git bisect`
  tem um ponto por agente para isolar.
- **Como reconferir:** o script acima.
- **O que quebra se divergir:** o card "rollback de um agente" e o card "relatório de onda por
  agente". Sem merge um-a-um eles não têm em que se apoiar.
- **Fontes:** https://git-scm.com/docs/git-revert (primária) — "Usually you cannot revert a merge
  because you do not know which side of the merge should be considered the mainline. This option
  specifies the parent number (starting from 1) of the mainline..." + REPRO.

### R15-24 — o que as ferramentas publicadas fazem, e o buraco comum

- **Verdade operacional:**
  - **uzi** (`github.com/devflowinc/uzi`, Go): worktree + tmux por agente,
    `uzi prompt --agents claude:2,codex:1 "..."`, `uzi ls [-w]`, `uzi run`, `uzi broadcast`,
    `uzi auto` ("auto-presses Enter for trust prompts"), `uzi kill`, e
    `uzi checkpoint` = "makes a commit and rebases changes from an agent's worktree into your
    current branch". Config em `uzi.yaml` com `devCommand` e `portRange` — ou seja, **porta por
    agente é problema conhecido e resolvido por range**.
  - **claude-squad** (`github.com/smtg-ai/claude-squad`, Go/TUI): worktree + tmux, suporta Claude
    Code/Codex/Gemini/Aider, exige `tmux` e `gh`, keybindings `n`/`N`/`D`/`Enter`/`Ctrl-Q`/`s`/`c`.
  - **container-use** (`github.com/dagger/container-use`): container + branch git por agente,
    servidor MCP, Docker+Dagger, declarado "in early development and actively evolving".
- **O buraco:** nenhum dos três documenta **como sabe que um agente terminou**. `uzi ls` mostra
  `ready`/`running` sem dizer de onde vem o sinal; `claude-squad` só menciona o modo `-y`. Ler
  tela de tmux é a hipótese óbvia, e é justamente o que a gente não quer.
- **O que quebra se divergir:** se algum deles publicar um sinal programático de término, o card
  "barreira própria" pode ser substituído por adoção. Enquanto não publicarem, o hook `Stop` +
  exit code (R15-15/R15-18) é a nossa vantagem sobre essas ferramentas, não uma reimplementação
  delas.
- **Fontes:** os três repositórios oficiais (primárias, três fontes distintas) +
  https://raw.githubusercontent.com/devflowinc/uzi/main/README.md +
  https://container-use.com/ (site oficial, conta junto com o repo) +
  https://tessl.io/blog/how-to-parallelize-ai-coding-agents/ (secundária: discute o padrão
  worktree, "risk and trust boundaries" e o gargalo de revisão humana, **sem** dados de falha).

### R15-25 — onde o paralelismo satura de verdade

- **Verdade operacional:** três tetos diferentes, e o que morde depende de como você autentica.
  1. **API (chave/Console):** limites por organização e por modelo em RPM / ITPM / OTPM, com `429`
     + header `retry-after`. Start tier para Opus 5: 1.000 RPM, 2.000.000 ITPM, 400.000 OTPM.
     `cache_read_input_tokens` **não** conta no ITPM (exceto Haiku 3.5), então prompt caching
     multiplica a vazão efetiva. Limite é por modelo: agentes em Sonnet e em Opus não disputam a
     mesma cota.
  2. **Assinatura (Pro/Max/Team/Enterprise):** o teto **não** é RPM. É uma janela deslizante de
     5 horas mais uma janela semanal por assento, compartilhada com o chat. Trocar de modelo com
     `/model` **não** restaura acesso, porque a janela é compartilhada entre modelos.
  3. **Máquina:** disco = (tamanho do working tree rastreado) × N worktrees, mais o ambiente que
     você provisionar em cada uma (`node_modules` por worktree é o multiplicador que mata).
     RAM/CPU: um processo `claude` + o que ele spawna (Bash, dev server, render) por agente.
     **Isto não tem fonte publicada e vira ledger.**
- **Dado desta máquina (REPRO, 2026-08-10):** um turno trivial de `claude -p` (prompt "Reply with
  exactly: OK", zero ferramentas) custou **US$ 0,03435** e consumiu **3.424 tokens de
  cache-creation** em Opus 5. Esse é o **piso por sessão nova**: N agentes pagam N vezes o
  preâmbulo antes de fazer qualquer trabalho. Foi executado com `provider: firstParty`.
- **Como reconferir:** `claude -p "Reply with exactly: OK" --output-format json | jq '.total_cost_usd, .usage'`
- **O que quebra se divergir:** o card "tamanho da onda". Se o teto for a janela de 5 h da
  assinatura, o parâmetro de onda é *tokens por onda*, não *processos simultâneos*.
- **Fontes:** https://platform.claude.com/docs/en/api/rate-limits (primária) +
  https://code.claude.com/docs/en/costs.md (primária) + REPRO.

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| "Remover a própria worktree de dentro dela falha." | **REFUTADO** | Em git 2.43.0, `git worktree remove .` de dentro da worktree retorna **rc=0** e apaga o diretório. O mesmo vale a partir de um subdiretório. O que quebra é o **shell**: o processo fica com um `cwd` inexistente e todo comando relativo seguinte falha (`cd: no such file or directory`). A regra correta do card é *"remova a worktree de fora dela"*, e o motivo é o cwd do script, não uma recusa do git. A doc oficial enumera as restrições de `remove` (suja, travada, principal) e **não** lista a worktree corrente. | https://git-scm.com/docs/git-worktree + REPRO |
| "Basta um `.gitignore` com `pasta/` para o symlink de insumo não sujar a worktree." | **REFUTADO** | `pasta/` não casa symlink: `git check-ignore` sai com 1, `git status` mostra `?? pasta` e `git add -A` **estagia o symlink**. Só o padrão sem barra (`pasta`) ignora o link. | https://git-scm.com/docs/gitignore + REPRO |
| "Merge octopus resolve a onda inteira de uma vez." | **REFUTADO** | Octopus é o default para >1 branch e "refuses to do a complex merge that needs manual resolution": um conflito derruba o lote inteiro e `HEAD` não anda. Mesmo quando funciona, `git revert -m 1` desfaz **todos** os contribuintes de uma vez — a atribuição por agente morre. | https://git-scm.com/docs/git-merge, https://git-scm.com/docs/git-revert + REPRO |
| "Precisamos escrever o gerenciador de worktrees por agente." | **REFUTADO (parcialmente)** | O Claude Code 2.1.226 já tem `-w/--worktree`, `.claude/worktrees/<nome>`, branch `worktree-<nome>`, `worktree.baseRef`, `.worktreeinclude`, `isolation: worktree` para subagente, hooks `WorktreeCreate`/`WorktreeRemove`, lock automático da worktree do agente em execução e bloqueio de escrita no checkout principal. O que **resta** escrever é o lançador de N sessões, a barreira e o merge com gate. | https://code.claude.com/docs/en/worktrees + REPRO (`claude --help`) |
| "`claude --help` lista as flags disponíveis." | **REFUTADO** | `--max-turns` é documentado e **aceito** pelo parser 2.1.226 e não aparece em `--help`. `--teammate-mode` idem (a própria doc diz que é experimental e não aparece no help; `grep -c teammate` no help devolve 0). `--help` não é inventário. | https://code.claude.com/docs/en/cli-reference + REPRO |
| "Crystal é uma das ferramentas de worktree paralela a considerar." | **REFUTADO (fonte única: o próprio repositório)** | `github.com/stravu/crystal` está marcado como **deprecado desde fevereiro de 2026**, apontando para um sucessor comercial (Nimbalyst). Não é base para card. | https://github.com/stravu/crystal |
| "`git worktree remove` limpa tudo." | **REFUTADO** | Ele deixa o **branch** para trás (verificado) e, se o diretório for apagado à mão, deixa metadados em `.git/worktrees/<nome>` até `git worktree prune`. Teardown completo = `remove` + `branch -D` + `prune`. | REPRO + https://git-scm.com/docs/git-worktree |
| "Ler o painel/tela do agente diz se ele terminou." | **REFUTADO como método** | Existem dois sinais programáticos e datados: o **exit code** do processo (0 / não-zero / 143) e o hook **`Stop`**, que grava um JSON com `session_id`, `transcript_path` e `last_assistant_message`. As ferramentas públicas (uzi, claude-squad) **não documentam** o mecanismo delas — não copie o que você não consegue ler. | https://code.claude.com/docs/en/headless, https://code.claude.com/docs/en/hooks + REPRO |
| "Agent teams do Claude Code resolvem a orquestração." | **EM DISPUTA / não usável hoje** | São **experimentais e desligados por padrão** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), custam ~7× tokens em plan mode, não sobrevivem a `/resume` com teammates in-process, não permitem times aninhados e o lead é fixo. Serve para pesquisa/revisão, não como motor de build. | https://code.claude.com/docs/en/agent-teams, https://code.claude.com/docs/en/costs.md |

---

## 4. Armadilhas (falso verde deste domínio)

- **A worktree "está limpa" logo o agente terminou bem.** → `git status` limpo também é o estado de
  um agente que não fez nada, ou que fez tudo em `/tmp`. → *Fica vermelho se sumir:* o gate precisa
  exigir **commit novo no branch da worktree** (`git rev-list --count base..HEAD` > 0), não
  "working tree limpa".

- **O processo `claude` saiu com 0 logo o trabalho está feito.** → Exit 0 significa "a sessão
  terminou sem erro de infraestrutura". Um agente que foi barrado por permissão e desistiu também
  sai 0. → *Fica vermelho se sumir:* checar `permission_denials` (vazio) e `subtype == "success"`
  no JSON de resultado, além do exit code.

- **O hook `Stop` gravou a linha logo o agente convergiu.** → `Stop` dispara quando o modelo termina
  de responder, inclusive quando ele responde "não consegui". → *Fica vermelho se sumir:*
  gate real (build/teste) rodando **entre** o merge daquele agente e o próximo, não só a presença
  da linha no arquivo de status.

- **O symlink de insumo apareceu na worktree logo está isolado.** → O symlink aponta para o
  diretório do checkout principal: dois agentes escrevendo no mesmo alvo **compartilham estado** e
  o isolamento da worktree vira ficção para tudo que passa por ele. → *Fica vermelho se sumir:*
  insumo só-leitura (monte read-only ou copie via `.worktreeinclude`); se um card precisar
  escrever em insumo compartilhado, ele **não** pode ir para uma onda paralela.

- **`--help` não mostra a flag logo ela não existe.** → Ver R15-13. → *Fica vermelho se sumir:*
  a checagem de flags do lançador deve testar `claude <flag> --version`, não fazer grep no help.

- **O JSON do hook tem o campo que a doc diz.** → Ver R15-19 (`reason` × `end_reason`). → *Fica
  vermelho se sumir:* o hook grava o payload **cru**; a extração de campo acontece depois, num
  parser que falha alto se o campo não existir.

- **`-p` é hermético como um container.** → Sem `--bare`, o `-p` carrega hooks, skills, plugins, MCP
  e `CLAUDE.md` do ambiente. A minha sessão de teste herdou `permission_mode: auto` e
  `effort: xhigh` das minhas settings pessoais, que não estavam no comando. E `--bare` **desliga
  hooks**, ou seja, desliga a barreira. → *Fica vermelho se sumir:* o lançador fixa
  `--permission-mode`, `--model`, `--effort` e `--settings` explicitamente em toda invocação.

- **Lançar N sessões em paralelo com `&` é gratuito.** → Sem redirecionar stdin, cada sessão espera
  por entrada: observei `Warning: no stdin data received in 3s, proceeding without it`. Numa onda
  de 8, são 24 s de espera pura, e pior: se o stdin for o terminal compartilhado, o comportamento é
  imprevisível. → *Fica vermelho se sumir:* toda invocação de onda usa `< /dev/null` (ou pipa o
  prompt de propósito).

- **Agentes paralelos não conflitam porque cada um tem sua worktree.** → Eles conflitam em tudo que
  é **fora** do working tree: porta do dev server, arquivo de cache global, `~/.cache`, um daemon
  do ffmpeg, o mesmo arquivo de saída de render. A uzi resolve porta com `portRange` justamente
  por isso. → *Fica vermelho se sumir:* cada card de onda declara os recursos globais que toca;
  dois cards que declaram o mesmo recurso não vão na mesma onda.

- **Mais agentes = mais throughput.** → A doc do próprio produto diz o contrário para times:
  "Start with 3-5 teammates ... Three focused teammates often outperform five scattered ones", e
  cita sobrecarga de coordenação e retornos decrescentes. Some a isso o custo fixo por sessão
  (US$ 0,034 e 3,4k tokens de preâmbulo aqui) e a janela de 5 h da assinatura. → *Fica vermelho se
  sumir:* medir tempo-de-onda real por tamanho de onda antes de subir o número.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| LS-01 | `.worktreeinclude` realmente copia os gitignorados para a worktree criada com `--worktree`? | Assumir que sim e usar `.worktreeinclude` em vez de symlink (evita a armadilha R15-05). | `printf '.env\n' > .worktreeinclude && echo K=1 > .env && claude -p --worktree t1 "run: ls -a" < /dev/null; ls -a .claude/worktrees/t1/.env` | Se não copiar, o card de insumo volta ao symlink e precisa carregar a regra do padrão sem barra. |
| LS-02 | O hook `Stop` dispara **exatamente uma vez** por execução `-p` que usa ferramentas (multi-turn)? | Assumir uma vez por término de resposta e desduplicar por `session_id` no leitor da barreira. | Hook `Stop` com `cat >> stop.jsonl`; `claude -p "leia 3 arquivos e resuma" --allowedTools Read < /dev/null`; `wc -l stop.jsonl` | Se disparar N vezes, a barreira conta término onde não houve, e a onda N+1 sai cedo. |
| LS-03 | Qual é a ordem entre a gravação do hook `Stop` e o exit do processo? | Assumir que o hook completa antes do exit e, mesmo assim, esperar pelo **PID** e só então ler o arquivo. | `claude -p "OK" --settings hook.json < /dev/null; stat -c %Y stop.jsonl; echo $?` num laço de 20 execuções | Se o hook puder ficar para trás, a barreira precisa de `wait` + polling com timeout, não leitura imediata. |
| LS-04 | `SubagentStop` distingue subagentes concorrentes por `agent_id`? | Não depender: barreira por sessão, não por subagente. | Hook `SubagentStop` gravando payload; prompt que dispare 2 subagentes; conferir `agent_id` distintos | Se não distinguir, qualquer contagem de subagentes na barreira é inválida. |
| LS-05 | `worktree.baseRef` existe mesmo como chave de settings nesta versão? | Assumir `"fresh"` (default documentado) e **não** depender de `"head"`. | `claude --settings '{"worktree":{"baseRef":"head"}}' --version` e depois `claude --worktree t2 -p "git log --oneline -1" < /dev/null` | Se não existir, worktrees de agente sempre partem do default remoto e cards que dependem de trabalho local não commitado quebram. |
| LS-06 | Quantos processos `claude` esta máquina aguenta antes de saturar? O que satura primeiro: RAM, disco ou a janela de uso? | Começar com **3** por onda; subir só com medição. | `for n in 1 2 4 6 8; do /usr/bin/time -v ./onda.sh $n; done` medindo RSS máximo, `df -h`, wall time e `total_cost_usd` somado | O parâmetro "tamanho da onda" de todo o programa. |
| LS-07 | Custo de disco por worktree neste repo (checkout + ambiente provisionado). | Orçar `tamanho do working tree × N` e proibir `node_modules` por worktree (usar store compartilhado). | `du -sh .` no checkout; `git worktree add ../probe && du -sh ../probe` ; depois do provisionamento, `du -sh ../probe` de novo | Se `node_modules` por worktree for inevitável, o número máximo de worktrees cai por disco antes de cair por CPU. |
| LS-08 | O teto de 8 bloqueios do hook `Stop` vale nesta versão, e `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` funciona? | Projetar o gate para convergir em ≤3 iterações; nunca depender de mais de 8. | Hook `Stop` que devolve exit 2 sempre; contar reentradas; repetir com `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=2` | Se o teto for menor, o gate deterministic desiste antes de convergir e o agente para com trabalho pela metade. |
| LS-09 | Rodar 6 sessões simultâneas dispara `429`/`StopFailure(rate_limit)` nesta conta? | Serializar em ondas de 3 e instrumentar `StopFailure` com matcher `rate_limit`. | Hook `StopFailure` gravando `error_type`; lançar 6 sessões; `grep -c rate_limit fail.jsonl` | Se disparar, o card "onda de 6" não existe; a onda vira 3 com fila. |
| LS-10 | Portas: quantos dev servers/renders simultâneos o projeto precisa e como alocar? | Copiar o padrão da uzi: faixa de portas por agente (`portRange`), variável de ambiente por worktree. | `ss -ltnp` durante uma onda; conferir colisão | Sem isso, dois agentes matam o dev server um do outro e o gate fica vermelho por motivo errado. |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| A execução das ondas usa **assinatura (Pro/Max/Team)** ou **chave de API**? | É contrato/orçamento, não fato técnico. A sessão de teste rodou como `firstParty` (assinatura), mas isso é o meu ambiente, não a decisão do programa. | Assinatura ⇒ o teto é janela de 5 h + semanal compartilhada com o chat; o parâmetro de onda vira *tokens por janela*. API ⇒ o teto é RPM/ITPM/OTPM por modelo e por organização, e vale distribuir agentes entre Sonnet e Opus para não disputar a mesma cota. |
| Qual é o **teto de gasto por onda** que o dono aceita? | Orçamento. | Determina o tamanho da onda mais do que qualquer limite técnico. Um turno trivial já custa US$ 0,034 de preâmbulo; um agente de trabalho real custa ordens de magnitude mais. `--max-budget-usd` só existe se houver um número. |
| Modo de permissão das ondas headless: `dontAsk`, `acceptEdits`, `auto` ou `bypassPermissions`? | Apetite de risco. Um agente sem supervisão com `bypassPermissions` pode rodar qualquer comando. | `dontAsk` ⇒ precisa de `permissions.allow` curado por card e alguns agentes vão travar. `auto` ⇒ classificador decide, mas **aborta** em `-p` se bloquear repetidamente. `bypassPermissions` ⇒ mais rápido, exige sandbox/container. |
| Isolamento por **worktree** ou por **container/devcontainer** por agente? | Custo/benefício depende do hardware e do apetite de risco, não de doc. | Worktree: barato (segundos, sem daemon), mas compartilha `$HOME`, rede, portas e o `.git` — um agente ainda pode apagar coisa fora do repo. Container (padrão do `container-use`, Docker+Dagger, projeto declarado "early development"): isola de verdade, custa imagem+build por agente e complica o acesso a GPU/ffmpeg local. |
| O merge da onda entra em `main` direto ou em um branch de integração? | Política de repositório. | Direto ⇒ o gate entre merges é o único guarda-corpo e um agente ruim polui `main`. Branch de integração ⇒ um passo a mais e um segundo gate, mas `main` nunca vê onda parcial. |
| A ordem de merge dos agentes de uma onda é fixa (dependência) ou por chegada? | Depende de como os cards forem particionados — decisão de programa. | Ordem fixa ⇒ o script precisa de `ordem.txt` e um agente atrasado bloqueia a fila. Por chegada ⇒ mais throughput, mas o gate precisa ser total (não incremental) a cada merge. |
| Aceitamos usar **agent teams** (experimental, ~7× tokens) para as fases de pesquisa/revisão? | É escolha de custo e de tolerância a feature experimental. | Sim ⇒ ganha revisão adversarial nativa com mailbox e task list compartilhada. Não ⇒ revisão vira mais uma sessão `-p` isolada com gate próprio, mais barata e mais previsível. |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** *o mecanismo de criação da worktree*. Trocar entre
  `git worktree add ../wt-<nome> -b <branch>` e `claude --worktree <nome>` é **uma variável** no
  script de lançamento (o caminho da worktree) mais **uma linha** de teardown. Decida por
  `claude --worktree` agora (ganha `.worktreeinclude`, lock automático, bloqueio de escrita no
  checkout principal) sabendo que voltar para o git puro custa duas linhas. Ponto de troca cara,
  em contraste: a **barreira**. Trocar "exit code + hook `Stop`" por "leitura de tela" depois de o
  orquestrador estar escrito é reescrever o orquestrador.

- **Skills que devem carregar este conhecimento:**
  - a skill de **orquestração de ondas** (lançamento, barreira, teardown) — R15-09 a R15-21;
  - a skill de **integração/merge com gate** — R15-22, R15-23;
  - a skill de **higiene de worktree** (insumo, symlink, prune, branch órfão) — R15-01 a R15-08;
  - a skill de **orçamento/limites** (tamanho de onda, custo por sessão, janelas) — R15-25.

- **Cards que este cluster condiciona:**
  1. **Lançador de onda**: recebe N prompts, cria N worktrees, invoca `claude -p` com
     `--permission-mode`, `--model`, `--settings`, `--output-format json`, `--max-turns`,
     `< /dev/null`, guarda PID e `session_id` de cada um.
  2. **Barreira de onda**: hook `Stop` gravando payload cru em `status/stop.jsonl` +
     `wait` nos PIDs + leitura do JSON de resultado (`is_error`, `subtype`, `permission_denials`).
  3. **Provisionamento de insumo por worktree**: `.worktreeinclude` (preferido) ou symlink com
     padrão de `.gitignore` **sem barra final**; insumo compartilhado é só-leitura.
  4. **Gate de agente**: build + teste + diff-check rodando **dentro** da worktree antes de o
     branch ser elegível a merge.
  5. **Integrador sequencial**: `git merge --no-ff` um branch por vez, gate completo entre cada,
     `git reset --hard HEAD~1` no vermelho; **proibido** `git merge a b c`.
  6. **Teardown de onda**: `git worktree remove` (de **fora** da worktree) + `git branch -D` +
     `git worktree prune`, com `git worktree list --porcelain` como verificação final.
  7. **Alocador de recursos globais**: faixa de portas por agente, e declaração obrigatória, por
     card, dos recursos fora do working tree que ele toca.
  8. **Instrumentação de limite**: hook `StopFailure` com matcher `rate_limit` alimentando a
     decisão de tamanho de onda (LS-06, LS-09).

---

### Inventário de fontes efetivamente abertas (WebFetch) — 2026-08-10

Primárias: `git-scm.com/docs/git-worktree`, `git-scm.com/docs/gitignore`,
`git-scm.com/docs/git-merge`, `git-scm.com/docs/git-revert`,
`kernel.org/pub/software/scm/git/docs/git-worktree.html` (mesmo texto upstream, atualizado
2026-02-09), `code.claude.com/docs/en/cli-reference`, `/headless`, `/hooks`, `/hooks.md`,
`/hooks-guide.md`, `/worktrees`, `/agent-teams`, `/sub-agents.md`, `/costs.md`, `/env-vars.md`,
`/settings.md`, `/best-practices`, `/llms.txt`, `platform.claude.com/docs/en/api/rate-limits`,
`github.com/devflowinc/uzi` (+ README raw), `github.com/smtg-ai/claude-squad`,
`github.com/stravu/crystal`, `github.com/dagger/container-use`, `container-use.com`.
Secundária: `tessl.io/blog/how-to-parallelize-ai-coding-agents/`.
REPRO: git 2.43.0, Claude Code 2.1.226, Linux 6.18.7 — 7 experimentos (worktree/ignorados,
symlink/gitignore, remove de dentro, lock/dirty/prune/porcelain, branch órfão, octopus+revert,
hook `Stop`/`SessionEnd` em `-p`).
