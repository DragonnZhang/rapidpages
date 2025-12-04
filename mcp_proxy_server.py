import json
import argparse
from pathlib import Path
import uvicorn
from fastmcp import FastMCP
from fastmcp.client.transports import StdioTransport
from fastmcp.server.proxy import ProxyClient

CONFIG_PATH = Path(__file__).parent / "mcp-config.json"

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def build_mcp_proxy(server_name: str = "mcp-midscene"):
    config = load_config()
    
    if server_name not in config.get("mcpServers", {}):
        raise ValueError(f"Server '{server_name}' not found in config")
    
    server_config = config["mcpServers"][server_name]
    
    command = server_config.get("command", "")
    args = server_config.get("args", [])
    env = server_config.get("env", {})
    
    transport = StdioTransport(
        command=command,
        args=args,
        env=env or None
    )

    proxy = FastMCP.as_proxy(
        ProxyClient(transport=transport),
        name=f'MCP Proxy - {server_name}'
    )

    return proxy

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="MCP Proxy Server")
    parser.add_argument("--port", type=int, default=8000, help="Port to run on")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--server", default="mcp-midscene", help="Server name from config")
    args = parser.parse_args()
    
    print(f"Starting MCP Proxy for: {args.server}")
    print(f"Server will be available at: http://{args.host}:{args.port}")
    
    mcp_server = build_mcp_proxy(args.server)
    app = mcp_server.http_app(stateless_http=True)

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
