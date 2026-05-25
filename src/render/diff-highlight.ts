import { element, type HtmlNode } from "./hast.js";
import { renderLawTextFragmentNodes } from "./law-html.js";
import type { LawTextFragment } from "../types.js";

function commonPrefixLength(left: string[], right: string[]): number {
  let index = 0;

  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }

  return index;
}

function commonSuffixLength(left: string[], right: string[], prefixLength: number): number {
  let length = 0;

  while (
    length < left.length - prefixLength &&
    length < right.length - prefixLength &&
    left[left.length - 1 - length] === right[right.length - 1 - length]
  ) {
    length += 1;
  }

  return length;
}

function isPlainParagraphBlock(markdown: string): boolean {
  return (
    !markdown.includes("\n") &&
    !/^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|~~~)/u.test(markdown.trim())
  );
}

function fragmentText(fragments: LawTextFragment[]): string {
  return fragments.map((fragment) => fragment.text).join("");
}

function fragmentWithText(fragment: LawTextFragment, textValue: string): LawTextFragment {
  switch (fragment.type) {
    case "text":
      return { ...fragment, text: textValue };
    case "reference":
      return { ...fragment, text: textValue };
    case "date":
      return { ...fragment, text: textValue };
    default: {
      const exhaustive: never = fragment;
      throw new Error(`[diff-highlight] unsupported law text fragment: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function sliceFragments(fragments: LawTextFragment[], start: number, end: number): LawTextFragment[] {
  const sliced: LawTextFragment[] = [];
  let offset = 0;

  for (const fragment of fragments) {
    const chars = Array.from(fragment.text);
    const fragmentStart = offset;
    const fragmentEnd = offset + chars.length;

    if (fragmentEnd <= start) {
      offset = fragmentEnd;
      continue;
    }

    if (fragmentStart >= end) {
      break;
    }

    const localStart = Math.max(start - fragmentStart, 0);
    const localEnd = Math.min(end - fragmentStart, chars.length);
    const textValue = chars.slice(localStart, localEnd).join("");

    if (textValue) {
      sliced.push(fragmentWithText(fragment, textValue));
    }

    offset = fragmentEnd;
  }

  return sliced;
}

export function renderChangedParagraphBlockNode(
  fragments: LawTextFragment[],
  compareFragments: LawTextFragment[],
  highlightClass: string,
  idPrefix = "",
): HtmlNode | undefined {
  const markdown = fragmentText(fragments);
  const compareMarkdown = fragmentText(compareFragments);

  if (!isPlainParagraphBlock(markdown) || !isPlainParagraphBlock(compareMarkdown)) {
    return undefined;
  }

  const left = Array.from(markdown);
  const right = Array.from(compareMarkdown);
  const prefixLength = commonPrefixLength(left, right);
  const suffixLength = commonSuffixLength(left, right, prefixLength);
  const changed = left.slice(prefixLength, left.length - suffixLength).join("");

  if (!changed) {
    if (prefixLength > 0 || suffixLength > 0) {
      return element("p", {}, renderLawTextFragmentNodes(fragments, idPrefix));
    }

    return undefined;
  }

  if (prefixLength === 0 && suffixLength === 0) {
    return element("p", { class: highlightClass }, renderLawTextFragmentNodes(fragments, idPrefix));
  }

  const suffixStart = left.length - suffixLength;
  const children: HtmlNode[] = [];

  if (prefixLength > 0) {
    children.push(...renderLawTextFragmentNodes(sliceFragments(fragments, 0, prefixLength), idPrefix));
  }

  children.push(
    element(
      "span",
      { class: highlightClass },
      renderLawTextFragmentNodes(sliceFragments(fragments, prefixLength, suffixStart), idPrefix),
    ),
  );

  if (suffixLength > 0) {
    children.push(...renderLawTextFragmentNodes(sliceFragments(fragments, suffixStart, left.length), idPrefix));
  }

  return element("p", {}, children);
}
