import { z } from "zod";
import { env } from "~/env.mjs";
import { type Tool, generateText, tool } from "ai";
import { getModelByName } from "~/utils/utils";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const model = getModelByName(env.MODEL_NAME);

/**
 * Execute a single test using MCP agent loop
 * This is a reusable function that can be called from other modules
 */
export async function executeMcpTest(params: {
  testDescription: string;
  testSteps: string[];
  mcpServerUrl: string;
  maxIterations?: number;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  errorType?: string;
  iterations: number;
}> {
  const {
    testDescription,
    testSteps,
    mcpServerUrl,
    maxIterations = 10,
  } = params;

  // Build the test prompt
  const promptText = `${testDescription}

Test Steps:
${testSteps.map((step, idx) => `${idx + 1}. ${step}`).join("\n")}

Execute these steps in order and verify the expected outcomes.`;

  // Initialize MCP client
  const client = new Client(
    {
      name: "rapidpages-test-executor",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl));

  try {
    await client.connect(transport);

    // Get available tools from MCP server
    const toolsResponse = await client.listTools();
    const toolDefinitions = toolsResponse.tools;

    console.log("🔧 [MCP Test] Available tools:", toolDefinitions.length);

    // Build tools array for the AI model
    const aiTools: Record<string, Tool> = {};

    for (const toolDef of toolDefinitions) {
      let parameters: z.ZodType = z.object({});

      if (toolDef.inputSchema) {
        try {
          const schema = toolDef.inputSchema as {
            type?: string;
            properties?: Record<string, unknown>;
            required?: string[];
          };

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

              if (prop.description) {
                zodType = zodType.describe(prop.description);
              }

              if (!schema.required?.includes(key)) {
                zodType = zodType.optional();
              }

              zodShape[key] = zodType;
            }

            parameters = z.object(zodShape);
          }
        } catch (err) {
          console.warn(`Failed to parse schema for tool ${toolDef.name}`, err);
        }
      }

      aiTools[toolDef.name] = tool({
        description: toolDef.description || `Tool: ${toolDef.name}`,
        parameters,
        execute: async (params: unknown) => params,
      });
    }

    // Execute agent loop
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      { role: "user", content: promptText },
    ];

    const systemPrompt = `You are an AI assistant that helps with browser UI testing using tools.

When you need to accomplish a test:
1. Analyze the test steps
2. Call the appropriate tools to complete each step
3. Verify the expected outcomes
4. Continue until all steps are completed OR you encounter a UI issue

CRITICAL - ERROR DETECTION:
- If you attempt the same action 2-3 times and it consistently fails, this is a UI BUG
- If an input field cannot accept text after multiple attempts, this is a UI BUG  
- If a button click has no effect after retrying, this is a UI BUG
- If expected elements are missing or unresponsive, this is a UI BUG

When you detect a UI issue:
1. STOP attempting the failed action immediately
2. Respond with "UI Error:" followed by a clear description

When the test is completed successfully:
- Respond with "Test passed:" followed by a summary

IMPORTANT: Do NOT retry the same failing action more than 2-3 times`;

    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      const aiResponse = await generateText({
        model,
        system: systemPrompt,
        tools: aiTools,
        messages,
        maxTokens: 2000,
      });

      const toolCalls = aiResponse.toolCalls || [];
      const textContent = aiResponse.text || "";

      // Check for completion or error
      if (toolCalls.length === 0) {
        const isTestPassed =
          textContent.toLowerCase().includes("test passed:") ||
          textContent.toLowerCase().includes("测试通过") ||
          textContent.toLowerCase().includes("successfully completed");

        const isUIError =
          textContent.toLowerCase().includes("ui error:") ||
          textContent.toLowerCase().includes("ui 错误:") ||
          textContent.toLowerCase().includes("ui bug");

        if (isTestPassed) {
          await client.close();
          return {
            success: true,
            message: textContent,
            iterations: iteration,
          };
        }

        if (isUIError) {
          await client.close();
          return {
            success: false,
            error: textContent,
            errorType: "UI_ERROR",
            iterations: iteration,
          };
        }

        // Ask AI to continue or complete
        messages.push({
          role: "user",
          content:
            "Please either call the necessary tools to continue, or if the test is complete, respond with 'Test passed:', or if there's a UI issue, respond with 'UI Error:'",
        });
        continue;
      }

      // Add assistant response
      messages.push({
        role: "assistant",
        content: textContent,
      });

      // Execute tool calls via MCP
      for (const toolCall of toolCalls) {
        try {
          const mcpResult = await client.callTool({
            name: toolCall.toolName,
            arguments: toolCall.args,
          });

          messages.push({
            role: "user",
            content: `Tool "${toolCall.toolName}" returned: ${JSON.stringify(
              mcpResult.content,
            )}`,
          });
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          messages.push({
            role: "user",
            content: `Tool "${toolCall.toolName}" failed: ${errorMsg}`,
          });
        }
      }
    }

    // Max iterations reached
    await client.close();
    return {
      success: false,
      error: "Test execution exceeded maximum iterations",
      errorType: "TIMEOUT",
      iterations: iteration,
    };
  } catch (error) {
    await client.close();
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorType: "EXECUTION_ERROR",
      iterations: 0,
    };
  }
}
