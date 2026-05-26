import { element, text, type HtmlNode } from "./hast.js";
import { hasParenthetical } from "../parse/heading.js";
import type { LawHeading, LawReferenceTarget, LawTextFragment, ParsedHeading } from "../types.js";

function textLineNodes(value: string): HtmlNode[] {
  if (!value.trim()) {
    return [];
  }

  return value.split("\n").flatMap((line, index) => {
    const nodes = index === 0 ? [] : [element("br")];

    if (line) {
      nodes.push(text(line));
    }

    return nodes;
  });
}

export function itemProperties(num: number, marker: string, itemParentId = "", idPrefix = ""): Record<string, string> {
  const properties: Record<string, string> = {
    "data-type": "item",
    "data-num": String(num),
    "data-marker": marker,
  };

  if (itemParentId) {
    properties.id = `${idPrefix}${itemParentId}-item${num}`;
  }

  return properties;
}

function referenceTargetHref(target: LawReferenceTarget, idPrefix: string): string {
  if (target.article.length === 0 || target.article.length > 2) {
    throw new Error(`[law-html] unsupported article reference target: ${target.article.join("_")}`);
  }

  const articleId = `${idPrefix}article${target.article.join("-")}`;

  if (!target.paragraph && !target.item) {
    return `#${articleId}`;
  }

  const paragraphId = `${articleId}-paragraph${target.paragraph ?? 1}`;

  if (!target.item) {
    return `#${paragraphId}`;
  }

  return `#${paragraphId}-item${target.item}`;
}

function plainTextToNodes(value: string): HtmlNode[] {
  return textLineNodes(value);
}

export function renderLawTextFragmentNodes(fragments: LawTextFragment[], idPrefix = ""): HtmlNode[] {
  return fragments.flatMap((fragment) => {
    switch (fragment.type) {
      case "text":
        return plainTextToNodes(fragment.text);
      case "reference":
        return [element("a", { href: referenceTargetHref(fragment.target, idPrefix) }, plainTextToNodes(fragment.text))];
      case "date":
        return [element("time", { datetime: fragment.datetime }, textLineNodes(fragment.text))];
      default: {
        const exhaustive: never = fragment;
        throw new Error(`[law-html] unsupported law text fragment: ${JSON.stringify(exhaustive)}`);
      }
    }
  });
}

function sectionData(id: string): { type: string; num?: string } {
  const paragraphMatch = /^article\d+(?:-\d+)?-paragraph(\d+)$/u.exec(id);

  if (paragraphMatch) {
    return { type: "paragraph", num: paragraphMatch[1] };
  }

  const preambleParagraphMatch = /^preamble-paragraph(\d+)$/u.exec(id);

  if (preambleParagraphMatch) {
    return { type: "paragraph", num: preambleParagraphMatch[1] };
  }

  const supplProvisionParagraphMatch = /^supplProvision\d*-paragraph(\d+)$/u.exec(id);

  if (supplProvisionParagraphMatch) {
    return { type: "paragraph", num: supplProvisionParagraphMatch[1] };
  }

  const articleMatch = /^article(\d+(?:-\d+)?)$/u.exec(id);

  if (articleMatch) {
    return { type: "article", num: articleMatch[1] };
  }

  const chapterMatch = /^chapter(\d+)$/u.exec(id);

  if (chapterMatch) {
    return { type: "chapter", num: chapterMatch[1] };
  }

  const supplProvisionMatch = /^supplProvision(\d*)$/u.exec(id);

  if (supplProvisionMatch) {
    return { type: "supplProvision", num: supplProvisionMatch[1] || undefined };
  }

  if (id === "mainProvision") {
    return { type: "mainProvision" };
  }

  if (id === "preamble") {
    return { type: "preamble" };
  }

  throw new Error(`[law-html] unsupported section id for data attributes: ${id}`);
}

export function sectionPropertiesForId(id: string, idPrefix = ""): Record<string, string> {
  if (!id) {
    return {};
  }

  const data = sectionData(id);
  const properties: Record<string, string> = {
    id: `${idPrefix}${id}`,
    "data-type": data.type,
  };

  if (data.num) {
    properties["data-num"] = data.num;
  }

  return properties;
}

function sectionTitleTag(rank: number): string {
  return `h${Math.min(Math.max(rank, 1), 6)}`;
}

function isArticleHeading(heading: ParsedHeading | LawHeading): boolean {
  return heading.id.startsWith("article") && !heading.id.includes("-paragraph");
}

function isChapterHeading(heading: ParsedHeading | LawHeading): boolean {
  return heading.id.startsWith("chapter");
}

function headingCaptionChildren(heading: ParsedHeading | LawHeading, highlightClass: string, highlightCaption: boolean): HtmlNode[] {
  const caption = heading.caption;

  if (!caption) {
    throw new Error(`[law-html] expected heading caption: ${heading.title}`);
  }

  return highlightCaption
    ? [
        text(caption.prefix),
        element("span", { class: highlightClass }, [text(caption.caption)]),
        text(caption.suffix),
      ]
    : [text(`${caption.prefix}${caption.caption}${caption.suffix}`)];
}

function articleTitleNodes(heading: ParsedHeading | LawHeading, highlightClass: string, highlightCaption: boolean): HtmlNode[] {
  const articleTitle = element("span", { class: "article-title", "data-type": "article-title" }, [text(heading.baseTitle)]);

  if (!hasParenthetical(heading)) {
    return [articleTitle];
  }

  return [
    articleTitle,
    element("span", { class: "article-caption", "data-type": "article-caption" }, headingCaptionChildren(heading, highlightClass, highlightCaption)),
  ];
}

function chapterTitleNodes(heading: ParsedHeading | LawHeading, highlightClass: string, highlightCaption: boolean): HtmlNode[] {
  const chapterTitle = element("span", { class: "chapter-title", "data-type": "chapter-title" }, [text(heading.baseTitle)]);

  if (!heading.caption) {
    return [chapterTitle];
  }

  return [
    chapterTitle,
    element("span", { class: "chapter-caption", "data-type": "chapter-caption" }, headingCaptionChildren(heading, highlightClass, highlightCaption)),
  ];
}

type TitleInput = {
  title: string;
  rank: number;
  heading: ParsedHeading | LawHeading;
};

type HeadingTitleOptions = {
  highlightTitleOnly?: boolean;
  highlightChanged?: boolean;
  compareWith?: { title: string };
};

export function renderHeadingTitleNode(
  input: TitleInput,
  options: HeadingTitleOptions,
  highlightClass: string,
): HtmlNode {
  const tag = sectionTitleTag(input.rank);
  const titleProperties: Record<string, string> = { class: "section-title" };

  if (input.heading.parsedText.type === "law") {
    titleProperties["data-type"] = "law-title";
  }

  if (options.highlightTitleOnly) {
    return element(tag, titleProperties, [element("span", { class: highlightClass }, [text(input.title)])]);
  }

  const shouldHighlightParenthetical =
    Boolean(options.highlightChanged && options.compareWith && input.title !== options.compareWith.title) &&
    hasParenthetical(input.heading);

  if (isArticleHeading(input.heading)) {
    return element(tag, titleProperties, articleTitleNodes(input.heading, highlightClass, shouldHighlightParenthetical));
  }

  if (isChapterHeading(input.heading)) {
    return element(tag, titleProperties, chapterTitleNodes(input.heading, highlightClass, shouldHighlightParenthetical));
  }

  if (!shouldHighlightParenthetical) {
    return element(tag, titleProperties, [text(input.title)]);
  }

  const heading = input.heading;

  if (!heading.caption) {
    throw new Error(`[law-html] expected heading caption: ${heading.title}`);
  }

  return element(tag, titleProperties, [
    text(heading.baseTitle),
    text(heading.caption.prefix),
    element("span", { class: highlightClass }, [text(heading.caption.caption)]),
    text(heading.caption.suffix),
  ]);
}
