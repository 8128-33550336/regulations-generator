import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { relativePath } from "../shared/path.js";

let browserPromise: Promise<Browser> | undefined;

async function pdfBrowser(): Promise<Browser> {
  browserPromise ??= puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  return browserPromise;
}

async function writePdf(page: Page, pdfFile: string): Promise<void> {
  await page.emulateMediaType("print");
  await mkdir(path.dirname(pdfFile), { recursive: true });
  await page.pdf({
    path: pdfFile,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
}

export async function closePdfBrowser(): Promise<void> {
  const browser = await browserPromise;
  browserPromise = undefined;
  await browser?.close();
}

export async function renderPdfFromHtml(htmlFile: string, pdfFile: string): Promise<void> {
  const browser = await pdfBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle0" });
    await writePdf(page, pdfFile);
  } finally {
    await page.close();
  }

  console.log(`Wrote ${relativePath(pdfFile)}`);
}

export async function renderPdfFromHtmlContent(html: string, pdfFile: string): Promise<void> {
  const browser = await pdfBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "load" });
    await writePdf(page, pdfFile);
  } finally {
    await page.close();
  }

  console.log(`Wrote ${relativePath(pdfFile)}`);
}
