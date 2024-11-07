import { EditorView } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import {
  DEFAULT_EXTENSIONS,
  firstContentfulLine,
  yamlParseLinter,
} from "./codemirror";
import { jsonParseLinter } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { linter } from "@codemirror/lint";
import YAML, { YAMLException } from "js-yaml";
import { prepare } from "./prepare";

/**
 * Sets up the given element as a schema input.
 * The given `onDone` callback is invoked, when everything is valid and the user clicked on the confirm button.
 * @param {HTMLElement} el
 * @param {(import("./models").AcceptedImport) => void} onDone
 * @returns {EditorView}
 */
export function setupSchemaInput(el, onDone) {
  const container = document.createElement("div");
  container.className = "schema-input";
  container.innerHTML = `
    <footer>
    <pre class="schema-input__message" style="display: none"></pre>
    <button id="load" disabled>Load OpenAPI document</button>
    </footer>
    `;
  const btnLoad = container.querySelector("button");

  /** The content of the editor parsed to an object, or undefined if not possible. */
  let parsed = undefined;
  /** The content of the editor as a string. */
  let content = undefined;
  /** @type {'openapi' | 'json-schema'} */
  let type = "openapi";

  /** @type {HTMLElement} */
  const message = container.querySelector(".schema-input__message");
  const setMessage = (msg) => {
    message.textContent = msg;
    message.style.display = msg ? "block" : "none";
    btnLoad.style.display = !msg ? "block" : "none";
  };
  function done() {
    if (!parsed || !content) {
      return;
    }
    btnLoad.disabled = true;
    btnLoad.classList.add("loading");

    let schemas;
    try {
      schemas = prepare(parsed, type);
    } catch (e) {
      console.error(e);
      setMessage(e.toString());
      btnLoad.disabled = false;
      btnLoad.classList.remove("loading");
      return;
    }

    onDone({
      content,
      parsed,
      type,
      schemas,
    });
  }

  btnLoad.addEventListener("click", () => done());

  const parent = document.createElement("div");
  parent.className = "schema-input__editor";

  let isJson = false;
  const linting = new Compartment();
  const state = EditorState.create({
    extensions: [
      ...DEFAULT_EXTENSIONS(),
      yaml(), // json seems to always work out of the box..?
      linting.of(linter(yamlParseLinter())),
      EditorView.updateListener.of((v) => {
        if (!v.docChanged) {
          return;
        }
        const fcl = firstContentfulLine(v.state);
        if (fcl) {
          const newIsJson = fcl.trimStart().startsWith("{");
          if (newIsJson != isJson) {
            isJson = newIsJson;
            v.view.dispatch({
              effects: [
                linting.reconfigure(
                  linter(isJson ? jsonParseLinter() : yamlParseLinter()),
                ),
              ],
            });
          }
        }
        content = v.state.doc.toString();
        if (!content.trim()) {
          parsed = undefined;
          btnLoad.disabled = true;
          setMessage("");
        } else {
          let p;
          try {
            p = isJson ? JSON.parse(content) : YAML.load(content);
          } catch (e) {
            console.error("Error while parsing content after doc change.", e);

            parsed = undefined;
            btnLoad.disabled = true;
            setMessage(
              e instanceof YAMLException
                ? `YAMLException: ${e.reason} (${e.mark.line}:${e.mark.column})`
                : e.toString(),
            );
            return;
          }
          if (p == null || typeof p !== "object") {
            parsed = undefined;
            btnLoad.disabled = true;
            setMessage(
              p == null
                ? `Invalid input. Seems to be ${p} ...`
                : `Invalid input. Seems to be a ${typeof p} ...`,
            );
            return;
          }
          const isOpenApi = "openapi" in p;
          type = !isOpenApi ? "json-schema" : "openapi";
          btnLoad.textContent = isOpenApi
            ? "Load OpenAPI document"
            : "Load JSON schema";

          parsed = p;
          btnLoad.disabled = false;
          setMessage("");
        }
      }),
    ],
  });

  const view = new EditorView({
    state,
    parent,
  });

  container.insertAdjacentElement("afterbegin", parent);

  el.innerHTML = "";
  el.appendChild(container);

  return view;
}
