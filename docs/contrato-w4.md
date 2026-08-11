# Contrato da W4 — a onda mais larga

Commit `PREP-w4`. Publicado **antes** de qualquer worktree da W4 existir, porque
uma worktree materializa apenas o que esta commitado: preparacao deixada no
checkout principal nao chega nos agentes, e a divergencia aparece no merge como
trabalho a refazer.

Treze agentes rodam esta onda em paralelo. **Nenhum enxerga os outros.** Tudo
que eles precisam em comum esta neste arquivo, em
`docs/contrato-estagio-resolucao.md` e em `docs/criterios-de-aceitacao-corrigidos.md`.

---

## 1. Mapa arquivo -> dono

A terceira coluna e o que da contratualidade. Sem ela, isto e uma sugestao.

**Os caminhos abaixo sao os que existem no disco.** O PROGRAMA escreve
`nos/Cabecalho.tsx` em maiuscula; F1-01 criou `nos/cabecalho.tsx` em minuscula,
com stub e `meta` ja preenchidos. Vale o disco: criar o arquivo em maiuscula
produziria **dois** componentes para o mesmo `tipo`, e o gate de unicidade de
F1-01 reprova exatamente isso.

| Arquivo / diretorio | Dono | Os outros |
|---|---|---|
| `src/composicao/nos/cabecalho.tsx` + `fixtures/snapshots/no-cabecalho/**` | F1-04 | nao editam |
| `src/composicao/nos/texto.tsx` + `fixtures/snapshots/no-texto/**` | F1-05 | nao editam |
| `src/composicao/nos/lista.tsx` + `fixtures/snapshots/no-lista/**` | F1-06 | nao editam |
| `src/composicao/nos/midia.tsx` + `fixtures/snapshots/no-midia/**` | F1-07 | nao editam |
| `src/composicao/nos/codigo.tsx` + `fixtures/snapshots/no-codigo/**` | F1-08 | nao editam |
| `src/composicao/nos/grafico.tsx` + `fixtures/snapshots/no-grafico/**` | F1-09 | nao editam |
| `src/composicao/transicoes/**` + `fixtures/snapshots/transicoes/**` | F1-10 | nao editam |
| `src/composicao/camadas/**` + `fixtures/snapshots/camadas/**` | F1-11 | nao editam |
| `src/resolucao/grafico/**` + `fixtures/cassetes/grafico/**` | F2-02 | nao editam |
| `src/resolucao/locucao/**` + `fixtures/cassetes/locucao/**` | F2-03 | nao editam |
| `src/resolucao/midia/**` + `fixtures/cassetes/midia/**` | F2-04 | nao editam |
| `src/resolucao/codigo/**` + `fixtures/cassetes/codigo/**` | F2-05 | nao editam |
| `src/resolucao/musica/**` + `fixtures/cassetes/musica/**` | F2-06 | nao editam |

Os seis arquivos de `nos/` **ja existem como stub**, escritos por F1-01 para
provar a fiacao da raiz. Substitua o corpo; **mantenha o `meta`** (`tipo`,
`schema`, `id`) como esta — a descoberta e o gate de unicidade dependem dele.

### Compartilhados nesta onda — so acrescente

- `docs/adr/` — **um arquivo novo por card**, nunca edite o de outro.
- `ledger/inbox/<CARD>.json` — um por card, por construcao.
- `justfile` — bloco proprio no fim do arquivo, delimitado por
  `# === <CARD> ===` … `# === fim <CARD> ===`. Nunca edite receita alheia.

**Nada mais e compartilhado.** Se um card precisar tocar `src/design/tokens.ts`,
`schema/manifesto.schema.json` ou `package.json`, ele **para, nao faz, e escreve
no handoff** — vira PREP da onda seguinte, feito por quem orquestra. Os tres sao
singletons (S-1, S-4, S-5), e treze agentes cegos entre si nao negociam em tempo
real.

### Dependencia lateral e proibida por construcao

Precisou de algo entregue por outro card **desta mesma onda**? Isso e
dependencia lateral. Pare, entregue o que da, e **nomeie a diferenca no
handoff**. Nao invente o artefato do vizinho nem edite o arquivo dele.

---

## 2. A superficie dos dois hubs — para nao ter de ler codigo

### F1-01 — contrato de no (para F1-04 … F1-11)

`src/composicao/contrato-de-no.ts`:

```ts
interface NoComponentProps {
  no: No;        // uniao discriminada do contrato do manifesto
  frame: number; // frame LOCAL: 0 = primeiro frame visivel DESTE no
  fps: number;
  width: number;
  height: number;
}
type NoComponent = React.FC<NoComponentProps>;

interface NoComponentMeta {
  tipo: string;      // "cabecalho" | "texto" | "lista" | "midia" | "codigo" | "grafico"
  schema: string;    // "Cabecalho.1", "Texto.1", ...
  id: string;        // unico no repositorio inteiro
  descricao: string;
}
```

Todo modulo de no exporta **`meta`** (nomeado) e **`default`** (o componente).
Nao existe registro central escrito a mao: a descoberta le do proprio modulo.

O contrato do componente, que o gate `comp-pureza` cobra:

- funcao pura de `(no, frame, fps, width, height)`;
- **`frame` vem por prop** — nao chame `useCurrentFrame()`;
- zero `Date.now()`, `Math.random()`, `setTimeout()`, `fetch()`;
- zero animacao CSS (`transition`, `animation`), zero `background-image`,
  zero `mask-image`;
- toda interpolacao com `extrapolateLeft`/`extrapolateRight` explicitos.

### F2-01 — contrato de estagio (para F2-02 … F2-06)

Leia **`docs/contrato-estagio-resolucao.md`**, com template copiavel em
`fixtures/resolucao/estagio-referencia/estagio.ts`. Em uma linha:

```ts
{ identidade: {nome, versao}, parametros, resolver(entrada) } -> { parcial, procedencia }
```

- Descoberta: `src/resolucao/<nome>/estagio.ts`, `export default`.
- Use **`entrada.fetch`**, nunca `globalThis.fetch` — o guarda de rede derruba
  a suite se voce sair pela porta errada.
- Mudou `resolver()` de um jeito que muda a saida? **Bump em
  `identidade.versao`.** Sem isso o cassete velho continua sendo servido.
- `procedencia.json` tem `licenca` obrigatoria, nao-vazia e nunca URL (a URL
  vive em `origem`). Use `paraProcedenciaDoStore()` — nao traduza a mao.
- Os alvos `res-offline --estagio <nome>`, `res-chave --estagio <nome>` e
  `res-cassete --estagio <nome>` **ja existem**; voce nao precisa escreve-los.

---

## 3. Faixas de id do ledger

Pre-alocadas. **Ids nunca sao reciclados** — o numero e citado no codigo. Um
card que esgotar a faixa para e pede faixa nova; nao invade a do vizinho.

| Card | Faixa | Card | Faixa |
|---|---|---|---|
| F1-04 | 310..319 | F1-09 | 360..369 |
| F1-05 | 320..329 | F1-10 | 370..379 |
| F1-06 | 330..339 | F1-11 | 380..389 |
| F1-07 | 340..349 | F2-02 | 390..409 |
| F1-08 | 350..359 | F2-03 | 410..429 |
| | | F2-04 | 430..449 |
| | | F2-05 | 450..469 |
| | | F2-06 | 470..489 |

As faixas dos cinco estagios de resolucao sao o dobro **de proposito**: e onde a
incerteza se concentra.

---

## 4. Faixas de porta TCP

Studio e preview simultaneos colidem em porta.

| Card | Porta | Card | Porta |
|---|---|---|---|
| F1-04 | 3104 | F1-09 | 3109 |
| F1-05 | 3105 | F1-10 | 3110 |
| F1-06 | 3106 | F1-11 | 3111 |
| F1-07 | 3107 | F2-02 | 3202 |
| F1-08 | 3108 | F2-03 | 3203 |
| | | F2-04 | 3204 |
| | | F2-05 | 3205 |
| | | F2-06 | 3206 |

---

## 5. A pergunta obrigatoria desta onda

Esta e uma **onda de composicao**: os oito nos trabalham sobre o mesmo artefato
entregue por F1-01, e os cinco estagios sobre o mesmo contrato de F2-01. O git
nao vai ter em que conflitar — e por isso vai **mergear em silencio codigo que
discorda**.

Antes de fechar o handoff, cada agente responde:

> Existe alguma assercao neste diff sobre a **LISTA COMPLETA** de alguma coisa?
> Se sim, ela e verdade contra a sua base e pode ser **falsa depois do merge do
> irmao**. Reescreva como assercao sobre a **presenca do SEU item**, nunca sobre
> a ausencia dos outros.

Isto existe por causa de um caso real: dois cards escreveram, cada um no seu
arquivo, um teste exigindo que a metade do outro continuasse na lista. Um
assertava `Todos == [x]`; o outro assertava exatamente os sete ids do primeiro.
Cada um era verdade contra a propria base, os dois sao contraditorios juntos, e
mergearam em silencio.

Concretamente, nesta onda: **nao asserte `tiposRegistrados()` contra uma lista
fechada**, e nao asserte que `src/composicao/nos/` contem exatamente N arquivos.
Asserte que o **seu** tipo esta la.

---

## 6. Ordem de merge da W4

**Os cinco de resolucao primeiro** (F2-02 … F2-06), **depois os oito de
composicao** (F1-04 … F1-11).

Motivo: os de resolucao gravam cassetes que os testes de composicao podem
consumir; mergea-los antes faz um eventual gate vermelho **nomear o card certo**.

Gate completo apos **cada** merge — nunca ao fim da onda. A bisseccao e o
produto, nao a limpeza: com um merge dentro, um gate vermelho nomeia o card; com
quatro, nao nomeia nada.
