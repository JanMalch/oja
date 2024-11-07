import "./style.css";
import { setupSchemaInput } from "./schema-input.js";
import { setupValidationMode } from "./validation-mode.js";
import { replaceContent } from "./codemirror.js";

const SCHEMA_STORAGE_KEY = "input";
const DATA_STORAGE_KEY = "data";
const QUERY_STORAGE_KEY = "query";

const inputEditor = setupSchemaInput(
  document.getElementById("input"),
  (input) => {
    localStorage.setItem(SCHEMA_STORAGE_KEY, input.content);

    const div = document.createElement("div");
    div.id = "loaded-mode";

    setupValidationMode(
      div,
      input,
      localStorage.getItem(DATA_STORAGE_KEY),
      localStorage.getItem(QUERY_STORAGE_KEY),
    );
    document.getElementById("starter").remove();
    document.body.appendChild(div);
  },
);

const restoredContent = localStorage.getItem(SCHEMA_STORAGE_KEY);
if (restoredContent) {
  replaceContent(inputEditor, restoredContent);
}
