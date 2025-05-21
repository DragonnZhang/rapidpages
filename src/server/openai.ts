import { env } from "~/env.mjs";
import { deepseek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { setGlobalDispatcher, Agent } from "undici";
import { type ComponentFile } from "~/utils/compiler";

setGlobalDispatcher(new Agent({ connect: { timeout: 200000_000 } }));

// 根据 MODEL_NAME 前缀选择合适的模型
function getModelByName(modelName: string) {
  console.log("🚀 ~ getModelByName ~ modelName:", modelName);
  if (modelName.startsWith("deepseek-")) {
    return deepseek(modelName);
  } else if (modelName.startsWith("gpt-")) {
    return createOpenAI({
      baseURL: "https://use.52apikey.cn/v1",
      apiKey: env.OPENAI_API_KEY,
    })(modelName);
  } else if (modelName.startsWith("claude-")) {
    return createOpenAI({
      baseURL: "https://use.52apikey.cn/v1",
      apiKey: env.ANTHROPIC_API_KEY,
    })(modelName);
  } else {
    // 默认使用 deepseek 作为后备选项
    console.warn(`未知模型前缀: ${modelName}，使用 deepseek-chat 作为默认值`);
    return deepseek("deepseek-chat");
  }
}

const model = getModelByName(env.MODEL_NAME);

const options = {
  maxTokens: 8192,
};

/**
 * 提取多文件代码块
 * 尝试从输入文本中提取多个文件的代码块
 */
const extractMultipleCodeBlocks = (input: string): ComponentFile[] | null => {
  // 匹配形式为 ```tsx // 文件名: XXX.tsx 或 // 文件: XXX.tsx 的代码块
  const fileRegex =
    /```tsx\s*\/\/\s*(文件名?|file):\s*([^\n(]+)(?:\s*\((主文件|main)\))?\n([\s\S]+?)```/g;

  const files: ComponentFile[] = [];
  let match;

  while ((match = fileRegex.exec(input)) !== null) {
    const filename = match[2]!.trim();
    const isMain = Boolean(match[3]); // 是否标记为主文件
    const content = match[4]!.trim();

    files.push({ filename, content, isMain });
  }

  // 如果没有找到符合格式的多文件代码块，返回null
  if (files.length === 0) {
    return null;
  }

  // 确保至少有一个文件被标记为主文件
  if (!files.some((f) => f.isMain)) {
    files[0]!.isMain = true;
  }

  return files;
};

export async function reviseComponent(
  prompt: string,
  code: ComponentFile[],
): Promise<ComponentFile[]> {
  // 准备系统提示
  let codeDisplay = "";

  // 对于多文件，生成适当的描述
  codeDisplay = code
    .map(
      (file) =>
        `\`\`\`tsx // 文件: ${file.filename}${
          file.isMain ? " (主文件)" : ""
        }\n${file.content}\n\`\`\``,
    )
    .join("\n\n");

  let fullText = "";
  let finishReason = "";

  // 初始生成
  const initialResponse = await generateText({
    model,
    messages: [
      {
        role: "system",
        content: [
          "你是一位资深的 React 前端开发专家，擅长创建复杂精美的用户界面。",
          "你需要对一个使用 TypeScript 和 Tailwind CSS 的 React 组件进行修改和优化。",
          "请严格遵循用户的需求，一字不差地执行修改要求。",
          "这是一个多文件组件项目，你需要分别修改每个文件，确保文件间引用关系正确。",
          "修改时请重点关注以下几点：",
          "1. UI 复杂度：添加更多精美的 UI 元素，使界面更加丰富多样",
          "2. 视觉层次：创建清晰的视觉层次结构和精心设计的布局",
          "3. 细节完善：添加阴影、过渡、动画等精细的设计元素",
          "4. 交互丰富：增加更多的交互元素和用户反馈",
          "5. 功能完整：确保实现所有必要的界面功能",
          "首先逐步思考需要的修改，然后提供一个具有高度复杂性和视觉吸引力的完整实现。",
          "对于每个文件，请使用 ```tsx // 文件: 文件名.tsx (主文件) 的格式包裹代码，主文件标记只用于主组件文件。",
          "修改后的代码应该是可以直接使用的完整 React 组件。",
          "回复中只包含代码，不需要额外的解释。",
          `以下是需要修改的当前代码：\n${codeDisplay}`,
        ].join("\n"),
      },
      {
        role: "user",
        content: `${prompt}`,
      },
    ],
    ...options,
  });

  fullText = initialResponse.text;
  finishReason = initialResponse.finishReason;

  // 如果因为长度限制而停止，继续生成剩余部分
  while (finishReason === "length") {
    console.log("模型因长度限制停止，继续生成剩余部分...");

    const continuationResponse = await generateText({
      model,
      messages: [
        {
          role: "system",
          content: [
            "你是一位资深的 React 前端开发专家，擅长创建复杂精美的用户界面。",
            "你需要对一个使用 TypeScript 和 Tailwind CSS 的 React 组件进行修改和优化。",
            "请严格遵循用户的需求，一字不差地执行修改要求。",
            "这是一个多文件组件项目，你需要分别修改每个文件，确保文件间引用关系正确。",
            "修改时请重点关注以下几点：",
            "1. UI 复杂度：添加更多精美的 UI 元素，使界面更加丰富多样",
            "2. 视觉层次：创建清晰的视觉层次结构和精心设计的布局",
            "3. 细节完善：添加阴影、过渡、动画等精细的设计元素",
            "4. 交互丰富：增加更多的交互元素和用户反馈",
            "5. 功能完整：确保实现所有必要的界面功能",
            "首先逐步思考需要的修改，然后提供一个具有高度复杂性和视觉吸引力的完整实现。",
            "对于每个文件，请使用 ```tsx // 文件: 文件名.tsx (主文件) 的格式包裹代码，主文件标记只用于主组件文件。",
            "修改后的代码应该是可以直接使用的完整 React 组件。",
            "回复中只包含代码，不需要额外的解释。",
            `以下是需要修改的当前代码：\n${codeDisplay}`,
          ].join("\n"),
        },
        {
          role: "user",
          content: `${prompt}`,
        },
        {
          role: "assistant",
          content: fullText,
        },
        {
          role: "system",
          content: [
            "你是一位资深的 React 前端开发专家，擅长创建复杂精美的用户界面。",
            "你正在继续生成之前未完成的 React 组件代码。请直接从上次停止的地方继续，保持代码的连贯性。",
            "不要重复已经生成的部分，只提供缺失的剩余部分。",
            "回复中只包含代码，不需要额外的解释。",
          ].join("\n"),
        },
      ],
      ...options,
    });

    fullText += continuationResponse.text;
    finishReason = continuationResponse.finishReason;
  }

  console.log("🚀 ~ reviseComponent ~ response:", fullText);

  // 尝试提取多文件代码块
  const multiFiles = extractMultipleCodeBlocks(fullText);

  if (!multiFiles) {
    console.warn("无法提取多文件组件，返回单文件组件");
    throw new Error("无法提取多文件组件");
  }

  console.log("🚀 ~ reviseComponent ~ 成功提取多文件组件:", multiFiles.length);
  return multiFiles;
}

export async function generateNewComponent(
  prompt: string,
): Promise<ComponentFile[]> {
  let fullText = "";
  let finishReason = "";

  // 初始生成
  const initialResponse = await generateText({
    model,
    messages: [
      {
        role: "system",
        content: [
          "你是一位专业的前端开发专家，擅长创建功能丰富、交互完善的 React 组件。",
          "你的任务是编写一个使用 TypeScript 和 Tailwind CSS 的完整 React 组件，该组件应该具有真实应用的复杂度和功能性。",
          "根据需求复杂度，你可以选择生成单文件组件或多文件组件系统。",
          "如果生成多文件组件，请使用以下格式标记每个文件：",
          "```tsx // 文件: 文件名.tsx (主文件)```",
          "其中主文件标记仅用于标识主组件文件，每个组件系统必须有且只有一个主文件。",
          "组件应该包含适当的交互元素、状态管理、合理的数据结构和布局。",
          "生成的代码应该是可工作的，结构良好，并且符合最佳实践。",
          "只导入 React 作为依赖。",
          "回复中只包含代码，不需要额外的解释。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `# 组件需求：${prompt}`,
          `## 技术要求：`,
          `- 使用 TypeScript 和 Tailwind CSS`,
          `- 只能使用 React 作为依赖库`,
          `- 组件代码要完整且可直接使用`,
          `- 可以创建单文件或多文件组件系统，取决于需求复杂度`,
          `## 功能要求：`,
          `- 包含合理的状态管理和用户交互`,
          `- 实现完整的 UI 界面，包括标题、内容区域、按钮、表单等必要元素`,
          `- 添加适当的交互反馈，如加载状态、成功/错误提示等`,
          `- 使用静态示例数据代替动态数据（不使用 props 传递数据）`,
          `- 实现该类型应用常见的核心功能（如数据展示、搜索、筛选、编辑等）`,
          `- 添加适当的注释解释关键逻辑`,
          `## 界面要求：`,
          `- 美观的布局和设计`,
          `- 响应式设计，适配不同屏幕尺寸`,
          `- 合理的空间分配和组件排列`,
          `- 使用 Tailwind 实现视觉层次和交互反馈`,
        ].join("\n"),
      },
    ],
    ...options,
  });

  fullText = initialResponse.text;
  finishReason = initialResponse.finishReason;

  // 如果因为长度限制而停止，继续生成剩余部分
  while (finishReason === "length") {
    console.log("模型因长度限制停止，继续生成剩余部分...");

    const continuationResponse = await generateText({
      model,
      messages: [
        {
          role: "system",
          content: [
            "你是一位专业的前端开发专家，擅长创建功能丰富、交互完善的 React 组件。",
            "你正在继续生成之前未完成的 React 组件代码。请直接从上次停止的地方继续，保持代码的连贯性。",
            "不要重复已经生成的部分，只提供缺失的剩余部分。",
            "回复中只包含代码，不需要额外的解释。",
          ].join("\n"),
        },
        {
          role: "user",
          content: `以下是已经生成的部分代码，请继续完成剩余部分：\n\n${fullText}`,
        },
      ],
      ...options,
    });

    fullText += continuationResponse.text;
    finishReason = continuationResponse.finishReason;
  }

  console.log("🚀 ~ generateNewComponent ~ result:", fullText);

  // 尝试提取多文件代码块
  const multiFiles = extractMultipleCodeBlocks(fullText);

  if (!multiFiles) {
    console.warn("无法提取多文件组件，返回单文件组件");
    throw new Error("无法提取多文件组件");
  }

  console.log(
    "🚀 ~ generateNewComponent ~ 成功提取多文件组件:",
    multiFiles.length,
  );
  return multiFiles;
}
