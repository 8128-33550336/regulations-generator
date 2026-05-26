import { element, text, type HtmlNode } from "./hast.js";
import { renderHtmlDocument } from "./page.js";
import type { GeneratedLaw, OutputFile } from "../types.js";

export function renderIndexJson(laws: GeneratedLaw[]): string {
  return `${JSON.stringify({ laws }, null, 2)}\n`;
}

export function renderIndexHtml(laws: GeneratedLaw[], title: string, description: string): string {
  const items = laws.map((law) => {
    const children: HtmlNode[] = [text(law.base)];

    for (const file of law.files) {
      children.push(text(" "), element("a", { href: file.path }, [text(`${file.type}${validationMark(file)}`)]));
    }

    return element("li", {}, children);
  });
  return renderHtmlDocument({
    title,
    stylesheets: [],
    body: [
      element("h1", {}, [text(title)]),
      element("p", {}, [text(description)]),
      element("ul", {}, items),
    ],
  });
}

export function renderIndexMarkdown(laws: GeneratedLaw[], title: string, description: string): string {
  const lines = [`# ${title}`, "", description, ""];

  for (const law of laws) {
    const links = law.files.map((file) => `[${file.type}${validationMark(file)}](${file.path})`).join(" ");
    lines.push(links ? `- ${law.base} ${links}` : `- ${law.base}`);
  }

  lines.push("");
  return lines.join("\n");
}

function validationMark(file: OutputFile): string {
  if (file.validate === undefined) {
    return "";
  }

  return file.validate ? " ✅" : " ❌";
}
