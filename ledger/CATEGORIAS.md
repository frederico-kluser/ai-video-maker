# Categorias do ledger — vocabulario fechado

Este documento define o vocabulario fechado de `quem_responde` (papel que responde a
pergunta do item). Alterar este arquivo requer commit do orquestrador que altera o enum
e o validador juntos, fora da onda.

## Papéis (quem_responde)

| Slug | O que cobre |
|---|---|
| `dono` | Decisao que depende do dono do programa: escopo, prioridade, apetite de risco, sign-off |
| `juridico` | Licenca, termos de uso, consentimento, atribuicao legal, jurisdicao |
| `infra` | Maquina-alvo, GPU, driver, sistema operacional, filesystem, rede, versao de runtime |
| `plataforma` | API externa, provedor de TTS, endpoint de LLM, servico de busca, CDN, Remotion, Manim |
| `operacao` | Procedimento, recoverability, backup, rollback, monitoramento, alarme |

## Compostos

Usar `→` para escalacao (mede um, decide outro) e `+` para conjunto.

Exemplos:
- `plataforma → dono` — a plataforma responde o fato, o dono decide o que fazer
- `infra + plataforma` — ambos precisam responder para fechar

## Distribuicao

A distribuicao e derivada, nunca redigitada:

```sh
grep -E '^[[:space:]]*"responde"' ledger/inbox/*.json | sort | uniq -c | sort -rn
```

## O que este documento NAO cobre

- As faixas de id por categoria de item (`ambiente`, `render`, `manim-bridge`, `audio`,
  `assets-licenca`, `agentes-worktrees`) — essas sao do panorama §7 e estao no schema
  do item, campo `categoria`.
- Alocacao de faixas de id por card — isso e atribuicao do `PREP` da onda, tabela em
  `PROGRAMA.html` §III-12.