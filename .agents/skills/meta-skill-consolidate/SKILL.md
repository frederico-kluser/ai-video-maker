---
name: meta-skill-consolidate
description: Scans the whole skill catalog on a schedule to deduplicate rules, revalidate stale provenance, resolve contradictions, enforce the token budget, retire obsolete content, and measure routing precision with trigger and adjacent near-miss evals before proposing that two competing skills be merged. Use whenever a skill body crosses the line budget, a skill is added or retired, a description is edited, two skills answer the same query, or roughly 10 to 15 tasks completed since the last pass, even if the user never says the word consolidate. Triggers are "consolidate skills", "GC skills", "clean up skills", "deduplicate", "stale provenance", "token budget", "routing eval", "near-miss", "skills overlap", "merge two skills", "which skill should have loaded", "consolidar as skills", "roteou pra skill errada".
metadata:
  type: meta
  tier: meta
  verification_signal: "cd $(git rev-parse --show-toplevel) && test $(ls -d .agents/skills/*/ 2>/dev/null | wc -l) -ge 1 && (python3 .agents/scripts/skill_lint.py; test $? -le 1)"
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
# Consolidação do catálogo — coleta de lixo com medição de roteamento

## Quando carregar
- Um corpo de skill passou de 400 linhas, ou o catálogo ganhou/perdeu uma skill, ou alguma
  `description` foi editada — editar `description` é editar o roteador.
- Passaram ~10–15 tarefas desde a última passada, ou duas skills responderam à mesma pergunta,
  ou alguém percebeu que a skill certa não carregou.
- Antes de propor fundir duas skills: a fusão é o desfecho **raro**; o comum é ajustar a
  `description` de uma delas.
- Não carregue para *escrever* conhecimento novo numa skill (isso é `meta-skill-evolution`),
  nem para decidir a regra de roteamento (isso é `project-router`, que a implementa; esta
  skill só a mede).

## Conhecimento injetado

> Base de citação: **caminho com prefixo `3b1b:` é do repositório de referência**; todo caminho
> sem prefixo é deste repositório — inclusive `.agents/skills/catalog.md`, que existe aqui, e
> `.agents/scripts/`, que **ainda não existe** aqui (é o card `T-10`; ver "Não verificado").
> Placar `(N-M)` vem de `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:950` a `:972`
> (ids `C01`..`C23`) e de `docs/pesquisa/R06-remotion-agentes-skills.md:35` a `:59`
> (ids `R06-01`..`R06-25`). Linhas marcadas `[spec]` são leitura direta do código de uma
> ferramenta e **não têm placar numerado** — estão declaradas em "Não verificado".

### O orçamento de tokens não está onde a intuição põe
Progressive disclosure tem 3 níveis: `name`+`description` (~100 tokens) ficam **sempre**
carregados; o corpo do `SKILL.md` (<5.000 tokens recomendado, <500 linhas) só entra **na
ativação**; recursos em subpastas custam zero até serem lidos — **Placar (3-0)** — fonte:
https://agentskills.io/specification (`R06-16`).
Consequência que inverte a prioridade da GC neste catálogo de 20 skills: cortar um corpo de
380 para 300 linhas economiza **zero** na sessão em que a skill não ativa; os ~2.000 tokens
permanentes (20 × ~100) estão nas `description`. **A passada de orçamento começa pelas
descrições, não pelos corpos** — e cada palavra tirada de uma `description` é uma palavra
tirada do roteador, então nenhuma edição de `description` sai sem re-rodar o eval de
roteamento.
O teto local deste programa é mais apertado que o da spec: o linter avisa a partir de **400**
linhas de corpo e erra acima de **500** (`docs/CONTRATO-DE-SKILL.md:27`), e o método pede
~2.000–3.500 tokens por skill (`docs/CONTRATO-DE-SKILL.md:107-108`). Não existe piso de linhas
declarado em nenhuma das duas fontes — não invente um para justificar fusão.

### Os verificadores herdados medem menos do que o nome promete
- `skill_lint.py` **não verifica proveniência em nenhum grau**: uma skill sem uma única
  citação sai `0 errors` — **Placar (3-0)** — fonte: `C01`, `3b1b:.agents/scripts/skill_lint.py`.
  Portanto "linter verde" nunca é evidência de que a consolidação preservou as fontes.
- `metadata.type` é opcional na prática: a regra só dispara se a chave existir; omiti-la passa
  limpo — **Placar (2-0)** — fonte: `C02`.
- O linter varre **um nível só** (`*/SKILL.md`): uma skill aninhada é pulada em silêncio —
  **Placar (2-0)** — fonte: `C03`. Por isso mover material para `parent/sub/SKILL.md` some do
  gate; mover para `parent/references/*.md` não.
- Códigos de saída: `0` = sem erro e sem aviso, `1` = **só avisos**, `2` = erro `[spec]` —
  fonte: `3b1b:.agents/scripts/skill_lint.py:5` e `:125-133`. Combine com a semântica de hook: exit
  `2` bloqueia, **qualquer outro código não bloqueia** — **Placar (3-0)** — fonte:
  https://code.claude.com/docs/en/hooks.md (`R06-24`). **Duas condições de escopo**, ambas de
  `R06-25` (2-0, mesma URL): a exceção é o evento `WorktreeCreate`, onde qualquer código ≠ 0
  aborta; e `exit 2` em `PostToolUse` não desfaz a escrita, só mostra o stderr ao modelo. Ou
  seja: um linter em `PostToolUse` nunca reverte o `SKILL.md` já gravado. O aviso de 400 linhas
  sai como `1`: ligado como hook, o orçamento de tokens é um alarme que não fecha porta nenhuma.
- Nenhum script executa o `metadata.verification_signal` declarado no frontmatter —
  **Placar (2-0)** — fonte: `C15`. Escrever o campo não é gate; rodá-lo na passada é.
- Rodado fora da raiz do repositório, o write gate libera escrita numa skill com registro
  vermelho — **Placar (2-0)** — fonte: `C05`. O mesmo `cwd` derruba mais três: a execução E3
  (`docs/pesquisa/L02-reuso-3b1b-infra-skills.md:655-669`) registra `skill_lint.py`,
  `check_staleness.py` e `stop_validation_gate.py` saindo `exit 0` com mensagem de "não achei",
  porque os quatro usam `Path(".agents/...")` relativo — log de execução, **sem placar próprio**.
  Consolidação roda da raiz do repositório, sempre, e o primeiro passo confere isso.

### Proveniência: "current" quer dizer "o arquivo existe e é comprido o bastante"
- `check_staleness.py` **captura o hash e nunca o compara**: detecta arquivo ausente e linha
  além do fim, não deriva — **Placar (2-0)** — fonte: `C07`.
- 34 de 43 citações do corpus de referência (79%) são invisíveis ao regex, quase todas por
  serem faixas (`arquivo.py:100-139`) — **Placar (2-0)** — fonte: `C08`. Só 3 de 43 (7%)
  resolvem para arquivo existente e são de fato conferidas — **Placar (2-0)** — fonte: `C09`.
- A única citação com hash do corpus aponta para a linha errada — e **já estava errada no
  commit que ela pina** — **Placar (3-0)** — fonte: `C10`. Citação com hash é gerada por script,
  **jamais escrita à mão** — fonte: `docs/PLAYBOOK-REFERENCIA.md:424-425`.
- Nada, em nenhum hook, chama `check_staleness.py`; as três menções são prosa — e **uma delas
  está dentro da própria skill de consolidação de origem**
  (`3b1b:.agents/skills/meta-skill-consolidate/SKILL.md:79`)
  — **Placar (2-0)** — fonte: `C18`. Foi esse passo que este arquivo herdou; ou o script roda na
  passada, ou o passo é declarado manual por escrito, porque a ausência de verificador é
  indistinguível de conformidade (`docs/PLAYBOOK-REFERENCIA.md:228-230`).
- Neste catálogo a proveniência dominante é **URL primária + placar**, não `arquivo:linha`. A
  revalidação correspondente é re-buscar a URL. O placar continua sendo propriedade do arquivo
  de pesquisa, que tem outro dono (`docs/CONTRATO-DE-SKILL.md:137-144`): se a re-busca
  contradiz o placar, isso vira item de ledger e handoff nomeado, não uma reescrita do número.

### O registro de eval é o token — e o token é editável à mão
- Não existe token nem TTL: o "token" é um JSON versionado no git, cujo `timestamp` nunca é
  lido — **Placar (3-0)** — fonte: `C04`.
- `all([])` é `True`: uma suíte que devolve lista vazia grava `last_eval_passed: true` com zero
  asserções — **Placar (2-0)** — fonte: `C16`.
- Duas das seis evals do corpus de origem são lambdas com `passed: True` literal, e são
  exatamente as das **duas meta-skills** — o portão das ferramentas que escrevem em outras
  skills nasceu permanentemente aberto — **Placar (2-0)** — fonte: `C17`. A eval desta skill é
  o caso fabricado; substituí-la por comando real é pré-requisito da primeira consolidação.
- O runner nunca lê um `SKILL.md`: o acoplamento é por chave num dicionário no próprio runner —
  **Placar (2-0)** — fonte: `C14`. Consequência direta para GC: aposentar uma skill sem apagar
  `.eval_records/<nome>.json` deixa um **token verde órfão**; se o nome voltar a existir, o
  portão de escrita abre sem nenhuma eval ter rodado (`C04`+`C14`).
- Um `SKILL.md` de skill com registro vermelho foi escrito e commitado no corpus de origem —
  **Placar (3-0)** — fonte: `C06`. O gate existia e não segurou.

### Contradição com id de disputa não é defeito a consertar
Antes do placar vem a **precedência declarada** (`README.md` § "Ordem de precedência";
`PROGRAMA.md`, preâmbulo canônico — a linha *"o panorama verificado vence sobre fato"*):
`PROGRAMA.md` vence sobre plano (cards, ondas, grafo, ordem), `docs/00-panorama-verificado.md`
vence sobre **fato**, `docs/PLAYBOOK-REFERENCIA.md` vence sobre método, subordinado ao PROGRAMA.
Skill que contradiz o panorama **não é contradição a arbitrar**: a skill está errada e o conserto
é na skill, mesmo que o placar dela pareça maior — o placar mora no arquivo de pesquisa, e o
panorama é quem o consolida. Placar só decide entre duas skills no **mesmo** nível.
O panorama já nomeia 17 disputas (`D-01`..`D-17`, `docs/00-panorama-verificado.md` §4 "Em
disputa"), várias com placar 1-1 ou 2-1: valor de `--hardware-acceleration` (`D-03`, 2-1),
concorrência default do Remotion (`D-06`), timestamps de TTS local (`D-05`), e se os hooks do
corpus de origem chegaram a disparar (`D-13`, 2-1). Cite sempre pelo **id da disputa**: o `§4` do
panorama é reordenável, o `D-nn` não. Duas skills em lados opostos de uma dessas linhas **não** são uma
contradição a resolver: apagar um lado transforma disputa em premissa invisível
(`docs/PLAYBOOK-REFERENCIA.md:469-471`). A consolidação só resolve contradição em que um lado
tem placar ≥2-0 e o outro ≤1-0; fora disso, marca as duas com o id da disputa e devolve ao
ledger.

### A duplicata estrutural deste catálogo é conhecida antes de medir
Três skills têm o **mesmo insumo de pesquisa R02**: `remotion-core`, `timeline-manifest` e
`motion-design-system` — fonte: `docs/CONTRATO-DE-SKILL.md:123-132`. Um insumo alimentando três
donos é a definição mecânica de risco de duplicata, e é onde a varredura começa. Mesma leitura
para o par `remotion-render-pipeline` (R05, R12) × `ffmpeg-media-ops` (R10): os três clusters
falam de encoder e aceleração de hardware. Isso é **hipótese de colisão**, não achado — quem
decide é o eval de roteamento abaixo.

### As colisões declaradas já estão contadas — a matriz começa semeada
`.agents/skills/catalog.md:65` registra **344 gatilhos declarados, 14 ambíguos** (2+ donos), com
a lista nominal em `:71-84`. `ffmpeg-media-ops` aparece em **10 dos 14** (`alpha channel`, `crf`,
`ducking`, `duration`, `hardware acceleration`, `lufs`, `nvenc`, `prores`, `true peak`,
`yuva420p`); os outros quatro são `easing` (`motion-design-system` × `remotion-core`),
`run these in parallel` (`parallel-worktrees` × `wave-planning`), `word timestamps`
(`audio-captions-sync` × `tts-voiceover`) e `token budget` (`llm-authoring` × **esta skill**).
Três consequências mecânicas:
- A matriz de confusão **não começa vazia**: cada par acima entra com ≥3 gatilhos e ≥3
  quase-erros adjacentes antes de qualquer consulta inventada. Par sem colisão declarada é o
  resto, não o começo.
- 10 de 14 num único dono é **assimetria**, e assimetria pelo critério (1) abaixo conserta-se na
  `description` — e a fusão desse par está vetada pela condição (3): `ffmpeg-media-ops` vale para
  o binário chamado por linha de comando, `remotion-render-pipeline` para o renderer do Remotion.
- **Esta skill é parte interessada** em `token budget`: os quase-erros desse par não podem ser
  escritos nem por ela nem por `llm-authoring` (`docs/PLAYBOOK-REFERENCIA.md:322-325`).
Condição de escopo do número: o índice casa **termo literal** extraído do frontmatter, então 14 é
**piso**, não total — duas `description` colidem por sinônimo sem repetir uma palavra, e isso o
índice nunca vê. `catalog.md` é artefato **derivado** (`:3-5`) e nomeia esta skill como quem mede
e propõe fusão (`:62-63`), mas o dono de escrita é quem orquestra
(`docs/CONTRATO-DE-SKILL.md:137-144`): `description` mudou, o handoff pede regeneração.

## Como medir precisão de roteamento (o problema novo deste catálogo)

O catálogo tem 20 skills e o roteamento por palavra-chave degrada acima de ~15; a mitigação
declarada é roteamento em dois níveis, tier antes de skill — fonte:
`docs/CONTRATO-DE-SKILL.md:146-152`. Medir isso é responsabilidade desta passada.

### 1. O corpus de consultas
- Por skill: **≥3 gatilhos** (consultas que têm de casar) e **≥3 quase-erros adjacentes**.
- Quase-erro adjacente é uma consulta que pertence legitimamente à **skill irmã**, não lixo
  fora de domínio. O corpus de origem usa "explain quantum mechanics" e "what time is it"
  (`3b1b:.agents/scripts/run_skill_evals.py:277-283`): com 20 skills, o modo de falha não é "nada
  casou", é "seis casaram" — e nenhum quase-erro distante mede isso.
- Um quase-erro adjacente de `A` é, por construção, um **gatilho de `B`**: ele passa quando
  `M == {B}`, e **falha quando `M == ∅`**. É a diferença que o corpus de origem não faz — lá o
  quase-erro é distante e "nada casou" conta como acerto, que é exatamente o vazamento do
  `or len(matched) == 0`. Quase-erro fora de domínio (se houver) é a única classe em que `M == ∅`
  é o resultado correto, e ela mede distância, não irmã.
- Quem escreve os quase-erros de uma skill **não é o dono dela**. Oráculo e implementação não
  podem derivar da mesma premissa (`docs/PLAYBOOK-REFERENCIA.md:322-325`).
- O corpus é versionado junto com a linha de base; consulta nova entra, consulta nunca sai.

### 2. As três métricas, medidas separadamente
Para cada consulta com dono único esperado `E` e conjunto casado `M`:
- **acerto exato**: `M == {E}`.
- **contaminação**: `E ∈ M` e `|M| > 1` — a skill certa carregou junto com N erradas. Reporte
  `|M|`, não só "passou": é o número que cresce com o tamanho do catálogo.
- **erro de tier**: o tier escolhido não contém `E`. Este é irrecuperável — a skill certa nem
  entrou na disputa — e por isso vai numa métrica própria, nunca somado ao acerto de skill.
Publique os três com **denominador**: nº de consultas, nº de skills, e quantos quase-erros são
adjacentes. "Zero colisões" é verdade quando o roteamento está perfeito **e** quando o corpus
não tem irmão adjacente; as duas leituras dão o mesmo número
(`docs/PLAYBOOK-REFERENCIA.md:506-510`).

### 3. Matriz de confusão e critério de fusão
Monte a matriz `20×20` onde a célula `(i,j)` conta consultas cujo dono é `i` e que também
casaram `j`. Ela é o único artefato que responde "quais duas skills competem pelos mesmos
gatilhos".
Proponha **fusão** apenas quando as três condições valem ao mesmo tempo:
1. a confusão é **simétrica** e alta (cada uma rouba as consultas da outra) — assimetria
   significa que uma `description` é ampla demais, e o conserto é a `description`;
2. a união dos dois corpos fica **abaixo de 400 linhas** — o limiar de aviso do linter
   (`docs/CONTRATO-DE-SKILL.md:27`), não os 500 do erro duro;
3. as duas compartilham **condição de escopo**. Se uma vale "no encoder de hardware" e a outra
   "no renderer de software", a fusão produz uma regra errada fora do escopo — este é o veto
   duro (`docs/CONTRATO-DE-SKILL.md:99-101`).
Quando (3) falha, o conserto é: mover o termo discriminante para **exatamente uma** das duas
`description`, e escrever na outra a linha de gatilho negativo que nomeia a irmã.
Fusão aprovada renomeia diretório **e** campo `name` no mesmo commit: `name` tem de ser
idêntico ao diretório pai — **Placar (3-0)** — fonte: https://agentskills.io/specification
(`R06-14`); divergência é erro duro no linter.

### 4. As sondas negativas do próprio eval
O eval de roteamento é código, então ele também precisa da pergunta "o que isto imprime se o
roteador não fizer nada?" (`docs/PLAYBOOK-REFERENCIA.md:383-385`). Quatro asserções recíprocas:
1. **roteador que não casa nada reprova.** A asserção herdada é
   `"passed": none_matched or len(matched) == 0` (`3b1b:.agents/scripts/run_skill_evals.py:327`):
   o `or` deixa passar um roteador mudo em todos os quase-erros `[spec]`.
2. **roteador que casa tudo reprova** — é o outro extremo, e nenhum quase-erro distante o pega.
3. **zero consultas parseadas = falha**, porque `all([])` é `True` — **Placar (2-0)** —
   fonte: `C16`.
4. **o oráculo lê o roteador real**, não uma cópia do mapa de palavras-chave. No corpus de
   origem os 15/15 verdes validam um `ROUTING_MAP` do arquivo de teste, e o roteador que roda é
   a prosa da skill — **Placar (2-0)** — fonte: `C23`.

### 5. Linha de base e regressão
Precisão de roteamento é número, então o gate é comparativo: grave a matriz e as três métricas
num artefato versionado e **falhe quando qualquer métrica piorar**, não quando ficar abaixo de
um limiar absoluto. Uma consolidação que melhora dedup e piora contaminação em 2 pontos é uma
regressão, e o diff que a causou é identificável porque o gate roda **após cada mudança**, não
ao fim da passada (`docs/PLAYBOOK-REFERENCIA.md:165-168`).

## Procedimento de consolidação

1. **Preflight.** `cd $(git rev-parse --show-toplevel)`; confirme que o linter existe
   (`ls .agents/scripts/skill_lint.py` — hoje **não existe**, é `T-10`; enquanto isso o passo é
   manual e declarado, nunca silencioso) e que ele enxerga ≥1 skill
   (diretório ausente imprime "No skills directory found" e sai `0` — falha aberto,
   `3b1b:.agents/scripts/skill_lint.py:108-110`). Registre a contagem de skills e as linhas
   de corpo de cada uma antes de tocar em qualquer arquivo. Leia a **forma** do vermelho, não só
   o código: `2` é erro de forma (frontmatter, `name`, data no corpo), `1` é `0 errors` com aviso
   de corpo >400 — orçamento, não forma, e é o item que esta passada existe para fechar. Meça sem
   pipe (`out=$(cmd); c=$?`): `| head` devolve o código do `head`.
2. **Roteamento primeiro.** Rode o eval de roteamento e grave a linha de base **antes** da
   dedup. Sem isso não há como distinguir "a fusão melhorou o roteamento" de "a fusão mudou o
   corpus de consultas".
3. **Dedup por chave de padrão.** Mesma regra em duas skills: fica a versão mais específica de
   domínio; a outra vira referência cruzada nomeando a irmã. Antes de apagar, compare as
   **condições de escopo** das duas redações — se diferem, não são duplicatas.
4. **Proveniência.** Re-rode a checagem de citações e re-busque as URLs primárias das linhas com
   placar. Cada citação que virou muda (faixa, sem caminho, URL) é conserto de forma, não de
   conteúdo; cada citação que não resolve mais vira item de ledger com o comando que fecha.
5. **Contradições.** Só resolva as que têm lado perdedor por placar. As demais recebem o id da
   disputa e voltam para o ledger.
6. **Orçamento.** Descrições primeiro, corpos depois. Material longo vai para
   `<skill>/references/*.md`, nunca para `<skill>/<sub>/SKILL.md` (`C03`).
7. **Gate de regressão antes de promover.** Linter (`exit 0`, não `exit 1`), eval de roteamento
   sem piora, e o `verification_signal` de cada skill tocada **executado de verdade** (`C15`).
   Qualquer eval que vire de correto para errado: reverta **aquela** mudança, não a passada.
8. **Deleção exige segunda opinião.** Subagente de contexto fresco, que recebe só o diff e três
   perguntas falsificáveis: (a) o trecho apagado carrega uma condição de escopo que nenhuma
   outra skill enuncia? (b) alguma skill referencia esse trecho por nome? (c) existe caso de
   borda que só esse trecho cobria? Sem consenso, não apaga.
9. **Saída.** Diff, mais handoff nomeado para o dono dos pontos de composição
   (`catalog.md`, `skill-map.md`, `PROGRAMA.md`) — esta skill **não** os edita
   (`docs/CONTRATO-DE-SKILL.md:137-144`). Skill aposentada: apague também
   `.eval_records/<nome>.json`, senão sobra token verde órfão.

## Conhecimento negativo — o que um profissional competente faria e aqui está errado
- **Não funda duas skills só porque colidem no gatilho.** Colisão de gatilho é problema de
  `description`; fusão é decisão de escopo. Fundir escopos diferentes produz regra errada fora
  do escopo, que é pior que duas skills competindo.
- **Não "resolva" contradição com id de disputa** (`D-01`..`D-17`). Escolher um lado sem placar
  vencedor apaga a incerteza e cria premissa invisível.
- **Não deduplique apagando a condição "for commercial use".** Regras de terceiros escritas com
  esse escopo (mídia externa, pesos de TTS) continuam **verdadeiras** e **não bloqueiam card
  algum**: o uso deste programa é pessoal (card `I-01`, *"RESPONDIDO: uso pessoal"*, e `ADR-0003`
  no índice de ADRs do `Apêndice C` — ambos em `PROGRAMA.md`). Unificar
  duas redações cortando o escopo produz um dos dois erros opostos — bloqueio falso agora, ou
  permissão falsa no dia em que `AB-950` reabrir — e nenhum dos dois aparece em teste.
- **Não reescreva placar.** O placar é propriedade de `docs/pesquisa/**`, que tem outro dono.
  Divergência vira ledger e handoff, nunca edição do número na skill.
- **Não conserte citação transformando-a em faixa** (`arquivo.py:100-139`) — é exatamente a
  forma que o verificador não casa (`C08`), e a citação fica muda parecendo mais precisa.
- **Não trate `check_staleness` verde como proveniência válida**: ele mede existência de
  arquivo e comprimento, não deriva (`C07`).
- **Não confie no registro `.eval_records` como prova de que a eval rodou** — é JSON versionado,
  editável à mão, sem TTL (`C04`), e duas entradas são verdes por construção (`C17`).
- **Não rode a passada de dentro de subdiretório**: quatro verificadores saem verdes sem
  verificar nada (`C05`).
- **Não apague a seção "Não verificado" de uma skill ao encurtá-la.** É a seção que mais parece
  supérflua e a única que registra o que ninguém checou; removê-la é ganho de linhas com perda
  de honestidade.
- **Não deixe o dono da skill escrever os quase-erros dela** — oráculo e implementação com a
  mesma premissa dão 15/15 verde sem medir nada (`C23`).
- **Não use o linter como hook confiando no aviso**: aviso sai `exit 1`, e exit ≠ 2 não bloqueia
  (`R06-24`).
- **Não edite `catalog.md` nem `skill-map.md` durante a onda** — ponto de composição com dono
  declarado; N agentes acrescentando linha ao mesmo índice conflitam sempre.

## Falso verde deste domínio
Coluna 3 = **qual verificador precisa existir para que o sinal falso vire vermelho**. "Nada
hoje" não é enfeite: é o item de trabalho.

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| `All skills pass linting` (`exit 0`) | não olha proveniência (`C01`), pula skill aninhada (`C03`), não roda `verification_signal` (`C15`) | nada hoje — só um gate que exija ≥1 `— fonte:` por seção de conhecimento, varra `**/SKILL.md` recursivo e execute cada `verification_signal` |
| `All provenance citations are current` | só existência de arquivo e nº de linhas (`C07`); 79% das citações são mudas (`C08`) | nada hoje — só um verificador que aceite faixa `a:b` e recompute o sha1 do trecho citado |
| eval verde desta meta-skill | no corpus de origem é lambda com `passed: True` literal (`C17`) | nada hoje — só uma eval que rode linter e eval de roteamento como subprocesso e propague o exit code |
| 15/15 nos evals de roteamento | o oráculo é uma cópia do mapa, não o roteador que roda (`C23`) | nada hoje — só um oráculo que leia as `description` reais do disco em vez do `ROUTING_MAP` do arquivo de teste |
| quase-erros passando | se forem fora de domínio, medem distância, não a irmã adjacente | a colisão entre irmãs, assim que ≥3 quase-erros por skill vierem da irmã adjacente |
| índice de gatilhos regenerado com `ambíguos: 0` | o índice casa **termo literal** do frontmatter (`.agents/skills/catalog.md:65`): duas `description` colidem por sinônimo sem repetir palavra, e o índice não vê consulta nenhuma | a matriz de confusão sobre consultas reais — sem ela, `0` significa "nenhum termo repetido", não "nenhuma colisão" |
| corpo cortado de 380 → 300 linhas | corpo só carrega na ativação; o custo permanente é a `description` (`R06-16`) | nada hoje — só a soma de tokens de `name`+`description` das 20 skills, medida antes e depois |
| linter em hook acusando aviso | aviso é `exit 1` e exit ≠ 2 não bloqueia (`R06-24`) | nada hoje — só um wrapper que mapeie aviso para `exit 2`, e em evento `PreToolUse`, porque em `PostToolUse` o arquivo já foi gravado (`R06-25`) |
| "nenhuma skill mudou nesta passada" | ausência de reclamação não é sinal (`docs/PLAYBOOK-REFERENCIA.md:535`) | nada hoje — só o diff da matriz de confusão contra a linha de base versionada |
| registro `last_eval_passed: true` | é JSON versionado e editável à mão, sem TTL (`C04`) | nada hoje — só re-executar a eval no gate e falhar quando o resultado divergir do registro |

## O que esta skill NÃO cobre
- Escrever conhecimento novo numa skill, o pipeline de memória de 5 passos e o template de
  proposta → `meta-skill-evolution`.
- A regra de roteamento em dois níveis e a escolha do tier → `project-router` (implementa; esta
  skill mede).
- Como escrever critério de aceitação falsificável e sonda negativa em geral →
  `falsifiable-gates`.
- Abrir, ancorar e fechar item de incerteza com evidência → `uncertainty-ledger`.
- O subagente de contexto fresco e a redação das perguntas de refutação → `adversarial-review`.
- Propriedade de arquivo, ondas e barreira → `wave-planning` e `parallel-worktrees`.
- Spec de frontmatter, empacotamento e progressive disclosure em detalhe → `llm-authoring`.
- Golden master e caracterização de saída de vídeo → `video-characterization`.

## Não verificado
- **A perna do `verification_signal` que chama o linter está PENDENTE.**
  `.agents/scripts/skill_lint.py` **não existe neste repositório** — ele é entrega do card `T-10`
  (`W1`). A perna que roda hoje é a contagem de skills; a outra falha por ferramenta ausente, e
  isso é declarado aqui em vez de ser mascarado por um caminho absoluto para o repositório de
  referência — gate que atravessa fronteira de repositório falha por motivo irrelevante e ensina
  a ignorá-lo. Enquanto `T-10` não fecha, o passo 1 e o passo 7 rodam o linter **manualmente** e
  registram por escrito que rodaram. Fecha com: `ls .agents/scripts/skill_lint.py`.
- **`[spec]` sem placar numerado.** Os códigos de saída do linter
  (`3b1b:.agents/scripts/skill_lint.py:5`, `:125-133`) e o vazamento
  `or len(matched) == 0` (`3b1b:.agents/scripts/run_skill_evals.py:327`) vêm de leitura integral do
  código, sem id de claim em `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:948-972`. Fecham com:
  rodar o linter contra um corpus sintético (skill sem citação, skill aninhada, corpo de 401
  linhas) e conferir código de saída; e rodar o eval de roteamento com um roteador mudo.
- **Orçamento de listing de 1% da janela de contexto** e corte das descrições das skills menos
  invocadas: descrito em `docs/pesquisa/R06-remotion-agentes-skills.md:454-458` **sem placar**,
  e aberto como `L-02` (`:498`). Se for verdade, 20 skills podem perder descrição em silêncio e
  o eval de roteamento medirá um roteador que o modelo não está vendo. Fecha com `/doctor` e
  `/context` dentro do Claude Code.
- **`C21` (1-0)** — `.eval_records/` como diretório compartilhado colide sob N worktrees. Abaixo
  de 2-0. Fecha com: dois agentes em worktrees distintas gravando o mesmo registro, e conferir o
  merge.
- **`C22` (2-1, EM DISPUTA / `D-13`)** — se os hooks do corpus de origem chegaram a disparar.
  Enquanto aberto, nenhum passo desta skill pode depender de hook para acontecer. Fecha com:
  `Edit` forçado num `SKILL.md` de registro vermelho sob o harness, observando `exit 2`.
- **YAML da `description`.** O esqueleto do contrato (`docs/CONTRATO-DE-SKILL.md:40-41`) escreve
  `Triggers:` dentro do valor, e `: ` num escalar simples é rejeitado por parser YAML estrito —
  este arquivo escreve `Triggers are` por isso. Não foi observado como o Claude Code trata o
  erro; a hipótese registrada em `docs/pesquisa/R06-remotion-agentes-skills.md:448-452` é
  metadata vazia com o corpo carregado, ou seja, ativação automática que nunca acontece. Fecha
  com: `yaml.safe_load` do frontmatter de cada `SKILL.md` no gate, mais `claude --debug`.

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
