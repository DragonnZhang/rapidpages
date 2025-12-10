# Data Model: Multi-agent UI Testing Loop

本文件描述多智能体 UI 测试闭环在服务端/文档层面使用的核心数据结构（不等同于 Prisma schema，但设计上应便于在需要时落地到数据库）。

## 1. Entities

### 1.1 UserRequirement

表示用户输入的自然语言需求及其结构化解析结果。

```ts
interface UserRequirement {
  id: string;
  rawText: string;             // 用户原始自然语言需求
  createdAt: string;
  parsedGoals: string[];       // 解析出的目标/意图摘要
  keyActions: string[];        // 解析出的关键用户操作或业务路径
  constraints: string[];       // 约束条件（例如品牌要求、交互限制等）
}
```

### 1.2 UiVersion

表示在闭环过程中某一时刻的 UI 状态，对应一组 TSX 文件及其元信息。

```ts
interface UiVersion {
  id: string;
  componentId: string;         // 对应 Component 实体的 ID（Prisma 中已有）
  revisionId?: string;         // 对应 ComponentRevision 的 ID（如有）
  versionIndex: number;        // 在本次迭代会话中的版本序号（0 = 初始生成）
  files: ComponentFile[];      // 复用现有 ComponentFile 结构
  createdAt: string;
  createdBy: "generator" | "optimizer"; // 初次生成或由哪一类 Agent 修改
  sourceFailureTestCaseId?: string;       // 如果是由某个失败用例触发的修改，记录该用例 ID
}
```

> `ComponentFile` 类型在现有 `~/utils/compiler` 中已定义，数据模型层只做引用。

### 1.3 TestCase

表示一条可执行测试用例，覆盖某条用户路径或可用性/边界检查。

```ts
interface TestCaseStep {
  id: string;
  description: string;         // 步骤自然语言描述
  action: string;              // 针对 MCP 工具的抽象动作描述（例如 "click", "input"）
  targetSelector?: string;     // 可选的 UI 目标选择方式（文本/aria-label/CSS 等）
  inputValue?: string;         // 文本输入等所需的值
  expectedOutcome?: string;    // 此步骤级别的预期（用于更细粒度的诊断）
}

export type TestCasePriority = "P0" | "P1" | "P2" | "P3";

export type TestCaseCategory = "core-flow" | "usability" | "edge";

interface TestCase {
  id: string;
  requirementId: string;       // 关联 UserRequirement
  title: string;
  description: string;
  priority: TestCasePriority;  // 与 spec 中优先级策略一致
  category: TestCaseCategory;  // core-flow / usability / edge
  steps: TestCaseStep[];
  expectedResult: string;      // 用例级别预期结果
}
```

### 1.4 TestCaseResult & TestRun

表示单条用例的执行结果与一次完整测试运行。

```ts
export type TestStepStatus = "pending" | "running" | "passed" | "failed" | "skipped";

interface TestStepResult {
  stepId: string;
  status: TestStepStatus;
  message?: string;            // MCP 返回的信息或错误摘要
}

export type TestCaseStatus = "pending" | "running" | "passed" | "failed" | "blocked";

interface TestCaseResult {
  testCaseId: string;
  status: TestCaseStatus;
  stepResults: TestStepResult[];
  failureReason?: string;      // 用例级失败原因总结
  relatedUiVersionId: string;  // 本次执行针对的 UI 版本
}

interface TestRun {
  id: string;
  requirementId: string;
  initialUiVersionId: string;
  createdAt: string;
  status: "running" | "succeeded" | "failed" | "stopped";
  iterations: IterationCycle[];  // 记录每一轮“执行→修改→回归”的信息
}

interface IterationCycle {
  index: number;               // 第几轮迭代（0 = 初始 UI，无修改）
  uiVersionId: string;
  testCaseResults: TestCaseResult[];
  triggeredByTestCaseId?: string; // 若是由某个失败用例触发的迭代
  notes?: string;              // 对本轮迭代的总结
}
```

### 1.5 TestReport

```ts
interface TestReport {
  id: string;
  testRunId: string;
  createdAt: string;
  summary: string;             // 面向用户的整体文字摘要
  stats: {
    totalCases: number;
    passed: number;
    failed: number;
    coreFlowCoverage: number;    // 0-1 之间，代表核心路径覆盖比例
    usabilityCoverage: number;   // 0-1 之间
    edgeCoverage: number;        // 0-1 之间
  };
  failures: Array<{
    testCaseId: string;
    latestStatus: TestCaseStatus;
    lastFailureReason?: string;
  }>;
  iterations: Array<{
    index: number;
    uiVersionId: string;
    changesSummary: string;    // Optimizer 对 UI 所做修改的摘要
  }>;
}
```

## 2. Relationships

- 一个 `UserRequirement` 可以对应多个 `TestRun`（用户多次触发闭环）。
- 一个 `TestRun` 由一系列 `IterationCycle` 组成，每个 `IterationCycle` 绑定一个 `UiVersion`；
- `TestCase` 集合在一次 `TestRun` 中会被串行执行，对应一组 `TestCaseResult`；
- `TestReport` 总结一个 `TestRun` 的结果，可供前端展示和后续分析。

## 3. Notes / Implementation Hints

- 首版可以只在内存或 JSON 中维护这些结构，而不必立即映射到数据库；后续若需要落地，可基于现有 Prisma schema 扩展。
- MCP 返回的数据（例如截图、HTML 片段等）可以先通过 `message` 或附加字段与 `TestStepResult` 关联，后续再考虑更完整的存储策略。
