# Correcoes de criterio de aceitacao — obrigatorio para todo card

Publicado no `PREP-w4`. Estas correcoes valem para **todos os cards das ondas
seguintes**, nao so os da W4. Cada uma foi verificada empiricamente, com o
comando e a saida.

---

## 1. `rg -L` NAO significa "arquivos sem correspondencia"

O PROGRAMA escreve o criterio de ausencia assim, em pelo menos seis cards:

```
∅-crit  rg -L "licenca:" assets/fontes/*.md → vazio
```

**Em ripgrep, `-L` e a forma curta de `--follow` (seguir symlinks).**
`--files-without-match` **nao tem forma curta**. Verificado:

```
$ rg --help | grep -E '^\s+-L'
    -L, --follow
```

O criterio nao esta apenas errado — ele esta **invertido nos dois sentidos**:

```
# um arquivo COM licenca, um SEM:
$ rg -L "licenca:" rgt/*.md
rgt/com.md:licenca: MIT              <- nao-vazio: o criterio REPROVA, e esta tudo certo

# NENHUM arquivo com licenca:
$ rg -L "licenca:" rgt/*.md
                                     <- vazio: o criterio APROVA, e nao ha licenca nenhuma
```

Ou seja: o comando literal do PROGRAMA **passa exatamente quando a propriedade
que ele deveria garantir esta ausente**. E o falso-verde perfeito — a forma mais
cara de teste, porque parece cobertura e nao e.

### A forma correta

```
rg --files-without-match "licenca:" assets/fontes/*.md   # → vazio
```

Vale tambem checar o denominador, porque `--files-without-match` sai vazio
tanto quando **todo** arquivo casa quanto quando **nao existe arquivo nenhum**:

```
test -n "$(ls assets/fontes/*.md 2>/dev/null)" || { echo "denominador zero"; exit 1; }
rg --files-without-match "licenca:" assets/fontes/*.md | tee /dev/stderr | grep -q . && exit 1 || exit 0
```

### Cards afetados

| Card | Onda | Criterio no PROGRAMA |
|---|---|---|
| F1-03 | W3 | `rg -L "licenca:" assets/fontes/*.md` — **ja corrigido pelo card** |
| F2-02 | W4 | `rg -L '"licenca"' fixtures/cassetes/grafico/**/procedencia.json` |
| F2-03 | W4 | idem, `locucao` |
| F2-04 | W4 | idem, `midia` |
| F2-05 | W4 | idem, `codigo` |
| F2-06 | W4 | idem, `musica` |
| F4-02 | W5 | `rg -L "^versao:" docs/autoria/prompts/*.md` |
| I-03 | W6.5 | `rg -L "comando:" docs/medicao/maquina.md` |
| F6-02 | W11 | `rg -L "## O que este documento NAO cobre" docs/runbooks/*.md` |
| F6-05 | W12 | `rg -L "virou manual" docs/arquivamento.md` |

Descoberto por F1-03 (AB-270) e confirmado aqui.

---

## 2. Alvos do `just` usam hifen, nao dois-pontos

O PROGRAMA escreve `just comp:testar`, `just res:offline`, `just no:<nome>`,
`just det:provar`, `just gm:e2e`. **`just` 1.42.4 nao aceita `:` em nome de
receita** — e o erro nao e local, e de parse: o **arquivo inteiro deixa de
carregar** e nenhuma receita roda, nem `just build`.

```
$ printf 'foo:bar:\n\t@echo ok\n' > justfile && just --list
error: Expected '&&', '::', comment, end of file, end of line, identifier,
       or '(', but found ':'
```

Passou despercebido por duas ondas porque `tools/gate.sh` invoca os comandos
diretamente, sem passar pelo `just`: o gate ficava **verde sobre um justfile
morto**.

**Convencao adotada: hifen.** `just comp-testar`, `just res-offline`,
`just fontes-testar`. Segue o precedente que `design-varrer` ja tinha aberto no
arquivo, e foi a forma para a qual os tres cards da W3 convergiram
independentemente.

Modulos (`just comp::testar`) foram testados e funcionam — exigem
`set working-directory := '..'`, sem o que todo caminho relativo quebra em
silencio — mas foram recusados: reescreveriam trabalho ja verde de tres cards
para ganhar um caractere de fidelidade.

**Regra para o seu card:** bloco proprio no fim do justfile, delimitado por
`# === <CARD> ===` … `# === fim <CARD> ===`. Nunca edite receita alheia.

---

## 3. O bundler do Remotion nao le os `paths` do tsconfig

Descoberto por F1-01. `import { tokens } from "src/design/tokens"` **passa no
`tsc` e no `vitest` e quebra so no bundle real** — o bundler do Remotion e
webpack, e ele nao resolve os aliases do tsconfig.

Dentro de `src/composicao/`, **use imports relativos**. A classe inteira de bug
e invisivel para os testes unitarios: so aparece no render de verdade.

---

## 4. A fixture canonica tinha dois numeros que nao se explicavam — corrigida

**Ja corrigido no `PREP-w4`.** Fica registrado porque muda o que voce pode
assertar.

`fixtures/canonico/manifesto-valido.json` declarava `duracao_total_frames: 930`.
A aritmetica de `calcularDuracao()` da **727** — 780 de cenas menos 53 de
fronteiras. Nenhum caminho chegava a 930. Os dois numeros conviveram porque
ninguem os comparava: o declarado era digitado, o derivado era calculado.

Alem disso, **cada fronteira era declaravel dos dois lados** — `transicao_saida`
da cena anterior e `transicao_entrada` da seguinte — e os dois lados
**discordavam em tres das quatro**:

| fronteira | `transicao_saida` da anterior | `transicao_entrada` da seguinte |
|---|---|---|
| c-001 → c-002 | `fade` 15 | `slide` 15 |
| c-002 → c-003 | `wipe` 20 | `flip` 12 |
| c-003 → c-004 | `clockWipe` 18 | `cube` 24 |
| c-004 → c-005 | (nenhuma) | `none` 0 |

A precedencia adotada por F1-01 faz **a `transicao_saida` mandar**, o que
tornava as entradas divergentes silenciosamente inertes: elas nao mudavam o
tempo, mas mentiam para quem as lesse. Cobertura ilusoria — `slide`, `flip` e
`cube` pareciam exercitados e nunca foram.

O que mudou na fixture: `duracao_total_frames` passou a **727**, e as quatro
`transicao_entrada` foram removidas. O total nao muda com a remocao (a fronteira
c-004 → c-005 declarava `none` 0). O campo continua opcional no schema.

`tests/fixtures/coerencia-canonica.test.ts` amarra os dois para a divergencia
nao voltar em silencio: exige que o declarado bata com o derivado, que o
derivado seja `somaCenas - somaTransicoes` (senao alguem faz os numeros baterem
zerando as transicoes), que nenhuma fronteira seja declarada dos dois lados, e
que nenhum no fique orfao. Sonda negativa executada: repor 930 deixa o teste
vermelho com `expected 930 to be 727`.

Ledger: AB-240 e AB-244 (F1-01).
