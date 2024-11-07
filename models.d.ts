import { ValidateFunction } from "ajv";
import { JSONSchema4 } from "json-schema";

export type OpenApiDocument = Record<string, any>;

export interface AppSchema {
  name: string;
  jsonSchema: JSONSchema4;
  openapiSchema: OpenApiDocument;
  formatted: {
    openapi: {
      json: string;
      yaml: string;
    };
    jsonSchema: {
      pristine: string;
      resolved: { ok: boolean; text: string };
    };
  };
  validate: ValidateFunction<unknown>;
}

export interface AcceptedImport {
  content: string;
  parsed: Record<string, any>;
  type: "openapi" | "json-schema";
  schemas: AppSchema[];
}
