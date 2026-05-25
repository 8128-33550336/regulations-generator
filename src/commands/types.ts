export type GenerateOptions = {
  all?: boolean;
  html?: boolean;
  pdf?: boolean;
  xml?: boolean;
  json?: boolean;
  index?: boolean;
  md?: boolean;
  sitemap?: boolean;
  baseUrl: string;
  title?: string;
  description: string;
  outputFile?: string;
};
