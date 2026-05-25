import path from "node:path";

export function resolveArgPath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

export function relativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath);
}
