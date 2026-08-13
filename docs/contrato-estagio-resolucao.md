# Contrato de estagio de resolucao

**Entregue por:** card `F2-01` (W3)
**Implementado por:** `F2-02` (grafico), `F2-03` (locucao), `F2-04` (midia), `F2-05` (codigo), `F2-06` (musica) — W4
**Consumido tambem por:** `F2-07` (suite offline, W5) e a composicao (W5+)
**ADR:** `docs/adr/0007-contrato-de-estagio-e-cassete.md`

Os cinco cards da W4 implementam este contrato **em paralelo e cegos entre si**.
Tudo que voce precisa saber para implementar um estagio esta aqui. Se
faltar alguma coisa, o buraco e do F2-01 — abra item de ledger, nao invente.

---

## 1. Em uma tela

```
src/resolucao/<nome>/estagio.ts        export default EstagioResolucao
fixtures/cassetes/<nome>/<chave>/      o cassete daquele estagio para aquela chave
```

```ts
import type {
  EntradaEstagio, EstagioResolucao, SaidaEstagio,
} from "../contrato.js";

const estagio: EstagioResolucao = {
  identidade: { nome: "locucao", versao: "1.0.0" },
  parametros: { voz: "alloy", velocidade: 1 },
  async resolver(entrada: EntradaEstagio): Promise<SaidaEstagio> {
    const resposta = await entrada.fetch("https://provedor.exemplo/tts", { ... });
    // ... produz assets, calcula hash de conteudo
    return { parcial, procedencia };
  },
};

export default estagio;
```

Template pronto para copiar: **`fixtures/resolucao/estagio-referencia/estagio.ts`**.

---

## 2. Descoberta — por convencao, nunca registro central

O orquestrador acha os estagios pelo **disco** (AGENTS.md Regra 6):

| O que | Regra |
|---|---|
| Onde | `src/resolucao/<nome>/estagio.ts` |
| Marcador | o arquivo se chama exatamente `estagio.ts` |
| Export | `export default` de um objeto `EstagioResolucao` |
| `<nome>` | um de: `locucao`, `grafico`, `midia`, `codigo`, `musica` |
| Diretorio sem `estagio.ts` | e infraestrutura (`cassete/`, `rede/`), nao estagio |

Nome fora da lista dos cinco → `EEstagioDesconhecido`, e a suite fica vermelha.
Nao existe lista de excecoes para manter.

---

## 3. A assinatura

### `identidade: { nome, versao }`

`versao` e **semver**, e entra na chave de cache.

> **Regra dura:** mudou o codigo de `resolver()` de um jeito que pode mudar
> a saida? Bumpe `versao`. Sem isso o cassete velho continua sendo
> encontrado e voce serve o resultado antigo para sempre — o modo de falha
> C12 do AGENTS.md.

### `parametros: ParametrosEstagio`

Tudo que muda a saida e **nao** esta no manifesto. Escalares apenas
(`string | number | boolean | null`); se precisar de aninhamento, achate
(`"voz.nome"`).

Exemplos reais por estagio:

| Estagio | Parametros tipicos |
|---|---|
| `locucao` | `voz`, `velocidade`, `formato`, `versaoDoModeloTTS` |
| `grafico` | `qualidade`, `versaoManim`, `fundoTransparente` |
| `midia` | `provedor`, `orientacao`, `tamanhoMinimo` |
| `codigo` | `tema`, `fonte`, `versaoDoDestacador` |
| `musica` | `provedor`, `duracaoAlvo`, `loudnessAlvo` |

Inclua a **versao da ferramenta externa** que voce chama (`manim 0.18.1`,
`ffmpeg 7.1`). Ela muda a saida e nao esta em lugar nenhum senao aqui.

### `resolver(entrada): Promise<SaidaEstagio>`

`entrada`:

| Campo | O que e |
|---|---|
| `manifesto` | o manifesto original, integro. **Nao modifique.** |
| `parametros` | os mesmos que voce declarou |
| `fetch` | **use este**, nunca `globalThis.fetch` (§5) |
| `diretorioTrabalho` | temporario, exclusivo desta execucao |

`resolver()` so e chamado em **modo gravacao**. Offline o orquestrador
reproduz o cassete e nao invoca seu codigo — e por isso que a suite roda
com a rede fechada.

---

## 4. A saida

```ts
interface SaidaEstagio {
  parcial: ParcialResolvido;      // a sua camada do manifesto resolvido
  procedencia: ProcedenciaCassete; // licenca — obrigatoria
}
```

### `parcial` — so a SUA camada

```ts
interface ParcialResolvido {
  assets: Record<Sha256, AssetResolvido>;  // sempre presente (pode ser {})
  nos_midia?:   Record<NodeId, Sha256>;
  nos_locucao?: Record<NodeId, Sha256>;
  nos_grafico?: Record<NodeId, Sha256>;
  nos_codigo?:  Record<NodeId, Sha256>;
  nos_musica?:  Record<NodeId, Sha256>;
  trilha_sonora?: Sha256 | null;
}
```

Preencha apenas o mapa que e seu. O orquestrador funde tudo
(`fundirParciais`) e **colisao com hashes diferentes e erro**, nao
"o ultimo vence": ultimo-vence faz o resultado depender da ordem de
execucao.

### Proibicoes que o schema impoe (nao sao convencao)

- **Nenhuma URL**, em nenhuma profundidade, nem como valor nem como nome
  de propriedade. `schema/manifesto-resolvido.schema.json` tem
  `$defs.SemURLProfundo` aplicado na raiz. `licenca: "CC BY 4.0"`, nunca
  `licenca: "https://creativecommons.org/..."`.
- **Nenhum tempo de parede.** Nao ha campo de data no schema, e
  `additionalProperties: false` impede criar um.

A URL de origem vai para a **procedencia**, que vive acima da fronteira.

### `procedencia` — a licenca e ∅-crit

```ts
interface ProcedenciaCassete {
  licenca: string;             // OBRIGATORIA, nao-vazia
  provedor: string;
  ferramenta?: string;         // "manim 0.18.1"
  assets: ProcedenciaAsset[];  // cada um com sua propria licenca
  adquiridoEm?: string;        // ISO-8601 — VOLATIL, ver §7
  notas?: string;
}

interface ProcedenciaAsset {
  hash: string;                // SHA-256 do conteudo
  licenca: string;             // OBRIGATORIA, nao-vazia
  atribuicaoObrigatoria: boolean;
  atribuicao?: string;
  provedor: string;
  idNoProvedor?: string;
  origem?: string;             // a URL vive AQUI, e nao e caminho de leitura
  termoDeBusca?: string;
}
```

O ∅-crit do **seu** card e:

```sh
rg -L '"licenca"' fixtures/cassetes/<nome>/**/procedencia.json   # tem de sair vazio
```

Os campos sao em **portugues** (`licenca`), diferente de
`src/store/procedencia.ts` (que usa `license`). Nao traduza a mao: use
`paraProcedenciaDoStore(asset, cassete)`.

> Licenca ausente ou vazia **impede a gravacao**, antes de qualquer byte
> chegar ao disco. Cassete invalido no disco passaria no `res-offline`
> seguinte e a divida ficaria invisivel.

---

## 5. Rede — use `entrada.fetch`

| Voce escreve | Modo gravacao | Modo offline |
|---|---|---|
| `entrada.fetch(...)` | vai a rede **e grava no cassete** | reproduz do cassete |
| `globalThis.fetch(...)` | vai a rede e **nao grava** | `ERedeBloqueada` |

O guarda (`src/resolucao/rede/bloqueio.ts`) bloqueia `fetch`, `net.Socket.connect`,
`http/https.request` e `dns.lookup`, e falha com a mensagem estavel
`REDE BLOQUEADA`. Em `res-offline` ainda ha o namespace de rede do kernel
por fora, que vale para subprocesso.

**Credenciais.** O cassete e versionado no repositorio. O gravador redige
headers sensiveis e credencial em query string, e **recusa gravar** se
achar padrao de chave no corpo da resposta. Nao contorne: troque o
provedor ou o formato da chamada.

**Cassete e sosia, nao sucessor.** Grave a resposta como ela veio. Se o
estagio conserta algo (normaliza campo, preenche default), o conserto e do
**estagio** e roda tambem no replay. Consertar na gravacao esconde o
defeito e o replay para de testar o seu codigo.

---

## 6. O cassete

```
fixtures/cassetes/<nome>/<chave>/
  cassete.json      cabecalho: formato, chave, componentes da chave
  resultado.json    a ParcialResolvido (JSON canonico)
  procedencia.json  licenca e origem — OBRIGATORIO
  chamadas.json     chamadas HTTP gravadas, na ordem
  corpos/<sha256>   corpo binario de cada resposta
  volatil.json      o UNICO arquivo que pode mudar ao regravar
```

Obrigatorios: `cassete.json`, `resultado.json`, `procedencia.json`,
`volatil.json`. Falta de qualquer um = `ECasseteAusente` (meio cassete nao
reproduz meio estagio; reproduz um resultado errado).

`<chave>` = SHA-256 do JSON canonico de:

```
{ versaoContrato, nome, versaoEstagio, hashManifesto, parametros }
```

Nao invente o nome do diretorio: `gravarCassete()` o calcula.

### Gravar

```sh
npx tsx -e '
  import estagio from "./src/resolucao/locucao/estagio.js";
  import { gravarCassete } from "./src/resolucao/cassete/gravador.js";
  await gravarCassete(estagio, { raiz: "fixtures/cassetes", manifesto, diretorioTrabalho: "/tmp/x" });
'
```

Ou pelo orquestrador, com `modo: "gravacao"`. Gravacao roda **a mao, com
rede**, nunca dentro da suite.

---

## 7. Determinismo do cassete

Regravar tem de reproduzir **cada byte**. As unicas excecoes estao em
`CAMPOS_VOLATEIS` (`src/resolucao/cassete/formato.ts`), hoje duas:

| Campo | Por que |
|---|---|
| `volatil.json#/*` | hora, duracao, runtime — auditoria, nao resultado |
| `procedencia.json#/adquiridoEm` | quando o byte entrou no repositorio; exigido por licenca |

`res-cassete` grava duas vezes com relogios diferentes, diffa, e **exige
zero refutacoes**; depois muta o resultado e **exige** que o diff fique
vermelho. Diff que nunca reprovou nao e evidencia de nada.

Se o seu estagio nao regrava identico, o problema e do estagio: algo dele
depende de relogio, ordem de `Object.keys`, tmpdir aleatorio ou nonce.

---

## 8. Aceitacao do seu card

| No PROGRAMA | Comando que existe hoje |
|---|---|
| `just res:<estagio>` | receita sua, no seu bloco do justfile |
| `just res:offline --estagio <nome>` | `bash tools/resolucao/offline.sh --estagio <nome>` |
| `just res:chave --estagio <nome>` | `npx tsx tools/resolucao/chave.ts --estagio <nome>` |
| ∅-crit `rg -L '"licenca"' ...` | idem |

> **Nome das receitas.** `just` 1.42 nao aceita `:` em nome de receita —
> `res:offline:` e lido como receita `res` com dependencia `offline`. As
> receitas de F2-01 usam hifen (`res-offline`, `res-chave`). Enquanto o
> justfile do repositorio nao parsear (item de ledger **AB-284**), chame os
> scripts direto. Use hifen tambem nas suas.

`res-offline` roda, na ordem: tripwire da porta de fuga do guarda → sondas
de saida (kernel e processo) → vitest → schema → **cobertura de cassetes
(∅-crit)** → chave de cache.

---

## 9. Erros que voce vai encontrar

| Erro | O que aconteceu | O que fazer |
|---|---|---|
| `ECasseteAusente` | estagio existe, cassete nao | grave o cassete |
| `ECasseteInvalido` | cassete existe e esta quebrado | veja a lista de problemas |
| `EChamadaNaoGravada` | cassete nao tem essa chamada | mudou o comportamento sem bumpar versao? regrave |
| `ERedeBloqueada` | tentou sair com o guarda ativo | use `entrada.fetch` e grave cassete |
| `EEstagioDesconhecido` | nome fora dos cinco | renomeie o diretorio |
| `EColisaoDeMerge` | dois estagios reivindicaram o mesmo no | so um estagio dono por mapa |
| `credencial detectada` | chave de API ia para o cassete | tire a chave da resposta ou da URL |

---

## 10. Checklist antes de abrir o handoff

- [ ] `src/resolucao/<nome>/estagio.ts` com `export default`
- [ ] `identidade.versao` bumpada se `resolver()` mudou
- [ ] todo parametro que muda a saida esta em `parametros` (inclusive versao de ferramenta externa)
- [ ] so `entrada.fetch`; zero `globalThis.fetch`
- [ ] `procedencia.licenca` e `assets[].licenca` preenchidas e nao-vazias
- [ ] nenhuma URL na `parcial` (`encontrarURLs(parcial)` vazio)
- [ ] cassete gravado em `fixtures/cassetes/<nome>/<chave>/`
- [ ] `bash tools/resolucao/offline.sh --estagio <nome>` verde
- [ ] `npx tsx tools/resolucao/chave.ts --estagio <nome>` verde
- [ ] `npx tsx tools/resolucao/regravar-e-diffar.ts --estagio <nome>` verde
- [ ] `rg -L '"licenca"' fixtures/cassetes/<nome>/**/procedencia.json` vazio
