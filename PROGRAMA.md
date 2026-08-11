# PROGRAMA — Editor de Vídeo IA

> **Documento canônico deste programa.** Em conflito, este vence.
>
> **Supera, no que diverge:** `Roadmap Editor de Vídeo IA.md` — integralmente na seção
> "Roadmap Técnico de Implementação Exaustiva" (as sete fases), e pontualmente em toda
> afirmação de API refutada por `docs/00-panorama-verificado.md`.
>
> **Reafirma explicitamente:** de `Roadmap Editor de Vídeo IA.md`, a tese central —
> o vídeo é uma função de estado, versionável, determinístico, com custo de render local —
> e a divisão em dois ecossistemas (Node/React para composição, Python para geometria).
> Isso não mudou e não vai mudar.
>
> **Método:** `docs/PLAYBOOK-REFERENCIA.md`. Em conflito entre o playbook e este documento,
> vence este documento — mas cada divergência é declarada e justificada, nunca silenciosa.
>
> **Fatos:** `docs/00-panorama-verificado.md`. Este documento **não** reafirma fatos por conta
> própria: toda afirmação técnica aqui é um ponteiro para lá. Se os dois divergirem, o
> panorama verificado vence sobre fato e este documento vence sobre plano.
>
> **Com uma cláusula que a conciliação isolou e que não estava escrita:** a precedência do
> panorama vale sobre **fato com placar** — as seções 1 a 4 e 7 dele. **Não vale sobre o escopo
> negativo dele (§10)**, que é prosa sem placar e que o §0 do próprio panorama exclui da sua
> autoridade. Isso não é tecnicalidade: sem a cláusula, um agente aplicando a precedência
> **literalmente** rebaixaria este documento de 20 para 19 skills — porque a §10.6 do panorama,
> escrita antes de a vigésima existir, diz 19. **A verificação vence a citação quando a citação é
> sobre escopo, não sobre fato.**
>
> **E a declaração foi testada, não só escrita.** Um agente de contexto zero leu os dois
> documentos inteiros procurando divergência de fato — `docs/conciliacao-programa-panorama.md`.
> Resultado: **onze divergências**, dez em que o panorama vence, uma em que ele está desatualizado,
> e **nenhuma em que este documento decida um fato *contra* o panorama por discordar dele**. As
> onze foram aplicadas. *Declarar precedência é barato; provar que ela se sustenta é o que fecha
> a lacuna.*

---

## Como usar este documento

### O que ele é

O **contrato de execução** de um programa de construção greenfield conduzido por agentes de IA
em git worktrees paralelas. Não é um relatório de arquitetura — esse já existe e se chama
`Roadmap Editor de Vídeo IA.md`. Este aqui é o que transforma aquele relatório em trabalho
particionável, verificável e paralelizável.

A ordem das partes é a ordem de execução. Você pode segui-lo de cima para baixo.

### O que ele não é

Ele **não** prova que o produto funciona. No momento em que foi escrito, nenhum frame havia
sido renderizado por este programa. O que ele oferece é a disciplina que faz o erro aparecer
enquanto ainda cabe num card — não a garantia de que não haverá erro.

Ele também **não** é um tutorial de Remotion, de Manim ou de FFmpeg. Esse conhecimento mora nas
skills (`.agents/skills/`), é carregado por classe de tarefa, e é citado — nunca repetido aqui.

### A diferença fundamental em relação ao playbook de origem

O playbook foi extraído de uma **modernização de legado**. Lá havia um oráculo pronto: o sistema
antigo, rodando, respondendo. A regra número um daquele programa era *"nenhuma conversão começa
sem um golden master pinado"* — e o golden master vinha de graça, bastava capturar.

**Aqui não há legado.** Não há sistema antigo, não há comportamento a preservar, não há defeito
que seja requisito. O oráculo não existe: ele precisa ser **construído antes do produto**.

Essa é a única adaptação estrutural do método, e ela reescreve a regra número um:

> **ADR-0001 (proposto na W0):** Nenhum estágio do pipeline é considerado iniciado enquanto não
> existir um oráculo capaz de **reprovar** aquele estágio. "Capaz de reprovar" não é opinião: é
> uma sonda negativa que prova que o critério fica vermelho quando o trabalho não é feito.
>
> Consequência estrutural: **o card do estágio declara dependência do card do oráculo**, e o
> grafo faz o resto. Ninguém precisa lembrar da regra — ela é uma aresta.

Tudo o mais no playbook transfere quase intacto, porque o que ele descreve não é uma técnica de
migração: é uma técnica de **coordenar agentes cegos entre si**, e esse problema é idêntico aqui.

### Os três avisos, traduzidos para este programa

**1. Isto não é TDD, e a distinção importa mais aqui do que lá.** Num legado, caracterização
vence TDD porque o requisito é "o que o sistema faz hoje". Aqui, metade do trabalho **não tem
comportamento anterior** — o gate local, o validador de grafo, o cache endereçado por conteúdo:
para todos esses, o teste *é* a especificação e TDD clássico é a disciplina certa. A outra
metade — tudo que produz pixel ou som — não tem requisito escrito em lugar nenhum e só pode ser
travada por **snapshot aprovado por humano mais prova de determinismo**.

Por isso todo card carrega um campo obrigatório:

```
disciplina: tdd | caracterizacao | ambos
```

Decidido na **escrita do card**, por quem orquestra. Nunca pelo agente executor. Um agente que
escolhe a própria disciplina escolhe a que é mais fácil de satisfazer.

**2. O que está provado aqui é zero.** O playbook de origem podia dizer "51 cards executados em
5 dias". Este documento não pode dizer nada disso. Ele é desenho revisado, não prática validada.
Trate cada número de cronograma da Parte VIII como **hipótese datada**, e o mecanismo de corte da
Parte VII como **construído e não disparado** desde o primeiro dia.

**3. O ativo reaproveitado tem prazo de validade.** O projeto `/home/ondokai/Projects/3blue1brown`
economiza tempo real: ele já resolveu a execução headless do Manim, já tem linter de skill, gate
de escrita, hooks e evals. Mas ele é um **repositório separado, que evolui sozinho**. Copiar dele
é absorver, nunca integrar — e o que for absorvido carrega a citação `arquivo:linha` da origem,
para que a divergência futura seja visível em vez de virar mistério. Ver §I-7 e ADR-0004.

---

## Parte 0 — Calibração: como as ferramentas mentem neste corpus

**Passo zero, e não é figura de linguagem.** Antes de contar qualquer coisa, descubra como as
suas ferramentas mentem *neste* projeto. Cada item abaixo é um **modo de falha**, não uma dica —
e cada um já custou tempo em projetos desta forma.

| # | A ferramenta mente assim | Por que o silêncio é o problema | O que fazer |
|---|---|---|---|
| C1 | `exit 0` de um render **não prova que saiu imagem**. Um quadro totalmente preto renderiza com sucesso. | O pipeline inteiro pode ficar verde produzindo vídeo em branco | Todo gate de render asserta **conteúdo** (entropia do frame, hash ≠ hash-de-quadro-preto), nunca só o código de saída |
| C2 | Um runner de teste com **filtro que não casa nada** sai verde | O critério de aceitação passa antes de a tarefa escrever a primeira linha | Sonda negativa por alvo (Parte IV §15) |
| C3 | `git diff --exit-code` **não enxerga arquivo não rastreado** | Um diretório de saída vazio "confere" | Combine com `git status --porcelain` ou `--no-ignore` explícito |
| C4 | `ffprobe` reporta duração do **container**, que pode divergir da duração do **stream** | Áudio e vídeo com durações diferentes passam por "o mesmo vídeo" | Sempre leia duração por stream, e asserte a diferença |
| C5 | O **Chrome do Studio ≠ o Chrome do render** | O que você viu na pré-visualização não é o que foi codificado | Nenhum snapshot é aprovado a partir do Studio; só a partir do render |
| C6 | Uma fonte que **não carregou** cai para a fonte de fallback sem erro | O layout muda em silêncio entre máquinas | Fontes locais embutidas + asserção de que a família resolvida é a esperada |
| C7 | Um asset baixado da rede **muda de conteúdo mantendo a URL** | O render de ontem não reproduz | Nada de URL no manifesto resolvido: só hash de conteúdo |
| C8 | `nvidia-smi` presente **não significa** encoder disponível para o seu processo | O fallback silencioso muda a qualidade sem avisar | Prove o encoder com um encode de 1 segundo, não com a presença do driver |
| C9 | Rodar duas vezes e comparar **não pega** o que muda por data, fuso ou máquina | O determinismo parece provado e não está | Congele relógio, fuso e locale; normalize **por posição, nunca por valor**; asserte que não sobrou volatilidade |
| C10 | Uma skill que existe **não significa** que foi carregada | O agente trabalha sem o conhecimento e o resultado parece plausível | O card lista `skills_obrigatorias` com caminho literal, e o handoff declara quais foram carregadas |
| C11 | Busca vazia em código gerado por LLM **não é prova de ausência** — o token pode estar quebrado por escape, unicode ou quebra de linha | Você conclui que a regra não existe e a duplica | Busque também no texto normalizado (a técnica do tripwire, §15) |
| C12 | O cache **acerta pelo motivo errado** quando a chave omite um parâmetro | O asset velho é servido para a entrada nova, em silêncio | A chave de cache inclui **tudo** que muda a saída, e existe um teste que muda um parâmetro por vez e exige cache miss |

> **Regra.** Estas doze linhas vão para o `AGENTS.md` da raiz e são **reinjetadas por hook a cada
> mensagem** nas que forem críticas. Um arquivo normativo é lido uma vez e sai de atenção numa
> sessão longa; a regra que precisa sobreviver à sessão longa mora no hook, não no arquivo.

---

## Parte I — A análise que precede a árvore

> Nenhuma afirmação técnica nasce aqui. Toda linha desta parte é **consequência de
> particionamento** derivada de `docs/00-panorama-verificado.md` e dos arquivos de
> `docs/pesquisa/`, e carrega a origem entre colchetes.

**O vocabulário de citação deste documento** — quatro formas, e cada uma diz *onde* a afirmação
resolve. A auditoria de conciliação mediu que 23 de 57 citações não conformavam justamente porque
o vocabulário não estava declarado: quem lia não sabia distinguir um claim confirmado de uma
refutação de cluster.

| Forma | Lê-se | Resolve em |
|---|---|---|
| `[R07-06 (3-0)]` | cluster R07, claim 06, três fontes confirmam e nenhuma contradiz | `docs/00-panorama-verificado.md` §1–§4, §7 |
| `[R13-16 · cluster]` | claim de cluster **não promovido** ao panorama — vale, mas com menos escrutínio | `docs/pesquisa/R13-*.md` §1 |
| `[R02 §3 · refutação]` | a tabela de refutações do cluster R02 — o que o panorama antigo afirma e **não se sustenta** | `docs/pesquisa/R02-*.md` §3 |
| `[§4 D-05]` | disputa nomeada entre clusters — **não** é fato, é o registro de que dois clusters discordam | `docs/00-panorama-verificado.md` §4 |

> **A regra que a forma existe para tornar possível:** um claim com placar `< 2-0` **não pode virar
> decisão de card**. Sem o vocabulário declarado, `[R13-16]` e `[R07-06 (3-0)]` liam igual — e a
> segunda tem três fontes atrás, a primeira tem uma.

### §I-1. As nove perguntas, traduzidas para greenfield

O playbook fecha nove perguntas antes de escrever tarefa. Elas foram escritas para um legado;
aqui não há legado. A tradução não é cosmética — **a resposta muda de "descobrir" para
"decidir"**, e uma decisão precisa de dono, o que um achado não precisa.

| # | No legado | **Aqui** | Resposta |
|---|---|---|---|
| Q1 | De que o sistema é feito? | **De quais estágios o pipeline é feito, e qual é impuro?** | Cinco estágios; a fronteira separa dois impuros de três puros (Parte II) |
| Q2 | Como o usuário atravessa o sistema? | **Qual é o caminho de um tema até um MP4 publicado?** | `brief → manifesto → resolvido → frames → entrega → revisão humana` |
| Q3 | Quais regras não são inferíveis do nome? | **Quais valores do domínio um agente adivinharia errado?** | §I-2 — e são muitos, todos numéricos |
| Q4 | Qual o modelo de dados? | **Qual é o contrato entre Node e Python, e quem é dono dele?** | `F0-02`; fonte única gerada, nunca duas definições à mão |
| Q5 | Quem mais depende do que vamos mexer? | **De quem NÓS dependemos, e o que cada um pode nos tirar?** | §I-3 — o blast radius invertido |
| Q6 | Como o sistema recebe identidade? | **Quais credenciais e licenças o pipeline precisa para rodar?** | `I-01` (respondido: uso pessoal), `I-02` |
| Q7 | O que é risco e o que é dívida? | **O que é irreversível?** | Publicar. Só isso (Parte VII) |
| Q8 | O que não veio no material? | **O que o panorama não menciona nenhuma vez?** | §I-5 — e virou fase 0 |
| Q9 | O que dá para verificar aqui? | **O que é o oráculo, se não há sistema anterior?** | §I-4 — a pergunta mais importante desta parte |

### §I-2. Q3 — os valores que um agente adivinharia errado

No legado, Q3 era *"o inteiro 10 significa retirada no balcão"*. Aqui, Q3 é o conjunto de
números e nomes que **soam inferíveis e não são** — e cada um deles, adivinhado, produz um
sistema plausível e errado que nenhum teste posterior pega.

| O que um agente assumiria | O que de fato é | Origem |
|---|---|---|
| `interpolate()` limita o resultado ao intervalo de saída | O default é **`extend`**, não `clamp`. `interpolate(200,[0,100],[0,1])` devolve `2`, **sem erro** | `[R02 §3 · refutação]` |
| `durationRestThreshold` é ajuste fino de estética | É `0.005` por default e mexer nele **alonga o cálculo** — `measureSpring()` roda um laço **sem teto** | `[R02 §3 · refutação]` |
| `-t` no motor de gráficos produz WebM com alfa | Sozinho produz **`.mov` com `qtrle`/`argb`**. WebM só com `--format=webm` junto | `[R07-06 (3-0)]` |
| O `.mov` transparente é ProRes 4444 | É **`qtrle`**. ProRes não aparece em lugar nenhum do código do gerador | `[R07-07 (2-0)]` |
| O navegador do render reproduz esse `.mov` | **Não reproduz** — a lista fechada de codecs é AV1/VP8/VP9 (+H.264/HEVC). Mas isso **não é o gargalo**: a extração de frame acontece **fora do navegador**, via FFmpeg | `[R07-10 (3-0)]` `[R07-11 (2-0)]` `[R07-12 (2-0)]` |
| `-qk` é 1440p e `-qp` é 4K | **Invertido**: `k` = 3840×2160, `p` = 2560×1440 | `[R07-18 (3-0)]` |
| `--disable_caching` não escreve cache | O help literal é *"still generates cache files"*. Para limpar é `--flush_cache` | `[R07-19 (2-0)]` |
| `--seed` torna o render reproduzível | Torna o **RNG da cena** reproduzível. Os **bytes não**: o gerador grava a própria versão em `metadata["comment"]` e não configura `bitexact` | `[R07-21 (2-0)]` `[R07-22 (2-0)]` |
| A concorrência default é metade dos núcleos | É `min(8, max(1, núcleos/2))` — **travada em 8**. Numa máquina de 32 threads o default é 8, não 16, e a doc não menciona o teto | `[R12-03]` `[R05 §3 · refutação]` |
| `--buffer-size` melhora a qualidade sob aceleração de hardware | É uma das opções **proibidas** com encoder acelerado, e é a primeira checada: com `required` o render **lança erro**; com `if-possible` ele **desliga a aceleração em silêncio** | `[R05 §3 · refutação]` |
| `--hardware-acceleration required` verifica se há hardware | **Não verifica.** Em Linux ele seleciona o encoder por `process.platform` e a falha aparece depois, como erro do FFmpeg | `[R05 §3 · refutação]` |
| Um GIF de biblioteca pública pode entrar num vídeo monetizado | O ToS de um dos provedores proíbe literalmente *"use or exploit any content for commercial use"* | `[R08-05 (2-0)]` |
| Timestamps de locução por caractere e por palavra são a mesma coisa | Um provedor devolve **por caractere**; palavra é **derivada** acumulando até o espaço. E há dois alinhamentos (texto original × texto normalizado) que **não** coincidem | `[R13-01 (3-0)]` |
| Offsets de *speech mark* são posição de caractere | Num provedor são **offset de byte** — e texto pt-BR com acento tem byte ≠ caractere em UTF-8 | `[R13-03 (2-0)]` |

> **É por isso que `F0-04` (tokens) tem out-degree 10 e é card crítico.** Cada linha acima é um
> valor que precisa viver num tipo nomeado único, com fonte citada. Um literal repetido em dois
> arquivos é uma dessas linhas esperando divergir num merge limpo.

### §I-3. Q5 — o blast radius invertido

No legado, o blast radius mede *quem quebra se eu mexer*. Greenfield, a pergunta se inverte:
**de quem nós dependemos, e o que cada um pode nos tirar sem aviso.** A técnica é a mesma —
medir **exclusividade**, não acoplamento — mas o eixo é o oposto.

| Dependência | Nosso *lock-in* | O que ela pode nos tirar | Mitigação e custo contável |
|---|---|---|---|
| **Motor de composição** | alto — é o modelo de programação | mudança de licença; a 5 ainda não existe e os breaking changes estão declarados como lista **incompleta** `[R01-11 (3-0)]`. A linha 4 é *anunciada* como patch-only — **promessa de fornecedor, não invariante testado por nós** `[R01-13 (1-0, tier NÃO VERIFICADO)]`; o teste que a torna falsificável é `AB-032` | pin exato de versão + `F1-01` isola o contrato de nó. Reversão: reescrever os componentes; manifesto e store não mudam |
| **Licença do motor** | baixo, **no escopo atual** | nada, enquanto o uso for pessoal: *personal use* é categoria de elegibilidade à licença gratuita. O gatilho de "empresa com mais de 3 empregados" `[R01-02 (3-0)]` **não se aplica** | `I-01` (respondido). O risco não é o texto da licença: é o **escopo mudar sem ninguém notar** — e é isso que `AB-950` vigia |
| **Motor de gráficos** | médio | nada — é OSS com release estável `[R07-01 (3-0)]` | contrato é "código → arquivo com alfa". Reversão: trocar um executor |
| **Provedor de locução** | médio | preço; mudança de modelo que **altera o som da voz ao longo do tempo** `[R13-16 · cluster]`; determinismo não garantido mesmo com seed `[R13-15]` | cache por hash torna a locução imutável depois de gerada. **Cuidado com o atalho que não existe:** o caminho local devolve timing **só em inglês** — a função de junção é guardada por `lang_code in 'ab'` `[R04-24 (2-0)]`, e o claim contrário está **EM DISPUTA** (`§4 D-05`). **Planejar pelo pior caso: em pt-BR local, o estágio de alinhamento não pode ser deletado** — e isso vale para `F2-03` e `F3-01`, os dois no caminho crítico. Custo de errar, palavra do panorama: *um subsistema inteiro* |
| **Mídia externa (GIF/meme)** | médio, **no escopo atual** | a cláusula que mordia era *"exploit any content for **commercial** use"* `[R08-05 (2-0)]`, e ela não alcança uso pessoal. Sobram os limites técnicos, **por provedor**: GIPHY beta 100/hora `[R08-01·R08-02 (2-0)]` · Pexels 200/h e 20.000/mês · Unsplash 50/h no modo demo `[R08-20·R08-22 (2-0)]` · Pixabay 100 req/60 s com cache obrigatório de 24 h `[§8.1 (1-0)]`. **E uma incompatibilidade que precisa ser decidida antes de escrever o downloader: Pixabay proíbe hotlink e Unsplash o exige** `[R08-21·R08-22]` — as duas regras não coexistem numa política única | o cache endereçado por conteúdo já resolve o limite de taxa. E `@remotion/animated-emoji` (CC BY 4.0 `[R08-19 (3-0)]`) continua sendo o caminho de menor atrito, não por licença: por **determinismo** |
| **Fontes** | baixo, se local | layout muda entre máquinas se a fonte vier de CDN — e o pacote de fontes do fornecedor **resolve para CDN** `[R09 §3 · refutação]` | fontes versionadas no repositório. `F1-03`. Reversão: copiar uma pasta |
| **Navegador headless** | médio | versão nova muda o pixel | é baixado pelo próprio motor, e a versão é **fixada pela versão do motor** `[R05-17 (3-0)]`. Consequência que muda o plano: **bump do motor = bump de navegador = re-baseline de 100% das fixtures** — evento planejado, nunca manutenção de rotina. E **cada worktree baixa o seu próprio navegador**: isso entra na conta de disco antes de dimensionar a W4 em 13 worktrees |
| **Máquina** | alto | GPU de consumo tem **teto de sessões simultâneas de encode** `[R12-16 (2-0)]` `[R12-17]` | `I-03` mede o teto **antes** da fase 5 |

**A métrica que decide o programa** — o análogo dos "2 ativos exclusivos" do legado:

> A análise inicial identificou **duas dependências irredutíveis sem mitigação técnica**: a
> licença do motor de composição e o regime da mídia externa. Ambas jurídicas, ambas exigindo
> decisão de quem tem mandato. **`I-01` respondeu as duas de uma vez**: o uso é pessoal, e as
> duas cláusulas que mordiam eram condicionadas a **uso comercial**.
>
> **Resultado: zero dependências irredutíveis no escopo atual.** Todo o resto é substituível a
> custo contável (tabela acima e "pontos de troca barata", Parte II).
>
> **O que isso não significa.** A medição não sumiu — ela ficou **condicional**. O número "zero"
> vale enquanto o escopo for pessoal, e o item `AB-950` existe precisamente para que o dia em que
> ele deixar de valer seja um evento **impresso**, e não uma descoberta. É a diferença entre um
> risco resolvido e um risco **datado**: o primeiro some do radar, o segundo continua sendo
> reperguntado. Este é o segundo.

### §I-4. Q9 — o oráculo, e o que ele não cobre

A pergunta mais importante desta parte, porque é a única sem resposta pronta.

No legado o oráculo é o sistema antigo. Aqui não existe "certo" independente: **um gerador de
vídeo não tem resposta correta, tem resposta aprovada.** O oráculo, então, é construído em três
camadas, e cada uma responde a uma pergunta diferente:

**A numeração abaixo é a do `docs/00-panorama-verificado.md §9.2`, e isso não é detalhe.** Uma
versão anterior desta seção tinha quatro camadas com numeração própria, em que "camada 1" e
"camada 2" significavam **coisas trocadas** em relação ao panorama — o que tornava ilegível, a
partir daqui, a ordem de construção publicada lá. Duas camadas também estavam simplesmente
faltando, e uma delas é a única que resolve o problema do oráculo circular.

| # | Pergunta que responde | Artefato | Custo | Cobre |
|---|---|---|---|---|
| **0. Estrutural** | *o arquivo é sequer o tipo de coisa que eu pedi?* | `ffprobe`: duração **por stream**, fps, resolução, nº de streams, sample rate, pix_fmt | ~zero | a casca — e pega a maioria dos desastres |
| **1. Determinismo** | *mudou alguma coisa sem que eu mandasse?* | render 2× → hash por frame (`framemd5`) | barato | tudo, sempre |
| **2. Timeline resolvida** | *o que exatamente mudou na decisão?* | diff do `manifesto-resolvido.json` | baratíssimo | a decisão, não o pixel |
| **3. Frame-chave** | *o pixel é o que um humano aceitou?* | PNG de frames escolhidos + envelope de áudio | caro | só os pontos escolhidos |
| **4. Invariantes de propriedade** | *a saída viola alguma regra que vale para todo vídeo?* | duração de legenda, contraste, safe area, flashes/s, LUFS | barato | propriedades, não conteúdo |
| **5. Round-trip** | *o vídeo diz o que o roteiro mandou dizer?* | transcrever o MP4 **final** e comparar com o roteiro de origem | caro | o único que fecha o laço |

**A camada 0 é a mais subestimada e a primeira a construir.** Ela não sabe nada sobre estética e
pega, sozinha, quase todo desastre real: o vídeo com metade da duração, o que saiu a 30 fps em vez
de 60, o que perdeu a trilha de áudio, o que exportou em 1280×720 porque um default vazou. Custa um
comando e nunca dá falso positivo — mas **cuidado com a armadilha C4**: `ffprobe` reporta duração
do *container*, que pode divergir da duração do *stream*. A asserção é **por stream**, e a diferença
entre eles é ela própria um invariante.

**A camada 2 é a que o playbook não tinha, e ela força a existência do runner.** Um diff de
manifesto resolvido é legível, nomeia o nó que mudou e roda em milissegundos — mas ele só existe se
alguém construir o estágio que *produz* o manifesto resolvido. Essa peça é descrita pelo panorama de
origem e **nenhuma fase antiga a construía**; é a camada 2 que a torna obrigatória.

**A camada 5 é a única que escapa do oráculo circular**, e é por isso que ela existe apesar de cara:

> *O oráculo e a implementação não podem derivar da mesma premissa não verificada.*

Gerar o vídeo a partir do manifesto e conferir o vídeo **contra o mesmo manifesto** é exatamente
isso: as duas cópias erram juntas e o teste diferencial fica cego. As camadas 0 a 4 todas derivam,
direta ou indiretamente, do manifesto. **Só a camada 5 entra por fora**: ela lê o artefato final
como um espectador leria — transcrevendo o áudio — e compara com o roteiro que originou tudo. Se o
manifesto estiver errado de um jeito que o render reproduz fielmente, é a única camada que percebe.

A camada 3 continua sendo aprovada por um humano, mas por outra razão: ela é a que responde *"o
pixel é aceitável"*, e essa pergunta não tem oráculo mecânico — tem gosto.

**O que o oráculo NÃO cobre, declarado e não maquiado:**

- **Se o vídeo presta.** Nenhuma das três camadas tem opinião sobre isso. Elas garantem que
  ninguém mudou o que foi aprovado, e nada além. Por isso `F6-01` existe.
- **Bytes de MP4.** Comparar o container é falso oráculo: o encoder grava versão e data. O gerador
  de gráficos, especificamente, **não é bit-exato por construção** `[R07-21 (2-0)]`. O golden
  master compara **frame extraído**, nunca arquivo — e a ferramenta para isso é o muxer de hash
  por frame do FFmpeg `[R11-20]`.
- **Não-determinismo do navegador.** Fonte não carregada, backend gráfico, *hinting* de fonte no
  Linux — cada um muda o pixel sem mudar o código `[R11-16]` `[R11-18]`. A resposta documentada
  por **dois projetos independentes** é **padronizar o ambiente em container**, não afrouxar o
  limiar `[R11-19 (2-0)]`.
- **A política de congelamento de animação, que ainda não está em card nenhum.** Três fornecedores
  independentes de teste visual congelam a animação antes do screenshot `[R11-03 (3-0)]`, e a
  prática **obriga declarar em qual frame**: o primeiro ou o último. *Se a política e a ferramenta
  discordarem, todo baseline nasce **consistentemente** errado — que é o pior caso, porque passa.*
  Destino: `F0-06` (o harness) e `F0-04` (o token que fixa a política).
- **Áudio.** Diff de forma de onda é frágil. A camada de snapshot usa **envelope por janela** e,
  quando disponível, *fingerprint* — não amostra a amostra `[R11-20]`.
- **A parte que roda fora do render.** Autoria por LLM não é determinística e não tem snapshot:
  ela é cercada por **cache mais validação de schema**, e é isso, e o card diz isso.

> **ADR-0001 reafirmado com o número:** um limiar perceptual afrouxado para "parar de dar falso
> positivo" é o mecanismo pelo qual um oráculo morre. Quando o snapshot ficar instável, a
> correção é **eliminar a fonte de variação**, nunca subir o limiar. O limiar é um token
> (`F0-04`), tem dono, e mudá-lo exige ADR.

### §I-5. Q8 — o que o panorama não menciona nenhuma vez

Cada lacuna abaixo virou card da fase 0 ou da trilha de infra. Esta tabela **é** o backlog
inicial — não é apêndice.

| Lacuna | Por que é grave | Vira |
|---|---|---|
| **Geração da locução** | o panorama transcreve áudio que ele nunca diz de onde vem | `F2-03`, `I-01` |
| **Enquadramento de uso** | citado zero vezes; era o item que podia parar o programa | `I-01` — **fechado**, com gatilho de reabertura |
| **Procedência por asset** | sem isso não há auditoria do que entrou no vídeo publicado | `F0-07`, `F5-06` |
| **Cache endereçado por conteúdo** | sem isso, N agentes multiplicam por N a conta de API | `F0-07` |
| **Teste automatizado do vídeo** | o panorama termina em "avaliação visual cíclica" — isto é, um humano olhando | `F0-06`, `F1-12`, `F5-08` |
| **Determinismo como requisito** | tratado como propriedade acidental do Remotion, não como invariante testado | `F0-06`, ADR-0002 |
| **Revisão humana antes de publicar** | ausente | `F6-01` |
| **Variantes verticais e safe areas** | ausente; e é onde texto some atrás da UI da plataforma | `F5-04`, `F0-04` |
| **Loudness e norma de áudio** | *ducking* é citado, alvo de loudness não; e o motor **não tem normalização embutida** `[R03 §3 · refutação]` | `F5-03`, `F0-04` |
| **Acessibilidade** | limite de flashes por segundo, contraste, tamanho mínimo | `F0-04` como invariante |
| **Custo por vídeo** | ausente | `T-08`, `F4-01` |
| **Observabilidade e retomada** | ausente | `F5-07` |
| **Publicação e política editorial** | ausente | `I-04`, `F6-02` |
| **Dicionário de pronúncia de termos técnicos em pt-BR** | ausente; e é o que separa locução aceitável de constrangedora | `F4-02` |

### §I-6. As refutações que impedem cards errados

Oito afirmações do panorama caíram contra fonte primária. Cada uma teria virado um card, e três
delas teriam virado **arquitetura**.

| O que o panorama afirma | Veredito | O que é de fato | Card que isso salva |
|---|---|---|---|
| `-t` produz WebM com alfa | **parcialmente refutado** | produz `.mov`/`qtrle` salvo com `--format=webm` | `F2-02`, ADR-0008 |
| o `.mov` transparente é ProRes 4444 | **refutado** | é `qtrle` | `F2-02` |
| passe `-c:v prores_ks -pix_fmt yuva444p10le` ao gerador | **refutado** | não são flags dele; o CLI **não expõe codec, pix_fmt nem bitrate** | `F2-02` |
| existe um pacote oficial de exibição de código | **refutado** | retorna 404 no registro; o caminho oficial é um *template* | `F2-05`, `F1-08` |
| o template de código roda offline | **refutado** | busca tipos de CDN em tempo de execução **e** carrega fonte de CDN | `F1-03`, `F2-05` |
| `--buffer-size` complementa o bitrate sob aceleração | **refutado** | é opção **proibida**; derruba o render ou desliga a aceleração em silêncio | `F5-02` |
| `--every-nth-frame` acelera o preview | **refutado** | *"may only be set when rendering GIFs"* | `F5-01` |
| ajustar `--seed` torna o gráfico reproduzível | **parcialmente refutado** | reproduz o RNG, não os bytes | `F0-06`, `F5-08` |

E **duas suspeitas que se provaram infundadas** — registradas porque uma refutação errada custa
tanto quanto uma afirmação errada:

- `pushCut()` **existe** — a partir de uma versão recente, e um pin abaixo dela não a tem
  `[R02 §3 · refutação]`. A suspeita de invenção estava errada; o risco real é **de versão**.
- O pacote de efeitos sonoros **existe** — mas exporta **URLs remotas**, não componentes; para
  pipeline local os arquivos precisam ser baixados `[R03 §3 · refutação]`. A suspeita estava errada;
  o risco real é **de rede em tempo de render**.

> **Padrão que se repete e vale como regra:** em quase todos os casos, o erro do panorama não foi
> inventar a coisa — foi **perder a condição de escopo**. "Existe" era verdade; "existe nesta
> versão", "existe offline", "existe neste renderer" não era. *Uma regra que perde sua condição
> de validade vira uma regra que está errada em todo o resto.*

### §I-7. O reuso do projeto de origem — absorver, medido por call-site

O projeto `/home/ondokai/Projects/3blue1brown` economiza tempo real. A decisão de **absorver ×
integrar** é congelada na raiz da árvore (`F0-05`, ADR-0004) e é **hereditária** — se chegar
tarde, metade dos cards já terá desenhado contra a premissa antiga.

**A regra que decide:** a escolha não se faz contando linhas do provedor. Faz-se contando
**call-sites** — a superfície consumida costuma ser uma ordem de grandeza menor que a publicada,
e é ela que paga a conta.

| O que existe lá | Destino | Por quê |
|---|---|---|
| Infraestrutura de skill: linter, evals, *staleness* | **absorver com ajuste** | o formato e as regras transferem; as lacunas medidas, não. `T-10` |
| Gate de escrita de skill e guardrail de shell | **reescrever contra as lacunas medidas** | o panorama **proíbe copiar os dois**: o guardrail deixa passar `rm -rf /`, `rm -rf ~` e `sudo rm -rf /` por causa de um `\b` no fim do regex `[L02-C11 (2-0)]`; e o "token" do gate é um JSON versionado no git, editável à mão, **sem TTL**, que **libera escrita quando executado de outro cwd** `[L02-C04 (3-0)]` `[L02-C05 (2-0)]`. `T-05` |
| Quirks do executor de gráficos (patch de compatibilidade, resolução de LaTeX, detecção de GPU com fallback, descoberta do arquivo de saída) | **absorver com citação `arquivo:linha` da origem** | é conhecimento não-inferível que custou tempo lá. `F2-02` |
| Sanitizações de código gerado | **absorver o padrão, não a lista** | a lista é da versão de lá; o padrão (sanitizar entre extração e validação) é o que transfere |
| O padrão de *retries* com simplificação progressiva | **absorver o padrão** | `F4-03` |
| Serviço HTTP, acoplamento com provedor de LLM, camada de API | **ignorar** | o pipeline daqui é local e determinístico; um serviço no meio reintroduz rede onde a arquitetura a tirou |
| A descoberta do arquivo de saída pelo *mais recente* | **absorver e consertar** | é frágil e quebra com render concorrente no mesmo diretório de mídia — e este programa **vai** renderizar concorrente. Registrado no handoff de `F2-02` |

**E a restrição que não se negocia:** absorver é **copiar para dentro**. O projeto de origem
continua existindo, evoluindo e sendo dele. Nada neste programa escreve lá.

### §I-8. Critério de parada da análise

A análise terminou. Os seis critérios, conferidos:

- [x] **Nomeio as dependências irredutíveis** (duas, ambas jurídicas) e o que cada dependência
      pode nos tirar — §I-3.
- [x] **Toda afirmação factual tem origem citada**; o que não tem está marcado, e o tier
      "não verificado" está declarado em `docs/00-panorama-verificado.md §8`.
- [x] **Toda dependência externa tem destino declarado** — absorver, integrar ou ignorar — §I-7.
- [x] **Cada lacuna tem o card que a fecha** — §I-5.
- [x] **O grafo fecha sem ciclo** e o caminho crítico é desenhável — §III-10.
- [x] **O card raiz existe sem citar nenhuma tecnologia de destino além do runtime** — `F0-01`,
      e a restrição está escrita dentro dele.

O último é o mais discriminante, e é o que separa esta parte do panorama que a precedeu.
`Roadmap Editor de Vídeo IA.md` **não conseguiria** escrever seu card raiz sem nomear quatro
produtos — porque ele tratou Q10 (qual stack) como se fosse pré-requisito de particionar o
trabalho. Não é. As quatro escolhas de tecnologia dele sobreviveram à verificação; **as
afirmações sobre como usá-las, em boa parte, não** (§I-6). Essa assimetria é exatamente a que o
método previa: *o inventário e o blast radius sobrevivem; as recomendações de tecnologia caem.*

---

## Parte II — A arquitetura em uma página

Esta é a única página que o card raiz precisa. Tudo o que vem depois é elaboração dela.

### A tese

> **O vídeo é uma função pura de um manifesto resolvido mais um conjunto de assets endereçados
> por conteúdo.** Tudo que não é puro é empurrado para *fora* do render, para um estágio de
> resolução que cacheia por hash da entrada.

Essa frase não é estética. Ela é o que permite que o programa seja verificável: uma função pura
tem golden master; um pipeline com rede no meio, não.

### Os cinco estágios e a fronteira que organiza o programa

```
   brief / tema
        │
        ▼
┌─────────────────┐
│  1. AUTORIA     │  LLM → manifesto.json          NÃO determinístico
│                 │  validado contra JSON Schema    cacheado por hash(brief+prompt+modelo)
└────────┬────────┘
         │  manifesto.json  ── contrato de dados nº 1
         ▼
┌─────────────────┐
│  2. RESOLUÇÃO   │  cada sub-estágio é impuro e independente dos outros:
│                 │    locução (TTS)      → audio/<hash>.wav + timing.json
│                 │    gráficos (Manim)   → assets/<hash>.<ext>
│                 │    mídia externa      → assets/<hash>.<ext> + procedencia.json
│                 │    código (highlight) → tokens/<hash>.json
│                 │    música             → audio/<hash>.wav + licenca.json
└────────┬────────┘
         │  manifesto-resolvido.json  ── contrato de dados nº 2
         │  ╔══════════════════════════════════════════════════════════╗
         │  ║  A FRONTEIRA.  Acima: nada é determinístico, tudo é      ║
         │  ║  cacheado. Abaixo: tudo é determinístico, e o            ║
         │  ║  determinismo é TESTADO. Nenhuma URL, nenhum tempo       ║
         │  ║  relativo, nenhuma decisão pendente atravessa esta linha.║
         │  ╚══════════════════════════════════════════════════════════╝
         ▼
┌─────────────────┐
│  3. COMPOSIÇÃO  │  Remotion; função pura de (manifesto-resolvido, assets)
│                 │  nenhum acesso a rede, nenhum relógio, nenhum aleatório não semeado
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. RENDER      │  frames → encode. Paralelizável por faixa de frames.
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. PÓS/ENTREGA │  loudness, variantes (16:9 / 9:16), legenda sidecar, thumbnail, manifesto
│                 │  de procedência (o que veio de onde, sob qual licença)
└─────────────────┘
```

### Por que a fronteira é o eixo do programa inteiro

Três consequências, e todas as três viram regra de card:

1. **O oráculo mora na fronteira.** O golden master deste projeto não é "o MP4". É o par
   *(manifesto-resolvido, frames-chave)*. O manifesto resolvido diffa como JSON — barato,
   legível, e nomeia exatamente o que mudou. Os frames-chave diffam como imagem — caro, mas só
   nos pontos que importam. Comparar MP4 byte a byte é o falso oráculo clássico: o encoder muda
   e tudo fica vermelho sem nenhuma regressão real.

2. **A fase de risco é a resolução, não o render.** Todo estágio de resolução tem rede, tem
   licença, tem custo por chamada e tem não-determinismo. Todo estágio abaixo da fronteira é
   uma função. Por isso a ordem das fases (§III-1) é: **primeiro a fronteira e o que está abaixo
   dela, depois o que está acima**. É o inverso do que a intuição sugere e é o que torna o
   programa testável cedo.

3. **O paralelismo máximo vive na resolução.** Os cinco sub-estágios de resolução não se
   conhecem. Eles compartilham exatamente um artefato — o *store* de conteúdo — e esse artefato
   é append-only por hash, o que significa que **N agentes podem escrever nele simultaneamente
   sem conflito**, desde que nenhum dois calculem o mesmo hash com conteúdo diferente. Essa é a
   onda mais larga do programa.

### Os singletons — o teto real de paralelismo

O teto não é o modelo nem a CPU. É o número de **recursos que só admitem um escritor**. Enumerados
antes de qualquer onda ser dimensionada; cada um vira **dono exclusivo** ou **sequência**:

| # | Singleton | Tratamento |
|---|---|---|
| S-1 | `package.json` + lockfile Node | dono exclusivo por onda; nunca dois cards adicionam dependência na mesma onda |
| S-2 | `pyproject.toml` + lock Python | idem |
| S-3 | `src/Root.tsx` (registro de composições do Remotion) | **stub commitado no PREP**, um bloco por card, só acrescente |
| S-4 | `schema/manifesto.schema.json` | dono único durante toda a fase 0; depois, só por ADR |
| S-5 | `src/design/tokens.ts` (+ o espelho Python) | dono único; alteração exige recaptura de snapshot |
| S-6 | definição do CI | dono exclusivo; **quem muda o gate mergeia por último** |
| S-7 | `ledger/aberto.json` | **nunca escrito por card**; cada card escreve `ledger/inbox/<CARD>.json`, faixa de id pré-alocada |
| S-8 | o diretório do store (`.cache/store/`) | append-only por hash; escrita atômica (tmp + rename) |
| S-9 | portas TCP (Studio, preview) | faixa de porta por card, declarada no PREP da onda |
| S-10 | GPU / sessões de encode simultâneas | fila explícita; o gate declara quantas sessões o hardware admite |
| S-11 | `PROGRAMA.md` (a árvore de cards) | escrito **só** por quem orquestra, em branch `PREP-*` |
| S-12 | `.agents/skills/catalog.md` | idem — é derivado dos SKILL.md, e derivado se **gera**, não se redigita |

> **Regra.** Um recurso que não aparece nesta tabela e que dois cards da mesma onda tocam é um
> incidente esperando o merge. Antes de abrir uma onda, releia a tabela e some os singletons
> tocados por ela. **Se o número for maior que zero e não houver dono declarado, a onda não abre.**

### Pontos de troca barata

Toda escolha abaixo é uma que se **espera** reverter. Cada uma ganha uma costura fina, e o custo
da reversão está escrito em unidade contável. *Se você não consegue escrever o custo em unidade
contável, o ponto não é barato* — e a linha diz isso.

| Ponto | Escolha default | Custo da reversão | Acoplamento residual que a costura **não** isola |
|---|---|---|---|
| Motor de composição | Remotion | reescrever os componentes de nó; o manifesto e o store não mudam | o modelo *frame-based* está no manifesto; um motor time-based exige conversão |
| Motor de gráficos | Manim (headless, via arquivo) | trocar um executor; o contrato é "código → arquivo com alfa" | o formato de alfa escolhido amarra o que a composição consegue reproduzir |
| Provedor de locução | *(decidido no panorama verificado)* | trocar um cliente + recachear; hash muda, snapshots recapturam | se o provedor fornece *timing* e o substituto não, o estágio de alinhamento volta ao pipeline |
| Provedor de mídia externa | *(idem)* | trocar um cliente; a procedência já é por asset | licença: assets já baixados sob termos antigos não migram |
| Encoder final | FFmpeg software | uma flag | encoder de hardware não aceita CRF — o controle de qualidade muda de eixo |
| Formato do manifesto | JSON Schema próprio | um conversor de/para | os ids de nó vazam para snapshots e para o ledger |
| Runner de tarefas | script + gate local | reescrever o gate; o CI lê a mesma definição | nada, se a fonte de definição continuar única |

E o **acoplamento residual** que nenhuma costura isola, declarado uma vez para não ser
reorçado a cada onda: **o modelo temporal**. Frame, fps e a decisão de guardar tempo em frames
ou em milissegundos atravessam manifesto, snapshot, legenda, áudio e teste. Trocar isso não é um
ponto de troca barata — é um programa novo.

---

## Parte III — A árvore de tarefas

### §III-1. As fases — o eixo é a fronteira, não a camada

O eixo **não** é dados/serviço/UI. É **distância da fronteira de determinismo**, do centro para
fora, porque é isso que determina se um pedaço de trabalho pode ser provado quando é escrito.

```
F0  Fundação e oráculo        ← o vocabulário, os contratos, e a máquina de reprovar
F1  Composição determinística ← abaixo da fronteira: função pura, snapshot desde o dia 1
F2  Resolução (impura)        ← acima da fronteira: cada sub-estágio isolado atrás de cache
F3  Sincronia                 ← o que amarra áudio e imagem; o núcleo de precisão
F4  Autoria                   ← o LLM; a única parte que não se prova, só se cerca
F5  Render, encode e entrega
F6  Operação e publicação     ★ construído e NÃO disparado
```

Mais **duas trilhas obrigatórias fora das fases**:

- **Trilha transversal `T`** — esqueleto, gate local, CI, hooks, ferramenta de worktree,
  infraestrutura de skills. *Não é feature.* Corre **em paralelo à F0** para não serializar
  atrás dela. Sem isso a F0 vira gargalo de uma onda inteira.
- **Trilha de infra `I`** — o que exige um humano, uma credencial, um cartão de crédito ou uma
  máquina fora do alcance do agente: licenciamento, contas de API, hardware de render, canal de
  publicação. **Não tem worktree**, roda direto no branch de integração, e ocupa **ondas
  fracionárias** (`W0.5`, `W2.5`, `W7.5`, `W9.5`) para encaixar entre ondas existentes **sem
  renumerar nada**.

> **Por que a trilha de infra tem onda fracionária e não onda própria:** porque ela não bloqueia
> a largura das ondas vizinhas. Um card de infra que virasse `W3` empurraria dez cards para `W4`
> por uma decisão que leva cinco minutos de um humano. A meia-onda é o mecanismo que impede uma
> assinatura de custar uma onda.

### §III-2. A lei das ondas

```
nivel(c) = 0 se c não tem dependência
nivel(c) = 1 + max(nivel(d)) para toda dependência d
onda(c) >= nivel(c)          ← invariante DURA, verificada por script
```

**A onda é uma decisão de escalonamento; o nível é uma restrição.** A onda nunca é menor que o
nível; pode ser maior, e quando é, a folga é **impressa pelo validador**, nunca descoberta.

> **Regra.** Se você não consegue derivar as ondas por script a partir do grafo, ou o grafo está
> errado ou as ondas estão. O validador de grafo (`T-02`) é escrito **no primeiro dia** — não é
> ferramenta de conforto, é o que impede uma aresta de sumir em silêncio quando o programa muda
> de ideia.

### §III-3. Como uma onda abre e fecha

Sete passos. Nenhum é opcional, e cada um previne uma falha nomeada:

1. **Commit `PREP-w<N>`** — antes de qualquer worktree existir. Traz, no mesmo commit:
   os stubs dos pontos de composição da onda, o contrato da onda (tabela `arquivo → dono`), as
   faixas de id do ledger, as faixas de porta TCP, e **qualquer mudança de ferramenta** que a
   onda exija. *Prep é commit próprio, com nome próprio, fora de qualquer card — para poder ser
   revisado, revertido e citado.*
2. **Preflight por worktree** — o script de criação termina provando acesso ao insumo crítico
   com um **valor conhecido**, não com "criei a pasta".
3. **Lançamento** — N agentes, um por card, cada um na sua worktree.
4. **Barreira** — contador **monotônico por onda**, escrito pelo próprio agente ao terminar,
   nunca relógio e nunca leitura de tela. A barreira tem de valer para quem terminou *antes* de
   você começar a esperar.
5. **Teardown da onda**, a partir do repositório principal, e são **três** comandos, não um:
   `git worktree remove` **+ `git branch -D` + `git worktree prune`**. O `remove` sozinho **não
   apaga o branch** — sem os outros dois, cada onda deixa N branches órfãos, para sempre.
   E a regra "remova de fora" tem o motivo trocado no folclore: `git worktree remove` de dentro da
   própria worktree **retorna 0** `[R15-04·R15-07 (2-0)]`; **quem quebra é o shell**, que fica com
   um `cwd` inexistente. Não é recusa do git.
6. **Merges um a um, na ordem declarada.** Nunca octopus — um octopus aborta inteiro no primeiro
   conflito e você perde a atribuição. Ordem padrão: **infra e ferramenta primeiro; quem muda o
   gate, por último.**
7. **Gate completo após CADA merge.** Nunca ao fim da onda. *A bissecção é o produto, não a
   limpeza:* com um merge dentro, um gate vermelho nomeia o card; com quatro, não nomeia nada.

### §III-4. Ondas de composição — o tipo perigoso

**Definição operacional:** onda em que N cards trabalham sobre **o mesmo artefato entregue por um
card anterior**, em vez de N fatias independentes.

**Detecção mecânica:** um card com out-degree alto cujos consumidores estão *todos* na mesma onda
seguinte. Convergência de dependentes num nível = onda de composição. O validador de grafo
**imprime** essa detecção; ela não depende de alguém notar.

Neste programa, as ondas de composição previstas são as que consomem:
`F0-02` (o schema do manifesto), `F1-01` (a composição base) e `F2-01` (o store).

Quatro dispositivos que uma onda de composição exige e uma onda normal não:

1. **Mapa de propriedade por arquivo**, com a coluna literal "os outros: não editam".
2. **Contratos congelados por escrito** — nome de campo, nome de flag, quem registra o quê.
3. **Faixas de id disjuntas** para ledger, para porta TCP e para qualquer inventário sequencial.
4. **Onda em dois tempos** quando a propriedade colide: roda 2 cards, mergeia, e só então o
   terceiro.

> **A frase que explica por que isso é obrigatório:** cards da mesma onda nascem em worktrees
> isoladas a partir da mesma base, então **o git não tem em que conflitar e mergeia em silêncio
> código que discorda**. O merge limpo prova ausência de conflito *de texto*, e nada mais.

**Os três tipos de discordância silenciosa esperados neste projeto**, com o gate que os pega:

| Discordância | Como acontece | O que a pega |
|---|---|---|
| Dois cards declaram o mesmo token de design com valores diferentes, em arquivos diferentes | ambos "corretos" contra a própria base | teste que **varre o disco** procurando literal fora do arquivo de tokens |
| Um card muda a chave de cache; o snapshot de outro card recaptura sozinho no próximo run | o hash muda, o arquivo aprovado não | o snapshot aprovado é **imutável**; execução divergente escreve em `*.received/` e falha |
| Dois cards registram composição com o mesmo id em `Root.tsx` | stub com blocos separados, merge limpo | teste que lista os ids registrados e exige unicidade |

### §III-5. O que é proibido entre irmãos da mesma onda

O playbook registra isso como um dos cinco erros do programa de origem, e ele custou 95 testes
fora do CI em silêncio: **irmãos da mesma onda são cegos entre si por construção**. Um card pediu,
no próprio handoff, algo que o irmão precisaria fazer — e o irmão não era descendente, então
nunca leu.

Aqui a regra é explícita e é verificada:

> **Dependência lateral é proibida.** Um card não pode depender de nada que outro card da
> **mesma onda** produza. Se ele depende, os dois não estão na mesma onda — o grafo está errado.
> O validador de grafo recusa uma aresta cujos dois extremos declaram a mesma onda.
>
> E o handoff carrega **campo `destinatarios:` obrigatório**, com ids de card nomeados. Handoff
> sem destinatário nomeado não é achado, é anotação — e o gate rejeita.

### §III-6. Granularidade — o que faz um pedaço virar um card

> **Um card é o maior pedaço de trabalho que ainda tem (a) um conjunto de arquivos escritos
> disjunto dos irmãos da mesma onda e (b) um comando que sai `exit 0` — e cujo `exit 0` seria
> `exit 1` se o trabalho não fosse feito.**

A segunda metade da condição (b) é o acréscimo deste programa em relação ao playbook, e ela vem
do erro nº 5 de lá: o critério mais comum da árvore de origem passava vazio. Aqui, um card cujo
critério não sabe reprovar **não é um card**; é uma intenção.

Divide-se por **contrato** e por **consumidor**, nunca por volume:

- por contrato: dois pedaços que escrevem no mesmo arquivo são um card, mesmo que sejam trabalhos
  diferentes; dois pedaços que escrevem em arquivos disjuntos são dois cards, mesmo que sejam o
  mesmo trabalho;
- por consumidor: um trabalho grande se corta quando cada pedaço **desbloqueia uma fase
  diferente** — o corte encurta o caminho crítico e essa é a única razão legítima de cortar algo
  que caberia junto.

Junta-se quando o padrão e o dono são os mesmos.

**Faixa alvo:** 60–180 linhas de card. Um card de 20 linhas está subespecificado — a sessão é
amnésica e ele vai improvisar. Um card de 400 linhas está fazendo o trabalho de três.

### §III-7. O que `<restricoes>` proíbe neste projeto

`<restricoes>` é onde mora o **conhecimento negativo** — o que um profissional competente faria
por bom senso e que aqui é errado. Duas famílias, e a segunda só existe porque há paralelismo.

**Família 1 — fidelidade e determinismo** (o que parece melhoria e destrói o oráculo):

1. **Proibido "melhorar" a saída sem recapturar o snapshot.** Ajustar um espaçamento, trocar uma
   cor "que ficou melhor", arredondar um valor — cada um desses invalida um golden master. Ou
   você recaptura e declara no handoff, ou não toca.
2. **Proibido introduzir não-determinismo.** Nada de `Date.now()`, `Math.random()`, `setTimeout`,
   `requestAnimationFrame`, animação CSS, fonte de CDN, imagem de URL remota, ou qualquer leitura
   de estado do ambiente dentro da composição. Cada um desses tem uma API determinística
   equivalente, e a skill do domínio nomeia qual.
3. **Proibido repetir um literal de domínio.** Todo valor que o domínio define — duração
   canônica, cor, LUFS alvo, limite de caracteres por segundo — vive num **único tipo nomeado**.
   Proibido repetir o literal em regra, em template, em query ou em teste. Motivo: quando o valor
   mudar, a correção tem de ser uma linha em um arquivo.
4. **Proibido remover ou renomear id de contrato.** Ids de nó, ids de composição, ids de elemento
   usados por snapshot: classes e atributos novos entram **ao lado**. Motivo mecânico: aprovar um
   snapshot é copiar um arquivo, e copiar absorve a perda em silêncio.

**Família 2 — propriedade** (existe só porque há N agentes agora):

5. **Fronteira de propriedade de arquivo, nomeando o card dono.** Nunca "não edite outros
   arquivos": sempre *"`caminho/X` pertence ao `F2-03`, que roda em PARALELO — entregue só o seu
   arquivo"*. Um agente obedece a uma proibição com nome; ignora uma proibição genérica.
6. **Nunca `git add -A`.** O repositório tem cache de assets, frames intermediários e worktrees
   irmãs no disco. Um `add -A` distraído commita gigabytes ou, pior, uma credencial.
7. **Nenhum segredo em arquivo versionado**, nenhuma chave real copiada para fixture, nenhuma
   credencial em manifesto. Verificado por hook, não por convenção.
8. **Proibido reintroduzir o que foi removido por decisão**, citando o invariante que quebra.

### §III-8. Qual representação vence

O grafo deste programa existe em **três** lugares: o campo `deps` de cada card (§III-14), a
tabela de ondas (§III-10) e o caminho crítico publicado. Duas dessas três são **derivadas**.

| Representação | Papel | Quem escreve |
|---|---|---|
| `deps` no card | **fonte de verdade** | quem orquestra, em `PREP` |
| Tabela de ondas §III-10 | derivada | `T-02`, por geração |
| Caminho crítico e fan-out | derivado | `T-02`, por recálculo |

> **Regra, e ela não é negociável:** se a tabela e os `deps` divergirem, **o validador falha e a
> tabela é a que está errada** — porque ela é a representação derivada. Corrigir a tabela à mão
> para "fazer o gate passar" é o mecanismo exato pelo qual, no programa de origem, quatro arestas
> existiam no atributo e nunca entraram no diagrama, e as duas representações divergiram em
> silêncio por semanas.
>
> Este documento **já cometeu esse erro uma vez** e o registrou em §III-10: um caminho crítico e
> três números de fan-out foram redigitados de cabeça e estavam errados. A correção está lá, com
> a consequência operacional que ela mudou.

---

### §III-9. A decisão de arquitetura que compra o paralelismo

Antes da tabela de ondas, uma decisão que não é técnica — é **de escalonamento** — e que sozinha
transforma a onda mais larga do programa de 3 cards em 13:

> **Descoberta por convenção, nunca registro central.** Nem os componentes de nó, nem os
> estágios de resolução, nem os perfis de encode têm um arquivo de registro. Cada um é descoberto
> pelo caminho e pelo nome: `src/composicao/nos/<Nome>.tsx` exporta um contrato conhecido, e o
> compositor varre o diretório.

O motivo não é elegância. Um registro central é um **singleton**: treze cards que precisam
adicionar uma linha ao mesmo arquivo ou (a) serializam, ou (b) recebem um stub com treze blocos
pré-abertos no `PREP` — que funciona, mas custa manutenção a cada onda. A descoberta por
convenção **elimina o singleton**, e o custo é um teste: *varrer o disco e exigir que todo
arquivo do diretório case o contrato e que todo id seja único.*

E esse teste é melhor que o registro que ele substitui, porque **anda no disco em vez de confiar
numa lista memorizada** — exatamente a classe de teste que pega o que humano nenhum lembraria.

> **Custo da reversão:** voltar a registro central custa um arquivo e uma linha por nó.
> É um ponto de troca barata, e está na tabela da Parte II.

### §III-10. Tabela de ondas

> ⚠️ **Esta tabela é DERIVADA.** Ela é gerada por `T-02` a partir do atributo `data-deps` dos
> cards. Se a tabela e os atributos divergirem, **a tabela é a que está errada** e o gate falha.
> Nunca edite esta tabela à mão — edite o card e regenere.

| Onda | Nível máx | Cards | n | Tipo | Por que esta largura |
|---|---|---|---|---|---|
| **W0** | 0 | `F0-01` `T-01` | 2 | **raiz** | entrega vocabulário e esqueleto, não funcionalidade. Todo o resto herda daqui |
| **W0.5** | — | `I-01` | 1 | **infra** | ✅ **respondido: uso pessoal**. Sem worktree, no branch de integração. Não bloqueia mais |
| **W1** | 1 | `F0-02` `F0-03` `F0-04` `F0-05` `T-02` `T-03` `T-04` `T-10` | 8 | fan-out da raiz | os quatro contratos + as quatro ferramentas. Nenhum se conhece |
| **W2** | 2 | `F0-06` `F0-07` `F0-08` `F0-09` `T-05` `T-06` `T-07` `T-08` | 8 | **fundação compartilhada** | o oráculo, o store, os invariantes, a fixture. A W3 nasce estreita e a W4 nasce enorme por causa desta |
| **W2.5** | — | `I-02` | 1 | **infra** | contas e chaves; bloqueia os estágios de resolução |
| **W3** | 3 | `F1-01` `F1-02` `F1-03` `F2-01` `T-09` | 5 | **hubs** | quatro hubs de out-degree ≥ 5. Onda estreita **de propósito** |
| **W4** | 4 | `F1-04`…`F1-11` `F2-02`…`F2-06` | **13** | **a mais larga** | o fan-out dos hubs. Zero singletons tocados — é o que §III-9 comprou |
| **W5** | 5 | `F1-12` `F2-07` `F3-01` `F4-01` `F4-02` | 5 | **composição** ★ | dois joins convergem (`F1-12` in-degree 9, `F2-07` in-degree 5); `F4-02` é preenchedor de folga |
| **W6** | 5 | `F3-02` `F3-03` `F3-04` `F4-03` `F4-04` | 5 | **composição** ★ | todos consomem `F3-01`/`F4-01`. Protocolo de onda de composição obrigatório |
| **W6.5** | — | `I-03` | 1 | **infra** | máquina de render; mede o teto real antes da fase 5 |
| **W7** | 6 | `F3-05` `F5-01` `F5-02` `F5-04` `F5-05` `F5-06` | 6 | fan-out | entrega e variantes; independentes entre si |
| **W8** | 7 | `F5-03` `F5-09` | 2 | **pescoço** | o mix final é singleton por natureza; não se alarga. Está no caminho crítico |
| **W9** | 8 | `F5-07` | 1 | **join** | in-degree 7. É o ponto de integração de verdade |
| **W9.5** | — | `I-04` | 1 | **infra** | canal e política editorial |
| **W10** | 9 | `F5-08` `F6-01` | 2 | — | o golden master de ponta a ponta e o checklist humano |
| **W11** | 10 | `F6-02` `F6-03` `F6-04` | 3 | fan-out | os três runbooks/gates, independentes |
| **W12** | 11 | `F6-05` | 1 | **fim de linha** | arquivamento e escopo negativo |

**Totais:** 61 cards de sequência principal + 4 de infra = **65**. **Profundidade do grafo = 11.**
Onda mais larga = **13**. Ondas com trabalho = 13 (W0–W12) mais 4 meias-ondas de infra.

**Caminho crítico** — o mais longo, **recalculado**, não redigitado:

```
F0-01 → F0-02 → F2-01 → F2-03 → F3-01 → F3-03 → F3-05 → F5-03 → F5-07 → F6-01 → F6-02 → F6-05
        contrato  contrato  locução  timing  ducking   mix    loudness  join   revisão runbook arquivo
```

> **Nota de método, e ela é o exemplo mais concreto deste documento.** Uma versão anterior desta
> seção publicava um caminho crítico **diferente** — passando por `F0-09 → F1-01 → F1-05 → F1-12`
> — e três números de fan-out errados. Os dois foram redigitados de cabeça a partir da intuição
> de qual seria o eixo mais longo. Ao rodar a checagem 9 do validador (§15 do playbook), o
> caminho real apareceu: **o eixo longo deste programa é o áudio, não a imagem.** A cadeia
> `locução → timing → ducking → mix → loudness` é estritamente sequencial e tem cinco níveis;
> a de imagem tem quatro e converge antes.
>
> Isso muda uma decisão operacional: **se sobrar capacidade numa onda, ela vai para a cadeia de
> áudio**, não para engrossar a onda de nós de composição — que é larga, vistosa e não está no
> caminho crítico. Era exatamente a decisão errada que a versão anterior induzia.
>
> É por isso que §IV-6 existe: *todo número que aparece em prosa e existe numa fonte estruturada
> é gerado ou conferido, nunca redigitado.* Este documento cometeu o erro que descreve, e o
> mecanismo que ele mesmo especifica é que o pegou.

**Fan-out** (recalculado — adiantar um hub encurta o programa inteiro):

| Card | out-degree | Adiantá-lo desbloqueia |
|---|---|---|
| `T-01` | **13** | tudo que compila; é o esqueleto |
| `F0-07` (store) | **10** | os cinco estágios de resolução + procedência + cache de render |
| `F0-04` (tokens) | **10** | tudo que produz pixel ou som |
| `F0-01` (vocabulário) | **9** | tudo |
| `F1-01` `F1-02` `F1-03` | **8** cada | os oito nós de composição |

**In-degree** (os pontos de integração de verdade):
`F1-12` = **9** · `F5-07` = **7** · `F2-07` = **5** · `F1-07` / `F1-09` = 4.

**Folga declarada** (checagem 3b do validador — folga é legítima, mas tem de ser **vista**, não
descoberta):

A partir da W2, quase todo card carrega **folga 1**. Isso não é acidente e não é desperdício:
`F0-07` (o store) tem nível topológico 1 e está escalonado na W2 **de propósito**, junto de
`F0-06` (o harness de determinismo). Os dois são a fundação de tudo que fica abaixo da fronteira,
e mantê-los na mesma onda significa **um `PREP`, um gate, uma ordem de merge** — e a onda
seguinte herda os dois prontos. Separá-los faria o store aterrissar sozinho na W1 sem nada capaz
de prová-lo.

Três cards carregam folga maior, e cada um tem motivo próprio:

| Card | nível | onda | folga | Por quê |
|---|---|---|---|---|
| `F4-02` | 2 | W5 | **3** | **preenchedor de paralelismo**: só é consumido três níveis depois, e foi puxado para a W5 justamente para engrossar uma onda magra |
| `F5-02` | 4 | W7 | **3** | depende de `I-03` (meia-onda), que mede o teto de hardware. Perfil de encode escolhido antes da medição é chute |
| `F5-06` | 4 | W7 | **3** | procedência só faz sentido depois que existe entregável; adiantá-la produziria um relatório sobre nada |

### §III-11. Mapa `arquivo → dono` — as ondas que exigem contrato

Publicado no commit `PREP-w<N>`, antes de qualquer worktree existir. A **terceira coluna é o que
dá contratualidade** — sem ela é uma sugestão.

#### W4 — a onda de 13 (a mais crítica do programa)

| Arquivo / diretório | Dono | Os outros |
|---|---|---|
| `src/composicao/nos/Cabecalho.tsx` + `fixtures/snapshots/no-cabecalho/**` | **F1-04** | não editam |
| `src/composicao/nos/TextoDestaque.tsx` + `fixtures/snapshots/no-texto/**` | **F1-05** | não editam |
| `src/composicao/nos/Lista.tsx` + `fixtures/snapshots/no-lista/**` | **F1-06** | não editam |
| `src/composicao/nos/Midia.tsx` + `fixtures/snapshots/no-midia/**` | **F1-07** | não editam |
| `src/composicao/nos/Codigo.tsx` + `fixtures/snapshots/no-codigo/**` | **F1-08** | não editam |
| `src/composicao/nos/Grafico.tsx` + `fixtures/snapshots/no-grafico/**` | **F1-09** | não editam |
| `src/composicao/transicoes/**` + `fixtures/snapshots/transicoes/**` | **F1-10** | não editam |
| `src/composicao/camadas/**` + `fixtures/snapshots/camadas/**` | **F1-11** | não editam |
| `src/resolucao/grafico/**` + `fixtures/cassetes/grafico/**` | **F2-02** | não editam |
| `src/resolucao/locucao/**` + `fixtures/cassetes/locucao/**` | **F2-03** | não editam |
| `src/resolucao/midia/**` + `fixtures/cassetes/midia/**` | **F2-04** | não editam |
| `src/resolucao/codigo/**` + `fixtures/cassetes/codigo/**` | **F2-05** | não editam |
| `src/resolucao/musica/**` + `fixtures/cassetes/musica/**` | **F2-06** | não editam |

**Compartilhados nesta onda — só acrescente:**
`docs/adr/` (um arquivo novo por card, nunca edite o de outro) ·
`ledger/inbox/<CARD>.json` (um por card, por construção).

**Nada mais é compartilhado nesta onda.** Se um card precisar tocar `src/design/tokens.ts`,
`schema/manifesto.schema.json` ou `package.json`, **ele para e escreve no handoff** — a mudança
vira um `PREP` da onda seguinte, feito por quem orquestra. Motivo: esses três são singletons
(S-1, S-4, S-5) e treze agentes cegos entre si não negociam em tempo real.

**Ordem de merge da W4:** os cinco de resolução primeiro (`F2-02`…`F2-06`), depois os oito de
composição. Motivo: os de resolução gravam cassetes que os testes de composição podem consumir;
mergeá-los antes faz um eventual gate vermelho nomear o card certo.

#### W5 e W6 — ondas de composição

| Arquivo / diretório | Dono | Os outros |
|---|---|---|
| `tests/integracao/composicao/**` | **F1-12** (W5) | não editam |
| `tests/integracao/resolucao/**` + `tools/offline-guard.*` | **F2-07** (W5) | não editam |
| `src/sincronia/timing/**` + `schema/timing.schema.json` | **F3-01** (W5) | não editam |
| `src/autoria/contrato/**` | **F4-01** (W5) | não editam |
| `docs/autoria/prompts/**` | **F4-02** (W5) | não editam |
| `src/sincronia/legendas/**` | **F3-02** (W6) | não editam |
| `src/sincronia/ducking/**` | **F3-03** (W6) | não editam |
| `src/sincronia/ritmo/**` | **F3-04** (W6) | não editam |
| `src/autoria/reparo/**` | **F4-03** (W6) | não editam |
| `fixtures/cassetes/autoria/**` + `tests/autoria/**` | **F4-04** (W6) | não editam |

**Contratos congelados antes da W6** (escritos no `PREP-w6`, não negociados em tempo real):
o formato de `timing.json` (campos, unidade de tempo, semântica de silêncio) · o nome e a
semântica do envelope de ducking · o contrato de erro de `F4-03` (o que é reparável e o que é
rejeição definitiva).

### §III-12. Faixas de id do ledger

Pré-alocadas no `PREP` de cada onda. **Ids nunca são reciclados** — o número é citado no código.
Um card que esgotar a faixa **para e pede uma faixa nova**; ele não invade a do vizinho.

| Onda | Faixas |
|---|---|
| W0 | `F0-01`: AB-001..019 · `T-01`: AB-020..029 |
| W1 | `F0-02`: 030..049 · `F0-03`: 050..059 · `F0-04`: 060..079 · `F0-05`: 080..099 · `T-02`: 100..109 · `T-03`: 110..119 · `T-04`: 120..129 · `T-10`: 130..139 |
| W2 | `F0-06`: 140..159 · `F0-07`: 160..179 · `F0-08`: 180..189 · `F0-09`: 190..209 · `T-05`: 210..219 · `T-06`: 220..229 · `T-07`: 230..234 · `T-08`: 235..239 |
| W3 | `F1-01`: 240..259 · `F1-02`: 260..269 · `F1-03`: 270..279 · `F2-01`: 280..299 · `T-09`: 300..309 |
| W4 | `F1-04`..`F1-11`: 310..389 (10 por card) · `F2-02`..`F2-06`: 390..489 (20 por card) |
| W5 | `F1-12`: 490..499 · `F2-07`: 500..519 · `F3-01`: 520..549 · `F4-01`: 550..569 · `F4-02`: 570..579 |
| W6 | `F3-02`: 580..599 · `F3-03`: 600..614 · `F3-04`: 615..629 · `F4-03`: 630..649 · `F4-04`: 650..659 |
| W7 | `F3-05`: 660..679 · `F5-01`: 680..699 · `F5-02`: 700..719 · `F5-04`: 720..734 · `F5-05`: 735..744 · `F5-06`: 745..769 |
| W8+ | `F5-03`: 770..789 · `F5-09`: 790..799 · `F5-07`: 800..829 · `F5-08`: 830..849 · `F6-01`..`F6-05`: 850..949 |
| infra | `I-01`: 950..969 · `I-02`: 970..979 · `I-03`: 980..989 · `I-04`: 990..999 |

As faixas de resolução (`F2-02`…`F2-06`) são as maiores de propósito: são os estágios que tocam
API externa, licença e formato de arquivo, e é ali que a incerteza se concentra. Uma faixa
apertada num estágio desses força o agente a escolher entre não registrar e invadir — e as duas
saídas são piores que uma faixa generosa.

### §III-13. O formato do card, e por que o prompt XML **não** aparece 65 vezes aqui

Cada card existe em **duas representações**, e a segunda é **gerada** da primeira:

1. **O registro** (abaixo, §III-14) — a fonte de verdade. Carrega os três eixos independentes,
   separados de propósito, porque confundir os dois últimos é o que faz uma onda parecer pronta
   sem estar:

   | atributo | eixo |
   |---|---|
   | `deps` | **grafo** — de onde saem as ondas |
   | `id` + estado | **identidade e progresso** |
   | `onda` | **escalonamento** — decisão, não derivação |

2. **O prompt XML de 12 tags** (Apêndice A) — o contrato da sessão amnésica, **gerado** pelo
   `T-06` a partir do registro mais o template.

#### O registro existe em três formas, e as três carregam os mesmos três atributos

Cards de onda estreita usam `<details>`; cards de onda larga usam tabela comprimida, porque 13
blocos `<details>` idênticos seriam ruído. **As duas formas são legítimas — o que não é legítimo é
uma delas esconder o grafo.**

Isso já aconteceu aqui. Uma versão anterior deste documento declarava as dependências da onda W4
numa prosa **acima** da tabela ("campos comuns dos nós"), o que é legível para humano e **invisível
para script**: um validador escrito contra este documento parseava **39 de 65 cards** e reportava
"dep inexistente" para os 26 que não enxergava. O documento que exige *"se você não consegue derivar
suas ondas por script, ou o grafo está errado ou as ondas estão"* (§III-2) não conseguia derivar as
próprias.

A correção foi mecânica: **toda linha de card, em qualquer forma, carrega `onda` e `deps`
literais**. Prosa comum acima da tabela continua existindo — mas como *explicação*, nunca como a
única fonte do atributo.

**Verificação, e ela é o critério de aceitação do `T-02`:**

```
cards parseados do documento : 65 / 65        ← zero parseados seria FALHA, nunca verde
profundidade                 : 11             ← igual ao publicado em §III-10
onda mais larga              : 13             ← igual
caminho crítico              : F0-01 → F0-02 → F2-01 → F2-03 → F3-01 → F3-03
                               → F3-05 → F5-03 → F5-07 → F6-01 → F6-02 → F6-05
top out-degree               : T-01=13 · F0-07=10 · F0-04=10 · F0-01=9 · F1-03=8
ciclos · órfãos · deps laterais · violações de monotonia : 0 · 0 · 0 · 0
```

> **O que isso prova, e o que não prova.** Prova que os números publicados em §III-10 são
> **deriváveis do próprio documento**, e não redigitados — que é o que §IV-6 exige. **Não** prova
> que o grafo está certo: um grafo internamente consistente pode estar inteiramente errado sobre o
> mundo. Ele prova consistência, não verdade.

> **Por que gerado e não escrito:** o playbook é explícito — *se o grafo existe em duas
> representações, uma tem de ser gerada da outra, nunca redigitada.* No programa de origem, quatro
> arestas existiam no atributo e nunca entraram no diagrama, e as duas representações divergiram
> em silêncio. Copiar 65 prompts XML para dentro deste documento **reintroduziria exatamente esse
> defeito, multiplicado por 65.**
>
> **Consequência operacional:** para executar um card, você roda o gerador, não copia daqui.
> O Apêndice A é o template; os cinco exemplos completos ali cobrem cada arquétipo (raiz, hub,
> onda larga, onda de composição, join, infra).

---

### §III-14. Os cards

**Legenda dos campos.** `disciplina` é decidida por quem orquestra e nunca pelo executor
(§Como usar). `∅-crit` é o critério que **falha por ausência** — obrigatório em todo card.
`refuta` são as perguntas falsificáveis que vão para `<revisao_adversarial>`; elas vêm do card,
escritas antes, nunca do executor.

---

#### 🔵 W0 — raiz

<details open>
<summary><b>F0-01</b> · Vocabulário, convenções e o contrato de card · <code>W0</code> · <code>deps: —</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | Entregar **vocabulário, não funcionalidade**. Depois deste card, nenhum outro precisa inventar um nome. |
| **Dono de** | `docs/vocabulario.md` · `docs/convencoes.md` · `docs/estrutura.md` · `AGENTS.md` · `docs/adr/0001-oraculo-antes-do-pixel.md` · `docs/adr/0002-fronteira-de-determinismo.md` |
| **Entrega** | (a) glossário fechado: *estágio, nó, manifesto, manifesto-resolvido, store, cassete, snapshot, timing, envelope, variante, procedência, entrega*; (b) convenção de **content-addressing**: qual hash, o que entra na chave, como se serializa a chave, escrita atômica; (c) layout de diretórios completo; (d) formato de card e de handoff (teto de 2 KB, `destinatarios:` obrigatório); (e) as 12 regras de calibração da Parte 0 dentro do `AGENTS.md`; (f) **ADR-0001** e **ADR-0002**. |
| **Aceitação** | `python3 tools/lint-vocabulario.py` — falha se um termo do glossário aparece em outro doc com grafia divergente ·<br>`∅-crit:` `rg -L "^## O que este documento NÃO cobre" docs/*.md` → **saída vazia** |
| **refuta** | *(1)* O glossário define "cassete" e "snapshot" de forma que alguém consiga confundi-los? Escreva a frase que os separa. *(2)* A convenção de hash inclui **tudo** que muda a saída? Nomeie um parâmetro que mudaria o resultado e não está na chave. *(3)* O ADR-0001 tem guarda executável, ou é uma intenção? |
| **ledger** | AB-001..019 |
| **Nota** | Este card **não pode citar tecnologia de destino** além do runtime. Se ele precisar dizer "Remotion" para existir, a análise não terminou. Ele diz *"o compositor"*. |

</details>

<details>
<summary><b>T-01</b> · Esqueleto do repositório e fixação da toolchain · <code>W0</code> · <code>deps: —</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | Um repositório que compila vazio e que **prova** que compila vazio, com toda versão de ferramenta fixada. |
| **Dono de** | `package.json` `package-lock.json` `tsconfig.json` `pyproject.toml` `uv.lock` `.nvmrc` `.python-version` `.gitignore` `justfile` `.editorconfig` |
| **Entrega** | Workspace Node + ambiente Python isolado; **todas** as versões pinadas, inclusive a do navegador headless e a do FFmpeg; `justfile` com os alvos que o gate vai chamar (ainda como `PENDENTE`, nunca omitidos); `.gitignore` cobrindo store, frames, worktrees, modelos e segredos. |
| **Aceitação** | `just build` → exit 0 com a solução vazia ·<br>`just versoes` imprime as versões e **falha** se alguma divergir do pinado ·<br>`∅-crit:` `git status --porcelain` após `just build` → **saída vazia** (nenhum artefato de build escapou do `.gitignore`) |
| **refuta** | *(1)* O `.gitignore` bloqueia mesmo o diretório do store, ou só o caminho relativo? Teste com um symlink. *(2)* `just build` passaria com o `src/` vazio? Se sim, não prova nada — adicione um alvo que falhe por ausência. *(3)* A versão do navegador está fixada, ou o gerenciador baixa "a mais recente"? |
| **ledger** | AB-020..029 |

</details>

---

#### 🟠 W0.5 — infra (sem worktree, no branch de integração)

<details>
<summary><b>I-01</b> · Enquadramento de uso — <b>RESPONDIDO: uso pessoal</b> · <code>W0.5</code> · <code>deps: —</code> · <code>disciplina: —</code> · 🟡 · <b>não bloqueia mais</b></summary>

> **Decisão do dono, registrada:** *"é para uso pessoal"*. Esta é a resposta a **P-01**, e ela
> vem de quem tem mandato para dá-la — não de dedução de agente. As demais perguntas jurídicas
> (P-02, P-03, P-04) **derivam** de P-01 e fecham com ela.

| | |
|---|---|
| **Objetivo** | Registrar o enquadramento **com a sua condição de escopo**, e instalar o gatilho que torna visível o dia em que o escopo mudar. |
| **Dono de** | `docs/adr/0003-enquadramento-de-uso.md` |
| **Entrega** | **Um** ADR, `ACEITO (sign-off do dono)`, com quatro decisões numeradas: **D1 — uso pessoal.** *Personal use* é uma das categorias de elegibilidade à licença gratuita do motor de composição no próprio texto vigente; o gatilho de "organização com fins lucrativos e mais de 3 empregados" **não se aplica** `[R01-02 (3-0)]`. **D2 — tier: nenhum.** P-02 fica `ENCERRADO SEM DECISÃO` — não há tier a escolher. **D3 — conteúdo de terceiros: permitido no escopo pessoal**, com o registro de procedência mantido de qualquer forma (ele não existe por causa da licença, existe porque é o que torna a decisão auditável depois). **D4 — voz e trilha: leque ampliado.** Modelos cujos *pesos* têm licença não-comercial passam a ser utilizáveis `[R13-20 (2-0)]` `[R13-21 (2-0)]` — isso **aumenta** as opções de `F2-03`, não as reduz. |
| **A condição de escopo — o único conteúdo que sobrevive deste card** | Todas as quatro decisões valem **enquanto o uso for pessoal e não comercial**. Publicar monetizado, publicar em nome de uma organização, ou o projeto migrar para uso de trabalho são **eventos que reabrem P-01, P-03 e P-04 de uma vez**. Isso não é ressalva de rodapé: é a regra que o próprio método nomeia — *uma regra que perde sua condição de validade vira uma regra que está errada em todo o resto*. Por isso o escopo vira **item de ledger com gatilho**, não uma frase no ADR. |
| **Aceitação** | `∅-crit:` `rg -L "condição de escopo" docs/adr/0003-*.md` → **saída vazia** ·<br>`python3 tools/validate-ledger.py --id AB-950 --exigir-gatilho` — o item de escopo existe e declara o evento que o reabre |
| **refuta** | *(1)* O ADR registra a decisão **sem** a condição de escopo? Então ele autoriza mais do que foi decidido. *(2)* Algum card assume "pode publicar" a partir daqui? A decisão é sobre **uso**, não sobre publicação — `F6-01` e `I-04` continuam existindo. *(3)* O gatilho de reabertura é verificável, ou é uma nota que ninguém vai reler? |
| **ledger** | AB-950..969 · **AB-950 nasce ABERTO de propósito**: *"o uso continua pessoal?"*, com verificação = o dono responde, e impacto = reabre P-01/P-03/P-04 e bloqueia `F2-04`, `F2-06`, `F5-06`. É o único item do programa que é **permanentemente aberto por desenho** — fechá-lo seria afirmar que o futuro não muda. |
| **Nota** | **Desbloqueia `F2-04`, `F2-06` e `F5-06`.** O card cai de crítico para 🟡: ele não guarda mais um risco, guarda uma **fronteira**. |

</details>

---

#### 🔵 W1 — fan-out da raiz (8 cards)

<details>
<summary><b>F0-02</b> · Contrato do manifesto: schema e geração cross-language · <code>W1</code> · <code>deps: F0-01, T-01</code> · <code>disciplina: tdd</code> · 🔴 crítico · <b>hub (out-degree 6)</b></summary>

| | |
|---|---|
| **Objetivo** | **Uma** fonte de verdade para o contrato de dados que Node e Python consomem. Duas definições mantidas à mão divergem — é uma questão de quando. |
| **Dono de** | `schema/manifesto.schema.json` · `schema/manifesto.llm.schema.json` · `schema/gerar.*` · `src/contratos/manifesto.*` · `tests/contratos/**` |
| **Entrega** | **Dois** schemas derivados de uma fonte, não um — ver a nota abaixo. Ambos com união discriminada por `node.type` usando **`anyOf` com `const`** (não `oneOf`, não `discriminator`), `additionalProperties: false` e `$defs`. Versionamento **por objeto**, no estilo `"schema": "<Tipo>.<N>"` em cada nó, em vez de uma versão única no topo — decisão copiada de um formato aberto maduro `[R16-24 (3-0)]`, e é o que permite evoluir um tipo de nó sem invalidar o manifesto inteiro. Mais: o gerador que produz os tipos das duas linguagens **a partir do schema**, e a decisão registrada de **unidade de tempo** (ADR-0010) com o conversor único. |
| **Aceitação** | `just contrato:gerar && git diff --exit-code src/contratos/` — prova que o gerado está commitado e é reprodutível ·<br>`just contrato:testar` — os dois lados aceitam a mesma fixture válida e **rejeitam** as 12 fixtures inválidas ·<br>`just contrato:subset` — o schema-para-o-LLM **não contém nenhuma chave fora do subset aceito**, verificado por lista, e o schema-de-validação **contém** as invariantes que o outro não pode ter ·<br>`∅-crit:` `rg -L '"additionalProperties": false' schema/*.json` → vazio |
| **refuta** | *(1)* O schema aceita um manifesto com campo desconhecido? Prove com uma fixture. *(2)* Um tipo de nó novo pode ser adicionado sem tocar em nenhum outro `$def`? Se não, a união não está discriminada. *(3)* A unidade de tempo escolhida sobrevive a uma mudança de fps? Escreva o teste. *(4)* O gerador roda offline? *(5)* **O schema-para-o-LLM tem alguma chave que o subset rejeita?** Um schema com feature não suportada é recusado **antes da inferência**, com 400 — o custo do erro é o pipeline inteiro parar na primeira chamada. |
| **ledger** | AB-030..049 |
| **Nota — por que dois schemas** | `[R16-09 (2-0)]` `[R16-14 (2-0)]` `[R16-15 (2-0)]`: o subset de JSON Schema que a saída estruturada de LLM aceita **não suporta** `minLength`/`maxLength`/`minimum`/`maximum`/`multipleOf` (e `minItems` só aceita 0 ou 1), **não suporta schema recursivo** num dos fornecedores, e os dois fornecedores divergem entre si sobre metade das chaves `[R16-18 (1-1)]`. Um schema único que carregue as invariantes de validade **é rejeitado na geração**; um schema único que as omita **não valida nada**. Logo: `manifesto.llm.schema.json` (subset, para gerar) e `manifesto.schema.json` (2020-12 completo, para validar), **ambos derivados da mesma fonte**, com um teste que prova que o primeiro é um relaxamento do segundo e não um schema diferente. Consequência de projeto: **o manifesto não pode ser uma árvore recursiva** — é uma lista plana de nós com referência por id. |

</details>

<details>
<summary><b>F0-03</b> · Ledger de incerteza: schema, validador, faixas e inbox · <code>W1</code> · <code>deps: F0-01, T-01</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | A fila de trabalho para o dia futuro, **com a ferramenta rodando desde hoje, verde com tudo aberto**. |
| **Dono de** | `ledger/aberto.json` · `ledger/inbox/.gitkeep` · `ledger/CATEGORIAS.md` · `tools/validate-ledger.py` (+ autoteste) · `tools/consolidar-ledger.py` |
| **Entrega** | Schema do item com os cinco campos; validação **por estado** (aberto exige verificação executável e evidência vazia; fechado exige evidência casando a regex **e** não casando a lista negra `ok`/`confirmado`/`conforme combinado`/`resolvido`); vocabulário **fechado** de categorias, com o gerador recusando categoria fora da lista; consolidação de inbox→aberto pelo orquestrador; invariante `todo id citado no código existe no ledger`. |
| **Aceitação** | `python3 tools/validate-ledger.py` → exit 0 com o ledger vazio ·<br>`python3 tools/validate-ledger_selftest.py` → **asserta a mensagem** de cada uma das 9 mutações, não o exit code ·<br>`∅-crit:` um item fechado com evidência `"ok"` **tem de** falhar — e o autoteste prova isso |
| **refuta** | *(1)* A ferramenta estreia no dia do fechamento? Se ela não roda hoje no gate, sim. *(2)* Duas worktrees escrevendo inbox ao mesmo tempo conflitam? *(3)* A lista negra pega `"OK"`, `" ok "` e `"Ok."`? *(4)* Um id reciclado é aceito? |
| **ledger** | AB-050..059 |

</details>

<details>
<summary><b>F0-04</b> · Tokens de design em código · <code>W1</code> · <code>deps: F0-01, T-01</code> · <code>disciplina: tdd</code> · 🔴 crítico · <b>hub (out-degree 10)</b></summary>

| | |
|---|---|
| **Objetivo** | O **vocabulário visual e sonoro** do sistema, em fonte única. Depois deste card, nenhum literal de domínio pode aparecer em outro arquivo. |
| **Dono de** | `src/design/tokens.ts` · `src/design/tokens.py` (gerado) · `src/design/gerar.*` · `tests/design/**` · `docs/design/justificativa.md` |
| **Entrega** | Escala tipográfica · paleta com contraste verificado por cálculo, não por olho · grade e **safe areas por plataforma** · durações canônicas · presets de mola nomeados · **os números normativos que viram invariante**: caracteres por segundo de legenda, duração mínima e máxima de legenda, tamanho mínimo legível, contraste mínimo, limite de flashes por segundo, LUFS alvo e *true peak*, e quantos dB abaixo a música fica sob a locução. **Cada número com fonte** citada de `docs/00-panorama-verificado.md`. |
| **Aceitação** | `just design:testar` — verifica contraste de cada par de cor por cálculo e falha abaixo do mínimo ·<br>`just design:gerar && git diff --exit-code src/design/tokens.py` ·<br>`∅-crit:` `just design:varrer` procura literal de token fora de `src/design/` em **todo** o repositório e falha se achar — com o repositório vazio ela passa, e é por isso que ela roda desde hoje |
| **refuta** | *(1)* Algum número entrou sem fonte? Liste-os. *(2)* A varredura pegaria `#0A0A0A` escrito como `rgb(10,10,10)`? Se não, ela é decorativa. *(3)* O limite de flash é verificável por um teste, ou é prosa? *(4)* Os dois arquivos de token podem divergir sem nada ficar vermelho? |
| **ledger** | AB-060..079 |

</details>

<details>
<summary><b>F0-05</b> · Inventário de reuso do 3blue1brown, por call-site · <code>W1</code> · <code>deps: F0-01</code> · <code>disciplina: —</code> · 🟡</summary>

| | |
|---|---|
| **Objetivo** | Decidir **absorver × integrar** com medição, não com contagem de linhas. A superfície consumida costuma ser uma ordem de grandeza menor que a publicada, e é ela que paga a conta. |
| **Dono de** | `docs/reuso-3b1b.md` · `docs/adr/0004-absorver-ou-integrar.md` |
| **Entrega** | Tabela `arquivo · linhas · papel · status · destino (absorver\|integrar\|ignorar) · justificativa`, derivada de `docs/pesquisa/L01-*`; o **inventário por call-site**: exatamente quantos símbolos o novo projeto consumiria; e o ADR que congela a decisão **na raiz da árvore, hereditária** — se ela chegar tarde, metade dos cards já terá desenhado contra a premissa antiga. |
| **Aceitação** | `∅-crit:` `rg -L "call-sites:" docs/reuso-3b1b.md` → vazio (toda linha de "absorver" declara quantos call-sites justificam) ·<br>`rg -c "3blue1brown/.*:[0-9]+" docs/reuso-3b1b.md` ≥ 15 — toda afirmação sobre o projeto de origem carrega `arquivo:linha` |
| **refuta** | *(1)* A decisão foi tomada por contagem de linhas do provedor? Isso é o erro nomeado. *(2)* "Absorver" aqui significa copiar para dentro **e nunca mexer no projeto de origem**? Está escrito? *(3)* Algum item marcado "absorver" traz junto uma dependência que o novo projeto não quer? |
| **ledger** | AB-080..099 |

</details>

<details>
<summary><b>T-02</b> · Validador de grafo de tarefas · <code>W1</code> · <code>deps: F0-01, T-01</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | As ~80 linhas que o programa de origem não escreveu e pagou por isso: um card órfão e quatro arestas divergindo em silêncio. |
| **Dono de** | `tools/validate-graph.py` (+ autoteste) · `tools/gerar-tabela-de-ondas.py` · `tools/gerar-prompt-de-card.py` |
| **Entrega** | As 11 checagens do §15 do playbook, com destaque para: **monotonia de onda** (`onda(card) > onda(dep)`) como invariante dura; **aviso impresso** quando `onda > nível`, com a folga; **falha** se dois cards da mesma onda declaram o mesmo arquivo como dono; **falha** em aresta cujos dois extremos declaram a mesma onda (dependência lateral, §III-5); **geração** da tabela de ondas e do prompt XML — nunca comparação com uma versão redigitada. |
| **Aceitação** | `python3 tools/validate-graph.py PROGRAMA.md` → exit 0 ·<br>`python3 tools/validate-graph_selftest.py` — 11 mutações **calculadas do documento corrente**, cada caso assertando a mensagem ·<br>`just ondas:gerar && git diff --exit-code PROGRAMA.md` — a tabela commitada é a gerada ·<br>`∅-crit:` **zero cards parseados = falha**, com a mensagem "o formato mudou e este verificador ficou cego" |
| **refuta** | *(1)* Um card sem dependência **e** sem dependente passa? Deveria falhar, salvo allowlist datada. *(2)* As mutações do autoteste são literais? Se sim, viram no-op no próximo merge. *(3)* O validador recusa explicitamente o que não sabe analisar, ou pula em silêncio? *(4)* Ele detecta e **imprime** as ondas de composição (§III-4)? |
| **ledger** | AB-100..109 |

</details>

<details>
<summary><b>T-03</b> · Gate local executável · <code>W1</code> · <code>deps: T-01</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | O gate **é** o pipeline. Uma etapa por job, três estados, ferramenta ausente = vermelho. |
| **Dono de** | `tools/gate.sh` (+ autoteste) · `docs/gate.md` |
| **Entrega** | Uma etapa por **job** (não por stage), lida da definição de CI quando ela existir e declarada `PENDENTE` enquanto não existir; resumo final com `PASS` / `FAIL` / `NÃO-EXERCITADO` por etapa; ausência de qualquer das seis dependências de sistema (Node, Python, FFmpeg, LaTeX, navegador, driver de GPU) imprime **VERMELHO nomeado**, nunca "pulado". |
| **Aceitação** | `bash tools/gate.sh` → exit 0 no repositório limpo, com todas as etapas em `PENDENTE` e o veredito dizendo isso ·<br>`bash tools/gate_selftest.sh` — asserta **a mensagem** de cada estado ·<br>`∅-crit:` esconder o FFmpeg do `PATH` **tem de** produzir vermelho, e o autoteste prova |
| **refuta** | *(1)* Uma etapa que não roda imprime a mesma coisa que uma que passou? *(2)* O gate confunde stage com job? Conte os dois. *(3)* Ele mantém uma lista própria de etapas em vez de ler a definição? Duas listas à mão recriam o buraco do outro lado. |
| **ledger** | AB-110..119 |

</details>

<details>
<summary><b>T-04</b> · Worktree por card, com preflight · <code>W1</code> · <code>deps: T-01</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | Terminar o setup com um **teste que prova acesso ao insumo com valor conhecido** — não com "criei a pasta". |
| **Dono de** | `tools/new-task-worktree.sh` · `tools/preflight.sh` (+ autoteste) · `docs/worktrees.md` |
| **Entrega** | Os cinco passos do §VI-2: validar identificador (`<FASE>-<NN>` ou `PREP-<slug>`); **recusar** identificadores de infra com explicação; criar do branch de integração; symlinkar o insumo gitignorado **e acrescentá-lo ao exclude local**; preflight com quatro provas de valor conhecido. Imprime, ao final, o que **não** funciona por design naquele ambiente. |
| **Aceitação** | `bash tools/new-task-worktree.sh create PREP-teste && bash tools/preflight.sh` → exit 0 ·<br>`bash tools/new-task-worktree.sh create I-01` → **exit ≠ 0** com a explicação ·<br>`∅-crit:` mover o store para fora e rodar o preflight **tem de** dar exit 1 deixando a worktree para inspeção |
| **refuta** | *(1)* O preflight passaria com o store vazio? *(2)* O `.gitignore` com barra cobre o symlink? Teste, não deduza. *(3)* O script tenta remover a worktree de dentro dela mesma em algum caminho de erro? |
| **ledger** | AB-120..129 |

</details>

<details>
<summary><b>T-10</b> · Infraestrutura de skills: linter, evals, staleness, catálogo gerado · <code>W1</code> · <code>deps: T-01</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | Absorver a infraestrutura já provada do projeto 3blue1brown e **fechar as lacunas dela**. |
| **Dono de** | `.agents/scripts/skill_lint.py` · `.agents/scripts/run_skill_evals.py` · `.agents/scripts/check_staleness.py` · `.agents/scripts/gerar_catalogo.py` · `.agents/skills/catalog.md` (gerado) |
| **Entrega** | Linter com as 9 regras (§Contrato de skill), **absorvido com citação `arquivo:linha` da origem**; runner de evals por skill; checador de proveniência que **rejeita a forma degenerada do pin** (citação sem caminho nunca casa a regex e é pulada em silêncio — no programa de origem, 38 de 55 citações estavam mudas); gerador do catálogo **a partir** dos frontmatter; e o acréscimo deste programa: **eval de roteamento com near-misses**, porque o catálogo tem 20 skills. |
| **Aceitação** | `python3 .agents/scripts/skill_lint.py` → exit 0 ·<br>`just skills:catalogo && git diff --exit-code .agents/skills/catalog.md` ·<br>`python3 .agents/scripts/skill_lint_selftest.py` — asserta a mensagem de cada regra ·<br>`∅-crit:` uma skill com data no corpo **tem de** dar erro (não aviso), e uma citação sem caminho **tem de** ser rejeitada |
| **refuta** | *(1)* Um pin degenerado passa? Escreva um e prove. *(2)* O catálogo é gerado ou redigitado? *(3)* O eval de roteamento tem near-misses, ou só casos positivos? Só positivos não mede precisão. *(4)* O linter aceitaria uma skill cujo `name` diverge do diretório? |
| **ledger** | AB-130..139 |

</details>

---

#### 🔵 W2 — fundação compartilhada (8 cards)

<details>
<summary><b>F0-06</b> · Harness de determinismo — <i>o motor do oráculo</i> · <code>W2</code> · <code>deps: F0-01, T-01, T-03</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | A máquina que torna possível **reprovar** qualquer coisa que produza pixel ou som. Sem ela, o ADR-0001 é uma frase. |
| **Dono de** | `tools/determinismo/**` · `tests/harness/**` · `fixtures/canario/**` · `docs/snapshots.md` |
| **Entrega** | (a) renderizar **duas vezes em rascunho** e diffar **antes** de tocar o diretório aprovado; (b) execução divergente escreve em `*.received/` e **nunca** sobrescreve a linha de base; (c) o congelamento de ambiente: relógio, fuso, locale, semente, fonte, backend gráfico; (d) normalização **por posição, nunca por valor**, com um pós-teste "não sobrou volatilidade"; (e) asserção de **conteúdo**: entropia do frame acima de um limiar, para pegar o quadro preto que `exit 0` não pega; (f) a composição-canário própria do harness, para ele não depender de nenhum card de composição. |
| **Aceitação** | `just det:provar` — renderiza o canário 2× e exige bytes idênticos ·<br>`just det:mutar` — injeta um valor volátil e exige **vermelho com a mensagem certa** ·<br>`∅-crit:` apagar um snapshot aprovado **tem de** deixar o gate vermelho (ausência falha), e não passar por "nada a comparar" |
| **refuta** | *(1)* O harness passaria com um quadro totalmente preto? *(2)* Rodar 2× seguidas pega o que muda à meia-noite ou por máquina? Se não, o congelamento está incompleto — liste o que falta. *(3)* Uma execução vermelha consegue sobrescrever a base por algum caminho? *(4)* A normalização substitui por **valor** em algum ponto? |
| **ledger** | AB-140..159 |

</details>

<details>
<summary><b>F0-07</b> · Store endereçado por conteúdo · <code>W2</code> · <code>deps: F0-01, T-01</code> · <code>disciplina: tdd</code> · 🔴 crítico · <b>hub (out-degree 10)</b></summary>

| | |
|---|---|
| **Objetivo** | O artefato que permite N agentes trabalharem em paralelo sem multiplicar por N a conta de API — e que torna o render reproduzível offline. |
| **Dono de** | `src/store/**` · `tools/store-*.{ts,py}` · `tests/store/**` |
| **Entrega** | Escrita **atômica** (tmp + rename); chave de conteúdo com **tudo** que muda a saída; `procedencia.json` obrigatório por asset (origem, licença, data de obtenção, termos); imutabilidade (um hash existente nunca é reescrito); coleta de lixo com allowlist; e a regra que atravessa o programa: **nenhuma URL remota atravessa a fronteira** — o manifesto resolvido referencia hash, nunca endereço. |
| **Aceitação** | `just store:testar` — N escritores concorrentes do mesmo conteúdo produzem um arquivo e zero corrupção ·<br>`just store:chave` — muda **um** parâmetro por vez e exige *cache miss* em cada um ·<br>`∅-crit:` `rg -L '"licenca"' .cache/store/**/procedencia.json` → vazio · `rg "https?://" manifesto-resolvido.json` → **sem resultado** |
| **refuta** | *(1)* A chave omite algum parâmetro que muda a saída? Nomeie um e prove que ele gera miss. *(2)* Dois processos escrevendo o mesmo hash com conteúdo **diferente** — o que acontece? *(3)* Um asset sem procedência entra? *(4)* A GC apaga algo que um snapshot aprovado ainda referencia? |
| **ledger** | AB-160..179 |

</details>

<details>
<summary><b>F0-08</b> · Invariantes estruturais e o catálogo de falso verde executável · <code>W2</code> · <code>deps: F0-01, T-03</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | Transformar o Apêndice H de tabela em **script**. Cada linha do catálogo que não vira verificação é decoração. |
| **Dono de** | `tools/invariantes/**` (+ autoteste) · `docs/falso-verde.md` |
| **Entrega** | Os nove invariantes do §IV-3, cada um com a pergunta *"se isto desaparecer, o que fica vermelho?"* respondida no próprio código; varredura **estrutural** (arquivo parseado) e não textual, para não acusar o próprio padrão escrito dentro do script; **falha fechado** — o que o verificador não sabe analisar é recusado explicitamente. |
| **Aceitação** | `just invariantes` → exit 0 ·<br>`just invariantes:autoteste` — cada invariante tem uma mutação **calculada** que o dispara, e o caso asserta **a mensagem** ·<br>`∅-crit:` remover um projeto de teste do CI **tem de** ficar vermelho pelo invariante "todo projeto de teste é executado por algum job" |
| **refuta** | *(1)* Algum invariante passa por omissão quando o objeto não existe ainda? Isso é verde por ausência. *(2)* A varredura de segredo acusa o próprio padrão do script? *(3)* Um invariante que perdeu o objeto foi apagado em vez de virar *ausência*? |
| **ledger** | AB-180..189 |

</details>

<details>
<summary><b>F0-09</b> · Fixture canônica — o manifesto de referência · <code>W2</code> · <code>deps: F0-02, F0-04</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | A entrada única de todo golden master do programa. Um manifesto que exercita **todos** os tipos de nó e, deliberadamente, **as entradas sujas**. |
| **Dono de** | `fixtures/canonico/**` · `docs/fixtures.md` |
| **Entrega** | Um manifesto válido cobrindo cada tipo de nó; **e** o conjunto de entradas sujas, que é onde mora a diferença entre paridade real e paridade de fachada: acento e cedilha, apóstrofo, aspas curvas, emoji, texto que estoura o quadro, texto de uma palavra, campo opcional ausente, duração zero, dois nós no mesmo instante, caractere de largura zero, número com zero à esquerda (`440` ≠ `0440`), e um nó cujo asset **não existe** no store. Mais 12 fixtures **inválidas**, uma por regra do schema. Cada fixture classificada `CONTRATO` × `BUG-A-DIVERGIR`. |
| **Aceitação** | `just fixtures:validar` — todas as válidas passam, todas as inválidas são rejeitadas **com a mensagem certa** ·<br>`∅-crit:` `python3 tools/validate-fixtures.py --exigir-classificacao` falha se **qualquer** fixture não aparecer na tabela `CONTRATO`×`BUG` |
| **refuta** | *(1)* Cadê o caso misto? Procure variação de domínio **sem** linha correspondente. *(2)* Alguma fixture é fabricada de modo a alimentar a própria asserção? Isso não é teste. *(3)* A fixture "asset ausente" espera erro claro ou silêncio? |
| **ledger** | AB-190..209 |

</details>

<details>
<summary><b>T-05</b> · Hooks: gate de segurança, gate de skill, barreira de onda, nudge · <code>W2</code> · <code>deps: T-01, T-03, T-10</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | Converter as regras que **não podem** depender de leitura atenta em garantias de máquina. Prosa numa skill é conselho; um hook é garantia. |
| **Dono de** | `.claude/settings.json` · `.agents/scripts/bash_guardrail.py` · `.agents/scripts/skill_write_gate.py` · `.agents/scripts/wave_barrier.py` · `.agents/scripts/nudge.py` (todos + autoteste) |
| **Entrega** | Os quatro hooks do §IV-5, com a política de falha declarada por hook (**abertos**, exceto os dois de segurança); a **barreira durável** que anexa uma linha por agente ao arquivo de status da onda, contada por **número de onda** e nunca por relógio; o nudge que reinjeta C1/C2/C9/C12 e **diz de si mesmo que é lembrete, não garantia**.<br><br>**E as duas reescritas que o panorama exige** — nenhuma é cópia do projeto de origem: **(a) o guardrail troca denylist por allowlist do harness (`permissions`) mais gate de propriedade de arquivo por card**, porque a denylist herdada deixa passar `rm -rf /` e `rm -rf ~`; **(b) o gate de escrita de skill ganha token gitignorado, TTL de 30 min, `sha1` do arquivo que passou, e resolução de caminho por `git rev-parse --show-toplevel`** — o herdado é um JSON versionado, editável à mão, sem TTL, que libera escrita quando executado de outro cwd. |
| **Aceitação** | `python3 .agents/scripts/hooks_selftest.py` — cada hook, cada estado, assertando a mensagem ·<br>`∅-crit:` remover o gate de escrita de skill **tem de** deixar um invariante vermelho — a ausência de um hook não pode ser indistinguível de conformidade ·<br>`∅-crit:` `rm -rf /`, `rm -rf ~` e `sudo rm -rf /` **têm de** ser bloqueados, e o autoteste prova os três — este é o critério que reprova a cópia herdada ·<br>`∅-crit:` rodar o gate de escrita **de outro cwd** tem de **negar**, nunca liberar |
| **refuta** | *(1)* A barreira vale para um agente que terminou **antes** de você começar a esperar? *(2)* O gate de segurança pega a leitura de segredo via shell, que contornaria a guarda de caminho? *(3)* Algum hook dispara em trabalho comum? Um gate que incomoda acaba desligado — e um que só pode ser satisfeito contornando-o ensina a contornar. *(4)* Um hook quebrado inutiliza a sessão? |
| **ledger** | AB-210..219 |

</details>

<details>
<summary><b>T-06</b> · Verificador de aceitação: sonda negativa e tripwire · <code>W2</code> · <code>deps: T-02, T-03</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | Impedir o defeito mais comum de uma árvore de tarefas: **o critério que já passava antes de a tarefa escrever a primeira linha**. |
| **Dono de** | `tools/verify-acceptance.py` (+ autoteste) · `tools/gerar-prompt-de-card.py` é de `T-02` — **não editar** |
| **Entrega** | Os cinco mecanismos do §IV-2: parsing do próprio `PROGRAMA.md` (união dos comandos do registro e do prompt gerado, deduplicada); ≥1 teste casado por seletor de card concluído, por descoberta e sem execução; **sonda negativa por alvo**; **tripwire** contando num texto normalizado **diferente** do que o parser lê; **zero cards parseados = falha**. |
| **Aceitação** | `python3 tools/verify-acceptance.py` → exit 0 ·<br>`python3 tools/verify-acceptance_selftest.py` — inclui o caso adversarial: HTML no meio do token, caractere de largura zero e hífen suave ·<br>`∅-crit:` um card marcado concluído com seletor que casa zero testes **tem de** ficar vermelho |
| **refuta** | *(1)* O verificador se auditaria? Ele é código de produção — tem autoteste e falha fechado? *(2)* A sonda negativa é por alvo, ou uma só para todos? Uma só não pega regressão por runner. *(3)* O tripwire lê o **mesmo** texto que o parser? Se sim, não é independente. |
| **ledger** | AB-220..229 |

</details>

<details>
<summary><b>T-07</b> · Estado derivado do programa · <code>W2</code> · <code>deps: T-02</code> · <code>disciplina: tdd</code> · 🟡</summary>

| | |
|---|---|
| **Objetivo** | Impedir que a seção "estado" deste documento vire a afirmação menos exata dele. Um cabeçalho velho é lido com a autoridade de documentação e está errado. |
| **Dono de** | `tools/derive-state.py` (+ autoteste) · a seção `<!-- ESTADO:GERADO -->` deste documento |
| **Entrega** | Derivação a partir dos cards; **"concluídas" é o prefixo ininterrupto de ondas, não o conjunto**; comparação **isolada por linha**, não por seção; falha imprimindo o texto que a prosa deveria carregar; e o estado dos cards suspensos por gate de infra, impresso e não descoberto. |
| **Aceitação** | `python3 tools/derive-state.py --verificar` → exit 0 ·<br>`∅-crit:` marcar um card de onda tardia como concluído **não pode** aumentar a contagem de ondas concluídas — e o autoteste prova |
| **refuta** | *(1)* Uma linha nova em outro ponto da mesma seção satisfaz sozinha a exigência? *(2)* O script **gera** ou **confere** a prosa editorial? Mover prosa para dentro do script é pior; deixá-la sem checagem é como ela apodrece. |
| **ledger** | AB-230..234 |

</details>

<details>
<summary><b>T-08</b> · Instrumentação de custo e tempo por onda · <code>W2</code> · <code>deps: T-03</code> · <code>disciplina: tdd</code> · 🟢</summary>

| | |
|---|---|
| **Objetivo** | Substituir a Parte VIII inteira por medição. Cada número dela é hipótese até este card rodar duas ondas. |
| **Dono de** | `tools/medir.py` · `docs/medicao/**` |
| **Entrega** | Coleta por onda: duração de parede, número de agentes, pico de RAM, pico de disco, chamadas de API por estágio (e quantas o cache absorveu), tempo de render por segundo de vídeo, tempo de gate. Escrita **em arquivo no repositório pelo próprio agente** — o histórico do terminal recupera pouco e zero se a janela fechar. |
| **Aceitação** | `python3 tools/medir.py --onda W2` grava e valida o registro ·<br>`∅-crit:` uma onda sem registro de medição **tem de** deixar o gate amarelo (`NÃO-EXERCITADO`), nunca verde |
| **refuta** | *(1)* A métrica "chamadas de API" tem **denominador**? Zero chamadas é verdade quando o cache está perfeito **e** quando ninguém rodou nada. *(2)* O registro sobrevive ao fechamento do terminal? |
| **ledger** | AB-235..239 |

</details>

---

#### 🟠 W2.5 — infra

<details>
<summary><b>I-02</b> · Contas, chaves e quotas · <code>W2.5</code> · <code>deps: I-01</code> · <code>disciplina: —</code> · 🔴 crítico · <b>bloqueante</b></summary>

| | |
|---|---|
| **Objetivo** | Tornar os estágios de resolução executáveis, sem que nenhuma credencial encoste no repositório. |
| **Dono de** | `.env.example` · `docs/contas.md` · `docs/adr/0005-segredos.md` |
| **Entrega** | Uma conta e uma chave por provedor aprovado em `I-01`; quota e limite de taxa **anotados por provedor** (é o que dimensiona a concorrência da W4); a política de segredo (onde mora, quem lê, como o hook bloqueia); e o registro do que **não** foi contratado e por quê. |
| **Aceitação** | `just contas:verificar` — cada provedor aprovado responde a um *ping* mínimo e a resposta é **descartada**, nunca gravada ·<br>`∅-crit:` `rg -i "sk-\|api[_-]?key\s*=\s*['\"][A-Za-z0-9]" -g '!.env.example' .` → **sem resultado**, e o hook de segurança prova que bloqueia |
| **refuta** | *(1)* Alguma chave real entrou em fixture, cassete ou log? *(2)* A quota anotada é a do plano contratado ou a da documentação pública? *(3)* Existe provedor usado por um card e não listado aqui? |
| **ledger** | AB-970..979 |

</details>

---



#### 🔵 W3 — os hubs (5 cards) — *onda estreita de propósito*

<details>
<summary><b>F1-01</b> · Composição raiz, contrato de nó e descoberta por convenção · <code>W3</code> · <code>deps: F0-02, F0-04, F0-09, T-01</code> · <code>disciplina: ambos</code> · 🔴 crítico · <b>hub (out-degree 8)</b></summary>

| | |
|---|---|
| **Objetivo** | O esqueleto abaixo da fronteira: uma **função pura** de `(manifesto-resolvido, assets) → frames`. E a decisão de §III-9, implementada. |
| **Dono de** | `src/composicao/raiz.tsx` · `src/composicao/contrato-de-no.ts` · `src/composicao/descoberta.ts` · `src/composicao/tempo.ts` · `tests/composicao/raiz/**` |
| **Entrega** | O contrato que todo nó implementa (props, duração declarada, contrato de id); a **descoberta por convenção** varrendo `src/composicao/nos/`; o cálculo de tempo (início, duração, sobreposição de transição) num único módulo; e a proibição executável de não-determinismo dentro de `src/composicao/`. |
| **Aceitação** | `just comp:testar` — a raiz renderiza a fixture canônica com **nós de mentira** e o timing bate ·<br>`just comp:unicidade` — varre o disco e exige id único por nó descoberto ·<br>`∅-crit:` `just comp:pureza` falha se achar `Date.now`/`Math.random`/`setTimeout`/`fetch` sob `src/composicao/` — e passa hoje, com o diretório quase vazio, que é o ponto |
| **refuta** | *(1)* A descoberta acha um arquivo que **não** casa o contrato e o ignora em silêncio? Deve falhar. *(2)* O cálculo de duração com transição sobreposta bate com a soma manual? Escreva o caso de três cenas e duas transições. *(3)* A raiz renderizaria um manifesto com nó de tipo desconhecido? Deve recusar, não pular. |
| **ledger** | AB-240..259 |

</details>

<details>
<summary><b>F1-02</b> · Motor de layout: medição, ajuste e overflow como erro · <code>W3</code> · <code>deps: F0-04, T-01</code> · <code>disciplina: tdd</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | Que texto que estoura o quadro seja um **erro de build**, não uma descoberta ao assistir o vídeo pronto. |
| **Dono de** | `src/composicao/layout/**` · `tests/composicao/layout/**` |
| **Entrega** | Medição de texto determinística; ajuste por regra declarada (reduzir corpo até um mínimo, depois quebrar, depois **falhar**); safe areas por plataforma vindas dos tokens; e a asserção de tamanho mínimo legível. |
| **Aceitação** | `just layout:testar` — a fixture "texto que estoura" **falha o build** com mensagem nomeando o nó ·<br>`∅-crit:` remover a checagem de safe area **tem de** deixar um invariante vermelho |
| **refuta** | *(1)* A medição depende de fonte carregada? Se a fonte cair para fallback, a medida muda em silêncio. *(2)* O ajuste reduz o corpo abaixo do mínimo legível para "caber"? Isso é pior que falhar. *(3)* O teste roda com a mesma pilha gráfica do render, ou com outra? |
| **ledger** | AB-260..269 |

</details>

<details>
<summary><b>F1-03</b> · Fontes locais embutidas e asserção de família resolvida · <code>W3</code> · <code>deps: F0-04, T-01</code> · <code>disciplina: tdd</code> · 🟡</summary>

| | |
|---|---|
| **Objetivo** | Eliminar a causa nº 1 de layout que muda entre máquinas: a fonte que não carregou e caiu para o fallback **sem erro**. |
| **Dono de** | `src/design/fontes/**` · `assets/fontes/**` · `tests/design/fontes/**` · `docs/design/licencas-de-fonte.md` |
| **Entrega** | Arquivos de fonte versionados no repositório, **nunca CDN**; carregamento explícito; asserção em tempo de render de que a família resolvida é a esperada; e a licença de cada fonte, com o direito de embutir declarado. |
| **Aceitação** | `just fontes:testar` — renderiza um still e asserta a família resolvida, não só que "renderizou" ·<br>`∅-crit:` `rg -i "fonts.googleapis\|cdn" src/ ` → **sem resultado** · `rg -L "licenca:" assets/fontes/*.md` → vazio |
| **refuta** | *(1)* Como o teste distingue "carregou a fonte certa" de "caiu no fallback que por acaso parece igual"? *(2)* Alguma fonte foi embutida sem direito de embutir? *(3)* O peso/estilo específico está fixado, ou só a família? |
| **ledger** | AB-270..279 |

</details>

<details>
<summary><b>F2-01</b> · Contrato de estágio de resolução, cassetes e o orquestrador · <code>W3</code> · <code>deps: F0-02, F0-07</code> · <code>disciplina: tdd</code> · 🔴 crítico · <b>hub (out-degree 7)</b></summary>

| | |
|---|---|
| **Objetivo** | O esqueleto **acima** da fronteira: como um estágio impuro é escrito, cacheado, gravado em cassete e verificado offline. |
| **Dono de** | `src/resolucao/contrato.ts` · `src/resolucao/orquestrador.ts` · `src/resolucao/cassete/**` · `tests/resolucao/contrato/**` · `schema/manifesto-resolvido.schema.json` |
| **Entrega** | O contrato de estágio (entrada → chave de cache → saída no store → fragmento de manifesto resolvido); o mecanismo de **cassete**: toda chamada externa é gravada uma vez e reproduzida depois, versionada, determinística; o orquestrador que roda os estágios em paralelo respeitando o teto declarado; o schema do **manifesto-resolvido**, que é o contrato congelado da fronteira; e o **guarda de rede**: no gate, o processo roda sem acesso externo. |
| **Aceitação** | `just res:offline` — a suíte inteira passa **com a rede bloqueada** ·<br>`just res:cassete` — regravar um cassete e diffar: qualquer diferença não explicada refuta o determinismo ·<br>`∅-crit:` um estágio sem cassete **tem de** derrubar `just res:offline`, e não ser pulado |
| **refuta** | *(1)* A suíte "offline" de fato bloqueia a rede, ou só não usa? São coisas diferentes — prove com um estágio que tenta sair. *(2)* A chave de cache do contrato inclui a **versão do estágio**? Sem isso, mudar o código não invalida o cache. *(3)* O manifesto resolvido consegue conter uma URL? Deve ser impossível pelo schema, não por convenção. |
| **ledger** | AB-280..299 |

</details>

<details>
<summary><b>T-09</b> · CI espelhado, lido pelo gate local · <code>W3</code> · <code>deps: T-03, T-06</code> · <code>disciplina: tdd</code> · 🟡 · <b>mergeia por último na W3</b></summary>

| | |
|---|---|
| **Objetivo** | Fonte única de definição: o gate local **lê** o CI. Duas listas mantidas à mão recriam o mesmo buraco do outro lado. |
| **Dono de** | `.github/workflows/**` · `tools/espelho-ci.py` (+ autoteste) |
| **Entrega** | A definição de CI com um job por etapa do gate; o espelhamento **bidirecional** como invariante (job sem etapa = vermelho; etapa sem job = vermelho); filtro de caminho com a semântica certa nos jobs caros; jobs caros **terminais** no grafo. |
| **Aceitação** | `python3 tools/espelho-ci.py` → exit 0 ·<br>`∅-crit:` adicionar um job ao CI sem etapa correspondente **tem de** ficar vermelho, e vice-versa |
| **refuta** | *(1)* Um job novo que ninguém conecta fica vermelho ou **invisível**? *(2)* O filtro de caminho está invertido em algum job? Teste com uma mudança que **não** deveria acordar o job caro. *(3)* Todo projeto de teste do repositório é executado por **algum** job? |
| **ledger** | AB-300..309 |

</details>

---

#### 🟢 W4 — a onda mais larga (13 cards) — *zero singletons tocados*

> **Protocolo obrigatório desta onda:** mapa `arquivo → dono` do §III-11 publicado no `PREP-w4`;
> faixas de id e de porta pré-alocadas; ordem de merge declarada (resolução antes de composição);
> **gate completo após cada merge**. Nenhum card desta onda toca `tokens.ts`, `manifesto.schema.json`
> ou `package.json` — quem precisar, **para e escreve no handoff**.
>
> **Os oito nós de composição** (`F1-04`…`F1-11`) compartilham o mesmo esqueleto de card: cada um
> implementa um componente, aprova seus próprios snapshots pelo harness `F0-06`, e declara sua
> duração pelo contrato de `F1-01`. Por isso os campos comuns aparecem uma vez, aqui, e o registro
> de cada card lista só o que é dele.

**Campos comuns dos nós `F1-04`…`F1-11`:**

| | |
|---|---|
| **deps** | `F1-01`, `F1-02`, `F1-03` (exceto onde indicado) |
| **disciplina** | `ambos` — TDD para o contrato e a duração; caracterização para o pixel |
| **Aceitação comum** | `just no:<nome>` → exit 0 ·<br>`just det:provar --no <nome>` — render 2× idêntico ·<br>`git diff --exit-code fixtures/snapshots/no-<nome>/` **combinado com** `git status --porcelain` (porque `diff --exit-code` não enxerga arquivo não rastreado) ·<br>`∅-crit:` apagar um snapshot aprovado **tem de** ficar vermelho |
| **refuta comum** | *(1)* O smoke passaria com o componente devolvendo um quadro vazio? *(2)* Renderize 2× e diffe: **qualquer** byte diferente refuta o determinismo. *(3)* Algum literal de token foi redeclarado neste arquivo? *(4)* O componente respeita a duração declarada, ou desenha fora da própria janela? |

| Card | Onda · deps · disciplina | Título | Dono de | O que é só dele | ledger |
|---|---|---|---|---|---|
| **F1-04** 🟡 | `W4` · `F1-01, F1-02, F1-03` · `ambos` | Nó: cabeçalho e título | `nos/Cabecalho.tsx` + snapshots | entrada com mola nomeada dos tokens; **nunca** valor de mola inline | 310..319 |
| **F1-05** 🔴 | `W4` · `F1-01, F1-02, F1-03` · `ambos` | Nó: texto com destaque palavra a palavra | `nos/TextoDestaque.tsx` + snapshots | consome `timing` como **entrada opcional**; sem timing, degrada para destaque por frase — e o teste prova os dois caminhos | 320..329 |
| **F1-06** 🟢 | `W4` · `F1-01, F1-02, F1-03` · `ambos` | Nó: lista, grade e bullets | `nos/Lista.tsx` + snapshots | *lagged start* declarativo; o caso "um item" e o caso "vinte itens" | 330..339 |
| **F1-07** 🔴 | `W4` · `F1-01, F1-02, F1-03, F0-07` · `ambos` | Nó: mídia com contrato de alfa | `nos/Midia.tsx` + snapshots | deps `+F0-07`; recebe **hash**, nunca URL; recusa asset ausente com erro nomeado; o caso do GIF, que precisa avançar pelo frame e não pelo relógio | 340..349 |
| **F1-08** 🟡 | `W4` · `F1-01, F1-02, F1-03` · `ambos` | Nó: código | `nos/Codigo.tsx` + snapshots | consome **tokens pré-computados**, nunca faz destaque em tempo de render; o caso "linha longa" e o caso "muitas linhas" | 350..359 |
| **F1-09** 🔴 | `W4` · `F1-01, F1-02, F1-03, F0-07` · `ambos` | Nó: gráfico | `nos/Grafico.tsx` + snapshots | deps `+F0-07`; consome arquivo com alfa vindo do store; o caso "o alfa não é suportado" tem de falhar no build, não no vídeo | 360..369 |
| **F1-10** 🔴 | `W4` · `F1-01, F1-02, F1-03` · `ambos` | Transições e composição de sequência | `transicoes/**` + snapshots | o cálculo de duração com sobreposição, conferido contra `F1-01`; o caso de transição mais longa que a cena. **Crítico porque errar aqui erra a duração de todo vídeo, e o erro é invisível frame a frame** | 370..379 |
| **F1-11** 🟢 | `W4` · `F1-01, F1-02, F1-03` · `ambos` | Camadas globais: fundo, grade, vinheta | `camadas/**` + snapshots | ordem de empilhamento declarada; o teste que prova que a camada não cobre a safe area | 380..389 |

**Os cinco estágios de resolução** (`F2-02`…`F2-06`) também compartilham esqueleto: cada um
implementa o contrato de `F2-01`, grava seu cassete, e passa na suíte offline.

| | |
|---|---|
| **deps comuns** | `F2-01`, `F0-07` |
| **disciplina** | `tdd` (o estágio) + `caracterizacao` (o cassete) |
| **Aceitação comum** | `just res:<estagio>` → exit 0 ·<br>`just res:offline --estagio <nome>` — passa **com a rede bloqueada** ·<br>`just res:chave --estagio <nome>` — muda um parâmetro por vez, exige *cache miss* em cada ·<br>`∅-crit:` `rg -L '"licenca"' fixtures/cassetes/<nome>/**/procedencia.json` → vazio |
| **refuta comum** | *(1)* O estágio chama a rede quando o cache acerta? Prove com a rede bloqueada e o cache quente. *(2)* A chave de cache inclui a versão do estágio? *(3)* O cassete contém alguma credencial? *(4)* O estágio "conserta" algo da resposta externa? Se conserta, ele esconde o defeito do cassete — o cassete tem de ser sósia, não sucessor. |

| Card | Onda · deps · disciplina | Título | Dono de | O que é só dele | ledger |
|---|---|---|---|---|---|
| **F2-02** 🔴 | `W4` · `F2-01, F0-07, F0-05` · `ambos` | Resolução: gráfico (Manim headless) | `resolucao/grafico/**` + cassetes | deps `+F0-05`; absorve os quirks do 3blue1brown **com citação de origem**; cache por hash do código da cena; o formato de alfa é decidido por ADR-0008 e **provado** com um render que o compositor consegue ler — a extração de frame acontece fora do navegador, então o limite de codec do navegador **não** é o gargalo `[R07-12 (2-0)]` | 390..409 |
| **F2-03** 🔴 | `W4` · `F2-01, F0-07` · `ambos` | Resolução: locução | `resolucao/locucao/**` + cassetes | produz `audio` **e** `timing` quando o provedor fornece; quando não fornece, emite o item de ledger e degrada — a escolha está no ADR-0009, não no código do card. **Está no caminho crítico** | 410..429 |
| **F2-04** 🟡 | `W4` · `F2-01, F0-07` · `ambos` | Resolução: mídia externa | `resolucao/midia/**` + cassetes | **desbloqueado por `I-01`** (uso pessoal). Restam os limites técnicos, e eles são **por provedor**, não um número só: 100 req/60 s com cache de 24 h e **proibição de hotlink** num deles, contra 50 req/h com **obrigação de hotlink** noutro `[R08-21·R08-22 (2-0)]`. **As duas regras não coexistem numa política única** — este card decide qual vale **antes** de escrever o downloader. O store resolve o limite de taxa; não resolve a contradição. Procedência com os termos citados literalmente, porque ela existe para auditoria, não para licença | 430..449 |
| **F2-05** 🟡 | `W4` · `F2-01, F0-07` · `ambos` | Resolução: destaque de código | `resolucao/codigo/**` + cassetes | pré-computa tokens em build; tema e versão do destacador fixados; **nada de busca de tipos em CDN em tempo de execução** `[R09 §3 · refutação]` | 450..469 |
| **F2-06** 🟡 | `W4` · `F2-01, F0-07` · `ambos` | Resolução: música e efeitos | `resolucao/musica/**` + cassetes | **desbloqueado por `I-01`**; catálogo local com licença por faixa; nada de busca em tempo de render; e os efeitos do pacote do fornecedor são **URLs remotas** — precisam ser baixados para o store `[R03 §3 · refutação]` | 470..489 |

---

#### 🟣 W5 — onda de composição ★ (5 cards)

<details>
<summary><b>F1-12</b> · Suíte integrada de composição · <code>W5</code> · <code>deps: F0-06, F1-04…F1-11</code> · <code>disciplina: caracterizacao</code> · 🔴 crítico · <b>join in-degree 9</b></summary>

| | |
|---|---|
| **Objetivo** | O que nenhum nó sozinho prova: que os oito **juntos** produzem um vídeo coerente. É aqui que "merge limpo ≠ integração funcional" aparece ou não aparece. |
| **Dono de** | `tests/integracao/composicao/**` · `fixtures/snapshots/integrado/**` |
| **Entrega** | Render da fixture canônica inteira; snapshots dos frames-chave (entrada, meio e saída de cada nó, mais as fronteiras de transição); o **diff do manifesto resolvido** como primeiro oráculo, porque é barato e nomeia o que mudou; a asserção de duração total contra a soma calculada; e a checagem semântica de merge escrita no commit. |
| **Aceitação** | `just int:composicao` → exit 0 ·<br>`just det:provar --integrado` — 2× idêntico ·<br>`∅-crit:` remover um nó da fixture **tem de** ficar vermelho por **ausência**, e não passar por "menos frames para comparar" |
| **refuta** | *(1)* Dois nós escreveram testes contraditórios que passam separados? Procure asserções sobre *a lista completa* de algo. *(2)* A duração total bate com a soma, ou o teste só olha o exit code? *(3)* Algum snapshot foi aprovado a partir do Studio em vez do render? |
| **ledger** | AB-490..499 |

</details>

<details>
<summary><b>F2-07</b> · Suíte offline de resolução e o guarda de rede · <code>W5</code> · <code>deps: F2-02…F2-06</code> · <code>disciplina: caracterizacao</code> · 🔴 crítico · <b>join in-degree 5</b></summary>

| | |
|---|---|
| **Objetivo** | Provar a afirmação que sustenta o programa inteiro: **o pipeline abaixo da autoria roda sem rede**. |
| **Dono de** | `tests/integracao/resolucao/**` · `tools/offline-guard.*` |
| **Entrega** | O guarda que **bloqueia** a rede no processo de teste (não apenas "não usa"); a suíte que resolve a fixture canônica inteira a partir de cassetes; a asserção de que o manifesto resolvido não contém URL; e o relatório de quantas chamadas externas o cache absorveu — **com denominador**. |
| **Aceitação** | `just res:offline` → exit 0 com a rede bloqueada ·<br>`∅-crit:` um estágio novo sem cassete **tem de** derrubar a suíte |
| **refuta** | *(1)* O guarda bloqueia DNS, socket e subprocesso, ou só o cliente HTTP da linguagem? *(2)* "Zero chamadas externas" tem denominador? Sem ele, é verdade quando o cache está perfeito **e** quando nada rodou. *(3)* Algum cassete foi gravado com a chave real dentro? |
| **ledger** | AB-500..519 |

</details>

<details>
<summary><b>F3-01</b> · Timing canônico · <code>W5</code> · <code>deps: F2-01, F2-03</code> · <code>disciplina: tdd</code> · 🔴 crítico · <b>caminho crítico</b></summary>

| | |
|---|---|
| **Objetivo** | Um artefato único de tempo — palavras, frases, silêncios — do qual legenda, ducking e ritmo derivam. Três consumidores, uma fonte. |
| **Dono de** | `src/sincronia/timing/**` · `schema/timing.schema.json` · `tests/sincronia/timing/**` |
| **Entrega** | O schema de `timing.json`; a produção a partir do que `F2-03` fornece; **e** o caminho alternativo de alinhamento quando o provedor não fornece — escolhido por ADR e registrado no ledger, nunca decidido pelo agente. Unidade de tempo herdada de `F0-02`, sem conversão espalhada. |
| **Aceitação** | `just timing:testar` — a fixture canônica produz timing válido e monotônico ·<br>`just timing:determinismo` — 2× idêntico ·<br>`∅-crit:` um timing com palavra fora de ordem, com sobreposição ou com duração negativa **tem de** ser rejeitado |
| **refuta** | *(1)* Existe caminho em que a legenda aparece **antes** de a palavra ser falada? Escreva o teste. *(2)* O timing e o áudio podem divergir sem nada ficar vermelho? *(3)* O oráculo do timing deriva da mesma premissa que o produtor dele? Se sim, as duas cópias erram juntas. |
| **ledger** | AB-520..549 |

</details>

<details>
<summary><b>F4-01</b> · Contrato de autoria: saída estruturada e cache · <code>W5</code> · <code>deps: F0-02, F2-01</code> · <code>disciplina: tdd</code> · 🟡 · <i>folga 1</i></summary>

| | |
|---|---|
| **Objetivo** | Cercar a única parte do sistema que não se prova. O LLM decide **narrativa**; o sistema decide **frames, layout e cor**. |
| **Dono de** | `src/autoria/contrato/**` · `tests/autoria/contrato/**` |
| **Entrega** | Chamada com saída estruturada contra o schema do manifesto (respeitando as limitações reais do modo estrito, registradas no panorama); **cache por hash de (brief + prompt + modelo + parâmetros)**, que é a única garantia real de reprodutibilidade; e a fronteira explícita do que o LLM **não** decide. |
| **Aceitação** | `just autoria:contrato` → exit 0 ·<br>`just autoria:cache` — a mesma entrada não chama a API duas vezes; mudar qualquer componente da chave gera *miss* ·<br>`∅-crit:` uma saída que não valida contra o schema **tem de** ser rejeitada antes de tocar o pipeline |
| **refuta** | *(1)* O LLM consegue emitir coordenada, cor ou duração em frames? Deve ser impossível pelo schema. *(2)* "Temperatura zero" está sendo tratado como garantia de determinismo? Não é — o cache é. *(3)* O custo por vídeo é medido ou estimado? |
| **ledger** | AB-550..569 |

</details>

<details>
<summary><b>F4-02</b> · Biblioteca de prompt e decomposição narrativa · <code>W5</code> · <code>deps: F0-01, F0-02</code> · <code>disciplina: tdd</code> · 🟢 · <i>preenchedor de paralelismo — nível 2, folga 3</i></summary>

| | |
|---|---|
| **Objetivo** | O conhecimento de **como se escreve um roteiro técnico curto** virando artefato versionado, e não improviso a cada execução. |
| **Dono de** | `docs/autoria/prompts/**` · `tests/autoria/prompts/**` |
| **Entrega** | Os prompts por etapa (tema → esqueleto → nós → revisão), versionados e citados pelo hash; o dicionário de pronúncia de termos técnicos em pt-BR (fonte única, consumido depois pela locução); e os critérios editoriais mensuráveis vindos dos tokens — densidade de corte, palavras por minuto, tempo mínimo de leitura. |
| **Aceitação** | `just prompts:testar` — cada prompt tem um caso de referência cuja saída valida contra o schema ·<br>`∅-crit:` `rg -L "^versao:" docs/autoria/prompts/*.md` → vazio |
| **refuta** | *(1)* Algum prompt pede ao modelo que decida algo que o sistema deveria decidir? *(2)* O dicionário de pronúncia está duplicado em outro lugar? *(3)* Os critérios editoriais são números com fonte, ou opinião? |
| **ledger** | AB-570..579 |

</details>

---

#### 🟣 W6 — onda de composição ★ (5 cards)

> **Contratos congelados no `PREP-w6`, não negociados em tempo real:** o formato de `timing.json`
> (dono `F3-01`, congelado) · o nome e a semântica do envelope de ducking · o contrato de erro de
> `F4-03` (o que é reparável × rejeição definitiva).

| Card | Título · deps · disciplina | Dono de | Aceitação (∅-crit em negrito) | refuta | ledger |
|---|---|---|---|---|---|
| **F3-02** | Legendas a partir do timing · `W6` · `F3-01, F1-05, F0-04` · `ambos` 🔴 | `src/sincronia/legendas/**` | `just legendas` ·<br>**apagar a regra de caracteres-por-segundo tem de ficar vermelho** ·<br>**o invariante é em SEGUNDOS, nunca em frames:** `duração >= max(0,833 s; caracteres/20)` e `<= 7 s` `[R14-01·R14-11 (2-0)]`. Num manifesto *frame-based*, esta é a regra que mais provavelmente será reescrita em frames por conveniência — e 20 frames a 60 fps são 0,333 s, **quatro vezes abaixo do piso**, em silêncio | *(1)* Uma legenda viola o mínimo ou o máximo de duração da norma? *(2)* Existe caminho em que a legenda aparece antes da palavra? *(3)* A paginação estoura a safe area em vertical? | 580..599 |
| **F3-03** | Envelope de ducking (calculado, determinístico) · `W6` · `F3-01, F0-04` · `tdd` 🔴 | `src/sincronia/ducking/**` | `just ducking` ·<br>**um trecho com locução e sem atenuação tem de ficar vermelho** | *(1)* O envelope é calculado ou depende de um compressor cuja saída muda entre versões? *(2)* A atenuação começa **antes** da fala, ou em cima dela? *(3)* Dois trechos de fala colados produzem um degrau audível? | 600..614 |
| **F3-04** | Ritmo: corte de silêncio e cadência · `W6` · `F3-01` · `tdd` 🟡 | `src/sincronia/ritmo/**` | `just ritmo` ·<br>**o teste que prova que nenhuma palavra foi cortada** | *(1)* O corte de silêncio comeu o ataque de alguma palavra? Prove por comparação do timing antes e depois. *(2)* O resultado é idempotente? *(3)* O corte muda a duração total sem atualizar o manifesto? | 615..629 |
| **F4-03** | Validação e reparo do manifesto gerado · `W6` · `F4-01, F0-02` · `tdd` 🔴 | `src/autoria/reparo/**` | `just autoria:reparo` ·<br>**um manifesto irreparável tem de ser rejeitado, nunca "melhorado" até passar** | *(1)* O reparo altera semântica ou só forma? Alterar semântica é o LLM decidindo duas vezes. *(2)* Três tentativas com simplificação progressiva terminam? *(3)* O erro final diz **qual** regra falhou, ou só "inválido"? | 630..649 |
| **F4-04** | Cassete de autoria e a suíte de rejeição · `W6` · `F4-01, F2-07` · `caracterizacao` 🟡 | `fixtures/cassetes/autoria/**` `tests/autoria/**` | `just autoria:offline` ·<br>**um manifesto inválido que passa tem de derrubar a suíte** | *(1)* O cassete tem manifesto **inválido** gravado, ou só os bons? Só os bons não testa nada. *(2)* A fixture alimenta a própria asserção? *(3)* O cassete contém a chave da API? | 650..659 |

---

#### 🟠 W6.5 — infra

<details>
<summary><b>I-03</b> · Máquina de render: medir o teto antes de precisar dele · <code>W6.5</code> · <code>deps: T-08</code> · <code>disciplina: —</code> · 🔴 crítico</summary>

| | |
|---|---|
| **Objetivo** | Substituir por **medição** os números que a Parte VIII chuta. A concorrência da fase 5 é dimensionada por este card, não por intuição. |
| **Dono de** | `docs/medicao/maquina.md` · `docs/adr/0006-teto-de-concorrencia.md` |
| **Entrega** | Medição real, nesta máquina, de: RAM por worker de render; ponto em que aumentar concorrência para de ganhar; sessões simultâneas de encode que o hardware admite; throughput de disco com N worktrees; e o tempo de render por segundo de vídeo, com e sem aceleração. Cada número com o comando que o reproduz. |
| **Aceitação** | `∅-crit:` `rg -L "comando:" docs/medicao/maquina.md` → vazio — **todo número traz o comando que o reproduz** ·<br>`just medir:maquina --conferir` compara os números do documento com uma medição curta e falha se divergirem além da tolerância declarada |
| **refuta** | *(1)* Algum número foi copiado de documentação em vez de medido aqui? *(2)* A medição de "sessões de encode" testou o **limite**, ou parou antes? *(3)* O teto declarado deixa margem para o gate rodar ao mesmo tempo? |
| **ledger** | AB-980..989 |

</details>

---

#### 🔵 W7 — entrega e variantes (6 cards)

| Card | Título · deps · disciplina | Dono de | Aceitação (∅-crit em negrito) | refuta | ledger |
|---|---|---|---|---|---|
| **F3-05** | Trilha de áudio composta · `W7` · `F3-03, F2-06` · `ambos` 🔴 | `src/audio/mix/**` | `just audio:mix` · determinismo 2× ·<br>**um mix sem locução tem de ficar vermelho** | *(1)* A soma das faixas clipa em algum ponto? *(2)* O mix é determinístico entre versões da ferramenta? *(3)* A música cobre a locução em algum trecho? Meça, não escute. | 660..679 |
| **F5-01** | Pipeline de render e paralelismo · `W7` · `F1-12, F2-07, I-03` · `tdd` 🔴 | `src/render/pipeline/**` | `just render:fixture` ·<br>**render por faixa de frames + concatenação tem de bater byte a byte com o render inteiro** | *(1)* A concatenação de faixas produz o mesmo resultado que o render contínuo? Se não, o paralelismo é ilusório. *(2)* A concorrência excede o teto medido em `I-03`? *(3)* Um worker que morre deixa o pipeline verde? | 680..699 |
| **F5-02** | Perfis de encode · `W7` · `F0-04, I-03` · `tdd` 🟡 | `src/render/encode/**` | `just encode:perfis` ·<br>**um perfil sem alvo de qualidade declarado tem de falhar** | *(1)* O perfil de hardware está sendo comparado com o de software pelo mesmo eixo? Não dá — um não tem CRF. *(2)* Metadado não-determinístico foi removido? *(3)* O fallback de hardware para software é silencioso? | 700..719 |
| **F5-04** | Variantes de proporção · `W7` · `F1-12, F0-04` · `ambos` 🟡 | `src/entrega/variantes/**` | `just variantes` · snapshots por variante ·<br>**conteúdo fora da safe area de qualquer plataforma tem de ficar vermelho** | *(1)* O recorte vertical corta texto? *(2)* A safe area usada é a da plataforma certa? *(3)* A variante herda o mesmo timing, ou recalcula e diverge? | 720..734 |
| **F5-05** | Thumbnail · `W7` · `F1-12, F0-04` · `ambos` 🟢 | `src/entrega/thumbnail/**` | `just thumb` · determinismo ·<br>**thumbnail com contraste abaixo do mínimo tem de falhar** | *(1)* O texto do thumbnail é legível no tamanho em que ele aparece de fato? *(2)* É gerado do mesmo manifesto, ou digitado à parte e divergindo? | 735..744 |
| **F5-06** | Relatório de procedência · `W7` · `F0-07, F2-04, F2-06` · `tdd` 🟡 | `src/entrega/procedencia/**` | `just procedencia` ·<br>**um asset no vídeo final sem origem declarada tem de bloquear a entrega** | *(1)* O relatório cobre assets **transitivos** (o que entrou dentro de um gráfico)? *(2)* Ele registra a origem de cada asset com data e termos, ou só o nome do arquivo? *(3)* Se o enquadramento de uso mudar (`AB-950`), este relatório é suficiente para reavaliar o que já foi produzido — **sem re-renderizar**? Essa é a razão de ele existir agora que a licença não bloqueia | 745..769 |

---

#### 🔵 W8 — pescoço (2 cards)

| Card | Título · deps · disciplina | Dono de | Aceitação (∅-crit em negrito) | refuta | ledger |
|---|---|---|---|---|---|
| **F5-03** | Pós-processamento: loudness e sidecar · `W8` · `F3-05, F0-04` · `ambos` 🔴 | `src/entrega/pos/**` | `just pos` ·<br>**um entregável fora do alvo de LUFS tem de bloquear** | *(1)* A normalização foi aplicada duas vezes em algum caminho? *(2)* O *true peak* está dentro do limite depois da codificação, ou só antes? *(3)* O sidecar de legenda bate com o queimado? | 770..789 |
| **F5-09** | Cache de render e invalidação · `W8` · `F5-01, F0-07` · `tdd` 🟡 | `src/render/cache/**` | `just render:cache` ·<br>**mudar um token de design tem de invalidar o cache de render** | *(1)* A chave inclui a versão do compositor e a do navegador? *(2)* Um cache acertando pelo motivo errado é detectável? *(3)* A invalidação é por conteúdo ou por data? Por data é falso verde. | 790..799 |

---

#### 🔴 W9 — o join (1 card)

<details>
<summary><b>F5-07</b> · Orquestrador de ponta a ponta · <code>W9</code> · <code>deps: F4-03, F5-01, F5-02, F5-03, F5-04, F5-05, F5-06</code> · <code>disciplina: ambos</code> · 🔴 crítico · <b>join in-degree 7</b></summary>

| | |
|---|---|
| **Objetivo** | O ponto de integração de verdade. Tudo o que foi construído em paralelo encontra-se aqui pela primeira vez. |
| **Dono de** | `src/pipeline/**` · `justfile` (alvo `produzir`) · `tests/e2e/**` |
| **Entrega** | Um comando: tema → entrega completa. Estágios com falha nomeada e retomada por estágio; relatório de execução escrito **em arquivo**; e o **modo estrito** em que qualquer aviso vira erro, usado pelo gate. |
| **Aceitação** | `just produzir --fixture canonico --estrito` → exit 0 e produz todos os artefatos de entrega ·<br>`∅-crit:` remover **qualquer** artefato de entrega esperado tem de ficar vermelho por ausência, com o nome do artefato |
| **refuta** | *(1)* O pipeline declara sucesso com um artefato faltando? *(2)* Um estágio que falha deixa artefato parcial que o próximo consome? *(3)* A retomada por estágio usa cache velho quando a entrada mudou? *(4)* O relatório sobrevive ao fechamento do terminal? |
| **ledger** | AB-800..829 |
| **Nota de merge** | Este card **mergeia sozinho**. É a única onda com um card, e é assim de propósito. |

</details>

---

#### 🔵 W10 → W12 — o oráculo final, a revisão humana e o corte

| Card | Onda · deps · disciplina | Título e objetivo | Aceitação (∅-crit em negrito) | refuta | ledger |
|---|---|---|---|---|---|
| **F5-08** | `W10` · `F5-07, F0-06` · `caracterizacao` 🔴 | **Golden master de ponta a ponta.** O vídeo canônico congelado: manifesto resolvido + frames-chave + envelope de áudio | `just gm:e2e` · 2× idêntico ·<br>**qualquer mudança de token, de fonte ou de versão de ferramenta tem de acender o diff** | *(1)* O golden master compara o MP4 byte a byte? Isso é falso oráculo — o encoder muda. *(2)* O que ele **não** cobre está escrito? *(3)* Uma regressão de áudio sem regressão de vídeo é detectada? | 830..849 |
| **F6-01** | `W10` · `F5-07, F5-06` · `tdd` 🔴 | **Checklist de revisão humana.** O artefato que um humano assina antes de qualquer publicação | `just revisar` gera o dossiê ·<br>**entrega sem dossiê tem de bloquear a publicação** | *(1)* O checklist é assinável por papel nomeado, ou por "o time"? *(2)* Ele inclui os itens que só um humano pega? *(3)* Existe caminho que publica sem passar por aqui? | 850..869 |
| **F6-02** | `W11` · `F6-01, F5-08` · `—` 🔴 | **Runbook de publicação** — nasce `ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO` | `∅-crit:` **`rg -L "## O que este documento NÃO cobre" docs/runbooks/*.md` → vazio** · `rg -q "GATE P-1" docs/runbooks/publicacao.md` | *(1)* Alguém que não participou consegue seguir? *(2)* Cada item traz a evidência junto? *(3)* As perguntas estão segregadas por interlocutor? | 870..889 |
| **F6-03** | `W11` · `F6-01` · `—` 🔴 | **Gates numerados de publicação** (padrão do Apêndice G) | `just gates:validar` ·<br>**um gate com veredito `CONFERE` sem evidência anexada tem de falhar** | *(1)* Algum gate diz "boas práticas" em vez do dano concreto? *(2)* Existe `NÃO_COLETADO` que pode virar `CONFERE` sem evidência? *(3)* Quem assina está nomeado por papel? | 890..909 |
| **F6-04** | `W11` · `F0-03, F5-08` · `tdd` 🔴 | **Fechamento do ledger.** Aceite: zero itens abertos nas categorias bloqueantes | `python3 tools/validate-ledger.py --exigir-fechados --categoria plataforma,infra,operacao` ·<br>**um item fechado com evidência da lista negra tem de falhar** ·<br>`--permitir-aberto AB-950` **com justificativa exigida** — allowlist explícita, nunca silenciosa | *(1)* Algum item foi fechado por dedução? *(2)* Algum ficou `INVIÁVEL` sem ADR? *(3)* A ferramenta estreou hoje? Se sim, ela vai falhar hoje. *(4)* **A allowlist tem mais de um item?** Cada item nela é uma exceção que ninguém mais vai reperguntar — duas já são um padrão, e padrão de exceção é o gate morrendo devagar | 910..929 |
| **F6-05** | `W12` · `F6-02, F6-03, F6-04` · `—` 🟡 | **Arquivamento e escopo negativo.** Congela por escrito o que era vivo, o que morreu e o que virou manual | `∅-crit:` **`rg -L "virou manual" docs/arquivamento.md` → vazio quando existir gate removido** | *(1)* Algum gate automático foi removido sem registro de que a regra virou manual? A ausência de um verificador é indistinguível de conformidade. *(2)* A seção "o que ninguém conferiu" existe? | 930..949 |

---

#### 🟠 W9.5 — infra

<details>
<summary><b>I-04</b> · Canal de publicação e política editorial · <code>W9.5</code> · <code>deps: I-01</code> · <code>disciplina: —</code> · 🟡</summary>

| | |
|---|---|
| **Objetivo** | Responder, com assinatura humana, a pergunta que nenhum agente pode responder: **o que conta como um vídeo publicável em nome de quem.** |
| **Dono de** | `docs/politica-editorial.md` · `docs/adr/0007-canal-e-politica.md` |
| **Entrega** | Quem é o dono editorial; o que nunca é publicado sem revisão; o que fazer quando um vídeo publicado precisa ser corrigido; a alavanca-mestra que desliga a publicação inteira; e o que a política **não** cobre. |
| **Aceitação** | `∅-crit:` `rg -L "alavanca-mestra" docs/runbooks/*.md` → vazio — todo runbook subordinado cita a alavanca maior |
| **refuta** | *(1)* Quem reverte é a mesma pessoa que decide o que é válido? Não deveria — reverter tráfego e corrigir conteúdo são papéis diferentes. *(2)* A política diz o que fazer no caso em que ninguém pensou? |
| **ledger** | AB-990..999 |

</details>

---

<!-- ESTADO:GERADO -->
### §III-15. Estado do programa

> ⚠️ **Esta seção é gerada por `T-07`.** Não edite à mão. Se ela discordar dos cards, o gate falha
> e **ela** é a que está errada.

```
Ondas concluídas: (nenhuma — o programa não começou)
Próxima onda:     W0
Cards:  65 total · 0 concluídos
        severidade: 41 🔴 críticos · 19 🟡 · 5 🟢
        fases: F0=9 · F1=12 · F2=7 · F3=5 · F4=4 · F5=9 · F6=5 · T=10 · I=4
Grafo:  profundidade 11 · onda mais larga 13 · 0 órfãos · 0 ciclos · 0 deps laterais
Ledger: 0 itens · 0 abertos · 0 fechados
Gates:  G-LIC G-DET G-OFF G-PROC G-LED G-HUM P-1..P-5 — todos PENDENTE
ADRs:   0000/10 escritos
Cards suspensos por gate de infra: nenhum (I-01 RESPONDIDO — uso pessoal)
Ledger: AB-950 ABERTO por desenho — gatilho de reabertura do enquadramento
```

> A proporção de críticos é alta — **63%** (41 de 65) — e isso é informação, não descuido. Num programa em
> que quase tudo produz artefato binário verificado por snapshot, ou o card tem oráculo capaz de
> reprovar, ou ele não deveria existir (ADR-0001). Se essa proporção cair muito ao longo do
> programa, a hipótese mais provável não é que o trabalho ficou mais fácil: é que alguém rebaixou
> a severidade para escapar do gate.

---

## Parte IV — Verificação em camadas

> **Leia isto antes.** A cadeia abaixo é desenho, não histórico. Ela ainda não pegou nenhum
> defeito porque ainda não rodou. O que se pode afirmar é o critério de desenho de cada camada,
> e ele é sempre o mesmo:
>
> ### ***Se isto desaparecer, o que fica vermelho?***
>
> Uma camada que não responde essa pergunta não é camada, é decoração. E o corolário que
> organiza a parte inteira: **ausência não falha sozinha. Se a cobertura pode encolher sem nada
> ficar vermelho, ela vai encolher — e o verde continua com a mesma cara.**

### §IV-1. O gate local é o pipeline

Uma etapa **por job** da definição de CI — não por *stage*. Confundir os dois é como se edita a
definição errado.

Três decisões que valem mais que a lista de etapas:

- **Ferramenta ausente é VERMELHO, não "pulado".** "Pulado" e "passou" imprimem a mesma conclusão
  operacional — *o gate não reclamou* — e a máquina onde falta a ferramenta é justamente a que vai
  declarar verde para sempre. Este projeto tem seis dependências de sistema que podem faltar
  (Node, Python, FFmpeg, LaTeX, Chrome do Remotion, driver de GPU). Cada ausência é vermelha e
  **nomeada**.
- **Três estados, não dois:** `PASS`, `FAIL` e **`NÃO-EXERCITADO`**, e o terceiro imprime junto
  com o veredito. Um gate novo que ninguém conecta não fica vermelho: fica **invisível**. Por
  isso gate que ainda não existe é anunciado como `PENDENTE`, nunca omitido.
- **Fonte única de definição:** o gate local **lê** a definição do CI em vez de duplicá-la. Duas
  listas mantidas à mão recriam o mesmo buraco do outro lado.

### §IV-2. Aceitação falsificável — a camada mais importante deste programa

O achado mais transferível do playbook, e o que mais se aplica aqui: **todo runner que aceita
seletor sai verde quando o seletor não casa nada.** `vitest -t`, `jest -t`, `pytest -k`,
`go test -run`, e o filtro de composição do render. No programa de origem, 25 de 42 cards tinham
exatamente esse critério — **o critério passava antes de a tarefa escrever a primeira linha**.

O verificador deste programa (`T-06`) faz cinco coisas, e as cinco são obrigatórias:

1. **Parseia o próprio `PROGRAMA.md`** — lê os cards e extrai os comandos de aceitação da tabela
   *e* do prompt XML (união, deduplicada). O parser do documento de gestão é **código de
   produção**: tem autoteste e falha fechado.
2. Para cada card **marcado como concluído**, exige que cada seletor case **≥1 teste**, por
   descoberta e sem execução.
3. **Sonda negativa por alvo:** um seletor deliberadamente impossível *tem de* listar zero. Se
   uma regressão do runner fizer a descoberta ignorar o seletor, *todo card passaria* — a sonda
   converte isso em vermelho.
4. **Tripwire independente:** conta ocorrências num texto normalizado **diferente** do que o
   parser lê. Existe porque um adversário — ou um merge distraído — derruba um parser com HTML no
   meio do token, caractere de largura zero ou hífen suave.
5. **Zero cards parseados = falha**, nunca verde. Significa que o formato do documento mudou e o
   verificador ficou cego.

E cada card carrega o guarda no próprio texto, como prosa que explica o mecanismo:

```
# GUARD: o seletor acima TEM de casar >=1 teste — 0 matches também sai exit 0 (falso verde).
# A garantia não é este comentário; é T-06 rodando dentro do gate.
```

#### Como é um critério bom, neste projeto

| | Critério | Por quê |
|---|---|---|
| **Bom** | `rg -L "PROCEDENCIA" assets/**/*.json` → **saída vazia** | falha por **ausência**: um asset novo sem procedência derruba. A maioria dos testes só falha por presença errada |
| **Bom** | renderizar 2× em rascunho + `diff` byte a byte dos frames | **dois oráculos**: executa *e* prova determinismo |
| **Bom** | render + asserção de que a entropia do frame > limiar | pega o quadro preto que `exit 0` não pega |
| **Bom** | mudar um parâmetro da chave de cache e exigir **cache miss** | prova que a chave não omite entrada |
| **Fraco** | `npm test -- -t "X"` | passa com zero testes casados |
| **Fraco** | "o vídeo ficou bom" | não é comando |
| **Fraco irredutível** | "pipeline verde (registrar a URL do run)" | não roda localmente; a evidência é uma URL colada à mão. Aceito, mas **declarado como irredutível** |

> **Todo card inclui ao menos um critério que falha por ausência.** É a classe que o resto não
> cobre, e é a única que detecta cobertura encolhendo.

### §IV-3. Invariantes estruturais — verificáveis sem executar nada

Afirmações sobre a **topologia** do pipeline e do repositório, checáveis sem runner e sem render:

| Invariante | O que impede |
|---|---|
| Todo projeto de teste do repositório é executado por **algum** job | o buraco real do programa de origem: 95 de 219 testes fora do CI em silêncio |
| Nenhum literal de token de design aparece fora de `src/design/tokens.*` | o valor duplicado que diverge no merge |
| Nenhum arquivo em `assets/` sem `procedencia.json` correspondente | asset sem licença rastreável dentro do MP4 publicado |
| Nenhuma URL remota em `manifesto-resolvido.json` | render não reproduzível offline |
| Nenhum `Date.now`/`Math.random`/`setTimeout` sob `src/composicao/` | não-determinismo no lado puro |
| Todo id de composição registrado é único | dois cards registrando o mesmo id, merge limpo |
| Nenhum segredo literal — varredura **estrutural** no arquivo já parseado, não no texto cru | varrer texto cru acusa o próprio padrão escrito dentro do script |
| Etapas caras (render completo, VM, GPU) são **terminais** no grafo de jobs | job rápido esperando infraestrutura pesada |
| **Ausência do que foi removido por decisão**, nos dois sentidos | reintrodução silenciosa, e divergência CI × gate local |

Quatro detalhes que valem mais que a lista:

- **Um invariante que perde o objeto muda de tipo, não é apagado.** Se um estágio sai do pipeline,
  o invariante vira *ausência* — e ausência é uma afirmação verificável. É por isso que o script
  continua existindo em vez de ser deletado.
- **Falha fechado.** Um detector que não entende o que está lendo **recusa explicitamente**, em
  vez de pular em silêncio. Aceitar seria afirmar uma garantia sobre um documento que não foi
  inteiramente lido.
- **Duas redes ortogonais** sempre que possível: o que o job *declara* e o que o job *executa*.
- **Preferir prefixo/substring a igualdade exata** em detectores de segurança: um falso positivo
  é barulhento e corrigível; o silêncio é como o problema volta.

### §IV-4. O autoteste roda ANTES do verificador

> *Um verificador que só sabe dizer OK é um comentário com `exit 0`.*

Toda ferramenta de verificação deste programa (o validador de grafo, o verificador de aceitação,
o checador de invariantes, o linter de skill, o validador de ledger) carrega um autoteste que:

- roda **antes** dela no gate;
- **asserta a mensagem, não o código de saída** — porque, com uma perna sintética, um invariante
  qualquer dispararia sozinho e todo caso "passaria pelo motivo errado". *Um autoteste que asserta
  só o código de saída não distingue "acusou" de "quebrou".*
- usa mutações **calculadas do documento corrente, nunca literais** — mutações literais viram
  no-op a cada merge, o autoteste grita "a mutação passou" e ensina a ignorá-lo.

### §IV-5. Hooks — separe *nudge* de *gate*

> **Prosa numa skill é conselho; um hook é garantia.**

| Hook | Evento | Papel | Falha |
|---|---|---|---|
| **Gate de escrita de skill** | antes de editar `**/SKILL.md` | bloqueia escrita sem token verde de verificação, TTL curto | fechado |
| **Gate de segurança** | antes de ler/escrever/executar | segredos, chaves, reescrita de história do git, `add -A`, e a leitura de segredo via shell que contornaria a guarda de caminho. Vale recursivamente para subagentes | fechado |
| **Barreira de onda** | ao terminar a resposta (`Stop` / `SubagentStop`) | anexa uma linha por agente ao arquivo de status da onda — é isto que torna a barreira **durável e contável** | aberto |
| **Nudge de calibração** | a cada mensagem | reinjeta as regras C1, C2, C9 e C12 da Parte 0 (~130 tokens) porque o arquivo normativo é lido **uma vez** e sai de atenção | aberto |

Três decisões de projeto:

- **Todos falham abertos diante de entrada inesperada**, exceto os dois de segurança. Um hook
  quebrado reporta em vez de inutilizar a sessão.
- **Escopo estreito o bastante para não ser desligado.** Uma proteção que dispara em trabalho
  comum acaba desligada, o que é pior que não tê-la. E: *um gate que só pode ser satisfeito
  contornando-o ensina a contornar.*
- **O nudge é honesto sobre si mesmo** e diz, no próprio texto, que é lembrete e não garantia.

> **Regra.** Gate mecânico **só** onde o erro é irreversível ou auto-amplificante — memória
> persistida, segredo, história do git, snapshot aprovado. Nudge de contexto para o resto. E diga,
> no arquivo, qual é qual.

### §IV-6. Estado derivado, nunca escrito à mão

> Um cabeçalho velho é pior que nenhum: é lido com a autoridade de documentação e está errado.

O verificador `T-07` **deriva** o estado do programa da árvore de cards — que é a fonte de
verdade, versionada card a card — e **falha se a prosa discordar**, imprimindo o texto que ela
deveria carregar.

Duas sutilezas que só aparecem na prática e que já estão codificadas na especificação de `T-07`:

- **"Concluídas" é o prefixo ininterrupto de ondas, não o conjunto.** Uma onda tardia terminando
  cedo não pode ser reportada como progresso que o programa não fez.
- **A comparação é isolada por linha, não por seção.** Uma linha nova em outro ponto da mesma
  seção pode satisfazer sozinha a exigência e a checagem passa sem olhar o que devia.

> **Regra.** Todo número que aparece em prosa e existe numa fonte estruturada é **gerado ou
> conferido**, nunca redigitado. Onde a prosa editorial cita um número da fonte, **confira em vez
> de gerar** — mover a prosa para dentro do script é pior, mas deixá-la sem checagem é como ela
> apodrece.

### §IV-7. As nove camadas, na ordem em que se constroem

1. Gate local executável, **antes** de qualquer CI. Uma etapa por job; ferramenta ausente = vermelho.
2. Fonte única de definição — o gate local *lê* o CI.
3. Invariantes estruturais, verificáveis sem executor.
4. Autoteste adversarial de cada verificador, rodando *antes* dele, assertando **a mensagem**.
5. Espelhamento bidirecional CI ⇄ gate local, ele próprio um invariante.
6. Aceitação de card amarrada a teste real, com sonda negativa e tripwire.
7. Documento de estado derivado.
8. Hooks de máquina só onde o erro é irreversível ou se auto-amplifica.
9. Setup de worktree com preflight que prova acesso ao insumo.

---

## Parte V — Memória e incerteza

### §V-1. A biblioteca de skills

> **O arquivo de skill *é* a memória — não há arquivo de aprendizados e não há buffer.**

Não existe onde um aprendizado repouse "não verificado ainda". Ou ele entra, e aí passou pelo
gate, ou não existe. *Um arquivo de learnings é exatamente o buraco por onde entra conhecimento
sem prova — e depois é recuperado como se fosse verdade.*

Correlato: **proibido data e changelog no corpo da skill.** História pertence ao git. A proibição
vale para a skill, **não** para o ADR — lá a data é obrigatória, porque um ADR é um registro
datado por definição. Esta regra é aplicada pelo linter como **erro**, não como aviso.

#### O gate de escrita, em três camadas

| camada | pergunta |
|---|---|
| **forma** | frontmatter válido, nome casando com o diretório, tipo no vocabulário fechado, tamanho, seções obrigatórias presentes |
| **deriva** | a linha citada **ainda é a mesma**? (hash de conteúdo recomputado) |
| **regressão** | as asserções de fato e de roteamento ainda passam? |

Falhou qualquer uma → token apagado, `exit 1`. O token é **gitignorado**, local, efêmero, nunca
herdado por outra worktree, e tem **TTL curto**: um verde de meia hora atrás não autoriza mais
uma escrita.

O que isso previne, na frase que vale enquadrar:

> **O agente não é um juiz confiável de se o próprio aprendizado está correto. Confiança não é
> evidência.**

E o limite honesto desta camada, declarado para que ninguém a compre por mais do que ela é: o
hash prova que **a linha não mudou**, jamais que ela **sustenta** a afirmação. *Proveniência
detecta deriva, não correção.* É por isso que o eval existe, e por isso o eval se escreve
**antes** da prosa: uma afirmação que não pode ser assertada não tem como detectar a própria
decadência.

#### A deriva já aconteceu neste repositório, e foi medida

Não é hipótese. As 20 skills foram escritas em paralelo, citando `arquivo:linha` deste documento.
Depois disso, **este documento foi editado pesadamente** — decisão de uso pessoal, correção do
caminho crítico, reordenação de severidades. Toda âncora de linha escrita antes dessas edições
apontava para um alvo que se moveu.

Medição, antes e depois da correção:

| Forma de citação | Antes | Depois | Sobrevive a uma edição do alvo? |
|---|---|---|---|
| `arquivo:linha` para documento **vivo** | **438** | **0** | **não** — o alvo desliza |
| `§seção` / id de card | 37 | **456** | sim |
| id de claim (`R07-06`, `AB-041`, `L02-C11`) | 109 | **231** | sim — o id é estável |
| URL | 426 | 368 | sim |
| `arquivo:linha` para documento **congelado** (`docs/pesquisa/`, `3b1b:`) | — | mantidos | sim, por acordo: aqueles arquivos não são editados |

Uma varredura mecânica achou **3 âncoras apontando para linha vazia ou separador** — 0,7%. Escrevi,
na primeira versão deste parágrafo, que *"esse número é um limite inferior, não o dano"*. Era, e a
diferença acabou sendo de duas ordens de grandeza.

**O dano real, medido depois, abrindo cada alvo:** dos pinos para `PROGRAMA.md`, **16 de 21** numa
skill e **7 de 9** noutra apontavam para conteúdo alheio — cabeçalho de tabela, bloco de código do
Apêndice A, legenda de campo, linha de aceitação de outro card. Nenhum deles aparecia na varredura
de linha vazia. Todos liam como proveniência forte.

> **A lição que só a medição dá:** a varredura barata (linha vazia) acha 0,7%; a cara (abrir e
> conferir se o alvo *sustenta* a afirmação) acha ~75%. **Um verificador que só sabe detectar a
> forma degenerada mais óbvia não mede o defeito — mede a si mesmo.** Foi por isso que a correção
> não foi "somar o offset": foi **eliminar a forma**.

E a demonstração ao vivo, registrada por um dos agentes de conversão enquanto trabalhava:

> *"O `PROGRAMA.md` foi editado por outro processo enquanto eu trabalhava — 2.966 para 3.000
> linhas; o card `I-01` saiu da linha 997 para a 1031. Toda verificação final foi feita por busca
> de conteúdo, não por número de linha."*

O documento se moveu **durante o conserto do problema causado por ele se mover**. Não há prova
melhor de que o alvo é vivo.

Três consequências, e as três já estão em card:

1. **`arquivo:linha` para um documento vivo é a forma degenerada do pin neste repositório.**
   `T-10` (`check_staleness.py`) tem de recusar essa forma quando o alvo é `PROGRAMA.md` ou o
   panorama, e exigir `§seção` ou id de claim — que são estáveis por construção.
2. **Para código, o pin correto é `arquivo:linha@hash`** — hash de conteúdo da linha, gerado por
   script, jamais escrito à mão. É o que transforma a citação de *endereço* em **asserção de
   conteúdo**.
3. **A ordem de escrita importa mais do que parecia.** Skills que citam um documento que ainda
   está sendo editado nascem com dívida de proveniência. O `PREP` de qualquer onda que produza
   skills tem de declarar quais documentos estão **congelados** para aquela onda.

> **Por que isto está registrado aqui e não escondido:** a ausência de um verificador é
> indistinguível de conformidade. Se este parágrafo não existisse, as 438 âncoras continuariam
> lendo como proveniência forte — e a primeira pessoa a descobrir o contrário seria alguém
> tentando reconferir uma afirmação e encontrando outra coisa na linha.

#### Entra ou é descartado — default: descartar

1. **É importante?** Quatro condições **simultâneas**: não-óbvio, **não inferível do código por
   um modelo capaz**, não-volátil, e *muda como tarefas futuras nessa área devem ser feitas*.
   *A maioria dos achados falha aqui. Esse é o desfecho saudável, não uma falha.*
2. **É verificado externamente?** A fonte citada tem de **implicar** a afirmação, não apenas
   existir.
3. **Conflita?** **Substituir** a passagem antiga — nunca anexar a regra concorrente ao lado, o
   que deixaria a skill segurando as duas e uma recuperação futura escolheria uma ao acaso.
4. **Gate:** escreva a asserção **antes** da prosa, depois rode a verificação.
   **Promover ou descartar, sem merge parcial.**
5. **Commit próprio.**

E a exigência mais sutil, ao editar: **manter a condição de escopo.** *Nunca remova o escopo para
economizar palavras: uma regra que perde sua condição de validade vira uma regra que está errada
em todo o resto.* Neste projeto isso é epidêmico — quase toda regra vale "no renderer OpenGL", ou
"acima da versão X", ou "só no encoder de hardware", ou "só quando o alfa é pré-multiplicado".

#### O problema novo: 20 skills

O catálogo deste programa tem **20 skills** — acima do limiar em que roteamento por palavra-chave
degrada. Duas mitigações, ambas obrigatórias:

- **Roteamento em dois níveis:** o router escolhe o *tier* (`metodo` | `dominio` | `meta`) e só
  então a skill dentro do tier.
- **Evals de roteamento com near-misses**, rodados pela consolidação: queries que **devem**
  disparar uma skill específica e queries que **não devem** disparar nenhuma. A precisão de
  roteamento é um número medido, não uma impressão. Quando duas skills competem pelos mesmos
  gatilhos, a consolidação **propõe fusão** — sobreposição de gatilho é dívida, não redundância
  saudável.

### §V-2. O ledger de incerteza

**Não é um registro de riscos. É uma fila de trabalho para um dia futuro.**

A decisão de nível de programa vem primeiro, e é uma frase:

> **Avançar o máximo possível contra o que se pode provar localmente, e deixar EM ABERTO —
> nunca resolver por palpite — tudo o que só o ambiente real, uma conta paga, uma licença ou
> uma decisão humana pode responder.**

Sem essa frase, cada agente resolve por plausibilidade e ninguém sabe onde.

#### Os cinco campos, e por que os dois últimos são os que importam

1. a pergunta
2. por que a base de código não responde
3. o que se assumiu enquanto isso
4. **o teste que fecha a questão** — executável: um comando, uma query, um experimento, ou a
   pergunta objetiva **e para quem**
5. **o que se quebra se a resposta for outra** — nomeando as fixtures, os snapshots e os gates a
   recapturar

> *Item aberto sem passo executável de verificação é item que ninguém consegue fechar no dia do
> acesso; ele não está aberto, está **esquecido**.*

Sem os dois últimos é um TODO. E os campos obrigatórios são **validados por script**, não por
revisão.

#### Classifique por quem responde, não só por risco

O ledger deste programa deriva, do texto de cada item, o **interlocutor mais barato que ainda
responde**: `dono` (mandato, orçamento, apetite de risco) · `jurídico` (licença, direito de
imagem e voz) · `infra` (máquina, GPU, rede) · `plataforma` (conta de API, quota, aprovação de
chave de produção) · `operação` (o que conta como vídeo publicável). *É isso que transforma o
catálogo numa agenda* — e neste projeto vários itens exigem antecedência de dias.

#### Âncora no código

`// ABERTO AB-nnn: <o que se assumiu>` no ponto exato da suposição. **O catálogo encontra o
código e o código encontra o catálogo.** Um invariante do gate exige que todo id citado no código
exista no ledger, e que todo item aberto do ledger com âncora declarada tenha a âncora presente.

#### Como sobreviver a N worktrees paralelas

O arquivo do ledger é um array único: várias worktrees acrescentando ao fim dele **conflitam no
fecho do array, sempre**. A solução, e ela é obrigatória desde a W0:

- **ids pré-alocados por faixa**, reservados no commit `PREP` da onda;
- **um arquivo de inbox por card** (`ledger/inbox/<CARD>.json`), nunca o arquivo compartilhado;
- **consolidação pelo orquestrador**, depois do merge;
- **ids nunca reciclados** — o número é citado no código;
- **procurar antes de abrir** — referenciar, não duplicar;
- **vocabulário fechado de categorias**, e o gerador **recusa** categoria fora da lista. Sem isso,
  quatro worktrees paralelas inventam cinco categorias novas ao mesmo tempo, cada uma sem ver as
  outras.

#### Como vira gate

Um card nomeado cujo aceite é **"zero itens abertos na categoria X"**, com um script binário que
decide isso — e **esse script roda no gate desde o dia 1**, verde com tudo aberto.

> *Ferramenta que estreia no dia do fechamento é ferramenta que falha no dia do fechamento.*

**Fechar é mais regulado que abrir.** "Evidência" tem forma verificável por expressão regular —
`arquivo:linha`, saída de comando salva, relatório de diff, ADR nominal, ou resposta atribuída
com data — **mais uma lista negra** que rejeita `"ok"`, `"confirmado"`, `"conforme combinado"`,
`"resolvido"`. Sem a lista negra, a regra vira decorativa.

> **Item marcado CONFIRMADO sem evidência anexada é pior que item aberto: ele para de ser
> reperguntado e vira premissa invisível.**

Estado terminal honesto: **`INVIÁVEL`**, com ADR. Sem ele, o inverificável ou fica aberto para
sempre — virando ruído — ou é fechado por dedução, virando mentira.

### §V-3. ADRs com guarda executável

Três campos diferenciam o formato deste programa de um ADR comum:

- **`Guarda executável`** — o comando de teste que **falha se a decisão for violada**.
  *Se você não consegue escrever a guarda, a decisão é uma intenção.*
- **`Supera` / `Reafirma explicitamente`** — o que este ADR revoga **e** o que continua valendo.
  Sem o segundo, "supera" vira revogação silenciosa do documento inteiro.
- **`O que o sign-off NÃO autoriza`** — a cláusula que impede que uma assinatura para um caso
  seja lida como assinatura para todos.

Mais quatro estados de `Status` que o formato clássico não tem e que este programa vai precisar:

```
PROPOSTO — esqueleto vazio                   ← não pode ser preenchido por dedução
ENCERRADO SEM DECISÃO                        ← é um desfecho registrado, não um esquecimento
ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO    ← a Parte VII inteira vai nascer assim
ACEITO (sign-off de <nome>, <data>)          ← + por que o sign-off era exigido
```

> **Regra dura, herdada sem alteração:** qualquer decisão que exponha o programa a obrigação
> jurídica de terceiro — licença de software comercial, termos de API, direito de voz, direito
> autoral de trilha — exige **assinatura humana nominal e datada**, com a cláusula do que ela não
> autoriza. Nenhum agente resolve isso por plausibilidade, e o gate rejeita o card que tentar.

---

## Parte VI — Operação da onda

### §VI-1. O ritual de entrada de uma tarefa

Oito passos, cada um prevenindo uma falha nomeada:

1. **Desambiguar antes de tocar em qualquer arquivo**, com um questionário fixo escrito em cima
   das armadilhas reais deste projeto, **em português**, terminando sempre em *"o que
   explicitamente NÃO fazer"*.
2. **Escrever o acordo** num artefato nomeado e gitignorado (`TASK_PLAN.md`).
3. **Classificar** — fase, tier de skill, se toca singleton, se altera saída visual ou sonora.
   É a classificação que dispara as obrigações.
4. **Selecionar o conhecimento** do catálogo, por *do que a tarefa trata*, não por *o que ela
   menciona*.
5. **Montar a cadeia** — o que roda em paralelo por contexto isolado.
6. **Carregar o conhecimento antes de implementar.**
7. **Executar contra o plano.** Se o plano estiver errado, revisar com o usuário em vez de
   divergir em silêncio.
8. **Ao concluir:** rodar a evolução de memória de cada skill envolvida e **apagar o plano**.

#### A assimetria card × tarefa avulsa

> Quando o usuário chega com um prompt de card, **o card já é a especificação** — escopo,
> entradas, saídas, dependências, critérios e armadilhas estão nele. Não repita as perguntas do
> passo 1: **pergunte só o que o card deixa em aberto.**

Mas o card ganha uma obrigação que a tarefa avulsa não tem: **ler o handoff de toda a cadeia de
ancestrais**, direta e transitivamente, porque o card foi escrito antes das ondas anteriores
rodarem e pode estar desatualizado por elas.

> **Regra.** Quando existe spec a montante, o ritual de entrada não é "perguntar", é **diferença**.

#### O plano descartável e os artefatos que nunca se apagam

`TASK_PLAN.md` é gitignorado e apagado no encerramento. Um plano que sobrevive à tarefa vira
documento normativo por acidente e passa a ser lido por tarefas futuras como verdade corrente.

Mas a regra "apague o plano ao terminar" é exatamente a que, mal executada, leva junto a memória
do projeto. Por isso os **permanentes são nomeados**, e a separação é testada:

| Artefato | Descartável? |
|---|---|
| `TASK_PLAN.md` | **sim** — apagado ao concluir |
| `PROGRAMA.md` | não |
| `docs/00-panorama-verificado.md` | não |
| `docs/PLAYBOOK-REFERENCIA.md`, `docs/CONTRATO-*.md` | não |
| `docs/pesquisa/**` | não |
| `docs/adr/**`, `ledger/**` | não |
| `.agents/skills/**` | não |
| snapshots aprovados | não — e são **imutáveis** |

#### As duas regras não negociáveis

De todo o conhecimento deste projeto, exatamente **duas** skills têm carregamento obrigatório por
classe de tarefa, e não por julgamento do agente. Duas, não vinte — porque as duas falhas que
elas cobrem são **silenciosas e confirmatórias**, e nenhum teste posterior as pega:

- **toda tarefa que altera saída visual ou sonora carrega antes `video-characterization`** —
  porque "o render passou" parece prova e não é;
- **toda tarefa que escreve num arquivo tocado por outro card carrega antes
  `parallel-worktrees`** — porque escopo contido *parece* contido, e o merge limpo confirma a
  ilusão.

### §VI-2. Worktree por tarefa, com preflight

Um `git worktree add` puro **não resolve o problema**: a worktree materializa apenas o que está
commitado, e neste projeto o insumo crítico é justamente o que não está — o store de assets, os
modelos de TTS/ASR baixados, o Chrome do Remotion, os binários. O agente busca, encontra zero, e
**isso é indistinguível de "não existe"**.

O script de criação (`T-04`) faz cinco coisas:

1. **valida o identificador** contra os formatos aceitos (`<FASE>-<NN>` da árvore, ou
   `PREP-<slug>` para trabalho que **não é card**);
2. **recusa** os identificadores da trilha de infra, com explicação — eles rodam no branch de
   integração;
3. cria a worktree a partir do branch de integração;
4. **symlinka o insumo gitignorado** e o acrescenta ao exclude local — porque o padrão de
   `.gitignore` com barra **não cobre symlink**;
5. roda um **preflight** com valores conhecidos, e falha com `exit 1` deixando a worktree para
   inspeção:
   - um asset conhecido resolve no store e o hash bate;
   - o binário do FFmpeg responde e a versão é a fixada;
   - uma composição-canário renderiza um still e o hash do PNG bate com o esperado;
   - o linter de skill roda e sai zero.

E imprime, ao final, **o que não funciona por design naquele ambiente** — para o agente não gastar
um ciclo descobrindo.

> **Regra.** O setup de ambiente de agente termina com um **teste que prova acesso ao insumo
> crítico com um valor conhecido** — não com "criei a pasta". Ambiente que falha em silêncio
> produz agente confiante e errado, e a falha aparece só no merge.

### §VI-3. Swarm × subagentes

| | decide | isolamento |
|---|---|---|
| **worktree** | paralelismo **entre** cards | diretório + branch |
| **subagentes** | paralelismo **dentro** de um card | contexto |

**"Agente único" é o default explícito de todo card**, e o card que quiser fan-out declara a
topologia e justifica o custo. O padrão que funciona é **fan-out para ler, funil para escrever**:
N subagentes investigam em contexto isolado e devolvem ~1 página destilada com citações; **a
escrita é do agente principal**, que enxerga o conjunto.

> **Regra.** Paralelize **investigação**. Serialize **decisão e escrita** quando a consistência
> entre as peças é o produto. E quem detecta *classe* de erro precisa ver o arquivo inteiro, não
> uma fatia — fatiar demais cega o agente para a categoria do defeito.

### §VI-4. Revisão adversarial

Nenhum card pede "revise". Todo card pede **refutação por um agente de contexto zero, antes de
concluir**:

```
Antes de concluir, lance um subagente de CONTEXTO FRESCO que recebe APENAS o diff e este
card, e tenta REFUTAR:
   <pergunta falsificável 1, específica do domínio>
   <pergunta falsificável 2>
   <pergunta falsificável 3>
Corrija o que ele derrubar antes de encerrar.
```

**Por que adversarial:** o revisor não vê o histórico da conversa do implementador, então não
herda nem a pressa nem as premissas.

> **Regra dupla.** (1) Contexto zero, tarefa escrita como *tentativa de refutação*, nunca como
> "aprovar/reprovar". (2) **O oráculo e a implementação não podem derivar da mesma premissa não
> verificada** — se o motor e o teste repetem a mesma suposição errada, as duas cópias erram
> juntas e o teste diferencial fica cego.

**As perguntas vêm do card**, escritas por quem orquestra, **antes**. Não do executor. Essa é a
única forma de fechar a brecha óbvia do mecanismo — quem escolhe a pergunta escolhe o resultado.

**Limite honesto, para não vender mais do que é:** a revisão adversarial reduz o erro que o autor
não *veria*; não corrige o erro que ele não *quer* ver. E não existe taxa: casos de sucesso são
anedota.

O banco de perguntas por domínio está no **Apêndice F**.

### §VI-5. Quando a premissa do card cai

Vai acontecer, e é o mecanismo funcionando. Todo card autoriza explicitamente:

> *Uma consideração de um ancestral distante pode invalidar uma premissa deste card — se isso
> ocorrer, ajuste o plano e diga por quê; **não siga no automático**.*

**Classifique antes de agir:**

| A premissa é… | Exemplo neste projeto | O que fazer |
|---|---|---|
| (i) **fato sobre o mundo** | "o formato de alfa escolhido toca no Chrome" — não toca | cumpra o card **pelo que ele quis**; entregue menos e **nomeie a diferença** |
| (ii) uma **entrada** | "a fixture tem caso com acento" — não tinha | **estenda a entrada**, anunciando quem mais depende dela |
| (iii) **restrição de arquitetura de ancestral** | o invariante proíbe o layout que o card pede | **o contrato vence, o card cede**; a dívida é nomeada e endereçada a um card futuro |
| (iv) **pressuposto de sequência** | "o store ainda não existe" — já existe e mudou de forma | **só este exige reescrever o card**, fora da onda |

**O que PARA: nada.** O card continua até seus critérios de aceitação — que são sobre o
*resultado*, não sobre a premissa. A exceção é (iv).

**Autoridade, e ela é assimétrica:**

- **O agente executor não pode reescrever o card.** Seu mandato é marcar concluído e escrever o
  handoff — nenhum outro.
- **Quem orquestra pode**, por outra via: branch `PREP-<slug>`, fora da onda, commit próprio,
  autoria humana.

**Consequência de desenho:** o corpo do card é **registro histórico imutável**; a refutação é
**append-only** no handoff. Quem lê o card vê as duas coisas — o que se acreditava e o que se
descobriu. Reescrever apagaria a segunda.

> *Um card é uma hipótese datada, não um contrato. O que ele afirma sobre o mundo pode ser falso;
> o que ele afirma sobre o resultado esperado é o que vincula.*
>
> E **a refutação tem endereço**: escreva-a para o descendente **nomeado** que vai tropeçar nela.

### §VI-6. O handoff

Herdando diretamente o erro nº 3 do programa de origem — 49 de 49 handoffs preenchidos, média de
5 KB, e **zero** disseram "nada a propagar":

| Campo | Regra |
|---|---|
| `destinatarios:` | **obrigatório**, ids de card nomeados. Vazio só é aceito como a string literal `NENHUM` |
| tamanho | **teto de 2 KB**. Acima disso o gate rejeita — o excesso vai para um documento próprio, citado |
| conteúdo | só o que **muda o trabalho de um descendente nomeado**. Não é diário |
| proveniência | toda afirmação com `arquivo:linha` |
| válvula de escape | `nada-a-propagar` é uma resposta legítima e esperada na maioria dos cards |

---

## Parte VII — Publicação e o corte

> ⚠️ **Toda esta parte nasce como `ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO`.** É desenho
> revisado, não prática validada. Nenhum vídeo deste programa foi publicado. Trate como plano em
> papel, e mantenha o cabeçalho quando o primeiro for publicado — mudando o status, não apagando
> a confissão.

O análogo do *strangler* aqui não é substituir um sistema: é **passar de "o pipeline produz um
arquivo" para "o pipeline publica em nome de alguém"**. A irreversibilidade não está no código,
está na publicação — um vídeo publicado com asset de licença errada, com voz clonada sem
consentimento ou com áudio fora de norma **não se despublica sem custo**.

Por isso a ordem: **toda etapa reversível vem antes da primeira irreversível**, e a fronteira é
declarada.

| # | Fase | Mecanismo | Reverter |
|---|---|---|---|
| 0 | **Saída em arquivo, nada publicado** | o piso seguro | — é o estado base |
| 1 | **Revisão humana obrigatória** | o artefato de entrega inclui o relatório de procedência e o checklist; nenhuma publicação sem aprovação nominal | não se publica |
| 2 | **Publicação privada / não listada** | canal de teste, audiência zero | apagar |
| 3 | **Publicação listada, um vídeo** | um item, escolhido por menor exposição | despublicar (não apaga o que já foi visto) |
| 4 | **Cadência regular** | N por semana, com portões datados | pausar a cadência |
| 5 | **Soak** — um ciclo de negócio real | — | ainda reversível |
| 6 | **Automação de ponta a ponta sem revisão humana** | ★ **a primeira etapa irreversível** | **deixa de ser edição** |

> **A partir da fase 6 a reversão deixa de ser uma edição de configuração.** Um pipeline que
> publica sozinho pode publicar errado antes de alguém acordar. A janela mínima entre 5 e 6 é
> declarada explicitamente e não é redonda: ela é **um ciclo de negócio completo**, justificado —
> menos que isso não cobre o caso raro; mais que isso mantém dois processos vivos sem aprender
> nada novo.

**Uma alavanca por fase, e uma alavanca-mestra.** A alavanca-mestra é a flag que desliga a
publicação inteira, citada em todos os runbooks subordinados. Reversão é sempre **uma edição de
configuração, sem redeploy**; edição inválida é **recusada e logada**, e a configuração anterior
continua valendo.

### §VII-1. A armadilha do denominador

A lição mais transferível desta parte, e a que mais se aplica a um pipeline de conteúdo:

> **Zero não é sinal sozinho — precisa de denominador.** "Zero vídeos rejeitados na revisão" é
> verdade quando o gerador está perfeito **e** quando ninguém está revisando. As duas leituras
> produzem o mesmo número e significam o oposto.

Daí a linha obrigatória de **volume ao lado de todo sinal de erro** que idealmente é zero. E:
*ausência de reclamação não é sinal* — pergunta ativa.

### §VII-2. O que não pode ser desligado

O checklist de desligamento é escrito em **duas listas simétricas**, e a do "não pode" vem
primeiro em esforço, com citação `arquivo:linha` para cada item:

- **§1 PODE desligar** — depois do soak.
- **§2 NÃO PODE desligar — e o motivo.** Neste projeto, os candidatos previsíveis: o store de
  assets (a procedência de tudo já publicado mora nele); o registro de licenças; os snapshots
  aprovados (sem eles nenhuma regressão futura é detectável); o ledger.

Três mecanismos de escrita que valem como padrão:

1. **Separe atos que parecem um só.** "Despublicar o vídeo" e "apagar os assets" são dois atos,
   com raios de alcance diferentes — tabela ato × o que quebra × reversível.
2. **Nomeie a armadilha que parece refutação** — a cópia esquecida que faz alguém concluir que
   um artefato é descartável.
3. **Preservar arquivo ≠ preservar função.**

**Gradação de irreversibilidade:** desativar é reversível, apagar não é. Nunca apague: renomeie
com prefixo de depreciação e espere um ciclo completo.

### §VII-3. Runbooks para quem não estava lá

> *Quem executa isto provavelmente não participou da construção. Por isso cada item traz a
> evidência junto, para ser reconferido no dia sem redescobrir nada.*

Isso **não é tom, é estrutura**. Cada runbook deste programa carrega, obrigatoriamente:

- um anexo **"como reconferir tudo isto você mesmo"**, com os comandos prontos;
- **correções de citação antecipadas**, para o leitor não concluir errado;
- **perguntas segregadas por interlocutor** — o risco concreto é queimar a sessão de um
  interlocutor caro com pergunta que era de outro;
- uma seção final **"o que ninguém conferiu"** — para que a lista não precise ser reconstruída
  por arqueologia;
- e o cabeçalho que declara **o que não foi executado**.

> **Regra.** Um runbook que só o autor consegue seguir não é um runbook. E **o escopo negativo é
> parte do entregável**: termine com "o que este documento NÃO cobre".

---

## Parte VIII — Cronograma, custo e o que esperar

⚠️ **Nenhum número desta parte é medido.** São hipóteses datadas, escritas para serem refutadas
pela primeira onda. A primeira coisa que o programa faz depois da W2 é **substituir esta parte
por medição** — e o card `T-08` existe exatamente para isso.

### §VIII-1. O que esperar de custo, por analogia

Da experiência registrada no playbook de origem, para calibrar ordem de grandeza — **não para
orçar este programa**:

- **9 agentes em paralelo** foi o máximo praticado numa onda; 4 e 6 nas demais.
- **Uma onda de composição levou ~1 hora por agente.**
- **Revisão automatizada dobra o custo por slot**: 3 agentes com revisor = até 6 agentes.
- **Observabilidade é escassa.** O histórico da janela do terminal recupera pouco, e **zero se a
  janela fechar**. → *Se o conteúdo importa, o lugar dele é um arquivo no repositório, escrito
  **pelo** agente.* Neste programa isso é regra de card, não conselho.

### §VIII-2. Os recursos que saturam antes do modelo

Este programa é mais pesado em máquina que o de origem, porque renderiza vídeo. A ordem esperada
de saturação:

| Ordem | Recurso | Por que satura aqui | Mitigação declarada |
|---|---|---|---|
| 1 | **RAM** | cada worker de render é uma aba de Chrome; cada worktree é uma cópia da árvore | teto de concorrência por card, declarado no PREP da onda |
| 2 | **Disco** | store de assets + frames intermediários + N worktrees + modelos baixados | store fora das worktrees, por symlink; limpeza de frames por card |
| 3 | **GPU / sessões de encode** | encoders de consumo limitam sessões simultâneas | fila explícita; o gate declara o teto |
| 4 | **Portas TCP** | Studio e previews simultâneos | faixa de porta por card, no PREP |
| 5 | **Rate limit de API** | TTS, LLM, mídia externa — N agentes chamando ao mesmo tempo | **o cache absorve**: o segundo agente que pede o mesmo hash não chama a API |
| 6 | **Contexto do modelo** | — | último da lista, e isso é intencional |

**O item 5 é o mais importante e é onde a arquitetura paga por si mesma.** O store endereçado por
conteúdo não é elegância: é o que permite que dez agentes trabalhem em paralelo sem multiplicar
por dez a conta de API nem o risco de rate limit.

### §VIII-3. Os cinco erros que este programa se compromete a não cometer

Herdados diretamente do que o programa de origem pagou para aprender:

1. **A seção de incerteza entra no card 1**, não na onda 6. Lá, 22 cards rodaram antes dela
   existir e o inventário de premissas ficou incompleto por construção.
2. **O validador de grafo é escrito no dia 1** (`T-02`), não nunca. Lá, um card ficou órfão e 4
   arestas divergiram entre as duas representações, em silêncio.
3. **O handoff tem teto e destinatário nomeado** desde o primeiro card (§VI-6).
4. **Dependência lateral é proibida e verificada** (§III-5).
5. **Sonda negativa desde o começo** (§IV-2), porque o critério de aceitação mais comum de uma
   árvore mal escrita passa vazio.

E um sexto, específico deste programa e que o de origem não tinha como cometer:

6. **Nenhum card produz pixel ou som antes de existir o oráculo capaz de reprovar aquele pixel ou
   som.** É o ADR-0001, e ele é uma aresta do grafo, não uma recomendação.

---

# Apêndices

## Apêndice A — Template do prompt de card (12 tags)

> ⚠️ **Este template é a entrada do gerador `tools/gerar-prompt-de-card.py`, não um formulário
> para preencher à mão.** O prompt de um card é **gerado** do registro (§III-14) mais este
> template. Se você se pegar redigitando um prompt, pare: você acabou de criar a segunda
> representação que vai divergir em silêncio.

```xml
<task id="<ID>" nome="<título curto>"
      onda="<Wn>" disciplina="<tdd|caracterizacao|ambos>"
      worktree="bash tools/new-task-worktree.sh create <ID>">

  <ultrathink>
    1–2 linhas dizendo ONDE gastar raciocínio e o dano a jusante se errar ali.
    Não "pense bem": "o erro aqui contamina os N descendentes porque <mecanismo>".
  </ultrathink>

  <contexto>
    3–6 linhas de domínio, não de projeto. A sessão é amnésica: o que ela precisa saber sobre
    o PROBLEMA e que não está no diff. Encolhe conforme o programa acumula contratos publicados.
  </contexto>

  <ler_consideracoes_dos_anteriores>
    ANTES de planejar: leia a linha "Considerações" (o handoff) de TODAS as tarefas das quais
    esta depende — direta E transitivamente. Siga o atributo `deps` de cada card recursivamente
    até a raiz e junte as considerações de todos os ancestrais.
    Dependências diretas desta tarefa: <LISTA>.
    Uma consideração de um ancestral distante pode invalidar uma premissa deste card — se isso
    ocorrer, classifique a premissa (fato | entrada | restrição de ancestral | sequência),
    ajuste o TASK_PLAN.md e diga por quê. NÃO siga no automático. Você NÃO pode reescrever
    este card: seu mandato é marcar concluído e escrever o handoff.
  </ler_consideracoes_dos_anteriores>

  <questoes_abertas>
    Ritual de 3 passos, obrigatório desde o primeiro card:
    (1) tome a decisão provisória e escreva-a;
    (2) abra o item em `ledger/inbox/<ID>.json` usando SÓ a sua faixa <AB-nnn..AB-mmm>,
        com os cinco campos — em especial a verificação EXECUTÁVEL e o que quebra se divergir;
    (3) marque o ponto exato no código com `// ABERTO AB-nnn: <o que se assumiu>`.
    Procure antes de abrir: referencie um item existente em vez de duplicar.
    Categoria só do vocabulário fechado de `ledger/CATEGORIAS.md`.
    Esperado neste card: <n> itens (pode ser zero, e zero é uma resposta legítima).
  </questoes_abertas>

  <skills_obrigatorias>
    Caminhos literais, COM ORDEM. As duas não negociáveis entram automaticamente quando a
    classificação do card as dispara (§VI-1).
    - .agents/skills/<primeira>/SKILL.md
    - .agents/skills/<segunda>/SKILL.md
  </skills_obrigatorias>

  <entradas>
    Arquivos COM INSTRUÇÃO DE MÉTODO de leitura — não basta dizer qual arquivo.
    Ex.: "docs/00-panorama-verificado.md §1 e §7 — leia o placar antes do claim;
          claim com placar < 2-0 não pode virar decisão deste card."
  </entradas>

  <o_que_fazer>
    3–5 passos numerados, cada um com o CAMINHO DE SAÍDA LITERAL.
    O caminho literal é o que impede dois cards da mesma onda de escreverem no mesmo arquivo.
  </o_que_fazer>

  <restricoes>
    PROIBIDO, por propriedade: <arquivo> pertence ao <CARD-DONO>, que roda em PARALELO nesta
      onda — entregue SÓ os seus arquivos.
    PROIBIDO tocar em: src/design/tokens.*, schema/*.json, package.json, pyproject.toml
      (singletons S-1, S-2, S-4, S-5). Se precisar, PARE e escreva no handoff.
    PROIBIDO introduzir não-determinismo: Date.now, Math.random, setTimeout, animação CSS,
      fonte de CDN, URL remota no manifesto resolvido.
    PROIBIDO repetir literal de domínio — todo valor vive no tipo nomeado único.
    PROIBIDO remover ou renomear id de contrato; o novo entra AO LADO.
    PROIBIDO `git add -A`.
    PROIBIDO "melhorar" a saída sem recapturar o snapshot e declarar no handoff.
    <+ as proibições específicas deste card>
  </restricoes>

  <swarm>
    <subagents>
      Agente único. (Default explícito. Fan-out custa 3–10× tokens sem ganho na escrita.)
      Se este card declarar fan-out, ele declara a topologia E a justificativa de custo, e o
      padrão é sempre fan-out para LER, funil para ESCREVER.
    </subagents>
    <worktree>bash tools/new-task-worktree.sh create <ID>
      (o preflight prova acesso ao insumo com valor conhecido; falhou ⇒ exit 1, e a worktree
       fica para inspeção. Você NUNCA remove a própria worktree.)</worktree>
    <revisao_adversarial>
      Antes de concluir, lance um subagente de CONTEXTO FRESCO que recebe APENAS o diff e este
      card, e tenta REFUTAR:
        <pergunta falsificável 1 — vinda do registro do card, escrita por quem orquestra>
        <pergunta falsificável 2>
        <pergunta falsificável 3>
      Corrija o que ele derrubar antes de encerrar.
    </revisao_adversarial>
  </swarm>

  <criterios_aceitacao>
    <comando 1>                                    # exit 0
    # GUARD: o seletor acima TEM de casar >=1 teste — 0 matches também sai exit 0 (falso verde).
    # Este comentário é PROSA. A garantia é T-06 rodando dentro do gate.
    <comando 2 — o critério que falha por AUSÊNCIA>  # saída vazia
    bash tools/gate.sh                              # VERDE (sem etapa em FAIL)
  </criterios_aceitacao>

  <ao_concluir_marque_feito_e_publique>
    (a) marque o estado do SEU card em PROGRAMA.md — só as suas linhas, nada mais;
    (b) escreva o handoff no campo Considerações do SEU card:
        - teto de 2 KB;
        - campo `destinatarios:` OBRIGATÓRIO, com ids de card nomeados
          (a string literal NENHUM é uma resposta válida e esperada);
        - só o que muda o trabalho de um descendente nomeado — não é diário;
        - toda afirmação com `arquivo:linha`;
        - se você refutou uma premissa deste card, escreva PARA QUEM ela importa.
  </ao_concluir_marque_feito_e_publique>

  <evolucao>
    Rode o pipeline de memória (`meta-skill-evolution`) para cada skill carregada.
    DEFAULT: DESCARTAR. A maioria dos achados falha no filtro de importância, e esse é o
    desfecho saudável. Se nada importante E verificado foi aprendido, não escreva nada.
    Apague TASK_PLAN.md.
  </evolucao>
</task>
```

### A-1. Arquétipo **raiz** — o que muda

O card raiz é o único que não tem `ler_consideracoes_dos_anteriores` com conteúdo (não há
ancestral) e o único que **não pode citar tecnologia de destino além do runtime**. Se ele
precisar dizer o nome do compositor para existir, a análise não terminou.

```xml
  <ultrathink>Você está escrevendo o vocabulário que 64 cards vão herdar sem poder discutir.
    Um termo ambíguo aqui vira duas implementações divergentes na W4, em worktrees que não se
    enxergam, e o merge vai ficar limpo.</ultrathink>
  <ler_consideracoes_dos_anteriores>Nenhuma — este é o card raiz.</ler_consideracoes_dos_anteriores>
  <restricoes>PROIBIDO citar tecnologia de destino. Diga "o compositor", "o motor de gráficos",
    "o provedor de locução". O nome do produto entra por ADR na W1, não aqui.</restricoes>
```

### A-2. Arquétipo **hub** (out-degree alto) — o que muda

```xml
  <ultrathink>Este card tem out-degree <n>. Toda decisão de interface aqui é herdada por <n>
    cards que rodam em paralelo e não podem renegociar. Gaste o raciocínio na SUPERFÍCIE
    (nomes, assinaturas, contrato de erro), não na implementação — a implementação é
    substituível, a superfície não.</ultrathink>
  <o_que_fazer>
    ...
    N. Publique a superfície no handoff, com a assinatura EXATA, para que os <n> descendentes
       não tenham de ler o código. Handoff de hub é o único que pode chegar perto do teto de 2 KB.
  </o_que_fazer>
```

### A-3. Arquétipo **onda larga** — o que muda

```xml
  <contexto>Você é 1 de 13 agentes desta onda. Os outros 12 não te enxergam e você não os
    enxerga. Tudo que vocês precisam em comum já foi commitado no PREP-w4.</contexto>
  <restricoes>
    Sua propriedade: <lista literal>. Os outros: não editam.
    PROIBIDO: tudo fora dessa lista. Se você precisar de algo de outro card desta onda,
    isso é DEPENDÊNCIA LATERAL e é proibida por construção (§III-5) — pare, entregue o que
    dá, e nomeie a diferença no handoff.
  </restricoes>
```

### A-4. Arquétipo **onda de composição** — o que muda

```xml
  <contexto>Esta é uma ONDA DE COMPOSIÇÃO: você e os outros trabalham sobre o MESMO artefato
    entregue por <CARD-ANCESTRAL>. O git não vai ter em que conflitar, então ele vai mergear
    em silêncio código que discorda. O contrato abaixo foi congelado no PREP e não é
    negociável em tempo real.</contexto>
  <entradas>
    docs/contrato-w<N>.md — os nomes de campo, os nomes de flag, e quem corta o quê.
    Leia ANTES de planejar. Se o contrato estiver errado, isso é um PREP, não um card.
  </entradas>
  <revisao_adversarial>
    ... + a pergunta obrigatória desta onda:
    "Existe alguma asserção neste diff sobre a LISTA COMPLETA de alguma coisa? Se sim, ela é
     verdade contra a sua base e pode ser falsa depois do merge do irmão. Reescreva como
     asserção sobre a presença do SEU item, nunca sobre a ausência dos outros."
  </revisao_adversarial>
```

> Essa última pergunta existe por causa de um caso real: dois cards escreveram, cada um em seu
> arquivo, um teste exigindo que a metade do **outro** continuasse na lista. Um assertava
> `Todos == [x]`; o outro assertava exatamente os sete ids do primeiro. Cada um era verdade
> contra a própria base, os dois são contraditórios juntos, e **mergearam em silêncio**.

### A-5. Arquétipo **join** (in-degree alto) — o que muda

```xml
  <ultrathink>Você é o primeiro a ver as <n> peças juntas. O defeito que você procura não está
    em nenhuma delas: está na COSTURA. Gaste o raciocínio em achar a asserção que só é falsa
    quando as peças se encontram.</ultrathink>
  <ler_consideracoes_dos_anteriores>
    ... este card tem in-degree <n>: leia os <n> handoffs ANTES de escrever a primeira linha.
    Espere encontrar ao menos uma contradição — se você não encontrou nenhuma, releia.
  </ler_consideracoes_dos_anteriores>
  <ao_concluir_marque_feito_e_publique>
    ... + escreva no commit a CHECAGEM SEMÂNTICA DO MERGE: que costura fechou, qual contrato
    bate, e qual asserção cada lado assumiu.
  </ao_concluir_marque_feito_e_publique>
```

### A-6. Arquétipo **infra** — o que muda

Cards de infra **não têm worktree** e rodam no branch de integração. O gerador **recusa** criar
worktree para um id de infra, com explicação.

```xml
<task id="I-0n" ... worktree="NENHUMA — card de infra roda no branch de integração">
  <swarm>
    <worktree>NENHUMA. `tools/new-task-worktree.sh create I-0n` sai com erro de propósito.
      Motivo: este card exige um humano, uma credencial ou uma máquina, e isolar isso numa
      worktree só esconde onde o trabalho de fato acontece.</worktree>
  </swarm>
  <criterios_aceitacao>
    ... o critério de um card de infra é SEMPRE um artefato versionado com evidência anexada,
    nunca "conversei com fulano". Evidência tem forma verificável (Apêndice G).
  </criterios_aceitacao>
</task>
```

---

## Apêndice B — Template do registro do card

**Três atributos, três eixos independentes.** Confundir os dois últimos é o erro que faz uma
onda parecer pronta sem estar.

```markdown
<details>
<summary><b>ID</b> · Título curto · <code>Wn</code> · <code>deps: A, B</code> ·
  <code>disciplina: tdd|caracterizacao|ambos</code> · 🔴|🟡|🟢 · <b>marcadores</b></summary>

| | |
|---|---|
| **Objetivo** | uma frase, no afirmativo, dizendo o que existe depois que este card fecha |
| **Dono de** | caminhos literais — esta linha é lida pelo validador de grafo (checagem 8) |
| **Entrega** | o conteúdo, em prosa densa |
| **Aceitação** | comandos com exit code; **∅-crit** obrigatório, marcado |
| **refuta** | 3–4 perguntas falsificáveis, escritas por quem orquestra, ANTES |
| **ledger** | AB-nnn..AB-mmm |
| **Considerações** | — (o handoff; preenchido ao concluir; teto 2 KB; `destinatarios:` obrigatório) |

</details>
```

| Atributo | Eixo | Quem escreve |
|---|---|---|
| `deps` | **grafo** — de onde saem as ondas | quem orquestra, em `PREP` |
| `id` + estado | **identidade e progresso** | o executor marca o estado; nada mais |
| `Wn` | **escalonamento** — decisão, não derivação | quem orquestra |
| `Dono de` | **propriedade** — a condição suficiente do paralelismo | quem orquestra, em `PREP` |
| `Considerações` | **handoff** — append-only | o executor, antes do merge |

> **O que é lido por ferramenta não se mexe.** `deps`, `Dono de`, `Wn` e o estado são parseados
> pelo validador de grafo e pelo verificador de aceitação. Uma reescrita de card preserva esses
> quatro e enumera o que mudou (§VI-5).

---

## Apêndice C — Template de ADR

```markdown
# ADR NNNN — <título que é a DECISÃO, não o tema>

- **Status:** Aceito | PROPOSTO — esqueleto vazio | ENCERRADO SEM DECISÃO
              | ENCERRADO COMO CONSTRUÍDO E NÃO DISPARADO
              [+ "(sign-off de <nome>, <data>)" e POR QUE o sign-off era exigido]
- **Data:** AAAA-MM-DD [· encerrado em AAAA-MM-DD]
- **Card:** <ID> (onda Wn). Depende de <ids>. Consumida por <ids>.
- **Supera, no que diverge:** <documento + seção exata>
- **Reafirma explicitamente:** <ADR §n, §n>          ← o que NÃO mudou
- **Guarda executável:** <comando que FALHA se a decisão for violada>
- **Itens de ledger ligados:** <AB-nnn, AB-mmm>

## Contexto            ← inclui "premissas de ancestrais que me vinculam"
## Decisão             ← numerada: D1, D2… cada uma citável isoladamente
## Alternativas consideradas / descartadas   ← com o motivo da rejeição
## Consequências       ← Positivas | Custos e desvios registrados
## Revisão adversarial ← o que a crítica derrubou
## O que este ADR NÃO decide / explicitamente fora de escopo
## Limites do que é verificável aqui
## Adendo do sign-off (data) ← o que o aceite autoriza e o que NÃO autoriza
```

**Se você não consegue escrever a guarda executável, a decisão é uma intenção.** É o campo mais
fácil de deixar vazio e o único cuja ausência transforma o ADR em prosa.

**ADRs previstos deste programa:**

Quinze ADRs previstos. A pesquisa isolou **dezoito** perguntas ao dono
(`docs/00-panorama-verificado.md §6`, P-01..P-18). **`I-01` fechou quatro** (P-01..P-04), todas
condicionadas a uso comercial. **Catorze continuam abertas** — e nenhuma é respondível por dedução.

> **Cinco delas têm ADR previsto abaixo. As outras nove (P-10..P-18) ainda não têm destino
> declarado**, e isso é uma dívida nomeada, não um esquecimento: cada uma precisa virar ADR
> previsto, item de ledger com gatilho, ou ser declarada fora de escopo **por escrito, com o
> motivo**. Uma pergunta ao dono que some do plano vira decisão por omissão dentro de um card —
> que é o modo de falha que a §V-2 chama de *premissa invisível*.

| ADR | Título | Card | Decisão do dono? | Estado |
|---|---|---|---|---|
| 0001 | Oráculo antes do pixel | `F0-01` | — | Aceito |
| 0002 | A fronteira de determinismo | `F0-01` | — | Aceito |
| **0003** | **Enquadramento de uso** (P-01 → e com ele P-02, P-03, P-04) | `I-01` | **sim** | ✅ **ACEITO — uso pessoal**, com condição de escopo e gatilho `AB-950` |
| 0004 | Absorver × integrar o projeto de origem | `F0-05` | — | Aceito |
| 0005 | Política de segredos | `I-02` | — | Aceito |
| 0006 | Teto de concorrência medido | `I-03` | — | Aceito |
| **0007** | **Canal e política editorial** | `I-04` | **sim** | pendente |
| 0008 | Formato de alfa entre gráficos e composição | `F2-02` | — | Aceito |
| **0009** | **Origem do timing** (provedor × alinhamento) | `F3-01` | **sim** | pendente — **o leque abriu**: pesos não-comerciais agora entram |
| 0010 | Unidade de tempo do manifesto | `F0-02` | — | Aceito |
| **0011** | **Fronteira de rede do pipeline** (P-05) | `F2-01` | **sim** | pendente |
| **0012** | **Formato e armazenamento do golden master** (P-06) | `F0-06` | **sim** | pendente |
| **0013** | **Acessibilidade e fotossensibilidade** (P-07) | `F0-04` | **sim** | pendente |
| 0014 | Forma do contrato de dados do manifesto (P-08) | `F0-02` | — | Aceito |
| **0015** | **Alvos numéricos de saída — LUFS e sincronia** (P-09) | `F0-04` | **sim** | pendente |

> **Por que uma resposta fechou quatro perguntas — e por que isso não é um atalho.** P-02, P-03 e
> P-04 não eram independentes de P-01: as três dependiam de cláusulas condicionadas a **uso
> comercial**. Respondido o enquadramento, as três perdem o objeto. O que **não** desaparece é a
> condição: as quatro decisões carregam o mesmo gatilho de reabertura, e ele mora em `AB-950`.
>
> **As cinco que restam são de outro tipo.** P-06 (o limiar do golden master) e P-09 (o alvo de
> LUFS) têm a propriedade perversa de que **afrouxá-las depois não dá erro** — cada ponto de
> afrouxamento é uma classe de regressão que deixa de ser detectada, e a perda é invisível. Por
> isso o próprio ADR declara que afrouxar exige **nova** decisão registrada. Elas não bloqueiam
> nenhum card hoje: são respondidas quando o card correspondente for executado, com dado medido
> na mesa em vez de estimativa.

---

## Apêndice D — Esquema de um item do ledger

```json
{
  "id": "AB-032",
  "titulo": "<uma frase>",
  "pergunta": "<a pergunta objetiva>",
  "por_que_aberto": "<por que a base de código não responde>",
  "decisao_provisoria": "<o que se assumiu enquanto isso>",
  "origem": ["<arquivo:linha>", "<arquivo:linha>"],
  "verificacao": "<comando literal, query, experimento — OU a pergunta e PARA QUEM>",
  "impacto_se_divergir": "<o que quebra, NOMEANDO fixtures, snapshots e gates a recapturar>",
  "risco": "baixo|medio|alto",
  "categoria": "<um do vocabulário FECHADO>",
  "responde": "dono|juridico|infra|plataforma|operacao",
  "antecedencia": "<dias necessários para conseguir a resposta>",
  "status": "ABERTO|CONFIRMADO|REFUTADO|PARCIAL|INVIÁVEL",
  "evidencia": "",
  "data_resolucao": "",
  "adr": ""
}
```

**Validado por script, não por revisão:**

| estado | exige |
|---|---|
| `ABERTO` | `por_que_aberto` + `decisao_provisoria` + `verificacao` + `impacto_se_divergir` **não-vazios**, e `evidencia` **vazia** |
| `CONFIRMADO` / `REFUTADO` / `PARCIAL` | `evidencia` casando a regex de forma citável + `data_resolucao` ISO |
| `INVIÁVEL` | `evidencia` + `data_resolucao` + **`adr` não-vazio** |

**Formas de evidência aceitas** (regex): `arquivo:linha` · caminho de saída de comando salva ·
caminho de relatório de diff · `ADR-nnnn` · `<nome>, <AAAA-MM-DD>` (resposta atribuída e datada).

**Lista negra de não-evidências** — sem ela a regra vira decorativa:
`ok` · `OK` · `confirmado` · `conforme combinado` · `resolvido` · `feito` · `checado` ·
`sim` · `n/a` · qualquer string com menos de 12 caracteres.

**Âncora no código**, no ponto exato da suposição:

```ts
// ABERTO AB-032: assume que o provedor devolve tempo em ms; ver ledger.
```

**Inbox por card**, para sobreviver a worktrees paralelas:

```json
{ "card": "F2-03", "faixa": "AB-410..429", "itens": [ /* … */ ] }
```

---

## Apêndice E — Como se escreve uma tabela `arquivo → dono`

O exemplo real está no §III-11. O que vale como padrão é a **forma**:

```markdown
### Um dono por arquivo — onda W<N>

| Arquivo | Dono | Os outros |
|---|---|---|
| caminho/literal/A.ext | **CARD-1** | não editam |
| caminho/literal/B/**  | **CARD-2** | não editam |

### Compartilhados — **só acrescente**

<lista>

Regras: nunca reordene, nunca renomeie, nunca reindente, nunca mexa em membro que não é seu.
Acrescente no fim do bloco correspondente. Diffs por acréscimo mergeiam mecanicamente.

### Faixas de id (para não conflitar no fecho do array)

CARD-1: AB-nnn..mmm · CARD-2: AB-ppp..qqq

### Faixas de porta TCP

CARD-1: 3100–3109 · CARD-2: 3110–3119

### Ordem de merge

1. <card> — motivo
2. <card> — motivo
…
N. <card que muda o gate> — por último, sempre
```

**A terceira coluna é o que dá contratualidade.** Sem "os outros: não editam" escrito, é uma
sugestão — e uma sugestão não sobrevive a treze agentes que não se enxergam.

**A assimetria que sustenta tudo:** um card mal isolado custa uma onda inteira de retrabalho;
a preparação que o isola custa algumas dezenas de linhas. **Prepare demais.**

---

## Apêndice F — Banco de perguntas adversariais

**O que faz uma pergunta boa:** ela nomeia um **resultado observável** que, se acontecer,
derruba o trabalho. "Está bom?" não é pergunta. *"O smoke passaria com um quadro preto?"* é.

| Domínio | Perguntas |
|---|---|
| **Esqueleto / ferramenta** | *o build passa com o diretório de fonte vazio? · o `.gitignore` bloqueia mesmo o store, ou só o caminho relativo — testou com symlink? · o autoteste asserta a mensagem ou só o exit code?* |
| **Contrato de dados** | *o schema aceita campo desconhecido? · um tipo novo pode entrar sem tocar em nenhum outro `$def`? · o gerado está commitado e é reprodutível? · o schema roda offline?* |
| **Determinismo** | ***renderize DUAS vezes e diffe: qualquer byte diferente refuta o determinismo*** · *o que muda à meia-noite? e entre máquinas? · a normalização substitui por valor em algum ponto? · a execução vermelha consegue sobrescrever a base?* |
| **Composição / pixel** | ***o smoke passaria com um quadro totalmente preto?*** · *o componente desenha fora da própria janela de tempo? · a fonte veio da rede? · algum literal de token foi redeclarado aqui? · o texto estoura o quadro em pt-BR, que é mais longo que em inglês?* |
| **Cache / store** | *a chave omite algum parâmetro que muda a saída? nomeie um e prove o miss · dois processos gravando o mesmo hash com conteúdo diferente — o que acontece? · a GC apaga algo que um snapshot aprovado referencia? · o cache acertou pelo motivo certo?* |
| **Resolução / rede** | *o estágio chama a rede quando o cache acerta? prove com a rede bloqueada e o cache quente · o guarda bloqueia DNS e subprocesso, ou só o cliente HTTP? · o cassete contém credencial? · **o estágio "conserta" algo da resposta externa?** o cassete tem de ser sósia, não sucessor* |
| **Áudio / sincronia** | ***existe caminho em que a legenda aparece antes de a palavra ser falada?*** · *o corte de silêncio comeu o ataque de alguma palavra? · a normalização foi aplicada duas vezes? · o teste passaria com a faixa muda? · o timing e o áudio podem divergir sem nada ficar vermelho?* |
| **Licença / procedência** | *o relatório cobre assets **transitivos** — o que entrou dentro de um gráfico? · licença incompatível é aviso ou bloqueio? aviso é decorativo · o sign-off cobre "vira frame de um MP4 monetizado" ou só "usar a API"?* |
| **LLM / autoria** | *o modelo consegue emitir coordenada, cor ou duração em frames? deve ser impossível pelo schema · "temperatura zero" está sendo tratado como garantia? não é · o reparo altera semântica ou só forma? · o cassete tem manifesto inválido, ou só os bons?* |
| **Onda de composição** | ***existe asserção neste diff sobre a LISTA COMPLETA de alguma coisa?*** reescreva como asserção sobre a presença do SEU item · *dois testes em paralelo colidem no mesmo recurso? · você tocou um singleton?* |
| **Gate / verificador** | *o que este comando imprime se a tarefa não fizer nada? · a sonda negativa é por alvo ou uma só para todos? · o tripwire lê o mesmo texto que o parser? então não é independente · o verificador pula o que não entende?* |
| **Runbook / operação** | *alguém que não participou consegue seguir? · cada item traz a evidência junto? · existe veredito `CONFERE` sem evidência anexada? · o sinal de erro tem denominador?* |

**Se a revisão for automatizada e mesclar código:** simule o merge antes de aplicá-lo. Um merge
direto deixaria marcadores de conflito na worktree onde o agente **ainda trabalha** — e marcador
de conflito é o material que faz um modelo alucinar e apagar lógica.

---

## Apêndice G — Padrão de escrita de um gate

```markdown
### GATE <ID> — <a asserção em UMA frase, no afirmativo>

<Por que existe: o dano CONCRETO se for pulado. Não "boas práticas".
 Se você não consegue nomear o dano, o gate não deveria existir.>

Antes de <ação>, numa sessão com <quem, POR PAPEL NOMEADO — nunca "o time">:
1. <comando/consulta executável, literal, copiável>
2. <como confrontar o resultado com o artefato do repositório>
3. **Registrar o resultado em <caminho de ADR nominal>** — item a item, com o veredito
   (igual | divergente | inexistente) e o que muda se divergir.

- [ ] <artefato de saída> existe e cobre todos os itens
- [ ] Toda divergência corrigida **e** os snapshots recapturados
```

**Os quatro elementos obrigatórios:** condição de entrada · evidência exigida (**saída de comando
salva, nunca afirmação**) · artefato nominal onde a evidência mora · **quem assina, por papel
nomeado**.

**Um veredito que não pode existir:** `CONFERE` sem evidência anexada. É pior que `ABERTO` — ele
para de ser reperguntado e vira premissa invisível. Use um estado explícito `NÃO_COLETADO` que
**nunca** vira `CONFERE`.

**Gates previstos deste programa:**

| Gate | Asserção | Card | Quem assina |
|---|---|---|---|
| `G-LIC` | Toda obrigação jurídica tem sign-off nominal e datado | `I-01` | dono + jurídico |
| `G-DET` | Todo artefato visual e sonoro renderiza duas vezes idêntico | `F0-06` | automático |
| `G-OFF` | O pipeline abaixo da autoria roda com a rede bloqueada | `F2-07` | automático |
| `G-PROC` | Todo asset do entregável tem licença declarada e compatível | `F5-06` | jurídico |
| `G-LED` | Zero itens abertos nas categorias bloqueantes, salvo allowlist justificada | `F6-04` | dono |
| `G-HUM` | Nenhuma publicação sem dossiê assinado | `F6-01` | operação |
| `P-1..P-5` | Os pré-requisitos numerados de publicação | `F6-03` | por papel |

---

## Apêndice H — Catálogo de falso verde **deste** projeto

A pergunta que gera esta lista: ***se isto desaparecer, o que fica vermelho?***

| O que parece verde | Por quê não é | Onde é pego |
|---|---|---|
| `exit 0` de um render | um quadro preto renderiza com sucesso | `F0-06` — asserção de entropia do frame |
| runner com seletor que casa **zero** testes | sai 0 quando o filtro não casa nada | `T-06` — sonda negativa por alvo |
| `git diff --exit-code` num diretório de saída | **não enxerga arquivo não rastreado** | combinado com `git status --porcelain` |
| snapshot aprovado a partir do Studio | o navegador do preview ≠ o do render | `F0-06` — só aprova do render |
| "o vídeo tem a duração certa" | duração do **container** ≠ duração do **stream** | `F5-07` — lê por stream |
| suíte "offline" que apenas não usa a rede | não é o mesmo que a rede **bloqueada** | `F2-07` — guarda que bloqueia |
| cache com 100% de acerto | a chave omite um parâmetro e serve o asset velho | `F0-07` — teste de miss por parâmetro |
| "zero chamadas externas" | verdade com o cache perfeito **e** com nada rodando | denominador obrigatório (`T-08`) |
| fonte que "carregou" | caiu no fallback sem erro | `F1-03` — asserta a família resolvida |
| teste que asserta **a documentação** | apagar o artefato real mantém o teste verde | `F0-08` — invariante estrutural |
| **fixture fabricada alimentando a própria asserção** | não é teste | revisão adversarial, pergunta padrão |
| **motor e oráculo repetindo a mesma premissa** | as duas cópias erram juntas e o diferencial fica cego | dono nomeado por semântica (§VI-4) |
| dois testes de irmãos que passam separados | cada um verdade contra a própria base, contraditórios juntos | `F1-12` + gate após cada merge |
| verificador que **pula** o que não entende | verde por omissão | `F0-08` — falha fechado |
| autoteste que asserta **só o exit code** | não distingue "acusou" de "quebrou" | todos os autotestes assertam a mensagem |
| mutações de autoteste escritas como **literais** | viram no-op no merge e ensinam a ignorar o alarme | mutações calculadas do documento corrente |
| barreira de onda por leitura de tela | declara "terminaram" com os agentes trabalhando | `T-05` — contador monotônico durável |
| citação de proveniência **sem o caminho** | a regex nunca casa e o token é pulado em silêncio | `T-10` — rejeita a forma degenerada |
| skill que existe | não significa que foi carregada | `skills_obrigatorias` + handoff declara |
| gate novo que ninguém conecta | não fica vermelho, fica **invisível** | três estados; `PENDENTE` é impresso |
| ausência de reclamação | **não é sinal** | pergunta ativa (§VII-1) |

---

## Apêndice I — Checklist de arranque, em uma página

**Antes de existir tarefa**
- [ ] As 12 regras de calibração escritas e commitadas (Parte 0), com as críticas no hook
- [ ] O panorama verificado fechado, com placar por claim e o tier "não verificado" declarado
- [ ] Refutações do panorama antigo enumeradas — cada uma impede um card errado
- [ ] Pontos de troca barata com **custo em unidade contável**; os que não têm, marcados "NÃO É BARATO"
- [ ] Perguntas ao dono separadas, com o ADR que recebe cada sign-off
- [ ] Sementes do ledger numeradas, com verificação executável e quem responde
- [ ] Singletons enumerados (§Parte II) — **antes** de dimensionar qualquer onda
- [ ] O documento que vence em caso de conflito, **nomeado**

**A árvore**
- [ ] Biblioteca de skills **antes** dos cards
- [ ] Cards cortados por propriedade de arquivo e por consumidor, nunca por volume
- [ ] Cada lacuna da análise virou card da fase 0
- [ ] Trilha transversal e trilha de infra separadas das fases; infra em onda fracionária
- [ ] Grafo declarado em atributo legível por máquina
- [ ] **Validador de grafo escrito no mesmo dia** — 11 checagens
- [ ] Caminho crítico publicado **e recalculável**
- [ ] Fan-out publicado (adiantar um hub encurta o programa)
- [ ] Nenhuma dependência lateral; o validador recusa

**Antes da primeira onda paralela**
- [ ] Script de worktree com preflight que **prova acesso com valor conhecido**
- [ ] Gate local executável, uma etapa por job, ferramenta ausente = vermelho, três estados
- [ ] Autoteste de cada verificador, rodando **antes** dele, assertando **a mensagem**
- [ ] Verificador de aceitação com sonda negativa e tripwire independente
- [ ] Hooks: gate onde o erro é irreversível; nudge no resto; cada um declara sua política de falha
- [ ] Ledger com validador rodando no gate desde o dia 1, verde com tudo aberto
- [ ] Estado do programa **derivado**, não escrito à mão
- [ ] Harness de determinismo antes do primeiro pixel (ADR-0001)

**Por onda**
- [ ] Commit `PREP-w<N>` **antes** das worktrees: stubs, contrato, faixas de id, faixas de porta, ferramenta
- [ ] Tabela `arquivo → dono` publicada, com a terceira coluna
- [ ] Singletons tocados pela onda: contados, e cada um com dono ou sequência
- [ ] Se ≥2 cards consomem o mesmo artefato anterior → **onda de composição**, protocolo próprio
- [ ] Ordem de merge declarada, com motivo
- [ ] **Gate completo após CADA merge**
- [ ] Handoff escrito dentro da worktree, antes do merge, com `destinatarios:` e teto de 2 KB
- [ ] Medição da onda gravada em arquivo (`T-08`)

---

## Apêndice J — Equivalente humano de cada mecanismo

Para a parte do trabalho que fica com gente, ou para um time que não vai orquestrar agentes.

| Mecanismo de agente | Equivalente humano |
|---|---|
| **Worktree + preflight** | Branch por tarefa **com ambiente reproduzível de um comando**. O ponto não é o branch: é que ninguém perde meio dia montando o ambiente nem descobre no fim que faltava um insumo. O preflight é o *"prove que você consegue renderizar o canário"* antes da primeira linha |
| **Mapa `arquivo → dono`** | Propriedade de diretório publicada **antes** da sprint, com a exceção declarada onde dois times tocam a mesma pasta |
| **Barreira de onda** | Checkpoint com definição de pronto **executável** (comando com exit 0), nunca "verde no board". Cada tarefa fecha marcando **no próprio artefato versionado**, dentro do branch, antes do merge |
| **Revisão adversarial** | Um revisor que **não participou**, recebendo **só o diff e o card**, com instrução escrita de *derrubar* e 3–4 perguntas falsificáveis do domínio. Time-box. **O implementador corrige antes de abrir o PR, não depois** |
| **Subagentes** | Fan-out de **investigação**: N pessoas leem N artefatos e devolvem **uma página destilada com citações**; **uma pessoa só escreve o código** |
| **Merge um a um + gate entre cada** | Integração serializada, com a ordem declarada quando importa |
| **Handoff** | Campo obrigatório no ticket, preenchido **antes do merge**, com citação `arquivo:linha`, teto de tamanho e **destinatários nomeados** |
| **Hooks de máquina** | Hook de pre-commit / regra de CI obrigatória. Nunca convenção em documento |
| **Ledger + âncora no código** | Registro de decisões assumidas, com id, e um comentário `// ABERTO <id>` no ponto exato |
| **Skills carregadas por classe de tarefa** | Checklist de onboarding **por tipo de mudança**, não por pessoa |

---

## Apêndice K — Índice das skills

> Gerado por `.agents/scripts/gerar_catalogo.py` a partir dos frontmatter. O catálogo vivo é
> `.agents/skills/catalog.md`; esta tabela é o mapa de intenção.

**Roteamento em dois níveis** — o router escolhe o *tier* e só então a skill. Com 20 skills,
roteamento de um nível degrada.

| Tier | Skill | Carregue quando |
|---|---|---|
| **router** | `project-router` | sempre, antes de qualquer passo |
| **método** | `wave-planning` | escrever ou mudar cards, ondas, arestas, PREP |
| | `parallel-worktrees` | **obrigatória** quando o card escreve em arquivo tocado por outro card |
| | `adversarial-review` | antes de concluir qualquer card |
| | `falsifiable-gates` | escrever critério de aceitação, verificador, invariante, autoteste |
| | `uncertainty-ledger` | abrir, fechar ou validar item de incerteza |
| | `video-characterization` | **obrigatória** quando o card altera saída visual ou sonora |
| **domínio** | `timeline-manifest` | tocar o schema, o contrato de dados ou a unidade de tempo |
| | `remotion-core` | composição, determinismo, tempo, transições |
| | `remotion-render-pipeline` | render, concorrência, encode, aceleração |
| | `manim-bridge` | gráficos, headless, alfa, reuso do projeto de origem |
| | `audio-captions-sync` | timing, legenda, ducking, loudness |
| | `asset-acquisition` | mídia externa, licença, procedência, cache de asset |
| | `code-animation` | destaque de código, tokens pré-computados, fonte mono |
| | `ffmpeg-media-ops` | encode, alfa, concatenação, normalização, probing |
| | `llm-authoring` | prompt, saída estruturada, cache de autoria, reparo |
| | `motion-design-system` | tokens, tipografia, cor, safe area, acessibilidade |
| | `tts-voiceover` | locução, voz, prosódia, dicionário de pronúncia |
| **meta** | `meta-skill-evolution` | ao concluir um card, para cada skill carregada |
| | `meta-skill-consolidate` | catálogo crescendo, gatilhos sobrepostos, proveniência stale |

---

## Nota final sobre o que este documento não é

Ele não prova que o método funciona **aqui**. No momento em que foi escrito, o programa tinha
zero cards executados, zero frames renderizados e zero itens de ledger fechados. O que existe é
a construção do aparato: 65 tarefas particionadas por propriedade de arquivo, um grafo cujas
ondas são deriváveis por script, e uma cadeia de verificação desenhada para achar defeito **em si
mesma** antes de ser apontada para o produto.

A diferença entre um programa destes que dá certo e um que dá errado **não é a ausência de
retrabalho** — é o gate entre cada merge, que nomeia o defeito enquanto ele ainda cabe num card.

E a frase que atravessa tudo, traduzida para este projeto:

> **Verde quer dizer "confere com o snapshot aprovado", nunca "o vídeo está bom".
> Não se valida uma geração contra ela mesma — é um limite de lógica, não de ferramenta.**

O snapshot foi aprovado por um humano uma vez. Tudo o que a cadeia garante é que ninguém mudou
aquilo sem perceber. Quem decide que o vídeo presta continua sendo gente — e o card `F6-01`
existe exatamente para não deixar essa parte virar automática por descuido.


