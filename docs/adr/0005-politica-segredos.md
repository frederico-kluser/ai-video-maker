# ADR-0005: Politica de segredos -- nunca versionar chave real, hook de seguranca como guarda

**Status:** ACEITO
**Data:** 2026-08-11
**Card:** `I-02` (W2.5)
**Depende de:** ADR-0003 (enquadramento de uso pessoal)
**Consumida por:** todos os cards que usam API externa (W4 em diante)

**Guarda executavel:** `rg -i "sk-|api[_-]?key\s*=\s*['\"][A-Za-z0-9]" -g '!.env.example' .` -- se houver saida, uma chave real entrou em arquivo rastreado e o gate falha.

## Contexto

O programa Editor de Video IA faz chamadas a cinco APIs externas, cada uma
autenticada por chave:

1. Anthropic (Claude API) -- `ANTHROPIC_API_KEY`
2. OpenAI (TTS) -- `OPENAI_API_KEY`
3. GIPHY (GIFs e stickers) -- `GIPHY_API_KEY`
4. Pexels (fotos e videos) -- `PEXELS_API_KEY`
5. Pixabay (musica e efeitos) -- `PIXABAY_API_KEY`

Chaves de API sao segredos. Versiona-las em repositorio publico as expoe
permanentemente no historico do git, e a revogacao exige rotacionar a chave
em todos os ambientes. O custo de um vazamento e assimetrico: um commit
errado e irreversivel sem `git filter-branch` ou `BFG` -- e mesmo assim,
qualquer clone anterior ao rewrite reteve a chave.

Este projeto ja tem um hook de seguranca no harness que bloqueia leitura de
arquivos `.env` e similares. Mas um hook de leitura **nao bloqueia a escrita**:
o agente pode criar um arquivo que contenha uma chave real (por exemplo, num
log, fixture ou arquivo de teste) e commita-lo. A prevencao exige dois
mecanismos complementares:

1. **Nunca escrever chave real em arquivo rastreado** (norma, este ADR).
2. **Gate pos-commit que varre o repositorio** (guarda executavel).

## Decisao

### D1 -- Chaves reais so existem em `.env` (nao rastreado)

Chaves de API reais **nunca** sao escritas em arquivo rastreado pelo git.
O unico arquivo autorizado a conter chaves e `.env`, que esta no
`.gitignore` (linhas 43-47: `.env`, `.env.local`, `.env.*.local`).

O hook `PreToolUse` com `pathPattern` `Read` bloqueia leitura de `.env` e
similares (`exit 2`), impedindo que o agente leia acidentalmente a chave
real e a copie para outro arquivo.

### D2 -- `.env.example` e o unico arquivo rastreado com nome de chave

`.env.example` declara os **nomes** das variaveis, com placeholders
explicitos (`sk-ant-...`, `sk-...`, ou vazio), e documenta para cada
variavel: onde obter a chave, os limites do provedor e as obrigacoes
legais (atribuicao, cache, divulgacao).

Ele e mantido por `I-02` e atualizado quando um provedor entra ou sai.

### D3 -- Gate pos-commit: regex de chave real

A guarda executavel varre o repositorio em busca de strings que se
parecam com chaves de API:

```bash
rg -i "sk-|api[_-]?key\s*=\s*['\"][A-Za-z0-9]" -g '!.env.example' .
```

Se houver saida, o gate falha. O `-g '!.env.example'` exclui o arquivo
de exemplo, que contem placeholders com prefixo `sk-` mas **sem sufixo
real** (o placeholder e `sk-ant-...` ou `sk-...`, truncado).

Este gate e executado **antes de cada commit** via hook `PreToolUse` ou
**apos cada onda** via script de validacao.

### D4 -- Hook de seguranca existente: bloqueio de leitura

O hook em `.claude/settings.json` (`PreToolUse`, `Read`, `pathPattern`)
bloqueia leitura de `.env` e similares com `exit 2`. O codigo `2` e o
unico que bloqueia em `PreToolUse`/`PostToolUse`/`Stop` (fonte:
https://code.claude.com/docs/en/hooks.md -- placar 3-0).

Este hook protege contra o cenario: agente le `.env` real, extrai a chave,
e a escreve em outro arquivo. Sem leitura, sem copia.

### D5 -- O hook de leitura NAO bloqueia escrita de chave

O hook atual bloqueia **leitura** de `.env`, mas nao bloqueia **escrita**
de chave em arquivo novo. Um agente que conhece a chave (porque o usuario
a passou no prompt, ou porque ela esta em variavel de ambiente) pode
escreve-la em um arquivo rastreado.

A defesa contra esse cenario e o gate pos-commit (D3), que detecta o
padrao de chave real em qualquer arquivo rastreado. Mas o gate pos-commit
so roda se for executado -- e a execucao depende de disciplina.

**Recomendacao:** Adicionar um hook `PreToolUse` com `Write||Edit` e regex
de chave para bloquear a escrita no nascedouro. Enquanto isso nao existe,
o gate D3 e a unica barreira.

### D6 -- Chaves em variaveis de ambiente: seguras, mas nao imunes

Chaves definidas como variaveis de ambiente (`export ANTHROPIC_API_KEY=...`)
nao sao capturadas pelo git. Mas:

- `env` pode vazar para logs (CI, `bash -x`, `ps aux`).
- Subprocessos herdam o ambiente completo.
- O agente tem acesso a `process.env` e pode serializa-lo.

O arquivo `.env` e preferivel a `export` porque:
- Nao aparece em `ps aux`.
- E bloqueado pelo hook de leitura.
- E explicitamente gitignorado.

## Consequencias

- **Positivas:** Nenhuma chave real entra no historico do git. O gate D3
  detecta chaves acidentalmente commitadas.
- **Negativas:** O desenvolvedor precisa copiar `.env.example` para `.env`
  e preencher as chaves manualmente. O hook de leitura impede que o agente
  leia o `.env` para validar se a chave funciona -- a validacao de chave
  (ping) e feita por script externo (`just contas:verificar`), que roda
  fora do harness.
- **Riscos:** O gate D3 e regex, nao parser. Chaves em formatos nao
  cobertos pelo regex (ex.: chaves Base64 sem prefixo `sk-`) passariam.
  A cobertura deve ser ampliada conforme novos provedores entram.

## Itens de ledger ligados

- Nenhum item aberto neste momento. Se um formato de chave novo entrar
  (ex.: chave sem prefixo `sk-`), abrir item de ledger com o regex
  atualizado.

## Reafirmacoes

- ADR-0001: guarda executavel presente e testavel.
- ADR-0002: contrato de card -- `I-02` entrega `.env.example`, `contas.md`
  e este ADR.
- ADR-0003: escopo pessoal -- nenhuma chave de producao GIPHY e necessaria
  enquanto o uso for pessoal e o volume for baixo.