# ADR-0001: Nenhum estagio comeca sem oraculo capaz de reprova-lo

**Status:** ACEITO
**Data:** 2026-08-11
**Decisores:** programa-editor-video-ia
**Supera:** Nenhum (ADR inaugural)

## Contexto

O programa Editor de Video IA gera video a partir de um tema. O artefato final
nao tem "certo" independente -- nao existe um gabarito externo contra o qual
comparar. O video e a saida de um pipeline de 5 estagios, e tres desses estagios
envolvem processos nao-deterministicos (LLM, TTS, download de midia).

Sem um oraculo, a unica forma de validar o pipeline e assistir ao video --
uma verificacao manual, subjetiva, que nao escala e nao pode ser executada
por um gate de CI.

A pergunta que este ADR responde: **quando um estagio pode comecar a ser
implementado?**

## Decisao

**Nenhum estagio do pipeline comeca a ser implementado enquanto nao existir
um oraculo capaz de reprova-lo.**

"Oraculo" aqui significa: um comando executavel que retorna `exit 0` quando
o estagio esta correto e `exit != 0` quando o estagio esta incorreto.

"Capaz de reprovar" significa que existe pelo menos um caso de teste que
**falha** (sonda negativa). Um oraculo que so tem casos positivos nao e um
oraculo -- e uma celebracao.

### O que conta como oraculo

| Tipo | Exemplo | Estagio |
|---|---|---|
| Teste de determinismo | Renderizar 2x e exigir bytes identicos | Composicao, Render |
| Snapshot aprovado | Comparar frame renderizado com `fixtures/snapshots/` | Composicao, Nos |
| Invariante estrutural | "Toda URL no codigo tem citacao de fonte" | Todo o repositorio |
| Golden master | `manifesto-resolvido + frames-chave` diffam como JSON | E2E |
| Sonda negativa | "Apagar o snapshot aprovado tem de ficar vermelho" | Qualquer estagio |

### O que NAO conta como oraculo

- "O comando rodou sem erro" (`exit 0` sem assercao de conteudo -- C1)
- "O video foi gerado" (quadro preto e um video valido)
- "O teste passou" quando o filtro nao casa nada (C2)
- "Parece certo" (verificacao humana sem criterio escrito)

### Mecanismo de enforce

O card de um estagio **declara dependencia** do card do oraculo correspondente.
O grafo de dependencias faz o resto: o card do estagio so e desbloqueado quando
o card do oraculo estiver concluido.

Exemplo:
- `F1-01` (Composicao raiz) depende de `F0-06` (Harness de determinismo)
- `F5-01` (Pipeline de render) depende de `F0-06` (Harness de determinismo)
- `F5-07` (Orquestrador e2e) depende de `F0-09` (Fixture canonica) e `F0-06`

## Consequencias

### Positivas

1. **O gate e verde desde o dia 1.** Com o repositorio vazio, todas as etapas
   estao `PENDENTE`. A cada card concluido, uma etapa entra no gate e passa a
   ser exigida. Nao existe o momento "agora vamos escrever os testes" -- os
   testes sao a condicao de existencia do codigo.

2. **A regra e uma aresta, nao uma recomendacao.** Ninguem precisa lembrar
   da regra -- ela e uma dependencia no grafo. Se o card do oraculo nao foi
   concluido, o card do estagio nao e desbloqueado.

3. **O oraculo e independente do implementador.** O card do oraculo e escrito
   e executado por um agente diferente do card do estagio. Quem implementa nao
   escreve o proprio oraculo.

### Negativas

1. **Custo inicial mais alto.** Todo estagio exige um card extra (o oraculo)
   antes de poder comecar. Isso aumenta o numero total de cards e a profundidade
   do grafo.

2. **Rigidez.** Um estagio que mudou de forma precisa de um oraculo novo --
   o que requer um card novo, uma dependencia nova e uma onda extra.

## Guarda executavel

O card `T-06` (Verificador de aceitacao) implementa a guarda executavel deste
ADR: verifica que todo card concluido tem um seletor que casa pelo menos um
teste. Um card marcado concluido cujo seletor casa zero testes **fica vermelho**.

Comando: `python3 tools/verify-acceptance.py`

## O que o sign-off NAO autoriza

- "O oraculo e o olho humano" -- verificar assistindo ao video e o estado
  pre-ADR. Este ADR existe exatamente para substituir isso.
- "O oraculo e o teste do framework" -- o teste do framework (Remotion,
  FFmpeg) testa o framework, nao o nosso pipeline.
- "O oraculo vai ser escrito depois" -- isso e o estado que este ADR proibe.

## O que este documento NAO cobre

- O formato exato de um card -- ver `docs/adr/0002-contrato-de-card.md`
- Como escrever um criterio de aceitacao -- ver skill `falsifiable-gates`
- Como capturar e comparar artefato de video -- ver skill `video-characterization`
