import { element, renderNodes, text, type HtmlNode } from "./hast.js";

function getContext(): { generator: string } {
  const repository = process.env.BUILD_GITHUB_REPOSITORY;
  const commit = process.env.BUILD_GITHUB_SHA;
  const serverUrl = process.env.BUILD_GITHUB_SERVER_URL;

  if (!repository || !commit || !serverUrl) {
    return { generator: "regulations-generator" };
  }

  return {
    generator: `${repository}@${commit.slice(0, 8)} ${serverUrl}/${repository}/tree/${commit}`,
  };
}

function stylesheetLinkNodes(stylesheets: string[]): HtmlNode[] {
  return stylesheets.map((href) => element("link", { rel: "stylesheet", href }));
}

export function renderHtmlDocument(params: { title: string; stylesheets: string[]; body: HtmlNode[] }): string {
  const context = getContext();

  const document = element("html", { lang: "ja" }, [
    element("head", {}, [
      element("meta", { charset: "utf-8" }),
      element("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      element("meta", { name: "generator", content: context.generator }),
      element("title", {}, [text(params.title)]),
      ...stylesheetLinkNodes(params.stylesheets),
    ]),
    element("body", {}, [
      element("main", { class: "page" }, params.body),
    ]),
  ]);

  return `<!doctype html>${renderNodes([document])}`;
}
