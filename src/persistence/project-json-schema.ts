import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject } from "ajv";

import projectSchema from "../../schemas/project-0.1.0.schema.json";
import type { Project } from "../domain/model";
import type { ValidationIssue } from "../domain/validation";

const MAX_SCHEMA_ISSUES = 50;

const ajv = new Ajv2020({
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  strict: true,
  useDefaults: false,
});

const validate = ajv.compile<Project>(projectSchema);

export type ProjectSchemaValidationResult =
  | { readonly valid: true; readonly project: Project }
  | { readonly valid: false; readonly issues: readonly ValidationIssue[] };

export function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function issuePath(error: ErrorObject): string {
  if (error.keyword === "additionalProperties") {
    return error.instancePath || "/";
  }
  if (error.keyword === "required") {
    const property = error.params.missingProperty;
    if (typeof property === "string") {
      return `${error.instancePath}/${property}`;
    }
  }
  return error.instancePath || "/";
}

function schemaIssues(errors: readonly ErrorObject[]): readonly ValidationIssue[] {
  const sorted = errors
    .map((error) => ({ code: `schema.${error.keyword}`, path: issuePath(error) }))
    .sort((left, right) => {
      const pathOrder = compareCodeUnits(left.path, right.path);
      return pathOrder === 0 ? compareCodeUnits(left.code, right.code) : pathOrder;
    });

  const deduplicated: ValidationIssue[] = [];
  for (const issue of sorted) {
    const previous = deduplicated.at(-1);
    if (previous?.code === issue.code && previous.path === issue.path) {
      continue;
    }
    deduplicated.push(issue);
    if (deduplicated.length === MAX_SCHEMA_ISSUES) {
      break;
    }
  }
  return deduplicated;
}

export function validateProjectJsonSchema(value: unknown): ProjectSchemaValidationResult {
  if (validate(value)) {
    return { valid: true, project: value };
  }

  return { valid: false, issues: schemaIssues(validate.errors ?? []) };
}
