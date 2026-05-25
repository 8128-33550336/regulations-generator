import { element, renderNodes, text, type HtmlNode } from "./hast.js";
import type { GeneratedLaw } from "../types.js";

export function renderIndexJson(laws: GeneratedLaw[]): string {
  return `${JSON.stringify({ laws }, null, 2)}\n`;
}

export function renderIndexHtml(laws: GeneratedLaw[], title: string, description: string, stylesheet: string): string {
  const items = laws.map((law) => {
    const children: HtmlNode[] = [text(law.base)];

    for (const file of law.files) {
      children.push(text(" "), element("a", { href: file.path }, [text(file.type)]));
    }

    return element("li", {}, children);
  });
  const document = element("html", { lang: "ja" }, [
    element("head", {}, [
      element("meta", { charset: "UTF-8" }),
      element("meta", { name: "viewport", content: "width=device-width, initial-scale=1.0" }),
      element("title", {}, [text(title)]),
    ]),
    element("body", {}, [
      element("h1", {}, [text(title)]),
      element("p", {}, [text(description)]),
      element("ul", {}, items),
    ]),
  ]);

  return `<!DOCTYPE html>${renderNodes([document])}\n`;
}

export function renderIndexMarkdown(laws: GeneratedLaw[], title: string, description: string): string {
  const lines = [`# ${title}`, "", description, ""];

  for (const law of laws) {
    const links = law.files.map((file) => `[${file.type}](${file.path})`).join(" ");
    lines.push(links ? `- ${law.base} ${links}` : `- ${law.base}`);
  }

  lines.push("");
  return lines.join("\n");
}
