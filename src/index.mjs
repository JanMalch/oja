import {openapiSchemaToJsonSchema as toJsonSchema} from '@openapi-contrib/openapi-schema-to-json-schema';
import {AggregateAjvError} from '@segment/ajv-human-errors'
import Ajv from 'ajv-draft-04';
import yaml from 'js-yaml'

document.addEventListener('DOMContentLoaded', () => {
  const KEY_OPEN_API_SPEC = 'OPEN_API_SPEC'
  const KEY_JSON_DATA = 'JSON_DATA'

  let openApiSpec = null;
  let jsonData = null;
  let jsonSchemas = [];
  let filterText = '';
  let results = {};

  function onJsonDataChange(value) {
    try {
      jsonData = JSON.parse(value);
      localStorage.setItem(KEY_JSON_DATA, value)
      window.inJsonDataError.textContent = '';
    } catch (e) {
      jsonData = null;
      window.inJsonDataError.textContent = e.toString();
    }
    revalidate()
  }

  function onOpenApiSpecChange(value) {
    try {
      openApiSpec = value.startsWith('{') ? JSON.parse(value) : yaml.load(value);
      localStorage.setItem(KEY_OPEN_API_SPEC, value)
      window.inOpenapiSpecError.textContent = '';
    } catch (e) {
      openApiSpec = null;
      window.inOpenapiSpecError.textContent = e.toString();
      return;
    }

    const _jsonSchemas = Object.entries(openApiSpec.components.schemas)
      .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map(([schemaName, schema]) => {
        return {schemaName, jsonSchema: toJsonSchema(schema), schema};
      });
    const ajv = new Ajv({
      allErrors: true,
      validateFormats: false,
    });
    _jsonSchemas.forEach(x => {
      ajv.addSchema(x.jsonSchema, '#/components/schemas/' + x.schemaName)
    });
    jsonSchemas = _jsonSchemas.map(x => {
      const validate = ajv.compile(x.jsonSchema);
      return {...x, jsonSchemaStr: JSON.stringify(x.jsonSchema, null, 4), validate}
    });
    revalidate()
  }

  function revalidate() {
    if (jsonData != null) {
      results = Object.fromEntries(jsonSchemas.map(x => [x.schemaName, x.validate(jsonData)]));
    } else {
      results = {};
    }
    printResults()
  }

  function printResults() {
    window.results.innerHTML = jsonSchemas
      .filter(x => x.schemaName.toLowerCase().includes(filterText))
      .map(x => {
        const isValid = results[x.schemaName];
        let messages;
        if (x.validate.errors == null) {
          messages = `<span>Your data is valid for this schema.</span>`
        } else {
          const aggr = new AggregateAjvError(x.validate.errors);
          const itemsHtml = aggr.toJSON().map(({message}) => `<li>${message}</li>`)
          messages = '<ul>' + itemsHtml.join('\n') + '</ul>'
        }

        return `
        <details class="result ${isValid === true ? 'result__valid' : isValid === false ? 'result__invalid' : ''}">
          <summary>${x.schemaName}</summary>
          <hr />
          <div class="result-content">
          <div class="result-messages">
            ${messages}
          </div>
          <div class="result-json-schema">
          <small>JSON schema</small>
          <pre>${x.jsonSchemaStr}</pre>
          </div>
          </div>
        </details>
      `;
      }).join('\n')
  }

  window.inOpenapiSpec.addEventListener('change', (ev) => {
    onOpenApiSpecChange(ev.target.value)
  })
  window.inJsonData.addEventListener('keyup', (ev) => {
    onJsonDataChange(ev.target.value)
  })
  window.inFilterText.addEventListener('keyup', (ev) => {
    filterText = (ev.target.value || '').toLowerCase()
    printResults()
  })

  try {
    const cachedOpenApiSpec = localStorage.getItem(KEY_OPEN_API_SPEC);
    const cachedJsonData = localStorage.getItem(KEY_JSON_DATA);
    if (cachedOpenApiSpec) {
      window.inOpenapiSpec.value = cachedOpenApiSpec
      onOpenApiSpecChange(cachedOpenApiSpec)
    }
    if (cachedOpenApiSpec) {
      window.inJsonData.value = cachedJsonData
      onJsonDataChange(cachedJsonData)
    }
  } catch (e) {
    // whatever
  }

})
