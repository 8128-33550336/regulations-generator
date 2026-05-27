import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { packageRoot } from "../shared/package-root.js";
import { relativePath } from "../shared/path.js";

const stylesheetFile = "regulation.css";
const sourceStylesheet = path.join(packageRoot(import.meta.url), "resources", stylesheetFile);

export function stylesheetHref(htmlFile: string, outputRoot: string): string {
  return path.relative(path.dirname(htmlFile), path.join(outputRoot, stylesheetFile)).split(path.sep).join("/");
}

export async function copyStylesheet(outputRoot: string, options: { log?: boolean } = {}): Promise<void> {
  const outputFile = path.join(outputRoot, stylesheetFile);

  await mkdir(outputRoot, { recursive: true });
  await copyFile(sourceStylesheet, outputFile);
  if (options.log !== false) {
    console.log(`Wrote ${relativePath(outputFile)}`);
  }
}
