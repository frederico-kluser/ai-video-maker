# Contrato da W8 — pos-processamento de entrega e cache de render por conteudo

Commit `PREP-w8`. Publicado **antes** de qualquer worktree da W8 existir,
pela mesma razao dos contratos-w6/w7: uma worktree materializa apenas o que
esta commitado, e a divergencia aparece no merge como trabalho a refazer.

Dois cards rodam esta onda em paralelo. **Nenhum enxerga o outro.** Tudo
que eles precisam em comum esta neste arquivo e nos ADRs pre-alocados de
`docs/adr/` (numeros 0040 e 0041, livres, por ordem de merge — ver §5).

**O que este PREP NAO entrega fora dos cards:** nenhum stub. Nenhum
arquivo de `src/entrega/pos/**` nem `src/render/cache/**` existe em disco —
cada card cria os seus no primeiro commit. Receitas do justfile (§6) sao
criadas pelos cards, nunca pelo PREP (regra da W5/W7: stub que o gate
rodasse deixaria o PREP vermelho).

---

## 1. Mapa arquivo -> dono

A segunda coluna e o que da contratualidade. Sem ela, isto e uma sugestao.

| Arquivo / diretorio | Dono | Os outros |
|---|---|---|
| `src/entrega/pos/**` | F5-03 | nao editam |
| `src/render/cache/**` | F5-09 | nao editam |

### Compartilhados nesta onda — so acrescente

- `docs/adr/` — **um arquivo novo por card** com o numero pre-alocado (§5),
  nunca edite o de outro.
- `ledger/inbox/<CARD>.json` — um por card, por construcao (a W8 abre na
  faixa 770..799, §5).
- `justfile` — bloco proprio no fim do arquivo, delimitado por
  `# === <CARD> ===` … `# === fim <CARD> ===`. Nunca edite receita alheia.
  **As receitas da W8 (§6) sao criadas pelos cards; o PREP nao criou
  stubs.**

**Nada mais e compartilhado.** Os singletons seguem proibidos: S-5
(`src/design/tokens.ts`), S-4 (`schema/manifesto.schema.json`), S-1
(`package.json` + lockfile) e S-3 (`src/Root.tsx`). Precisa de um deles?
Para, nao faz, e escreve no handoff.

### Dependencia lateral e proibida por construcao

Precisou de algo entregue por outro card **desta mesma onda**? Isso e
dependencia lateral. Pare, entregue o que da, e **nomeie a diferenca no
handoff**. O consumo permitido e apenas dos contratos FECHADOS das ondas
anteriores — mix de F3-05 (W7), perfis de encode de F5-02 (W7), legendas de
F3-02 (W6, ADR-0027), pipeline de F5-01 (W7) — e deste PREP.

---

## 2. C1 — Emendas do F5-03 (loudness e sidecar)

O PROGRAMA.html declara as dependencias originais (F3-05, F0-04); abaixo,
o que a W8 ACRESCENTA. Onde o texto do PROGRAMA divergir, vale este
contrato.

- **F5-03 ganha a dep declarada F5-02** (alem de F3-05 e F0-04): o encode
  de audio do master para a conferencia de *true peak* DEPOIS da
  codificacao usa os perfis de encode do F5-02 — e so perfis
  `deterministico: true` participam da comparacao. A fila de encode usada
  e **INJETADA** (instancia propria do card), nunca a compartilhada:
  o AB-705 registra que o dono da fila compartilhada e o F5-07 (W9).
- **F5-03 ganha a dep declarada F3-02** (legendas, explicita): a queimada
  e o sidecar nascem do MESMO documento — ver ∅-crit (a) e (b).

### ∅-crits complementares do F5-03

- **(a) Sidecar SRT do MESMO documento.** O sidecar e serializado do
  documento `LegendasCanonicas.1` lido via `lerLegendas(bytes, contexto)`
  (ADR-0027 — o consumidor F5-03 le por `lerLegendas`, e o `serializeSrt`
  do Remotion fabrica `timestampMs` e nao e round-trip limpo; o SRT so e
  fabricado no ponto de consumo). Mutacao: um intervalo do sidecar
  divergindo do golden `fixtures/canonico/legendas-canono.json` fica
  VERMELHO.
- **(b) CASO C1 — divergencia legitima de FIM.** Na fixture canonica,
  c-004 tem janela visual de 4 s e fala de 8,505 s: a legenda queimada
  existe so dentro da janela visual, e o sidecar descreve a fala INTEIRA
  ate 22,738 s (ADR-0027, AB-583; o mesmo caso que a W7 resolveu no mix,
  contrato-w7 §2). O gate assere **coerencia de `inicio_s` ONDE a queimada
  existe** — nunca igualdade de duracao total entre sidecar e queimada.
  Asserir duracao total igual seria o falso-verde que este contrato existe
  para impedir: o lado que descreve a fala inteira e o lado que descreve a
  janela visual divergem por CONSTRUCAO.
- **(c) True peak no CODIFICADO.** O *true peak* e conferido no entregavel
  CODIFICADO, decodificado de volta — nunca so no PCM pre-encode (pergunta
  adversarial (2) do card). Tolerancia de medicao ±0,3 LU e margem de
  overshoot de codec (AAC) **declaradas no ADR-0040**. O gate do pos e
  deterministico em VEREDITO (medida de loudness), nunca em bytes do
  entregavel — o encoder de entrega muda e bytes nao sao oraculo
  (AB-396/397, ADR-0035).

### Pin obrigatorio do pos

O documento do pos registra as versoes pinadas (ffmpeg 6.1.1 + node) e a
receita `just pos` **falha se a versao corrente divergir do pin** — o
padrao `MixDocument.ferramentas` do F3-05 (W7): o determinismo entre
versoes de ferramenta e declarado por pin, nunca assumido. Bump de versao
invalida o documento e exige re-verificacao.

---

## 3. C2 — Emendas do F5-09 (cache por conteudo)

- **Chave do cache (C7) — cinco componentes obrigatorios:**
  1. `H(manifesto resolvido)` — hash do manifesto resolvido que o render
     consome;
  2. `H(assets)` — re-hash dos BYTES dos assets referenciados (a chave
     nunca confia no hash declarado no manifesto: o conteudo do store de
     F0-07 e enderecado por conteudo, mas o que entra na chave e o hash
     dos bytes que serao lidos);
  3. `H(tokens consumidos)` — o cache **importa os valores de S-5 que o
     render consome por leitura e os hasheia** (`src/design/tokens.ts` —
     leitura, nunca edicao): mudar um token de design tem de invalidar o
     cache (∅-crit do PROGRAMA);
  4. `H(versao do codigo / compositor / navegador)` — a versao do
     compositor e a do navegador entram na chave (pergunta adversarial
     (1) do card);
  5. `pin das ferramentas` — versoes pinadas (node, ffmpeg) na chave,
     mesmo padrao do §2.
- **NUNCA entram na chave:** data/hora, `memTotal` (AB-684 — a leitura em
  runtime do orcamento muda a concurrency, nao o conteudo da saida; a
  justificativa completa esta no ADR-0041), numero de workers, plano de
  faixas, porta TCP, env de agendamento. Qualquer um desses na chave faz
  o cache mentir: dois renders do MESMO conteudo divergindo por ambiente
  e o falso-verde do card.
- **Cache de bytes delimitado por codec.** O cache de bytes de frame so
  existe onde a comparacao byte a byte vale: consume
  `CODIFICADORES_DA_COMPARACAO` de `src/render/pipeline/codificacoes.ts`
  (F5-01, W7) — png/qtrle so. vp9/webm e mp4/h264 **nunca** viram cache de
  bytes, exclusao declarada com o motivo (AB-396: vp9 nao-determinista;
  AB-397: vp9 sai `yuv420p` sem alfa; MP4: encoder muda — ADR-0035).
- **Perfis `deterministico: false` nunca viram cache de bytes** — NVENC
  (AB-700, ADR-0036 decisao 3): sem garantia, sem golden, sem cache de
  bytes. Cache de metadado/derivado pode existir; cache de bytes do
  frame nao.
- **Unidade: FRAME por indice absoluto (AB-691)**, nunca a faixa. O
  parser de nomes extrai o indice do nome (`frame-[frame].png`), robusto
  a padding entre faixas de tamanhos diferentes.
- **Sonda de cache-miss obrigatoria.** Um ∅-crit com cache QUENTE nao
  prova render — acertar a chave e nao re-renderizar mascara um worker
  morto (AB-685, pergunta adversarial 3 do F5-01). O gate do F5-09:
  - forca o MISS (chave fria), re-renderiza e compara contra o render
    sem cache — o cache acertando pelo motivo errado tem de ser
    detectavel;
  - mutacao: token de design MUDADO com cache quente fica VERMELHO (o
    ∅-crit do PROGRAMA, exercitado com o cache cheio).

---

## 4. Ordem de merge da W8

**F5-03 → F5-09**

Motivo: o F5-03 (pos) e o card de caminho critico (marcado no PROGRAMA) e
nao consome artefato nenhum do F5-09; o F5-09 (cache) fecha a onda por
ultimo porque e o ponto em que a delimitacao de codec do pipeline (F5-01)
vira contrato consumido — com ele por ultimo, um gate vermelho apos o
merge nomeia o card certo.

Gate completo apos **cada** merge — nunca ao fim da onda. A bisseccao e o
produto, nao a limpeza.

---

## 5. Faixas de id, ADRs e portas

Faixas de id do ledger. **Ids nunca sao reciclados** — o numero e citado
no codigo. Um card que esgotar a faixa para e pede faixa nova; nao invade
a do vizinho.

| Card | Faixa | ADR | Porta |
|---|---|---|---|
| F5-03 | 770..789 | 0040 | 4503 |
| F5-09 | 790..799 | 0041 | 4509 |

`docs/adr/` tem `0001`..`0041` unicos em disco: `0033` esta alocado ao
I-04 (W9.5, ainda nao escrito); `0040` e `0041` estavam livres e sao
escritos por este PREP — conferido neste PREP. O numero de um card nao
pode ser tomado por outro; os ADRs da W8 ja existem no commit do PREP e
os cards NAO os reescrevem (leitura, nunca edicao).

As portas seguem a numeracao das W5/W6/W7 (43xx audio/sincronia, 45xx
render/entrega): F5-03 = 4503, F5-09 = 4509 (4503 e 4509 estavam livres
— a W7 usou 4501/4502/4504/4505/4506 e 4305).

---

## 6. Receitas pre-registradas (NENHUM stub no justfile)

As receitas abaixo entram no justfile nos blocos dos respectivos cards. O
PREP **nao cria stubs** — uma receita vazia que o gate rodasse deixaria o
PREP vermelho (regra da W5 mantida). Quem as cria: o proprio card, no seu
commit, com corpo que falha por ausencia ate a implementacao existir.

| Receita prevista | Card | O que faz (a definir pelo card) |
|---|---|---|
| `pos` | F5-03 | gate do pos (∅-crits: entregavel fora do alvo de LUFS bloqueia; sidecar divergindo do golden; pin de ferramentas divergindo — todos VERMELHO) |
| `render-cache` | F5-09 | gate do cache por conteudo (∅-crits: token mudado com cache quente; cache quente nao prova render — sonda de miss — todos VERMELHO) |

Convencao de nomes: **hifen, nunca `:`** — o PROGRAMA.html escreve
`just render:cache`, mas o `just` 1.42 le `a:b:` como "receita a depende
de b" e o parse morre (armadilha 9.1, ja tratada no arquivo inteiro).
Vale `render-cache`.

---

## 7. A pergunta obrigatoria desta onda

Dois cards tocam a MESMA familia de caminhos (`src/entrega/**` para o
F5-03, `src/render/**` para o F5-09) e consomem os MESMOS insumos ja
mergeados. O git nao vai ter em que conflitar — e por isso vai **mergear
em silencio codigo que discorda**.

Antes de fechar o handoff, cada agente responde:

> Existe alguma assercao neste diff sobre a **LISTA COMPLETA** de alguma
> coisa? Se sim, ela e verdade contra a sua base e pode ser **falsa depois
> do merge do irmao**. Reescreva como assercao sobre a **presenca do SEU
> item**, nunca sobre a ausencia dos outros.

Concretamente, nesta onda:

- **F5-03:** nao asserte **lista fechada de intervalos** de legenda nem
  **igualdade total** sidecar x queimada (a c-004 prova que os dois
  divergem por construcao — §2, ∅-crit (b)). Asserte a presenca e a
  coerencia: "o `inicio_s` da fala de c-004 coincide onde a queimada
  existe" — o MESMO numero nos dois, derivado do MESMO documento.
- **F5-09:** nao asserte **lista fechada de codecs cacheaveis** —
  `CODIFICADORES_DA_COMPARACAO` (F5-01) pode crescer. Asserte a presenca:
  "o codec X esta declarado cacheavel / excluido com motivo" — nunca "os
  codecs cacheaveis sao exatamente estes N".

---

## 8. Roteamento de ABs sem acao na W8

Itens de ledger que esta onda NAO fecha — para onde vao, para que o dono
nao os reabra por engano:

| AB | O que e | Roteamento |
|---|---|---|
| AB-705 | Fila explicita de encode: dono da fila compartilhada entre pipeline e orquestrador | **F5-07 (W9)** — o F5-03 usa fila INJETADA (§2); a instancia unica no processo e decisao de composicao do F5-07 |
| AB-720 / AB-721 / AB-722 | Reflow vertical 9:16 do canonico, marcador de midia e vinheta/grade fora do retangulo 9:16 provisional | **F5-07 (W9)** + revisao de tokens — o 9:16 e provisional e a revisao das zonas e do dono de tokens (F0-04) |
| AB-723 | Pesquisa 2026: zonas de UI das plataformas de video vertical sobre 1080x1920 | **dono de tokens** — a pesquisa alimenta a decisao do token, nao a substitui (regra da W7, contrato-w7 §6) |
| AB-735 / AB-736 / AB-741 | Escala de saida e piso de legibilidade do thumbnail; thumbnail vertical nao coberto | **F5-07 (W9) / tokens** — escala e piso sao constantes do modulo de thumbnail; o vertical depende da revisao de tokens do AB-720..723 |
| AB-685 | Worker morto derruba o pipeline — sonda por composicao inexistente nao cobre morte no meio | **F5-07 (W9)** — a sonda de cache-miss do F5-09 (C2) e uma camada a mais; a politica de retomada e do orquestrador |
| AB-746 / AB-747 / AB-748 / AB-749 | Procedencia: gaps de data, asset de terceiro dentro de cena, suficiencia sob AB-950, origem do manifesto | **F6-01 (W10)** — revisao humana; nenhum card da W8 toca `src/entrega/procedencia/**` |
| AB-684 | `memTotal` em runtime difere da referencia do I-03 — orcamento deriva o limite em runtime | **sem acao W8** — registrada no ADR-0041 (decisao: fora da chave do cache, com justificativa); o gate imprime os numeros a cada execucao (tripwire visivel) |
