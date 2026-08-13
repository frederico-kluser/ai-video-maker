# ADR-0018 — No de codigo: tokens pre-computados, nunca destaque em render

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F1-08
- **Depende de:** ADR-0001 (todo card tem oraculo), F1-01 (contrato de no), F2-01 (contrato de estagio)

## Contexto

`AGENTS.md`, Regra 1: *`src/composicao/` e funcao pura.* Destacar sintaxe e
trabalho impuro — exige gramatica, tema e, em algumas ferramentas, busca de
tipos numa CDN (`twoslash-cdn`). Nada disso pode existir abaixo da fronteira
de determinismo.

A pesquisa registrada em `docs/pesquisa/R09-animacao-de-codigo.md` e na skill
`code-animation` mostra o mecanismo real do template oficial: o highlight roda
em `calculateMetadata()`, **uma unica vez, numa aba separada**, e o resultado
viaja como dados JSON-serializaveis para todas as abas do render. O custo do
destaque nao multiplica por frame nem por thread — e e exatamente essa a
costura que este card imita para o nosso pipeline: o destaque e computado no
estagio de resolucao `codigo` (F2-05, acima da fronteira, cacheado por hash) e
chega ao no como **dado consumido**, nunca como trabalho refeito no render.

## Decisao

### 1. O no consome `destaque_sintaxe`, nunca destaca

O componente `src/composicao/nos/codigo.tsx` nao importa destacador nenhum,
nao carrega gramatica, nao tem tabela de palavras-chave e nao roda regex
sobre o codigo do no. Ele le o campo `destaque_sintaxe` (anexado a camada de
hidratacao), confere-o contra o codigo cru e **pinta** os tokens.

Ha teste que varre o proprio fonte do componente atras de import de
destacador, tabela de palavra-chave e regex (busca no texto normalizado —
tecnica do tripwire, C11). Ha teste de pixel que prova, no render real, que
(1) as cores dos papeis aparecem quando ha tokens e (2) nenhuma delas aparece
quando nao ha.

### 2. Ausencia e mentira sao coisas diferentes

- **Ausencia** — nao ha `destaque_sintaxe`: o componente desenha o codigo
  numa cor so, marca `data-destaque="ausente"` e nao explode. A fixture
  canonica do repositorio tem no de codigo sem destaque; um render que
  morresse por isso reprovaria F1-01.
- **Mentira** — ha `destaque_sintaxe`, mas ele discorda do codigo do no
  (linha a mais, token que nao reconstroi a linha, papel desconhecido,
  formato de outra versao): RECUSA dura. `ErroDeDestaque` sobe e o render
  para, em vez de exibir um codigo que nao e o do manifesto.

A assercao que carrega o peso e a reconstrucao: a concatenacao dos tokens de
cada linha tem de reproduzir a linha crua, caractere por caractere.

### 3. O formato do artefato e dependencia lateral declarada

O contrato de estagio (`docs/contrato-estagio-resolucao.md`) fixa que a saida
do estagio `codigo` e `nos_codigo: Record<NodeId, Sha256>` — um hash de asset
por no. Ele **nao** fixa o conteudo desse asset. Este card assume — e declara
aqui — que o asset e um JSON `DestaqueDeCodigo` (formato versionado
`DestaqueCodigo.1`: `linguagem`, `destacador`, `linhas[].numero/tokens[]`),
que a hidratacao anexa ao no como `destaque_sintaxe`.

F2-05 e irmao desta onda e e cego para este arquivo. A conferencia do
formato fica registrada em AB-350 do ledger e pertence ao join da W5
(F1-12): se F2-05 entregar outro conteudo, so a hidratacao muda — o
componente nao precisa de reescrita, porque o formato e estrutural e
versionado, e uma versao diferente e recusada de forma ruidosa.

O campo **nao** entra em `src/contratos/manifesto.ts` nem no schema
(ambos singletons, S-4): a leitura no componente e estrutural e conferida,
nunca um cast cego.

### 4. Papeis lexicos fechados; cor fora do no

O componente sabe COLORIR oito papeis (`PAPEIS_DE_TOKEN`), que e diferente de
RECONHECER: quem classifica e o destacador, acima da fronteira. Um papel fora
da lista e recusado — pintar de cor default seria inventar significado.

Toda cor vem de `src/design/tokens.ts` (Regra 2). O mapa `COR_POR_PAPEL`
reaproveita os papeis semanticos existentes (`text`, `highlight`, `state`)
porque nao existe grupo `sintaxe` em tokens.ts; criar uma paleta de sintaxe
propria e alteracao de S-5 e vira PREP do orquestrador (AB-353 aberto).

### 5. O oraculo

Snapshot aprovado a partir do **render** (webpack do Remotion), nunca do
Studio (C5): `fixtures/snapshots/no-codigo/aprovado/` tem tres artefatos —
still com tokens, still do mesmo codigo sem tokens e o markup do componente.
Determinismo provado renderizando 2x e exigindo bytes identicos. Pixel
analisado por `tools/no-codigo/analisar-frame.py` (C1): quadro chapado ou
vazio reprova, e as cores procuradas sao lidas do proprio componente, nunca
digitadas. Ausencia de snapshot e VERMELHA sempre: gravar exige o modo
`--aprovar` explicito, e `tools/no-codigo/ausencia.sh` prova por mutacao que
apagar um aprovado derruba o gate.

## Consequencias

1. Trocar de motor de destaque (F2-05) nao toca neste componente: o artefato
   e a superficie. Reversao = 1 arquivo + 1 fixture de tokens, a costura que
   a pesquisa nomeia.
2. Um no de codigo sem destaque continua renderizavel — o pipeline nunca fica
   preso por falta de tokens.
3. O preco e que um artefato torto (destacador bugado, versao divergente)
   derruba o render alto em vez de sair feio — comportamento intencional.

## Alternativas descartadas

- **Destacar no render** (chamar `highlight()`/`codeToTokens()` dentro do
  componente): multiplica o custo por frame x concorrencia, abre porta de
  nao-determinismo entre abas e coloca impureza abaixo da fronteira.
- **Screenshot de editor como bloco de codigo**: queima tema/fonte/DPI, o
  texto some do DOM e nenhum gate de layout tem o que medir.
- **Destacador embutido no no com gramatica estatica**: ainda e um lexer
  abaixo da fronteira, e a lista de linguagens cresceria no componente.
