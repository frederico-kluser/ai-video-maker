# AGENTS.md -- Editor de Video IA

Instrucoes para agentes de IA que trabalham neste repositorio.
Este arquivo e carregado no inicio de toda sessao. Seja direto e normativo.

## Visao geral

O Editor de Video IA e um pipeline que transforma um tema/brief em video completo
com narracao, graficos, legendas e musica.

O video e uma **funcao pura** de um manifesto resolvido mais assets enderecados
por conteudo (SHA-256). Tudo que e impuro -- LLM, TTS, download, rede -- sobe
para *acima* da fronteira de determinismo e e cacheado por hash.

## Os cinco estagios

1. **AUTORIA** -- LLM recebe tema e produz `manifesto.json`. Nao deterministico, cacheado.
2. **RESOLUCAO** -- Cinco sub-estagios impuros (locucao, grafico, midia, codigo, musica).
   Cada um cacheado por hash. Produz `manifesto-resolvido.json`.
3. **COMPOSICAO** -- Funcao pura. Zero rede, zero `Date.now()`, zero `Math.random()` sem seed.
   Determinismo testado: render 2x produz bytes identicos.
4. **RENDER** -- Frames a encode. Paralelizavel por faixa.
5. **POS/ENTREGA** -- Loudness, variantes, legenda, thumbnail, procedencia.

## A fronteira de determinismo

```
Acima: nada e deterministico, tudo e cacheado.
Abaixo: tudo e deterministico, e o determinismo e TESTADO.

Nenhuma URL, nenhum tempo relativo, nenhuma decisao pendente
atravessa esta linha.
```

## Regras criticas

### Regra 1: Nao introduza nao-determinismo abaixo da fronteira

`src/composicao/` e funcao pura. Proibido:
- `Date.now()`, `Math.random()`, `setTimeout()`, `fetch()`
- Qualquer acesso a rede, disco, ambiente ou relogio
- Iteracao sobre objetos sem ordenacao explicita

### Regra 2: Nao duplique literais de token

Toda cor, espacamento, duracao, fonte e tamanho vive exclusivamente em
`src/design/tokens.ts`. O gate `just design:varrer` procura literais fora
de `src/design/` e falha se achar. Um literal repetido em dois arquivos
diverge num merge limpo.

### Regra 3: Todo card tem oraculo (ADR-0001)

Nenhum estagio do pipeline comeca enquanto nao existir um oraculo **capaz de
reprova-lo**. O card declara dependencia do card do oraculo, e o grafo faz
o resto. O comando de aceitacao tem de falhar se o trabalho nao tiver sido
feito (sonda negativa).

### Regra 4: O gate roda desde o dia 1

O gate comeca verde com tudo vazio. A cada card concluido, uma nova etapa
entra no gate e passa a ser exigida. Uma etapa que nao roda imprime `PENDENTE`;
uma que roda e passa imprime `PASSOU`; uma que falha imprime `FALHOU`.

### Regra 5: Handoff e o unico canal entre ondas

Ao concluir um card, escreva um handoff com campo `destinatarios` preenchido.
Irmaos da mesma onda sao cegos entre si por construcao -- o que o irmao
descobriu nao chega a voce.

### Regra 6: Descoberta por convencao, nunca registro central

Componentes de no, estagios de resolucao e perfis de encode sao descobertos
pelo caminho e nome no disco. Nao existe arquivo de registro central.

Para estagios de resolucao a convencao e `src/resolucao/<nome>/estagio.ts`
com `export default`. Um estagio descoberto no disco e SEM cassete derruba
`res-offline` -- nunca e pulado em silencio.

### Regra 7: Estagio de resolucao segue o contrato escrito

Antes de implementar qualquer estagio de resolucao (locucao, grafico,
midia, codigo, musica), leia:

- `docs/contrato-estagio-resolucao.md` -- assinatura, formato de cassete,
  campos obrigatorios de `procedencia.json` (inclusive `licenca`),
  comandos de aceitacao e checklist de fechamento
- `docs/adr/0006-contrato-de-estagio-e-cassete.md` -- por que cada decisao
- `fixtures/resolucao/estagio-referencia/estagio.ts` -- template copiavel

O que nao se negocia: `licenca` nao-vazia na procedencia, nenhuma URL no
manifesto resolvido, `identidade.versao` bumpada quando `resolver()` muda,
e `entrada.fetch` em vez de `globalThis.fetch`.

## As 12 ferramentas que mentem (C1-C12)

Estes modos de falha afetam este projeto especificamente. Todos falham em
silencio, com sinal positivo.

| # | A ferramenta mente assim | O que fazer |
|---|---|---|
| C1 | `exit 0` de um render nao prova que saiu imagem. Quadro preto = sucesso | Assertar conteudo (entropia do frame), nunca so o codigo de saida |
| C2 | Runner de teste com filtro que nao casa nada sai verde | Sonda negativa por alvo |
| C3 | `git diff --exit-code` nao enxerga arquivo nao rastreado | Combine com `git status --porcelain` |
| C4 | `ffprobe` reporta duracao do container, que pode divergir do stream | Leia duracao por stream e asserte a diferenca |
| C5 | O Chrome do Studio != o Chrome do render | Nenhum snapshot aprovado a partir do Studio; so do render |
| C6 | Uma fonte que nao carregou cai para fallback sem erro | Fontes locais embutidas + assercao da familia resolvida |
| C7 | Um asset da rede muda de conteudo mantendo a URL | Nada de URL no manifesto resolvido: so hash de conteudo |
| C8 | `nvidia-smi` presente != encoder disponivel para o processo | Prove o encoder com encode de 1s, nao com presenca do driver |
| C9 | Rodar 2x e comparar nao pega o que muda por data, fuso ou maquina | Congele relogio, fuso e locale; normalize por posicao, nunca por valor |
| C10 | Uma skill que existe != skill que foi carregada | Card lista `skills_obrigatorias`; handoff declara quais foram carregadas |
| C11 | Busca vazia em codigo gerado por LLM nao e prova de ausencia | Busque tambem no texto normalizado (tecnica do tripwire) |
| C12 | O cache acerta pelo motivo errado quando a chave omite um parametro | A chave inclui tudo que muda a saida; teste muda um parametro por vez e exige cache miss |

## As 14 armadilhas de dominio

| O que um agente assumiria | O que de fato e |
|---|---|
| `interpolate()` limita o resultado ao intervalo de saida | O default e `extend`, nao `clamp`. `interpolate(200,[0,100],[0,1])` devolve `2` |
| `durationRestThreshold` e ajuste fino de estetica | E `0.005` por default e mexer nele alonga o calculo sem teto |
| `-t` no motor de graficos produz WebM com alfa | Sozinho produz `.mov` com `qtrle`/`argb`. WebM so com `--format=webm` junto |
| O `.mov` transparente e ProRes 4444 | E `qtrle`. ProRes nao aparece no codigo do gerador |
| O navegador do render reproduz esse `.mov` | Nao reproduz -- mas a extracao de frame e fora do navegador, via FFmpeg |
| `-qk` e 1440p e `-qp` e 4K | Invertido: `k` = 3840x2160, `p` = 2560x1440 |
| `--disable_caching` nao escreve cache | O help diz "still generates cache files". Para limpar e `--flush_cache` |
| `--seed` torna o render reproduzivel | Torna o RNG da cena reproduzivel. Os bytes nao: o gerador grava a propria versao |
| A concorrencia default e metade dos nucleos | E `min(8, max(1, nucleos/2))` -- travada em 8 |
| `--buffer-size` melhora qualidade com acelaracao | Opcao proibida com encoder acelerado: `required` lanca erro; `if-possible` desliga aceleracao em silencio |
| `--hardware-acceleration required` verifica se ha hardware | Nao verifica. Seleciona encoder por plataforma e a falha aparece depois |
| Timestamps de locucao por caractere e por palavra sao a mesma coisa | Um provedor devolve por caractere; palavra e derivada acumulando ate o espaco |
| Offsets de speech mark sao posicao de caractere | Num provedor sao offset de byte -- e texto pt-BR com acento tem byte != caractere |
| O caminho local de transcricao devolve timing por palavra em qualquer idioma | A funcao de juncao e guardada por idioma ingles. Em pt-BR, o estagio de alinhamento nao pode ser deletado |

## Os 12 singletons

| # | Singleton | Tratamento |
|---|---|---|
| S-1 | `package.json` + lockfile Node | Dono exclusivo por onda |
| S-2 | `pyproject.toml` + lock Python | Dono exclusivo por onda |
| S-3 | `src/Root.tsx` (registro) | Stub no PREP, um bloco por card |
| S-4 | `schema/manifesto.schema.json` | Dono unico na fase 0; depois, so por ADR |
| S-5 | `src/design/tokens.ts` (+ espelho) | Dono unico; alteracao recaptura snapshots |
| S-6 | Definicao do CI | Dono exclusivo; mergeia por ultimo |
| S-7 | `ledger/aberto.json` | Nunca escrito por card |
| S-8 | O diretorio do store | Append-only por hash; escrita atomica |
| S-9 | Portas TCP (Studio, preview) | Faixa por card, declarada no PREP |
| S-10 | GPU / sessoes de encode | Fila explicita |
| S-11 | A arvore de cards | So o orquestrador escreve, em `PREP-*` |
| S-12 | `.agents/skills/catalog.md` | Gerado, nunca redigitado |

## Antes de escrever qualquer codigo

1. Leia `PROGRAMA.html` -- o contrato de execucao.
2. Leia o card que voce vai executar.
3. Leia o handoff de TODOS os ancestrais do card.
4. Consulte `docs/vocabulario.md` se encontrar um termo desconhecido.
5. Carregue as skills obrigatorias declaradas no card.

## O que este documento NAO cobre

- Vocabulario -- ver `docs/vocabulario.md`
- Convencoes de codigo -- ver `convencoes.md`
- Estrutura de diretorios -- ver `estrutura.md`
- O plano completo de execucao -- ver `PROGRAMA.html`
- Contrato de estagio de resolucao -- ver `docs/contrato-estagio-resolucao.md`
