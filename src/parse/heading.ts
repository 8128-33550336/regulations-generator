import type { HeadingCaption, ParsedHeading, ParsedHeadingText } from "../types.js";

const kanjiDigits = new Map([
  ["一", 1],
  ["二", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
]);
const supportedNumberPattern = /^(?:\d+|[一二三四五六七八九]|(?:[一二三四五六七八九]?十[一二三四五六七八九]?))$/u;

function normalizeDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}

function error(message: string): never {
  throw new Error(`[heading] ${message}`);
}

export function parseJapaneseNumber(value: string): number {
  const normalized = normalizeDigits(value.trim());

  if (!normalized) {
    error("empty number");
  }

  if (!supportedNumberPattern.test(normalized)) {
    error(`unsupported Japanese number: ${value}`);
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (kanjiDigits.has(normalized)) {
    const digit = kanjiDigits.get(normalized);

    if (digit === undefined) {
      error(`failed to parse Japanese digit: ${value}`);
    }

    return digit;
  }

  if (normalized === "十") {
    return 10;
  }

  const tenMatch = /^([一二三四五六七八九]?)十([一二三四五六七八九]?)$/u.exec(normalized);

  if (!tenMatch) {
    error(`failed to parse Japanese number: ${value}`);
  }

  const tens = tenMatch[1] ? kanjiDigits.get(tenMatch[1]) : 1;
  const ones = tenMatch[2] ? kanjiDigits.get(tenMatch[2]) : 0;

  if (tens === undefined || ones === undefined) {
    error(`failed to parse Japanese number: ${value}`);
  }

  return tens * 10 + ones;
}

function parseHeadingText(baseTitle: string, depth: number, parentBaseTitle?: string): ParsedHeadingText {
  if (depth === 1) {
    return { type: "law", rawText: baseTitle };
  }

  if (depth === 2) {
    const chapterMatch = /^第(.+?)章(?:\s+.+)?$/u.exec(baseTitle);

    if (chapterMatch) {
      return { type: "chapter", num: [parseJapaneseNumber(chapterMatch[1])], rawText: baseTitle };
    }

    if (baseTitle === "本則") {
      return { type: "mainProvision", rawText: baseTitle };
    }

    if (baseTitle === "前文") {
      return { type: "preamble", rawText: baseTitle };
    }

    if (baseTitle === "附則" || baseTitle === "附記") {
      return { type: "supplProvision", rawText: baseTitle };
    }

    error(`h2 heading must be a chapter, preamble, main provision, or supplementary provision: ${baseTitle}`);
  }

  if (depth === 3) {
    const articleMatch = /^第(.+?)条(?:の(.+))?$/.exec(baseTitle);

    if (!articleMatch) {
      error(`h3 heading must be an article heading: ${baseTitle}`);
    }

    const articleNumber = parseJapaneseNumber(articleMatch[1]);
    const subArticle = articleMatch[2] ? Number(normalizeDigits(articleMatch[2])) : undefined;

    if (subArticle !== undefined && !Number.isInteger(subArticle)) {
      error(`unsupported sub-article number: ${baseTitle}`);
    }

    return {
      type: "article",
      num: subArticle === undefined ? [articleNumber] : [articleNumber, subArticle],
      rawText: baseTitle,
    };
  }

  if (depth === 4) {
    const paragraphNumber = parseJapaneseNumber(baseTitle);

    return { type: "paragraph", num: [paragraphNumber], rawText: baseTitle };
  }

  if (depth >= 5) {
    const itemNumber = parseJapaneseNumber(baseTitle);

    if (!parentBaseTitle) {
      error(`item heading has no parent paragraph: ${baseTitle}`);
    }

    parseJapaneseNumber(parentBaseTitle);
    return { type: "item", num: [itemNumber], rawText: baseTitle };
  }

  return { type: "law", rawText: baseTitle };
}

function headingIdSegmentFromParsed(parsedText: ParsedHeadingText): string {
  switch (parsedText.type) {
    case "law":
      return "";
    case "chapter":
      return `chapter${parsedText.num?.[0]}`;
    case "mainProvision":
      return "mainProvision";
    case "preamble":
      return "preamble";
    case "supplProvision":
      return "supplProvision";
    case "article":
      if (!parsedText.num || parsedText.num.length < 1 || parsedText.num.length > 2) {
        error(`invalid article number: ${parsedText.rawText}`);
      }

      return `article${parsedText.num[0]}${parsedText.num[1] === undefined ? "" : `-${parsedText.num[1]}`}`;
    case "paragraph":
      return `paragraph${parsedText.num?.[0]}`;
    case "item":
      return `item${parsedText.num?.[0]}`;
  }
}

export function headingIdSegment(baseTitle: string, depth: number, parentBaseTitle?: string): string {
  return headingIdSegmentFromParsed(parseHeadingText(baseTitle, depth, parentBaseTitle));
}

function validateHeadingDepth(title: string, depth: number): void {
  if (depth < 1 || depth > 6) {
    error(`unsupported heading depth h${depth}: ${title}`);
  }
}

type ParsedTitle = {
  title: string;
  caption?: HeadingCaption;
};

function parseChapterTitleWithCaption(title: string): ParsedTitle | undefined {
  const match = /^(第.+?章)(\s+)(.+)$/u.exec(title);

  if (!match) {
    return undefined;
  }

  return {
    title: match[1],
    caption: {
      prefix: match[2],
      caption: match[3],
      suffix: "",
    },
  };
}

function parseTitleWithCaption(title: string): ParsedTitle {
  const chapterTitle = parseChapterTitleWithCaption(title);

  if (chapterTitle) {
    return chapterTitle;
  }

  const openCount = [...title].filter((char) => char === "（" || char === "(").length;
  const closeCount = [...title].filter((char) => char === "）" || char === ")").length;

  if (openCount > 1 || closeCount > 1) {
    error(`heading has multiple parentheticals: ${title}`);
  }

  if (openCount !== closeCount) {
    error(`unbalanced parenthetical heading: ${title}`);
  }

  if (openCount === 0) {
    return { title };
  }

  const openParenIndex = title.search(/[（(]/u);
  const closeParenIndex = title.length - 1;
  const closeParen = title[closeParenIndex];

  if (openParenIndex < 0 || (closeParen !== "）" && closeParen !== ")")) {
    error(`unsupported parenthetical heading shape: ${title}`);
  }

  const openParen = title[openParenIndex];

  if ((openParen === "（" && closeParen !== "）") || (openParen === "(" && closeParen !== ")")) {
    error(`mismatched parenthetical heading: ${title}`);
  }

  const beforeParen = title.slice(0, openParenIndex);
  const caption = title.slice(openParenIndex + 1, closeParenIndex);
  const separatorStart = beforeParen.trimEnd().length;

  return {
    title: beforeParen.slice(0, separatorStart),
    caption: {
      prefix: `${beforeParen.slice(separatorStart)}${openParen}`,
      caption,
      suffix: closeParen,
    },
  };
}

function ensureParentForSegment(depth: number, baseTitle: string, parentId?: string): void {
  if (depth >= 4 && !parentId) {
    error(`heading has no parent id: ${baseTitle}`);
  }
}

export function parseHeadingTitle(
  title: string,
  depth: number,
  parentBaseTitle?: string,
  parentId?: string,
): ParsedHeading {
  const trimmedTitle = title.trim();
  const parsedTitle = parseTitleWithCaption(trimmedTitle);

  if (!parsedTitle.caption) {
    const baseTitle = depth === 1 ? "law" : trimmedTitle;
    validateHeadingDepth(trimmedTitle, depth);
    const parsedText = parseHeadingText(baseTitle, depth, parentBaseTitle);

    return {
      title: trimmedTitle,
      id: buildHeadingId(parsedText, depth, parentId),
      parsedText,
      baseTitle: trimmedTitle,
    };
  }

  const baseTitle = depth === 1 ? "law" : parsedTitle.title;
  validateHeadingDepth(trimmedTitle, depth);
  const parsedText = parseHeadingText(baseTitle, depth, parentBaseTitle);

  return {
    title: trimmedTitle,
    id: buildHeadingId(parsedText, depth, parentId),
    parsedText,
    baseTitle: parsedTitle.title,
    caption: parsedTitle.caption,
  };
}

export function hasParenthetical(heading: Pick<ParsedHeading, "caption">): boolean {
  return heading.caption !== undefined;
}

function buildHeadingId(parsedText: ParsedHeadingText, depth: number, parentId?: string): string {
  const segment = headingIdSegmentFromParsed(parsedText);

  if (!segment) {
    return "";
  }

  if (segment.startsWith("article")) {
    return segment;
  }

  ensureParentForSegment(depth, parsedText.rawText, parentId);
  return parentId ? `${parentId}-${segment}` : segment;
}
