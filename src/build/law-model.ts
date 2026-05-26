import { parseKanjiListItem } from "../parse/items.js";
import { parseJapaneseNumber } from "../parse/heading.js";
import type {
  LawArticle,
  LawChapter,
  LawDocumentModel,
  LawHeading,
  LawItem,
  LawMainProvision,
  LawMetadataBlock,
  LawMetadataType,
  LawParagraph,
  LawPreamble,
  LawSentenceBlock,
  LawSupplProvision,
  LawTextFragment,
  Section,
  SectionBlock,
} from "../types.js";

const dateOnlyPattern = /^((?:令和\s*\d+年|\d{4}年)\s*\d{1,2}月\s*\d{1,2}日)$/u;
const amendmentDateOnlyPattern =
  /^(?:改正\s+((?:令和\s*\d+年|\d{4}年)\s*\d{1,2}月\s*\d{1,2}日)|((?:令和\s*\d+年|\d{4}年)\s*\d{1,2}月\s*\d{1,2}日)\s+改正)$/u;
const japaneseDatePattern = /((?:令和\s*(\d+)年|(\d{4})年)\s*(\d{1,2})月\s*(\d{1,2})日)/g;
const referenceNumber = "[一二三四五六七八九十０-９0-9]+";
const articleReferencePattern = new RegExp(
  `第(${referenceNumber})条(?:の(${referenceNumber}))?(?:第(${referenceNumber})項)?(?:(?:第(${referenceNumber})号)|(各号))?`,
  "g",
);

function error(message: string): never {
  throw new Error(`[law-model] ${message}`);
}

function isLawSection(section: Section): boolean {
  return section.heading.parsedText.type === "law";
}

export function isPreambleSection(section: Section): boolean {
  return section.heading.parsedText.type === "preamble";
}

export function isSupplProvisionSection(section: Section): boolean {
  return section.heading.parsedText.type === "supplProvision";
}

export function isChapterSection(section: Section): boolean {
  return section.heading.parsedText.type === "chapter";
}

export function isArticleSection(section: Section): boolean {
  return section.heading.parsedText.type === "article";
}

export function isParagraphSection(section: Section): boolean {
  return section.heading.parsedText.type === "paragraph";
}

export function isChapterModel(node: LawChapter | LawArticle): node is LawChapter {
  return node.type === "chapter";
}

function metadataType(block: string): LawMetadataType {
  if (dateOnlyPattern.test(block) || amendmentDateOnlyPattern.test(block)) {
    return "date";
  }

  return "issuer";
}

function metadataAmend(block: string): boolean {
  if (dateOnlyPattern.test(block)) {
    return false;
  }

  if (amendmentDateOnlyPattern.test(block)) {
    return true;
  }

  error(`metadata block is not a date: ${block}`);
}

function lawHeading(section: Section): LawHeading {
  return {
    title: section.title,
    rank: section.rank,
    id: section.heading.id,
    parsedText: section.heading.parsedText,
    baseTitle: section.heading.baseTitle,
    caption: section.heading.caption,
  };
}

function documentMetadata(section: Section): LawMetadataBlock[] {
  const counts = new Map<string, number>();

  return section.blocks.map((block) => {
    const type = metadataType(block.text);
    const amend = type === "date" ? metadataAmend(block.text) : undefined;
    const countKey = type === "date" ? `${type}:${amend ? "amend" : "enact"}` : type;
    const count = (counts.get(countKey) ?? 0) + 1;
    counts.set(countKey, count);

    const metadata = {
      num: count === 1 ? undefined : count,
      text: block.text,
      fragments: parseLawTextFragments(block.text, { references: false }),
    };

    if (type === "issuer") {
      return {
        ...metadata,
        type,
      };
    }

    const dateFragment = metadata.fragments.find((fragment) => fragment.type === "date");

    if (!dateFragment) {
      error(`date metadata has no date fragment: ${block.text}`);
    }

    const date = dateFragment.datetime;

    if (amend) {
      return {
        ...metadata,
        type,
        date,
        amend: true,
      };
    }

    return {
      ...metadata,
      type,
      date,
      amend: false,
    };
  });
}

function sectionNumber(section: Section, expectedType: string): number[] {
  const parsed = section.heading.parsedText;

  if (parsed.type !== expectedType) {
    error(`expected ${expectedType}, got ${parsed.type}: ${section.title}`);
  }

  if (!parsed.num || parsed.num.length === 0) {
    error(`${expectedType} has no number: ${section.title}`);
  }

  return parsed.num;
}

function sectionNum(section: Section, expectedType: string): string {
  return sectionNumber(section, expectedType).join("_");
}

function paragraphNumberText(section: Section): string {
  const num = sectionNumber(section, "paragraph")[0];
  return num === 1 ? "" : section.heading.parsedText.rawText;
}

function paragraphNumber(section: Section): number {
  return sectionNumber(section, "paragraph")[0];
}

function normalizeDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}

function referenceArticleNumber(articleNumberText: string, subArticleText: string | undefined): number[] {
  const articleNumber = parseJapaneseNumber(articleNumberText);

  if (!subArticleText) {
    return [articleNumber];
  }

  const subArticle = normalizeDigits(subArticleText);

  if (!/^\d+$/u.test(subArticle)) {
    error(`unsupported sub-article reference: ${subArticleText}`);
  }

  return [articleNumber, Number(subArticle)];
}

function dateTimeValue(reiwaYear: string | undefined, westernYear: string | undefined, month: string, day: string): string {
  if (!reiwaYear && !westernYear) {
    error("date has neither Reiwa year nor western year");
  }

  const year = westernYear ? Number(westernYear) : 2018 + Number(reiwaYear);

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

type FragmentMatch = {
  index: number;
  length: number;
  fragments: LawTextFragment[];
};

function referenceMatches(textValue: string): FragmentMatch[] {
  const matches: FragmentMatch[] = [];

  for (const match of textValue.matchAll(articleReferencePattern)) {
    const [label, articleNumber, subArticle, paragraphNumber, itemNumber, allItems] = match;
    const index = match.index;

    if (index === undefined) {
      error(`reference match has no index: ${label}`);
    }

    const referenceText = allItems ? label.slice(0, -allItems.length) : label;

    if (!referenceText) {
      error(`empty reference label: ${label}`);
    }

    matches.push({
      index,
      length: label.length,
      fragments: [
        {
          type: "reference",
          text: referenceText,
          target: {
            article: referenceArticleNumber(articleNumber, subArticle),
            paragraph: paragraphNumber ? parseJapaneseNumber(paragraphNumber) : undefined,
            item: itemNumber ? parseJapaneseNumber(itemNumber) : undefined,
          },
        },
        ...(allItems ? [{ type: "text" as const, text: allItems }] : []),
      ],
    });
  }

  return matches;
}

function dateMatches(textValue: string): FragmentMatch[] {
  const matches: FragmentMatch[] = [];

  for (const match of textValue.matchAll(japaneseDatePattern)) {
    const [display, _date, reiwaYear, westernYear, month, day] = match;
    const index = match.index;

    if (index === undefined) {
      error(`date match has no index: ${display}`);
    }

    matches.push({
      index,
      length: display.length,
      fragments: [
        {
          type: "date",
          text: display,
          datetime: dateTimeValue(reiwaYear, westernYear, month, day),
        },
      ],
    });
  }

  return matches;
}

function parseLawTextFragments(textValue: string, options: { references: boolean }): LawTextFragment[] {
  const fragments: LawTextFragment[] = [];
  const matches = [
    ...dateMatches(textValue),
    ...(options.references ? referenceMatches(textValue) : []),
  ].sort((left, right) => left.index - right.index);
  let lastIndex = 0;

  for (const match of matches) {
    if (match.index < lastIndex) {
      error(`overlapping text fragments near: ${textValue.slice(match.index, match.index + match.length)}`);
    }

    if (match.index > lastIndex) {
      fragments.push({ type: "text", text: textValue.slice(lastIndex, match.index) });
    }

    fragments.push(...match.fragments);
    lastIndex = match.index + match.length;
  }

  if (lastIndex === 0) {
    fragments.push({ type: "text", text: textValue });
  } else if (lastIndex < textValue.length) {
    fragments.push({ type: "text", text: textValue.slice(lastIndex) });
  }

  return fragments;
}

function parseSentenceBlock(textValue: string): LawSentenceBlock {
  return {
    type: "sentence",
    text: textValue,
    fragments: parseLawTextFragments(textValue, { references: true }),
  };
}

export function firstParagraphSection(section: Section): Section {
  if (!isArticleSection(section) && !isPreambleSection(section) && !isSupplProvisionSection(section)) {
    error(`cannot build first paragraph from ${section.heading.parsedText.type}: ${section.title}`);
  }

  return {
    ...section,
    title: "",
    pathTitle: section.heading.id ? `${section.heading.id}-paragraph1` : "paragraph1",
    rank: 4,
    heading: {
      ...section.heading,
      title: "",
      id: section.heading.id ? `${section.heading.id}-paragraph1` : "",
      parsedText: { type: "paragraph", num: [1], rawText: "1" },
      baseTitle: "",
      caption: undefined,
    },
  };
}

export function paragraphSection(section: Section, num: number, paragraphText: string): Section {
  return {
    ...section,
    title: num === 1 ? "" : String(num),
    pathTitle: section.heading.id ? `${section.heading.id}-paragraph${num}` : `paragraph${num}`,
    rank: 4,
    heading: {
      ...section.heading,
      title: num === 1 ? "" : String(num),
      id: section.heading.id ? `${section.heading.id}-paragraph${num}` : "",
      parsedText: { type: "paragraph", num: [num], rawText: String(num) },
      baseTitle: "",
      caption: undefined,
    },
    blocks: [{ type: "paragraph", text: paragraphText }],
    text: paragraphText,
  };
}

function paragraphItems(section: Section, blocks: SectionBlock[]): { sentenceBlocks: LawSentenceBlock[]; items: LawItem[] } {
  const sentenceBlocks: LawSentenceBlock[] = [];
  const items: LawItem[] = [];
  let readingItems = false;

  for (const block of blocks) {
    if (block.type === "list") {
      for (const item of block.items) {
        if (item.num !== items.length + 1) {
          error(`item number must be sequential in ${section.key}: ${block.text}`);
        }

        readingItems = true;
        items.push({
          type: "item",
          num: item.num,
          title: item.title,
          marker: item.marker,
          body: parseSentenceBlock(item.body),
        });
      }

      continue;
    }

    const item = parseKanjiListItem(block.text);

    if (item) {
      if (item.itemNumber !== items.length + 1) {
        error(`item number must be sequential in ${section.key}: ${block.text}`);
      }

      readingItems = true;
      items.push({
        type: "item",
        num: item.itemNumber,
        title: item.title,
        marker: item.marker,
        body: parseSentenceBlock(item.body),
      });
      continue;
    }

    if (/^[一二三四五六七八九十]+[、.]/u.test(block.text)) {
      error(`malformed item block in ${section.key}: ${block.text}`);
    }

    if (readingItems) {
      error(`non-item block appears after item blocks in ${section.key}`);
    }

    sentenceBlocks.push(parseSentenceBlock(block.text));
  }

  return { sentenceBlocks, items };
}

function buildParagraph(section: Section): LawParagraph {
  if (!section.text.trim()) {
    error(`paragraph has no body: ${section.key}`);
  }

  const num = sectionNumber(section, "paragraph")[0];
  const parsedBlocks = paragraphItems(section, section.blocks);

  return {
    type: "paragraph",
    heading: lawHeading(section),
    id: section.heading.id,
    num,
    title: paragraphNumberText(section),
    text: section.text,
    ...parsedBlocks,
  };
}

function validateParagraphSequence(article: Section, paragraphSections: Section[]): void {
  let expected = 2;

  for (const paragraph of paragraphSections) {
    const actual = paragraphNumber(paragraph);

    if (actual !== expected) {
      error(`paragraph numbers must be sequential in ${article.key}: expected ${expected}, got ${actual}`);
    }

    expected += 1;
  }
}

function headingCaption(section: Section): string | undefined {
  if (!section.heading.caption) {
    return undefined;
  }

  return `${section.heading.caption.prefix}${section.heading.caption.caption}${section.heading.caption.suffix}`;
}

function buildArticle(section: Section, paragraphSections: Section[]): LawArticle {
  validateParagraphSequence(section, paragraphSections);

  const paragraphs = [
    ...(section.text.trim() ? [buildParagraph(firstParagraphSection(section))] : []),
    ...paragraphSections.map(buildParagraph),
  ];

  if (paragraphs.length === 0) {
    error(`article has no paragraph: ${section.title}`);
  }

  return {
    type: "article",
    heading: lawHeading(section),
    id: section.heading.id,
    num: sectionNum(section, "article"),
    title: section.heading.parsedText.rawText,
    caption: headingCaption(section),
    paragraphs,
  };
}

function collectArticles(sections: Section[], context: string): LawArticle[] {
  const articles: LawArticle[] = [];
  let index = 0;

  while (index < sections.length) {
    const section = sections[index];

    if (!isArticleSection(section)) {
      error(`${context} must contain articles only, got ${section.heading.parsedText.type}: ${section.title}`);
    }

    const paragraphs: Section[] = [];
    index += 1;

    while (index < sections.length && isParagraphSection(sections[index])) {
      paragraphs.push(sections[index]);
      index += 1;
    }

    articles.push(buildArticle(section, paragraphs));
  }

  return articles;
}

function collectChapters(sections: Section[]): LawChapter[] {
  const chapters: LawChapter[] = [];
  let index = 0;

  while (index < sections.length) {
    const chapter = sections[index];

    if (!isChapterSection(chapter)) {
      error(`main provision mixes chapter and non-chapter sections: ${chapter.title}`);
    }

    const children: Section[] = [];
    index += 1;

    while (index < sections.length && !isChapterSection(sections[index])) {
      children.push(sections[index]);
      index += 1;
    }

    chapters.push({
      type: "chapter",
      heading: lawHeading(chapter),
      id: chapter.heading.id,
      num: sectionNum(chapter, "chapter"),
      title: chapter.heading.parsedText.rawText,
      caption: headingCaption(chapter),
      articles: collectArticles(children, chapter.title),
    });
  }

  return chapters;
}

function mainProvision(sections: Section[]): LawMainProvision {
  if (sections.length === 0) {
    error("main provision has no sections");
  }

  return {
    type: "mainProvision",
    children: sections.some(isChapterSection) ? collectChapters(sections) : collectArticles(sections, "main provision"),
  };
}

function buildPreamble(section: Section | undefined): LawPreamble | undefined {
  if (!section) {
    return undefined;
  }

  if (!section.text.trim()) {
    error(`preamble has no body: ${section.key}`);
  }

  return {
    type: "preamble",
    heading: lawHeading(section),
    id: section.heading.id,
    title: section.title,
    paragraphs: section.blocks.map((block, index) => buildParagraph(paragraphSection(section, index + 1, block.text))),
  };
}

function buildSupplProvision(section: Section): LawSupplProvision {
  const blocks = section.blocks;

  if (blocks.length === 0) {
    error(`supplementary provision has no paragraph: ${section.title}`);
  }

    const paragraphs = blocks.map((block, index) => buildParagraph(paragraphSection(section, index + 1, block.text)));

    const isAmendment = paragraphs.some((paragraph) => paragraph.sentenceBlocks.some((sentence) => sentence.fragments.some((fragment) => fragment.type === "date" && metadataAmend(fragment.text))));

  return {
    type: "supplProvision",
    heading: lawHeading(section),
    id: section.heading.id,
    title: section.title,
    label: section.title,
    paragraphs,
    isAmendment,
  };
}

export function lawSection(sections: Section[]): Section {
  const title = sections[0];

  if (!title || !isLawSection(title)) {
    error("first section must be law");
  }

  return title;
}

export function buildLawModel(sections: Section[]): LawDocumentModel {
  const title = lawSection(sections);
  const bodySections = sections.slice(1);
  const preambleIndex = bodySections.findIndex(isPreambleSection);
  const firstSupplIndex = bodySections.findIndex(isSupplProvisionSection);
  const mainStart = preambleIndex === 0 ? 1 : 0;
  const mainEnd = firstSupplIndex === -1 ? bodySections.length : firstSupplIndex;

  if (preambleIndex > 0) {
    error("preamble must appear immediately after document title");
  }

  if (firstSupplIndex !== -1 && bodySections.slice(firstSupplIndex).some((section) => !isSupplProvisionSection(section))) {
    error("only supplementary provisions may appear after the first supplementary provision");
  }

  return {
    type: "law",
    title: {
      type: "law",
      heading: lawHeading(title),
      title: title.title,
      text: title.text,
    },
    metadata: documentMetadata(title),
    preamble: buildPreamble(preambleIndex === 0 ? bodySections[0] : undefined),
    mainProvision: mainProvision(bodySections.slice(mainStart, mainEnd)),
    supplProvisions: firstSupplIndex === -1 ? [] : bodySections.slice(firstSupplIndex).map(buildSupplProvision),
  };
}
