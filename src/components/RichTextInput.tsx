import { useState, useRef, useCallback, useEffect } from "react";
import { PaperAirplaneIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { cn } from "~/utils/utils";
import {
  type RichTextContent,
  type MediaItem,
  type ActionRecord,
} from "~/types/multimodal";
import {
  extractImagesFromClipboard,
  isImageFile,
  isAudioFile,
} from "~/utils/fileUtils";
import { ImagePreviewModal } from "./ImagePreviewModal";

interface RichTextInputProps {
  onSubmit: (content: RichTextContent) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}

interface MediaBadge {
  id: string;
  filename: string;
  type: "image" | "audio" | "code" | "element" | "action" | "action-sequence";
  actionSequence?: ActionRecord[];
  displayName?: string;
}

export const RichTextInput: React.FC<RichTextInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = "输入内容，可以插入图片、语音或代码文件...",
}) => {
  const [currentText, setCurrentText] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [previewImage, setPreviewImage] = useState<MediaItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // 插入 badge
  const insertBadge = (mediaItem: MediaItem, badge: MediaBadge) => {
    if (!editorRef.current) return;

    const badgeElement = createBadgeElement(badge);

    // 创建一个包含唯一标识的占位符
    const placeholderSpan = document.createElement("span");
    placeholderSpan.setAttribute("data-badge-id", badge.id);
    placeholderSpan.contentEditable = "false";
    placeholderSpan.appendChild(badgeElement);

    // 确保焦点在编辑器上，然后插入到末尾
    editorRef.current.focus();

    // 将光标移到编辑器末尾
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false); // 移到末尾
      selection.addRange(range);

      // 插入badge
      range.deleteContents();
      range.insertNode(placeholderSpan);

      // 在badge后面添加一个空格，并将光标放在空格后
      const spaceNode = document.createTextNode(" ");
      range.setStartAfter(placeholderSpan);
      range.insertNode(spaceNode);
      range.setStartAfter(spaceNode);
      range.setEndAfter(spaceNode);

      selection.removeAllRanges();
      selection.addRange(range);
    }

    updateTextFromEditor();
  };

  // 创建 badge 元素
  const createBadgeElement = (badge: MediaBadge): HTMLElement => {
    if (badge.type === "action-sequence" && badge.actionSequence) {
      const container = document.createElement("div");
      container.style.display = "inline-block";
      container.style.verticalAlign = "middle";
      container.style.margin = "0 2px";

      const actionBlock = document.createElement("div");
      actionBlock.className =
        "inline-flex items-center gap-1 rounded-md border border-yellow-200 bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800";

      // 创建图标
      const iconSvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      iconSvg.setAttribute("class", "h-3 w-3");
      iconSvg.setAttribute("fill", "none");
      iconSvg.setAttribute("stroke", "currentColor");
      iconSvg.setAttribute("viewBox", "0 0 24 24");

      const iconPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      iconPath.setAttribute("stroke-linecap", "round");
      iconPath.setAttribute("stroke-linejoin", "round");
      iconPath.setAttribute("stroke-width", "2");
      iconPath.setAttribute("d", "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z");

      iconSvg.appendChild(iconPath);
      actionBlock.appendChild(iconSvg);

      // 创建文本内容（转义HTML）
      const textSpan = document.createElement("span");
      textSpan.textContent = badge.displayName || badge.filename;
      actionBlock.appendChild(textSpan);

      // 创建删除按钮
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "ml-1 text-current opacity-50 hover:opacity-100";

      const removeSvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      removeSvg.setAttribute("class", "h-2.5 w-2.5");
      removeSvg.setAttribute("fill", "none");
      removeSvg.setAttribute("stroke", "currentColor");
      removeSvg.setAttribute("viewBox", "0 0 24 24");

      const removePath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      removePath.setAttribute("stroke-linecap", "round");
      removePath.setAttribute("stroke-linejoin", "round");
      removePath.setAttribute("stroke-width", "2");
      removePath.setAttribute("d", "M6 18L18 6M6 6l12 12");

      removeSvg.appendChild(removePath);
      removeButton.appendChild(removeSvg);

      // 绑定删除按钮事件
      removeButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeMedia(badge.id);
      });

      actionBlock.appendChild(removeButton);
      container.appendChild(actionBlock);
      return container;
    } else {
      const getBadgeIcon = () => {
        switch (badge.type) {
          case "image":
            return `<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>`;
          case "audio":
            return `<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
            </svg>`;
          case "code":
            return `<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>`;
          case "element":
            return `<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>`;
          default:
            return `<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>`;
        }
      };

      const getBadgeColors = () => {
        switch (badge.type) {
          case "image":
            return "border-blue-200 bg-blue-100 text-blue-800";
          case "audio":
            return "border-green-200 bg-green-100 text-green-800";
          case "code":
            return "border-purple-200 bg-purple-100 text-purple-800";
          case "element":
            return "border-orange-200 bg-orange-100 text-orange-800";
          default:
            return "border-blue-200 bg-blue-100 text-blue-800";
        }
      };

      const badgeElement = document.createElement("span");
      badgeElement.className = `mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${getBadgeColors()}`;

      // 创建图标
      const iconContainer = document.createElement("span");
      iconContainer.innerHTML = getBadgeIcon();
      badgeElement.appendChild(iconContainer);

      // 创建文本内容（转义HTML）
      const textSpan = document.createElement("span");
      textSpan.className = "max-w-24 truncate";
      textSpan.textContent = badge.displayName || badge.filename;
      badgeElement.appendChild(textSpan);

      // 创建删除按钮
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className =
        "ml-0.5 cursor-pointer text-current opacity-50 hover:opacity-100";

      const removeSvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      removeSvg.setAttribute("class", "h-2.5 w-2.5");
      removeSvg.setAttribute("fill", "none");
      removeSvg.setAttribute("stroke", "currentColor");
      removeSvg.setAttribute("viewBox", "0 0 24 24");

      const removePath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      removePath.setAttribute("stroke-linecap", "round");
      removePath.setAttribute("stroke-linejoin", "round");
      removePath.setAttribute("stroke-width", "2");
      removePath.setAttribute("d", "M6 18L18 6M6 6l12 12");

      removeSvg.appendChild(removePath);
      removeButton.appendChild(removeSvg);

      // 绑定删除按钮事件
      removeButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeMedia(badge.id);
      });

      badgeElement.appendChild(removeButton);

      // 添加点击事件（用于图片预览）
      if (badge.type === "image") {
        badgeElement.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openImagePreview(badge.id);
        });
      }

      return badgeElement;
    }
  };

  // 从编辑器更新文本状态
  const updateTextFromEditor = () => {
    if (!editorRef.current) return;

    const textContent = editorRef.current.innerText || "";
    setCurrentText(textContent);
  };

  // 处理文件上传
  const handleFileUpload = useCallback(
    async (file: File, type: "image" | "audio") => {
      try {
        const base64Url = await fileToBase64(file);

        const mediaItem: MediaItem = {
          id: generateId(),
          type,
          url: base64Url,
          name: file.name,
          size: file.size,
        };

        setMedia((prev) => [...prev, mediaItem]);

        const newBadge: MediaBadge = {
          id: mediaItem.id,
          filename: file.name,
          type,
        };

        insertBadge(mediaItem, newBadge);

        return mediaItem;
      } catch (error) {
        console.error("转换文件为base64失败:", error);
        throw error;
      }
    },
    [],
  );

  // 处理图片选择
  const handleImageSelect = () => {
    fileInputRef.current?.click();
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
    if (mediaItem) {
      // 从DOM中移除对应的badge元素
      if (editorRef.current) {
        const badgeElement = editorRef.current.querySelector(
          `[data-badge-id="${mediaId}"]`,
        );
        if (badgeElement) {
          badgeElement.remove();
        }
      }

      // 移除媒体和badge
      setMedia((prev) => prev.filter((item) => item.id !== mediaId));

      // 更新文本状态
      updateTextFromEditor();
    }
  };

  // 处理代码文件拖拽
  const handleCodeFileDrop = useCallback(
    (codeData: { type: string; filename: string; content: string }) => {
      const mediaItem: MediaItem = {
        id: generateId(),
        type: "code",
        url: codeData.content,
        name: codeData.filename,
        size: codeData.content.length,
      };

      setMedia((prev) => [...prev, mediaItem]);

      // 创建badge
      const newBadge: MediaBadge = {
        id: mediaItem.id,
        filename: codeData.filename,
        type: "code",
        displayName: codeData.filename,
      };

      insertBadge(mediaItem, newBadge);

      return mediaItem;
    },
    [],
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

    const container = containerRef.current;
    if (container) {
      container.addEventListener("dragover", handleDragOver);
      container.addEventListener("drop", handleDrop);
    }

    return () => {
      window.removeEventListener(
        "codeFileDrop",
        handleCodeFileDrag as EventListener,
      );
      if (container) {
        container.removeEventListener("dragover", handleDragOver);
        container.removeEventListener("drop", handleDrop);
      }
    };
  }, [handleCodeFileDrop]);

  // 处理元素选择
  const handleElementDrop = useCallback(
    (elementData: { type: string; name: string; content: string }) => {
      const mediaItem: MediaItem = {
        id: generateId(),
        type: "element",
        url: elementData.content,
        name: elementData.name,
        size: elementData.content.length,
      };

      setMedia((prev) => [...prev, mediaItem]);

      // 创建badge
      const newBadge: MediaBadge = {
        id: mediaItem.id,
        filename: elementData.name,
        type: "element",
        displayName: elementData.name,
      };

      insertBadge(mediaItem, newBadge);

      return mediaItem;
    },
    [],
  );

  // 监听元素选择事件
  useEffect(() => {
    const handleElementSelection = (event: CustomEvent) => {
      handleElementDrop(event.detail);
    };

    window.addEventListener(
      "elementDrop",
      handleElementSelection as EventListener,
    );

    return () => {
      window.removeEventListener(
        "elementDrop",
        handleElementSelection as EventListener,
      );
    };
  }, [handleElementDrop]);

  // 处理操作记录
  const handleActionDrop = useCallback(
    (actionData: { type: string; name: string; content: string }) => {
      // 将单个操作也创建为 action-sequence 类型，只是只包含一个操作
      const singleActionRecord: ActionRecord = {
        id: Math.random().toString(36).substring(2, 15),
        timestamp: Date.now(),
        type: "input",
        elementTag: "unknown",
        elementText: "",
        elementClass: "",
        elementId: "",
        description: actionData.content,
        inputValue: undefined,
      };

      const mediaItem: MediaItem = {
        id: generateId(),
        type: "action-sequence",
        url: JSON.stringify([singleActionRecord]),
        name: actionData.name,
        size: 1,
      };

      setMedia((prev) => [...prev, mediaItem]);

      // 创建badge
      const newBadge: MediaBadge = {
        id: mediaItem.id,
        filename: actionData.name,
        type: "action-sequence",
        actionSequence: [singleActionRecord],
        displayName: actionData.name,
      };

      insertBadge(mediaItem, newBadge);

      return mediaItem;
    },
    [],
  );

  // 监听操作记录事件
  useEffect(() => {
    const handleActionSelection = (event: CustomEvent) => {
      handleActionDrop(event.detail);
    };

    window.addEventListener(
      "actionDrop",
      handleActionSelection as EventListener,
    );

    return () => {
      window.removeEventListener(
        "actionDrop",
        handleActionSelection as EventListener,
      );
    };
  }, [handleActionDrop]);

  // 处理操作序列
  const handleActionSequenceDrop = useCallback(
    (sequenceData: { type: string; name: string; actions: ActionRecord[] }) => {
      const mediaItem: MediaItem = {
        id: generateId(),
        type: "action-sequence",
        url: JSON.stringify(sequenceData.actions),
        name: sequenceData.name,
        size: sequenceData.actions.length,
      };

      setMedia((prev) => [...prev, mediaItem]);

      // 创建badge
      const newBadge: MediaBadge = {
        id: mediaItem.id,
        filename: sequenceData.name,
        type: "action-sequence",
        actionSequence: sequenceData.actions,
        displayName: sequenceData.name,
      };

      insertBadge(mediaItem, newBadge);

      return mediaItem;
    },
    [],
  );

  // 监听操作序列事件
  useEffect(() => {
    const handleActionSequenceSelection = (event: CustomEvent) => {
      handleActionSequenceDrop(event.detail);
    };

    window.addEventListener(
      "actionSequenceDrop",
      handleActionSequenceSelection as EventListener,
    );

    return () => {
      window.removeEventListener(
        "actionSequenceDrop",
        handleActionSequenceSelection as EventListener,
      );
    };
  }, [handleActionSequenceDrop]);

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
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  };

  // 处理输入事件
  const handleInput = () => {
    updateTextFromEditor();
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 处理剪贴板粘贴事件
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
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

  // 打开图片预览
  const openImagePreview = (mediaId: string) => {
    const imageItem = media.find(
      (item) => item.id === mediaId && item.type === "image",
    );
    if (imageItem) {
      setPreviewImage(imageItem);
      setShowPreview(true);
    }
  };

  // 关闭图片预览
  const closeImagePreview = () => {
    setShowPreview(false);
    setPreviewImage(null);
  };

  // 添加 placeholder 样式
  useEffect(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const placeholder = editor.getAttribute("data-placeholder");

    if (placeholder) {
      const style = document.createElement("style");
      style.textContent = `
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `;

      if (!document.head.querySelector("[data-placeholder-style]")) {
        style.setAttribute("data-placeholder-style", "true");
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <>
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

              <div className="relative min-h-[120px]">
                {/* 使用 contentEditable div 替代 textarea */}
                <div
                  ref={editorRef}
                  contentEditable={!disabled}
                  className="relative block w-full resize-none border-0 bg-transparent px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-0"
                  style={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                    fontSize: "0.875rem",
                    lineHeight: "1.5rem",
                    color: "#111827",
                    minHeight: "120px",
                  }}
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  data-placeholder={!currentText ? placeholder : ""}
                />
              </div>

              {/* 工具栏 */}
              <div className="flex items-center justify-between border-t border-gray-200 px-3 py-3">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleImageSelect}
                    disabled={disabled}
                    className="inline-flex items-center rounded-md px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    <PhotoIcon className="mr-1 h-4 w-4" />
                    Upload Image
                  </button>
                  <span className="ml-2 text-xs text-gray-400">
                    Supports pasting screenshots, dragging and dropping files,
                    code snippets, elements, or operation history.
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
          </form>
        </div>
      </div>

      {/* 图片预览模态 */}
      <ImagePreviewModal
        imageItem={previewImage}
        isOpen={showPreview}
        onClose={closeImagePreview}
      />
    </>
  );
};
