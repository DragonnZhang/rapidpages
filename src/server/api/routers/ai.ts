import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env.mjs";
import { generateText } from "ai";
import { getModelByName } from "~/utils/utils";

const model = getModelByName(env.MODEL_NAME);

export const aiRouter = createTRPCRouter({
  generateDescription: publicProcedure
    .input(
      z.object({
        type: z.enum(["element", "action-sequence", "logic"]),
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
          "Descriptions should summarize the user's main operational intent, such as: Form Filling, Product Search, Login Process, Content Editing, Button Clicking, etc.",
          "Descriptions should be within 2-6 words in English, highlighting the core purpose of the operation.",
          "Only return the description text, without any other content.",
        ].join("\n");

        userPrompt = [
          "Please generate a brief description for the following user action sequence:",
          content,
          context ? `Context information: ${context}` : "",
        ].join("\n");
      } else if (type === "logic") {
        systemPrompt = [
          "You are an interaction design expert who needs to generate brief descriptions for interactive logic.",
          "Descriptions should clearly express the trigger condition and behavior result, such as: Form Validation, Show Modal, Toggle Menu, Update Display, etc.",
          "Descriptions should be within 2-6 words in English, highlighting the core purpose of the interaction.",
          "Only return the description text, without any other content.",
        ].join("\n");

        userPrompt = [
          "Please generate a brief description for the following interactive logic:",
          content,
          context ? `Bound element: ${context}` : "",
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
        } else if (type === "action-sequence") {
          return { description: "User Action" };
        } else {
          return { description: "Interactive Logic" };
        }
      }
    }),
});
