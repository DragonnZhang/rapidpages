import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { deepseek, createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { env } from "~/env.mjs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 根据 MODEL_NAME 前缀选择合适的模型
export function getModelByName(modelName: string) {
  console.log("🚀 ~ getModelByName ~ modelName:", modelName);
  if (modelName.startsWith("deepseek-")) {
    return deepseek(modelName);

    // 暂时先改成用豆包托管的 DeepSeek，因为速度可能更快
    // return createDeepSeek({
    //   baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    //   apiKey: env.DOUBAO_API_KEY,
    // })(modelName);
  } else if (modelName.startsWith("gpt-")) {
    return createOpenAI({
      baseURL: "https://use.52apikey.cn/v1",
      apiKey: env.OPENAI_API_KEY,
    })(modelName);
  } else if (modelName.startsWith("claude-")) {
    return createOpenAI({
      baseURL: "https://api.mjdjourney.cn/v1",
      apiKey: env.ANTHROPIC_API_KEY,
    })(modelName);
  } else if (modelName.startsWith("gemini-")) {
    return google(modelName);
  } else if (modelName.startsWith("qwen-")) {
    // 还是不行，目前只支持流式输出
    return createOpenAI({
      apiKey: env.DASHSCOPE_API_KEY,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    })(modelName);
  } else if (modelName.startsWith("doubao-")) {
    return createOpenAI({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: env.DOUBAO_API_KEY,
    })(modelName);
  } else {
    // 默认使用 deepseek 作为后备选项
    console.warn(`未知模型前缀: ${modelName}，使用 deepseek-chat 作为默认值`);
    return deepseek("deepseek-chat");
  }
}
