---
name: video-characterization
description: 'Injects the video-adapted golden master method — the six-layer oracle pyramid and its build order (structural ffprobe first, key-frame pixel diff last), which artifact to pin per output type, how determinism is proven twice before the approved directory is touched, why a red run writes to *.received/ and never overwrites the baseline, the catalog of headless-Chrome nondeterminism and how each source is removed, CONTRATO vs BUG-A-DIVERGIR classification, fixture lifecycle and baseline storage cost. Use whenever a task captures, approves, compares, calibrates or retires a visual or audio baseline, or answers "how do we know this render did not regress", even if the user never says snapshot, golden master or characterization. Triggers: "snapshot", "golden master", "baseline", "fixture", "regressão visual", "visual regression", "determinismo", "flaky render", "pixel diff", "limiar de diff", "framemd5", "received", "re-baseline", "caracterização", "aprovar o frame".'
metadata:
  type: knowledge
  tier: metodo
  verification_signal: ffmpeg -hide_banner -h muxer=framemd5 >/dev/null && ffmpeg -hide_banner -h filter=libvmaf 2>&1 | grep -q "Unknown filter"
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
# Caracterização de vídeo — o golden master quando não existe legado

## Quando carregar

- A tarefa vai **criar, aprovar, comparar, recalibrar ou aposentar** qualquer linha de base de
  pixel, de frame, de timeline ou de áudio.
- A tarefa precisa responder *"como sabemos que este render não regrediu?"* — inclusive quando a
  palavra "snapshot" não aparece no card.
- Um teste visual começou a piscar e alguém está prestes a mexer no limiar.
- A tarefa escreve o `disciplina: caracterizacao` de um card, ou depende de um card que escreveu.
- **Não carregue** para escrever o critério de aceitação genérico de um card (é `falsifiable-gates`),
  nem para descobrir qual flag do `remotion render` existe (é `remotion-render-pipeline`), nem para
  a aritmética de duração de `<TransitionSeries>` (é `remotion-core`).

## Conhecimento injetado

### 1. Aqui o oráculo não é um sistema antigo — é determinismo mais um humano

O playbook define "iniciado" por *"nenhuma conversão começa sem um golden master pinado"*. Neste
programa **não há legado**, e o produto é um vídeo cuja qualidade final é julgamento estético.
Importar a regra ao pé da letra faz o programa nunca começar. A adaptação canônica é o **ADR-0001**:
nenhum estágio é considerado iniciado enquanto não existir um oráculo capaz de **reprovar** aquele
estágio — e "capaz de reprovar" é uma sonda negativa, não opinião — **Norma** — fonte:
`PROGRAMA.md · ADR-0001`. O que trava tudo que produz pixel ou som é **snapshot aprovado por
humano mais prova de determinismo** — **Norma** — fonte: `PROGRAMA.md §"Os três avisos" · aviso 1`.

A restrição que atravessa todas as camadas: *o oráculo e a implementação não podem derivar da mesma
premissa não verificada* — **Norma** — fonte: `docs/PLAYBOOK-REFERENCIA.md:322`. Isso elimina de
saída o oráculo mais tentador deste projeto: **gerar o vídeo a partir do manifesto e conferi-lo
contra o mesmo manifesto**. As duas cópias erram juntas — fonte:
`docs/00-panorama-verificado.md §9.1`.

Frase operacional: **verde quer dizer "confere com o snapshot aprovado", nunca "o vídeo está bom"**
— fonte: `PROGRAMA.md §"Nota final sobre o que este documento não é"`.

### 2. A pirâmide de camadas — e a ordem de construção, que não é a ordem de importância

Nenhuma camada sozinha é o oráculo. Elas estão em **ordem de construção, da mais barata para a mais
cara** — fonte: `docs/00-panorama-verificado.md §9.2`. Construir na ordem errada é o erro de
sequenciamento mais caro do domínio: quem começa pelo diff de pixel gasta semanas calibrando limiar
antes de ter qualquer gate.

| # | Camada | O que responde | Limite duro dela |
|---|---|---|---|
| **0** | **Oráculo estrutural por `ffprobe`** — *o mais barato e o mais subestimado* | duração exata em frames **por stream**, fps, resolução, codec, `pix_fmt`, nº de trilhas, taxa de amostragem, e **presença de canal alfa nos intermediários do Manim** | **um vídeo de 100 s totalmente preto passa em todos os critérios** — nunca pode ser a única |
| **1** | **Prova de determinismo por `framemd5`** *(roda sempre)* | "mudou alguma coisa?" **e** "em qual frame?" | prova **estabilidade, não correção**: dois renders idênticos de um vídeo errado passam |
| **2** | **Timeline resolvida** como artefato textual pinado | aritmética de tempo | não prova pixel nem som |
| **4** | **Invariantes de propriedade** (verdades por construção, sem artefato de referência) | "está quebrado?" | nunca provam que está **bom**; e são escritas por quem escreve o motor |
| **3** | **Golden master de frame-chave** (`remotion still` + diff de imagem) | "**o que** mudou visualmente" | caro, e o limiar depende de ruído **medido** |
| **5** | **Round-trip**: transcrever o MP4 final de volta e comparar com o roteiro | o artefato final **pelo sentido**, não pela receita | Whisper **não é determinístico** entre versões, threads e quantizações: comparação por **distância tolerada**, nunca por igualdade — e roda **fora** do gate rápido |

Repare em duas coisas que a ordem esconde: a **camada 4 vem antes da 3** — invariante é mais barata
que pixel, e pelo menos um critério dela tem de **falhar por ausência** (diretório de frames vazio ⇒
vermelho, não verde). E a **camada 3 é a última do gate rápido**, liberada só depois de AB-019 (o
ruído medido) e AB-017 (`gl` na chave do baseline): escrever o limiar antes de medir o ruído é
calibrar por acidente — fonte: `docs/00-panorama-verificado.md §9.5, itens 4 e 5`.

A camada 5 é a única cujo oráculo **não deriva da mesma premissa** que a implementação (§1). É por
isso que ela existe apesar de custar minutos — e é por isso que trocá-la por "conferir o manifesto
contra o manifesto" destrói exatamente a propriedade que a justificava — fonte:
`docs/00-panorama-verificado.md §9.2, Camada 5`.

### 3. O artefato certo por tipo de saída

Escolher o artefato errado é o erro mais caro desta skill, porque ele só aparece meses depois, como
"o gate vive vermelho" ou "o gate nunca acusa nada".

| Tipo de saída | Artefato que vira baseline | Por que não o óbvio |
|---|---|---|
| Frame de composição | PNG de **frame-chave** via `npx remotion still --frame=N` (comando separado, `--frame` singular, **não aceita `--concurrency`**) — **(2-0)** — https://www.remotion.dev/docs/cli/still | O óbvio seria o frame 0, e o frame 0 de quase toda animação é o estado inicial (opacidade 0, escala 0): um baseline de tela quase vazia. Os frames vão **no meio das transições**, onde a interpolação está exercida — fonte: `docs/00-panorama-verificado.md §9.2, Camada 3` |
| Sequência / vídeo inteiro | **Hash por frame decodificado** (`ffmpeg -i out.mp4 -f framemd5 -`: texto de N linhas), não o arquivo. `-fflags +bitexact -flags +bitexact -map_metadata -1` em todo comando, mais pin da versão do FFmpeg — **(2-0)** — fonte: `docs/00-panorama-verificado.md §2.4 · R10-25·R11-11·R11-12`, https://ffmpeg.org/ffmpeg-formats.html. Medido no programa: um MP4 **com** e um **sem** `bitexact` têm bytes diferentes e **o mesmo `framemd5`** — fonte: `docs/00-panorama-verificado.md §9.2, Camada 1`. *A lista de muxers de hash disponíveis é saída do binário local, placar (1-0) — ver `## Não verificado`* | O container carrega a versão do encoder; subir o FFmpeg invalidaria 100% dos baselines de uma vez, indistinguível de regressão real. O Manim é pior: grava `Rendered with Manim Community v<versão>` **dentro** do arquivo — **(2-0)** — https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py |
| Saída com alfa do Manim | Sequência PNG (`--format=png -t`, grava **todos** os frames, RGBA) — **(3-0)** — fonte: `docs/00-panorama-verificado.md §1.3 · R07-23` | Lossless, sem codec, sem metadado de encoder, byte-comparável. É o único artefato do lado Manim que torna o golden master barato |
| Tolerância de encoder | Métrica perceptual (`ssim` do FFmpeg) **com asserção prévia de mesma duração, mesma resolução e mesmo `pix_fmt`** — os três são exigência do filtro, não zelo —, gateando pelo **mínimo por frame** — **(2-0)** — fonte: `docs/pesquisa/R11-golden-master-video.md:31` (`man ffmpeg-filters` do FFmpeg 6.1.1 + `libavfilter/vf_psnr.c`) | Os filtros assumem mesmo número de frames comparados um a um: um frame de offset produz número baixo que *parece* regressão de qualidade e é dessincronia. Diagnóstico errado, correção errada. Divergência de dimensão aborta com `AVERROR(EINVAL)`; divergência de `pix_fmt`, não |
| Timeline | **Diff do manifesto resolvido**: JSON determinístico com `id`, frame inicial, frame final, assets por hash. Roda em milissegundos e cobre a classe de erro mais frequente (deslocamento de tempo) — fonte: `docs/00-panorama-verificado.md §9.2, Camada 2` | A duração de `<TransitionSeries>` é `Σ(sequences) − Σ(transitions)`: a transição é **subtrativa**, e errar o sinal produz cauda preta no fim, sem erro de execução — **(2-0)** — https://www.remotion.dev/docs/transitions/transitionseries |
| Áudio | **Envelope por janela** e, quando disponível, *fingerprint* — nunca amostra a amostra — **Norma** — fonte: `PROGRAMA.md §I-4` | Diff de forma de onda é frágil por construção. **Nada no Remotion impede clipping**: três faixas em `volume={1}` somam além de 0 dBFS e saturam sem warning — **(2-0)** — fonte: `docs/00-panorama-verificado.md §2.2 · R03-10·R03-17`. O gate de nível é `ebur128` (leitura), nunca a flag do `loudnorm` — **Norma** — fonte: `docs/00-panorama-verificado.md §9.2, Camada 4` |

**Armadilha de composição:** a asserção da timeline tem de vir de uma **expectativa escrita à mão**
para a fixture. Se ela vier de outra execução do mesmo motor, cai direto na regra do §1 — fonte:
`docs/00-panorama-verificado.md §9.2, Camada 2`.

### 4. Determinismo provado duas vezes — e a segunda não é a repetição da primeira

A entrega do harness é explícita: **(a)** renderizar **duas vezes em rascunho e diffar antes de
tocar o diretório aprovado**; **(b)** execução divergente escreve em `*.received/` e **nunca**
sobrescreve a linha de base, e **falha** — **Norma** — fonte:
`PROGRAMA.md · card F0-06 (Entrega, a e b)`, `PROGRAMA.md §III-4`.

A parte que quase todo mundo perde: **render 2× na mesma máquina, no mesmo segundo, com o mesmo
ambiente, prova determinismo contra escalonamento de threads e nada mais.** Não testa fuso, locale,
data, versão de fonte, backend gráfico nem versão do Chrome — fonte:
`docs/pesquisa/R11-golden-master-video.md:469`. A segunda prova é com o **ambiente perturbado de propósito**
(`TZ` diferente, `LANG` diferente, `--gl` diferente) afirmando que o hash **muda só onde deveria**.
É a diferença entre um harness que congela o ambiente e um que apenas repete a mesma sorte.

A prova de determinismo roda com **`--concurrency` default**, não `1`: serializar esconde o sintoma
(inconsistência entre instâncias da página) sem remover a causa, e o flicker volta em produção, não
no teste — fonte: `docs/00-panorama-verificado.md §9.5, item 2`.

O snapshot aprovado é **imutável** — fonte: `PROGRAMA.md §VI-1 (tabela de artefatos
permanentes)`, `PROGRAMA.md §III-4`.
`cp received/ approved/` não é aprovação: é absorver a regressão em silêncio. A aprovação exige um
passo que produza registro.

### 5. Não-determinismo em Chrome headless — cada fonte e como ela se elimina

| Fonte de variação | Como se elimina | Placar / fonte |
|---|---|---|
| **Backend gráfico** | Em Remotion 4.0.x **no desktop** o default de `--gl` é `null` — *o Chrome decide*, a pior situação possível (Lambda/Cloud Run já usam `swangle`; o default local vira `angle` só no 5.0, **não lançado**). Fixe `gl` explicitamente **no dia 1** (candidato `swangle`) e coloque-o na chave do baseline. Mudar o backend muda o rasterizador e recaptura 100% dos golden masters | **(2-0)** — https://www.remotion.dev/docs/gl-options; `docs/00-panorama-verificado.md §2.4 · R05-13·R05-14·R05-16` |
| **Versão do Chrome** | Não existe flag "escolha a versão do Chrome": a versão é uma **constante compilada dentro do `@remotion/renderer`** (4.0.507 embute `TESTED_VERSION = "149.0.7790.0"`). Pin exato do Remotion, sem `^` e sem `~`, pina o Chrome junto. `--browser-executable` **desfaz** a garantia | **(3-0)** — https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell; `docs/00-panorama-verificado.md §1.2 · R05-17` |
| **Fonte vinda da rede** | `@remotion/google-fonts` **não embute** a fonte: os módulos gerados apontam para `fonts.gstatic.com`, então usar o pacote é baixar da rede em tempo de render. Troque por `@remotion/fonts` + `staticFile()` com o `.woff2` versionado, e feche com um gate de render com a **rede desligada** | **REFUTAÇÃO registrada** — fonte: `docs/00-panorama-verificado.md §3.2 (refutação de R09-25)`, `docs/00-panorama-verificado.md · AB-055` |
| **Fonte que "carregou"** | Uma fonte pode cair no fallback **sem erro**. O gate asserta a **família resolvida**, não o sucesso da chamada; e medidas de texto só depois da carga confirmada | **Norma** — fonte: `PROGRAMA.md Parte 0 · C6`, `PROGRAMA.md · card F1-03` |
| **Hinting de fonte no Linux** | O Chromium tem `--font-render-hinting` porque headless e headed renderizam texto diferente no Linux — mas a página oficial de Chromium flags do Remotion lista uma superfície **fechada de seis flags** e não inclui repasse arbitrário. A estabilização tem de vir de **fonte embutida + ambiente padronizado**, não de flag | **(1-0)** — ver `## Não verificado`; https://www.remotion.dev/docs/chromium-flags |
| **Fuso e locale** | Exporte `TZ` e `LANG` fixos no runner **e** proíba `Intl.*`/`toLocaleString` sem locale explícito na camada pura. É uma regra que nenhum grep por `Date.now` pega | **ABERTO (AB-013)** — fonte: `docs/00-panorama-verificado.md §7.1 · AB-013` |
| **`Math.random()`** | `random(seed)` do Remotion. O motivo mecânico é que o Remotion abre **múltiplas instâncias da página** para renderizar frames em paralelo, e o valor difere por instância | **(1-0)** — https://www.remotion.dev/docs/random; `docs/00-panorama-verificado.md §8.1 · R02-21` |
| **`Date.now()` e relógio de parede** | Derivar do número do frame. **Mas:** não existe página oficial do Remotion que proíba nominalmente `Date.now`/`setTimeout`/`requestAnimationFrame`/`animation` CSS. A regra é sólida **por dedução do modelo** (screenshot por frame, sem tempo de parede correndo); a citação ao fornecedor seria falsa | **(1-0) para o claim sobre a doc** — fonte: `docs/00-panorama-verificado.md §8.1 · R02-23b` |
| **GIF dentro de `<img>`** | Um `<img src="x.gif">` anima pelo **relógio de parede** e produz saída diferente a cada render. `@remotion/gif` é determinístico por três mecanismos: `delayRender()` bloqueando a carga, índice puro `f(frame, fps, playbackRate, delays)` sem `Date.now()`, e pintura em `<canvas>`. Vira lint no diretório de composições | **(2-0)** — fonte: `docs/00-panorama-verificado.md §2.6 · R08-15·R08-16` |
| **`background-image` / `mask-image`, `<img>` cru, ordem de render** | Estão no catálogo oficial de flicker e **nenhum grep por `Date.now` os pega** — o lint tem de nomeá-los um a um | **(1-0)** — https://www.remotion.dev/docs/flickering; ver `## Não verificado` |
| **Cache do Manim** | O cache é por *play call*, com **CRC32** (checksum, não hash criptográfico) e **truncagem de arrays numpy acima de 1000 elementos**. Colisão é possível por construção: se um partial errado for reutilizado, **o golden master passa e o vídeo está errado**. `--disable_caching` no CI — ele desliga **o uso** e *ainda grava* os arquivos de cache; quem remove é `--flush_cache`, e confundir os dois deixa a worktree suja — e queda súbita de tempo de CI é alarme, não vitória | **(2-0)** — fonte: `docs/00-panorama-verificado.md §2.4 · R12-19·R07-19` |
| **A máquina inteira** | Padronizar o ambiente em container é a resposta convergente de dois projetos independentes (BackstopJS `--docker`; Playwright: *"run tests in the same environment where the baseline screenshots were generated"*, citando até **power source**). Sem container, o baseline vale **só na máquina que o gerou**, e isso vai no README | **(2-0)** — https://github.com/garris/BackstopJS; https://playwright.dev/docs/test-snapshots |

**Animação por JavaScript não é congelada por ferramenta de captura.** Playwright, Chromatic e Percy
congelam animação/transição **CSS** — **(3-0)** — https://www.chromatic.com/docs/animations/ ·
https://www.browserstack.com/docs/percy/stabilize-screenshots/animations ·
https://playwright.dev/docs/api/class-pageassertions — e nenhum deles congela Motion/GSAP/jQuery
— **(2-0)**. O que salva este projeto é que **a estabilidade não vem da ferramenta de captura, vem
de a animação ser função pura do frame**. Qualquer `requestAnimationFrame` fora do relógio do
Remotion reintroduz o problema, e a reação natural (afrouxar o limiar) destrói o oráculo em vez de
consertar a causa.

**Corolário de política:** se o projeto decidir "pausar no primeiro frame" e a ferramenta pausar no
último (`pauseAnimationAtEnd` default `true` no Chromatic), todo baseline nasce **consistentemente**
errado — que é o pior caso, porque passa — **(3-0)** — fonte: `docs/00-panorama-verificado.md · R11-03`.

### 6. Normalizar por posição, nunca por valor — e assertar a normalização

Normalização por **posição** (esta região, este campo, este offset) e nunca por **valor**
("substitua toda ocorrência que se pareça com um timestamp") — **Norma** — fonte:
`docs/PLAYBOOK-REFERENCIA.md:224`. Normalizar por valor apaga a regressão junto com o ruído: no dia
em que o valor volátil aparecer num lugar novo, ele é apagado lá também e ninguém vê.

No caso visual isso é **máscara de região** — o `mask: [locator]` do Playwright pinta a região de
`#FF00FF` — e não "ignore pixels cuja cor seja X" — **(2-0)** —
https://playwright.dev/docs/api/class-pageassertions.

E a normalização é **assertada**: um pós-teste "não sobrou volatilidade" roda depois dela — **Norma**
— fonte: `PROGRAMA.md · card F0-06 (Entrega, d)`. Sem esse pós-teste, uma normalização que parou
de casar continua verde.

### 7. Assertar conteúdo, não status — o limite da camada 0 e o que o fecha

*"O render saiu com exit 0"* não prova que o quadro não está preto. Este é o limite duro da camada
estrutural: **um vídeo de 100 s totalmente preto passa em todos os critérios de `ffprobe`** — fonte:
`docs/00-panorama-verificado.md §9.2, Camada 0`. É a definição literal de *"o smoke passaria com
uma página em branco?"*.

O que fecha o buraco, em ordem de custo:

- **Entropia do frame acima de um limiar**, para pegar o quadro preto que o `exit 0` não pega —
  **Norma** — fonte: `PROGRAMA.md · card F0-06 (Entrega, e)`, `PROGRAMA.md Parte 0 · C1`.
- **Invariante "nenhum frame 100% preto fora dos cortes declarados"**. Repare no mecanismo: um hash
  de tela preta é **perfeitamente estável**, então a camada de determinismo **nunca** pega perda de
  alfa — fonte: `docs/00-panorama-verificado.md §9.2, Camada 4`.
- **`pix_fmt` do intermediário contém canal alfa.** Perder o `-t` no Manim produz `yuv420p` e fundo
  preto, sem erro — a falha silenciosa mais provável do programa — fonte:
  `docs/00-panorama-verificado.md §9.2, Camada 0`.
- **Duração lida por stream, não por container**, com a diferença entre os dois assertada. `ffprobe`
  reporta a duração do container; áudio e vídeo com durações diferentes passam por "o mesmo vídeo" —
  **Norma** — fonte: `PROGRAMA.md Parte 0 · C4`. Na mesma leitura entram fps, codec, número de
  trilhas e taxa de amostragem: são de graça e nenhuma outra camada os cobre — fonte:
  `docs/00-panorama-verificado.md §9.2, Camada 0`.
- **Resolução assertada no arquivo gerado, nunca pela letra da flag.** No Manim, `-qp` é 2560×1440 e
  `-qk` é 3840×2160, e várias fontes de terceiros trocam os dois; um golden master gravado em 1440p
  contra saída 2160p falha em 100% dos pixels — **(3-0)** — fonte:
  `docs/00-panorama-verificado.md §1.3 · R07-18`.

### 8. CONTRATO × BUG-A-DIVERGIR — classifique antes de capturar

| Rótulo | Significado de um diff | O que exige |
|---|---|---|
| **CONTRATO** | o diff é **regressão** | preservar; o baseline vence |
| **BUG-A-DIVERGIR** | o diff é **a divergência pretendida** | **ADR nominal**; o baseline se move por escrito |

Fonte: `docs/PLAYBOOK-REFERENCIA.md:233`. Aqui o eixo muda de lugar: como não há legado, o
"comportamento que já existe" **é o baseline aprovado por um humano**. Toda fixture nasce
classificada, inclusive as de entrada suja — acento e cedilha, apóstrofo, aspas curvas, emoji, texto
que estoura o quadro, caractere de largura zero, `440` ≠ `0440`, nó cujo asset não existe no store —
**Norma** — fonte: `PROGRAMA.md · card F0-09 (Entrega)`.

O corolário do playbook (*"corrigir o shim é obrigatório; corrigir o legado é proibido"*) traduz-se
assim: **corrigir a fonte de variação é obrigatório; subir o limiar é proibido.** Um limiar
afrouxado para "parar de dar falso positivo" é o mecanismo pelo qual um oráculo morre; o limiar é um
token, tem dono, e mudá-lo exige ADR — **Norma** — fonte: `PROGRAMA.md §I-4 (ADR-0001 reafirmado)`.

### 9. Ciclo de vida: nascer, servir, ser aposentado por escrito

**Nascer.** Só a partir do **render**, jamais do Studio ou do preview: o Chrome do preview não tem as
mesmas flags nem o mesmo backend do Chrome do render, e o baseline nasceria descrevendo um pipeline
que nunca vai rodar — **Norma** — fonte: `PROGRAMA.md Parte 0 · C5`, `PROGRAMA.md Apêndice H`. E
nasce com a chave **completa**: `{composição, frame, plataforma, versão do Remotion (= versão do Chrome), backend gl}`
— fonte: `docs/00-panorama-verificado.md §9.2, Camada 3`. Chave incompleta significa dois agentes
em worktrees com configurações diferentes sobrescrevendo o baseline um do outro **em silêncio**.

**Servir.** Imutável. Execução divergente escreve em `*.received/`. E o gate combina dois comandos,
porque `git diff --exit-code` num diretório de saída **não enxerga arquivo não rastreado** — some com
`git status --porcelain` — fonte: `docs/PLAYBOOK-REFERENCIA.md:523`, `PROGRAMA.md Parte 0 · C3`,
`PROGRAMA.md §III-14 · W4 (aceitação comum de F1-04…F1-11)`.

**Falhar por ausência.** Apagar um snapshot aprovado **tem de** deixar o gate vermelho, e não passar
por "nada a comparar" — **Norma** — fonte:
`PROGRAMA.md §III-14 · W4 (aceitação comum de F1-04…F1-11)`. É a única classe de falha que o resto
da cadeia não cobre.

**Aposentar.** Quando um gate automático for removido, **registre por escrito que a regra virou
manual** — *a ausência de um verificador é indistinguível de conformidade* — fonte:
`docs/PLAYBOOK-REFERENCIA.md:228`. E a caracterização é orçada como **infraestrutura**, com ciclo de
vida declarado: escreva o dia em que ela deixar de ser reproduzível — fonte:
`docs/PLAYBOOK-REFERENCIA.md:219`. No programa de origem a infraestrutura de caracterização **morreu
antes do fim do programa**, e o que salvou a honestidade do relatório foi isso ter sido escrito em
vez de a ausência parecer conformidade — fonte: `docs/PLAYBOOK-REFERENCIA.md:23`.

**O estado que não pode existir:** um veredito `CONFERE` sem evidência anexada. Enquanto a pilha não
estiver de pé, o rótulo é `NÃO_COLETADO`, que nunca vira `CONFERE` sozinho — fonte:
`docs/00-panorama-verificado.md §9.5`.

### 10. Custo de armazenamento e versionamento — a decisão barata agora e cara depois

Git LFS troca o arquivo por um ponteiro e guarda o conteúdo remoto; no GitHub são **10 GiB de
storage + 10 GiB de banda** em Free/Pro, depois **US$ 0,07/GiB-mês** e **US$ 0,0875/GiB**, com os
*data packs* descontinuados — **(2-0)** — https://git-lfs.com/ ·
https://docs.github.com/en/billing/managing-billing-for-git-large-file-storage/about-billing-for-git-large-file-storage.

A aritmética que morde: um PNG 1920×1080 pesa da ordem de 1 MB, logo **10.000 stills ≈ 10 GiB = o
teto gratuito**; 100 composições × 10 frames × 10 recapturas já mora nessa ordem de grandeza —
fonte: `docs/00-panorama-verificado.md · R11-22`.

As três opções, com o que cada uma custa: **(a) PNG no git** — zero setup, histórico incha para
sempre, cada recaptura é um blob permanente; **(b) LFS** — histórico limpo, custo medido, precisa de
servidor; **(c) hash-only** — repositório minúsculo e a única opção que **não deixa você olhar o que
quebrou** sem re-renderizar. Migrar de (a) para (b) depois exige **reescrever o histórico do git**,
que é destrutivo com worktrees paralelas abertas — fonte: `docs/00-panorama-verificado.md §5.2`.

Esta decisão está **bloqueada em decisão de dono** (P-06 → ADR-006) e depende do ruído medido: se o
ruído entre dois renders idênticos for **0**, dá para gatear por hash e o baseline vira um `.sha256`
de 64 bytes; se for maior que 0, precisa de tolerância **e** de PNG versionado — fonte:
`docs/00-panorama-verificado.md §6.2 · P-06`. Não escolha sozinho, e não escreva o limiar antes de medir.

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

1. **Não compare bytes do *container* de vídeo** — nem MP4, nem `.mov` do Manim: o container carrega
   a versão do encoder, e o Manim escreve `Rendered with Manim Community v<versão>` dentro do
   arquivo — **(2-0)**. Compare **frame decodificado** (`framemd5`). Escopo do que continua válido:
   igualdade byte a byte **do stream decodificado, dentro de uma cadeia de ferramentas pinada** —
   medido no programa que `ffmpeg 6.1.1 + libx264` já é reprodutível bit a bit entre execuções, com
   threads default, `-threads 1` e com `bitexact` — **(2-0)** — fonte:
   `docs/00-panorama-verificado.md §2.4 · R10-25·R11-11·R11-12`. O que quebra a igualdade é o
   **bump de versão**, e a reação correta a ele é re-baselinar por escrito, não afrouxar a comparação.
2. **Não conclua "encoder com threads nunca é determinístico".** É falso para x264: existe
   `--non-deterministic` descrita como *"Slightly improve quality of SMP, at the cost of
   repeatability"*, ou seja, a não-reprodutibilidade é **opt-in** — **(2-0)** —
   https://manpages.debian.org/testing/x264/x264.1.en.html. Descartar a comparação de hash por esse
   motivo errado joga fora a camada 1 inteira, que é a mais barata que enxerga pixel.
3. **Não afrouxe o limiar para o teste parar de piscar.** Cada ponto de afrouxamento é uma classe de
   regressão que deixa de ser detectada, e a perda é **invisível**: com `maxDiffPixels` alto o
   bastante, "o texto sumiu" passa. Gateie por **duas dimensões ao mesmo tempo** (limiar de cor baixo
   **e** contagem de pixels pequena), ou exija que a diferença esteja **concentrada**.
4. **Não use `--concurrency=1` para consertar flicker.** Esconde o sintoma sem remover a causa; o
   flicker volta em produção, não no teste.
5. **Não escreva um gate `ΔVMAF ≤ 6`.** Duas razões independentes: `libvmaf` só existe se o build
   tiver `--enable-libvmaf`, e o build padrão desta máquina (`ffmpeg 6.1.1-3ubuntu5`) **não** tem —
   `ffmpeg -h filter=libvmaf` responde `Unknown filter 'libvmaf'` — **(2-0)** —
   https://github.com/Netflix/vmaf;
   e o "6 pontos = 1 JND" não tem fonte primária localizada. Adotar VMAF é card de **infraestrutura**,
   não card de teste.
6. **Não escreva "a doc do Remotion proíbe `setTimeout`/`Date.now`/`rAF`".** Não foi achada página
   oficial que os liste. Proíba-os pela **dedução do modelo**, e não cite o fornecedor como se fosse
   dele — fonte: `docs/00-panorama-verificado.md §8.1 · R02-23b`.
7. **Não escreva "o Remotion recomenda evitar CDN de fontes por determinismo".** A página de fontes
   lista Google Fonts via CDN como abordagem **padrão** e não emite esse aviso. A restrição é
   **nossa**, por render local — fonte: `docs/00-panorama-verificado.md §3.2 (refutação de R09-25)`.
8. **Não aprove baseline a partir do Studio.** O instinto certo — "vi na pré-visualização, está
   certo, congela" — grava um baseline do Chrome do preview, que não tem as mesmas flags nem o mesmo
   backend do Chrome do render. E quando o primeiro render de verdade falhar, a reação natural
   (recapturar do render) **apaga a única evidência** de que o pipeline e o preview divergem, que é
   justamente o que precisava ser investigado.
9. **Não copie um número de limiar entre ferramentas nem de um blog.** O limiar vive numa **constante
   nomeada**, derivada do ruído **medido** nesta máquina, com o valor medido registrado ao lado em
   comentário. Número literal dentro do teste é limiar calibrado por acidente.
10. **Não trate divergência na máquina de outra pessoa como bug.** Sem container, o baseline vale só
    na máquina que o gerou — é o **limite declarado** do oráculo, e tem de estar no README.
11. **Não use `--repro` como mecanismo de reprodutibilidade.** É ferramenta de bug report: gera um ZIP
    para o suporte e não fixa nada — fonte: `docs/pesquisa/R05-render-hwaccel.md §4 (armadilhas)`.
12. **Não deixe o cache do Manim ligado no CI**, e não comemore queda súbita no tempo de CI: em cache
    por CRC32 com truncagem de array, isso é o sintoma de acerto pelo motivo errado.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| `exit 0` do render | não olha um pixel; 100 s de tela preta passa em toda a camada estrutural | **nada** — só a invariante de frame-não-preto / entropia |
| render 2× idêntico na mesma máquina, no mesmo segundo | prova escalonamento de threads; não testa fuso, locale, fonte, `gl` nem versão do Chrome | **nada** — só a segunda prova com ambiente perturbado |
| `git diff --exit-code` no diretório aprovado | **não enxerga arquivo não rastreado** | **nada** — só `git status --porcelain` junto |
| snapshot aprovado a partir do Studio | o Chrome do preview ≠ o do render (flags e backend diferentes) | **nada** — só o gate que recusa baseline cuja procedência não seja o comando de render; sem ele, o primeiro render real falha e o instinto é recapturar |
| média de SSIM do vídeo inteiro | uma regressão que destrói 3 frames de 900 é diluída até virar ruído | **nada** — só gate por **mínimo por frame** ou contagem abaixo do limiar |
| PSNR/SSIM entre dois MP4s | os filtros assumem mesmo número de frames comparados um a um — **(2-0)** | fica vermelho **pela razão errada**, o que custa mais que ficar verde |
| comparador com `allowSizeMismatch` / que redimensiona | transforma mudança de resolução — a pior regressão possível — em não-evento | **nada** — o vídeo sai 1280×720 e o gate aprova |
| detector de antialiasing ligado (default de mercado) | mudança sutil de peso de fonte ou de subpixel pode ser **classificada como AA** e sumir do diff | **nada** — só um diff paralelo, tolerante, medindo o ruído de AA |
| `ffprobe` diz que a duração está certa | duração do **container** ≠ duração do **stream** | **nada** — só a leitura por stream, com a diferença assertada |
| cache do Manim com 100% de acerto | CRC32 + truncagem de arrays: partial errado reutilizado ⇒ **o golden master passa e o vídeo está errado** — **(2-0)** | **nada** — só `--disable_caching` no CI |
| `cp received/ approved/` como aprovação | absorve a regressão em silêncio e reescreve a memória do projeto | **nada** — só a imutabilidade do aprovado |
| suíte "offline" que apenas não usa a rede | não é o mesmo que a rede **bloqueada**; `@remotion/google-fonts` baixa de `fonts.gstatic.com` em tempo de render | **nada** — só o guarda que bloqueia a interface |
| baseline sem `gl` e sem versão do Chrome na chave | dois agentes com configurações diferentes sobrescrevem o baseline um do outro | **nada** — o merge é limpo e o oráculo já morreu; só a chave completa `{composição, frame, plataforma, versão do Remotion, gl}` deixa o conflito visível |
| um baseline capturado, e nenhum critério que falhe por ausência | o diretório de frames vazio é indistinguível de "nada mudou" | **nada** — só o `∅-crit:` que exige o arquivo esperado existir antes de comparar |

## O que esta skill NÃO cobre

- **Critério de aceitação falsificável, sonda negativa e os três estados do gate** — `falsifiable-gates`.
- **Flags do `remotion render`, `--concurrency`, aceleração de hardware, `--chrome-mode`** —
  `remotion-render-pipeline`.
- **`useCurrentFrame`, `interpolate`, aritmética de `<TransitionSeries>`** — `remotion-core`.
- **Formato e schema do manifesto e da timeline resolvida** — `timeline-manifest`.
- **CLI do Manim, codecs de alfa, `--media_dir`, `--seed`** — `manim-bridge`.
- **Comandos FFmpeg em geral, filtros e transcodificação** — `ffmpeg-media-ops`.
- **Alinhamento de legenda, ASR e sincronia áudio/vídeo** — `audio-captions-sync`.
- **As perguntas de refutação de contexto fresco** — `adversarial-review`.
- **Registrar e fechar os itens AB-nnn citados aqui** — `uncertainty-ledger`.
- **Se o vídeo presta.** Nenhuma camada tem opinião sobre isso; é regra **manual**, registrada por
  escrito. E semelhança com referência estética de terceiro é **briefing para humano**, jamais gate,
  marcada `NÃO EXECUTADO` — fonte: `docs/00-panorama-verificado.md §9.3`.
- **Os oito lugares onde a regra roda fora do alcance do snapshot** — e são **oito**, não quatro:
  (1) LLM → manifesto, (2) síntese de voz, (3) transcrição/ASR, (4) aquisição de assets pela rede,
  (5) conformidade de licença, (6) julgamento estético e referência de estilo, (7) **o ambiente**
  (sem container o baseline vale só na máquina que o gerou), (8) **as UI das plataformas de destino**
  (safe zones de TikTok/Reels/Shorts são renderizadas por cima do nosso vídeo e nenhum snapshot nosso
  as contém) — fonte: `docs/00-panorama-verificado.md §9.4`. Os dois que mais enganam: o snapshot
  começa **no manifesto**, nunca no briefing; e o artefato cacheado da voz é o **par (áudio,
  timing)**, porque se o áudio mudar e o timing não, o vídeo dessincroniza sem erro. Cada um vira
  artefato separado, citado e marcado `NÃO EXECUTADO`.

## Não verificado

Tudo abaixo entrou sem placar ≥2-0 e **não pode** sustentar um card sozinho.

| Item | Placar | Comando que fecha a lacuna |
|---|---|---|
| Nome do comparador embutido no runner de screenshot e o template `{testName}-{browserName}-{platform}.png` | (1-0) | `npm ls pixelmatch` após a instalação (AB-058) |
| Espaço de cor do limiar: YIQ (doc do Playwright) × OKLab/HyAB (README do pixelmatch 7.x) | (1-1) EM DISPUTA | `node -p "require('pixelmatch/package.json').version"` — se for 7.x, todo limiar publicado antes está em outra escala |
| Opções e defaults do pixelmatch (`includeAA`, `windowSize`) e o `misMatchThreshold` **percentual** do BackstopJS | (1-0) cada | https://github.com/mapbox/pixelmatch/blob/main/README.md?plain=1 · https://github.com/garris/BackstopJS · `npx odiff-bin --help` |
| `storeReceivedOnFailure` e `comparisonMethod: 'ssim'` do `jest-image-snapshot` | (1-0) | ler o README do pacote instalado |
| Catálogo oficial de flicker do Remotion (10 causas) e o motivo mecânico | (1-0) — duas páginas do **mesmo domínio** contam como uma fonte | https://www.remotion.dev/docs/flickering — corroborar por execução: render com `transition: opacity 1s` e um valor de relógio na tela |
| `--font-render-hinting` do Chromium e a superfície fechada de flags do Remotion | (1-0) | https://www.remotion.dev/docs/chromium-flags — greppar por `hinting` |
| Muxers de hash por frame, muxer de fingerprint acústico, filtros de correlação e de estatística de áudio; e a lista de métricas do `compare` do ImageMagick 6 (sem SSIM) | (1-0) — saída do binário local é uma fonte, ainda que seja lista fechada da própria ferramenta | `ffmpeg -h muxer=framemd5` · `ffmpeg -h muxer=chromaprint` · `ffmpeg -h filter=axcorrelate` · `compare -list metric` |
| "≈6 pontos de VMAF = 1 JND" | (1-0), e é **ausência** na doc oficial, não prova de falsidade | buscar `JND` em https://github.com/Netflix/vmaf |
| **Emoji do sistema como fonte de variação de raster** — hipótese **sem nenhuma fonte** na pesquisa deste programa | sem placar | render da mesma composição com e sem a fonte de emoji do host instalada, e `sha256sum` dos PNGs. O que **tem** placar é o contorno: `@remotion/animated-emoji` usa vídeos pré-renderizados copiados para `public/` — **(3-0)** — o que tira a fonte do host do caminho |
| Determinismo real do render (AB-016), `gl` como chave de baseline (AB-017), **ruído de base** (AB-019), efeito de `TZ`/`LANG` (AB-013), render com rede desligada (AB-055), tamanho do conjunto de baselines (AB-059) | não medidos | os comandos estão em `docs/00-panorama-verificado.md §7.1` (AB-013), `§7.2` (AB-016, AB-019) e `§7.5` (AB-055, AB-059) — **AB-019 bloqueia a escrita de qualquer limiar** |

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
