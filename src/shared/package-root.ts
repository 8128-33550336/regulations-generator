import path from "node:path";
import { fileURLToPath } from "node:url";

export function packageRoot(importMetaUrl: string): string {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "../..");
}
