# Catálogo de skills — Editor de Vídeo IA

> **Arquivo GERADO** a partir do frontmatter de cada `SKILL.md`. Não edite à mão: regenere com
> `python3 .agents/scripts/gerar-catalogo.py`. Se este arquivo e os frontmatter divergirem, **este** é o que está errado — ele é a representação derivada.

## Como rotear — dois níveis, obrigatório

Este catálogo tem **20 skills**, acima do limiar (~15) em que roteamento por palavra-chave degrada. O `project-router` escolhe primeiro o **tier**, e só depois a skill dentro dele. Roteamento de um nível nesta escala erra, e erra em silêncio.

**As duas obrigatórias por classe de tarefa** — carregadas por regra, não por julgamento do agente:

| Se a tarefa… | Carregue antes, sempre | Porque a falha é… |
|---|---|---|
| altera saída **visual ou sonora** | `video-characterization` | silenciosa: "o render passou" parece prova e não é |
| escreve em arquivo tocado por **outro card** | `parallel-worktrees` | confirmatória: o merge limpo confirma a ilusão de escopo contido |

## Router — sempre primeiro

| Skill | `type` | Carregue quando |
|---|---|---|
| [`project-router`](project-router/SKILL.md) | router | the user asks for any change, card, fix, feature, render, plan, analysis or r… |

## Método — como o programa é executado

| Skill | `type` | Carregue quando |
|---|---|---|
| [`adversarial-review`](adversarial-review/SKILL.md) | knowledge | a diff, render, caption track, cache key, asset fetch or gate is about to be … |
| [`falsifiable-gates`](falsifiable-gates/SKILL.md) | knowledge | a task writes or reviews a done-criterion, a gate, a verifier, a hook or a CI… |
| [`parallel-worktrees`](parallel-worktrees/SKILL.md) | knowledge | work is split across several agents, branches or checkouts at the same time, … |
| [`uncertainty-ledger`](uncertainty-ledger/SKILL.md) | knowledge | a task is about to assume something the current machine cannot prove, when a … |
| [`video-characterization`](video-characterization/SKILL.md) | knowledge | a task captures, approves, compares, calibrates or retires a visual or audio … |
| [`wave-planning`](wave-planning/SKILL.md) | knowledge | planning, numbering, widening, splitting or re-ordering waves of parallel car… |

## Domínio — o que o programa constrói

| Skill | `type` | Carregue quando |
|---|---|---|
| [`asset-acquisition`](asset-acquisition/SKILL.md) | knowledge | a task fetches, caches, references or credits any external media asset, even … |
| [`audio-captions-sync`](audio-captions-sync/SKILL.md) | knowledge | a task touches narration timing, captions, subtitles, word highlighting, back… |
| [`code-animation`](code-animation/SKILL.md) | knowledge | a task puts source code on screen, diffs two code states, types code out, hig… |
| [`ffmpeg-media-ops`](ffmpeg-media-ops/SKILL.md) | knowledge | a task shells out to ffmpeg or ffprobe, transcodes, concatenates, mixes, norm… |
| [`llm-authoring`](llm-authoring/SKILL.md) | knowledge | code asks a model to emit, repair or extend a timeline manifest, prunes a JSO… |
| [`manim-bridge`](manim-bridge/SKILL.md) | knowledge | a Python process shells out to the manim CLI, whenever a scene asset has to r… |
| [`motion-design-system`](motion-design-system/SKILL.md) | knowledge | a task picks a duration, a colour, a size, a screen position, an easing curve… |
| [`remotion-core`](remotion-core/SKILL.md) | knowledge | authoring, generating or reviewing composition code, scene timing, animation … |
| [`remotion-render-pipeline`](remotion-render-pipeline/SKILL.md) | knowledge | a task builds, tunes, parallelizes or budgets a video render, even if the use… |
| [`timeline-manifest`](timeline-manifest/SKILL.md) | knowledge | a task reads, writes, generates, validates, versions or migrates the manifest… |
| [`tts-voiceover`](tts-voiceover/SKILL.md) | knowledge | a task synthesizes speech, picks or swaps a voice provider, writes the voiceo… |

## Meta — como a memória evolui

| Skill | `type` | Carregue quando |
|---|---|---|
| [`meta-skill-consolidate`](meta-skill-consolidate/SKILL.md) | meta | a skill body crosses the line budget, a skill is added or retired, a descript… |
| [`meta-skill-evolution`](meta-skill-evolution/SKILL.md) | meta | a card is being closed, whenever work produced a gotcha, a silent flag, a mea… |

## Índice de gatilhos

Termo → skill. **Um termo reivindicado por duas skills é dívida de roteamento**, não redundância saudável: `meta-skill-consolidate` mede isso e propõe fusão.

Gatilhos declarados: **352** · ambíguos (2+ donos): **11** (3.1%)

### Ambíguos — desambiguar na próxima consolidação

| Gatilho | Reivindicado por |
|---|---|
| `alpha channel` | ffmpeg-media-ops, manim-bridge |
| `crf` | ffmpeg-media-ops, remotion-render-pipeline |
| `easing` | motion-design-system, remotion-core |
| `framemd5` | ffmpeg-media-ops, video-characterization |
| `lufs` | audio-captions-sync, ffmpeg-media-ops, motion-design-system |
| `nvenc` | ffmpeg-media-ops, remotion-render-pipeline |
| `prores` | ffmpeg-media-ops, manim-bridge |
| `run these in parallel` | parallel-worktrees, wave-planning |
| `token budget` | llm-authoring, meta-skill-consolidate |
| `true peak` | audio-captions-sync, ffmpeg-media-ops, motion-design-system |
| `word timestamps` | audio-captions-sync, tts-voiceover |

### Todos os gatilhos

| Gatilho | Skill |
|---|---|
| `--frames` | remotion-render-pipeline |
| `--gl` | remotion-render-pipeline |
| `// aberto` | uncertainty-ledger |
| `9:16` | motion-design-system |
| `@remotion/media` | remotion-core |
| `ab-` | uncertainty-ledger |
| `acceptance criteria` | falsifiable-gates |
| `alinhamento forcado` | audio-captions-sync |
| `alpha channel` | ffmpeg-media-ops, manim-bridge |
| `angle` | remotion-render-pipeline |
| `animar codigo` | code-animation |
| `animate code` | code-animation |
| `antes de concluir` | adversarial-review |
| `anyof` | llm-authoring |
| `ao concluir o card` | meta-skill-evolution |
| `api key` | asset-acquisition |
| `aprendi que` | meta-skill-evolution |
| `aprovar o frame` | video-characterization |
| `asr` | audio-captions-sync |
| `asset cache` | asset-acquisition |
| `assume` | uncertainty-ledger |
| `attribution` | asset-acquisition |
| `atualiza a skill` | meta-skill-evolution |
| `audio library` | asset-acquisition |
| `azure speech` | tts-voiceover |
| `b-roll` | asset-acquisition |
| `background music` | asset-acquisition |
| `barrier` | parallel-worktrees |
| `baseline` | video-characterization |
| `bitexact` | ffmpeg-media-ops |
| `bundle cache` | remotion-render-pipeline |
| `bytes deterministicos no ffmpeg` | ffmpeg-media-ops |
| `cache_control` | llm-authoring |
| `calculatemetadata` | remotion-core |
| `caminho critico` | wave-planning |
| `caption` | audio-captions-sync |
| `caracteres por segundo` | audio-captions-sync |
| `caracterização` | video-characterization |
| `cartesia` | tts-voiceover |
| `chatterbox` | tts-voiceover |
| `clean up skills` | meta-skill-consolidate |
| `clonagem de voz` | tts-voiceover |
| `close this item` | uncertainty-ledger |
| `code overflows the frame` | code-animation |
| `code snippet` | code-animation |
| `code transition` | code-animation |
| `codegen` | timeline-manifest |
| `codehike` | code-animation |
| `combinechunks` | remotion-render-pipeline |
| `company license` | remotion-core |
| `composition` | remotion-core |
| `composition wave` | wave-planning |
| `concat demuxer` | ffmpeg-media-ops |
| `concurrency` | remotion-render-pipeline |
| `consolidar as skills` | meta-skill-consolidate |
| `consolidate skills` | meta-skill-consolidate |
| `content id` | asset-acquisition |
| `contexto fresco` | adversarial-review |
| `contract` | timeline-manifest |
| `contraste` | motion-design-system |
| `corrige isso` | project-router |
| `cost per video` | llm-authoring |
| `cps` | audio-captions-sync |
| `credits` | asset-acquisition |
| `crf` | ffmpeg-media-ops, remotion-render-pipeline |
| `cria a cena` | project-router |
| `cria uma skill` | meta-skill-evolution |
| `critical path` | wave-planning |
| `cube` | remotion-core |
| `damping ratio` | motion-design-system |
| `data contract` | timeline-manifest |
| `deduplicate` | meta-skill-consolidate |
| `definition of done` | falsifiable-gates |
| `delayrender` | remotion-core |
| `dependency graph` | wave-planning |
| `design system` | motion-design-system |
| `dessincronia` | audio-captions-sync |
| `determinismo` | video-characterization |
| `deterministic output` | llm-authoring |
| `disable_caching` | manim-bridge |
| `download asset` | asset-acquisition |
| `drift` | audio-captions-sync |
| `dtw` | audio-captions-sync |
| `ducking` | audio-captions-sync |
| `duracao de transicao` | motion-design-system |
| `duration` | timeline-manifest |
| `easing` | motion-design-system, remotion-core |
| `ebu r128` | ffmpeg-media-ops |
| `ebur128` | ffmpeg-media-ops |
| `elevenlabs` | tts-voiceover |
| `encode` | ffmpeg-media-ops |
| `encoder de hardware` | ffmpeg-media-ops |
| `escala tipografica` | motion-design-system |
| `evolucao` | meta-skill-evolution |
| `exit 0` | falsifiable-gates |
| `fade` | audio-captions-sync |
| `falsifiable question` | adversarial-review |
| `fan-out` | wave-planning |
| `ffmpeg` | ffmpeg-media-ops |
| `ffprobe` | ffmpeg-media-ops |
| `ffprobe check` | falsifiable-gates |
| `fixture` | video-characterization |
| `flaky render` | video-characterization |
| `flash` | motion-design-system |
| `flicker` | remotion-core |
| `forced alignment` | audio-captions-sync |
| `fotossensibilidade` | motion-design-system |
| `fps` | timeline-manifest |
| `framemd5` | ffmpeg-media-ops, video-characterization |
| `framerange` | remotion-render-pipeline |
| `gate` | falsifiable-gates |
| `gc skills` | meta-skill-consolidate |
| `gif` | asset-acquisition |
| `giphy` | asset-acquisition |
| `git diff --exit-code` | falsifiable-gates |
| `git worktree` | parallel-worktrees |
| `golden master` | video-characterization |
| `graph validator` | wave-planning |
| `graphics safe` | motion-design-system |
| `grep -l` | falsifiable-gates |
| `guarda na memoria` | meta-skill-evolution |
| `hardware acceleration` | remotion-render-pipeline |
| `headless render` | manim-bridge |
| `highlight.js` | code-animation |
| `how many agents at once` | parallel-worktrees |
| `implementa` | project-router |
| `import audio from remotion` | remotion-core |
| `insert a new task` | wave-planning |
| `integrate the branches` | parallel-worktrees |
| `interpolate` | remotion-core |
| `it is green` | falsifiable-gates |
| `json schema` | timeline-manifest |
| `json_schema` | llm-authoring |
| `kokoro` | tts-voiceover |
| `layout none` | remotion-core |
| `learned this` | meta-skill-evolution |
| `legenda` | audio-captions-sync |
| `legibilidade` | motion-design-system |
| `let the model write the scene` | llm-authoring |
| `licenca do motor de highlight` | code-animation |
| `limiar de diff` | video-characterization |
| `lineartiming` | remotion-core |
| `locucao` | tts-voiceover |
| `loudness` | audio-captions-sync |
| `loudnorm` | ffmpeg-media-ops |
| `lufs` | audio-captions-sync, ffmpeg-media-ops, motion-design-system |
| `magic move` | code-animation |
| `make the render faster` | remotion-render-pipeline |
| `manifest` | timeline-manifest |
| `manifest generation` | llm-authoring |
| `manifesto` | timeline-manifest |
| `manim` | manim-bridge |
| `manim_executor` | manim-bridge |
| `mark as confirmed` | uncertainty-ledger |
| `md5 of video` | ffmpeg-media-ops |
| `measuretext` | code-animation |
| `media_dir` | manim-bridge |
| `meme` | asset-acquisition |
| `merge the wave` | parallel-worktrees |
| `merge two skills` | meta-skill-consolidate |
| `migration` | timeline-manifest |
| `monospace font` | code-animation |
| `monta o pipeline` | project-router |
| `motion-invariants` | motion-design-system |
| `musica de fundo` | audio-captions-sync |
| `nao tem skill pra isso` | meta-skill-evolution |
| `narracao` | tts-voiceover |
| `near-miss` | meta-skill-consolidate |
| `needs the real environment` | uncertainty-ledger |
| `negative probe` | falsifiable-gates |
| `new skill` | meta-skill-evolution |
| `next wave` | project-router |
| `no skill covers this` | meta-skill-evolution |
| `node` | timeline-manifest |
| `node --test` | falsifiable-gates |
| `non-deterministic render` | remotion-core |
| `nvenc` | ffmpeg-media-ops, remotion-render-pipeline |
| `o smoke passaria` | adversarial-review |
| `octopus merge` | parallel-worktrees |
| `offthreadvideo` | remotion-core |
| `onda de composicao` | wave-planning |
| `one agent per card` | parallel-worktrees |
| `open item` | uncertainty-ledger |
| `openverse` | asset-acquisition |
| `otio` | timeline-manifest |
| `out of sync` | audio-captions-sync |
| `output_config` | llm-authoring |
| `overshoot` | motion-design-system |
| `paleta` | motion-design-system |
| `parallelize these cards` | wave-planning |
| `partial_movie_files` | manim-bridge |
| `pausa` | tts-voiceover |
| `pexels` | asset-acquisition |
| `phoneme` | tts-voiceover |
| `piper` | tts-voiceover |
| `pix_fmt` | ffmpeg-media-ops |
| `pixabay` | asset-acquisition |
| `pixel diff` | video-characterization |
| `plan the waves` | wave-planning |
| `planeja a onda` | project-router |
| `polly` | tts-voiceover |
| `por onde comeco` | project-router |
| `premount` | remotion-core |
| `prep commit` | wave-planning |
| `presentation` | remotion-core |
| `promote this finding` | meta-skill-evolution |
| `prompt caching` | llm-authoring |
| `pronuncia` | tts-voiceover |
| `prores` | ffmpeg-media-ops, manim-bridge |
| `prosodia` | tts-voiceover |
| `prove que não quebrou` | adversarial-review |
| `provisional decision` | uncertainty-ledger |
| `pushcut` | remotion-core |
| `pydantic` | timeline-manifest |
| `pytest -k` | falsifiable-gates |
| `qsv` | ffmpeg-media-ops |
| `qtrle` | manim-bridge |
| `qual skill uso` | project-router |
| `que onda` | wave-planning |
| `random seed` | remotion-core |
| `rate limit` | asset-acquisition |
| `re-baseline` | video-characterization |
| `reaction` | asset-acquisition |
| `received` | video-characterization |
| `reels` | motion-design-system |
| `refute isso` | adversarial-review |
| `regressão visual` | video-characterization |
| `remotion license` | remotion-core |
| `remux` | ffmpeg-media-ops |
| `render in chunks` | remotion-render-pipeline |
| `render out of memory` | remotion-render-pipeline |
| `render preset` | remotion-render-pipeline |
| `render the video` | remotion-render-pipeline |
| `render twice` | falsifiable-gates |
| `render twice and diff` | adversarial-review |
| `renderer opengl` | manim-bridge |
| `renderiza` | project-router |
| `renders differ between machines` | remotion-render-pipeline |
| `renumber waves` | wave-planning |
| `reproducible generation` | llm-authoring |
| `retry the prompt` | llm-authoring |
| `review this diff` | adversarial-review |
| `revisão adversarial` | adversarial-review |
| `roda o card` | project-router |
| `roteou pra skill errada` | meta-skill-consolidate |
| `routing eval` | meta-skill-consolidate |
| `royalty free` | asset-acquisition |
| `run card` | project-router |
| `run these in parallel` | parallel-worktrees, wave-planning |
| `safe area` | motion-design-system |
| `salva isso` | meta-skill-evolution |
| `sample rate` | ffmpeg-media-ops |
| `save this knowledge` | meta-skill-evolution |
| `scene render` | manim-bridge |
| `schema` | timeline-manifest |
| `seed` | tts-voiceover |
| `sequence` | remotion-core |
| `series` | remotion-core |
| `shiki` | code-animation |
| `shorts` | motion-design-system |
| `should we document this` | meta-skill-evolution |
| `sidechaincompress` | ffmpeg-media-ops |
| `silencedetect` | ffmpeg-media-ops |
| `sincronia` | audio-captions-sync |
| `skills overlap` | meta-skill-consolidate |
| `snappy` | motion-design-system |
| `snapshot` | video-characterization |
| `soundtrack` | asset-acquisition |
| `speech marks` | tts-voiceover |
| `speech synthesis` | tts-voiceover |
| `spring` | remotion-core |
| `spring preset` | motion-design-system |
| `springtiming` | remotion-core |
| `srt` | audio-captions-sync |
| `ssml` | tts-voiceover |
| `stale provenance` | meta-skill-consolidate |
| `start this task` | project-router |
| `sticker` | asset-acquisition |
| `stock photo` | asset-acquisition |
| `stock video` | asset-acquisition |
| `stream copy` | ffmpeg-media-ops |
| `stream duration` | ffmpeg-media-ops |
| `strict mode` | llm-authoring |
| `structured output` | llm-authoring |
| `subtitle` | audio-captions-sync |
| `swangle` | remotion-render-pipeline |
| `syntax highlight` | code-animation |
| `t_dtw` | audio-captions-sync |
| `tabela de ondas` | wave-planning |
| `teardown the worktrees` | parallel-worktrees |
| `temperature 0` | llm-authoring |
| `tenor` | asset-acquisition |
| `tiktok` | motion-design-system |
| `timeline` | timeline-manifest |
| `timestamp por palavra` | audio-captions-sync |
| `todo in the code` | uncertainty-ledger |
| `token budget` | llm-authoring, meta-skill-consolidate |
| `token de design` | motion-design-system |
| `token transitions` | code-animation |
| `transcode` | ffmpeg-media-ops |
| `transcricao` | audio-captions-sync |
| `transition` | remotion-core |
| `transitionseries` | remotion-core |
| `transparent` | manim-bridge |
| `trecho de codigo` | code-animation |
| `trim silence` | ffmpeg-media-ops |
| `true peak` | audio-captions-sync, ffmpeg-media-ops, motion-design-system |
| `tts` | tts-voiceover |
| `typing effect` | code-animation |
| `unblock on access day` | uncertainty-ledger |
| `unsplash` | asset-acquisition |
| `update the skill` | meta-skill-evolution |
| `use the gpu` | remotion-render-pipeline |
| `usecurrentframe` | remotion-core |
| `vaapi` | ffmpeg-media-ops |
| `vale a pena guardar` | meta-skill-evolution |
| `validate-graph` | wave-planning |
| `validator` | timeline-manifest |
| `valor magico` | motion-design-system |
| `verifier` | falsifiable-gates |
| `video bitrate` | remotion-render-pipeline |
| `video com alfa` | ffmpeg-media-ops |
| `visual regression` | video-characterization |
| `vitest -t` | falsifiable-gates |
| `voice cloning` | tts-voiceover |
| `voiceover` | tts-voiceover |
| `volume` | audio-captions-sync |
| `voz` | tts-voiceover |
| `wait for all the agents` | parallel-worktrees |
| `watermark` | asset-acquisition |
| `wave` | parallel-worktrees |
| `wave table` | wave-planning |
| `wcag` | motion-design-system |
| `we don't know yet` | uncertainty-ledger |
| `webm` | manim-bridge |
| `which skill` | project-router |
| `which skill should have loaded` | meta-skill-consolidate |
| `which wave` | wave-planning |
| `whisper` | audio-captions-sync |
| `whisper.cpp` | audio-captions-sync |
| `who answers this` | uncertainty-ledger |
| `who owns this file` | parallel-worktrees |
| `why is my render slow` | remotion-render-pipeline |
| `word timestamps` | audio-captions-sync, tts-voiceover |
| `wordboundary` | tts-voiceover |
| `would the test pass with a black frame` | adversarial-review |
| `would the test pass with a silent track` | adversarial-review |
| `write it to memory` | meta-skill-evolution |
| `write_to_movie` | manim-bridge |
| `xtts` | tts-voiceover |
| `yuva420p` | manim-bridge |
| `zod` | timeline-manifest |
