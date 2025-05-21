import CodeMirror, { EditorState } from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { javascript } from "@codemirror/lang-javascript";
import { EditorView } from "@codemirror/view";
import { type ComponentFile } from "~/utils/compiler";
import { useState } from "react";

const editorStyles = EditorView.baseTheme({
  "&": {
    fontSize: "0.875rem",
  },
  "&.cm-editor": {
    flex: "1",
    height: "100%",
    position: "relative",
  },
  ".cm-scroller": {
    position: "absolute !important",
    top: "0",
    right: "0",
    bottom: "0",
    left: "0",
    "overflow-y": "auto",
  },
  "&.cm-editor.cm-focused": {
    outline: "none",
  },
});

interface CodePanelProps {
  code: ComponentFile[];
}

export const CodePanel: React.FC<CodePanelProps> = ({ code }) => {
  console.log("🚀 ~ code:", code);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-gray-200">
        <div className="flex flex-1 overflow-x-auto">
          {code.map((file, index) => (
            <button
              key={index}
              className={`flex items-center px-4 py-2 text-sm font-medium ${
                selectedFileIndex === index
                  ? "border-b-2 border-indigo-500 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setSelectedFileIndex(index)}
            >
              <span className="mr-1">{file.filename}</span>
              {file.isMain && (
                <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">
                  Main
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <CodeMirror
          className="w-full flex-1 overflow-hidden rounded-b-lg border-0"
          value={code[selectedFileIndex]?.content || ""}
          theme={vscodeDark}
          extensions={[
            javascript({ jsx: true, typescript: true }),
            editorStyles,
            EditorView.lineWrapping,
            EditorState.readOnly.of(true),
          ]}
          editable={false}
        />
      </div>
    </div>
  );
};
