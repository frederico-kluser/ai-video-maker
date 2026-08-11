# Contrato de pesquisa — formato obrigatório de saída

> Este arquivo é o **contrato da onda de pesquisa (W-P)**. Foi commitado antes de qualquer
> agente ser lançado. Nenhum agente de pesquisa edita este arquivo.
> Cada agente é **dono exclusivo** de um único arquivo em `docs/pesquisa/`.

## Por que este contrato existe

O documento `Roadmap Editor de Vídeo IA.md` é um **panorama**: mistura achado com
recomendação, e várias de suas afirmações têm cara de API real mas não foram conferidas
contra fonte primária. O programa inteiro vai ser particionado em cima dessas afirmações.
Uma afirmação falsa aqui vira contrato em 40 cards.

A regra de nível de programa é uma frase:

> **Toda afirmação técnica que condiciona um card carrega um placar de corroboração.
> Um claim sem placar é indistinguível de opinião três meses depois.**

## Regime de decisão (qual das três coisas fazer)

| Situação | O que fazer |
|---|---|
| A resposta é pública e datável (versão, flag, endpoint, termo de licença) | **PESQUISAR** — fonte primária, placar explícito |
| A resposta depende de mandato, orçamento, hardware ou apetite de risco do dono | **PERGUNTAR** — vira item `PERGUNTA-DONO` no arquivo, nunca resolvido por dedução |
| A resposta só existe rodando o sistema nesta máquina | **REGISTRAR** — vira semente de ledger (`LEDGER-SEED`), com *como verificar* e *o que muda se divergir* |

Confundir os três é o erro caro. Um agente que "deduz" a política de licenciamento de um
produto comercial produz um plano que só quebra no jurídico.

## Placar de corroboração

Formato literal: `(N-M)` onde **N** = fontes independentes que confirmam,
**M** = fontes independentes que contradizem.

- **Fonte primária** = documentação oficial do projeto, repositório oficial, changelog
  oficial, página de preços/licença oficial, RFC, man page. Vale 1.
- **Fonte secundária** = blog, tutorial, vídeo, resposta de fórum, artigo de terceiro. Vale 1,
  mas **nenhum claim fecha só com secundárias** — precisa de ≥1 primária.
- Duas páginas do mesmo domínio contam como **uma** fonte.

| Placar | Rótulo | Pode virar card? |
|---|---|---|
| ≥3-0 com ≥1 primária | `CONFIRMADO` | sim, direto |
| 2-0 com ≥1 primária | `PROVÁVEL` | sim, com nota de rechecagem e data-limite |
| 1-0, ou só secundárias | `NÃO VERIFICADO` | **não** — vira `LEDGER-SEED` |
| qualquer N-M com M≥1 | `EM DISPUTA` | **não** — escreva as duas leituras e o que as separa |
| a fonte não existe / a API não existe | `REFUTADO` | vira linha da tabela de refutações |

**Fechamento parcial é aceito e é o desfecho saudável mais comum.** Se metade de um claim
verifica e a outra metade não, escreva as duas metades separadas com placares diferentes.
Nunca troque "não verificado" por "verificado" sem dado no meio.

## Estrutura obrigatória do arquivo de saída

Cada agente escreve **um** arquivo em `docs/pesquisa/R<NN>-<slug>.md`, com exatamente estas
seções, nesta ordem:

```markdown
# R<NN> — <título do cluster>

**Escopo desta pesquisa:** <2 linhas: o que este cluster responde e o que NÃO responde>

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R<NN>-01 | ... | (3-0) | CONFIRMADO | https://... |

## 2. Detalhe por claim

### R<NN>-01 — <claim>
- **Verdade operacional:** <o que isso significa na prática, 1-3 linhas>
- **Como reconferir:** <comando literal, URL, ou consulta — copiável>
- **O que quebra se divergir:** <nomeie os artefatos: qual card, qual fixture, qual gate>
- **Fontes:** <lista com URL e o que cada uma diz; marque (primária)/(secundária)>

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|

## 4. Armadilhas (falso verde deste domínio)

Cada linha: *o que parece funcionar* → *por que não é prova* → *o que fica vermelho se sumir*.

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** <se aplicável — a escolha que se espera reverter e o custo da
  reversão em unidade contável (arquivos, linhas, uma variável)>
- **Skills que devem carregar este conhecimento:** <nomes da lista do contrato de skill>
- **Cards que este cluster condiciona:** <descreva o trabalho, não invente ids>
```

## Regras duras para o agente de pesquisa

1. **Nunca invente URL.** Se você não abriu a página, ela não é fonte. Um link plausível que
   404 é pior que nenhum link: ele lê como verificado.
2. **Nunca invente nome de API, flag ou pacote.** Se você não viu na doc, o claim é
   `NÃO VERIFICADO`, e você escreve isso.
3. **Data importa.** Anote a versão do produto a que o claim se refere. "Funciona" sem versão
   é afirmação sobre nada.
4. **Zero resultado não é prova de ausência.** Se a busca não achou, tente outro termo, o
   repositório e o changelog antes de escrever `REFUTADO`. `REFUTADO` exige evidência
   positiva de que a coisa não existe (ex.: a página de referência lista todas as opções e
   aquela não está lá).
5. **Escreva o arquivo mesmo que o resultado seja magro.** Um cluster que devolve
   "3 claims confirmados e 6 em aberto" é informação. Um cluster que devolve nada é buraco.
6. **Você é dono de UM arquivo.** Não edite `docs/00-panorama-verificado.md`, não edite
   arquivos de outros clusters, não edite este contrato.

## O que o agente devolve para o orquestrador

No máximo **40 linhas**: a tabela da seção 1 comprimida, mais as refutações, mais os
`PERGUNTA-DONO`. O corpo fica no arquivo — o histórico do terminal não é lugar de conteúdo.
