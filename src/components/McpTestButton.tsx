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
    runTool,
  } = useMcpClient();

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState("");

  // tRPC mutations
  const decideToolCall = api.mcp.decideToolCall.useMutation();

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
      }));

      // 调用 AI 模型决策需要使用的工具
      const aiResult = await decideToolCall.mutateAsync({
        promptText: testPrompt,
        tools: toolsList,
      });

      if (!aiResult.success) {
        throw new Error(aiResult.error ?? "AI decision failed");
      }

      const decision = aiResult.decision;
      if (!decision) {
        throw new Error("No decision returned from AI");
      }

      if (!decision.tool) {
        const reason = decision.reason ?? "No suitable tool found";
        toast(reason);
        setTestResult(`No tool executed: ${reason}`);
        return;
      }

      // 执行工具
      toast.loading(`Executing tool: ${decision.tool}...`);
      const toolResult = await runTool(decision.tool, decision.args ?? {});

      const resultText =
        typeof toolResult === "string"
          ? toolResult
          : JSON.stringify(toolResult, null, 2);

      setTestResult(`Tool: ${decision.tool}\n\nResult:\n${resultText}`);
      toast.success("Test completed successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Test failed: ${message}`);
      setTestResult(`Error: ${message}`);
    } finally {
      setIsTesting(false);
    }
  }, [isConnected, tools, runTool, testPrompt, decideToolCall]);

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
