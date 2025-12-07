import React, { useState } from "react";
import Head from "next/head";
import { ApplicationLayout as AppLayout } from "~/components/AppLayout";
import { Button } from "~/components/Button";
import { Spinner } from "~/components/Spinner";
import { toast } from "react-hot-toast";
import { useMcpClient } from "~/hooks/useMcpClient";

const MCPClientPage = () => {
  const {
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
    runTool: runToolFromHook,
  } = useMcpClient();

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [args, setArgs] = useState("{}");

  const handleConnect = async () => {
    try {
      await connect();
      toast.success("Connected to MCP Server");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to connect: ${errorMsg}`);
    }
  };

  const handleRunTool = async () => {
    if (!selectedTool) return;

    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(args);
      } catch (e) {
        toast.error("Invalid JSON arguments");
        return;
      }

      await runToolFromHook(selectedTool, parsedArgs);
      toast.success("Tool executed");
      // we rely on hook state to set result
    } catch (error: unknown) {
      toast.error("Tool execution failed");
    }
  };

  const hasResult = result !== null && result !== undefined;
  const formattedResult =
    typeof result === "string" ? result : JSON.stringify(result, null, 2);

  return (
    <AppLayout>
      <Head>
        <title>MCP Client - Rapidpages</title>
      </Head>
      <div className="container mx-auto max-w-4xl p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">MCP Client</h1>

        {/* Connection Section */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Server Connection
          </h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value);
              }}
              placeholder="Enter HTTP Endpoint URL (e.g., http://localhost:8000)"
              className="flex-1 rounded border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={isConnected}
            />
            {!isConnected ? (
              <Button onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? (
                  <div className="flex items-center gap-2">
                    <Spinner /> Connecting...
                  </div>
                ) : (
                  "Connect"
                )}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  void disconnect();
                  setSelectedTool(null);
                }}
                variant="secondary"
              >
                Disconnect
              </Button>
            )}
          </div>
          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">
                <strong>Connection Error:</strong> {error}
              </p>
              <p className="mt-2 text-xs text-red-600">
                Make sure your MCP proxy server is running on the correct port
                and the URL is accessible.
              </p>
            </div>
          )}
        </div>

        {/* Tools Section */}
        {isConnected && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Tool List */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:col-span-1">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Available Tools
              </h2>
              <div className="space-y-2">
                {tools.map((tool) => (
                  <button
                    key={tool.name}
                    onClick={() => {
                      setSelectedTool(tool.name);
                    }}
                    className={`w-full rounded px-4 py-2 text-left transition-colors ${
                      selectedTool === tool.name
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <div className="font-medium">{tool.name}</div>
                    <div
                      className={`truncate text-xs ${
                        selectedTool === tool.name
                          ? "text-indigo-200"
                          : "text-gray-500"
                      }`}
                    >
                      {tool.description}
                    </div>
                  </button>
                ))}
                {tools.length === 0 && (
                  <p className="text-gray-500">No tools found.</p>
                )}
              </div>
            </div>

            {/* Tool Execution */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:col-span-2">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                {selectedTool ? `Run: ${selectedTool}` : "Select a Tool"}
              </h2>

              {selectedTool && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Arguments (JSON)
                    </label>
                    <textarea
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                      className="h-40 w-full rounded border border-gray-300 bg-white p-4 font-mono text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <Button
                    onClick={handleRunTool}
                    disabled={isRunning}
                    className="w-full justify-center"
                  >
                    {isRunning ? (
                      <div className="flex items-center gap-2">
                        <Spinner /> Executing...
                      </div>
                    ) : (
                      "Execute Tool"
                    )}
                  </Button>

                  {hasResult && (
                    <div className="mt-6">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Result
                      </label>
                      <pre className="max-h-96 w-full overflow-auto rounded border border-gray-700 bg-gray-900 p-4 font-mono text-sm text-green-400">
                        {formattedResult}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MCPClientPage;
