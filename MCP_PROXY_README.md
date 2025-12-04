# MCP Proxy Server

使用 FastMCP 将 stdio 的 MCP 服务转换为 HTTP/SSE 可访问的端点。

## 安装依赖

```bash
pip install fastmcp
```

## 使用方法

### 快速开始

启动默认的 SSE 代理服务器（`mcp-midscene`）：

```bash
python mcp_proxy_server.py
```

这会在 `http://localhost:8000/sse` 启动 SSE 端点。

### 指定服务器

```bash
# 列出可用的 MCP 服务器
python mcp_proxy_server.py --list-servers

# 启动特定服务器的代理
python mcp_proxy_server.py mcp-midscene
```

### 自定义端口和传输协议

```bash
# 使用 HTTP 传输，端口 9000
python mcp_proxy_server.py mcp-midscene --transport http --port 9000

# 绑定到所有网络接口（不安全，仅用于开发）
python mcp_proxy_server.py mcp-midscene --host 0.0.0.0 --port 8000
```

## 访问代理服务器

### 使用 SSE 传输

启动后，在你的 `mcp.json` 中添加：

```json
{
  "mcpServers": {
    "mcp-midscene-http": {
      "type": "sse",
      "url": "http://localhost:8000/sse"
    }
  }
}
```

### 使用 HTTP 传输

```json
{
  "mcpServers": {
    "mcp-midscene-http": {
      "type": "streamable-http",
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

### 使用 curl 测试

```bash
# 获取可用工具列表
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# 调用具体工具
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/call",
    "params":{"name":"your_tool_name","arguments":{}}
  }'
```

## 工作原理

1. **FastMCP Proxy**: 使用 `FastMCP.as_proxy()` 连接到 stdio 进程
2. **协议转换**: 将 stdio 协议转换为 SSE 或 HTTP 传输
3. **HTTP 服务**: 在指定的主机和端口启动 HTTP 服务器
4. **配置驱动**: 从 `mcp-config.json` 读取 MCP 服务器配置

## 配置文件格式

脚本期望 `mcp-config.json` 的格式如下：

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@midscene/mcp"],
      "env": {
        "KEY": "value"
      }
    }
  }
}
```

## 完整工作流示例

### 终端 1：启动代理服务器

```bash
python mcp_proxy_server.py mcp-midscene --transport sse --port 8000
```

输出：

```
Starting proxy server for: mcp-midscene
Transport: sse
Host: 127.0.0.1:8000
SSE endpoint: http://127.0.0.1:8000/sse
```

### 终端 2：通过 HTTP 访问

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### 或在其他应用中使用

创建 `mcp.json`：

```json
{
  "mcpServers": {
    "midscene-proxy": {
      "type": "streamable-http",
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

然后用这个配置连接到代理服务器。

## 故障排除

### 连接失败

确保：

1. 代理服务器正在运行
2. 防火墙允许指定的端口
3. 主机和端口配置正确

### 工具调用失败

1. 检查 MCP 服务器的日志输出
2. 验证环境变量是否正确设置
3. 确保 mcp-config.json 中的命令和参数正确

### 端口被占用

使用 `--port` 参数指定不同的端口：

```bash
python mcp_proxy_server.py mcp-midscene --port 9000
```

## 高级用法

### 多个代理服务器同时运行

```bash
# 终端 1
python mcp_proxy_server.py mcp-midscene --port 8000

# 终端 2
python mcp_proxy_server.py another-server --port 8001
```

### 在生产环境中部署

对于生产环境，建议：

1. 使用 systemd/supervisor 管理进程
2. 使用 nginx/Apache 作为反向代理
3. 启用 HTTPS
4. 添加认证和速率限制

## 参考资源

- [FastMCP 文档](https://gofastmcp.com/)
- [MCP 规范](https://modelcontextprotocol.io/)
- [FastMCP Proxy 模式](https://gofastmcp.com/patterns/proxy)
