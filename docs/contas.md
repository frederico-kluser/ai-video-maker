# Contas, chaves e quotas por provedor

> **Card:** `I-02` (W2.5) | **Data de pesquisa:** 2026-08-11
> **Artefatos:** `.env.example` (este arquivo referenciado) | ADR-0005 (politica de segredos)
> **Bloqueia:** estagios de resolucao (W4)

Este documento tabula, para cada provedor que o programa usa, o limite publicado
hoje, a obrigacao de cache ou renovacao de URL, e a exigencia de atribuicao como
condicao da chave de producao. E esta resposta que dimensiona a concorrencia da
W4 -- nao o palpite.

---

## Tabela consolidada

| Provedor | Produto | Quota publicada | Limite de gasto | Obrigacao de cache | Atribuicao | Condicao para chave de producao |
|---|---|---|---|---|---|---|
| **Anthropic** | Claude API (Messages) | Start: 1.000 RPM, 500K ITPM, 100K OTPM (Fable 5) / 2M ITPM, 400K OTPM (Opus 4.x, Sonnet 4.x) | US$ 500/mes (Start) | Cache-aware ITPM: tokens cacheados nao contam para rate limit (exceto Haiku 3.5). Prompt caching com write de 5 min (1.25x) ou 1 h (2x), read a 0.1x. | AUP: divulgar IA ao usuario final em dominios de alto risco (legal, saude, financas) e em chatbots. Sem exigencia geral de atribuicao para geracao de conteudo. | Conta com historico de uso e credito. Tier sobe automaticamente com uso. |
| **OpenAI** | TTS (tts-1, tts-1-hd, gpt-4o-mini-tts) | tts-1: 500 RPM (T1), 2.500 (T2), 5.000 (T3), 10.000 (T5) | Pre-pago por uso | Sem obrigacao de cache documentada. URLs de audio sao efemeras (via API, nao ha URL persistente). | **OBRIGATORIO:** "provide a clear disclosure to end users that the TTS voice they are hearing is AI-generated and not a human voice" | Conta OpenAI com credito. Tiers sobem com gasto acumulado (T1: US$ 5 pagos). |
| **GIPHY** | Search API (GIFs, stickers) | Beta: 100 chamadas/h, 50 objetos/busca. Producao: sob consulta. | Gratuito (beta). Producao: precificacao negociada. | **PROIBIDO cache** de URLs de midia ou copias sem aprovacao explicita. Se aprovado, usar revalidacao de cache exigida pela GIPHY. Hotlink direto obrigatorio -- nao proxy. | **OBRIGATORIO:** "conspicuously display 'Powered By GIPHY' attribution marks where the API is utilized" | Aplicacao formal. Time da GIPHY entra em contato para discutir precificacao. Nao misturar com outros provedores na mesma grade. |
| **Pexels** | API (fotos, videos) | 200 req/h, 20.000 req/mes | Gratuito | Sem obrigacao de cache documentada. URLs de midia sao fornecidas diretamente. | **OBRIGATORIO:** link proeminente para Pexels + creditar fotogafos quando possivel ("Photos provided by Pexels") | Demonstracao de atribuicao (video demo, screenshots ou call). Limites maiores sao gratuitos. |
| **Pixabay** | API (musica, efeitos sonoros) | Ilimitado (sem teto documentado por chave) | Gratuito | Sem obrigacao de cache documentada. | **NAO obrigatorio** (Pixabay Content License). Uso comercial permitido. Nao pode revender o arquivo isolado. | Chave gratuita via cadastro. Sem upgrade necessario. |

---

## Notas por provedor

### Anthropic (Claude API)

- **Fonte:** https://platform.claude.com/docs/en/api/rate-limits (acessado 2026-08-11)
- **Precificacao:** https://platform.claude.com/docs/en/about-claude/pricing
- Os limites sao por **organizacao**, nao por chave. Varias chaves na mesma org compartilham o mesmo pool.
- O tier inicial para contas novas pode ser "Evaluation", com limites abaixo do Start tier, ate estabelecer historico.
- Batch API: 50% de desconto, limites separados.
- Cache-aware ITPM e uma vantagem significativa: com 80% de cache hit rate, o throughput efetivo e ~5x o limite nominal de ITPM.
- **AUP:** https://www.anthropic.com/legal/aup -- divulgar IA em dominios de alto risco e chatbots.

### OpenAI (TTS)

- **Fonte:** https://developers.openai.com/api/docs/guides/text-to-speech (acessado 2026-08-11)
- **Fonte de limites:** https://developers.openai.com/api/docs/models/tts-1 (acessado 2026-08-11)
- **Modelos:**
  - `tts-1`: US$ 15/1M caracteres, otimizado para tempo real
  - `tts-1-hd`: US$ 30/1M caracteres, qualidade premium
  - `gpt-4o-mini-tts`: US$ 0,60/1M tokens input + US$ 12/1M tokens audio output, prosodia controlavel
- A exigencia de divulgacao ("clear disclosure") e **contratual**, nao apenas recomendacao. Esta na pagina de documentacao do endpoint TTS.
- O audio e retornado como blob na resposta da API -- nao ha URL persistente para cache.

### GIPHY

- **Fonte:** https://developers.giphy.com/docs/ (acessado 2026-08-11)
- A restricao de cache e a mais restritiva entre todos os provedores: nao basta nao cachear -- e proibido proxyar requests e modificar URLs.
- O modelo de chave beta → producao implica que o programa, enquanto uso pessoal, opera com a chave beta (100 req/h).
- A proibicao de misturar conteudo GIPHY com outros provedores na mesma grade e relevante para o design do seletor de assets.

### Pexels

- **Fonte:** https://www.pexels.com/api/documentation/ (acessado 2026-08-11)
- **Fonte de limites:** https://help.pexels.com/hc/en-us/articles/900005368726 (acessado 2026-08-11)
- Headers de rate limit: `X-Ratelimit-Limit`, `X-Ratelimit-Remaining`, `X-Ratelimit-Reset` (apenas em respostas 2xx).
- Limites maiores sao gratuitos mediante demonstracao de atribuicao -- relevante para a W4 se a concorrencia exigir >20.000 req/mes.

### Pixabay

- **Fonte:** https://pixabay.com/service/about/api/ (acessado 2026-08-11)
- **Licenca:** https://pixabay.com/service/license-summary/ (acessado 2026-08-11)
- A ausencia de exigencia de atribuicao e de teto de requisicoes torna o Pixabay o provedor mais flexivel para musica e efeitos sonoros.
- A restricao "nao revender o arquivo isolado" nao afeta o programa: o audio vai incorporado no video final, nao distribuido como faixa separada.

---

## Impacto na concorrencia da W4

A W4 (estagios de resolucao) roda em paralelo e faz chamadas a todos os provedores acima.
A concorrencia maxima segura e determinada pelo **gargalo**:

| Provedor | Gargalo relevante para W4 | Concorrencia maxima segura (estimativa) |
|---|---|---|
| Anthropic | 2M ITPM (Start, Sonnet 4.x) | 10-20 agentes paralelos (assumindo ~50K tokens/request) |
| OpenAI TTS | 500 RPM (T1) | Muito acima do necessario (cada video usa ~1-2 chamadas TTS) |
| GIPHY | 100 req/h (beta) | **GARGALO**: 1-2 agentes fazendo busca de GIFs em paralelo |
| Pexels | 200 req/h, 20.000 req/mes | 3-5 agentes fazendo busca de fotos/videos em paralelo |
| Pixabay | Ilimitado | Sem restricao |

**Conclusao:** O GIPHY (chave beta, 100 req/h) e o gargalo. Se a W4 precisar de mais
que ~100 buscas de GIF por hora, e necessario: (a) solicitar chave de producao GIPHY,
ou (b) cachear resultados de busca (com aprovacao explicita da GIPHY), ou (c) reduzir
a concorrencia da W4 para o teto do GIPHY.

---

## Fontes

- Anthropic Rate Limits: https://platform.claude.com/docs/en/api/rate-limits
- Anthropic Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- Anthropic AUP: https://www.anthropic.com/legal/aup
- OpenAI TTS: https://developers.openai.com/api/docs/guides/text-to-speech
- OpenAI Rate Limits: https://developers.openai.com/api/docs/guides/rate-limits
- OpenAI TTS-1 Model: https://developers.openai.com/api/docs/models/tts-1
- GIPHY Developers: https://developers.giphy.com/docs/
- GIPHY API Terms: https://support.giphy.com/hc/en-us/articles/360028134111-GIPHY-API-Terms-of-Service
- Pexels API: https://www.pexels.com/api/documentation/
- Pexels Rate Limits: https://help.pexels.com/hc/en-us/articles/900005368726
- Pixabay API: https://pixabay.com/service/about/api/
- Pixabay License: https://pixabay.com/service/license-summary/