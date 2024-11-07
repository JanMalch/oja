import {
  keymap,
  drawSelection,
  highlightSpecialChars,
  highlightActiveLine,
  lineNumbers,
  highlightActiveLineGutter,
  EditorView,
} from "@codemirror/view";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
  foldGutter,
} from "@codemirror/language";
import { defaultKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { YAMLException } from "js-yaml";
import YAML from "js-yaml";
import { nord } from "cm6-theme-nord";

export const DEFAULT_EXTENSIONS = () => [
  drawSelection(),
  highlightSpecialChars(),
  highlightActiveLine(),
  lineNumbers(),
  highlightActiveLineGutter(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  indentOnInput(),
  bracketMatching(),
  foldGutter(),
  keymap.of(defaultKeymap),
  nord,
];

/**
 * Replaces all content with the given content.
 * @param {EditorView} view
 * @param {string} content
 */
export function replaceContent(view, content) {
  const update = view.state.update({
    changes: { from: 0, to: view.state.doc.length, insert: content },
  });
  view.update([update]);
}

/**
 * Returns the first contentful (non-blank) line in the given view.
 * @param {EditorState} view
 * @returns {string | undefined}
 */
export function firstContentfulLine(state) {
  const doc = state.doc;
  for (const line of doc.iter()) {
    if (line.trim().length > 0) {
      return line;
    }
  }
  return undefined;
}

/**
 * @returns {(view: EditorView) => Diagnostic[]}
 */
export function yamlParseLinter() {
  return (view) => {
    try {
      YAML.load(view.state.doc.toString());
    } catch (e) {
      if (!(e instanceof YAMLException)) throw e;
      const pos = getErrorPosition(e, view.state.doc);
      return [
        {
          from: pos,
          message: e.reason,
          severity: "error",
          to: pos,
        },
      ];
    }
    return [];
  };
}

/**
 *
 * @param {YAMLException} error
 * @param {Text} doc
 * @returns {number}
 */
function getErrorPosition(error, doc) {
  return doc.line(error.mark.line).from + error.mark.column;
}
