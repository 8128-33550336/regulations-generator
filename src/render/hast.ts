import { unified } from "unified";
import rehypeStringify from "rehype-stringify";

export type HtmlNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, string>;
  children?: HtmlNode[];
};

const htmlStringifier = unified().use(rehypeStringify, {
  closeSelfClosing: true,
});

export function text(value: string): HtmlNode {
  return { type: "text", value };
}

export function element(tagName: string, properties: Record<string, string> = {}, children: HtmlNode[] = []): HtmlNode {
  return { type: "element", tagName, properties, children };
}

function root(children: HtmlNode[]): HtmlNode {
  return { type: "root", children };
}

export function renderNodes(nodes: HtmlNode[]): string {
  return String(htmlStringifier.stringify(root(nodes) as never));
}
