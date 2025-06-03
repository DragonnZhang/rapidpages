import { useEffect, useRef, useState } from "react";
import { compileTypescript, type ComponentFile } from "~/utils/compiler";
import { CursorArrowRaysIcon } from "@heroicons/react/24/outline";

interface MyProps extends React.HTMLAttributes<HTMLDivElement> {
  code: ComponentFile[];
}

export const PageEditor = ({ code }: MyProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [dom, setDom] = useState<string | undefined>(undefined);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isElementSelectMode, setIsElementSelectMode] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(
    null,
  );

  useEffect(() => {
    // Compile and render the page
    const compileCode = async () => {
      const compiledCode = await compileTypescript(code);
      setDom(compiledCode);
    };

    // We resize the canvas to fit the screen. This is not ideal, but it works for now.
    const handleResize = () => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const { contentWindow } = iframeRef.current;
      if (contentWindow) {
        const { documentElement } = contentWindow.document;
        const width = documentElement.clientWidth;
        const height = documentElement.clientHeight;
        setDimensions({ width, height });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Compile the code
    compileCode();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [code]);

  // 启用元素选择模式
  const enableElementSelection = () => {
    setIsElementSelectMode(true);

    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    const iframeDoc = iframe.contentDocument;

    // 添加选择样式
    const style = iframeDoc.createElement("style");
    style.textContent = `
      .element-selector-hover {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 1px !important;
        cursor: crosshair !important;
      }
      .element-selector-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 9999 !important;
        cursor: crosshair !important;
      }
    `;
    iframeDoc.head.appendChild(style);

    // 创建透明覆盖层
    const overlay = iframeDoc.createElement("div");
    overlay.className = "element-selector-overlay";
    iframeDoc.body.appendChild(overlay);

    let currentHoveredElement: HTMLElement | null = null;

    // 鼠标移动事件
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 临时隐藏覆盖层以获取真实元素
      overlay.style.display = "none";
      const elementBelow = iframeDoc.elementFromPoint(
        e.clientX,
        e.clientY,
      ) as HTMLElement;
      overlay.style.display = "block";

      if (elementBelow && elementBelow !== currentHoveredElement) {
        // 移除之前的高亮
        if (currentHoveredElement) {
          currentHoveredElement.classList.remove("element-selector-hover");
        }

        // 添加新的高亮（但不包括body和html）
        if (
          elementBelow !== iframeDoc.body &&
          elementBelow !== iframeDoc.documentElement
        ) {
          elementBelow.classList.add("element-selector-hover");
          currentHoveredElement = elementBelow;
          setHoveredElement(elementBelow);
        } else {
          currentHoveredElement = null;
          setHoveredElement(null);
        }
      }
    };

    // 鼠标离开覆盖层时移除高亮
    const handleMouseLeave = (e: MouseEvent) => {
      if (currentHoveredElement) {
        currentHoveredElement.classList.remove("element-selector-hover");
        currentHoveredElement = null;
        setHoveredElement(null);
      }
    };

    // 点击事件
    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (currentHoveredElement) {
        selectElement(currentHoveredElement);
      }

      disableElementSelection();
    };

    overlay.addEventListener("mousemove", handleMouseMove);
    overlay.addEventListener("mouseleave", handleMouseLeave);
    overlay.addEventListener("click", handleClick);

    // 清理函数
    const cleanup = () => {
      if (currentHoveredElement) {
        currentHoveredElement.classList.remove("element-selector-hover");
      }
      overlay.remove();
      style.remove();
    };

    // 保存清理函数到iframe上，方便后续调用
    (iframe as any).elementSelectorCleanup = cleanup;
  };

  // 禁用元素选择模式
  const disableElementSelection = () => {
    setIsElementSelectMode(false);
    setHoveredElement(null);

    const iframe = iframeRef.current;
    if (iframe && (iframe as any).elementSelectorCleanup) {
      (iframe as any).elementSelectorCleanup();
      (iframe as any).elementSelectorCleanup = null;
    }
  };

  // 选择元素
  const selectElement = (element: HTMLElement) => {
    const tagName = element.tagName.toLowerCase();

    // 简化元素名称，只显示标签类型
    const elementName = `<${tagName}>`;

    // 创建自定义事件，通知 RichTextInput 组件
    const event = new CustomEvent("elementDrop", {
      detail: {
        type: "element",
        name: elementName,
        content: element.outerHTML,
      },
    });
    window.dispatchEvent(event);
  };

  const handleScroll = (event: React.WheelEvent) => {
    if (!iframeRef.current) return;
    if (!iframeRef.current.contentWindow) return;
    iframeRef.current.contentWindow.scrollBy(0, event.deltaY);

    // scrollTop = iframeRef.current.scrollTop + event.deltaY;
  };

  return (
    <div className="absolute inset-0 flex justify-center">
      {/* 元素选择按钮 */}
      <div className="absolute right-4 top-4 z-10">
        <button
          onClick={
            isElementSelectMode
              ? disableElementSelection
              : enableElementSelection
          }
          className={`
            inline-flex items-center rounded-md px-3 py-2 text-sm font-medium shadow-sm
            ${
              isElementSelectMode
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }
          `}
          title={isElementSelectMode ? "取消选择元素 (ESC)" : "选择页面元素"}
        >
          <CursorArrowRaysIcon className="mr-1 h-4 w-4" />
          {isElementSelectMode ? "取消选择" : "选择元素"}
        </button>
      </div>

      <div
        className="absolute inset-0 overflow-hidden rounded-b-lg"
        onWheel={handleScroll}
      >
        <iframe
          width="100%"
          height="100%"
          tabIndex={-1}
          title="The editor's rendered HTML document"
          srcDoc={dom}
          ref={iframeRef}
          className="mx-auto my-0 block w-full min-w-[769] overflow-hidden border-0"
        />
        <div className="pointer-events-none absolute inset-y-0 flex max-w-full">
          <svg
            id="SVGOverlay"
            className="overflow-visible"
            width={dimensions.width}
            height={dimensions.height}
            ref={svgRef}
          >
            <rect id="SVGSelection"></rect>
            <rect id="SVGHover"></rect>
          </svg>
        </div>
      </div>
    </div>
  );
};
