# ai-video-maker

Programa de construção de um **editor de vídeo programático** — um pipeline que transforma um
tema em um MP4 publicável, dirigido por agentes de IA rodando em git worktrees paralelas.

No momento em que este README foi escrito, **nenhuma linha de produto existe**. O que existe é o
aparato: a análise verificada, a árvore de 65 tarefas, a cadeia de verificação e a biblioteca de
conhecimento que os agentes carregam por classe de tarefa.

---

## Por onde começar

| Se você quer… | Leia |
|---|---|
| **executar o programa** | [`PROGRAMA.md`](PROGRAMA.md) — o documento canônico. Comece por "Como usar" e pela Parte II (a arquitetura em uma página) |
| saber **o que é fato e o que é suposição** | [`docs/00-panorama-verificado.md`](docs/00-panorama-verificado.md) — a lei factual, com placar de corroboração por claim |
| entender **o método** | [`docs/PLAYBOOK-REFERENCIA.md`](docs/PLAYBOOK-REFERENCIA.md) — digest normativo |
| **pegar uma tarefa** | `PROGRAMA.md` §III-14, e rode o gerador de prompt de card (`T-02`) — não copie o card à mão |
| **escrever uma skill** | [`docs/CONTRATO-DE-SKILL.md`](docs/CONTRATO-DE-SKILL.md) |
| ver **a pesquisa crua** | [`docs/pesquisa/`](docs/pesquisa/) — 19 clusters, cada um dono de um arquivo |

## Ordem de precedência

Declarada antes da primeira onda paralela, porque sem isso agentes paralelos escolhem fontes
diferentes e os dois "acertam":

```
PROGRAMA.md                    vence sobre PLANO
docs/00-panorama-verificado.md vence sobre FATO
docs/PLAYBOOK-REFERENCIA.md    vence sobre MÉTODO (subordinado ao PROGRAMA)
Roadmap Editor de Vídeo IA.md  é PANORAMA — superado no que diverge
```

## A tese, em uma frase

> O vídeo é uma função pura de um manifesto resolvido mais um conjunto de assets endereçados por
> conteúdo. Tudo que não é puro é empurrado para fora do render, para um estágio de resolução que
> cacheia por hash da entrada.

É essa fronteira que torna o sistema verificável: uma função pura tem golden master; um pipeline
com rede no meio, não.

## Estrutura

```
PROGRAMA.md                       o contrato de execução — 65 cards, 13 ondas
Roadmap Editor de Vídeo IA.md     o panorama de origem (histórico, não editar)
docs/
  00-panorama-verificado.md       fatos, com placar de corroboração
  PLAYBOOK-REFERENCIA.md          o método, digest normativo
  CONTRATO-DE-PESQUISA.md         formato da onda de pesquisa
  CONTRATO-DE-SKILL.md            formato da onda de skills + mapa de propriedade
  auditoria-cruzada-skills.md     contradições e lacunas entre skills
  pesquisa/                       19 clusters verificados
.agents/skills/                   20 skills, carregadas por classe de tarefa
  catalog.md                      índice gerado — roteamento em dois níveis
```

## O que este repositório NÃO é

Não é o produto. Não há `src/`, não há teste, não há vídeo. O primeiro card (`F0-01`) ainda não
foi executado, e ele entrega **vocabulário, não funcionalidade**.

E não prova que o método funciona aqui: zero cards executados, zero frames renderizados, zero
itens de ledger fechados. O que está provado é a construção do aparato — e a cadeia de
verificação já achou defeito **em si mesma** antes de ser apontada para o produto
(`PROGRAMA.md` §III-10, a nota sobre o caminho crítico redigitado).
