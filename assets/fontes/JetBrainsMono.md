# JetBrains Mono — ficha de licenca

Ficha obrigatoria (F1-03). Toda fonte embutida em `assets/fontes/` tem uma ficha
que declara **o direito de embutir**, que e uma permissao separada do direito de
usar e do direito de redistribuir.

## Identificacao

familia: JetBrains Mono
arquivos: JetBrainsMono-Regular.woff2
versao: 2.304 (ttfautohint v1.8.4.7-5d5b)
formato: WOFF2 (TrueType outlines)
origem: https://github.com/JetBrains/JetBrainsMono
upstream_release: https://github.com/JetBrains/JetBrainsMono/releases

## Licenca

licenca: SIL Open Font License, Version 1.1
licenca_arquivo: OFL.txt
licenca_url: https://openfontlicense.org/documents/OFL.txt
licenca_faq: https://openfontlicense.org/documents/OFL-FAQ.txt
titular: Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)
reserved_font_name: nenhum declarado no OFL.txt upstream
fonte_do_texto: https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt

Atencao: o aviso upstream nao tem `(c)` — le-se literalmente
`Copyright 2020 The JetBrains Mono Project Authors (...)`. O nome do titular e
*The JetBrains Mono Project Authors*, nao *JetBrains s.r.o.*; a tabela `name`
ID 0 do proprio arquivo confirma.

## Direito de embutir

direito_de_embutir: SIM
os2_fstype: 0x0000 (Installable Embedding — sem restricao de embutir)

Tres evidencias independentes, nesta ordem de forca:

1. **Bit de permissao no proprio binario.** `OS/2.fsType == 0x0000` significa
   *Installable Embedding*: o arquivo nao carrega nenhuma restricao de embutir.
   Um valor `0x0002` (*Restricted License Embedding*) proibiria. Este bit e
   verificado por `just fontes:licenca`, nao apenas declarado aqui.

2. **Clausula PERMISSION da OFL 1.1**, verbatim:

   > Permission is hereby granted, free of charge, to any person obtaining
   > a copy of the Font Software, to use, study, copy, merge, **embed**, modify,
   > redistribute, and sell modified and unmodified copies of the Font
   > Software, subject to the following conditions:

3. **OFL-FAQ 1.1 e 1.12**, verbatim:

   > 1.1 Can I use the fonts for a book or other print publication, to create
   > logos or other graphics, or even to manufacture objects based on their
   > outlines? Yes. [...] Some examples of these uses are: logos, posters,
   > business cards, stationery, **video titling**, signage, [...]

   > 1.12 So can I embed OFL fonts in my document? Yes, either in full or a
   > subset. The restrictions regarding font modification and redistribution do
   > not apply, as the font is not intended for use outside the document.

## Obrigacao que sobra

O bundle do render serve o `.woff2` inteiro por HTTP local, o que a OFL-FAQ 1.15
trata como *bundling*, nao como *embedding* puro. Nesse caso vale a clausula 2 da
OFL: cada copia tem de carregar o aviso de copyright e a licenca. Por isso
`assets/fontes/OFL.txt` acompanha os binarios e e copiado junto pelo bundler.

O video renderizado nao herda nada: OFL clausula 5 — *"The requirement for fonts
to remain under this license does not apply to any document created using the
Font Software."*

## Bytes

O hash abaixo e verificado por `just fontes:licenca`. Se o arquivo for trocado, o
gate fica vermelho e a ficha tem de ser reexaminada — a declaracao de licenca
nunca fica orfã dos bytes que ela descreve.

sha256_JetBrainsMono-Regular.woff2: a9cb1cd82332b23a47e3a1239d25d13c86d16c4220695e34b243effa999f45f2

## Metricas declaradas pelo arquivo

| arquivo | name ID 1 | name ID 2 | usWeightClass | italicAngle | unitsPerEm |
|---|---|---|---|---|---|
| JetBrainsMono-Regular.woff2 | JetBrains Mono | Regular | 400 | 0 | 1000 |

Extraido com:

```
python3 -c "from fontTools.ttLib import TTFont; f=TTFont('assets/fontes/JetBrainsMono-Regular.woff2'); print(f['name'].getDebugName(1), f['OS/2'].usWeightClass, hex(f['OS/2'].fsType))"
```
