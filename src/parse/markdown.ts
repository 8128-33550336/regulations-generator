import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Content, DefinitionContent, List, ListItem, Paragraph, Root, RootContent } from "mdast";
import { parseHeadingTitle } from "./heading.js";
import type { Section, SectionBlock } from "../types.js";

const markdownProcessor = unified().use(remarkParse);

function error(message: string): never {
  throw new Error(`[markdown] ${message}`);
}

function assertNoDefinitions(node: RootContent): asserts node is Exclude<RootContent, DefinitionContent> {
  if (node.type === "definition" || node.type === "footnoteDefinition") {
    error(`unsupported markdown node type: ${node.type}`);
  }
}

function depthOf(node: RootContent): number {
  if (node.type !== "heading") {
    error(`expected heading node, got ${node.type}`);
  }

  if (typeof node.depth !== "number") {
    error("heading node has no depth");
  }

  if (node.depth < 1 || node.depth > 6) {
    error(`unsupported heading depth: ${node.depth}`);
  }

  return node.depth;
}

function headingTextNodeContent(node: Content): string {
  if (node.type !== "text") {
    error(`only text nodes are allowed here, got ${node.type}`);
  }

  return node.value;
}

function paragraphNodeContent(node: Content): string {
  if (node.type === "text") {
    return node.value;
  }

  if (node.type === "break") {
    return "\n";
  }

  error(`only text or hard break nodes are allowed in paragraph, got ${node.type}`);
}

export function textContent(node: RootContent): string {
  if (node.type !== "heading") {
    error(`expected heading node, got ${node.type}`);
  }

  return node.children.map(headingTextNodeContent).join("");
}

export function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\s+/g, " ").trim();
}

function paragraphText(node: Paragraph): string {
  const text = node.children
    .map(paragraphNodeContent)
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

  if (!text) {
    error("empty paragraph");
  }

  return text;
}

function listItemText(node: ListItem): string {
  if (node.children.length !== 1) {
    error(`list item must contain exactly one paragraph, got ${node.children.length} children`);
  }

  const child = node.children[0];

  if (child.type !== "paragraph") {
    error(`list item child must be paragraph, got ${child.type}`);
  }

  return paragraphText(child);
}

function listBlock(node: List): SectionBlock {
  if (node.children.length === 0) {
    error("empty list");
  }

  if (!node.ordered) {
    error("list blocks must be ordered because they are parsed as Item");
  }

  const start = node.start ?? 1;
  const items = node.children.map((item, index) => {
    const num = start + index;
    const body = listItemText(item);

    return {
      num,
      title: String(num),
      marker: `${num}.`,
      body,
    };
  });

  return {
    type: "list",
    text: items.map((item) => `${item.marker} ${item.body}`).join("\n"),
    items,
  };
}

function sectionBlock(node: Exclude<RootContent, DefinitionContent>): SectionBlock {
  switch (node.type) {
    case "paragraph":
      return { type: "paragraph", text: paragraphText(node) };
    case "list":
      return listBlock(node);
    default:
      error(`unsupported markdown block type: ${node.type}`);
  }
}

export function collectSections(markdown: string, label: string): Section[] {
  const tree = markdownProcessor.parse(markdown) as Root;
  const sections: Section[] = [];
  const parseHeadingStack = new Map<number, string>();
  const pathTitleStack = new Map<number, string>();
  const idStack = new Map<number, string>();
  const keyCounts = new Map<string, number>();
  const idCounts = new Map<string, number>();
  let current: Section | undefined;

  console.log(`[parse] ${label}`);

  for (const node of tree.children) {
    assertNoDefinitions(node);

    if (node.type === "heading") {
      const depth = depthOf(node);
      const title = textContent(node).trim();

      if (!title) {
        error(`empty heading in ${label}`);
      }
      const parentBaseTitle = Array.from(parseHeadingStack.entries())
        .filter(([level]) => level < depth)
        .sort(([left], [right]) => right - left)
        .at(0)?.[1];
      const parentId = Array.from(idStack.entries())
        .filter(([level]) => level < depth)
        .sort(([left], [right]) => right - left)
        .at(0)?.[1];
      const parsedHeading = parseHeadingTitle(title, depth, parentBaseTitle, parentId);
      const id = uniqueId(parsedHeading.id, idCounts, label);
      const pathTitle = sectionPathTitle(id, parsedHeading.parsedText.type);
      const heading = { ...parsedHeading, id };

      for (const key of Array.from(parseHeadingStack.keys())) {
        if (key >= depth) {
          parseHeadingStack.delete(key);
        }
      }
      for (const key of Array.from(pathTitleStack.keys())) {
        if (key >= depth) {
          pathTitleStack.delete(key);
        }
      }
      for (const key of Array.from(idStack.keys())) {
        if (key >= depth) {
          idStack.delete(key);
        }
      }
      parseHeadingStack.set(depth, parsedHeading.baseTitle);
      pathTitleStack.set(depth, pathTitle);
      if (heading.id) {
        idStack.set(depth, heading.id);
      }

      const baseKey = Array.from(pathTitleStack.entries())
        .sort(([left], [right]) => left - right)
        .map(([, value]) => value)
        .join(" / ");
      const count = (keyCounts.get(baseKey) ?? 0) + 1;
      keyCounts.set(baseKey, count);
      const key = count === 1 ? baseKey : `${baseKey} (${count})`;

      console.log(`  h${depth}: ${title} -> ${key}`);

      current = {
        key,
        title,
        pathTitle,
        rank: depth,
        blocks: [],
        text: "",
        heading,
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      error(`${label}: ${node.type} node appeared before the first heading`);
    }

    current.blocks.push(sectionBlock(node));
  }

  return sections.map((section) => ({
    ...section,
    text: section.blocks.map((block) => block.text).join("\n\n").trim(),
  }));
}

function sectionPathTitle(id: string, type: string): string {
  return id || type;
}

function uniqueId(id: string, counts: Map<string, number>, label: string): string {
  if (!id) {
    return "";
  }

  const count = (counts.get(id) ?? 0) + 1;
  counts.set(id, count);

  if (id === "supplProvision") {
    return `${id}${count}`;
  }

  if (count === 1) {
    return id;
  }

  error(`duplicate id ${id} in ${label}`);
}
