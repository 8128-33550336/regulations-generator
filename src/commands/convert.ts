import { closePdfBrowser } from "../render/pdf.js";
import { resolveArgPath } from "../shared/path.js";
import { writeSingleFile } from "./law-files.js";
import type { GenerateOptions } from "./types.js";

export async function convert(input: string, output: string, options: GenerateOptions): Promise<void> {
  const effectiveOptions = expandConvertOptions(options);

  try {
    await writeSingleFile(resolveArgPath(input), resolveArgPath(output), effectiveOptions);
  } finally {
    await closePdfBrowser();
  }
}

function expandConvertOptions(options: GenerateOptions): GenerateOptions {
  return {
    ...options,
    html: Boolean(options.html || options.all),
    pdf: Boolean(options.pdf || options.all),
    xml: Boolean(options.xml || options.all),
    json: Boolean(options.json || options.all),
    toml: Boolean(options.toml || options.all),
    md: Boolean(options.md || options.all),
  };
}
