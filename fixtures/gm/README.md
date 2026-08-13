# Golden master de ponta a ponta — fixtures/gm/ (card F5-08, W10)

Este diretorio e o **oraculo final** do programa: o que `just produzir
--fixture canonico --estrito` tem de produzir, congelado byte a byte.
O gate e `just gm-e2e` (ADR-0044; o PROGRAMA.html cita a forma `gm:e2e` —
este justfile usa hifen, a convencao das demais receitas).

## O que o golden compara (e por que nao e o MP4)

| Item | O que e | Por que |
|---|---|---|
| `manifestos/manifesto-resolvido.json` | artefato 1 do pipeline | JSON deterministico; cobre classe de erro mais frequente (tempo/estrutura) |
| `manifestos/mix-documento.json` | MixDocument.1 (ADR-0034) | documento do mix com pin de ferramentas |
| `manifestos/pos-documento.json` | PosDocument.1 (ADR-0040) | alvo/gain/medicoes do pos |
| `manifestos/relatorio-final.json` | RelatorioFinal.1 — o INDICE de hashes dos 11 artefatos | qualquer mudanca de hash de QUALQUER artefato (m4a, srt, thumbnail, variante, mp4) muda o relatorio-final — o golden cobre os 11 sem capturar os 11 |
| `frames/frame-<N>.png` | frames-chave extraidos do **master.mov** (QTRLE/argb — o render deterministico da chave C7) | o MP4 final carrega a versao do encoder — comparar o MP4 byte a byte e falso oraculo. QTRLE e lossless e deterministico |
| `audio/envelope.json` | envelope do **master.wav** do mix (RMS por janela de 100 ms, por canal) | uma regressao de AUDIO sem regressao de VIDEO muda o envelope e o gate acende |

Os frames-chave e os motivos de cada escolha estao no `manifesto.json`
(indice): inicio do video, primeira moldura de cada cena (fronteiras de
transicao — interpolacao exercida), meio das cenas representativas
(grafico e codigo) e fim. A lista e **derivada** do manifesto da fixture
pelas mesmas funcoes do render (`planoDeComposicao`) e gravada no indice;
o gate usa a gravada, para uma fixture que mude acender o diff em vez de
deslocar a amostragem.

## O que o golden NAO cobre (escrito, como o card exige)

- **O MP4 final byte a byte** — o encoder muda (oraculo falso). O golden
  compara os frames decodificados do master deterministico e o indice de
  hashes (relatorio-final), nunca o container.
- **Timing palavra a palavra da locucao** — o envelope por janela de
  100 ms pega mudanca de ganho e de duracao grossa; um deslocamento
  menor que uma janela pode passar.
- **O 9:16** — o estrito e 16:9-only (ADR-0042, decisao 4); nenhum
  artefato 9:16 existe na lista fechada.
- **A rede** — o render estrito e offline por construcao; bloquear rede
  e o offline-guard, nao este golden.
- **A maquina** — sem container, o baseline vale **somente na maquina
  que o capturou** (ffmpeg 6.1.1 e chrome-headless-shell pinados pelo
  Remotion 4.0.507). O indice registra `captura.maquina`.

## Como o gate prova a sensibilidade (∅-crit)

`just gm-e2e` roda `tools/gm/gate.ts`:

1. **P0** — presenca: apagar qualquer item do golden fica VERMELHO
   nomeando o item (nunca "nada a comparar").
2. **R1** — producao com cache FRIO e extracao: os 13 itens tem de sair
   byte a byte identicos ao golden (a regeneracao do card).
3. **R2** — re-execucao com o MESMO cache (quente): bytes identicos a
   R1 (2x identico, incluindo o caminho do cache).
4. **S0** — pin: ffmpeg 6.1.1 e node registrados; chave C7 recomputada
   da saida == chave do golden (versao de ferramenta por PIN, sem
   re-render).
5. **M1/M2** — mutacao de token (`background.primary`) e de fonte
   (`Inter-Regular.woff2`): o diff TEM de acender (com cache frio), e
   cada arquivo mutado e restaurado byte a byte e conferido.

## Como regenerar (re-baseline — ato explicito)

```sh
just gm-capturar            # producao fresca (cache frio) + captura em fixtures/gm/**
# ou, de uma saida existente do pipeline:
npx tsx tools/gm/capturar.ts --no-run --saida <dir-da-execucao>
```

Regenerar o golden **e re-aprovar o oraculo**: so para divergencia
classificada como BUG-A-DIVERGIR (ADR nominal — `docs/adr/0044-*.md`),
nunca para "parar de piscar". O indice registra o commit da captura.
