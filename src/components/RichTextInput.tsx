import { useState, useRef, useCallback, useEffect } from "react";
import {
  PaperAirplaneIcon,
  PhotoIcon,
  MicrophoneIcon,
  XMarkIcon,
  CodeBracketIcon,
  CursorArrowRaysIcon,
} from "@heroicons/react/24/outline";
import { cn } from "~/utils/utils";
import { type RichTextContent, type MediaItem } from "~/types/multimodal";
import {
  extractImagesFromClipboard,
  isImageFile,
  isAudioFile,
} from "~/utils/fileUtils";

interface RichTextInputProps {
  onSubmit: (content: RichTextContent) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}

interface MediaBadge {
  id: string;
  filename: string;
  type: "image" | "audio" | "code" | "element";
  position: number;
}

export const RichTextInput: React.FC<RichTextInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = "输入内容，可以插入图片、语音或代码文件...",
  rows = 2,
}) => {
  const [currentText, setCurrentText] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaBadges, setMediaBadges] = useState<MediaBadge[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  // 将文件转换为base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // 处理文件上传
  const handleFileUpload = useCallback(
    async (file: File, type: "image" | "audio") => {
      try {
        // 转换为base64
        const base64Url = await fileToBase64(file);
        console.log("🚀 ~ base64Url:", base64Url);

        const mediaItem: MediaItem = {
          id: generateId(),
          type,
          url: base64Url, // 使用base64格式而不是blob URL
          name: file.name,
          size: file.size,
        };

        setMedia((prev) => [...prev, mediaItem]);

        // 在当前光标位置插入媒体标记
        const filename =
          file.name.length > 20
            ? file.name.substring(0, 17) + "..."
            : file.name;
        const placeholder = `[${filename}]`;

        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newText =
            currentText.substring(0, start) +
            placeholder +
            currentText.substring(end);

          setCurrentText(newText);

          // 创建badge
          const newBadge: MediaBadge = {
            id: mediaItem.id,
            filename: file.name,
            type,
            position: start,
          };

          setMediaBadges((prev) => [...prev, newBadge]);

          // 设置新的光标位置
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd =
              start + placeholder.length;
            setCursorPosition(start + placeholder.length);
          }, 0);
        }

        return mediaItem;
      } catch (error) {
        console.error("转换文件为base64失败:", error);
        throw error;
      }
    },
    [currentText],
  );

  // 处理图片选择
  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };

  // 处理音频选择
  const handleAudioSelect = () => {
    audioInputRef.current?.click();
  };

  // 处理文件输入变化
  const onFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "audio",
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file, type);
    }
    e.target.value = ""; // 重置文件输入
  };

  // 移除媒体项
  const removeMedia = (mediaId: string) => {
    const mediaItem = media.find((item) => item.id === mediaId);
    const badge = mediaBadges.find((b) => b.id === mediaId);

    if (mediaItem && badge) {
      const filename =
        badge.filename.length > 20
          ? badge.filename.substring(0, 17) + "..."
          : badge.filename;
      const placeholder = `[${filename}]`;

      // 从文本中移除占位符
      const newText = currentText.replace(placeholder, "");
      setCurrentText(newText);

      // 移除媒体和badge
      setMedia((prev) => prev.filter((item) => item.id !== mediaId));
      setMediaBadges((prev) => prev.filter((b) => b.id !== mediaId));
    }
  };

  // 更新光标位置
  const handleTextareaClick = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const handleTextareaKeyUp = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  // 处理代码文件拖拽
  const handleCodeFileDrop = useCallback(
    (codeData: { type: string; filename: string; content: string }) => {
      const mediaItem: MediaItem = {
        id: generateId(),
        type: "code",
        url: codeData.content, // 直接存储代码内容
        name: codeData.filename,
        size: codeData.content.length,
      };

      setMedia((prev) => [...prev, mediaItem]);

      // 在当前光标位置插入代码文件标记
      const filename =
        codeData.filename.length > 20
          ? codeData.filename.substring(0, 17) + "..."
          : codeData.filename;
      const placeholder = `[${filename}]`;

      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText =
          currentText.substring(0, start) +
          placeholder +
          currentText.substring(end);

        setCurrentText(newText);

        // 创建badge
        const newBadge: MediaBadge = {
          id: mediaItem.id,
          filename: codeData.filename,
          type: "code",
          position: start,
        };

        setMediaBadges((prev) => [...prev, newBadge]);

        // 设置新的光标位置
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd =
            start + placeholder.length;
          setCursorPosition(start + placeholder.length);
        }, 0);
      }

      return mediaItem;
    },
    [currentText],
  );

  // 监听代码文件拖拽事件
  useEffect(() => {
    const handleCodeFileDrag = (event: CustomEvent) => {
      handleCodeFileDrop(event.detail);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer?.getData("application/json");
      if (data) {
        try {
          const dragData = JSON.parse(data);
          if (dragData.type === "code") {
            handleCodeFileDrop(dragData);
          }
        } catch (error) {
          console.error("Failed to parse drag data:", error);
        }
      }
    };

    window.addEventListener(
      "codeFileDrop",
      handleCodeFileDrag as EventListener,
    );
    containerRef.current?.addEventListener("dragover", handleDragOver);
    containerRef.current?.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener(
        "codeFileDrop",
        handleCodeFileDrag as EventListener,
      );
      containerRef.current?.removeEventListener("dragover", handleDragOver);
      containerRef.current?.removeEventListener("drop", handleDrop);
    };
  }, [handleCodeFileDrop]);

  // 处理元素选择
  const handleElementDrop = useCallback(
    (elementData: { type: string; name: string; content: string }) => {
      const mediaItem: MediaItem = {
        id: generateId(),
        type: "element",
        url: elementData.content, // 存储元素的HTML内容
        name: elementData.name,
        size: elementData.content.length,
      };

      setMedia((prev) => [...prev, mediaItem]);

      // 在当前光标位置插入元素标记
      const displayName =
        elementData.name.length > 20
          ? elementData.name.substring(0, 17) + "..."
          : elementData.name;
      const placeholder = `[${displayName}]`;

      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText =
          currentText.substring(0, start) +
          placeholder +
          currentText.substring(end);

        setCurrentText(newText);

        // 创建badge
        const newBadge: MediaBadge = {
          id: mediaItem.id,
          filename: elementData.name,
          type: "element",
          position: start,
        };

        setMediaBadges((prev) => [...prev, newBadge]);

        // 设置新的光标位置
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd =
            start + placeholder.length;
          setCursorPosition(start + placeholder.length);
        }, 0);
      }

      return mediaItem;
    },
    [currentText],
  );

  // 监听元素选择事件
  useEffect(() => {
    const handleElementSelection = (event: CustomEvent) => {
      handleElementDrop(event.detail);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer?.getData("application/json");
      if (data) {
        try {
          const dragData = JSON.parse(data);
          if (dragData.type === "element") {
            handleElementDrop(dragData);
          }
        } catch (error) {
          console.error("Failed to parse drag data:", error);
        }
      }
    };

    window.addEventListener(
      "elementDrop",
      handleElementSelection as EventListener,
    );
    containerRef.current?.addEventListener("dragover", handleDragOver);
    containerRef.current?.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener(
        "elementDrop",
        handleElementSelection as EventListener,
      );
      containerRef.current?.removeEventListener("dragover", handleDragOver);
      containerRef.current?.removeEventListener("drop", handleDrop);
    };
  }, [handleCodeFileDrop, handleElementDrop]);

  // 渲染带有badge的文本
  const renderTextWithBadges = () => {
    if (!currentText) return null;

    const parts = [];
    let lastIndex = 0;

    // 找到所有的媒体占位符
    const placeholderRegex = /\[([^\]]+)\]/g;
    let match;

    while ((match = placeholderRegex.exec(currentText)) !== null) {
      const beforeText = currentText.slice(lastIndex, match.index);
      const placeholderText = match[1];

      // 添加前面的文本
      if (beforeText) {
        parts.push(
          <span key={`text-${lastIndex}`} className="text-gray-900">
            {beforeText}
          </span>,
        );
      }

      // 查找对应的媒体项
      const badge = mediaBadges.find((b) => {
        const displayName =
          b.filename.length > 20
            ? b.filename.substring(0, 17) + "..."
            : b.filename;
        return displayName === placeholderText;
      });

      if (badge) {
        const getBadgeIcon = () => {
          switch (badge.type) {
            case "image":
              return <PhotoIcon className="h-3 w-3" />;
            case "audio":
              return <MicrophoneIcon className="h-3 w-3" />;
            case "code":
              return <CodeBracketIcon className="h-3 w-3" />;
            case "element":
              return <CursorArrowRaysIcon className="h-3 w-3" />;
            default:
              return <PhotoIcon className="h-3 w-3" />;
          }
        };

        const getBadgeColors = () => {
          switch (badge.type) {
            case "image":
              return "border border-blue-200 bg-blue-100 text-blue-800";
            case "audio":
              return "border border-green-200 bg-green-100 text-green-800";
            case "code":
              return "border border-purple-200 bg-purple-100 text-purple-800";
            case "element":
              return "border border-orange-200 bg-orange-100 text-orange-800";
            default:
              return "border border-blue-200 bg-blue-100 text-blue-800";
          }
        };

        parts.push(
          <span
            key={`badge-${badge.id}`}
            className={cn([
              "mx-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              getBadgeColors(),
            ])}
            style={{
              pointerEvents: "auto",
              verticalAlign: "middle",
            }}
          >
            {getBadgeIcon()}
            <span className="max-w-24 truncate">{badge.filename}</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeMedia(badge.id);
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // 防止textarea失去焦点
                e.stopPropagation();
              }}
              className="ml-0.5 cursor-pointer text-current opacity-50 hover:opacity-100"
              style={{ pointerEvents: "auto" }}
            >
              <XMarkIcon className="h-2.5 w-2.5" />
            </button>
          </span>,
        );
      } else {
        // 如果找不到对应的badge，显示原文本
        parts.push(
          <span key={`placeholder-${match.index}`} className="text-gray-500">
            [{placeholderText}]
          </span>,
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余的文本
    if (lastIndex < currentText.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-gray-900">
          {currentText.slice(lastIndex)}
        </span>,
      );
    }

    return parts;
  };

  // 提交内容
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentText.trim() && media.length === 0) return;

    const content: RichTextContent = {
      text: currentText,
      media: media,
    };

    onSubmit(content);

    // 清空输入
    setCurrentText("");
    setMedia([]);
    setMediaBadges([]);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 处理剪贴板粘贴事件
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // 提取图片文件
      const imageFiles = extractImagesFromClipboard(clipboardData);

      if (imageFiles.length > 0) {
        e.preventDefault(); // 阻止默认粘贴行为

        // 处理每个图片
        for (const file of imageFiles) {
          await handleFileUpload(file, "image");
        }
      }
      // 如果没有图片，允许默认的文本粘贴行为
    },
    [handleFileUpload],
  );

  // 处理拖拽事件
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 处理拖拽放置事件
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);

      for (const file of files) {
        if (isImageFile(file)) {
          await handleFileUpload(file, "image");
        } else if (isAudioFile(file)) {
          await handleFileUpload(file, "audio");
        }
      }
    },
    [handleFileUpload],
  );

  return (
    <div
      ref={containerRef}
      className="relative flex w-full rounded-lg border border-gray-300 bg-gray-200"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDrop={handleDrop}
    >
      <div className="relative min-w-0 flex-1">
        <form className="relative" onSubmit={handleSubmit}>
          <div className="overflow-hidden rounded-lg bg-white focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600">
            <label htmlFor="richTextInput" className="sr-only">
              添加内容
            </label>

            <div className="relative">
              {/* 显示层 - 带有badge的文本 */}
              <div
                className="absolute inset-0 whitespace-pre-wrap break-words px-3 py-1.5 text-sm leading-6"
                style={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                  fontSize: "0.875rem",
                  lineHeight: "1.5rem",
                  color: "#111827",
                  zIndex: 2,
                  pointerEvents: "none",
                }}
              >
                {currentText && renderTextWithBadges()}
              </div>

              {/* 输入层 - 完全透明的文本用于光标和选择 */}
              <textarea
                ref={textareaRef}
                rows={rows}
                name="richTextInput"
                id="richTextInput"
                disabled={disabled}
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                onClick={handleTextareaClick}
                onKeyUp={handleTextareaKeyUp}
                className="relative block w-full resize-none border-0 bg-transparent px-3 py-1.5 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
                placeholder={!currentText ? placeholder : ""}
                onKeyDown={handleKeyDown}
                style={{
                  caretColor: "#111827",
                  fontSize: "0.875rem",
                  lineHeight: "1.5rem",
                  fontFamily:
                    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                  color: "transparent",
                  backgroundColor: "transparent",
                  zIndex: 1,
                }}
                onPaste={handlePaste}
              />
            </div>

            {/* 工具栏 */}
            <div className="flex items-center justify-between border-t border-gray-200 px-3 py-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleImageSelect}
                  disabled={disabled}
                  className="inline-flex items-center rounded-md px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <PhotoIcon className="mr-1 h-4 w-4" />
                  图片
                </button>
                <button
                  type="button"
                  onClick={handleAudioSelect}
                  disabled={disabled}
                  className="inline-flex items-center rounded-md px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <MicrophoneIcon className="mr-1 h-4 w-4" />
                  语音
                </button>
                <span className="ml-2 text-xs text-gray-400">
                  支持粘贴截图、拖拽文件或代码文件
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  disabled || (!currentText.trim() && media.length === 0)
                }
                className={cn([
                  "inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                  (disabled || (!currentText.trim() && media.length === 0)) &&
                    "cursor-not-allowed opacity-50",
                ])}
              >
                {disabled ? (
                  <div className="h-4 w-4 stroke-gray-300">
                    <svg className="animate-spin" viewBox="0 0 256 256">
                      <line
                        x1="128"
                        y1="32"
                        x2="128"
                        y2="64"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="24"
                      ></line>
                      <line
                        x1="195.9"
                        y1="60.1"
                        x2="173.3"
                        y2="82.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="24"
                      ></line>
                      <line
                        x1="224"
                        y1="128"
                        x2="192"
                        y2="128"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="24"
                      ></line>
                      <line
                        x1="195.9"
                        y1="195.9"
                        x2="173.3"
                        y2="173.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="24"
                      ></line>
                      <line
                        x1="128"
                        y1="224"
                        x2="128"
                        y2="192"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="24"
                      ></line>
                      <line
                        x1="60.1"
                        y1="195.9"
                        x2="82.7"
                        y2="173.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="24"
                      ></line>
                      <line
                        x1="32"
                        y1="128"
                        x2="64"
                        y2="128"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="24"
                      ></line>
                      <line
                        x1="60.1"
                        y1="60.1"
                        x2="82.7"
                        y2="82.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="24"
                      ></line>
                    </svg>
                  </div>
                ) : (
                  <PaperAirplaneIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange(e, "image")}
            className="hidden"
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => onFileChange(e, "audio")}
            className="hidden"
          />
        </form>
      </div>
    </div>
  );
};
