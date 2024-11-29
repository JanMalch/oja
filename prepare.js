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
    const result = {
      $schema: "http://json-schema.org/draft-04/schema#",
      $ref: "#/$defs/" + name,
      $defs: {},
    };

    function add(n, s) {
      result.$defs[n] = JSON.parse(
        JSON.stringify(s, (key, value) => {
          if (typeof value === "object") {
            const ref = value["$ref"]?.toString()?.substring(21);
            if (!ref) {
              return value;
            }
            if (ref !== n) {
              const resolved = schemas.find((s) => s.name === ref)?.jsonSchema;
              add(ref, resolved);
            }
            return { $ref: "#/$defs/" + ref };
          }
          return value;
        }),
      );
    }

    add(name, jsonSchema);
    return {
      ok: true,
      text: JSON.stringify(
        result,
        function (key, value) {
          // remove $schema from $defs, just to clean up a bit
          if (key === "$schema" && !("$defs" in this)) {
            return undefined;
          }
          return value;
        },
        2,
      ),
    };
  } catch (e) {
    return {
      ok: false,
      text: e,
    };
  }
}
