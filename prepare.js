import { openapiSchemaToJsonSchema } from "@openapi-contrib/openapi-schema-to-json-schema";
import Ajv from "ajv-draft-04";
import yaml from "js-yaml";

const TO_JSON_SCHEMA_OPTS = Object.freeze({ strictMode: false });
const AJV_OPTS = Object.freeze({
  strictSchema: "log",
  allErrors: true,
  validateFormats: false,
});

/**
 * @param {Record<string, any>} data
 * @param {'openapi' | 'json-schema'} type
 * @returns {import("./models").AppSchema[]}
 */
export function prepare(data, type) {
  if (type === "openapi") {
    return prepareOpenApi(data);
  } else {
    return [prepareJsonSchema(data)];
  }
}

/**
 * @param {Record<string, any>} data
 * @returns {import("./models").AppSchema[]}
 */
function prepareOpenApi(data) {
  const schemas = Object.entries(data.components.schemas)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([name, openapiSchema]) => {
      const jsonSchema = openapiSchemaToJsonSchema(
        openapiSchema,
        TO_JSON_SCHEMA_OPTS,
      );
      return {
        name,
        jsonSchema,
        openapiSchema,
        formatted: {
          openapi: {
            json: JSON.stringify(openapiSchema, null, 2),
            yaml: yaml.dump(openapiSchema, { indent: 2 }),
          },
          jsonSchema: {
            pristine: JSON.stringify(jsonSchema, null, 2),
          },
        },
      };
    });
  schemas.forEach((container, _, schemas) => {
    container.formatted.jsonSchema.resolved = resolveAndFormatJsonSchema(
      container.name,
      container.jsonSchema,
      schemas,
    );
  });

  const ajv = new Ajv(AJV_OPTS);
  schemas.forEach((x) => {
    ajv.addSchema(x.jsonSchema, "#/components/schemas/" + x.name);
  });
  schemas.forEach((x) => {
    x.validate = ajv.compile(x.jsonSchema);
  });
  return schemas;
}

/**
 * @param {Record<string, any>} data
 */
function prepareJsonSchema(schema) {
  throw new Error("Not yet supported :D");
}

/**
 * @param {string} name
 * @param {import("json-schema").JSONSchema4} jsonSchema
 * @param {Array<{ jsonSchema: import("json-schema").JSONSchema4 }>} schemas
 * @returns {{ok: boolean, text: string}}
 */
function resolveAndFormatJsonSchema(name, jsonSchema, schemas) {
  try {
    return {
      ok: true,
      text: JSON.stringify(
        jsonSchema,
        (key, value) => {
          if (typeof value === "object") {
            // let's see how war this naive approach gets us
            const ref = value["$ref"]?.toString()?.substring(21);
            if (ref === name) {
              // https://json-schema.org/understanding-json-schema/structuring#recursion
              return { "$ref": "#" }
            }
            if (ref) {
              // TODO: this seems like a terrible idea
              const resolved = schemas.find((s) => s.name === ref)?.jsonSchema;
              if (!resolved) return resolved
              const formatted = resolveAndFormatJsonSchema(ref, resolved, schemas);
              if (!formatted.ok) return resolved;
              const parsed = JSON.parse(formatted.text)
              delete parsed['$schema']
              return parsed;
            }
          }
          return value;
        },
        2,
      ),
    };
  } catch (e) {
    console.warn('miiii')
    return {
      ok: false,
      text: e,
    };
  }
}
