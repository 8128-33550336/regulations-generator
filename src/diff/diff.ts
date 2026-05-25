import { normalizeMarkdown } from "../parse/markdown.js";
import type {
  DiffEntry,
  LawArticle,
  LawChapter,
  LawDiffNode,
  LawDocumentModel,
  LawParagraph,
  LawPreamble,
  LawSupplProvision,
  Status,
} from "../types.js";

function nodeText(node: LawDiffNode | undefined): string {
  if (!node) {
    return "";
  }

  if (node.type === "title") {
    return node.text;
  }

  return [
    ...node.paragraph.sentenceBlocks.map((block) => block.text),
    ...node.paragraph.items.map((item) => item.body.text),
  ].join("\n");
}

function nodeTitle(node: LawDiffNode | undefined): string {
  if (!node) {
    return "";
  }

  return node.type === "title" ? "タイトル" : node.paragraph.title;
}

function statusLabel(oldNode?: LawDiffNode, newNode?: LawDiffNode): Status {
  if (!oldNode) {
    return "追加";
  }
  if (!newNode) {
    return "削除";
  }
  if (normalizeMarkdown(nodeText(oldNode)) === normalizeMarkdown(nodeText(newNode))) {
    return nodeTitle(oldNode) === nodeTitle(newNode) ? "変更なし" : "変更";
  }
  return "変更";
}

function lcs(left: string[], right: string[]): string[] {
  const lengths = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));

  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      lengths[leftIndex][rightIndex] =
        left[leftIndex] === right[rightIndex]
          ? lengths[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(lengths[leftIndex + 1][rightIndex], lengths[leftIndex][rightIndex + 1]);
    }
  }

  const sequence: string[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      sequence.push(left[leftIndex]);
      leftIndex += 1;
      rightIndex += 1;
    } else if (lengths[leftIndex + 1][rightIndex] >= lengths[leftIndex][rightIndex + 1]) {
      leftIndex += 1;
    } else {
      rightIndex += 1;
    }
  }

  return sequence;
}

function orderedDiffKeys(oldKeys: string[], newKeys: string[]): string[] {
  const anchors = lcs(oldKeys, newKeys);
  const keys: string[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  for (const anchor of anchors) {
    const oldAnchorIndex = oldKeys.indexOf(anchor, oldIndex);
    const newAnchorIndex = newKeys.indexOf(anchor, newIndex);

    keys.push(...oldKeys.slice(oldIndex, oldAnchorIndex));
    keys.push(...newKeys.slice(newIndex, newAnchorIndex));
    keys.push(anchor);

    oldIndex = oldAnchorIndex + 1;
    newIndex = newAnchorIndex + 1;
  }

  keys.push(...oldKeys.slice(oldIndex));
  keys.push(...newKeys.slice(newIndex));

  return Array.from(new Set(keys));
}

function containerId(node: LawDiffNode): string {
  return node.type === "paragraph" ? node.container.id : "";
}

function findRenumberedParagraph(
  newNode: LawDiffNode,
  oldNodes: LawDiffNode[],
  consumedOldKeys: Set<string>,
): LawDiffNode | undefined {
  if (newNode.type !== "paragraph") {
    return undefined;
  }

  const normalizedNewText = normalizeMarkdown(nodeText(newNode));

  return oldNodes.find((oldNode) => {
    return (
      oldNode.type === "paragraph" &&
      containerId(oldNode) === containerId(newNode) &&
      oldNode.key !== newNode.key &&
      !consumedOldKeys.has(oldNode.key) &&
      normalizeMarkdown(nodeText(oldNode)) === normalizedNewText
    );
  });
}

function paragraphNode(paragraph: LawParagraph, container: LawArticle | LawPreamble | LawSupplProvision): LawDiffNode {
  return {
    type: "paragraph",
    key: paragraph.id,
    paragraph,
    container,
  };
}

function articleParagraphNodes(article: LawArticle): LawDiffNode[] {
  return article.paragraphs.map((paragraph) => paragraphNode(paragraph, article));
}

function chapterParagraphNodes(chapter: LawChapter): LawDiffNode[] {
  return chapter.articles.flatMap(articleParagraphNodes);
}

function preambleParagraphNodes(preamble: LawPreamble): LawDiffNode[] {
  return preamble.paragraphs.map((paragraph) => paragraphNode(paragraph, preamble));
}

function supplProvisionParagraphNodes(supplProvision: LawSupplProvision): LawDiffNode[] {
  return supplProvision.paragraphs.map((paragraph) => paragraphNode(paragraph, supplProvision));
}

function modelNodes(document: LawDocumentModel): LawDiffNode[] {
  return [
    { type: "title", key: "law-title", text: document.title.title },
    ...(document.preamble ? preambleParagraphNodes(document.preamble) : []),
    ...document.mainProvision.children.flatMap((node) => node.type === "chapter" ? chapterParagraphNodes(node) : articleParagraphNodes(node)),
    ...document.supplProvisions.flatMap(supplProvisionParagraphNodes),
  ];
}

export function buildDiffEntries(oldDocument: LawDocumentModel, newDocument: LawDocumentModel): DiffEntry[] {
  const oldNodes = modelNodes(oldDocument);
  const newNodes = modelNodes(newDocument);
  const oldByKey = new Map(oldNodes.map((node) => [node.key, node]));
  const newByKey = new Map(newNodes.map((node) => [node.key, node]));
  const keys = orderedDiffKeys(
    oldNodes.map((node) => node.key),
    newNodes.map((node) => node.key),
  );

  const consumedOldKeys = new Set<string>();
  const consumedNewKeys = new Set<string>();
  const entries: DiffEntry[] = [];

  for (const key of keys) {
    if (consumedOldKeys.has(key) || consumedNewKeys.has(key)) {
      continue;
    }

    const oldNode = oldByKey.get(key);
    const newNode = newByKey.get(key);

    if (oldNode && newNode && normalizeMarkdown(nodeText(oldNode)) !== normalizeMarkdown(nodeText(newNode))) {
      const renumberedOldNode = findRenumberedParagraph(newNode, oldNodes, consumedOldKeys);

      if (renumberedOldNode) {
        entries.push({
          key,
          status: "削除",
          oldNode,
        });
        entries.push({
          key: `${renumberedOldNode.key} -> ${newNode.key}`,
          status: "変更",
          oldNode: renumberedOldNode,
          newNode,
          highlightTitleOnly: true,
        });
        consumedOldKeys.add(key);
        consumedOldKeys.add(renumberedOldNode.key);
        consumedNewKeys.add(key);
        continue;
      }
    }

    entries.push({
      key,
      status: statusLabel(oldNode, newNode),
      oldNode,
      newNode,
    });
  }

  return entries;
}
