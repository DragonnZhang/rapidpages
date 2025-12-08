import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env.mjs";
import { type Tool, generateText, tool } from "ai";
import { getModelByName } from "~/utils/utils";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const model = getModelByName(env.MODEL_NAME);

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface ToolResult {
  name: string;
  result: unknown;
}

interface AgentLoopStep {
  toolCall: ToolCall | null;
  toolResult: ToolResult | null;
  reasoning: string;
}

export const mcpRouter = createTRPCRouter({
  /**
   * Agentic loop: AI continuously calls tools and processes results
   * until the task is completed using native tool calling
   */
  agentLoop: publicProcedure
    .input(
      z.object({
        promptText: z.string(),
        toolDefinitions: z.array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
            input_schema: z.unknown().optional(),
          }),
        ),
        mcpServerUrl: z.string(), // MCP server URL
      }),
    )
    .mutation(async ({ input }) => {
      const { promptText, toolDefinitions, mcpServerUrl } = input;

      console.log("🚀 ~ toolDefinitions:", toolDefinitions);

      const steps: AgentLoopStep[] = [];

      // Initialize MCP client
      const client = new Client(
        {
          name: "rapidpages-mcp-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      const transport = new StreamableHTTPClientTransport(
        new URL(mcpServerUrl),
      );
      await client.connect(transport);

      // Message history for the agentic loop
      const messages: Array<{ role: "user" | "assistant"; content: string }> = [
        {
          role: "user",
          content: promptText,
        },
      ];

      const systemPrompt = `You are an AI assistant that helps with browser UI testing using tools.

There is no need to navigate to other URL. Just interact with current page.

When you need to accomplish a task:
1. Analyze the user's instruction
2. Call the appropriate tools to complete the task
3. Use the tool results to inform your next steps
4. Continue until the task is completed OR you encounter a UI issue

CRITICAL - ERROR DETECTION:
- If you attempt the same action 2-3 times and it consistently fails, DO NOT retry infinitely
- If an input field cannot accept text after multiple attempts, this is a UI BUG
- If a button click has no effect after retrying, this is a UI BUG
- If expected elements are missing or unresponsive, this is a UI BUG

When you detect a UI issue or bug:
1. STOP attempting the failed action immediately
2. Respond with "UI Error:" followed by a clear description of the problem
3. Include what you were trying to do and what went wrong

When the task is completed successfully:
- Respond with "Task completed:" followed by a summary

IMPORTANT: 
- Do NOT retry the same failing action more than 2-3 times
- Recognize when something is broken and report it immediately
- Both successful completion and error detection should stop tool calling`;

      // Build tools array for the AI model (only once, outside the loop)
      const aiTools: Record<string, Tool> = {};

      for (const toolDef of toolDefinitions) {
        // Convert JSON schema to Zod schema
        let parameters: z.ZodType = z.object({});

        if (toolDef.input_schema) {
          try {
            // Convert MCP JSON Schema to Zod schema
            const schema = toolDef.input_schema as {
              type?: string;
              properties?: Record<string, unknown>;
              required?: string[];
            };

            console.log(
              `📝 Converting schema for tool ${toolDef.name}:`,
              JSON.stringify(schema, null, 2),
            );

            if (schema.type === "object" && schema.properties) {
              const zodShape: Record<string, z.ZodType> = {};

              for (const [key, value] of Object.entries(schema.properties)) {
                const prop = value as {
                  type?: string;
                  description?: string;
                };

                let zodType: z.ZodType = z.any();

                if (prop.type === "string") {
                  zodType = z.string();
                } else if (prop.type === "number") {
                  zodType = z.number();
                } else if (prop.type === "boolean") {
                  zodType = z.boolean();
                } else if (prop.type === "array") {
                  zodType = z.array(z.any());
                } else if (prop.type === "object") {
                  zodType = z.record(z.any());
                }

                // Add description if available
                if (prop.description) {
                  zodType = zodType.describe(prop.description);
                }

                // Check if this property is required
                if (!schema.required?.includes(key)) {
                  zodType = zodType.optional();
                }

                console.log(
                  `  ✅ Parameter "${key}": ${prop.type}${
                    schema.required?.includes(key)
                      ? " (required)"
                      : " (optional)"
                  }`,
                );

                zodShape[key] = zodType;
              }

              parameters = z.object(zodShape);
            } else {
              // Fallback to any for non-object schemas
              parameters = z.any();
            }
          } catch (err) {
            console.warn(
              `Failed to parse schema for tool ${toolDef.name}, using default`,
              err,
            );
          }
        }

        aiTools[toolDef.name] = tool({
          description: toolDef.description || `Tool: ${toolDef.name}`,
          parameters,
          execute: async (params: unknown) => {
            // This will be called by AI SDK, but we need to call MCP
            return params;
          },
        });
      }

      try {
        let iteration = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          iteration++;
          // eslint-disable-next-line no-console
          console.log(`\n=== Agent Loop Iteration ${iteration} ===`);

          // Call AI with tools
          const aiResponse = await generateText({
            model,
            system: systemPrompt,
            tools: aiTools,
            messages,
            maxTokens: 2000,
          });

          // eslint-disable-next-line no-console
          console.log("AI Response:", aiResponse);

          // Check if the model called any tools
          const toolCalls = aiResponse.toolCalls || [];
          const textContent = aiResponse.text || "";

          // eslint-disable-next-line no-console
          console.log(`Tool calls: ${toolCalls.length}, Text: ${textContent}`);

          // If no tool calls, check if task is complete
          if (toolCalls.length === 0) {
            const step: AgentLoopStep = {
              toolCall: null,
              toolResult: null,
              reasoning: textContent,
            };
            steps.push(step);

            // Check if AI indicates task completion
            const isTaskComplete =
              textContent.toLowerCase().includes("task completed") ||
              textContent.toLowerCase().includes("任务完成") ||
              textContent.toLowerCase().includes("successfully completed") ||
              textContent.toLowerCase().includes("已完成");

            // Check if AI detected a UI error
            const isUIError =
              textContent.toLowerCase().includes("ui error:") ||
              textContent.toLowerCase().includes("ui 错误:") ||
              textContent.toLowerCase().includes("ui bug") ||
              textContent.toLowerCase().includes("界面错误");

            if (isTaskComplete) {
              // eslint-disable-next-line no-console
              console.log("Task completed by AI. Final response:", textContent);

              await client.close();

              return {
                success: true,
                message: textContent,
                steps,
                iterations: iteration,
              };
            }

            if (isUIError) {
              // eslint-disable-next-line no-console
              console.log("UI Error detected by AI:", textContent);

              await client.close();

              return {
                success: false,
                error: textContent,
                errorType: "UI_ERROR",
                steps,
                iterations: iteration,
              };
            }

            // If AI just provided reasoning without tools and without completion signal,
            // ask it to either use tools or confirm completion
            messages.push({
              role: "user",
              content:
                "Please either call the necessary tools to continue the task, or if the task is complete, provide a summary starting with 'Task completed:', or if you encountered a UI issue, report it starting with 'UI Error:'",
            });

            continue;
          }

          // Add assistant response to messages
          messages.push({
            role: "assistant",
            content: textContent,
          });

          // Process tool calls - actually call MCP tools
          for (const toolCall of toolCalls) {
            const step: AgentLoopStep = {
              toolCall: {
                name: toolCall.toolName,
                args: (toolCall.args as Record<string, unknown>) || {},
              },
              toolResult: null,
              reasoning: "",
            };

            try {
              // eslint-disable-next-line no-console
              console.log(
                `Calling MCP tool: ${toolCall.toolName} with args:`,
                toolCall.args,
              );

              // Actually call the MCP tool
              const mcpResult = await client.callTool({
                name: toolCall.toolName,
                arguments: toolCall.args,
              });

              // eslint-disable-next-line no-console
              console.log(`MCP tool ${toolCall.toolName} result:`, mcpResult);

              step.toolResult = {
                name: toolCall.toolName,
                result: mcpResult.content,
              };

              // Add tool result to messages
              messages.push({
                role: "user",
                content: `Tool "${
                  toolCall.toolName
                }" returned: ${JSON.stringify(mcpResult.content)}`,
              });
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);

              // eslint-disable-next-line no-console
              console.error(
                `MCP tool ${toolCall.toolName} execution failed:`,
                errorMsg,
              );

              // Add error to messages
              messages.push({
                role: "user",
                content: `Tool "${toolCall.toolName}" failed with error: ${errorMsg}`,
              });
            }

            steps.push(step);
          }
        }
      } catch (error) {
        console.error("Agent Loop Failed:", error);
        await client.close();

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          steps,
        };
      }
    }),
});
