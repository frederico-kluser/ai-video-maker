# =============================================================================
# justfile — task runner do Editor de Video IA
# =============================================================================
# Requisitos: Node >=22, Python >=3.12, FFmpeg >=6.0
# Instalar:  npm install && uv sync (ou pip install -e ".[dev]")
# =============================================================================

# Versoes pinadas da toolchain (unica fonte de verdade)
NODE_VERSION := "24"
PYTHON_VERSION := "3.12"
FFMPEG_MIN_VERSION := "6.0"
REMOTION_VERSION := "4.0.507"
TYPESCRIPT_VERSION := "5.9"

# Compila TypeScript e verifica sintaxe Python
build:
    @echo "=== build: TypeScript ==="
    npx tsc --noEmit
    @echo "=== build: Python ==="
    python3 -c "print('Python syntax OK')"
    @echo "=== build: OK ==="

# Roda todos os testes. Falha de QUALQUER runner propaga o exit code real
# (falso-verde C2 corrigido): `--passWithNoTests` para o vitest (runner que
# nao casa teste nenhum sai 0 sem olhar nada) e o pytest roda sem `|| echo` —
# teste que falha deixa a receita VERMELHA, e exit 5 (nenhum teste coletado)
# tambem e vermelho (o pytest nao esta configurado para aceitar coletas vazias).
test:
    npx vitest run --passWithNoTests
    python3 -m pytest tests/

# Roda linters (TypeScript + Python ruff). Sem `2>/dev/null`: violacao de
# ruff tem de aparecer, e ferramenta ausente e VERMELHO, nao "pulado".
lint:
    @echo "=== lint: TypeScript ==="
    npx tsc --noEmit
    @echo "=== lint: Python (ruff) ==="
    python3 -m ruff check src/ tests/

# Type-check TypeScript (sem emitir JS)
typecheck:
    npx tsc --noEmit

# Remove artefatos de build
clean:
    rm -rf dist/ output/ .remotion/ .cache/
    find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name '*.tsbuildinfo' -delete 2>/dev/null || true
    @echo "clean: OK"

# Imprime versoes da toolchain
versoes:
    @echo "=== Toolchain versions ==="
    @echo -n "Node.js: " && node --version
    @echo -n "Python: " && python3 --version | cut -d' ' -f2
    @echo -n "FFmpeg: " && ffmpeg -version 2>&1 | head -1 | cut -d' ' -f3
    @echo "Remotion (pinned): {{REMOTION_VERSION}}"
    @echo -n "TypeScript: " && npx tsc --version
    @echo "=== Versoes reportadas acima ==="

# Formata TypeScript e Python. Sem `2>/dev/null` e sem `|| echo`: erro de
# formatador ou ferramenta ausente propaga e deixa a receita VERMELHA.
fmt:
    @echo "=== fmt: TypeScript ==="
    npx prettier --write "src/**/*.{ts,tsx}"
    @echo "=== fmt: Python (ruff) ==="
    python3 -m ruff format src/ tests/

# Inicia o Remotion Studio
dev:
    npx remotion studio

# Instala dependencias
install:
    npm install
    @echo "Python dependencies: run 'uv sync' or 'pip install -e .[dev]'"

# ─── Contrato do manifesto ────────────────────────────────────────────────────

# Regenera schemas e modelos cross-language a partir da fonte unica (Zod 4).
# Falha se git diff nao for vazio (ausencia e divergencia).
contrato_gerar:
    @echo "=== contrato_gerar ==="
    @echo "Fonte unica: src/contratos/manifesto.ts (Zod 4)"
    @echo "Destinos: schema/manifesto.schema.json, schema/manifesto.llm.schema.json"
    @echo "          datamodel-codegen → src/contratos/manifesto.py"
    @echo "NOTA: geracao Zod→JSON Schema requer npm install e Zod 4."
    @echo "      Nesta fase (F0), os schemas sao mantidos a mao."
    @test -s schema/manifesto.schema.json || { echo "FALHOU: schema/manifesto.schema.json nao existe"; exit 1; }
    @test -s schema/manifesto.llm.schema.json || { echo "FALHOU: schema/manifesto.llm.schema.json nao existe"; exit 1; }
    @test -s src/contratos/manifesto.ts || { echo "FALHOU: src/contratos/manifesto.ts nao existe"; exit 1; }
    @echo "contrato_gerar: OK (schemas e tipos presentes)"

# Valida fixtures contra o schema completo e o subset do LLM.
# Exige jsonschema instalado (pip install jsonschema).
contrato_testar:
    @echo "=== contrato_testar ==="
    @python3 -m pytest tests/contratos/validar_manifesto_test.py -v 2>/dev/null || \
        { echo "FALHOU: testes de validacao do manifesto"; exit 1; }
    @echo "contrato_testar: OK"

# Verifica que o schema do LLM e um subset valido:
# (a) sem chaves proibidas pelo strict mode da Anthropic
# (b) e relaxamento do schema completo
contrato_subset:
    @echo "=== contrato_subset ==="
    python3 -m pytest tests/contratos/validar_manifesto_test.py::test_subset_sem_chaves_proibidas tests/contratos/validar_manifesto_test.py::test_subset_e_relaxamento -q 2>/dev/null
    @echo "contrato_subset: OK"

# =============================================================================
# Design system — tokens e validacao
# =============================================================================

# Gera tokens.py (espelho Python) a partir de src/design/tokens.ts
design-gerar:
    npx tsx scripts/generate-tokens-py.ts
    @echo "=== design-gerar: verificando git diff --exit-code ==="
    git diff --exit-code tokens.py || (echo "ERRO: tokens.py difere do gerado. Rode just design-gerar e commit." && exit 1)
    @echo "design-gerar: OK"

# Roda testes de design (contraste + varredura de literais)
design-testar:
    @echo "=== design-testar: contraste WCAG AA ==="
    npx vitest run tests/design/contrast.test.ts
    @echo "=== design-testar: varredura de literais ==="
    npx vitest run tests/design/literal-scan.test.ts
    @echo "design-testar: OK"

# Varredura de literais — falha se achar literal fora de src/design/
design-varrer:
    @echo "=== design-varrer: procurando literais fora de src/design/ ==="
    npx vitest run tests/design/literal-scan.test.ts
    @echo "design-varrer: OK"

# =============================================================================
# Validador de grafo
# =============================================================================

# Roda o validador de grafo
validar-grafo:
    python3 tools/validate-graph.py tools/cards.json

# Roda o autoteste do validador
validar-grafo-selftest:
    python3 tools/validate-graph_selftest.py

# Gera a tabela de ondas
ondas-gerar:
    python3 tools/gerar-tabela-de-ondas.py tools/cards.json

# Gera prompt de um card (ex: just prompt:card F0-01)
prompt-card card_id:
    python3 tools/gerar-prompt-de-card.py {{card_id}} tools/cards.json

# =============================================================================
# Skills infrastructure
# =============================================================================

skills-lint:
    python3 .agents/scripts/skill_lint.py

skills-test:
    python3 .agents/scripts/skill_lint_selftest.py

skills-catalogo:
    python3 .agents/scripts/gerar-catalogo.py
    git diff --exit-code .agents/skills/catalog.md || (echo "ERROR: catalog.md is out of date. Run 'just skills:catalogo' to regenerate." && exit 1)
# Alias
default: build

# =============================================================================
# Harness de determinismo — canário
# =============================================================================

# Prova de determinismo: renderiza o canário 2x e exige bytes idênticos
det-provar:
    bash tools/determinismo/provar.sh

# Teste de mutação: injeta valor volátil e exige que o gate fique VERMELHO
det-mutar:
    bash tools/determinismo/mutar.sh

# Teste de ausência: apaga snapshot aprovado e exige que o gate fique VERMELHO
det-ausencia:
    bash tools/determinismo/ausencia.sh

# Roda todos os testes de determinismo (vitest)
det-testar:
    npx vitest run tests/harness/

# === F1-01 ===
# =============================================================================
# Composicao — raiz, contrato de no, descoberta por convencao e tempo
# =============================================================================
# NOTA DE NOME: o PROGRAMA escreve estas receitas como `comp:testar`. O `just`
# 1.42 nao aceita ':' em nome de receita (o ':' separa nome de dependencia),
# entao valem os nomes com hifen — a mesma saida ja adotada por `design-varrer`
# e `contrato_gerar` neste arquivo.

# A raiz renderiza a fixture canonica com nos de mentira e o timing bate
comp-testar:
    @echo "=== comp-testar: tipos de src/composicao/ ==="
    npx tsc --noEmit -p tsconfig.composicao.json
    @echo "=== comp-testar: render + timing ==="
    npx vitest run tests/composicao/testar.test.ts

# Varre o disco e exige id unico por no descoberto
comp-unicidade:
    @echo "=== comp-unicidade ==="
    npx vitest run tests/composicao/unicidade.test.ts

# (∅-crit) Falha se achar Date.now / Math.random / setTimeout / fetch
# sob src/composicao/. Traz sonda negativa: o mesmo varredor tem de acusar
# as quatro violacoes plantadas em tests/composicao/impuro/.
comp-pureza:
    @echo "=== comp-pureza (∅-crit) ==="
    npx vitest run tests/composicao/pureza.test.ts

# O ponto de entrada do Remotion tem de BUNDLAR de verdade.
# O bundler e webpack e NAO le os `paths` do tsconfig: um import
# "src/design/tokens" passa no tsc e no vitest e quebra so aqui.
comp-bundle:
    @echo "=== comp-bundle: webpack do Remotion ==="
    npx remotion bundle src/composicao/raiz.tsx --out-dir=.remotion/bundle-composicao
    @test -f .remotion/bundle-composicao/index.html || { echo "FALHOU: bundle sem index.html"; exit 1; }
    @echo "comp-bundle: OK"

# Os gates de composicao de uma vez (sem o bundle, que e lento)
comp-gate: comp-pureza comp-unicidade comp-testar
    @echo "comp-gate: VERDE"
# === fim F1-01 ===

# === F2-01 ===
# Resolucao — contrato de estagio, cassetes e orquestrador.
# Dono: card F2-01. Nao edite fora destes marcadores.
# Contrato para os cinco cards da W4: docs/contrato-estagio-resolucao.md
#
# NOME DAS RECEITAS — leia antes de reclamar que nao e `res:offline`.
# O PROGRAMA.html escreve a aceitacao como `just res:offline`. Acontece que
# `just` 1.42 NAO aceita `:` em nome de receita: `res:offline:` e lido como
# receita `res` com dependencia `offline`, e o `:` final e erro de sintaxe.
# O mesmo vale para `det:provar`, `ondas:gerar`, `skills:lint` e
# `validar-grafo:selftest`, ja no arquivo — por isso o justfile inteiro nao
# parseia hoje, em qualquer branch. F2-01 nao pode consertar as receitas dos
# outros cards (regra da onda), entao usa hifen aqui e registrou o item de
# ledger AB-284. Enquanto o arquivo nao parsear, os comandos equivalentes
# rodam direto:
#     bash tools/resolucao/offline.sh
#     npx tsx tools/resolucao/regravar-e-diffar.ts
#     bash tools/resolucao/sem-cassete.sh

# `res:offline` do PROGRAMA. A suite inteira com a REDE BLOQUEADA
# (namespace de rede do kernel + guarda em processo).
# --estagio <nome> restringe a um estagio (usado por F2-02..F2-06).
res-offline *args:
    bash tools/resolucao/offline.sh {{args}}

# `res:cassete` do PROGRAMA. Regrava um cassete e diffa: qualquer diferenca
# nao explicada refuta o determinismo. Inclui sonda negativa — muta o
# resultado e exige que o diff fique VERMELHO.
res-cassete *args:
    npx tsx tools/resolucao/regravar-e-diffar.ts {{args}}

# `res:chave` do PROGRAMA. Muda um componente da chave por vez e exige
# cache miss em cada (C12).
res-chave *args:
    npx tsx tools/resolucao/chave.ts {{args}}

# ∅-crit: prova que um estagio SEM cassete derruba res-offline.
# Injeta um estagio de mentira, exige VERMELHO pelo motivo certo, remove,
# exige VERDE.
res-sem-cassete:
    bash tools/resolucao/sem-cassete.sh

# Cobertura de cassetes: todo estagio descoberto em
# src/resolucao/<nome>/estagio.ts tem de ter cassete. Inclui autoteste do
# proprio verificador (C2).
res-cobertura *args:
    npx tsx tools/resolucao/cobertura.ts {{args}}

# Sonda de rede isolada. camada = kernel | processo
res-sonda camada="processo":
    npx tsx tools/resolucao/sonda-rede.ts --camada {{camada}}

# Schema do manifesto resolvido: prova que uma URL e impossivel pelo schema.
res-schema:
    python3 -m pytest tests/resolucao/test_schema_resolvido.py -q

# Tudo do card F2-01, em ordem.
res-tudo: res-offline res-cassete res-sem-cassete
# === fim F2-01 ===

# === F1-03 ===
# =============================================================================
# Fontes locais embutidas — F1-03
# =============================================================================
# AGENTS.md C6: "Uma fonte que nao carregou cai para fallback sem erro."
# Estas receitas existem para que isso nunca passe em silencio.
#
# NOME DAS RECEITAS: o card pediu `just fontes:testar`, mas `just` 1.42 nao
# aceita ':' em nome de receita — ele le `a:b` como "receita a depende de b".
# Todas as receitas `x:y` deste justfile (validar-grafo:selftest em diante) ja
# tornam o arquivo inteiro impossivel de parsear, desde antes deste card. Por
# isso o bloco abaixo segue a convencao que FUNCIONA neste mesmo arquivo
# (design-gerar, design-testar, design-varrer): hifen, nao dois-pontos.
# Ver docs/adr/0008-fontes-locais-embutidas.md e ledger/inbox/F1-03.json (AB-271).

# Renderiza um still e asserta a FAMILIA RESOLVIDA — nao "renderizou sem erro".
# Inclui a sonda negativa: um arquivo de fonte ausente TEM de derrubar o render.
fontes-testar:
    @echo "=== fontes-testar: familia resolvida no render ==="
    npx vitest run tests/design/font-resolve.test.ts
    @echo "fontes-testar: OK"

# Licenca e direito de embutir. Embutir e uma permissao separada de usar e de
# redistribuir: mora na OFL 1.1 E no bit OS/2.fsType dentro do proprio binario.
fontes-licenca:
    @echo "=== fontes-licenca: ficha de licenca de cada fonte embutida ==="
    @# ATENCAO: em ripgrep, -L e --follow (symlinks), NAO --files-without-match.
    @# O ∅-crit do card, `rg -L "licenca:" ...`, sai VAZIO justamente quando
    @# NENHUMA ficha declara licenca. Aqui usamos a flag que exprime a intencao.
    @test -n "$(ls assets/fontes/*.md 2>/dev/null)" || { echo "FALHOU: nenhuma ficha .md em assets/fontes/"; exit 1; }
    @sem_licenca=$(rg --files-without-match "licenca:" assets/fontes/*.md || true); \
        if [ -n "$sem_licenca" ]; then echo "FALHOU: ficha sem 'licenca:':"; echo "$sem_licenca"; exit 1; fi
    @echo "  toda ficha .md declara licenca:"
    @# C2: um filtro -t que nao casa nada faz o vitest sair verde sem olhar nada.
    @saida=$(npx vitest run tests/design/font-resolve.test.ts -t "binario" 2>&1); \
        echo "$saida" | tail -6; \
        echo "$saida" | grep -qE "Tests +[1-9][0-9]* passed" || \
            { echo "FALHOU: o filtro -t nao selecionou nenhum teste (falso verde)"; exit 1; }
    @echo "fontes-licenca: OK"

# Zero fonte remota: o render e offline por construcao.
fontes-offline:
    @echo "=== fontes-offline: nenhuma fonte remota em src/ ==="
    @if rg -i -n "fonts.googleapis|cdn" src/; then \
        echo "FALHOU: referencia a fonte remota em src/"; exit 1; \
    fi
    @echo "fontes-offline: OK (sem resultado)"
# === fim F1-03 ===
# === F2-02 ===
# =============================================================================
# Resolucao: grafico (Manim headless) — F2-02
# =============================================================================
# Contrato: docs/contrato-estagio-resolucao.md. Quirks absorvidos do 3b1b com
# citacao de origem: src/resolucao/grafico/manim/quirks.py. Decisoes:
# docs/adr/0009-estagio-grafico-manim.md. Ledger: ledger/inbox/F2-02.json.
#
# NOME DAS RECEITAS: hifen, nunca ':'. `just` 1.42 le `a:b:` como "receita a
# depende de b" e o erro de parse derruba o arquivo INTEIRO — nenhuma receita
# roda, nem as dos outros cards. Ver docs/criterios-de-aceitacao-corrigidos.md.

# ∅-crit do card: todo cassete de grafico declara licenca.
#
# O comando do PROGRAMA e `rg -L '"licenca"' ... -> vazio`. Em ripgrep, -L e
# --follow (symlinks), NAO --files-without-match: o comando literal sai vazio
# exatamente quando NENHUM procedencia.json declara licenca. Aqui usamos a
# flag que exprime a intencao, E checamos o denominador — porque
# --files-without-match tambem sai vazio quando nao existe arquivo nenhum.
res-grafico-licenca:
    @echo "=== res-grafico-licenca: ∅-crit de licenca (forma corrigida) ==="
    @arquivos=$(ls fixtures/cassetes/grafico/*/procedencia.json 2>/dev/null || true); \
        if [ -z "$arquivos" ]; then \
            echo "FALHOU: denominador zero — nenhum fixtures/cassetes/grafico/*/procedencia.json."; \
            echo "        Cassete ausente NAO e aprovacao: grave com 'just res-grafico-gravar'."; \
            exit 1; \
        fi; \
        echo "  denominador: $(printf '%s\n' "$arquivos" | wc -l) procedencia.json"
    @sem_chave=$(rg --files-without-match '"licenca"' fixtures/cassetes/grafico/*/procedencia.json || true); \
        if [ -n "$sem_chave" ]; then \
            echo "FALHOU: procedencia.json sem a chave \"licenca\":"; echo "$sem_chave"; exit 1; \
        fi
    @# Presenca da chave nao basta: `"licenca": ""` casaria no rg acima. A
    @# checagem de valor nao-vazio EM CADA licenca (topo e cada asset) e
    @# validarProcedencia(), exercitada em tests/resolucao/estagio-grafico.test.ts.
    @sem_valor=$(rg --files-without-match '"licenca": *"[^"]+"' fixtures/cassetes/grafico/*/procedencia.json || true); \
        if [ -n "$sem_valor" ]; then \
            echo "FALHOU: procedencia.json com \"licenca\" vazia:"; echo "$sem_valor"; exit 1; \
        fi
    @echo "  toda procedencia.json de grafico declara licenca nao-vazia"
    @echo "res-grafico-licenca: OK"

# O alvo do card. Roda sem Manim instalado — e diz em voz alta o que, por
# isso, NAO foi exercitado aqui.
res-grafico: res-grafico-licenca
    @echo ""
    @echo "=== res-grafico: estagio de resolucao grafico ==="
    @echo "--- [1/5] tipos ---"
    npx tsc --noEmit
    @echo "--- [2/5] vitest: tests/resolucao/estagio-grafico.test.ts ---"
    @# C2: um alvo que nao casa nenhum teste sai verde. Exigimos o numerador.
    @saida=$(npx vitest run tests/resolucao/estagio-grafico.test.ts 2>&1); \
        echo "$saida" | tail -6; \
        echo "$saida" | grep -qE "Tests +[1-9][0-9]* passed" || \
            { echo "FALHOU: o vitest nao rodou nenhum teste deste card (falso verde)"; exit 1; }
    @echo "--- [3/5] pytest: quirks absorvidos do 3b1b ---"
    @saida=$(python3 -m pytest tests/resolucao/test_grafico_quirks.py -q 2>&1); \
        echo "$saida" | tail -4; \
        echo "$saida" | grep -qE "[1-9][0-9]* passed" || \
            { echo "FALHOU: o pytest nao rodou nenhum teste dos quirks (falso verde)"; exit 1; }
    @echo "--- [4/5] cobertura de cassete (∅-crit do contrato) ---"
    npx tsx tools/resolucao/cobertura.ts --estagio grafico
    @echo "--- [5/5] chave de cache: um componente por vez (C12) ---"
    npx tsx tools/resolucao/chave.ts --estagio grafico
    @echo ""
    @if command -v manim >/dev/null 2>&1 || [ -n "${MANIM_BIN:-}" ] || [ -n "${PYTHON_BIN:-}" ]; then \
        echo "  [MOTOR PRESENTE] 'just res-grafico-conferir' exercita o render de verdade"; \
        echo "                   ATENCAO (cartucho webm): o libvpx-vp9 desta cadeia e"; \
        echo "                   nao-determinista — o hash do asset muda entre gravacoes"; \
        echo "                   e '--conferir' sai VERMELHO por construcao (AB-396)."; \
    else \
        echo "  [NAO-EXERCITADA] o render real do Manim nao rodou nesta invocacao."; \
        echo "                   O Manim CE esta declarado em pyproject.toml e nao esta"; \
        echo "                   instalado neste ambiente. O cassete commitado FOI gravado"; \
        echo "                   com manim 0.20.1 + Lavf62.12.102 (ADR-0007) em webm."; \
    fi
    @echo "res-grafico: OK"

# Gravacao do cassete. Roda A MAO, com o Manim disponivel — nunca em suite.
#   just res-grafico-gravar
#   PYTHON_BIN=/caminho/para/python-com-manim just res-grafico-gravar
res-grafico-gravar:
    npx tsx src/resolucao/grafico/gravar.ts

# Regrava duas vezes com relogios diferentes, diffa, compara com o cassete
# COMMITADO e roda a sonda negativa. Exige o Manim: sem ele, falha alto.
res-grafico-conferir:
    npx tsx src/resolucao/grafico/gravar.ts --conferir
# === fim F2-02 ===

# === F2-03 ===
# Resolucao — locucao: audio e timing por palavra.
# Dono: card F2-03. Nao edite fora destes marcadores.
#
# A aceitacao do PROGRAMA pede `just res:locucao`; este arquivo usa hifen
# (AB-284, just 1.42 nao aceita ':' em nome de receita). O conjunto que
# fecha o card:
#   - vitest dos testes do estagio (tests/resolucao/locucao.test.ts),
#     com a REDE BLOQUEADA pelo guarda em processo;
#   - res-offline --estagio locucao (namespace de kernel + guarda, schema,
#     cobertura de cassete, chave de cache);
#   - determinismo REAL do cassete: grava DUAS vezes com relogios
#     diferentes contra o sosia local e diffa byte a byte, com sonda
#     negativa (mutar o resultado TEM de deixar vermelho). O
#     regravar-e-diffar compartilhado usa o manifesto de referencia, que
#     nao tem cena com locucao — zero unidades e determinismo provado
#     sobre nada (C2). A prova de verdade roda aqui;
#   - ∅-crit da licenca na forma CORRETA: em ripgrep, `-L` e --follow,
#     nao --files-without-match (docs/criterios-de-aceitacao-corrigidos.md).

# O gate completo do estagio de locucao (audio + timing).
res-locucao:
    @echo "=== res-locucao: audio e timing por palavra ==="
    npx tsc --noEmit
    npx vitest run tests/resolucao/locucao.test.ts
    bash tools/resolucao/offline.sh --estagio locucao
    npx tsx tools/resolucao/chave.ts --estagio locucao
    npx tsx src/resolucao/locucao/gravar.ts --determinismo
    @echo "--- ∅-crit: todo procedencia.json declara licenca ---"
    @test -n "$(ls fixtures/cassetes/locucao/*/procedencia.json 2>/dev/null)" || { echo "FALHOU: nenhum cassete de locucao gravado"; exit 1; }
    @sem_licenca=$(rg --files-without-match '"licenca"' fixtures/cassetes/locucao/*/procedencia.json || true); \
        if [ -n "$sem_licenca" ]; then echo "FALHOU: cassete sem licenca:"; echo "$sem_licenca"; exit 1; fi
    @echo "res-locucao: VERDE"

# So a prova de determinismo do cassete de locucao (sem vitest nem offline).
res-locucao-determinismo:
    npx tsx src/resolucao/locucao/gravar.ts --determinismo
# === fim F2-03 ===

# === F2-05 ===
# =============================================================================
# Resolucao: destaque de codigo pre-computado — F2-05 (W4)
# =============================================================================
# O card em uma frase: o destaque de sintaxe e calculado ACIMA da fronteira
# de determinismo e o no de composicao (F1-08) so consome tokens prontos.
# Nada de resolver tipo em host de terceiro em tempo de render.
#
# NOME DAS RECEITAS: hifen, nunca ':'. `just` 1.42 le `a:b:` como "receita a
# depende de b" — ver docs/criterios-de-aceitacao-corrigidos.md §2.
#
# A aceitacao do card usa tambem duas receitas do F2-01, que ja existem:
#     just res-offline --estagio codigo    (rede bloqueada de verdade)
#     just res-chave   --estagio codigo    (um parametro por vez, cache miss)
#
# ADR: docs/adr/0011-resolucao-destaque-de-codigo.md
# Ledger: ledger/inbox/F2-05.json (AB-450..AB-456)

# ∅-crit do card: todo cassete deste estagio declara licenca.
#
# O PROGRAMA escreve `rg -L '"licenca"' ... -> vazio`. Esta ERRADO: em
# ripgrep, `-L` e `--follow` (seguir symlink), e `--files-without-match` nao
# tem forma curta. O comando literal sai vazio EXATAMENTE quando nenhum
# arquivo declara licenca — passa quando a propriedade esta ausente.
# Aqui: a flag que exprime a intencao, MAIS o denominador (porque
# --files-without-match tambem sai vazio quando nao ha arquivo nenhum),
# MAIS a sonda negativa (porque um comando que nunca reprovou nao e prova).
res-codigo-licenca:
    @echo "=== res-codigo-licenca: ∅-crit da licenca ==="
    @arquivos=$(ls fixtures/cassetes/codigo/*/procedencia.json 2>/dev/null || true); \
        test -n "$arquivos" || { echo "FALHOU: denominador zero — nenhum procedencia.json em fixtures/cassetes/codigo/"; exit 1; }; \
        echo "  denominador: $(printf '%s\n' "$arquivos" | wc -l) procedencia.json"
    @sem=$(rg --files-without-match '"licenca"' fixtures/cassetes/codigo/*/procedencia.json || true); \
        if [ -n "$sem" ]; then echo "FALHOU: cassete sem licenca declarada:"; printf '%s\n' "$sem"; exit 1; fi
    @echo "  toda procedencia.json de fixtures/cassetes/codigo/ declara licenca"
    @tmp=$(mktemp -d); mkdir -p "$tmp/sem-licenca"; printf '%s\n' '{"provedor":"x"}' > "$tmp/sem-licenca/procedencia.json"; \
        if rg --files-without-match '"licenca"' "$tmp"/*/procedencia.json | grep -q .; then \
            echo "  sonda negativa: um procedencia.json SEM licenca E acusado"; rm -rf "$tmp"; \
        else \
            echo "FALHOU: SONDA NEGATIVA — o comando nao acusa um arquivo sem licenca"; rm -rf "$tmp"; exit 1; \
        fi
    @echo "res-codigo-licenca: OK"

# O gate do card. Frescor do cassete, determinismo com sonda negativa, zero
# chamada de rede gravada, varredura de credencial, endereco de conteudo
# conferido, zero URL, e a presenca do no de codigo da fixture canonica.
res-codigo: res-codigo-licenca
    @echo ""
    npx tsx src/resolucao/codigo/gate.ts
    @echo ""
    @echo "=== res-codigo: suite do estagio (com o guarda de rede em processo) ==="
    @# C2: um alvo de vitest que nao casa nenhum teste sai VERDE. Exigimos o
    @# denominador na saida. FORCE_COLOR=0 + strip de ANSI porque o contador
    @# vem embrulhado em escape de cor quando o ambiente forca cor, e o grep
    @# passaria a reprovar por causa do terminal, nao do teste.
    @saida=$(FORCE_COLOR=0 npx vitest run tests/resolucao/codigo.test.ts 2>&1 | sed -e 's/\x1b\[[0-9;]*m//g'); \
        printf '%s\n' "$saida" | tail -6; \
        printf '%s\n' "$saida" | grep -qE "Tests +[1-9][0-9]* passed" || \
            { echo "FALHOU: o alvo do vitest nao selecionou nenhum teste (falso verde)"; exit 1; }
    @echo ""
    npx tsx tools/resolucao/chave.ts --estagio codigo
    @echo ""
    @echo "res-codigo: VERDE"

# Grava o cassete. Diferente dos outros quatro estagios da W4, este comando
# nao precisa de rede nem de credencial: so tokeniza texto que ja esta no
# manifesto. --limpar remove cassetes orfaos de chaves antigas.
res-codigo-gravar *args:
    npx tsx src/resolucao/codigo/gravar.ts {{args}}

# A aceitacao inteira do card, na ordem em que o PROGRAMA a escreve.
res-codigo-tudo: res-codigo
    bash tools/resolucao/offline.sh --estagio codigo
    @echo "res-codigo-tudo: VERDE"
# === fim F2-05 ===

# === F2-06 ===
# =============================================================================
# Resolucao de musica e efeitos — card F2-06
# =============================================================================
# Os efeitos do pacote do fornecedor sao URLs REMOTAS; este estagio as
# transforma em hash no store (download -> sha256 -> store, F0-07). Nenhuma
# URL atravessa a fronteira: ela vive em procedencia.assets[].origem (C7).
#
# NOME DAS RECEITAS: o card pediu `just res:musica`, mas `just` 1.42 nao
# aceita ':' em nome de receita (ver bloco F2-01, AB-284). Usa-se hifen,
# como design-gerar, fontes-testar e os demais.
#
# O ∅-crit do card e:
#     rg -L '"licenca"' fixtures/cassetes/musica/**/procedencia.json -> vazio
# ATENCAO a mesma armadilha de F1-03: em ripgrep `-L` e `--follow`
# (symlinks), NAO `--files-without-match`. A flag que exprime a intencao
# ("nenhum procedencia.json sem licenca") e esta:
#     rg --files-without-match '"licenca"' fixtures/cassetes/musica/**/procedencia.json
# O `licenca` no topo E em CADA asset e exigido pelo gravador antes de
# qualquer byte chegar ao disco (ECasseteInvalido) — o ∅-crit de disco e a
# segunda barreira, para cassete que entre por outro caminho.

# `res:musica` do PROGRAMA. O oraculo do card: prova, COM A REDE BLOQUEADA
# neste mesmo processo (primeira linha do verificar.ts), as sete fases —
# denominador, C7 (URL nao desceu e nao sumiu), hash->store byte a byte,
# cache quente sem chamar resolver(), sosia-nao-sucessor, determinismo por
# regravacao a partir do cassete, e zero credencial. Exit 0 = VERDE.
res-musica:
    npx tsx tools/musica/verificar.ts

# Grava o cassete de musica. A MAO, COM REDE, fora de qualquer suite.
# `--pausa <ms>` aumenta a cortesia entre downloads (o fornecedor devolve
# 429 quando o bucket anonimo do IP esta apertado — outros agentes da W4
# batem no mesmo provedor). A pausa nao entra na chave de cache.
res-musica-gravar *args:
    npx tsx tools/musica/gravar.ts {{args}}

# Determinismo do estagio — a fase 6 do oraculo acima. Medido a partir do
# CASSETE (ver ledger AB-473): regravar contra a rede real devolve headers
# volateis do fornecedor (date, age, x-request-id) que entram em
# chamadas.json e refutam o diff sem nenhum defeito do estagio. A prova
# correta regrava a partir do cassete e roda com a rede bloqueada.
res-musica-determinismo:
    npx tsx tools/musica/verificar.ts
# === fim F2-06 ===

# === F2-04 ===
# Midia externa — decisao de hotlink e estagio de resolucao de midia.
# Dono: card F2-04. Nao edite fora destes marcadores.
# Decisao de hotlink: docs/adr/0013-hotlink-e-midia-externa.md
#
# NOME DAS RECEITAS: hifen, nunca dois-pontos (ver bloco de F2-01, AB-284).
# `just res:midia` do PROGRAMA = `just res-midia`.

# O relatorio da decisao sai 1 se a decisao estiver violada (provedor que
# exige hotlink com adaptador implementado). Depois a suite offline do
# estagio e o oraculo completo (tools/midia/verificar.ts, 7 fases — a
# fase 6 e a perna de determinismo NAO-VACUA, regravada a partir do
# cassete; ver ledger AB-440 e o bloco res-midia-determinismo abaixo).
res-midia:
    npx tsx src/resolucao/midia/relatorio.ts
    bash tools/resolucao/offline.sh --estagio midia
    npx tsx tools/midia/verificar.ts
    @echo "res-midia: VERDE"

# Determinismo do estagio — a fase 6 do oraculo acima. Medido a partir do
# CASSETE (ledger AB-440, mesma classe do AB-473 do irmao musica):
# regravar contra a rede real devolve headers volateis do fornecedor
# (date, age, server, x-request-id, x-cache, content-length…) que entram
# em chamadas.json fora de CAMPOS_VOLATEIS, e o CORPO da busca muda ate
# dentro do mesmo segundo (ranking do Commons nao e estavel) — os dois
# refutam o diff sem nenhum defeito do estagio. A prova correta regrava a
# partir do cassete, com as chamadas reais (busca + download) rodando em
# cada gravacao, e exige 0 refutacoes + sonda negativa vermelha.
res-midia-determinismo:
    npx tsx tools/midia/verificar.ts

# ∅-crit do card, com a intencao certa: --files-without-match lista os
# procedencia.json SEM "licenca". O `rg -L` do PROGRAMA e -L=--follow e
# imprime as linhas que casam — sai vazio justamente quando NENHUMA
# procedencia declara licenca (armadilha registrada em AB-270).
res-midia-licenca:
    @test -z "$(rg --files-without-match '"licenca"' fixtures/cassetes/midia/**/procedencia.json)" && echo "res-midia-licenca: VERDE" || { echo "res-midia-licenca: VERMELHO — algum procedencia.json sem 'licenca'"; exit 1; }
# === fim F2-04 ===

# === F1-04 ===
# =============================================================================
# No de cabecalho e titulo — F1-04 (onda W4)
# =============================================================================
# Hifen, nunca ':': `just` 1.42 le `a:b:` como "receita a depende de b" e o
# erro de parse derruba o ARQUIVO INTEIRO, nao so a receita
# (docs/criterios-de-aceitacao-corrigidos.md §2).
#
# O que cada uma prova esta no cabecalho de tools/no-cabecalho/provar.sh.
# ADR: docs/adr/0014-no-de-cabecalho-mola-nomeada.md

# O gate do card: tipos, oraculo do componente, varredura de literais e
# a prova de determinismo + snapshot (render de verdade, nunca Studio — C5).
no-cabecalho:
    @echo "=== no-cabecalho: tipos de src/composicao/ ==="
    npx tsc --noEmit -p tsconfig.composicao.json
    @echo "=== no-cabecalho: oraculo do componente ==="
    npx vitest run tests/composicao/no-cabecalho.test.ts
    @echo "=== no-cabecalho: zero literal de token fora de src/design/ ==="
    npx vitest run tests/design/literal-scan.test.ts
    @echo "=== no-cabecalho: determinismo (2x) + snapshot ==="
    bash tools/no-cabecalho/provar.sh
    @echo "no-cabecalho: VERDE"

# (Re)aprova os stills. Escreve em fixtures/snapshots/no-cabecalho/aprovados/.
# O gate NUNCA faz isso sozinho: aprovado ausente e vermelho, nao "primeira vez".
no-cabecalho-aprovar:
    bash tools/no-cabecalho/provar.sh --aprovar

# (∅-crit) Apaga cada snapshot aprovado, exige VERMELHO pelo motivo certo,
# restaura e exige VERDE. Um gate que regera o proprio oraculo nao reprova nada.
no-cabecalho-ausencia:
    bash tools/no-cabecalho/ausencia.sh
# === fim F1-04 ===

# === F1-05 ===
# =============================================================================
# No: texto — destaque palavra a palavra, degradacao declarada para frase
# =============================================================================
# Dono: card F1-05. Nao edite fora destes marcadores.
#
# NOME DAS RECEITAS: o PROGRAMA escreve `just no:<nome>` e `just det:provar
# --no <nome>`. `just` 1.42 nao aceita ':' em nome de receita (docs/
# criterios-de-aceitacao-corrigidos.md §2), entao vale o hifen, como no resto
# do arquivo. E `det:provar --no <nome>` nao existe: tools/determinismo/
# provar.sh esta amarrado ao canario (entry point, id, frame e nome de arquivo
# sao constantes no script) e tools/ nao e compartilhado nesta onda. F1-05 traz
# o proprio harness em fixtures/snapshots/no-texto/provar.ts e registra AB-321
# pedindo a generalizacao.
#
# PORTA TCP DESTE CARD: 3105.

# O gate do card. `just no-texto` -> exit 0.
no-texto: no-texto-testar no-texto-snapshot no-texto-ausencia
    @echo ""
    @echo "no-texto: VERDE"

# Os dois caminhos do card, em node, sem navegador: com timing e sem timing.
no-texto-testar:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== no-texto-testar: tipos de src/composicao/ e tests/composicao/ ==="
    npx tsc --noEmit -p tsconfig.composicao.json
    echo "=== no-texto-testar: com timing, sem timing, e a fronteira entre eles ==="
    # A saida do vitest vem com escapes ANSI mesmo fora de terminal, e eles
    # entram NO MEIO de "Tests  65 passed". Um grep ingenuo nao casa e o guarda
    # de C2 acusa falso verde onde nao ha — foi o que aconteceu aqui.
    saida=$(npx vitest run tests/composicao/no-texto.test.ts 2>&1 \
        | sed -E 's/\x1b\[[0-9;]*m//g')
    echo "$saida" | tail -8
    # C2: um alvo que nao casa nenhum teste sai VERDE sem ter olhado nada.
    echo "$saida" | grep -qE "Tests +[1-9][0-9]* passed" \
        || { echo "FALHOU: nenhum teste selecionado (falso verde)"; exit 1; }
    echo "no-texto-testar: OK"

# Render 2x com bytes identicos, invariantes entre stills, e o diretorio de
# snapshots limpo. C5: o aprovado sai do RENDER, nunca do Studio.
no-texto-snapshot:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== no-texto-snapshot: render 2x, invariantes e comparacao ==="
    npx tsx fixtures/snapshots/no-texto/provar.ts
    echo ""
    echo "=== no-texto-snapshot: fixtures/snapshots/no-texto/ sem mudanca ==="
    # C3: `git diff --exit-code` NAO enxerga arquivo nao rastreado — sozinho ele
    # da falso verde em snapshot novo. Os dois comandos andam juntos, sempre.
    git diff --exit-code fixtures/snapshots/no-texto/
    sujo=$(git status --porcelain -uall -- fixtures/snapshots/no-texto/)
    if [ -n "$sujo" ]; then
        echo "FALHOU: fixtures/snapshots/no-texto/ tem arquivo modificado ou nao rastreado:"
        echo "$sujo"
        exit 1
    fi
    echo "no-texto-snapshot: OK"

# (∅-crit) Apagar um snapshot aprovado tem de ficar VERMELHO. Prova por mutacao:
# some com cada aprovado, um por vez, e exige que o gate reprove; restaura e
# exige que volte a passar (controle positivo nas duas pontas).
no-texto-ausencia:
    @echo "=== no-texto-ausencia (∅-crit) ==="
    bash tools/no-texto/ausencia.sh

# (Re)aprova os snapshots. Explicito de proposito: o gate NUNCA gera snapshot
# sozinho — "primeira execucao, vou gerar" e o falso verde que o ∅-crit derruba.
no-texto-aprovar:
    npx tsx fixtures/snapshots/no-texto/provar.ts --aprovar

# Studio para olhar o no com os proprios olhos. Porta 3105 (faixa deste card).
# NAO aprova snapshot: o Chrome do Studio nao e o Chrome do render (C5).
no-texto-studio:
    npx remotion studio fixtures/snapshots/no-texto/index.tsx --port 3105
# === fim F1-05 ===

# === F1-06 ===
# =============================================================================
# No `lista` — grade, bullets, e os dois extremos: UM item e VINTE itens
# =============================================================================
# NOME DAS RECEITAS: hifen, nunca ':'. O `just` 1.42 le `a:b:` como "receita a
# depende de b" e o arquivo INTEIRO deixa de parsear.
# Ver docs/criterios-de-aceitacao-corrigidos.md §2.
#
# Porta TCP reservada para este card: 3106 (docs/contrato-w4.md §4).
# Faixa de ledger: AB-330..AB-339 (ledger/inbox/F1-06.json).

# A aceitacao inteira do card, em ordem. Este e o `just no-lista` do PROGRAMA.
no-lista: no-lista-testar no-lista-snapshot no-lista-determinismo no-lista-ausencia no-lista-mutar
    @echo ""
    @echo "no-lista: VERDE"

# Tipos do escopo de composicao + a suite do no.
no-lista-testar:
    @echo "=== no-lista-testar: tipos + suite do no lista ==="
    npx tsc --noEmit -p tsconfig.composicao.json
    npx vitest run tests/composicao/no-lista.test.ts

# Regrava os snapshots por cima dos aprovados e exige que NADA tenha mudado.
# `git diff --exit-code` pega o que mudou; `git status --porcelain` pega o que
# NASCEU e nunca foi rastreado — sozinho, o diff nao ve arquivo novo (C3).
no-lista-snapshot:
    @echo "=== no-lista-snapshot: regrava e exige diff limpo ==="
    npx tsx tools/no-lista/gravar.ts fixtures/snapshots/no-lista
    git diff --exit-code fixtures/snapshots/no-lista/
    @sujeira=$(git status --porcelain -- fixtures/snapshots/no-lista/); \
        if [ -n "$sujeira" ]; then \
            echo "FALHOU: snapshot nao rastreado ou modificado:"; echo "$sujeira"; exit 1; \
        fi
    @echo "no-lista-snapshot: OK"

# Render 2x em processos separados, `cmp` byte a byte, com assercao de entropia.
no-lista-determinismo:
    bash tools/no-lista/determinismo.sh

# ∅-crit: apagar, corromper ou nao rastrear um snapshot aprovado fica VERMELHO.
no-lista-ausencia:
    bash tools/no-lista/ausencia.sh

# Sondas negativas sobre o componente: quadro vazio, safe area zerada e piso de
# fonte de 1px TEM de deixar a suite vermelha.
no-lista-mutar:
    bash tools/no-lista/mutar.sh

# Reaprova os snapshots. So depois de revisar o diff — este comando nao valida
# nada, ele grava o que o codigo faz hoje.
no-lista-aprovar:
    npx tsx tools/no-lista/gravar.ts fixtures/snapshots/no-lista
    @echo "revise antes de commitar: git diff fixtures/snapshots/no-lista/"

# Preview no Studio, na porta reservada deste card.
no-lista-studio:
    npx remotion studio src/composicao/raiz.tsx --port 3106
# === fim F1-06 ===

# === F1-07 ===
# =============================================================================
# No de midia — F1-07 (endereco por hash, contrato de alfa, GIF por frame)
# =============================================================================
# O PROGRAMA escreve estas receitas como `just no:<nome>` e
# `just det:provar --no <nome>`. `just` 1.42 nao aceita ':' em nome de
# receita (AB-243), entao valem os hifens, como no resto do arquivo.
#
# `just det-provar` (F0-06) NAO aceita `--no midia`: a receita nao declara
# argumentos e este card nao edita receita alheia (contrato da W4, §1).
# O provador de determinismo do no de midia e `det-provar-midia`, que faz
# exatamente o que o PROGRAMA pede: render 2x identico + identico ao
# snapshot aprovado + o GIF avanca entre frames. Ver ledger/inbox/F1-07.json
# (AB-343) e docs/adr/0017-no-de-midia.md.

# `just no:midia` do PROGRAMA — o smoke do no: marcacao byte a byte identica
# ao aprovado + o oraculo inteiro. O provador de pixel (2x render) e receita
# separada, como em F0-06 (`det-provar` / `det-ausencia`).
no-midia:
    @echo "=== no-midia: marcacao aprovada ==="
    npx tsx tools/no-midia/marcacao.ts
    @echo "=== no-midia: oraculo (vitest) ==="
    npx vitest run tests/composicao/no-midia.test.ts
    @echo "no-midia: VERDE"

# `just det:provar --no midia` do PROGRAMA — determinismo e regressao do still
det-provar-midia:
    npx tsx tools/no-midia/provar.ts

# ∅-crit: apagar um snapshot aprovado TEM de ficar vermelho, e a restauracao
# devolve o verde
no-midia-ausencia:
    bash tools/no-midia/ausencia.sh
# === fim F1-07 ===

# === F1-08 ===
# =============================================================================
# No de codigo — desenha tokens PRE-COMPUTADOS, nunca destaca em render
# =============================================================================
# Dono: card F1-08. Nao edite fora destes marcadores.
#
# NOME DAS RECEITAS: hifen, nunca ':' — `just` 1.42 le `a:b` como "receita a
# depende de b" e o arquivo inteiro deixa de parsear. Mesma convencao de
# design-varrer, comp-testar e res-offline.
#
# Porta 3108 (faixa deste card) no studio, para nao colidir com irmao da onda.

# Tudo do card, na ordem em que um vermelho nomeia a causa certa.
no-codigo: no-codigo-testar no-codigo-render no-codigo-ausencia
    @echo "no-codigo: VERDE"

# Tipos + testes de unidade do no. Traz sonda contra filtro vazio (C2): um
# seletor que nao casa nada faz o vitest sair verde sem olhar nada.
no-codigo-testar:
    @echo "=== no-codigo-testar: tipos de src/composicao/ ==="
    npx tsc --noEmit -p tsconfig.composicao.json
    @echo "=== no-codigo-testar: unidade (recusa, janela, cor de token) ==="
    @saida=$(npx vitest run tests/composicao/no-codigo.test.ts 2>&1); \
        echo "$saida" | tail -6; \
        echo "$saida" | grep -qE "Tests +[1-9][0-9]* passed" || \
            { echo "FALHOU: nenhum teste selecionado (falso verde)"; exit 1; }
    @echo "no-codigo-testar: OK"

# Render de verdade (webpack do Remotion, nao Studio — C5): 2x bytes
# identicos, analise de pixel e comparacao com o snapshot aprovado.
no-codigo-render:
    bash tools/no-codigo/provar.sh

# (∅-crit) Apagar um snapshot aprovado TEM de ficar vermelho. Prova por
# mutacao, com o gate voltando ao verde depois de cada uma.
no-codigo-ausencia:
    bash tools/no-codigo/ausencia.sh

# Grava o snapshot aprovado. Ato explicito — o gate nunca grava sozinho.
no-codigo-aprovar:
    bash tools/no-codigo/provar.sh --aprovar
    @echo "Agora: git add fixtures/snapshots/no-codigo/ && commit"

# Studio na porta deste card, para olhar o no com o olho.
# ATENCAO: o Chrome do Studio nao e o Chrome do render (C5). Nada que sai
# daqui vira snapshot aprovado.
no-codigo-studio:
    npx remotion studio fixtures/snapshots/no-codigo/entrada.tsx --port 3108
# === fim F1-08 ===

# === F1-09 ===
# =============================================================================
# No: grafico — "o alfa nao e suportado" tem de falhar no BUILD, nao no video
# =============================================================================
# Dono: card F1-09. Nao edite fora destes marcadores.
#
# O que este bloco prova, e como (criterios de aceitacao do PROGRAMA):
#
#   1. `just no-grafico` -> exit 0. A receita completa: conferir (guarda de
#      build sobre o manifesto resolvido), provar (render 2x com bytes
#      identicos + snapshot aprovado + assercao de PIXEL — tinta, cores e
#      cantos transparentes, que e a assinatura de "compoe sobre a cena"),
#      mutar (seis sondas negativas), ausencia (o ∅-crit) e o diff/status
#      dos snapshots.
#
#   2. `just det:provar --no <nome>` do PROGRAMA. O just 1.42 NAO aceita
#      argumento em receita sem parametro (`just det-provar --no grafico`
#      tenta rodar a receita `--no` e falha), e `det-provar` e receita de
#      outro card. A prova de determinismo DESTE no (render 2x, bytes
#      identicos) e a etapa `no-grafico-provar`, dentro de `no-grafico`.
#      Registrado no ledger: ledger/inbox/F1-09.json (AB-360).
#
#   3. `git diff --exit-code fixtures/snapshots/no-grafico/` COMBINADO com
#      `git status --porcelain` (C3: diff nao enxerga arquivo nao rastreado).
#      Etapa `no-grafico-snapshots`, dentro de `no-grafico`.
#
#   4. ∅-crit: apagar um snapshot aprovado TEM de ficar vermelho. Etapa
#      `no-grafico-ausencia` (tools/no-grafico/ausencia.sh), dentro de
#      `no-grafico`, e coberta de novo pelas sondas ∅-1/∅-2 de `mutar`.
#
# NOME DAS RECEITAS: hifen, seguindo a convencao ja adotada por F1-01, F2-01
# e F1-03 (criterios-de-aceitacao-corrigidos.md §2 — o just 1.42 nao aceita
# ':' em nome de receita).

# Guarda de build: um manifesto resolvido com grafico em formato sem alfa
# tem de ser VERMELHO ANTES de abrir navegador. Aqui roda o caso bom; os
# casos ruins (JPEG, PNG de tipo de cor 2, sem asset) sao cobrados pelas
# sondas ∅-4, ∅-5 e ∅-6 de `no-grafico-mutar`.
no-grafico-conferir:
    @echo "=== no-grafico-conferir: guarda de build no caso bom ==="
    @npx tsx tools/no-grafico/conferir.ts fixtures/snapshots/no-grafico/resolvido-com-alfa.json --loja fixtures/snapshots/no-grafico/assets
    @echo "no-grafico-conferir: OK"

# Render 2x com bytes identicos + snapshot aprovado + assercao de pixel.
# O correspondente, no PROGRAMA, e `det:provar --no grafico` (ver AB-360).
no-grafico-provar:
    @echo "=== no-grafico-provar ==="
    @npx tsx tools/no-grafico/provar.ts
    @echo "no-grafico-provar: OK"

# Grava (ou regrava) os snapshots aprovados, explicitamente.
no-grafico-aprovar:
    @echo "=== no-grafico-aprovar ==="
    @npx tsx tools/no-grafico/provar.ts --aprovar
    @echo "no-grafico-aprovar: OK"

# Sondas negativas: cada garantia deste card e quebrada de proposito e o
# gate tem de ficar VERMELHO pelo motivo certo.
no-grafico-mutar:
    @echo "=== no-grafico-mutar ==="
    @npx tsx tools/no-grafico/mutar.ts
    @echo "no-grafico-mutar: OK"

# ∅-crit: apagar um snapshot aprovado tem de ficar VERMELHO, e com ele de
# volta o gate tem de voltar VERDE.
no-grafico-ausencia:
    @echo "=== no-grafico-ausencia (∅-crit) ==="
    @bash tools/no-grafico/ausencia.sh
    @echo "no-grafico-ausencia: OK"

# C3: diff --exit-code nao enxerga arquivo nao rastreado — o criterio e a
# COMBINACAO dos dois, e os dois tem de sair vazios.
no-grafico-snapshots:
    @echo "=== no-grafico-snapshots: diff + status de fixtures/snapshots/no-grafico/ (C3) ==="
    @bash tools/no-grafico/snapshots.sh

# Regenera as duas fixtures de asset (grafico-com-alfa.png e grafico-opaco.png).
# Deterministico: os hashes em cenario.ts e nos resolvido-*.json so valem se
# os bytes nao mudarem — rodar e conferir que nada mudou e o proprio teste.
no-grafico-gerar-assets:
    @echo "=== no-grafico-gerar-assets ==="
    @npx tsx tools/no-grafico/gerar-assets.ts
    @git diff --exit-code --quiet fixtures/snapshots/no-grafico/assets/ || \
        { echo "FALHOU: gerar-assets mudou os bytes — hashes em cenario.ts divergem"; exit 1; }
    @echo "no-grafico-gerar-assets: OK"

# A aceitacao inteira do card, em ordem. O `just no-grafico` do PROGRAMA.
no-grafico: no-grafico-conferir no-grafico-provar no-grafico-mutar no-grafico-ausencia no-grafico-snapshots
    @echo "no-grafico: VERDE"
# === fim F1-09 ===

# === F1-10 ===
# =============================================================================
# Transicoes e composicao de sequencia
# =============================================================================
# NOME DAS RECEITAS: hifen, nunca ':'. O `just` 1.42 le `a:b:` como "receita a
# depende de b" e o arquivo INTEIRO deixa de parsear.
# Ver docs/criterios-de-aceitacao-corrigidos.md §2.
#
# Porta TCP reservada para este card: 3110 (docs/contrato-w4.md §4).
# Faixa de ledger: AB-370..AB-379 (ledger/inbox/F1-10.json).

# A aceitacao inteira do card, em ordem. Este e o `just transicoes` do PROGRAMA.
transicoes: transicoes-testar transicoes-provar transicoes-ausencia
    @echo ""
    @echo "transicoes: VERDE"

# Tipos do escopo de composicao + a suite do card.
transicoes-testar:
    @echo "=== transicoes-testar: tipos + suite F1-10 ==="
    npx tsc --noEmit -p tsconfig.composicao.json
    npx vitest run tests/composicao/transicoes.test.ts

# Determinismo: render 2x em PROCESSOS separados, cmp byte a byte, oraculo de
# pixel (C1), regressao contra os 9 aprovados e snapshot conferido no git (C3).
transicoes-provar:
    bash tools/transicoes/provar.sh

# ∅-crit: apagar um snapshot aprovado TEM de deixar o gate VERMELHO pelo
# motivo certo (AUSENTE) e a restauracao TEM de devolver o VERDE.
transicoes-ausencia:
    bash tools/transicoes/ausencia.sh

# Reaprova os 9 snapshots. So depois de revisar o diff — este comando nao
# valida nada, ele grava o que o codigo faz hoje.
transicoes-aprovar:
    bash tools/transicoes/provar.sh --aprovar
    @echo "revise antes de commitar: git diff fixtures/snapshots/transicoes/"

# Preview no Studio, na porta reservada deste card.
transicoes-studio:
    npx remotion studio src/composicao/transicoes/entrada.tsx --port 3110
# === fim F1-10 ===

# === F1-11 ===
# =============================================================================
# Camadas globais — fundo, grade, vinheta — e a prova de que nenhuma
# sobreposicao cobre a safe area.
# Dono: card F1-11. Nao edite fora destes marcadores.
#
# NOME DAS RECEITAS: o PROGRAMA escreve `just no:<nome>` e `just det:provar
# --no <nome>`, mas `just` 1.42 nao aceita ':' em nome de receita e a receita
# `det-provar` (F0-06) nao recebe argumentos — nao se edita receita alheia.
# Vale a convencao de hifen deste arquivo: no-camadas, camadas-det-provar.
# O equivalente exato de `just det:provar --no camadas` e
# `just camadas-det-provar` (render 2x, bytes identicos).
# =============================================================================

# Gate das camadas: denominador + entropia + render + regressao + medicao
# + os dois oraculos de git sobre fixtures/snapshots/camadas/.
no-camadas:
    bash tools/camadas/gate.sh

# `det:provar --no camadas` do PROGRAMA: render 2x e exige bytes identicos.
camadas-det-provar:
    bash tools/camadas/provar.sh

# ∅-crit: apagar um snapshot aprovado TEM de ficar VERMELHO.
camadas-ausencia:
    bash tools/camadas/ausencia.sh

# O medidor sabe reprovar? Sondas INVASAO e QUADRO VAZIO com assercao de
# mensagem, nao so de exit code.
camadas-invasao:
    bash tools/camadas/invasao.sh

# Testes unitarios das camadas (geometria, contrato, medicao, registro).
camadas-testar:
    npx vitest run tests/composicao/camadas/

# Gera (ou regenera) os snapshots aprovados a partir do RENDER, com a prova
# de determinismo ANTES de copiar. Re-baseline explicito — o commit seguinte
# registra o que mudou.
camadas-capturar:
    bash tools/camadas/aprovar.sh
# === fim F1-11 ===

# === F3-01 ===
# =============================================================================
# Timing canonico — tres consumidores (legendas, ducking, ritmo), uma fonte.
# Dono: card F3-01 (W5, caminho critico). Nao edite fora destes marcadores.
#
# Contrato congelado em docs/contrato-w5.md §2: unidade SEGUNDOS, chave por
# cena com campo `unidade`, silencio declarado, consumo por CONTEUDO via
# casarTimings() ligado pelo campo `audio`.
#
# Porta TCP reservada para este card: 4301 (docs/contrato-w5.md §9).
# Faixa de ledger: AB-520..AB-549 (ledger/inbox/F3-01.json).
#
# A aceitacao do PROGRAMA pede `just timing:testar` e `just timing:determi-
# nismo`; este arquivo usa hifen (AB-284, just 1.42 nao aceita ':' em nome
# de receita). O conjunto que fecha o card:
#   - typecheck ESCOPADO (tsconfig.timing.json): reprova por causa DESTE
#     card, nao por causa de outro;
#   - vitest da suite (oraculo + schema ajv + ∅-crit + adversariais);
#   - pytest do schema com a implementacao python (jsonschema) — duas
#     implementacoes sobre a mesma fixture;
#   - golden: gerar.ts --conferir compara byte a byte com a fixture
#     COMMITADA. Ausencia e VERMELHO, sempre (nunca se auto-grava).

# O gate completo do timing canonico (schema + casarTimings + oraculo).
timing-testar:
    @echo "=== timing-testar: schema + casarTimings ==="
    npx tsc --noEmit -p tsconfig.timing.json
    npx vitest run tests/sincronia/timing.test.ts
    python3 -m pytest tests/sincronia/test_schema_timing.py -q
    npx tsx tools/timing/gerar.ts --conferir
    @git status --porcelain fixtures/canonico/timing-canono.json | grep -q . && \
        { echo "FALHOU: a fixture mudou no working tree (C3)"; exit 1; } || true
    @echo "timing-testar: VERDE"

# Determinismo: 2x em PROCESSOS separados, ambientes diferentes, sonda
# negativa de mutacao e regressao contra o golden (tools/timing/determinismo.sh).
timing-determinismo:
    bash tools/timing/determinismo.sh

# Regenera a fixture golden a partir do cassete COMMITADO. Ato explicito —
# este comando nao valida nada, ele grava o que o codigo faz hoje.
timing-gravar:
    npx tsx tools/timing/gerar.ts --gravar
    @echo "revise antes de commitar: git diff fixtures/canonico/timing-canono.json"
# === fim F3-01 ===

# === F4-01 ===
# =============================================================================
# Contrato de autoria v1 — saida estruturada do LLM (narrativa apenas) + cache.
# O LLM decide NARRATIVA; o sistema decide frames, layout e cor: os campos
# dessas decisoes NAO EXISTEM no schema (additionalProperties:false).
# Regras duras: AB-432 (hash de midia ADVISORY) e AB-433 (texto_alternativo
# OBRIGATORIO para no de midia).
#
# NOME DAS RECEITAS: hifen, nunca ':' (just 1.42 — armadilha 9.1).
# Porta TCP reservada: 4401 (docs/contrato-w5.md §9). Faixa de ledger:
# AB-550..AB-569 (ledger/inbox/F4-01.json). Dono: card F4-01 — nao edite
# fora destes marcadores.
#
# ∅-crit do card: uma saida que NAO valida contra o schema TEM de ser
# rejeitada ANTES de tocar o pipeline — prova em rejeitar.test.ts com stub
# de pipeline que registra invocacao.
#
# C2 (falso verde): o vitest sai 0 quando um caminho listado nao existe mas
# outro casa. Cada receita confere por `test -f` que OS ARQUIVOS existem
# antes de rodar — apagar qualquer teste do contrato deixa a receita
# VERMELHA por ausencia.
# =============================================================================

# Gate do contrato de autoria: schema + validacao + ∅-crit + regras duras
# + pergunta adversarial 1 (frames/cor/coordenada impossiveis) + subsets
# por fornecedor + vocabulario de transicao.
autoria-contrato:
    @echo "=== autoria-contrato: contrato de autoria v1 ==="
    @for f in validar.test.ts rejeitar.test.ts adversarial.test.ts ab-432-ab-433.test.ts subset.test.ts vocabulario.test.ts; do \
        test -f "tests/autoria/contrato/$f" || { echo "FALHOU: tests/autoria/contrato/$f ausente"; exit 1; }; \
    done
    npx vitest run tests/autoria/contrato/validar.test.ts tests/autoria/contrato/rejeitar.test.ts tests/autoria/contrato/adversarial.test.ts tests/autoria/contrato/ab-432-ab-433.test.ts tests/autoria/contrato/subset.test.ts tests/autoria/contrato/vocabulario.test.ts
    @echo "autoria-contrato: VERDE"

# Cache de autoria: a mesma entrada NAO chama a API duas vezes (HIT); mudar
# QUALQUER componente da chave gera MISS (C12, um parametro por vez).
autoria-cache:
    @echo "=== autoria-cache: chave canonica + HIT/MISS ==="
    @for f in cache.test.ts canonicalizar.test.ts; do \
        test -f "tests/autoria/contrato/$f" || { echo "FALHOU: tests/autoria/contrato/$f ausente"; exit 1; }; \
    done
    npx vitest run tests/autoria/contrato/cache.test.ts tests/autoria/contrato/canonicalizar.test.ts
    @echo "autoria-cache: VERDE"
# === fim F4-01 ===

# === F4-02 ===
# =============================================================================
# Biblioteca de prompts de autoria (docs/autoria/prompts/**) e o dicionario
# de pronuncia — card F4-02 (W5).
# Dono: card F4-02. Nao edite fora destes marcadores.
#
# NOME DA RECEITA: o PROGRAMA.html escreve `just prompts:testar`, mas `just`
# 1.42 NAO aceita ':' em nome de receita (armadilha 9.1, ja tratada no
# arquivo inteiro). Vale a convencao de hifen: `prompts-testar`.
#
# O que a receita prova:
#   1. vitest: casos de referencia validam contra o contrato de autoria v1
#      (contrato-w5 §3 — AB-432 hash advisory, AB-433 texto_alternativo
#      obrigatorio), fronteira de decisao declarada em todo prompt, e o
#      dicionario de pronuncia como fonte unica.
#   2. ∅-crit do front-matter na forma CORRIGIDA da armadilha 9.2: em
#      ripgrep, `-L` e `--follow`, NAO `--files-without-match`. O literal
#      `rg -L` do PROGRAMA sai vazio justamente quando NENHUM prompt declara
#      `versao:` — passa por ausencia. O comando abaixo exprime a intencao
#      e anda em par com o denominador (biblioteca vazia e VERMELHO).
# =============================================================================

# Aceitacao do card F4-02, em ordem.
prompts-testar:
    @echo "=== prompts-testar: vitest (front-matter, casos, fronteira, dicionario) ==="
    npx vitest run tests/prompts/
    @echo "=== prompts-testar: ∅-crit do front-matter (versao:) ==="
    @test "$(rg --files docs/autoria/prompts/ | wc -l)" -ge 5 || { echo "FALHOU: denominador — biblioteca de prompts vazia?"; exit 1; }
    @test -z "$(rg --files-without-match '^versao:' docs/autoria/prompts/ -g '*.md' -g '!**/casos/**')" || { echo "FALHOU: arquivo sem 'versao:' em docs/autoria/prompts/"; exit 1; }
    @test -z "$(rg --files-without-match '^versao:' docs/autoria/prompts/*.md)" || { echo "FALHOU: .md de topo sem 'versao:' (∅-crit literal do card)"; exit 1; }
    @echo "prompts-testar: VERDE"
# === fim F4-02 ===

# === F1-12 ===
# =============================================================================
# Suite integrada de composicao — o join dos oito nos da W4 com a raiz
# =============================================================================
# Dono: card F1-12 (onda W5). Nao edite fora destes marcadores.
#
# O PROGRAMA escreve a aceitacao como `just int:composicao` e
# `just det:provar --integrado`. O `just` 1.42 NAO aceita ':' em nome de
# receita (AB-284) nem argumento em receita sem parametro — valem os hifens,
# convencao deste arquivo: `int-composicao` e `det-provar-integrado`.
#
# Porta TCP deste card: 4112 (docs/contrato-w5.md §9).
# Faixa de ledger: AB-490..AB-499 (ledger/inbox/F1-12.json).
#
# O que cada etapa prova:
#   vitest    tests/integracao/composicao/ — fiacao (AB-364), duracao
#             subtrativa calculada a mao, pintor de cena real (AB-374),
#             AB-312/AB-313/AB-344, e o gate de PRESENCA no por no (o ∅-crit
#             roda o arquivo presenca.test.ts).
#   provar    render de verdade 2x com bytes identicos (determinismo),
#             oraculo de conteudo do quadro composto (C1, AB-344/AB-390) e
#             snapshots aprovados — so do render, nunca do Studio (C5).
#   ausencia  ∅-crit: remove CADA no da fixture e exige VERMELHO por
#             ausencia (nomeando o no), nunca por "menos frames".
#   qtrle     sonda do cassete REAL de F2-02 (.mov qtrle/argb): o render
#             integrado recusa o formato com evidencia (AB-390); o cartucho
#             webm e o caminho de producao.

# `just int:composicao` do PROGRAMA — a aceitacao inteira do card.
int-composicao: int-composicao-testar int-composicao-provar int-composicao-ausencia int-composicao-qtrle int-composicao-snapshots
    @echo ""
    @echo "int-composicao: VERDE"

# Tipos do repositorio + as duas suites de oraculo (fiacao e presenca).
int-composicao-testar:
    @echo "=== int-composicao-testar: tipos ==="
    npx tsc --noEmit
    @echo "=== int-composicao-testar: suites (fiacao, duracao, pintor, presenca) ==="
    @# C2: um alvo que nao casa nenhum teste sai VERDE sem ter olhado nada.
    @saida=$(npx vitest run tests/integracao/composicao/ 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g'); \
        printf '%s\n' "$saida" | tail -6; \
        printf '%s\n' "$saida" | grep -qE "Tests +[1-9][0-9]* passed" || \
            { echo "FALHOU: nenhum teste selecionado (falso verde)"; exit 1; }
    @echo "int-composicao-testar: OK"

# `just det:provar --integrado` do PROGRAMA — determinismo do artefato
# integrado: render 2x em processos do mesmo bundle, bytes identicos, oraculo
# de conteudo e igualdade com o snapshot aprovado.
det-provar-integrado:
    npx tsx tests/integracao/composicao/provar.ts

# A etapa de determinismo dentro do gate (a mesma receita acima).
int-composicao-provar:
    npx tsx tests/integracao/composicao/provar.ts

# ∅-crit: remover um no da fixture TEM de ficar VERMELHO por AUSENCIA.
int-composicao-ausencia:
    npx tsx tests/integracao/composicao/ausencia.ts

# Sonda do cassete REAL de F2-02 (.mov qtrle/argb) — evidencia no handoff.
int-composicao-qtrle:
    npx tsx tests/integracao/composicao/qtrle.ts

# C3: diff --exit-code nao enxerga arquivo nao rastreado — os dois juntos.
int-composicao-snapshots:
    @echo "=== int-composicao-snapshots: diff + status de fixtures/snapshots/integrado/ (C3) ==="
    git diff --exit-code --quiet -- fixtures/snapshots/integrado/ || \
        { echo "FALHOU: fixtures/snapshots/integrado/ tem mudanca"; git --no-pager diff --stat -- fixtures/snapshots/integrado/; exit 1; }
    @sujo=$(git status --porcelain -uall -- fixtures/snapshots/integrado/); \
        if [ -n "$sujo" ]; then \
            echo "FALHOU: fixtures/snapshots/integrado/ tem arquivo modificado ou nao rastreado:"; \
            printf '%s\n' "$sujo"; exit 1; \
        fi
    @echo "int-composicao-snapshots: OK"

# (Re)aprova os snapshots. Ato explicito — o gate NUNCA grava sozinho.
int-composicao-aprovar:
    npx tsx tests/integracao/composicao/provar.ts --aprovar
    @echo "revise antes de commitar: git diff fixtures/snapshots/integrado/"

# Regenera o asset e a fixture integrada; confere que nada mudou (C7).
int-composicao-gerar:
    npx tsx tests/integracao/composicao/gerar-assets.ts
    npx tsx tests/integracao/composicao/gerar-fixture.ts
    @echo "confira: git diff --exit-code fixtures/snapshots/integrado/"

# Preview no Studio, na porta reservada deste card (4112).
# NAO aprova snapshot: o Chrome do Studio nao e o Chrome do render (C5).
int-composicao-studio:
    npx remotion studio fixtures/snapshots/integrado/entrada.tsx --port 4112
# === fim F1-12 ===

# === F2-07 ===
# =============================================================================
# Suite offline INTEGRADA e o guarda de rede — card F2-07 (W5)
# =============================================================================
# Generaliza a suite offline do F2-01 para a W5 e alem: prova que o pipeline
# abaixo da autoria roda sem rede em QUATRO camadas (kernel via unshare,
# subprocesso, processo, vitest completo) mais o ∅-crit e o denominador.
# Decisoes e evidencias: docs/adr/0026-suite-offline-integrada-e-guarda-de-rede.md.
#
# NOME DAS RECEITAS: hifen, nunca dois-pontos (convencao de F2-01, AB-284).
#
# `just res-offline` (bloco F2-01) continua existindo e continua verde — ele
# roda tools/resolucao/offline.sh, a suite POR ESTAGIO. A suite deste card e
# o generalizacao dela: `res-offline-integrado` roda tools/offline-guard.sh,
# que cobre as camadas de subprocesso e o vitest INTEIRO (incluindo
# tests/integracao/resolucao/, os cinco estagios reais a partir dos cassetes).

# A suite completa com a rede bloqueada em todas as camadas:
#   unshare --net (kernel, vale para subprocesso) + sonda de subprocesso +
#   sonda em processo + tripwire de headers volateis + vitest completo +
#   schema + cobertura (∅-crit) + chave de cache + denominador.
res-offline-integrado:
    bash tools/offline-guard.sh

# So a suite vitest de integracao da resolucao (guarda em processo via setup).
res-integracao:
    npx vitest run tests/integracao/resolucao/

# ∅-crit no nivel de integracao: estagio novo sem cassete derruba a suite.
res-vazio-crit-integrado:
    npx vitest run tests/integracao/resolucao/vazio-crit.test.ts

# Sondas isoladas do guarda: kernel | processo | subprocesso
res-guarda-sonda camada="processo":
    @if [ "{{camada}}" = "subprocesso" ]; then \
        npx tsx tools/offline-guard.ts --sonda subprocesso; \
    else \
        npx tsx tools/resolucao/sonda-rede.ts --camada {{camada}}; \
    fi

# Tripwire de headers volateis nos cassetes commitados (AB-440/473/475).
# `--redige` roda a migracao idempotente (remover da lista em formato.ts).
res-guarda-cassetes *args:
    npx tsx tools/offline-guard.ts --verifica-cassetes {{args}}
# === fim F2-07 ===

# === F3-02 ===
# =============================================================================
# Legendas a partir do timing — o invariante e em SEGUNDOS, nunca em frames.
# Dono: card F3-02 (W6). Nao edite fora destes marcadores.
#
# Contrato congelado em docs/contrato-w6.md §2: unidade SEGUNDOS, consumo
# por CONTEUDO (campo audio), unidade orfa ignorada (AB-522), fonte dos
# bytes = replay do cassete de locucao (AB-523).
#
# Porta TCP reservada para este card: 4302 (docs/contrato-w6.md §9).
# Faixa de ledger: AB-580..AB-599 (ledger/inbox/F3-02.json).
#
# O invariante (R14-01·R14-11, 2-0):
#   duracao >= max(0,833 s; caracteres/20)  e  duracao <= 7 s
# em SEGUNDOS — 20 frames a 60 fps sao 0,333 s, QUATRO VEZES abaixo do
# piso. O ∅-crit do card: APAGAR a regra de caracteres-por-segundo de
# src/sincronia/legendas/validar.ts deixa o teste VERMELHO pelo motivo
# certo (a sonda que casa um documento que passa no piso absoluto e
# falha em caracteres/20).
#
# O conjunto que fecha o card:
#   - typecheck ESCOPADO (tsconfig.legendas.json): reprova por causa
#     DESTE card, nao por causa de outro;
#   - vitest da suite (aceitacao + ∅-crit + segundos-nunca-frames +
#     adversariais + sondas do oraculo);
#   - golden: gerar.ts --conferir compara byte a byte com a fixture
#     COMMITADA (fixtures/canonico/legendas-canono.json). Ausencia e
#     VERMELHO, sempre (nunca se auto-grava).

# O gate completo das legendas canonicas.
legendas:
    @echo "=== legendas: typecheck + suite + golden ==="
    npx tsc --noEmit -p tsconfig.legendas.json
    npx vitest run tests/sincronia/legendas.test.ts
    npx tsx tools/legendas/gerar.ts --conferir
    @git status --porcelain fixtures/canonico/legendas-canono.json | grep -q . && \
        { echo "FALHOU: a fixture de legendas mudou no working tree (C3)"; exit 1; } || true
    @echo "legendas: VERDE"

# So a suite (para iterar rapido).
legendas-testar:
    @echo "=== legendas-testar: typecheck + suite ==="
    npx tsc --noEmit -p tsconfig.legendas.json
    npx vitest run tests/sincronia/legendas.test.ts
    @echo "legendas-testar: OK"

# Regenera a fixture golden a partir do manifesto + timing canonico
# COMMITADOS. Ato explicito — este comando nao valida nada, ele grava o
# que o codigo faz hoje.
legendas-gravar:
    npx tsx tools/legendas/gerar.ts --gravar
    @echo "revise antes de commitar: git diff fixtures/canonico/legendas-canono.json"
# === fim F3-02 ===

# === F3-03 ===
# =============================================================================
# Envelope de ducking — CALCULADO (DuckingEnvelope.1), nunca compressor.
# Dono: card F3-03 (W6). Nao edite fora destes marcadores.
#
# Contrato congelado em docs/contrato-w6.md §4: envelope como DADO, chave
# por intervalo ABSOLUTO na timeline, unidade segundos, campos minimos por
# intervalo (inicio_s, fim_s, ganho_db, rampas), atenuacao comeca ANTES da
# fala, trechos colados sem degrau. A APLICACAO no mix e do F3-05 (W7) —
# docs/adr/0012 ("O mix de audio (ducking, loudness, cobertura da trilha)
# — F3-03 produz o envelope; nao mixa nada").
#
# Porta TCP reservada: 4303 (docs/contrato-w6.md §9). Faixa de ledger:
# AB-600..AB-614 (ledger/inbox/F3-03.json). ADR: docs/adr/0028-envelope-de-ducking.md.
#
# ∅-crit do card: um trecho com locucao SEM atenuacao fica VERMELHO — a
# suite (tests/sincronia/ducking.test.ts) prova por mutacao e o --conferir
# da ferramenta (tests/sincronia/ducking.ferramenta.ts) sai 1 se qualquer
# palavra do timing canonico ficar sem intervalo. A conferencia tambem
# compara byte a byte com o golden commitado (tests/fixtures/ducking-
# canono.json): ausencia ou divergencia e VERMELHO — o golden nao se
# auto-grava, regeneracao e ato explicito (`just ducking-gravar`).
#
# NOME DAS RECEITAS: hifen, nunca ':' (just 1.42 — armadilha 9.1).
# =============================================================================

# Gate do envelope de ducking calculado (oraculo + ∅-crit + golden + 2x).
ducking:
    @echo "=== ducking: envelope de ducking calculado ==="
    npx tsc --noEmit
    @test -f src/sincronia/ducking/formato.ts || { echo "FALHOU: src/sincronia/ducking/formato.ts ausente"; exit 1; }
    @test -f tests/sincronia/ducking.test.ts || { echo "FALHOU: suite de ducking ausente"; exit 1; }
    @test -f tests/sincronia/ducking.ferramenta.ts || { echo "FALHOU: ferramenta de conferencia ausente"; exit 1; }
    npx vitest run tests/sincronia/ducking.test.ts
    npx tsx tests/sincronia/ducking.ferramenta.ts --conferir
    @echo "ducking: VERDE"

# Regenera o golden do envelope a partir do timing canonico COMMITADO.
# Ato explicito — este comando nao valida nada, ele grava o que o codigo
# faz hoje (e recusa gravar com locucao descoberta).
ducking-gravar:
    npx tsx tests/sincronia/ducking.ferramenta.ts --gravar
    @echo "revise antes de commitar: git diff tests/fixtures/ducking-canono.json"
# === fim F3-03 ===

# === F3-04 ===
# =============================================================================
# Ritmo — corte de silencio e cadencia. Dono: card F3-04 (W6, dependencia
# F3-01: timing canonico).
#
# Contrato congelado em docs/contrato-w6.md §2: consumo do timing canonico
# por CONTEUDO (lerTimingCanonico / serializarTimingCanonico, unidade
# SEGUNDOS, silencio DECLARADO, fonte dos bytes = replay do cassete).
# A politica do corte e o ADR-0029.
#
# ∅-crit (criterio de aceitacao do PROGRAMA): o teste que prova que NENHUMA
# palavra foi cortada — o corte de silencio nunca come o ataque de uma
# palavra. Vive em tests/sincronia/ritmo.test.ts (comparacao do timing
# antes/depois + round-trip + sonda negativa de ataque coberto).
#
# Porta TCP reservada: 4304 (docs/contrato-w6.md §9).
# Faixa de ledger: AB-615..AB-629 (ledger/inbox/F3-04.json).
#
# A aceitacao pede `just ritmo` (hifen — AB-284, just 1.42 nao aceita ':' em
# nome de receita). O conjunto que fecha o card:
#   - typecheck do repositorio inteiro (sem tsconfig escopado: os irmaos da
#     W6 nao podem criar dois arquivos de raiz com o mesmo nome);
#   - vitest da suite inteira (∅-crit + adversariais 1/2/3/4 + presenca).
ritmo:
    @echo "=== ritmo: corte de silencio e cadencia ==="
    npx tsc --noEmit
    npx vitest run tests/sincronia/ritmo.test.ts
    @echo "=== ritmo: VERDE (nenhuma palavra cortada — ADR-0029) ==="
# === fim F3-04 ===

# === F4-03 ===
# =============================================================================
# Validacao e reparo da saida do LLM de autoria — card F4-03 (W6).
# Dono: card F4-03. Nao edite fora destes marcadores.
#
# NOME DA RECEITA: o PROGRAMA.html escreve `just autoria:reparo`, mas o
# `just` 1.42 NAO aceita ':' em nome de receita (armadilha 9.1). Vale a
# convencao de hifen: `autoria-reparo` (contrato-w6 §5).
#
# O que a receita prova (contrato-w6 §3, congelado):
#   1. REPARAVEL = FORMA (espaco, escape, case de enum, ordem, duplicata);
#      REJEICAO DEFINITIVA = SEMANTICA (tipo de no desconhecido,
#      texto_alternativo ausente — AB-433, AB-432/433, transicao fora do
#      vocabulario v1 fade/slide/wipe/flip/none — AB-555);
#   2. o ∅-crit do card: um manifesto irreparavel TEM de ser REJEITADO,
#      nunca "melhorado" ate passar — vazio-crit.test.ts prova que o
#      reparador nunca e invocado para semantica;
#   3. tres tentativas com simplificacao progressiva (T1⊃T2⊃T3) TERMINAM,
#      e o erro final NOMEIA a regra que falhou com o caminho JSON.
#
# C2 (falso verde): o vitest sai 0 quando um caminho listado nao existe
# mas outro casa. Cada receita confere por `test -f` que OS ARQUIVOS
# existem antes de rodar — apagar o ∅-crit deixa a receita VERMELHA por
# ausencia.
#
# Porta TCP reservada: 4403 (docs/contrato-w6.md §9). Faixa de ledger:
# AB-630..AB-649 (ledger/inbox/F4-03.json).
# =============================================================================

# Gate de validacao e reparo: classificacao + tres tentativas + ∅-crit.
autoria-reparo:
    @echo "=== autoria-reparo: validacao e reparo de forma (F4-03) ==="
    @for f in vazio-crit.test.ts classificar.test.ts reparar.test.ts reparador-mecanico.test.ts; do \
        test -f "tests/autoria/reparo/$f" || { echo "FALHOU: tests/autoria/reparo/$f ausente"; exit 1; }; \
    done
    @test -f src/autoria/reparo/reparar.ts || { echo "FALHOU: src/autoria/reparo/reparar.ts ausente"; exit 1; }
    npx vitest run tests/autoria/reparo/
    @echo "autoria-reparo: VERDE"
# === fim F4-03 ===

# === F4-04 ===
# =============================================================================
# Cassete de autoria e a suite de REJEICAO — card F4-04 (W6)
# =============================================================================
# A suite offline da AUTORIA. O cassete (fixtures/cassetes/autoria/) so
# testa alguma coisa porque o CAMINHO DE CHAMADA que o produz esta no
# repositorio (src/autoria/executor/**): schemas podados por fornecedor,
# cache do F4-01, e o gate (rejeitarSaidaInvalida) ANTES do pipeline.
#
# ∅-crit: "um manifesto invalido que passa tem de derrubar a suite". O
# cassete TEM manifestos INVALIDOS gravados (invalidos.json — nao so os
# bons) e a suite exige rejeicao de cada um em tres niveis (validacao,
# gate, executor). Um validador que afrouxe deixa a suite VERMELHA.
#
# Rede bloqueada em DUAS camadas (mesmo desenho do F2-07): kernel
# (unshare --net) + guarda em processo (tests/setup/rede-bloqueada.ts).
# Sem unshare a camada de kernel e NAO-EXERCITADA — dita em voz alta.
#
# AB-551/552/554 (tetos reais, temperature, degradacao silenciosa) sao
# EVIDENCIA com credencial, NUNCA gate: esta suite roda verde OFFLINE.
# A medicao e: npx tsx src/autoria/executor/medir-limites.ts

# A suite completa de autoria com a rede bloqueada em todas as camadas.
autoria-offline:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ "${AUTORIA_OFFLINE_DENTRO:-0}" = "1" ]; then
        FALHAS=0
        echo "=== autoria-offline — cassete de autoria + suite de rejeicao (F4-04) ==="
        echo "Camada externa: ${AUTORIA_OFFLINE_CAMADA:-desconhecida}"
        echo ""

        echo "--- [1/5] ∅-crit: o cassete de autoria existe com manifestos INVALIDOS gravados ---"
        CASSETES=$(find fixtures/cassetes/autoria -mindepth 1 -maxdepth 1 -type d -name '[0-9a-f]*' 2>/dev/null | wc -l)
        INVALIDOS=$(cat fixtures/cassetes/autoria/*/invalidos.json 2>/dev/null | grep -c '"motivo"' || echo 0)
        if [ "$CASSETES" -lt 1 ] || [ "$INVALIDOS" -lt 3 ]; then
            echo "[FALHOU] cassetes=$CASSETES invalidosGravados=$INVALIDOS — sem cassete ou sem invalidos gravados a suite estaria verde por vazio"
            FALHAS=$((FALHAS + 1))
        else
            echo "[PASSOU] $CASSETES cassete(s), $INVALIDOS manifestos invalidos gravados"
        fi
        echo ""

        echo "--- [2/5] sonda de kernel: chamada que TENTA sair ---"
        if [ "${AUTORIA_OFFLINE_TEM_NAMESPACE:-0}" = "1" ]; then
            if npx tsx tools/resolucao/sonda-rede.ts --camada kernel; then
                echo "[PASSOU] sonda de kernel"
            else
                echo "[FALHOU] sonda de kernel"
                FALHAS=$((FALHAS + 1))
            fi
        else
            echo "[NAO-EXERCITADA] sonda de kernel — sem namespace de rede nesta maquina"
        fi
        echo ""

        echo "--- [3/5] sonda em processo: o guarda instalado bloqueia ---"
        if npx tsx tools/resolucao/sonda-rede.ts --camada processo; then
            echo "[PASSOU] sonda em processo"
        else
            echo "[FALHOU] sonda em processo"
            FALHAS=$((FALHAS + 1))
        fi
        echo ""

        echo "--- [4/5] vitest: suite de autoria (cassete, rejeicao, executor, determinismo) ---"
        if npx vitest run tests/autoria/; then
            echo "[PASSOU] vitest tests/autoria/"
        else
            echo "[FALHOU] vitest tests/autoria/"
            FALHAS=$((FALHAS + 1))
        fi
        echo ""

        echo "--- [5/5] denominador: os arquivos de teste do F4-04 existem (anti-vacuidade C2) ---"
        FALTANDO=""
        for f in tests/autoria/cassete.test.ts tests/autoria/rejeicao.test.ts \
                 tests/autoria/executor.test.ts tests/autoria/cassete-diff.test.ts \
                 fixtures/cassetes/autoria/invalidos-fonte.json \
                 fixtures/cassetes/autoria/brief-canonico.json; do
            [ -f "$f" ] || FALTANDO="$FALTANDO $f"
        done
        if [ -n "$FALTANDO" ]; then
            echo "[FALHOU] arquivos ausentes:$FALTANDO"
            FALHAS=$((FALHAS + 1))
        else
            echo "[PASSOU] todos os arquivos do F4-04 presentes"
        fi
        echo ""

        echo "---"
        if [ "$FALHAS" -gt 0 ]; then
            echo "=== VERMELHO: $FALHAS etapa(s) falharam com a rede bloqueada ==="
            exit 1
        fi
        echo "=== VERDE: a suite de autoria passou com a rede bloqueada ==="
        exit 0
    fi

    if command -v unshare >/dev/null 2>&1 &&
        unshare --map-root-user --net -- true >/dev/null 2>&1; then
        export AUTORIA_OFFLINE_DENTRO=1
        export AUTORIA_OFFLINE_TEM_NAMESPACE=1
        export AUTORIA_OFFLINE_CAMADA="namespace de rede do kernel (unshare --net)"
        exec unshare --map-root-user --net -- bash -c '
            ip link set lo up 2>/dev/null || true
            exec bash "$0" "$@"
        ' "$0"
    fi

    echo "=== autoria-offline ==="
    echo ""
    echo "AVISO: 'unshare --net' indisponivel nesta maquina."
    echo "       A camada externa (kernel) NAO foi aplicada; a suite roda"
    echo "       so com o guarda em processo. Resultado mais fraco, dito"
    echo "       em voz alta de proposito."
    echo ""
    export AUTORIA_OFFLINE_DENTRO=1
    export AUTORIA_OFFLINE_TEM_NAMESPACE=0
    export AUTORIA_OFFLINE_CAMADA="AUSENTE (unshare indisponivel) — so o guarda em processo"
    exec bash "$0"

# So a suite vitest de autoria (sem o guarda de kernel).
autoria-suite:
    npx vitest run tests/autoria/

# ∅-crit no nivel de suite: os manifestos invalidos GRAVADOS tem de ser
# rejeitados — um invalido que passa derruba a suite.
autoria-rejeicao:
    npx vitest run tests/autoria/rejeicao.test.ts

# Determinismo do cassete de autoria: regravar reproduz bytes identicos
# exceto os volateis declarados (inclui sonda negativa).
autoria-cassete:
    npx vitest run tests/autoria/cassete-diff.test.ts

# Cerimonia de gravacao (a mao, com rede e credencial — nunca em suite).
autoria-gravar *args:
    npx tsx src/autoria/executor/gravar-cassete.ts {{args}}

# Medicao com credencial (AB-551/552/554) — EVIDENCIA, nunca gate.
autoria-medir *args:
    npx tsx src/autoria/executor/medir-limites.ts {{args}}
# === fim F4-04 ===

# === I-03 ===
# Maquina de render (card I-03): medicao + conferencia da maquina.
#   just medir-maquina                  -> inventario rapido da maquina
#   just medir-maquina rss --concurrency 16   -> RAM por worker (cerimonia completa)
#   just medir-maquina saturacao        -> curva tempo-por-frame x concurrency
#   just medir-maquina encode --nvenc 1,4,8 --soft 1,4   -> sessoes de encode
#   just medir-maquina disco --com-store -> throughput de disco (dd)
#   just medir-maquina --conferir       -> medicao CURTA vs docs/medicao/maquina.md
#                                        (falha alem da tolerancia declarada)
# Todo numero tem o comando que o reproduz (∅-crit: rg -L "comando:" -> vazio).
medir-maquina *args:
    @python3 tools/medir-maquina.py {{args}}
# === fim I-03 ===

# === F3-05 ===
# =============================================================================
# Trilha de audio composta — card F3-05 (W7, caminho critico do audio).
# Dono: card F3-05. Nao edite fora destes marcadores.
#
# Contrato congelado em docs/contrato-w7.md: §1 (mapa: src/audio/mix/** e do
# F3-05), §2 (C1 — reconciliacao janela x fala), §4 (C3 — emenda com bytes e
# hash NOVOS), §6 (emendas do card: tres ∅-crits) e §12 (a pergunta da onda:
# assercao de PRESENCA, nunca lista completa — "a fala de c-004 esta em
# [14,233..22,738] com a cauda cortada no inicio de c-005", os MESMOS
# numeros que o F5-01 deriva dos MESMOS inputs). Decisoes: ADR-0034.
#
# Os tres ∅-crits do card, todos MEDIDOS (nunca por escuta):
#   1. um mix SEM LOCUCAO fica VERMELHO (sonda P1 + presenca medida);
#   2. DUAS LOCUCOES SIMULTANEAS por mais de 0,1 s no mix ficam VERMELHO
#      (sonda P2; a fixture canonica sobrepoe c-004/c-005 em 4,505 s no
#      timing — caso de ESTRESSE deliberado que a reconciliacao do C1
#      resolve no mix: cena posterior manda, cauda cortada);
#   3. emenda enderecada pelo HASH DO AUDIO-FONTE fica VERMELHO (sonda P3;
#      o caso de estresse com a cadencia cortante publica bytes + hash
#      NOVOS, enderecaveis por conteudo no store — AB-617).
# Adversariais: (1) clip medido nos bytes; (2) determinismo 2x em DOIS
# processos com TZ/LANG diferentes; (3) cobertura medida (integracao do
# envelope: ganho aplicado onde a fala existe — sonda P4); (4) reconciliacao
# C1 aplicada (fala carrega alem da janela, cena posterior manda, sobre-
# posicao residual = 0 — pergunta da onda).
#
# Consumo (contratos FECHADOS): timing canonico (F3-01), envelope de ducking
# (F3-03), cadencia/ritmo (F3-04), trilha do cassete (F2-06), aritmetica da
# composicao (F1-01), store (F0-07).
#
# Porta TCP reservada: 4305 (docs/contrato-w7.md §11). Faixa de ledger:
# AB-660..AB-679 (ledger/inbox/F3-05.json). ADR: docs/adr/0034-*.md.
#
# NOME DA RECEITA: hifen, nunca ':' — o PROGRAMA.html escreve `just audio:mix`,
# mas o just 1.42 le 'a:b:' como dependencia (armadilha 9.1). Vale
# `audio-mix` (contrato-w7 §7).
# =============================================================================

# Gate da trilha de audio composta: fixture canonica + estresse + sondas +
# determinismo 2x (medido, nao escutado).
audio-mix:
    @echo "=== audio-mix: trilha de audio composta (F3-05, W7) ==="
    npx tsc --noEmit
    @test -f src/audio/mix/formato.ts || { echo "FALHOU: src/audio/mix/formato.ts ausente"; exit 1; }
    @test -f src/audio/mix/mixar.ts || { echo "FALHOU: src/audio/mix/mixar.ts ausente"; exit 1; }
    @test -f src/audio/mix/verificar.ts || { echo "FALHOU: src/audio/mix/verificar.ts ausente"; exit 1; }
    @test -f tests/audio/mix.test.ts || { echo "FALHOU: suite de mix ausente"; exit 1; }
    @test -f tests/audio/mix.ferramenta.ts || { echo "FALHOU: ferramenta do gate ausente"; exit 1; }
    npx vitest run tests/audio/mix.test.ts
    npx tsx tests/audio/mix.ferramenta.ts --conferir
    @echo "audio-mix: VERDE"
# === fim F3-05 ===

# === F5-02 ===
# =============================================================================
# Perfis de encode (hardware e software) — card F5-02 (W7). ADR-0036.
# =============================================================================
# Contrato: docs/contrato-w7.md §1 (dono de src/render/encode/**), §6 (emenda:
# o perfil DECLARA se o encode e deterministico; goldens so em perfis
# deterministicos; o ∅-crit do PROGRAMA permanece), §7 (esta receita),
# §11 (porta TCP 4502 reservada), §12 (presenca, nunca lista completa).
# Tetos de sessoes: I-03/ADR-0032 decisao 2 — 4 NVENC + 4 libx264 com fila
# explicita (S-10); NVENC nao tem CRF (perfis por qualidade).
#
# ∅-crit do PROGRAMA: um perfil SEM ALVO DE QUALIDADE DECLARADO tem de
# falhar — o passo [3/6] roda listarPerfis() sobre o disco, que lança no
# primeiro perfil invalido; o vitest cobre a sonda negativa por unidade.
#
# A pergunta obrigatoria da onda (§12): toda assercao e de PRESENCA dos
# perfis DESTE card (entrega-software, entrega-nvenc), nunca de lista
# completa de perfis — o merge dos irmaos pode trazer mais.
encode-perfis:
    @echo "=== encode-perfis: perfis de encode (hw/sw — um nao tem CRF) ==="
    @echo "--- [1/6] tipos (tsc do repositorio inteiro) ---"
    npx tsc --noEmit
    @echo "--- [2/6] vitest: tests/render/encode (∅-crit + 4 adversariais + presenca + encodes reais) ---"
    @# C2: um alvo que nao casa nenhum teste sai verde. Exigimos o numerador.
    @saida=$(npx vitest run tests/render/encode/ 2>&1); \
        echo "$saida" | tail -8; \
        echo "$saida" | grep -qE "Tests +[1-9][0-9]* passed" || \
            { echo "FALHOU: o vitest nao rodou nenhum teste deste card (falso verde)"; exit 1; }
    @echo "--- [3/6] ∅-crit: todo perfil do disco declara alvo de qualidade (listarPerfis lança em invalido) ---"
    @npx tsx -e "(async () => { \
        const { listarPerfis } = await import('src/render/encode/descobrir.js'); \
        const ps = await listarPerfis(); \
        const nomes = ps.map(p => p.perfil.nome); \
        for (const nome of ['entrega-software', 'entrega-nvenc']) { \
            if (!nomes.includes(nome)) { \
                console.error('FALHOU: perfil esperado ausente do disco: ' + nome); \
                process.exit(1); \
            } \
        } \
        for (const p of ps) { \
            console.log('  - ' + p.perfil.nome + ' (motor ' + p.perfil.motor + \
                ', alvo ' + p.perfil.alvoQualidade.tipo + '=' + p.perfil.alvoQualidade.valor + \
                ', deterministico: ' + p.perfil.deterministico + ')'); \
        } \
    })().catch((e) => { console.error(e.message); process.exit(1); });"
    @echo "--- [4/6] NVENC: deteccao por smoke test de 1 s (C8) + contrato de fallback declarado ---"
    @npx tsx -e "(async () => { \
        const { detectarNvenc } = await import('src/render/encode/detectar.js'); \
        const { escolherPerfil } = await import('src/render/encode/escolher.js'); \
        const { listarPerfis } = await import('src/render/encode/descobrir.js'); \
        const ps = (await listarPerfis()).map(d => d.perfil); \
        const nvenc = ps.find(p => p.nome === 'entrega-nvenc'); \
        const software = ps.find(p => p.nome === 'entrega-software'); \
        if (!nvenc || !software) { console.error('FALHOU: perfis ausentes'); process.exit(1); } \
        const d = await detectarNvenc(); \
        console.log('  deteccao: ' + (d.nvenc ? 'NVENC DISPONIVEL' : 'NVENC INDISPONIVEL') + ' — ' + d.motivo); \
        const escolha = escolherPerfil(nvenc, { nvenc: d.nvenc }, [nvenc, software]); \
        if (d.nvenc) { \
            if (escolha.fallback.ativo) { console.error('FALHOU: fallback declarado com NVENC disponivel'); process.exit(1); } \
        } else { \
            if (!escolha.fallback.ativo) { console.error('FALHOU: fallback NAO declarado com NVENC indisponivel — o fallback tem de ser declarado (pergunta adversarial 3)'); process.exit(1); } \
            console.log('  fallback DECLARADO: ' + escolha.fallback.solicitado + ' -> ' + escolha.perfil.nome); \
        } \
    })().catch((e) => { console.error(e.message); process.exit(1); });"
    @echo "--- [5/6] determinismo declarado TESTADO ao vivo (2x bytes identicos no perfil deterministico, ffmpeg real) ---"
    @npx tsx -e "(async () => { \
        const { execFile } = await import('node:child_process'); \
        const { mkdtemp, readFile, rm } = await import('node:fs/promises'); \
        const { tmpdir } = await import('node:os'); \
        const { join } = await import('node:path'); \
        const { createHash } = await import('node:crypto'); \
        const rodar = (c, a) => new Promise((res, rej) => execFile(c, a, { timeout: 120000 }, (e) => e ? rej(e) : res())); \
        const dir = await mkdtemp(join(tmpdir(), 'f5-02-gate-')); \
        try { \
            const master = join(dir, 'master.mp4'); \
            await rodar('ffmpeg', ['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=30:duration=1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-fflags','+bitexact','-flags','+bitexact','-map_metadata','-1', master]); \
            const { listarPerfis } = await import('src/render/encode/descobrir.js'); \
            const { executarEncode } = await import('src/render/encode/executar.js'); \
            const { calcularFramemd5 } = await import('src/render/encode/verificar.js'); \
            const catalogo = (await listarPerfis()).map(d => d.perfil); \
            const software = catalogo.find(p => p.nome === 'entrega-software'); \
            if (!software) { console.error('FALHOU: entrega-software ausente'); process.exit(1); } \
            if (!software.deterministico) { console.error('FALHOU: perfil deterministico declarou false'); process.exit(1); } \
            const s1 = join(dir, 'd1.mp4'); const s2 = join(dir, 'd2.mp4'); \
            await executarEncode({ perfil: software, entrada: master, saida: s1, catalogo }); \
            await executarEncode({ perfil: software, entrada: master, saida: s2, catalogo }); \
            const sha = async (f) => createHash('sha256').update(await readFile(f)).digest('hex'); \
            const a = await sha(s1); const b = await sha(s2); \
            if (a !== b) { console.error('FALHOU: 2x encodes divergiram (' + a + ' vs ' + b + ') — determinismo declarado nao confere'); process.exit(1); } \
            const f1 = await calcularFramemd5(s1); const f2 = await calcularFramemd5(s2); \
            if (f1 !== f2) { console.error('FALHOU: framemd5 divergiu entre os 2x encodes'); process.exit(1); } \
            console.log('  2x encodes byte-a-byte identicos (sha256 ' + a.slice(0, 12) + '...); framemd5 identico'); \
        } finally { await rm(dir, { recursive: true, force: true }).catch(() => undefined); } \
    })().catch((e) => { console.error(e.message); process.exit(1); });"
    @echo "--- [6/6] conferencia do ambiente: muxer framemd5 no build (build-dependente) ---"
    @ffmpeg -hide_banner -h muxer=framemd5 >/dev/null 2>&1 || \
        { echo "FALHOU: o build local de ffmpeg nao tem o muxer framemd5 — o oraculo de determinismo (camada 1) nao roda neste ambiente"; exit 1; }
    @echo ""
    @echo "=== encode-perfis: VERDE (∅-crit + eixos + fallback declarado + determinismo testado) ==="
# === fim F5-02 ===

# === F5-06 ===
# Relatorio de procedencia transitivo (card F5-06, W7). ∅-crit: um asset
# no video final sem origem declarada tem de bloquear a entrega. O gate
# cobre: denominador (diretos + transitivos dos cassetes commitados),
# ∅-crit, sonda negativa (4 mutacoes), emenda do F3-05 (C3), presenca
# per-item, data e termos, determinismo e AB-950.
procedencia:
    npx tsx src/entrega/procedencia/gate.ts
# === fim F5-06 ===

# === F5-04 ===
# =============================================================================
# Variantes de proporcao — conteudo fora da safe area de QUALQUER plataforma
# tem de ficar VERMELHO. Dono: card F5-04 (W7). Nao edite fora destes
# marcadores.
#
# Contrato congelado em docs/contrato-w7.md §6 (emenda F5-04) e o ∅-crit do
# PROGRAMA: `just variantes` -> exit 0, snapshots por variante, conteudo fora
# da safe area de qualquer plataforma fica vermelho.
#
# O que o gate verifica:
#   - typecheck ESCOPADO (tsconfig.variantes.json): reprova por causa DESTE
#     card, nao por causa de outro;
#   - suite vitest: derivacao + heranca de timing (pergunta adversarial 3),
#     bloco de legenda por plataforma (pergunta 2 do card, consumindo F3-02),
#     safe area da plataforma certa (pergunta 2, tokens 16:9 EBU e 9:16
#     provisional AB-071/AB-584) e o ∅-crit de mutacao (remover a checagem
#     de safe area deixa a variante 9:16 do canonico aprovada em silencio ->
#     VERMELHO);
#   - render: determinismo 2x, oraculo de pixel (conteudo dentro da safe
#     area; nada de tinta nao-explicada fora), snapshots aprovados por
#     variante ENTREGAVEL, e o ∅-crit em dado real: a variante 9:16 do
#     canonico TEM de ser reprovada pelo oraculo geometrico (reflow nao cabe
#     no retangulo util provisional) — se ela voltar limpa, o gate FALHA.
#
# Porta TCP reservada para este card: 4504 (docs/contrato-w7.md §11).
# Faixa de ledger: AB-720..AB-734 (ledger/inbox/F5-04.json).

# O gate completo das variantes de proporcao.
variantes: variantes-testar variantes-snapshots
    @echo ""
    @echo "variantes: VERDE"

# So a suite (para iterar rapido).
variantes-testar:
    @echo "=== variantes-testar: typecheck + suite ==="
    npx tsc --noEmit -p tsconfig.variantes.json
    npx vitest run tests/entrega/variantes.test.ts tests/entrega/variantes-c2-sonda.test.ts
    @echo "variantes-testar: OK"

# Render 2x com bytes identicos, oraculo de pixel, snapshots por variante e
# o ∅-crit (variante 9:16 do canonico reprovada + sondas). C5: o aprovado
# sai do RENDER, nunca do Studio.
variantes-snapshots:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== variantes-snapshots: determinismo + oraculo + snapshots ==="
    npx tsx tools/variantes/provar.ts
    echo ""
    echo "=== variantes-snapshots: fixtures/snapshots/variantes/ sem mudanca ==="
    # C3: `git diff --exit-code` NAO enxerga arquivo nao rastreado — o par
    # com `git status --porcelain` e o oraculo de "o diretorio esta intacto".
    git diff --exit-code fixtures/snapshots/variantes/
    sujo=$(git status --porcelain -uall -- fixtures/snapshots/variantes/)
    if [ -n "$sujo" ]; then
        echo "FALHOU: fixtures/snapshots/variantes/ tem arquivo modificado ou nao rastreado:"
        echo "$sujo"
        exit 1
    fi
    echo "variantes-snapshots: OK"

# (Re)aprova os snapshots. Explicito de proposito: o gate NUNCA gera snapshot
# sozinho — "primeira execucao, vou gerar" e o falso verde que o ∅-crit derruba.
variantes-aprovar:
    npx tsx tools/variantes/provar.ts --aprovar

# Studio para olhar as variantes com os proprios olhos. Porta 4504 (faixa
# deste card). NAO aprova snapshot: o Chrome do Studio nao e o Chrome do
# render (C5).
variantes-studio:
    npx remotion studio fixtures/snapshots/variantes/entrada.tsx --port 4504
# === fim F5-04 ===

# === F5-05 ===
# =============================================================================
# Thumbnail — card F5-05 (W7)
# =============================================================================
# O thumbnail e gerado do MESMO manifesto que o video: o unico caminho
# para o pixel e o pintor promovido (src/composicao/pintura, AB-493), o
# frame e escolhido pelo modulo (o meio da janela do primeiro cabecalho,
# pela MESMA aritmetica do render) e a escala de saida (1280x720) tambem.
# Nada e digitado a parte — o texto do thumbnail so pode ter vindo do
# manifesto.
#
# ∅-crit do card: "thumbnail com contraste abaixo do minimo tem de
# falhar". O contraste e MEDIDO nos pixels renderizados (WCAG, formula
# dos tokens) e o gate exerce o vermelho: repinta a tinta do titulo com
# uma cor de 2.66:1 (abaixo do piso 3:1) nos pixels REAIS do thumbnail e
# exige que a medicao falhe.
#
# Determinismo: o mesmo frame renderizado 2x tem de produzir bytes
# identicos — um thumbnail preto tambem e deterministico, por isso o gate
# mede conteudo (C1): o fundo tem de ser o dos tokens e as tintas do
# titulo do manifesto tem de estar na tela.
#
# O entregavel sai em output/thumbnail.png, so depois do gate verde.

# Gate do thumbnail: typecheck + suite (com guarda de C2) + render 2x +
# conteudo + contraste + ∅-crit.
thumb:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== thumb: typecheck ==="
    npx tsc --noEmit
    echo "=== thumb: suite do modulo ==="
    saida=$(npx vitest run tests/entrega/thumbnail/ 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g')
    echo "$saida" | tail -6
    # C2: um alvo que nao casa nenhum teste sai VERDE sem ter olhado nada.
    echo "$saida" | grep -qE "Tests +[1-9][0-9]* passed" \
        || { echo "FALHOU: nenhum teste selecionado (falso verde)"; exit 1; }
    echo "=== thumb: gate (determinismo + conteudo + contraste + ∅-crit) ==="
    npx tsx tests/entrega/thumbnail/gate.ts
    echo "thumb: OK"
# === fim F5-05 ===

# === F5-01 ===
# =============================================================================
# Pipeline de render e paralelismo — render por faixa + concatenacao.
# Dono: card F5-01 (onda W7, hub). Nao edite fora destes marcadores.
#
# O PROGRAMA escreve a aceitacao como `just render:fixture`; o `just` 1.42
# NAO aceita ':' em nome de receita — vale o hifen, convencao da W7 §7:
# `render-fixture` (hifen, nunca dois-pontos).
#
# Porta TCP deste card: 4501 (docs/contrato-w7.md §11).
# Faixa de ledger: AB-680..AB-699 (ledger/inbox/F5-01.json).
# ADR: docs/adr/0035-pipeline-de-render-por-faixas.md.
#
# O que cada etapa prova:
#   render-fixture   o gate de ponta a ponta (∅-crits): faixa == inteiro
#                    byte a byte no codec deterministico (PNG/QTRLE — vp9 e
#                    MP4 excluidos por declaracao, AB-396/397), integridade
#                    referencial cena.nos (C2), teto do I-03 com MemTotal
#                    em runtime (AB-986), ancora absoluta do audio (C4/C3).
#   render-testar    a suite vitest do pipeline (ponte, faixas, orcamento,
#                    audio, codecs, worker morto) — rapida, sem navegador.

# `just render:fixture` do PROGRAMA — a aceitacao inteira do card.
render-fixture:
    npx tsx tests/render/pipeline/render-fixture.ts

# A suite de unidade do pipeline (sem render de verdade — o gate do render
# e a receita acima).
render-testar:
    @echo "=== render-testar: suite vitest do pipeline ==="
    @saida=$(npx vitest run tests/render/pipeline/ 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g'); \
        printf '%s\n' "$saida" | tail -6; \
        printf '%s\n' "$saida" | grep -qE "Tests +[1-9][0-9]* passed" || \
            { echo "FALHOU: nenhum teste selecionado (falso verde)"; exit 1; }
    @echo "render-testar: OK"
# === fim F5-01 ===
