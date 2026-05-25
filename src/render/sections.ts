import {
  renderHeadingTitleNode,
  renderLawTextFragmentNodes,
  itemProperties,
  sectionPropertiesForId,
} from "./law-html.js";
import { element, renderNodes, type HtmlNode } from "./hast.js";
import { isChapterModel } from "../build/law-model.js";
import type {
  LawArticle,
  LawChapter,
  LawDocumentModel,
  LawItem,
  LawMetadataBlock,
  LawParagraph,
  LawPreamble,
  LawSupplProvision,
  LawTitle,
} from "../types.js";

function lawParagraphItemParentId(paragraph: LawParagraph): string {
  return paragraph.id.includes("-paragraph") ? paragraph.id : "";
}

function wrapWithSectionNodes(id: string, children: HtmlNode[], idPrefix = ""): HtmlNode[] {
  const properties = sectionPropertiesForId(id, idPrefix);

  return properties.id ? [element("section", properties, children)] : children;
}

function wrapMainProvisionNodes(children: HtmlNode[]): HtmlNode[] {
  if (children.length === 0) {
    return [];
  }

  return [element("section", { id: "mainProvision", "data-type": "mainProvision" }, children)];
}

function renderLawHeadingNode(node: LawTitle | LawChapter | LawArticle | LawParagraph | LawPreamble | LawSupplProvision): HtmlNode {
  return renderHeadingTitleNode(
    { title: node.title, rank: node.heading.rank, heading: node.heading },
    {},
    "amendment",
  );
}

function renderLawTitleNode(document: LawDocumentModel): HtmlNode {
  const heading = renderLawHeadingNode(document.title);

  return element("header", { class: "law-header" }, [heading, ...renderLawMetadataBlockNodes(document.metadata)]);
}

function lawMetadataId(block: LawMetadataBlock): string {
  const type = block.type === "date" ? (block.amend ? "amend-date" : "enact-date") : block.type;
  if (block.type === "date" && block.amend) {
    return `${type}${block.num ?? 1}`;
  }

  return block.num ? `${type}${block.num}` : type;
}

function renderLawMetadataBlockNodes(blocks: LawMetadataBlock[]): HtmlNode[] {
  return blocks.map((block) => {
    const properties: Record<string, string> = {
      id: lawMetadataId(block),
      "data-type": block.type,
    };

    if (block.type === "date") {
      properties["data-amend"] = String(block.amend);
      properties.datetime = block.date;

      if (block.amend) {
        properties["data-num"] = String(block.num ?? 1);
      }
    }

    if (block.num) {
      properties["data-num"] = String(block.num);
    }

    return element("p", properties, renderLawTextFragmentNodes(block.fragments));
  });
}

function renderLawItemsNode(items: LawItem[], itemParentId: string): HtmlNode[] {
  if (items.length === 0) {
    return [];
  }

  return [
    element(
      "ol",
      { class: "kanji-list" },
      items.map((item) => {
        return element("li", itemProperties(item.num, item.marker, itemParentId), renderLawTextFragmentNodes(item.body.fragments));
      }),
    ),
  ];
}

async function renderLawParagraphNodes(paragraph: LawParagraph): Promise<HtmlNode[]> {
  const title = renderLawHeadingNode(paragraph);
  const sentenceNodes = paragraph.sentenceBlocks.map((block) => {
    return element("p", {}, renderLawTextFragmentNodes(block.fragments));
  });
  const itemNodes = renderLawItemsNode(paragraph.items, lawParagraphItemParentId(paragraph));

  return wrapWithSectionNodes(paragraph.id, [title, ...sentenceNodes, ...itemNodes]);
}

async function renderLawArticleNodes(article: LawArticle): Promise<HtmlNode[]> {
  const title = renderLawHeadingNode(article);
  const paragraphs = (await Promise.all(article.paragraphs.map(renderLawParagraphNodes))).flat();

  return wrapWithSectionNodes(article.id, [title, ...paragraphs]);
}

async function renderLawChapterNodes(chapter: LawChapter): Promise<HtmlNode[]> {
  const title = renderLawHeadingNode(chapter);
  const articles = (await Promise.all(chapter.articles.map(renderLawArticleNodes))).flat();

  return wrapWithSectionNodes(chapter.id, [title, ...articles]);
}

async function renderMainProvisionNodes(document: LawDocumentModel): Promise<HtmlNode[]> {
  const children = (
    await Promise.all(
      document.mainProvision.children.map((node) => isChapterModel(node) ? renderLawChapterNodes(node) : renderLawArticleNodes(node)),
    )
  ).flat();

  return wrapMainProvisionNodes(children);
}

async function renderPreambleNodes(preamble: LawPreamble): Promise<HtmlNode[]> {
  const title = renderLawHeadingNode(preamble);
  const paragraphs = (await Promise.all(preamble.paragraphs.map(renderLawParagraphNodes))).flat();

  return wrapWithSectionNodes(preamble.id, [title, ...paragraphs]);
}

async function renderSupplProvisionNodes(supplProvision: LawSupplProvision): Promise<HtmlNode[]> {
  const title = renderLawHeadingNode(supplProvision);
  const paragraphs = (await Promise.all(supplProvision.paragraphs.map(renderLawParagraphNodes))).flat();

  return wrapWithSectionNodes(supplProvision.id, [title, ...paragraphs]);
}

export async function renderLawDocumentModelNodes(document: LawDocumentModel): Promise<HtmlNode[]> {
  const nodes = [
    renderLawTitleNode(document),
    ...(document.preamble ? await renderPreambleNodes(document.preamble) : []),
    ...(await renderMainProvisionNodes(document)),
    ...(await Promise.all(document.supplProvisions.map(renderSupplProvisionNodes))).flat(),
  ];

  return [element("article", { class: "law", "data-type": "law" }, nodes)];
}

export async function renderLawDocumentModel(document: LawDocumentModel): Promise<string> {
  return renderNodes(await renderLawDocumentModelNodes(document));
}
