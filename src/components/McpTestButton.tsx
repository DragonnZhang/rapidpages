import { BoltIcon } from "@heroicons/react/24/outline";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useMcpClient } from "~/hooks/useMcpClient";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

interface McpTestButtonProps {
  className?: string;
}

export const McpTestButton = ({ className }: McpTestButtonProps) => {
  const { isConnected, isConnecting, connect, disconnect, error } =
    useMcpClient();

  const handleClick = useCallback(async () => {
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

  return (
    <Button
      onClick={() => {
        void handleClick();
      }}
      disabled={isConnecting}
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
          <span>{isConnected ? "Disconnect MCP" : "Test via MCP"}</span>
        </span>
      )}
      {error && !isConnecting && (
        <span className="ml-2 text-xs text-red-200">{error}</span>
      )}
    </Button>
  );
};
