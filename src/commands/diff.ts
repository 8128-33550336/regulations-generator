import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildLawModel } from "../build/law-model.js";
import { buildDiffEntries } from "../diff/diff.js";
import { revisionDate } from "../diff/revision.js";
import { collectSections } from "../parse/markdown.js";
import { renderDiffHtmlDocument } from "../render/diff-html.js";
import { closePdfBrowser, renderPdfFromHtml, renderPdfFromHtmlContent } from "../render/pdf.js";
import { relativePath, resolveArgPath } from "../shared/path.js";
import { copyStylesheet, sourceStylesheetHref, stylesheetHref } from "./resources.js";

type DiffOptions = {
  html?: boolean;
  pdf?: boolean;
};

function pdfOutputPath(htmlFile: string): string {
  return path.join(path.dirname(htmlFile), `${path.basename(htmlFile, path.extname(htmlFile))}.pdf`);
}

function defaultOutputFile(options: DiffOptions): string {
  return options.pdf && !options.html ? "diff-before-after.pdf" : "diff-before-after.html";
}

export async function diff(oldFile: string, newFile: string, outputFile: string | undefined, options: DiffOptions = {}): Promise<void> {
  try {
    const outputHtml = Boolean(options.html || !options.pdf);
    const outputPdf = Boolean(options.pdf);
    const oldPath = resolveArgPath(oldFile);
    const newPath = resolveArgPath(newFile);
    const outputPathValue = resolveArgPath(outputFile ?? defaultOutputFile({ html: outputHtml, pdf: outputPdf }));
    const outputRoot = path.dirname(outputPathValue);
    const [oldMarkdown, newMarkdown] = await Promise.all([
      readFile(oldPath, "utf8"),
      readFile(newPath, "utf8"),
    ]);
    const oldSections = collectSections(oldMarkdown, relativePath(oldPath));
    const newSections = collectSections(newMarkdown, relativePath(newPath));
    const oldLawModel = buildLawModel(oldSections);
    const newLawModel = buildLawModel(newSections);
    const html = await renderDiffHtmlDocument({
      title: newLawModel.title.title,
      date: revisionDate(newLawModel),
      entries: buildDiffEntries(oldLawModel, newLawModel),
      stylesheets: [outputHtml ? stylesheetHref(outputPathValue, outputRoot) : sourceStylesheetHref()],
    });

    if (outputHtml) {
      await mkdir(outputRoot, { recursive: true });
      await copyStylesheet(outputRoot);
      await writeFile(outputPathValue, html);
      console.log(`Wrote ${relativePath(outputPathValue)}`);
    }

    if (outputPdf) {
      if (outputHtml) {
        await renderPdfFromHtml(outputPathValue, pdfOutputPath(outputPathValue));
      } else {
        await renderPdfFromHtmlContent(html, outputPathValue);
      }
    }
  } finally {
    await closePdfBrowser();
  }
}
