import XMLBuilder from "fast-xml-builder";
import type { GeneratedLaw } from "../types.js";

type SitemapNode = Record<string, SitemapNode[] | string | Record<string, string>>;

const xmlBuilder = new XMLBuilder({
  attributeNamePrefix: "@_",
  format: true,
  ignoreAttributes: false,
  preserveOrder: true,
  suppressEmptyNode: false,
});

function text(value: string): SitemapNode {
  return { "#text": value };
}

function element(name: string, attributes: Record<string, string>, children: SitemapNode[] = []): SitemapNode {
  const node: SitemapNode = { [name]: children };

  if (Object.keys(attributes).length > 0) {
    node[":@"] = Object.fromEntries(Object.entries(attributes).map(([key, value]) => [`@_${key}`, value]));
  }

  return node;
}

export function renderSitemap(laws: GeneratedLaw[], baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const urls = laws.flatMap((law) => law.files.map((file) => new URL(file.path, normalizedBaseUrl).toString()));
  const urlset = element(
    "urlset",
    { xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9" },
    urls.map((url) => element("url", {}, [element("loc", {}, [text(url)])])),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBuilder.build([urlset]).trimStart()}\n`;
}
