import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { relativePath } from "../shared/path.js";

const stylesheetFile = "regulation.css";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceStylesheet = path.join(packageRoot, "resources", stylesheetFile);

export function stylesheetHref(htmlFile: string, outputRoot: string): string {
  return path.relative(path.dirname(htmlFile), path.join(outputRoot, stylesheetFile)).split(path.sep).join("/");
}

export function sourceStylesheetHref(): string {
  return pathToFileURL(sourceStylesheet).href;
}

export async function copyStylesheet(outputRoot: string, options: { log?: boolean } = {}): Promise<void> {
  const outputFile = path.join(outputRoot, stylesheetFile);

  await mkdir(outputRoot, { recursive: true });
  await copyFile(sourceStylesheet, outputFile);
  if (options.log !== false) {
    console.log(`Wrote ${relativePath(outputFile)}`);
  }
}
