# Inter — ficha de licenca

Ficha obrigatoria (F1-03). Toda fonte embutida em `assets/fontes/` tem uma ficha
que declara **o direito de embutir**, que e uma permissao separada do direito de
usar e do direito de redistribuir.

## Identificacao

familia: Inter
arquivos: Inter-Regular.woff2, Inter-Bold.woff2
versao: 4.001 (git-9221beed3)
formato: WOFF2 (TrueType outlines)
origem: https://github.com/rsms/inter
upstream_release: https://github.com/rsms/inter/releases

## Licenca

licenca: SIL Open Font License, Version 1.1
licenca_arquivo: OFL.txt
licenca_url: https://openfontlicense.org/documents/OFL.txt
licenca_faq: https://openfontlicense.org/documents/OFL-FAQ.txt
titular: Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter)
reserved_font_name: nenhum declarado no LICENSE.txt upstream
fonte_do_texto: https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt

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

Os hashes abaixo sao verificados por `just fontes:licenca`. Se um arquivo for
trocado, o gate fica vermelho e a ficha tem de ser reexaminada — a declaracao de
licenca nunca fica orfã dos bytes que ela descreve.

sha256_Inter-Regular.woff2: e06f6b1bc553aaea4e4668023ed0ab0a147129c3107f511bc7d03d361b0ae085
sha256_Inter-Bold.woff2: fa888127b6da015b65569f0351f3b5c391ad928904951f1c20e9f8462a8d95ea

## Metricas declaradas pelo arquivo

| arquivo | name ID 1 | name ID 2 | usWeightClass | italicAngle | unitsPerEm |
|---|---|---|---|---|---|
| Inter-Regular.woff2 | Inter | Regular | 400 | 0 | 2048 |
| Inter-Bold.woff2 | Inter | Bold | 700 | 0 | 2048 |

Extraido com:

```
python3 -c "from fontTools.ttLib import TTFont; f=TTFont('assets/fontes/Inter-Regular.woff2'); print(f['name'].getDebugName(1), f['OS/2'].usWeightClass, hex(f['OS/2'].fsType))"
```
