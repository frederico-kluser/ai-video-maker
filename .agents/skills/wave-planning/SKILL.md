---
name: wave-planning
description: Provides the law that turns this program's dependency graph into waves — level is a constraint, wave is a scheduling decision, and neither is chosen by taste. Use whenever planning, numbering, widening, splitting or re-ordering waves of parallel cards, when deciding which wave a card belongs to, when inserting new work into an existing plan, or when writing or debugging the graph validator, even if the user never says "wave", "DAG" or "topological level". Triggers: "which wave", "wave table", "tabela de ondas", "que onda", "plan the waves", "parallelize these cards", "run these in parallel", "dependency graph", "critical path", "caminho critico", "fan-out", "composition wave", "onda de composicao", "PREP commit", "insert a new task", "renumber waves", "graph validator", "validate-graph".
metadata:
  type: knowledge
  tier: metodo
  verification_signal: "python3 tools/validate-graph.py PROGRAMA.md  # enquanto T-02 nao existir: grep -nF 'onda(c) >= nivel(c)' PROGRAMA.md && grep -nF 'onda(card) > onda(dep)' PROGRAMA.md"
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
# Planejamento de ondas — derivar o escalonamento do grafo

## Quando carregar

- Ao escrever ou revisar a tabela de ondas, o campo `deps` de um card, ou a decisão de em qual
  onda um card novo entra.
- Ao decidir se dois cards podem correr juntos — a resposta **não** é "estão no mesmo nível".
- Ao escrever, mudar ou depurar o validador de grafo (`T-02`, `tools/validate-graph.py`).
- Quando uma onda nasce com 1 ou 2 cards e a tentação é engrossá-la.
- Quando o plano muda no meio do programa e alguém quer renumerar ondas.
- **Não carregar** quando a pergunta é como criar a worktree, provar o preflight, detectar o
  término do agente ou ordenar merges — isso é `parallel-worktrees`. Nem quando a pergunta é se
  o critério de aceitação sabe reprovar — isso é `falsifiable-gates`.

## Como ler as fontes desta skill

Três classes de linha, e elas não se verificam do mesmo jeito.

- **`norma:`** — regra deste programa, citada por **âncora de seção** (`PROGRAMA.md §III-2`,
  `PLAYBOOK §15`), nunca por número de linha. O que a verifica é `grep -n '§III-2' PROGRAMA.md`.
  Norma não é afirmação sobre o mundo e não tem placar.
  **Por que âncora e não linha:** `PROGRAMA.md` ganha e perde linhas a cada onda, e um pino
  `arquivo:linha` redigitado à mão aponta para outro parágrafo depois do primeiro `PREP` — e
  continua **lendo como verificado**. Este é o defeito `L02-C10` do corpus de referência, onde a
  única citação com hash já apontava errado no commit que ela pina — (3-0) —
  `docs/00-panorama-verificado.md` item `L02-C10`.
- **`(N-M)`** — afirmação factual sobre o mundo, com o placar já fechado pela pesquisa, citada
  pelo **id do item** no panorama (`R15-01`, `R08-01`), que é estável. Sem `>=2-0`, a linha está
  em `## Não verificado`.
- **`AB-nnn` / `LS-nn`** — item **aberto** de ledger. Não é fato e não fecha decisão de card.

Medições do programa de origem citadas pelo playbook são **fonte única** e estão em
`## Não verificado`, mesmo quando soam precisas.

## Conhecimento injetado

### Nível é restrição; onda é escalonamento — e os dois são campos diferentes

```
nivel(c) = 0                    se c não tem dependência
nivel(c) = 1 + max(nivel(d))    para toda dependência d
onda(card) > onda(dep)          ← a forma que o script REPROVA (checagem 3, por aresta)
onda(c)   >= nivel(c)           ← consequência da anterior, por indução; a folga só gera AVISO
```

As duas desigualdades não são intercambiáveis, e confundi-las é o defeito mais caro desta skill:
o erro duro do validador é **por aresta** (`>` estrito, checagem 3); `onda >= nivel` é o que
**decorre** dela e é apenas **impresso** quando sobra folga (checagem 4). Um validador que
implemente só `onda >= nivel` aceita duas pontas de uma aresta na **mesma onda** e sai verde.
A onda nunca é *menor* que o nível; pode ser maior — e quando é, a folga é **impressa**, nunca
descoberta. — norma: `PROGRAMA.md §III-2` · `docs/PLAYBOOK-REFERENCIA.md §11` ·
`PROGRAMA.md §III-14` (card `T-02`, "Entrega")

O que isto proíbe na prática é escolher a onda antes de fechar `deps`. O card carrega **três
eixos separados de propósito**, e confundir os dois últimos é o que faz uma onda parecer pronta
sem estar: — norma: `PROGRAMA.md §III-13`

| atributo | eixo |
|---|---|
| `deps` | **grafo** — de onde saem as ondas; é a fonte de verdade |
| `id` + estado | identidade e progresso |
| `onda` | **escalonamento** — decisão de quem orquestra, não derivação |

> Se você não consegue derivar as ondas por script a partir do grafo, ou o grafo está errado ou
> as ondas estão. — norma: `PROGRAMA.md §III-2`

### Granularidade de card — a definição literal, e a metade que este programa acrescentou

> **"Um card é o maior pedaço de trabalho que ainda tem (a) um conjunto de arquivos escritos
> disjunto dos irmãos da mesma onda e (b) um comando que sai `exit 0`."**
> — norma: `docs/PLAYBOOK-REFERENCIA.md §8`

Este programa acrescenta a segunda metade de (b): **"e cujo `exit 0` seria `exit 1` se o
trabalho não fosse feito."** Um card cujo critério não sabe reprovar não é um card, é uma
intenção. — norma: `PROGRAMA.md §III-6`

**O eixo de corte deste programa é `contrato`, e ele diverge do playbook de propósito:** lá está
escrito *blast radius*, aqui está escrito *contrato* — e vale o daqui, por precedência
(`PROGRAMA.md` vence `PLAYBOOK` sobre plano). As duas consequências são literais e
contraintuitivas: — norma: `PROGRAMA.md §III-6` · diverge de `docs/PLAYBOOK-REFERENCIA.md §8`

- dois pedaços que escrevem **no mesmo arquivo** são **um** card, mesmo sendo trabalhos
  diferentes;
- dois pedaços que escrevem em arquivos **disjuntos** são **dois** cards, mesmo sendo o mesmo
  trabalho.

Corta-se um trabalho grande só quando cada pedaço **desbloqueia uma fase diferente** — encurtar
o caminho crítico é a única razão legítima de cortar algo que caberia junto. Junta-se quando o
padrão e o dono são os mesmos. Faixa alvo deste programa: **60–180 linhas de card**; 20 linhas
é subespecificado (a sessão é amnésica e improvisa), 400 é o trabalho de três.

### O segundo filtro: mesmo nível é necessário, arquivo disjunto é suficiente

O DAG diz **quando**; a propriedade de arquivo diz **se**. A granularidade da propriedade
degrada `diretório → arquivo → membro dentro do arquivo`, e no último caso o contrato escrito é
literal: *"compartilhado — só acrescente. Nunca reordene, nunca renomeie, nunca reindente,
nunca mexa em membro que não é seu."* — norma: `docs/PLAYBOOK-REFERENCIA.md §12`

**O teto de paralelismo não é o modelo nem a CPU: é o número de recursos singleton que as
tarefas tocam.** Enumere-os antes de dimensionar a onda; cada singleton vira **dono exclusivo**
ou **sequência**. — norma: `docs/PLAYBOOK-REFERENCIA.md §12`

Singleton não é só arquivo. Dois que um plano de ondas erra por não contar:

- **Cota de API é singleton de onda.** A chave **beta** da GIPHY (a gratuita; a de produção tem
  preço negociado) é **100 chamadas/hora por chave, não por processo**; N agentes em worktrees
  com retry estouram isso, e o sintoma chega como falha de card, não como falha de escalonamento.
  Obriga cache local de busca **antes** de qualquer onda paralela. — (2-0) —
  `docs/00-panorama-verificado.md` itens `R08-01 · R08-02`
- **A unidade do teto muda com a conta.** Por API o limite é RPM/ITPM/OTPM por organização e por
  modelo; por assinatura é janela deslizante de 5 h + semanal **por assento, compartilhada com o
  chat**. Se a execução é por assinatura, o parâmetro da onda é *tokens por janela*, não
  *processos simultâneos*. — (2-0) — `docs/00-panorama-verificado.md` item `R15-25`

### Estreiteza é sinal, não ineficiência — classifique antes de alargar

| Tipo de onda estreita | Como reconhecer | Tratamento |
|---|---|---|
| **arquivo global / singleton** | um recurso que todos tocariam (rotas, lockfile, mix final, porta) | **não alarga.** Vira dono exclusivo ou sequência. Neste programa a `W8` é pescoço por natureza — e está no caminho crítico |
| **join** (in-degree alto) | N cadeias convergem num card | **não alarga.** O card muda de arquétipo: lê os N handoffs antes da primeira linha e **espera achar ao menos uma contradição** |
| **fundação compartilhada / hub** | out-degree alto; a onda seguinte depende inteira dela | estreita **de propósito**. O que encurta o programa é **adiantar o hub**, não engrossar a onda |
| **fim de linha** | nada depende do card | não há o que alargar; aceite e feche |

— norma: `docs/PLAYBOOK-REFERENCIA.md §11` · `PROGRAMA.md §III-10`

Para alargar existe **exatamente um** movimento legítimo: **gastar folga** — puxar para a onda
um card cujo nível já é anterior. `F4-02` tem nível 2, onda 5 e folga 3, e foi puxado para
engrossar uma onda magra; isso é preenchedor de paralelismo, e a folga está declarada na tabela.
**Antecipar dependência não é alargar: é criar aresta** — e a aresta nova reaparece como
profundidade em algum lugar. — norma: `PROGRAMA.md §III-10` (tabela "Folga declarada")

**Largura é fan-out do nível anterior.** Se a onda seguinte nasce magra, o defeito está na
anterior, não nela. Adiantar um hub encurta o programa inteiro.

**Capacidade excedente tem endereço: o caminho crítico.** Neste programa o eixo longo é o
**áudio** (`locução → timing → ducking → mix → loudness`, cinco níveis estritamente sequenciais),
não a imagem — que é larga, vistosa e converge antes. Isso não foi intuído: uma versão anterior
publicou um caminho crítico diferente e três números de fan-out errados, todos redigitados de
cabeça, e o **recálculo do caminho mais longo** é que expôs. Cite a regra, não o número: essa é a
checagem **10** na lista do §15 do playbook (reproduzida abaixo), e `PROGRAMA.md §III-10` a chama
de "checagem 9" — as duas numerações divergem; cite pelo enunciado, nunca pelo ordinal.
— norma: `PROGRAMA.md §III-10` · `docs/PLAYBOOK-REFERENCIA.md §15`

### Ondas de composição — o tipo que o git mergeia em silêncio

**Definição operacional:** onda em que N cards trabalham sobre **o mesmo artefato entregue por um
card anterior**, em vez de N fatias independentes. — norma: `PROGRAMA.md §III-4`

**Detecção mecânica:** um card com **out-degree alto cujos consumidores estão todos na mesma
onda seguinte**. Convergência de dependentes num nível = onda de composição.
— norma: `docs/PLAYBOOK-REFERENCIA.md §13` · `PROGRAMA.md §III-4`

Duas precisões que separam isto de sensibilidade e que mudam o que se escreve no validador:

- **O predicado mecânico é a convergência**, não o tamanho: `{onda(d) : d depende de c}` é um
  conjunto **unitário** e igual a `onda(c) + 1`. Isso é computável a partir de `deps` sozinho.
- **"Out-degree alto" não tem limiar escrito em nenhuma das duas fontes.** Portanto o validador
  **imprime o candidato** e não decide sozinho; quem orquestra é que declara a onda como de
  composição e paga os quatro dispositivos. Escrever um limiar (`>= 5`, `>= 3`) num card é
  inventar norma — se um limiar for necessário, ele entra por `PREP`, com o número visível.

> Cards da mesma onda nascem em worktrees isoladas **a partir da mesma base**, então o git não
> tem em que conflitar e **mergeia em silêncio código que discorda**. Merge limpo prova ausência
> de conflito *de texto*, e nada mais. — norma: `PROGRAMA.md §III-4`

Os **quatro dispositivos** que uma onda de composição exige e uma onda normal não
— norma: `PROGRAMA.md §III-4` · `docs/PLAYBOOK-REFERENCIA.md §13`:

1. **Mapa de propriedade por arquivo**, com a coluna literal **"os outros: não editam"** — sem a
   terceira coluna é sugestão, não contrato. — norma: `PROGRAMA.md §III-11`
2. **Contratos congelados por escrito** no `PREP`: nome de campo, nome de flag, quem registra o
   quê. Não se negocia em tempo real entre irmãos cegos. *O que exatamente congela é por onda:*
   na `W6` deste programa são o formato de `timing.json`, a semântica do envelope de ducking e o
   contrato de erro de `F4-03` (o que é reparável × rejeição definitiva) — isso é a instância da
   `W6`, não um item genérico do dispositivo. — norma: `PROGRAMA.md §III-11`
3. **Faixas de id disjuntas** — ledger, porta TCP e qualquer inventário sequencial. Ids nunca
   são reciclados; quem esgota a faixa **para e pede outra**, não invade a do vizinho.
   — norma: `PROGRAMA.md §III-12`
4. **Onda em dois tempos** quando a propriedade colide: roda 2 cards, mergeia, e só então o
   terceiro.

E a pergunta adversarial **obrigatória** desta onda, que existe por um caso real de dois testes
contraditórios que mergearam limpos: *"existe alguma asserção neste diff sobre a **lista
completa** de alguma coisa? Ela é verdade contra a sua base e pode ser falsa depois do merge do
irmão. Reescreva como asserção sobre a **presença do seu item**, nunca sobre a ausência dos
outros."* — norma: `PROGRAMA.md` Apêndice A, arquétipo `A-4` (onda de composição)

### O commit PREP — antes de qualquer worktree existir

`PREP-w<N>` é **commit próprio, com nome próprio, fora de qualquer card**, para poder ser
revisado, revertido e citado. Ele traz, no mesmo commit: os **stubs** dos pontos de composição,
o **contrato da onda** (tabela `arquivo → dono`), as **faixas de id** do ledger, as **faixas de
porta**, e **qualquer mudança de ferramenta** que a onda exija.
— norma: `PROGRAMA.md §III-3` (passo 1)

O motivo de ser **commit** e não arquivo no disco é mecânico: `git worktree add` materializa
**apenas o conteúdo rastreado** do commit-ish. Um stub que não foi commitado **não existe** em
nenhuma worktree da onda, e o agente descobre isso escrevendo o arquivo do zero — do jeito dele.
— (3-0) — `docs/00-panorama-verificado.md` item `R15-01`

Segundo motivo mecânico, do outro lado da onda — e ele **tem escopo, não vale universalmente**:
a worktree **nativa** do Claude Code (`-w/--worktree`, na versão 2.1.226) ramifica do **branch
default do remoto**, porque `worktree.baseRef` tem default `"fresh"`. Isso é o default de um
ajuste, não uma lei: `"head"` ramifica do `HEAD` local. E `git worktree add` puro **não** tem
esse comportamento — ele ramifica do commit-ish que você passar. Onde o default vale, ele é a
diferença entre a onda N+1 **ver ou não ver** o trabalho da onda N, e o fechamento da onda tem
de chegar ao branch de onde a próxima ramifica. — (2-0) —
`docs/00-panorama-verificado.md` item `R15-09`

> **A assimetria que sustenta o PREP:** um card mal isolado custa **uma onda inteira** de
> retrabalho; a preparação que o isola custa algumas dezenas de linhas. **Prepare demais.**
> — norma: `docs/PLAYBOOK-REFERENCIA.md §13`

### Ondas fracionárias, e como a árvore muda no meio do programa

- **Onda nova vai para o fim da fila**, mesmo que seu nível topológico seja anterior. Nível é
  restrição; a posição na fila é escalonamento.
- **Onda fracionária `W<n>.5`** encaixa trabalho entre ondas existentes **sem renumerar nada**.
- **A trilha de infra ocupa as fracionárias** — licença, contas, hardware, canal de publicação.
  Ela **não tem worktree** e roda direto no branch de integração; o gerador **recusa** criar
  worktree para um id de infra. Motivo: um card de infra em onda inteira empurraria dez cards
  para a onda seguinte por uma decisão que leva cinco minutos de um humano.
  — norma: `PROGRAMA.md §III-1`; a recusa do gerador está em `PROGRAMA.md §VI-2` e no
  Apêndice A, arquétipo `A-6`
- **Arestas também são removidas**, não só acrescentadas — remoção silenciosa de aresta é o que
  o validador existe para pegar. — norma: `docs/PLAYBOOK-REFERENCIA.md §14`
- **Quem reescreve card é quem orquestra**, por branch `PREP-<slug>`, **fora da onda**. O
  executor não reescreve o card: ele cumpre até os critérios, nomeia a diferença e escreve o
  handoff. — norma: `docs/PLAYBOOK-REFERENCIA.md §27`

### As 11 checagens do validador de grafo (`T-02`, ~80 linhas, escrito no dia 1)

— norma: `docs/PLAYBOOK-REFERENCIA.md §15` · `PROGRAMA.md §III-14` (card `T-02`)

1. toda dependência resolve para um card existente;
2. grafo acíclico — DFS com cor, e **imprime o ciclo**, não só o veredito;
3. **monotonia de onda:** `onda(card) > onda(dep)` para toda aresta — invariante dura, e por ser
   **estritamente maior** ela já recusa dependência lateral;
4. **AVISO** quando `onda(card) > nivel(card)`: imprime a folga (aviso, não erro — folga é
   legítima; folga invisível não);
5. sem órfão — card sem dependência **e** sem dependente falha, salvo allowlist datada;
6. representações redundantes idênticas — **ou melhor: GERE o diagrama** em vez de comparar;
7. onda declarada no card == linha da tabela de ondas;
8. dois cards da mesma onda não escrevem no **mesmo arquivo**;
9. todo card tem critério parseável e, se concluído, que case **≥1 teste**;
10. caminho crítico publicado == caminho mais longo **recalculado**;
11. card concluído ⇒ **todos os ancestrais transitivos concluídos**.

O que este programa muda nessa lista — e a distinção importa, porque duas dessas quatro linhas
**não são checagens novas**, são a forma dura de uma que já existia
— norma: `PROGRAMA.md §III-14` (card `T-02`, "Entrega" e "Aceitação") · `PROGRAMA.md §III-5`:

- **destaque, não acréscimo:** a falha em aresta cujos dois extremos declaram a **mesma onda**
  (dependência lateral) já é consequência do `>` estrito da checagem 3. O que se acrescenta é a
  **mensagem nomeada** para esse caso — e é a mensagem que o autoteste asserta;
- **destaque, não acréscimo:** o **aviso impresso com a folga** é a checagem 4 tornada
  obrigatória, não opcional;
- **acréscimo real:** **falha** se dois cards da mesma onda declaram o mesmo arquivo como
  **dono** — a checagem 8 do playbook fala de arquivo **escrito**; esta fala do mapa de
  propriedade, e pega o conflito **antes** de alguém escrever;
- **acréscimo real:** o "ou melhor" da checagem 6 vira obrigação — o validador **gera** a tabela
  de ondas e o prompt XML do card, e o gate é `git diff --exit-code`; nunca comparação com uma
  versão redigitada;
- **acréscimo real:** **`zero cards parseados = falha`**, com a mensagem *"o formato mudou e este
  verificador ficou cego"*. Sem essa linha o validador sai verde quando o parser deixa de casar o
  documento: `all([])` é `True` em Python, e uma função de eval que devolve lista vazia grava
  aprovado com **zero asserções**. — (2-0) — `docs/00-panorama-verificado.md` item `L02-C16`

E o autoteste do validador roda **antes** dele, asserta **a mensagem** (não o código de saída) e
usa mutações **calculadas do documento corrente**, nunca literais — mutação literal vira no-op
no próximo merge e ensina a ignorar o alarme.
— norma: `PROGRAMA.md §IV-4` · `PROGRAMA.md §III-14` (card `T-02`, "Aceitação")

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

1. **Não alargue uma onda antecipando dependência.** Puxar um card que "quase" já pode rodar
   cria a aresta que faltava e reaparece como profundidade adiante. O único alargamento legítimo
   é **gastar folga já existente** — e a folga tem de estar impressa pelo validador antes, não
   argumentada depois.
2. **Não implemente a monotonia como `onda(card) >= onda(dep)`.** É a escrita natural de quem
   leu "a onda nunca é menor que o nível" e traduziu para arestas: passa em todo card correto,
   e por isso parece certa. Com `>=`, dois cards ligados por aresta na **mesma onda** saem
   verdes — e eles rodam em worktrees cegas entre si, então o dependente lê um arquivo que ainda
   não existe. A forma dura é `>` estrito, por aresta.
3. **Não numere onda por gosto, e não escolha a onda antes de fechar `deps`.** A onda é campo do
   card, mas é **derivável**: se o número que você escreveu não sobrevive ao script, ele estava
   errado. Não existe "esta onda ficou grande demais, jogo dois cards para a seguinte" sem que a
   folga apareça na tabela derivada.
4. **Não mantenha o grafo em duas representações redigitadas.** Se ele existe em dois lugares,
   **um tem de ser gerado do outro**. A tabela de ondas, o caminho crítico e o fan-out são
   derivados de `deps`; quando divergem, **a tabela é a que está errada**. Corrigi-la à mão para
   o gate passar é o mecanismo exato pelo qual quatro arestas existiram num atributo e nunca
   entraram no diagrama. E redigitar proveniência tem um caso local fechado: a **única** citação
   com hash do corpus de referência aponta para a linha errada — e já apontava errado no commit
   que ela pina. — (3-0) — `docs/00-panorama-verificado.md` item `L02-C10`
5. **Não cite `PROGRAMA.md` por número de linha** num card, num handoff ou nesta skill. É o que
   um profissional faz para ser preciso, e aqui é o contrário: o `PREP` de cada onda insere
   linhas, o pino escorrega para outro parágrafo, e o texto continua lendo como verificado.
   Cite `§III-N` — a âncora sobrevive ao `PREP` e é `grep`-ável.
6. **Não peça nada a um irmão da mesma onda.** Dependência lateral é proibida por construção:
   irmãos são cegos entre si, e um pedido no handoff nunca é lido por quem não é descendente. Se
   o card depende, os dois não estão na mesma onda — o grafo está errado. Handoff sem campo
   `destinatarios:` **nomeado** é anotação, não achado, e o gate rejeita.
   — norma: `PROGRAMA.md §III-5`
7. **Não trate merge limpo como acordo semântico.** Gate completo após **cada** merge, nunca ao
   fim da onda: com um merge dentro, o vermelho nomeia o card; com quatro, não nomeia nada. A
   bissecção é o produto. — norma: `PROGRAMA.md §III-3` (passo 7)
8. **Não ponha card de infra em onda inteira** só porque "é uma tarefa como as outras". Ele não
   tem worktree, depende de um humano, e ocupar `W<n>.5` é o que impede uma assinatura de custar
   uma onda.
9. **Não conclua uma onda por conjunto.** *"Concluídas" é o **prefixo ininterrupto** de ondas,
   não o conjunto* — com a `W3` aberta, a `W4` inteira feita não avança o contador, e a
   comparação é isolada **por linha**, nunca por seção.
   — norma: `docs/PLAYBOOK-REFERENCIA.md §33`
10. **Não dimensione a onda por "quantos processos a máquina aguenta"** antes de contar os
    singletons e de **nomear a unidade de cota da conta** (RPM/ITPM por organização e modelo, se
    API; janela de 5 h por assento, se assinatura). E **não decida de cabeça qual teto morde
    primeiro**: RAM × disco × janela de uso é item **aberto** no ledger (`AB-073`), com decisão
    provisória de *3 agentes por onda até medir*. Escrever num card "a cota estoura antes da RAM"
    fecha por palpite um item que a pesquisa deixou em aberto — o defeito é o mesmo do caminho
    crítico redigitado, só que sem nada para recalcular contra.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| Validador sai `exit 0` | pode ter parseado **zero** cards; `all([])` é `True` | a checagem `zero cards parseados = falha`, com mensagem própria |
| Tabela de ondas bate com os `deps` | pode ter sido **editada à mão** para bater | `just ondas:gerar && git diff --exit-code PROGRAMA.md` — a tabela commitada é a gerada |
| Grafo acíclico e "monótono" | "monótono" na forma fraca (`onda(card) >= onda(dep)`) **aceita** aresta entre dois cards da mesma onda; só a forma estrita a recusa | a checagem 3 escrita com `>` estrito **mais** o caso de autoteste que rebaixa uma aresta para onda igual e asserta a mensagem de dependência lateral |
| Merge da onda limpo, sem conflito | git prova ausência de conflito **de texto**; código que discorda mergeia em silêncio | gate completo após **cada** merge + os três testes de unicidade de `PROGRAMA.md §III-4` (varredura de disco por token de design duplicado · snapshot aprovado imutável · lista de ids registrados em `Root.tsx`) |
| Caminho crítico publicado "faz sentido" | intuição de eixo longo erra: aqui o eixo é áudio, não imagem | a checagem "caminho crítico publicado == caminho mais longo recalculado" (nº 10 no playbook, nº 9 em `PROGRAMA.md §III-10`) |
| Card isolado, sem dependência e sem dependente | passa em acíclico **e** em monotonia | a checagem 5 (órfão), com allowlist datada |
| `PREP` "pronto" porque os stubs estão no disco | worktree materializa só o **rastreado**; stub não commitado não existe lá | preflight por worktree que prova o insumo com **valor conhecido** |
| Onda "concluída" porque todos os cards dela estão feitos | concluídas é prefixo ininterrupto; uma onda anterior aberta invalida | comparação **por linha** do estado derivado contra os cards |
| Folga sai como **AVISO** e o validador segue `exit 0` | aviso não é erro, e o exit code não separa folga deliberada de card esquecido na fila | a linha **"Por quê"** na tabela de folga declarada de `PROGRAMA.md §III-10`, exigida de todo card cuja folga excede a folga-1 generalizada da tabela — sem ela o aviso vira ruído que ninguém lê |
| Onda de composição "não detectada" porque ninguém a nomeou | a detecção é do grafo, não da percepção: `{onda(d) : d depende de c}` unitário já basta | a impressão do candidato pelo validador — sem ela, os quatro dispositivos ficam por conta de alguém lembrar |

## O que esta skill NÃO cobre

- **Criar, travar, provisionar e remover worktree; preflight; barreira de término; ordem e
  mecânica de merge** → `parallel-worktrees`. Esta skill só diz **o que** vai no `PREP` e **por
  que** a onda abre com um commit.
- **Se o critério de aceitação sabe reprovar** (sonda negativa, tripwire, critério que falha por
  ausência) → `falsifiable-gates`.
- **As perguntas de refutação e o subagente de contexto fresco** → `adversarial-review`. Aqui
  aparece só a pergunta obrigatória da onda de composição, porque ela é propriedade da onda.
- **Abrir, ancorar e fechar item de incerteza** → `uncertainty-ledger`. Esta skill só declara que
  as **faixas** são pré-alocadas no `PREP` e nunca recicladas.
- **Ordem de construção do oráculo e o que é golden master** → `video-characterization`.
- **Qual skill carregar para uma tarefa** → `project-router`.

## Não verificado

- **Faixa de tamanho de card medida no programa de origem** (50–176 linhas, média 110; 51 cards,
  16 ondas): fonte única — o digest do playbook. Placar 1-0 como afirmação sobre o mundo. Fecha
  medindo `wc -l` dos prompts gerados após duas ondas deste programa.
- **"A preparação que isola um card custa 26 linhas"**: número do programa de origem, fonte
  única. Fecha medindo o diff de um `PREP-w<N>` real deste programa.
- **Todos os números derivados da tabela de ondas** (profundidade 11, onda mais larga 13,
  fan-out, in-degree, caminho crítico) ainda **não foram recalculados por máquina**: `T-02` não
  existe. Enquanto não existir, cada um desses números é redigitado — a mesma classe de defeito
  que a checagem do caminho crítico pegou uma vez. Fecha com
  `python3 tools/validate-graph.py PROGRAMA.md`.
- **Teto de agentes simultâneos** (`N×M ≤ 8`, "comece com 3 por onda"): decisão **provisória**
  de itens abertos do ledger — `AB-025` e `AB-073` em `docs/00-panorama-verificado.md`. Fecha com
  o script de rampa descrito lá, medindo RSS máximo, disco e custo por onda.
- **`worktree.baseRef` existe mesmo como chave de settings nesta versão**: só a doc do
  fornecedor afirma (`LS-05` em `docs/pesquisa/R15-agentes-paralelos.md`). Planeje a onda pelo
  default `"fresh"` e **não dependa** de `"head"`. Fecha com
  `claude --settings '{"worktree":{"baseRef":"head"}}' --version` e depois
  `claude --worktree t2 -p "git log --oneline -1" < /dev/null`.
- **Cardinalidade do hook de término por execução** (`AB-066`) muda a barreira, não a derivação
  da onda; o item é de `parallel-worktrees`.
- **Limiar de out-degree que caracteriza "hub"**: nenhuma das duas fontes escreve um número.
  Fecha declarando o limiar num `PREP` e fazendo `T-02` imprimi-lo junto do candidato.

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
