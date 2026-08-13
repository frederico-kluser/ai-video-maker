# Dossiê de revisão humana — entrega `canonico`

> **RASCUNHO GERADO POR MÁQUINA (F6-01).** Vereditos do checklist e
> assinaturas por papel estão em branco. Um dossiê só vale para publicação
> depois de assinado pelos quatro papéis nomeados — até lá, `just
> revisar-bloqueia` falha de propósito.

<!-- F6-01:dossie:entrega=canonico -->
<!-- F6-01:relatorio-embutido-hash=01f37b0d6b93f199054f18ba554487f01615367754fc4c644331a8e07ebf9eed -->
<!-- F6-01:relatorio-final-hash=b06fcbf1655b4d6535014407925050b2dac0d8421533103a6339f03939a5fc04 -->
<!-- F6-01:regeneracao=CONSISTENTE -->
<!-- F6-01:enquadramento=DECLARADO -->
<!-- F6-01:ab950=AB-950 continua fechado -->
<!-- F6-01:disclosure=DECLARADO -->
<!-- F6-01:gaps=DECLARADO -->

## 1. Identidade da entrega

- **entrega:** `canonico`
- **origem:** entrega de FIXTURE montada dos cassetes commitados (sem render)
- **sucesso do relatorio-final:** `true`
- **hash relatorio-procedencia.json:** `01f37b0d6b93f199054f18ba554487f01615367754fc4c644331a8e07ebf9eed`
- **hash relatorio-final.json:** `b06fcbf1655b4d6535014407925050b2dac0d8421533103a6339f03939a5fc04`
- **semOrigem (∅-crit F5-06):** VAZIO — liberado

## 2. Gaps de data visíveis (AB-746 — visíveis, não omitidos)

| hash | motivo | decisão do dono (preencher) |
|---|---|---|
| `09c8a304b49dd8b6…` | data de aquisicao nao registrada | _(preencher)_ |
| `0c4a9057a1b8199a…` | data de aquisicao nao registrada | _(preencher)_ |
| `0e186f98bb29f2fe…` | data de aquisicao nao registrada | _(preencher)_ |
| `15ea1591069231d0…` | data de aquisicao nao registrada | _(preencher)_ |
| `2b8de8cb0a8e0acd…` | data de aquisicao nao registrada | _(preencher)_ |
| `6b9ec331d006e5fd…` | data de aquisicao nao registrada | _(preencher)_ |
| `943bdb0f597e16a6…` | data de aquisicao nao registrada | _(preencher)_ |
| `afa60b4957155b8b…` | data de aquisicao nao registrada | _(preencher)_ |
| `dd6f0be76df31705…` | data de aquisicao nao registrada | _(preencher)_ |

## 3. Relatório de procedência (F5-06 — gerarRelatorio)

**Regeneração dos mesmos commitados (AB-748):** `CONSISTENTE` — o relatório regenerado sem re-renderizar coincide nos vereditos essenciais (semOrigem, gaps, diretos, transitivos, enquadramento).

```json
{"diretos":[{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"0c4a9057a1b8199a9621e08e99c76cb403dc8f20d7b89d1f4ddea82abe6ddef2","nos":["n-008"],"origem":{"atribuicaoObrigatoria":false,"ferramenta":"destaque-local 1.0.0 + gramaticas 1.0.0","idNoProvedor":"n-008","licenca":"CC0-1.0","notas":"Destaque pre-computado localmente. Gramatica e tema sao escritos neste repositorio (CC0-1.0); zero material de terceiro e zero chamada externa. O texto do codigo vem do proprio manifesto e mantem a licenca do manifesto: este estagio transforma, nao adquire.","provedor":"local"},"papeis":["codigo"],"semData":true,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"0e186f98bb29f2fe7758a18ff74f1b6904347384f56fd4a6e67f93f1b1c95ad6","nos":["n-midia-02"],"origem":{"atribuicaoObrigatoria":false,"ferramenta":"wikimedia-commons mediawiki-action-api-2026-08","idNoProvedor":"2121531","licenca":"PDM-1.0","notas":"hotlink nao utilizado: bytes baixados e re-hospedados por hash (docs/adr/0008-hotlink-e-midia-externa.md) | AB-950 continua fechado (enquadramento de uso pessoal, ADR-0003) | n-midia-01: hash declarado 000000000000… != adquirido dd6f0be76df3… | n-midia-02: hash declarado 000000000000… != adquirido 0e186f98bb29…","origem":"https://commons.wikimedia.org/wiki/File:Petroleum_Pipeline_Systems.gif","provedor":"wikimedia-commons","termoDeBusca":"pipeline diagram"},"papeis":["midia"],"semData":true,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"126e3d99f83e7aee719fe13806d837b68752c8878e9c4c48f198903773430255","nos":["n-002","n-008","n-014"],"origem":{"adquiridoEm":"2026-08-13T12:09:52.576Z","atribuicao":"\"Music Box Sound Effect\" por Big Daddy sob Public domain","atribuicaoObrigatoria":false,"ferramenta":"commons-efeitos-base 1.0.0 / mediawiki-action-api-formatversion-2","idNoProvedor":"File:Music Box Sound Effect.ogg","licenca":"Public domain","notas":"Uso pessoal (ADR-0003, D1; AB-950 continua fechado). O credito que atravessa a fronteira e T+A+L do modelo TASL, sem URL, porque $defs.TextoSemURL do manifesto resolvido proibe endereco. O 'S' (fonte) fica em assets[].origem e idNoProvedor; CC BY 4.0 §3(a)(2) permite satisfazer 3(a)(1) por referencia a um recurso que reune as informacoes, e e F5-06 que junta as duas metades na publicacao.","origem":"https://upload.wikimedia.org/wikipedia/commons/9/9a/Music_Box_Sound_Effect.ogg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original","provedor":"wikimedia-commons","termoDeBusca":"caixa-de-musica"},"papeis":["musica"],"semData":false,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"2b8de8cb0a8e0acd586bc0e68ed2edb245ca7960be56454383714a26e118adeb","nos":["c-005"],"origem":{"atribuicao":"Audio sintetico de referencia — nao e voz humana","atribuicaoObrigatoria":true,"ferramenta":"locucao 1.0.0 (tts-1 + whisper-1)","idNoProvedor":"tts-1/alloy","licenca":"CC0-1.0","notas":"Locucao sintetizada e alinhada por transcricao. Audio sintetico de referencia — nao e voz humana. O timing por palavra e um asset de dados separado (mimeType application/vnd.editor-video-ia.timing-locucao+json); a ligacao com o audio vive no campo 'audio' do proprio documento. AB-950 continua fechado.","provedor":"sosia-local"},"papeis":["locucao"],"semData":true,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"3a00855408e16a823176c25052bc801b2f70023c382e75fa11d7d913609daa80","nos":["n-005","n-006","n-007"],"origem":{"adquiridoEm":"2026-08-13T12:09:52.576Z","atribuicao":"\"Sound Effect - Door Bell\" por Amada44 sob CC0","atribuicaoObrigatoria":false,"ferramenta":"commons-efeitos-base 1.0.0 / mediawiki-action-api-formatversion-2","idNoProvedor":"File:Sound Effect - Door Bell.ogg","licenca":"CC0","notas":"Uso pessoal (ADR-0003, D1; AB-950 continua fechado). O credito que atravessa a fronteira e T+A+L do modelo TASL, sem URL, porque $defs.TextoSemURL do manifesto resolvido proibe endereco. O 'S' (fonte) fica em assets[].origem e idNoProvedor; CC BY 4.0 §3(a)(2) permite satisfazer 3(a)(1) por referencia a um recurso que reune as informacoes, e e F5-06 que junta as duas metades na publicacao.","origem":"https://upload.wikimedia.org/wikipedia/commons/3/34/Sound_Effect_-_Door_Bell.ogg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original","provedor":"wikimedia-commons","termoDeBusca":"campainha"},"papeis":["musica"],"semData":false,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"6ac2876495aa5f0a8d4558bc35aa3e05f6e88b667a097cd3b7f41f15874276bb","nos":[],"origem":{"adquiridoEm":"2026-08-13T12:09:52.576Z","atribuicao":"\"Kevin MacLeod - Lift Motif\" por Kevin MacLeod sob CC BY 3.0","atribuicaoObrigatoria":true,"ferramenta":"commons-efeitos-base 1.0.0 / mediawiki-action-api-formatversion-2","idNoProvedor":"File:Kevin MacLeod - Lift Motif.ogg","licenca":"CC BY 3.0","notas":"Uso pessoal (ADR-0003, D1; AB-950 continua fechado). O credito que atravessa a fronteira e T+A+L do modelo TASL, sem URL, porque $defs.TextoSemURL do manifesto resolvido proibe endereco. O 'S' (fonte) fica em assets[].origem e idNoProvedor; CC BY 4.0 §3(a)(2) permite satisfazer 3(a)(1) por referencia a um recurso que reune as informacoes, e e F5-06 que junta as duas metades na publicacao.","origem":"https://upload.wikimedia.org/wikipedia/commons/9/9e/Kevin_MacLeod_-_Lift_Motif.ogg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original","provedor":"wikimedia-commons","termoDeBusca":"trilha-elevador"},"papeis":["trilha-sonora"],"semData":false,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"6b9ec331d006e5fd80db18acd52d003ef10f89d06249d8d9dd9eee65df61950c","nos":["c-004"],"origem":{"atribuicao":"Audio sintetico de referencia — nao e voz humana","atribuicaoObrigatoria":true,"ferramenta":"locucao 1.0.0 (tts-1 + whisper-1)","idNoProvedor":"tts-1/alloy","licenca":"CC0-1.0","notas":"Locucao sintetizada e alinhada por transcricao. Audio sintetico de referencia — nao e voz humana. O timing por palavra e um asset de dados separado (mimeType application/vnd.editor-video-ia.timing-locucao+json); a ligacao com o audio vive no campo 'audio' do proprio documento. AB-950 continua fechado.","provedor":"sosia-local"},"papeis":["locucao"],"semData":true,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"943bdb0f597e16a6430121d85c451a809fb5f6bc8fb01679d17615474ba4003a","nos":["g-001"],"origem":{"atribuicaoObrigatoria":false,"ferramenta":"manim 0.20.1","idNoProvedor":"Cena_g_001_f061eb95","licenca":"CC0-1.0","notas":"Render local com Manim CE headless (cairo, --write_to_movie), muxer Lavf62.12.102. Saida gerada a partir dos dados do manifesto; nenhum asset de terceiro. Correcoes de quirk aplicadas ao codigo da cena: g-001: cor: CYAN -> TEAL; g-001: cor: CYAN -> TEAL; g-001: cor: CYAN -> TEAL.","provedor":"local"},"papeis":["grafico"],"semData":true,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"afa60b4957155b8b5d9b1314e65827cccaa7dfd4863495dd239253741355c08d","nos":["g-002"],"origem":{"atribuicaoObrigatoria":false,"ferramenta":"manim 0.20.1","idNoProvedor":"Cena_g_002_82f2bf7a","licenca":"CC0-1.0","notas":"Render local com Manim CE headless (cairo, --write_to_movie), muxer Lavf62.12.102. Saida gerada a partir dos dados do manifesto; nenhum asset de terceiro. Correcoes de quirk aplicadas ao codigo da cena: g-001: cor: CYAN -> TEAL; g-001: cor: CYAN -> TEAL; g-001: cor: CYAN -> TEAL.","provedor":"local"},"papeis":["grafico"],"semData":true,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"cce5b73c814b7f8c501d0370ce27995c28fe2e6c2bed06547208cba00f285c2b","nos":["n-001","n-015"],"origem":{"adquiridoEm":"2026-08-13T12:09:52.576Z","atribuicao":"\"Airplane Chime Sound Effect\" por Sharelk sob CC0","atribuicaoObrigatoria":false,"ferramenta":"commons-efeitos-base 1.0.0 / mediawiki-action-api-formatversion-2","idNoProvedor":"File:Airplane Chime Sound Effect.ogg","licenca":"CC0","notas":"Uso pessoal (ADR-0003, D1; AB-950 continua fechado). O credito que atravessa a fronteira e T+A+L do modelo TASL, sem URL, porque $defs.TextoSemURL do manifesto resolvido proibe endereco. O 'S' (fonte) fica em assets[].origem e idNoProvedor; CC BY 4.0 §3(a)(2) permite satisfazer 3(a)(1) por referencia a um recurso que reune as informacoes, e e F5-06 que junta as duas metades na publicacao.","origem":"https://upload.wikimedia.org/wikipedia/commons/c/ce/Airplane_Chime_Sound_Effect.ogg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original","provedor":"wikimedia-commons","termoDeBusca":"abertura"},"papeis":["musica"],"semData":false,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"d9b8d3b5e4ae0a6ed336e769301546735ff34f29c14be6e1232da6b7096c0988","nos":["n-003","n-004","n-009","n-010","n-011","n-012","n-013"],"origem":{"adquiridoEm":"2026-08-13T12:09:52.576Z","atribuicao":"\"Achievement unlocked sound effect video game\" por rhodesmas sob CC BY 3.0","atribuicaoObrigatoria":true,"ferramenta":"commons-efeitos-base 1.0.0 / mediawiki-action-api-formatversion-2","idNoProvedor":"File:Achievement unlocked sound effect video game.wav","licenca":"CC BY 3.0","notas":"Uso pessoal (ADR-0003, D1; AB-950 continua fechado). O credito que atravessa a fronteira e T+A+L do modelo TASL, sem URL, porque $defs.TextoSemURL do manifesto resolvido proibe endereco. O 'S' (fonte) fica em assets[].origem e idNoProvedor; CC BY 4.0 §3(a)(2) permite satisfazer 3(a)(1) por referencia a um recurso que reune as informacoes, e e F5-06 que junta as duas metades na publicacao.","origem":"https://upload.wikimedia.org/wikipedia/commons/8/85/Achievement_unlocked_sound_effect_video_game.wav?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original","provedor":"wikimedia-commons","termoDeBusca":"conquista"},"papeis":["musica"],"semData":false,"transitivo":false},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"dd6f0be76df31705998cd38604847d60ffa2833056dcc3864fb2f7047abeeb1f","nos":["n-midia-01"],"origem":{"atribuicao":"Mistervip.wa, File:Flowchart Program.png, CC BY-SA 4.0, via Wikimedia Commons","atribuicaoObrigatoria":true,"ferramenta":"wikimedia-commons mediawiki-action-api-2026-08","idNoProvedor":"160897767","licenca":"CC-BY-SA-4.0","notas":"hotlink nao utilizado: bytes baixados e re-hospedados por hash (docs/adr/0008-hotlink-e-midia-externa.md) | AB-950 continua fechado (enquadramento de uso pessoal, ADR-0003) | n-midia-01: hash declarado 000000000000… != adquirido dd6f0be76df3… | n-midia-02: hash declarado 000000000000… != adquirido 0e186f98bb29…","origem":"https://commons.wikimedia.org/wiki/File:Flowchart_Program.png","provedor":"wikimedia-commons","termoDeBusca":"flowchart diagram"},"papeis":["midia"],"semData":true,"transitivo":false}],"enquadramento":{"ab950":"AB-950 continua fechado","adr":"ADR-0003","uso":"pessoal"},"formato":"RelatorioProcedencia.1","gapsDeData":[{"hash":"09c8a304b49dd8b632c1a8c4ed22ce829b4932fad9314600bf98d843e2dec7ea","motivo":"data de aquisicao nao registrada"},{"hash":"0c4a9057a1b8199a9621e08e99c76cb403dc8f20d7b89d1f4ddea82abe6ddef2","motivo":"data de aquisicao nao registrada"},{"hash":"0e186f98bb29f2fe7758a18ff74f1b6904347384f56fd4a6e67f93f1b1c95ad6","motivo":"data de aquisicao nao registrada"},{"hash":"15ea1591069231d080425045634404e2d3c2e5f51bc84fe991fc147a36856bdd","motivo":"data de aquisicao nao registrada"},{"hash":"2b8de8cb0a8e0acd586bc0e68ed2edb245ca7960be56454383714a26e118adeb","motivo":"data de aquisicao nao registrada"},{"hash":"6b9ec331d006e5fd80db18acd52d003ef10f89d06249d8d9dd9eee65df61950c","motivo":"data de aquisicao nao registrada"},{"hash":"943bdb0f597e16a6430121d85c451a809fb5f6bc8fb01679d17615474ba4003a","motivo":"data de aquisicao nao registrada"},{"hash":"afa60b4957155b8b5d9b1314e65827cccaa7dfd4863495dd239253741355c08d","motivo":"data de aquisicao nao registrada"},{"hash":"dd6f0be76df31705998cd38604847d60ffa2833056dcc3864fb2f7047abeeb1f","motivo":"data de aquisicao nao registrada"}],"geradoEm":"2026-08-13T21:16:30.348Z","manifesto":{"hashManifestoOriginal":"a0ae9cdd0e99d3f62bd8aecce8246e1dcfebfa56be0099854ea6fd479cb27158","origem":{"fonteDaOrigem":"cassete","origens":[{"atribuicaoObrigatoria":false,"ferramenta":"executor-de-autoria 1.0.0","licenca":"Termos de uso do provedor de modelo de lingua (uso pessoal — ADR-0003; AB-950). Texto gerado por modelo; o projeto nao o redistribui.","notas":"Sem ANTHROPIC_API_KEY no dia do card: gravado do SOSIA (envelope montado a mao na forma da API real). AB-552 fica PENDENTE — evidencia com credencial, nunca gate.","provedor":"sosia-local"},{"atribuicaoObrigatoria":false,"ferramenta":"executor-de-autoria 1.0.0","licenca":"Termos de uso do provedor de modelo de lingua (uso pessoal — ADR-0003; AB-950). Texto gerado por modelo; o projeto nao o redistribui.","notas":"Gravado com chamada REAL ao provedor (OPENAI_API_KEY, dia do card F4-04). A resposta foi gravada como veio (sosia, nao sucessor).","provedor":"openai"}]},"schemaVersion":"ManifestoResolvido.1"},"semOrigem":[],"transitivos":[{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"09c8a304b49dd8b632c1a8c4ed22ce829b4932fad9314600bf98d843e2dec7ea","nos":[],"origem":{"atribuicaoObrigatoria":false,"ferramenta":"locucao 1.0.0 (tts-1 + whisper-1)","idNoProvedor":"whisper-1/pt-BR","licenca":"CC0-1.0","notas":"Locucao sintetizada e alinhada por transcricao. Audio sintetico de referencia — nao e voz humana. O timing por palavra e um asset de dados separado (mimeType application/vnd.editor-video-ia.timing-locucao+json); a ligacao com o audio vive no campo 'audio' do proprio documento. AB-950 continua fechado.","provedor":"sosia-local"},"papeis":["cassete-locucao"],"semData":true,"transitivo":true},{"derivadoDe":null,"fonteDaOrigem":"cassete","hash":"15ea1591069231d080425045634404e2d3c2e5f51bc84fe991fc147a36856bdd","nos":[],"origem":{"atribuicaoObrigatoria":false,"ferramenta":"locucao 1.0.0 (tts-1 + whisper-1)","idNoProvedor":"whisper-1/pt-BR","licenca":"CC0-1.0","notas":"Locucao sintetizada e alinhada por transcricao. Audio sintetico de referencia — nao e voz humana. O timing por palavra e um asset de dados separado (mimeType application/vnd.editor-video-ia.timing-locucao+json); a ligacao com o audio vive no campo 'audio' do proprio documento. AB-950 continua fechado.","provedor":"sosia-local"},"papeis":["cassete-locucao"],"semData":true,"transitivo":true}]}
```

## 4. Declaração de enquadramento (AB-993)

- **uso:** pessoal — **ADR-0003** (a decisão de uso não é a decisão de publicação; política §0.2).
- **gatilho AB-950:** `AB-950 continua fechado` — nunca omitido (ADR-0003: omissão é falha de gate).
- **caso não previsto (política §7):** "o que não está escrito não está decidido" — caso não previsto bloqueia publicação nova até enquadramento por registro.

## 5. Disclosure de voz sintética (AB-999)

DECLARADO — a entrega contem voz sintetica (estagio locucao/TTS); a obrigacao de disclosure do provedor (ADR-0003 D4, AB-999) e conferida pelo Revisor juridico no item J2.

## 6. Checklist por papel (docs/revisao/checklist.md)

### Revisor editorial

- [ ] E1 — veredito: `PENDENTE`
- [ ] E2 — veredito: `PENDENTE`
- [ ] E3 — veredito: `PENDENTE`
- [ ] E4 — veredito: `PENDENTE`
- [ ] E5 — veredito: `PENDENTE`

### Revisor jurídico

- [ ] J1 — veredito: `PENDENTE`
- [ ] J2 — veredito: `PENDENTE`
- [ ] J3 — veredito: `PENDENTE`
- [ ] J4 — veredito: `PENDENTE`

### Operador de reversão

- [ ] R1 — veredito: `PENDENTE`
- [ ] R2 — veredito: `PENDENTE`

### Operador de publicação

- [ ] P1 — veredito: `PENDENTE`
- [ ] P2 — veredito: `PENDENTE`

## 7. Assinaturas por papel

Assinar com nome + data + veredito global. Um papel sem assinatura torna o dossiê inválido (∅-crit).

### Assinatura — Revisor editorial

- **nome:** _(preencher)_
- **data:** _(preencher)_
- **veredito global:** `PENDENTE`

### Assinatura — Revisor jurídico

- **nome:** _(preencher)_
- **data:** _(preencher)_
- **veredito global:** `PENDENTE`

### Assinatura — Operador de reversão

- **nome:** _(preencher)_
- **data:** _(preencher)_
- **veredito global:** `PENDENTE`

### Assinatura — Operador de publicação

- **nome:** _(preencher)_
- **data:** _(preencher)_
- **veredito global:** `PENDENTE`

---

Gerado por `just revisar` (F6-01). Confira a estrutura e o ∅-crit em `docs/revisao/dossie.md`.