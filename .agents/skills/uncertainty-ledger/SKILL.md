---
name: uncertainty-ledger
description: 'Provides the rules for opening, anchoring, distributing and closing items in this program''s uncertainty ledger — a work queue for the day the real environment answers, not a risk register. Use whenever a task is about to assume something the current machine cannot prove, when a card needs new ledger ids while N worktrees run in parallel, when someone wants to mark an item confirmed, or when the closing script runs at a gate. Load it even if the user never says "ledger", "uncertainty" or "AB-nnn". Triggers: "assume", "we don''t know yet", "needs the real environment", "open item", "close this item", "mark as confirmed", "provisional decision", "TODO in the code", "AB-", "// ABERTO", "unblock on access day", "who answers this".'
metadata:
  type: knowledge
  tier: metodo
  verification_signal: git show 8737ad6:docs/00-panorama-verificado.md | grep -cE '^. AB-[0-9]{3} .' | grep -qx 75
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
# Ledger de incerteza — fila de trabalho, não registro de riscos

## Quando carregar

- A tarefa vai **assumir** algo que a máquina atual não prova (versão de driver, teto de API,
  determinismo de render, comportamento de voz TTS) e precisa registrar o pressuposto no ato.
- Um card em worktree isolada precisa **abrir ids novos** sem colidir com os irmãos da mesma onda.
- Alguém vai marcar um item como resolvido, o script de fechamento está sendo escrito ou alterado,
  ou o orquestrador vai **consolidar inboxes** depois do merge de uma onda.
- **Não carregue** para escrever o critério de aceitação de um card (isso é `falsifiable-gates`),
  para desenhar a onda e a propriedade de arquivo (`wave-planning`, `parallel-worktrees`), nem para
  responder o conteúdo de um item de domínio — a resposta mora na skill de domínio e em
  `docs/00-panorama-verificado.md` §7, que é a lei factual.

## Convenção de proveniência desta skill

Não existe arquivo de pesquisa dedicado a este método. As fontes são o playbook, o panorama e o
`PROGRAMA.md` — que **vence sobre plano** (faixa de id, caminho, nome de ferramenta, propriedade de
arquivo) e por isso decide onde a operação do ledger mora. Três marcas, e nada além afirma fato:

- **Normativo** — regra dessas três fontes. É lei deste programa, não afirmação empírica sobre o
  mundo; por isso não carrega placar. `PROGRAMA.md` e o panorama são citados por **âncora de seção
  ou id** (`§V-2`, `Apêndice D`, `F0-03`, `AB-049`), nunca por `arquivo:linha` — pino de linha não
  sobrevive a uma edição do alvo; o playbook, que ninguém edita aqui, continua por `arquivo:linha`.
- **Placar (N-M)** — afirmação empírica pontuada num arquivo de pesquisa, com `arquivo:linha`.
- **Extensão desta skill** — instanciação ou generalização que a fonte **não** cobre (um caminho,
  um algoritmo de hash, um enum de slugs). Nunca leia como lei; quem escrever o validador congela.
- Empírico sem placar ≥2-0 desce para `## Não verificado`, com o comando que fecha a lacuna.

## Conhecimento injetado

### A decisão de nível de programa, numa frase

Toda incerteza que **só o ambiente real responde** vira item de ledger com verificação executável e
consequência nomeada, escritas **no ato de assumir** — nunca depois.
— **Normativo** — fonte: `PROGRAMA.md` §V-2 (a frase de abertura), `docs/PLAYBOOK-REFERENCIA.md:68-70`

O corolário que muda o comportamento: se você consegue responder a pergunta agora, com um comando
na sua worktree, **não é item de ledger** — é uma linha de bootstrap. Ledger inchado é ledger não
lido. A seção de incerteza entra desde o card 1, não na onda 6.
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:543`

### Os cinco campos — e por que os dois últimos são os que decidem

| # | Campo | O que ele é |
|---|---|---|
| 1 | a pergunta | uma frase interrogativa, respondível por sim/não ou por um número |
| 2 | por que a base não responde | qual propriedade do mundo falta (doc omissa, fonte única, só existe na máquina-alvo) |
| 3 | o que se assumiu | a decisão provisória que o código vai carregar até a resposta chegar |
| 4 | **a verificação executável** | o comando que roda e imprime a resposta |
| 5 | **o que quebra se divergir** | os artefatos nomeados que precisam ser refeitos |

— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:449-452`

> *"Item aberto sem passo executável de verificação é item que ninguém consegue fechar no dia do
> acesso; ele não está aberto, está esquecido."* — `docs/PLAYBOOK-REFERENCIA.md:453-454`

Sem os campos 4 e 5 o registro é um TODO com número. Os dois testes que separam item de TODO:

**Teste do campo 4.** Aplique a pergunta do gate falsificável — *"o que este comando imprime se a
tarefa não fizer nada?"* Se imprime verde, o campo é decorativo.
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:383-385`
Reprovam: "verificar com o dono", "testar em produção", "conferir na doc". Nenhum é comando. Quando
a resposta depende de mandato, topologia física ou apetite de risco, a saída **não é item de
ledger** — é pergunta de sign-off, com ADR e cláusula do que o sign-off não autoriza. São dois
artefatos com donos diferentes; misturá-los faz o item esperar por uma execução que nunca vem.
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:64-67`, panorama §10 (item 2)

**A exceção é uma só, e tem nome.** `AB-950` — *"o uso continua pessoal?"* — nasce `ABERTO` **por
desenho**: verificação = o dono responde, e um campo `gatilho` nomeia o evento que o reabre
(publicar monetizado, publicar por uma organização, virar uso de trabalho). Ele existe porque a
decisão de `ADR-0003` vale **enquanto o uso for pessoal**, e regra sem condição de validade fica
errada em todo o resto. Não o feche, não o converta em sign-off, e não o leia como bloqueio —
**nenhum card deste programa está bloqueado por licença comercial**; o item é o gatilho, não a
trava. — **Normativo** — fonte: `PROGRAMA.md`, card `I-01` (aceitação: `validate-ledger.py --id
AB-950 --exigir-gatilho`)

**Teste do campo 5.** Ele nomeia artefato: fixture, baseline, gate, card, ou o *tipo* do card.
"Pode causar problemas de performance" não é campo 5. O modelo bom é AB-049: se whisper.cpp não for
determinístico, `captions.json` deixa de ser derivado e passa a ser artefato versionado e revisável
— *muda a topologia do pipeline, não um parâmetro*.
— **Normativo** — fonte: panorama §7.4, item `AB-049`
O campo 5 tem **destinatário nomeado**: uma premissa refutada sem descendente nomeado não é achado,
é anotação. — **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:351-352`

### Schema do item

**Extensão desta skill** — o `PROGRAMA.md` nomeia um conjunto próprio de campos no **Apêndice D**,
com outros nomes; os nomes abaixo são desta skill. Normativo são os **cinco campos**
(`docs/PLAYBOOK-REFERENCIA.md:449-452`) e o arquivo que os carrega (`PROGRAMA.md`, card `F0-03`).
Quem escrever `tools/validate-ledger.py` congela estas strings:

```json
{ "id": "AB-050", "categoria": "audio", "quem_responde": "plataforma → dono", "estado": "ABERTO",
  "pergunta": "…", "por_que_a_base_nao_responde": "…", "assumido": "…",
  "verificacao": { "cmd": "…", "espera": "…", "ambiente": "maquina-alvo" },
  "quebra_se_divergir": { "resumo": "…", "artefatos": ["gates/sync_ms.py"], "cards": ["F2-03"] },
  "ancoras": ["src/resolucao/locucao/tts.ts:41"],
  "gatilho": null, "evidencia": null, "adr": null }
```

`verificacao.ambiente` separa "roda aqui" de "só na máquina-alvo": sem ele o gate não distingue
`NAO_EXERCITADO` legítimo de sonda esquecida. `gatilho`, `evidencia` e `adr` existem desde o dia 1
com `null` — schema que ganha campo no dia do fechamento é schema exercitado pela primeira vez
nesse dia.

### Regras de validação por estado

Quatro estados, e o terceiro é o que costuma faltar: `ABERTO` · `FECHADO` · `NAO_EXERCITADO` ·
`INVIAVEL`. Os três primeiros são a regra do ledger; `INVIAVEL` é o estado terminal honesto.
— **Normativo** — fonte: panorama §7.7, regra 7 (três estados) e regra 5
(`INVIAVEL`). Não confunda com os três estados de **gate de CI** (`PASS`/`FAIL`/não-exercitado,
`docs/PLAYBOOK-REFERENCIA.md:367-370`): são vocabulários distintos, para objetos distintos.

| Estado | O validador exige | O validador rejeita |
|---|---|---|
| `ABERTO` | campos 1–5 presentes; campo 4 com token executável; campo 5 com ≥1 artefato nomeado; **toda âncora declarada resolve** | campo 4 sem comando; `quebra_se_divergir.artefatos` vazio; âncora que aponta para linha inexistente |
| `NAO_EXERCITADO` | motivo textual **e** o que falta para exercitar (credencial, máquina, GPU) | usar este estado como sinônimo de "falhou" |
| `FECHADO` | `evidencia` completa e com forma válida; `evidencia.cmd` idêntico (normalizado) a `verificacao.cmd`; nenhuma âncora `ABERTO <id>` restante | evidência textual; evidência de outro comando |
| `INVIAVEL` | `adr` apontando para um ADR que tem **guarda executável** — o comando que falha se a decisão for violada | `INVIAVEL` sem ADR; ADR sem guarda (aí é intenção, não decisão) |

— **Normativo** (guarda executável) — fonte: `docs/PLAYBOOK-REFERENCIA.md:475-478`; o resto da
tabela é **Extensão desta skill**.

**Exigir que o item *tenha* âncora é o erro que pinta o dia 1 de vermelho.** Não existe uma linha de
código neste repositório e os 75 itens do panorama nascem sem âncora; exigir ≥1 âncora por item
aberto reprova 75/75 exatamente onde a lei manda sair verde (panorama §7.7, regra 6; `PROGRAMA.md`
card `F0-03`, aceitação: *exit 0 com o ledger vazio*). A âncora vira obrigatória **no commit em que o
pressuposto entra no código**, e quem cobra é o invariante do consolidador, não o schema.

`NAO_EXERCITADO` não é meio-termo diplomático: é a diferença entre "a premissa está errada" e "a
sonda não rodou". Conflatar os dois bloqueia trabalho pelo motivo errado, e o relatório imprime
**os três números sempre**, com denominador — "0 divergências" é verdade quando o pipeline está
perfeito **e** quando ninguém rodou nada. — **Normativo** — `docs/PLAYBOOK-REFERENCIA.md:506-510`

### Âncora no código

Todo pressuposto assumido aparece ao lado do código que o carrega:
`// ABERTO AB-nnn: <o que se assumiu>`.
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:456-457`, panorama §7.7, regra 3

Quatro detalhes que decidem se a âncora funciona:

1. **A âncora carrega o campo 3, não o campo 1.** Quem tropeça na linha às 3h precisa do que foi
   assumido, não da pesquisa que levou até lá.
2. **A âncora nunca declara decisão.** Uma "decisão provisória" da seção 7 do panorama é um
   pressuposto ancorado, **nunca** uma decisão tomada. — **Normativo** — fonte:
   panorama §10 (item 2)
3. **A forma prescrita é `//`, mas a busca não pode ser.** O panorama escreve a âncora como
   `// ABERTO AB-nnn:` — essa é a lei. O programa, porém, tem Python e shell (`#`) e JSX
   (`{/* */}`), e um grep ancorado em `//` perde essas âncoras **em silêncio**. Use
   `grep -rn 'ABERTO AB-[0-9]\{3\}'`. — **Extensão desta skill**, por analogia com a falha medida
   em `docs/PLAYBOOK-REFERENCIA.md:426-427` (regex de proveniência que exigia caminho e deixou 38
   de 55 citações mudas); o comportamento em Python/JSX deste repositório não foi medido.
4. **A âncora é bidirecional e o fechamento a remove no mesmo commit.** Item sem âncora só é erro
   depois que o código existe; âncora **sem item** é erro sempre — pergunta ressuscitada por engano.

### Categorias — vocabulário fechado

Seis valores, um por partição do panorama, e nada além deles:

`ambiente` (AB-001..015) · `render` (AB-016..032) · `manim-bridge` (AB-033..044) ·
`audio` (AB-045..054) · `assets-licenca` (AB-055..065) · `agentes-worktrees` (AB-066..075)

As **faixas** são do panorama — **Normativo** — §7.1 a §7.6, uma faixa por subseção, na ordem
acima — e descrevem só a partição do §7: **item novo herda a faixa do card**, então a categoria
deixa de ser dedutível do número e passa a ser campo obrigatório. Os **slugs** são convenção desta
skill (o panorama tem títulos em prosa, não enum); quem escrever o validador congela as seis strings.

Por que fechado, e não tag livre: a regra operacional é **procurar antes de abrir**, e procurar é
grep. Com vocabulário aberto a mesma incerteza é arquivada sob dois nomes, o grep pela categoria
"errada" devolve zero, e **zero resultados não é prova de ausência**. O custo da duplicata não é o
arquivo: são duas pessoas medindo a mesma coisa, com números diferentes e sem árbitro.
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:33-35`, `:461`

Categoria nova exige commit do orquestrador que altera **o enum e o validador juntos**, fora da
onda. Um item com categoria desconhecida é erro do validador, nunca campo livre aceito em silêncio:
verificador que pula o que não entende é verde por omissão.
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:530`

### Classifique por quem responde

Quatro papéis, também fechados: `dono` · `infra` · `plataforma` · `juridico`. Compostos com `→`
(escalação: mede um, decide outro) e `+` (conjunto). É isso que transforma catálogo em **agenda**:
`quem_responde=infra` é uma lista entregável em uma sessão, não 75 consultas.
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:456`, panorama §7 (preâmbulo)

A distribuição é derivada, nunca redigitada (`docs/PLAYBOOK-REFERENCIA.md:408-410`):
```sh
grep -E '^\| AB-[0-9]{3} \|' docs/00-panorama-verificado.md | awk -F'|' '{gsub(/^ +| +$/,"",$(NF-1)); print $(NF-1)}' | sort | uniq -c | sort -rn
```
A ausência é registrada de propósito: **não existe papel DBA neste programa**, porque não há banco
no escopo — senão a coluna sugere que alguém está faltando.
— **Normativo** — fonte: panorama §7 (preâmbulo, "sobre quem responde")

### Sobreviver a N worktrees

Cinco dispositivos, todos mecânicos:
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:459-461`, panorama §7.7, regras 1-2

1. **Faixas pré-alocadas por card, no `PREP` da onda.** A alocação operante é a tabela de
   `PROGRAMA.md` §III-12 (`F0-01`: AB-001..019 · `T-01`: 020..029 · … · infra: 950..999), que
   supera a frase "AB-076..AB-149 reservadas" do panorama. **A consequência que morde:** os 75
   itens do panorama §7 já ocupam AB-001..075 e as faixas dos primeiros cards começam em AB-001 —
   os mesmos números para perguntas diferentes. Resolver a sobreposição é ato de quem orquestra
   (`PROGRAMA.md` é singleton S-11), nunca de um card em worktree; até lá o invariante de unicidade
   é a única coisa que separa "id novo" de "id roubado". Card que esgota a faixa **para e pede
   faixa nova**, não invade a do vizinho. — **Normativo** — fonte: `PROGRAMA.md` §III-12,
   `docs/PLAYBOOK-REFERENCIA.md:161-163` (faixa disjunta é 1 dos 4 dispositivos da onda)
2. **Inbox por card; `ledger/aberto.json` nunca é escrito por card.** Cada card escreve
   `ledger/inbox/<CARD>.json` — um dono por arquivo, zero conflito. Cards da mesma onda nascem de
   worktrees isoladas na mesma base, então o git **mergeia em silêncio** duas linhas adjacentes que
   discordam. — **Normativo** — fonte: `PROGRAMA.md` §II «Os singletons» (S-7), §III-11 (W4,
   compartilhados) e card `F0-03`; `docs/PLAYBOOK-REFERENCIA.md:158-160`; panorama §7.7, regra 2
3. **Consolidação pelo orquestrador, depois do merge** — nunca durante a onda.
4. **Ids nunca reciclados**, e a numeração nunca é compactada na consolidação. Item fechado guarda
   o id para sempre: âncoras antigas, handoffs e ADRs continuam resolvendo. Id reciclado faz um grep
   velho apontar para a pergunta errada — e *parecer certo*.
5. **Procurar antes de abrir**, por id e pelo texto da pergunta.

O que o consolidador checa, em ordem, antes de escrever a tabela (derivado das cinco regras acima —
nenhuma fonte enumera invariantes de consolidação; o invariante 5 é o único com placar próprio):

| # | Invariante | Falha típica que ele pega |
|---|---|---|
| 1 | ids únicos no conjunto de todos os inboxes | dois cards abriram o mesmo número |
| 2 | todo id cai **dentro da faixa alocada ao card** que o escreveu | card escreveu na faixa do vizinho |
| 3 | id novo = `max(faixa)+1`, sem preencher buracos | reaproveitamento de posição vaga |
| 4 | todo item `ABERTO` tem ≥1 âncora resolvível | pressuposto que ninguém encontra |
| 5 | **itens parseados ≥ 1 por inbox não-vazio** (ledger vazio saindo 0 é correto) | arquivo com bytes que parseia para lista vazia, lido como "tudo certo" |
| 6 | inbox ausente ⇒ o card declara "nada a propagar" explicitamente | ausência lida como conformidade |

O invariante 5 não é paranoia: no corpus de referência, `all([])` é `True` e uma avaliação que
devolvia lista vazia gravava `last_eval_passed: true`.
— **Placar (2-0)** — fonte: `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:965`

### Fechar é mais regulado que abrir

> *"Item marcado CONFIRMADO sem evidência anexada é pior que item aberto: ele para de ser
> reperguntado e vira premissa invisível."* — `docs/PLAYBOOK-REFERENCIA.md:468-470`

Abrir custa cinco campos. Fechar custa forma verificável **por regex** mais uma lista negra.
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:466-467`, panorama §7.7, regra 4

A **exigência** de forma verificável por regex — saída de comando salva, hash, código de saída — é
normativa (`docs/PLAYBOOK-REFERENCIA.md:466-467`, panorama §7.7, regra 4). A
**instanciação** abaixo é desta skill; a fonte não escolhe algoritmo nem subdiretório (o gate de
escrita do playbook usa `sha1`; aqui se usa `sha256`). A raiz `ledger/` é do `PROGRAMA.md` (card
`F0-03`); o `evidencia/` dentro dela não é nomeado. Todas obrigatórias em `evidencia`:

```
cmd      : string idêntica, após normalização de espaços, a verificacao.cmd
exit     : ^[0-9]{1,3}$
arquivo  : ^ledger/evidencia/AB-[0-9]{3}\.[a-z0-9.]+$
sha256   : ^[0-9a-f]{64}$   (recomputado pelo script sobre `arquivo`, não confiado)
```

**Lista negra** — seis termos, aplicada ao campo `evidencia` quando ele vier como texto, casando o
campo **todo** após `strip()`, sem diferenciar maiúsculas e ignorando pontuação final (`"OK"`,
`" ok "` e `"Ok."` têm de reprovar — `PROGRAMA.md`, card `F0-03`, refuta 3): `ok` · `confirmado` ·
`conforme combinado` · `testado` · `funciona` · `resolvido`. É a **união** de três fontes que
divergem — playbook três (`:466-467`), panorama cinco (§7.7, regra 4), card `F0-03` quatro (entrega),
sendo `resolvido` exclusivo de lá. União e não interseção: termo omitido é evidência que outra
fonte do próprio programa rejeita, entrando verde. — **Normativo** (os termos e o casamento).

Três detalhes não-óbvios do fechamento:

- **A lista negra roda no campo de evidência, não no registro inteiro.** Se ela varrer o item todo,
  a palavra "ok" no texto da pergunta reprova o fechamento, e a equipe aprende a contornar o gate —
  um gate que só pode ser satisfeito contornando-o ensina a contornar.
  — **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:400-402`
- **O sha256 é recomputado, não lido.** É a camada de deriva do gate de escrita de conhecimento:
  forma → deriva → regressão. Hash conferido pelo próprio autor prova endereço, não conteúdo.
  — **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:429-430`
- **`evidencia.cmd` tem de ser o comando do item.** Sem essa comparação dá para fechar AB-050 com a
  saída de outra sonda — o hash bate, o arquivo existe, e o item fecha na pergunta errada. Comando
  divergente resolve para `NAO_EXERCITADO`, jamais para `FECHADO`. É a mesma proibição do veredito
  `CONFERE` sem evidência anexada: existe `NÃO_COLETADO`, e ele nunca vira `CONFERE`.
  — **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:502-504`

Normalize a saída salva **por posição, nunca por valor**. Mascarar o número medido para o hash
estabilizar prova que a máscara funciona, não que o pipeline funciona.
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:224`

### O script de fechamento roda no gate desde o dia 1

Com 75 itens abertos e nenhum fechado — e mesmo com o ledger **vazio** — `tools/validate-ledger.py`
sai **0**. Esse é o comportamento correto, e é critério de aceitação de card.
— **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:463-464`,
panorama §7.7, regra 6; `PROGRAMA.md`, card `F0-03` (objetivo e aceitação)

O motivo é operacional, não estético: *ferramenta que estreia no dia do acesso é ferramenta que
falha no dia do acesso*. No dia do acesso você tem uma janela curta na máquina-alvo e nenhuma
paciência para depurar o próprio validador.

O que ele valida já na onda 1, com tudo aberto: schema de todo item · unicidade e faixa de id ·
campo 4 executável · campo 5 com artefato · **toda âncora declarada resolve** · contagem dos três
estados com denominador · itens parseados ≥ 1 **por inbox não-vazio**.

E o que o mantém honesto — porque o caminho de fechamento não é exercitado por nenhum item real na
onda 1:

- **Uma fixture sintética de item `FECHADO`** (com evidência válida) e outra **inválida** entram na
  suíte desde o dia 1. Sem elas, o ramo mais regulado do script nunca roda antes do dia em que
  precisa funcionar.
- **Autoteste antes do verificador**, assertando **a mensagem** e não o código de saída — um
  autoteste que verifica só o código de saída não distingue "acusou" de "quebrou".
  — **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:392-394`; `PROGRAMA.md`, card `F0-03`
- **Mutações calculadas do documento corrente, nunca literais**: duplique o *último* id que existe
  hoje e exija que a mensagem contenha esse id. Mutação escrita como literal vira no-op quando o
  documento muda, e ensina a ignorar o alarme.
  — **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:393-394`, `:532`
- **Falha fechado**: item que o script não sabe analisar é erro, não item pulado.
  — **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:394-395`
- Se um dia o script for removido do gate, registre por escrito que a regra virou manual — a
  ausência de um verificador é indistinguível de conformidade.
  — **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:228-229`

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

1. **Não abra item para o que um comando local responde agora.** O ledger é para o que só o
   ambiente real responde. AB-001 (`ldd --version`) é item porque a resposta é da máquina-alvo, não
   da sua worktree — a mesma pergunta sobre a sua máquina é linha de bootstrap.
2. **Não escreva "alinhar com o dono" no campo 4.** Dependência de mandato vira pergunta de
   sign-off com ADR, com a cláusula do que o sign-off não autoriza. Item de ledger que espera
   decisão humana nunca fecha e envenena a contagem do gate. Única exceção: `AB-950`, aberto por
   desenho, com `gatilho` (`PROGRAMA.md`, card `I-01`) — e ele **não** bloqueia card nenhum.
3. **Não feche porque o agente testou e funcionou.** *"O agente não é um juiz confiável de se o
   próprio aprendizado está correto. Confiança não é evidência."*
   — **Normativo** — fonte: `docs/PLAYBOOK-REFERENCIA.md:432-433`
4. **Não modele o estado como booleano.** `passed: bool` conflata "quebrou" com "não rodou" e
   bloqueia escrita numa premissa que nunca foi avaliada.
5. **Não deixe item inviável aberto por educação.** `INVIAVEL` com ADR é estado honesto; aberto
   eterno consome atenção do gate toda onda e treina o time a ignorar a lista.
6. **Não acrescente "só uma linha" a `ledger/aberto.json` durante a onda.** Ele é singleton S-7,
   nunca escrito por card: duas linhas adjacentes com ids diferentes mergeiam sem conflito e
   ninguém revisa o resultado semântico. Inbox por card, consolidação depois do merge.
7. **Não compacte a numeração ao consolidar.** Buracos na sequência são gratuitos; id reciclado é
   uma âncora antiga apontando para a pergunta errada, com aparência de correta.
8. **Não deixe o campo 5 dizer "impacta o pipeline".** Ele nomeia o card e o artefato a recapturar,
   porque o destinatário é quem vai tropeçar na premissa, não a equipe em geral.
9. **Não use "0 ocorrências" como fechamento sem denominador.** "0 GIFs falharam" é verdade quando
   o downloader está perfeito **e** quando nenhum GIF foi baixado.
10. **Não anexe evidência gerada por um comando "equivalente".** Equivalente é julgamento; o
    validador compara strings normalizadas. Se o comando do item estava errado, corrija o item num
    commit próprio — não feche com outro comando.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| `tools/validate-ledger.py` sai 0 | pode ter parseado zero itens de um arquivo com bytes; `all([])` é `True` — **Placar (2-0)**, `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:965`. Ledger **vazio** saindo 0 é correto (`PROGRAMA.md`, card `F0-03`, aceitação) | contagem impressa com denominador + autoteste que corrompe um inbox **não-vazio** e exige a mensagem que nomeia o arquivo |
| item `FECHADO` com evidência `"ok"` | a forma da evidência não foi validada | regex de forma + lista negra aplicada ao campo `evidencia` |
| `grep -rn '// ABERTO'` volta vazio ⇒ "sem pressuposto solto" | âncora em Python é `#` e em JSX é `{/* */}`; a regex ancorada em `//` nunca casa | grep sem prefixo de comentário + contagem cruzada item × âncora |
| evidência com sha256 correto | o comando que gerou a saída pode não ser o `verificacao.cmd` do item | comparação normalizada `evidencia.cmd` × `verificacao.cmd` |
| todos os itens têm o campo 4 preenchido | "verificar com o dono" preenche o campo e não é comando | validador que exige token executável e rejeita verbo de intenção — com a exceção nomeada `AB-950`, que em troca **tem de** declarar `gatilho` |
| gate verde na onda 1 com tudo aberto | correto, e prova só o ramo de abertura | fixtures sintéticas de `FECHADO` válido e inválido na suíte desde o dia 1 |
| relatório sem itens `NAO_EXERCITADO` | "não rodou" foi lido como "não se aplica" e sumiu | impressão obrigatória dos três estados com denominador |
| nenhum item novo há N ondas | ausência de reclamação não é sinal | inbox obrigatório por card, com "nada a propagar" explícito |
| item `INVIAVEL` com ADR anexado | o ADR pode não ter guarda executável — aí é intenção | validador exigindo o campo `Guarda executável` no ADR referenciado |

## O que esta skill NÃO cobre

- **Critério de aceitação e sonda negativa do card** → `falsifiable-gates`. O ledger empresta a
  pergunta *"o que isto imprime se nada for feito?"*, mas o gate do card é lá.
- **Propriedade de arquivo, worktree, preflight e barreira de onda** → `parallel-worktrees`; **o
  desenho da onda e a alocação de faixas por card** → `wave-planning`.
- **Refutação do próprio trabalho antes de encerrar** → `adversarial-review`.
- **Baseline de vídeo, ruído de pixel e tolerância** → `video-characterization` — muitos itens de
  `render` fecham com essa maquinaria. **Como esta skill se atualiza** → `meta-skill-evolution`.
- **As respostas dos 75 itens** → skills de domínio (`remotion-render-pipeline`, `manim-bridge`,
  `audio-captions-sync`, `asset-acquisition`, `tts-voiceover`) e `docs/00-panorama-verificado.md`
  §7, que é a lei factual.

## Não verificado

Nada acima marcado **Normativo** é afirmação empírica. As empíricas abaixo ficaram sem placar ≥2-0:

| O que | Placar | Comando que fecha |
|---|---|---|
| Diretório compartilhado sem faixa de id colide sob N worktrees (base do dispositivo "inbox por card") — `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:970` | 1-0, PROVÁVEL | duas worktrees escrevendo o mesmo `<skill>.json` e `git merge` das duas; observar se o resultado é conflito ou sobrescrita silenciosa |
| Ambiente ausente foi contabilizado como reprovação no corpus de referência (motivo do estado `NAO_EXERCITADO`) — `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:333-341` | **sem placar próprio**: é prosa da §3.4, fora da tabela de claims C01–C23; o panorama a dá como medida em §7.7, regra 7 | `jq '.assertions[] \| select(.passed==false).detail' .agents/skills/.eval_records/manim-code-gen.json` no repositório de referência |
| A lista negra de seis termos é exaustiva | sem fonte | é a união de três fontes, não uma prova de completude; termo adicional entra por commit do orquestrador, junto com o autoteste, nunca por hábito |
| Âncoras em `#` (Python/shell) e `{/* */}` (JSX) existem neste repositório — base do grep agnóstico de sintaxe | sem fonte; a lei escreve só `//` (panorama §7.7, regra 3) | `grep -rn 'ABERTO AB-[0-9]\{3\}' . \| grep -cE '(#\|\{/\*) *ABERTO'` — conta só as âncoras não-`//`; se der 0, a extensão não paga o próprio custo |
| O subdiretório `ledger/evidencia/` | sem fonte | a raiz `ledger/` e `ledger/inbox/<CARD>.json` são do `PROGRAMA.md`, card `F0-03`; o lugar da evidência não é nomeado. `F0-03` congela o contrato ao criar o diretório |
| PEAT como exemplo de `INVIAVEL` (panorama §3.3, claim `R14-23`) | R14-23 é 1-0 | é exatamente por isso que `INVIAVEL` exige ADR com guarda **e** gatilho de reconferência: estado terminal apoiado em fonte única precisa de porta de volta |

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
