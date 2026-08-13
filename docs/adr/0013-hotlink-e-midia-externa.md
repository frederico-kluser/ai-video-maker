# ADR-0013: Midia externa — politica de hotlink e a decisao que precede o downloader

**Status:** ACEITO
**Data:** 2026-08-13 (termos consultados em 2026-08-11 e re-verificados em 2026-08-13)
**Card:** `F2-04` (W4) — estagio de resolucao `midia`
**Depende de:** ADR-0007 (contrato de estagio e cassete), ADR-0003 (enquadramento de uso pessoal)
**Consumida por:** `F2-07` (W5, suite offline), composicao (W5+), `F5-06` (relatorio de procedencia)

**Guardas executaveis:**

```sh
npx tsx src/resolucao/midia/relatorio.ts          # imprime a decisao + evidencia; sai 1 se violada
bash tools/resolucao/offline.sh --estagio midia   # suite com a rede bloqueada de verdade
npx tsx tools/resolucao/chave.ts --estagio midia  # um parametro por vez, cache miss em cada (C12)
rg --files-without-match '"licenca"' fixtures/cassetes/midia/**/procedencia.json  # ∅-crit
```

## Contexto

O card F2-04 comeca com um conflito de termos de uso que nao admite
conciliacao:

- **Unsplash EXIGE hotlink.** Os API Terms, secao 6 (Image Interaction
  Data): *"you must directly use or embed the related image URLs returned
  by the API in your Developer Apps (generally referred to as
  'hotlinking') in accordance with the API Guidelines"*, e *"Failure to do
  any of the foregoing in this Section 6 will constitute a material
  breach of these API Terms."* A documentacao reforca: *"Unlike most
  APIs, we require the image URLs returned by the API to be directly used
  or embedded in your applications."* A obrigacao esta no **contrato de
  API** — vale para qualquer uso, pessoal ou comercial.
- **GIPHY EXIGE hotlink.** Os docs da API: *"GIPHY media should be loaded
  directly from the media URLs returned by the API and should not be
  cached, proxied, rewritten, or stored by the partner."* Alem da
  atribuicao visivel *"Powered By GIPHY"*.
- **Pixabay PROIBE hotlink.** Os docs da API, secao Hotlinking: *"Returned
  image URLs may be used for temporarily displaying search results.
  However, permanent hotlinking of images (using Pixabay URLs in your
  app) is not allowed. If you intend to use the images, please download
  them to your server first."* Para video o mesmo documento diz o
  contrario: *"Videos may be embedded directly in your applications. Yet,
  we recommend storing them on your server."* — e o mesmo documento exige
  **cache de 24 h** nas respostas.
- **Pexels e SILENTE.** Busca negativa nos docs da API e nos termos
  (2026-08-11, re-verificada 2026-08-13): nenhuma ocorrencia de
  hotlink, framing, embedding ou caching. Silencio apurado por busca
  negativa nao e prova de ausencia (C11) — esta rotulado como tal.
- **Wikimedia Commons DESENCORAJA.** "Commons:Reusing content outside
  Wikimedia": *"Directly using a Commons file via embedding its URL
  ('hotlinking') is also possible, but is not recommended."*

As duas regras — "voce DEVE servir do meu servidor" (Unsplash, GIPHY) e
"voce NAO PODE servir do meu servidor" (Pixabay) — **nao coexistem numa
politica unica de aquisicao**. A decisao e anterior ao downloader por
construcao: ela decide se o downloader existe.

## Decisao

### D1 — Baixar e re-hospedar por hash. Hotlink nunca.

Todo asset de midia externa e baixado uma vez, na gravacao do cassete, e
passa a viver no pipeline enderecado por SHA-256 dos bytes. Em runtime o
render nunca fala com o provedor — nao ha URL viva no manifesto
resolvido, em nenhuma profundidade (schema, `$defs.SemURLProfundo`).

### D2 — Provedor que EXIGE hotlink e INELEGIVEL — por arquitetura, nao por licenca.

`politicaHotlink: "exige"` exclui o provedor. A razao nao e juridica (a
licenca de conteudo poderia permitir, como mostra a ressalva do
Unsplash: a Unsplash License dispensa atribuicao mas as API Guidelines a
exigem — a obrigacao vem do contrato de API, e **uso pessoal nao
isenta**; o ADR-0003 mudou o que a LICENCA permite, nao o que o
CONTRATO DE API exige). A razao e que este pipeline nao consegue
hotlinkar sem quebrar tres invariantes:

1. **C7 / schema** — nenhuma URL atravessa a fronteira de determinismo.
   Um asset hotlinkado E uma URL viva no momento do render.
2. **Enderecamento por conteudo** — o pipeline referencia asset por
   SHA-256 dos bytes. Nao se hasheia o que nao se tem.
3. **Render offline** — `res-offline` fecha a rede no kernel. Um asset
   hotlinkado faria o render depender de um terceiro vivo, e o teste
   "render 2x, bytes identicos" passaria a medir o servidor alheio.

### D3 — A barreira e a AUSENCIA de adaptador, nao um `if`.

Provedor com `politicaHotlink: "exige"` nao tem adaptador implementado
(`ADAPTADORES` em `src/resolucao/midia/adaptadores.ts`). A checagem
`exigirProvedorElegivel` existe para dar diagnostico; a barreira e que
nao existe codigo capaz de baixar do provedor inelegivel. Um `if` some
quando alguem apaga o `if`; a ausencia do adaptador exige escrever o
adaptador para desaparecer. A invariante ("todo provedor que exige
hotlink nao tem adaptador") e verificada por teste sobre a tabela
inteira — universal, nunca sobre a lista fechada.

### D4 — Provedor elegivel implementado: Wikimedia Commons.

`desencoraja` e `silente` sao elegiveis: nenhum dos dois obriga a servir
do servidor do provedor, que e a unica coisa que este pipeline nao
consegue fazer. O Commons e o implementado, por tres razoes em ordem de
peso: (1) a politica do site recomenda exatamente o que este pipeline
faz — baixar e re-hospedar; (2) a Action API e publica, **sem
credencial** — a pergunta adversarial "o cassete contem alguma
credencial?" e respondivel por construcao; (3) a licenca e POR ARQUIVO e
vem na propria resposta — o adaptador le a licenca de cada candidato, e
arquivo com licenca nao reconhecida e descartado, nunca assumido.

## A evidencia, por provedor (termos consultados em 2026-08-11, re-verificados em 2026-08-13)

| Provedor | Hotlink | Fonte | Teto de requisicoes | Obrigacao de cache | Credencial |
|---|---|---|---|---|---|
| Unsplash | EXIGE | contrato-de-api (api-terms, sec. 6) | demo 50 req/h; producao 1000 req/h | nao se aplica (hotlink obrigatorio) | sim |
| GIPHY | EXIGE | contrato-de-api (developers.giphy.com/docs/api) | 100 req/h (chave beta) | PROIBIDO cachear/armazenar | sim |
| Pixabay | PROIBE | contrato-de-api (pixabay.com/api/docs, sec. Hotlinking) | 100 req/60 s | OBRIGATORIO cachear respostas por 24 h | sim |
| Pexels | SILENTE (busca negativa) | docs da API + ToS | 200 req/h; 20.000/mes | nao mencionado | sim |
| Wikimedia Commons | DESENCORAJA | politica-do-site (Commons:Reusing content outside Wikimedia) | sem teto duro em leitura ("be considerate"); header real observado: `x-ratelimit-limit: 10000;w=1` (cassete, 2026-08-11) | nao mencionado | nao |

A citacao literal de cada provedor vive em `src/resolucao/midia/politicas.ts`
— o relatorio `npx tsx src/resolucao/midia/relatorio.ts` imprime todas
com data de consulta a cada execucao do gate. A tabela acima e o resumo;
a citacao e a evidencia, e a evidencia nunca e parafrase.

## Alternativas consideradas e descartadas

### Alternativa A: "Hotlink para quem exige, download para quem proibe"

**Descartada.** O downloader existiria sob duas politicas ao mesmo
tempo, e a saida do estagio (uma URL no parcial) quebraria o schema na
metade dos caminhos. A pergunta do card e exatamente esta: as duas
regras nao coexistem, e a escolha e uma so, antes do codigo.

### Alternativa B: "Unsplash com hotlink, com a URL na procedencia"

**Descartada.** A URL viva nao "vive acima da fronteira" so porque esta
na procedencia: ela existiria no render se a composicao a consumisse, e
mesmo parada ela e um compromisso que o pipeline nao tem como honrar
offline. Alem disso o cassete nao poderia conter o asset (nao ha bytes),
o que quebraria o contrato de cassete do ADR-0007 (D4: cassete
auto-contido).

### Alternativa C: "Nenhum provedor externo; so assets proprios"

**Descartada.** E a saida de um card futuro (biblioteca propria), nao a
deste. Este card resolve o que fazer QUANDO o manifesto pede midia
externa, e o Commons e a resposta que satisfaz os termos de todos os
lados.

### Alternativa D: "Esperar o enquadramento juridico amadurecer"

**Descartada.** O ADR-0003 ja decidiu o enquadramento (uso pessoal) e a
obrigacao de hotlink nao depende dele. A decisao de F2-04 e arquitetural
e tecnica; nao ha pergunta ao dono pendente.

## Consequencias

### Positivas

1. **O downloader existe sob UMA politica**, e a politica esta escrita
   antes dele — o codigo cita o ADR, e o ADR cita os termos com data.
2. **O cassete e sosia, nao sucessor**: a resposta do Commons e gravada
   como veio (HTML no Artist, `"true"` como string, candidato sem
   licenca), e a normalizacao roda no ESTAGIO, e portanto no replay.
3. **Zero credencial em jogo** no provedor implementado: a Action API e
   publica, nao ha chave para vazar nem header para redigir.
4. **A exclusao do Unsplash e da GIPHY e arquitetural e documentada**,
   independente do enquadramento de uso — vale mesmo que o ADR-0003 D3
   (preterir GIPHY) mude.

### Custos e desvios registrados

1. **O numero deste ADR e 0008, nao 0007.** O 0007 esta reservado no
   PROGRAMA para o card `I-04` (politica editorial / canal). A
   referencia cruzada do ADR-0003 (§ "O que este ADR NAO decide") marca
   `I-04` como ADR-0007; tomar o numero causaria colisao quando I-04
   rodar.
2. **`video` nao e suportado pelo adaptador do Commons neste card**
   (ledger AB-434): o caminho existiria, mas nao foi exercitado contra o
   provedor, e "suportado mas nunca rodado" e a forma mais cara de
   mentira nesta base.
3. **A regravacao do cassete pode mudar os bytes sem bump de versao**
   (ledger AB-439): a busca do Commons devolve um ranking que muda com o
   tempo. O determinismo e POR cassete (regravar e diffar), nao entre
   cassetes.
4. **O enquadramento de uso pessoal continua declarado como condicao**
   (ADR-0003, AB-950): a procedencia do cassete registra "AB-950
   continua fechado". A mudanca de escopo nao passa despercebida.
5. **A prova de determinismo do estagio e feita A PARTIR do cassete, nao
   contra a rede real** (ledger AB-440, mesma classe do AB-473 do irmao
   musica). A perna original encadeada em `res-midia` era vacua (C2): o
   `regravar-e-diffar` usava um manifesto sem nenhum no de midia e o
   estagio nao fazia chamada nenhuma. A perna nova —
   `tools/midia/verificar.ts`, fase 6 — regrava duas vezes com o
   `fetchReal` substituido pelo reprodutor do proprio cassete e relogios
   diferentes, roda as chamadas REAIS do cassete (2 buscas + 2 downloads
   de binario por gravacao, contadas e nomeadas), exige 0 refutacoes e
   tem sonda negativa (mutar `resultado.json` deixa o diff VERMELHO).
   Por que nao regravar contra o provedor vivo: o revisor gravou o
   cassete duas vezes contra a rede real e diffeu 22-25 refutacoes por
   duas causas independentes — headers volateis do fornecedor (`date`,
   `age`, `server`, `x-request-id`, `server-timing`, `x-search-id`,
   `x-cache`, `x-cache-status`, `content-length`, `transfer-encoding`)
   que entram crus em `chamadas.json` e nao sao cobertos pela whitelist
   `CAMPOS_VOLATEIS`, e o corpo da busca, cujo ranking nao e estavel nem
   dentro do mesmo segundo (hashCorpo 8883742a… -> 25c8700d…). A decisao
   sobre a whitelist de headers volateis (ou a redacao na gravacao) e do
   join F2-07, na W5 — item AB-440 no ledger.

## Revisao adversarial

**Pergunta:** "Uso pessoal" (ADR-0003) nao torna o hotlink do Unsplash
aceitavel? Ele e obrigatorio so para uso comercial?

**Resposta:** Nao. A obrigacao de hotlink do Unsplash e da GIPHY nao
esta na licenca de conteudo — esta no CONTRATO DE API, que vale para
qualquer uso. O ADR-0003 D3 preteriu a GIPHY por razoes tecnicas e de
clareza juridica; aqui a exclusao e de outra natureza (arquitetural) e
vale mesmo que D3 mude. O que o uso pessoal muda e a LICENCA de
conteudo — e ela nao e o problema deste card.

**Pergunta:** Um provedor "silente" (Pexels) pode ser considerado
elegivel so porque a busca nao achou a palavra "hotlink"?

**Resposta:** Elegivel sim, mas com o rotulo de evidencia fraca (C11):
busca negativa nao e prova de ausencia. A tabela marca `silente` como
categoria separada de `desencoraja`, e o item de ledger AB-438 exige
re-verificacao antes de o Pexels virar provedor primario. Ele nao tem
adaptador neste card.

**Pergunta:** O cassete contem alguma credencial?

**Resposta:** Nao ha credencial neste estagio por construcao: o provedor
implementado (Commons) tem `exigeCredencial: false`, e a Action API e
publica. O teste varre todos os arquivos do cassete com o detector do
gravador (com sonda negativa do proprio detector) e exige zero achados.

**Pergunta:** O estagio chama a rede quando o cache acerta?

**Resposta:** Nao, e isso e testado com a rede bloqueada e o cache
quente: o orquestrador em modo offline reproduz o cassete sem invocar
`resolver()`, e o teste usa um `resolver()` espiao que LANCARIA se
chamado, com o contador de tentativas de saida do guarda como
denominador.

**Pergunta:** A chave de cache inclui a versao do estagio e a decisao de
hotlink?

**Resposta:** Sim. `versaoEstagio` e componente da chave (teste exige
cache miss ao bumpar), e `modoDeAquisicao: "baixar-e-rehospedar"` e um
parametro declarado — a introducao de qualquer outro modo de aquisicao
(hotlink, proxy, embed) e cache miss por construcao, em vez de
reaproveitar cassetes gravados sob a decisao antiga.

**Pergunta:** Os termos mudam; quem re-verifica as citacoes?

**Resposta:** Ninguem automaticamente — e isto e declarado (ledger
AB-437). Cada citacao traz o documento e a data de consulta, o relatorio
imprime a data a cada gate, e a regravacao manual do cassete (o unico
momento em que o estagio fala com o provedor) e o ponto natural de
re-leitura do termo.

**Pergunta:** O gate de determinismo do card (`res-midia`) prova mesmo
que o estagio e deterministico?

**Resposta:** Hoje sim, e antes provava por vacuidade (C2). A perna
antiga (`regravar-e-diffar --estagio midia`) usava um manifesto fixo sem
nenhum no de midia: o estagio nao fazia chamada nenhuma e o verde nao
media nada. A perna nova (`tools/midia/verificar.ts`, fase 6) regrava o
estagio A PARTIR do cassete — com o `fetchReal` substituido pelo
reprodutor do proprio cassete e relogios diferentes — e exige zero
refutacoes. Regravar contra a rede real nao e usado de proposito: o
revisor gravou duas vezes contra o provedor vivo e diffeu 22-25
refutacoes por volatilidade do fornecedor (headers `date`/`age`/
`x-request-id`/`x-cache` crus em `chamadas.json`, fora de
`CAMPOS_VOLATEIS`; ranking da busca instavel ate dentro do mesmo
segundo), nao por defeito do estagio. A perna conta e nomeia as chamadas
reais regravadas (2 buscas + 2 downloads por gravacao) e tem sonda
negativa: mutar `resultado.json` deixa o diff VERMELHO. A whitelist de
headers volateis e decidida pelo join F2-07, na W5 (ledger AB-440).

## O que este ADR NAO decide

- **Nao decide o provedor primario do produto final** (biblioteca
  propria, GIPHY reavaliada, Pexels) — decide o que o estagio `midia`
  faz hoje: buscar no Commons, baixar e re-hospedar por hash.
- **Nao decide canal ou politica editorial** — e `I-04` (ADR-0007).
- **Nao decide o tamanho maximo de cassete** — e o ledger AB-280/283,
  com saida desenhada (corpos para o store).
- **Nao reabre o enquadramento de uso** (ADR-0003): este ADR depende
  dele apenas para declarar a condicao de escopo; as obrigacoes de API
  valem em qualquer enquadramento.

## Condicao de escopo

As citacoes deste ADR sao verdadeiras na data de consulta declarada
(2026-08-11, re-verificadas 2026-08-13) e envelhecem com o documento
citado. Se os termos de um provedor mudarem, a entrada de
`POLITICAS_DE_PROVEDOR` muda — a estrutura da decisao (D1..D4) nao: ela
nao depende de nenhum termo especifico, so da classificacao "exige /
proibe / desencoraja / silente", que e o que o termo declara.

O enquadramento de uso pessoal (ADR-0003) permanece condicao deste
programa; a procedencia declara "AB-950 continua fechado" a cada
gravacao de cassete.
