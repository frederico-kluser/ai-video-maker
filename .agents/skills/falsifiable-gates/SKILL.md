---
name: falsifiable-gates
description: Provides falsifiable acceptance criteria for this video pipeline — the negative probe per target, the independent tripwire, "zero parsed items = fail", criteria that fail by absence, two oracles per capture, and a self-test that asserts the message. Use whenever a task writes or reviews a done-criterion, a gate, a verifier, a hook or a CI step, even if the user never says "test". Triggers: "acceptance criteria", "definition of done", "gate", "verifier", "it is green", "exit 0", "negative probe", "grep -L", "git diff --exit-code", "ffprobe check", "pytest -k", "vitest -t", "node --test", "render twice".
metadata:
  type: knowledge
  tier: metodo
  verification_signal: "rg --help | grep -q -e '-L, --follow' && ffmpeg -hide_banner -h filter=libvmaf 2>&1 | grep -q Unknown"
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
# Gates falsificáveis — "o que este comando imprime se a tarefa não fizer nada?"

## Quando carregar

- Ao escrever ou revisar um critério de aceitação, um `∅-crit`, um gate, um verificador, um hook
  ou uma etapa do gate local — antes de a primeira linha do card ser escrita.
- Ao dizer, ou ler alguém dizendo, "está verde", "o render passou", "o snapshot bate".
- Ao herdar um comando de aceitação de um card anterior: ele pode estar invertido (ver `rg -L`).
- **Não carregue** para escolher o **valor** — o artefato de baseline, o número do limiar de diff, a
  chave do snapshot: isso é `video-characterization`. Para as refutações, `adversarial-review`.

## Como ler as linhas deste arquivo

- `Placar (N-M)` = fato. Convenção A (fonte pública) ou **B** (execução local reproduzível conta
  como fonte), as duas declaradas em `docs/00-panorama-verificado.md` §0. **medido aqui** traz a
  versão da ferramenta junto: a versão **é** a condição de escopo — trocá-la invalida a linha.
- `norma:` + `arquivo:linha` = lei deste programa, não placar. Em conflito, `PROGRAMA.md` vence
  sobre o playbook (`docs/PLAYBOOK-REFERENCIA.md:8-10`) e `docs/00-panorama-verificado.md` vence
  sobre qualquer fato técnico.

## A pergunta única

> Para cada critério: ***"o que este comando imprime se a tarefa não fizer nada?"*** Se a resposta
> for "verde", o critério é decorativo. — norma: `docs/PLAYBOOK-REFERENCIA.md:383-384`,
> `PROGRAMA.md` **Apêndice F**, linha "Gate / verificador" do banco de perguntas adversariais.

No programa de origem, **25 de 42 cards** tinham exatamente esse critério: já passava antes da
primeira linha de código. — norma: `docs/PLAYBOOK-REFERENCIA.md:374-376`, `PROGRAMA.md` §IV-2.

## Conhecimento injetado

### O runner com seletor não responde igual — e nenhum dos três responde como o folclore diz

A regra "todo runner com filtro sai verde quando o filtro não casa nada" é a **forma** certa da
suspeita e a **letra** errada. Medido nesta máquina:

| runner | filtro sem casamento | exit | o que imprime | por que ainda é falso verde |
|---|---|---|---|---|
| `pytest 9.0.3` | `-k "nao_casa"` | **5** | `1 deselected` | 5 ≠ 1: `\|\| true`, `set +e` ou um envoltório que testa `rc == 1` converte em verde. E `pytest dir_vazio` também é 5 — mesmo código para "o filtro não casou" e "não havia teste" |
| `pytest 9.0.3` | `--collect-only -q -k "nao_casa"` | **5** | `no tests collected (1 deselected)` | é este o modo que a descoberta sem execução do verificador usa (`PROGRAMA.md` §IV-2, mecanismo 2) |
| `node --test 24.15.0` (isolamento default) | `--test-name-pattern="nao_casa"` | **0** | `✔ t.test.mjs` · `tests 1` · `pass 1` | **o "1" é o ARQUIVO, não um teste**: o sumário conta arquivos, e um humano lendo o log vê contagem verde |
| `node --test 24.15.0` `--experimental-test-isolation=none` | idem | **0** | `tests 0` · `pass 0` | contagem honesta, veredito verde do mesmo jeito |

**Placar (2-0, convenção B — duas execuções independentes por runner)** — fonte: execuções nesta
máquina. Reproduza com um `test_a.py` e um `t.test.mjs` de um teste que passa cada:
`python3 -m pytest [--collect-only -q] -k nao_casa; echo $?` · `python3 -m pytest dir_vazio/; echo $?`
· `node --test [--experimental-test-isolation=none] --test-name-pattern=nao_casa; echo $?`.

Consequência de projeto: a asserção "≥1 teste casado" compara **um número obtido por descoberta**,
nunca um exit code; e a sonda é **por alvo**, não uma para todos — uma só não pega regressão do
runner num alvo específico. — norma: `PROGRAMA.md` §IV-2 (os cinco mecanismos) e a **Entrega** do
card `T-06`, que os repete um a um.

### Zero itens parseados = falha, sempre, em todo verificador

`all([])` é `True` em Python: uma função de eval que devolve lista vazia grava
`last_eval_passed: true` com **zero asserções** — **Placar (2-0)** — fonte:
`docs/00-panorama-verificado.md` §1.8, **L02-C16**; `3b1b:.agents/scripts/run_skill_evals.py:339-341,376`.

O mesmo defeito, na camada 0 deste pipeline (medido, `ffprobe 6.1.1-3ubuntu5`):

- `ffprobe -v error -show_entries stream=nb_framez -of csv=p=0 v.mp4` (chave com typo) →
  **saída vazia, exit 0**.
- `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 v.mp4` num MP4
  **sem trilha de áudio** → **saída vazia, exit 0**.
- com a chave certa: `yuv420p,30/1,30`, exit 0 — o mesmo exit code dos dois casos acima.

**Placar (2-0, convenção B)**. Portanto o oráculo estrutural tem de **exigir parse não-vazio antes
de comparar valor**; um gate de áudio escrito como "se houver trilha, então…" aprova o vídeo mudo.
— norma: `docs/00-panorama-verificado.md` §9.2, Camada 0.

### Ferramenta ausente é VERMELHO — e o probe de capacidade mais natural é verde, porque isso é o falso verde

`ffmpeg -hide_banner -h filter=libvmaf` imprime `Unknown filter 'libvmaf'.` e **sai 0** — exatamente
o mesmo exit code de `-h filter=ssim`, que existe. **Placar (2-0, convenção B)** — medido em
`ffmpeg 6.1.1-3ubuntu5`. O probe correto casa o **conteúdo** da saída, nunca o código.

`libvmaf` não existe no build padrão do Ubuntu — **Placar (2-0)** — fonte:
https://github.com/Netflix/vmaf + saída do binário local (`docs/pesquisa/R11-golden-master-video.md:253-268`).
Card que escreva "gate por VMAF" é card de infraestrutura, não de teste.

Seis dependências de sistema podem faltar aqui (Node, Python, FFmpeg, LaTeX, o Chrome do Remotion,
driver de GPU); cada ausência é vermelha e **nomeada** — "pulado" e "passou" imprimem a mesma
conclusão operacional. — norma: `PROGRAMA.md` §IV-1.

### Três estados, e o terceiro é impresso

`PASS`, `FAIL` e **`NÃO-EXERCITADO`**; gate que ainda não existe é anunciado como `PENDENTE`, nunca
omitido, porque um gate que ninguém conecta não fica vermelho: fica **invisível**. — norma:
`PROGRAMA.md` §IV-1, `docs/PLAYBOOK-REFERENCIA.md:367-370`.

Evidência de que dois estados abrem o portão: duas das seis evals do corpus 3b1b são lambdas com
`passed: True` literal e **nunca podem ficar vermelhas** — **Placar (2-0)** — fonte:
`docs/pesquisa/L02-reuso-3b1b-infra-skills.md:325-331` (L02-C17). São justamente as duas skills que
escrevem em outras skills.

### O critério que falha por ausência — e o `-L` que o inverte nesta máquina

O padrão canônico é `grep -L "MARCA" dir/*.ext` → **saída vazia** (`docs/PLAYBOOK-REFERENCIA.md:387`).
Nesta máquina ele tem três armadilhas empilhadas.

**1. `rg -L` não é `--files-without-match`.** Em `ripgrep 15.0.0`, `-L` é `--follow` (seguir
symlinks). Medido, com um arquivo por vez num diretório:

| conteúdo do diretório | `rg -L "MARCA" dir/` | leitura correta |
|---|---|---|
| um arquivo **sem** a marca | saída vazia, exit 1 | "ninguém casou o padrão" |
| um arquivo **com** a marca | imprime a linha casada, exit 0 | "alguém casou o padrão" |
| diretório vazio | saída vazia, exit 1 | indistinguível do primeiro caso |
| **diretório inexistente** | **stdout vazio, exit 2** (o erro vai para stderr) | o alvo nem existe |

Ou seja, `rg -L PADRAO … → saída vazia` afirma **"nenhum arquivo contém o padrão"**, que é o
**oposto** de "todo arquivo contém o padrão". O flag certo em `rg` é `--files-without-match`
(medido: com um arquivo sem a marca, imprime o caminho e sai 0).
**Placar (4-0, convenção B: `rg --help` documenta `-L, --follow`; execução invertida; execução
correta com `--files-without-match`; execução em diretório inexistente devolvendo stdout vazio).**

**O alvo concreto, não hipotético:** `grep -c "rg -L" PROGRAMA.md` responde **13** — treze `∅-crit`
já escritos usam essa forma, e um deles é o exemplo canônico "Bom" da tabela de critérios de
**§IV-2** (`rg -L "PROCEDENCIA" assets/**/*.json → saída vazia`). Os outros doze estão na aceitação
dos cards `F0-01, F0-02, F0-05, F0-07, F1-03, F4-02, F6-02, F6-05, T-09, I-01, I-03, I-04` — por id
de card, porque a linha desses alvos já andou **+53** desde que esta skill foi escrita. Como quase
nenhum desses diretórios existe ainda, cada um devolve **stdout vazio com exit 2** e o critério
imprime verde antes da primeira linha do card — o defeito que o `∅-crit` existe para impedir.

Consequência operacional: um `∅-crit` herdado que use `rg -L` é **defeito de ferramenta, não
intenção do autor**. Converta para `rg --files-without-match` ou `grep -L` antes de rodar, e trate
o resultado antigo como não-exercitado. Esta skill não edita os cards; ela obriga o executor a
fazer a conversão e a registrar que fez.

**2. Sem denominador, a ausência é verde por vazio.** Um diretório vazio devolve saída vazia — e o
critério passa. Em `bash`, `grep -L "MARCA" vazio/*.json` com glob que não expande devolve
**stdout vazio e rc=2**, e o teste `[ -z "$(…)" ]` imprimiu literalmente `CRITERIO PASSOU`
(medido). **Placar (2-0, convenção B)**. Todo critério por ausência anda em par com o denominador.
A forma completa é esta, e é ela que vai no card — **duas linhas, nunca uma**:

```
test "$(rg --files assets/ | wc -l)" -ge 12                   # denominador: o alvo existe, com 12 itens
test -z "$(rg --files-without-match 'PROCEDENCIA' assets/)"   # ausência: nenhum item sem a marca
```

Sozinha, a segunda linha passa com `assets/` vazio, inexistente ou apagado. — norma:
`docs/PLAYBOOK-REFERENCIA.md:508-510` ("zero não é sinal sozinho — precisa de denominador").

**3. `grep` aqui não é o GNU grep.** `grep --version` responde `ugrep 7.5.0`, e o `--help` dele
documenta `-L, --files-without-match` — semântica igual à pretendida, binário diferente.
**Placar (2-0, convenção B)**. Quem depender de comportamento específico do GNU não está
exercitando o GNU.

### Dois oráculos: executar **e** provar determinismo — com a cegueira do `git diff` medida

Medido em `git 2.43.0`, num diretório de saída aprovado:

| situação | `git diff --exit-code -- aprovado/` | `git status --porcelain -- aprovado/` |
|---|---|---|
| arquivo novo **não rastreado** | **exit 0** (verde) | imprime `?? aprovado/b.txt`, **exit 0** |
| arquivo rastreado **apagado** | exit 1 (vermelho) | imprime `D aprovado/a.txt`, exit 0 |
| limpo | exit 0 | saída vazia, exit 0 |

**Placar (2-0, convenção B + `docs/PLAYBOOK-REFERENCIA.md:523`)**. Duas lições, e a segunda é a que
quase ninguém escreve: `git status --porcelain` **sai 0 nos três casos** — o sinal dele é a
**saída**, não o exit code, então ele nunca falha sozinho numa cadeia `&&`.

O par correto de uma captura é: `git diff --exit-code <dir>` **e** `test -z "$(git status
--porcelain <dir>)"` **e** a captura falhando se o artefato esperado não existir. — norma:
`docs/00-panorama-verificado.md` §9.2 (Camada 2, "armadilha nomeada"), `PROGRAMA.md` §IV-2 (o
critério "Bom" de dois oráculos).

Camada 1 do oráculo deste programa: render 2× e comparar `ffmpeg -i out.mp4 -f framemd5 -` — texto
de N linhas, hash por frame decodificado, imune a container e a metadata; responde "mudou?" **e**
"em qual frame?". Duas condições que a camada carrega junto e que não são desta skill: as
pré-condições declaradas não-negociáveis (`-fflags +bitexact -flags +bitexact -map_metadata -1`,
FFmpeg pinado, `chromiumOptions.gl` fixado) e o `--concurrency` **default**. Limite duro: prova
**estabilidade**, não correção — dois renders idênticos de um vídeo errado passam. — norma:
`docs/00-panorama-verificado.md` §9.2 (Camada 1) e §9.5, gate `G-DET` (`PROGRAMA.md` Apêndice G).

### Invariantes estruturais sobre o pipeline — verificáveis sem runner e sem render

As não-óbvias, porque são as que nenhum outro oráculo pega:

- **Nenhum frame 100% preto fora dos cortes declarados.** Um hash de tela preta é perfeitamente
  estável: a camada de determinismo aprova o vídeo preto com nota máxima.
- **Soma das durações dos nós == duração da composição** — pega a cauda preta de somar em vez de
  subtrair a transição.
- **Legenda dentro da área segura** — overflow **não muda o exit code do render**, e nenhum outro
  oráculo o detecta. — os três são a tabela de invariantes de `docs/00-panorama-verificado.md` §9.2,
  Camada 4.
- **`psnr`/`ssim` exigem mesma resolução e mesmo `pix_fmt` e assumem o mesmo número de frames,
  comparados um a um** (dimensão divergente aborta com `AVERROR(EINVAL)`) — **Placar (2-0)** —
  fonte: `man ffmpeg-filters` (FFmpeg 6.1.1) +
  https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/vf_psnr.c. Logo o gate asserta
  **duração e geometria iguais antes de medir**; um frame de offset produz um número baixo que
  parece regressão de qualidade e é dessincronia.
- **Nada pisca mais de 3 vezes em qualquer janela de 1 s** (WCAG 2.2 SC 2.3.1, Nível A) —
  **Placar (3-0)** — fonte:
  https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html. A convergência
  com a ITU-R BT.1702 é **só na contagem**: a **área de referência diverge** — WCAG mede 25% de um
  campo visual de 10° (341×256 px), a ITU mede 1/4 da tela exibida — **Placar (2-0)** — fonte:
  https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf. Um gate de flash
  que não declara **qual** área mede está medindo a errada. "Corte rápido conta como flash" é
  atraente e **não é fato aqui**: ver "Não verificado".
- **Não existe alvo único de loudness** — cinco publicadores, cinco números, todos corretos no
  próprio escopo — **Placar (5-0)** — fonte: https://tech.ebu.ch/docs/r/r128.pdf. Escrever
  `-14 LUFS` num gate é escolher um escopo por acidente; o alvo é decisão em ADR e a medição é
  `ebur128` (read-only).
- **Exit code mente na fronteira do Manim:** `find_video` do `manim-api` só varre `*.mp4`, então
  render com `-t` devolve `None` e o pipeline **reporta erro com `returncode == 0`** —
  **Placar (3-0)** — fonte: panorama §1.8, **L01-C07**. A extensão que `-t`
  resolve é **`.mov`**; `.webm` só sai com `--format=webm`, e `--format=mp4 -t` entrega `.mov` em
  silêncio, exit 0 — **Placar (3-0)** — fonte: panorama §1.3, **R07-06**. Logo o
  gate é "existe `<Cena>.<ext-esperada>`", nunca "o manim retornou 0". E sem `--write_to_movie` o
  renderer **OpenGL** não escreve arquivo nenhum, com mensagem que aponta para a camada errada —
  **Placar (4-0)** — fonte: panorama §1.8, **L01-C01**. Escopo desta última:
  renderer OpenGL do Manim CE, não o Cairo.

Regra de manutenção: **um invariante que perde o objeto muda de tipo, não é apagado** — vira
asserção de *ausência*, que continua verificável. — norma: `PROGRAMA.md` §IV-3.

### O autoteste roda ANTES do verificador e asserta a mensagem

- Roda antes; asserta **a mensagem**, não o exit code — *um autoteste que asserta só o código de
  saída não distingue "acusou" de "quebrou"*. — norma: `PROGRAMA.md` §IV-4,
  `docs/PLAYBOOK-REFERENCIA.md:392-394`.
- **Mutações calculadas do documento corrente, nunca literais**: mutação literal vira no-op no
  primeiro merge, o autoteste grita "a mutação passou" e ensina a ignorar o alarme.
- **Falha fechado e recusa explicitamente o que não sabe analisar.** O contraexemplo está no
  corpus: o linter varre `*/SKILL.md` **um nível só** e uma skill aninhada com `type` inválido é
  pulada em silêncio — **Placar (2-0)** — fonte:
  `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:168-171` (L02-C03).
- **Por que a mensagem, e não o código:** o `bash_guardrail.py` do 3b1b não bloqueia `rm -rf /` —
  o `\b` final do regex exige fronteira de palavra que não existe depois de `/`, e **o caso
  literalmente nomeado na descrição do hook é o que passa** — **Placar (2-0)** — fonte:
  `docs/00-panorama-verificado.md` §1.8, **L02-C11**. Um autoteste de exit code teria ficado verde.
- **Guarda declarada e nunca disparada:** nenhum script executa o `metadata.verification_signal`
  dos seis `SKILL.md` do corpus — **Placar (2-0)** — fonte:
  `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:386-404` (L02-C15). O campo desta skill só é
  garantia quando o gate o chama.
- **Hook com o exit errado é falso verde perfeito:** em hooks do Claude Code, `0` = sucesso,
  `2` = erro **bloqueante**, **qualquer outro código = não-bloqueante** — um hook de lint com
  `exit 1` não bloqueia nada: o log mostra o erro, o agente segue, o commit entra —
  **Placar (3-0)** — fonte: https://code.claude.com/docs/en/hooks.md
  (panorama §1.6, **R06-24**). Duas condições de escopo que a regra perde se for
  citada solta: em `WorktreeCreate` **qualquer** código ≠ 0 aborta, e `exit 2` em `PostToolUse` não
  desfaz nada, só mostra o stderr ao modelo — **Placar (2-0)** — fonte:
  `docs/pesquisa/R06-remotion-agentes-skills.md:59` (R06-25). É doc de publicador único e o ledger
  tem `AB-068` **aberto** para medi-lo aqui: o gate cita o item, não finge que já mediu.
- **Tripwire independente:** conte num texto normalizado **diferente** do que o parser lê. Se o
  tripwire lê o mesmo texto, não é independente — é a mesma premissa duas vezes. — norma:
  `PROGRAMA.md` §IV-2, mecanismo 4.

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Não escreva `npm test -- -t "X"` (ou `pytest -k X`) como critério de card.** É o item "Fraco"
  da tabela de §IV-2 do programa, e a medição acima mostra que o motivo varia por
  runner: no `node --test` o veredito é verde com `pass 1` mentiroso; no `pytest` o veredito é 5,
  que parece vermelho até alguém encapsular em `|| true`.
- **Não use `rg -L` para dizer "todo arquivo tem a marca".** Em ripgrep `-L` é `--follow`. Este é o
  erro mais caro desta skill porque ele **inverte** o critério em vez de enfraquecê-lo — e não é
  hipótese: são 13 ocorrências já escritas em `PROGRAMA.md`, incluindo o exemplo canônico "Bom"
  da tabela de §IV-2.
- **Não trate exit code como sinal onde ele não é:** `git status --porcelain` sai 0 sujo,
  `ffmpeg -h filter=<inexistente>` sai 0, `ffprobe` com chave errada sai 0. Nos três, o sinal é a
  saída.
- **Não "conserte" flicker com `--concurrency=1`.** A própria doc diz que é mais lento e não
  garante o timing correto: serializar esconde a inconsistência entre instâncias sem remover a
  causa (estado fora de `useCurrentFrame()`), e o flicker volta em produção. A camada de
  determinismo roda com `--concurrency` **default**. — norma:
  `docs/00-panorama-verificado.md` §9.5 (passo 2), `docs/pesquisa/R11-golden-master-video.md:484-488`.
- **Não afrouxe o limiar até o teste parar de piscar.** Cada ponto de afrouxamento é uma classe de
  regressão que deixa de ser detectada, e a perda é invisível: com `maxDiffPixels` alto o
  bastante, "o texto sumiu" passa. Gateie por **duas dimensões ao mesmo tempo**. — norma:
  `docs/00-panorama-verificado.md` §9.5 (o fecho da seção). O **número** é de `video-characterization`.
- **Não aprove baseline com `cp received/ aprovado/`** — copiar absorve a regressão em silêncio; o
  arquivo aprovado é imutável e a aprovação produz registro. — norma:
  `docs/pesquisa/R11-golden-master-video.md:506-508`.
- **Não gere o oráculo com o motor.** Conferir o vídeo contra o mesmo manifesto que o gerou é duas
  cópias errando juntas; a expectativa da fixture da timeline resolvida é **escrita à mão**. —
  norma: `docs/00-panorama-verificado.md` §9.1 e §9.2 (limite duro da Camada 2).
- **Não invente flag de render para montar um gate.** Em `remotion 4.0.507`, as ~60 flags de
  `npx remotion render` funcionam como allowlist: `--delay-render-timeout` e `--output-still`
  **não existem** (o timeout de `delayRender()` é `--timeout`; still é o comando separado
  `npx remotion still`) — **Placar (2-0: a página lista todas as flags e nenhuma das duas está lá,
  e `options/timeout.tsx` @ v4.0.507 declara `cliFlag = 'timeout'`)** — fonte:
  https://www.remotion.dev/docs/cli/render + `docs/pesquisa/R05-render-hwaccel.md:428`. E
  `--every-nth-frame` **só pode ser usado ao renderizar GIF**; para preview parcial de vídeo o
  certo é `--frames` — **Placar (2-0)** — fonte:
  https://www.remotion.dev/docs/renderer/render-frames + `docs/pesquisa/R05-render-hwaccel.md:44`
  (R05-19). Nome de flag errado = card morto.
- **Não escreva `CONFERE` depois de ler a saída na tela.** É o reflexo certo em qualquer outro
  projeto e aqui é o veredito que não pode existir: sem a **saída de comando salva** anexada, ele
  para de ser reperguntado e vira premissa invisível. Enquanto a pilha não estiver de pé, o rótulo
  é `NÃO_COLETADO`, que nunca vira `CONFERE` sozinho. — norma: `PROGRAMA.md` Apêndice G ("um
  veredito que não pode existir"), `docs/00-panorama-verificado.md` §9.5.
- **Não delete o verificador de um estágio removido** — ele vira asserção de ausência nos dois
  sentidos, que é o que impede reintrodução silenciosa. — norma: `PROGRAMA.md` §IV-3.

## Falso verde deste domínio

Linhas marcadas *(medido)* vêm das execuções desta skill; as demais, de
`docs/pesquisa/R11-golden-master-video.md:467-513`, `PROGRAMA.md` **Apêndice H** e
`docs/PLAYBOOK-REFERENCIA.md:518-536` (Apêndice I).

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| `exit 0` de um render | um quadro preto renderiza com sucesso | asserção de entropia do frame + invariante "nenhum frame 100% preto" |
| filtro que casa zero testes *(medido)* | `node --test` imprime `pass 1` (o arquivo) e sai 0 | sonda negativa por alvo + contagem por descoberta |
| `pytest -k` "vermelho" *(medido)* | sai **5**, e 5 vira 0 em `\|\| true` ou em wrapper que só testa `rc == 1` | asserção explícita de `rc == 0` **e** de nº de testes casados |
| `rg -L "MARCA" dir/` vazio *(medido)* | em ripgrep `-L` é `--follow`: vazio significa "ninguém tem a marca" — 13 `∅-crit` de `PROGRAMA.md` já estão nessa forma | `rg --files-without-match` + denominador |
| critério por ausência em diretório vazio, apagado ou inexistente *(medido)* | glob que não expande devolve stdout vazio e rc=2; `rg` em dir inexistente também | `test "$(rg --files <dir> \| wc -l)" -ge N` na linha anterior |
| `git diff --exit-code` no diretório aprovado *(medido)* | não enxerga arquivo não rastreado | `test -z "$(git status --porcelain <dir>)"` |
| `git status --porcelain` numa cadeia `&&` *(medido)* | sai 0 sujo e limpo | comparar a **saída**, não o código |
| `ffmpeg -h filter=libvmaf` como probe *(medido)* | sai 0 e imprime `Unknown filter` | casar o conteúdo da saída |
| `ffprobe -show_entries` com chave errada *(medido)* | saída vazia, exit 0 | exigir parse não-vazio antes de comparar |
| dois renders com o mesmo hash na mesma máquina | prova escalonamento de threads, nada de fuso, locale, fonte, `gl` | render 2× com `TZ`, `LANG` e `--gl` trocados de propósito, assertando que o hash muda **só** onde deveria |
| média de SSIM do vídeo inteiro | 3 frames destruídos em 900 diluem no ruído | mínimo por frame ou contagem abaixo do limiar |
| comparador com `allowSizeMismatch` | mudança de resolução vira não-evento | assertar resolução antes de comparar pixel |
| frame 0 como golden master de cena animada | frame 0 é o estado inicial: tela quase vazia | frames no meio das transições |
| baseline aprovado a partir do Studio | o Chrome do preview não é o do render | só aprovar a partir do render |
| "a duração está certa" | duração do container ≠ duração do stream | `ffprobe -select_streams v:0 -show_entries stream=duration,nb_frames`, com parse não-vazio exigido |
| verificador que pula o que não entende | linter varre um nível e ignora o aninhado em silêncio | falhar fechado e recusar explicitamente |
| autoteste que asserta só o exit code | não distingue "acusou" de "quebrou" | asserção sobre a mensagem |
| hook de política com `exit 1` | não-bloqueante: o commit entra | `exit 2` |
| "zero chamadas externas" | verdade com o cache perfeito **e** com nada rodando | contagem de chamadas **esperadas** > 0 no mesmo run, antes de assertar que as externas são 0 (`T-08`) |
| ausência de reclamação | silêncio é produzido igualmente por "está tudo certo" e por "ninguém olhou" | pergunta ativa com destinatário nomeado e prazo; sem resposta no prazo = vermelho, não verde |

## O que esta skill NÃO cobre

**A fronteira é forma × valor, não assunto**, e precisa ser dita assim porque o corpo acima cita
objeto de skill vizinha em nove linhas, de propósito. Esta skill é dona da **forma** —
comando, sonda negativa, denominador, par de oráculos, três estados, e o que fica **vermelho** se
cada um sumir. Ela nunca escreve o **número, a flag ou o artefato**.

- **O valor do baseline visual** — qual artefato vira aprovado, qual é o número do limiar, qual a
  chave de snapshot (`gl`, plataforma, versão do Chrome), como capturar o still →
  `video-characterization`. As seis linhas daqui que tocam esse objeto (afrouxar o limiar, `cp
  received/ aprovado/`, frame 0 como golden master, baseline vindo do Studio, média de SSIM,
  `allowSizeMismatch`) dizem só o que fica vermelho; a recíproca já está escrita lá (*"critério
  falsificável, sonda negativa e os três estados → `falsifiable-gates`"*), então as duas fronteiras
  fecham em vez de circular.
- **Flags de render, `--gl`, concorrência, chunking** → `remotion-render-pipeline`; `--concurrency=1`
  entra aqui só como falso conserto de flicker, e o default é decisão de lá.
- **Sintaxe de `ffmpeg`/`ffprobe`, filtros e aceleração por hardware** → `ffmpeg-media-ops`, dona
  também dos dois probes que uso de exemplo: `psnr`/`ssim` exigindo mesma geometria, e duração de
  container × duração de stream.
- **As perguntas de refutação e o subagente de contexto fresco** → `adversarial-review`.
- **Item aberto, forma da evidência, estado terminal `INVIÁVEL`** → `uncertainty-ledger`.
- **Ordem de ondas, barreira, propriedade de arquivo** → `wave-planning`, `parallel-worktrees`.
- **Sincronia de áudio e legenda** → `audio-captions-sync`.

## Não verificado

Nada aqui pode ser citado como fato; cada linha traz o comando que fecha a lacuna.

- **`vitest -t` e `jest -t` com filtro sem casamento.** Não medidos: este repositório ainda não tem
  `package.json`. Fecha com, no repo já instalado:
  `npx vitest run -t "nao_casa_nada"; echo $?` e `npx jest -t "nao_casa_nada"; echo $?`, comparando
  também com `--passWithNoTests` explícito.
- **O filtro de composição do Remotion.** Não medido (Remotion não instalado aqui). Fecha com:
  `npx remotion render <entry> id-que-nao-existe out.mp4; echo $?` ·
  `npx remotion compositions <entry>` · `npx remotion still <entry> <id> out.png --frame=999999; echo $?`.
  Até lá, todo critério que dependa do id da composição carrega a sonda negativa junto.
- **O `threshold` não é portável entre comparadores.** R11-07 está **(1-1) EM DISPUTA**: a doc do
  Playwright descreve YIQ, o README do `pixelmatch` 7.x descreve OKLab/HyAB. Fecha com
  `npm ls pixelmatch` e `node -p "require('pixelmatch/package.json').version"` depois do primeiro
  `npm i` (`docs/pesquisa/R11-golden-master-video.md:133-163`).
- **`-fflags +bitexact` como pré-condição do hash.** R11-11 é **(1-0)**, fonte única (man page).
  Fecha com `man ffmpeg-formats | grep -A4 bitexact` e o experimento de dois encodes com e sem a
  flag.
- **"Corte rápido conta como flash".** R14-08 é **(1-0) NÃO VERIFICADO**, e a redação da fonte é
  condicional — cortes rápidos ficam sujeitos às restrições de flash **quando produzem áreas da
  tela que piscam**, não sempre. Escrever um gate que reprova corte rápido *per se* seria inventar
  uma norma. Fecha lendo a seção de fast cuts em
  https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf e registrando a
  citação literal (`docs/pesquisa/R14-motion-design-medivel.md:32`).
- **Se o `exit 1` de hook realmente não bloqueia nesta versão do harness.** É doc de publicador
  único e o item `AB-068` do ledger está aberto. Fecha com um hook `PreToolUse` matcher `Bash` que
  faz `echo x >&2; exit 1`, rodando um `Bash` trivial e observando se ele executa; repetir com
  `exit 2` (`docs/00-panorama-verificado.md` §7.6, item `AB-068`).
- **O vazamento `none_matched or len(matched) == 0` na asserção de quase-erro** (um roteador que
  nunca casa nada passa em todos os quase-erros): leitura de código sem placar próprio no arquivo
  de pesquisa. Fecha com
  `sed -n '320,330p' /home/ondokai/Projects/3blue1brown/.agents/scripts/run_skill_evals.py`.
- **Diferença de comportamento entre `ugrep 7.5.0` e o GNU grep em `-L`.** Medi a identidade do
  binário e a documentação do flag, não a divergência. Fecha com
  `grep --version | head -1` e um caso de teste com o GNU grep instalado lado a lado.

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
