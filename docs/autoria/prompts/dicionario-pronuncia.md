versao: 1.0.0

# Dicionario de pronuncia pt-BR — termos tecnicos (fonte unica)

Fonte unica dos termos tecnicos e siglas com pronuncia nao-obvia para a
locucao em portugues do Brasil. **Nenhum outro arquivo do repositorio
define a pronuncia de termo listado aqui** — a locucao (F2-03) consome
este arquivo; os prompts da autoria o aplicam por referencia. Um termo
novo entra neste arquivo, nunca em outro lugar (teste
`tests/prompts/prompts.test.ts`, suite "dicionario").

O arquivo guarda o **termo e a pronuncia pretendida** em ortografia
pt-BR simples — o adaptador do provedor de TTS a serializa no formato
dele (`<sub>`, lexico PLS, `custom_pronunciations`), e o roteiro de
locucao pode embutir a forma por extenso. **Nunca guarde SSML pronto de
um provedor** (ADR-0010, skill tts-voiceover: SSML nao e portatil entre
provedores e na voz errada e aceito e ignorado).

## Formato

| Termo | Pronuncia pretendida (pt-BR) | Orientacao para o texto da locucao |
|---|---|---|
| Kubernetes | ku-ber-ne-tes, tonica em "ber" | manter o termo como esta; nao soletrar |
| PostgreSQL | pos-tres-que-el | soletrar letra a letra a partir de "pos-tres" |
| async/await | a-sinc (barra) a-uéit | dizer a palavra "barra" entre as duas |
| Docker | do-ker, tonica em "do" | manter o termo |
| Django | djan-go, "dj" como em "djonga" | manter o termo |
| Node.js | nodj, uma silaba com "dj" suave | manter o termo |
| GIF | guif (consoante como em "guitarra") | manter o termo; nao usar "jif" sem audicao |
| SQL | es-que-el, letra a letra | soletrar; nao usar "sequel" sem audicao |
| Linux | li-nux, "x" como em "taxi" | manter o termo |
| Nginx | en-jin-eks ("engine-x") | manter o termo |
| MySQL | mai-es-que-el | soletrar a partir de "mai" |
| MongoDB | mon-go-de-be | soletrar a partir de "mon-go" |
| JSON | jei-son, "j" como em "jeito" | manter o termo |
| Cache | cachi (como "quiche" em ingles) | manter o termo |
| TypeScript | taip-screipt | manter o termo |
| JavaScript | java-screipt | manter o termo |

## Frase-canario (skill tts-voiceover, R13)

Exercita sigla, produto e barra numa frase so. Sintetizar e **ouvir** e
o unico teste — nenhum gate automatico pega pronuncia errada:

> O Kubernetes orquestra containers e o PostgreSQL usa async/await

## Como estender

1. Acrescente a linha na tabela, com pronuncia pretendida e orientacao.
2. Rode `just prompts-testar` (o teste exige que o termo tenha
   orientacao e que a tabela nao tenha linha duplicada).
3. Na maquina-alvo com o provedor de TTS, sintetize a frase-canario com
   o termo inserido e ouca; ajuste a pronuncia pretendida se divergir
   (item AB-573 do ledger — as pronuncias deste arquivo sao
   provisorias ate a audicao no provedor real).

## Controle (metadados do arquivo)

- versao_contrato_autoria: v1 (contrato-w5 §3; AB-432/AB-433)
- consumido_por: prompt-decomposicao-narrativa.md, prompt-roteiro-locucao.md, prompt-autoria-principal.md
- caso_de_referencia: embutido (frase-canario acima); este arquivo nao e prompt
- fonte_canario: docs/pesquisa/R13-tts-locucao.md:330 (congelado no commit 8737ad6)
