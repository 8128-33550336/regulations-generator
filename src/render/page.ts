import { element, renderNodes, text, type HtmlNode } from "./hast.js";

function stylesheetLinkNodes(stylesheets: string[]): HtmlNode[] {
  return stylesheets.map((href) => element("link", { rel: "stylesheet", href }));
}

export function renderHtmlDocument(params: { title: string; stylesheets: string[]; body: HtmlNode[] }): string {
  const document = element("html", { lang: "ja" }, [
    element("head", {}, [
      element("meta", { charset: "utf-8" }),
      element("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      element("title", {}, [text(params.title)]),
      ...stylesheetLinkNodes(params.stylesheets),
    ]),
    element("body", {}, [
      element("main", { class: "page" }, params.body),
    ]),
  ]);

  return `<!doctype html>${renderNodes([document])}`;
}
