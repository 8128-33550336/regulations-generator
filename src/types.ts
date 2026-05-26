export type ParsedHeadingText = {
  type: "law" | "chapter" | "mainProvision" | "preamble" | "supplProvision" | "article" | "paragraph" | "item";
  num?: number[];
  rawText: string;
};

export type HeadingCaption = {
  prefix: string;
  caption: string;
  suffix: string;
};

export type ParsedHeading = {
  title: string;
  id: string;
  parsedText: ParsedHeadingText;
  baseTitle: string;
  caption?: HeadingCaption;
};

export type Section = {
  key: string;
  title: string;
  pathTitle: string;
  rank: number;
  blocks: SectionBlock[];
  text: string;
  heading: ParsedHeading;
  isTitleOnly?: boolean;
};

export type SectionListItem = {
  num: number;
  title: string;
  marker: string;
  body: string;
};

export type SectionBlock = {
  type: "paragraph";
  text: string;
} | {
  type: "list";
  text: string;
  items: SectionListItem[];
};

export type Status = "追加" | "削除" | "変更" | "変更なし";

export type LawDiffContainer = LawArticle | LawPreamble | LawSupplProvision;

export type LawDiffNode = {
  type: "title";
  key: string;
  text: string;
} | {
  type: "paragraph";
  key: string;
  paragraph: LawParagraph;
  container: LawDiffContainer;
};

export type DiffEntry = {
  key: string;
  status: Status;
  oldNode?: LawDiffNode;
  newNode?: LawDiffNode;
  highlightTitleOnly?: boolean;
};

export type OutputFile = {
  type: "html" | "pdf" | "xml" | "json" | "toml" | "md";
  path: string;
  validate?: boolean;
};

export type GeneratedLaw = {
  base: string;
  files: OutputFile[];
};

export type LawMetadataType = "date" | "issuer";

export type LawEnactDateMetadataBlock = {
  type: "date";
  num?: number;
  text: string;
  fragments: LawTextFragment[];
  date: string;
  amend: false;
};

export type LawAmendDateMetadataBlock = {
  type: "date";
  num?: number;
  text: string;
  fragments: LawTextFragment[];
  date: string;
  amend: true;
};

export type LawIssuerMetadataBlock = {
  type: "issuer";
  num?: number;
  text: string;
  fragments: LawTextFragment[];
};

export type LawDateMetadataBlock = LawEnactDateMetadataBlock | LawAmendDateMetadataBlock;

export type LawMetadataBlock = LawDateMetadataBlock | LawIssuerMetadataBlock;

export type LawHeading = {
  title: string;
  rank: number;
  id: string;
  parsedText: ParsedHeadingText;
  baseTitle: string;
  caption?: HeadingCaption;
};

export type LawTitle = {
  type: "law";
  heading: LawHeading;
  title: string;
  text: string;
};

export type LawItem = {
  type: "item";
  num: number;
  title: string;
  marker: string;
  body: LawSentenceBlock;
};

export type LawReferenceTarget = {
  article: number[];
  paragraph?: number;
  item?: number;
};

export type LawTextFragment = {
  type: "text";
  text: string;
} | {
  type: "reference";
  text: string;
  target: LawReferenceTarget;
} | {
  type: "date";
  text: string;
  datetime: string;
};

export type LawSentenceBlock = {
  type: "sentence";
  text: string;
  fragments: LawTextFragment[];
};

export type LawParagraph = {
  type: "paragraph";
  heading: LawHeading;
  id: string;
  num: number;
  title: string;
  text: string;
  sentenceBlocks: LawSentenceBlock[];
  items: LawItem[];
};

export type LawArticle = {
  type: "article";
  heading: LawHeading;
  id: string;
  num: string;
  title: string;
  caption?: string;
  paragraphs: LawParagraph[];
};

export type LawChapter = {
  type: "chapter";
  heading: LawHeading;
  id: string;
  num: string;
  title: string;
  caption?: string;
  articles: LawArticle[];
};

export type LawMainProvision = {
  type: "mainProvision";
  children: Array<LawChapter | LawArticle>;
};

export type LawPreamble = {
  type: "preamble";
  heading: LawHeading;
  id: string;
  title: string;
  paragraphs: LawParagraph[];
};

export type LawSupplProvision = {
  type: "supplProvision";
  heading: LawHeading;
  id: string;
  title: string;
  label: string;
  paragraphs: LawParagraph[];
  isAmendment: boolean;
};

export type LawDocumentModel = {
  type: "law";
  title: LawTitle;
  metadata: LawMetadataBlock[];
  preamble?: LawPreamble;
  mainProvision: LawMainProvision;
  supplProvisions: LawSupplProvision[];
};
