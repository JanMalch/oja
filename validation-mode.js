import { DEFAULT_EXTENSIONS, replaceContent } from "./codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { AggregateAjvError } from "@segment/ajv-human-errors";
import { yaml } from "@codemirror/lang-yaml";

const OPENAPI_SCHEMA_YAML = "openapi-schema-yaml";
const OPENAPI_SCHEMA_JSON = "openapi-schema-json";
const JSON_SCHEMA = "json-schema";
const RESOLVED_JSON_SCHEMA = "resolved-json-schema";

function fmt(x) {
  return typeof x === "string" ? x : x.ok ? x.text : `Error: ${x.text}`;
}

/**
 *
 * @param {string | null} content
 * @returns {HTMLElement}
 */
function createEditorEl(content) {
  const parent = document.createElement("div");
  parent.className = "data-input";

  const state = EditorState.create({
    extensions: [
      ...DEFAULT_EXTENSIONS(),
      json(),
      linter(jsonParseLinter()),
      EditorView.updateListener.of((v) => {
        if (!v.docChanged) {
          return;
        }
        parent.dispatchEvent(
          new CustomEvent("datachange", { detail: v.state.doc.toString() }),
        );
      }),
    ],
  });

  const view = new EditorView({
    state,
    parent,
  });

  replaceContent(view, content);

  return parent;
}

// https://heroicons.com/

const OK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
</svg>
`;

const ERR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
</svg>
`;

const SCHEMA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v7.5m2.25-6.466a9.016 9.016 0 0 0-3.461-.203c-.536.072-.974.478-1.021 1.017a4.559 4.559 0 0 0-.018.402c0 .464.336.844.775.994l2.95 1.012c.44.15.775.53.775.994 0 .136-.006.27-.018.402-.047.539-.485.945-1.021 1.017a9.077 9.077 0 0 1-3.461-.203M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
</svg>
`;

const CLOSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
</svg>
`;

/**
 *
 * @param {HTMLElement} el
 * @param {import("./models").AcceptedImport} data
 * @param {string | null} content
 * @param {string | null} q initial query
 */
export function setupValidationMode(el, data, content, q) {
  const containerEl = document.createElement("div");
  containerEl.className = "validation-container";

  let parsed = content ? JSON.parse(content) : "";
  let query = q ?? "";

  const explanationEl = document.createElement("p");
  explanationEl.innerHTML = `Your data on the left will be validated <b>in its entirety against every schema</b> of your input.
This will likely result in a lot of errors, because your data simply does not match every schema.
<br/>
If you are working with OpenAPI and want to validate a response, you'll have to check in the contract which response schema is used for that individual endpoint.
You can then search for that schema with the searchbox below.
`;

  const searchEl = document.createElement("input");
  searchEl.className = "schema-search";
  searchEl.type = "search";
  searchEl.value = query;
  searchEl.setAttribute("spellcheck", "false");
  searchEl.setAttribute("autocomplete", "off");
  searchEl.setAttribute("incremental", "");
  searchEl.placeholder =
    "Search for the schema you want to validate against ...";
  searchEl.addEventListener("search", () => {
    query = searchEl.value;
    localStorage.setItem("query", query);
    updateList();
  });

  const listEl = document.createElement("ul");

  function updateList() {
    listEl.innerHTML = "";

    const lcQuery = query.toLowerCase();

    data.schemas.forEach((schema) => {
      if (!schema.name.toLowerCase().includes(lcQuery)) {
        return;
      }

      const isValid = parsed ? schema.validate(parsed) : null;
      const errors = new AggregateAjvError(schema.validate.errors).toJSON();

      const listItemEl = document.createElement("li");

      if (isValid != null) {
        listItemEl.className = isValid ? "valid" : "invalid";
      } else {
        listItemEl.className = "";
      }

      const nameEl = document.createElement("h3");
      nameEl.innerHTML = `${isValid == null ? "" : isValid ? OK_SVG : ERR_SVG}<span>${schema.name}</span><button class="icon-btn">${SCHEMA_SVG}</button>`;

      const errorsEl = document.createElement("ul");
      errorsEl.className = "errors";
      errors.forEach((e) => {
        const eEl = document.createElement("li");
        eEl.textContent = e.message;
        errorsEl.appendChild(eEl);
      });

      nameEl.querySelector("button").addEventListener("click", () => {
        const dialog = document.createElement("dialog");

        const headerEl = document.createElement("header");
        headerEl.className = "dialog-header";
        headerEl.innerHTML = "<h3>Schemas</h3>";

        const closeBtn = document.createElement("button");
        closeBtn.className = "icon-btn";
        closeBtn.innerHTML = CLOSE_SVG;
        closeBtn.addEventListener("click", () => dialog.close());

        headerEl.appendChild(closeBtn);

        dialog.appendChild(headerEl);

        const tabBar = new SchemaTabBar(); // TODO: not on a per-schema basis is nicer, I think
        dialog.appendChild(tabBar);

        const lang = new Compartment();
        const state = EditorState.create({
          extensions: [
            ...DEFAULT_EXTENSIONS(),
            lang.of(json()),
            EditorView.updateListener.of((v) => {
              if (!v.docChanged) {
                return;
              }
              parent.dispatchEvent(
                new CustomEvent("datachange", {
                  detail: v.state.doc.toString(),
                }),
              );
            }),
          ],
        });

        const view = new EditorView({
          state,
          parent: dialog,
        });

        replaceContent(view, fmt(schema.formatted.jsonSchema.resolved));
        tabBar.addEventListener("changemode", (ev) => {
          switch (ev.detail) {
            case OPENAPI_SCHEMA_YAML:
              replaceContent(view, schema.formatted.openapi.yaml);
              break;
            case OPENAPI_SCHEMA_JSON:
              replaceContent(view, schema.formatted.openapi.json);
              break;
            case JSON_SCHEMA:
              replaceContent(view, schema.formatted.jsonSchema.pristine);
              break;
            case RESOLVED_JSON_SCHEMA:
              replaceContent(view, fmt(schema.formatted.jsonSchema.resolved));
              break;
          }
          view.dispatch({
            effects: [
              lang.reconfigure(
                ev.detail === OPENAPI_SCHEMA_YAML ? yaml() : json(),
              ),
            ],
          });
        });

        dialog.addEventListener("close", () => {
          dialog.remove();
        });

        document.body.appendChild(dialog);

        dialog.showModal();
      });

      listItemEl.appendChild(nameEl);
      if (errors.length > 0) {
        listItemEl.appendChild(errorsEl);
      }
      listEl.appendChild(listItemEl);
    });
  }

  updateList();

  const editorEl = createEditorEl(
    content || '"Replace this with your own JSON data"',
  );
  editorEl.addEventListener("datachange", (e) => {
    parsed = JSON.parse(e.detail);
    localStorage.setItem("data", e.detail);
    updateList();
  });

  const schemasContainerEl = document.createElement("div");
  schemasContainerEl.className = "schema-overview";
  schemasContainerEl.appendChild(explanationEl);
  schemasContainerEl.appendChild(searchEl);
  schemasContainerEl.appendChild(listEl);
  containerEl.appendChild(editorEl);
  containerEl.appendChild(schemasContainerEl);
  el.appendChild(containerEl);
}

class SchemaTabBar extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.innerHTML = `
            <div class="schema-modes">
                <button type="button" role="tab" aria-selected="true" data-mode="${RESOLVED_JSON_SCHEMA}">Resolved JSON Schema</button>
                <button type="button" role="tab" data-mode="${JSON_SCHEMA}">JSON Schema</button>
                <button type="button" role="tab" data-mode="${OPENAPI_SCHEMA_YAML}">OpenAPI (YAML)</button>
                <button type="button" role="tab" data-mode="${OPENAPI_SCHEMA_JSON}">OpenAPI (JSON)</button>
            </div>
        `;
    const buttons = Array.from(this.querySelectorAll("button"));
    buttons.forEach((n) =>
      n.addEventListener("click", (ev) => {
        /** @type {HTMLButtonElement} */
        const btn = ev.target;
        this.dispatchEvent(
          new CustomEvent("changemode", { detail: btn.dataset["mode"] }),
        );
        if (!btn.hasAttribute("aria-selected")) {
          buttons.forEach((b) => {
            if (btn === b) {
              b.setAttribute("aria-selected", "true");
            } else {
              b.removeAttribute("aria-selected");
            }
          });
        }
      }),
    );
  }
}

if ("customElements" in window) {
  customElements.define("app-schema-tab-bar", SchemaTabBar);
} else {
  alert("Please use a modern browser."); // TODO: improve? :D
}
