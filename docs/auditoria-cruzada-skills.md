# Auditoria cruzada das 20 skills

> **Dono exclusivo deste arquivo:** o auditor cruzado. Nenhuma skill o edita; nenhum agente de
> skill escreve aqui. Ele existe porque **irmãos da mesma onda são cegos entre si por construção**
> — vinte agentes escreveram vinte `SKILL.md` sem ver um ao outro, e é exatamente essa cegueira
> que fez o programa de origem perder 95 testes fora do CI em silêncio.
>
> **Precedência aplicada em todo veredito abaixo** (não é opinião deste arquivo; é decisão
> registrada em `PROGRAMA.md:19` e `README.md`):
> `PROGRAMA.md` vence sobre **plano** · `docs/00-panorama-verificado.md` vence sobre **fato** ·
> `docs/PLAYBOOK-REFERENCIA.md` vence sobre **método**, subordinado ao PROGRAMA ·
> `Roadmap Editor de Vídeo IA.md` é panorama **histórico**.
>
> **Contexto de programa que condiciona toda leitura de licença:** `I-01` / ADR-0003 registrou o
> uso como **pessoal**. Cláusula de terceiro condicionada a *"for commercial use"* **não bloqueia
> card algum**. O conhecimento sobre essas cláusulas está **correto e deve ser preservado com a
> condição de escopo escrita** — é a condição que o torna verdadeiro. Nenhum achado abaixo pede
> remoção desse conteúdo, e nenhuma skill foi encontrada afirmando que um card está bloqueado por
> licença comercial (verificado: `asset-acquisition`, `code-animation`, `remotion-core`,
> `tts-voiceover` e `project-router` carregam a condição corretamente).

---

## 1. Contradições entre skills

Cada linha foi verificada contra o panorama e/ou executada nesta máquina. A coluna **ação** é
escrita para caber em **uma edição** no arquivo da skill perdedora.

### 1.1 Contradições confirmadas

| # | skill A | afirma | skill B | afirma | quem está certa segundo a precedência | ação (1 edição) |
|---|---|---|---|---|---|---|
| **C-01** | `remotion-core` (`## O que esta skill NÃO cobre`) | «`<Audio>`, as duas pipelines de áudio … → `audio-captions-sync`» | `audio-captions-sync` + `tts-voiceover` | «Componente de áudio a importar … **lint contra `import {Audio} from 'remotion'`** → `remotion-core`» | **Nenhuma.** É delegação circular: A→B e B→A sobre o mesmo objeto. Verificado mecanicamente: `remotion-core` tem **0 ocorrências** de `Html5Audio` e **0** de `import {Audio}`. A regra de lint que o panorama torna obrigatória (R03-02·R03-04, 2-0, *"OBRIGA uma regra de lint proibindo `import {Audio} from 'remotion'`"*) **não tem dono** | `remotion-core` absorve o par `<Audio>@remotion/media` × `Audio` legado de `remotion` + a regra de lint (é fato de API de componente, não de sincronia), e troca a linha de `NÃO cobre` para «alinhamento, paginação e ducking → `audio-captions-sync`» |
| **C-02** | `remotion-render-pipeline` + `code-animation` | «`calculateMetadata` → `remotion-core`» | `remotion-core` | não menciona `calculateMetadata` em nenhuma linha (**0 ocorrências**) | **Nenhuma** — delegação para vazio. Idem `<OffthreadVideo>`: `manim-bridge` e `ffmpeg-media-ops` roteiam para `remotion-core`, que tem **0 ocorrências** do componente | `remotion-core` ganha um parágrafo de `calculateMetadata` (roda **uma vez, em aba separada**, antes do render — R09-15, 2-0) e uma linha sobre `<OffthreadVideo>` extrair frame fora do browser (R07-12, 2-0). Sem isso, três skills apontam para um buraco |
| **C-03** | `llm-authoring` | semântica de exit code de hook — **Placar (2-0)** | `falsifiable-gates`, `project-router`, `parallel-worktrees`, `meta-skill-consolidate`, `adversarial-review` | mesma afirmação — **Placar (3-0)** | **B.** O panorama registra R06-24 como **(3-0)** (`docs/00-panorama-verificado.md:118`). O panorama vence sobre fato | `llm-authoring`: trocar `**Placar (2-0)**` por `**Placar (3-0)** — R06-24` na linha do hook |
| **C-04** | `adversarial-review` (tabela «A fonte veio da rede?») | `@remotion/google-fonts` aponta para `fonts.gstatic.com` — **(3-0) R09-25** | `remotion-core` + `code-animation` | mesma afirmação — **(2-0)**, e `remotion-core` escreve literalmente: *"Não herde o (3-0) da linha 105: aquele placar é da **licença** das fontes (OFL), não da **entrega pela rede**"* | **B.** Verificado no panorama: `:105` (R09-25, **3-0**) é sobre licença OFL; a entrega por CDN é linha de **refutação** em `:390`, **sem coluna de placar** | `adversarial-review`: trocar `(3-0) R09-25` por `(2-0) · docs/00-panorama-verificado.md:390` naquela célula |
| **C-05** | `wave-planning` (norma explícita) | *"**Não cite `PROGRAMA.md` por número de linha** num card, num handoff ou **nesta skill**. Cite `§III-N`"* — e cumpre: **0** pinos de linha | 14 skills | citam `PROGRAMA.md`/panorama por **número de linha**: `adversarial-review` 91, `video-characterization` 61, `timeline-manifest` 44, `asset-acquisition` 38, `falsifiable-gates` 36, `uncertainty-ledger` 31, `meta-skill-evolution` 22, `tts-voiceover` 21, `project-router` 12, … | **A**, e não por gosto: `PROGRAMA.md:1764-1790` mede **438 âncoras `arquivo:linha`** e declara que a forma **não sobrevive** a uma edição do alvo. Minha contagem independente: **438 pinos**. O número bate exatamente | Não é conserto de skill: é o card `T-10` (`check_staleness.py`) recusando `arquivo:linha` quando o alvo é `PROGRAMA.md` ou o panorama. Enquanto ele não existe, ver **§4** (um bloco já está deslocado) |
| **C-06** | `timeline-manifest` | «se o manifesto é portátil entre os dois fornecedores é **ADR-0014**, registrada no card `F0-02` (`PROGRAMA.md:2544`)» (2×) | `PROGRAMA.md` | **`ADR-0014` não existe.** Os ADRs de 4 dígitos registrados são `0001, 0002, 0003, 0004, 0008, 0009, 0010`. E `PROGRAMA.md:2544` é a linha «- **Reafirma explicitamente:** \<ADR §n, §n\>» do **template** de ADR no Apêndice C | **B.** `PROGRAMA.md` vence sobre plano. A semente é `P-08` no panorama (`:732`), que a mapeia para **ADR-008**, não 0014 | `timeline-manifest`: trocar as duas ocorrências de `ADR-0014` por «a ADR da semente `P-08` (`docs/00-panorama-verificado.md:732`), **ainda sem número no registro do PROGRAMA**» e remover o pin `PROGRAMA.md:2544` |
| **C-07** | `audio-captions-sync` | AAC tem **512 amostras de priming** — **(2-0)**, sem ressalva | `ffmpeg-media-ops` | «A Apple diz que o priming é fixo em **2112** … **Os dois números (512 e 2112) divergem entre as fontes**» — e resolve sem depender de qual é o certo (PCM até o master) | **Empate técnico bem tratado por B.** O panorama carrega os dois (R03-22/23 = 2-0 para 512; R10-22 = 1-0 para 2112). `remotion-render-pipeline` também usa 2112, corretamente marcado (1-0) | `audio-captions-sync`: acrescentar meia linha «(a Apple publica **2112**; a divergência está registrada em `ffmpeg-media-ops` e **não muda a decisão**: PCM até o master)» |
| **C-08** | `falsifiable-gates` (`## Quando carregar`) | *"**Não carregue** para escolher o artefato de baseline, o limiar de diff ou a chave do snapshot — isso é `video-characterization`"* | `falsifiable-gates` (corpo) | carrega, no próprio corpo, **9 regras** desse escopo: não afrouxar o limiar, `cp received/ approved/`, frame 0 como golden master, baseline a partir do Studio, média de SSIM, `allowSizeMismatch`, `--concurrency=1` para flicker, `psnr/ssim` exigem mesma resolução, duração de container × stream | **A contra si mesma.** É violação da própria fronteira negativa, e é a maior sobreposição de conteúdo do catálogo (≈9 regras duplicadas com `video-characterization`) | `falsifiable-gates`: manter apenas a **forma** do gate (o comando, a sonda, o denominador) e substituir as 9 regras pelo ponteiro nominal; ou reescrever a fronteira negativa para admitir a duplicação. As duas saídas são de uma edição — a proibida é deixar as duas versões vivas |
| **C-09** | `asset-acquisition` | «o **formato do campo de asset** no manifesto → `timeline-manifest`», e afirma que o campo `license` **não é opcional** | `timeline-manifest` | **1 ocorrência** da palavra `asset`, **0** de `license`, **0** de `procedência`; a seção `NÃO cobre` não menciona `asset-acquisition` | **Nenhuma** — campo sem dono. O invariante `C7` (*"nada de URL no manifesto resolvido; só hash de conteúdo"*, `PROGRAMA.md:109`) é norma reinjetada por hook e **não aparece no schema** | `timeline-manifest`: uma linha no schema declarando o nó de asset (`hash` obrigatório, `license` obrigatório, `fetchedFrom` como procedência e **não** como caminho de leitura) e citando `asset-acquisition` como dona da regra |
| **C-10** | `remotion-render-pipeline` | «licenciamento do Remotion → **o panorama verificado**» | `asset-acquisition` + `code-animation` | «A licença do próprio Remotion → **`remotion-core`**» | **B.** `remotion-core` é a dona declarada no contrato (`docs/CONTRATO-DE-SKILL.md`, S09) e carrega a seção inteira de licença | `remotion-render-pipeline`: trocar «→ o panorama verificado» por «→ `remotion-core`». Rotear para um documento em vez de para a skill dona faz o router nunca carregar a skill |

### 1.2 O que **não** é contradição (verificado e registrado, para não ser "consertado" na próxima onda)

| tema | leitura |
|---|---|
| `concurrency` default | `remotion-core` e `remotion-render-pipeline` escrevem **o mesmo** `Math.round(Math.min(8, Math.max(1, cores/2)))`, teto rígido **8**. Consistente com R05-09·10·11. Nenhuma skill escreve "metade dos cores" |
| `durationRestThreshold` | `remotion-core` e `motion-design-system` escrevem **0.005**; ambas registram que 0.001 é ajuste de **timeline**, não estético. Consistente com R02-03 |
| `interpolate()` default | todas as skills que tocam no assunto escrevem **`extend`**, não `clamp`, e tratam como **gate**. Consistente com R02-18 |
| LUFS e true peak | `audio-captions-sync`, `ffmpeg-media-ops`, `motion-design-system` e `tts-voiceover` escrevem **(5-0) "não existe alvo único"** e **−1 dBTP (3-0)**. Quatro skills, zero divergência numérica |
| Manim `-t` → `.mov` | `manim-bridge`, `falsifiable-gates`, `project-router` e `video-characterization` escrevem `.mov` `qtrle/argb`, **não ProRes, não webm**; webm exige `--format=webm`. Consistente |
| `-qk`/`-qp` | `manim-bridge` e `video-characterization` escrevem `p`=2560×1440 e `k`=3840×2160 — invertido em relação ao folclore, e **as duas** mandam assertar `pixel_width/height` do arquivo |
| `pushCut()` / `@remotion/sfx` / `@remotion/code` | nenhuma skill trata `pushCut()` como alucinação; `@remotion/sfx` é sempre descrito como **URLs remotas**; `@remotion/code` é ausência provada por evidência positiva. As três refutações do programa estão corretamente absorvidas |
| `--buffer-size` | só `remotion-render-pipeline` fala dela, e escreve os **dois** desfechos (`required` lança · `if-possible` desliga a aceleração em silêncio). Nenhuma outra skill recomenda a receita refutada |
| 6 camadas × «pirâmide de quatro camadas» | `video-characterization` diz **seis**; o **título** de `docs/00-panorama-verificado.md:1008` diz «quatro», mas o corpo enumera **Camada 0 a 5**. A skill está certa contra o conteúdo; o defeito é do título do panorama, e é do dono dele |

---

## 2. Sobreposição de gatilho — o risco real de rotear com 20 skills

### 2.1 Confirmação independente do número do catálogo

Recontei do zero, a partir do frontmatter de cada `SKILL.md`, sem ler `catalog.md`:

| medida | valor | conferência |
|---|---|---|
| termos de gatilho **únicos** declarados | **344** | ✅ bate com `catalog.md:65` |
| ambíguos (2+ donos) | **14** (4,07%) | ✅ bate, e a lista nominal é **idêntica** |
| ocorrências totais (contando cada dono) | **360** | — |
| termos com **3** donos | **2** (`lufs`, `true peak`) | — |
| skill com mais participações em ambiguidade | `ffmpeg-media-ops` — **10 dos 14** | ✅ bate com `meta-skill-consolidate` |

Diferença metodológica encontrada e resolvida: a `description` de `remotion-core` contém a palavra
`trigger` **antes** da lista (`…the scope-conditioned license trigger.`), o que faz um extrator
ingênuo capturar `"Remotion"` e `"determinism"` como gatilhos e reportar **346**. O gerador do
catálogo não cai nisso. **O 344 está certo.**

**Onde o número engana, e isso é o achado:** o índice casa **termo literal**. Ele não vê
(a) substring — `token` engole `token budget` e `token transitions`; (b) sinônimo — quatro literais
diferentes para *determinismo*; (c) normalização — `json schema` × `json_schema`. **14 é piso, não
total.** As oito linhas de §2.3 são colisões reais que o índice reporta como zero.

### 2.2 Desambiguação dos 14 — uma proposta por linha, acionável

Regra usada: **fica com o termo quem tem o artefato escrito** (a flag, o filtro, a tabela), não
quem tem o assunto.

| gatilho | fica com | por quê | a outra passa a usar |
|---|---|---|---|
| `alpha channel` | `ffmpeg-media-ops` | é dona da matriz container × codec × `pix_fmt` × quem reproduz | `manim-bridge` → `alfa do manim` |
| `crf` | `ffmpeg-media-ops` | dona do fato (3-0) "nenhum encoder de hardware tem `crf`" | `remotion-render-pipeline` → `--crf` (a flag, com os dois hifens) |
| `ducking` | `audio-captions-sync` | dona do envelope autorado avaliado como `volume={(f)=>…}` | `ffmpeg-media-ops` → só `sidechaincompress` (já declarado) |
| `duration` | **nenhuma** — genérico demais | casa 3 domínios e nenhum é o dono | `ffmpeg-media-ops` → `stream duration`; `timeline-manifest` → `durationInFrames` |
| `easing` | `motion-design-system` | easing é **token de design**, e a grade de durações é dela | `remotion-core` → `Easing.bezier` |
| `hardware acceleration` | `remotion-render-pipeline` | `--hardware-acceleration` é flag da CLI do Remotion | `ffmpeg-media-ops` → `encoder de hardware` |
| `lufs` | `ffmpeg-media-ops` | é quem **mede** (`ebur128`, `loudnorm` two-pass) | `audio-captions-sync` → `loudness da locucao`; `motion-design-system` → `targetLufs` (nome da chave) |
| `nvenc` | `ffmpeg-media-ops` | dona da matriz por API e dos aliases depreciados de `-rc` | `remotion-render-pipeline` → `sessoes de encode simultaneas` |
| `prores` | `ffmpeg-media-ops` | dona de `prores_ks`, `-profile 4444`, `-alpha_bits` | `manim-bridge` → `transcode pos-manim` |
| `run these in parallel` | `wave-planning` | o DAG decide **quando**; a pergunta com lista de cards é escalonamento | `parallel-worktrees` → `isolar estes cards` (já tem `one agent per card`) |
| `token budget` | `llm-authoring` | orçamento de tokens **da chamada** é dela | `meta-skill-consolidate` → `orcamento de description` |
| `true peak` | `ffmpeg-media-ops` | mesma razão de `lufs` — quem mede | `audio-captions-sync` → `clipping da mixagem`; `motion-design-system` → `maxTruePeakDbtp` |
| `word timestamps` | `tts-voiceover` | é o **critério que decide o provedor** e apaga ou cria o subsistema de ASR | `audio-captions-sync` → `word timestamps do whisper` |
| `yuva420p` | `manim-bridge` | é o gate literal do handoff (`ffprobe … pix_fmt == yuva420p`) | `ffmpeg-media-ops` → só `pix_fmt` (já declarado) |

### 2.3 As colisões que o índice **não** vê — e que custam mais

| colisão | tipo | proposta |
|---|---|---|
| `token` (motion-design-system) engole `token budget` (llm-authoring, meta-skill-consolidate) e `token transitions` (code-animation) | substring | `motion-design-system` → `token de design` |
| `wave` (parallel-worktrees) engole `wave table`, `which wave`, `composition wave` (wave-planning) | substring | `parallel-worktrees` → `barreira de onda` |
| `manifest` (timeline-manifest) engole `manifest generation` (llm-authoring) | substring | `llm-authoring` → `gerar manifesto com LLM` |
| `seed` (tts-voiceover) engole `random seed` (remotion-core) e colide com `--seed` do Manim | substring + 3º domínio mudo | `tts-voiceover` → `seed do TTS`; `manim-bridge` acrescenta `--seed do manim` |
| `json schema` (timeline-manifest) × `json_schema` (llm-authoring) | normalização (`_`↔espaço) | `llm-authoring` → `output_config json_schema` |
| `threshold` (video-characterization) × `threshold` do `sidechaincompress`/`silencedetect` (ffmpeg-media-ops) × `durationRestThreshold` (remotion-core) | homônimo em 3 domínios | `video-characterization` → `limiar de diff` |
| `transparent` (manim-bridge) × `transparent video` (ffmpeg-media-ops) | substring | `ffmpeg-media-ops` → `video com alfa` |
| `determinismo` (video-characterization) × `deterministic render` (ffmpeg-media-ops) × `deterministic output` (llm-authoring) × `non-deterministic render` (remotion-core) | **4 literais, 1 conceito, ambiguidade medida = 0** | prefixar por domínio: `determinismo de pixel`, `bytes deterministicos no ffmpeg`, `saida deterministica de LLM`, `flicker entre abas` |

### 2.4 O que falta medir (e por que o índice não substitui)

`meta-skill-consolidate` já define o método certo (matriz 20×20, ≥3 gatilhos + ≥3 **quase-erros
adjacentes** por skill, quase-erro escrito por quem **não** é dono, três métricas com denominador).
Nada disso rodou. **`0 ambíguos` num índice regenerado significaria "nenhum termo repetido", não
"nenhuma colisão"** — e as oito linhas de §2.3 provam o ponto agora, sem eval.

---

## 3. Lacunas — conhecimento do panorama que nenhuma skill carrega

Método: varredura mecânica de §1 (confirmados), §2 (prováveis), §5 (troca barata) e §7 (ledger)
contra o texto das 20 skills, por id de claim, por id `AB-nnn` e por palavra-chave.

**Números brutos:**

| medida | valor |
|---|---|
| ids `AB-nnn` do §7 do panorama | 75 (+2 fora de faixa citados no corpo) |
| `AB-nnn` citados por **alguma** skill | 35 |
| `AB-nnn` que **nenhuma** skill cita | **42** |
| ids de claim (`R##-nn`, `L0n-Cnn`) no panorama | 338 |
| ids de claim citados por alguma skill | 102 |

Os 42 `AB` sem menção nenhuma: `AB-003, 004, 005, 006, 007, 009, 010, 011, 012, 014, 015, 018,
020, 021, 022, 024, 026, 027, 028, 029, 030, 031, 032, 034, 035, 037, 038, 039, 042, 043, 044,
046, 047, 048, 051, 052, 053, 054, 056, 057, 069, 074`.

### 3.1 Lacunas que são **skill faltando** (nenhuma das 20 tem escopo para o assunto)

| lacuna (fonte no panorama) | por que nenhuma skill cobre | veredito |
|---|---|---|
| **Bootstrap e provisionamento de ambiente**: glibc ≥ 2.35 (`AB-001`), as 14 libs do Chrome Headless Shell (`AB-003`), `libasound2` × `libasound2t64` (`AB-004`), Node 22 sem `engines` publicado (`AB-005`, R01-16), `cmake` para whisper.cpp ≥1.7.3 (`AB-006`), FFmpeg empacotado × do sistema (`AB-007`), disco por worktree e por Chrome (`AB-010`, `AB-011`, `AB-012`), `libvmaf` ausente (`AB-014`), `chromaprint` (`AB-015`) | `parallel-worktrees` cobre *criar* worktree e o preflight **em forma**, mas nenhuma skill carrega o **inventário de dependência de sistema** nem a regra "ausência é vermelho, não pulado". Hoje esse conhecimento só existe no panorama | **skill faltando** — `environment-preflight` (tier `metodo`), dona de: probe de biblioteca, `tool-versions.lock`, e a regra de que ferramenta ausente reprova nomeada |
| **Ecossistema de skills como dependência externa**: `npx skills` é do **vercel-labs**, MIT, executado com `--yes` (R06-06, 3-0); `remotion-dev/skills` tem 12 skills e **não declara licença** (R06-05); `@remotion/mcp` está **depreciado** com desligamento anunciado (R06-09); o plugin oficial **duplica** as mesmas 12 skills (R06-13); o campo `version:` do frontmatter deles está **fora da spec** e quebra o empacotamento para claude.ai (R06-07); §5.1 «Modo de instalação das skills» (`SKILLS_MODE=cli` × `vendor`) | Varredura: `vercel` = **0 skills**, `claude-code-plugin` = **0**, `version:` = **0**, `npx skills` = **0**, `SKILLS_MODE` = **0**. `mcp` aparece 1× e em contexto não relacionado (`parallel-worktrees`). O único ponto tocado é a *rede* no `Q5` do `project-router` | **skill faltando** — `skill-supply-chain` (tier `meta`), dona da origem, do alvo de distribuição e do trade-off vendor × CLI |
| **Licença de peso de modelo de alinhamento**: `ctc-forced-aligner` com modelo default **CC-BY-NC 4.0**, MFA `portuguese_mfa` **CC BY 4.0**, NeMo Apache-2.0 só CTC, stable-ts *"paused indefinitely"* (R04-19, 3-0); e as licenças divergentes **dentro** do Remotion (`@remotion/captions` MIT × `install-whisper-cpp` licença Remotion × `@remotion/whisper-web` **UNLICENSED**, R04-10) | `tts-voiceover` cobre licença de peso **de TTS**; `audio-captions-sync` cobre a mecânica do whisper.cpp e **não** a licença. Varredura: `ctc-forced-aligner` = 0, `NeMo` = 0, `whisper-web` = 0 | **card do programa** — cabe em `F0-04`/`F5-06` (o gate de publicação já exige o campo de licença; falta a **lista** do lado do alinhador). Não precisa de skill nova: `tts-voiceover` já tem a seção certa e o escopo declarado |

### 3.2 Lacunas que são **card do programa** (a skill certa existe; o conhecimento é do card)

| lacuna | dona natural | card |
|---|---|---|
| Regra de lint contra `import {Audio} from 'remotion'` (R03-02·04, 2-0, *"OBRIGA uma regra de lint"*) — órfã por delegação circular (**C-01**) | `remotion-core` | `T-05` (hooks) escreve o lint; a regra entra na skill como fato |
| `calculateMetadata` como fronteira de determinismo (R09-15, 2-0) e `<OffthreadVideo>` extraindo frame fora do browser (R07-12, 2-0) — delegados para vazio (**C-02**) | `remotion-core` | nenhum card novo: é conteúdo de skill |
| Nó de asset no schema com `hash` + `license` + `fetchedFrom` obrigatórios; invariante `C7` sem representação no contrato (**C-09**) | `timeline-manifest` | `F0-02` (dono do contrato) |
| Manim CE 0.20.1 exige **Python ≥ 3.11** (R07-02, 2-0) — varredura: **0 skills** | `manim-bridge` | `F2-02` (o card do Manim já define a imagem) |
| ManimGL 1.7.2 × `manimlib` congelado em 0.2.0, CLIs **não intercambiáveis** (R07-25, 2-0) — `manimgl` aparece em 2 skills, mas nunca como "por que CE e não GL" | `manim-bridge` | conteúdo de skill |
| Licenças dos motores alternativos de highlight: Prism MIT, **highlight.js BSD-3-Clause** (a única não-MIT, muda o `NOTICE`), starry-night MIT, tree-sitter MIT (R09-23, 2-0) — varredura: `highlight.js` = **0**, `starry-night` = **0** | `code-animation` | conteúdo de skill |
| `@remotion/zod-types` é **Zod v4 desde 4.0.426** (`@remotion/zod-types-v3` para Zod 3) (R16-22·23) — varredura: `zod-types` = **0 skills** | `timeline-manifest` | `F0-02` |
| §5.2 **Local × Lambda para o render**: o obstáculo **não é custo** ($0,103/10 min HD) — é dependência de AWS, ausência de aceleração de hardware em Lambda/Cloud Run (R12-18) e Manim+LaTeX não caberem no runtime sem imagem custom | `remotion-render-pipeline` | conteúdo de skill (uma linha em `## O que esta skill NÃO cobre` já resolveria: hoje o assunto **não existe**) |
| Openverse `/v1/audio/` com filtro `license_type` como alternativa automatizável à YouTube Audio Library (R08-25) — `asset-acquisition` cita Openverse só para imagem e rate limit | `asset-acquisition` | `F2-04` |
| 15 dos 17 `AB` de render/Manim que ninguém cita (`AB-020, 021, 022, 024, 026..032, 034, 035, 037, 038, 042, 043`) — todos são **medições desta máquina** que decidem parâmetro de card (joelho da curva, RSS por aba, teto NVENC real, equivalência `combineChunks`, taxa de acerto do cache do Manim) | `remotion-render-pipeline` e `manim-bridge` | são **itens de ledger já abertos**; a lacuna é que as skills não os **citam**, então o executor não sabe que a decisão dele é provisória. Conserto: uma coluna «item aberto» ao lado de cada decisão provisória |
| `AB-046, 047, 048, 051..054` (offset A/V real por pipeline, clipping medido, whisper com mp3, erro por palavra do `--dtw`, `<mark>` no Chirp 3, `WordBoundary` no DragonHD, `loudnorm` convergindo) — `audio-captions-sync` e `tts-voiceover` **descrevem** esses testes em `## Não verificado` mas **não** os ancoram nos ids do ledger | `audio-captions-sync`, `tts-voiceover` | conserto de 1 linha por item: trocar «Fecha com: \<comando\>» por «Fecha `AB-0nn` com: \<comando\>» |
| `AB-056, 057` (CORS de asset remoto; RSS por GIF) — `asset-acquisition` **cita os dois pelo texto** e ancora só um | `asset-acquisition` | conserto de 1 linha |
| `AB-069, 074` (teto de 8 bloqueios do `Stop`; `429` com 6 sessões) — `parallel-worktrees` descreve o primeiro em `## Não verificado` **sem o id** | `parallel-worktrees` | conserto de 1 linha |

### 3.3 O que **não** é lacuna (verificado, para não gerar trabalho)

`AB-013` (TZ/LANG), `AB-016..019` (determinismo e ruído de base), `AB-025`/`AB-073` (teto de
agentes), `AB-033`/`AB-036`/`AB-040`/`AB-041`/`AB-044` (Manim), `AB-045` (teto da GIPHY),
`AB-049`/`AB-050` (whisper e Kokoro), `AB-055` (render offline), `AB-058..065` (comparador,
baselines, schema, Code Hike), `AB-066..068`/`AB-070..072`/`AB-075` — todos **citados nominalmente**
por pelo menos uma skill, com o comando que fecha. E as 22 linhas de §5.1 do panorama estão
cobertas por skill dona, **exceto** «Modo de instalação das skills» (§3.1) e «Import do componente
de áudio» (**C-01**).

---

## 4. Conformidade mecânica

Nenhum arquivo foi editado. Todas as colunas são saída de comando, reproduzíveis.

**O que passa em 20/20:** frontmatter fechado · `name` idêntico ao diretório · `metadata.type` em
`{knowledge, router, meta}` · `metadata.tier` presente · `verification_signal` presente · as **7
seções obrigatórias** presentes · corpo ≤ 500 linhas · **zero datas no corpo** (regra 7 do contrato,
a que mais derruba texto bem escrito) · `description` ≤ 1024 caracteres.

| skill | linhas (tot/corpo) | seções | placares | pinos internos → deslocados | `description` | veredito mecânico |
|---|---|---|---|---|---|---|
| `adversarial-review` | 295 / 287 | 7/7 ✅ | 33 | **91 → 49 pinos de `PROGRAMA.md` deslocados em bloco** | 726 | ❌ **reprova** |
| `asset-acquisition` | 382 / 374 | 7/7 ✅ | 41 | 38 → 4 sem eco (todos em `:2533..2546`, região de ADR) | 728 | ⚠️ reconferir 4 |
| `audio-captions-sync` | 408 / 400 | 7/7 ✅ | 48 | 15 → 0 | 950 | ⚠️ 1 pino truncado |
| `code-animation` | 338 / 330 | 7/7 ✅ | 28 | 4 → 1 | 718 | ✅ |
| `falsifiable-gates` | 393 / 385 | 7/7 ✅ | 19 | 36 → 4 | 609 | ⚠️ |
| `ffmpeg-media-ops` | 409 / 401 | 7/7 ✅ | 62 | 15 → 1 | 962 | ⚠️ corpo a 401 (aviso ≥400) |
| `llm-authoring` | 363 / 345 | 7/7 ✅ | 35 | 13 → 1 | 953 | ⚠️ |
| `manim-bridge` | 374 / 366 | 7/7 ✅ | 55 | 5 → 0; **28 pinos sem prefixo de repositório** | 807 | ❌ **reprova** |
| `meta-skill-consolidate` | 358 / 350 | 7/7 ✅ | 21 | 4 → 1 | 811 | ⚠️ |
| `meta-skill-evolution` | 309 / 291 | 7/7 ✅ | 27 | 22 → **7 sem eco, com melhor offset +36** | 1019 | ❌ **reprova** |
| `motion-design-system` | 407 / 389 | 7/7 ✅ | 29 | 13 → 0 | 1023 | ⚠️ `description` a 1023/1024 |
| `parallel-worktrees` | 409 / 394 | 7/7 ✅ | 28 | 3 → 0 | 733 | ✅ |
| `project-router` | 400 / 392 | 7/7 ✅ | 34 | 12 → 0 (usa prefixo `3b1b:` corretamente) | 586 | ✅ |
| `remotion-core` | 367 / 351 | 7/7 ✅ | 61 | 10 → 0 | 817 | ✅ |
| `remotion-render-pipeline` | 407 / 399 | 7/7 ✅ | 47 | 0 (usa id de claim `R05-nn`) | 900 | ✅ |
| `timeline-manifest` | 405 / 397 | 7/7 ✅ | 60 | 44 → 5 (inclui **`ADR-0014` inexistente**) | 894 | ❌ **reprova** |
| `tts-voiceover` | 361 / 353 | 7/7 ✅ | 51 | 21 → 0 (**âncora textual entre parênteses em cada pino**) | 913 | ✅ **modelo** |
| `uncertainty-ledger` | 414 / 399 | 7/7 ✅ | 2 | 31 → 6 | 734 | ⚠️ |
| `video-characterization` | 373 / 365 | 7/7 ✅ | 38 | 61 → 6 | 970 | ⚠️ |
| `wave-planning` | 398 / 390 | 7/7 ✅ | 7 | **0 — usa `§III-N`, por norma própria** | 798 | ✅ **modelo** |

### 4.1 URLs órfãs e proveniência sem URL

«URL órfã» = URL no corpo sem placar nem `fonte:` na mesma unidade de texto. Nenhuma foi
encontrada — todas as 426 URLs do catálogo estão ancoradas. O defeito é o **oposto**:

| skill | URLs no corpo | leitura |
|---|---|---|
| `adversarial-review` | **0** | toda a proveniência é `arquivo:linha` — e 49 desses pinos estão deslocados. É a skill menos reconferível do catálogo |
| `meta-skill-evolution` | **0** | idem, com 7/22 pinos sem eco |
| `uncertainty-ledger` | **0** | **correto**: é skill normativa, 41 marcas `Normativo`, 2 placares. Norma não carrega placar |
| `wave-planning` | **0** | **correto e exemplar**: cita `§III-N`, o único formato que sobrevive a `PREP` |

### 4.2 `verification_signal` — executei os 20

| resultado | skills |
|---|---|
| **passa hoje** (executado) | `adversarial-review` (2 e 3 hits), `falsifiable-gates`, `ffmpeg-media-ops` (0 e 2, exatamente o esperado), `uncertainty-ledger` (**75 = 75** ✅), `video-characterization`, `wave-planning` (ramo de fallback) |
| **falha por ferramenta ausente, e a skill NÃO declara** | `manim-bridge` (`manim` não instalado); `remotion-render-pipeline` (`node_modules/@remotion/renderer` inexistente); `remotion-core` (`require('remotion')` inexistente); `motion-design-system` (chama `.agents/scripts/skill_lint.py`, que **não existe neste repositório**) |
| **falha por artefato futuro, e a skill DECLARA** | `timeline-manifest` (`just contrato:gerar` — declarado), `wave-planning` (`tools/validate-graph.py` — declarado), `audio-captions-sync` (`skill_lint.py` — declarado), `meta-skill-evolution` (`skill_lint.py` — declarado) |
| **depende de rede** | `asset-acquisition`, `code-animation`, `llm-authoring`, `tts-voiceover`, `motion-design-system` — nenhuma declara que o sinal **não roda offline**, o que colide com `AB-055` |
| **aponta para outro repositório em caminho absoluto** | `meta-skill-consolidate` → `/home/ondokai/Projects/3blue1brown/.agents/scripts/skill_lint.py`. É gate cruzando fronteira de repositório: se aquele diretório sumir, o sinal falha por motivo irrelevante |

### 4.3 O achado mecânico mais caro

`PROGRAMA.md:1764-1790` já mede **438 âncoras `arquivo:linha`** e declara que a forma não sobrevive
a uma edição. **Minha varredura independente contou exatamente 438 pinos.** O número bate — e a
localização do dano, que faltava, é esta:

- **`adversarial-review`: os 49 pinos de `PROGRAMA.md` estão deslocados em bloco, −40 linhas.**
  Eco lexical no offset 0 = **10/49**; no offset **+40** = **43/49**. Verificado à mão:
  o bloco do prompt de refutação está pinado em `2317-2324` e mora em **2355-2362**;
  a versão de §VI-4 está pinada em `2010-2017` e mora em **2049-2050**;
  *"ausência de reclamação não é sinal"* está pinada em `2131` e mora em **2169**.
  **Conserto em uma edição:** somar 40 a todo `PROGRAMA.md:N` daquele arquivo — depois trocar por
  `§`-âncora, que é o que `wave-planning` já faz.
- **`meta-skill-evolution`: 7 de 22 pinos sem eco, melhor offset +36.** O bloco do pipeline de 5
  passos está pinado em `1764-1780`; `#### Entra ou é descartado — default: descartar` mora em
  **1802**. A própria skill confessa o defeito em `## Não verificado` e afirma que os 20 pinos
  «foram corrigidos um a um» — **a correção não pegou o bloco de §V-1**.
- **`manim-bridge`: 28 citações a `manim-api/…`, `openai_service.py:…`, `venv/…` sem prefixo de
  repositório.** Resolvidas contra este repo, **não existem**. `project-router` já resolveu essa
  classe declarando a convenção `3b1b:` e escrevendo por que ela importa; `manim-bridge` não a
  adotou. **Conserto em uma edição:** prefixar as 28 com `3b1b:` e declarar a convenção no topo.
- `audio-captions-sync` tem 1 pino escrito como `…verificado.md:656` (com reticências) — forma que
  nenhum verificador casa.

---

## 5. Concentração de risco

### 5.1 Mais afirmações sem placar

A pergunta precisa de uma correção de método antes do número: em skill de `metodo`, prescrição do
programa **não carrega placar por contrato** (é `Normativo` com `arquivo:linha`). Contando só o que
é **afirmação empírica sem placar**:

| skill | placares | marcas `Normativo`/`norma` | leitura |
|---|---|---|---|
| `uncertainty-ledger` | **2** | 41 | ✅ **não é risco** — é o desenho correto de skill normativa. As duas afirmações empíricas que ela faz estão pontuadas |
| `wave-planning` | **7** | 33 | ✅ idem, e é a única que cita por `§`-âncora |
| `falsifiable-gates` | 19 | 24 | ✅ e as medições dela são **convenção B declarada com a versão da ferramenta ao lado** — o formato mais honesto do catálogo |
| **`adversarial-review`** | 33 | 5 | ❌ **é aqui que mora o risco.** 33 placares, **0 `fonte:`**, **0 URLs**, e a proveniência é 91 pinos de linha dos quais 49 estão deslocados. Ela *parece* a mais verificada (33 placares em 287 linhas) e é a **menos reconferível**: cada placar é herdado de um id de claim que o leitor não consegue abrir pelo pino dado |
| `meta-skill-consolidate` | 21 | 0 | ⚠️ 21 placares, todos herdados de **um** arquivo (`L02`), e o campo `[spec]` (leitura de código sem id de claim) é usado 4× sem placar — a própria skill declara isso |

**Veredito:** `adversarial-review` carrega a maior massa de afirmação cuja verificação está
**quebrada na forma**, e `meta-skill-consolidate` a maior proporção de afirmação sem placar próprio.

### 5.2 Maior dependência de uma única fonte — o ponto único de falha nomeado

| cluster | o que sustenta | exposição |
|---|---|---|
| **`L02-reuso-3b1b-infra-skills.md`** | **duas skills inteiras** — `meta-skill-evolution` e `meta-skill-consolidate` — mais a espinha de `falsifiable-gates` (L02-C03, C16, C17, C11) e boa parte de `project-router` | **Este é o ponto único de falha do catálogo.** Todo `L02` é **convenção B**: execução local sobre `/home/ondokai/Projects/3blue1brown`. Não há segunda fonte possível — o objeto medido é um repositório específico numa máquina específica. Se ele mudar ou sair do disco, **nada disso é re-verificável**, e `meta-skill-consolidate` chega a **hardcodar o caminho absoluto dele dentro do `verification_signal`**. As duas skills que o cluster sustenta são justamente **as duas que autorizam escrita em outras skills** — e o próprio L02 mediu que, no repositório de origem, as evals dessas duas eram lambdas com `passed: True` literal. O portão das ferramentas de escrita foi construído sobre a única fonte que ninguém consegue corroborar |
| **`R15-agentes-paralelos.md`** | `parallel-worktrees` inteira (28 placares, 0 ids de claim externos) | mitigado: a skill declara a convenção de rótulo no topo, separa `REPRO sem placar` de `Placar (N-M)`, e lista 8 itens em `## Não verificado` **cada um com mitigação ao lado**. É o melhor tratamento de fonte única do catálogo |
| **`R10-ffmpeg.md` + execução local em `ffmpeg 6.1.1`** | `ffmpeg-media-ops` (62 placares, o maior número do catálogo) | 5 dos claims distintivos (`NV-1`..`NV-5`: duração container × stream, `loudnorm` a 192 kHz, `-crf` como aviso, posição dos flags de bitexact, determinismo do `sidechaincompress`) são **execução local única, sem perna documental**. A skill abre com escopo de versão explícito e os cinco estão em `## Não verificado` com o comando que fecha — **risco declarado, não escondido** |
| **`R09-animacao-de-codigo`** | `code-animation` inteira | 12 itens em `## Não verificado`, nenhum ≥2-0. A skill declara isso na primeira linha da seção |
| **`R13-tts-locucao.md`** | `tts-voiceover` inteira | mitigado pela disputa `D-05` estar escrita **contra o próprio insumo** (R13 × R04, com R04 vencendo) — é a única skill que documenta a derrota do próprio arquivo de pesquisa |

---

## 6. Veredito por skill

| # | skill | veredito | conserto em uma linha |
|---|---|---|---|
| 1 | `project-router` | **PRONTA** | — (usa `3b1b:` corretamente, 0 pinos deslocados, e é a única que já mapeia as colisões conhecidas de nome) |
| 2 | `wave-planning` | **PRONTA** | — (0 pinos de linha, `§`-âncora por norma própria; é o modelo do catálogo) |
| 3 | `tts-voiceover` | **PRONTA** | — (todo pino de `PROGRAMA.md` traz o texto-alvo entre parênteses; 21/21 resolvem) |
| 4 | `parallel-worktrees` | **PRONTA** | — (trocar o gatilho `wave` por `barreira de onda` é melhoria de roteamento, não conserto) |
| 5 | `remotion-core` | **PRECISA DE CONSERTO** | absorver `calculateMetadata`, `<OffthreadVideo>` e o lint contra `import {Audio} from 'remotion'` — hoje quatro skills roteiam para lá e o texto tem **0 ocorrências** dos três |
| 6 | `remotion-render-pipeline` | **PRECISA DE CONSERTO** | trocar «licenciamento do Remotion → o panorama verificado» por «→ `remotion-core`», e declarar que o `verification_signal` exige `node_modules` instalado |
| 7 | `ffmpeg-media-ops` | **PRECISA DE CONSERTO** | ceder os gatilhos `hardware acceleration` e `yuva420p` (§2.2) e cortar o corpo de 401 para <400 linhas — está no limiar de aviso do linter |
| 8 | `audio-captions-sync` | **PRECISA DE CONSERTO** | corrigir o pino truncado `…verificado.md:656` e acrescentar a ressalva de que a Apple publica **2112** amostras de priming contra as 512 da cadeia Remotion (**C-07**) |
| 9 | `manim-bridge` | **PRECISA DE CONSERTO** | prefixar as **28** citações de `manim-api/…` com `3b1b:` e declarar a convenção no topo — resolvidas contra este repositório, nenhuma existe |
| 10 | `timeline-manifest` | **PRECISA DE CONSERTO** | trocar as duas menções a `ADR-0014` (que **não existe** no registro) pela semente `P-08`, e declarar o nó de asset com `hash`+`license` obrigatórios (**C-06**, **C-09**) |
| 11 | `llm-authoring` | **PRECISA DE CONSERTO** | corrigir o placar do exit code de hook de `(2-0)` para `(3-0)` — R06-24, e o panorama vence sobre fato (**C-03**) |
| 12 | `asset-acquisition` | **PRECISA DE CONSERTO** | reconferir os 4 pinos da faixa `PROGRAMA.md:2533..2546` (região de ADR, a mais editada) e ancorar `AB-056`/`AB-057` pelo id |
| 13 | `code-animation` | **PRECISA DE CONSERTO** | acrescentar a licença dos motores alternativos — **highlight.js é BSD-3-Clause** e muda o `NOTICE` do projeto (R09-23, 2-0); hoje varre 0 ocorrências |
| 14 | `motion-design-system` | **PRECISA DE CONSERTO** | trocar o gatilho `token` por `token de design` (engole 3 gatilhos de outras skills) e declarar que o `verification_signal` chama um script inexistente |
| 15 | `video-characterization` | **PRECISA DE CONSERTO** | trocar o gatilho `threshold` por `limiar de diff` e reconferir os 6 pinos sem eco (`PROGRAMA.md:107, 1945, 2731, 2862`) |
| 16 | `falsifiable-gates` | **PRECISA DE CONSERTO** | resolver a violação da própria fronteira negativa: as 9 regras de baseline/limiar que ela declara não cobrir estão no corpo dela (**C-08**) |
| 17 | `uncertainty-ledger` | **PRECISA DE CONSERTO** | reconferir 6 pinos (`PROGRAMA.md:988, 990` e `panorama:775, 896, 1192`); o resto é normativo e está correto por contrato |
| 18 | `meta-skill-consolidate` | **PRECISA DE CONSERTO** | tirar o caminho absoluto de outro repositório de dentro do `verification_signal` — gate que atravessa fronteira de repositório falha por motivo irrelevante |
| 19 | `meta-skill-evolution` | **REFAZER a proveniência** (o conteúdo é bom) | o bloco de pinos de §V-1 (`PROGRAMA.md:1764-1780`) está deslocado ~+36 enquanto a skill afirma, em `## Não verificado`, que os 20 pinos «foram corrigidos um a um». **A skill que denuncia o defeito é caso do defeito, e a confissão dela está desatualizada** — o que é pior que o pino errado |
| 20 | `adversarial-review` | **REFAZER a proveniência** (o banco de perguntas é o melhor artefato do catálogo) | **os 49 pinos de `PROGRAMA.md` estão deslocados em bloco, −40 linhas** (eco 10/49 em offset 0 → 43/49 em offset +40). Somar 40 é uma edição; trocar por `§`-âncora é a correção durável. Enquanto isso, **nenhuma das 33 afirmações dela é reconferível pelo endereço que ela dá** |

### 6.1 Como ler estes vereditos

Nenhuma skill foi reprovada por **conteúdo**. Onze das doze «precisa de conserto» são de **uma
linha**. As duas «refazer» não pedem reescrita de texto — pedem reescrita de **endereço**, que é
uma operação mecânica. O que este arquivo mede é exatamente o que o programa previu que aconteceria
e escreveu antes de acontecer (`PROGRAMA.md:1764`, *"A deriva já aconteceu neste repositório, e foi
medida"*): **20 skills escritas em paralelo contra um documento que continuou sendo editado.**

O que a auditoria acrescenta ao que o PROGRAMA já sabia é a **localização**: o dano não está
espalhado uniformemente por 438 pinos. Ele está **concentrado em dois blocos contíguos**, em duas
skills, e some com duas edições.

E o que nenhuma auditoria pega, e por isso fica escrito aqui: **proveniência detecta deriva, não
correção.** Consertar os 49 pinos de `adversarial-review` prova que as linhas voltaram a existir —
não prova que elas sustentam as afirmações. Isso só o eval prova, e o eval não existe (`T-10`).
