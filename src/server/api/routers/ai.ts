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
          "You are a frontend development expert who needs to generate brief functional descriptions for HTML elements.",
          "Descriptions should be concise and clear, typically 2-4 word English phrases, such as: Login Button, Search Box, Navigation Bar, User Avatar, etc.",
          "Only return the description text, without any other content.",
        ].join("\n");

        userPrompt = [
          "Please generate a brief functional description for the following HTML element:",
          "```html",
          content,
          "```",
          context ? `Context information: ${context}` : "",
        ].join("\n");
      } else if (type === "action-sequence") {
        systemPrompt = [
          "You are a user experience analysis expert who needs to generate brief descriptions for user action sequences.",
          "Descriptions should summarize the user's main operational intent, such as: Form Filling, Product Search, Login Process, Content Editing, etc.",
          "Descriptions should be within 2-6 words in English, highlighting the core purpose of the operation.",
          "Only return the description text, without any other content.",
        ].join("\n");

        userPrompt = [
          "Please generate a brief description for the following user action sequence:",
          content,
          context ? `Context information: ${context}` : "",
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
          return { description: "Page Element" };
        } else {
          return { description: "User Action" };
        }
      }
    }),
});
