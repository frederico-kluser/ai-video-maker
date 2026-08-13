# ADR-0007: Contrato de estagio de resolucao, formato de cassete e composicao da chave de cache

**Status:** ACEITO
**Data:** 2026-08-11
**Card:** `F2-01` (W3) — hub de out-degree 7
**Depende de:** `F0-02` (schema do manifesto), `F0-07` (store por SHA-256), ADR-0001 (oraculo)
**Consumida por:** `F2-02`, `F2-03`, `F2-04`, `F2-05`, `F2-06` (W4), `F2-07` (W5), e a composicao

**Guardas executaveis:**

```sh
bash tools/resolucao/offline.sh          # suite com a rede bloqueada de verdade
npx tsx tools/resolucao/regravar-e-diffar.ts  # regravar e diffar; sonda negativa inclusa
bash tools/resolucao/sem-cassete.sh      # ∅-crit: estagio sem cassete derruba a suite
python3 -m pytest tests/resolucao/test_schema_resolvido.py   # URL impossivel pelo schema
```

## Contexto

O AGENTS.md coloca a resolucao exatamente em cima da fronteira de
determinismo: cinco sub-estagios impuros (locucao, grafico, midia, codigo,
musica), cada um cacheado por hash, produzindo um `manifesto-resolvido.json`
que atravessa a linha. Abaixo dela tudo tem de ser deterministico, e o
determinismo e testado.

Cinco cards da W4 vao implementar esses estagios **em paralelo e cegos
entre si**. Cinco pessoas decidindo sozinhas o que e um cassete produzem
cinco formatos; o que diverge nunca e a parte visivel, e sim o campo que
ninguem testa — tipicamente a licenca. Este ADR fixa as decisoes que os
sete cards downstream herdam.

Tres perguntas adversariais do card guiaram o desenho, e cada uma virou
um mecanismo:

1. Uma suite "offline" que so *nao usa* a rede e indistinguivel de uma que
   *nao consegue* usar — ate o dia em que alguem adiciona uma chamada e o
   CI fica verde na maquina com rede.
2. Uma chave de cache que omite a versao do estagio serve resultado velho
   para sempre, e o sintoma aparece longe da causa.
3. Uma URL no manifesto resolvido reintroduz, abaixo da fronteira, um
   endereco cujo conteudo pode mudar sem aviso (C7).

## Decisao

### D1 — O contrato e uma funcao de (manifesto, parametros) para (parcial, procedencia)

`EstagioResolucao` (`src/resolucao/contrato.ts`) tem tres membros:
`identidade` (nome canonico + versao semver), `parametros` (escalares que
mudam a saida), e `resolver(entrada)`.

`resolver()` **so e chamado em modo gravacao**. Em modo offline o
orquestrador reproduz o cassete e nao invoca o codigo do estagio. E isso
que torna possivel rodar a suite com a rede fechada sem mock nenhum: nao
ha o que mockar, porque nao ha execucao.

Cada estagio devolve apenas a **sua camada** (`ParcialResolvido`). O merge
e do orquestrador, e **colisao com hashes diferentes e erro**, nao
"o ultimo vence" — ultimo-vence faz o resultado ser funcao da ordem de
execucao, que e o oposto de determinismo.

### D2 — Descoberta por convencao: `src/resolucao/<nome>/estagio.ts`

Sem registro central (Regra 6). O arquivo `estagio.ts` **e** o registro; um
diretorio de infraestrutura (`cassete/`, `rede/`) nao o tem e por isso nao
e confundido com estagio, sem lista de excecoes para manter desatualizada.

O caminho casa com os `owned_files` dos cards da W4 (`resolucao/grafico/**`
etc.), entao cada card e dono do seu diretorio inteiro.

Quem responde "faltou algum estagio?" e o **disco**, nao a lista de
estagios que alguem passou ao orquestrador. Uma lista passada a mao nunca
contem o estagio que voce esqueceu — e "estagio esquecido" e exatamente o
que o ∅-crit existe para pegar.

### D3 — A chave de cache inclui cinco componentes, e a versao do estagio e um deles

```
chave = SHA-256( jsonCanonico({
  versaoContrato,   // muda quando a semantica deste contrato muda
  nome,             // locucao | grafico | midia | codigo | musica
  versaoEstagio,    // semver do estagio  ← C12
  hashManifesto,    // SHA-256 do JSON canonico do manifesto
  parametros,       // tudo que muda a saida e nao esta no manifesto
}) )
```

JSON **canonico** (chaves ordenadas): sem isso a chave depende da ordem de
insercao das propriedades, que e ordem de escrita do codigo e nao dado — e
a mesma configuracao produz duas chaves em duas maquinas.

A chave e tambem o **nome do diretorio do cassete**. Consequencia
deliberada: mudar qualquer componente muda o diretorio, e em modo offline
o cassete antigo simplesmente **nao e encontrado** — o miss vira
`ECasseteAusente`, um erro barulhento, em vez de um resultado velho
servido em silencio.

`versaoContrato` existe para que uma mudanca de semantica aqui invalide
todos os cassetes de uma vez, sem precisar bumpar cinco estagios a mao.

**Obrigacao herdada pela W4:** mudou `resolver()` de um jeito que pode
mudar a saida ⇒ bumpe `identidade.versao`. E a unica parte do contrato
que nenhuma ferramenta consegue verificar sozinha.

### D4 — Formato de cassete: um diretorio por (estagio, chave)

```
fixtures/cassetes/<nome>/<chave>/
  cassete.json      formato, chave, componentes da chave (auditoria de C12 a olho nu)
  resultado.json    a ParcialResolvido, em JSON canonico
  procedencia.json  licenca e origem — OBRIGATORIO
  chamadas.json     chamadas HTTP gravadas, na ordem
  corpos/<sha256>   corpo binario de cada resposta, deduplicado por hash
  volatil.json      o UNICO arquivo autorizado a mudar ao regravar
```

O caminho `fixtures/cassetes/<nome>/**/procedencia.json` e o mesmo que o
∅-crit dos cinco cards da W4 varre com `rg -L '"licenca"'`.

Obrigatorios: `cassete.json`, `resultado.json`, `procedencia.json`,
`volatil.json`. Falta parcial conta como **ausencia total**: meio cassete
nao reproduz meio estagio, reproduz um resultado errado.

### D5 — `procedencia.json` em portugues, com `licenca` obrigatoria

`licenca` nao-vazia no topo **e** em cada asset. Validado na **gravacao**,
antes de qualquer byte chegar ao disco — um cassete invalido gravado
passaria no `res-offline` seguinte e a divida ficaria invisivel — e de novo
na **leitura**, porque um cassete pode ser editado a mao depois.

Os campos ficam em portugues (`licenca`, `atribuicaoObrigatoria`) enquanto
`src/store/procedencia.ts` usa ingles (`license`). Sao dois contratos, de
dois cards. A ponte e `paraProcedenciaDoStore()`, escrita uma vez aqui: se
cada card da W4 escrevesse a sua, cinco tradutores paralelos divergiriam,
e o campo que divergisse seria descoberto numa auditoria de licenca — tarde.

Provedor fora do vocabulario fechado do store vira `"unknown"`, **mas o
nome original vai para `notes`**: provedor que some no mapeamento e uma
auditoria que nao consegue voltar a origem.

### D6 — Determinismo do cassete: diff total, volateis enumerados

Regravar tem de reproduzir cada byte. As unicas diferencas aceitaveis
estao em `CAMPOS_VOLATEIS`, hoje duas:

| Campo | Justificativa |
|---|---|
| `volatil.json#/*` | hora de gravacao, duracao, runtime — auditoria de execucao, nao resultado |
| `procedencia.json#/adquiridoEm` | quando o byte entrou no repositorio; exigido para auditoria de licenca |

A mascara e **por caminho explicito** (`arquivo#/campo`), nunca por forma
do valor. Um "ignore timestamps" com regex frouxo come tambem o hash que
mudou, e o diff passa a dizer "igual" para cassetes que divergem no
conteudo.

O diff percorre a **uniao** dos arquivos dos dois lados: arquivo que existe
so de um lado e refutacao, nao omissao (C3 — o erro do `git diff` que nao
enxerga arquivo novo). JSON logicamente igual com bytes diferentes tambem
refuta: serializacao nao-canonica quebraria a estabilidade do cassete.

`res-cassete` termina com **sonda negativa**: muta um byte de
`resultado.json` e exige que o diff fique vermelho. Um diff que nunca
reprovou nao e evidencia de nada.

### D7 — Rede bloqueada em duas camadas, e a prova e de dois lados

| Camada | Mecanismo | Cobre |
|---|---|---|
| Externa | namespace de rede do kernel (`unshare --map-root-user --net`) | processo **e subprocessos** |
| Interna | `src/resolucao/rede/bloqueio.ts`, via `setupFiles` do vitest | `fetch`, `net.Socket.connect`, `http/https.request`, `dns` |

A camada interna falha com a mensagem **estavel** `REDE BLOQUEADA`,
distinguivel de um `ENOTFOUND` por acaso. Os testes casam essa mensagem, e
nao "deu erro": qualquer erro serviria para um teste frouxo, e e assim que
uma suite passa a medir o ambiente em vez do guarda.

As sondas usam **IP literal** (`1.1.1.1:443`), nao nome. Um `ENOTFOUND`
provaria resolvedor quebrado, nao rede fechada — e resolvedor quebrado e um
estado comum de container.

A prova e **de dois lados**: um servidor de loopback local mostra que, sem
o guarda, a mesma chamada **funciona**; com ele, morre. Sem essa metade,
"bloqueou" e "esta quebrado" produzem o mesmo teste verde.

`__somenteParaSondaDoGuarda_comRedeLiberada` e a porta de fuga que torna a
sonda possivel. O nome e feio de proposito e `offline.sh` tem um tripwire
que falha se o simbolo aparecer fora de tres arquivos autorizados: um
estagio que desligue o guarda "so para testar" transformaria "offline" numa
palavra.

Quando `unshare` nao existe, `res-offline` **diz isso em voz alta** e marca
a sonda de kernel como NAO-EXERCITADA. Reportar verde sem a camada externa
seria maquiagem.

O guarda **completo** — proxy, denominador de chamadas, subprocesso
instrumentado — e o card `F2-07` (W5), dono de `tools/offline-guard.*`.
Aqui esta o minimo que torna a prova possivel hoje.

### D8 — ∅-crit: estagio sem cassete derruba a suite, e a prova roda sozinha

`verificarCobertura()` varre `src/resolucao/*/estagio.ts` e exige cassete
para cada um. Ordem das checagens: **cassete primeiro, nome canonico
depois** — um estagio novo falha pela razao util ("nao tem cassete") antes
da burocratica.

O problema de vacuidade e real: a W4 ainda nao entregou estagio nenhum, a
varredura de producao encontra zero, e zero passa por vacuidade (C2). Duas
defesas:

1. `tools/resolucao/cobertura.ts` roda, **a cada execucao**, um autoteste
   do proprio verificador em arvores temporarias: um estagio com cassete
   tem de dar OK, um sem cassete tem de dar FALHOU. Se o verificador
   responder errado, o script sai vermelho mesmo com a producao limpa.
2. O relatorio imprime sempre o **denominador** ("estagios descobertos: 0")
   e nomeia os canonicos pendentes. "Nenhum problema" sozinho e armadilha.

`res-sem-cassete` executa a prova pedida pelo card, com fase de linha de
base: verde limpo → injeta estagio de mentira → **vermelho, e a saida tem
de citar o nome do estagio e o ∅-crit** → remove → verde. Vermelho generico
nao conta: precisa ser vermelho pelo motivo certo.

### D9 — O manifesto resolvido nao consegue conter URL, pelo schema

`schema/manifesto-resolvido.schema.json` define `$defs.SemURLProfundo`,
recursivo, aplicado na **raiz** via `allOf`. Ele proibe `://` e `^//` em
toda string e em todo nome de propriedade, em qualquer profundidade —
**inclusive dentro do manifesto embutido**, sem precisar tocar
`schema/manifesto.schema.json` (singleton S-4).

Dez fixtures em `fixtures/resolucao/` contrabandeiam URL por dez caminhos
diferentes (propriedade extra, campo `provedor`, campo `licenca`,
`atribuicao`, dentro do manifesto, nome de propriedade, no lugar do hash,
URL relativa a protocolo), mais timestamp e asset sem licenca. Proibir so
o obvio nao proibe nada.

Complementarmente, `encontrarURLs()` e o tripwire em runtime: a busca e no
JSON serializado inteiro, nao campo a campo (C11).

### D10 — Zero tempo de parede no manifesto resolvido

Nao existe `inicio`, `fim`, `duracaoMs` nem qualquer campo de data no
manifesto resolvido, e `additionalProperties: false` impede criar um. O
registro de estagio carrega `{ estagio, versaoEstagio, chave, origem }` —
*qual codigo* produziu o resultado, nunca *quando*.

Congelar relogio no teste nao adianta se o artefato tem campo de data: dois
pipelines identicos em dias diferentes produziriam manifestos resolvidos
diferentes, e o determinismo abaixo da fronteira seria falso (C9). Duracao
e auditoria, e auditoria mora em `volatil.json`.

## Consequencias

**Positivas**

- Os cinco cards da W4 implementam contra um contrato escrito, com template
  copiavel e checklist — sem falar entre si.
- Ausencia de cassete e ruidosa por construcao; nao ha caminho de codigo
  que a transforme em skip.
- Mudar versao, parametro ou manifesto invalida o cache automaticamente,
  porque a chave e o nome do diretorio.
- A suite roda com a rede fechada de verdade, e o fato e provado por sondas
  de dois lados, nao afirmado.

**Negativas**

- Cassete e um artefato versionado no repositorio: assets grandes inflam o
  git. Mitigacao parcial: `corpos/` deduplica por hash. Se virar problema,
  a saida e mover corpos para o store e deixar so o hash — sem mudar o
  contrato.
- Gravar cassete exige rede e roda a mao. Regravar em massa apos bump de
  versao e trabalho manual ate existir um `res-gravar` em lote.
- `unshare --net` nao existe em todo ambiente (macOS, alguns CI). La a
  camada externa some e sobra so o guarda em processo — resultado mais
  fraco, e declarado como tal.
- A obrigacao de bumpar `identidade.versao` e disciplina humana. Nenhum
  teste consegue distinguir "codigo mudou e a saida tambem" de "codigo
  mudou e a saida nao". Mitigacao: `res-cassete` pega o caso em que a saida
  mudou e o cassete nao foi regravado.

**Riscos**

- `CAMPOS_VOLATEIS` e a superficie de erosao deste ADR. Cada entrada nova e
  determinismo do qual se abre mao. Ha teste exigindo que a lista tenha no
  maximo tres entradas; crescer alem disso exige ADR novo.
- O detector de credencial e regex, nao parser. Chave em formato nao
  coberto passaria. Ver ADR-0005, mesmo risco, mesma mitigacao: ampliar
  conforme provedor novo entra.

## Itens de ledger ligados

- **AB-280** — assets grandes em cassete versionado: limite de tamanho por
  cassete ainda nao definido.
- **AB-281** — `unshare --net` indisponivel em parte dos ambientes: a
  camada externa some e nao ha decisao sobre tratar isso como vermelho.
- **AB-282** — regravacao em massa apos bump de `versaoContrato`: nao ha
  ferramenta.
- **AB-283** — deduplicacao de corpo entre cassetes de estagios diferentes
  nao existe: o mesmo GIF baixado por dois estagios ocupa dois lugares.
- **AB-284** — o `justfile` do repositorio nao parseia com `just` 1.42:
  receitas com `:` no nome sao invalidas. Afeta todos os cards.

## Reafirmacoes

- **ADR-0001** (oraculo): cada guarda deste card tem sonda negativa —
  `res-cassete` muta e exige vermelho; `res-sem-cassete` injeta e exige
  vermelho; `cobertura.ts` autotesta o verificador; a sonda de rede prova o
  lado positivo com loopback.
- **ADR-0005** (segredos): nenhuma credencial entra em cassete; a gravacao
  falha se achar.
- **AGENTS.md Regra 1**: nenhum `Date.now()` nem iteracao nao-ordenada no
  caminho que produz o manifesto resolvido.
- **AGENTS.md Regra 6**: descoberta por caminho no disco, sem registro central.
- **AGENTS.md S-4**: `schema/manifesto.schema.json` nao foi tocado.
