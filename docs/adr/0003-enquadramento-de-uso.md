# ADR-0003: Enquadramento de uso -- uso pessoal (P-01, e com ele P-02..P-04)

- **Status:** ACEITO (sign-off de fredericokluser, 2026-08-11)
- **Data:** 2026-08-11
- **Card:** `I-01` (onda W0.5). Depende de: nenhum. Consumida por: `F2-04`, `F2-06`, `F5-06`, `I-02`, `I-04`.
- **Supera, no que diverge:** `docs/00-panorama-verificado.md` §6.1 (P-01..P-04 deixam de ser perguntas abertas -- passam a fechadas com a condição de escopo abaixo)
- **Reafirma explicitamente:** ADR-0001 §Guarda executável, ADR-0002 §Restrições (fronteira negativa)
- **Guarda executável:** `rg -L "condição de escopo" docs/adr/0003-enquadramento-de-uso.md` -- se este ADR não contiver "condição de escopo", a saída lista o arquivo e o gate falha; se contiver, a saída é vazia e o gate passa.
- **Itens de ledger ligados:** `AB-950` (aberto, único item permanentemente aberto do ledger -- ver gatilho de reabertura abaixo)

## Contexto

A pesquisa (`docs/00-panorama-verificado.md`) isolou **18 perguntas ao dono** (P-01..P-18). As
quatro primeiras (P-01..P-04) são sobre licenciamento e uso comercial, e três delas (P-02..P-04)
dependem da resposta de P-01: o enquadramento da entidade que opera o programa.

As quatro perguntas são:

- **P-01:** O projeto é pessoal ou da empresa? O e-mail da sessão é `@grupofleury.com.br`, o que
  introduz a ambiguidade. A licença do Remotion (`LICENSE.md` 4.x) estabelece que organização com
  fins lucrativos e **mais de 3 empregados** não é elegível à Free License -- o gatilho é o tamanho
  da organização, não o número de pessoas que escrevem código Remotion. `[R01-02 (3-0)]`

- **P-02:** Se houver licença: Creators (US$ 25/Seat/mês) ou Automators (US$ 0,01/render, piso
  US$ 100/mês)? A FAQ do Remotion se contradiz para o cenário de render local de baixo volume
  `[R01-09 (1-1)]`, e o dado que decidiria (renders/dia reais) só existe se for coletado desde o
  primeiro card.

- **P-03:** Podemos usar GIFs da GIPHY em vídeos publicados/monetizados? O User ToS da GIPHY
  proíbe expressamente *"exploit any content for commercial use"* `[R08-05 (2-0)]`. Um MP4
  exportado com um GIF da GIPHY, publicado num canal monetizado, cai em copy + modify + publish +
  distribute + display + exploit for commercial use simultaneamente.

- **P-04:** TTS e música: qual provedor, e o vídeo declara que a voz é sintética? Os pesos de
  modelos locais como XTTS-v2 (Coqui Public Model License), checkpoints do F5-TTS (CC-BY-NC) e
  OpenAudio S1-mini (CC-BY-NC-SA) **proíbem uso comercial** `[R13-20 (2-0)]` `[R13-21 (2-0)]`,
  mesmo com código permissivo. A OpenAI exige contratualmente informar o usuário final de que a
  voz é IA.

**Premissa vinculante:** R01-05 confirma que **não existe diferença de funcionalidade entre free
e pago** no Remotion. Logo, uma mudança de escopo (de pessoal para empresa) **não produz nenhum
sinal técnico** -- o pipeline continua verde, o compliance é invisível. `[R01-05 (2-0)]`

**Consequência estrutural:** enquanto P-01 e P-03 estiverem abertas, nenhum card de composição
pode ser marcado como concluído em regime de produção. Esta é a razão de `I-01` ser a meia-onda
W0.5, executada **antes** de qualquer card de domínio.

## Decisão

### D1 -- Uso pessoal

O escopo de uso deste programa é **pessoal**. O programa é operado por uma pessoa física, fora do
escopo de trabalho, sem vínculo a nenhuma organização com fins lucrativos.

Esta decisão responde P-01 e, com ela, fecha P-02, P-03 e P-04 de uma vez.

### D2 -- Remotion: Free License (P-01 e P-02)

Sob uso pessoal, a Free License do Remotion cobre integralmente o uso do motor. O gatilho de
"organização com fins lucrativos e mais de 3 empregados" `[R01-02 (3-0)]` **não se aplica** a
uma pessoa física operando fora do escopo de trabalho.

A pergunta P-02 (Creators vs. Automators) perde o objeto: não há entidade comercial para
licenciar. O campo `license` no `package.json` continua declarando a licença do Remotion como
proprietária, e o gate de compliance continua citando o `LICENSE.md` do repositório como fonte
de verdade (`R01-01`).

### D3 -- Provedor de GIF: biblioteca própria, sem GIPHY (P-03)

Sob uso pessoal, a cláusula do User ToS da GIPHY que proíbe *"exploit any content for commercial
use"* `[R08-05 (2-0)]` **não veda o uso pessoal** -- mas o card de reação (`F2-04`) adota
**biblioteca própria + `@remotion/animated-emoji` (CC BY 4.0)** como fonte primária, por duas
razões: (a) a fronteira entre "pessoal" e "comercial" num canal monetizado do YouTube é
juridicamente cinzenta, e (b) o limite de 100 req/h da chave beta da GIPHY `[R08-01 (2-0)]`
estoura rapidamente em worktrees paralelas com retry, independentemente do enquadramento.

A GIPHY **não é proibida** -- ela é **preterida** por razões técnicas e de clareza jurídica. Se
o dono quiser reavaliar, o caminho é reabrir P-03 como pergunta separada, com registro escrito
da decisão e watermark "Powered By GIPHY" dentro do vídeo `[R08-06]`.

### D4 -- TTS: pesos não-comerciais passam a ser elegíveis (P-04)

Sob uso pessoal, as licenças não-comerciais dos pesos de TTS -- XTTS-v2 (Coqui Public Model
License), checkpoints do F5-TTS (CC-BY-NC), OpenAudio S1-mini (CC-BY-NC-SA) `[R13-20 (2-0)]`
`[R13-21 (2-0)]` -- **não bloqueiam o uso**. O programa pode considerar modelos locais com
pesos NC, além dos já permitidos Apache-2.0 (Kokoro-82M, Dia-1.6B, Sesame CSM-1B, Orpheus)
e MIT (Chatterbox, com marca d'água Perth).

Os modelos sob Apache-2.0 e MIT continuam sendo a primeira escolha por não terem restrição de
licença em nenhum cenário. Os modelos NC são elegíveis, mas o card de voz (`F3-01`) deve
registrar a licença no campo obrigatório do manifesto do provedor, porque o gate de publicação
(`F5-06`) precisa saber o que está embutido no vídeo.

A obrigação de disclosure da OpenAI (informar que a voz é IA) continua valendo
**independentemente do enquadramento** -- é um termo de uso do provedor, não uma cláusula
comercial.

## Alternativas consideradas / descartadas

### Alternativa A: "Uso pessoal, mas tratar como empresa para não ter surpresa"

**Descartada.** O custo é real e imediato: Company License a partir de US$ 100/mês (piso
Automators), sem benefício técnico correspondente (R01-05: não há diferença de funcionalidade).
A "surpresa" que esta alternativa tenta evitar é exatamente o que o gatilho `AB-950` cobre --
e o gatilho é verificável, enquanto o custo mensal é certo.

### Alternativa B: "Não decidir agora, deixar P-01..P-04 abertas"

**Descartada.** A consequência estrutural está documentada no panorama: enquanto P-01 e P-03
estiverem abertas, nenhum card de composição pode ser marcado como concluído em regime de
produção. Adiar a decisão é adiar o programa inteiro.

### Alternativa C: "Uso pessoal, mas usar GIPHY mesmo assim"

**Descartada como fonte primária.** A GIPHY não está proibida, mas dois fatores independentes
convergem contra: o limite técnico de 100 req/h (que não depende do enquadramento) e a zona
cinzenta jurídica de "pessoal" vs. "comercial" num canal monetizado. A biblioteca própria +
emoji animado CC BY 4.0 resolve os dois.

## Consequências

### Positivas

1. **Quatro perguntas fechadas com uma decisão.** P-01..P-04 deixam de ser bloqueantes. O
   programa pode avançar para os cards de domínio sem gate de licença.

2. **Três cards desbloqueados.** `F2-04` (biblioteca de reação), `F2-06` (biblioteca de
   música) e `F5-06` (relatório de procedência) tinham dependência indireta de P-01..P-04 e
   agora podem ser executados.

3. **Leque de TTS ampliado.** Modelos locais com pesos NC (XTTS-v2, F5-TTS, OpenAudio)
   passam a ser elegíveis. O ADR-0009 (Origem do timing) ganha opções que antes estavam
   bloqueadas.

4. **Custo zero de licenciamento.** Nenhum contrato comercial é necessário para começar.
   O programa opera integralmente sob Free License, com a condição de escopo abaixo.

### Custos e desvios registrados

1. **O item `AB-950` nasce aberto e permanece aberto.** É o único item permanentemente
   aberto do ledger. Cada gate de publicação, cada relatório de procedência e cada handoff
   de card de composição deve declarar "AB-950 continua fechado" ou "AB-950 disparou" --
   nunca omitir. O custo é uma linha por artefato; o benefício é que a mudança de escopo
   não passa despercebida.

2. **A GIPHY é preterida, não proibida.** Se o dono quiser reavaliar, o caminho é reabrir
   P-03 como pergunta separada. Mas reabrir P-03 **não reabre** P-01, P-02 ou P-04 -- cada
   uma tem seu próprio gatilho.

3. **A pergunta P-04 não está 100% fechada.** A elegibilidade dos pesos NC está decidida,
   mas a escolha do provedor e a obrigação de disclosure continuam como escopo do card
   `F3-01` e do ADR-0009. O que este ADR fecha é a **vedação** por licença NC -- ela não
   se aplica mais.

## Revisão adversarial

**Pergunta:** "Uso pessoal" com canal monetizado no YouTube não é uso comercial? A fronteira
é cinzenta.

**Resposta:** A licença do Remotion distingue entre "uso comercial do vídeo" (permitido,
`R01-06`) e "uso comercial do Remotion" (gatilho da Company License). A monetização do vídeo
no YouTube é o primeiro caso. O que a licença do Remotion veda é vender/relicenciar um
derivado do próprio Remotion, e a Free License cobre *"companies or individuals to create
videos for commercial purposes"* desde que a organização não exceda 3 empregados. Para uma
pessoa física, o limite não se aplica.

**Pergunta:** E se a pessoa física abrir um CNPJ amanhã?

**Resposta:** Esse é exatamente o gatilho `AB-950`. O ledger exige reabertura no evento
"organização com fins lucrativos e mais de 3 empregados". Um CNPJ sem empregados não dispara
o gatilho da licença 4.x (o gatilho é o tamanho da organização, não a existência de CNPJ).
Se o CNPJ contratar o 4º empregado, o gatilho dispara e o ADR é reaberto.

**Pergunta:** O Remotion 5.0 pode mudar os termos. Este ADR sobrevive a isso?

**Resposta:** Não -- e este ADR declara isso explicitamente. O panorama estabelece que o
evento "`dist-tags.latest` deixa de começar com `4.0.`" é o gatilho de re-pesquisa de R01,
R02, R05, R11 e R12 de uma vez (`R01-11`). Se o 5.0 redefinir "uso pessoal", este ADR é
reaberto. Enquanto o 4.x for a versão corrente, a decisão vale.

## O que este ADR NÃO decide / explicitamente fora de escopo

- **Não decide canal ou política editorial.** Isso é `I-04` (ADR-0007).
- **Não decide provedor de TTS.** Isso é `F3-01` (ADR-0009). Este ADR apenas remove a
  vedação por licença NC.
- **Não decide se o vídeo será publicado ou monetizado.** Isso é `F6-01` e `I-04`. A
  decisão é sobre **uso**, não sobre publicação.
- **Não autoriza estender o sign-off a outro repositório.** O enquadramento é deste
  programa, neste repositório.
- **Não autoriza tratar "pessoal" como "empresa de 1 pessoa".** Pessoa física operando
  fora do escopo de trabalho não é uma organização com fins lucrativos. Se a operação
  migrar para um CNPJ, o gatilho `AB-950` é avaliado -- e o que dispara é o número de
  empregados, não a existência do CNPJ.

## Condição de escopo

Todas as decisões deste ADR (D1..D4) são verdadeiras **sob a condição de que o uso do
programa continua sendo pessoal, por uma pessoa física, fora do escopo de trabalho, sem
vínculo a organização com fins lucrativos com mais de 3 empregados.**

Se esta condição deixar de ser verdadeira, **todas as quatro decisões caem simultaneamente**
e as perguntas P-01..P-04 voltam ao estado "abertas". O item `AB-950` do ledger de incerteza
é o mecanismo de reabertura.

## Gatilho de reabertura (AB-950)

**Evento:** "organização com fins lucrativos e mais de 3 empregados".

**O que o evento dispara:** reabertura deste ADR. As quatro decisões (D1..D4) voltam ao
estado PROPOSTO. P-01..P-04 voltam a ser perguntas abertas. Todos os cards que consomem
este ADR (`F2-04`, `F2-06`, `F5-06`) precisam ser reavaliados.

**Como o evento é detectado:** não há sinal técnico (R01-05). A detecção é por declaração
do dono. O ledger exige que todo gate de publicação, relatório de procedência e handoff de
card de composição declare "AB-950 continua fechado" -- a omissão é falha de gate. O item
nunca é fechado; ele é verificável por estar sempre presente, nunca por estar ausente.

**O que NÃO dispara o gatilho:**
- Abertura de CNPJ sem empregados (ou com até 3 empregados)
- Monetização do vídeo no YouTube (R01-06: permitido)
- Publicação do vídeo em qualquer plataforma
- Mudança de provedor de TTS, GIF ou música

## Limites do que é verificável aqui

1. **A guarda executável verifica a presença da condição de escopo no texto.** Ela não
   verifica se a condição é verdadeira no mundo real -- isso é impossível por software
   (R01-05: não há diferença de funcionalidade entre free e pago).

2. **O gatilho `AB-950` é verificável por declaração, não por detecção automática.**
   O `validate-ledger.py` (quando existir) verifica que o item existe, que declara o
   evento de reabertura, e que não foi fechado sem evidência. Ele não detecta a mudança
   de escopo -- isso exige declaração do dono.

3. **A fronteira "pessoal vs. comercial" na monetização do YouTube é cinzenta por
   natureza.** Este ADR não a resolve -- ele registra que a licença do Remotion permite
   "commercial purposes" para o vídeo (R01-06) e que o gatilho da Company License é o
   tamanho da organização, não a monetização do vídeo.

## Adendo do sign-off (2026-08-11)

### O que o aceite autoriza

- Iniciar os cards de domínio (`F2-04`, `F2-06`, `F5-06`) sob enquadramento de uso pessoal
- Operar o Remotion sob Free License, sem contrato comercial
- Usar modelos TTS com pesos sob licença não-comercial (XTTS-v2, F5-TTS ckpt, OpenAudio)
- Usar `@remotion/animated-emoji` (CC BY 4.0) como fonte de reação
- Publicar e monetizar o vídeo produzido (R01-06: permitido)

### O que o sign-off NÃO autoriza

- **Operar o programa sob CNPJ com mais de 3 empregados** sem reabrir este ADR. O gatilho
  `AB-950` existe exatamente para isso, e ignorá-lo é violação da licença do Remotion
  (`R01-02`).
- **Estender a decisão "uso pessoal" a qualquer outro repositório ou projeto.** O
  enquadramento é deste programa, neste repositório.
- **Usar conteúdo da GIPHY em vídeos publicados** sem reabrir P-03 como pergunta separada.
  A GIPHY foi preterida (D3), não proibida -- mas reavaliá-la exige decisão registrada.
- **Publicar vídeo com voz de IA sem disclosure** -- a obrigação da OpenAI é um termo de
  uso do provedor, não uma cláusula comercial, e continua valendo independentemente do
  enquadramento.
- **Tratar "pesos NC são elegíveis" como "pesos NC são recomendados".** Modelos Apache-2.0
  e MIT continuam sendo a primeira escolha. Modelos NC são elegíveis, não preferenciais.
- **Dispensar o campo `license` no manifesto do provedor de voz.** O gate de publicação
  (`F5-06`) precisa saber o que está embutido no vídeo, e a licença dos pesos é parte
  disso.
- **Assumir que o Remotion 5.0 manterá os mesmos termos.** O evento "`dist-tags.latest`
  deixa de começar com `4.0.`" é o gatilho de re-pesquisa (`R01-11`), e este ADR declara
  que não sobrevive a ele sem reavaliação.