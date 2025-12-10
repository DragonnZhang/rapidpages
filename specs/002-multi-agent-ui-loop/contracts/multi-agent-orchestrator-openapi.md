# Contracts: Multi-agent Orchestrator (tRPC/OpenAPI Sketch)

> 说明：实际实现基于 tRPC，但本文件用接近 OpenAPI 的方式描述路由契约，便于前后端对齐。

## 1. Start Orchestrated Run

**Endpoint**: `multiAgent.startRun` (tRPC mutation)

**Input**:

```ts
interface StartRunInput {
  requirementText: string;              // 用户自然语言需求
  componentId?: string;                // 可选：基于已有 UI 进行回归/扩展测试
}
```

**Output**:

```ts
interface StartRunOutput {
  testRunId: string;                   // 新建的 TestRun ID
  initialUiVersionId: string;          // 初始 UI 版本 ID
}
```

## 2. Get Run Status & Timeline

**Endpoint**: `multiAgent.getRunStatus` (tRPC query)

**Input**:

```ts
interface GetRunStatusInput {
  testRunId: string;
}
```

**Output**:

```ts
interface GetRunStatusOutput {
  status: "running" | "succeeded" | "failed" | "stopped";
  currentIterationIndex: number;
  maxIterations: number;              // 固定为 3（与 FR-011 一致）
  timeline: Array<{
    phase: "requirement-parsing" | "ui-generation" | "testcase-generation" | "test-execution" | "result-analysis" | "ui-optimization" | "report-generation";
    agent: string;                    // 例如 "UI Generator", "Testcase Planner", "Evaluator", "Optimizer", "Reporter"
    startedAt?: string;
    finishedAt?: string;
    summary?: string;                 // 每个阶段的高层摘要
  }>;
}
```

## 3. Get Final Report

**Endpoint**: `multiAgent.getReport` (tRPC query)

**Input**:

```ts
interface GetReportInput {
  testRunId: string;
}
```

**Output**:

```ts
interface GetReportOutput extends TestReport {}
```

> `TestReport` 类型定义见 `data-model.md`。

---

这些契约为前端提供：

- 启动一次多智能体闭环（`startRun`）；
- 轮询或订阅运行状态与阶段时间线（`getRunStatus`）；
- 在完成后获取详细测试报告（`getReport`）。
