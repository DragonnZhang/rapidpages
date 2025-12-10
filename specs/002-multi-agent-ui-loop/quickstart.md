# Quickstart: Multi-agent UI Testing Loop

本向导面向开发者，说明如何在 Rapidpages 中使用和扩展多智能体 UI 测试闭环特性。

## 1. 触发一次多智能体闭环

1. 在前端页面（例如新增的 "Multi-agent Run" 入口）中，调用 tRPC：

   ```ts
   const mutation = api.multiAgent.startRun.useMutation();

   mutation.mutate({
     requirementText: "用户自然语言需求...",
     componentId: existingComponentId, // 可选
   });
   ```

2. 后端 orchestrator 将：
   - 调用 UI 生成 Agent（基于 `generateNewComponent` 或 `reviseComponent`）生成初始 UI；
   - 调用测试用例生成 Agent 根据需求+UI 生成 `TestCase[]`；
   - 通过 MCP 驱动 Evaluator 串行执行用例，失败立即触发 Optimizer 进行 UI 迭代（最多 3 轮）。

## 2. 查看运行过程与结果

1. 前端通过 `multiAgent.getRunStatus` 定期轮询或基于 subscription 获取运行状态：

   ```ts
   const { data } = api.multiAgent.getRunStatus.useQuery({ testRunId });
   ```

2. 使用返回的 `timeline` 渲染阶段视图，例如按阶段显示：
   - 需求解析
   - UI 生成
   - 测试用例设计
   - 测试执行
   - 结果分析
   - UI 迭代
   - 报告生成

3. 运行完成后，通过 `multiAgent.getReport` 获取最终报告并展示通过率、失败/修复历史等信息。

## 3. 扩展或自定义 Agent 行为

- 所有 Agent（UI 生成、测试用例生成、结果分析、报告生成、Optimizer）均通过统一的 LLM 客户端实现，只是 system prompt 不同：
  - 修改相应 prompt，可改变 Agent 行为风格（例如更偏保守的修改策略、更详细的报告）。
- Orchestrator 内部应保持对外契约不变（参见 `contracts/`），以便前端与其他调用方可以稳定依赖。

## 4. 实现注意事项

- 测试用例执行需严格串行，以免在共享 UI 状态下产生干扰；
- 在每轮迭代中，确保把失败用例上下文（包括步骤和 MCP 返回信息）完整地传给 Optimizer，以支持高质量的 UI 修改；
- 控制单次闭环调用 LLM 的次数与 token 量，避免运行成本过高；
- 所有阶段的关键事件应记录到 `timeline` 中，方便前端渲染与调试。
