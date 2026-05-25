#!/usr/bin/env node

import { Command } from "commander";
import { convert } from "./convert.js";
import { diff } from "./diff.js";
import { generate } from "./generate.js";
import type { GenerateOptions } from "./types.js";

const program = new Command();

function addFormatOptions(command: Command): Command {
  return command
    .option("-H, --html", "write HTML files")
    .option("-p, --pdf", "write PDF files")
    .option("-x, --xml", "write XML files")
    .option("-j, --json", "write JSON files")
    .option("-m, --md", "copy Markdown files");
}

function addDirectoryOptions(command: Command): Command {
  return addFormatOptions(command)
    .option("-a, --all", "write HTML, PDF, XML, JSON, Markdown, index, and sitemap files")
    .option("-i, --index", "write index.html, index.md, and index.json")
    .option("-s, --sitemap", "write sitemap.xml")
    .option("-b, --base-url <url>", "base URL for sitemap.xml", "https://example.com/")
    .option("--title <title>", "title for index.html")
    .option("--description <description>", "description for index.html", "List of files");
}

program
  .name("regulations-generate")
  .description("Generate regulation files from Markdown")
  .helpOption("--help", "display help for command");

addDirectoryOptions(
  program
    .command("gen")
    .alias("generate")
    .description("Generate regulation files from Markdown files into an output directory")
    .argument("<input>", "Markdown file or directory")
    .argument("<output>", "Output directory"),
).action((input: string, output: string, options: GenerateOptions) => {
    generate(input, output, options).catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });

addFormatOptions(
  program
    .command("conv")
    .alias("convert")
    .description("Convert one Markdown file into one output file")
    .argument("<input.md>", "Markdown file")
    .argument("<output>", "Output file"),
).action((input: string, output: string, options: GenerateOptions) => {
  convert(input, output, options).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
});

program
  .command("diff")
  .description("Generate diff HTML or PDF files")
  .option("-H, --html", "write HTML file")
  .option("-p, --pdf", "write PDF file")
  .argument("<before.md>", "before Markdown file")
  .argument("<after.md>", "after Markdown file")
  .argument("[output]", "output file")
  .action((before: string, after: string, output: string | undefined, options: { html?: boolean; pdf?: boolean }) => {
    diff(before, after, output, options).catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });

program.parse();
