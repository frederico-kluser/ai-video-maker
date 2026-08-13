# ADR-0031 — Cassete de autoria e a suite de rejeicao: o executor como cliente de chamada

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F4-04
- **Depende de:** ADR-0023 (contrato de autoria v1), F2-01 (cassetes e orquestrador de resolucao), F2-07 (suite offline integrada), F4-02 (biblioteca de prompts), AB-550 (ponte Autoria.1 -> S-4)
- **Porta TCP:** 4404 (docs/contrato-w6.md §9 — reservada; este card NAO abre servico TCP, o numero fica reservado para ferramenta de preview/Studio da autoria)
- **Faixa de ledger:** AB-650..AB-659 (ledger/inbox/F4-04.json)

## Contexto

O card F4-04 (W6, caracterizacao) entrega o cassete de autoria e a suite de
rejeicao. O ∅-crit do card: **"um manifesto invalido que passa tem de
derrubar a suite"**. O corolario, na pergunta adversarial do card: o cassete
tem de conter manifestos INVALIDOS gravados — so os bons nao testa nada.

O contrato-w6 §12 (bloco B1) congela o contorno do executor: o cassete de
autoria so testa alguma coisa se o CAMINHO DE CHAMADA que o produz estiver
no repositorio — `src/autoria/executor/**`, um cliente de chamada que:

1. usa os schemas PODADOS por fornecedor
   (`autoria.llm.anthropic.json` / `autoria.llm.openai.json`) para montar
   a chamada — nunca o schema completo;
2. respeita o cache do F4-01 (hash do brief + prompt + modelo, C12);
3. valida via `rejeitar.ts` ANTES do pipeline (`rejeitarSaidaInvalida`).

E o cassete grava contra a fixture canonica (`fixtures/canonico/manifesto-valido.json`):
"o cassete de autoria grava contra o mesmo manifesto que o resto do pipeline
usa — um manifesto diferente nao exercitaria o caminho real de resolucao".

AB-551/552/554 sao EVIDENCIA com credencial, NUNCA gate: o gate local
permanece verde OFFLINE (sem rede, sem chamada, cassete apenas).

## Decisoes

### 1. A autoria NAO entra no orquestrador de resolucao — e um caminho separado

O orquestrador (F2-01) executa os cinco estagios canonicos
[locucao, grafico, midia, codigo, musica] sobre um manifesto JA existente;
a autoria produz o documento que (via ponte AB-550, F5-01 na W7) se torna o
manifesto resolvido. A autoria e o estagio 1 do pipeline (AGENTS.md), a
resolucao e o estagio 2 — o executor e o cliente de chamada do estagio 1,
upstream do orquestrador. O nome "autoria" existe para o CASSETE (nome do
diretorio em `fixtures/cassetes/autoria/`), nao como `NomeEstagio`: a
descoberta por convencao varre `src/resolucao/<nome>/estagio.ts` e o
orquestrador lanca `EEstagioDesconhecido` para nome fora da lista canonica
(AB-502, fix do PREP-w6) — um estagio "autoria" ali seria um erro, e esta
decisao evita que ele exista.

### 2. O cassete de autoria segue o layout F2-01 com UMA extensao: `invalidos.json`

Layout (o MESMO do contrato F2-01, `src/resolucao/cassete/formato.ts`):
`fixtures/cassetes/autoria/<chave>/` com `cassete.json`, `resultado.json`,
`procedencia.json`, `volatil.json`, `chamadas.json` + `corpos/` — e a
extensao deste card: **`invalidos.json`**, a lista dos manifestos INVALIDOS
GRAVADOS. Cada entrada: `id` estavel, `motivo` (a regra do contrato que o
documento viola) e `documento` (o manifesto como veio, completo). A fonte
da cerimonia de gravacao vive em `fixtures/cassetes/autoria/invalidos-fonte.json`;
o cassete carrega a copia (o registro e per-chave, auto-contido).

Por que `invalidos.json` e nao fabricar os invalidos no teste: a pergunta
adversarial do card (2) — "a fixture alimenta a propria assercao?" — exige
que os invalidos sejam DADOS gravados, avaliados pelo validador do F4-01
(externo a este card). A suite nao muta nem deriva: le o cassete e exige
rejeicao em tres niveis (validacao, gate, executor). O leitor do cassete
REJEITA um cassete sem `invalidos.json` (ou com a lista vazia): meio
cassete nao reproduz meio estagio.

### 3. A chave do cassete: a MESMA construcao da resolucao, com prompt e brief na chave

A chave e o SHA-256 do JSON canonico dos componentes (mesma construcao de
`chaveDeCache` da resolucao, com canonicalizacao identica):
`{versaoContrato, versaoEstagio, nome: "autoria", hashManifesto, parametros}`
— onde `hashManifesto` e o hash da FIXTURE CANONICA (o cassete grava contra
o mesmo manifesto que o resto do pipeline usa) e `parametros` =
`{provedor, modelo, maxTokens, promptSha256, briefSha256, tentativa}`.

`promptSha256` e `briefSha256` amarram o cassete ao texto exato do prompt
(biblioteca de F4-02 — fonte unica, lida na chamada) e as mensagens exatas
do brief: QUALQUER mudanca troca a chave, troca o diretorio e o replay
offline vira miss — nunca resultado velho servido em silencio (C12). A
chave do cache do F4-01 (entrada) fica no cabecalho como auditoria
(`chaveCacheEntrada`), fora da chave do cassete.

`temperature` NAO entra na chave — mesma decisao do ADR-0023 (decisao 4):
o cache e o contrato de reproducao; parametros de amostragem nao fazem
parte dele. O parametro usado na chamada gravada (0, medido como aceito —
AB-554) fica documentado no executor.

### 4. O resultado gravado e um documento Autoria.1 — o Manifesto.1 e o alvo da ponte, nao a saida

A fixture canonica (`manifesto-valido.json`) e um documento **Manifesto.1**
(frames, layout, cor, hash) — o alvo da ponte AB-550 (F5-01 na W7), nao a
saida do executor. A saida do executor valida contra o schema Autoria.1:
gravar um Manifesto.1 como `resultado.json` faria o proprio gate rejeitar o
cassete. O `resultado.json` e o documento de autoria (Autoria.1) da chamada
— para o provedor openai, a resposta REAL gravada como veio (sosia, nao
sucessor); para o anthropic (sem credencial no dia), o documento de
referencia com a MESMA narrativa da fixture canonica, gravado do sosia e
registrado em `procedencia.notas`.

### 5. O executor implementa o HIT/MISS do cache com `lerDoCache`/`escreverNoCache` — porque `buscarOuGerar` e sincrono

O contrato do gerador do F4-01 (`buscarOuGerar(entrada, gerador: (entrada) => unknown)`)
e SINCRONO. A chamada HTTP ao provedor e assincrona. Medido neste card: um
gerador async passado ao `buscarOuGerar` grava a PROMISE no cache
(`JSON.stringify(Promise) === "{}"`) — a entrada fica envenenada em
silencio e toda chamada seguinte serve o cache sujo. O executor replica a
mecanica do cache do F4-01 (mesma chave, mesma escrita atomica, mesmo
arquivo) com o ciclo async proprio: `lerDoCache` -> (miss) `await
executarChamada` -> `escreverNoCache`. A escrita e ANTES do gate — mesma
semantica do F4-01 — e o gate roda TAMBEM sobre a saida do cache: um cache
envenenado nao e porta de fuga do pipeline (testado).

### 6. O caminho OpenAI envia `strict: false` — o schema podado nao e strict-compativel como commitado

Medido com credencial real (dia do card): o schema podado
`autoria.llm.openai.json` usa `const` SEM `type` em 13 propriedades
(`schema_version` e `schema`/`type` dos seis nos). Isso e valido em JSON
Schema 2020-12 e no subset da Anthropic, e INVALIDO no strict da OpenAI —
a chamada com `strict: true` volta 400 ("schema must have a 'type' key",
antes da inferencia). Com `strict: false` a chamada funciona (200) e o
documento sai valido. A SEGURANCA do contrato nao depende do strict: o
gate (`rejeitarSaidaInvalida`) valida contra o schema completo ANTES do
pipeline — o caminho nao-estrito e exatamente o caso que o gate existe
para cobrir. O defeito do schema esta registrado (AB-650): quando o dono
do schema corrigir (const com type pareado), o executor volta a `strict: true`.

### 7. AB-551/552/554: evidencia com credencial, nunca gate

As medicoes sao comandos avulsos (`npx tsx src/autoria/executor/medir-limites.ts`),
rodados a mao com rede e credencial, registrados em `ledger/evidencia/`. O
gate `just autoria-offline` roda VERDE offline: cassete apenas. Medido no
dia do card: AB-554 FECHADO (temperature 0 aceito — 200), AB-551 FECHADO
(teto atual da conta aceita 6 niveis e >100 propriedades — 200); AB-552
PENDENTE (sem credencial Anthropic no ambiente; nao bloqueia).

### 8. A gravacao e uma cerimonia a mao, com o gravador do F2-01 consumido, nunca editado

A gravacao usa o `GravadorDeChamadas` do F2-01 (instrumenta o fetch real,
sanitiza credencial, guarda corpos por hash) e os helpers de `formato.ts`
(`serializarCanonico`, `sanitizarHeaders`, `sanitizarUrl`,
`procurarCredencial`, `validarProcedencia`) — consumo, nao edicao. O
script da cerimonia vive em `src/autoria/executor/gravar-cassete.ts` (a
ferramenta fica ao lado do executor porque `tools/` esta fora do mapa de
arquivos da W6): roda com rede e credencial, nunca em suite. O
determinismo e provado sobre a resposta GRAVADA (sosia), nunca com uma
segunda chamada real — a resposta de LLM nao e reproduzivel (ADR-0023); o
`tests/autoria/cassete-diff.test.ts` regrava duas vezes com relogios
diferentes e exige diff identico exceto `CAMPOS_VOLATEIS`.

## Consequencias

- O gate `just autoria-offline` cobre: ∅-crit (cassete existe com
  invalidos gravados), sonda de kernel (unshare), sonda em processo,
  vitest de autoria (incluindo os testes do contrato de F4-01) e o
  denominador dos arquivos do card (anti-vacuidade C2).
- O replay offline do cassete exercita o caminho de chamada INTEIRO:
  entrada -> requisicao montada -> fetch do cassete (casa por metodo+URL,
  lanca em chamada ausente) -> extracao -> gate -> documento.
- O F5-07 (W9, consumidor do executor no pipeline) encontra o executor
  em `src/autoria/executor/` com a API `chamarAutoria(provedor, brief,
  opcoes) -> Promise<ResultadoChamadaAutoria>`; o resultado ja saiu do
  gate — o pipeline nao valida de novo, consome.

## Alternativas descartadas

- **Gravador proprio sem consumir o F2-01** — divergiria na
  sanitizacao/tripwire de credencial no primeiro campo novo; o cassete de
  autoria tem de ser indistingivel em formato dos da resolucao.
- **Invalidos fabricados no teste por mutacao do documento bom** — a
  pergunta adversarial (2) do card; mutacao e a mesma premissa duas
  vezes, e uma mutacao no-op passa verde.
- **`strict: true` + cassete sosia (nao usar a chamada real ate o schema
  ser corrigido)** — o executor ficaria sem caminho real de chamada; o
  registro do defeito (AB-650) + `strict: false` documentado entrega o
  caminho funcionando HOJE com o gate como garantia.
- **Executar a autoria dentro do orquestrador de resolucao** — o
  orquestrador e o contrato de estagio (EntradaEstagio/Manifesto) nao se
  aplicam a autoria (brief, nao manifesto); forcar caberia por cast e
  a lista canonica ficaria mentirosa (AB-502).
