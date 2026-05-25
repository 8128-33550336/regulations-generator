import { renderChangedParagraphBlockNode } from "./diff-highlight.js";
import { renderDateTimeNodes } from "./date-time.js";
import {
  itemProperties,
  renderHeadingTitleNode,
  renderLawTextFragmentNodes,
  sectionPropertiesForId,
} from "./law-html.js";
import { element, text, type HtmlNode } from "./hast.js";
import { renderHtmlDocument } from "./page.js";
import { normalizeMarkdown } from "../parse/markdown.js";
import type { DiffEntry, LawDiffContainer, LawDiffNode, LawItem, LawParagraph, LawSentenceBlock, Status } from "../types.js";

type DiffRenderOptions = {
  idPrefix: string;
  highlightAll?: boolean;
  highlightChanged?: boolean;
  highlightTitleOnly?: boolean;
  highlightClass: string;
  compareWith?: LawDiffNode;
  includeContainer?: boolean;
};

function noteFor(status: Status): string {
  switch (status) {
    case "追加":
      return "（追加）";
    case "削除":
      return "（削除）";
    case "変更":
      return "（変更）";
    case "変更なし":
      return "";
    default: {
      const exhaustive: never = status;
      throw new Error(`[diff-html] unsupported status: ${exhaustive}`);
    }
  }
}

function statusClass(status: Status): string {
  switch (status) {
    case "追加":
      return "status-added";
    case "削除":
      return "status-deleted";
    case "変更":
      return "status-changed";
    case "変更なし":
      return "status-unchanged";
    default: {
      const exhaustive: never = status;
      throw new Error(`[diff-html] unsupported status: ${exhaustive}`);
    }
  }
}

function tableCell(children: HtmlNode[] = []): HtmlNode {
  return element("td", {}, children);
}

function omissionCell(): HtmlNode {
  return tableCell([element("p", {}, [text("（略）")])]);
}

function omissionRow(): HtmlNode {
  return element("tr", { class: "omission" }, [
    omissionCell(),
    omissionCell(),
    tableCell(),
  ]);
}

function entryNode(entry: DiffEntry): LawDiffNode | undefined {
  return entry.newNode ?? entry.oldNode;
}

function entryContainerId(entry: DiffEntry): string {
  const node = entryNode(entry);
  return node?.type === "paragraph" ? node.container.id : "";
}

function isParagraphEntry(entry: DiffEntry): boolean {
  return entryNode(entry)?.type === "paragraph";
}

function titleCellNode(node: Extract<LawDiffNode, { type: "title" }>, options: DiffRenderOptions): HtmlNode[] {
  const properties: Record<string, string> = options.highlightAll || options.highlightChanged ? { class: options.highlightClass } : {};
  return [element("h1", { class: "section-title" }, [element("span", properties, [text(node.text)])])];
}

function headingNode(node: LawDiffContainer | LawParagraph, options: Pick<DiffRenderOptions, "highlightTitleOnly" | "highlightClass">): HtmlNode {
  if (options.highlightTitleOnly) {
    const tagName = `h${Math.min(Math.max(node.heading.rank, 1), 6)}`;
    return element(tagName, { class: "section-title" }, [
      element("span", { class: options.highlightClass }, [text(node.title)]),
    ]);
  }

  return renderHeadingTitleNode(
    { title: node.title, rank: node.heading.rank, heading: node.heading },
    {},
    options.highlightClass,
  );
}

function wrapSection(id: string, children: HtmlNode[], idPrefix: string): HtmlNode[] {
  const properties = sectionPropertiesForId(id, idPrefix);
  return properties.id ? [element("section", properties, children)] : children;
}

function containerNodes(container: LawDiffContainer, options: DiffRenderOptions): HtmlNode[] {
  return wrapSection(container.id, [headingNode(container, options)], options.idPrefix);
}

function compareParagraph(options: DiffRenderOptions): LawParagraph | undefined {
  return options.compareWith?.type === "paragraph" ? options.compareWith.paragraph : undefined;
}

function changedSentenceNode(block: LawSentenceBlock, compareBlocks: LawSentenceBlock[], options: DiffRenderOptions): HtmlNode | undefined {
  if (!options.highlightChanged || options.highlightAll || options.highlightTitleOnly) {
    return undefined;
  }

  const compareBlock = compareBlocks.find((candidate) => normalizeMarkdown(candidate.text) !== normalizeMarkdown(block.text));

  if (!compareBlock) {
    return undefined;
  }

  return renderChangedParagraphBlockNode(block.fragments, compareBlock.fragments, options.highlightClass, options.idPrefix);
}

function sentenceNodes(paragraph: LawParagraph, options: DiffRenderOptions): HtmlNode[] {
  const compareBlocks = compareParagraph(options)?.sentenceBlocks ?? [];
  const compareTexts = new Set(compareBlocks.map((block) => normalizeMarkdown(block.text)));

  return paragraph.sentenceBlocks.map((block) => {
    const changedNode = changedSentenceNode(block, compareBlocks, options);

    if (changedNode) {
      return changedNode;
    }

    const shouldHighlight =
      options.highlightAll ||
      (options.highlightChanged && !compareTexts.has(normalizeMarkdown(block.text)));
    const properties: Record<string, string> = shouldHighlight ? { class: options.highlightClass } : {};

    return element("p", properties, renderLawTextFragmentNodes(block.fragments, options.idPrefix));
  });
}

function itemText(item: LawItem): string {
  return `${item.title}\n${item.body.text}`;
}

function itemNodes(paragraph: LawParagraph, options: DiffRenderOptions): HtmlNode[] {
  if (paragraph.items.length === 0) {
    return [];
  }

  const compareItems = compareParagraph(options)?.items ?? [];
  const compareTexts = new Set(compareItems.map((item) => normalizeMarkdown(itemText(item))));
  const items = paragraph.items.map((item) => {
    const shouldHighlight =
      options.highlightAll ||
      (options.highlightChanged && !compareTexts.has(normalizeMarkdown(itemText(item))));
    const properties = itemProperties(item.num, item.marker, paragraph.id, options.idPrefix);

    if (shouldHighlight) {
      properties.class = options.highlightClass;
    }

    return element("li", properties, renderLawTextFragmentNodes(item.body.fragments, options.idPrefix));
  });

  return [element("ol", { class: "kanji-list" }, items)];
}

function paragraphNodes(paragraph: LawParagraph, options: DiffRenderOptions): HtmlNode[] {
  const children = [
    headingNode(paragraph, options),
    ...sentenceNodes(paragraph, options),
    ...itemNodes(paragraph, options),
  ];

  return wrapSection(paragraph.id, children, options.idPrefix);
}

function diffNodeCell(node: LawDiffNode | undefined, options: DiffRenderOptions): HtmlNode {
  if (!node) {
    return tableCell();
  }

  if (node.type === "title") {
    return tableCell(titleCellNode(node, options));
  }

  return tableCell([
    ...(options.includeContainer ? containerNodes(node.container, options) : []),
    ...paragraphNodes(node.paragraph, options),
  ]);
}

async function rowForEntry(entry: DiffEntry, includeContainer = false): Promise<HtmlNode> {
  return element("tr", { class: statusClass(entry.status) }, [
    diffNodeCell(entry.newNode, {
      idPrefix: "after-",
      highlightAll: entry.status === "追加",
      highlightChanged: entry.status === "変更",
      highlightTitleOnly: entry.highlightTitleOnly,
      highlightClass: "amendment",
      compareWith: entry.oldNode,
      includeContainer,
    }),
    diffNodeCell(entry.oldNode, {
      idPrefix: "before-",
      highlightChanged: entry.status === "変更",
      highlightTitleOnly: entry.highlightTitleOnly,
      highlightClass: "current-change",
      compareWith: entry.newNode,
      includeContainer,
    }),
    tableCell([text(noteFor(entry.status))]),
  ]);
}

async function changedRows(entries: DiffEntry[]): Promise<HtmlNode[]> {
  const rows: HtmlNode[] = [];
  let currentContainerId = "";
  let skippedInCurrentContainer = false;
  let skippedBetweenRows = false;

  function pushSkippedBetweenRows(): void {
    if (skippedBetweenRows) {
      rows.push(omissionRow());
      skippedBetweenRows = false;
    }
  }

  function enterContainer(containerId: string): boolean {
    if (!containerId) {
      currentContainerId = "";
      skippedInCurrentContainer = false;
      return false;
    }

    if (currentContainerId === containerId) {
      if (skippedInCurrentContainer) {
        rows.push(omissionRow());
        skippedInCurrentContainer = false;
      }
      return false;
    }

    pushSkippedBetweenRows();
    currentContainerId = containerId;
    skippedInCurrentContainer = false;
    return true;
  }

  for (const entry of entries) {
    if (entry.status === "変更なし") {
      if (isParagraphEntry(entry) && entryContainerId(entry) === currentContainerId) {
        skippedInCurrentContainer = true;
      } else if (rows.length > 0) {
        skippedBetweenRows = true;
      }
      continue;
    }

    if (entryNode(entry)?.type === "title") {
      currentContainerId = "";
      skippedInCurrentContainer = false;
      pushSkippedBetweenRows();
      rows.push(await rowForEntry(entry));
      continue;
    }

    const containerId = entryContainerId(entry);
    rows.push(await rowForEntry(entry, enterContainer(containerId)));
  }

  return rows;
}

function tableHeaderCell(label: string): HtmlNode {
  return element("th", { scope: "col" }, [text(label)]);
}

function diffTable(rows: HtmlNode[]): HtmlNode {
  return element("table", { class: "diff-table" }, [
    element("thead", {}, [
      element("tr", {}, [
        tableHeaderCell("改正案"),
        tableHeaderCell("現行"),
        tableHeaderCell("備考"),
      ]),
    ]),
    element("tbody", {}, rows),
  ]);
}

function renderDiffPageHeader(params: { title: string; date: string }): HtmlNode[] {
  return [
    element("p", { class: "date" }, renderDateTimeNodes(params.date)),
    element("h1", { class: "page-title" }, [text("「"), text(params.title), text("」")]),
    element("p", { class: "subtitle" }, [text("新旧対照表")]),
  ];
}

export async function renderDiffHtmlDocument(params: {
  title: string;
  date: string;
  entries: DiffEntry[];
  stylesheets: string[];
}): Promise<string> {
  const rows = await changedRows(params.entries);

  return renderHtmlDocument({
    title: `${params.title} 新旧対照表`,
    body: [
      ...renderDiffPageHeader({ title: params.title, date: params.date }),
      diffTable(rows),
    ],
    stylesheets: params.stylesheets,
  });
}
