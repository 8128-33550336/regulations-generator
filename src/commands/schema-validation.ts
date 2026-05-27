import { execFile } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { GeneratedLaw } from "../types.js";
import { packageRoot } from "../shared/package-root.js";
import { relativePath } from "../shared/path.js";

const execFileAsync = promisify(execFile);

type ValidationSchemas = {
  jsonSchemaFile: string;
  rncSchemaFile: string;
};

type JsonValidator = ReturnType<Ajv2020["compile"]>;

type ValidationContext = ValidationSchemas & {
  jsonValidate?: JsonValidator;
};

function validationSchemas(): ValidationSchemas {
  const schemaDir = path.join(packageRoot(import.meta.url), "schema");
  return {
    jsonSchemaFile: path.join(schemaDir, "schema.json"),
    rncSchemaFile: path.join(schemaDir, "schema.rnc"),
  };
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function jingJarFile(): string {
  return path.join(packageRoot(import.meta.url), "jing.jar");
}

async function loadJsonValidator(schemaFile: string): Promise<JsonValidator> {
  const schema = JSON.parse(await readFile(schemaFile, "utf8")) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

async function validateJsonFile(file: string, validate: JsonValidator): Promise<boolean> {
  let value: unknown;

  try {
    value = JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch (error) {
    console.error(`[schema] ng json ${relativePath(file)}`);
    console.error(error);
    return false;
  }

  const ok = validate(value);

  if (ok) {
    console.log(`[schema] ok json ${relativePath(file)}`);
    return true;
  }

  console.error(`[schema] ng json ${relativePath(file)}`);
  console.error(validate.errors);
  return false;
}

async function validateXmlFile(file: string, schemaFile: string): Promise<boolean> {
  try {
    await execFileAsync("java", ["-jar", jingJarFile(), "-c", schemaFile, file]);
    console.log(`[schema] ok xml ${relativePath(file)}`);
    return true;
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string; message?: string };
    console.error(`[schema] ng xml ${relativePath(file)}`);
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
    if (!result.stdout && !result.stderr && result.message) console.error(result.message);
    return false;
  }
}

async function createValidationContext(): Promise<ValidationContext> {
  const schemas = validationSchemas();
  let jsonValidate: JsonValidator | undefined;

  try {
    jsonValidate = await loadJsonValidator(schemas.jsonSchemaFile);
  } catch (error) {
    console.error(`[schema] ng json schema ${relativePath(schemas.jsonSchemaFile)}`);
    console.error(error);
  }

  if (!(await exists(schemas.rncSchemaFile))) {
    console.error(`[schema] ng xml schema ${relativePath(schemas.rncSchemaFile)} not found`);
  }

  return { ...schemas, jsonValidate };
}

export async function validateGeneratedLaws(outputDir: string, laws: GeneratedLaw[]): Promise<boolean> {
  const context = await createValidationContext();
  let hasChecks = false;
  let hasFailures = false;

  for (const law of laws) {
    const checks: boolean[] = [];

    for (const file of law.files) {
      const outputFile = path.join(outputDir, file.path);

      if (file.type === "json") {
        file.validate = context.jsonValidate ? await validateJsonFile(outputFile, context.jsonValidate) : false;
        checks.push(file.validate);
      }

      if (file.type === "xml") {
        file.validate = await validateXmlFile(outputFile, context.rncSchemaFile);
        checks.push(file.validate);
      }
    }

    if (checks.length === 0) {
      console.log(`[schema] skipped ${law.base}`);
      continue;
    }

    hasChecks = true;
    hasFailures = hasFailures || !checks.every(Boolean);
  }

  const allOk = hasChecks && !hasFailures;
  const statusFile = path.join(outputDir, "status.txt");
  await writeFile(statusFile, allOk ? "ok\n" : "ng\n");
  console.log(`Wrote ${relativePath(statusFile)}`);

  return allOk;
}
