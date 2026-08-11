---
name: timeline-manifest
description: Provides the cross-language data contract of the video manifest — the one JSON artifact read by Node/Remotion and by Python/Manim — covering the two-schema shape mandated by card F0-02 (LLM subset + full 2020-12 validator), closed objects, the anyOf+const union on the node kind field, the flat node list with id references, per-object versioning, single-source codegen and the validation gate, the time-unit decision owned by ADR-0010 and its conversion rule, and why OpenTimelineIO, EDL and FCPXML are not adopted. Use whenever a task reads, writes, generates, validates, versions or migrates the manifest, or adds a field that both sides consume, even if the user doesn't mention "schema" or "JSON". Triggers: "manifest", "manifesto", "schema", "json schema", "zod", "pydantic", "contract", "data contract", "node", "timeline", "codegen", "validator", "migration", "otio", "fps", "duration".
metadata:
  type: knowledge
  tier: dominio
  verification_signal: "just contrato:gerar && test -s schema/manifesto.schema.json && test -s schema/manifesto.llm.schema.json && git diff --exit-code schema/ src/contratos/"
---

> **Como resolver as citações desta skill.** As fontes que ela cita foram consolidadas em
> `PROGRAMA.html` (arquivo único, na raiz do repositório) e os documentos originais ficaram
> **congelados no histórico do git**, no commit `8737ad6`. Caminho e número de linha continuam
> exatos — o commit os pina por conteúdo:
>
> - `docs/pesquisa/<arq>.md:<linha>` → `git show 8737ad6:docs/pesquisa/<arq>.md`
> - `docs/00-panorama-verificado.md §<n>` → `git show 8737ad6:docs/00-panorama-verificado.md`
> - `PROGRAMA.md §<seção>` → a aba correspondente de `PROGRAMA.html`
>
> Um id de claim (`R07-06`, `L02-C11`) ou de card (`F2-03`) continua sendo a âncora estável.
> Prefira-o ao caminho de arquivo: ele não desliza.
# Manifesto de timeline — o contrato de dados entre Node e Python

## Quando carregar

- A tarefa escreve, lê, gera ou valida o manifesto do vídeo; ou acrescenta um campo que os dois
  lados (Remotion e Manim) consomem.
- A tarefa desenha o schema entregue a um LLM, ou descobre que a chamada volta 400 antes da
  inferência.
- A tarefa converte tempo (segundos, milissegundos, frames) em qualquer direção, ou calcula a
  duração de uma composição.
- A tarefa versiona ou migra o formato, ou pesa adotar um formato de timeline existente.
- **Não carregue** para: como chamar a API de saída estruturada, prompt caching, custo por
  iteração (é `llm-authoring`); como o Remotion consome props e monta a composição (é
  `remotion-core`); os números normativos de duração e legibilidade (é `motion-design-system`).

## Conhecimento injetado

### O que o PROGRAMA já decidiu — e que nenhum agente redecide aqui

O card `F0-02` (`PROGRAMA.md` **§III-14**) é dono do contrato e fecha, por decisão registrada,
quatro pontos que parecem abertos quando se lê só a pesquisa. **Convenção de pino desta skill:**
`§`-âncora e id de card/claim, nunca `arquivo:linha` — o número morre na próxima edição do alvo e
`F0-02 · Entrega` não. `panorama` = `docs/00-panorama-verificado.md`.

| Decidido | Onde | O que sobra para você |
|---|---|---|
| **Dois** schemas derivados de **uma** fonte | `F0-02 · Entrega` · `F0-02 · Nota` | provar que o subset é **relaxamento** do completo, não outro schema |
| União por `anyOf` + `const` em `node.type` (**não** `oneOf`, **não** `discriminator`) | `F0-02 · Entrega` | escrever as variantes sem tocar `$def` alheio |
| **Lista plana de nós com referência por id** — o manifesto **não** é árvore recursiva | `F0-02 · Nota` | resolver aninhamento por id, não por `children` |
| Versionamento **por objeto** (`"schema": "<Tipo>.<N>"` em cada nó) | `F0-02 · Entrega`, copiado de OTIO **(3-0)** | 1 campo por variante do `anyOf` + 1 `migrate()` por bump |

Arquivos que o card possui, e cujos nomes não são negociáveis fora dele:
`schema/manifesto.schema.json` · `schema/manifesto.llm.schema.json` · `schema/gerar.*` ·
`src/contratos/manifesto.*` · `tests/contratos/**` — `F0-02 · Dono de`. Os alvos de aceitação são
`just contrato:gerar`, `just contrato:testar`, `just contrato:subset` — `F0-02 · Aceitação`.

### A receita concreta da fonte única — e a direção que não existe

Uma fonte, dois consumidores. O sentido é **Zod → JSON Schema → Pydantic**, e não o inverso:

```
src/contratos/manifesto.ts     # Zod 4 — fonte de verdade (topo z.object())
   ├─ z.toJSONSchema(M, {target: "draft-2020-12", reused: "ref"})
   │     ├─▶ schema/manifesto.schema.json      # 2020-12 completo — valida
   │     │      └─▶ datamodel-codegen --input-file-type jsonschema
   │     │             --output-model-type pydantic_v2.BaseModel  ─▶ src/contratos/manifesto.py
   │     └─▶ schema/manifesto.llm.schema.json  # subset podado — só gera
   └─▶ <Composition schema={Manifest} defaultProps={…} />
```

- `z.toJSONSchema()` é de primeira parte no Zod 4, `target` default `draft-2020-12`,
  `reused: "ref"` para emitir `$defs`, `unrepresentable: "throw"` como padrão — **Placar (2-0)** —
  fonte: https://zod.dev/json-schema
- **O caminho inverso não é caminho:** `z.fromJSONSchema()` está marcado experimental —
  **Placar (1-0)**: das duas fontes que sustentam o claim de origem (R16-03), **só uma** menciona
  `fromJSONSchema`, e as duas são do mesmo projeto — fonte: https://zod.dev/json-schema
  (ver "Não verificado").
- `datamodel-code-generator` gera Pydantic v2 / dataclass / TypedDict / msgspec a partir de JSON
  Schema, MIT, Python ≥3.10 — **Placar (2-0)** — fonte:
  https://github.com/koxudaxi/datamodel-code-generator · https://pypi.org/project/datamodel-code-generator/
- JSON Schema 2020-12 é a versão corrente e é o dialeto que Pydantic v2 e o subset AWS/Anthropic
  assumem — **Placar (3-0)** — fonte: https://json-schema.org/specification

**Custos de reversão, em unidade contável** (§5 do playbook exige isso; sem número, o ponto não é
barato — `docs/PLAYBOOK-REFERENCIA.md:71`):

| Trocar | Custo | Fonte |
|---|---|---|
| gerador Python (`datamodel-codegen` → `quicktype`) | **1 linha de script** (o insumo é o mesmo `.json`) | panorama §5.1 · "Gerador de modelos Python" |
| validador TS (Ajv ↔ TypeBox ↔ `safeParse`) | **1 módulo**, se e somente se todos validarem o mesmo arquivo | panorama §5.1 · "Validador TypeScript do manifesto" |
| versionamento por objeto ↔ topo único | **1 arquivo de schema + 1 função de migração** | panorama §5.1 · "Versionamento do manifesto" |
| **direção da fonte única** (Zod→JSON Schema para JSON Schema→Zod) | **não é barato**: depende de API experimental (1-0) | https://zod.dev/json-schema |
| **opcionais de verdade ↔ tudo em `required` com `\|null`** | **não é barato**: atravessa todo card de nó, toda fixture e todo componente React | panorama §5.2 · "campos opcionais de verdade" |
| **unidade de tempo** (frames ↔ ms) | **não é ponto de troca barata — "é um programa novo"** | `PROGRAMA.md` §II · "Pontos de troca barata" |

### O subset de structured output é quem desenha o schema, não o gosto

Esta é a restrição que mais condiciona a forma do manifesto. O subset aceito pela saída estruturada
da Anthropic **não suporta**: schemas recursivos, `$ref` externo, `minimum`/`maximum`/`multipleOf`,
`minLength`/`maxLength`, e `additionalProperties` diferente de `false`; `minItems` de array só
aceita 0 ou 1. Suporta `enum`, `const`, `anyOf`, `$ref`/`$defs` internos, `default`, formatos de
string (`date-time`, `uri`, `uuid`, …) — **Placar (2-0)** — fonte:
https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md ·
https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html

**A tenaz que obriga dois schemas, nas duas pontas** (`F0-02 · Nota`): um schema único que
**carregue** as invariantes de validade é **rejeitado na geração** (400, antes da inferência); um
schema único que as **omita** para caber no subset **não valida nada**. Não há terceira saída — e
por isso o par é `manifesto.llm.schema.json` (subset, só para gerar) + `manifesto.schema.json`
(2020-12 completo, único que valida), ambos derivados da mesma fonte.

Consequências diretas, todas herdadas do mesmo claim:

- **Sem árvore.** `children: {"$ref": "#"}` retorna **400 na validação do schema, antes da
  inferência**. O manifesto é **lista plana de nós com referência por id** (`F0-02 · Nota`).
- **A união discriminada é `anyOf` de objetos com o campo de tipo como `{"const": "..."}`** — nem a
  Anthropic nem a OpenAI documentam `oneOf` no subset; `discriminator` é vocabulário OpenAPI, não
  JSON Schema puro — **Placar (2-0)** — fonte:
  https://developers.openai.com/api/docs/guides/structured-outputs ·
  https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs
- **`additionalProperties: false` em todo objeto.** *Condição de escopo:* nos schemas **entregues
  aos dois fornecedores** é o único valor aceito — não é higiene, é o subset. No schema de
  validação é escolha, e o card a torna obrigatória com um critério de vazio
  (`rg -L '"additionalProperties": false' schema/*.json` → vazio, `F0-02 · Aceitação`), porque é ele
  que transforma "campo novo sem bump" em falha dura.
- **As invariantes numéricas moram fora do schema do LLM** — e a prova de que os dois não
  divergiram é um teste de que o subset é **relaxamento** do completo, não um schema diferente
  (`F0-02 · Nota`).
- **Desenhe para a interseção de plataforma.** Os limites de tamanho do modo `strict` estão
  **em disputa** (OpenAI: 10 níveis / 5.000 propriedades / 1.000 enums; Azure: 5 níveis / 100
  propriedades) — **Placar (1-1) EM DISPUTA** — fonte:
  https://developers.openai.com/api/docs/guides/structured-outputs ·
  https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs
  Regra segura: profundidade ≤5, poucas dezenas de propriedades.
- **Os dois fornecedores são parcialmente opostos:** a OpenAI exige **tudo** em `required`
  (opcional se emula com `["string","null"]`) e **aceita recursão**; a Anthropic aceita opcionais
  e **proíbe recursão** — **Placar (2-0)** (lado OpenAI) — fonte:
  https://developers.openai.com/api/docs/guides/structured-outputs. *Condição de escopo:* se o
  manifesto é portátil entre os dois é a **ADR da semente `P-08`** (panorama §6.2, que a nomeia
  "ADR-008"), entregue dentro do card `F0-02` — e ela **ainda não tem número no registro do
  PROGRAMA**. **Enquanto essa ADR não estiver lida, não presuma nem "uma fixture só" nem "uma por
  fornecedor"** — presumir a primeira quebra na portabilidade, presumir a segunda paga por uma
  portabilidade que ninguém pediu.
- **Congele o schema entregue ao LLM.** Ele é compilado em gramática: a primeira chamada com
  schema novo paga latência extra (até minutos) e a gramática fica em cache por 24 h —
  **Placar (2-0)** — fonte: https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html.
  As duas fontes **divergem no início da contagem** (Anthropic: "desde o último uso"; AWS: "desde
  o primeiro acesso") — planeje pelo pior caso. Iterar o schema a cada rodada e esperar latência
  baixa é contraditório.

### Tempo: a unidade é ADR-0010 — esta skill não a decide, ela diz o que a escolha tem de pagar

**Dono único, declarado:** a unidade de tempo do manifesto é **ADR-0010**, entregue pelo card
`F0-02` **junto com o conversor único** — `F0-02 · Entrega`. Trocar depois atravessa manifesto,
snapshot, legenda, áudio e teste, e o próprio PROGRAMA declara que isso **não é ponto de troca
barata — "é um programa novo"** (`PROGRAMA.md` §II · "Pontos de troca barata").

**O PROGRAMA está tensionado neste ponto, e a tensão é do ADR, não sua:** a linha "Motor de
composição" de §II diz que "o modelo *frame-based* está no manifesto", enquanto `F0-02 · refuta (3)`
exige que *"a unidade de tempo escolhida sobreviva a uma mudança de fps"* — e um
número de frames não sobrevive. Quem encontrar essa divergência **abre item de ledger e lê a
ADR-0010**; não a resolve escrevendo código.

**As quatro evidências que qualquer escolha tem de responder** (nenhuma delas é opinião):

1. **fps é parâmetro de render, não de conteúdo.** O formato primário (16:9 × 9:16) é decisão de
   dono ainda aberta — semente `P-10`, panorama §6.2. Uma unidade em frames congela o fps antes da
   decisão existir.
2. **As invariantes normativas do produto já são em segundos:** duração de nó de texto
   ≥ max(0,833 s; caracteres/20) e ≤ 7 s, "escrito **em segundos**, nunca em frames" —
   **Placar (2-0)**, o do elo mais fraco: piso e teto são R14-01 **(2-0)** e o divisor 20 (20 CPS
   Netflix) é R14-03 **(3-0)**, que é a atribuição do panorama — fonte: panorama §9.2 · `R14-01` ·
   `R14-11`. (Os números normativos são de `motion-design-system`; aqui só a **unidade** é o ponto.)
3. **O tipo `Caption` do próprio Remotion é em ms** (`startMs`, `endMs`, `timestampMs`) —
   **Placar (2-0)** — fonte: claim `R04-06` do panorama. A legenda é o nó de timing mais
   apertado; num manifesto em frames ela é o subsistema que converte na contramão.
4. **Tempo absoluto carrega a sua própria taxa; frame não.** OTIO representa tempo como
   `RationalTime {rate, value}` justamente porque um número de tempo sem a taxa ao lado é
   ambíguo — **Placar (3-0)** — fonte:
   https://opentimelineio.readthedocs.io/en/latest/tutorials/otio-file-format-specification.html

**O custo que qualquer unidade absoluta cobra, e que não pode ser escondido:** a duração de uma
transição por mola **não existe em ms nem em segundos**. Ela é derivada por
`timing.getDurationInFrames({fps})`, que é função do fps — **Placar (2-0)** — fonte:
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/types.ts ·
https://www.remotion.dev/docs/transitions/transitionseries
Portanto o manifesto guarda a **especificação** do timing (`{kind: "spring", config: {...}}`), nunca
uma duração para ele. Um `durationMs` num nó de transição por mola é uma mentira que só aparece
quando alguém troca o fps.

**A regra de conversão que não acumula erro** (vale para qualquer unidade absoluta; com `u` = a
unidade por segundo — 1.000 para ms):

- Converta **âncoras absolutas**, nunca durações encadeadas:
  `f(t) = round(t * fps / u)`; `startFrame = f(start)`, `endFrame = f(end)`,
  `durationInFrames = f(end) − f(start)`. O erro fica limitado a meio frame **por âncora** e
  não propaga. Somar `round(duração_i)` acumula até N/2 frames em N nós.
- O fim de um nó é **o mesmo literal** do início do seguinte, passado pela mesma função —
  é isso que garante que o corte não sobre nem falte um frame.
- O último frame de uma duração é `durationInFrames − 1` — **Placar (1-0)** — fonte:
  https://www.remotion.dev/docs/the-fundamentals (ver "Não verificado").
- **A duração total da composição não é `f(total)`.** *Condição de escopo: a regra é de
  `<TransitionSeries>` (R02-11) — em `<Series>`/`<Sequence>` sem transição o termo subtraído é
  zero.* Ali é `Σ durações das sequences − Σ durações das transições`: durante a transição as duas
  cenas rodam ao mesmo tempo e o total **encurta** —
  **Placar (2-0)** — fonte: https://www.remotion.dev/docs/transitions/transitionseries. As duas
  contas divergem, e a divergência aparece como cauda preta no fim do vídeo, que nenhum smoke pega
  (panorama §9.2, tabela de invariantes estruturais, R02-11).
- A conversão vive em **uma** função exportada (o "conversor único" que `F0-02` entrega), com um
  teste de tabela; o lado Python reimplementa **a mesma tabela**, não a mesma intenção.

### Regra de fonte única: um valor de domínio, um tipo nomeado

Um valor de domínio (`NodeId`, `TransitionKind`, `FpsProfile`, a unidade de tempo) vive num único
tipo nomeado. O motivo aqui não é estilo: "default de flag declarado duas vezes" e "número
redigitado em prosa" são dois itens do catálogo de falso verde do programa — norma:
`docs/PLAYBOOK-REFERENCIA.md:527` · `docs/PLAYBOOK-REFERENCIA.md:410`.

- **Enum de transições é derivado do `exports` do pacote instalado**, num arquivo só (~25 linhas),
  não digitado à mão: `cube()` tem página de doc mas **não** está no pacote — é item pago separado
  (`@remotion-dev/cube-presentation`) — **Placar (3-0)** — fonte:
  https://www.remotion.dev/docs/transitions/presentations/cube ·
  https://registry.npmjs.org/@remotion/transitions/latest.
  *Condição de escopo:* o número de presentations é **por versão pinada** — 19 em
  `@remotion/transitions@4.0.507` (R02-07, 3-0), e `pushCut()` existe **a partir da 4.0.500**
  (R02-06, **1-0**), logo o catálogo **muda de tamanho com o pin** — panorama §5.1 · "Catálogo de
  transições". Escrever "19" no schema é congelar a versão sem dizer. Um nome a mais no enum vira
  erro de import em tempo de render; um a menos é capacidade perdida em silêncio.
- **O nó de asset fecha com `hash` e `license` — os dois em `required`, nos dois schemas.** É o que
  põe dentro do contrato a regra de calibração `C7` (*"nada de URL no manifesto resolvido; só hash
  de conteúdo"* — `PROGRAMA.md` §Parte 0, linha `C7`): fora do schema ela é norma reinjetada por
  hook, que validador nenhum reprova. `fetchedFrom` guarda a **procedência** e **não** é caminho de
  leitura; quem resolve, licencia e prova origem é `asset-acquisition`, dona da regra.
- **Ids estáveis são requisito, não conforto:** sem id não há re-render parcial, não há diff entre
  versões e não há cache — fonte: `docs/pesquisa/L03-panorama-achado-vs-recomendacao.md:428`. E o
  id é também o mecanismo de aninhamento, já que a árvore recursiva está proibida. A única
  trava de formato disponível dentro do schema do LLM é `pattern` (ex.: `^n-[0-9]{3}$`), sem
  backreference, lookahead nem `\b` — **Placar (1-0)** — fonte:
  https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md
- **Nada sensível em nome de propriedade, `enum`, `const` ou `pattern`:** o schema compilado é
  cacheado separadamente do conteúdo e não recebe as mesmas proteções — **Placar (1-0)** — fonte:
  https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use.md

### Validação como gate — quem valida, onde, contra o quê

1. **O runner Node valida antes do bundler**, contra `schema/manifesto.schema.json` (2020-12
   completo, com as constraints numéricas). O Ajv não serve direto de prateleira: draft-2020-12
   **não é o export padrão** (o padrão é draft-07) e `discriminator` só funciona com a opção
   ligada — **Placar (1-0)** — fonte: https://ajv.js.org/json-schema.html
2. **O lado Python valida em espelho antes de chamar o Manim.** Pydantic v2 emite 2020-12 com
   `$defs`, mas a doc **não** afirma que ele valide contra um JSON Schema externo arbitrário —
   **Placar (1-0)** — fonte: https://pydantic.dev/docs/validation/latest/concepts/json_schema/.
   Ausência de menção não é prova de ausência, e também não autoriza planejar como se validasse.
3. **O Remotion não é o gate.** Ele exige o Zod na prop `schema` do `<Composition>` com topo
   `z.object()` e input props serializáveis em JSON — **Placar (1-0)** — fonte:
   https://www.remotion.dev/docs/schemas · https://www.remotion.dev/docs/passing-props. Se o schema
   é validado **no render** (e não só no Studio) ninguém afirmou; até medir, valide no runner.
4. **O gate de fonte única** (`just contrato:gerar`) regenera os dois schemas e os modelos e falha
   se o `git diff` for não-vazio — `F0-02 · Aceitação` · `AB-061`. Ele precisa falhar **também por
   ausência**: `git diff --exit-code` num diretório de saída não enxerga arquivo não rastreado —
   norma: `docs/PLAYBOOK-REFERENCIA.md:523`.
5. **`just contrato:subset` é um gate separado do de geração**: prova por lista que o schema-do-LLM
   não tem chave fora do subset, **e** que o de validação contém as invariantes que o outro não
   pode ter — `F0-02 · Aceitação`. Sem ele os dois schemas divergem sem que nada fique vermelho.
6. **A fixture de regressão é o manifesto congelado**, nunca saída de LLM contra saída de LLM:
   nenhum dos dois fornecedores garante saída idêntica, a Anthropic documenta que "even with
   `temperature` of `0.0`, the results will not be fully deterministic" e não expõe `seed` —
   **Placar (2-0)** — fonte: https://platform.claude.com/docs/en/api/messages.md
7. **A timeline resolvida é o segundo artefato do runner** — por nó: `id`, frame inicial, frame
   final, assets com hash e parâmetros já calculados. É texto, é diffável, roda em milissegundos e
   pega a classe de erro mais frequente (deslocamento de tempo) antes de gastar minutos de render —
   fonte: panorama §9.2 · "Camada 2". Limite duro: a expectativa da fixture tem de ser **escrita à
   mão**; se ela vier de outra execução do mesmo motor, oráculo e implementação erram juntos.

### Versionamento e migração

- OTIO **não tem versão de arquivo no topo**: cada objeto carrega `"OTIO_SCHEMA": "Tipo.N"` —
  **Placar (3-0)** — fonte:
  https://opentimelineio.readthedocs.io/en/latest/tutorials/otio-file-format-specification.html
  É a resposta que 15 anos de interoperabilidade em cinema deram para "como versiono um contrato que
  vai evoluir", e é o que o `F0-02` copia sem adotar OTIO (`F0-02 · Entrega`, claim `R16-24`).
- **Por objeto já é a decisão do card**, não uma opção em aberto: custa 1 campo por variante do
  `anyOf` + 1 função `migrate()` por bump, e é o que permite evoluir um tipo de nó sem invalidar o
  manifesto inteiro. **Topo único** forçaria bump global **mais** migração de todas as fixtures a
  cada mudança de um nó — panorama §5.1 · "Versionamento do manifesto". A reversão entre as duas
  custa 1 arquivo de schema + 1 função de migração, e passa por ADR.
- A migração é testada como `migrate(fixture_antiga) == fixture_nova`, com a fixture antiga
  **preservada** no repositório. Regravar a fixture antiga apaga a única prova de que a migração faz
  alguma coisa.
- Um bump do schema **entregue ao LLM** recompila a gramática e paga a latência da primeira chamada
  de novo (**Placar (2-0)**, fonte acima). Versionar não é higiene: é orçamento de latência.

### Formatos existentes — o que foi examinado e por que não se adota

| Formato | O que é (verificado) | Veredito |
|---|---|---|
| **OpenTimelineIO** | JSON, Apache-2.0, ASWF, core C++ + binding Python; `RationalTime{rate,value}`; core embarca só `otio_json`/`otiod`/`otioz` — **Placar (3-0)** | **Não adotar**: modela corte editorial (clips, tracks, mídia), não "renderize este componente com estas props", e não tem binding JS/TS oficial documentado — num pipeline Node+Python ficaria só de um lado. **Copiar** o versionamento por objeto. |
| **EDL (`cmx_3600`), FCP XML, AAF, ALE** | adaptadores **contrib**, fora do core do OTIO — **Placar (3-0)** | **Não adotar**: além de não virem no core, nenhum expressa parâmetro de componente React nem cena de Manim. |
| **Editly** | spec declarativa JSON/JSON5 (`fps`, `clips`, ~17 tipos de layer), MIT, **sem JSON Schema publicado** — **Placar (3-0)** | **Não adotar**: sem schema publicado não há contrato validável nem codegen; serve como referência de vocabulário de layer. |
| **Motion Canvas, Revideo** | animação descrita em TS/JSX; **não publicam** formato de timeline declarativo — **Placar (3-0)** | **Fora da comparação**: não são formato de dados. |

Fontes desta tabela: https://opentimelineio.readthedocs.io/en/latest/tutorials/adapters.html ·
https://github.com/AcademySoftwareFoundation/OpenTimelineIO · https://github.com/mifi/editly ·
https://github.com/motion-canvas/motion-canvas · https://midrender.com/revideo/docs

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

1. **Modelar nós como árvore recursiva** (`children: {"$ref": "#"}`). É o desenho óbvio para
   composição visual e retorna **400 antes da inferência** no structured output da Anthropic
   (2-0); o card manda lista plana com referência por id (`F0-02 · Nota`). *Condição de escopo:*
   a proibição vale para o schema **entregue ao LLM**; o schema de validação (2020-12 completo, no
   Ajv) pode ser recursivo à vontade — o que não muda a forma do dado, que já está decidida.
2. **Escrever a união como `oneOf` + `discriminator`.** É o idioma canônico de OpenAPI e não está no
   subset de nenhum dos dois fornecedores (2-0); no Ajv, `discriminator` ainda exige opt-in (1-0).
   Use `anyOf` + `const`.
3. **Colocar `minimum: 0` na duração e `minLength: 1` no título.** É exatamente o que "schema
   estrito" sugere. *Condição de escopo:* rejeitado no schema entregue à **saída estruturada da
   Anthropic** (2-0); a OpenAI documenta essas chaves como suportadas e o Azure como não
   suportadas (1-1 EM DISPUTA), então a regra da interseção é não usá-las. As invariantes vão para
   o segundo schema, que é 2020-12 completo e as aceita todas.
4. **Deixar `additionalProperties: true` "para não travar a evolução".** No schema do LLM o valor
   fechado é o único aceito (2-0); no de validação, é ele que transforma "campo novo sem bump" em
   falha dura — e o card tem critério de vazio que reprova qualquer objeto sem ele.
5. **Copiar o exemplo de `strict` da OpenAI para a Anthropic.** Os subsets são parcialmente opostos
   — `required` completo × opcionais de verdade, recursão proibida × permitida (2-0 / 1-0).
6. **Guardar `durationMs` de uma transição por mola.** A duração dela é derivada do fps por
   `getDurationInFrames({fps})` (2-0); o campo fica correto no fps em que foi escrito e errado em
   todos os outros, sem erro nenhum.
7. **Somar as durações dos nós para obter a duração da composição.** Transição é subtrativa (2-0);
   somar produz cauda preta no fim, que não é erro de execução e não aparece em smoke.
8. **Converter durações e depois somar.** Arredonda N vezes e o erro acumula; converta âncoras
   absolutas e subtraia frames.
9. **Decidir a unidade de tempo dentro do card que você está executando.** É ADR-0010, entregue por
   `F0-02 · Entrega` com o conversor único; e o PROGRAMA se contradiz em aberto entre §II (linha
   "Motor de composição") e `F0-02 · refuta (3)`. Escolher em silêncio produz dois conversores e
   nenhuma ADR — o pior dos dois mundos.
10. **Usar `Date`, `Map` ou `Set` no tipo do manifesto.** Sobrevivem em memória no Zod e morrem na
    fronteira CLI→render, onde as props têm de ser serializáveis em JSON (1-0); e `z.date()` é um
    dos tipos que `z.toJSONSchema()` recusa por padrão (2-0). Data é string ISO com
    `format: "date-time"`, que o subset aceita.
11. **Setar `unrepresentable: "any"` para o codegen "só funcionar".** A opção existe (2-0); a
    consequência — os tipos irrepresentáveis viram `{}` e o Pydantic gerado aceita **qualquer
    coisa** naquele campo — é a premissa aberta **AB-061** (panorama §7.5), não um claim fechado.
    Nas duas leituras o contrato continua verde e deixa de existir.
12. **Chamar o Zod da `<Composition>` de gate de validação.** Ninguém afirmou que ele roda no render
    (só no Studio é o que está documentado); o gate é o validador do runner.
13. **Adotar OTIO "porque é padrão".** Sem binding JS/TS oficial, adotá-lo custa um serviço Python
    só para ler a timeline (3-0). O que se adota é a ideia de versionar por objeto.
14. **Iterar o schema a cada rodada de prompt.** Recompila a gramática (até minutos na primeira
    chamada) e invalida o cache (2-0).
15. **Escrever o enum de transições à mão a partir da doc do site.** A doc lista `cube()`, que não
    está no pacote e é pago (3-0); derive do `exports` instalado.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| O manifesto valida no Ajv | O default do Ajv é **draft-07**, mais permissivo que o subset do LLM: aceita `minLength`, recursão e `oneOf` (1-0 / 2-0) | Um gate que envia o schema real à API com `max_tokens` mínimo, só para provocar a validação de schema (200 × 400) |
| Os dois schemas existem e ambos passam | Nada prova que o subset descreve **o mesmo dado** que o completo; eles derivam juntos e divergem separados | `just contrato:subset`: lista de chaves proibidas no schema-do-LLM **+** asserção de que ele é relaxamento do completo (`F0-02 · Aceitação`) |
| O Zod aceita o objeto, logo o Python aceita | Com `unrepresentable: "any"` o campo vira `{}` e o Pydantic aceita qualquer coisa (AB-061, aberto) | Regenerar schema + modelos no CI e falhar com `git diff` não-vazio, **mais** um grep por `{}` no schema gerado |
| O schema gerado está commitado e igual | `git diff --exit-code` num diretório de saída não enxerga **arquivo não rastreado** (`PLAYBOOK:523`) | Um `test -s` no arquivo esperado antes do diff — critério que falha **por ausência** |
| O manifesto passou no schema, logo o Remotion renderiza | Props têm restrição que o JSON Schema não expressa: topo objeto e serializável em JSON (1-0) | Um teste de round-trip `JSON.parse(JSON.stringify(props))` comparando o resultado |
| A timeline resolvida bate com o manifesto | Se ela é gerada pelo mesmo código que renderiza, oráculo e implementação erram juntos (panorama §9.2, "Limite duro" da Camada 2) | Uma expectativa **escrita à mão** por fixture, não outra execução do mesmo motor |
| `temperature: 0` deu a mesma saída duas vezes | As duas docs dizem que não é garantido; duas amostras iguais são coincidência (2-0) | Regressão contra **manifesto congelado**, com o manifesto cacheado por hash da entrada canonicalizada |
| A composição renderiza sem erro | Duração maior que o conteúdo não é erro: vira cauda preta no fim (2-0) | Assert `durationInFrames declarado == Σ(sequences) − Σ(transições)` (panorama §9.2, invariantes estruturais), com os dois lados computados por funções distintas. A forma ingênua do invariante — "soma das durações dos nós" — é o próprio bug: fica **verde** no manifesto errado e **vermelho** em todo vídeo correto que tenha transição |
| O enum de `type` do nó cobre tudo que a doc mostra | A doc mostra `cube()`, que não está no pacote (3-0) | Enum derivado do `exports` do pacote instalado, com teste que compara enum × exports |
| O schema novo funcionou na primeira chamada | Validação de schema é imediata; a **compilação de gramática** pode levar minutos e depois cacheia por 24 h (2-0) — a chamada verde esconde que o schema mudou | Teste que compara `sha256(schema/manifesto.llm.schema.json)` com o valor congelado e falha se mudou sem bump de versão de nó |
| A conversão de tempo tem teste e passa | Um teste de ida (`converte(x) == y`) não pega erro acumulado nem divergência JS × Python | Teste de **tabela** compartilhada pelos dois lados, com âncoras encadeadas: N nós contíguos, assertando que `fim(i) == início(i+1)` em frames |

## O que esta skill NÃO cobre

- **Como chamar a API de saída estruturada** (`output_config.format`), prompt caching, breakpoints,
  mínimo cacheável e custo por iteração → `llm-authoring`.
- **Como o Remotion consome o manifesto**: `<Composition>`, `<Sequence>`/`<Series>`/
  `<TransitionSeries>`, `useCurrentFrame()`, premount, `staticFile` → `remotion-core`.
- **Os números normativos** de duração de leitura, CPS, safe area, spring e cadência →
  `motion-design-system`.
- **O tipo `Caption`, alinhamento por palavra e sincronia de áudio** → `audio-captions-sync`.
- **O lado Python do consumo** (invocar o Manim, alfa, WebM) → `manim-bridge`.
- **Desenho de gates e critérios falsificáveis em geral** → `falsifiable-gates`; **golden master e
  caracterização de vídeo** → `video-characterization`.

## Não verificado

Tudo abaixo entrou com placar < 2-0, sem placar, ou como decisão ainda não lida. Nada disto pode
virar gate antes de fechar.

| Item | Placar | Comando que fecha |
|---|---|---|
| **ADR-0010 (unidade de tempo): o valor decidido não está escrito no PROGRAMA**, e §II (linha "Motor de composição", frame-based) aponta para o lado oposto de `F0-02 · refuta (3)` (sobreviver a mudança de fps) | decisão, sem placar | ler ADR-0010 quando `F0-02` for executado; até lá, nenhum campo de tempo entra em fixture nem em componente |
| **A ADR da semente `P-08` (portabilidade Anthropic × OpenAI)** — quantas fixtures de schema existem depende dela; o panorama §6.2 a chama de "ADR-008" e ela **não tem número no registro de ADRs do PROGRAMA** | decisão, sem placar | ler essa ADR no card `F0-02` antes de escrever a segunda fixture |
| `z.fromJSONSchema()` é experimental — só **uma** das duas fontes de R16-03 o menciona, e as duas são do mesmo projeto | (1-0) | abrir https://zod.dev/json-schema e conferir a marcação; ou `npx tsx -e "import{z}from'zod';console.log(typeof z.fromJSONSchema)"` |
| Ajv: qual classe importa 2020-12 e se `discriminator: true` funciona com `anyOf` + `const` | (1-0) | `npm i ajv && node -e "const A=require('ajv/dist/2020');const a=new A({discriminator:true});console.log(a.opts.discriminator)"` |
| Pydantic v2 emite 2020-12 / não valida schema externo | (1-0) | `python -c "from pydantic import BaseModel; print(BaseModel.model_json_schema())"` e `pip install jsonschema` como plano B |
| `strict` da Anthropic aceita propriedade fora de `required` (**AB-062**) | (1-0) | uma chamada com tool `strict` + campo opcional; ver se volta 400 |
| `pattern` é suportado no schema (sem backreference/lookahead/`\b`) | (1-0) | enviar o schema com `pattern` e `max_tokens: 16`; 200 × 400 |
| Round-trip Zod→JSON Schema→Pydantic sem `{}` vazio (**AB-061**) | premissa aberta | `grep -c '{}' schema/manifesto.schema.json` depois de gerar, e o gate de `git diff` |
| Remotion: topo `z.object()`, props serializáveis, e se o schema é validado **no render** | (1-0) / não afirmado | `npx remotion render <id> --props=./props-invalido.json` e observar |
| Último frame é `durationInFrames − 1` e `segundos * fps` | (1-0, fonte de domínio único) | render de 1 s e `ffprobe -count_frames` no resultado |
| Limites de tamanho do `strict` (níveis, propriedades, enums) | (1-1) EM DISPUTA | medir no provedor exato, enviando o schema real |
| Schema compilado é cacheado à parte e não recebe as mesmas proteções de dado sensível | (1-0) | reler https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use.md e conferir a nota; até lá, tratar nome de propriedade/`enum`/`const`/`pattern` como público |
| Trocar `output_config.format` invalida o prompt cache da thread | (1-0) | duas chamadas com o mesmo prefixo e schemas diferentes, lendo `usage.cache_read_input_tokens` |
| **`Math.round` (JS) e `round` (Python) divergem no meio-frame** — dedução, sem fonte | sem placar | `node -e "console.log(Math.round(2.5))"` × `python3 -c "print(round(2.5))"`; se divergir, o conversor único precisa de regra explícita de desempate nos dois lados |
| Tamanho do catálogo de transições na versão que este repo vai pinar (19 vale para 4.0.507; `pushCut()` a partir de 4.0.500) | (1-0) para o corte de versão | `node -e "console.log(Object.keys(require('@remotion/transitions/package.json').exports).length)"` no pin instalado — o enum é derivado, nunca digitado |
| Os alvos `just contrato:gerar` / `:testar` / `:subset` do `verification_signal` são entregues por `F0-02` e ainda não existem | sem placar | executar `F0-02`; antes dele o sinal desta skill falha por ausência, que é o comportamento correto |

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
