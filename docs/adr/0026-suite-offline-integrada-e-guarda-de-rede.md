# ADR-0026: Suite offline integrada e o guarda de rede (F2-07)

**Status:** ACEITO
**Data:** 2026-08-13
**Card:** `F2-07` (W5) — Suite offline de resolucao e o guarda de rede
**Depende de:** ADR-0007 (contrato de estagio e cassete, F2-01), ADR-0008 (fontes locais),
ADR-0009 (grafico), ADR-0010 (timing de locucao), ADR-0011 (codigo), ADR-0012 (musica),
ADR-0013 (midia), `docs/contrato-w5.md` (§5 headers volateis, §8 numero pre-alocado)
**Consumida por:** `F4-04` (W6 — cassete de autoria e suite de rejeicao), `F5-01` (W7 —
pipeline de render), e todo card que precise provar "roda sem rede"

**Guardas executaveis:**

```sh
bash tools/offline-guard.sh                 # a suite integrada inteira, rede bloqueada
just res-offline-integrado                  # idem, pela receita
npx vitest run tests/integracao/resolucao/  # so a suite vitest de integracao
npx tsx tools/offline-guard.ts --verifica-cassetes   # tripwire de headers volateis
bash tools/resolucao/offline.sh             # receita F2-01 intacta (continua verde)
```

## Contexto

A W4 entregou os cinco estagios de resolucao (grafico, locucao, midia,
codigo, musica), cada um com cassete em `fixtures/cassetes/<nome>/<chave>/`
e um oraculo por estagio. O F2-07 junta os cinco com o orquestrador
(F2-01) e prova que o pipeline abaixo da autoria roda com a rede
bloqueada — em todas as camadas, com denominador, e com o ∅-crit de
estagio sem cassete no nivel de integracao.

Quatro problemas abertos pela W4 chegaram a este card, e as quatro
decisoes abaixo os fecham com evidencia medida no repositorio.

---

## D1 — AB-394: o guarda global NAO e enfraquecido; a evidencia de fontes renderiza em processo externo

**Problema (AB-394, alto):** o guarda global de rede
(`tests/setup/rede-bloqueada.ts`, `permitirLoopback: false`, instalado
por `vitest.config.ts` para a suite inteira) derrubava
`tests/design/font-resolve.test.ts` (F1-03): o `renderStill` do Remotion
abre um WebSocket CDP para o Chrome local em `127.0.0.1`.

**Decisao:** manter o guarda GLOBAL e com `permitirLoopback: false`, e
manter a producao da evidencia de fontes em PROCESSO EXTERNO
(`tools/fontes/render-evidencias.ts`, disparado por `execFileSync` pelo
teste). O guarda em processo nao alcanca subprocessos; a camada que
cobre filhos e o namespace do kernel (`unshare --net`), onde o loopback
e levantado de proposito e o render de fontes funciona.

**Evidencia:** o commit `2444d44` (onda 4.5) ja moveu o render para
processo externo. Verificado neste card, suite completa:
`npx vitest run` → 31 arquivos, 1755 testes verdes (base), incluindo
`font-resolve.test.ts` (33 testes, evidencia produzida em subprocesso).
A suite de integracao deste card prova o outro lado: `redeBloqueada()
=== true` dentro de `tests/integracao/resolucao/` — ou seja, o guarda
esta ativo fora de `tests/resolucao/` — e o LOOPBACK tambem morre com
`REDE BLOQUEADA` (o guarda nao foi aberto para acomodar o vizinho).

---

## D2 — AB-440/AB-473: headers volateis sao REMOVIDOS NA GRAVACAO, nunca whitelisted no diff

**Problema (AB-440, AB-473):** headers volateis do fornecedor
(`date`, `age`, `server`, `x-request-id`, `server-timing`,
`x-search-id`, `x-cache`, `x-cache-status`, `content-length`,
`transfer-encoding`) entravam crus em `chamadas.json` e refutavam o
diff de determinismo do estagio sem nenhum defeito dele — `CAMPOS_VOLATEIS`
so cobria `volatil.json#/*` e `procedencia.json#/adquiridoEm`.

**Decisao:** redigir na gravacao — os headers da lista
`HEADERS_VOLATEIS` (novo, em `src/resolucao/cassete/formato.ts`) sao
REMOVIDOS dos `headersResposta` de cada chamada, no `GravadorDeChamadas`
(`src/resolucao/cassete/gravador.ts`), depois da sanitizacao de
credenciais. NAO ampliar `CAMPOS_VOLATEIS`: um header volatil que
ESCAPE da lista tem de deixar o diff VERMELHO — e a sonda negativa da
suite de integracao fabrica um (`x-novo-volatil`) e EXIGE a refutacao.

**Evidencia (amostras reais, 2026-08-13):** `chamadas.json` de
`midia/70696a63…` e `musica/440eeb9e…` carregavam os 10 headers da
classe AB-440/473 crus. A lista tambem inclui `x-ratelimit-remaining` e
`x-ratelimit-reset` (Wikimedia os devolve em toda resposta; sao
contadores de janela que descem a cada requisicao do mesmo bucket —
medidos no cassete de musica).

**Consequencia para cassetes ja commitados:** migracao idempotente em
`tools/offline-guard.ts --redige-cassetes`, executada neste card nos
tres cassetes afetados (locucao, midia, musica): 110 headers removidos,
corpos e hashes intactos. `--verifica-cassetes` e o tripwire permanente.

**Por que remover e nao marcar `[REDIGIDO]`:** a lista existe para
dizer "isto muda entre gravacoes e nao deve entrar no diff"; marcar
preservaria o ruido no arquivo versionado sem ganho de auditoria.

---

## D3 — AB-475: `x-client-ip` e PII — removido na gravacao, migrado do historico da arvore

**Problema (AB-475):** o Wikimedia devolve `x-client-ip` com o endereco
de quem fez a requisicao. O cassete de midia carregava o IPv6 REAL da
maquina de gravacao: `2804:1b3:a940:dc57:91d3:f8eb:97:3916`.

**Decisao:** `x-client-ip` entra em `HEADERS_VOLATEIS` (removido na
gravacao como os demais). Um whitelist de volateis em `CAMPOS_VOLATEIS`
manteria a PII no repositorio para sempre — inaceitavel para dado
pessoal, independente de credencial.

**Evidencia:** cassete `midia/70696a63…/chamadas.json` chamada 0 (e o
cassete de musica, nas 6 chamadas). Apos a migracao, nenhum
`chamadas.json` commitado carrega `x-client-ip`.

**Exposicao residual (declarada):** o commit original da W4 contem os
bytes com o IPv6 no historico do git; remover da arvore nao reescreve o
historico. Mitigacao: o endereco e temporario/rotativo (ISP residencial)
e nenhuma chave de sessao foi gravada junto. A regra daqui em diante:
o gravador NAO grava esse header, e o tripwire derruba a suite se ele
aparecer de novo.

---

## D4 — AB-455: a ponte cassete->store, verificada pela suite integrada

**Problema (AB-455):** o contrato de estagio devolve `parcial` +
`procedencia` e mais nada; quem produz bytes resolve sozinho onde eles
moram. Na W4: codigo gravou em `<cassete>/artefatos/<sha>.json` (com
conferencia de hash na leitura, `src/resolucao/codigo/artefatos.ts`),
midia/musica/locucao em `<cassete>/corpos/<hash>` (corpos das chamadas).

**Decisao:** o canal formal (enderecamento por SHA-256 no
`diretorioTrabalho` → store F0-07) e VERIFICADO na suite integrada
(`tests/integracao/resolucao/resolucao-integrada.test.ts`, secao
"ponte cassete->store"): para cada asset de midia e musica, os bytes
existem em `corpos/<hash>`, rehasheiam para o endereco, entram e saem
do `Store` byte a byte com procedencia traduzida. Para codigo, os
artefatos em `artefatos/<hash>.json` idem.

**Caracterizacoes medidas (NAO consertadas — estagios sao de outros
cards, ver ledger AB-501/AB-503):**
- `grafico`: cassete metadata-only — os bytes do video renderizado NAO
  foram commitados (morreram no diretorio de trabalho da gravacao);
- `locucao`: os audios tem bytes (`corpos/`), mas os assets de TIMING
  (computados pelo estagio) nao tem bytes commitados.

---

## D5 — A W4 gravou contra TRES manifestos (AB-500)

**Decisao:** a suite integrada resolve cada estagio contra o manifesto
DELE: `fixtures/canonico/manifesto-valido.json` para locucao/codigo/
musica, `src/resolucao/grafico/manifesto-de-gravacao.ts` para grafico e
`fixtures/cassetes/midia/manifesto-de-gravacao.json` para midia. Um
run unico do orquestrador com um manifesto so cobre tres dos cinco
estagios; os outros dois rodam por `resolverEstagio`. O merge das cinco
parciais (um manifesto resolvido completo) e provado por
`fundirParciais` sem colisao. Assercoes per-item, nunca sobre listas
fechadas (contrato-w5 §10).

---

## D6 — O orquestrador descarta em silencio estagio fora da lista canonica (AB-502)

**Decisao:** caracterizar e registrar. `ordenarPelaCanonica`
(`src/resolucao/orquestrador.ts`, F2-01) filtra por `ORDEM_ESTAGIOS`:
um estagio com nome fora da lista e descartado SEM aviso e o
orquestrador resolve um manifesto vazio — verde por ausencia. O ∅-crit
de descoberta (`src/resolucao/descoberta.ts`) cobre o caminho do disco;
o chamador que monta o orquestrador a mao fica com o buraco. Nao e
conserto aqui (orquestrador e de F2-01): fica no ledger para o dono
lancar `EEstagioDesconhecido` em `ordenarPelaCanonica` (sugestao para a
W6). O ∅-crit de integracao deste card usa nome canonico de proposito.

---

## Consequencias

1. `HEADERS_VOLATEIS` e a superficie de erosao deste ADR, como
   `CAMPOS_VOLATEIS` e para o ADR-0007: cada entrada nova tem de caber
   num paragrafo de justificativa. A sonda negativa (header fora da
   lista → diff VERMELHO) e estrutural: a lista nao aparece em
   `CAMPOS_VOLATEIS`, entao qualquer vazamento refuta.
2. `tools/offline-guard.sh` e a suite canonica offline a partir da W5:
   quatro camadas (kernel unshare, subprocesso, processo, vitest
   completo), tripwire de porta de fuga, tripwire de headers volateis,
   ∅-crit de cobertura e denominador de cassetes/chamadas.
   `tools/resolucao/offline.sh` (F2-01) continua existindo e verde — a
   suite por estagio.
3. A suite integrada roda no gate da W5 pelo runner `test` (vitest
   inclui `tests/integracao/**`), com o guarda em processo ativo pelo
   setup global.
