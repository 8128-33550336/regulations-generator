import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildLawModel } from "../build/law-model.js";
import { buildDiffEntries } from "../diff/diff.js";
import { revisionDate } from "../diff/revision.js";
import { collectSections } from "../parse/markdown.js";
import { renderDiffHtmlDocument } from "../render/diff-html.js";
import { closePdfBrowser, renderPdfFromHtml } from "../render/pdf.js";
import { relativePath, resolveArgPath } from "../shared/path.js";
import { copyStylesheet, stylesheetHref } from "./resources.js";

type DiffOptions = {
  html?: boolean;
  pdf?: boolean;
};

type DiffFormat = "html" | "pdf";

type DiffHtmlData = Omit<Parameters<typeof renderDiffHtmlDocument>[0], "stylesheets">;

function defaultOutputFile(format: DiffFormat): string {
  return format === "pdf" ? "diff-before-after.pdf" : "diff-before-after.html";
}

function outputFormat(options: DiffOptions): DiffFormat {
  if (options.html && options.pdf) {
    throw new Error("-H/--html and -p/--pdf cannot be used together in diff.");
  }

  return options.pdf ? "pdf" : "html";
}

async function buildDiffHtmlData(oldPath: string, newPath: string): Promise<DiffHtmlData> {
  const [oldMarkdown, newMarkdown] = await Promise.all([
    readFile(oldPath, "utf8"),
    readFile(newPath, "utf8"),
  ]);
  const oldSections = collectSections(oldMarkdown, relativePath(oldPath));
  const newSections = collectSections(newMarkdown, relativePath(newPath));
  const oldLawModel = buildLawModel(oldSections);
  const newLawModel = buildLawModel(newSections);

  return {
    title: newLawModel.title.title,
    date: revisionDate(newLawModel),
    entries: buildDiffEntries(oldLawModel, newLawModel),
  };
}

async function renderDiffHtml(data: DiffHtmlData, htmlFile: string, outputRoot: string): Promise<string> {
  return renderDiffHtmlDocument({
    ...data,
    stylesheets: [stylesheetHref(htmlFile, outputRoot)],
  });
}

async function writeDiffHtml(data: DiffHtmlData, htmlFile: string, outputRoot: string): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  await copyStylesheet(outputRoot);
  await writeFile(htmlFile, await renderDiffHtml(data, htmlFile, outputRoot));
  console.log(`Wrote ${relativePath(htmlFile)}`);
}

async function renderDiffPdf(data: DiffHtmlData, pdfFile: string): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "regulations-generator-pdf-"));
  const tempHtmlFile = path.join(tempRoot, "index.html");

  try {
    await copyStylesheet(tempRoot, { log: false });
    await writeFile(tempHtmlFile, await renderDiffHtml(data, tempHtmlFile, tempRoot));
    await renderPdfFromHtml(tempHtmlFile, pdfFile);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export async function diff(oldFile: string, newFile: string, outputFile: string | undefined, options: DiffOptions = {}): Promise<void> {
  try {
    const format = outputFormat(options);
    const oldPath = resolveArgPath(oldFile);
    const newPath = resolveArgPath(newFile);
    const outputPathValue = resolveArgPath(outputFile ?? defaultOutputFile(format));
    const htmlData = await buildDiffHtmlData(oldPath, newPath);

    if (format === "html") {
      await writeDiffHtml(htmlData, outputPathValue, path.dirname(outputPathValue));
      return;
    }

    await renderDiffPdf(htmlData, outputPathValue);
  } finally {
    await closePdfBrowser();
  }
}
