# Estrutura do repositorio -- Editor de Video IA

Este documento e normativo. A estrutura de diretorios e verificada por invariante
(`tools/invariantes/`, a ser escrito em `F0-08`): todo diretorio declarado aqui
que nao existe falha o gate como `ausencia`.

```
.
├── AGENTS.md                  # Instrucoes para agentes de IA
├── PROGRAMA.html              # Contrato de execucao (imutavel, 65 cards)
├── convencoes.md              # Convencoes de codigo, naming, commits
├── estrutura.md               # Este arquivo
│
├── src/
│   ├── composicao/            # Estagio 3: funcao pura, deterministica
│   │   ├── raiz.tsx           #   Composicao raiz (<Composition>)
│   │   ├── contrato-de-no.ts  #   Interface que todo no implementa
│   │   ├── descoberta.ts      #   Varredura por convencao (sem registro)
│   │   ├── tempo.ts           #   Calculo de duracao, transicoes
│   │   ├── nos/               #   Componentes de no (Cabecalho, TextoDestaque, ...)
│   │   ├── transicoes/        #   Transicoes entre cenas
│   │   ├── camadas/           #   Camadas globais (fundo, grade, vinheta)
│   │   └── layout/            #   Medicao, ajuste, safe area, overflow
│   │
│   ├── resolucao/             # Estagio 2: impuro, cacheado por hash
│   │   ├── contrato.ts        #   Contrato de estagio de resolucao
│   │   ├── orquestrador.ts    #   Orquestrador dos 5 sub-estagios
│   │   ├── locucao/           #   TTS → audio + timing
│   │   ├── grafico/           #   Manim headless → video com alfa
│   │   ├── midia/             #   Download de midia externa
│   │   ├── codigo/            #   Syntax highlight → tokens
│   │   └── musica/            #   Musica e efeitos → audio
│   │
│   ├── autoria/               # Estagio 1: LLM, nao-deterministico
│   │   ├── contrato/          #   Saida estruturada, cache de prompt
│   │   ├── prompts/           #   Templates de prompt versionados
│   │   └── reparo/            #   Validacao e reparo do manifesto
│   │
│   ├── sincronia/             # Amarra audio e imagem
│   │   ├── timing/            #   Timing canonico (uma fonte, 3 consumidores)
│   │   ├── legendas/          #   Geracao de legendas (queimada + sidecar)
│   │   ├── ducking/           #   Envelope de atenuacao calculado
│   │   └── ritmo/             #   Corte de silencio e cadencia
│   │
│   ├── render/                # Estagio 4: frames → encode
│   │   ├── pipeline/          #   Render por faixa + concatenacao
│   │   ├── encode/            #   Perfis de encode (hw/sw)
│   │   └── cache/             #   Cache de render por conteudo
│   │
│   ├── entrega/               # Estagio 5: pos-producao
│   │   ├── variantes/         #   16:9, 9:16, safe area
│   │   ├── thumbnail/         #   Gerado do manifesto, nunca digitado
│   │   ├── procedencia/       #   Relatorio de origem de cada asset
│   │   └── pos/               #   Loudness, sidecar, pos-processamento
│   │
│   ├── audio/                 # Mix de audio
│   │   └── mix/               #   Trilha composta (locucao + musica + efeitos)
│   │
│   ├── pipeline/              # Orquestrador e2e
│   │   └── ...                #   Um comando: tema → entrega completa
│   │
│   ├── design/                # Tokens de design
│   │   ├── tokens.ts          #   Fonte unica de verdade (cores, espacamento, ...)
│   │   └── fontes/            #   Fontes locais embutidas
│   │
│   ├── store/                 # Store enderecado por conteudo (SHA-256)
│   │   └── ...                #   Append-only, escrita atomica
│   │
│   └── contratos/             # Tipos gerados dos JSON Schemas
│       ├── manifesto.ts       #   Gerado de schema/manifesto.schema.json
│       └── ...
│
├── docs/
│   ├── adr/                   # Architecture Decision Records
│   │   ├── 0001-oraculo.md    #   ADR-0001: regra do oraculo
│   │   ├── 0002-contrato-de-card.md  # ADR-0002: contrato de card
│   │   └── ...
│   ├── vocabulario.md         # Glossario canonico (~30 termos)
│   ├── autoria/               # Prompts, diretrizes narrativas
│   │   └── prompts/           #   Templates versionados
│   ├── revisao/               # Checklist humano de revisao
│   ├── runbooks/              # Publicacao, gates, procedimentos
│   ├── medicao/               # Custo, tempo, maquina
│   │   └── maquina.md         #   RAM/worker, saturacao, encode, disco
│   ├── pesquisa/              # Braindump de pesquisa (historico, congelado)
│   └── falso-verde.md         # Catalogo executavel de falso verde
│
├── fixtures/
│   ├── canonico/              # Fixture canonica (manifesto de referencia)
│   ├── snapshots/             # Snapshots aprovados (imutaveis)
│   │   └── *.received/        #   Snapshots divergentes (execucao vermelha)
│   ├── cassetes/              # Respostas gravadas de APIs externas
│   │   ├── locucao/
│   │   ├── grafico/
│   │   └── ...
│   └── gm/                    # Golden master (manifesto-resolvido + frames-chave)
│
├── ledger/                    # Registro de incerteza
│   ├── aberto.json            #   Singleton -- nunca escrito por card
│   └── inbox/                 #   Um arquivo por card (faixa pre-alocada)
│
├── schema/                    # JSON Schema (contratos de dados)
│   ├── manifesto.schema.json
│   ├── timing.schema.json
│   └── ...
│
├── tools/                     # Scripts Python/Bash
│   ├── validate-graph.py      #   Validador de grafo de tarefas
│   ├── validate-ledger.py     #   Validador de ledger
│   ├── verify-acceptance.py   #   Verificador de aceitacao (sonda negativa)
│   ├── gate.sh                #   Gate local executavel
│   ├── preflight.sh           #   Preflight de worktree
│   ├── new-task-worktree.sh   #   Criacao de worktree
│   ├── lint-vocabulario.py    #   Linter de vocabulario
│   ├── determinismo/          #   Harness de determinismo
│   ├── invariantes/           #   Scripts de invariantes estruturais
│   ├── store-*                #   Ferramentas do store
│   └── ...
│
├── tests/                     # Testes automatizados
│   ├── contratos/
│   ├── composicao/
│   ├── resolucao/
│   ├── store/
│   ├── design/
│   ├── sincronia/
│   ├── autoria/
│   ├── render/
│   ├── integracao/
│   ├── e2e/
│   └── harness/
│
├── assets/                    # Assets estaticos
│   └── fontes/                #   Fontes locais (com licenca)
│
├── .agents/                   # Skills e scripts de agente
│   ├── skills/                #   20 skills de dominio + metodo
│   │   ├── catalog.md         #     Catalogo gerado (nunca redigitado)
│   │   └── skill-map.md       #     Mapa de composicao
│   └── scripts/               #   Linter, evals, hooks
│
├── .claude/                   # Configuracao do Claude Code
│   └── settings.json          #   Hooks, permissoes
│
├── .github/                   # CI/CD
│   └── workflows/             #   Jobs espelhados do gate local
│
├── package.json               # Node.js (S-1: singleton)
├── tsconfig.json              # Configuracao TypeScript
├── pyproject.toml             # Python (S-2: singleton)
├── justfile                   # Tarefas (build, test, gate, ...)
├── .gitignore                 # Exclusoes de git
└── .env.example               # Template de variaveis de ambiente
```

## Singletons

Recursos que so admitem um escritor. Enumerados antes de qualquer onda
ser dimensionada. Cada um vira dono exclusivo ou sequencia.

| # | Singleton | Tratamento |
|---|---|---|
| S-1 | `package.json` + lockfile Node | Dono exclusivo por onda |
| S-2 | `pyproject.toml` + lock Python | Dono exclusivo por onda |
| S-3 | `src/Root.tsx` (registro) | Stub no PREP, um bloco por card |
| S-4 | `schema/manifesto.schema.json` | Dono unico na fase 0; depois, so por ADR |
| S-5 | `src/design/tokens.ts` (+ espelho) | Dono unico; alteracao recaptura snapshots |
| S-6 | Definicao do CI | Dono exclusivo; mergeia por ultimo |
| S-7 | `ledger/aberto.json` | Nunca escrito por card |
| S-8 | O diretorio do store | Append-only por hash; escrita atomica |
| S-9 | Portas TCP (Studio, preview) | Faixa por card, declarada no PREP |
| S-10 | GPU / sessoes de encode | Fila explicita; gate declara o limite |
| S-11 | A arvore de cards | So o orquestrador escreve, em `PREP-*` |
| S-12 | `.agents/skills/catalog.md` | Gerado, nunca redigitado |

## O que este documento NAO cobre

- Convencoes de codigo -- ver `convencoes.md`
- Vocabulario -- ver `docs/vocabulario.md`
- Arquitetura e fronteira de determinismo -- ver `AGENTS.md` e `PROGRAMA.html`
- Workflows de execucao -- ver `PROGRAMA.html` aba "Rodar a onda"
