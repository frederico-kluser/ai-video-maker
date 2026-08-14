# CLAUDE.md

Este arquivo importa a fonte única de verdade do repositório. Todas as instruções normativas
vivem em AGENTS.md — não duplique aqui nada que já esteja lá.

@AGENTS.md

Notas de portabilidade:
- O catálogo de skills e o roteador estão em `.agents/skills/` (fonte única), com symlink
  `.claude/skills -> ../.agents/skills` para carregamento por ferramentas que só procuram em
  `.claude/`.
- Os artefatos de composição do sistema de skills (nunca apagar): `project-analysis.md`,
  `skill-map.md`, `catalog.md` (gerado), `validation-report.md`, `.bootstrap-state.json`.
