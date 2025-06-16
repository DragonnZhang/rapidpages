import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env.mjs";
import { deepseek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

// 根据 MODEL_NAME 前缀选择合适的模型
function getModelByName(modelName: string) {
  if (modelName.startsWith("deepseek-")) {
    return deepseek(modelName);
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
  } else {
    return deepseek("deepseek-chat");
  }
}

const model = getModelByName(env.MODEL_NAME);

export const aiRouter = createTRPCRouter({
  generateDescription: publicProcedure
    .input(
      z.object({
        type: z.enum(["element", "action-sequence"]),
        content: z.string(),
        context: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { type, content, context } = input;

      let systemPrompt = "";
      let userPrompt = "";

      if (type === "element") {
        systemPrompt = [
          "你是一个前端开发专家，需要为HTML元素生成简短的功能描述。",
          "描述应该简洁明了，通常是2-4个字的中文词组，例如：登录按钮、搜索框、导航栏、用户头像等。",
          "只返回描述文本，不要包含任何其他内容。",
        ].join("\n");

        userPrompt = [
          "请为以下HTML元素生成一个简短的功能描述：",
          "```html",
          content,
          "```",
          context ? `上下文信息：${context}` : "",
        ].join("\n");
      } else if (type === "action-sequence") {
        systemPrompt = [
          "你是一个用户体验分析专家，需要为用户操作序列生成简短的描述。",
          "描述应该概括用户的主要操作意图，例如：填写表单、搜索商品、登录操作、编辑内容等。",
          "描述应该在6-10个字以内，使用中文，突出操作的核心目的。",
          "只返回描述文本，不要包含任何其他内容。",
        ].join("\n");

        userPrompt = [
          "请为以下用户操作序列生成一个简短的描述：",
          content,
          context ? `上下文信息：${context}` : "",
        ].join("\n");
      }

      try {
        const response = await generateText({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          maxTokens: 100,
        });

        return {
          description: response.text.trim(),
        };
      } catch (error) {
        console.error("AI描述生成失败:", error);
        // 返回默认描述
        if (type === "element") {
          return { description: "页面元素" };
        } else {
          return { description: "用户操作" };
        }
      }
    }),
});
