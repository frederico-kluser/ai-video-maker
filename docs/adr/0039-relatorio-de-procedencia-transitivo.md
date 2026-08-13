# ADR-0039 — Relatorio de procedencia transitivo (F5-06): o que entra no video final, com origem, data e termos

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F5-06 (W7, entrega)
- **Numero pre-alocado:** docs/contrato-w7.md §10 (F5-06 -> 0039)
- **Faixa de ledger:** AB-745..AB-749 (ledger/inbox/F5-06.json)
- **Depende de:** F0-07 (store enderecado por conteudo e `procedencia.ts`), F2-04/F2-06
  (bibliotecas de asset), ADR-0003 (enquadramento de uso pessoal — o relatorio e o
  consumidor D1/D3/D4 do ADR), contrato-w7 C3 (emenda do F3-05, AB-617)
- **Guarda executavel:** `just procedencia` com exit 0, sonda negativa incluida
  (o gate do proprio card: `npx tsx src/entrega/procedencia/gate.ts`)

## Contexto

O ADR-0003 liberou o uso sob enquadramento pessoal e deixou `AB-950` aberto de
proposito: o unico item permanentemente aberto do ledger. A consequencia estrutural
registrada la e que uma mudanca de enquadramento **nao produz nenhum sinal tecnico**
(R01-05) — o pipeline continua verde, o compliance fica invisivel. O F5-06 existe
para isso: um relatorio regeneravel a qualquer momento que diga, de cada byte do
video final, de onde ele veio, sob qual licenca, com que termos e quando foi
adquirido. Quando (e se) o AB-950 disparar, este relatorio e a base da reavaliacao
**sem re-renderizar** — e a razao de ele existir agora, nao depois.

Tres perguntas adversariais do card governam este ADR:

1. **O relatorio cobre assets TRANSITIVOS** — o que entrou dentro de um grafico,
   dentro de um cassete, dentro de uma emenda? Sim: `assets[]` de cada cassete
   participante entra como transitivo, e a cadeia de derivacao da emenda (C3) e
   caminhada ate a origem.
2. **Ele registra a ORIGEM com data e termos, ou so o nome do arquivo?** Registra
   licenca, provedor, data (`adquiridoEm`), termos (`atribuicao`/`termoDeBusca`) e
   origem (URL/id no provedor) quando existem; a ausencia de data vira gap
   **reportado**, nunca omitido.
3. **Se o enquadramento mudar (AB-950), o relatorio e suficiente para reavaliar o
   ja produzido sem re-renderizar?** Sim — ver Decisao 4.

## Decisoes

### 1. Formato do relatorio: `RelatorioProcedencia.1`

O relatorio e um JSON canonico (chaves ordenadas, sem espaco superfluo — o mesmo
criterio de `jsonCanonico` do contrato de resolucao) com:

- **`manifesto`** — identidade do manifesto resolvido + a origem do texto gerado
  (cassetes de autoria casados pelo `hashManifesto`);
- **`enquadramento`** — uso pessoal, ADR-0003, e a declaracao obrigatoria
  "AB-950 continua fechado" (omissao e falha de gate, ADR-0003);
- **`diretos`** — hashes referenciados pelos mapas `nos_*` e `trilha_sonora` do
  manifesto resolvido, cada um com a origem registrada;
- **`transitivos`** — o que entrou dentro de cassete (`cassete-<estagio>`) e dentro
  de emenda (a cadeia de derivacao, papel `emenda`);
- **`semOrigem`** — o ∅-crit: vazio = entrega liberada; qualquer entrada =
  `just procedencia` VERMELHO e a entrega bloqueada;
- **`gapsDeData`** — datas ausentes (visiveis para a reavaliacao, nao bloqueantes).

Vive em `src/entrega/procedencia/` (formato.ts, relatorio.ts, gate.ts), consumindo
`src/resolucao/cassete/*` (leitura) e `src/store/procedencia.ts` (leitura). Nada de
`src/resolucao/**` ou `src/store/**` e editado.

### 2. "Origem declarada" — a definicao executavel do ∅-crit

Um asset do video final (direto ou transitivo) esta com origem declarada quando:

- existe um registro de procedencia para o hash — do store (F0-07) ou dos cassetes
  participantes (store vence; sem store, os cassetes sustentam o relatorio);
- `licenca` e nao-vazia e nunca uma URL;
- `provedor` e nao-vazio;
- se o asset e DERIVADO (emenda), a cadeia de derivacao termina num registro com
  origem declarada e nao cicla (teto de profundidade 16 + deteccao de ciclo).

Tudo que viola isso entra em `semOrigem`. A ausencia de **data** nao bloqueia —
`adquiridoEm` e VOLATIL por contrato da W4 (CAMPOS_VOLATEIS) — mas vira
`gapsDeData`, porque a reavaliacao precisa ver o buraco. A data epoch que
`paraProcedenciaDoStore` grava quando o cassete nao tem data
(`1970-01-01T00:00:00.000Z`) e tratada como data nao registrada.

### 3. Convencao de derivacao da emenda (contrato-w7 C3, AB-617)

O F3-05 materializa a emenda com bytes e hash NOVOS no store. A procedencia desses
bytes declara a origem — o audio-fonte e a operacao — no campo de texto livre do
registro, com o marcador:

```
emenda: audio-fonte=<sha256>; operacao=<nome> <versao>
```

O relatorio varre o TEXTO inteiro de cada registro (store: `notes`/`sourceId`/
`attribution`/`toolVersion`; cassete: `notas`/`atribuicao`/`origem`/`idNoProvedor`)
em busca do marcador — o tripwire por texto normalizado (C11) torna o resultado
independente do campo exato escolhido pelo F3-05. A emenda entra no relatorio com
`derivadoDe` = {hash do audio-fonte, operacao}, e o audio-fonte entra como
transitivo com a origem DELE. O ∅-crit cobre a cadeia: emenda com audio-fonte sem
origem, ou cadeia ciclica, bloqueia.

**O hash usado e o NOVO (da emenda), nunca o do audio-fonte** — reusar o hash da
fonte e o falso-verde que o ∅-crit do F3-05 persegue (contrato-w7 §4).

### 4. Reavaliacao sem re-renderizar: o relatorio e funcao pura dos inputs commitados

O relatorio e gerado por funcao pura de (manifesto resolvido, store, cassetes,
relogio INJETADO). Consequencias:

- **Regeneravel a qualquer momento** a partir do que ja esta commitado — zero render,
  zero rede, zero cache quente. E isso que o torna a base da reavaliacao do AB-950.
- **Determinista**: duas geracoes com relogios diferentes diferem SO em `geradoEm`
  (verificado pelo gate). O relatorio pode ser versionado e diffado.
- **O "video final" do gate** (antes do F5-01 mergear) e o manifesto resolvido
  montado dos cassetes commitados (union dos `resultado.json` por estagio). Quando o
  F5-01 entregar a ponte AB-550, o manifesto resolvido da ponte substitui essa
  montagem como entrada — o gerador aceita qualquer `ManifestoResolvido`.

### 5. O gate: oito checagens, todas com denominador

`just procedencia` roda `src/entrega/procedencia/gate.ts` com: (1) denominador —
diretos E transitivos gerados dos cassetes commitados; (2) ∅-crit — `semOrigem`
vazio; (3) sonda negativa — quatro mutacoes (hash sem registro, licenca vazia,
emenda com fonte sem origem, cadeia ciclica), cada uma tem de ficar VERMELHA pelo
motivo certo; (4) emenda C3 presente no relatorio transitivo; (5) presenca per-item
dos assets conhecidos da fixture canonica — nunca lista fechada (contrato-w7 §12);
(6) data e termos registrados; (7) determinismo; (8) AB-950 declarado.

## Alternativas consideradas / descartadas

### Alternativa A: "Relatorio so do que o render consome diretamente"

**Descartada.** O audio-fonte dentro da emenda e os 5 wavs dentro da trilha
composta entrariam no video final sem nenhum registro no relatorio — exatamente a
cegueira que a pergunta 1 do card persegue. A transitividade (cassete + emenda) e o
que torna o relatorio defensavel.

### Alternativa B: "Bloquear tambem por data ausente"

**Descartada.** `adquiridoEm` e VOLATIL por contrato da W4; os cassetes locais
(locucao, grafico, codigo) sao legitimamente gravados sem data. Bloquear por data
faria o gate vermelho com dados commitados legitimos. A ausencia vira `gapsDeData`:
visivel para a reavaliacao, nunca silenciosa.

### Alternativa C: "O relatorio regenera o proprio oraculo"

**Descartada.** O gate nunca grava o relatorio que valida: ele exercita o gerador
contra os cassetes commitados + sondas sinteticas. Um gate que regera o proprio
oraculo nao reprova nada (disciplina do F1-05 mantida).

## Consequencias

### Positivas

1. **O ∅-crit do card e executavel**: um asset no video final sem origem declarada
   deixa `just procedencia` VERMELHO e bloqueia a entrega.
2. **O AB-950 tem base de reavaliacao**: o relatorio, regenerado dos mesmos
   commitados, diz o que esta embutido no video — a leitura que o ADR-0003 exige do
   gate de publicacao.
3. **A emenda (C3) tem origem rastreavel** mesmo sendo derivada: hash novo +
   cadeia ate o audio-fonte.
4. **Nenhum outro card precisa mudar**: o relatorio consome contratos fechados
   (store, cassetes, manifesto resolvido) e declara o enquadramento por copia da
   sentenca do ADR-0003.

### Custos e desvios registrados

1. **A convencao do marcador de derivacao depende do F3-05 gravar o marcador no
   texto livre da procedencia.** O F3-05 mergeia ANTES do F5-06 (contrato-w7 §8) e
   foi cego ao formato exato. O relatorio varre o texto inteiro de TODOS os campos
   livres (C11), entao qualquer campo escolhido pelo F3-05 e coberto — mas se o
   F3-05 nao gravar o marcador em campo nenhum, a cadeia nao aparece. Registrado em
   AB-745; o gate sonda a convencao sinteticamente e o handoff nomeia a diferenca.
2. **O manifesto resolvido do gate (montagem dos cassetes) precede a ponte do
   F5-01.** Quando o F5-01 (hub) entregar a ponte AB-550, ele consome o mesmo
   gerador com o manifesto da ponte — a montagem atual e um placeholder honesto de
   "o video final", nao um artefato paralelo.
3. **A data de aquisicao ausente e um gap visivel, nao um bloqueio.** Quem
   reavaliar sob um AB-950 disparado ve os gaps na primeira pagina do relatorio.
4. **O relatorio contem URLs** (`origem`, `fetchedFrom`). E de proposito: o
   relatorio vive ACIMA da fronteira de determinismo (entrega, nao composicao) e a
   URL e parte da origem registrada. C7 vale para o manifesto resolvido, nao para o
   relatorio de auditoria.

## Revisao adversarial

**Pergunta:** O relatorio nao deveria bloquear quando a data de aquisicao falta?
Sem data, como reavaliar sob AB-950?

**Resposta:** A reavaliacao sob AB-950 e sobre LICENCAS e TERMOS, nao sobre datas:
o que muda com o enquadramento e se a licenca cobre o uso, e a data nao muda a
licenca declarada. A data importa para auditoria de "quando este byte entrou", e a
ausencia dela e reportada em `gapsDeData`, na primeira pagina do relatorio — quem
reavaliar ve o buraco. Bloquear por data tornaria o gate vermelho com cassetes
legitimamente gravados sem `adquiridoEm` (volatil por contrato da W4), sem ganho
para a reavaliacao.

**Pergunta:** O hash "cassete:musica/…" em `semOrigem` nao e um hash de verdade —
como o consumidor do relatorio trata isso?

**Resposta:** E o nivel de falha CERTO para um cassete ilegivel: o ∅-crit da W4
rejeita o cassete inteiro antes de o relatorio poder enumerar os assets dele, e
silenciar a rejeicao seria pular o problema em verde. O papel `cassete-<estagio>`
nomeia onde o bloqueio esta, e a guarda da W4 (`lerCassete`) ja nomeia o asset
dentro da mensagem. Nenhum consumidor trata isso como endereco de conteudo.

**Pergunta:** E se o F3-05 usar o hash do audio-fonte para a emenda, contra o
contrato C3?

**Resposta:** O relatorio reporta o que o manifesto resolvido referenciar — se a
emenda nao existir como hash proprio, nao ha marcador e a cadeia nao aparece. O
∅-crit do F3-05 persegue exatamente esse falso-verde (contrato-w7 §4/§6), e o
AB-617 registra a disciplina da regeneracao. O handoff do F5-06 nomeia isso para o
F5-01 (consumidor do hash novo).

## O que este ADR NAO decide / explicitamente fora de escopo

- **Nao define o dossie de revisao** — isso e o F6-01 (W10), que CONSUME este
  relatorio (consumidor nomeado no handoff).
- **Nao decide o que o gate de publicacao faz alem de bloquear** — o F5-06 bloqueia
  ou libera; a politica de publicacao e do F5-07/F6-01.
- **Nao altera o store, os cassetes nem o schema** — consome, nunca edita (S-4, S-8).
- **Nao decide quando o AB-950 dispara** — isso e declaracao do dono, por definicao
  do ADR-0003; este relatorio e a ferramenta da reavaliacao, nao o detector.
