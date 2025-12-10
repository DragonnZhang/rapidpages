# Tasks: Multi-agent UI Testing Loop

**Input**: Design documents from `/specs/002-multi-agent-ui-loop/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 本特性未显式要求 TDD 或单元测试，这里不单独列出测试代码任务；测试主要通过多智能体驱动的端到端 UI 测试闭环完成。

**Organization**: Tasks 按用户故事分组，以支持每个 story 独立实现和验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无依赖冲突）
- **[Story]**: 任务所属用户故事（US1, US2, US3, US4）
- 描述中必须包含精确文件路径

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 为多智能体闭环准备最小的工程地基，确保可以在当前分支上安全开发和运行。

- [ ] T001 在 `specs/002-multi-agent-ui-loop/` 目录审阅 `spec.md`、`plan.md`、`data-model.md`、`contracts/` 和 `quickstart.md`，确认需求与设计已对齐
- [ ] T002 [P] 在 `src/server/api/root.ts` 中确认现有 tRPC 结构，并预留/标注 `multiAgent` 路由挂载位置
- [ ] T003 [P] 在 `src/server/api/routers/` 下创建占位文件 `multiAgent.ts`（仅导出空 router），确保编译通过

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立多智能体 orchestrator 的基础骨架与数据结构，在此之前不得开始任何具体用户故事实现。

**⚠️ CRITICAL**: 未完成本阶段前，不得开始任何 US1–US4 的实现。

- [ ] T004 在 `src/server/api/routers/multiAgent.ts` 中定义基础 tRPC router 结构（`createTRPCRouter` 调用），预留 `startRun`、`getRunStatus`、`getReport` 三个 procedure 名称
- [ ] T005 在 `src/server/api/root.ts` 中注册 `multiAgent` router，并在 `src/utils/api.ts` 中导出 `api.multiAgent` 客户端类型
- [ ] T006 [P] 在 `src/server/api/routers/multiAgent.ts` 中引入 `env`、`getModelByName`、`generateNewComponent`、`reviseComponent`、`mcpRouter` 或 MCP 客户端所需类型，以便后续编排使用
- [ ] T007 [P] 在 `src/server/api/routers/multiAgent.ts` 中按 `data-model.md` 定义 TypeScript 接口/类型（如 `UserRequirement`、`TestRun`、`TestCase`、`TestReport`），并与 `contracts/multi-agent-orchestrator-openapi.md` 对齐
- [ ] T008 在 `src/server/api/routers/multiAgent.ts` 中实现基础的内存存储结构（如 Map 或简单对象）用于保存 `TestRun` 与 `TestReport`，为后续各用户故事共享
- [ ] T009 在 `src/pages/` 下创建新的入口页面文件（如 `multi-agent.tsx`），包含基本布局与通过 `api.multiAgent.startRun` 触发闭环的按钮占位

**Checkpoint**: 多智能体 orchestrator 的路由和数据类型就绪，前端页面可以成功调用 `startRun` 并获得占位响应。

---

## Phase 3: User Story 1 - 一键从需求到可用 UI 闭环 (Priority: P1) 🎯 MVP

**Goal**: 从用户自然语言需求出发，经 orchestrator 依次完成 UI 生成、测试用例生成、串行 UI 测试和报告生成，形成一次完整但最小的闭环。

**Independent Test**: 仅启用 US1 的能力时，用户在新页面输入需求并点击“生成并测试”，系统能在 3 轮以内自动完成 UI 生成 + 至少一组核心路径用例的执行，并返回一份包含通过/失败统计和简单总结的报告。

### Implementation for User Story 1

- [ ] T010 [US1] 在 `src/server/api/routers/multiAgent.ts` 的 `startRun` 中实现 `UserRequirement` 创建与初始 `TestRun` 实例化逻辑（生成 `testRunId`、`initialUiVersionId` 占位）
- [ ] T011 [US1] 在 `src/server/api/routers/multiAgent.ts` 中集成 `generateNewComponent`：根据 `requirementText` 生成初始 `UiVersion`（只需返回 `ComponentFile[]` 与 `uiVersionId`，存入内存）
- [ ] T012 [US1] 在 `src/server/api/routers/multiAgent.ts` 中实现“测试用例生成 Agent”函数：基于 `UserRequirement` 和 `UiVersion`，调用 LLM 生成若干 `TestCase`（按 `data-model.md` 结构），暂存到对应 `TestRun`
- [ ] T013 [US1] 在 `src/server/api/routers/multiAgent.ts` 中实现 Evaluator 基础流程：串行遍历 `TestCase[]`，为每条用例构建对 MCP 的任务提示，并调用现有 `mcpRouter.agentLoop` 或 MCP 客户端完成 UI 操作
- [ ] T014 [US1] 在 Evaluator 中根据 MCP 返回结果填充 `TestCaseResult` 与 `IterationCycle`（第 0 轮，仅初始 UI），并统计通过/失败用例
- [ ] T015 [US1] 在 `src/server/api/routers/multiAgent.ts` 中实现简单的 `TestReport` 生成逻辑：基于一次执行结果构建 `summary` 与 `stats`，存入内存结构
- [ ] T016 [US1] 在 `src/server/api/routers/multiAgent.ts` 中实现 `getRunStatus`，返回当前 `TestRun` 的 `status`、`currentIterationIndex` 与基础 `timeline` 信息（至少包含 `requirement-parsing`、`ui-generation`、`testcase-generation`、`test-execution`、`report-generation` 阶段）
- [ ] T017 [US1] 在 `src/server/api/routers/multiAgent.ts` 中实现 `getReport`，返回完整的 `TestReport`
- [ ] T018 [P] [US1] 在 `src/pages/multi-agent.tsx` 中实现“需求输入 + 启动按钮 + 运行状态展示”UI，使用 `api.multiAgent.startRun` 和 `api.multiAgent.getRunStatus` 轮询或刷新界面
- [ ] T019 [P] [US1] 在 `src/pages/multi-agent.tsx` 或新建组件（如 `src/components/MultiAgentRunTimeline.tsx`）中使用 `timeline` 渲染基础阶段列表，并在完成后展示 `getReport` 返回的统计信息

**Checkpoint**: 用户可以在 `multi-agent` 页面输入需求并获得一次完整（单轮）的 UI 生成+测试+报告闭环，尚未包含失败驱动迭代逻辑。

---

## Phase 4: User Story 2 - 单个失败用例驱动 UI 迭代 (Priority: P1)

**Goal**: 当某条测试用例失败时，系统自动把失败上下文交给 Optimizer，更新 UI 后对相关用例进行回归测试，单次闭环最多 3 轮迭代。

**Independent Test**: 在仅启用 US2 扩展时，如果某条核心用例被刻意设计为会失败（例如按钮缺失），系统能够：记录失败 → 调用 UI 修改 Agent → 生成新 UiVersion → 对该用例（及必要路径）重新测试 → 在 3 轮内给出“修复成功”或“需要人工介入”的结论。

### Implementation for User Story 2

- [ ] T020 [US2] 在 `src/server/api/routers/multiAgent.ts` 中扩展 Evaluator，将失败的 `TestCaseResult`（包含步骤与 MCP 错误信息）打包为 Optimizer 的输入结构
- [ ] T021 [US2] 在 `src/server/api/routers/multiAgent.ts` 中集成 `reviseComponent`：基于失败用例上下文和当前 `UiVersion.files` 调用 UI 修改 Agent，生成新的 `ComponentFile[]` 并创建后续 `UiVersion`
- [ ] T022 [US2] 在 `src/server/api/routers/multiAgent.ts` 中维护 `IterationCycle[]`：为每次“失败→修改→重测”增加一条迭代记录，并标记 `triggeredByTestCaseId`
- [ ] T023 [US2] 在 Evaluator 中实现按 FR-011 控制的最多 3 轮迭代逻辑：每轮结束后检查整体状态，若仍有关键用例失败且迭代次数未达上限则继续，否则停止并更新 `TestRun.status`
- [ ] T024 [US2] 在回归测试阶段只重跑相关用例：根据触发失败的 `TestCaseId` 及其依赖关系选择需要重新执行的测试集，避免全量重跑
- [ ] T025 [US2] 在 `TestReport` 结构填充每轮迭代的 `changesSummary` 字段（可由 Optimizer 返回的说明文本生成），便于用户理解每次修改内容
- [ ] T026 [P] [US2] 在前端 `multi-agent.tsx` 或 `MultiAgentRunTimeline` 组件中可视化显示各迭代轮次（0~N），包括 UI 版本索引与触发它的失败用例摘要
- [ ] T027 [US2] 在前端报告展示中增加“自动修复历史”区域，列出每轮修复尝试及结果（成功/仍失败/达到上限）

**Checkpoint**: 对单个或少量失败用例，系统能够自动驱动 UI 迭代并重测，在 3 轮内收敛或给出人工介入提示。

---

## Phase 5: User Story 3 - 分阶段可视化查看各 Agent 贡献 (Priority: P2)

**Goal**: 提供清晰的阶段视图和 Agent 贡献可视化，让用户可以从 UI 中理解多智能体在整个闭环中的行为和决策。

**Independent Test**: 即便只开启阶段视图（不增加更多智能体逻辑），用户在一次闭环完成后可以打开“过程视图”，按时间顺序查看各阶段、负责的 Agent 名称和摘要结果。

### Implementation for User Story 3

- [ ] T028 [US3] 在 `src/server/api/routers/multiAgent.ts` 中完善 `timeline` 结构，为每个阶段填充 `startedAt`、`finishedAt` 和 `summary`，涵盖规范中的各阶段（需求解析、UI 生成、测试用例设计、测试执行、结果分析、UI 迭代、报告生成）
- [ ] T029 [P] [US3] 在 `src/components/` 下创建 `MultiAgentRunTimeline.tsx`，以时间线或分组列表形式渲染 `timeline`，支持按阶段展开/折叠摘要
- [ ] T030 [P] [US3] 在 `src/pages/multi-agent.tsx` 中集成 `MultiAgentRunTimeline` 组件，并根据 `getRunStatus` 返回的数据实时更新阶段状态
- [ ] T031 [US3] 在前端为每个阶段标注对应的 Agent 名称（UI Generator、Testcase Planner、Evaluator、Optimizer、Reporter），并使用不同颜色或图标区分
- [ ] T032 [US3] 在报告视图中加入“过程回放”入口，允许用户在闭环完成后重新查看整个阶段序列及关键统计指标

**Checkpoint**: 用户能够通过可视化时间线理解多智能体的协作过程，并在必要时对单次运行进行复盘。

---

## Phase 6: User Story 4 - 针对已有 UI 进行回归与扩展测试 (Priority: P3)

**Goal**: 支持在已有 UI 基础上输入新的业务变更说明，自动生成补充测试用例并完成测试与必要的 UI 迭代。

**Independent Test**: 在已有 Component 上运行本功能时，系统能够识别“原有用例”与“新增用例”，并在新增用例失败时优先对新增需求相关区域进行 UI 修改与重测。

### Implementation for User Story 4

- [ ] T033 [US4] 在 `multiAgent.startRun` 的输入中支持 `componentId`，并在存在该字段时跳过初始 UI 生成逻辑，转而从数据库加载现有 `Component`/`ComponentRevision` 形成初始 `UiVersion`
- [ ] T034 [US4] 在“测试用例生成 Agent”中区分“原有用例”和“新增用例”（例如通过 tag 或命名约定），并在 `TestCase` 中记录分类信息
- [ ] T035 [US4] 在 Evaluator 与 Optimizer 逻辑中优先处理新增用例失败场景，尽量将 UI 修改范围局限在与新增需求相关的部分（可通过在 prompt 中加入限制说明实现）
- [ ] T036 [US4] 在 `TestReport` 中增加对“原有用例 vs 新增用例”执行结果的分组统计，帮助用户快速识别变更影响
- [ ] T037 [P] [US4] 在前端 `multi-agent.tsx` 页面增加从“我的 UI”或现有组件列表中选择 `componentId` 的入口，并在界面上区分“新建场景”和“基于已有 UI 的回归/扩展场景”

**Checkpoint**: 系统可以在已有 UI 上完成基于新增需求的补充测试与局部迭代，而不会破坏原有核心结构。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨用户故事的统一打磨与优化。

- [ ] T038 [P] 在 `specs/002-multi-agent-ui-loop/quickstart.md` 中更新示例代码与说明，使其与最终实现的 API 和 UI 行为保持一致
- [ ] T039 [P] 在 `README.md` 或新增文档中增加“多智能体 UI 测试闭环”简介与入口说明，指向 `multi-agent` 页面
- [ ] T040 在 `src/server/openai.ts` 与 `src/server/api/routers/mcp.ts` 中检查与 orchestrator 的集成点，移除不再使用的调试日志或临时代码
- [ ] T041 对 `src/pages/multi-agent.tsx` 和新建组件进行样式和交互细节打磨（如加载态、错误提示、滚动/布局优化），使用 Tailwind 保持与现有 UI 风格一致
- [ ] T042 [P] 运行 `npm run lint` 并修复与本特性相关的所有 lint 问题
- [ ] T043 检查在多轮迭代中 LLM 调用与 MCP 调用的失败场景，补充必要的错误处理和用户可见提示

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Phase 1 完成，阻塞所有用户故事的实现
- **User Stories (Phase 3–6)**: 均依赖 Phase 2 完成
  - US1、US2 为核心闭环能力，建议按优先级顺序串行实现
  - US3、US4 可在 US1 稳定后并行开展（UI 可视化与已有 UI 回归场景相对独立）
- **Polish (Phase 7)**: 依赖所有目标用户故事完成

### User Story Dependencies

- **User Story 1 (P1)**: 仅依赖 Foundational，构成 MVP 的最小闭环
- **User Story 2 (P1)**: 依赖 US1（需要已有的“单轮执行 + 报告”能力）
- **User Story 3 (P2)**: 依赖 US1/US2 提供的 `timeline` 与报告结构，但可在逻辑上独立实现可视化层
- **User Story 4 (P3)**: 依赖 US1/US2 的核心编排能力，扩展到已有 UI 场景

### Within Each User Story

- 先打通 orchestrator 内部的数据流与状态管理，再完善前端可视化与交互；
- 优先实现“单轮无迭代”的 happy path，再逐步加入自动迭代与边界处理；
- 避免在多个故事中同时大量修改同一文件（如 `multiAgent.ts`），可通过小步提交和分支控制冲突。

### Parallel Opportunities

- 标记为 [P] 的任务可以在不同开发者之间并行：
  - Phase 1–2 中的类型定义、router 注册、前端占位页面搭建可以并行；
  - US1 中前端 UI（T018、T019）与后端核心逻辑（T010–T017）可并行推进；
  - US2–US4 中，前端可视化与后端策略调整也可并行；
- 不同用户故事在完成前序依赖后，可由不同开发者并行负责，确保每个 story 仍然可单独测试与验收。

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational
3. 实现 Phase 3: User Story 1（单轮闭环：需求→UI→测试→报告）
4. 使用代表性需求在前端运行一次完整闭环，人工验证报告质量

### Incremental Delivery

1. 在 MVP 基础上实现 Phase 4 (US2)：加入自动迭代与失败驱动优化
2. 然后实现 Phase 5 (US3)：增强可视化与过程可解释性
3. 最后实现 Phase 6 (US4)：扩展到已有 UI 的回归/扩展测试场景
4. 每个阶段完成后都可独立对外展示和验证，不依赖后续阶段的完成。

### Parallel Team Strategy

- 一名开发者聚焦 `multiAgent` orchestrator 后端实现（Phase 2–4 主体）；
- 另一名开发者聚焦前端 `multi-agent` 页面与时间线/报告可视化（Phase 3、5）；
- 若有第三名开发者，可专注于 US4 的“已有 UI 场景”集成与数据库/Prisma 层的扩展（Phase 6）。
