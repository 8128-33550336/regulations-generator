import { element, text, type HtmlNode } from "./hast.js";

export function renderDateTimeNodes(value: string): HtmlNode[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);

  if (!match) {
    throw new Error(`[date-time] expected YYYY-MM-DD date: ${value}`);
  }

  const [, year, month, day] = match;
  return [element("time", { datetime: value }, [text(`${year}年${month}月${day}日`)])];
}
