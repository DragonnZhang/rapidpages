import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env.mjs";
import { generateText } from "ai";
import { getModelByName } from "~/utils/utils";

const model = getModelByName(env.MODEL_NAME);

export const mcpRouter = createTRPCRouter({
  /**
   * 根据提示词文件决定要调用的 MCP 工具
   */
  decideToolCall: publicProcedure
    .input(
      z.object({
        promptText: z.string(),
        tools: z.array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const { promptText, tools } = input;

      // 准备工具描述给 AI
      const toolsDescription = tools
        .map(
          (tool, idx) =>
            `${idx + 1}. ${tool.name}: ${tool.description ?? "No description"}`,
        )
        .join("\n");

      try {
        const aiResponse = await generateText({
          model,
          messages: [
            {
              role: "system",
              content: `You are an AI assistant that helps with browser UI testing using Midscene tools.

Available tools:
${toolsDescription}

Your task is to analyze the user's test instruction and determine the appropriate Midscene tool to use.

Common testing workflow:
1. For most UI tests, you should first call "mcp_mcp-midscene_midscene_get_tabs" to get information about open browser tabs (this tool requires no arguments, use empty object {})
2. Then based on the test instruction, use appropriate Midscene tools:
   - "mcp_mcp-midscene_midscene_aiTap" - to click elements (requires "locate" parameter with natural language description)
   - "mcp_mcp-midscene_midscene_aiInput" - to input text (requires "locate" and "value" parameters)
   - "mcp_mcp-midscene_midscene_aiAssert" - to verify conditions (requires "assertion" parameter)
   - "mcp_mcp-midscene_midscene_aiScroll" - to scroll the page (requires "direction": "up"/"down"/"left"/"right")
   - "mcp_mcp-midscene_midscene_navigate" - to navigate to a URL (requires "url" parameter)
   - "mcp_mcp-midscene_midscene_screenshot" - to take screenshots (requires "name" parameter)

Respond with a JSON object in this format: {"tool": "tool_name", "args": {...}}
If the instruction is about UI testing, start with getting tabs using: {"tool": "mcp_mcp-midscene_midscene_get_tabs", "args": {}}
If no tool is suitable, respond with: {"tool": null, "reason": "explanation"}

Important: Only respond with the JSON object, nothing else.`,
            },
            {
              role: "user",
              content: `Here is the test instruction:\n${promptText}\n\nWhich tool should I call and with what arguments?`,
            },
          ],
          maxTokens: 1000,
        });

        const aiText = aiResponse.text.trim();
        // eslint-disable-next-line no-console
        console.log("AI Response:", aiText);

        // 解析 AI 响应
        let decision: {
          tool: string | null;
          args?: Record<string, unknown>;
          reason?: string;
        };

        try {
          // 尝试提取 JSON
          const jsonMatch = aiText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            decision = JSON.parse(jsonMatch[0]) as typeof decision;
          } else {
            throw new Error("No JSON found in AI response");
          }
        } catch (parseError) {
          return {
            success: false,
            error: "Failed to parse AI response",
            rawResponse: aiText,
          };
        }

        return {
          success: true,
          decision,
        };
      } catch (error) {
        console.error("AI 决策失败:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
});
