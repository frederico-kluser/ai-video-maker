# Vocabulario do programa -- Editor de Video IA

Glossario canonico do programa. Todo termo listado aqui tem definicao unica e vinculante.
Se um termo aparece em outro documento com sentido divergente, o linter falha
(`tools/lint-vocabulario.py`, a ser escrito em `T-01`), e a divergencia e tratada como
bug de especificacao, nao de interpretacao.

## Termos

### autoria
Estagio 1 do pipeline. O LLM recebe um tema/brief e produz `manifesto.json` -- uma
descricao narrativa e estrutural do video. A saida nao e deterministica: a mesma entrada
pode produzir manifestos diferentes. O resultado e cacheado por `hash(brief + prompt +
modelo)`.

Exemplo: `just autoria:gerar --tema "como funciona um motor eletrico"` produz
`manifesto.json` com cenas, texto de locucao e referencias a nos visuais.

### barreira
Ponto de sincronizacao entre ondas. Nenhum card da onda N+1 comeca enquanto todos os
cards da onda N nao estiverem mergeados e com gate verde. A barreira e implementada
pelo orquestrador (nao por convencao humana).

Exemplo: a onda W4 (13 cards) so dispara depois que os 8 cards da W2 passaram pelo gate
e foram mergeados um a um.

### cassete
Resposta gravada de uma API externa (TTS, LLM, busca de midia), armazenada em
`fixtures/cassetes/<estagio>/`. Permite rodar o pipeline offline e com saida
reproduzivel. Um cassete e sosia, nao sucessor: nao "conserta" a resposta real -- se
a resposta real mudou, o cassete tem de ser regravado e o diff explicado.

Exemplo: `fixtures/cassetes/locucao/ola-mundo/` contem o audio e o timing retornados
pelo provedor de TTS para o texto "ola mundo", congelados para teste offline.

### composicao
Estagio 3 do pipeline. Funcao pura que recebe `manifesto-resolvido.json` + assets
enderecados por hash e produz a timeline de frames. Nenhum acesso a rede, nenhum
`Date.now()`, nenhum `Math.random()` sem seed. O determinismo e testado: renderizar
duas vezes produz bytes identicos.

Exemplo: `src/composicao/raiz.tsx` monta a arvore de componentes Remotion a partir do
manifesto resolvido.

### ducking
Tecnica de audio que atenua a musica de fundo durante a locucao para que a voz
permaneca inteligivel. Neste programa, o envelope de ducking e **calculado** a partir do
timing da locucao, nao aplicado por compressor em tempo de execucao -- compressores tem
saida nao-deterministica entre versoes.

Exemplo: um trecho de 3 segundos de locucao reduz o ganho da musica em -12 dB,
com ataque de 100 ms antes do inicio da fala e release de 200 ms apos o fim.

### fronteira (de determinismo)
A linha que separa os estagios impuros (autoria e resolucao) dos estagios puros
(composicao, render, pos/entrega). Acima da fronteira: nada e deterministico, tudo e
cacheado por hash. Abaixo da fronteira: tudo e deterministico, e o determinismo e
testado. Nenhuma URL, nenhum tempo relativo, nenhuma decisao pendente atravessa essa
linha.

Exemplo: `manifesto-resolvido.json` e o artefato que cruza a fronteira. Ele nao contem
URLs -- apenas hashes de conteudo que apontam para o store.

### gate
Ponto de verificacao que um card (ou onda) precisa passar para ser considerado concluido.
O gate local roda `bash tools/gate.sh` e tem tres estados: `PENDENTE` (nao executado),
`PASSOU` (verde) e `FALHOU` (vermelho). Todo gate exige sonda negativa: o comando que
prova que o trabalho foi feito **tem de** falhar se o trabalho nao tiver sido feito.

Exemplo: `just no:Cabecalho` renderiza o no Cabecalho e compara com o snapshot aprovado.
Se o snapshot for apagado, o comando **tem de** falhar (ausencia = vermelho).

### golden master
Conjunto de artefatos de referencia que representam a saida correta do pipeline.
Neste programa, o golden master nao e "o MP4 final" -- e o par
`(manifesto-resolvido, frames-chave)` mais os snapshots aprovados em
`fixtures/snapshots/`. O MP4 e derivado e nao e comparado byte a byte (o encoder muda
e tudo fica vermelho sem regressao real).

Exemplo: `fixtures/gm/` contem o manifesto-resolvido e os frames-chave da fixture
canonica, contra os quais toda mudanca e comparada.

### handoff
Mensagem estruturada que um agente escreve ao concluir um card, enderecada ao(s)
proximo(s) agente(s) da cadeia. E o unico canal de comunicacao entre ondas. Campos
obrigatorios: `destinatarios`, `o-que-fiz`, `arquivos-modificados`, `premissas`,
`bloqueios`. Um handoff sem campo `destinatarios` preenchido e invalido.

Exemplo: o agente do card `F0-01` escreve um handoff enderecado a `F0-02, F0-03, F0-04,
F0-05, T-02` -- todos os cards que dependem de `F0-01`.

### invariante
Regra que deve ser verdadeira em todo commit, verificada por script em `tools/invariantes/`.
Cada invariante tem uma mutacao calculada que o dispara, e o autoteste asserta a mensagem
de falha. Invariante que perde o objeto nao pode ser apagado -- vira `ausencia` e falha.

Exemplo: "todo projeto de teste e executado por algum job do CI" -- remover um projeto
do CI deixa o invariante vermelho.

### ledger
Registro de incerteza do programa. Itens que nao podem ser fechados agora por falta de
acesso, credencial ou maquina. Cada card escreve em `ledger/inbox/<CARD>.json` com faixa
de ids pre-alocada. O arquivo `ledger/aberto.json` e singleton -- nunca escrito por card,
apenas pelo orquestrador. Ids nunca sao reciclados.

Exemplo: `AB-950` -- "o enquadramento de uso continua pessoal?" -- e o unico item
permanentemente aberto, com gatilho de reabertura declarado.

### legenda
Texto sincronizado com o audio, gerado a partir do timing da locucao. O invariante
fundamental e em **segundos, nunca em frames**: `duracao >= max(0,833 s; caracteres/20)`
e `<= 7 s`. A legenda pode ser queimada no video ou entregue como sidecar (`.srt`, `.vtt`).

Exemplo: `src/sincronia/legendas/` produz legendas a partir do `timing.json` gerado
pela resolucao de locucao.

### loudness
Nivel de volume percebido, medido em LUFS (Loudness Units relative to Full Scale).
O padrao de broadcast e -23 LUFS (EBU R128) com true peak em -1 dBTP. A medicao e feita
**depois** da codificacao (codecs com perda alteram o true peak). Um entregavel fora do
alvo de LUFS bloqueia a entrega.

Exemplo: `ffmpeg -i video_final.mp4 -af loudnorm=I=-23:LRA=7:TP=-1:print_format=json -f null -`

### manifesto
Arquivo JSON gerado pelo LLM no estagio de autoria. Descreve a estrutura narrativa do
video: cenas, texto de locucao, referencias a nos visuais, transicoes. Validado contra
JSON Schema. E a saida do estagio 1 e a entrada do estagio 2.

Exemplo: `manifesto.json` contem `{"cenas": [{"id": "intro", "locucao": "Voce ja...",
"nos": [{"tipo": "cabecalho", "texto": "Motores Eletricos"}]}]}`.

### manifesto-resolvido
Manifesto apos o estagio de resolucao. Todas as referencias abstratas foram substituidas
por hashes de conteudo que apontam para o store. Nao contem URLs, nomes de arquivo
temporarios nem decisoes pendentes. E o artefato que cruza a fronteira de determinismo.

Exemplo: onde o manifesto tinha `{"tipo": "midia", "busca": "engine diagram"}`,
o manifesto-resolvido tem `{"tipo": "midia", "hash": "sha256:abc123..."}`.

### no
Componente visual que compoe um video. Cada no e um arquivo em `src/composicao/nos/<Nome>.tsx`
que exporta um contrato conhecido. A descoberta e por convencao (varredura de diretorio),
nunca por registro central. Exemplos: `Cabecalho`, `TextoDestaque`, `Lista`, `Midia`,
`Codigo`, `Grafico`.

### onda
Conjunto de cards que rodam em paralelo numa iteracao do programa. A onda e uma decisao
de escalonamento; o nivel e uma restricao derivada do grafo de dependencias. Invariante:
`onda(c) >= nivel(c)`. Nenhum card avanca ate a onda inteira fechar (barreira).

### oraculo
Mecanismo capaz de reprovar um estagio do pipeline. O ADR-0001 estabelece que nenhum
estagio comeca sem um oraculo capaz de reprova-lo. O oraculo pode ser: teste de
determinismo (2x identico), snapshot aprovado, invariante estrutural, golden master,
ou sonda negativa.

### PREP
Branch de preparacao (`PREP-<slug>`) onde o orquestrador escreve stubs, declara faixas
de ids e prepara singletons antes de abrir uma onda. Nenhum card de dominio escreve em
branch PREP -- e territorio exclusivo do orquestrador.

### preflight
Script executado antes de um card comecar (`tools/preflight.sh`). Verifica que o ambiente
da worktree esta integro: store acessivel, dependencias instaladas, ferramentas no PATH,
portas disponiveis. Falha antes de o agente tocar em codigo.

### procedencia
Registro da origem de cada asset que entra no video final: de onde veio, sob qual licenca,
em que data, com quais termos. Cobre assets **transitivos** (o que entrou dentro de um
grafico, de uma fonte, de um efeito). Permite reavaliar o ja produzido sem re-renderizar.

Exemplo: `src/entrega/procedencia/` gera um relatorio JSON que lista cada asset no video
final com sua origem, licenca e data de aquisicao.

### resolucao
Estagio 2 do pipeline. Cinco sub-estagios impuros e independentes: locucao (TTS),
grafico (Manim), midia externa, codigo (highlight), musica. Cada um produz assets
enderecados por hash e cacheia por `hash(entrada + versao do estagio)`. O manifesto
de entrada e enriquecido ate virar `manifesto-resolvido.json`.

### safe area
Regiao da tela onde o conteudo essencial permanece visivel em qualquer plataforma.
Para TV: 90% da largura e altura (5% de margem). Para vertical 9:16: zonas diferentes
do horizontal. Conteudo fora da safe area de qualquer plataforma alvo bloqueia a entrega.

### snapshot
Arquivo aprovado de referencia em `fixtures/snapshots/`. E imutavel: execucao divergente
escreve em `*.received/` e falha. Nenhum snapshot e aprovado a partir do Studio --
apenas do render de producao.

Exemplo: `fixtures/snapshots/no-Cabecalho/frame-000.png` e o snapshot aprovado do
primeiro frame do no Cabecalho. Se o codigo mudar e o frame divergir, o novo frame vai
para `frame-000.received.png` e o teste falha.

### store
Diretorio que armazena assets enderecados por conteudo (SHA-256). Append-only: escrita
atomica (tmp + rename). N escritores concorrentes do mesmo conteudo produzem um arquivo
e zero corrupcao. A chave de cache inclui **tudo** que muda a saida.

Exemplo: `store/audio/a1b2c3...wav` e o arquivo de audio da locucao "ola mundo",
enderecado pelo hash do texto + voz + provedor.

### timing
Estrutura de dados que mapeia cada palavra da locucao ao instante em que comeca e termina
no audio. E a ponte entre audio e imagem: legenda, destaque palavra-a-palavra e ducking
consonem o timing. O timing e monotonico (palavras em ordem, sem sobreposicao, sem
duracao negativa).

Exemplo: `timing.json` contem `[{"palavra": "motores", "inicio": 1.2, "fim": 1.7, ...}]`.

### worktree
Diretorio isolado criado com `git worktree add` onde um agente executa um card sem
interferir nos outros. Cards da mesma onda nascem em worktrees isoladas sobre a mesma
base. O agente **nunca** remove a propria worktree -- o orquestrador remove, de fora,
sob lock.

## O que este documento NAO cobre

- Sintaxe de ferramentas especificas (FFmpeg, Manim, Remotion) -- isso e dominio das skills
- Instrucoes de execucao de cards -- isso e dominio do PROGRAMA.html e dos handoffs
- Estrutura de diretorios -- ver `estrutura.md`
- Convencoes de codigo -- ver `convencoes.md`
- Schema JSON -- ver `schema/`
