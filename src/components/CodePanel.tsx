import { useState } from "react";
import { type ComponentFile } from "~/utils/compiler";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { CodeBracketIcon } from "@heroicons/react/24/outline";

export const CodePanel = ({ code }: { code: ComponentFile[] }) => {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const handleFileDragStart = (e: React.DragEvent, file: ComponentFile) => {
    // 设置拖拽数据，包含代码内容
    const dragData = {
      type: "code",
      filename: file.filename,
      content: file.content,
    };
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="flex h-full flex-col">
      {/* 文件选项卡 */}
      {code.length > 1 && (
        <div className="flex border-b border-gray-200 bg-gray-50">
          {code.map((file, index) => (
            <button
              key={file.filename}
              draggable
              onDragStart={(e) => handleFileDragStart(e, file)}
              onClick={() => {
                setSelectedFileIndex(index);
              }}
              className={`
                group relative px-4 py-2 text-sm font-medium transition-colors
                ${
                  selectedFileIndex === index
                    ? "border-b-2 border-indigo-600 bg-white text-indigo-600"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }
                flex cursor-pointer items-center gap-2
              `}
              title={`点击查看 ${file.filename}，拖拽到输入框作为参考`}
            >
              <CodeBracketIcon className="h-4 w-4" />
              {file.filename}
              {file.isMain && (
                <span className="ml-1 rounded-sm bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-600">
                  main
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 代码编辑器 */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={code[selectedFileIndex]?.content || ""}
          height="calc(100vh - 300px)"
          extensions={[javascript({ jsx: true, typescript: true })]}
          theme={oneDark}
          editable={false}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
          }}
        />
      </div>
    </div>
  );
};
