import { BoltIcon, PlayIcon } from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useMcpClient } from "~/hooks/useMcpClient";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { api } from "~/utils/api";

interface McpTestButtonProps {
  className?: string;
}

export const McpTestButton = ({ className }: McpTestButtonProps) => {
  const {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    error,
    tools,
    serverUrl,
  } = useMcpClient();

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState("");

  // tRPC mutations
  const agentLoop = api.mcp.agentLoop.useMutation();

  const handleConnect = useCallback(async () => {
    try {
      if (isConnected) {
        await disconnect();
        toast.success("Disconnected from MCP");
      } else {
        await connect();
        toast.success("MCP ready for testing");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  }, [connect, disconnect, isConnected]);

  const handleTest = useCallback(async () => {
    if (!isConnected) {
      toast.error("Please connect to MCP first");
      return;
    }

    if (!testPrompt.trim()) {
      toast.error("Please enter a test instruction");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // 准备工具列表
      const toolsList = tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? undefined,
        input_schema: tool.input_schema,
      }));

      toast.loading("Running agentic loop...");

      // 调用 agentic loop
      const result = await agentLoop.mutateAsync({
        promptText: testPrompt,
        toolDefinitions: toolsList,
        mcpServerUrl: serverUrl,
        maxIterations: 10,
      });

      if (!result.success) {
        throw new Error(result.error ?? "Agent loop failed");
      }

      // 格式化结果
      const stepsText = result.steps
        ?.map((step, idx) => {
          let text = `Step ${idx + 1}:\n`;
          if (step.reasoning) {
            text += `  Reasoning: ${step.reasoning}\n`;
          }
          if (step.toolCall) {
            text += `  Tool: ${step.toolCall.name}\n`;
            text += `  Args: ${JSON.stringify(step.toolCall.args)}\n`;
          }
          if (step.toolResult) {
            text += `  Result: ${JSON.stringify(step.toolResult.result)}\n`;
          }
          return text;
        })
        .join("\n");

      const resultText = `Completed in ${result.iterations} iterations\n\nFinal Message:\n${result.message}\n\nSteps:\n${stepsText}`;

      setTestResult(resultText);
      toast.success("Test completed successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Test failed: ${message}`);
      setTestResult(`Error: ${message}`);
    } finally {
      setIsTesting(false);
    }
  }, [isConnected, tools, serverUrl, testPrompt, agentLoop]);

  return (
    <div className="flex flex-col gap-3">
      {isConnected && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Test Instruction:
          </label>
          <input
            type="text"
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            placeholder="e.g., Click the login button"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={isTesting}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            void handleConnect();
          }}
          disabled={isConnecting || isTesting}
          variant={isConnected ? "secondary" : "primary"}
          className={className}
        >
          {isConnecting ? (
            <span className="flex items-center gap-2">
              <Spinner />
              <span>Connecting</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <BoltIcon className="h-4 w-4" />
              <span>{isConnected ? "Disconnect" : "Connect MCP"}</span>
            </span>
          )}
        </Button>

        {isConnected && (
          <Button
            onClick={() => {
              void handleTest();
            }}
            disabled={isTesting || isConnecting}
            variant="primary"
            className={className}
          >
            {isTesting ? (
              <span className="flex items-center gap-2">
                <Spinner />
                <span>Testing...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <PlayIcon className="h-4 w-4" />
                <span>Run Test</span>
              </span>
            )}
          </Button>
        )}
      </div>

      {error && !isConnecting && (
        <div className="text-xs text-red-600">{error}</div>
      )}

      {testResult && (
        <div className="mt-2 rounded border border-gray-300 bg-gray-50 p-3">
          <pre className="max-h-64 overflow-auto text-xs">{testResult}</pre>
        </div>
      )}
    </div>
  );
};
