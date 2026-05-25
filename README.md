# build

規則 Markdown から HTML、XML、新旧対照表 HTML を生成するためのスクリプトです。

## 使い方 (テスト用)

```sh
cd build
npm install
```

単体生成:

```sh
regulation-generate -H -o ../bylaw-welcoming/bylaw-welcoming.html ../bylaw-welcoming/bylaw-welcoming-new.md
regulation-generate -p -o ../bylaw-welcoming/bylaw-welcoming.pdf ../bylaw-welcoming/bylaw-welcoming-new.md
regulation-generate -x ../bylaw-welcoming/bylaw-welcoming-new.md ../bylaw-welcoming/out
regulation-generate diff ../bylaw-welcoming/bylaw-welcoming.md ../bylaw-welcoming/bylaw-welcoming-new.md ../bylaw-welcoming/bylaw-welcoming-diff.html
```

一括生成 CLI:

```sh
regulation-generate -a example/in example/out
regulation-generate -p example/in example/out
```

まとめて生成:

```sh
npm run all
npm run html
npm run pdf
npm run xml
```

第二引数は常に出力ディレクトリとして扱います。単体ファイルへ出力する場合は `-o <file>` を指定します。ディレクトリ出力では、出力ディレクトリを削除してから作り直します。形式オプションを指定しない場合、HTML などの形式ファイルは出力しません。`-p` は HTML を生成してから PDF を生成します。`-a` は `-H -p -x -j -i -s -m` 相当です。

## ディレクトリ構成

```text
src/
  build/     Section[] から規程文書の中間構造を構築
  commands/  CLI エントリポイント
  diff/      新旧対照表用の差分エントリ生成
  parse/     Markdown と見出しのパース
  render/    HTML / XML のレンダリング
  shared/    CLI パス解決などの共通処理
  types.ts   共通型
```

### commands

- `commands/generate.ts`: Markdown から HTML、XML、JSON、インデックス、サイトマップ、新旧対照表 HTML を生成します。

CLI はファイル読み書きと引数処理だけを担当し、パースやレンダリングの詳細は下位モジュールへ委譲します。

### build

- `build/law-model.ts`: `Section[]` を `LawDocumentModel` に変換します。

`LawDocumentModel` は、文書名、制定・改正日などのメタ情報、前文、本則、章、条、項、号、附則を持つ中間構造です。HTML と XML はこの中間構造を共有し、条・項・号の親子関係や「条の本文は第1項」という解釈をレンダラ側で毎回推測しないようにしています。

`xml` コマンドは確認用に `*-sections.json` と `*-law-model.json` も出力します。`Section[]` は Markdown 見出し単位のパース結果、`LawDocumentModel` は XML の一歩手前の法令構造です。

### parse

- `parse/markdown.ts`: `remark-parse` で Markdown AST を読み、見出し単位の `Section[]` に変換します。
- `parse/heading.ts`: 見出し文字列を strict に解釈します。
- `parse/items.ts`: 漢数字の号リストを strict に解釈します。

見出しは `ParsedHeading.parsedText` として構造化します。例:

```ts
{ type: "article", num: [3, 2], rawText: "第3条の2" }
{ type: "supplProvision", rawText: "附記" }
```

想定外の見出し、未対応の番号、親を持たない項・号などは throw して早めに気づけるようにしています。

### render

- `render/html.ts`: Markdown ブロックを rehype ノード経由で HTML 化し、日付や条文参照リンクも処理します。
- `render/hast.ts`: HTML AST ノード生成と文字列化の低レベル処理を担当します。
- `render/sections.ts`: `LawDocumentModel` を HTML の `section`, `h1`-`h4`, `li` へ変換します。
- `render/page.ts`: HTML 文書全体の枠を生成します。
- `render/xml.ts`: `LawDocumentModel` を XMLSchemaForJapaneseLaw v3 の一部構造へ変換します。

通常 HTML は、外側を `article[data-type=law]` とし、文書名と制定・改正・発出者などのメタ情報を `header.law-header` にまとめます。条は `section[data-type=article]`、項はその内側の `section[data-type=paragraph]`、号は `li[data-type=item][data-num]` として出力します。

XML は今回必要な範囲に絞って生成しています。主な対応要素は `LawTitle`, `EnactStatement`, `Preamble`, `MainProvision`, `Chapter`, `Article`, `Paragraph`, `Item`, `SupplProvision` です。`Delete="false"`, `Hide="false"`, `OldStyle="false"`, `WritingMode="vertical"` のような schema default と同じ属性は出力しません。

### diff

- `diff/diff.ts`: 旧版・新版の `Section[]` から `DiffEntry[]` を生成します。

差分表示の細かい HTML 表現は `render/diff-html.ts` と `render/sections.ts` 側で扱います。

## 検証

TypeScript:

```sh
npm run build
```

XML schema:

```sh
xmllint --noout --schema ../XMLSchemaForJapaneseLaw_v3_slimed.xsd ../bylaw-welcoming/bylaw-welcoming.xml
```

`all-xml` で生成される XML は `XMLSchemaForJapaneseLaw_v3_slimed.xsd` に通ることを確認しています。
