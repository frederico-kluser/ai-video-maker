# R16 — Manifesto do vídeo: schema, saída estruturada de LLM e validação

**Escopo desta pesquisa:** fecha o contrato de dados do manifesto (draft de JSON Schema, versionamento,
fonte única entre TS e Python), o que as APIs de saída estruturada da Anthropic e da OpenAI **permitem e
proíbem** no schema, prompt caching, determinismo de LLM, a integração Zod↔Remotion, e se vale adotar um
formato aberto de timeline em vez de inventar. **NÃO** responde: performance de validação nesta máquina,
custo real por vídeo, nem o desenho concreto dos campos do manifesto (isso é decisão de dono + ledger).

> **Nota de método (limitação real desta rodada):** o orçamento de `WebSearch` da sessão foi esgotado
> (200/200) depois de 4 buscas. As demais fontes foram obtidas por `WebFetch` direto de URLs canônicas.
> 24 páginas foram efetivamente abertas e lidas; 5 tentativas falharam (404/403/redirect) e **não** foram
> usadas como fonte: `koxudaxi.github.io/datamodel-code-generator` (404), `motioncanvas.io/docs` (403),
> `openai.com/index/introducing-structured-outputs-in-the-api` (403), `npmjs.com/package/@remotion/zod-types`
> (403), `github.com/motion-canvas/core` (404). Isso rebaixa alguns placares para 1-0 — está sinalizado.
> Data de coleta: **2026-08-10**.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R16-01 | A versão corrente da especificação JSON Schema é **2020-12** (drafts liberados: 04, 06, 07, 2019-09, 2020-12) e é o dialeto que Pydantic v2 e o subset da AWS/Anthropic assumem. | (3-0) | CONFIRMADO | https://json-schema.org/specification |
| R16-02 | No Ajv, draft-2020-12 **não** é o export padrão (o padrão é draft-07) e exige importar uma classe `Ajv` diferente; o keyword `discriminator` só funciona com a opção `discriminator: true`. | (1-0) | NAO_VERIFICADO | https://ajv.js.org/json-schema.html |
| R16-03 | Zod 4 tem conversão para JSON Schema **de primeira parte** via `z.toJSONSchema()`, com `target` default `"draft-2020-12"`, `reused: "inline"\|"ref"` para `$defs`, e `unrepresentable: "throw"` como padrão para tipos sem correspondência (`bigint`, `date`, `map`, `set`, `transform`, `custom`, …). | (2-0) | PROVÁVEL | https://zod.dev/json-schema |
| R16-04 | `model_json_schema()` do Pydantic v2 emite JSON Schema **Draft 2020-12**, declara `$schema: https://json-schema.org/draft/2020-12/schema` e coloca submodelos em `$defs`. | (1-0) | NAO_VERIFICADO | https://pydantic.dev/docs/validation/latest/concepts/json_schema/ |
| R16-05 | `datamodel-code-generator` gera **Pydantic v2 BaseModel / dataclass / TypedDict / msgspec Struct** a partir de JSON Schema (`--input-file-type jsonschema --output-model-type pydantic_v2.BaseModel`), é MIT, exige Python ≥3.10 e está na 0.72.3 (2026-08-10). | (2-0) | PROVÁVEL | https://github.com/koxudaxi/datamodel-code-generator |
| R16-06 | `quicktype` aceita **JSON Schema como entrada** (`--src-lang`) e gera TypeScript e Python entre 18+ alvos; licença Apache-2.0. | (1-0) | NAO_VERIFICADO | https://github.com/glideapps/quicktype |
| R16-07 | TypeBox produz **objetos que já são JSON Schema** em memória (inferindo como tipos TS), cobre drafts 3→2020-12 e traz compilador JIT próprio como alternativa ao Ajv; v1.x, `npm install typebox`. | (1-0) | NAO_VERIFICADO | https://github.com/sinclairzx81/typebox |
| R16-08 | Na Anthropic, o parâmetro atual de saída estruturada é **`output_config.format`** com `{"type":"json_schema","schema":…}` e **não exige beta header**; o antigo `output_format` + header `structured-outputs-2025-11-13` seguem funcionando por um período de transição. | (2-0) | PROVÁVEL | https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md |
| R16-09 | O subset de JSON Schema aceito pela saída estruturada da Anthropic **não suporta**: schemas recursivos, `$ref` externo, `minimum`/`maximum`/`multipleOf`, `minLength`/`maxLength`, `additionalProperties` diferente de `false`; `minItems` de array só aceita **0 ou 1**. | (2-0) | PROVÁVEL | https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html |
| R16-10 | `pattern` (regex) **é** suportado pela Anthropic no schema, mas sem backreferences (`\1`), sem lookahead/lookbehind e sem word boundaries (`\b`). | (1-0) | NAO_VERIFICADO | https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md |
| R16-11 | Em `strict: true` da Anthropic, `strict` é campo **de topo** da tool (irmão de `name`/`description`/`input_schema`), exige `additionalProperties: false`, mas **não exige** que todas as propriedades estejam em `required`. | (1-0) | NAO_VERIFICADO | https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use.md |
| R16-12 | Saída estruturada é **incompatível com citations** em modelos Anthropic: habilitar as duas retorna 400. | (1-0) | NAO_VERIFICADO | https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html |
| R16-13 | O schema é compilado em gramática: a **primeira** chamada com um schema novo paga latência extra (até minutos em schemas complexos) e a gramática compilada fica em cache por **24 h**. | (2-0) | PROVÁVEL | https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html |
| R16-14 | No modo `strict` da OpenAI, **todas** as propriedades precisam estar em `required` e **todo** objeto precisa de `additionalProperties: false`; campo opcional se emula com `"type": ["string","null"]`. | (2-0) | PROVÁVEL | https://developers.openai.com/api/docs/guides/structured-outputs |
| R16-15 | O modo `strict` da OpenAI **não suporta** `allOf`, `not`, `dependentRequired`, `dependentSchemas`, `if`/`then`/`else`, e o objeto **raiz não pode ser `anyOf`**. | (2-0) | PROVÁVEL | https://developers.openai.com/api/docs/guides/structured-outputs |
| R16-16 | O modo `strict` da OpenAI **suporta schemas recursivos** (`$ref: "#"` para a raiz e `$ref: "#/$defs/..."`) — o oposto exato da Anthropic. | (2-0) | PROVÁVEL | https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs |
| R16-17 | Os limites numéricos de tamanho de schema no `strict` divergem entre plataformas: OpenAI documenta **10 níveis / 5.000 propriedades / 120.000 chars / 1.000 enums**; Azure OpenAI documenta **5 níveis / 100 propriedades**. | (1-1) | EM_DISPUTA | https://developers.openai.com/api/docs/guides/structured-outputs |
| R16-18 | Se `minLength`/`maxLength`/`pattern`/`format`/`minimum`/`maximum`/`minItems`/`maxItems` valem no `strict` da OpenAI: a doc da OpenAI lista boa parte como **suportada**; a doc do Azure lista **todas como não suportadas**. | (1-1) | EM_DISPUTA | https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs |
| R16-19 | Prompt caching Anthropic: marcador `cache_control: {"type":"ephemeral"}` (opcional `"ttl":"1h"`), TTL padrão **5 minutos**, **máximo 4 breakpoints** por request, hierarquia de invalidação `tools → system → messages`; escrita 5 min = 1,25× input, escrita 1 h = 2×, leitura = 0,1×. | (2-0) | PROVÁVEL | https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md |
| R16-20 | O prefixo mínimo cacheável **varia por modelo** (512 / 1.024 / 2.048 / 4.096 tokens) e prefixos abaixo do mínimo **falham em silêncio**: a inferência dá certo, o cache simplesmente não acontece e **nenhum erro é retornado**. | (2-0) | PROVÁVEL | https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md |
| R16-21 | Nenhum dos dois fornecedores garante saída idêntica: a Anthropic documenta que "even with `temperature` of `0.0`, the results will not be fully deterministic" e não expõe `seed`; a OpenAI documenta `seed` como "best effort" e "Determinism is not guaranteed". | (2-0) | PROVÁVEL | https://platform.claude.com/docs/en/api/messages.md |
| R16-22 | No Remotion, o schema Zod é atrelado pela prop **`schema`** do `<Composition>`, o tipo de topo **tem que ser `z.object()`**, `defaultProps` correspondentes são exigidos, e `@remotion/zod-types` fornece `zColor()`, `zTextarea()`, `zMatrix()`; desde **Remotion v4.0.426** o pacote é baseado em **Zod v4** (use `@remotion/zod-types-v3` para ficar no Zod 3.22.3). | (1-0) | NAO_VERIFICADO | https://www.remotion.dev/docs/schemas |
| R16-23 | Input props do Remotion **precisam ser um objeto serializável em JSON**; a CLI aceita `--props='{"a":1}'` **ou** `--props=./caminho/props.json`, e a via SSR usa `inputProps` em `selectComposition()`/`renderMedia()`, com `defaultProps` sobrescritos pelos input props. | (1-0) | NAO_VERIFICADO | https://www.remotion.dev/docs/passing-props |
| R16-24 | OpenTimelineIO serializa em JSON, **não tem versão de arquivo no topo** (cada objeto carrega `"OTIO_SCHEMA": "Tipo.N"`), representa tempo como `RationalTime {rate, value}`, e o **core só embarca `otio_json`/`otiod`/`otioz`** — EDL (`cmx_3600`), FCP XML, AAF e ALE são adaptadores contrib; Apache-2.0, core C++ + binding Python (0.18.1, 2025-11-09). | (3-0) | CONFIRMADO | https://opentimelineio.readthedocs.io/en/latest/tutorials/otio-file-format-specification.html |
| R16-25 | Entre os "vídeo como dado" examinados, só **OTIO** e **Editly** expõem formato declarativo serializado; **Motion Canvas** e **Revideo** descrevem animação em código TypeScript/JSX e não publicam formato de timeline declarativo. | (3-0) | CONFIRMADO | https://github.com/mifi/editly |

---

## 2. Detalhe por claim

### R16-01 — JSON Schema 2020-12 é a versão corrente
- **Verdade operacional:** o manifesto deve declarar `"$schema": "https://json-schema.org/draft/2020-12/schema"`.
  Isso alinha com o que Pydantic v2 já emite e com o subset que AWS/Anthropic validam, evitando um passo de
  downgrade de dialeto no meio do pipeline.
- **Como reconferir:** abrir https://json-schema.org/specification e conferir a frase "The current version is 2020-12!".
- **O que quebra se divergir:** se o time escolher draft-07 (default do Ajv), o Ajv "funciona sem esforço" mas
  o schema gerado por Pydantic/Zod/TypeBox passa a precisar de conversão; e `$defs` (2019-09+) vira `definitions`.
  Card afetado: o card que cria `schemas/manifest.schema.json` e o card do validador Node.
- **Fontes:**
  - https://json-schema.org/specification (primária) — "The current version is _2020-12_! The previous version was 2019-09."
  - https://pydantic.dev/docs/validation/latest/concepts/json_schema/ (primária) — declara conformidade com Draft 2020-12.
  - https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html (primária) — "supported JSON Schema Draft 2020-12 subset".

### R16-02 — Ajv: 2020-12 exige outra classe; `discriminator` é opt-in
- **Verdade operacional:** `import Ajv from "ajv"` dá draft-07. Para 2020-12 é outro import, e a doc avisa
  que "draft-2020-12 is not backwards compatible". Se quiser `oneOf` discriminado por `type` com mensagens de
  erro decentes, precisa ligar `discriminator: true` explicitamente.
- **Como reconferir:** https://ajv.js.org/json-schema.html, seções "JSON Schema versions" e "discriminator".
  Localmente: `npm i ajv && node -e "const A=require('ajv/dist/2020');console.log(typeof A)"`.
- **O que quebra se divergir:** o card do validador Node valida contra o dialeto errado e aceita manifesto inválido.
- **Fontes:** https://ajv.js.org/json-schema.html (primária). **Uma só fonte** — vira LEDGER-SEED L-02.

### R16-03 — Zod 4: `z.toJSONSchema()` é first-party
- **Verdade operacional:** não é preciso a dependência `zod-to-json-schema`. `z.toJSONSchema(schema, {target:"draft-2020-12", reused:"ref"})`
  emite `$defs`. Mas atenção ao inverso: `z.fromJSONSchema()` existe e está marcado **experimental**, e vários
  tipos Zod **não têm representação** (`z.date()`, `z.map()`, `z.set()`, `z.transform()`, `z.bigint()`, `z.custom()`) —
  o default é **lançar exceção**, não degradar em silêncio.
- **Como reconferir:** https://zod.dev/json-schema. Local: `npx tsx -e "import{z}from'zod';console.log(JSON.stringify(z.toJSONSchema(z.object({a:z.string()})),null,2))"`.
- **O que quebra se divergir:** o card "gerar manifest.schema.json a partir do Zod" morre, e a fonte única de
  verdade teria que inverter de direção (JSON Schema → Zod), que hoje é o caminho experimental.
- **Fontes:**
  - https://zod.dev/json-schema (primária) — target default draft-2020-12, opções `io`, `reused`, `unrepresentable`.
  - https://github.com/colinhacks/zod (primária, repo oficial) — feature listada como "Built-in JSON Schema conversion"; MIT.
  - *Ressalva de independência:* as duas fontes são do mesmo projeto (domínios distintos, mantenedor único).

### R16-04 — Pydantic v2 emite Draft 2020-12 com `$defs`
- **Verdade operacional:** o lado Python "fala" o mesmo dialeto do lado TS sem tradução.
- **Como reconferir:** `python -c "from pydantic import BaseModel; import json; print(json.dumps(BaseModel.model_json_schema(),indent=2))"`
  e conferir a chave `$schema`.
- **O que quebra se divergir:** o card de geração de modelos Python.
- **Fontes:** https://pydantic.dev/docs/validation/latest/concepts/json_schema/ (primária).
- **Meia-verdade explicitada:** a página **não** afirma que o Pydantic valide dados contra um JSON Schema
  externo arbitrário. Ausência de menção **não é prova de ausência** — mas também não autoriza planejar
  como se validasse. Ver LEDGER-SEED L-04.

### R16-05 — datamodel-code-generator é a ponte JSON Schema → Python
- **Verdade operacional:** receita concreta do lado Python:
  `datamodel-codegen --input schemas/manifest.schema.json --input-file-type jsonschema --output-model-type pydantic_v2.BaseModel --output manim_side/manifest_models.py`
- **Como reconferir:** https://pypi.org/project/datamodel-code-generator/ (versão/licença) e o README do repo (flags).
- **O que quebra se divergir:** o card "gerar modelos Python do manifesto" precisa cair para `quicktype` ou escrita à mão.
- **Fontes:**
  - https://github.com/koxudaxi/datamodel-code-generator (primária) — formatos de entrada/saída e flags.
  - https://pypi.org/project/datamodel-code-generator/ (primária) — 0.72.3, 2026-08-10, MIT, Python ≥3.10.
- **Não verificado:** quais drafts de JSON Schema exatamente são suportados — o README diz só "JSON Schema".

### R16-06 — quicktype como alternativa multi-linguagem
- **Verdade operacional:** serve para gerar **os dois lados** de um único JSON Schema, mas é um gerador de
  *modelos*, não de validadores acoplados ao schema.
- **Como reconferir:** https://github.com/glideapps/quicktype; local: `npx quicktype --src-lang schema --lang python manifest.schema.json`.
- **O que quebra se divergir:** nada crítico — é o plano B do R16-05.
- **Fontes:** https://github.com/glideapps/quicktype (primária).
- **Explicitamente NÃO verificado:** se o TypeScript gerado inclui *type guards* / validadores em runtime.
  A leitura do README não confirmou. Não planeje contando com isso.

### R16-07 — TypeBox: o schema *é* o objeto
- **Verdade operacional:** TypeBox inverte a relação — você escreve o JSON Schema e o tipo TS é inferido dele,
  em vez de escrever Zod e converter. Isso remove um passo de build e a classe de bug "o Zod aceita o que o
  JSON Schema rejeita". O custo: perde-se `@remotion/zod-types` (R16-22) e a edição visual no Studio.
- **Como reconferir:** https://github.com/sinclairzx81/typebox.
- **O que quebra se divergir:** é uma alternativa de arquitetura, não um card. Ver seção 7.
- **Fontes:** https://github.com/sinclairzx81/typebox (primária).

### R16-08 — Anthropic: `output_config.format`, sem beta header
- **Verdade operacional:** código novo escreve
  `output_config={"format":{"type":"json_schema","schema": SCHEMA}}` no `client.messages.create(...)`.
  Não é `output_format`, não é header beta.
- **Como reconferir:** https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md
- **O que quebra se divergir:** todo card que gera manifesto via LLM; e a skill de "saída estruturada".
- **Fontes:**
  - https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md (primária) — "The `output_format`
    parameter has moved to `output_config.format`, and beta headers are no longer required."
  - https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html (primária, independente) —
    "For InvokeModel API with Anthropic Claude models, use the `output_config.format` request field."
- **Nota de plataforma:** no endpoint `bedrock-mantle` da AWS o `output_config.format` é **rejeitado com 400** —
  lá tem que ser Converse ou InvokeModel no endpoint `bedrock-runtime`. Só importa se algum dia sair do local.

### R16-09 — O subset da Anthropic proíbe recursão e constraints numéricas/de tamanho
- **Verdade operacional — este é o claim que mais condiciona o desenho do manifesto.** Não dá para expressar,
  no schema entregue ao modelo: `"minLength": 1` num título, `"minimum": 0` numa duração, `"maxItems"` num
  array de nós, nem uma árvore recursiva de nós filhos. **O manifesto tem que ser plano/aninhado com
  profundidade fixa, e as invariantes numéricas ficam num validador de segunda etapa.**
- **Como reconferir:** as duas páginas abaixo; a lista "not supported" é literal nas duas.
- **O que quebra se divergir:** o card do schema do manifesto e a fixture de validação. Se alguém desenhar
  `children: {"$ref": "#"}` para nós aninhados, a chamada retorna **400 na validação do schema**, antes da inferência.
- **Fontes:**
  - https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md (primária).
  - https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html (primária, independente) —
    "Recursive schemas / External `$ref` references / Numerical constraints (`minimum`, `maximum`, `multipleOf`) /
    String constraints (`minLength`, `maxLength`) / `additionalProperties` set to anything other than `false`".
- **Suportado (para o desenho aproveitar):** `enum` (só strings/números/bools/nulls), `const`, `anyOf`,
  `allOf` (com limitações — `allOf` com `$ref` não é suportado), `$ref`/`$defs` **internos**, `default`,
  formatos de string `date-time`/`time`/`date`/`duration`/`email`/`hostname`/`uri`/`ipv4`/`ipv6`/`uuid`,
  e `minItems` de array **apenas com valor 0 ou 1**.

### R16-10 — `pattern` é suportado (com limites de regex)
- **Verdade operacional:** dá para restringir strings por regex (`^[a-z0-9-]+$` para ids de nó, por exemplo)
  mesmo sem `minLength`. Mas nada de backreference, lookahead/lookbehind ou `\b`.
- **Como reconferir:** https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md, seção de pattern.
- **O que quebra se divergir:** se `pattern` não valer, ids e enums de `type` perdem a única trava de formato
  disponível dentro do schema, e a validação inteira migra para a segunda etapa.
- **Fontes:** https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md (primária).
  A página da AWS **não menciona** `pattern` na lista de suportados nem na de não-suportados — por isso 1-0.
- **Aviso operacional colhido junto:** a doc de strict tool use avisa que schemas compilados são cacheados
  separadamente do conteúdo e **não recebem as mesmas proteções de PHI** — não coloque dado sensível em
  nomes de propriedade, `enum`, `const` ou `pattern`.

### R16-11 — `strict: true` em tool NÃO exige tudo em `required`
- **Verdade operacional:** esta é a **diferença de desenho mais importante entre Anthropic e OpenAI**. Na
  Anthropic o exemplo oficial tem `properties: {location, unit}` com `required: ["location"]` e
  `additionalProperties: false` — ou seja, **campos opcionais de verdade**. Na OpenAI, tudo tem que estar em
  `required` e opcional é emulado com `["string","null"]` (R16-14). Um manifesto desenhado para a Anthropic
  com campos opcionais **não roda em modo strict na OpenAI sem reescrita**.
- **Como reconferir:** https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use.md — comparar
  o bloco `properties` com o array `required` no exemplo `get_weather`.
- **O que quebra se divergir:** o card que decide "campos opcionais no manifesto vs. tudo obrigatório com null".
  É uma decisão de forma do dado, cara de reverter depois que houver fixtures.
- **Fontes:** https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use.md (primária).
  Os exemplos da AWS por acaso têm tudo em `required`, então não confirmam nem contradizem. LEDGER-SEED L-05.

### R16-12 — Structured outputs é incompatível com citations
- **Verdade operacional:** se algum dia o gerador de manifesto precisar de citações de fonte, não dá para
  combinar com `output_config.format` na mesma chamada.
- **Como reconferir:** https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html, nota final.
- **O que quebra se divergir:** nada hoje; é um limite a lembrar se entrar pesquisa com citação no pipeline.
- **Fontes:** https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html (primária).
  A página da Anthropic lida não mencionou explicitamente essa incompatibilidade — daí 1-0.

### R16-13 — Compilação de gramática e cache de 24 h
- **Verdade operacional:** trocar o schema **a cada iteração** custa latência de compilação toda vez. Congelar
  o schema (e versioná-lo) é otimização real, não higiene.
- **Como reconferir:** medir o tempo da 1ª e da 2ª chamada com o mesmo schema.
- **O que quebra se divergir:** o orçamento de tempo do loop agente↔render.
- **Fontes:**
  - https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md (primária) — "Compiled grammars
    are cached for 24 hours **from last use**"; mudanças de nome/descrição de tool **não** invalidam.
  - https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html (primária) — "cached for 24 hours
    **from first access**"; "may take up to a few minutes" na primeira compilação.
- **Divergência real:** "desde o último uso" vs "desde o primeiro acesso". As duas afirmações não são
  equivalentes. Planeje pelo pior caso (primeiro acesso) até medir.

### R16-14 / R16-15 / R16-16 — O `strict` da OpenAI: mais restritivo na forma, mais permissivo na recursão
- **Verdade operacional:** OpenAI exige `required` completo + `additionalProperties:false` em **todo** objeto,
  proíbe `allOf`/`not`/`if-then-else`/`dependent*` e proíbe `anyOf` na raiz — **mas aceita recursão**
  (`$ref: "#"`, `$ref: "#/$defs/no"`), que a Anthropic proíbe. O `oneOf` discriminado por `"type"` do panorama
  **não é expressável em nenhum dos dois**: a OpenAI só suporta `anyOf` (não `oneOf`), e a Anthropic também
  documenta `anyOf`/`allOf`, não `oneOf`.
- **Como reconferir:** https://developers.openai.com/api/docs/guides/structured-outputs e
  https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs (seção "JSON Schema support and limitations").
- **O que quebra se divergir:** o card do schema do manifesto. **Uma união discriminada por `type` precisa ser
  escrita como `anyOf` de objetos, cada um com `type: {"const": "..."}`** — e não como `oneOf` + `discriminator`
  (que é vocabulário OpenAPI, não JSON Schema puro).
- **Fontes (independentes):** developers.openai.com (primária) + learn.microsoft.com (primária).

### R16-17 / R16-18 — Duas disputas reais sobre o `strict` da OpenAI
- **O que separa as duas leituras:** a Microsoft rotula explicitamente sua lista como *"Azure-specific limits"*.
  Portanto não é necessariamente contradição factual — é **divergência de plataforma** (e possivelmente
  defasagem de doc). O resultado prático é o mesmo: **não confie em nenhum limite de tamanho nem em nenhuma
  constraint de string/número dentro do `strict` sem medir no provedor exato que você vai usar.**
  - Limites: OpenAI diz 10 níveis / 5.000 propriedades / 120.000 chars de nomes+defs+enums / 1.000 enums.
    Azure diz **100 propriedades no total e 5 níveis**. Diferença de 50×.
  - Constraints: OpenAI lista `pattern`/`format` (string), `multipleOf`/`maximum`/`minimum` (número),
    `minItems`/`maxItems` (array) como suportados — e diz que `minLength`/`maxLength`/`pattern`/`format`/
    numéricas/`patternProperties`/`minItems`/`maxItems` são adicionalmente não suportados **para modelos
    fine-tuned**. Azure lista todos como não suportados, sem essa ressalva.
- **O que quebra se divergir:** o card de schema, de novo. A regra segura para este projeto é **desenhar para
  a interseção**: sem constraints numéricas, sem constraints de tamanho de string, profundidade ≤ 5,
  poucas dezenas de propriedades — e validar o resto fora do LLM.

### R16-19 / R16-20 — Prompt caching: o que fecha e o que morde
- **Verdade operacional:** reenviar o mesmo manifesto grande + as mesmas skills a cada iteração é exatamente
  o caso de uso do cache. Regra de ouro que sai das duas fontes: **conteúdo estável primeiro, volátil depois
  do último breakpoint**, porque o cache é *prefix match* e qualquer byte alterado invalida tudo à frente.
- **Como reconferir:** ler `usage.cache_read_input_tokens` em duas chamadas seguidas com o mesmo prefixo.
  Se vier 0 nas duas, há invalidador silencioso (timestamp, UUID, `json.dumps` sem `sort_keys`).
- **O que quebra se divergir:** o card de "custo por iteração" e o card do runner que monta o prompt.
- **Fontes:**
  - https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md (primária) — TTLs, 4 breakpoints,
    multiplicadores 1,25× / 2× / 0,1×, campos de `usage`, tabela de mínimos por modelo
    (512: Opus 5 / Fable 5 / Mythos 5 · 1.024: Opus 4.8, Sonnet 5, Sonnet 4.6, Sonnet 4.5 · 2.048: Opus 4.7 ·
    4.096: Opus 4.6, Opus 4.5, Haiku 4.5), e "Shorter prompts cannot be cached, even if marked with
    `cache_control` … **no error is returned**".
  - https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html (primária, independente) —
    `"cache_control": {"type":"ephemeral","ttl":"5m|1h"}`, máximo 4 checkpoints para modelos Claude, mínimos
    por modelo (4.096 para Opus 4.6/4.5/Haiku 4.5; 1.024 para Sonnet 4.6), ordem `tools → system → messages`,
    "the TTL … resets with each successful cache hit", e "If you try to add a cache checkpoint before meeting
    the minimum number of tokens, your inference will still succeed, but your prefix will not be cached".
- **Só na fonte Anthropic (1-0, não confirmado):** os multiplicadores exatos de preço (a AWS só diz
  "reduced rate"), e que **trocar `output_config.format` invalida o prompt cache daquela thread**. Esse
  segundo ponto é a armadilha que cruza R16-08 com R16-19: iterar o schema e esperar cache é contraditório.
- **Mínimo é não-monotônico:** 512 nos modelos mais novos, 4.096 no Opus 4.6/4.5 e Haiku 4.5. Um prompt de
  3 K tokens cacheia em um modelo e silenciosamente não cacheia em outro.

### R16-21 — Determinismo: o pipeline é determinístico do manifesto para baixo, não do briefing para baixo
- **Verdade operacional:** `temperature: 0` **não** garante bytes idênticos, em nenhum dos dois fornecedores,
  e a Anthropic nem expõe `seed`. Pior: nos modelos Opus/Sonnet mais recentes o próprio parâmetro
  `temperature` deixou de ser aceito em parte da linha (a referência ainda documenta 0.0–1.0, mas o guia de
  migração da mesma casa trata sampling params como removidos em modelos recentes — **conflito interno de
  doc, não resolvido aqui**). A conclusão de engenharia não muda: **a única reprodutibilidade real é cachear
  a saída por hash da entrada.**
- **Como reconferir:**
  - Anthropic: https://platform.claude.com/docs/en/api/messages.md — "Note that even with `temperature` of
    `0.0`, the results will not be fully deterministic."
  - OpenAI: https://developers.openai.com/cookbook/examples/reproducible_outputs_with_the_seed_parameter —
    "our system will make a **best effort** to sample deterministically"; "Determinism is **not guaranteed**";
    "a small chance that responses differ even when request parameters and `system_fingerprint` match".
- **O que quebra se divergir:** o card de "render reprodutível" e qualquer teste de regressão que compare
  saída de LLM byte a byte. **A fixture tem que ser o manifesto congelado, não o prompt.**
- **Receita concreta:** `cache_key = sha256(canonical_json({model, system, tools, messages, output_config, schema_version}))`
  → guardar o manifesto resultante em `cache/manifests/<hash>.json` e versionar. Canonicalizar com
  `json.dumps(..., sort_keys=True, separators=(",",":"))` / `JSON.stringify` sobre chaves ordenadas — sem isso
  o hash muda sem o conteúdo mudar, e de quebra você invalida o prompt cache (R16-19).

### R16-22 / R16-23 — Remotion: o que o Zod impõe ao manifesto
- **Verdade operacional (as duas restrições que valem para o desenho):**
  1. **Topo tem que ser `z.object()`** — "Remotion requires that the top-level type is a `z.object()`".
     Um manifesto que fosse um array no topo não pode ser prop de composição diretamente.
  2. **Input props precisam ser JSON-serializáveis** — "Input props must be an object and serializable to JSON."
     Nada de `Date`, `Map`, `Set` atravessando a fronteira CLI→render. Datas viram string ISO
     (`format: "date-time"`, que o subset da Anthropic aceita — R16-09).
- **Como reconferir:** https://www.remotion.dev/docs/schemas e https://www.remotion.dev/docs/passing-props.
  Versão: `npx remotion versions`; e `cat node_modules/@remotion/zod-types/package.json | jq .version,.peerDependencies`.
- **O que quebra se divergir:** o card do componente raiz da composição, o card do runner que chama
  `renderMedia`, e o card de "editar props no Studio".
- **Fontes:** https://www.remotion.dev/docs/schemas, https://www.remotion.dev/docs/zod-types/,
  https://www.remotion.dev/docs/passing-props (todas primárias, **mesmo domínio → conta como uma fonte**).
- **Versões colhidas:** `@remotion/zod-types` baseado em **Zod v4 desde Remotion v4.0.426**;
  `@remotion/zod-types-v3` mantém Zod 3.22.3. Instalação: `npx remotion add @remotion/zod-types zod`.
- **Não verificado:** se o schema é validado **no render** (e não só no Studio) e o que acontece em falha.
  A doc lida não afirma. Isso é decisivo para saber se o Remotion é ou não um gate de validação. LEDGER-SEED L-08.

### R16-24 / R16-25 — "Vídeo como dado": o que existe pronto
- **Verdade operacional:** OTIO é o único **padrão de interchange** maduro e governado (Academy Software
  Foundation, Apache-2.0, C++ + Python) — mas ele modela **corte editorial** (clips, tracks, transições,
  referências de mídia com `RationalTime`), **não** modela "renderize um `<CodeHikeBlock/>` com este código e
  este highlight". E o core **não** traz EDL/FCPXML/AAF: são adaptadores contrib no pacote
  `OpenTimelineIO-Plugins`. Não há binding JS/TS oficial documentado — num pipeline Node(Remotion) + Python(Manim),
  OTIO estaria só de um lado.
- **Como reconferir:**
  - https://opentimelineio.readthedocs.io/en/latest/tutorials/otio-file-format-specification.html — "OpenTimelineIO
    files are serialized as JSON"; "There is no top level file format version in OTIO. Each data type has a
    version instead"; `"OTIO_SCHEMA": "Timeline.1"`; `RationalTime {rate, value}`.
  - https://opentimelineio.readthedocs.io/en/latest/tutorials/adapters.html — core: `otio_json`, `otiod`, `otioz`.
  - https://github.com/AcademySoftwareFoundation/OpenTimelineIO e https://pypi.org/project/OpenTimelineIO/ — Apache-2.0, 0.18.1 (2025-11-09), Python 3.9–3.13.
  - https://github.com/mifi/editly — spec declarativa JSON/JSON5 com `outPath`, `width`, `height`, `fps`, `clips`,
    `defaults`, `audioTracks`; ~17 tipos de layer (`video`, `image`, `title`, `subtitle`, `fill-color`,
    `canvas`, `fabric`, `gl`, …); MIT; **sem JSON Schema publicado**.
  - https://github.com/motion-canvas/motion-canvas — "A TypeScript library that uses generators to program
    animations"; MIT; sem formato serializado documentado.
  - https://midrender.com/revideo/docs — cenas em TypeScript/JSX (`makeScene2D()`), "Parameterized Videos"
    via variáveis de projeto; sem formato de timeline declarativo.
- **O que quebra se divergir:** o card "definir o formato do manifesto". Se OTIO servisse, o card viraria
  "adotar OTIO + extensão de metadata" e mudaria a forma de todos os cards de nó.
- **A lição transferível, mesmo não adotando OTIO:** **versionar por objeto, não por arquivo.**
  `"OTIO_SCHEMA": "Clip.5"` é o padrão que 15 anos de interoperabilidade em cinema escolheram, e é a resposta
  à pergunta "como versiono um contrato que vai evoluir". Ver seção 7.

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| "o vídeo seja **determinístico**, repetível e versionável" (linha 6), como propriedade da arquitetura inteira, incluindo a etapa de LLM | **PARCIALMENTE REFUTADO** | O determinismo vale do **manifesto para baixo** (Remotion/FFmpeg). A etapa LLM→manifesto **não é determinística e não pode ser tornada determinística por parâmetro**: a Anthropic afirma que "even with `temperature` of `0.0`, the results will not be fully deterministic" e não expõe `seed`; a OpenAI diz que `seed` é "best effort" e "Determinism is not guaranteed". Repetibilidade exige **cache por hash da entrada**, não configuração de sampling. | https://platform.claude.com/docs/en/api/messages.md · https://developers.openai.com/cookbook/examples/reproducible_outputs_with_the_seed_parameter |
| "esquema JSON **estrito**" com `node.type` selecionando componentes (linhas 21-22) — implícito: um `oneOf` discriminado por `type` | **EM DISPUTA / IMPRATICÁVEL COMO ESCRITO** | Nem a Anthropic nem a OpenAI documentam `oneOf` no subset aceito — ambas documentam **`anyOf`**. A união discriminada precisa ser `anyOf` de objetos com `type: {"const": "..."}`. `discriminator` é vocabulário OpenAPI e, no Ajv, exige `discriminator: true` explícito. | https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md · https://developers.openai.com/api/docs/guides/structured-outputs · https://ajv.js.org/json-schema.html |
| Manifesto com "Nós" como estrutura hierárquica livre gerada pelo LLM | **REFUTADO para geração via structured outputs Anthropic** | **Schemas recursivos não são suportados** — a AWS documenta que schema com feature não suportada retorna **400 imediatamente**, antes da inferência. Um `children: {"$ref":"#"}` não roda. (Na OpenAI rodaria: recursão é suportada lá — o manifesto não é portável entre os dois nesse ponto.) | https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html |
| Manifesto "estrito" no sentido de carregar as regras de validade (durações mínimas, tamanhos, limites) | **REFUTADO como schema único** | O subset aceito **não** suporta `minLength`/`maxLength`/`minimum`/`maximum`/`multipleOf`, e `minItems` só aceita 0 ou 1. Um schema com essas chaves é rejeitado. As invariantes precisam de **duas camadas**: schema-para-o-LLM (subset) e schema-para-validação (2020-12 completo). | https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md · https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html |
| "compila as vistas interativas no **Remotion Studio**" (linha 17) sem mencionar Zod | **LACUNA, não erro** | Editar props visualmente no Studio requer atrelar um schema Zod via prop `schema` do `<Composition>`, com topo obrigatoriamente `z.object()` e `defaultProps` correspondentes. O panorama descreve o resultado sem a pré-condição. | https://www.remotion.dev/docs/schemas |
| O manifesto é consumido por Node **e** por Python (linha 32: runner Node chama CLI Python) sem nenhuma menção a como os dois lados compartilham o contrato | **LACUNA CRÍTICA** | É o problema central deste cluster e o panorama não o nomeia. Existe receita concreta (Zod 4 → `z.toJSONSchema()` → `manifest.schema.json` → `datamodel-codegen` → Pydantic v2), mas ela precisa virar card explícito com um gate de CI, ou os dois lados divergem em silêncio. | https://zod.dev/json-schema · https://github.com/koxudaxi/datamodel-code-generator |
| Nenhuma menção a formatos abertos de timeline (OTIO/EDL/FCPXML) antes de inventar o manifesto | **LACUNA, com resposta** | OTIO existe, é ASWF/Apache-2.0 e maduro — **mas** modela corte editorial, não composição React/Manim, e **não tem binding JS/TS oficial documentado** (core C++ + Python). Adotá-lo inteiro seria errado; **copiar o versionamento por objeto (`OTIO_SCHEMA: "Tipo.N"`) é a decisão barata e certa.** | https://opentimelineio.readthedocs.io/en/latest/tutorials/otio-file-format-specification.html · https://github.com/AcademySoftwareFoundation/OpenTimelineIO |

---

## 4. Armadilhas (falso verde deste domínio)

- **O manifesto valida no Ajv → "o schema está certo".** → Ajv default é **draft-07** e é bem mais permissivo
  que o subset do LLM; ele aceita `minLength`, `recursion`, `oneOf`. → Fica vermelho se sumir: o gate que
  roda o schema contra a API real (uma chamada com `max_tokens` mínimo só para provocar a validação de schema).

- **A primeira chamada com structured outputs funcionou → "o schema é aceito".** → A validação de schema é
  imediata (400 na AWS), mas a **compilação de gramática** pode levar minutos na primeira vez e depois cachear
  por 24 h; um teste em máquina "aquecida" esconde a latência do primeiro deploy. → Fica vermelho: a métrica
  de latência da primeira chamada do dia, medida separada da segunda.

- **`cache_read_input_tokens` > 0 uma vez → "o cache está funcionando".** → O mínimo cacheável é
  **não-monotônico entre modelos** (512 / 1.024 / 2.048 / 4.096) e prefixos curtos **não geram erro**, só não
  cacheiam. Trocar de modelo pode desligar o cache em silêncio. → Fica vermelho: assert de que
  `cache_read_input_tokens > 0` na 2ª chamada de cada modelo usado, no CI.

- **`temperature: 0` no teste deu a mesma saída duas vezes → "é determinístico".** → As duas docs dizem
  explicitamente que não é garantido; duas amostras iguais são coincidência estatística, não prova. → Fica
  vermelho: o teste de regressão que compara **manifesto contra fixture congelada**, não saída de LLM contra
  saída de LLM.

- **O Zod aceita o objeto → "o Python vai aceitar".** → `z.toJSONSchema()` **lança exceção** em tipos
  irrepresentáveis por padrão, mas se alguém setar `unrepresentable: "any"` eles viram `{}` e o Pydantic
  gerado aceita **qualquer coisa** naquele campo. → Fica vermelho: o gate de CI que regenera o
  `manifest.schema.json` e falha se o diff for não-vazio, mais um grep por `{}` vazio no schema gerado.

- **O manifesto passou no schema → "o Remotion vai renderizar".** → Input props têm uma restrição que o
  JSON Schema não expressa: **têm que ser serializáveis em JSON e o topo tem que ser objeto**. Um `Date`
  sobrevive ao Zod em memória e morre na fronteira CLI. → Fica vermelho: um teste que faz round-trip
  `JSON.parse(JSON.stringify(props))` e compara.

- **Adotar OTIO "porque é padrão".** → OTIO não tem binding JS/TS oficial documentado, e os adaptadores
  EDL/FCPXML/AAF **não vêm no core**. Adotar OTIO num pipeline Node+Python custa um serviço Python só para
  ler o timeline. → Fica vermelho: se o card "adotar OTIO" existir, ele precisa começar por
  `npm ls opentimelineio` retornando vazio.

- **Copiar o exemplo de `strict` da OpenAI para a Anthropic (ou vice-versa).** → São subsets **diferentes e
  parcialmente opostos**: OpenAI exige tudo em `required` e aceita recursão; Anthropic aceita opcionais e
  proíbe recursão. → Fica vermelho: uma fixture de schema por fornecedor, não uma compartilhada.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| L-01 | O `anyOf` de nós discriminado por `type: {"const": ...}` é aceito pela API de structured outputs com o número de tipos de nó que o projeto tem? | Assumir que sim até ~10 variantes | Enviar o schema real com `max_tokens: 16` e ver se volta 200 ou 400 | O formato do manifesto inteiro |
| L-02 | Qual classe/import do Ajv nesta versão instalada valida 2020-12, e `discriminator: true` funciona com `anyOf` + `const`? | `require("ajv/dist/2020")` | `npm i ajv && node -e "const A=require('ajv/dist/2020');const a=new A({discriminator:true});console.log(a.opts.discriminator)"` | O card do validador Node |
| L-03 | Quantos tokens tem o manifesto + as skills no prompt, e isso passa do mínimo cacheável do modelo escolhido? | Assumir que passa de 1.024 mas não de 4.096 | `client.messages.count_tokens(...)` e depois duas chamadas iguais conferindo `usage.cache_read_input_tokens` | O orçamento de custo por iteração |
| L-04 | O Pydantic consegue validar contra o `manifest.schema.json` externo, ou é preciso `jsonschema`/`fastjsonschema` no lado Python? | Assumir que **precisa** de `jsonschema` separado | `pip install jsonschema && python -c "import jsonschema; jsonschema.Draft202012Validator.check_schema(...)"` | O card do validador Python |
| L-05 | `strict: true` na Anthropic realmente aceita propriedade fora de `required`? | Assumir que sim (exemplo oficial) | Uma chamada com tool `strict` + campo opcional; ver se dá 400 | A decisão "opcional vs tudo obrigatório com null" |
| L-06 | O round-trip Zod → JSON Schema → Pydantic preserva os tipos do manifesto real sem `{}` vazio? | Assumir que sim para primitivos + enums + arrays | Rodar o pipeline e `grep -c '"{}"' manifest.schema.json` | O gate de fonte única TS↔Python |
| L-07 | Qual é a latência real da primeira chamada com o schema novo (compilação de gramática) nesta conta? | Assumir 10–60 s | Cronometrar 1ª vs 2ª chamada com schema novo | O orçamento de tempo do loop agente |
| L-08 | O Remotion valida o schema Zod **durante o render** (não só no Studio) e o que acontece se o manifesto violar? | Assumir que **não valida** no render — validar no runner antes | `npx remotion render <id> --props=./props-invalido.json` e observar | O desenho do gate de validação |
| L-09 | `temperature` é aceito ou retorna 400 no modelo que o projeto vai usar de fato? | Assumir que pode ser rejeitado; não depender dele | Uma chamada com `temperature: 0` e conferir status | O código do cliente LLM |
| L-10 | A canonicalização de JSON (ordem de chaves) é estável entre Node e Python para o hash de cache? | `sort_keys=True` / chaves ordenadas explicitamente | Gerar o hash dos dois lados sobre o mesmo objeto e comparar | O cache de saída por hash e o prompt cache |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| O manifesto precisa ser portável entre Anthropic e OpenAI, ou pode ser desenhado só para a Anthropic? | É apetite de risco de fornecedor, não fato técnico. Os dois subsets são parcialmente opostos (recursão / `required`). | **Só Anthropic:** campos opcionais de verdade, sem recursão. **Portável:** interseção — tudo em `required` com `\|null`, sem recursão, sem constraints. Custa expressividade em todo card de nó. |
| A fonte única de verdade é o **Zod** (TS→Python) ou o **JSON Schema escrito à mão** (neutro, gera os dois)? | Depende de quem edita o contrato no dia a dia e de quanto o Studio importa. | **Zod:** ganha `@remotion/zod-types` e edição visual no Studio; Python vira derivado. **JSON Schema à mão:** neutro, mas perde o Studio visual e exige `z.fromJSONSchema()` (experimental) ou Zod escrito em paralelo. |
| Aceita adicionar `datamodel-code-generator` (Python ≥3.10) + um passo de codegen no CI? | É custo de manutenção e política de ferramental, não questão técnica. | **Sim:** um gate de CI garante os dois lados alinhados. **Não:** modelos Python à mão, e o drift TS↔Python vira classe de bug permanente. |
| Qual é o modelo alvo (e portanto o mínimo cacheável e a política de sampling)? | Custo, latência e apetite. Muda 512 vs 4.096 tokens de mínimo e se `temperature` sequer existe. | Muda o desenho do prompt (quanto conteúdo estável precisa haver antes do breakpoint) e a estimativa de custo por iteração. |
| Vale um segundo schema (2020-12 completo, com `minLength`/`minimum`/`maxItems`) só para validação pós-LLM? | É trade-off de manutenção: dois artefatos que podem divergir vs invariantes não checadas. | **Sim:** invariantes de negócio ficam declarativas, mas há dois schemas para manter em sincronia. **Não:** invariantes viram código imperativo no runner. |
| Adotar `OTIO_SCHEMA`-style (versão por objeto) ou um `manifestVersion` único no topo? | É política de evolução de contrato; nenhuma é "certa". | **Por objeto:** migração incremental por tipo de nó, mais verboso. **Topo único:** simples, mas toda mudança de um nó força bump global e migração de todas as fixtures. |
| Se `pattern` for a única constraint disponível, os ids de nó passam a ter formato imposto (ex.: `^n-[0-9]{3}$`)? | É decisão de convenção do produto. | **Sim:** o LLM erra menos e o diff de manifesto fica legível. **Não:** ids livres, e a colisão/duplicidade vira checagem no runner. |

---

## 7. Recomendação para o roadmap

**A receita concreta (o pedido central deste cluster).** Uma fonte de verdade, dois consumidores:

```
src/schema/manifest.ts          # Zod 4 — FONTE DE VERDADE (topo z.object(), para servir de schema de Composition)
        │
        ├─ z.toJSONSchema(Manifest, { target: "draft-2020-12", reused: "ref" })
        │        └──▶ schemas/manifest.schema.json      # artefato commitado, diff revisável
        │                     │
        │                     ├─▶ datamodel-codegen --input-file-type jsonschema
        │                     │      --output-model-type pydantic_v2.BaseModel
        │                     │      └──▶ manim_side/manifest_models.py   (lado Python)
        │                     │
        │                     └─▶ schemas/manifest.llm.json  # subset podado p/ output_config.format
        │                             (sem minLength/maximum/minItems>1/recursão; oneOf → anyOf+const)
        │
        └─ <Composition schema={Manifest} defaultProps={...} />   (lado Remotion/Studio)
```

Gate de CI de uma linha: regenerar `manifest.schema.json` e `manifest_models.py` e **falhar se o `git diff`
for não-vazio**. Isso é o que impede o drift silencioso entre Node e Python.

- **Ponto de troca barata:**
  **(a) o dialeto/versionamento do manifesto.** Adotar `"schemaVersion": "<Tipo>.<N>"` por objeto de nó
  (padrão OTIO) custa **um campo por variante do `anyOf` + uma função `migrate()` por bump** — reversível
  para um `manifestVersion` único de topo mexendo em **1 arquivo de schema + 1 função de migração**.
  **(b) o gerador Python.** Trocar `datamodel-code-generator` por `quicktype` é mudar **uma linha de script**
  (`datamodel-codegen --input …` → `quicktype --src-lang schema --lang python …`), porque o insumo é o mesmo
  `manifest.schema.json`.
  **(c) o validador TS.** Ajv ↔ TypeBox ↔ `Manifest.safeParse` é **um módulo** (`src/validate.ts`), desde que
  todo mundo valide contra o mesmo arquivo.
  **Ponto de troca CARA (não reversível barato):** decidir se o manifesto tem campos opcionais de verdade
  (Anthropic) ou tudo em `required` com `|null` (OpenAI/portável). Isso atravessa **todo card de nó, toda
  fixture e todo componente React**. Decidir antes do primeiro card. É a PERGUNTA-DONO nº 1.

- **Skills que devem carregar este conhecimento:**
  - a skill de **saída estruturada / cliente LLM** — precisa de R16-08, R16-09, R16-10, R16-11, R16-13
    (o que não pode entrar no schema, e por que o schema não pode mudar a cada iteração);
  - a skill de **contrato de dados do manifesto** — R16-01, R16-03, R16-04, R16-05 (a receita acima) e o
    versionamento por objeto de R16-24;
  - a skill de **Remotion** — R16-22 e R16-23 (topo `z.object()`, props JSON-serializáveis, `--props`);
  - a skill de **custo/telemetria de LLM** — R16-19, R16-20, R16-21 (breakpoints, mínimo silencioso, cache
    por hash em vez de `temperature: 0`).

- **Cards que este cluster condiciona:**
  1. Escrever o schema Zod do manifesto com topo `z.object()` e união de nós como `anyOf` + `type: const`
     (**não** `oneOf`, **não** recursão).
  2. Script de build `schema:gen` que emite `manifest.schema.json` (2020-12) e o **subset podado** para o LLM.
  3. Script `models:gen` (datamodel-codegen) + gate de CI de diff vazio.
  4. Validador no runner Node, rodando **antes** do bundler, contra o schema 2020-12 completo (com as
     constraints numéricas que o LLM não pôde receber).
  5. Validador espelho no lado Python, antes de qualquer chamada ao Manim.
  6. Cliente LLM com `output_config.format`, schema congelado por versão, e `cache_control` com o conteúdo
     estável (manifesto-base + skills) **antes** do último breakpoint.
  7. Cache de saída por `sha256` da entrada canonicalizada, com fixtures de manifesto congeladas no repo.
  8. Teste de regressão que compara **manifesto vs fixture**, nunca saída de LLM vs saída de LLM.
  9. Card de decisão (bloqueante): opcionais de verdade vs tudo obrigatório com `|null`.
