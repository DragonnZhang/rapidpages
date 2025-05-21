import { availablePresets, registerPreset, transform } from "@babel/standalone";
import {
  type TailwindConfig,
  createTailwindcss,
} from "@mhsdesign/jit-browser-tailwindcss";
import * as esbuild from "esbuild-wasm";

// 使用Promise来追踪初始化状态，确保只初始化一次
let esbuildInitPromise: Promise<void> | null = null;

// 初始化 esbuild-wasm
const initEsbuild = async () => {
  if (!esbuildInitPromise) {
    esbuildInitPromise = esbuild
      .initialize({
        // 使用特定版本的esbuild-wasm，该版本更稳定
        wasmURL:
          "https://cdn.jsdelivr.net/npm/esbuild-wasm@0.25.4/esbuild.wasm",
        // 允许worker线程运行
        worker: false,
      })
      .catch((error) => {
        // 如果初始化失败，重置Promise以便下次可以重试
        console.error("Failed to initialize esbuild:", error);
        esbuildInitPromise = null;
        throw error;
      });
  }
  return esbuildInitPromise;
};

registerPreset("tsx", {
  presets: [
    [availablePresets["typescript"], { allExtensions: true, isTSX: true }],
  ],
});

// 新的类型定义
export interface ComponentFile {
  filename: string;
  content: string;
  isMain?: boolean; // 标记主组件，默认会在App中直接渲染
}

// 更新后的编译函数，支持多文件
export const compileTypescript = async (files: ComponentFile[]) => {
  console.log("🚀 ~ compileTypescript ~ files:", files);

  // 初始化 esbuild
  await initEsbuild();

  // 找出主组件，如果没有标记，使用第一个文件
  const mainComponents = files.filter((c) => c.isMain);
  const mainComponent =
    mainComponents.length > 0 ? mainComponents[0] : files[0];
  const mainComponentName = sanitizeIdentifier(
    mainComponent!.filename.replace(/\.tsx$/, ""),
  );

  // 创建入口文件内容
  const entryFileContent = `
    import React from 'react';
    import ReactDOM from 'react-dom';
    ${files
      .map((file) => {
        // 使用安全的标识符作为导入名
        const name = sanitizeIdentifier(file.filename.replace(/\.[^.]+$/, ""));
        return `import ${name} from './${file.filename}';`;
      })
      .join("\n")}

    const App = () => {
      return (
        <>
          <${mainComponentName} />
        </>
      )
    }

    // 使用兼容性方式渲染React组件
    const rootElement = document.querySelector("#root");
    // 检测是否支持React 18的createRoot API
    if (typeof ReactDOM.createRoot === 'function') {
      // React 18+
      ReactDOM.createRoot(rootElement).render(<App />);
    } else {
      // React 17及以下
      ReactDOM.render(<App />, rootElement);
    }
  `;

  // 创建一个虚拟文件系统用于 esbuild
  const virtualFileSystem = {};

  // 将所有组件文件添加到虚拟文件系统
  files.forEach((file) => {
    // 确保文件名有正确的扩展名
    const filename = ensureFileExtension(file.filename);
    virtualFileSystem[filename] = file.content;
  });

  // 添加入口文件
  virtualFileSystem["index.tsx"] = entryFileContent;

  // 使用 esbuild 打包
  const bundleResult = await esbuild.build({
    entryPoints: ["index.tsx"],
    bundle: true,
    write: false,
    format: "esm",
    target: "es2015",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    logLevel: "warning", // 显示更多日志以便调试
    plugins: [
      {
        name: "virtual-files",
        setup(build) {
          // 拦截所有文件请求，返回虚拟文件系统中的内容
          build.onResolve({ filter: /.*/ }, (args) => {
            console.log("Resolving:", args.path, "from", args.importer);

            // 处理相对导入路径
            if (args.path.startsWith("./")) {
              // 从导入者位置解析相对路径
              const importerDir = args.importer.includes("/")
                ? args.importer.substring(0, args.importer.lastIndexOf("/")) +
                  "/"
                : "";

              // 移除 ./ 前缀并标准化路径
              let normalizedPath = args.path.substring(2);

              // 确保有正确的扩展名
              normalizedPath = ensureFileExtension(normalizedPath);

              // 检查文件是否存在于虚拟文件系统中
              if (normalizedPath in virtualFileSystem) {
                return { path: normalizedPath, namespace: "virtual-fs" };
              }

              // 如果没有扩展名的查找失败，尝试添加其他常见扩展名
              const extensions = [".tsx", ".ts", ".jsx", ".js"];
              for (const ext of extensions) {
                const pathWithExt = normalizedPath + ext;
                if (pathWithExt in virtualFileSystem) {
                  return { path: pathWithExt, namespace: "virtual-fs" };
                }
              }
            }

            // 直接在虚拟文件系统中查找
            if (args.path in virtualFileSystem) {
              return { path: args.path, namespace: "virtual-fs" };
            }

            // 对于外部模块，标记为external
            return { external: true };
          });

          build.onLoad({ filter: /.*/, namespace: "virtual-fs" }, (args) => {
            console.log("Loading:", args.path);
            if (args.path in virtualFileSystem) {
              const loader = getLoaderForFile(args.path);
              return {
                contents: virtualFileSystem[args.path],
                loader,
              };
            }
            return null;
          });
        },
      },
    ],
  });

  // 获取打包后的代码
  const bundledCode = bundleResult.outputFiles[0].text;

  // 使用 babel 编译打包后的代码
  const output = babelCompile(bundledCode, "bundle.js");

  // 配置Tailwind
  const tailwindConfig: TailwindConfig = {
    theme: {
      extend: {
        colors: {},
      },
    },
    // plugins: [typography]
  };

  const tailwindCss = createTailwindcss({ tailwindConfig });

  // 生成CSS
  const css = await tailwindCss.generateStylesFromContent(
    `
      @tailwind base;
      @tailwind components;
      @tailwind utilities;
    `,
    [output.code],
  );

  // 生成最终HTML
  const html = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <style>${css}</style>
    </head>
    <body style="background-color:#fff">
      <div id="root"></div>
      <script crossorigin defer src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
      <script crossorigin defer src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
      <script defer>window.addEventListener("DOMContentLoaded", () => {${output.code}});</script>
    </body>
  </html>
    `;

  return html;
};

// Transforms the TSX code to JS
const babelCompile = (code: string, filename: string) =>
  transform(code, {
    filename: filename,
    plugins: [
      [
        "transform-modules-umd",
        {
          globals: {
            react: "React",
            "react-dom": "ReactDOM",
            "react-dom/client": "ReactDOM",
          },
        },
      ],
    ],
    presets: ["tsx", "react"],
  });

// 根据文件扩展名获取合适的loader
function getLoaderForFile(filename: string): string {
  if (filename.endsWith(".tsx")) return "tsx";
  if (filename.endsWith(".ts")) return "ts";
  if (filename.endsWith(".jsx")) return "jsx";
  if (filename.endsWith(".js")) return "js";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".css")) return "css";
  return "js"; // 默认
}

// 确保文件名有正确的扩展名
function ensureFileExtension(filename: string): string {
  // 如果已经有扩展名，则原样返回
  if (/\.(tsx|ts|jsx|js)$/i.test(filename)) {
    return filename;
  }
  // 默认添加.tsx扩展名
  return `${filename}.tsx`;
}

// 工具函数：将文件名转换为有效的JS标识符
function sanitizeIdentifier(name: string): string {
  // 替换所有非字母数字字符为下划线
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}
