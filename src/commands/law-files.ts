import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildLawModel } from "../build/law-model.js";
import { collectSections } from "../parse/markdown.js";
import { renderHtmlDocument } from "../render/page.js";
import { renderPdfFromHtml, renderPdfFromHtmlContent } from "../render/pdf.js";
import { renderLawDocumentModelNodes } from "../render/sections.js";
import { renderLawModelToml } from "../render/toml.js";
import { renderXmlModel } from "../render/xml.js";
import { relativePath } from "../shared/path.js";
import type { GeneratedLaw, LawDocumentModel, OutputFile, Section } from "../types.js";
import { copyStylesheet, sourceStylesheetHref, stylesheetHref } from "./resources.js";
import type { GenerateOptions } from "./types.js";

type ParsedMarkdown = {
  markdown: string;
  sections: Section[];
  lawModel: LawDocumentModel;
};

type NonPdfOutputFormat = Exclude<OutputFile["type"], "pdf">;

function assertNever(value: never): never {
  throw new Error(`Unsupported output format: ${value}`);
}

function selectedOutputFormats(options: GenerateOptions): NonPdfOutputFormat[] {
  const formats: NonPdfOutputFormat[] = [];

  if (options.html) formats.push("html");
  if (options.xml) formats.push("xml");
  if (options.json) formats.push("json");
  if (options.toml) formats.push("toml");
  if (options.md) formats.push("md");

  return formats;
}

function outputBaseName(inputFile: string): string {
  return path.basename(inputFile, path.extname(inputFile));
}

function outputPath(outputDir: string, base: string, ext: string): string {
  return path.join(outputDir, `${base}.${ext}`);
}

function relativeOutputPath(outputDir: string, file: string): string {
  return path.relative(outputDir, file).split(path.sep).join("/");
}

function htmlOutputForPdf(pdfFile: string): string {
  const parsed = path.parse(pdfFile);
  return path.join(parsed.dir, `${parsed.name || parsed.base}.html`);
}

export async function markdownInputs(inputPath: string): Promise<string[]> {
  const inputStat = await stat(inputPath);

  if (!inputStat.isDirectory()) {
    return [inputPath];
  }

  const entries = await readdir(inputPath);
  return entries
    .filter((entry) => entry.toLowerCase().endsWith(".md"))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => path.join(inputPath, entry));
}

async function parseMarkdown(inputFile: string): Promise<ParsedMarkdown> {
  const markdown = await readFile(inputFile, "utf8");
  const sections = collectSections(markdown, relativePath(inputFile));
  const lawModel = buildLawModel(sections);
  return { markdown, sections, lawModel };
}

async function writeHtml(
  parsed: ParsedMarkdown,
  file: string,
  outputRoot: string,
  options: { log?: boolean } = {},
): Promise<void> {
  const html = await renderHtml(parsed, stylesheetHref(file, outputRoot));
  await writeFile(file, html);
  if (options.log !== false) {
    console.log(`Wrote ${relativePath(file)}`);
  }
}

async function renderHtml(parsed: ParsedMarkdown, stylesheet: string): Promise<string> {
  const body = await renderLawDocumentModelNodes(parsed.lawModel);
  return renderHtmlDocument({
    title: parsed.lawModel.title.title,
    stylesheets: [stylesheet],
    body,
  });
}

async function writeXml(parsed: ParsedMarkdown, file: string): Promise<void> {
  await writeFile(file, renderXmlModel(parsed.lawModel));
  console.log(`Wrote ${relativePath(file)}`);
}

async function writeJson(parsed: ParsedMarkdown, file: string): Promise<void> {
  await writeFile(file, `${JSON.stringify(parsed.lawModel, null, 2)}\n`);
  console.log(`Wrote ${relativePath(file)}`);
}

async function writeToml(parsed: ParsedMarkdown, file: string): Promise<void> {
  await writeFile(file, renderLawModelToml(parsed.lawModel));
  console.log(`Wrote ${relativePath(file)}`);
}

async function writeMarkdown(inputFile: string, file: string): Promise<void> {
  await copyFile(inputFile, file);
  console.log(`Wrote ${relativePath(file)}`);
}

export async function writeSingleFile(inputFile: string, outputFile: string, options: GenerateOptions): Promise<void> {
  const inputStat = await stat(inputFile);

  if (inputStat.isDirectory()) {
    throw new Error("conv/convert can only be used with a single Markdown file input.");
  }

  if (options.index || options.sitemap) {
    throw new Error("-i/--index and -s/--sitemap cannot be used with conv/convert.");
  }

  const formats = selectedOutputFormats(options);

  if (options.pdf && (options.xml || options.json || options.toml || options.md)) {
    throw new Error("-p/--pdf cannot be combined with -x, -j, -t, or -m in conv/convert.");
  }

  if (!options.pdf && formats.length > 1) {
    throw new Error("conv/convert can only be used with one output format.");
  }

  if (!options.pdf && formats.length === 0) {
    return;
  }

  await mkdir(path.dirname(outputFile), { recursive: true });

  if (options.pdf) {
    const parsed = await parseMarkdown(inputFile);
    if (options.html) {
      const htmlFile = htmlOutputForPdf(outputFile);
      const outputRoot = path.dirname(htmlFile);
      await copyStylesheet(outputRoot);
      await writeHtml(parsed, htmlFile, outputRoot);
      await renderPdfFromHtml(htmlFile, outputFile);
      return;
    }

    await renderPdfFromHtmlContent(await renderHtml(parsed, sourceStylesheetHref()), outputFile);
    return;
  }

  const format = formats[0];

  switch (format) {
    case "md":
      await writeMarkdown(inputFile, outputFile);
      return;
    case "html": {
      const parsed = await parseMarkdown(inputFile);
      await copyStylesheet(path.dirname(outputFile));
      await writeHtml(parsed, outputFile, path.dirname(outputFile));
      return;
    }
    case "xml": {
      const parsed = await parseMarkdown(inputFile);
      await writeXml(parsed, outputFile);
      return;
    }
    case "json": {
      const parsed = await parseMarkdown(inputFile);
      await writeJson(parsed, outputFile);
      return;
    }
    case "toml": {
      const parsed = await parseMarkdown(inputFile);
      await writeToml(parsed, outputFile);
      return;
    }
    default:
      assertNever(format);
  }
}

export async function generateOne(inputFile: string, outputDir: string, options: GenerateOptions): Promise<GeneratedLaw> {
  const base = outputBaseName(inputFile);
  const parsed = await parseMarkdown(inputFile);
  const files: OutputFile[] = [];
  const htmlFile = outputPath(outputDir, base, "html");

  if (options.html) {
    await writeHtml(parsed, htmlFile, outputDir);
    files.push({ type: "html", path: relativeOutputPath(outputDir, htmlFile) });

    const indexHtmlFile = path.join(outputDir, base, "index.html");
    await mkdir(path.dirname(indexHtmlFile), { recursive: true });
    await writeHtml(parsed, indexHtmlFile, outputDir);
    files.push({ type: "html", path: relativeOutputPath(outputDir, indexHtmlFile) });
  }

  if (options.pdf) {
    const pdfFile = outputPath(outputDir, base, "pdf");
    if (options.html) {
      await renderPdfFromHtml(htmlFile, pdfFile);
    } else {
      await renderPdfFromHtmlContent(await renderHtml(parsed, sourceStylesheetHref()), pdfFile);
    }
    files.push({ type: "pdf", path: relativeOutputPath(outputDir, pdfFile) });
  }

  if (options.xml) {
    const xmlFile = outputPath(outputDir, base, "xml");
    await writeXml(parsed, xmlFile);
    files.push({ type: "xml", path: relativeOutputPath(outputDir, xmlFile) });
  }

  if (options.json) {
    const jsonFile = outputPath(outputDir, base, "json");
    await writeJson(parsed, jsonFile);
    files.push({ type: "json", path: relativeOutputPath(outputDir, jsonFile) });
  }

  if (options.toml) {
    const tomlFile = outputPath(outputDir, base, "toml");
    await writeToml(parsed, tomlFile);
    files.push({ type: "toml", path: relativeOutputPath(outputDir, tomlFile) });
  }

  if (options.md) {
    const mdFile = outputPath(outputDir, base, "md");
    await writeMarkdown(inputFile, mdFile);
    files.push({ type: "md", path: relativeOutputPath(outputDir, mdFile) });
  }

  return { base, files };
}
