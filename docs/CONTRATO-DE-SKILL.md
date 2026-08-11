# Contrato de skill — formato obrigatório e mapa de propriedade

> Este arquivo é o **contrato da onda de skills (W-S)**. Foi commitado antes de qualquer
> agente ser lançado. Nenhum agente de skill edita este arquivo.
> Cada agente é **dono exclusivo de um único `SKILL.md`**. Diretório disjunto, sem exceção.

## De onde vem este formato

O formato não foi inventado aqui. Ele é o formato já em produção em
`/home/ondokai/Projects/3blue1brown/.agents/skills/`, que tem um **linter executável**
(`.agents/scripts/skill_lint.py`) e três hooks de máquina. Adotar o mesmo formato significa
que o linter daquele projeto valida estas skills sem uma linha de mudança — e que o gate de
escrita (`skill_write_gate.py`) pode ser reaproveitado.

**Consequência dura:** o que o linter lê, você não muda por gosto. As regras abaixo não são
estilo, são condição de saída zero.

## Regras que o linter aplica (falha = exit 2)

| # | Regra | Origem |
|---|---|---|
| 1 | O arquivo começa com `---` e tem frontmatter fechado por um segundo `---` | `skill_lint.py` |
| 2 | Frontmatter contém `name:`, `description:`, `metadata:` | idem |
| 3 | `name` casa `^[a-z0-9-]+$`, ≤ 64 chars, **idêntico ao nome do diretório** | idem |
| 4 | `description` ≤ 1024 chars | idem |
| 5 | `metadata.type` ∈ `{knowledge, task, router, meta}` — **não existe tipo "method"** | idem |
| 6 | Corpo ≤ 500 linhas (aviso a partir de 400) | idem |
| 7 | **Nenhuma data, changelog, "last updated" ou "version history" no corpo** — história é do git | idem |
| 8 | `MUST/ALWAYS/NEVER/DO NOT/REQUIRED` em caixa alta só com o "porquê" na mesma linha | idem (aviso) |
| 9 | `description` em terceira pessoa, começando por um destes verbos: `Injects`, `Routes`, `Handles`, `Provides`, `Contains`, `Manages`, `Validates`, `Creates`, `Updates`, `Proposes`, `Scans`, `Runs` | idem (aviso) |

A regra 7 é a que mais derruba texto bem escrito. `2026-08-10` no corpo é **erro**, não aviso.
Se você precisa datar algo, o lugar é o ADR, não a skill.

## Esqueleto obrigatório

```markdown
---
name: <igual-ao-diretorio>
description: <Verbo em 3ª pessoa> ... Use whenever <gatilho semântico>, even if the user
  doesn't mention <termo literal>. Triggers: "<t1>", "<t2>", "<t3>", ...
metadata:
  type: knowledge | router | meta
  tier: metodo | dominio | router | meta
  verification_signal: "<comando literal que prova que esta skill ainda é verdade>"
---
# <Título humano>

## Quando carregar
- <situação 1 — descreva a TAREFA, não o arquivo>
- <situação 2>
- <o gatilho negativo: quando NÃO carregar, e o que carregar no lugar>

## Conhecimento injetado

### <subtítulo>
<fato não-óbvio> — **Placar (N-M)** — fonte: <URL primária ou `arquivo:linha`>

...

## Conhecimento negativo — o que um profissional competente faria e aqui está errado
<lista; esta seção é obrigatória e é a de maior valor>

## Falso verde deste domínio
| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|

## O que esta skill NÃO cobre
<escopo negativo explícito, com o nome da skill que cobre>

## Não verificado
<tudo que entrou sem placar ≥2-0, marcado, com o comando que fecha a lacuna. Se não há nada,
escreva "Nada — todo claim acima tem placar ≥2-0." e prove que é verdade.>

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
```

## Regras de conteúdo (não são do linter, são do método)

1. **Só entra o que é não-óbvio.** Um modelo capaz já sabe React, já sabe Python, já sabe o
   que é `interpolate`. A skill existe para o que ele **não** consegue inferir do código:
   a armadilha, a flag que muda o resultado em silêncio, o valor que o domínio define.
   *A maioria dos achados falha aqui, e esse é o desfecho saudável.*
2. **Toda afirmação factual carrega placar + fonte.** Sem placar, a linha vai para
   `## Não verificado`.
3. **Nunca cite uma URL que você não abriu.** Citação que ninguém checa é pior que citação
   errada: o texto lê como verificado enquanto nada nunca o checa.
4. **Preserve a condição de escopo.** Uma regra que perde a condição de validade
   ("no renderer OpenGL", "acima da versão X", "só no encoder de hardware") vira uma regra
   **errada em todo o resto**. Nunca corte o escopo para economizar palavras.
5. **A seção de conhecimento negativo é obrigatória** e não pode ser genérica.
   "Não escreva código ruim" não é conhecimento negativo. *"Não parametrize a SQL do shim —
   o defeito é o requisito"* é.
6. **Sem prosa de tutorial.** A skill não ensina a tecnologia; ela injeta o delta entre o que
   o modelo já sabe e o que este programa exige.
7. **Cada skill cabe em ~2.000–3.500 tokens.** Perto de 500 linhas você errou o recorte:
   ou dividiu de menos, ou está escrevendo documentação.

## Mapa de propriedade — um dono por arquivo

Nenhum agente escreve fora da sua linha. Os outros: **não editam**.

| # | Arquivo (dono exclusivo) | tier | Insumo de pesquisa a ler |
|---|---|---|---|
| S01 | `.agents/skills/project-router/SKILL.md` | router | — (lê o catálogo) |
| S02 | `.agents/skills/wave-planning/SKILL.md` | metodo | playbook (referência) |
| S03 | `.agents/skills/parallel-worktrees/SKILL.md` | metodo | R15 |
| S04 | `.agents/skills/adversarial-review/SKILL.md` | metodo | playbook |
| S05 | `.agents/skills/falsifiable-gates/SKILL.md` | metodo | playbook + R11 |
| S06 | `.agents/skills/uncertainty-ledger/SKILL.md` | metodo | playbook |
| S07 | `.agents/skills/video-characterization/SKILL.md` | metodo | R11 |
| S08 | `.agents/skills/timeline-manifest/SKILL.md` | dominio | R02, R16 |
| S09 | `.agents/skills/remotion-core/SKILL.md` | dominio | R01, R02 |
| S10 | `.agents/skills/remotion-render-pipeline/SKILL.md` | dominio | R05, R12 |
| S11 | `.agents/skills/manim-bridge/SKILL.md` | dominio | R07 + fontes locais 3b1b |
| S12 | `.agents/skills/audio-captions-sync/SKILL.md` | dominio | R03, R04 |
| S13 | `.agents/skills/asset-acquisition/SKILL.md` | dominio | R08 |
| S14 | `.agents/skills/code-animation/SKILL.md` | dominio | R09 |
| S15 | `.agents/skills/ffmpeg-media-ops/SKILL.md` | dominio | R10 |
| S16 | `.agents/skills/llm-authoring/SKILL.md` | dominio | R06, R16 |
| S17 | `.agents/skills/motion-design-system/SKILL.md` | dominio | R02, R14 |
| S18 | `.agents/skills/tts-voiceover/SKILL.md` | dominio | R13 |
| S19 | `.agents/skills/meta-skill-evolution/SKILL.md` | meta | — (adapta do 3b1b) |
| S20 | `.agents/skills/meta-skill-consolidate/SKILL.md` | meta | — (adapta do 3b1b) |

### Arquivos compartilhados — ninguém escreve nesta onda

`.agents/skills/catalog.md`, `.agents/skills/skill-map.md`, `PROGRAMA.md`,
`docs/00-panorama-verificado.md`, `docs/pesquisa/**`, e este contrato.

Motivo mecânico: são pontos de composição. Vinte agentes acrescentando linha ao mesmo índice
conflitam **sempre**. O índice é escrito por quem orquestra, depois, a partir dos arquivos
entregues — nunca redigitado em paralelo.

## Roteamento com 20 skills — o problema que isto cria

O relatório de validação do projeto 3blue1brown registra que roteamento por palavra-chave
degrada acima de ~15 skills. Este catálogo tem 20. A mitigação é **roteamento em dois
níveis**: o router escolhe primeiro o *tier* (metodo | dominio | meta) e só depois a skill
dentro do tier. O `project-router` (S01) é obrigado a implementar isso e a declarar, no
próprio corpo, que a degradação é conhecida e como ela é contornada.
