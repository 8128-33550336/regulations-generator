import type { LawDocumentModel } from "../types.js";

export function revisionDate(document: LawDocumentModel): string {
  const revisionDate = document.metadata
    .filter((block) => block.type === "date" && block.amend)
    .at(-1)?.date;

  if (!revisionDate) {
    throw new Error("[diff] new law model has no revision date");
  }

  return revisionDate;
}
