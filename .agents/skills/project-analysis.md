# Project Analysis — Editor de Vídeo IA (`ai-video-maker`)

Produced by the knowledge-skills bootstrap run (phase 1). Method: repository-docs grounding
(AGENTS.md, convencoes.md, estrutura.md, RETOMAR-AQUI.md, docs/*, ADRs, justfile, CI, package
manifests), two isolated-context exploration agents (normative docs synthesis + source/tooling
map), and a direct audit of the existing `.agents/skills/` system. All `path:line` pins refer to
HEAD `ccda369` unless a commit is named.

## 1. What the project is

A pipeline that turns a theme/brief into a finished MP4 (narration, Manim math graphics,
captions, music) with **no manual editing**. The video is a **pure function** of a resolved
manifest plus content-addressed assets (SHA-256); everything impure (LLM, TTS, downloads,
network) lives *above* the determinism frontier and is cached by hash
(`AGENTS.md:11-13`, `RETOMAR-AQUI.md:28-41`).

Five stages: (1) **AUTORIA** — LLM writes `manifesto.json` (non-deterministic, cached);
(2) **RESOLUÇÃO** — five impure sub-stages (locucao, grafico, midia, codigo, musica), each
hash-cached with a cassette, producing `manifesto-resolvido.json`; (3) **COMPOSIÇÃO** — pure
function, zero network/`Date.now()`/`Math.random()`, determinism tested (render 2× → identical
bytes); (4) **RENDER** — frames→encode, parallelizable by lane; (5) **PÓS/ENTREGA** — loudness,
variants, captions, thumbnail, provenance (`AGENTS.md:15-23`).

Stack: Remotion 4.0.507, Node 24, Python 3.12, just 1.42.4, ffmpeg 6.1.1, Manim 0.20.1
(`RETOMAR-AQUI.md:56-60`). Plan source of truth: `PROGRAMA.html` (immutable; 65 cards, 13 waves —
all merged; `1133e39`).

## 2. Normative rules (with provenance)

| Rule | Content | Source |
|---|---|---|
| Determinism frontier | `src/composicao/` is pure: no `Date.now()`, `Math.random()`, `setTimeout()`, `fetch()`, no network/disk/env/clock, no unordered iteration. Enforced by `just comp-pureza` | `AGENTS.md:37-43`, `convencoes.md:40-46` |
| Token literals | Every color/spacing/duration/font/size lives only in `src/design/tokens.ts` (mirror `tokens.py`); `just design-varrer` fails on literals outside `src/design/` | `AGENTS.md:44-49`, `convencoes.md:50-53` |
| Oracle per card (ADR-0001) | No pipeline stage starts without an oracle able to fail it; acceptance has a negative probe | `AGENTS.md:51-56`, `convencoes.md:89-93`, `gate.md:105` |
| Gate | Runs from day 1, starts green with everything empty; states PASS/FAIL/NÃO-EXERCITADO/PENDENTE; **missing tool = RED, never skipped**; green requires zero FAIL and zero NÃO-EXERCITADO | `AGENTS.md:58-62`, `gate.md:9-41` |
| Handoff | Only channel between waves; `destinatarios` field mandatory (empty handoff rejected by gate); fields: destinatarios, o-que-fiz, arquivos-modificados, premissas, bloqueios | `AGENTS.md:64-68`, `convencoes.md:70-81`, `vocabulario.md:83-90` |
| Discovery by convention | Nodes `src/composicao/nos/<nome>.tsx` with `meta`+`default`; stages `src/resolucao/<nome>/estagio.ts` with `export default`; discovered stage without cassette fails `res-offline`; unknown name → `EEstagioDesconhecido` | `AGENTS.md:70-77`, `contrato-estagio-resolucao.md:43-56` |
| Stage contract (ADR-0007) | `licenca` mandatory non-empty in provenance, never a URL; `identidade.versao` bumped when `resolver()` changes (else C12); `entrada.fetch`, never `globalThis.fetch` (else `ERedeBloqueada`); cassette is a **twin, not successor**; key = SHA-256 of `{versaoContrato, nome, versaoEstagio, hashManifesto, parametros}`; volatiles only `volatil.json#/*` and `adquiridoEm` | `AGENTS.md:79-92`, `contrato-estagio-resolucao.md:41,180-207,226-264` |
| Ledger | IDs pre-allocated by range, **never recycled**; `ledger/aberto.json` is S-7 singleton never written by a card; cards write only `ledger/inbox/<CARD>.json` | `RETOMAR-AQUI.md:438-452`, `estrutura.md:169` |
| Archiving / negative scope | "The absence of a verifier is indistinguishable from compliance" — every rule whose automated verifier was removed declares in writing that it became manual; F6-05 froze live/dead/manual | `arquivamento.md:7-12,97-137` |
| Publishing | Dossier signed by a named role (never "the team"); gates P-1..P-5 `CONFERE` with attached evidence; phase 6 is the first irreversible one; "whoever reverts does not decide what is valid"; "whoever publishes does not self-approve"; AB-950 trigger must be declared in every gate (omission = gate failure); master-switch flag that disables all publication | `politica-editorial.md:39-65,67-92,104-121,214-221` |
| Tool pins | ffmpeg 6.1.1 + node pinned; gate fails if current version diverges; cross-version determinism is declared by pin, never assumed | `contrato-w8.md:95-101`, `contrato-w9.md:266-277` |
| Timing in seconds | Timing in SECONDS, never frames (caption ≥ max(0.833 s; chars/20), ≤ 7 s); consumption by CONTENT via `casarTimings()`, never by position | `contrato-w6.md:93-104`, `vocabulario.md:110-115` |
| Authoring repair | REPAIRABLE = FORM (space/escape/case/order/duplicate); REJECTION = SEMANTICS (never "improved until it passes"); 3 attempts with progressive simplification; repair never fills duration/layout/color/hash/license | `contrato-w6.md:134-173` |
| Cache by content | Cache key = 5 components (manifest, byte re-hash, tokens read, compositor/browser versions, pin); NEVER date/memTotal/workers; cache-miss probe mandatory | `contrato-w8.md:107-150` |
| Strict profile | Authoring SKIPPED, zero-LLM mechanical repair, NVENC never (`deterministico: false` never in strict), 9:16 out of scope, mp4 muxing belongs to orchestrator F5-07 | `contrato-w9.md:187-216,232-244` |
| Wave ritual (7 steps) | (1) `PREP-w<N>` commit before any worktree (worktrees materialize only committed content); (2) per-worktree preflight; (3) 1 agent/card/worktree; (4) barrier written by the agent; (5) teardown (worktree remove + branch -D + prune); (6) merges one-by-one in declared order, **never octopus**; (7) **full gate after EACH merge** (bisection names the card). Squash-merge: 1 commit per card | `RETOMAR-AQUI.md:83-107` |
| Singletons | If a card needs to touch S-1..S-12 (tokens, schema, package.json, Root.tsx, card tree…): **stop, don't do it, write it in the handoff** — becomes PREP of next wave | `RETOMAR-AQUI.md:296-306`, `estrutura.md:156-174` |
| Lateral dependency | Never invent a same-wave neighbor's artifact | `contrato-w4.md:57-61` |
| justfile recipes | Hyphen, never `:` (global parse dies; green gate over a dead justfile) | `criterios-de-aceitacao-corrigidos.md:115-144`, `RETOMAR-AQUI.md:347-360` |
| Worktrees | `node_modules` is a symlink to the main checkout — never run `npm install` inside; the agent never removes its own worktree | `RETOMAR-AQUI.md:239-240`, `vocabulario.md:212-216` |

## 3. The 12 lying tools (C1-C12)

Normative table at `AGENTS.md:94-112`. Summary: C1 render exit 0 ≠ image (assert frame
entropy); C2 test-runner filters that match nothing pass green (negative probe per target);
C3 `git diff --exit-code` misses untracked files; C4 `ffprobe` container duration ≠ stream
duration; C5 Studio Chrome ≠ render Chrome (approve only renders); C6 a font that didn't load
falls back silently (embed + assert resolved family); C7 a network asset changes content under
the same URL (hash, never URL); C8 `nvidia-smi` present ≠ encoder available (prove with 1 s
encode); C9 running twice misses date/timezone/machine-dependent change (freeze clock/tz/locale;
normalize by position); C10 skill that exists ≠ skill that was loaded (`skills_obrigatorias`
declares, handoff confirms); C11 empty search in LLM-generated code isn't absence (normalized
text, tripwire); C12 cache hits for the wrong reason when the key omits a parameter (key covers
everything; one-parameter-at-a-time cache-miss tests).

These are re-injected on every user prompt by the `calibration_nudge` hook
(`.agents/scripts/calibration_nudge.py`, `C1/C2/C9/C12`).

## 4. Domain traps beyond AGENTS.md's "14 armadilhas"

| Trap | Reality | Source |
|---|---|---|
| `just` recipe named with `:` | Parse error is GLOBAL — whole file stops loading; gate stays green calling commands directly | `RETOMAR-AQUI.md:347-360` |
| `rg -L` | Is `--follow`, not `--files-without-match` — inverted; check the denominator | `RETOMAR-AQUI.md:362-376`, `falso-verde.md:23` |
| Remotion bundler (webpack) | Ignores tsconfig `paths` — `import from "src/design/tokens"` passes tsc+vitest, breaks only at real render; use relative imports inside `src/composicao/` | `RETOMAR-AQUI.md:378-383` |
| pytest collection | `*_test.py` wasn't collected → zero tests, exit 5 read as failure; acceptances reported without ever running (AB-285) | `RETOMAR-AQUI.md:390-396` |
| Canonical fixture | `duracao_total_frames` 930 vs 727 derived — declared frontier on both sides with 3/4 disagreeing (output rules → inert inputs lie) | `RETOMAR-AQUI.md:398-411` |
| `git status --porcelain` in `&&` chains | Exits 0 both clean and dirty — the signal is the OUTPUT | `falso-verde.md:25` |
| `ffprobe` with wrong key | Empty output, exit 0 — require non-empty parse before comparing | `falso-verde.md:26` |
| `pytest -k` + `|| true` | Exit 5 becomes 0 — assert `rc == 0` and test count | `falso-verde.md:22` |
| vite `meta` binding | A binding named `meta` in a file using `import.meta` breaks (found by F1-08) | `RETOMAR-AQUI.md:269-270` |
| Render flake under load | Chrome `delayRender` (Inter font) — re-run once before investigating; `just e2e` is manual, CI doesn't run it | `TUTORIAL.md:274-276,312,433-436` |
| `--provedor anthropic` | Always records from the TWIN — no real call path today (AB-552) | `TUTORIAL.md:329-336` |
| Video content oracle | Rejects only "dark AND flat" (YAVG max < 24 AND stddev ≤ 1.0) — stddev is the weapon that recognizes 3b1b math; YAVG alone would false-red | `TUTORIAL.md:174-184` |

## 5. Annotated map

- **`src/`** — `composicao/` (pure: `raiz.tsx` registerRoot, `ManifestoRaiz.tsx` envelope→Sequence
  tree, `camadas/`, `layout/` (eixo/medicao/overflow), `nos/` (cabecalho, codigo, grafico, lista,
  midia, texto), `pintura/`, `transicoes/`, `design/tokens.ts` + `design/fontes/`);
  `resolucao/` (`<nome>/estagio.ts` convention — codigo, grafico/manim, locucao, midia, musica;
  `orquestrador.ts`, `descoberta.ts`, `cassete/`, `rede/bloqueio.ts`); `autoria/` (contrato,
  executor, reparo); `sincronia/` (ducking, legendas, ritmo, timing); `render/` (cache, encode,
  pipeline); `entrega/` (pos, procedencia, thumbnail, variantes); `pipeline/produzir.ts`;
  `store/` (content-addressed). Entry points: `index.ts` + 3 more `registerRoot` files
  (`prova/`, `entrada.tsx`, `produzir.ts`).
- **`tests/`** — vitest (`*.test.ts`, network-guard setup `tests/setup/rede-bloqueada.ts`,
  probes/oracles/∅-crit/mutation/entropy/byte-identical) + pytest (schema validation against
  `schema/*.json`, both `test_*.py` and `*_test.py` names). Tools selftests live in `tools/`.
- **`tools/`** — `gate.sh` (5-stage gate, 3 states), `preflight.sh`, `offline-guard.sh` (4-layer
  offline suite), `verify-acceptance.py` (every card selector matches ≥1 test), `validate-graph.py`,
  `validate-ledger.py`, `espelho-ci.py` (gate↔CI mirror), `medir*.py`, `derive-state.py`,
  `store-*.ts`, `gm/*` golden master.
- **`justfile`** (~120 hyphen-named recipes) — `build/test/lint/typecheck` mirror CI;
  `design-varrer` literal scan; `comp-pureza`; `res-offline` (kernel `unshare --net` +
  in-process guard + vitest + pytest); `skills-lint` (skill_lint.py), `skills-test`
  (skill_lint_selftest.py), `skills-catalogo` (regenerate + `git diff --exit-code`); node/transition
  recipes with `-aprovar` (explicit re-baseline) and `-ausencia`/`-mutar` (∅-crit probes).
- **`.github/workflows/ci.yml`** — push/PR to main: build / test / lint / typecheck / versões;
  must mirror `tools/gate.sh` or `espelho-ci.py` goes RED.
- **`docs/`** — `adr/` (48 numbered ADRs, gap at 0048; 0001-0049; rules + rationale),
  `contrato-w4..w9.md` (per-wave contracts), `contrato-estagio-resolucao.md`,
  `politica-editorial.md`, `criterios-de-aceitacao-corrigidos.md`, `falso-verde.md`, `gate.md`,
  `fixtures.md`, `reuso-3b1b.md`, `vocabulario.md`, `contas.md`, `arquivamento.md`,
  `TUTORIAL.md` + `TUTORIAL.html`. Frozen-in-git docs (via `git show 8737ad6:`):
  `PROGRAMA.md`, `docs/00-panorama-verificado.md`, `docs/PLAYBOOK-REFERENCIA.md`,
  `docs/pesquisa/**` (19 files), `docs/CONTRATO-DE-SKILL.md`.
- **`output/`** — final deliverables: `master.mov` (qtrle/argb deterministic master),
  `master.wav`, `entregavel-final.mp4`, `entregavel.m4a`, `entregavel.srt`,
  `manifesto-resolvido.json`, `mix-documento.json`, `pos-documento.json`,
  `relatorio-final.json`, `relatorio-procedencia.json`, `variante-16x9.json`, `thumbnail.png`.
- **`ledger/`** — `aberto.json` (S-7), `inbox/`, `CATEGORIAS.md`, `fechamento.md` (G-LED closed).
- **`schema/`** — manifesto, manifesto-resolvido, timing JSON schemas.

## 6. Tooling-guaranteed conventions (deterministic enforcement, not prose)

These are already enforced by CI/justfile/scripts — skills must POINT to the check, never restate
the rule: `npm run typecheck` (tsc --noEmit) · `npm test`/`npx vitest run` · `python3 -m pytest
tests/` (exit 5 = fail) · `python3 -m ruff check src/ tests/` (E,F,I,N,W,UP,B,C4,SIM) ·
`just design-varrer` (token literals) · `just comp-pureza` (composição purity) ·
`tools/gate.sh` (5 stages) · `tools/espelho-ci.py` (gate↔CI mirror) · `tools/verify-acceptance.py`
(card→test coverage) · `tools/validate-graph.py` (wave graph) · `tools/validate-ledger.py`
(ledger closure) · `res-offline` (network-blocked suite) · `skills-lint` / `skills-test` /
`skills-catalogo` (skills system itself).

## 7. The existing knowledge-skills system — audit state

Built by a prior bootstrap run (commits `3c4283e` onda1-infra-skills, `5995a9d` onda2-hooks,
`770725b` PREP-w5; origin `8737ad6`). Current state at `ccda369`:

- **20 skills, 4 tiers** in `.agents/skills/` — router (1: `project-router`), metodo (6:
  adversarial-review, falsifiable-gates, parallel-worktrees, uncertainty-ledger,
  video-characterization, wave-planning), dominio (11: asset-acquisition, audio-captions-sync,
  code-animation, ffmpeg-media-ops, llm-authoring, manim-bridge, motion-design-system,
  remotion-core, remotion-render-pipeline, timeline-manifest, tts-voiceover), meta (2:
  meta-skill-evolution, meta-skill-consolidate).
- **skill_lint.py** — frontmatter (name==dirname, description ≤1024, metadata.type), `$data`
  rejection, mandatory provenance citation, body ≤500 lines (warn at 400). Baseline: **0 errors,
  11 warnings** (bodies 402-413 lines — under the error ceiling; line-budget debt owned by
  meta-skill-consolidate).
- **Hooks** in `.claude/settings.json` — PreToolUse: bash guardrail (allowlist), SKILL.md write
  gate, secrets read guard; Stop: wave barrier + (new, this run) bootstrap mission gate;
  UserPromptSubmit: calibration nudge. `hooks_selftest.py`: 44 tests, all green.
- **catalog.md** — generated (S-12, `skills-catalogo`), 352 triggers, 11 ambiguous (3.1%),
  two-level routing doctrine, two mandatory loads (video-characterization, parallel-worktrees).
- **skill-map.md** — hand-written granularity justification (merge/split tables, per-skill
  verification-signal classes, declared limits).

**Gaps found by this audit** (fixed in phases 3-5 of this run):
1. `.claude/skills` symlink → `.agents/skills` missing (load-path hypothesis unverified);
2. `CLAUDE.md` missing (AGENTS.md exists and is the single source);
3. No `.eval_records/` → write gate would block ANY SKILL.md edit (fail-closed by design);
4. **Write-gate contract drift**: meta-skill-evolution prescribes token = gitignored, local,
   TTL 30 min, sha1-bound, fail-closed on empty argv — implementation stores committed JSON with
   no TTL/sha1 and allows empty path (hooks_selftest even asserts "Empty path allows");
5. Bootstrap artifacts (`.bootstrap-state.json`, project-analysis.md, validation-report.md)
   missing — this run creates them;
6. Project state docs drift: RETOMAR-AQUI.md frozen at 2026-08-11 (repo is complete); skill-map §2
   ambiguity counts stale (11/352 vs 14/344 quoted).

## 8. Knowledge-area coverage vs the 20 skills

Every normative rule in §2 and trap in §4 maps to an existing skill (manim-bridge,
remotion-core, audio-captions-sync, timeline-manifest, falsifiable-gates, video-characterization,
parallel-worktrees, wave-planning, uncertainty-ledger, llm-authoring, tts-voiceover,
ffmpeg-media-ops, motion-design-system, asset-acquisition, code-animation,
remotion-render-pipeline). No new domain skill is warranted by this analysis — the catalog's
coverage is complete for the product as built. Candidate *passage-level* updates (only if
verified during this run): hook firing evidence (project-router §Não verificado 3/4), write-gate
contract compliance, load-path verification via symlink.

## 9. Not found

- `docs/00-panorama-verificado.md`, `docs/PLAYBOOK-REFERENCIA.md`, `docs/pesquisa/**`,
  `PROGRAMA.md` in the working tree — exist only at commit `8737ad6` (by design; consolidated
  into `PROGRAMA.html`).
- ADR-0048 (gap in numbering 0001..0049 — historical renumbering, `RETOMAR-AQUI.md:458-465`).
- Any `.claude/` skills directory or CLAUDE.md.
- Any `.eval_records/` (write-gate tokens).
- A live `.env` file (only `.env.example`; keys come from the environment, `TUTORIAL.md:63`).
- `output-final/` is empty (superseded by `output/`).

## 10. Provenance

All pins above at `@ccda369` (HEAD) unless noted; frozen corpus at `@8737ad6`. Generated by the
bootstrap run — a reviewable draft, not normative project doc. The normative entry point for
agents remains `AGENTS.md`; the normative execution contract is `PROGRAMA.html`.
