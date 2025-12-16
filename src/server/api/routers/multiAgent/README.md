# Multi-Agent 模块结构

本目录包含了多智能体测试系统的模块化实现，将不同的职责分离到各自独立的文件中。

## 目录结构

```
multiAgent/
├── types.ts              # 所有类型定义
├── storage.ts            # 内存存储和事件发射器
├── requirementParser.ts  # 需求解析 Agent
├── uiGenerator.ts        # UI 生成 Agent
├── testCaseGenerator.ts  # 测试用例生成 Agent
├── evaluator.ts          # 测试评估 Agent
├── optimizer.ts          # UI 优化 Agent
├── orchestrator.ts       # 主协调器（迭代测试循环）
└── helpers.ts            # 辅助函数（报告生成、状态查询等）
```

## 各模块职责

### types.ts

定义所有数据类型，包括：

- `UserRequirement` - 用户需求
- `UiVersion` - UI 版本
- `TestCase` - 测试用例
- `TestCaseResult` - 测试结果
- `IterationCycle` - 迭代周期
- `TestRun` - 测试运行
- `TestReport` - 测试报告
- `TimelineEvent` - 时间线事件

### storage.ts

管理内存存储：

- `testRunsStore` - 测试运行存储
- `testReportsStore` - 测试报告存储
- `userRequirementsStore` - 用户需求存储
- `uiVersionsStore` - UI 版本存储
- `testCasesStore` - 测试用例存储
- `testCaseStatusStore` - 测试用例状态存储
- `testRunEmitter` - 事件发射器（用于实时更新）

### requirementParser.ts

**需求解析 Agent**

- `parseRequirement()` - 使用 LLM 解析用户需求文本
- 提取目标、关键操作和约束条件

### uiGenerator.ts

**UI 生成 Agent**

- `generateInitialUi()` - 基于需求生成初始 UI
- 调用 `generateNewComponent()` 创建组件文件

### testCaseGenerator.ts

**测试用例生成 Agent**

- `generateTestCases()` - 使用 LLM 生成测试用例
- 支持不同优先级（P0-P3）和类别（core-flow, usability, edge）

### evaluator.ts

**测试评估 Agent**

- `evaluateTestCases()` - 使用 MCP 服务器执行测试
- 实时更新测试状态
- 返回详细的测试结果

### optimizer.ts

**UI 优化 Agent**

- `optimizeUiForFailures()` - 基于失败的测试用例优化 UI
- 使用 `reviseComponent()` 生成改进的代码

### orchestrator.ts

**主协调器**

- `runIterativeTestingLoop()` - 执行迭代测试和优化循环
- 最多 3 轮迭代
- 管理 UI 版本和数据库持久化

### helpers.ts

**辅助函数**

- `buildIterationCycle()` - 构建迭代周期数据
- `generateTestReport()` - 生成测试报告（包含覆盖率统计）
- `getRunStatusInternal()` - 查询测试运行状态
- `updateTimeline()` - 更新时间线事件
- `emitTestRunUpdate()` - 发射实时更新事件

## 主入口文件

`multiAgent.ts` - tRPC 路由定义

- 导入所有模块并提供统一的 API 接口
- 重新导出所有类型供外部使用
- 定义以下端点：
  - `startRun` - 启动多智能体测试
  - `getRunStatus` - 获取运行状态
  - `getReport` - 获取测试报告
  - `getTestCases` - 获取测试用例列表
  - `onTestRunUpdate` - 订阅实时更新

## 工作流程

1. **需求解析**：`parseRequirement()` 分析用户输入
2. **UI 生成**：`generateInitialUi()` 或加载现有组件
3. **测试生成**：`generateTestCases()` 创建测试用例
4. **迭代循环**：`runIterativeTestingLoop()` 执行：
   - 评估：`evaluateTestCases()` 运行测试
   - 优化：`optimizeUiForFailures()` 修复失败
   - 重复最多 3 轮
5. **报告生成**：`generateTestReport()` 汇总结果

## 依赖关系

```
multiAgent.ts (路由)
    ↓
orchestrator.ts (协调器)
    ↓
├── requirementParser.ts
├── uiGenerator.ts
├── testCaseGenerator.ts
├── evaluator.ts
├── optimizer.ts
└── helpers.ts
    ↓
├── types.ts
└── storage.ts
```

## 实时更新机制

系统使用 EventEmitter 实现实时更新：

1. `testRunEmitter` 发射更新事件
2. `emitTestRunUpdate()` 在状态变化时触发
3. tRPC subscription `onTestRunUpdate` 推送给前端
4. 支持并发的多个测试运行（最多 100 个监听器）
