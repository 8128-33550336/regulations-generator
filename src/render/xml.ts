import XMLBuilder from "fast-xml-builder";
import { buildLawModel, isChapterModel } from "../build/law-model.js";
import type {
  LawArticle,
  LawChapter,
  LawDocumentModel,
  LawItem,
  LawParagraph,
  LawSentenceBlock,
  LawSupplProvision,
  Section,
} from "../types.js";

function error(message: string): never {
  throw new Error(`[xml] ${message}`);
}

type XmlAttributeValue = string | number | boolean | undefined;
type XmlBuilderAttributeMap = Record<string, string | number | boolean>;
type XmlBuilderNode = Record<string, XmlBuilderNode[] | string | XmlBuilderAttributeMap>;
type LawEra = "Meiji" | "Taisho" | "Showa" | "Heisei" | "Reiwa";

type LawEraDate = {
  era: LawEra;
  year: number;
  month: number;
  day: number;
};

const eraStarts: Array<{ era: LawEra; start: string; startYear: number }> = [
  { era: "Reiwa", start: "2019-05-01", startYear: 2019 },
  { era: "Heisei", start: "1989-01-08", startYear: 1989 },
  { era: "Showa", start: "1926-12-25", startYear: 1926 },
  { era: "Taisho", start: "1912-07-30", startYear: 1912 },
  { era: "Meiji", start: "1868-01-25", startYear: 1868 },
];

const xmlBuilder = new XMLBuilder({
  attributeNamePrefix: "@_",
  format: false,
  ignoreAttributes: false,
  preserveOrder: true,
  suppressEmptyNode: false,
});

function text(value: string): XmlBuilderNode {
  return { "#text": value };
}

function element(name: string, attributes: Record<string, XmlAttributeValue>, children: XmlBuilderNode[] = []): XmlBuilderNode {
  const attrs = Object.fromEntries(
    Object.entries(attributes)
      .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
      .map(([key, value]) => [`@_${key}`, value]),
  );
  const node: XmlBuilderNode = { [name]: children };

  if (Object.keys(attrs).length > 0) {
    node[":@"] = attrs;
  }

  return node;
}

function textElement(name: string, value: string, attributes: Record<string, XmlAttributeValue> = {}): XmlBuilderNode {
  return element(name, attributes, [text(value)]);
}

function blankElement(name: string): XmlBuilderNode {
  return element(name, {});
}

function lawEraDate(value: string): LawEraDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);

  if (!match) {
    error(`invalid enact date: ${value}`);
  }

  const [, yearValue, monthValue, dayValue] = match;
  const westernYear = Number(yearValue);

  for (const eraStart of eraStarts) {
    if (value >= eraStart.start) {
      return {
        era: eraStart.era,
        year: westernYear - eraStart.startYear + 1,
        month: Number(monthValue),
        day: Number(dayValue),
      };
    }
  }

  error(`unsupported enact date: ${value}`);
}

function enactDate(document: LawDocumentModel): LawEraDate {
  const metadata = document.metadata.find((block) => block.type === "date" && !block.amend);

  if (!metadata) {
    error("law metadata has no enact date");
  }

  return lawEraDate(metadata.date);
}

function plainBlock(block: string): string {
  const value = block
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

  if (!value) {
    error("empty markdown block");
  }

  return value;
}

function sentence(value: string): XmlBuilderNode {
  return textElement("Sentence", value.trim() ? plainBlock(value) : "");
}

function sentenceContainer(name: string, blocks: LawSentenceBlock[]): XmlBuilderNode {
  const body = blocks.length > 0 ? blocks : [{ type: "sentence" as const, text: "", fragments: [] }];
  return element(name, {}, body.map((block) => sentence(block.text)));
}

function renderItem(item: LawItem): XmlBuilderNode {
  return element("Item", { Num: item.num }, [
    textElement("ItemTitle", item.title),
    element("ItemSentence", {}, [sentence(item.body.text)]),
  ]);
}

function renderParagraph(paragraph: LawParagraph): XmlBuilderNode {
  return element("Paragraph", { Num: paragraph.num }, [
    textElement("ParagraphNum", paragraph.title),
    sentenceContainer("ParagraphSentence", paragraph.sentenceBlocks),
    ...paragraph.items.map(renderItem),
  ]);
}

function renderArticle(article: LawArticle): XmlBuilderNode {
  const children: XmlBuilderNode[] = [];

  if (article.caption) {
    children.push(textElement("ArticleCaption", article.caption));
  }

  children.push(textElement("ArticleTitle", article.title));
  children.push(...article.paragraphs.map(renderParagraph));

  if (article.paragraphs.length === 0) {
    error(`article has no paragraph: ${article.title}`);
  }

  return element("Article", { Num: article.num }, children);
}

function renderArticleNode(node: LawArticle): XmlBuilderNode {
  return renderArticle(node);
}

function renderChapterNode(node: LawChapter): XmlBuilderNode {
  const chapterTitle = node.caption ? `${node.title}${node.caption}` : node.title;

  return element("Chapter", { Num: node.num }, [
    textElement("ChapterTitle", chapterTitle),
    ...node.articles.map(renderArticleNode),
  ]);
}

function renderMainProvisionNode(document: LawDocumentModel): XmlBuilderNode {
  return element(
    "MainProvision",
    {},
    document.mainProvision.children.map((node) => isChapterModel(node) ? renderChapterNode(node) : renderArticleNode(node)),
  );
}

function renderPreamble(document: LawDocumentModel): XmlBuilderNode | undefined {
  if (!document.preamble) {
    return undefined;
  }

  return element("Preamble", {}, document.preamble.paragraphs.map(renderParagraph));
}

function renderSupplProvision(supplProvision: LawSupplProvision): XmlBuilderNode {
    return element("SupplProvision", {
    Type: supplProvision.isAmendment ? "Amend" : "New"
  }, [
    textElement("SupplProvisionLabel", supplProvision.label),
    ...supplProvision.paragraphs.map(renderParagraph),
  ]);
}

function enactStatements(document: LawDocumentModel): XmlBuilderNode[] {
  return document.metadata.map((block) => textElement("EnactStatement", plainBlock(block.text)));
}

export function renderXmlModel(document: LawDocumentModel): string {
  const title = document.title;
  const lawDate = enactDate(document);
  const lawBodyChildren = [
    textElement("LawTitle", title.title),
    ...enactStatements(document),
    renderPreamble(document),
    renderMainProvisionNode(document),
    ...document.supplProvisions.map(renderSupplProvision),
  ].filter((child): child is XmlBuilderNode => Boolean(child));
  const xml = element(
    "Law",
    {
      Era: lawDate.era,
      Year: lawDate.year,
      Num: 1,
      PromulgateMonth: lawDate.month,
      PromulgateDay: lawDate.day,
      LawType: "Misc",
      Lang: "ja",
    },
    [blankElement("LawNum"), element("LawBody", {}, lawBodyChildren)],
  );

  return `<?xml version="1.0" encoding="UTF-8"?>${xmlBuilder.build([xml])}`;
}

export function renderXmlDocument(sections: Section[]): string {
  return renderXmlModel(buildLawModel(sections));
}
