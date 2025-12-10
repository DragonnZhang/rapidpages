# Phase 0 Research: Multi-agent UI Testing Loop

## 1. Unknowns & Clarifications from Technical Context

在本特性中，主要技术未知点已经在 `spec.md` 中通过 FR-011~FR-013 明确：

- 最大 UI 自动迭代轮数：确定为单次闭环最多 3 轮（Q1: A）。
- 测试用例覆盖优先级：确定为“核心业务路径 > 基础可用性/可访问性 > 边缘错误场景”（Q2: A）。
- 品牌一致性 vs 自动修改边界：在测试环境中允许对任何 UI 元素进行自动调整，只需保证可读性与基本可用性，并在结果中说明（Q3: C）。

因此，本阶段研究主要聚焦以下方向：

1. 多智能体编排在单进程 Web 应用中的常见模式（特别是 Evaluator-Optimizer 循环）。
2. 如何在不引入额外服务的前提下，把现有 UI 生成/修改能力（`openai.ts`）与 MCP UI 测试能力（`mcp.ts`）组合成一个可靠的闭环。
3. 如何设计“测试用例生成 Agent”“报告生成 Agent”的输入输出契约，使其既便于扩展，又不对现有代码造成大规模侵入式修改。

## 2. Multi-agent Orchestration Patterns (Evaluator-Optimizer)

### Decision: 单 orchestrator + 多角色 prompt，而不是多个物理服务

**Decision**: 在本项目中采用“单 orchestrator + 多角色 prompt”的模式，即：

- 在服务端新增一个 Orchestrator tRPC 路由（例如 `multiAgent.ts`），作为整个闭环的唯一入口；
- 各个 Agent（UI 生成、测试用例生成、UI 测试/Evaluator、结果分析、报告生成、UI 修改/Optimizer）均通过同一 LLM 客户端（`getModelByName(env.MODEL_NAME)`）+ 不同 system prompt 以及输入/输出 schema 来区分角色；
- 不引入新的进程或服务，而是在现有 Node/Next.js 进程内以顺序编排的方式完成多 Agent 流程。

**Rationale**:

- 当前需求规模集中在“单页面 / 小型 UI”的场景，引入独立 Agent 服务会显著增加部署和调试成本，不符合“尽量简单”的工程原则。
- `openai.ts` 与 `mcp.ts` 已经在本进程内成功使用 `ai` SDK 与 MCP SDK，复用它们可以最大化减少新抽象。
- 使用 prompt 区分角色足以满足“各司其职”的需要，而不会限制未来在需要时抽取为独立服务。

**Alternatives considered**:

- **独立多服务架构**：为 UI 生成、用例生成、测试执行、报告生成分别建立子服务（HTTP/队列），由 orchestrator 调度。放弃原因：项目规模和部署复杂度不匹配，本阶段不需要。
- **MCP 端实现全部智能体逻辑**：将测试用例生成和结果分析逻辑下沉到 MCP 服务器。放弃原因：MCP 目前主要承担“与浏览器交互”的执行层职责，将高层业务逻辑放入 MCP 会削弱前后端分层清晰度。

### Decision: Evaluator 串行执行用例，失败立即反馈 Optimizer

**Decision**: 测试执行 Agent（Evaluator）在单个 UI 版本上串行执行用例，一旦遇到失败：

- 立即将失败用例的上下文（包括步骤、期望、实际行为、MCP 报告）发送给 Optimizer（UI 修改 Agent）。
- Optimizer 完成修改后，仅对受影响的用例（及其依赖的关键路径）进行回归测试，而不是全量重跑。
- 单次闭环中总计“失败 → 修改 → 重测”的轮数最多为 3（与 FR-011 一致），超出后停止自动尝试并输出需要人工介入的报告。

**Rationale**:

- 串行执行可避免在同一 UI 上引入复杂的状态隔离机制，符合当前工程现状。
- 失败立刻反馈能够加快收敛速度，减少无意义的后续用例执行。

**Alternatives considered**:

- **所有用例执行完后再统一反馈给 Optimizer**：会导致 Optimizer 难以“一次性修好”多个相互影响的问题，且更难做逐步可解释的报告。
- **并发执行用例**：在共享 UI 的前提下需要复杂的隔离/重置机制，目前不符合“简单优先”的目标。

## 3. Technology Choices & Best Practices

### 3.1 在 Next.js + tRPC 中放置 orchestrator 的位置

**Decision**: 将多智能体 orchestrator 实现为新的 tRPC 路由（例如 `multiAgentRouter`），放在 `src/server/api/routers/multiAgent.ts` 中，并在 `src/server/api/root.ts` 中注册。

**Rationale**:

- tRPC 已是现有 API 层的统一抽象；新特性应复用这一层而非额外引入 REST/GraphQL。
- 方便前端通过 `api.multiAgent.startRun.useMutation()` 等方式触发闭环运行，并获取阶段化进度和最终报告。

**Alternatives considered**:

- 使用 Next API Route 独立实现 orchestrator：会与现有 tRPC 客户端并行存在，增加前端调用复杂度。

### 3.2 UI 生成/修改与 orchestrator 的集成方式

**Decision**: 通过在 orchestrator 内部直接调用 `generateNewComponent` 与 `reviseComponent`，并约定：

- Orchestrator 负责从数据库加载/保存 `Component` 与 `ComponentRevision`；
- `generateNewComponent` 与 `reviseComponent` 仍只关注多文件 TSX 代码的生成/修改，不关心测试逻辑；
- 由 orchestrator 将最新的 `ComponentFile[]` 编译为预览并暴露给前端查看。

**Rationale**:

- 保持 `openai.ts` 的关注点单一，后续若需要可以在其他场景重用。

**Alternatives considered**:

- 让 `reviseComponent` 直接根据失败用例描述返回“修改后的组件 + 测试建议”；放弃原因：会耦合过多责任在单一函数中，不利于维护。

### 3.3 测试用例与报告的结构化表示

**Decision**: 采用简单的 TypeScript 接口定义测试用例与报告结构（会在 `data-model.md` 与 `/contracts` 中详细列出），包括：

- `TestCase`：id、priority、title、steps、expectedResult、tags（core/usability/edge）。
- `TestRun`：关联 UI 版本、用例列表、执行状态和迭代历史。
- `TestReport`：汇总通过率、失败列表、每次迭代的原因与修复摘要。

**Rationale**:

- 结构化表示便于后续前端渲染阶段视图，以及在需要时存入数据库。

**Alternatives considered**:

- 完全基于自然语言日志：实现简单，但不利于 UI 展示和后续自动分析，且难以与已有数据模型对齐。

## 4. Summary of Key Decisions

- **Orchestrator 形态**: 使用单 tRPC 路由 + 多角色 prompt，而非多进程服务。
- **执行策略**: 测试用例串行执行，失败立即反馈给 Optimizer，单次闭环最多 3 轮自动迭代。
- **优先级策略**: 测试用例覆盖顺序为核心路径 → 可用性/可访问性 → 边缘错误场景。
- **品牌与自动修改**: 在测试环境中允许对任意 UI 元素进行自动调整，只要保持可读性与基本可用性，并在报告中说明。
- **集成点**: Orchestrator 通过 tRPC 暴露，在内部编排 `openai.ts` 与 `mcp.ts` 提供的现有能力，并利用数据模型与契约文件确保各阶段输入输出清晰。
