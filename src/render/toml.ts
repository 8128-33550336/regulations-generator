import { stringify } from "smol-toml";
import type {
  LawArticle,
  LawChapter,
  LawDocumentModel,
  LawItem,
  LawMetadataBlock,
  LawParagraph,
  LawPreamble,
  LawSentenceBlock,
  LawSupplProvision,
} from "../types.js";

type TomlObject = Record<string, unknown>;

function sentenceBlockText(blocks: LawSentenceBlock[]): string {
  return blocks.map((block) => block.text).join("\n");
}

function renderTomlItem(item: LawItem): TomlObject {
  return {
    marker: `${item.marker} `,
    text: item.body.text,
  };
}

function renderTomlParagraph(paragraph: LawParagraph): TomlObject {
  return {
    id: paragraph.id,
    num: paragraph.num,
    text: sentenceBlockText(paragraph.sentenceBlocks),
    ...(paragraph.items.length > 0 ? { items: paragraph.items.map(renderTomlItem) } : {}),
  };
}

function renderTomlArticle(article: LawArticle): TomlObject {
  const articleToml: TomlObject = {
    id: article.id,
    num: article.num,
    caption: article.caption ?? "",
  };

  for (const paragraph of article.paragraphs) {
    articleToml[String(paragraph.num)] = renderTomlParagraph(paragraph);
  }

  return articleToml;
}

function renderTomlChapter(chapter: LawChapter): TomlObject {
  const chapterToml: TomlObject = {
    id: chapter.id,
    num: chapter.num,
    ...(chapter.caption ? { caption: chapter.caption } : {}),
  };

  for (const article of chapter.articles) {
    chapterToml[article.title] = renderTomlArticle(article);
  }

  return chapterToml;
}

function renderTomlMainProvision(law: LawDocumentModel): TomlObject {
  const mainProvisionToml: TomlObject = {};

  for (const child of law.mainProvision.children) {
    if (child.type === "chapter") {
      mainProvisionToml[child.title] = renderTomlChapter(child);
      continue;
    }

    mainProvisionToml[child.title] = renderTomlArticle(child);
  }

  return mainProvisionToml;
}

function renderTomlPreamble(preamble: LawPreamble): TomlObject {
  return {
    id: preamble.id,
    title: preamble.title,
    paragraphs: preamble.paragraphs.map(renderTomlParagraph),
  };
}

function renderTomlSupplProvision(supplProvision: LawSupplProvision, index: number): TomlObject {
  return {
    id: supplProvision.id,
    title: supplProvision.title,
    num: index + 1,
    paragraphs: supplProvision.paragraphs.map(renderTomlParagraph),
  };
}

function renderTomlSupplProvisions(supplProvisions: LawSupplProvision[]): TomlObject {
  const supplProvisionsToml: TomlObject = {};

  for (const [index, supplProvision] of supplProvisions.entries()) {
    supplProvisionsToml[String(index + 1)] = renderTomlSupplProvision(supplProvision, index);
  }

  return supplProvisionsToml;
}

function renderTomlMetadata(metadata: LawMetadataBlock[]): TomlObject {
  const metadataToml: TomlObject = {};
  const amendments: TomlObject[] = [];

  for (const block of metadata) {
    if (block.type === "issuer") {
      metadataToml.issuer = block.text;
      continue;
    }

    if (block.amend) {
      amendments.push({
        text: block.text,
        date: block.date,
      });
      continue;
    }

    metadataToml.enact = block.text;
  }

  if (amendments.length > 0) {
    metadataToml.amendments = amendments;
  }

  return metadataToml;
}

export function renderLawModelToml(law: LawDocumentModel): string {
  const lawToml: TomlObject = {
    title: law.title.title,
    metadata: renderTomlMetadata(law.metadata),
  };

  if (law.preamble) {
    lawToml.preamble = renderTomlPreamble(law.preamble);
  }

  lawToml["本則"] = renderTomlMainProvision(law);

  if (law.supplProvisions.length > 0) {
    lawToml["附則"] = renderTomlSupplProvisions(law.supplProvisions);
  }

  return `${stringify(lawToml)}\n`;
}
