---
name: adversarial-review
description: 'Provides the fresh-context refutation prompt and the falsifiable question bank for this video pipeline — how to phrase a question that names an observable result which, if it happens, kills the work, and how to keep the oracle from inheriting the implementation''s premise. Use whenever a diff, render, caption track, cache key, asset fetch or gate is about to be declared done, even if the user never says review, refutation or adversarial. Triggers: "revisão adversarial", "antes de concluir", "refute isso", "contexto fresco", "o smoke passaria", "prove que não quebrou", "review this diff", "falsifiable question", "render twice and diff", "would the test pass with a black frame", "would the test pass with a silent track"'
metadata:
  type: knowledge
  tier: metodo
  verification_signal: git show 8737ad6:PROGRAMA.md | grep -n 'CONTEXTO FRESCO' && git show 8737ad6:PROGRAMA.md | grep -n 'quadro totalmente preto'
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
# Revisão adversarial — refutar em contexto zero

> **Convenção de proveniência desta skill — leia antes de conferir qualquer citação.** Nenhuma
> afirmação abaixo é ancorada por `arquivo:linha` no `PROGRAMA.md` nem no panorama: essa forma não
> sobrevive a uma edição do alvo, o próprio `PROGRAMA.md §V-1` mede a deriva e a declara previsível,
> e **este arquivo já foi vítima dela** — um bloco inteiro de pinos morreu de uma vez. As âncoras
> usadas são: **`§N-M`** e **`Apêndice X`** = seções do `PROGRAMA.md`; **`F0-06`, `T-06`, `T-07`** =
> ids de card do `PROGRAMA.md §III-14`; **`panorama §N`** = seção de
> `docs/00-panorama-verificado.md`; **`R##-nn` / `L0n-Cnn`** = id de claim do panorama, resolvível
> com um `grep`; **`playbook §N`** = seção de `docs/PLAYBOOK-REFERENCIA.md`. Toda âncora sobrevive
> a uma reedição do alvo; se alguma parar de resolver, o alvo foi **renomeado**, não deslocado.

## Quando carregar

- Antes de encerrar qualquer card que produza diff. A tag `<revisao_adversarial>` do template de
  card não é opcional e não é "revise": é *refute* — `PROGRAMA.md §VI-4` e a tag
  `<revisao_adversarial>` do **Apêndice A**.
- Ao **escrever** um card (quem orquestra escolhe as perguntas antes, não o executor).
- Ao montar o subagente revisor: o que entregar a ele, o que não entregar, e como ler o veredito.
- **Não carregue** para desenhar o critério de aceitação executável e a sonda negativa do gate —
  isso é `falsifiable-gates`. Não carregue para construir a pilha de oráculos de vídeo (ffprobe,
  framemd5, timeline resolvida, frames-âncora) — isso é `video-characterization`.

## Conhecimento injetado

### A forma do prompt é literal, e a literalidade é o mecanismo

```
Antes de concluir, lance um subagente de CONTEXTO FRESCO que recebe APENAS o diff e este
card, e tenta REFUTAR:
   <pergunta falsificável 1 — vinda do registro do card, escrita por quem orquestra>
   <pergunta falsificável 2>
   <pergunta falsificável 3>
Corrija o que ele derrubar antes de encerrar.
```

O bloco acima é o do **template de card** — `PROGRAMA.md`, **Apêndice A**, tag
`<revisao_adversarial>`. A versão de **§VI-4** é idêntica exceto no primeiro marcador, onde diz
*"específica do domínio"*; o verbatim de origem está no **playbook §26**. Três propriedades
sustentam o mecanismo, e cada uma apagada em silêncio o transforma em teatro:

1. **Contexto zero.** O revisor não vê o histórico da conversa do implementador, então não herda
   nem a pressa nem as premissas — `PROGRAMA.md §VI-4` ("Por que adversarial").
2. **Tarefa escrita como tentativa de refutação**, nunca como "aprovar/reprovar". Um revisor
   autorizado a dizer "está bom" diz — `PROGRAMA.md §VI-4` (a «Regra dupla», item 1) ·
   **playbook §26**.
3. **As perguntas vêm do card**, escritas por quem orquestra, antes — `PROGRAMA.md §VI-4`.

**O limite honesto, e ele precisa estar escrito, não subentendido:** *quem escolhe as perguntas é
o implementador, e quem decide o que "foi derrubado" também* (**playbook §26**, "Limite honesto").
Nada dentro do mecanismo fecha essa brecha; a **única** mitigação declarada é procedimental — **as
perguntas vêm do card, escritas por quem orquestra, antes** (`PROGRAMA.md §VI-4` ·
`panorama §9.2, Camada 4`). Some com isso e a revisão vira o autor se aprovando com passos extras.
E a revisão reduz o erro que o autor não *veria*; não corrige o erro que ele não *quer* ver, e
**não existe taxa** — casos de sucesso são anedota (`PROGRAMA.md §VI-4`, "Limite honesto").

O implementador corrige **antes de abrir o PR**, não depois, e a revisão tem time-box —
`PROGRAMA.md` **Apêndice J**, linha «Revisão adversarial».

### O que faz uma pergunta boa

Ela nomeia um **resultado observável** que, se acontecer, **derruba o trabalho**. "Está bom?" não
é pergunta; *"o smoke passaria com um quadro totalmente preto?"* é — `PROGRAMA.md` **Apêndice F**
(abertura, e a linha **Composição / pixel**).

Teste de descarte, aplicável em dois segundos: ***o que este comando imprime se a tarefa não
fizer nada?*** Se a resposta for "verde", a pergunta é decorativa — **playbook §30**.

Segundo teste, específico deste domínio: a pergunta cita **um artefato que existe no disco depois
do render** (um frame, uma linha de `framemd5`, um campo de `ffprobe`, um `startMs`) ou apenas o
código-fonte? Pergunta que só olha o fonte não distingue "renderizou" de "renderizou preto".

Terceiro teste, mecânico: **a resposta que derruba é "sim"?** Se a pergunta está escrita de modo
que a resposta boa é "sim" ("o `gl` foi fixado?"), quem responde tem um caminho barato para o
verde. Inverta a redação até que o achado — não a conformidade — seja o "sim". Todo o banco
abaixo está normalizado assim.

### A regra dupla — e por que a segunda metade é a que se perde

> *"O oráculo e a implementação não podem derivar da mesma premissa não verificada."*
> `panorama §9.1` · `PROGRAMA.md §VI-4` (a «Regra dupla», item 2)

Isso elimina de saída o oráculo mais tentador deste projeto: **gerar o vídeo a partir do manifesto
e conferir o vídeo contra o mesmo manifesto** — as duas cópias erram juntas (`panorama §9.1`).
Instâncias concretas que a revisão tem de caçar:

| Par proibido | Por quê | Fonte |
|---|---|---|
| timeline resolvida gerada pelo **mesmo código** que renderiza | a asserção tem de vir de expectativa escrita à mão para a fixture, nunca de outra execução do mesmo motor | `panorama §9.2, Camada 2` |
| comparar **saída de LLM contra saída de LLM** | o snapshot começa no manifesto congelado, nunca no briefing | `panorama §9.4`, item 1 |
| invariante escrita pela mesma pessoa que escreveu o motor | mitigação declarada: as perguntas vêm do card, escritas antes | `panorama §9.2, Camada 4` |
| fixture fabricada alimentando a própria asserção | não é teste | `PROGRAMA.md` **Apêndice H** |
| motor e oráculo repetindo a mesma premissa | as duas cópias erram juntas e o diferencial fica cego | `PROGRAMA.md` **Apêndice H** |

O único candidato deste programa cujo oráculo **não** deriva da mesma premissa é o round-trip:
transcrever o MP4 final e comparar com o roteiro. Ele mede o artefato **pelo sentido**, não pela
receita — e cobra o preço de ser não-determinístico, então a comparação é por distância tolerada,
nunca por igualdade (`panorama §9.2, Camada 5`; o whisper-cli não expõe semente e tem fallback de
temperatura ligado por default — **placar (2-0)**, R04-16, `panorama §2.3`).

---

## Banco de perguntas falsificáveis deste domínio

Escolha 3 a 4 por card, do eixo que o diff toca. **Em toda pergunta abaixo, a resposta que derruba
o trabalho é "sim"** — a coluna do meio diz o que cai quando ela é "sim".

### Determinismo

| Pergunta (um "sim" derruba) | O que cai | Placar · fonte |
|---|---|---|
| **Dois renders seguidos diferem em alguma linha de `ffmpeg -i out.mp4 -f framemd5 -`?** O artefato do diff não é o MP4 e não são os PNGs — isto vale para a **camada 1, lado Remotion**; do lado Manim o artefato comparável é PNG (linha adiante) | o determinismo, e a linha diz **em qual frame**. O Apêndice F pede "qualquer **byte** diferente" (`PROGRAMA.md` **Apêndice F**, linha **Determinismo**); sobre **fato** o panorama vence, e ele mediu o contrário — dois MP4 com bytes diferentes (um com `bitexact`, outro sem) deram o **mesmo** framemd5 | medição local R11, **sem placar** · `panorama §9.2, Camada 1` |
| Existe comando FFmpeg neste diff **sem** `-fflags +bitexact -flags +bitexact -map_metadata -1`, ou a versão do FFmpeg **não** está pinada? | a reprodutibilidade. "FFmpeg com thread não é determinístico" está refutado **para ffmpeg 6.1.1 + libx264, medido nesta máquina** — não para outra versão e não para encoder de hardware; o que quebra a igualdade é a **versão** (`TAG:encoder=Lavf…`), e subir o FFmpeg invalida 100% dos baselines de uma vez | (2-0) R10-25 · (1-0) R11-11/12 · `panorama §2.4` |
| O render roda com `chromiumOptions.gl` **não** declarado? | o default na linha **4.0.x** é `null` — "o Chrome decide", a pior situação possível para determinismo (no 5.0 passa a `angle`); a variável precisa ter nome e lugar antes de existirem 200 baselines | (2-0) R05-13/14/16 · `panorama §2.4` |
| A chave do baseline **omite** `gl` ou a versão do Chrome? | o Remotion fixa a versão do Chrome Headless Shell pela própria versão; bump de Remotion = bump de Chrome = re-baseline total | (3-0) R05-17 · `panorama §1.2` |
| O gate compara **bytes de vídeo** do Manim? | o Manim **CE 0.20.1** não configura `bitexact` em lugar nenhum e grava a própria versão em `metadata["comment"]` **dentro** do container; `sha256` de vídeo nunca fecha. O artefato comparável é PNG (`--format=png -t`) | (2-0) R07-21 · (3-0) R07-23 · `panorama §2.4` e `§1.3` |
| Existe `.gif` dentro de `<img>`/`<Img>` no diretório de composições? | `<img src="x.gif">` anima pelo relógio de parede e produz saída diferente a cada render; `@remotion/gif` é determinístico por três mecanismos verificáveis | (2-0) R08-15 · a recomendação da doc é só (1-0) R08-16 · `panorama §2.6` |
| Alguma animação é dirigida por Web Animations API ou por `setTimeout`? | é o erro clássico do domínio: o exemplo da doc do Code Hike usa WAAPI, que é relógio de parede, e o template Remotion aplica estilo por frame via `useCurrentFrame()`+`interpolate()` justamente por isso | (2-0) R09-16 · `panorama §2.7` |
| "Rodou duas vezes igual, logo é determinístico" está sendo aplicado a uma chamada de LLM? | as duas docs dizem explicitamente que `temperature: 0` **não** garante saída idêntica; duas amostras iguais são coincidência estatística | (2-0) R16-21 · `panorama §3.3` |

### Pixel, quadro preto e layout

| Pergunta (um "sim" derruba) | O que cai | Placar · fonte |
|---|---|---|
| **O smoke passaria com um quadro totalmente preto?** | um vídeo de 100 s inteiramente preto passa em **todos** os critérios estruturais de `ffprobe`; e o hash de tela preta é perfeitamente estável, então a prova de determinismo também passa | `panorama §9.2, Camadas 0 e 4` · `PROGRAMA.md` **Parte 0, C1** |
| O `pix_fmt` do intermediário do Manim é `yuv420p`, isto é, **sem** canal alfa? | perder o alfa **não** gera erro, gera fundo preto: `--format=mp4 -t` produz `.mov` silenciosamente e perder o `-t` produz `yuv420p`, sempre com exit 0 | (3-0) R07-06 (o `.mov`) e (3-0) R10-09 em `panorama §1.3` · (2-0) R07-08 (o `yuv420p`) em `§2.5` · o "falha silencioso mais provável do programa" é `§9.2, Camada 0` |
| O caminho do arquivo de saída do Manim foi montado por **concatenação** de extensão? | a função que mais parece utilitário pronto (`find_video` do `manim-api`) varre só `*.mp4`, devolve `None` com `-t`, e o pipeline reporta erro **com `returncode == 0`** | (3-0) L01-C07 · `panorama §1.8` · o call-site é `3b1b:manim-api/services/manim_executor.py` |
| A asserção de resolução lê a **letra da flag** em vez de `pixel_width`/`pixel_height` do arquivo? | no Manim CE, `p` é 2560×1440 e `k` é 3840×2160 — várias fontes trocam os dois, e um golden master gravado na resolução errada fica 100% vermelho | (3-0) R07-18 · `panorama §1.3` |
| **A fonte veio da rede?** | `@remotion/google-fonts` gera módulos que apontam para `fonts.gstatic.com`: usar o pacote **é** baixar no render. Para offline, `@remotion/fonts` + `staticFile()` com o `.woff2` versionado. A restrição é **nossa**, por render local — a doc do Remotion não a emite | R09-25 (**segunda metade**) — as duas linhas de origem são **refutações sem coluna de placar**, `panorama §3.3`. **Não herde o placar `3-0` de R09-25 em `panorama §1.5`:** ele é da **licença** OFL das fontes, não da entrega pela rede |
| "A fonte carregou" está sendo tratado como sinal? | o Chrome renderiza com fallback em silêncio e a medida do fallback é plausível; `validateFontIsLoaded` mede duas vezes e lança se as medidas baterem — **opt-in enquanto o projeto estiver no 4.x**, default só no 5.0 | (2-0) R09-13/14 · `panorama §2.7` |
| O texto estoura o quadro em pt-BR, que é mais longo que em inglês? | `fitText()` resolve **uma largura, uma linha** — para bloco de código o par é `fitTextOnNLines()`/`fillTextBox()`; e overflow **não muda o exit code do render** | (3-0) R09-12 · `panorama §1.2` e `§9.2, Camada 4` |
| Os frames-âncora incluem o frame 0? | o frame 0 de quase toda animação é o estado inicial (opacidade 0, escala 0) — um baseline de tela quase vazia. Os frames vão no **meio** das transições | `panorama §9.2, Camada 3` |
| O limiar foi afrouxado até o teste parar de piscar? | com `maxDiffPixels` alto o bastante, "o texto sumiu" passa, e a perda é invisível. Gate por duas dimensões ao mesmo tempo (`threshold` baixo **e** `maxDiffPixels` pequeno) | `panorama §9.5` |
| O baseline foi aprovado a partir do Studio? | o navegador do preview não é o do render | `PROGRAMA.md` **Parte 0, C5** · **Apêndice H** |
| Existe algum nó do manifesto sem **nenhum** frame em que ele é visível? | pega o nó que "renderizou" atrás de outro — nada mais pega | `panorama §9.2, Camada 4` |

### Áudio, legenda e sincronia

| Pergunta (um "sim" derruba) | O que cai | Placar · fonte |
|---|---|---|
| **Existe caminho em que a legenda aparece antes de a palavra ser falada?** | pergunta canônica do eixo — `PROGRAMA.md` **Apêndice F**, linha **Áudio / sincronia** | — |
| **O teste passaria com a faixa de áudio muda?** | não existe normalização de loudness embutida no render **do Remotion** (enumeração completa de 96 arquivos de opções, evidência positiva de ausência); o gate mede com `ebur128` fora do Remotion, ou não mede | (2-0) R03-18 · `panorama §2.2` |
| Três faixas em `volume={1}` somam além de 0 dBFS neste diff? | volume > 1 **amplifica** e a mixagem é `amix … normalize=0` — o Remotion desliga a normalização que o FFmpeg traz ligada. Nada impede clipping, e não há warning | (2-0) R03-10/17 · `panorama §2.2` |
| O `frame` do callback de `volume` foi tratado como absoluto? | ele é **relativo ao início da mídia**; o bug é silencioso em cena que começa no frame 0, então a fixture precisa de áudio dentro de `<Sequence from={90}>` | (2-0) R03-08 · `panorama §2.2` |
| O diff mistura `import {Audio} from 'remotion'` com `<Audio>` de `@remotion/media`? | são **duas pipelines de timing distintas** (`adelay` em ms inteiros × offset por cabeçalho WAV em amostras) disputando o mesmo `amix`; o import legado compila, roda e produz som | (2-0) R03-02/04 · R03-25 · `panorama §2.2` |
| Algum passo intermediário faz `.trim()` no `text` da legenda? | `createTikTokStyleCaptions` segmenta pelo **espaço inicial** do `text`; um trim colapsa a paginação inteira e o sintoma é visual, não erro | (2-0) R04-07 · `panorama §2.3` |
| O critério de sincronia é mais apertado que ±150 ms num caminho de ASR? | com collar de 0,2 s em fala sintética limpa, DTW dá F1 74,7 e WhisperX 76,7 — um quarto das palavras erra no caso mais fácil. ±50 ms é irrealizável, não rigoroso | (2-0) R04-17 · `panorama §2.3` |
| O áudio e o timing podem ser invalidados **separadamente** no cache? | se o áudio mudar e o timing não, o vídeo dessincroniza **sem erro** — o par tem de ser cacheado junto e versionado, e o render nunca deve re-sintetizar | `panorama §9.4`, item 2 |
| **O gate de duração só olha o exit code — ou lê a duração do *container* em vez da do *stream*?** | a invariante "soma das durações dos nós == duração da composição" pega a cauda preta no fim causada por somar em vez de subtrair transições; e duração do **container** ≠ duração do **stream** | `panorama §9.2, Camada 4` · `PROGRAMA.md` **Apêndice H** (e **Parte 0, C4**) |

### Cache, assets e rede

| Pergunta (um "sim" derruba) | O que cai | Placar · fonte |
|---|---|---|
| **O estágio chama a rede quando o cache acerta?** Prove com a rede **bloqueada** e o cache quente | suíte "offline" que apenas não usa a rede não é o mesmo que rede bloqueada; e o guarda precisa bloquear DNS e subprocesso, não só o cliente HTTP | `PROGRAMA.md` **Apêndice F**, linha **Resolução / rede** · **Apêndice H** (o gate é `F2-07`) |
| A chave de cache omite algum parâmetro que muda a saída? Nomeie **um** e prove o miss | cache com 100% de acerto é o sintoma, não a métrica: a chave omite um parâmetro e serve o asset velho | `PROGRAMA.md` **Apêndice F**, linha **Cache / store** · **Apêndice H** (o gate é `F0-07`) · **Parte 0, C12** |
| Houve **queda súbita** de tempo de CI depois de mexer numa cena do Manim? | o hash de *play call* é **CRC32** (checksum, não hash criptográfico) e **trunca arrays numpy acima de 1000 elementos** para uma amostra — colisão é possível por construção, e um partial errado faz o golden master passar com o vídeo errado. Queda súbita de tempo é alarme, não vitória | (2-0) R12-19/R07-19 · `panorama §2.4` |
| `--disable_caching` está sendo tratado como "não escreve cache"? | o help literal é *"Disable the use of the cache (still generates cache files)"*; quem limpa é `--flush_cache` | (2-0) R12-19/R07-19 · `panorama §2.4`, corroborado pela linha de refutação em `§3.3` |
| Existe URL remota no manifesto resolvido ou no bundle? | `@remotion/sfx` exporta **strings de URL remotas**, não componentes: um render sem internet trava no `delayRender`. E o template Code Hike baixa type definitions de CDN em runtime | (2-0) R03-21 · (2-0) R09-17 · `panorama §2.2` e `§2.7` · o invariante é `C7` (`PROGRAMA.md` **Parte 0**) |
| A métrica "zero chamadas externas" é publicada **sem denominador**? | é verdade com o cache perfeito **e** com nada rodando; as duas leituras produzem o mesmo número e significam o oposto | `PROGRAMA.md` **Apêndice F**, linha **Runbook / operação** · **Apêndice H** (denominador obrigatório, `T-08`) |
| O estágio **"conserta"** algo da resposta externa antes de gravar o cassete? | um cassete que já vem corrigido testa o corretor contra si mesmo; ele tem de ser **sósia**, não sucessor | `PROGRAMA.md` **Apêndice F**, linha **Resolução / rede** |

### Gate e verificador — as perguntas que derrubam o próprio teste

| Pergunta (um "sim" derruba) | O que cai | Placar · fonte |
|---|---|---|
| Existe seletor de teste neste card que casa **zero** testes? | todo runner com seletor sai verde quando o seletor não casa nada; no programa de origem, 25 de 42 cards tinham esse critério e ele passava antes da primeira linha escrita | `PROGRAMA.md §IV-2` (abertura) · **Apêndice H** · **Parte 0, C2** — o verificador é `T-06` |
| O gate usa `git diff --exit-code` num diretório de saída? | ele **não enxerga arquivo não rastreado**; a captura tem de falhar se o arquivo esperado não existir | `panorama §9.2, Camada 2` · `PROGRAMA.md` **Apêndice H** · **Parte 0, C3** |
| O verificador trata "zero itens parseados" como sucesso? | `all([])` é `True` em Python — uma função de eval que devolve lista vazia grava `passed: true` com **zero** asserções | (2-0) L02-C16 · `panorama §1.8` · o call-site é `3b1b:.agents/scripts/run_skill_evals.py` |
| Algum hook de política **do Claude Code** sai com `exit 1`? | só nessa semântica (0 = ok, 2 = bloqueante, **qualquer outro = não-bloqueante**) `exit 1` deixa o log vermelho, o agente segue e o commit entra. Política exige `exit 2` ou `exit 0` + JSON de negação. Num hook de **git** `exit 1` bloqueia — não transporte a regra | (3-0) R06-24 · `panorama §1.6` |
| O autoteste asserta **só o exit code**? | só o exit code não distingue "acusou" de "quebrou" | `PROGRAMA.md` **Apêndice F**, linha **Esqueleto / ferramenta** · **Apêndice H** |
| O tripwire lê o mesmo texto que o parser? | então não é independente | `PROGRAMA.md` **Apêndice F**, linha **Gate / verificador** |
| O verificador **pula** o que não entende? | verde por omissão; a regra é falhar fechado | `PROGRAMA.md` **Apêndice F**, linha **Gate / verificador** · **Apêndice H** (o gate é `F0-08`) |

### Onda de composição, e o merge

| Pergunta (um "sim" derruba) | O que cai | Placar · fonte |
|---|---|---|
| **Existe asserção neste diff sobre a LISTA COMPLETA de alguma coisa?** Reescreva como asserção sobre a **presença do seu item**, nunca sobre a ausência dos outros | caso real: dois cards, cada um em seu arquivo, cada um verdade contra a própria base, contraditórios juntos — e mergearam em silêncio | `PROGRAMA.md` **Apêndice A, §A-4** (a pergunta obrigatória e o caso real) · **Apêndice F**, linha **Onda de composição** |
| Você tocou um singleton (arquivo de rotas, lockfile, porta, id de composição)? | o teto de paralelismo é o número de singletons, e cada um vira dono exclusivo ou sequência | **playbook §12** · `PROGRAMA.md` **Parte II, «Os singletons — o teto real de paralelismo»** · `§III-4` (os quatro dispositivos de uma onda de composição) |
| Existe teste de irmão desta onda que nunca rodou **junto** com o seu? | cada um é verdade contra a própria base; o gate roda após **cada** merge, nunca ao fim da onda | `PROGRAMA.md §III-14` (protocolo obrigatório da **W4**) · **Apêndice H** · **Apêndice I** («Por onda») |

**Se a revisão for automatizada e for mesclar código: simule o merge antes de aplicá-lo.** Um
merge direto deixaria marcadores de conflito na worktree onde o agente **ainda trabalha** — e
marcador de conflito é o material que faz um modelo alucinar e apagar lógica (`PROGRAMA.md`
**Apêndice F**, fecho). E, na integração da onda, mesclar mais de um branch de uma vez usa
**octopus**, que desiste do lote inteiro no primeiro conflito e cujo `revert -m 1` desfaz **todos**
os contribuintes — **placar (2-0)**, R15-22/23, `panorama §2.8`.

---

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Pedir "revise este diff".** Revisão devolve aprovação; o mandato escrito é *refutar*. Trocar o
  verbo é a forma mais barata de desligar o mecanismo sem que nada fique vermelho.
- **Passar o histórico da conversa ao revisor "para dar contexto".** É exatamente o que se está
  tentando remover: o contexto herdado traz a premissa que se quer testar. Entregue o diff e o
  card, e nada mais (`PROGRAMA.md §VI-4`: *"recebe APENAS o diff e este card"* + "Por que
  adversarial").
- **Deixar o executor escolher as perguntas.** Quem escolhe a pergunta escolhe o resultado. As
  perguntas vêm do registro do card, escritas por quem orquestra, antes (`PROGRAMA.md §VI-4`).
- **Deixar o executor ser também o juiz do que "foi derrubado".** É a metade do limite honesto que
  some primeiro (**playbook §26**): sem a pergunta escrita antes, "isso não conta" fecha qualquer
  achado, e o veredito não deixa rastro. O achado vai para o handoff, com `destinatarios:` —
  texto, não julgamento verbal (`PROGRAMA.md §VI-6`).
- **Reescrever o card quando a refutação derruba a premissa.** O executor não pode: o corpo do
  card é registro histórico imutável e a refutação é *append-only* no handoff. Quem orquestra
  altera por branch `PREP-<slug>`, fora da onda (`PROGRAMA.md §VI-5`, "Autoridade" +
  "Consequência de desenho").
- **Deixar a refutação sem destinatário.** Uma premissa refutada sem descendente **nomeado** não é
  achado, é anotação — e o handoff exige `destinatarios:` preenchido, aceitando vazio só como a
  string literal `NENHUM` (**playbook §27** · `PROGRAMA.md §VI-5` e `§VI-6`).
- **Tratar "nenhuma pergunta derrubou nada" como verde.** Ausência de reclamação não é sinal
  (`PROGRAMA.md §VII-1` · **Apêndice H**, última linha). Se as três perguntas passam de primeira,
  suspeite **das perguntas**: injete deliberadamente o defeito que cada uma descreve e exija que
  ela o pegue.
- **Pedir ao revisor um juízo estético.** Qualidade de vídeo não tem métrica aceita; todas as
  camadas medem "não quebrou". Isso é regra manual, registrada por escrito, não pergunta de
  refutação (`panorama §9.3`).
- **Contar a revisão adversarial como cobertura.** Ela reduz o erro que o autor não *veria*; não
  corrige o erro que ele não *quer* ver, e não existe taxa — casos de sucesso são anedota
  (`PROGRAMA.md §VI-4`, "Limite honesto").
- **Aplicar o patch do revisor direto na worktree do agente vivo.** O agente ainda está escrevendo
  ali; um merge direto deposita marcadores de conflito no arquivo que ele vai reler, e é esse
  material que o faz alucinar e apagar lógica. Simule o merge primeiro (`PROGRAMA.md`
  **Apêndice F**, fecho).
- **Usar o próprio manifesto (ou outra execução do mesmo motor) como oráculo.** É a violação mais
  fácil de cometer e a mais difícil de enxergar, porque o teste fica verde e estável.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| "o subagente adversarial rodou" | ele pode ter recebido perguntas que passam com o diff vazio | sonda negativa por pergunta: injetar o defeito descrito e exigir que a pergunta o pegue |
| "o revisor não achou nada" | ausência de reclamação não é sinal (`PROGRAMA.md §VII-1`) | contador por onda de `perguntas que derrubaram algo / perguntas feitas`, publicado pelo estado derivado (card **`T-07`**, `PROGRAMA.md §III-14`) — hoje **inexistente**, ver `## Não verificado` |
| "o revisor leu o card" | se leu também a conversa, herda a premissa e o contexto deixou de ser zero | o prompt entrega diff+card por arquivo, e o handoff registra **quais arquivos** foram entregues |
| `exit 0` do render | um quadro preto renderiza com sucesso | asserção de entropia por frame acima de um limiar (card **`F0-06`**, entrega (e), `PROGRAMA.md §III-14` · **Apêndice H**) |
| `sha256` idêntico do MP4 | o Manim grava a própria versão dentro do container; e bytes iguais provam estabilidade, não correção | comparação de `framemd5` + comparação de PNG no lado Manim |
| dois renders idênticos | prova estabilidade, não correção: dois renders de um vídeo errado passam | camada de invariantes + round-trip por transcrição |
| "o gate de sincronia passou" | com tolerância frouxa o suficiente, tudo passa | limiar escrito no card **antes** da medição, e piso de ±150 ms em caminho de ASR |
| "o merge não deu conflito" | o git prova ausência de conflito **de texto**, e nada mais | o **gate completo rodando depois de cada** merge, nunca ao fim da onda (`PROGRAMA.md §III-14`, protocolo da **W4** · **Apêndice H**), mais a pergunta obrigatória da onda de composição aplicada ao diff **já mesclado** (**Apêndice A, §A-4**) |
| "a pergunta é do domínio certo" | pergunta que só olha o fonte não distingue "renderizou" de "renderizou preto" | exigir que cada pergunta cite um artefato de disco pós-render |
| "a pergunta foi respondida" | se a resposta boa é "sim", conformidade e achado ficam do mesmo lado | redação normalizada: a resposta que derruba é sempre "sim" |

## O que esta skill NÃO cobre

- **Escrever o critério de aceitação, a sonda negativa e o tripwire do gate** — `falsifiable-gates`.
- **A pilha de oráculos de vídeo** (ffprobe, framemd5, timeline resolvida, frames-âncora,
  invariantes, round-trip) e a captura/aprovação de baseline — `video-characterization`.
- **Propriedade de arquivo, disparo, barreira e ordem de merge da onda** — `parallel-worktrees`
  (mecânica de worktree) e `wave-planning` (grafo, níveis e ondas).
- **Registrar a premissa derrubada como item com verificação executável e destinatário** —
  `uncertainty-ledger`.
- **Os fatos de API citados pelas perguntas** — `remotion-core`, `remotion-render-pipeline`,
  `manim-bridge`, `audio-captions-sync`, `asset-acquisition`, `ffmpeg-media-ops`, `llm-authoring`.

## Não verificado

Seis itens entraram sem placar ≥2-0. Cada um traz o comando que fecha a lacuna.

1. **A simulação de merge por `git merge-tree --write-tree`.** `PROGRAMA.md` **Apêndice F** (fecho)
   manda simular, mas não nomeia o comando, e nenhum arquivo de pesquisa o mediu (o que existe é
   R15-22/23 sobre octopus, que é outra pergunta). Fecha com:
   `git merge-tree --write-tree <base> <branch>; echo $?` num clone descartável, conferindo que
   ele lista os conflitos **sem** tocar a árvore de trabalho, na versão de git desta máquina.
2. **A eficácia da revisão adversarial.** Não há taxa publicada nem medida; o próprio programa
   declara que casos de sucesso são anedota (`PROGRAMA.md §VI-4`, "Limite honesto"). Fecha com um
   contador por onda (`perguntas que derrubaram algo / perguntas feitas`) publicado pelo estado
   derivado — o card `T-07` existe (`PROGRAMA.md §III-14`) mas ainda não está construído, então
   hoje o número **não existe**.
3. **Se o subagente revisor deve poder executar comandos** (rodar o gate, renderizar) ou só ler o
   diff. Nenhuma fonte. Fecha medindo custo e achados de uma onda com as duas topologias.
4. **O time-box da revisão.** `PROGRAMA.md` **Apêndice J** exige um, e não dá número. Fecha
   cronometrando as primeiras revisões e fixando o valor no template de card.
5. **O limiar de entropia que separa "quadro preto" de "quadro escuro legítimo".** A asserção de
   entropia está prescrita (card **`F0-06`**, entrega (e)), o número não existe. Fecha medindo a
   entropia por frame de um render conhecido-bom e de um render forçado a preto, e escrevendo o
   corte entre as duas distribuições.
6. **A base do eixo Determinismo é mais fina do que a tabela sugere.** O framemd5 igual entre um
   MP4 com e um sem `bitexact` é **uma medição local sem placar**; `R11-11`/`R11-12` (bitexact
   existe para reprodutibilidade; x264 é determinístico por default) são **(1-0)** no arquivo de
   origem, e a reprodutibilidade medida vale para **ffmpeg 6.1.1 + libx264 nesta máquina**, não
   para outro encoder. Fecha rodando o comando de R10-25 nesta máquina, depois com `h264_nvenc`,
   e comparando `ffmpeg -i out.mp4 -f framemd5 -` entre as duas execuções de cada encoder.

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
