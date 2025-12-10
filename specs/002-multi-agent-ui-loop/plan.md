# Implementation Plan: Multi-agent UI Testing Loop

**Branch**: `002-multi-agent-ui-loop` | **Date**: 2025-12-10 | **Spec**: `specs/002-multi-agent-ui-loop/spec.md`
**Input**: Feature specification from `/specs/002-multi-agent-ui-loop/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

基于 `Multi-agent UI Testing Loop` 规范，本特性要在现有 Rapidpages（Next.js 13 + tRPC + MCP UI 测试能力 + openai.ts UI 生成/修改）之上，引入一个多智能体编排层，形成从“自然语言需求 → UI 生成 → 测试用例设计 → UI 测试（Evaluator）→ 失败驱动 UI 迭代（Optimizer）→ 测试报告”的顺序闭环。技术上不新增独立服务，而是：

- 在服务端（tRPC + MCP）实现一个 Orchestrator（多 Agent 编排器），以 Evaluator-Optimizer 模式驱动现有 `generateNewComponent/ reviseComponent` 与 `mcpRouter.agentLoop`；
- 把“测试用例生成 Agent”“结果分析 Agent”“报告生成 Agent”等都实现为同一模型上的不同 System Prompt + 输入输出约定，保持在一个进程内完成多智能体逻辑；
- 在前端保留现有 UI 编辑/预览能力，仅新增一个“多智能体测试闭环”入口与过程可视化视图，使用已有 tRPC 路由返回阶段列表与报告摘要。

## Technical Context

**Language/Version**: TypeScript (Node 18+ / Next.js 13 pages router)  
**Primary Dependencies**: Next.js, tRPC, Prisma/PostgreSQL, `ai` SDK（LLM 调用）, MCP SDK（UI 测试工具层）, Jotai, Tailwind CSS  
**Storage**: PostgreSQL（通过 Prisma 管理 `Component`/`ComponentRevision` 等实体，UI 代码以 JSON `ComponentFile[]` 形式保存）  
**Testing**: 以 `npm run lint` 作为主要检查；多智能体闭环本身以“端到端 UI 行为 + 报告结果”作为验收（通过 MCP 驱动浏览器执行），不单独引入新的测试框架  
**Target Platform**: Vercel/Node Web 环境 + 浏览器端 UI 预览（iframe） + 通过 MCP 连接到真实浏览器实例的 UI 测试  
**Project Type**: Web 应用（单仓，前后端同一 Next.js 项目）  
**Performance Goals**: 单次从“需求到报告”的完整闭环在普通页面上 5 分钟内完成（对应 SC-001），单次测试会话内 UI 迭代轮数上限 3 轮（FR-011）  
**Constraints**: 多智能体逻辑优先保证“有限、可解释、可回放”，不做大规模并发；测试执行串行调度以避免共享 UI 状态冲突；LLM 调用成本需控制在可接受范围（例如每次闭环调用次数可控）  
**Scale/Scope**: 首版聚焦单页面/小型 UI 的多 Agent 闭环，支持 3 轮自动迭代和若干条关键用例；暂不支持跨多个页面/复杂导航结构的全站测试

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

由于当前 `.specify/memory/constitution.md` 仍是模板形态，尚未声明具体的强制原则（例如“Library-first”“CLI-first”等），因此本特性的计划在以下假设下通过初次宪法检查：

- 我们保持“最小惊讶”的工程实践：不拆分新仓库、不创建多进程服务，而是在现有 Next.js + tRPC + MCP 架构内增加一个多智能体编排层；
- 不破坏现有 `generateNewComponent`/`reviseComponent` 与 `mcpRouter.agentLoop` 的对外契约，而是通过新增 Orchestrator 组合这些能力；
- 将多智能体的行为通过文档（`research.md`、`data-model.md`、`contracts/*`、`quickstart.md`）清晰暴露，后续若宪法补充具体要求（例如“必须有 CLI 接口”“必须有契约测试”），可以在不大改本特性前提下增量满足。

当前无显式违反项，允许进入 Phase 0 研究与设计。若后续宪法文件被具体化，本计划需在 Phase 1 完成后再次对照检查，如发现冲突需在 “Complexity Tracking” 中记录理由与替代方案取舍。

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── pages/
│   ├── new.tsx                # 现有 UI 生成入口
│   ├── mcp.tsx                # 现有 MCP UI 测试入口
│   └── ...
├── server/
│   ├── api/
│   │   ├── root.ts
│   │   ├── trpc.ts
│   │   └── routers/
│   │       ├── mcp.ts         # 现有 MCP agentLoop 路由（Evaluator）
│   │       └── [new-orchestrator].ts  # 本特性新增：多智能体编排路由（Evaluator + Optimizer + Planner/Reporter）
│   ├── openai.ts              # 现有 UI 生成/修改能力（Optimizer 实现基础）
│   └── ...
├── components/
│   ├── PageEditor.tsx
│   ├── Chat.tsx
│   └── ...                    # 可能新增一个 MultiAgentRunTimeline / AgentRunPanel
└── utils/
    ├── api.ts                 # tRPC 客户端
    └── ...

specs/
└── 002-multi-agent-ui-loop/
    ├── spec.md
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── quickstart.md
    └── contracts/
```

**Structure Decision**: 基于现有 Next.js 单仓结构，在 `src/server/api/routers` 中新增一个“多智能体编排”路由文件（例如 `multiAgent.ts`），作为 UI 生成 Agent、测试用例生成 Agent、UI 测试 Agent（MCP）、结果分析/报告 Agent 的统一入口；前端在现有页面基础上新增一个多智能体运行入口和过程视图组件，所有实现细节与约定通过 `specs/002-multi-agent-ui-loop` 下的文档进行约束。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None at this time* | N/A | 当前宪法文件尚未具体化，且本特性遵循“尽量复用现有架构、不增加额外服务”的原则，无需额外复杂度豁免 |

> Post-Design Check: Phase 1 完成后再次审视，本特性仍未引入额外仓库/服务或复杂抽象；如未来宪法补充具体强制规则，需在此记录任何例外与理由。
