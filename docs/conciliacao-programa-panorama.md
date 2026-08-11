# Conciliação `PROGRAMA.md` × `docs/00-panorama-verificado.md`

> **Dono exclusivo deste arquivo:** o agente de conciliação. Nem o PROGRAMA nem o panorama editam aqui.
>
> **O que este documento é:** a verificação da declaração de precedência que fechou a §10.5 do
> panorama. A declaração já existe (cabeçalho do `PROGRAMA.md` e `README.md`). O que **não** existia
> era prova de que ela se sustenta — isto é, de que o `PROGRAMA.md` não contradiz o panorama em
> nenhum fato. *Declarar precedência é barato; provar que ela se sustenta é o que fecha a lacuna.*
>
> **Método:** leitura integral dos dois documentos (2.907 linhas + 1.275 linhas), extração mecânica
> das 57 citações `[R0n-nn (N-M)]` do `PROGRAMA.md`, resolução de cada uma contra o id e o placar
> reais do panorama, e varredura dos 12 itens do escopo negativo do panorama (§10) contra o que o
> plano assume.
>
> **Data:** 2026-08-10 (mesma data de corte do panorama).
>
> **O que este documento NÃO cobre:** não confere o `Roadmap Editor de Vídeo IA.md` (é panorama
> histórico, superado no que diverge), não confere `docs/PLAYBOOK-REFERENCIA.md` contra nenhum dos
> dois, não reabre nenhum claim do panorama contra fonte primária (a pesquisa não foi refeita), e
> não julga o plano como plano — onde o `PROGRAMA.md` decide cards, ondas, grafo e ordem, ele vence
> por precedência declarada e este documento se cala.

---

## 1. Divergências de FATO

**Onze divergências.** Em dez delas o panorama vence por precedência. Na décima-primeira o panorama
é que está desatualizado — e o caso está registrado justamente para ninguém "consertar" o
`PROGRAMA.md` na direção errada.

Ordenadas por gravidade decrescente.

| # | Afirmação no `PROGRAMA.md` | Afirmação no panorama | Quem vence | Correção exata a aplicar no `PROGRAMA.md` |
|---|---|---|---|---|
| **F-1** | L. 2563-2565: *"A pesquisa isolou **nove** perguntas ao dono (`docs/00-panorama-verificado.md §6`); **`I-01` fechou quatro delas de uma vez**… **Cinco** ainda exigem decisão humana."* | §6 enumera **P-01 a P-18** (4 em §6.1 + 14 em §6.2). E §10.2 é literal: *"**As 18 perguntas da secao 6 estao abertas**, e quatro delas (P-01 a P-04, licenciamento) sao bloqueantes para producao."* | **Panorama** (contagem verificável por enumeração; §10.2 escreve o número) | Trocar por: *"A pesquisa isolou **dezoito** perguntas ao dono. `I-01` fechou **quatro** (P-01..P-04), todas condicionadas a uso comercial. **Catorze continuam abertas.**"* E dar destino declarado a P-10..P-18 — cada uma vira ADR previsto, item de ledger com gatilho, ou é declarada fora de escopo **por escrito, com o motivo**. Hoje elas simplesmente somem. Ver §4 deste documento para o que cada uma já virou premissa. |
| **F-2** | §I-7, l. 327: *"Infraestrutura de skill: linter, gate de escrita, evals, staleness, **hooks** \| **absorver quase verbatim** \| é exatamente o mecanismo que o método exige, **já em produção**. `T-10`, `T-05`."* E `T-05` (l. 1146) lista `bash_guardrail.py` e `skill_write_gate.py` como artefatos próprios, com os mesmos nomes de arquivo da origem. | §1.8 (tier CONFIRMADO, convenção B): **L02-C11** (2-0) — *"**PROIBE** copiar o guardrail"*, porque o `\b` final do regex deixa passar `rm -rf /`, `rm -rf ~` e `sudo rm -rf /`; *"**OBRIGA** substituir denylist por allowlist do harness (`permissions`) + gate de **propriedade de arquivo** por card."* **L02-C04 · L02-C05** (3-0 / 2-0) — *"**PROIBE** copiar o gate como esta"*: o "token" é um JSON versionado no git, editável à mão, sem TTL, e o gate **libera escrita** quando executado de outro cwd. **L02-C16** (2-0) — duas das seis evals são lambdas com `passed: True` literal. | **Panorama** (três claims do tier confirmado, e são refutações internas provadas por artefato em disco) | Reescrever a linha de §I-7 para **`reescrever contra as lacunas medidas`**, não "absorver quase verbatim", e apagar *"já em produção"* — §10.11 do panorama declara que `run_skill_evals.py` **não foi executado**, logo "provado" é premissa. Acrescentar à **Entrega de `T-05`**: (a) allowlist do harness + gate de propriedade por card **no lugar** da denylist; (b) token **gitignorado**, TTL de 30 min, `sha1` do arquivo que passou, e resolução de caminho por `git rev-parse --show-toplevel`. Acrescentar ao **`∅-crit` de `T-05`**: `rm -rf /` e `rm -rf ~` **têm de** ser bloqueados, e o autoteste prova. |
| **F-3** | §I-3, l. 185, coluna de mitigação do provedor de locução: *"E existe caminho **local Apache-2.0 com timing** `[R13-12 (2-0)]` `[R13-13 (2-0)]`."* Escrito como fato assentado, na coluna que reduz o risco. | §4 **D-05** classifica R13-12 como **EM DISPUTA** contra **R04-24** (2-0): `KPipeline.join_timestamps` é guardada por `self.lang_code in 'ab'` (inglês) — *"Para os demais idiomas o `Result` sai **sem `tokens`**, e portanto **sem timestamps**"*. §2.3 R04-24 fecha: *"**Hoje, com TTS local em pt-BR, nao existe caminho pronto de timestamp por palavra.**"* E D-05 instrui: *"Enquanto nao resolver, **planeje pelo pior caso** (R04-24)"*; custo de errar = *"**um subsistema inteiro**"*. | **Panorama** (§0 é explícito: *"Onde dois clusters se contradizem, o claim **nao entra na secao 1**"*) | Reescrever a mitigação como: *"o caminho local devolve timing **só em inglês** — `join_timestamps` é guardada por `lang_code in 'ab'` `[R04-24 (2-0)]`, e R13-12 está **em disputa** (§4 D-05). **Planejar pelo pior caso:** em pt-BR local o estágio de alinhamento **não pode ser deletado**."* Abrir o item de ledger com a verificação de uma linha (semente **AB-050** do panorama) e endereçá-lo a `F2-03` e `F3-01` — **os dois estão no caminho crítico**, então esta é a premissa mais cara do documento. |
| **F-4** | §III-3, passo 5, l. 549-551: *"**O agente nunca remove a própria worktree**: **o git recusa**, e apagar o diretório por baixo dele corrompe metadados."* | §3.3 (folclore de domínio), l. 382: *"'`git worktree remove` limpa tudo' / 'remover a propria worktree de dentro dela falha' \| **REFUTADO (os dois)** \| `remove` **nao apaga o branch**… E remover de dentro **retorna 0** em git 2.43.0 — o que quebra e o **shell** (cwd inexistente). A regra correta e 'remova de fora', e o **motivo e o cwd do script, nao uma recusa do git**."* Custo declarado: *"1 card de teardown que acumularia **6 branches por onda, para sempre**"*. | **Panorama** (refutação com REPRO na máquina) | Trocar o mecanismo: *"o `git worktree remove` de dentro da própria worktree **retorna 0**; quem quebra é o shell, que fica com um `cwd` inexistente `[R15-04/R15-07 (2-0)]`. Por isso a remoção é **de fora**."* E completar o passo 5: teardown = `remove` (de fora) **+ `git branch -D` + `git worktree prune`** — `remove` **não** apaga o branch. Sem isso, cada onda deixa N branches órfãos, permanentemente. |
| **F-5** | §I-4, l. 215-220: o oráculo tem **quatro** camadas — `0` estrutural (`ffprobe`), `1` diff do manifesto resolvido, `2` determinismo, `3` snapshot aprovado. E l. 238-239: *"é por isso que a camada 3 existe e é aprovada por um humano — **ela é a única que não deriva do manifesto**."* | §9.2 tem **seis** camadas, e a numeração é outra: `0` `ffprobe`; **`1` determinismo por `framemd5`**; **`2` timeline resolvida**; `3` frame-chave; **`4` invariantes de propriedade**; **`5` round-trip (transcrever o MP4 final e comparar com o roteiro)**. E a camada 5 é *"o **unico** candidato cujo oraculo **nao deriva da mesma premissa** que a implementacao"*. §9.5 publica a ordem de construção usando **essa** numeração. | **Panorama** | Adotar a numeração do panorama (0..5) — hoje "camada 1" e "camada 2" significam **coisas trocadas** nos dois documentos, e §9.5 do panorama é uma ordem de construção que fica ilegível a partir do `PROGRAMA.md`. Acrescentar as duas camadas ausentes: a **camada 2 (timeline resolvida)**, que é o artefato que *"**forca a existencia do runner**"* (refutação I-09 do panorama — a peça central que o roadmap antigo descreve e nenhuma fase constrói), e a **camada 5 (round-trip)**, hoje inexistente no `PROGRAMA.md` (`grep round-trip` → 0). Corrigir a frase de l. 238: a única que não deriva da mesma premissa é a **camada 5**, não a 3. |
| **F-6** | §I-3, l. 188: *"Navegador headless \| médio \| versão nova muda o pixel \| é **baixado e fixado** pelo próprio motor `[R01-19]`; o pin entra no gate."* | **R01-19** é *"o modo alternativo de navegador se seleciona com `--chrome-mode=…`"* e está na **§8.1 — tier NÃO VERIFICADO (fonte única)**. O claim correto é **R05-17 (3-0)**: o Remotion baixa o próprio Chrome Headless Shell e a versão é **fixada pela versão do Remotion** (4.0.507 embute `TESTED_VERSION = "149.0.7790.0"`) — *"**OBRIGA** pin exato do Remotion (sem `^`, sem `~`)… **bump de Remotion = bump de Chrome = re-baseline de 100% das fixtures**"* e *"**OBRIGA** contar o custo de disco/rede por worktree"*. | **Panorama** | Trocar `[R01-19]` por `[R05-17 (3-0)]` e escrever a consequência que hoje falta: **bump de Remotion é evento de re-baseline planejado, nunca manutenção de rotina** (§5.1 do panorama), e **cada worktree baixa o seu próprio Chrome** — número que o `PROGRAMA.md` precisa antes de dimensionar a W4 em 13 worktrees (ver §4, item 3). |
| **F-7** | §I-4, l. 250-252: *"A resposta documentada por **três fornecedores independentes** de teste visual é **padronizar o ambiente**, não afrouxar o limiar `[R11-19 (2-0)]` `[R11-03 (3-0)]`."* | **R11-19 (2-0)**: *"Padronizar o ambiente de render em **container** e a resposta documentada de **dois projetos independentes**"* (BackstopJS `--docker`; Playwright). **R11-03 (3-0)** são **três** fornecedores, mas para outra prática: **congelar animação antes do screenshot** (Playwright `animations:"disabled"`, Chromatic `pauseAnimationAtEnd`, Percy `@media only percy`) — e ela *"**OBRIGA** declarar a politica do projeto: pausar no **primeiro** ou no **ultimo** frame"*. | **Panorama** | Corrigir para **"dois projetos independentes"** e mover `[R11-03 (3-0)]` para onde ele pertence — a política de congelamento de animação, que hoje **não existe em card nenhum**. O aviso do panorama é o que importa: *"se a politica e a ferramenta discordarem, todo baseline nasce **consistentemente** errado — que e o pior caso, porque passa."* Destino natural: `F0-06` (harness) e `F0-04` (o token que fixa a política). |
| **F-8** | §I-3 l. 186 e `F2-04` l. 1338: *"**1 requisição/segundo** e cache obrigatório de 24 h num dos provedores `[R08-10]`."* | **`R08-10` não existe no panorama.** Os ids R08 presentes são 01-07, 12, 14-25, mais a faixa `R08-06..R08-13` da §8.1 (tier 1-0). Os números reais: **Pixabay 100 req/60 s + cache 24 h + proibição de hotlink** (§8.1, 1-0); **GIPHY beta 100/hora** e produção paga (R08-01·R08-02, 2-0); **Pexels 200/h e 20.000/mês** e **Unsplash 50/h (demo)** com obrigação de **hotlinkar** (R08-20·R08-22, 2-0). E §8.1 avisa: *"**Nenhum agente deve transformar 'eu li o ToS' em 'esta liberado'**"*. | **Panorama** | Substituir a linha por uma tabela por provedor, com o placar e o tier de cada número, e trocar `1 req/s` por `100 req/60 s` (Pixabay). Registrar a incompatibilidade que o panorama isola e o `PROGRAMA.md` não menciona: **Pixabay proíbe hotlink, Unsplash exige hotlink** (R08-21/R08-22) — *"as duas regras **nao coexistem numa politica unica**… **OBRIGA** decidir antes de escrever o downloader"*. `F2-04` é o card que precisa dessa decisão **antes** de existir. |
| **F-9** | §I-3, l. 182: *"a **linha 4 é *patch-only*** e a 5 ainda não existe, com breaking changes declarados como lista **incompleta** `[R01-11 (3-0)]` `[R01-12 (2-0)]`."* | **`R01-12` não existe** (a sequência R01 pula 10, 12, 15 e 18). O "5.0 não lançado + lista incompleta" é **R01-11 (3-0)** ✔. Mas *"patch-only"* é **R01-13**, e ele está na **§8.1 — tier NÃO VERIFICADO**, com a ressalva literal: *"E **promessa de fornecedor, nao invariante testado por nos**"*, cujo teste real é **AB-032**. | **Panorama** | Apagar `[R01-12 (2-0)]`. Reescrever: *"a linha 4 é anunciada como patch-only — **promessa de fornecedor, não invariante testado** `[R01-13 (1-0, §8.1)]`; o teste que a torna falsificável é `AB-032`."* Um placar `(2-0)` inventado para uma promessa de fornecedor é exatamente a classe de erro que o Apêndice A manda evitar (*"claim com placar < 2-0 não pode virar decisão deste card"*). |
| **F-10** | `F3-02` (l. 1426) exige *"apagar a regra de caracteres-por-segundo tem de ficar vermelho"*, e a Parte II declara o modelo **frame-based** (*"o modelo *frame-based* está no manifesto"*, l. 470). Nenhum ponto do `PROGRAMA.md` diz em que unidade o piso e o teto de legenda são escritos. | **R14-01 · R14-11 (2-0)**: *"**PROIBE** escrever o gate de duracao **em frames**: 20 frames a 60 fps sao 0,333 s, **quatro vezes abaixo do piso** em segundos. O invariante e `duracao >= max(0,833 s; caracteres/20)`"* — com teto de 6 s (DCMP) a 7 s (Netflix). | **Panorama** | Escrever a unidade dentro de `F0-04` (o token) e dentro do `∅-crit` de `F3-02`: **o invariante de duração de legenda é em segundos, nunca em frames**, `duracao >= max(0,833 s; caracteres/20)` e `<= 7 s`. Num programa cujo manifesto é frame-based, esta é a regra que **mais** provavelmente será reescrita em frames por conveniência — e o erro é de 4× no piso, silencioso. |
| **F-11** | §V-1 (l. 1766, 1822), `T-10` (l. 1073) e Apêndice K (l. 2859): *"**20 skills**"*. | §10.6: *"`docs/CONTRATO-DE-SKILL.md` define **S01..S19**"*; §3.2: *"as **19** skills do programa"*. | **`PROGRAMA.md`** — e aqui a precedência **não se aplica**: o item é do escopo negativo (§10), **não tem placar**, e §0 do próprio panorama restringe a autoridade dele a claims com placar. Verificação: `docs/CONTRATO-DE-SKILL.md` define **S01..S20** e há **20** diretórios em `.agents/skills/`. | **Nada a corrigir no `PROGRAMA.md`.** O panorama é que está desatualizado em dois pontos (§10.6 e §3.2) e deve ser corrigido na próxima revisão dele. Registrado aqui porque um agente aplicando a precedência **literalmente** rebaixaria o `PROGRAMA.md` de 20 para 19 skills e quebraria o Apêndice K, o `T-10` e o catálogo gerado. |

### 1.1 Divergências internas do `PROGRAMA.md` (não são divergência com o panorama, mas violam a própria §IV-6)

A regra do documento é: *"todo número que aparece em prosa e existe numa fonte estruturada é
**gerado ou conferido**, nunca redigitado."* Estes quatro foram redigitados e não conferem com os
`deps` declarados, que são a fonte de verdade por §III-8:

| Número em prosa | Onde | O que os `deps` dizem | Efeito |
|---|---|---|---|
| `F0-04` out-degree **9** | §I-2 l. 170 e o cabeçalho do card (l. 997) | **10** (`F0-09, F1-01, F1-02, F1-03, F3-02, F3-03, F5-02, F5-03, F5-04, F5-05`) — e a tabela derivada de §III-10 já imprime 10 | duas representações divergindo, o defeito que §III-8 diz que este documento **já cometeu uma vez** |
| `F0-07` out-degree **7** | cabeçalho do card, l. 1099 | **10** (`F2-01, F1-07, F1-09, F2-02..F2-06, F5-06, F5-09`) — §III-10 imprime 10 | idem |
| `F2-01` out-degree **5** | cabeçalho do card, l. 1263 | **7** (`F2-02..F2-06, F3-01, F4-01`) | idem; e `F2-01` não aparece na tabela de fan-out, então nada o confere |
| *"a proporção de críticos é… **69%**"* | §III-15, l. 1544 | **41 / 65 = 63,1 %** (69,2 % seriam 45) | um número editorial que o `T-07` vai reprovar no primeiro dia |
| *"**Sete** afirmações do panorama caíram contra fonte primária"* | §I-6, l. 287 | a tabela logo abaixo tem **oito** linhas | idem |

Todos os cinco são pegos por `T-02` e `T-07` no dia em que forem escritos. Registrados aqui para
que a primeira execução deles **não** seja lida como "o validador está quebrado".

**Positivo, e vale registrar porque é raro:** as quatro medições de proveniência da §V-1 do
`PROGRAMA.md` **são reproduzíveis**. Recontagem mecânica sobre `.agents/skills/**/*.md`:
âncoras `PROGRAMA.md:NN` / `00-panorama-verificado.md:NN` = **438** (o documento diz 438);
URLs = **426** (diz 426). O parágrafo que confessa a deriva de proveniência é, ele próprio, o
único bloco de números do documento que passa no seu próprio critério.

---

## 2. Afirmações do `PROGRAMA.md` sem lastro no panorama

**57 citações** no formato `[R0n-nn …]`. Resolvidas uma a uma contra o id e o placar reais.

| Classe | Ocorrências | Veredito |
|---|---|---|
| **A** — id existe **e** o placar citado bate com o do panorama | **34** | conformes |
| **B** — id **não existe no panorama** | **3** | não resolvem |
| **C** — id resolve **só dentro de uma faixa** da §8, e é citado sem placar | **1** | lê como fato; é tier não verificado |
| **D** — id existe, mas está na **§8 (tier NÃO VERIFICADO, < 2-0)**, citado sem placar em posição de fato | **8** | lê como verificado; nada o checa |
| **E** — forma `[Rnn · refutação]`, que **não é um id do panorama** e não carrega placar | **11** | não resolve para claim nenhum |
| | **57** | **23 não conformes (40 %)** |

### 2.1 Classe B — as três citações que não resolvem para nada

| Linha | Citação | O que o `PROGRAMA.md` afirma | Realidade no panorama |
|---|---|---|---|
| 182 | `[R01-12 (2-0)]` | linha 4 do Remotion é *patch-only* | **id inexistente.** A sequência R01 vai 01-09, 11, 13, 14, 16, 17, 19-25. O claim correto é R01-13, e ele é **1-0** (§8.1). Ver F-9. |
| 186 | `[R08-10]` | 1 req/s + cache 24 h num dos provedores | **id inexistente** como linha própria. Existe só dentro da faixa `R08-06..R08-13` da §8.1 (tier 1-0). Ver F-8. |
| 1338 | `[R08-10]` | idem, dentro do card `F2-04` | idem — e aqui é pior, porque vira **critério de dimensionamento** de um card de resolução |

> **Por que uma citação que não resolve é pior que nenhuma:** ela lê como verificada e **nada a
> checa**. `[R08-10]` aparece em `F2-04` como se fosse o número que dimensiona a concorrência do
> estágio de mídia externa. Um agente que abra o panorama para conferir não acha o id, e o desfecho
> provável não é "vou reabrir a pesquisa" — é "deve estar em outro lugar". *A ausência de um
> verificador é indistinguível de conformidade.*

### 2.2 Classe C e D — citações que apontam para o tier "não verificado" sem dizer que apontam

O Apêndice A do `PROGRAMA.md` instrui o executor de card: *"leia o placar antes do claim; **claim
com placar < 2-0 não pode virar decisão deste card**"*. Nove citações do próprio `PROGRAMA.md`
violam essa instrução, porque omitem o placar exatamente onde ele reprovaria:

| Linha | Citação | Onde está no panorama | O que o `PROGRAMA.md` sustenta com ela |
|---|---|---|---|
| 188 | `[R01-19]` | §8.1, fonte única | o pin do navegador headless — e é o **id errado** (ver F-6) |
| 250 | `[R11-16]` | §8.1, *"duas paginas do mesmo dominio = 1 fonte"* | as causas de não-determinismo do navegador |
| 250 | `[R11-18]` | §8.1 | *hinting* de fonte no Linux |
| 248, 254 | `[R11-20]` ×2 | §8.1, *"saida do binario local = 1 fonte"* | **a escolha do muxer de hash por frame como oráculo** e o envelope/fingerprint de áudio — decisão de arquitetura sobre claim 1-0 |
| 163 | `[R12-03]` | §8.1 | o teto de 8 na concorrência (mitigado: `[R05 · refutação]` cobre o mesmo fato em 2-0) |
| 189 | `[R12-17]` | §2.4, `(2-0) / (1-0)` — o `R12-17` é o lado **1-0** | *"existe patch binário de terceiro"* / o teto de sessões NVENC |
| 185 | `[R13-15]` | §8.1, faixa `R13-14..R13-17` | determinismo não garantido mesmo com seed |
| 185 | `[R13-16]` | **classe C** — só dentro da faixa `R13-14..R13-17` | *"mudança de modelo que altera o som da voz ao longo do tempo"* |

**Correção:** cada uma passa a carregar o placar e o tier explicitamente — `[R11-20 (1-0, §8.1)]` —
e, onde a citação sustenta decisão de arquitetura (`R11-20`, o oráculo por `framemd5`), o
`PROGRAMA.md` abre o item de ledger correspondente em vez de tratar o claim como fechado. O
panorama já dá o comando que fecha cada uma na coluna "comando/URL que fecha" da §8.1.

### 2.3 Classe E — a forma `[Rnn · refutação]`

Onze ocorrências: `[R02 · refutação]` (l. 155, 156, 305), `[R03 · refutação]` (l. 278, 307, 1340),
`[R05 · refutação]` (l. 163, 164, 165), `[R09 · refutação]` (l. 187, 1339).

**Essa forma não existe no panorama.** As refutações da §3 são identificadas pela linha do roadmap
antigo (`RM:nn`) e pelos ids R que as sustentam — nunca por "cluster + a palavra refutação". A
consequência é que a citação **não é resolvível**: não há a que ir. E o conteúdo por trás dela é,
em todos os onze casos, um claim que **existe e tem placar**, o que torna a perda gratuita:

| Citação | Claim real no panorama, com placar |
|---|---|
| `[R02 · refutação]` (interpolate) | **R02-18 (2-0)** — `extrapolateLeft/Right: 'extend'` |
| `[R02 · refutação]` (durationRestThreshold) | **R02-03 (2-0)** + **R02-04 (2-0)** |
| `[R02 · refutação]` (pushCut existe) | **R02-05 (3-0)**, e o corte de versão é **R02-06 (1-0, §8.1)** — a distinção importa: o **existir** é 3-0, o **"≥ 4.0.500"** é 1-0 |
| `[R03 · refutação]` (sfx são URLs remotas) | **R01-22 (3-0)** (existe) + **R03-21 (2-0)** (exporta URL) |
| `[R03 · refutação]` (sem normalização embutida) | **R03-18 (2-0)** |
| `[R05 · refutação]` (concorrência, buffer-size, hardware-acceleration) | **R05-09·10·11 (2-0)**, **R05-04·05·06 (2-0)**, **R05-08 (1-0, §8.1)** |
| `[R09 · refutação]` (fontes resolvem para CDN) | **R09-25 (3-0)** para a licença; a parte "aponta para gstatic" é a segunda metade de R09-25, §2 |

**Correção:** substituir as onze pela citação com id e placar. O ganho não é cosmético — em três
casos (`pushCut`, `hardware-acceleration required`, `R05-08`) a forma agregada **esconde que uma
metade do claim é 3-0 e a outra é 1-0**, que é precisamente o padrão que a §I-6 do próprio
`PROGRAMA.md` nomeia como a raiz do erro: *"o erro do panorama não foi inventar a coisa — foi
**perder a condição de escopo**."*

---

## 3. Fatos do panorama que o `PROGRAMA.md` deveria refletir e não reflete

### 3.1 A conclusão sobre `I-01` — ela se sustenta, com dois recortes

**Sustenta-se.** P-01 é a pergunta *"este projeto é da empresa ou é pessoal do dono?"*, e o panorama
declara para a resposta "pessoal": *"**Free License cobre integralmente; o programa comeca direto no
tecnico.**"* P-02 (*"**se houver licenca**: Creators ou Automators?"*) perde o objeto por
construção — a condicional não se ativa. P-03 e P-04 tinham como cláusula mordente, respectivamente,
*"exploit any content for **commercial** use"* (R08-05) e as licenças de peso **não-comerciais**
(R13-20/21/22); ambas são condicionadas a uso comercial e não alcançam uso pessoal. E a decisão vem
de quem tem mandato, com sign-off registrado — que é exatamente o mecanismo que o panorama §6 exige.
O `ADR-0003` faz o que o panorama pede e o `PROGRAMA.md` acerta o ponto mais difícil: mantém a
**condição de escopo** viva em `AB-950`, permanentemente aberta por desenho.

**Dois recortes, e nenhum invalida a conclusão:**

1. **P-03 não fecha inteiro.** A cláusula que morde é comercial e sai; mas a exigência de marca
   conspícua **"Powered By GIPHY"** (R08-06, §8.1) **não é condicionada a uso comercial** — é
   exigência da API. `grep "Powered By" PROGRAMA.md` → **0**. E ela é o objeto de **P-17**, uma das
   nove perguntas que sumiram (F-1). Consequência concreta: `F2-04` está marcado *"desbloqueado por
   `I-01`"* sem carregar a única obrigação que sobrevive ao desbloqueio. **Correção:** ou `F2-04`
   ganha o slot de créditos no template + o teste que valida sua presença quando o manifesto tem
   asset com atribuição obrigatória, ou o card declara por escrito que o provedor GIPHY não será
   usado e o caminho é `@remotion/animated-emoji` (CC BY 4.0, R08-19, 3-0).
2. **P-02 fecha hoje e não fecha amanhã.** `AB-002` do panorama: *"Quantos renders/dia o pipeline
   realmente faz? O dado **nao existe retroativamente**: so existe se for instrumentado **desde o
   card 1**… Sem ele, **P-02 nunca fecha**."* O `PROGRAMA.md` encerra P-02 *"SEM DECISÃO"* e **não
   instrumenta a contagem** — `metrics/renders.jsonl` não existe em card nenhum. No dia em que
   `AB-950` disparar (o escopo deixar de ser pessoal), P-02 reabre **sem o dado que a responde**, e
   o dado não é recuperável. **Correção:** acrescentar o contador ao `∅-crit` de `F5-01` (pipeline de
   render) ou de `T-08`, com âncora `// ABERTO AB-002`. Custo hoje: uma linha. Custo depois: a
   pergunta fica permanentemente sem resposta.

**E as "cinco perguntas restantes" não são cinco.** Além de serem **catorze** contra o panorama
(F-1), o número não fecha nem contra a própria tabela de ADRs do `PROGRAMA.md`: ela marca
*"Decisão do dono? **sim**"* em **sete** ADRs (0003, 0007, 0009, 0011, 0012, 0013, 0015), dos quais
**seis** estão pendentes — e apenas quatro deles (0011=P-05, 0012=P-06, 0013=P-07, 0015=P-09)
correspondem a perguntas da §6. `ADR-0007` (canal e política editorial) e `ADR-0009` (origem do
timing) **não têm P correspondente**; e **P-08 → `ADR-0014` está marcado "Aceito"** embora o
panorama o classifique como *"a decisao de forma do dado mais cara do programa"*, ainda em disputa
(D-16), e a §5.2 o liste como **"NÃO É BARATO"** e *"(indefinido — bloqueado em P-08)"*.
**Correção:** `ADR-0014` volta a `PROPOSTO`; a contagem passa a ser derivada da tabela, não escrita.

### 3.2 Claims confirmados (≥ 3-0) que não têm destino no plano

| Claim | Placar | O que ele obriga | Estado no `PROGRAMA.md` |
|---|---|---|---|
| **R06-24** — semântica de exit code de hook: **2** = bloqueante; **1** (e qualquer outro) = **não-bloqueante** | 3-0 | *"**Este e o item mais caro do cluster.** Um hook de lint que faz `exit 1` **nao bloqueia nada** e produz falso verde perfeito"* | §IV-5 declara "falha aberto/fechado" por hook, mas **nunca escreve os exit codes**. Um `T-05` implementado com `exit 1` nos dois hooks de segurança satisfaz o card e **não bloqueia nada**. → entra na Entrega e no `∅-crit` de `T-05` |
| **R05-17** — Chrome fixado pela versão do Remotion | 3-0 | pin exato + re-baseline de 100 % das fixtures a cada bump + custo de disco por worktree | citado com o id errado (F-6); a consequência de re-baseline **não está escrita em lugar nenhum** |
| **R02-07 / R02-08** — 19 presentations no `exports`; `cube()` é pacote **pago** separado | 3-0 / 3-0 | *"**OBRIGA** que o enum de `presentation` do schema seja **gerado do `exports` do pacote instalado**, nunca copiado da doc"*; *"um LLM que le a doc escreve `cube()`… ou alguem 'resolve' instalando uma dependencia paga sem passar pelo dono"* | `F1-10` (transições) e `F0-02` (schema) não dizem que o enum é **gerado**. Num programa cujo manifesto é escrito por LLM, esta é uma falha de compilação garantida |
| **R07-23** — `--format=png` do Manim grava todos os frames em PNG (RGBA com `-t`) | 3-0 | *"**HABILITA o golden master barato do lado Manim**: lossless, sem codec, sem metadata de encoder, byte-comparavel"* | `F2-02` deixa o formato de alfa para o `ADR-0008` sem citar a sequência PNG como o caminho que torna o golden master do Manim possível — e `R07-21 (2-0)` já proíbe comparar bytes de vídeo |
| **R13-24** — consentimento e disclosure de voz são obrigação **contratual** de três fornecedores | 3-0 | *"**OBRIGA** um campo obrigatorio no gate de publicacao: `voz: sintetica/humana + provedor + licenca dos pesos + consentimento em arquivo + disclosure`"* | `F6-01` (checklist humano) e `G-HUM` não nomeiam nenhum desses cinco campos. E o risco é **na publicação**, não no build — nenhum teste técnico o pega |
| **R04-19** — a licença do **peso** ≠ a licença do **código** | 3-0 | *"um card que le so o `LICENSE` do repositorio passa verde e o projeto fica ilegal"* | `I-01` D4 acerta ao falar de "pesos", mas `F5-06`/`G-PROC` verificam "licença declarada e compatível" sem distinguir peso de pacote |
| **R06-05 / R06-09** — `remotion-dev/skills` **não declara licença**; `@remotion/mcp` está **deprecado** com desligamento anunciado | 3-0 / 3-0 | vendorizar é decisão jurídica (P-15); *"**OBRIGA** um card negativo escrito ('nao fazer, e por que') para que ninguem o reintroduza em tres meses"* | nenhum dos dois aparece. O `PROGRAMA.md` tem `T-10` (infra de skills) e Apêndice K (catálogo) sem tocar na origem das skills do fornecedor |
| **R06-14 / R06-16** — progressive disclosure: só `name`+`description` (~100 tokens) carregam no startup | 3-0 | *"**OBRIGA** que o dimensionamento de contexto das skills do programa seja feito por `name+description`, nao por corpo"* | §V-1 dimensiona o catálogo por número de skills e por roteamento em dois níveis, sem registrar o mecanismo |
| **R15-09** — o Claude Code tem worktree **nativa**, e ela ramifica do branch **default do remoto**, não do `HEAD` | 2-0 | *"**REFUTA** 'precisamos escrever o gerenciador de worktrees'"*; e *"ramificar do branch default e nao do `HEAD` e a diferenca entre a onda N+1 ver ou nao o trabalho da onda N"* | `T-04` escreve `new-task-worktree.sh` do zero, a partir do branch de integração. **O plano vence sobre plano** — mas o card deve registrar a refutação e justificar por que reimplementa, e o `PREP` de cada onda deve declarar de onde a worktree ramifica |

### 3.3 Uma incompletude que muda a natureza de um card

§I-2, l. 156, sobre `durationRestThreshold`: *"É `0.005` por default e mexer nele **alonga o
cálculo** — `measureSpring()` roda um laço **sem teto**."* Isso é **R02-04**, a consequência
secundária. **R02-03 (2-0)** dá a primária: *"mudar o limiar muda a **duracao da transicao**, logo a
duracao total da composicao: **nao e ajuste estetico, e ajuste de timeline**"*, e **R14-17**
quantifica: o tempo de acomodação vai de ≈1,06 s para ≈1,38 s — **+30 %, ≈10 frames a 30 fps**.
Com a metade que falta, `durationRestThreshold` deixa de ser "um parâmetro caro de calcular" e passa
a ser **uma entrada da aritmética de duração** — que é o objeto de `F1-10`, o card marcado 🔴 com a
justificativa *"errar aqui erra a duração de todo vídeo, e o erro é invisível frame a frame"*.

---

## 4. O escopo negativo do panorama (§10) × o que o `PROGRAMA.md` assume

Doze itens. **Seis** viraram premissa não verificada dentro do plano.

| # | O que o panorama declara não cobrir | O `PROGRAMA.md` assume resolvido? |
|---|---|---|
| 1 | *"Não é o plano"* — sem cards, ondas, grafo, prazos | **Não.** Os dois são complementares por construção; é a repartição que a precedência formaliza |
| 2 | *"Não decide nada que dependa de mandato. **As 18 perguntas** estão abertas"* | **SIM — e é o caso mais amplo.** Quatro fecham com sign-off (legítimo). **Nove desaparecem** (F-1) e pelo menos cinco delas já estão decididas por omissão dentro dos cards. Detalhado em §4.1 |
| 3 | *"Não contém **nenhum número medido nesta máquina** para o pipeline real"* | **SIM — e é o caso mais caro.** Detalhado em §4.2 |
| 4 | *"Não substitui os 19 arquivos de `docs/pesquisa/`"* | **Não.** §I header e `F0-05` leem `docs/pesquisa/L01-*`; o Apêndice A manda ler §1 e §7 do panorama com o placar antes do claim |
| 5 | *"Não cobre o `PROGRAMA.md`"* | **Não** — é a lacuna que este documento fecha |
| 6 | *"Não cobre o contrato de skills (S01..S19)"* | **Não**, e aqui o panorama é que erra (F-11) |
| 7 | *"Não cobre custo total nem prazo; faltam AB-002, AB-023, AB-073"* | **Parcialmente.** A Parte VIII se declara hipótese e `T-08` mede — mas **`AB-002` (renders/dia) não existe em card nenhum** e não é recuperável depois (§3.1, recorte 2) |
| 8 | *"Não cobre operação pós-publicação: metadados, **thumbnails**, capítulos, **disputa de Content ID**, analytics, retenção"* | **SIM.** `F5-05` **Thumbnail** é card de W7 num terreno que o panorama declara sem cobertura: seu critério (*"contraste abaixo do mínimo tem de falhar"*) depende de um número que **não tem claim com placar** na §1. E `F6-02` (runbook de publicação) não menciona disputa de Content ID, que o panorama §9.3 coloca como *"runbook de disputa, nao gate"* — obrigatório e ausente |
| 9 | *"Não cobre segurança além do que os clusters tocaram… **não houve** threat model"* | **SIM.** `grep sandbox PROGRAMA.md` → **0**. `F2-02` executa código Manim gerado por LLM e `F4-03` repara manifestos de LLM, sem ADR de isolamento e sem item de ledger. **P-12** está aberto no panorama, e `L01-C14 (3-0)` já provou que a blocklist AST *"**nao confere isolamento**"*. Some-se F-2: o guardrail herdado não bloqueia `rm -rf /` |
| 10 | *"Não cobre o que os clusters declararam fora de escopo (qualidade de voz, tema/fonte, custo de nuvem, **qual tier contratar**)"* | **Não.** `F1-03` não escolhe fonte por qualidade e o tier é `I-01`/P-02 |
| 11 | *"Não cobre a arqueologia completa do 3b1b: `run_skill_evals.py` **não foi executado**, o venv **não foi ativado**"* | **SIM.** §I-7 diz *"já em produção"* e `T-10` diz *"absorver a infraestrutura **já provada**"*. O panorama declara que ela **não foi executada** — "provada" é premissa. E `L02-C16 (2-0)` mostra duas das seis evals com `passed: True` literal. Ver F-2 |
| 12 | *"**Não é permanente.** Corte 2026-08-10; rechecagem geral 2026-11-10; dois gatilhos por evento: `dist-tags.latest` ≠ `4.0.*` e Manim `0.21.0`"* | **SIM, por omissão.** Nenhum card, nenhum gate e nenhum item de ledger carrega a data-limite ou os dois gatilhos. `AB-950` é o único item permanentemente aberto e cobre só o enquadramento de uso. **Correção:** dois itens de ledger com gatilho, no molde do `AB-950`, e `R01-11 (3-0)` já nomeia o evento: *"**OBRIGA** que o evento… seja o gatilho de re-pesquisa de R01, R02, R05, R11 e R12 **de uma vez**"* |

### 4.1 As nove perguntas que sumiram — e onde cada uma já virou plano

| Pergunta perdida | O que o `PROGRAMA.md` já decidiu sem ela |
|---|---|
| **P-10** — 16:9 ou 9:16? idioma? | `F5-04` entrega *"variantes 16:9 / 9:16"* com `∅-crit` *"conteúdo fora da safe area **de qualquer plataforma** tem de ficar vermelho"*. O panorama: **para 9:16 não há fonte** (R14-22; safe zones de TikTok/Reels/Shorts são `AB-071`, medição empírica pendente) e EBU R 95 (3,5 % / 5 %) é **televisão 16:9**. O critério de `F5-04` é, hoje, **incumprível por ausência de número** |
| **P-11** — LaTeX no container do Manim? grau de paralelismo? | `F2-02` não decide, e a §5.2 do panorama classifica como **NÃO É BARATO**: define a imagem Docker (TeX Live > 1 GB), o cold start de cada worktree e se a corrida de `media/Tex/` vira problema real |
| **P-12** — sandbox para código gerado por LLM? modo de permissão das ondas? | ausente (§4, item 9) |
| **P-13** — quantos agentes/worktrees, sob qual conta, com que teto de gasto? | `§III-10` fixa **13 agentes na W4**. O panorama: o teto de assinatura é *"janela de 5 h + semanal por assento, **compartilhada com o chat**"*, o piso por sessão nova é **US$ 0,034 + 3.424 tokens de preâmbulo**, e *"**OBRIGA** que o parametro de onda seja tokens por janela… nao processos simultaneos"* |
| **P-14** — determinismo byte-a-byte é gate? aceita container? | `F0-06` **já decidiu**: *"`just det:provar` … exige **bytes idênticos**"*. Ver §4.2 |
| **P-15** — vendorizar as skills do fornecedor ou instalar por CLI? | ausente; `T-10` constrói infraestrutura de skills sem tocar na origem |
| **P-16** — os hooks moram em `.claude/settings.json` commitado ou no frontmatter? | `T-05` **já decidiu**: é dono de `.claude/settings.json`. Decisão legítima de plano, mas o panorama a marca como decisão de **mandato**, e o `ADR-016` correspondente não existe |
| **P-17** — aceitamos marcas de terceiros dentro do vídeo? | ausente; e é o que faz `F2-04` fechar ou não (§3.1, recorte 1) |
| **P-18** — aplicar `keylase/nvidia-patch`? | ausente; `S-10` e `I-03` assumem fila com teto medido, que é a resposta "não" — tomada por omissão |

### 4.2 O caso mais caro: quatro ondas paralelas antes da primeira medição

O panorama põe **"quanto de RAM custa uma aba de render do Remotion"** com data-limite **"antes da
primeira onda paralela"** (§8.2), e as sementes `AB-016` (render 2× byte-idêntico?), `AB-017` (`gl`
muda o PNG?), `AB-019` (ruído de base), `AB-022` (RAM por aba), `AB-025` (pico com N×M) são todas
anteriores a qualquer decisão de baseline. O `PROGRAMA.md` escalona `I-03` — o card que mede a
máquina — em **W6.5**, depois de W3 (5 cards), **W4 (13 cards)**, W5 e W6. Três consequências:

1. **`F0-06` (W2) já fixa a resposta de `AB-016`.** O `∅-crit` exige *"bytes idênticos"* e
   *"snapshot aprovado é **imutável**"*. A decisão provisória do panorama para `AB-016` é
   **"presumir *não* até medir"**, e o custo de errar está escrito: *"se divergir, **nenhum golden
   master pixel-exato e possivel** e o gate vira obrigatoriamente metrica com tolerancia — o que
   muda o **tipo do card** e o **formato do baseline**."* Isto é P-06 e P-14 decididos dentro de um
   card de W2, com os ADRs correspondentes (0012, 0014) marcados **pendentes** na mesma página.
2. **A chave do baseline está incompleta e treze agentes escrevem nela ao mesmo tempo.** O panorama
   §9.2 define a chave como `{composição, frame, plataforma, versão do Remotion (= versão do
   Chrome), backend gl}`. O `PROGRAMA.md` usa `fixtures/snapshots/no-<nome>/**` — sem `gl` e sem
   versão do Chrome. `AB-017`: *"sem `gl` no nome do arquivo de baseline, **dois agentes com
   configs diferentes se sobrescrevem em silencio**."* A W4 é exatamente essa configuração:
   13 worktrees capturando snapshot em paralelo. E `grep chromiumOptions|swangle PROGRAMA.md` → **0**;
   `F0-06` fala em *"backend gráfico"* genérico, sem valor fixado e sem token em `F0-04`.
3. **O teto de paralelismo é um chute contra a única mitigação declarada.** §VIII-2 do
   `PROGRAMA.md` põe RAM como recurso nº 1 a saturar, com mitigação *"teto de concorrência por card,
   declarado no PREP da onda"* — mas o número que preenche esse teto só existe depois de `I-03`.
   A decisão provisória do panorama é **`N×M ≤ 8` até medir** (`AB-025`); a W4 pede 13.

**Correção mínima, e ela é de plano, não de fato:** partir `I-03` em dois. Um `I-03a` de **W0.5 ou
W1**, sem worktree, que roda apenas `AB-016`, `AB-017`, `AB-019`, `AB-022` e `AB-025` — cinco
comandos, todos já escritos na §7 do panorama — e cujo resultado entra no `PREP-w2` como o valor do
`gl`, o formato do baseline e o teto `N×M`. E um `I-03b` na W6.5 com o resto (sessões NVENC,
throughput de disco, tempo por segundo de vídeo). Sem isso, `F0-06` e os oito cards de nó da W4
constroem o oráculo inteiro do programa em cima de uma premissa que o panorama manda **presumir
falsa**.

---

## 5. Veredito

**A declaração de precedência se sustenta — e este documento é a prova, não a repetição dela.**

Ela se sustenta em três níveis, e é útil separá-los:

- **Como regra, integralmente.** O `PROGRAMA.md` faz o que promete no cabeçalho: **não reafirma fato
  por conta própria**. Toda afirmação técnica dele é ponteiro, e a arquitetura de citação existe.
  Não encontrei **nenhum** caso em que o `PROGRAMA.md` decida um fato **contra** o panorama por
  discordar dele — as onze divergências são erro de transcrição, de contagem, de id ou de
  atualização, nunca disputa. Isso importa: uma precedência falha quando um documento reivindica
  autoridade que não tem, e não é o caso aqui.
- **Como fato, ainda não.** **Onze divergências**, das quais **dez o panorama vence**. Em nenhuma a
  precedência se inverte. Na décima-primeira (F-11, a contagem de skills) o panorama é que está
  desatualizado — e ela é a única exceção que a regra precisa registrar, porque é um item da §10,
  **sem placar**, e §0 do próprio panorama restringe sua autoridade a claims com placar. *A
  precedência do panorama vale sobre fato **com placar**; sobre o escopo negativo dele, não vale.*
  Essa cláusula não estava escrita e precisa passar a estar.
- **Como prática de citação, não.** **23 das 57 citações (40 %) não conformam**: 3 apontam para ids
  inexistentes (`R01-12`, `R08-10`×2), 9 apontam para o tier NÃO VERIFICADO da §8 sem dizer que
  apontam, e 11 usam a forma `[Rnn · refutação]`, que não existe no vocabulário do panorama e não
  resolve para claim nenhum. Uma citação que não resolve **lê como verificada e nada a checa** — é o
  mesmo defeito que o `PROGRAMA.md` §V-1 mede em si mesmo (438 âncoras de linha para alvo móvel) e
  manda `T-10` recusar. A regra que ele escreve para as skills tem de valer para ele.

**Três divergências são bloqueantes antes da primeira onda paralela** — não porque sejam as mais
graves em tese, mas porque as ondas W2/W3/W4 as executam:

1. **F-2** — `§I-7` manda *absorver quase verbatim* hooks e gate de escrita que o panorama
   **PROIBE copiar** (`L02-C11`, `L02-C04/C05`, tier confirmado). `T-05` e `T-10` são os cards que
   produzem as garantias do programa inteiro; se nascerem cópias, o programa começa com gates
   decorativos e não tem como saber. Agrava: `R06-24 (3-0)` — um hook com `exit 1` **não bloqueia
   nada** — não está escrito em lugar nenhum.
2. **F-1 + §4.2** — nove perguntas ao dono desaparecidas, cinco delas já decididas por omissão
   dentro de cards; e `F0-06` (W2) fixando "bytes idênticos" antes de `AB-016`/`AB-017`/`AB-019`
   serem medidos, com `ADR-0012` e `ADR-0014` marcados pendentes na mesma página. Correção de plano:
   partir `I-03` e trazer as cinco medições para W0.5/W1.
3. **F-3** — o único caminho local de timing em pt-BR está citado como fato `(2-0)` quando o
   panorama o tem **em disputa** (D-05), com instrução explícita de **planejar pelo pior caso**; e
   ele sustenta `F2-03 → F3-01`, **no caminho crítico**. Custo de errar, palavra do panorama:
   *"um subsistema inteiro"*.

**O resto — F-4 a F-10, as 23 citações e os seis itens da §4 — é correção de texto e de destino, não
de arquitetura.** Nenhum deles derruba um card; todos mudam o que um card acredita.

**Conclusão operacional.** A §10.5 do panorama pode ser marcada como **fechada**: a relação entre os
dois documentos está declarada **e verificada**, com o escopo exato da autoridade de cada um. O que
fica em aberto não é a precedência — é a **manutenção** dela: nada hoje impede a divergência nº 12.
O mecanismo natural é o `T-02`/`T-10`, estendidos com uma checagem barata: **toda citação
`[R0n-nn (N-M)]` do `PROGRAMA.md` resolve para um id existente no panorama, com o placar idêntico,
ou o gate fica vermelho.** São vinte linhas de script, rodam offline, e teriam pego 23 dos 23 casos
desta seção antes de qualquer agente ler uma delas como verdade.
