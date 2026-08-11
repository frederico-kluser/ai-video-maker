---
name: parallel-worktrees
description: Provides the verified mechanics of running one coding agent per card in its own git
  worktree - the preflight that proves input access with a known value, a durable wave barrier
  built on a monotonic counter and the Stop hook payload, one-by-one merges with a full gate after
  each, and file-level ownership as the real parallelism axis. Use whenever work is split across
  several agents, branches or checkouts at the same time, even if the user never says worktree,
  wave or barrier. Triggers:"run these in parallel", "one agent per card", "git worktree",
  "wave", "barrier", "wait for all the agents", "merge the wave", "octopus merge", "integrate the
  branches", "teardown the worktrees", "who owns this file", "how many agents at once".
metadata:
  type: knowledge
  tier: metodo
  verification_signal: "d=$(mktemp -d) && git worktree add -q --detach $d/w HEAD && touch .pw-probe && test ! -e $d/w/.pw-probe && mkdir $d/w/pw && echo lnk/ > $d/w/pw/.gitignore && ln -s /tmp $d/w/pw/lnk && ! git -C $d/w check-ignore -q pw/lnk && git worktree remove --force $d/w && rm -rf .pw-probe $d"
---

> **Como resolver as citações desta skill.** As fontes que ela cita foram consolidadas em
> `PROGRAMA.html` (arquivo único, na raiz do repositório) e os documentos originais ficaram
> **congelados no histórico do git**, no commit `8737ad6`. Caminho e número de linha continuam
> exatos — o commit os pina por conteúdo:
>
> - `docs/pesquisa/<arq>.md:<linha>` → `git show 8737ad6:docs/pesquisa/<arq>.md`
> - `docs/00-panorama-verificado.md §<n>` → `git show 8737ad6:docs/00-panorama-verificado.md`
> - `PROGRAMA.md §<seção>` → a aba correspondente de `PROGRAMA.html`
>
> Um id de claim (`R07-06`, `L02-C11`) ou de card (`F2-03`) continua sendo a âncora estável.
> Prefira-o ao caminho de arquivo: ele não desliza.
# Worktree por card: preflight, barreira e integração

## Quando carregar

- Vai lançar mais de um agente ao mesmo tempo sobre o mesmo repositório, em qualquer forma
  (worktree, branch, checkout, container).
- Vai escrever o script que espera os agentes terminarem, ou o script que integra o que eles
  produziram.
- Vai decidir se dois cards podem correr juntos, ou vai partir um card porque dois agentes
  escreveriam no mesmo arquivo.
- Vai provisionar insumo (asset, `.env`, cache, modelo, fonte) dentro de uma worktree.
- **Não carregue** para derivar quais cards vão em qual onda a partir do grafo de dependências —
  isso é `wave-planning`. Não carregue para desenhar o critério de aceitação que o gate roda —
  isso é `falsifiable-gates`.

## Convenção de rótulo usada abaixo

- **Placar (N-M)** = claim factual contado em `docs/pesquisa/R15-agentes-paralelos.md`. Nada aqui
  inventa placar. Quando o placar é (2-0)/(3-0) e só uma URL aparece, o ponto que falta é o
  **REPRO** de R15 §2 (git 2.43.0 · Claude Code 2.1.226), cujo comando literal está lá.
- **REPRO sem placar** = observação local de R15, fonte única: vale (1-0), não apoie decisão nova.
- **Norma** = regra de método deste programa, citada por âncora de seção: `PLAYBOOK §N` resolve em
  `docs/PLAYBOOK-REFERENCIA.md`, nunca por número de linha. Não é
  fato sobre o mundo: é o que este programa decidiu, e vale mesmo que o mundo permita o contrário.

## Conhecimento injetado

### Uma worktree materializa só o rastreado — e é por isso que o preflight existe

`git worktree add` materializa **apenas o conteúdo rastreado** do commit-ish. `node_modules/`,
`.env`, `assets/` gerados, cache de fonte e saída de render **não vão junto** — worktree é
checkout novo, não cópia de diretório — **Placar (3-0)** — fonte:
https://git-scm.com/docs/git-worktree e https://code.claude.com/docs/en/worktrees ("A worktree is
a fresh checkout, so untracked files like `.env` or `.env.local` from your main repository are not
present.") · REPRO git 2.43.0 em `docs/pesquisa/R15-agentes-paralelos.md:69-86`.

Numa worktree vinculada, `.git` é um **arquivo** com `gitdir: <repo>/.git/worktrees/<nome>`, e o
estado administrativo (`gitdir`, `commondir`, `HEAD`, `index`, `logs`) mora no repo principal —
**Placar (2-0)** — fonte: https://git-scm.com/docs/git-worktree. Consequência: `rm -rf` no
diretório da worktree **não** apaga o registro; sobram metadados que depois recusam reusar o mesmo
nome de path, até `git worktree prune`.

Não escreva o gerenciador de worktrees: o Claude Code 2.1.226 já tem `-w/--worktree [nome]`
(`.claude/worktrees/<nome>`, branch `worktree-<nome>`), `EnterWorktree`/`ExitWorktree`,
`isolation: worktree` para subagente, hooks `WorktreeCreate`/`WorktreeRemove`, lock automático,
bloqueio de escrita no checkout principal e `worktree.baseRef` com default **`"fresh"`**, que
ramifica do **branch default do remoto**, não do `HEAD` local — **Placar (2-0)** — fonte:
https://code.claude.com/docs/en/worktrees · `[R15-09 (2-0)]`. Resta escrever
o lançador de N sessões, a barreira e o merge com gate. **A armadilha é o ponto de partida:** esse
default é a diferença entre a onda N+1 ver ou não o trabalho da onda N; criar a worktree à mão, a
partir do branch de integração, não tem o problema. Que `worktree.baseRef` exista como **chave de
settings** nesta versão é outra coisa, e **não** está confirmado (ver "Não verificado") — o que
fecha o buraco sem depender de nada disso é o preflight de `merge-base --is-ancestor`.

**Norma.** O setup termina com um **teste que prova acesso ao insumo crítico, com um valor
conhecido** — não com "criei a pasta" — fonte: `PLAYBOOK §23`. Cinco passos:
validar identificador · **recusar** identificadores de infra · criar a partir do branch de
integração · symlinkar o insumo gitignorado e acrescentá-lo ao exclude local · preflight com valor
conhecido; falhou ⇒ `exit 1` e **a worktree fica para inspeção** — fonte: `PLAYBOOK §23`.

O adjetivo faz todo o trabalho: *valor conhecido*. `test -e assets/` fica verde para um symlink que
aponta para um diretório vazio, para um diretório errado e para o diretório certo. O preflight tem
de **ler um byte** de um item nomeado — um sha1 de fixture, uma duração conhecida, uma linha
específica — e comparar. Ambiente que falha em silêncio produz agente confiante e errado, e a
falha aparece só no merge — fonte: `PLAYBOOK §23`.

### A armadilha do symlink: a barra final do padrão de ignore

Condição de escopo: vale **apenas** quando o insumo é provido por *symlink* dentro da worktree e o
padrão que o ignora **termina em barra**. Arquivo rastreado nunca é afetado.

Um padrão de `.gitignore` com barra final (`assets/`) **não casa um symlink** de mesmo nome: o
symlink fica untracked, `git check-ignore` sai 1, `git status` mostra `?? assets` e `git add -A`
**estagia o symlink**. Sem a barra (`assets`), ele é ignorado — **Placar (2-0)** — fonte:
https://git-scm.com/docs/gitignore ("The pattern `foo/` will match a directory `foo` and paths
underneath it, but will not match a regular file or a symbolic link `foo`").

O estrago concreto: o agente instruído a "commite tudo" faz `git add -A` e commita um symlink
apontando para um caminho absoluto `/home/...` da máquina de quem orquestrou. O diff é um arquivo
de uma linha; o gate de diff limpo passa; o merge leva isso para o branch de integração.

Segunda consequência, mais cara que a primeira: **symlink de insumo é estado compartilhado**. Dois
agentes escrevendo através dele compartilham o alvo e o isolamento da worktree vira ficção para
tudo que passa por ali. Insumo compartilhado é só-leitura; um card que precisa **escrever** em
insumo compartilhado não pode ir numa onda paralela — fonte:
`docs/pesquisa/R15-agentes-paralelos.md:567-571`.

### Por que o agente não remove a própria worktree — e qual é o motivo real

**Norma.** O agente nunca remove a própria worktree; a remoção é feita do repo principal, sob lock
— fonte: `PLAYBOOK §24`.

O motivo que quase todo mundo escreve é falso e precisa ser escrito certo, senão a regra é
"corrigida" pela primeira pessoa que a testar. "Remover a própria worktree de dentro dela falha"
está **REFUTADO**: em git 2.43.0, `git worktree remove .` de dentro retorna **rc=0** e apaga o
diretório. O que quebra é o **shell**: o processo fica com um `cwd` inexistente e todo comando
relativo seguinte falha. A doc enumera as restrições de `remove` (suja, travada, principal) e
**não** lista a worktree corrente — fonte: `docs/pesquisa/R15-agentes-paralelos.md:538`.

`git worktree lock --reason` cria o arquivo `locked` com o motivo em texto puro e faz
`prune`/`move`/`remove` recusarem; o Claude Code trava a worktree de um agente enquanto ele roda —
**Placar (3-0)** — fonte: https://git-scm.com/docs/git-worktree e
https://code.claude.com/docs/en/worktrees. Logo: não invente lockfile, e faça a varredura de
worktrees órfãs respeitar o lock, senão ela apaga a worktree de um agente vivo.

`git worktree remove` recusa worktree com modificação ou untracked, exige `-f -f` para travada, e a
worktree principal não pode ser removida — **Placar (2-0)** — fonte:
https://git-scm.com/docs/git-worktree. A recusa **é** o gate implícito de perda de trabalho:
`--force` cego destrói em silêncio o resultado de um agente que esqueceu de commitar.

`git worktree remove` **não apaga o branch** — **Placar (2-0)** — fonte:
`docs/pesquisa/R15-agentes-paralelos.md:130-138` (REPRO git 2.43.0 +
https://code.claude.com/docs/en/worktrees). E `prune` remove metadados de worktrees cujo diretório
sumiu, com expiração automática por `gc.worktreePruneExpire` — **Placar (2-0)** — fonte:
https://git-scm.com/docs/git-worktree. Teardown completo = `remove` (de **fora**) + `branch -D` +
`prune`; e o registro de worktrees **não** serve como histórico de "quais agentes rodaram", porque
some sozinho.

`git worktree list --porcelain` emite um bloco por worktree em formato declarado estável entre
versões, recomendado com `-z` — é a **única** leitura de estado apta a script — **Placar (2-0)** —
fonte: https://git-scm.com/docs/git-worktree. A saída humana é alinhada por colunas e muda com o
comprimento dos paths.

### A barreira: contador monotônico de onda, nunca relógio, nunca tela

**Norma.** A barreira tem de valer para quem terminou *antes* de você começar a esperar. Contador
monotônico por onda, nunca relógio, nunca "a tela está parada" — fonte: `PLAYBOOK §24`.
"Barreira de onda por leitura de tela" está no catálogo de falso verde do método: declarou
"terminaram" com os agentes trabalhando — fonte: `PLAYBOOK Apêndice I`.

Não há o que copiar das ferramentas publicadas: o padrão dominante é worktree + tmux, um agente por
worktree (uzi, claude-squad), ou container + branch por agente (container-use, "in early
development"), e **nenhum dos três READMEs documenta como o término de um agente é detectado** —
**Placar (3-0)** — fonte: https://github.com/devflowinc/uzi ·
https://github.com/smtg-ai/claude-squad · https://github.com/dagger/container-use.

Uma **barreira durável** é um hook `Stop` do tipo `command` cujo comando anexa o JSON de stdin a um
arquivo: funciona sem TTY, sem ler tela, e deixa rastro em disco — **Placar (2-0)** — fonte:
https://code.claude.com/docs/en/hooks. Configuração mínima, passável por `--settings` sem tocar no
repo:

```json
{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"cat >> /caminho/status/onda3.jsonl"}]}]}}
```

O hook `Stop` dispara **inclusive em modo `-p`**, e o payload real em Claude Code 2.1.226 traz
`session_id`, `transcript_path`, `cwd`, `prompt_id`, `permission_mode`, `effort.level`,
`hook_event_name`, `stop_hook_active`, `last_assistant_message`, `background_tasks`,
`session_crons` — **Placar (2-0)** — fonte: https://code.claude.com/docs/en/hooks. Três
consequências de projeto:

1. `last_assistant_message` vem no payload: **não leia o transcript**, que a própria doc avisa que
   "may lag current turn".
2. `transcript_path` transforma a barreira também num índice de auditoria por agente.
3. Todos os hooks que casam um evento rodam **em paralelo**: não presuma ordem entre eles.

**O contador é a contagem de `session_id` distintos no arquivo da onda.** Ele é monotônico porque o
arquivo só cresce, e é durável porque o registro de quem terminou já estava em disco antes de você
começar a esperar — que é exatamente o requisito da norma. Um relógio ("espere 20 min") e uma tela
("parou de rolar") falham no mesmo ponto: nenhum dos dois sabe o que aconteceu antes de ele começar
a olhar.

O hook grava o payload **cru**; a extração de campo acontece depois, num parser que falha alto. O
motivo é concreto: o payload de `SessionEnd` observado em 2.1.226 usa a chave `reason`, enquanto a
referência de hooks descreve `end_reason` — **(1-1, EM DISPUTA)** — fonte:
https://code.claude.com/docs/en/hooks vs REPRO em `docs/pesquisa/R15-agentes-paralelos.md:388-401`.
`cat >>` é imune a isso; `jq -r '.end_reason'` não é.

O exit code é o segundo sinal, e é complementar, não substituto: `claude -p` sai **0** em sucesso,
não-zero em falha e **143** em SIGTERM (após abortar o turno e rodar `SessionEnd`) — **Placar
(2-0)** — fonte: https://code.claude.com/docs/en/headless. `wait $pid` é a barreira mais barata que
existe, e **perde a durabilidade**: se o orquestrador morrer, o `wait` some e o arquivo não.

`--output-format json` devolve um objeto cujos quatro campos um gate de onda deve checar são
`is_error`, `subtype`, `terminal_reason` e `permission_denials` — **Placar (2-0)** — fonte:
https://code.claude.com/docs/en/headless. `permission_denials` não-vazio é a assinatura de "o
agente foi barrado e fingiu que terminou".

Duas restrições do Claude Code 2.1.226 que apagam a barreira se ignoradas — **Placar (2-0)** —
fonte: https://code.claude.com/docs/en/cli-reference:

- **`--bare` desliga hooks.** Barreira por hook e `--bare` são mutuamente exclusivos.
- Sem `--bare`, o `-p` herda hooks, skills, plugins, MCP e `CLAUDE.md` do ambiente. Uma sessão de
  teste reportou `permission_mode: "auto"` e `effort: xhigh` herdados de settings pessoais, não do
  comando. O lançador fixa `--permission-mode`, `--model`, `--effort` e `--settings` em toda
  invocação.

E o detalhe que custa 3 s por agente: sem `< /dev/null`, cada sessão espera stdin e imprime
`Warning: no stdin data received in 3s, proceeding without it` — fonte:
`docs/pesquisa/R15-agentes-paralelos.md:586-590`.

### Integração: um a um, nunca octopus

Mesclar mais de um branch usa a estratégia **octopus** por padrão, que *"refuses to do a complex
merge that needs manual resolution"*: no primeiro conflito **o lote inteiro falha** e o `HEAD` não
anda — **Placar (2-0)** — fonte: https://git-scm.com/docs/git-merge. Três branches conflitantes em
`git merge a b c` produzem `Should not be doing an octopus.` e **nenhum** dos três entra.

Reverter um merge exige `-m <parent-number>`; num commit octopus de N pais o revert é relativo a
**um** pai e desfaz **todos** os outros contribuintes de uma vez — **Placar (2-0)** — fonte:
https://git-scm.com/docs/git-revert. Ou seja: mesmo quando o octopus *funciona*, a atribuição por
agente morre.

Com merges um-a-um cada agente vira um commit de merge próprio: `git revert -m 1 <sha>` desfaz
exatamente aquele agente, e `git log --first-parent`/`git bisect` dão um ponto por agente.

O ciclo, na ordem — fonte: `PLAYBOOK §24`:

```
lançar N agentes → BARREIRA → "commite tudo" → BARREIRA → sair do TUI
→ remover worktrees (do repo principal, sob lock) → MERGES um a um, nunca octopus
→ gate após CADA merge
```

```bash
for b in $(cat ordem.txt); do
  git merge --no-ff "$b" -m "integra $b" || { git merge --abort; echo "FALHOU: $b"; exit 1; }
  ./gate.sh || { git reset --hard HEAD~1; echo "GATE VERMELHO APÓS $b"; exit 1; }
done
```

`--squash` é a variante que **não** cria commit nem move `HEAD`: útil para um commit único por
agente, mas perde a granularidade do `git reset --hard HEAD~1` — fonte:
`docs/pesquisa/R15-agentes-paralelos.md:452-453`.

**Norma — gate completo após CADA merge, nunca ao fim da onda: a bissecção é o produto** — fonte:
`PLAYBOOK §13`. Rodar o gate uma vez, no fim, devolve "a onda quebrou" —
uma informação que não endereça ninguém.

**Norma — ordem de merge importa: infra e gateway primeiro; quem muda o gate, por último** —
fonte: `PLAYBOOK §24`. O motivo do último termo: se o card que altera o gate
entra primeiro, todo gate subsequente mede um oráculo diferente do que os outros agentes
enfrentaram, e você perde a capacidade de distinguir "este merge quebrou" de "o gate mudou".

### Propriedade por ARQUIVO, e o teto de paralelismo

**Norma.** O DAG diz *quando*; a propriedade de arquivo diz *se*. Dois filtros: mesmo nível
topológico (necessário) e **conjuntos de arquivos escritos disjuntos** (suficiente) — fonte:
`PLAYBOOK §12`. E o eixo de paralelismo se define como *quem escreve em
qual arquivo*, nunca como *quem trabalha em qual assunto* — fonte: `PLAYBOOK §12`.

A granularidade degrada em três degraus: `diretório → arquivo → membro dentro do arquivo`. No
último degrau o contrato escrito é literal — fonte: `PLAYBOOK §12`:

> *"compartilhado — só acrescente. Nunca reordene, nunca renomeie, nunca reindente, nunca mexa em
> membro que não é seu."*

Reordenar e reindentar entram na proibição porque são exatamente as operações que um agente
competente faz por higiene e que transformam um diff de 3 linhas em um conflito de arquivo inteiro
com o irmão de onda.

**Teto de paralelismo = número de recursos singleton que as tarefas tocam** (arquivo de rotas,
lockfile, porta TCP, banco, definição de CI). Enumere-os **antes** de dimensionar a onda; cada
singleton vira dono exclusivo ou sequência — fonte: `PLAYBOOK §12`. O teto
não é o modelo nem a CPU.

Nesta infraestrutura de skills os singletons são visíveis e historicamente **não declarados**:
`catalog.md`, o arquivo de estado de bootstrap e cada registro de eval por skill — fonte:
`docs/pesquisa/L02-reuso-3b1b-infra-skills.md:882-891`. Um diretório compartilhado onde N agentes
em N worktrees escrevem o mesmo `<skill>.json` colide por construção.

E o singleton mais esquecido está **fora** do working tree: agentes paralelos não conflitam no
código, conflitam em porta de dev server, cache global, `~/.cache`, daemon de ffmpeg e o mesmo
arquivo de saída de render. A uzi resolve porta por `portRange` justamente por isso. Cada card
declara os recursos globais que toca; dois cards que declaram o mesmo recurso não vão na mesma onda
— fonte: `docs/pesquisa/R15-agentes-paralelos.md:592-596`.

**Norma.** Todo ponto de composição compartilhado vira **stub vazio commitado no branch base antes
de criar as worktrees**, junto com o documento que é o contrato da onda. A assimetria que sustenta
tudo: um card mal isolado custa uma onda inteira de retrabalho; a preparação que o isola custa 26
linhas — fonte: `PLAYBOOK §13`.

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Ler o merge limpo como integração funcional.** É o defeito central desta skill.
  *"Cards da mesma onda nascem em worktrees isoladas a partir da mesma base, então o git não tem em
  que conflitar e mergeia em silêncio código que discorda"* — fonte:
  `PLAYBOOK §13`. Casos concretos que passam sem conflito de texto: o card
  produtor emite `durationInFrames` e o card consumidor lê `duration`; dois cards acrescentam a
  mesma chave em arquivos diferentes do mesmo manifesto; um card renomeia um export e o irmão
  importa o nome antigo em outro arquivo; dois cards alocam a mesma porta. O git prova ausência de
  conflito **de texto**, e nada mais.
- **Rodar o gate no fim da onda porque é mais rápido.** Sim, é mais rápido, e devolve "a onda
  quebrou". A bissecção por agente é o produto do merge um-a-um; agregar o gate joga fora a única
  coisa que o merge um-a-um comprou.
- **Deduzir progresso de "a worktree está limpa".** `git status` limpo é também o estado de um
  agente que não fez nada e do que fez tudo em `/tmp`. O gate exige commit novo no branch da
  worktree (`git rev-list --count base..HEAD` > 0) — fonte:
  `docs/pesquisa/R15-agentes-paralelos.md:552-555`.
- **Usar `--force` no teardown para o script não travar.** A recusa do `remove` é o sinal de que
  há trabalho não commitado. Forçar apaga em silêncio o resultado de um agente.
- **Escrever no card que "o git recusa remover a worktree corrente".** Ele não recusa (rc=0). Uma
  regra com motivo falso é desmontada pela primeira pessoa que a testa. O motivo é o `cwd` do
  script.
- **Fazer `grep` no `--help` para saber se uma flag existe.** `--max-turns` é documentado, aceito
  pelo parser de 2.1.226 e **não** aparece no help — **Placar (2-0)** — fonte:
  https://code.claude.com/docs/en/cli-reference. O lançador testa `claude <flag> --version`.
- **Construir a barreira sobre `SubagentStop` porque a granularidade é melhor.** O evento existe;
  o que é (1-0) e não reproduzido é ele **distinguir subagentes concorrentes por `agent_id`** (ver
  "Não verificado"). Sem essa distinção qualquer contagem por subagente é inválida — barreira por
  **sessão**; subagente é detalhe interno de cada agente.
- **Tratar `git worktree list` como histórico da onda.** `gc.worktreePruneExpire` expira o registro
  sozinho.
- **Ignorar a pasta de insumo com `pasta/` e considerar o symlink resolvido.** A barra final é a
  diferença entre ignorado e estagiado.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| Merge sem conflito de texto | worktrees da mesma base não têm em que conflitar; código que discorda entra em silêncio | gate completo rodando **entre** um merge e o próximo |
| `git status` limpo na worktree | é também o estado de quem não fez nada | `git rev-list --count base..HEAD` > 0 por agente |
| Processo `claude` saiu com 0 | agente barrado por permissão que desistiu também sai 0 | `is_error`, `subtype` e `permission_denials` vazio no JSON de resultado |
| Linha gravada no arquivo da barreira | `Stop` dispara também quando o modelo responde "não consegui" | gate de agente (build + teste + diff-check) rodando **dentro** da worktree antes de o branch ser elegível a merge |
| Hook de gate no fim do turno saindo com `exit 1` | `exit 1` é erro **não-bloqueante** (`[R06-24 (3-0)]`): o agente para assim mesmo, a linha da barreira é gravada e a onda avança com trabalho não validado | o gate roda **fora** do hook, entre os merges; hook de política usa `exit 2` |
| Preflight "criei a pasta" / `test -e assets` | passa para symlink quebrado, vazio ou apontando ao alvo errado | leitura de um **valor conhecido** do insumo, comparada |
| `.gitignore` com `pasta/` protegendo o symlink | padrão com barra não casa symlink; `git add -A` o estagia | `git check-ignore -q <symlink>` exigindo rc=0 no preflight |
| `--help` não lista a flag, logo ela não existe | `--help` não é inventário nesta versão | `claude <flag> --version` no gate do lançador |
| `git worktree remove` "limpou tudo" | o branch sobrevive; metadados sobram se o diretório foi apagado à mão | `git branch --list '<prefixo-da-onda>*'` sem saída **e** `git worktree list --porcelain` só com o bloco da worktree principal |
| Worktree nativa criada com `claude --worktree` | `worktree.baseRef` default `"fresh"` ramifica do branch default do **remoto**: a onda N+1 não vê a onda N | `git -C <worktree> merge-base --is-ancestor <base-da-onda> HEAD` no preflight |
| Barreira por relógio ou por tela parada | não sabe nada sobre quem terminou antes de você olhar | contador monotônico de `session_id` distintos no arquivo da onda |
| Octopus verde num teste com branches disjuntos | funciona até o primeiro conflito, e já matou o `revert -m 1` por agente | merge um a um: o vermelho nomeia **um** branch e os anteriores continuam integrados |

## O que esta skill NÃO cobre

- **Derivar as ondas do grafo** (nível topológico, folga, largura, ondas de composição, validador
  de grafo): `wave-planning`.
- **Desenhar o gate** que roda entre os merges (critério falsificável, sonda negativa, três
  estados, autoteste do verificador): `falsifiable-gates`.
- **O subagente de contexto fresco** que tenta refutar o diff antes do commit:
  `adversarial-review`.
- **Faixas de id, inbox por card e consolidação pós-merge** do que ficou aberto:
  `uncertainty-ledger`.
- **Qual conta paga a onda e qual é o teto de gasto** — é PERGUNTA-DONO, não skill; os três tetos
  (API por RPM/ITPM/OTPM, assinatura por janela de 5 h + semanal por assento, e máquina por disco ×
  N worktrees) estão em `[R15-25 (2-0)]`.
- **Escolher qual skill carregar** para uma tarefa: `project-router`.

## Não verificado

Oito itens. Nenhuma regra das seções acima quebra se um deles cair: cada um entra já com a
mitigação ao lado.

1. **`.worktreeinclude` copia gitignorados para a worktree criada pelo Claude Code** — (1-0),
   publicador único — fonte: https://code.claude.com/docs/en/worktrees. Escopo: só vale para
   worktree criada *pelo Claude Code*, e **não** é processado quando um hook `WorktreeCreate`
   assume a criação. Se não copiar, o provisionamento volta ao symlink e a barra final volta a
   valer. Fecha com: `printf '.env\n' > .worktreeinclude && echo K=1 > .env && claude -p --worktree t1 "run: ls -a" < /dev/null; ls -a .claude/worktrees/t1/.env`.
2. **`-p` não limpa a worktree ao sair** — (1-0) — fonte:
   https://code.claude.com/docs/en/worktrees. Fecha com:
   `claude -p --worktree ondaX "echo oi" < /dev/null; git worktree list`.
3. **`SubagentStop` distingue subagentes concorrentes por `agent_id`** — (1-0) — fonte:
   https://code.claude.com/docs/en/hooks. Fecha com hook `SubagentStop` gravando o payload e um
   prompt que dispare dois subagentes. Recomendação enquanto estiver aberto: barreira por sessão.
4. **O `Stop` é sobrescrito após 8 bloqueios consecutivos, e
   `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` eleva o teto** — (1-0) — fonte:
   https://code.claude.com/docs/en/hooks-guide.md. Só a existência do campo `stop_hook_active` foi
   observada. Fecha com um hook `Stop` que sempre devolve exit 2, contando reentradas.
5. **Cardinalidade do `Stop` numa execução `-p` multi-turn** — não medido. Fecha com
   `claude -p "leia 3 arquivos e resuma" --allowedTools Read < /dev/null; wc -l stop.jsonl`. Até
   fechar, o leitor da barreira **desduplica por `session_id`** — se disparar N vezes, o contador
   conta término onde não houve e a onda seguinte sai cedo.
6. **Chave do payload de `SessionEnd`: `reason` × `end_reason`** — (1-1, EM DISPUTA). Fecha
   abrindo a referência de hooks no mesmo dia da versão instalada e comparando byte a byte com o
   payload gravado.
7. **Onde mora o "exclude local" de uma worktree vinculada.** O método manda acrescentar o insumo
   ao exclude local (`PLAYBOOK §23`) e não diz onde. REPRO em git 2.43.0 indica
   que `.git/worktrees/<nome>/info/exclude` **não** tem efeito e que só `.git/info/exclude` (o
   common dir, **compartilhado por todas as worktrees**) ignora o symlink — (1-0), fonte única.
   Se confirmar, o preflight não pode escrever exclude por worktree e o nome do symlink precisa
   ser o mesmo em todas. Fecha com:
   `git worktree add -b p ../p && ln -s /tmp ../p/assets && printf 'assets\n' > .git/worktrees/p/info/exclude && git -C ../p check-ignore -v assets; echo rc=$?` (esperado rc=1) e o mesmo com `.git/info/exclude` (esperado rc=0).
8. **`worktree.baseRef` existe como chave de settings nesta versão?** — (1-0): a página de
   worktrees aponta para `settings#worktree-settings`, e o fetch da referência de settings não
   trouxe a seção — fonte: https://code.claude.com/docs/en/worktrees. Fecha com
   `claude --settings '{"worktree":{"baseRef":"head"}}' --version` e depois `claude --worktree t2 -p "git log --oneline -1" < /dev/null`.
   Enquanto abrir, o default `"fresh"` é o que vale e a base da onda se prova por `merge-base`.

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
