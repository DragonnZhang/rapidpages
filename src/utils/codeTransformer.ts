import { type ComponentFile } from "./compiler";

/**
 * 确保输入数据是ComponentFile[]格式
 * 可以处理JSON字符串、纯文本字符串或已经是数组的情况
 */
export function parseCodeToComponentFiles(code: unknown): ComponentFile[] {
  // 如果是null或undefined，返回空数组
  if (code == null) {
    return [];
  }

  // 如果已经是数组格式且看起来像ComponentFile[]，直接返回
  if (
    Array.isArray(code) &&
    code.length > 0 &&
    "filename" in code[0] &&
    "content" in code[0]
  ) {
    return code as ComponentFile[];
  }

  // 如果是字符串，可能是JSON字符串或纯代码
  if (typeof code === "string") {
    try {
      // 尝试解析JSON
      const parsed = JSON.parse(code);
      if (Array.isArray(parsed)) {
        return parsed as ComponentFile[];
      } else {
        // JSON但不是数组，创建单文件组件
        return [{ filename: "Section.tsx", content: code, isMain: true }];
      }
    } catch (e) {
      // 不是JSON，视为纯代码文本
      return [{ filename: "Section.tsx", content: code, isMain: true }];
    }
  }

  // 其他未知格式，返回空数组
  console.warn("Unknown code format:", code);
  return [];
}

/**
 * 从ComponentFile数组中提取主组件内容
 * 用于向后兼容只需要单一组件内容的情况
 */
export function extractMainComponentCode(files: ComponentFile[]): string {
  // 找到标记为主组件的文件
  const mainFile = files.find((file) => file.isMain);
  // 如果没有找到主组件，使用第一个文件
  return mainFile ? mainFile.content : files[0]?.content || "";
}
