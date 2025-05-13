import OpenAI from "openai";
import { env } from "~/env.mjs";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: "https://use.52apikey.cn/v1",
});
const openaiModelName = "gpt-4o";

const extractFirstCodeBlock = (input: string) => {
  const pattern = /```(\w+)?\n([\s\S]+?)\n```/g;
  let matches;
  while ((matches = pattern.exec(input)) !== null) {
    const language = matches[1];
    const codeBlock = matches[2];
    if (language === undefined || language === "tsx" || language === "json") {
      return codeBlock as string;
    }
  }

  throw new Error("No code block found in input");
};

export async function reviseComponent(prompt: string, code: string) {
  const completion = await openai.chat.completions.create({
    model: openaiModelName,
    messages: [
      {
        role: "system",
        content: [
          "你是一位资深的 React 前端开发专家，擅长创建复杂精美的用户界面。",
          "你需要对一个使用 TypeScript 和 Tailwind CSS 的 React 组件进行修改和优化。",
          "请严格遵循用户的需求，一字不差地执行修改要求。",
          "不要引入新的组件或文件，所有修改都应该在现有组件内完成。",
          "修改时请重点关注以下几点：",
          "1. UI 复杂度：添加更多精美的 UI 元素，使界面更加丰富多样",
          "2. 视觉层次：创建清晰的视觉层次结构和精心设计的布局",
          "3. 细节完善：添加阴影、过渡、动画等精细的设计元素",
          "4. 交互丰富：增加更多的交互元素和用户反馈",
          "5. 功能完整：确保实现所有必要的界面功能",
          "首先逐步思考需要的修改，然后提供一个具有高度复杂性和视觉吸引力的完整实现。",
          "回复时只提供修改后的完整组件代码，放在代码块中。",
          "修改后的代码应该是可以直接使用的完整 React 组件。",
          `以下是需要修改的当前代码：\n\`\`\`tsx\n${code}\n\`\`\``,
        ].join("\n"),
      },
      {
        role: "user",
        content: `${prompt}`,
      },
    ],
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 4096,
    n: 1,
  });

  const choices = completion.choices;

  if (
    !choices ||
    choices.length === 0 ||
    !choices[0] ||
    !choices[0].message ||
    !choices[0].message.content
  ) {
    throw new Error("No choices returned from OpenAI");
  }

  const response = choices[0].message.content;
  console.log("🚀 ~ reviseComponent ~ response:", response);

  let newCode;
  try {
    newCode = extractFirstCodeBlock(response);
  } catch (error) {
    newCode = response;
  }

  console.log("🚀 ~ reviseComponent ~ newCode:", newCode);

  return newCode;
}

export async function generateNewComponent(prompt: string) {
  const completion = await openai.chat.completions.create({
    model: openaiModelName,
    messages: [
      {
        role: "system",
        content: [
          "你是一位专业的前端开发专家，擅长创建功能丰富、交互完善的 React 组件。",
          "你的任务是编写一个使用 TypeScript 和 Tailwind CSS 的完整 React 组件，该组件应该具有真实应用的复杂度和功能性。",
          "组件应该包含适当的交互元素、状态管理、合理的数据结构和布局。",
          "生成的代码应该是可工作的，结构良好，并且符合最佳实践。",
          "只导入 React 作为依赖。",
          "只回复代码，不要有其他解释。",
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
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 4096,
    n: 1,
  });

  const choices = completion.choices;

  if (!choices || choices.length === 0 || !choices[0] || !choices[0].message) {
    throw new Error("No choices returned from OpenAI");
  }

  let result = choices[0].message.content || "";
  console.log("🚀 ~ generateNewComponent ~ result:", result);
  result = extractFirstCodeBlock(result);

  return result;
}
