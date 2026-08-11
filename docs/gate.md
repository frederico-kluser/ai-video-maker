# Gate local executável — `tools/gate.sh`

## O que é

O gate local é um script bash que roda **todas** as etapas de verificação do
projeto e reporta três estados por etapa:

| Estado | Cor | Significado |
|---|---|---|
| `PASS` | Verde | O comando da etapa rodou e saiu com `exit 0` |
| `FAIL` | Vermelho | O comando falhou (`exit != 0`) **ou** uma ferramenta necessária está ausente |
| `NÃO-EXERCITADO` | Amarelo | A etapa existe mas o comando não está definido — não há como exercitá-la |
| `PENDENTE` | Ciano | A etapa está declarada na definição mas não foi conectada a nenhum job do CI |

## Princípios

### Ferramenta ausente é VERMELHO, não "pulado"

Se uma etapa declara que depende de `node`, `python3`, `ffmpeg` ou qualquer
outra ferramenta, e essa ferramenta não está no `PATH`, o estado da etapa é
**FAIL** (vermelho). Não existe o conceito de "pular" etapa por falta de
ferramenta — a ausência é uma falha do ambiente.

### Gate começa verde com tudo vazio

Quando o repositório está vazio (ou quando nenhuma etapa tem comando definido),
todas as etapas estão `PENDENTE` e o veredito final é **VERDE**. A cada card
concluído, uma etapa recebe um comando e passa a ser exigida.

### Três estados, não dois

Um gate com dois estados (passou/falhou) é cego para o que não foi exercitado.
`NÃO-EXERCITADO` é impresso e visível — não some no silêncio de "não rodou".

### Veredito final

| Condição | Veredito |
|---|---|
| Nenhuma `FAIL` e nenhuma `NÃO-EXERCITADO` | **VERDE** |
| Nenhuma `FAIL` mas há `NÃO-EXERCITADO` | **AMARELO** |
| Pelo menos uma `FAIL` | **VERMELHO** |

## Etapas atuais

As etapas são definidas diretamente no script (hardcoded). Futuramente, a
definição migrará para a configuração do CI — cada etapa do gate corresponde a
um job.

| Etapa | Descrição | Ferramentas |
|---|---|---|
| `build` | Compila TypeScript e verifica sintaxe Python | `node`, `python3` |
| `test` | Roda todos os testes (vitest + pytest) | `node`, `python3` |
| `lint` | Roda linters (TypeScript + Python ruff) | `node`, `python3` |
| `typecheck` | Type-check TypeScript (sem emitir JS) | `node` |
| `versoes` | Reporta versões da toolchain | `node`, `python3`, `ffmpeg` |

## Uso

```bash
# Executar o gate
bash tools/gate.sh

# Saída sem cores ANSI (para CI/logs)
bash tools/gate.sh --no-color

# Executar o autoteste do gate
bash tools/gate_selftest.sh
```

## Autoteste

`tools/gate_selftest.sh` roda **antes** do gate e asserta a **mensagem** de cada
estado — não apenas o exit code. Um autoteste que asserta só o código de saída
não distingue "acusou" de "quebrou".

O autoteste prova:

- Que a mensagem `[PASS]` aparece quando o comando sai 0
- Que a mensagem `[FAIL]` aparece quando o comando sai != 0
- Que a mensagem `[NÃO-EXERCITADO]` aparece quando o comando é vazio
- Que a mensagem `[PENDENTE]` aparece quando a etapa não tem descrição
- Que esconder `ffmpeg` do `PATH` produz `[FAIL]` com o nome da ferramenta
- Que etapa sem comando produz `[NÃO-EXERCITADO]`, não `[PASS]` nem `[FAIL]`
- Que o veredito `VERDE` aparece com todas `PASS`
- Que o veredito `VERMELHO` aparece com alguma `FAIL`
- Que o veredito `AMARELO` aparece com alguma `NÃO-EXERCITADO`
- Que o gate começa verde com tudo vazio (só `PENDENTE`)
- Que ferramenta ausente é `[FAIL]` (vermelho), não `[NÃO-EXERCITADO]` (amarelo)

## Como adicionar uma etapa

1. Adicione uma chamada a `_define_stage` em `tools/gate.sh`:
   ```bash
   _define_stage "nome-da-etapa" \
       "Descrição do que a etapa verifica" \
       "comando && que && executa" \
       "ferramenta1,ferramenta2"
   ```
2. Adicione `"nome-da-etapa"` ao array `STAGE_ORDER`.
3. Rode `bash tools/gate_selftest.sh` para confirmar que nada quebrou.
4. Rode `bash tools/gate.sh` para ver a nova etapa em ação.

## Referências

- ADR-0001: "Nenhum estágio começa sem oráculo capaz de reprová-lo" — gate
  como guarda executável
- AGENTS.md, Regra 4: "O gate começa verde com tudo vazio"
- Skill `falsifiable-gates`: três estados, sonda negativa, ferramenta ausente
  é vermelho