import { useCallback, useRef, useState } from "react";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface McpTool {
  name: string;
  description?: string;
  input_schema?: unknown;
  [key: string]: unknown;
}

interface UseMcpClientOptions {
  defaultServerUrl?: string;
}

const DEFAULT_MCP_URL =
  process.env.NEXT_PUBLIC_MCP_URL ?? "http://localhost:8000/mcp";

export const useMcpClient = (options: UseMcpClientOptions = {}) => {
  const [serverUrl, setServerUrl] = useState(
    options.defaultServerUrl ?? DEFAULT_MCP_URL,
  );
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<Client | null>(null);

  const connect = useCallback(
    async (urlOverride?: string) => {
      const targetUrl = urlOverride ?? serverUrl;

      if (!targetUrl) {
        const missingMsg = "Server URL is required";
        setError(missingMsg);
        throw new Error(missingMsg);
      }

      setIsConnecting(true);
      setError(null);

      try {
        const transport = new StreamableHTTPClientTransport(new URL(targetUrl));
        const client = new Client({
          name: "rapidpages-client",
          version: "1.0.0",
        });

        await client.connect(transport);
        clientRef.current = client;
        setServerUrl(targetUrl);
        setIsConnected(true);

        const toolsList = await client.listTools();
        const formattedTools = toolsList.tools.map((tool) => {
          return {
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema,
          };
        });
        setTools(formattedTools);
        return formattedTools;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsConnected(false);
        setTools([]);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [serverUrl],
  );

  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.close();
      clientRef.current = null;
    }

    setIsConnected(false);
    setTools([]);
    setResult(null);
  }, []);

  const runTool = useCallback(
    async (toolName: string, args: Record<string, unknown> = {}) => {
      if (!clientRef.current) {
        const message = "MCP client is not connected";
        setError(message);
        throw new Error(message);
      }

      setIsRunning(true);
      setError(null);

      try {
        const toolResult = await clientRef.current.callTool({
          name: toolName,
          arguments: args,
        });
        setResult(toolResult);
        return toolResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setResult(`Error: ${message}`);
        throw err;
      } finally {
        setIsRunning(false);
      }
    },
    [],
  );

  return {
    serverUrl,
    setServerUrl,
    isConnected,
    isConnecting,
    isRunning,
    tools,
    result,
    error,
    connect,
    disconnect,
    runTool,
    clientRef,
  };
};
