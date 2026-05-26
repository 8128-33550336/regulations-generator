# regulations-generator

規則 Markdown から HTML、XML、新旧対照表 HTML を生成するためのスクリプトです。

## 使い方 (テスト用)

```sh
npm install
npm run build
```

コマンド形式:

```text
regulations-generate gen [-a] [-H] [-p] [-x] [-j] [-t] [-m] [-i] [-s] [-b <url>|--base-url <url>] [--title <title>] [--description <text>] <input> <output-dir>
regulations-generate conv [-H] [-p] [-x] [-j] [-t] [-m] <input.md> <output-file>
regulations-generate diff [-H] [-p] <before.md> <after.md> [output]
```

単体生成:

```sh
regulations-generate conv -H example/in/bylaw-welcoming-new.md example/out/bylaw-welcoming-new.html
regulations-generate conv -p example/in/bylaw-welcoming-new.md example/out/bylaw-welcoming-new.pdf
regulations-generate conv -x example/in/bylaw-welcoming-new.md example/out/bylaw-welcoming-new.xml
regulations-generate conv -t example/in/bylaw-welcoming-new.md example/out/bylaw-welcoming-new.toml
regulations-generate diff -H -p example/in/bylaw-welcoming-old.md example/in/bylaw-welcoming-new.md example/out/bylaw-welcoming-diff.html
```

一括生成 CLI:

```sh
regulations-generate gen -a example/in example/out
regulations-generate gen -p example/in example/out
```

まとめて生成:

```sh
npm run all
npm run html
npm run pdf
npm run xml
npm run toml
```

サブコマンド:

| サブコマンド | 用途 | 出力先 |
| --- | --- | --- |
| `gen`, `generate` | Markdown ファイルまたはディレクトリをまとめて変換 | ディレクトリ |
| `conv`, `convert` | 単一 Markdown ファイルを変換 | ファイル |
| `diff` | 新旧対照表 HTML/PDF を生成 | ファイル |

オプション:

| オプション | `gen` | `conv` | `diff` | 内容 |
| --- | --- | --- | --- | --- |
| `-H`, `--html` | yes | yes | yes | HTML を生成 |
| `-p`, `--pdf` | yes | yes | yes | PDF を生成 |
| `-x`, `--xml` | yes | yes | no | XML を生成 |
| `-j`, `--json` | yes | yes | no | JSON を生成 |
| `-t`, `--toml` | yes | yes | no | TOML を生成 |
| `-m`, `--md` | yes | yes | no | Markdown をコピー |
| `-a`, `--all` | yes | no | no | `-H -p -x -j -t -i -s -m` 相当 |
| `-i`, `--index` | yes | no | no | `index.html`, `index.md`, `index.json` を生成 |
| `-s`, `--sitemap` | yes | no | no | `sitemap.xml` を生成 |
| `-b`, `--base-url <url>` | yes | no | no | `sitemap.xml` のベース URL |
| `--title <title>` | yes | no | no | インデックスのタイトル |
| `--description <text>` | yes | no | no | インデックスの説明 |

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

- `commands/generate.ts`: Markdown から HTML、XML、JSON、TOML、インデックス、サイトマップ、新旧対照表 HTML を生成します。

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
