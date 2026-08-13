# ADR-0009: Estagio de resolucao `grafico` — Manim headless, quirks do 3b1b e formato de alfa

**Status:** ACEITO
**Data:** 2026-08-11
**Card:** `F2-02` (W4) — Resolucao: grafico (Manim headless)
**Depende de:** ADR-0004 (reuso 3b1b), ADR-0007-contrato-de-estagio-e-cassete (F2-01),
`docs/contrato-estagio-resolucao.md`
**Consumida por:** `F2-07` (suite offline, W5), `F1-09` (no grafico da composicao, W4),
`F2-05`/`F2-06` (irmaos da mesma onda, cegos), e todo card que render o video final

**Guardas executaveis:**

```sh
just res-grafico                                   # o alvo do card
bash tools/resolucao/offline.sh --estagio grafico  # suite com a rede bloqueada
npx tsx tools/resolucao/chave.ts --estagio grafico # C12: um componente por vez
PYTHON_BIN=<python-com-manim> npx tsx src/resolucao/grafico/gravar.ts --conferir
python3 -m pytest tests/resolucao/test_grafico_quirks.py -q
```

## Contexto

O estagio `grafico` resolve os nos `grafico` do manifesto: gera uma cena
Manim para cada um, renderiza em headless e devolve o SHA-256 do video
produzido. Ele e um dos cinco estagios impuros da resolucao (contrato
F2-01), os cinco implementados em paralelo e cegos entre si.

Quatro fatos do ambiente decidem o desenho:

1. O Manim CE **nao tem paralelismo interno** e o projeto de origem virou
   um servico FastAPI + tunel cujo teto efetivo por request (~100 s) e
   MENOR que o `render_timeout` do servidor (120 s) — abrindo uma janela
   em que o servidor renderiza para ninguem (`docs/reuso-3b1b.md` item
   2.16). A forma correta e processo por cena, terminado antes de o
   Remotion abrir.
2. O Manim **nao produz saida bit-exata por construcao**: grava
   `comment=Rendered with Manim Community v<versao>` e a tag
   `encoder=Lavf<X.Y.Z>` **dentro do container**. Duas maquinas ou duas
   versoes produzem bytes diferentes sem que uma linha do nosso codigo
   mude — o modo de falha C12 na forma mais silenciosa.
3. O LLM que escreve o manifesto produz graficos cujo codigo contem os
   erros sistematicos documentados no inventario 3b1b (CYAN fora do
   namespace de `from manim import *`, `fill_opacity` em
   `add_background_rectangle`, `tip_style` de ManimGL) — erros que so
   estouram dentro do subprocesso de render (ADR-0004).
4. `-t` sozinho produz **.mov com qtrle/argb**, nao WebM com alfa e nao
   ProRes (AGENTS.md, armadilhas de dominio; verificado com ffprobe na
   gravacao). WebM com alfa exige `-t` **e** `--format=webm` juntos.

## Decisao

### D1 — O motor entra como processo por cena, nunca servico

Um processo Python por cena (`ExecutorManimSubprocesso` em
`src/resolucao/grafico/executor.ts` + `runner.py`), o job vai por ARQUIVO
(quebras de linha e aspas nao passam por argv), o resultado volta na
ultima linha de stdout como JSON. Nao existe pool, daemon nem fallback:
motor ausente e `EMotorGraficoAusente`, e ninguem o substitui em
producao — um motor que degrada em silencio entrega video sem grafico
com codigo de saida 0 (AGENTS.md C1).

### D2 — Versao da ferramenta externa vai nos parametros, e divergencia e erro

`versaoManim: "0.20.1"` (pin do pyproject.toml: `manim>=0.20.1,<0.21`) e
`versaoMuxer: "Lavf62.12.102"` (medido: a tag `encoder` vai dentro dos
bytes). O runner **recusa renderizar** se o ambiente divergir de qualquer
um dos dois — a mensagem diz exatamente o que bumpar e o que regravar.
Omitir o muxer e o modo de falha C12 em sua forma mais silenciosa: o
container muda, a chave nao.

### D3 — Formato de alfa: `.mov` qtrle/argb por default, webm por parametro

- `-t` sozinho produz **.mov com qtrle/argb** (QuickTime Animation RLE,
  lossless) — verificado com ffprobe na gravacao do cassete. NAO e WebM
  com alfa (exige `--format=webm` junto) e NAO e ProRes 4444 (ProRes nao
  aparece no codigo do gerador — `scene_file_writer.py`).
- O default do estagio e `formato: "mov"` + `fundoTransparente: true`.
  O runner ja implementa `--format=webm` como alternativa de parametro.
- A extracao de frame na composicao e fora do navegador (FFmpeg no
  `<OffthreadVideo>` do Remotion), entao o codec qtrle nao passa pelo
  decoder do Chrome — a premissa do PROGRAMA e exatamente essa ("o
  formato de alfa escolhido toca no navegador — nao toca").
- O PROGRAMA projeta esta decisao como "ADR-0008 — Formato de alfa entre
  graficos e composicao". A numeracao real segue a ordem de criacao dos
  arquivos (precedente: F2-01 gravou 0007-contrato-de-estagio-e-cassete
  onde o PROGRAMA projetava 0011). O consumo pelo `<OffthreadVideo>` nao
  esta confirmado — rastreado em **AB-390**, verificado no join da W5.

### D4 — Quirks do 3b1b absorvidos com citacao `arquivo:linha`, conserto na ENTRADA

`src/resolucao/grafico/manim/quirks.py` implementa os itens 2.1–2.10 do
inventario (`docs/reuso-3b1b.md`), cada um com a citacao do projeto de
origem (`manim-api/services/openai_service.py:...`, `manim_executor.py:...`),
exigida pela Regra 3 do ADR-0004. O oraculo dos quirks e
`tests/resolucao/test_grafico_quirks.py` (64 testes sem o Manim instalado,
mais a sonda empirica marcada `manim`).

**O conserto acontece na ENTRADA** (o codigo da cena, antes do
subprocesso), nunca na saida do motor: corrigir a saida faria o cassete
gravado ser um **sucessor** da execucao real, e nao um sosia dela
(contrato F2-01, secao 5). Cada correcao aplicada e **nomeada** na
procedencia (`cor: CYAN -> TEAL`), porque conserto anonimo e
indistinguivel de nenhum conserto.

O patch de `BackgroundRectangle` e prefixado a toda cena (custo zero
quando desnecessario); se a 0.20.1 ainda o exige e uma pergunta aberta —
**AB-392**.

### D5 — Zero rede, e o hash do motor atravessa intacto

O estagio nao chama `entrada.fetch` (nem `globalThis.fetch`): o Manim e
um processo local. `chamadas.json` do cassete sai **vazio**, e isso e o
retrato fiel da execucao. O SHA-256 vem do motor e atravessa sem
normalizacao nenhuma — hash e o contrato, nao um chute.

### D6 — Conteudo do render e exigido, exit 0 nao prova imagem

O runner decodifica os primeiros 12 frames com PyAV e exige desvio-padrao
> 1.0 (em cinza) em pelo menos um. Quadro preto, branco ou chapado sai
com exit 0 e tem de ser reprovado — C1. Medido na gravacao: o frame 0 de
um render real da exatamente 0.0 (a cena comeca vazia) e os seguintes dao
~20; por isso a checagem varre varios frames.

### D7 — Licenca da saida

`CC0-1.0` no topo e em cada asset. O video e gerado localmente a partir
dos dados do manifesto: nao ha asset de terceiro dentro dele. A licenca
do Manim CE (MIT) e da FERRAMENTA, nao da saida — um compilador GPL nao
torna GPL o binario; a ferramenta fica registrada em `procedencia.ferramenta`.

### D8 — Cassete gravado contra `MANIFESTO_DE_GRAVACAO`

`src/resolucao/grafico/manifesto-de-gravacao.ts` — 480x270 @ 15 fps
(render ~1 s, mesmo caminho de codigo de 1920x1080), dois nos que cobrem
os dois call-sites vivos dos quirks: `g-001` barras com `CYAN` (sem o
quirk, `NameError` dentro do subprocesso) e `g-002` linha sem cor
declarada (cor de serie vinda dos tokens de design, por import — Regra 2
do AGENTS.md). O manifesto mora no codigo, nao num JSON solto, porque a
chave do cassete e SHA-256 dele: o compilador guarda os bytes melhor que
a memoria de quem regrava.

### D9 — Nao gravar `adquiridoEm` no estagio

`EntradaEstagio` nao oferece relogio injetavel; ler `Date.now()` dentro
de `resolver()` poria nao-determinismo no estagio para preencher um campo
que a auditoria ja tem em `volatil.json`. — **AB-391**.

### D10 — Determinismo provado, nao declarado

`res-grafico-conferir` grava o cassete duas vezes com relogios diferentes,
diffa (zero refutacoes fora de `CAMPOS_VOLATEIS`), compara com o cassete
commitado byte a byte e muta um byte exigindo VERMELHO. Executado com
`PYTHON_BIN=<venv com manim 0.20.1>` (o venv de referencia do 3b1b serve:
`/home/ondokai/Projects/3blue1brown/manim-api/venv`) ele regravou os tres
arquivos estaveis identicos ao commitado.

## O que este estagio NAO e

- **Sandbox.** A blocklist de imports/funcoes bloqueia NOMES, nao
  capacidades; o subprocesso roda na conta do usuario
  (`docs/reuso-3b1b.md` item 2.13, IGNORAR). Ela vale como validacao
  antes do subprocesso, e so — o teste
  `test_a_blocklist_nao_e_sandbox` documenta o furo em vez de esconde-lo.
- **Consertador de saida.** Nenhuma normalizacao do resultado do motor:
  o hash atravessa intacto (D5) e as correcoes de quirk sao de entrada e
  nomeadas (D4).
- **Degradavel.** Motor ausente e erro; versao divergente e erro; video
  chapado e erro. Nao existe "desenha de outro jeito".

## Consequencias

### Positivas

1. A suite roda sem o Manim instalado: offline o orquestrador reproduz o
   cassete e nao invoca `resolver()`. O Manim e dependencia de GRAVACAO,
   nao de teste.
2. A troca de formato de handoff (mov → webm) e um parametro, e o runner
   ja implementa os dois caminhos — AB-390 fecha no join da W5.
3. As quatro perguntas adversariais do card tem resposta executavel:
   rede com cache quente (sondas do `offline.sh` + teste do orquestrador
   com estagio que explode), versao na chave (`chave.ts` + teste),
   credencial no cassete (`procurarCredencial` sobre todos os bytes),
   sosia vs sucessor (D4/D5 + `res-grafico-conferir`).

### Negativas

1. Custo de manutencao do runner e dos quirks em python: mudanca de
   versao do Manim derruba o pin de `versaoManim`/`versaoMuxer` e exige
   regravacao do cassete — de proposito, e com mensagem que nomeia o passo.
2. O cassete de 480x270 nao prova a qualidade visual de 1920x1080; prova
   o caminho de codigo e o determinismo. Qualidade e o oraculo visual
   (W5+).

## O que o sign-off NAO autoriza

- **Importar do projeto de origem.** Nenhum `import` de
  `/home/ondokai/Projects/3blue1brown` — ADR-0004, Regra 1.
- **Corrigir a saida do motor em nome do cassete.** Cassete e sosia.
- **Gravar cassete com versao divergente do ambiente.** O runner recusa.
- **Bumpar a versao do estagio sem bumpar a chave de cache.** A versao
  entra na chave (D2 do contrato); `chave.ts` reprova a omissao.
- **Tocar nos estagios irmaos, no contrato ou no store.** Fronteira do
  card: `src/resolucao/grafico/**`, `fixtures/cassetes/grafico/**`,
  testes do estagio, bloco proprio do justfile.
