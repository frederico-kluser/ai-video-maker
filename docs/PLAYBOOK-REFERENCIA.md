# Playbook de referência — digest normativo

> **Este arquivo é um digest.** A fonte é o playbook "Modernizar um legado com agentes em
> paralelo", extraído de um programa real (51 cards, 16 ondas, 5 dias, agentes em git
> worktrees paralelas). As frases entre aspas são **verbatim** do original e são normativas.
> O resto é sumário e é subordinado a elas.
>
> **Precedência:** em conflito entre este digest e `PROGRAMA.md`, vence `PROGRAMA.md` —
> ele é o documento canônico deste programa e declara explicitamente o que supera.
> Em conflito entre este digest e uma skill, vence este digest.

---

## 0. Os três avisos do original

1. **Aquele programa não praticou TDD.** Praticou **caracterização antes de portar** e
   **critério de aceitação executável** por card. A diferença: TDD escreve o teste a partir
   do requisito que você quer; caracterização escreve o teste a partir do comportamento que
   já existe — inclusive os defeitos.
2. **O que foi provado é a construção, não a produção.** O ledger foi exercitado 260 vezes
   como catalogação e zero vezes como resolução. O corte e o desligamento foram construídos
   e não disparados.
3. **A infraestrutura de caracterização morreu antes do fim do programa** — e isso foi
   registrado por escrito em vez de deixar a ausência parecer conformidade.

---

## Parte I — Antes de existir tarefa

### §1 Calibre as ferramentas antes de contar qualquer coisa

> **Regra.** Escreva as regras de leitura do corpus num arquivo normativo *antes* de contar
> qualquer coisa, e trate cada uma como modo de falha, não como dica. "Zero resultados não é
> prova de ausência" ensina mais do que "use `-a`".

**Corolário.** Binário ilegível ≠ inacessível. Tente antes de declarar lacuna.

### §2 As dez perguntas — Q1..Q9 são pré-requisito de escrever tarefa; Q10 não é

| # | Pergunta | Sem ela, o que quebra |
|---|---|---|
| Q1 | De que o sistema é feito? | não há como fatiar em tarefas |
| Q2 | Como o usuário atravessa o sistema? | não há como definir fatias verticais |
| Q3 | Quais regras **não são inferíveis do nome**? | um agente escreve lógica plausível e errada |
| Q4 | Qual o modelo de dados? | não há mock, não há fixture |
| Q5 | **Quem mais depende do que vamos mexer?** | reescrita contida vira incidente alheio |
| Q6 | Como o sistema recebe identidade? | não dá para rodar nada isolado |
| Q7 | O que é risco e o que é dívida? | não há critério para priorizar ondas |
| Q8 | O que **não veio** no material? | planeja-se sobre buraco |
| Q9 | O que dá para verificar aqui × o que exige ambiente real? | confunde-se lint verde com correto |
| Q10 | Qual stack e qual faseamento? | — (não é pré-requisito) |

> **O último critério de parada é o mais discriminante:** consigo escrever o card raiz sem
> citar nenhuma tecnologia de destino além do runtime? Se não, a análise não terminou.

### §3 Blast radius — meça exclusividade, não acoplamento

Rode o grafo **nos dois sentidos**. "De quem eu dependo" é o fácil; "quem depende de mim" é o
que gera incidente. Hash de linha prova **cópia**, não prova **alcance** — são duas perguntas.

### §5 Stack: pesquisar × perguntar × registrar

- **Pesquise** quando a resposta é pública e datável — com **placar declarado**, e o placar
  desce até o executor: o card recebe o claim já com o nível de confiança embutido.
- **Pergunte ao dono** quando depende de mandato, topologia física ou apetite de risco.
  Vira **sign-off nominal e datado** no ADR, sempre com a cláusula do que o sign-off **não**
  autoriza.
- **Registre** quando a resposta só existe no ambiente real — vira item de ledger, com *como
  verificar* e *o que muda se divergir* escritos **no ato de assumir**.

**Pontos de troca barata:** liste o que você espera reverter, com o custo da reversão em
unidade contável. *Se você não consegue escrever o custo em unidade contável, o ponto não é
barato.* E documente o **acoplamento residual**.

### §6 Separe fisicamente achado de recomendação

> **Regra.** Escreva o panorama assumindo que ele será superado, e prepare o mecanismo de
> superação junto: um documento canônico, datado, que declara *"supero X §n"*. Não gaste
> tempo refinando escolhas de tecnologia no panorama — gaste em **enumerar as lacunas** e o
> **blast radius**, que é o que vai derrubar as escolhas.

E **nomeie o documento que vence em caso de conflito**, antes da primeira onda paralela.

---

## Parte II — A árvore de tarefas

### §8 Granularidade

> **Um card é o maior pedaço de trabalho que ainda tem (a) um conjunto de arquivos escritos
> disjunto dos irmãos da mesma onda e (b) um comando que sai `exit 0`.**

Divide-se por **blast radius** e por **consumidor**, nunca por volume. Junta-se quando o
padrão e o dono são os mesmos. Faixa medida no original: 50–176 linhas, média 110.

### §9 As fases — o eixo é ordem de risco, não camada

Mais **duas trilhas obrigatórias fora das fases**: a **transversal** (scaffold, CI, gateway,
auth — corre em paralelo à fase 0 para não serializar atrás dela) e a de **infra** (exige
humano/credencial/máquina; sem worktree; ocupa **ondas fracionárias** W*n*.5 para encaixar
sem renumerar nada).

### §10 Anatomia do card — 12 tags

`ultrathink` · `contexto` · `ler_consideracoes_dos_anteriores` ·
`questoes_abertas_ate_o_backend` · `skills_obrigatorias` · `entradas` · `o_que_fazer` ·
`restricoes` · `swarm/{subagents,worktree,revisao_adversarial}` · `criterios_aceitacao` ·
`ao_concluir_marque_feito_e_publique` · `evolucao`

> **Regra.** `<restricoes>` é onde vive o conhecimento **negativo** — o que um profissional
> competente faria por bom senso e que aqui é errado. Duas famílias: **fidelidade** (o
> defeito é o requisito) e **propriedade** (quem mais escreve neste arquivo agora). A segunda
> só existe porque há paralelismo.

**Esqueleto mínimo, sete campos:** foco do raciocínio · contexto (≤6 linhas) · herança
explícita · fontes + método de leitura · fronteira negativa (arquivos proibidos **com o nome
do card dono**) · aceitação executável e falsificável · protocolo de saída.

**O custo do card cai** conforme o programa acumula contratos publicados: raiz ≈ 5 KB,
penúltima onda ≈ 2 KB.

### §11 O grafo e as ondas — a lei

> **Regra.** A árvore de ondas não é um artefato criativo. É `nivel(c) = 0 se sem deps, senão
> 1 + max(nivel(d))`, mais um punhado de exceções nomeadas. **Se você não consegue derivar as
> suas ondas por script a partir do grafo, ou o grafo está errado ou as ondas estão.**

**A onda é uma decisão de escalonamento; o nível é uma restrição.** A onda nunca é *menor*
que o nível, mas pode ser maior.

**Estreiteza é sinal, não ineficiência.** Classifique antes de alargar: arquivo global · join
(in-degree alto) · fundação compartilhada · fim de linha. Para alargar: **gaste folga**,
nunca antecipe dependência. **Largura é fan-out do nível anterior** — adiantar um hub encurta
o programa inteiro.

### §12 Propriedade de arquivo — o eixo real do paralelismo

**O DAG diz *quando*; a propriedade de arquivo diz *se*.** Dois filtros: (1) mesmo nível
topológico — necessário; (2) conjuntos de arquivos escritos disjuntos — suficiente.

Granularidade degrada assim: `diretório → arquivo → membro dentro do arquivo`. No último
caso o contrato escrito é: *"compartilhado — só acrescente. Nunca reordene, nunca renomeie,
nunca reindente, nunca mexa em membro que não é seu."*

> **Regra.** Defina o eixo de paralelismo como *quem escreve em qual arquivo*, nunca como
> *quem trabalha em qual assunto*.

**O teto de paralelismo** não é o modelo nem a CPU: é o **número de recursos singleton** que
as tarefas tocam (arquivo de rotas, lockfile, porta TCP, banco, definição de CI). Enumere-os
antes de dimensionar a onda; cada singleton vira **dono exclusivo** ou **sequência**.

### §13 Ondas de composição

**Definição:** onda em que N cards trabalham sobre **o mesmo artefato entregue por um card
anterior**. **Detecção mecânica:** card com out-degree alto cujos consumidores estão todos na
mesma onda seguinte.

> *"Cards da mesma onda nascem em worktrees isoladas a partir da mesma base, então o git não
> tem em que conflitar e **mergeia em silêncio** código que discorda."*

Quatro dispositivos que ela exige: mapa de propriedade por arquivo com coluna "os outros: não
editam" · contratos congelados por escrito · **faixas de ID disjuntas** · onda em dois tempos
quando a propriedade colide.

> **Regra.** O merge do git prova ausência de conflito **de texto**, e nada mais. Instale:
> 1. **gate completo após CADA merge**, nunca ao fim da onda — a bissecção é o produto;
> 2. **testes que andam no disco** em vez de listas memorizadas;
> 3. **uma checagem semântica explícita do merge, escrita no commit**.

> **Regra.** Todo ponto de composição compartilhado vira **stub vazio commitado no branch base
> antes de criar as worktrees**, junto com um documento que é o contrato da onda.
> **A assimetria que sustenta tudo:** um card mal isolado custa uma onda inteira de
> retrabalho; a preparação que o isola custa 26 linhas. **Prepare demais.**

### §14 Como a árvore muda no meio do programa

Onda nova vai para o **fim da fila**, mesmo com nível topológico anterior · **onda
fracionária** para encaixar sem renumerar · **commit PREP** trazendo cards, arestas,
contadores **e a ferramenta** · **arestas também são removidas**.

### §15 O validador de grafo — escreva no dia 1 (~80 linhas)

1. toda dependência resolve para um card existente
2. grafo acíclico (DFS com cor; imprime o ciclo)
3. **monotonia de onda:** `onda(card) > onda(dep)` para toda aresta — invariante DURA
4. AVISO quando `onda(card) > nivel(card)`: imprima a folga
5. sem órfão (salvo allowlist datada)
6. representações redundantes idênticas — **ou melhor: GERE o diagrama do grafo**
7. onda declarada no card == linha da tabela de ondas
8. dois cards da mesma onda não escrevem no **MESMO ARQUIVO**
9. todo card tem critério parseável e, se concluído, que case ≥1 teste
10. caminho crítico publicado == caminho mais longo recalculado
11. card concluído ⇒ todos os ancestrais transitivos concluídos

> **Corolário de desenho:** se o grafo existe em duas representações, **uma tem de ser gerada
> da outra, nunca redigitada**.

---

## Parte III — Testes antes do código

### §16 A regra que define "iniciado"

> **"Nenhuma conversão de uma unidade legada começa sem um golden master pinado dessa
> unidade. Enquanto o snapshot não estiver pinado, o port não é considerado iniciado."**

Torne-a **estrutural**: o card do port declara dependência do card da captura, e o grafo faz
o resto.

### §17 A caracterização é infraestrutura, não teste

Quatro camadas, **cada uma um card separado, cada uma com gate próprio**: host do runtime →
shims determinísticos → dados determinísticos (**relógio congelado**) → motor de captura.
Nenhum passo começa sem o anterior verde.

> **Regra.** Antes de acreditar em qualquer sintoma, **prove a sonda**. Metade dos "achados"
> iniciais eram artefato da ferramenta de observação.

> **Regra.** Orce a caracterização como **infraestrutura**, com custo de máquina e ciclo de
> vida. E declare, por escrito, o dia em que ela deixar de ser reproduzível.

### §18 O que um golden master é

**Bytes de saída + diff de estado**, não "status 200". Normalização **por posição, nunca por
valor**. Onde a regra roda **fora do servidor**, o snapshot não a exercita — congele-a num
artefato separado, citado, marcado **NÃO EXECUTADO**.

> **Regra.** Quando um gate automático for removido, **registre que a regra virou manual**.
> A ausência de um verificador é indistinguível de conformidade.

### §19 Defeitos preservados — classifique CONTRATO × BUG antes de portar

| Rótulo | Significado de um diff |
|---|---|
| **CONTRATO** | diff = **regressão**. Preservar. |
| **COMPORTAMENTO-BUG** | diff = **a divergência pretendida**. Exige ADR nominal. |

> **Corrigir o shim é obrigatório; corrigir o legado é proibido.**

### §20 Onde o TDD entra (prescrito)

| Situação | Disciplina |
|---|---|
| Portar comportamento que **já existe** | **caracterização primeiro** |
| Escrever comportamento que **não existe** (ferramental, gateway, telemetria) | **TDD clássico** |
| Corrigir defeito **depois** da virada | TDD sobre o teste de caracterização + mover fixture CONTRATO→BUG com ADR |

**Torne isso um campo do card:** `disciplina: caracterizacao | tdd`, decidido na escrita do
card e não pelo agente.

### §21 Sequência de caracterização (12 passos, resumida)

inventariar blast radius → erguer ambiente em cards gateados → **validar a ferramenta antes
do sistema** → escolher o artefato certo por tipo de saída → **normalizar por posição e
assertar a normalização** → **assertar conteúdo, não status** → cobrir entradas sujas →
classificar CONTRATO×BUG → registrar o não-observável **no mesmo commit** → só então portar →
**provar determinismo duas vezes** (execução vermelha escreve em `*.received/`, nunca
sobrescreve a linha de base) → ao arquivar, congelar por escrito.

---

## Parte IV — Executar com agentes

### §22 Ritual de entrada

Desambiguar → escrever o acordo (artefato gitignorado) → classificar → selecionar
conhecimento → montar a cadeia → **carregar o conhecimento antes de implementar** → executar
contra o plano → ao concluir, evolution + apagar o plano.

> **Regra.** Quando existe spec a montante, o ritual de entrada não é "perguntar", é
> **diferença**: perguntar só o delta, e ler o histórico das dependências.

**As duas regras não negociáveis** (duas, não vinte): toda tarefa que abre fonte legado
carrega antes a skill de leitura do corpus; toda tarefa que propõe mudança carrega antes a
skill de blast radius. *As duas falhas que elas cobrem são silenciosas e confirmatórias.*

### §23 Worktree com preflight

> **Regra.** O setup termina com um **teste que prova acesso ao insumo crítico, com um valor
> conhecido** — não com "criei a pasta". Ambiente que falha em silêncio produz agente
> confiante e errado, e a falha aparece só no merge.

Cinco passos: validar identificador · **recusar** identificadores de infra · criar a partir
do branch de integração · symlinkar o insumo gitignorado **e acrescentá-lo ao exclude local**
· preflight com valor conhecido (falhou ⇒ exit 1, worktree fica para inspeção).

### §24 Disparo, barreira, ciclo

> **Regra.** A barreira tem de valer para quem terminou *antes* de você começar a esperar.
> **Contador monotônico por onda, nunca relógio, nunca "a tela está parada".**

```
lançar N agentes → BARREIRA → "commite tudo" → BARREIRA → sair do TUI
→ remover worktrees (do repo principal, sob lock) → MERGES um a um, nunca octopus
→ gate após CADA merge
```

O agente **nunca** remove a própria worktree. **Ordem de merge importa:** infra e gateway
primeiro; quem muda o gate, por último.

### §25 Swarm × subagents

| | decide | isolamento |
|---|---|---|
| **worktree** | paralelismo **entre** cards | diretório + branch |
| **subagents** | paralelismo **dentro** de um card | contexto |

> **Regra.** Paralelize **investigação** (barato, contexto isolado, retorno destilado de ~1
> página com citações). Serialize **decisão e escrita** quando a consistência entre as peças
> é o produto. E quem detecta *classe* de erro precisa ver o arquivo inteiro, não uma fatia.

**"Agente único" é o default explícito** — multi-agente custa 3–10× tokens sem ganho na
escrita.

### §26 Revisão adversarial

> *"Antes de concluir, lance um subagente de CONTEXTO FRESCO que recebe apenas o diff e este
> card, e tenta refutar: [3 a 4 perguntas falsificáveis específicas do domínio].
> **Corrija o que ele derrubar antes de encerrar.**"*

> **Regra dupla.** (1) Contexto zero, tarefa escrita como *tentativa de refutação*, não como
> "aprovar/reprovar". (2) **O oráculo e a implementação não podem derivar da mesma premissa
> não verificada.**

**O que faz uma pergunta boa:** ela nomeia um resultado observável que, se acontecer,
**derruba o trabalho**. "Está bom?" não é pergunta. *"O smoke passaria com uma página em
branco?"* é.

**Limite honesto:** quem escolhe as perguntas é o implementador, e quem decide o que "foi
derrubado" também. Para fechar a brecha, as perguntas vêm do card, escritas por quem
orquestra, antes.

### §27 Quando a premissa do card cai

| A premissa é… | O que fazer |
|---|---|
| (i) fato sobre o mundo | cumpra o card **pelo que ele quis**; entregue menos e **nomeie a diferença** |
| (ii) uma entrada | **estenda a entrada**, anunciando quem mais depende dela |
| (iii) restrição de ancestral | **o contrato vence, o card cede**; dívida nomeada a um card futuro |
| (iv) pressuposto de sequência | **só este exige reescrever o card**, fora da onda |

**O que PARA: nada.** O card continua até seus critérios de aceitação — que são sobre o
*resultado*, não sobre a premissa.

**Autoridade:** o executor **não pode** reescrever o card; seu mandato é marcar concluído e
escrever o handoff. Quem orquestra pode, por branch `PREP-<slug>`, fora da onda.

> *Um card é uma hipótese datada, não um contrato. O que ele afirma sobre o mundo pode ser
> falso; o que ele afirma sobre o resultado esperado é o que vincula.*
>
> E **a refutação tem endereço**: escreva-a para o descendente **nomeado** que vai tropeçar
> nela. Uma premissa refutada sem destinatário nomeado não é achado, é anotação.

---

## Parte V — Verificação em camadas

### §28 O fio condutor

> **"Ausência não falha sozinha. Se a cobertura pode encolher sem nada ficar vermelho, ela vai
> encolher — e o verde continua com a mesma cara."**

**Projete cada camada perguntando: *se isto desaparecer, o que fica vermelho?***

### §29 O gate local

Uma etapa **por job** (não por stage). **"Ferramenta ausente é VERMELHO, não 'pulado'"** —
pulado e passou imprimem a mesma conclusão operacional. **Três estados, não dois:** PASS,
FAIL e **não-exercitado**. Gate que ainda não existe é anunciado como `PENDENTE`, nunca
omitido. **Fonte única:** o gate local *lê* a definição do CI.

### §30 Aceitação falsificável — o achado mais transferível

O runner sai **verde quando o filtro não casa teste nenhum**. No programa de origem, 25 de 42
cards tinham exatamente esse critério: **já passava antes de a tarefa escrever a primeira
linha.**

O verificador corrigido: (1) parseia o próprio documento de gestão; (2) exige ≥1 teste casado
por filtro de card concluído; (3) **sonda negativa por alvo** — um filtro impossível *tem de*
listar zero; (4) **tripwire independente** num texto normalizado diferente; (5) **zero cards
parseados = falha**.

> **Regra.** Para cada critério, pergunte: ***"o que este comando imprime se a tarefa não
> fizer nada?"*** Se a resposta for "verde", o critério é decorativo.

**Inclua ao menos um critério que falhe por ausência** — é a classe que o resto não cobre.
Exemplo bom: `grep -L "MARCA" dir/*.ext # saída vazia`. Exemplo bom: capturar +
`git diff --exit-code <dir aprovado>` (dois oráculos: executa *e* prova determinismo).

### §31 Invariantes estruturais e autoteste

**O autoteste roda ANTES do verificador** e **asserta a mensagem, não o código de saída** —
*"um autoteste que asserta só o código de saída não distingue 'acusou' de 'quebrou'."*
As mutações são **calculadas do documento corrente, nunca literais**. **Falha fechado.**
**Recusa explícita do que não sabe analisar**, em vez de ignorar em silêncio.

### §32 Hooks — separe *nudge* de *gate*

> **"Prosa numa skill é conselho; estes hooks são garantias."**

**Todos falham abertos** diante de entrada inesperada. **Escopo estreito o bastante para não
ser desligado** — *"um gate que só pode ser satisfeito contornando-o ensina a contornar."*
O nudge é honesto sobre si mesmo.

> **Regra.** Gate mecânico só onde o erro é **irreversível ou auto-amplificante** (memória
> persistida, segredo, história do git). Nudge de contexto para o resto.

### §33 Estado derivado, não escrito à mão

> **Regra.** Todo número que aparece em prosa e existe numa fonte estruturada é **gerado ou
> conferido**, nunca redigitado.

**"Concluídas" é o prefixo ininterrupto de ondas, não o conjunto.** A comparação é isolada
**por linha**, não por seção.

---

## Parte VI — Memória e incerteza

### §35 A biblioteca de conhecimento

> **"O arquivo de skill *é* a memória — não há arquivo de aprendizados e não há buffer."**

**Citação com hash:** `caminho:linha@sha1curto` — o hash transforma a citação de *endereço*
em **asserção de conteúdo**. Gerada por script, **jamais escrita à mão**. O linter precisa
**rejeitar as formas degeneradas do pin** (no original, 38 de 55 citações estavam mudas
porque a regex exigia caminho e o token nunca casava).

**Gate de escrita em três camadas:** forma → deriva (sha1 recomputado) → regressão. Token
gitignorado, **TTL de 30 minutos**.

> **"O agente não é um juiz confiável de se o próprio aprendizado está correto. Confiança não
> é evidência."**

**Entra ou é descartado. Default: descartar.** (1) É importante? (não-óbvio, não inferível,
não-volátil, muda como tarefas futuras são feitas). (2) É verificado externamente? A linha
citada tem de **implicar** a afirmação. (3) Conflita? **Substituir**, nunca anexar a regra
concorrente. (4) Gate: escreva a asserção **antes** da prosa. (5) Commit próprio.

> **Nunca remova o escopo para economizar palavras:** uma regra que perde sua condição de
> validade vira uma regra que está errada em todo o resto.

**Limite declarado:** *"Proveniência detecta deriva, não correção."*

### §36 O ledger de incerteza

**Não é registro de riscos. É uma fila de trabalho para um dia futuro.**

Cinco campos: a pergunta · por que a base não responde · o que se assumiu · **o teste
executável que fecha a questão** · **o que se quebra se a resposta for outra** (nomeando
fixtures e gates a recapturar).

> *"Item aberto sem passo executável de verificação é item que ninguém consegue fechar no dia
> do acesso; ele não está aberto, está **esquecido**."*

**Classifique por quem responde**, não só por risco — é isso que transforma o catálogo numa
agenda. **Âncora no código:** `// ABERTO <id>: <o que se assumiu>`.

**Sobreviver a N worktrees:** ids pré-alocados **por faixa** · **inbox por card**, nunca o
arquivo compartilhado · consolidação pelo orquestrador depois do merge · ids nunca reciclados
· procurar antes de abrir.

**O script de fechamento roda no gate desde o dia 1**, verde com tudo aberto — *"ferramenta
que estreia no dia do acesso é ferramenta que falha no dia do acesso."*

**Fechar é mais regulado que abrir:** evidência com forma verificável por regex, **mais uma
lista negra** que rejeita `"ok"`, `"confirmado"`, `"conforme combinado"`.

> **"Item marcado CONFIRMADO sem evidência anexada é pior que item aberto: ele para de ser
> reperguntado e vira premissa invisível."**

**Estado terminal honesto:** `INVIÁVEL`, com ADR.

### §37 ADR com guarda executável

Três campos que diferenciam: **`Guarda executável`** (o comando que **falha** se a decisão
for violada — *se você não consegue escrever a guarda, a decisão é uma intenção*) ·
**`Supera` / `Reafirma explicitamente`** · **`O que o sign-off NÃO autoriza`**.

Quatro estados extras: `PROPOSTO — esqueleto vazio` · `ENCERRADO SEM DECISÃO` ·
`ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO` · `ACEITO (sign-off de <nome>)`.

### §38 Absorver × integrar

> **Regra.** A escolha **não se decide no documento de visão, com contagem de linhas do
> provedor**. Decide-se depois de um inventário **por call-site** — a superfície consumida
> costuma ser uma ordem de grandeza menor que a publicada. Congele a decisão na raiz da
> árvore e faça-a hereditária.

---

## Parte VII — A troca

Fases ordenadas de forma que **toda etapa reversível venha antes da primeira irreversível**,
com janela de tempo explícita na fronteira: catch-all → alcançabilidade → corte de leitura →
corte de busca → canário por unidade → corte final → soak → desligamento físico.

**Uma alavanca por fase, e uma alavanca-mestra.** Reversão é sempre **uma edição de
configuração, sem redeploy**.

**Gates numerados** (Apêndice G): condição de entrada · evidência exigida (saída de comando
salva, nunca afirmação) · **artefato nominal onde a evidência mora** · **quem assina, por
papel nomeado**. Um veredito que não pode existir: `CONFERE` sem evidência anexada — use
`NÃO_COLETADO`, que **nunca** vira `CONFERE`.

**A armadilha do denominador:**

> *"Zero não é sinal sozinho — precisa de denominador. 'Tráfego residual = 0' é verdade quando
> o corte está perfeito **e** quando ninguém está usando. As duas leituras produzem o mesmo
> número e significam o oposto."*

**Runbook para quem não estava lá:** cada item traz a evidência junto; anexo "como reconferir
tudo isto você mesmo"; perguntas segregadas por interlocutor; seção final "o que ninguém
conferiu"; e **o escopo negativo é parte do entregável**.

---

## Apêndice I — Catálogo de falso verde (a categoria mais repetida)

| O que parecia verde | Por quê |
|---|---|
| runner com filtro que casa **zero** testes | sai 0 quando o filtro não casa nada |
| `git diff --exit-code` num diretório de saída | **não enxerga arquivo não rastreado** |
| citação de proveniência **sem o caminho** | a regex nunca casa; é pulada em silêncio |
| teste que asserta **a documentação** em vez do artefato | apagar o artefato mantém o teste verde |
| **fixture fabricada alimentando a própria asserção** | não é teste |
| **default de flag declarado duas vezes** | virar o default deixa a suíte verde |
| **motor e oráculo repetindo a mesma premissa errada** | as duas cópias erram juntas |
| cláusulas infalsificáveis pelo seed | passam apagadas → rode mutação contra o seed |
| verificador que **pula** o que não entende | verde por omissão → **falhe fechado** |
| autoteste que asserta **só o código de saída** | não distingue "acusou" de "quebrou" |
| mutações de autoteste escritas como **literais** | viram no-op e ensinam a ignorar o alarme |
| barreira de onda por **leitura de tela** | declarou "terminaram" com os agentes trabalhando |
| "sinal = 0" sem denominador | verdade quando está perfeito **e** quando ninguém usa |
| ausência de reclamação | **não é sinal** |

**A pergunta que gera esta lista:** *se isto desaparecer, o que fica vermelho?*

---

## Os cinco erros que o programa de origem cometeu

1. A seção de incerteza entrou só na onda 6 → **ponha desde o card 1**.
2. Nunca houve validador do grafo → **~80 linhas, no dia 1**.
3. O handoff não tinha teto nem destinatário; 49 de 49 preenchidos, **zero** disseram "nada a
   propagar" → **limite de tamanho + campo `destinatários:` obrigatório**.
4. Irmãos da mesma onda são cegos entre si por construção → **proíba dependência lateral ou
   crie barreira de leitura intra-onda**.
5. O critério de aceitação mais comum passava vazio → **sonda negativa desde o começo**.

---

## A frase que resume tudo

> **"Verde quer dizer 'confere com o mock', nunca 'confere com produção'. Não se valida uma
> reconstrução contra ela mesma — é um limite de lógica, não de ferramenta."**
