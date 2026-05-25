import { Command } from "commander";
import { diff } from "./diff.js";
import { generate } from "./generate.js";
import type { GenerateOptions } from "./types.js";

const program = new Command();

program
  .name("generate")
  .description("Generate regulation files from Markdown")
  .helpOption("--help", "display help for command")
  .argument("<input>", "Markdown file or directory")
  .argument("[output]", "Output directory")
  .option("-o, --output-file <file>", "write one output file")
  .option("-a, --all", "write HTML, PDF, XML, JSON, Markdown, index, and sitemap files")
  .option("-H, --html", "write HTML files")
  .option("-p, --pdf", "write PDF files after writing HTML files")
  .option("-x, --xml", "write XML files")
  .option("-j, --json", "write JSON files")
  .option("-i, --index", "write index.html, index.md, and index.json")
  .option("-m, --md", "copy Markdown files")
  .option("-s, --sitemap", "write sitemap.xml")
  .option("-b, --base-url <url>", "base URL for sitemap.xml", "https://example.com/")
  .option("--title <title>", "title for index.html")
  .option("--description <description>", "description for index.html", "List of files")
  .action((input: string, output: string | undefined, options: GenerateOptions) => {
    generate(input, output, options).catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });

program
  .command("diff")
  .description("Generate diff HTML and PDF files")
  .argument("<before.md>", "before Markdown file")
  .argument("<after.md>", "after Markdown file")
  .argument("[output.html]", "output HTML file; PDF is written next to it", "diff-before-after.html")
  .action((before: string, after: string, output: string) => {
    diff(before, after, output).catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });

program.parse();
