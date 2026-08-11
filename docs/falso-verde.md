# Catalogo de Falso Verde — Editor de Video IA

Cada linha desta tabela descreve uma situacao em que o pipeline retorna sucesso
mas o artefato esta errado. A terceira coluna nomeia o que fica vermelho se o
falso verde sumir — o invariante, o gate ou o teste que o detecta.

## Convencao de leitura

- `(medido)` = executado e conferido nesta maquina, com versao da ferramenta
- `(projetado)` = implementado no codigo, esperando o alvo existir
- `(calculado)` = mutacao sintetica que prova o detector
- `IXX` = invariante estrutural (`tools/invariantes/verificar.py`)
- `Gate` = etapa do `tools/gate.sh`
- `just` = receita do `justfile`

## Tabela de falsos verdes

| O que parece verde | Por que nao e | O que fica vermelho se sumir |
|---|---|---|
| `exit 0` de um render *(medido)* | Um quadro preto renderiza com sucesso. Frame 100% preto e perfeitamente estavel e passa na camada de determinismo. | `I04` (nao-determinismo) + gate de entropia de frame (camada 4 do oraculo) |
| Runner de teste com filtro que nao casa nada *(medido, node --test 24.15.0)* | `node --test` imprime `pass 1` (o arquivo) e sai 0 | `I01` (testes-tem-job) + sonda negativa por alvo com contagem por descoberta |
| `pytest -k` "vermelho" *(medido, pytest 9.0.3)* | Sai **5**, e 5 vira 0 em `\|\| true` ou em wrapper que so testa `rc == 1`. `pytest dir_vazio` tambem e 5 | Gate `test` com assercao explicita de `rc == 0` e de numero de testes casados |
| `rg -L "MARCA" dir/` vazio *(medido, ripgrep 15.0.0)* | Em ripgrep `-L` e `--follow`: vazio significa "ninguem tem a marca" — o oposto do pretendido. 13 `∅-crit` em `PROGRAMA.md` ja estao nessa forma | `rg --files-without-match` + denominador |
| `git diff --exit-code` no diretorio aprovado *(medido, git 2.43.0)* | Nao enxerga arquivo nao rastreado: a captura que nao gravou nada passa | `test -z "$(git status --porcelain <dir>)"` na mesma linha |
| `git status --porcelain` numa cadeia `&&` *(medido, git 2.43.0)* | Sai 0 sujo e limpo — o sinal e a saida, nao o codigo | Comparar a saida, nunca so o exit code |
| `ffprobe` com chave errada *(medido, ffprobe 6.1.1)* | `ffprobe -v error -show_entries stream=nb_framez` → saida vazia, exit 0 | Exigir parse nao-vazio antes de comparar valor |
| Diretorio `src/composicao/` vazio ou inexistente *(projetado)* | O invariante retorna `NAO-EXERCITADO` e o gate fica amarelo — mas o codigo de composicao pode estar em outro lugar, com `Date.now()` e `fetch()` passando batido | `I04` cobre `src/composicao/`; se a composicao mudar de diretorio, o invariante tem de ser atualizado |
| Literal de token fora de `src/design/` que nao e hex, px nem ms *(projetado)* | `I02` cobre 8 classes de literal. Um literal de `borderRadius: 8` sem `px` ou `ms` passa batido | Expansao do `I02` quando novas classes de token forem criadas |
| `I06` passa em repositorio limpo *(projetado)* | O padrao `sk-` da OpenAI pode dar falso positivo em strings de documentacao. Mais grave: uma chave em base64 sem prefixo `sk-` passa | Tripwire: busca tambem por strings de alta entropia (>40 chars base64) em arquivos fora de `fixtures/` |
| `I01` passa porque o diretorio de testes e referenciado em comentario *(projetado)* | A busca por substring casa `"contratos"` em `# testes/contratos` num comentario do justfile | Busca por regex de comando, nao por substring em comentario |
| `I03` NAO-EXERCITADO porque o `manifesto-resolvido.json` nao existe *(projetado)* | E o estado correto na Fase 0. Quando o arquivo for criado, o invariante passa a rodar — mas se ninguem adicionar o caminho certo, ele continua NAO-EXERCITADO para sempre | Lista de caminhos em `I03` precisa ser mantida; o gate `contrato_testar` falha se o arquivo esperado nao existir |
| `I07` NAO-EXERCITADO com lista vazia *(projetado)* | E o estado correto enquanto nenhum ADR removeu nada. O risco e que um item seja removido e o `I07` nao seja atualizado — a ausencia vira NAO-EXERCITADO em vez de PASS | O autoteste (`test_i07`) muta a lista e prova que o detector funciona |
| Autoteste com mutacao literal *(calculado)* | Se a mutacao e um texto fixo, o primeiro merge a absorve e o teste passa a testar "a mutacao nao existe" — que e verde | `verificar_selftest.py` usa mutacao calculada: cria o cenario a partir do documento corrente, nunca de string literal |
| Autoteste que asserta so exit code *(calculado)* | Nao distingue "acusou" de "quebrou": o script pode estar quebrando com erro de sintaxe e saindo 1, e o teste passa | `verificar_selftest.py` usa `_assert_contains` e `_assert_not_contains` sobre a saida textual |
| Gate verde com tudo vazio | O gate comeca verde com tudo PENDENTE — e o estado inicial de todo projeto. O que era verde vira vermelho quando a primeira etapa entra | Cada etapa adicionada ao gate tem uma sonda negativa que falha se o trabalho nao foi feito |
| `I05` NAO-EXERCITADO porque nenhum `Root.tsx` existe *(projetado)* | Quando o arquivo for criado, o invariante passa a rodar. Mas se o `id` for passado como variavel (ex.: `` id={`cena-${nome}`} ``), o regex nao captura | O invariante precisara evoluir para AST quando o Remotion estiver instalado |
| Verificador roda sem autoteste antes *(projetado)* | O verificador pode estar quebrado e ninguem sabe. O autoteste e a unica prova de que o detector detecta | `just invariantes:selftest` roda antes de `just invariantes:verificar` |

## Falsos verdes herdados do ecossistema

Estes nao sao especificos deste repositorio mas afetam as ferramentas que ele usa.

| Ferramenta | O falso verde | O que fazer |
|---|---|---|
| `npx remotion render` | Composicao com id inexistente: comportamento nao medido. Pode sair 0 ou 1 dependendo da versao | Sonda negativa: `npx remotion compositions <entry>` lista os ids; o render so roda se o id existe |
| `npx remotion still --frame=999999` | Frame alem da duracao: comportamento nao medido | Assertar `nb_frames` antes de pedir o frame |
| `ffmpeg -i input -c copy output.mp4` | Remux sem re-encode: se o container de origem tem codec incompativel com MP4, falha silenciosamente em alguns players | `ffprobe` de saida conferindo `codec_name` por stream |
| `npx tsc --noEmit` | So type-checka arquivos incluidos no `tsconfig.json`. Um `.tsx` novo fora do `include` nao e analisado | `I01` cobre a existencia de teste; `just lint` cobre a cobertura do `tsconfig` |
| `python3 -m pytest tests/` | Se `tests/` nao tem `__init__.py` nem `conftest.py`, o discovery pode nao achar nada dependendo da configuracao | `I01` garante que cada diretorio de teste tem um job; o `conftest.py` e verificado por convencao |

## Como usar este catalogo

1. Antes de escrever um criterio de aceitacao, consulte esta tabela.
2. Se o cenario que voce esta testando e um falso verde conhecido, escreva a sonda negativa.
3. Se voce descobrir um falso verde novo, adicione uma linha a esta tabela e um invariante ou gate que o detecte.
4. A terceira coluna nunca fica vazia — se nao ha detector, o falso verde e uma nota de "cuidado", nao um item acionavel.

## Referencias

- `AGENTS.md` §As 12 ferramentas que mentem (C1-C12)
- `falsifiable-gates` SKILL.md §Falso verde deste dominio
- `PROGRAMA.html` §IV-2 (cinco mecanismos de gate)
- `docs/PLAYBOOK-REFERENCIA.md` §Gate e verificador
