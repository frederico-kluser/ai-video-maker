---
name: llm-authoring
description: Provides the verified contract for driving an LLM as the author of the video
  manifest — the Anthropic structured-output surface, the strict-mode schema subset that
  amputates manifest design, prompt-caching economics, why temperature 0 buys no
  reproducibility, and the split between what the model decides and what the system computes.
  Use whenever code asks a model to emit, repair or extend a timeline manifest, prunes a JSON
  Schema before handing it to a model, budgets tokens or cost per iteration, or debugs a
  generated manifest that a validator or a renderer rejected — even if the user never says
  Anthropic, structured outputs, schema or caching. Triggers — "structured output",
  "output_config", "json_schema", "strict mode", "anyOf", "prompt caching", "cache_control",
  "temperature 0", "deterministic output", "reproducible generation", "manifest generation",
  "let the model write the scene", "retry the prompt", "cost per video", "token budget".
metadata:
  type: knowledge
  tier: dominio
  verification_signal: "curl -sS https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md | grep -c output_config.format"
---
# Autoria por LLM — o modelo escreve o manifesto, o sistema escreve o vídeo

## Quando carregar

- A tarefa pede a um modelo que produza, conserte ou estenda o manifesto/timeline do vídeo.
- A tarefa poda, congela ou versiona o JSON Schema **que vai dentro da chamada** (que não é o
  mesmo schema com que se valida a resposta).
- A tarefa orça tokens, latência ou custo do laço autor→render, ou monta o prompt cache.
- A tarefa investiga manifesto rejeitado — pelo validador, pelo bundler, ou pela própria API
  com 400 antes de qualquer inferência.
- **Não carregar** quando o assunto é o desenho dos campos do manifesto e seu versionamento
  (`timeline-manifest`), a prop `schema` do `<Composition>` (`remotion-core`), ou geração de
  código Manim (`manim-bridge`).

## Como ler as citações desta skill

`Placar (N-M)` = fontes independentes a favor menos contra, herdado do arquivo de pesquisa
citado. Abaixo de `2-0` a linha carrega o placar real **onde aparece** e, quando condiciona uma
decisão de desenho, também tem entrada em `## Não verificado` com o comando que a fecha. Linhas
marcadas **lei do programa** citam **âncora de seção** (`§N.M`, id de claim `Rnn-nn`/`AB-nnn`) de
um documento normativo deste repositório — nunca `arquivo:linha`, que não sobrevive a uma edição
do alvo — e são decisão registrada, não fato do mundo, e por isso não carregam placar. **Divergência
declarada** marca os pontos em que esta skill é mais estreita que
`docs/00-panorama-verificado.md`: o panorama vence sobre fato, então a divergência fica visível
em vez de silenciosa, e cai assim que o teste citado rodar.

## Conhecimento injetado

### A divisão de trabalho, e o erro clássico

O LLM decide **narrativa, ritmo, qual nó entra, em que ordem, e o texto**. O sistema decide
**frame exato, layout, cor e duração resolvida**. Isto não é gosto:

- A duração de `<TransitionSeries>` é `Σ(sequências) − Σ(transições)` — a transição é
  **subtrativa**. Errar o sinal produz cauda preta no fim do vídeo, sem erro de execução e
  invisível em teste de fumaça; a duração tem de sair de `timing.getDurationInFrames({fps})`,
  nunca de aritmética escrita no manifesto — **Placar (2-0)** — fonte:
  `docs/00-panorama-verificado.md §2.1` (R02-11). **Condição de escopo:** o subtrativo vale para
  `<TransitionSeries.Transition>`; `<TransitionSeries.Overlay>` (v4.0.415+) **não encurta nada**
  — tratar overlay como subtrativo erra a duração para o outro lado.
- Piso de tempo escrito **em frames** é errado por construção: 20 frames a 60 fps são 0,333 s e
  a 30 fps são 0,667 s, enquanto as normas de legendagem fixam o piso em **tempo** —
  **Placar (2-0)** — fonte: `docs/00-panorama-verificado.md §2.8` (R14-01·R14-11). O manifesto
  carrega segundos; frame é derivado pelo sistema.
- O vocabulário fechado que o modelo pode escolher (o `presentation` de uma transição, por
  exemplo) tem de ser **gerado do `exports` do pacote instalado**, nunca copiado da doc —
  **Placar (3-0)** — fonte: https://registry.npmjs.org/@remotion/transitions/latest . O
  contraexemplo é literal: `cube()` tem página na árvore de doc e **não existe no pacote** (é
  um pacote separado e pago); um modelo que lê a doc escreve `cube()` e entrega build quebrado
  — **Placar (3-0)** — fonte: https://www.remotion.dev/docs/transitions/presentations/cube
- Campo opcional na API vira **obrigatório no schema entregue ao modelo** sempre que o default
  for visível no vídeo: omitir `presentation` não dá corte seco, dá `slide()` —
  **Placar (2-0)** — fonte: `docs/00-panorama-verificado.md §2.1` (R02-12).

A razão de fundo: coordenada, cor e frame escolhidos pelo modelo são **plausíveis e não
falsificáveis** — não existe oráculo que reprove uma coordenada. Já "o nó citado não está no
enum gerado do pacote instalado" é uma asserção que roda em milissegundos.

### `output_config.format` é a superfície atual

Saída estruturada entra em `output_config.format` com `{"type":"json_schema","schema": …}` e
**não exige beta header**; a forma antiga (`output_format` mais header beta) segue funcionando
por um período de transição — **Placar (2-0)** — fontes:
https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md e
https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html

**Condição de escopo:** no endpoint `bedrock-mantle` da AWS esse campo é **rejeitado com 400** —
lá o caminho é Converse ou InvokeModel no endpoint `bedrock-runtime`. Fora da AWS a condição
não se aplica e a regra é simplesmente `output_config.format`.

### O subset da Anthropic em modo estrito amputa o desenho do manifesto

**Condição de escopo: tudo nesta seção vale para o subset da Anthropic.** No outro fornecedor
metade se inverte (seção seguinte) — copiar estas restrições para lá produz um schema
gratuitamente pobre; copiar as de lá para cá produz 400.

O schema entregue ao modelo **não** aceita: schemas recursivos, `$ref` externo,
`minimum`/`maximum`/`multipleOf`, `minLength`/`maxLength`, `additionalProperties` diferente de
`false`; `minItems` de array só aceita **0 ou 1**. Aceita `enum` (**só escalares** — string,
número, bool, null), `const`, `anyOf`, `$ref`/`$defs` **internos**, `default`, os formatos de
string (`date-time`, `duration`, `uri`, `uuid`, …) e `allOf` **exceto combinado com `$ref`** —
**Placar (2-0)** — fontes: as duas acima.

Três consequências que condicionam o formato do manifesto:

1. **Sem recursão** ⇒ nada de `children: {"$ref": "#"}`. O manifesto é aninhado com
   **profundidade fixa**. Schema com feature não suportada volta **400 na validação do schema,
   antes da inferência** — não é falha de geração, é rejeição de contrato.
2. **Sem constraint numérica ou de tamanho** ⇒ **dois schemas**: o **podado**, que viaja na
   chamada, e o **completo** (draft 2020-12), contra o qual a resposta é validada. Toda
   invariante de negócio (duração mínima, teto de nós, tamanho de título) vive no segundo.
3. **Sem `oneOf`** — nenhum dos dois fornecedores o documenta no subset aceito. União
   discriminada é `anyOf` de objetos, cada um com `type: {"const": "..."}`; `discriminator` é
   vocabulário OpenAPI, não JSON Schema — **Placar (2-0)** — fontes: a página da Anthropic acima
   e https://developers.openai.com/api/docs/guides/structured-outputs

**Colisão real com `remotion-core` (e com qualquer piso que `motion-design-system` exija):**
R02-04 obriga piso de `damping` e de `durationRestThreshold` **no schema exposto ao LLM**
(`docs/00-panorama-verificado.md §2.1`, R02-04, 2-0), porque `measureSpring()` roda um `while`
sem teto de iteração. O subset **proíbe `minimum`**. Piso numérico ali não é expressável: a saída
compatível é `enum` dos valores permitidos (suportado) ou a checagem no validador pós-LLM.
Escrever `minimum` derruba a chamada inteira com 400, antes da inferência.

### A gramática é compilada, e isso precifica iterar o schema

A primeira chamada com um schema novo paga latência de compilação — **até minutos** em schema
complexo — e a gramática compilada fica em cache por **24 h** — **Placar (2-0)** — fontes: as
duas páginas de saída estruturada acima. **Divergência real entre elas:** "desde o último uso"
× "desde o primeiro acesso". Planeje pelo pior caso (primeiro acesso) até medir. Congelar e
versionar o schema é otimização mensurável, não higiene.

### O outro fornecedor é o oposto, não um superconjunto

No `strict` da OpenAI: **todas** as propriedades precisam estar em `required`,
`additionalProperties: false` em **todo** objeto, opcional emulado com `["string","null"]`; sem
`allOf`/`not`/`if`-`then`-`else`/`dependent*`; a raiz não pode ser `anyOf` — **mas recursão é
suportada**, o inverso exato da Anthropic — **Placar (2-0)** — fontes:
https://developers.openai.com/api/docs/guides/structured-outputs e
https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs

Consequência operacional: **uma fixture de schema por fornecedor**, nunca uma compartilhada. E
a decisão "campos opcionais de verdade × tudo em `required` com `|null`" atravessa todo nó,
toda fixture e todo componente — é ponto de troca **cara**, a decidir antes do primeiro card
(**lei do programa**, `docs/00-panorama-verificado.md §5.2` — a linha «campos opcionais de verdade
× tudo em `required`», classificada **NÃO É BARATO**).

### Prompt caching — o que realmente muda o custo de iterar

- `cache_control: {"type":"ephemeral"}` (opcional `"ttl":"1h"`), TTL padrão **5 minutos**,
  **máximo 4 breakpoints** por request, invalidação em cascata `tools → system → messages` —
  **Placar (2-0)** — fontes:
  https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md e
  https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
- Os **multiplicadores de preço** (escrita 5 min = 1,25× input, escrita 1 h = 2×, leitura = 0,1×)
  aparecem **só na fonte Anthropic** — a da AWS diz apenas "reduced rate" — **(1-0)**, ver
  `## Não verificado` #8. Use-os para dimensionar, não para faturar. **Divergência declarada com
  a autoridade de fato:** `docs/00-panorama-verificado.md §2.8` (R16-19·R16-20) embute os
  multiplicadores numa
  linha agregada de placar (2-0); a pesquisa de origem os isola em 1-0
  (`docs/pesquisa/R16-manifesto-e-llm-estruturado.md:249-251`). Esta skill segue a origem por ser
  a leitura mais estreita; se o panorama for corrigido, **é ele que vale**.
- O cache é **prefix match**: um único byte alterado invalida tudo à frente. Daí a ordem
  obrigatória do prompt — **estável primeiro** (schema congelado, corpo das skills,
  manifesto-base), **volátil depois do último breakpoint**.
- O prefixo mínimo cacheável **varia por modelo** (512 / 1.024 / 2.048 / 4.096 tokens) e é
  **não-monotônico** — modelo mais novo não significa mínimo menor. Abaixo do mínimo o cache
  simplesmente **não acontece e nenhum erro é retornado**: a inferência dá certo — **Placar
  (2-0)** — mesma fonte. Trocar de modelo desliga o cache em silêncio.
- **Condição de escopo do ganho de vazão:** na autenticação por **chave de API**,
  `cache_read_input_tokens` **não conta no ITPM** (exceto Haiku 3.5), então o cache multiplica
  a vazão além de baratear. Em **assinatura** Pro/Max/Team o teto não é RPM/ITPM — é janela
  deslizante de 5 h mais janela semanal por assento, compartilhada com o chat, e esse ganho não
  existe — **Placar (2-0)** — fontes: https://platform.claude.com/docs/en/api/rate-limits e
  https://code.claude.com/docs/en/costs.md
- Corpo de skill é conteúdo estável e entra no contexto **só na ativação** (metadata ~100
  tokens sempre carregada; recursos custam zero até serem lidos) — **Placar (3-0)** — fonte:
  https://agentskills.io/specification . Logo o corpo desta e das outras skills pertence
  **antes** do último breakpoint, não depois.

### Determinismo — o que a doc de fato afirma

- A referência da API afirma literalmente que *"even with `temperature` of `0.0`, the results
  will not be fully deterministic"*, e **não expõe `seed`**; do outro lado, `seed` é descrito
  como *"best effort"* e *"Determinism is not guaranteed"* — **Placar (2-0)** — fontes:
  https://platform.claude.com/docs/en/api/messages.md e
  https://developers.openai.com/cookbook/examples/reproducible_outputs_with_the_seed_parameter
- A única reprodutibilidade real é **cache de saída por hash da entrada canonicalizada**:
  `sha256(canonical_json({model, system, tools, messages, output_config, schema_version}))` →
  `cache/manifests/<hash>.json`, versionado no repositório. Canonicalize com
  `sort_keys=True, separators=(",",":")` (ou chaves ordenadas explicitamente no lado TS) —
  sem isso o hash muda sem o conteúdo mudar **e**, de quebra, você invalida o prompt cache.
- O snapshot do programa **começa no manifesto, nunca no briefing**; a fixture é o manifesto
  congelado — **lei do programa**, `docs/00-panorama-verificado.md §9.4`, item 1 (a etapa
  LLM → manifesto).

### Validação é gate, não etapa

Ordem obrigatória: gerar → validar contra o schema **completo** no runner → só então bundler e
render. O validador espelho do lado Python roda antes de qualquer chamada ao Manim.

- Se o gate for hook do Claude Code: `exit 1` **não bloqueia nada** — só `0` (sucesso, stdout lido
  como JSON) e `2` (bloqueante, stderr entregue ao modelo) são especiais; **qualquer outro código é
  erro não-bloqueante** e a ação prossegue. Política é `exit 2`, ou `exit 0` mais JSON, nunca os
  dois — **Placar (3-0)** · R06-24 (`docs/00-panorama-verificado.md §1.6`) — fonte:
  https://code.claude.com/docs/en/hooks.md . **Duas condições de
  escopo:** (a) `WorktreeCreate` é a exceção — lá qualquer código não-zero aborta; (b) quais
  eventos `exit 2` bloqueia é **lista enumerada, não dedutível do prefixo "pré/pós"** — `Stop` e
  `SubagentStop` bloqueiam sem serem "pré", `PostToolBatch` bloqueia apesar do `Post`, enquanto
  `PostToolUse`/`PostToolUseFailure` **não desfazem nada**: a ferramenta já rodou e o stderr vira
  só mensagem ao modelo. Um gate de manifesto pendurado em `PostToolUse` é decorativo por
  construção. Lista literal: `docs/pesquisa/R06-remotion-agentes-skills.md:394-399`.
- Mantenha o cliente LLM **fora** do caminho de render. No projeto de referência o executor de
  vídeo é inimportável sem `OPENAI_API_KEY`, porque o cliente é instanciado no escopo do
  módulo: não dá nem para escrever teste de caracterização do render sem provisionar uma chave
  falsa — **Placar (3-0)** — fonte: `docs/pesquisa/L01-reuso-3b1b-codigo.md:680` (C06).

### Retry com simplificação progressiva

Padrão que já existe no projeto de referência: até `MAX_CODE_ATTEMPTS = 3`; nas tentativas 2 e
3 o prompt recebe um bloco `[RETRY SIMPLIFICATION]` pedindo uma versão **mais simples porém
fiel ao pedido** (uma cena 2D, mobjects básicos, evitar recursos caros) — **sem placar: é
leitura direta de código local, reconferível em um segundo**, não afirmação sobre o mundo:
`sed -n '37,44p;281,284p' /home/ondokai/Projects/3blue1brown/manim-api/services/openai_service.py`.
(O `3b1b:.agents/skills/manim-code-gen/SKILL.md:42` descreve o mesmo trecho, mas **cita esse
arquivo:linha** — é cópia, não segunda fonte.)

Transposto para o manifesto: degrade **capacidade**, não fidelidade — menos nós, sem transição
exótica, sem nó que dependa de asset externo, sem tipo de nó que a fixture não cobre. E note o
efeito colateral: o prompt **muta** a cada tentativa, então a saída depende de *quantas vezes
falhou*. A tentativa vencedora precisa entrar no cache junto com o número da tentativa, senão o
hash de entrada não reproduz a saída.

### Custo por vídeo

- **Não existe modelo de custo por vídeo neste programa** — faltam AB-002, AB-023 e AB-073
  (**lei do programa**, `docs/00-panorama-verificado.md §10`, item 7). Qualquer número
  apresentado hoje como "custo por vídeo" é invenção.
- O que dá para medir agora, por sessão:
  `claude -p "Reply with exactly OK" --output-format json | jq '.total_cost_usd, .usage'`.
  Piso medido de sessão nova num turno trivial em Opus 5: **US$ 0,03435** e **3.424 tokens de
  cache-creation** — N agentes pagam N vezes o preâmbulo antes de qualquer trabalho. Isto é
  **uma execução única nesta máquina (REPRO), não um placar** — o (2-0) de R15-25 cobre os tetos
  de RPM/ITPM, não este número — fonte: `docs/pesquisa/R15-agentes-paralelos.md:507-530`.
- Por chamada, os três números que fecham o custo de iteração são `usage.input_tokens`,
  `usage.cache_creation_input_tokens` e `usage.cache_read_input_tokens`, aplicados aos
  multiplicadores 1,25× / 2× / 0,1× da seção de caching — que são **(1-0)**, e portanto uma
  estimativa, não uma fatura.
- Contagem de renders só existe se for instrumentada **desde o card 1**: o dado não existe
  retroativamente (**lei do programa**, `docs/00-panorama-verificado.md §7.1`, AB-002).

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Não peça ao LLM que escreva TSX de composição livremente.** O reflexo é blindar com
  blocklist de `import`. No projeto de referência a blocklist AST existe e **não confere
  isolamento algum**: o código aprovado é escrito em disco e executado por `subprocess` na
  conta do usuário, sem container, sem usuário separado, com `os.environ.copy()` inteiro —
  **Placar (3-0)** — fonte: `docs/pesquisa/L01-reuso-3b1b-codigo.md:688` (C14). A defesa certa
  não é uma blocklist melhor: é **o modelo emitir dados** (manifesto) e o código que os
  interpreta ser escrito e revisado por gente. Se um caminho de código gerado precisar existir,
  ele é card de infraestrutura de sandbox, não uma lista de nomes proibidos.
- **Não eleja o Remotion como validador do manifesto só porque a composição já tem
  `schema={…}`.** O reflexo competente é "o Zod está atrelado, logo o render valida para mim" —
  e **não está verificado** que o schema Zod seja checado *durante o render*, e não apenas no
  Studio (`## Não verificado` #6, **(0-0)**). Se não for, o manifesto inválido não levanta erro:
  ele produz um vídeo errado, aprovado por qualquer gate que só cheque "o arquivo de saída
  existe e tem N frames".
- **Não use a confiança do modelo como sinal de qualidade.** *"O agente não é um juiz confiável
  de se o próprio aprendizado está correto. Confiança não é evidência."* — **lei do programa**,
  `docs/PLAYBOOK-REFERENCIA.md:432-433`. Nenhum campo auto-atribuído (`confidence`, `quality`,
  `is_valid`) emitido pelo próprio gerador entra no manifesto como gate.
- **Não copie exemplo de `strict` de um fornecedor para o outro.** Os subsets são parcialmente
  opostos: um aceita opcionais e proíbe recursão; o outro exige tudo em `required` e aceita
  recursão. O exemplo copiado roda no lugar errado e falha só quando o schema cresce.
- **Não itere o schema esperando latência baixa e cache quente.** Schema novo é gramática nova,
  logo compilação (até minutos) — e possivelmente prompt cache perdido. Iterar o schema e
  esperar cache são objetivos contraditórios na mesma sessão.
- **Não reponha o retry cego.** No projeto de referência `last_message` (a mensagem do
  validador) é atribuída em `:279`, `:303`, `:312`, `:338` e usada **só no retorno** (`:344`,
  `:350`) — nunca entra em `attempt_prompt`: as tentativas 2 e 3 recebem apenas a instrução
  genérica de simplificar. Reconferível com
  `grep -n last_message /home/ondokai/Projects/3blue1brown/manim-api/services/openai_service.py`.
  Devolva o erro do validador com o caminho JSON do campo que falhou — sem isso, você paga três
  gerações para tentar sorte três vezes.
- **Não trate `temperature: 0` como configuração de reprodutibilidade.** Nem como configuração
  garantida: em parte da linha recente o parâmetro pode nem ser aceito (ver `## Não
  verificado`). Reprodutibilidade é cache por hash, e mais nada.
- **Não canonicalize com `json.dumps` padrão.** Sem `sort_keys`, o hash de cache muda sem o
  conteúdo mudar, e você derruba os dois caches (o de saída e o de prompt) de uma vez.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| O manifesto valida no Ajv | O default do Ajv é **draft-07** (**(1-0)**, `docs/00-panorama-verificado.md §8.1`, R16-02), mais permissivo que o subset do modelo — aceita `minLength`, recursão e `oneOf`. Verde aqui e 400 na API. A armadilha vale mesmo se o default mudar: o dialeto de validação nunca é o subset do modelo | Um gate que envia o schema real à API com `max_tokens` mínimo, só para provocar a validação de schema |
| A primeira chamada com o schema novo funcionou | A validação de schema é imediata, mas a **compilação de gramática** pode levar minutos e depois cacheia por 24 h; máquina aquecida esconde a latência do primeiro deploy | Métrica da 1ª chamada do dia, medida separada da 2ª |
| `cache_read_input_tokens > 0` uma vez | O mínimo cacheável é **não-monotônico entre modelos** e prefixo curto não gera erro — trocar de modelo desliga o cache em silêncio | Assert de `cache_read_input_tokens > 0` na 2ª chamada **de cada modelo usado**, no CI |
| `temperature: 0` deu a mesma saída duas vezes | As duas docs dizem explicitamente que não é garantido — duas amostras iguais são coincidência estatística | Teste de regressão que compara **manifesto contra fixture congelada**, nunca saída de LLM contra saída de LLM |
| O retry "consertou" na 3ª tentativa | O prompt muta a cada tentativa: a saída depende de quantas vezes falhou, e a taxa de acerto na 1ª tentativa fica invisível | Contador de tentativa por geração, persistido, com alarme quando a mediana sair de 1 |
| O manifesto trouxe `"valid": true` | Auto-avaliação do gerador é o próprio gerador assinando embaixo | O validador externo rodando o schema completo sobre o arquivo |
| O manifesto passou no schema | As props de entrada têm restrição que o JSON Schema não expressa: serializável em JSON, topo `z.object()` — **(1-0)**, `docs/00-panorama-verificado.md §2.8` (R16-22·R16-23) | Round-trip `JSON.parse(JSON.stringify(props))` comparado ao original |
| O agente disse que consultou a doc do fornecedor | A skill de doc exige rede (busca remota mais fetch); sem rede o agente cai em conhecimento memorizado e o código sai plausível e desatualizado — **Placar (2-0)**, `docs/00-panorama-verificado.md §2.8` (R06-08) | O passo de CI que **regenera** o enum de `presentation` a partir de `curl -sS https://registry.npmjs.org/@remotion/transitions/latest \| jq -r '.exports\|keys[]'` e falha no `git diff` não-vazio: sem rede ele quebra em vez de aceitar o enum memorizado |

## O que esta skill NÃO cobre

- Campos do manifesto, dialeto 2020-12, versionamento por objeto e a cadeia
  Zod → JSON Schema → Pydantic: **`timeline-manifest`**.
- `<Composition schema={…}>`, topo `z.object()`, `--props` e serialização de input props:
  **`remotion-core`**.
- Geração e sanitização de código Manim, e o que o executor exige: **`manim-bridge`**.
- Como escrever o gate, a sonda negativa e o critério que falha por ausência:
  **`falsifiable-gates`**; fixture e golden master: **`video-characterization`**.
- Tetos de paralelismo, largura de onda e orçamento por janela: **`parallel-worktrees`** e
  **`wave-planning`**.
- Como abrir, ancorar e fechar as perguntas listadas abaixo: **`uncertainty-ledger`**.
- Formato, escrita e consolidação de arquivos de skill: **`meta-skill-evolution`** e
  **`meta-skill-consolidate`**.
- Curvas, ζ, overshoot e duração de animação: **`motion-design-system`**.

## Não verificado

1. `pattern` é suportado no schema da Anthropic, sem backreference, lookahead/lookbehind ou
   `\b` — **(1-0)**: a página da AWS não o cita nem entre os suportados nem entre os proibidos.
   **Divergência declarada com a autoridade de fato:** `docs/00-panorama-verificado.md §2.8`
   (R16-09) lista `pattern` como suportado dentro de uma linha agregada de placar (2-0), enquanto
   `§8.1` mantém R16-10 na fila de verificação — o panorama fica dos dois lados, e esta skill
   adota o lado estreito até o teste abaixo rodar. **Fecha com:** enviar schema com `pattern: "^n-[0-9]{3}$"` e
   `max_tokens: 16`; 200 = suportado, 400 = não. Enquanto isso, `pattern` é a única trava de
   formato disponível dentro do schema — não construa o desenho em cima dela.
2. `strict: true` em tool aceita propriedade **fora** de `required` — **(1-0)**, o exemplo
   oficial sugere que sim. **Fecha com:** uma chamada com tool `strict` e um campo opcional;
   ver se volta 400.
3. Saída estruturada é incompatível com `citations` (as duas juntas retornam 400) — **(1-0)**.
   **Fecha com:** uma chamada com os dois recursos ligados.
4. Trocar `output_config.format` invalida o prompt cache daquela thread — **(1-0)**, só na
   fonte da Anthropic. **Fecha com:** duas chamadas com o mesmo prefixo e schemas diferentes,
   lendo `usage.cache_read_input_tokens`.
5. Limites de tamanho do modo `strict` e quais constraints valem lá — **(1-1), em disputa**
   entre a doc do fornecedor (10 níveis / 5.000 propriedades / 1.000 enums) e a da plataforma
   gerenciada (5 níveis / 100 propriedades). **Fecha com:** enviar o schema real crescendo em
   profundidade até o primeiro 400. Até lá, desenhe para a interseção — profundidade ≤ 5,
   poucas dezenas de propriedades, zero constraint numérica ou de tamanho.
6. O Remotion valida o schema Zod **durante o render**, e não só no Studio — **(0-0)**: nenhuma
   fonte afirma, a doc lida só não nega. **Fecha com:**
   `npx remotion render <id> --props=./props-invalido.json` e observar se falha.
7. `temperature` é aceito ou retorna 400 no modelo alvo — **(1-1), em disputa** entre a
   referência da API (documenta 0.0–1.0) e o guia de migração da mesma casa (trata sampling
   params como removidos na linha recente). **Fecha com:** uma chamada com `temperature: 0`,
   conferindo o status.
8. Os multiplicadores de preço do prompt cache (1,25× / 2× / 0,1×) — **(1-0)**, só a fonte da
   Anthropic os dá; a da AWS diz apenas "reduced rate" (o panorama §2.8, R16-19·R16-20, os dá
   como 2-0 por agregação de linha — ver a nota na seção de caching). **Fecha com:** uma chamada com
   `cache_control` e outra sem, comparando `total_cost_usd` contra os `usage.*` correspondentes.
9. Custo real de uma geração completa de manifesto nesta conta — nenhum número existe.
   **Fecha com:** somar `total_cost_usd` de todas as chamadas de uma geração e persistir em
   `metrics/`, desde a primeira execução.

## Evolution

On task completion, if this skill was involved, run the memory pipeline
(see `meta-skill-evolution`):

1. **Importance** — non-obvious, non-inferable, non-volatile, and changes how future tasks in
   this area are done?
2. **Verification** — confirmed by a green test/lint/eval or explicit user confirmation?
   Without an external signal, discard.
3. **Conflict** — contradicts an existing passage? Replace it; never append a rival rule.
4. **Gating** — run the skill linter and this skill's eval set. Discard on regression.
5. **Update** — edit this file directly. No learnings file, no buffer.

If nothing important and verified was learned, write nothing — that is the healthy default.
