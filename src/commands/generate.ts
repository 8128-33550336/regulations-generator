import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderIndexHtml, renderIndexJson, renderIndexMarkdown } from "../render/index.js";
import { renderSitemap } from "../render/sitemap.js";
import { closePdfBrowser } from "../render/pdf.js";
import { relativePath, resolveArgPath } from "../shared/cli.js";
import type { GeneratedLaw } from "../types.js";
import { generateOne, markdownInputs, writeSingleFile } from "./law-files.js";
import { copyStylesheet, stylesheetHref } from "./resources.js";
import type { GenerateOptions } from "./types.js";

function indexTitle(inputPath: string, options: GenerateOptions): string {
  return options.title ?? path.basename(inputPath.replace(/[\\/]$/, ""));
}

async function writeIndexFiles(inputPath: string, outputDir: string, laws: GeneratedLaw[], options: GenerateOptions): Promise<void> {
  const title = indexTitle(inputPath, options);
  const indexJson = path.join(outputDir, "index.json");
  const indexHtml = path.join(outputDir, "index.html");
  const indexMd = path.join(outputDir, "index.md");

  await writeFile(indexJson, renderIndexJson(laws));
  await writeFile(indexHtml, renderIndexHtml(laws, title, options.description, stylesheetHref(indexHtml, outputDir)));
  await writeFile(indexMd, renderIndexMarkdown(laws, title, options.description));
  console.log(`Wrote ${relativePath(indexJson)}`);
  console.log(`Wrote ${relativePath(indexHtml)}`);
  console.log(`Wrote ${relativePath(indexMd)}`);
}

async function writeSitemapFile(outputDir: string, laws: GeneratedLaw[], options: GenerateOptions): Promise<void> {
  const sitemapFile = path.join(outputDir, "sitemap.xml");
  await writeFile(sitemapFile, renderSitemap(laws, options.baseUrl));
  console.log(`Wrote ${relativePath(sitemapFile)}`);
}

export async function generate(input: string, output: string | undefined, options: GenerateOptions): Promise<void> {
  const effectiveOptions = expandGenerateOptions(options);
  try {
    const inputPath = resolveArgPath(input);

    if (effectiveOptions.outputFile) {
      if (output) {
        throw new Error("Use either <output> directory or -o/--output-file, not both.");
      }

      await writeSingleFile(inputPath, resolveArgPath(effectiveOptions.outputFile), effectiveOptions);
      return;
    }

    if (!output) {
      throw new Error("Missing output directory.");
    }

    const outputPathValue = resolveArgPath(output);

    const inputFiles = await markdownInputs(inputPath);
    await mkdir(outputPathValue, { recursive: true });
    if (effectiveOptions.html || effectiveOptions.index) {
      await copyStylesheet(outputPathValue);
    }

    const laws: GeneratedLaw[] = [];

    for (const inputFile of inputFiles) {
      laws.push(await generateOne(inputFile, outputPathValue, effectiveOptions));
    }

    if (effectiveOptions.index) {
      await writeIndexFiles(inputPath, outputPathValue, laws, effectiveOptions);
    }

    if (effectiveOptions.sitemap) {
      await writeSitemapFile(outputPathValue, laws, effectiveOptions);
    }
  } finally {
    await closePdfBrowser();
  }
}

function expandGenerateOptions(options: GenerateOptions): GenerateOptions {
  return {
    ...options,
    html: Boolean(options.html || options.pdf || options.all),
    pdf: Boolean(options.pdf || options.all),
    xml: Boolean(options.xml || options.all),
    json: Boolean(options.json || options.all),
    index: Boolean(options.index || options.all),
    md: Boolean(options.md || options.all),
    sitemap: Boolean(options.sitemap || options.all),
  };
}
