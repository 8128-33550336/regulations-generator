import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildLawModel } from "../build/law-model.js";
import { buildDiffEntries } from "../diff/diff.js";
import { revisionDate } from "../diff/revision.js";
import { collectSections } from "../parse/markdown.js";
import { renderDiffHtmlDocument } from "../render/diff-html.js";
import { closePdfBrowser, renderPdfFromHtml } from "../render/pdf.js";
import { relativePath, resolveArgPath } from "../shared/cli.js";
import { copyStylesheet, stylesheetHref } from "./resources.js";

function pdfOutputPath(htmlFile: string): string {
  return path.join(path.dirname(htmlFile), `${path.basename(htmlFile, path.extname(htmlFile))}.pdf`);
}

export async function diff(oldFile: string, newFile: string, outputFile?: string): Promise<void> {
  try {
    const oldPath = resolveArgPath(oldFile);
    const newPath = resolveArgPath(newFile);
    const outputPathValue = resolveArgPath(outputFile ?? "diff-before-after.html");
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
      stylesheets: [stylesheetHref(outputPathValue, outputRoot)],
    });

    await mkdir(outputRoot, { recursive: true });
    await copyStylesheet(outputRoot);
    await writeFile(outputPathValue, html);
    console.log(`Wrote ${relativePath(outputPathValue)}`);
    await renderPdfFromHtml(outputPathValue, pdfOutputPath(outputPathValue));
  } finally {
    await closePdfBrowser();
  }
}
