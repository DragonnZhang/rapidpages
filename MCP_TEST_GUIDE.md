# MCP 测试功能使用指南

## 功能概述

`McpTestButton` 组件现在支持完整的 MCP (Model Context Protocol) 测试流程:

1. **连接 MCP Server** - 连接到本地或远程 MCP 服务器
2. **读取提示词** - 从 `prompt.txt` 文件读取测试提示词
3. **AI 决策** - 使用大模型分析提示词并决定调用哪个工具
4. **执行工具** - 自动执行 AI 选择的工具并显示结果

## 使用方法

### 1. 启动 MCP Server

确保你的 MCP 代理服务器正在运行:

```bash
python mcp_proxy_server.py
```

默认地址: `http://localhost:8000/mcp`

### 2. 准备提示词文件

在项目根目录下创建或编辑 `prompt.txt` 文件,写入你想要测试的提示词。例如:

```
请帮我搜索 GitHub 上关于 React 的最新 issues
```

或

```
请创建一个新的 GitHub repository,名字叫 test-repo
```

### 3. 使用测试按钮

1. 点击 **Connect MCP** 按钮连接到 MCP 服务器
2. 连接成功后,会出现 **Run Test** 按钮
3. 点击 **Run Test** 开始测试流程

### 4. 查看结果

测试结果会显示在按钮下方,包括:

- AI 决策选择的工具名称
- 工具执行的参数
- 工具返回的结果

## 工作流程

```
用户点击 Run Test
    ↓
读取 prompt.txt 文件
    ↓
获取可用的 MCP 工具列表
    ↓
调用 AI 模型决策
    ↓
AI 返回工具名称和参数
    ↓
执行选中的工具
    ↓
显示执行结果
```

## 技术实现

### 前端组件 (McpTestButton.tsx)

- 使用 `useMcpClient` hook 管理 MCP 连接
- 使用 tRPC 调用服务端 API
- 状态管理: 连接状态、测试状态、结果展示

### 后端 API (mcp.ts router)

两个主要的 tRPC procedures:

1. **getPromptFile** - 读取 `prompt.txt` 文件内容
2. **decideToolCall** - 调用 AI 模型决策工具调用
   - 输入: 提示词文本 + 可用工具列表
   - 输出: 工具名称 + 参数

### AI 提示词设计

系统提示词要求 AI:

- 分析用户意图
- 从可用工具中选择最合适的
- 返回 JSON 格式: `{"tool": "tool_name", "args": {...}}`
- 如果没有合适的工具: `{"tool": null, "reason": "..."}`

## 示例

### 示例 1: GitHub 搜索

**prompt.txt:**

```
搜索 GitHub 上最近更新的 Next.js issues
```

**AI 决策:**

```json
{
  "tool": "mcp_github_github_search_pull_requests",
  "args": {
    "query": "repo:vercel/next.js is:issue",
    "sort": "updated",
    "order": "desc"
  }
}
```

### 示例 2: 创建文件

**prompt.txt:**

```
在 GitHub 仓库中创建一个 README.md 文件
```

**AI 决策:**

```json
{
  "tool": "mcp_github_github_create_or_update_file",
  "args": {
    "owner": "your-username",
    "repo": "your-repo",
    "path": "README.md",
    "content": "# My Project",
    "message": "Create README",
    "branch": "main"
  }
}
```

## 注意事项

1. **环境变量**: 确保配置了所需的 API keys (OPENAI_API_KEY, MODEL_NAME 等)
2. **MCP Server**: 必须先启动 MCP 代理服务器才能连接
3. **权限**: 某些 GitHub 操作需要适当的认证和权限
4. **提示词**: 提示词应该清晰明确,帮助 AI 做出正确决策

## 故障排除

### 连接失败

- 检查 MCP 服务器是否运行
- 确认服务器地址正确 (默认 `http://localhost:8000/mcp`)

### AI 决策失败

- 检查环境变量是否配置正确
- 查看服务器日志了解错误详情
- 确认提示词清晰明确

### 工具执行失败

- 检查工具参数是否正确
- 确认有必要的权限和认证
- 查看 MCP 服务器日志
