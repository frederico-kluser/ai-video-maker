# Mapa de skills — justificativa de recorte

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

> **Baseado em:** `docs/00-panorama-verificado.md` (19 clusters de pesquisa verificada) e
> `docs/PLAYBOOK-REFERENCIA.md`. O catálogo navegável e **gerado** é `catalog.md` — este arquivo
> é o *porquê* do recorte, e é escrito à mão de propósito: a justificativa não se deriva.

## 1. O que este catálogo é

**20 skills**, em quatro tiers. Não é uma biblioteca de documentação: é o **delta** entre o que um
modelo capaz já sabe e o que este programa exige. Se uma passagem de uma skill ensina a
tecnologia, ela está no lugar errado.

| Tier | n | Papel | Quem carrega |
|---|---|---|---|
| `router` | 1 | despacha toda tarefa | sempre, primeiro |
| `metodo` | 6 | como o programa é **executado** | por classe de tarefa; duas são obrigatórias |
| `dominio` | 11 | o que o programa **constrói** | pelo que a tarefa trata |
| `meta` | 2 | como a memória **evolui** | ao concluir, e periodicamente |

## 2. O problema que este catálogo cria, e que ele declara

O relatório de validação do projeto de origem registra que **roteamento por palavra-chave degrada
acima de ~15 skills**. Este catálogo tem 20. Isso é uma escolha, e ela vem com duas obrigações:

1. **Roteamento em dois níveis** — o router escolhe o *tier* e só então a skill. Está escrito
   dentro do `project-router`, não só aqui.
2. **Medição, não impressão** — `meta-skill-consolidate` roda evals de roteamento com
   **near-misses** (queries que não devem disparar nada) e publica a precisão como número.
   O `catalog.md` gerado lista **11 gatilhos ambíguos de 352** (3,1%), com os donos concorrentes
   nomeados — números regerados por `gerar-catalogo.py` em `ccda369` (a linha "14 de 344" deste
   arquivo, escrita quando o catálogo tinha outra forma, está superada pelo gerado; gerado vence,
   é a representação derivada). Ambiguidade declarada é dívida; ambiguidade não medida é acidente
   esperando acontecer.

**Por que 20 e não 12:** porque o eixo de corte é **propriedade de arquivo e falha silenciosa**,
não conveniência de navegação. Fundir `ffmpeg-media-ops` com `remotion-render-pipeline` deixaria
uma skill de 700 linhas — acima do teto do linter — e degradaria o roteamento das duas.

## 3. Por que NÃO dividir mais

| Divisão candidata | Por que fica junto |
|---|---|
| `remotion-core` → separar `spring`/`interpolate` de `TransitionSeries` | São o **mesmo modelo temporal**. O cálculo de duração com transição sobreposta depende da semântica de `interpolate`; separar duplicaria o contexto que uma precisa da outra |
| `manim-bridge` → separar "executor headless" de "formato de alfa" | O formato de alfa **é** a saída do executor. A decisão de container/codec/pix_fmt e a de renderer são a mesma decisão, tomada no mesmo comando |
| `audio-captions-sync` → separar legenda de ducking | As duas derivam de **um** artefato, `timing.json`. Separar cria duas skills que só sabem metade do contrato e uma terceira para o contrato |
| `uncertainty-ledger` → separar "abrir item" de "fechar item" | Fechar é mais regulado que abrir **por causa** de como abrir funciona. A regra de evidência só faz sentido ao lado da regra dos cinco campos |
| `falsifiable-gates` → separar "catálogo de falso verde" de "sonda negativa" | O catálogo **é** a lista de coisas que a sonda existe para pegar |
| `motion-design-system` → separar tokens de acessibilidade | O limite de flashes e o contraste **são tokens**. Separá-los cria o caminho pelo qual alguém escreve uma cor fora da paleta e um invariante deixa de existir |
| Uma skill de "estilo de código" | Não há convenção não-inferível. O que existe é `disciplina: tdd \| caracterizacao`, e isso é campo de card, não skill |

## 4. Por que NÃO juntar mais

| Fusão candidata | Por que separa |
|---|---|
| `remotion-core` + `remotion-render-pipeline` | Um vive **abaixo** da fronteira de determinismo (função pura, sem I/O), o outro **atravessa** o encoder e o hardware. Falham por motivos diferentes: um por não-determinismo, o outro por saturação de recurso. Juntas passariam de 700 linhas |
| `ffmpeg-media-ops` + `remotion-render-pipeline` | O FFmpeg é usado **fora** do render (alfa do Manim, loudness, concatenação, extração de frame para o golden master). Fundir amarraria conhecimento de mídia ao motor de composição, que é o ponto de troca barata nº 1 |
| `tts-voiceover` + `audio-captions-sync` | Um está **acima** da fronteira (rede, licença, custo, consentimento), o outro **abaixo** (função determinística do timing). E a licença de voz é obrigação jurídica — não pode estar diluída numa skill de sincronia |
| `asset-acquisition` + `code-animation` | Ambos "resolvem asset", mas o regime é oposto: um é **jurídico** (ToS, atribuição, uso comercial), o outro é **determinístico** (pré-computar token, fixar tema). Fundir esconderia a obrigação legal atrás de um detalhe técnico |
| `wave-planning` + `parallel-worktrees` | Um decide **quando** (o DAG), o outro decide **se** (propriedade de arquivo). O playbook é explícito que são dois filtros em ordem, e confundi-los é o que faz uma onda parecer pronta sem estar |
| `video-characterization` + `falsifiable-gates` | Um é sobre **oráculo de pixel e som**, o outro sobre **critério que sabe reprovar**. `video-characterization` é uma das duas obrigatórias por classe de tarefa; diluí-la numa skill genérica de gate quebra a regra de carregamento obrigatório |
| `meta-skill-evolution` + `meta-skill-consolidate` | Criar e podar têm requisitos de segurança diferentes: evolução exige proposta revisada; consolidação exige **segunda opinião para deleção** |
| Tudo em uma skill monolítica | Passaria de 6.000 linhas e destruiria o roteamento. O tier existe justamente para não precisar disso |

## 5. As duas obrigatórias, e por que exatamente duas

De todo o conhecimento deste programa, exatamente **duas** skills têm carregamento obrigatório por
classe de tarefa — não por julgamento do agente. Duas, não vinte, porque as duas falhas que elas
cobrem são **silenciosas e confirmatórias**: nenhum teste posterior as pega, e o sinal disponível
diz o contrário do que aconteceu.

| Skill | Classe de tarefa | A falha que ela cobre |
|---|---|---|
| `video-characterization` | altera saída visual ou sonora | **"o render passou" parece prova.** Um quadro totalmente preto sai com `exit 0`. O sinal é positivo e o resultado é lixo |
| `parallel-worktrees` | escreve em arquivo tocado por outro card | **"escopo contido" parece contido.** O merge limpo *confirma* a ilusão: o git prova ausência de conflito de texto e nada mais |

Uma terceira candidata foi considerada e **rejeitada**: `asset-acquisition`, pelo risco jurídico.
Rejeitada porque a falha dela **não é silenciosa** — ela é bloqueada por um gate (`G-PROC`) e por
um card de infra com assinatura (`I-01`). Onde existe gate mecânico, não é preciso regra de
carregamento. *Gate onde o erro é irreversível; nudge no resto.*

## 6. Sinal de verificação por skill

Toda skill declara `verification_signal` no frontmatter: o comando que prova que ela **ainda é
verdade**. Sem isso, a skill não tem como detectar a própria decadência — e proveniência detecta
deriva, não correção.

| Classe de sinal | Skills | Roda sem o produto existir? |
|---|---|---|
| Linter de skill + eval de roteamento | todas | sim |
| Recomputação de pin de proveniência (a linha citada ainda é a mesma?) | as que citam `arquivo:linha` do projeto de origem | sim |
| Presença/versão de ferramenta (`ffmpeg`, `manim`, runtime) | `ffmpeg-media-ops`, `manim-bridge`, `remotion-render-pipeline` | sim, se instalada — **ausente é vermelho, não pulado** |
| Asserção contra artefato do produto | nenhuma, hoje | não — e é por isso que estão marcadas como `PENDENTE` |

**A última linha é a confissão honesta deste catálogo:** nenhuma skill tem, hoje, eval que rode
contra código de produto, porque não há produto. Os sinais atuais provam **forma e proveniência**,
não **correção**. Isso muda a partir da W1, e cada skill declara qual será o seu sinal real.

## 7. Grafo de composição

Quem compõe com quem, e por quê. As arestas abaixo são **carregamento em cadeia** (a skill de
origem assume a de destino na mesma tarefa) ou **fluxo de artefato** (a saída de uma é entrada da
outra). Aresta ausente por decisão — as fusões recusadas do §4 — é anti-aresta deliberada
(`asset-acquisition` × `code-animation`, `tts-voiceover` × `audio-captions-sync`,
`remotion-core` × `remotion-render-pipeline` atravessando a fronteira de determinismo).

| De | Para | Por quê |
|---|---|---|
| `project-router` | todas | roteamento em dois níveis: fechou o tier, escolhe a skill — o router despacha e não executa |
| `project-router` | `video-characterization`, `parallel-worktrees` | as duas obrigatórias por classe de tarefa, decididas por Q1/Q3 (ou pelos campos do card) — sem julgamento |
| `wave-planning` | `parallel-worktrees` | quem decide **quando** (DAG, níveis, largura) assume quem decide **se** (propriedade de arquivo, barreira, teardown) — dois filtros em ordem, nunca um |
| `falsifiable-gates` | `video-characterization` | o oráculo de pixel/som **é** um critério de gate: caracterização sem sonda negativa é medição de decoração |
| `video-characterization` | `falsifiable-gates` | a caracterização precisa do catálogo de falso-verde para saber o que a própria sonda deve reprovar |
| todas as task skills | `meta-skill-evolution` | o `<evolution>` roda ao fechar cada skill carregada — sem ele a memória morre no card |
| `meta-skill-consolidate` | todas | GC lê todos os corpos, mede sobreposição de gatilho (via `catalog.md`), podridão de pin e teto de linhas |
| `timeline-manifest` | `remotion-core`, `audio-captions-sync` | o manifesto resolvido é consumido pela árvore de composição e pelo timing de legendas/ducking |
| `tts-voiceover` | `audio-captions-sync` | o timing nativo de voz (palavra/caractere/byte) alimenta o alinhamento da legenda |
| `manim-bridge` | `remotion-core`, `ffmpeg-media-ops` | os webm de cena entram via OffthreadVideo; o alfa (`qtrle`/`yuva420p`) é tratado por FFmpeg fora do render |
| `remotion-render-pipeline` | `ffmpeg-media-ops` | concat, extração de frame (golden), remux — o render chama FFmpeg, mas o conhecimento de mídia não mora nele |
| `audio-captions-sync` | `ffmpeg-media-ops` | loudness/`ebur128`/`true peak` são domínio FFmpeg consumido pela pista de áudio |
| `llm-authoring` | `timeline-manifest` | a autoria gera/valida o manifesto; o contrato de forma do artefato é do timeline |
| `asset-acquisition` | `remotion-core` | o nó de mídia consome assets hash-addressados; o regime jurídico vive na aquisição, o layout no nó |
| `code-animation` | `remotion-core` | destaque de código pré-computado vira o nó de código da composição |
| `motion-design-system` | `remotion-core`, `video-characterization` | tokens e invariantes de motion são consumidos pelos nós e verificados visualmente |
| qualquer tarefa | `uncertainty-ledger` | todo pressuposto não-provável abre item; o ledger é ortogonal ao roteamento e não compete com skill |

## 8. Limites declarados

1. **Todas foram exercitadas.** Escritas em `8737ad6`, as skills rodaram nas 13 ondas de
   execução (W1-W12 + fix, `ccda369`): a convenção `skills_obrigatorias` de cada card as declarou
   (`docs/adr/0002-contrato-de-card.md:41`), os handoffs declararam as carregadas (C10,
   `AGENTS.md:110`), e a calibração C1/C2/C9/C12 é reinjetada por hook a cada prompt. O primeiro
   teste real do catálogo foi o pipeline completo — incluindo os 5 webm 3b1b, o GIF com legenda e
   o golden master. O que continua **não** medido: precisão de roteamento em número (item 4).
2. **O placar vem da pesquisa, não da skill.** Uma skill que inflasse um placar seria indetectável
   pelo linter — só a auditoria cruzada pega, e ela roda uma vez por onda, não a cada escrita.
3. **`Não verificado` é uma seção obrigatória e não vazia na maioria.** Isso é saudável: significa
   que as skills sabem o que não sabem. Um catálogo em que todas as seções `Não verificado`
   estivessem vazias seria mais suspeito, não menos.
4. **Roteamento com 20 skills não foi medido ainda.** A ambiguidade de gatilho foi *contada*
   (14 de 344), mas precisão de roteamento é outra coisa e exige os evals de near-miss.
