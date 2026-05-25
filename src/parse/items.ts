import { parseJapaneseNumber } from "./heading.js";

const kanjiListItemPattern = /^([一二三四五六七八九十]+)([、.])\s*(.+)$/s;

export type KanjiListItem = {
  marker: string;
  itemNumber: number;
  title: string;
  body: string;
};

export function parseKanjiListItem(value: string): KanjiListItem | undefined {
  const match = kanjiListItemPattern.exec(value);

  if (!match) {
    return undefined;
  }

  return {
    marker: `${match[1]}${match[2]}`,
    itemNumber: parseJapaneseNumber(match[1]),
    title: match[1],
    body: match[3].trim(),
  };
}
