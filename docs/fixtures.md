# Fixtures do Manifesto

> **Card:** F0-09 — Fixture canônica, o manifesto de referência
> **Skill:** timeline-manifest
> **Dono de:** fixtures/canonico/**, docs/fixtures.md

## Estrutura

```
fixtures/canonico/
  manifesto-valido.json           # Fixture canônica que exerce todos os tipos de nó
  manifesto-invalido-01-*.json    # 8 fixtures inválidas com classificação CONTRATO×BUG
  validar.py                      # Script de validação contra o schema
```

## Fixture canônica (`manifesto-valido.json`)

A fixture válida exerce todos os tipos de nó, transições, animações e áudio definidos no schema. Ela serve como:

1. **Golden master** para o validador — regressão do schema
2. **Referência de integração** — prova que Node e Python consomem o mesmo dado
3. **Entrada de teste** para o resolvedor de timeline
4. **Template** para quem escreve um manifesto novo

### Nós exercitados

| Tipo | IDs | O que exercita |
|---|---|---|
| `cabecalho` | n-001, n-015 | Com subtitulo + alinhamento centro; minimalista (sem subtitulo) |
| `texto` | n-002, n-014 | Com destaque=true + slide from-left; com destaque=false + alinhamento direita + entrada_frames=30 |
| `lista` | n-003, n-004 | Não-ordenada com scale; ordenada com spring + configuracao_mola |
| `midia` | n-005, n-006, n-007 | Imagem (cover + texto_alternativo), video (contain), gif (fill + entrada_frames) |
| `codigo` | n-008 | TypeScript com linhas_destaque, nome_arquivo, slide from-bottom |
| `grafico` | n-009..n-013 | Todos os 5 tipos: barras (com cor), linha, pizza (com cor), area, dispersao |

### Cenas exercitadas

| Cena | Transições | Áudio | Nós |
|---|---|---|---|
| c-001 | saida: fade | -- | n-001 |
| c-002 | entrada: slide left, saida: wipe right | -- | n-002, n-003 |
| c-003 | entrada: flip, saida: clockWipe com timing spring | -- | n-005, n-008, n-004 |
| c-004 | entrada: cube from-bottom | locucao + texto_locucao | n-009..n-013 |
| c-005 | entrada: none, saida: fade | locucao + texto_locucao | n-014, n-006, n-007, n-015 |

### Áudio global

Trilha sonora com volume 0.25 e inicio em frame 0.

### Edge cases cobertos

- `entrada_frames` com valor 0 (n-001, n-002) e valor > 0 (n-003=30, n-007=15, n-014=30)
- `animacao.tipo: "none"` (n-006)
- `animacao.tipo: "spring"` com `configuracao_mola` (n-004)
- `transicao.tipo: "none"` com `duracao_frames: 0` (c-005 entrada)
- `transicao` com `timing.kind: "spring"` + config (c-003 saida)
- `destaque: false` explicito (n-014) — default é false, mas o explicito testa o round-trip
- `alinhamento: "direita"` (n-014) — menos comum que centro/esquerda
- `ajuste: "fill"` em midia (n-007)
- `grafico.area` e `grafico.dispersao` (n-012, n-013) — os tipos menos usados
- `dados[].cor` presente em alguns gráficos e ausente em outros
- `audio_cena` com `texto_locucao` (c-004, c-005) — referencia para geração de legenda

## Fixtures inválidas — classificação CONTRATO x BUG

Cada fixture inválida testa uma violação específica do contrato. A classificação segue dois eixos:

- **CONTRATO**: o JSON Schema explicitamente rejeita este caso (ex.: enum inválido, required faltando, minimum violado, additionalProperties).
- **BUG**: o schema deveria rejeitar, mas não rejeita — seja porque a validação é de camada superior (integridade referencial entre arrays), seja porque o validador atual não cobre o caso.

### Tabela de classificação

| Fixture | Classificação | Violação | Erro esperado |
|---|---|---|---|
| `01-schema-version-faltando` | CONTRATO | `required` de topo ausente | `'schema_version' is a required property` |
| `02-tipo-no-invalido` | CONTRATO | `anyOf` sem match — `type: "invalido"` não casa nenhum `const` | `no anyOf match` |
| `03-duracao-negativa` | CONTRATO | `duracao_frames: -30` viola `minimum: 1` | `-30 is less than the minimum of 1` |
| `04-cabecalho-sem-texto` | CONTRATO | `NoCabecalho` sem campo obrigatório `texto` | `'texto' is a required property` |
| `05-cena-no-inexistente` | **BUG** | Cena referencia `n-999` que não existe no array `nos` | O JSON Schema valida que `nos[]` é string, mas não tem `$ref` cruzado entre arrays. A integridade referencial é da camada de negócio. |
| `06-propriedade-extra` | CONTRATO | `cor_fonte` não declarada, `additionalProperties: false` | `Additional properties are not allowed` |
| `07-transicao-tipo-invalido` | CONTRATO | `"explosao"` não está no enum de `Transicao.tipo` | `'explosao' is not one of ['slide','fade','wipe','flip','clockWipe','cube','none']` |
| `08-grafico-tipo-invalido` | CONTRATO | `"radar"` não está no enum de `tipo_grafico` | `'radar' is not one of ['barras','linha','pizza','area','dispersao']` |

### Nota sobre o caso BUG (05)

A fixture `05-cena-no-inexistente` é classificada como BUG porque o JSON Schema **não tem mecanismo para validar integridade referencial entre arrays**. O schema valida que `cena.nos[]` é um array de strings, mas não que cada string corresponde a um `id` no array `nos`. Essa validação é responsabilidade da camada de negócio (resolvedor de timeline). O `validar.py` cobre esse caso na validação estrutural (fallback sem jsonschema), mas com `jsonschema` puro ele escaparia — isso é documentado, não corrigido na fixture.

## Script de validação (`validar.py`)

### Uso

```bash
# Validar todas as fixtures
python3 fixtures/canonico/validar.py

# Validar uma fixture específica
python3 fixtures/canonico/validar.py --fixture fixtures/canonico/manifesto-valido.json

# Schema alternativo
python3 fixtures/canonico/validar.py --schema schema/manifesto.llm.schema.json

# Modo verboso (mostra erros detalhados)
python3 fixtures/canonico/validar.py --verbose

# Modo silencioso (só imprime erros)
python3 fixtures/canonico/validar.py --quiet
```

### Exit codes

| Código | Significado |
|---|---|
| 0 | Todas as fixtures válidas passaram e todas as inválidas foram rejeitadas |
| 1 | Erro de uso (arquivo ausente, JSON malformado) |
| 2 | **Regressão**: uma fixture válida foi rejeitada pelo schema |
| 3 | **Escape**: uma fixture inválida passou na validação |

### Dependências

- `jsonschema` (opcional): para validação completa draft 2020-12. Instalar com `pip install jsonschema`.
- Sem `jsonschema`: fallback para validação estrutural básica (cobre a maioria dos casos CONTRATO, mas não todos os detalhes do schema).

## Invariantes

1. **A fixture canônica sempre passa na validação.** Se `manifesto-valido.json` for rejeitado, o schema ou a fixture estão quebrados — é regressão.
2. **Toda fixture inválida CONTRATO é rejeitada pelo schema.** Se passar, o validador está com bug.
3. **A fixture BUG (05) é documentada como escape esperado** quando usando `jsonschema` puro. O `validar.py` no modo estrutural a detecta.
4. **Novas fixtures inválidas** devem ser adicionadas com classificação CONTRATO ou BUG documentada nesta tabela.
5. **O manifesto canônico não é saída de LLM.** Ele é escrito à mão e congelado. É o oráculo contra o qual saídas de LLM são comparadas (ver `timeline-manifest` SKILL.md §Validação como gate, item 6).

## Relação com outros artefatos

| Artefato | Relação |
|---|---|
| `schema/manifesto.schema.json` | Schema contra o qual as fixtures são validadas |
| `schema/manifesto.llm.schema.json` | Subset — a fixture válida também passa nele (relaxamento) |
| `src/contratos/manifesto.ts` | Tipos TypeScript — a fixture é um valor do tipo `Manifesto` |
| `src/design/tokens.ts` | Tokens de design — cores, durações e fontes referenciadas contextualmente |
