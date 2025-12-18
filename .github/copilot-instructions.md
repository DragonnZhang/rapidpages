# Rapidpages – Copilot Instructions

Rapidpages is an AI-powered IDE for generating React+Tailwind UI components from natural language. It features multi-agent testing loops, action recording, and in-browser compilation.

## Architecture Overview

**Stack**: Next.js 13 (Pages Router) + tRPC + Prisma (PostgreSQL) + NextAuth (GitHub OAuth)

- **Pages**: `src/pages/**` routes with shared `AppLayout.tsx`; middleware redirects `/` → `/new`
- **Data**: `Component` + `ComponentRevision` tables store UI as JSON `ComponentFile[]` arrays (format: `[{filename, content, isMain}]`)
- **API**: tRPC routers in `src/server/api/routers/`, aggregated in `appRouter`, consumed via `api.*.useMutation()`
- **Auth**: Session-based with `useSession({ required: true })` for protected pages

## Core Data Flow: Prompt → UI → Preview

1. **Input**: `RichTextInput` collects `{text, media}` where `media` can be images, code files, element HTML, action sequences, or interactive logic
2. **Generation**:
   - New: `api.component.createComponent` → `generateNewComponent()` (in `openai.ts`)
   - Revision: `api.component.makeRevision` → `reviseComponent()`
   - Both expect LLM responses like:
     ````tsx
     ```tsx // 文件: ComponentName.tsx (主文件)
     // ...actual component code...
     ```;
     ````
3. **Parsing**: `extractMultipleCodeBlocks()` → `ComponentFile[]`, normalized via `parseCodeToComponentFiles()` before DB writes or rendering
4. **Compilation**: `PageEditor` runs `compileTypescript(files)`:
   - Uses esbuild-wasm (CDN-loaded) + Babel + JIT Tailwind
   - Requires exactly ONE file with `isMain: true` as entrypoint
   - Returns standalone HTML with inlined CSS and UMD React imports

## Multi-Agent Testing System (Branch: `002-multi-agent-ui-loop`)

**Goal**: Automated Evaluator-Optimizer loop for UI validation and iterative fixes

- **Flow**: Requirement parsing → UI generation → Test case design → Test execution → Result analysis → UI optimization (up to 3 cycles)
- **Key files**:
  - `multiAgent.ts`: tRPC router + orchestrator
  - `multiAgent/*.ts`: Individual agents (parser, generator, evaluator, etc.)
  - `storage.ts`: In-memory stores + event emitter for real-time updates
- **Type**: All agents share `TestRun`, `TestCase`, `UiVersion`, `IterationCycle` types
- **Integration**: Uses MCP (Model Context Protocol) for browser automation via `api.mcp.*` procedures

## Action Recording & Element Selection

- **Recording**: `PageEditor` listens to iframe events (click, input, etc.) → creates `ActionRecord` → pushes to `actionHistoryAtom` (Jotai)
- **Timeline**: `ActionTimeline` component displays records and dispatches:
  - `actionSequenceDrop` event: When user drags action(s) to input
  - `elementDrop` event: When selecting element in "selection mode"
- **Consumption**: `RichTextInput` handles these events, converts to media badges, and includes in LLM prompts

**Custom event payloads**:

```typescript
// For elements
{ type: "element", name: string, content: string }

// For action sequences
{ actions: ActionRecord[], id: string }
```

## AI Provider Integration

- **Centralized**: All LLM calls route through `getModelByName(env.MODEL_NAME)` in `utils.ts`
- **Supported**: OpenAI, Anthropic, DeepSeek, Google Gemini, Qwen, Doubao
- **Adding providers**: Extend `getModelByName()` with new AI SDK instances; do NOT scatter API key logic

## Frontend Patterns

- **Layout**: `react-resizable-panels` for split views; `EditorTabs` for multi-file code display
- **State**: Jotai atoms (`actionHistoryAtom`, `interactiveLogicModalAtom`) + local React state; avoid Redux
- **Drag/Drop**: CodePanel items are draggable with `{ type: "code", filename, content }` payload
- **Styling**: Tailwind classes only; use `cn()` helper to merge conditional classes
- **Tables**: `@tanstack/react-table` with `flexRender`; see `my-uis.tsx` for patterns

## Development Workflows

**Setup**:

```bash
npm install
npm run db:push     # Sync Prisma schema without migrations
npm run dev         # Start dev server on :3000
```

**Environment** (see `env.mjs` for validation):

- DB: `DATABASE_URL` (PostgreSQL)
- Auth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXTAUTH_SECRET`
- AI: Keys for OpenAI, Anthropic, DeepSeek, Google, Qwen, Doubao
- Config: `MODEL_NAME` (e.g., "deepseek-V3"), `MCP_SERVER_URL`, `NEXT_PUBLIC_URL`

**Database changes**:

```bash
npx prisma migrate dev   # Create + apply migration
npm run build:production # For deployments (runs migrate deploy)
```

**Quality**: `npm run lint` is the only automated check; no test suite yet

## Critical Constraints & Pitfalls

1. **Code format**: LLM responses MUST match `tsx // 文件: X.tsx (主文件)` exactly; regex parsing is fragile
2. **DB JSON columns**: Always serialize `ComponentFile[]` before saving to `code` field
3. **Main file**: Every `ComponentFile[]` needs exactly one `isMain: true` file for compilation
4. **Event cleanup**: Custom event listeners in `useEffect` must return cleanup functions
5. **SSR hydration**: New tRPC routers must export from `appRouter` and be imported in `_app.tsx` context
6. **esbuild CDN**: Compilation breaks offline; test with `wasmURL` override if needed
7. **Action recording**: Continuous input events are debounced; only final value creates new `ActionRecord`
8. **Iteration limits**: Multi-agent loop caps at 3 cycles to prevent infinite retries

## File Naming Conventions

- Components: PascalCase (e.g., `PageEditor.tsx`)
- Utils/Helpers: camelCase (e.g., `codeTransformer.ts`)
- Types: Shared types live in `src/types/`, router-specific types co-locate with router
- Routers: Noun-based (e.g., `component.ts`, `multiAgent.ts`), NOT verb-based

## Useful Entry Points

- **UI rendering**: [src/components/PageEditor.tsx](src/components/PageEditor.tsx) lines 48-200
- **LLM prompts**: [src/server/openai.ts](src/server/openai.ts) system prompts around L190, L300
- **Type defs**: [src/utils/compiler.ts](src/utils/compiler.ts#L46-L50) for `ComponentFile`, [src/types/multimodal.ts](src/types/multimodal.ts) for media types
- **Multi-agent orchestration**: [src/server/api/routers/multiAgent/orchestrator.ts](src/server/api/routers/multiAgent/orchestrator.ts)
- **DB schema**: [prisma/schema.prisma](prisma/schema.prisma)
