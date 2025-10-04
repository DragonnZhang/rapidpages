# Rapidpages – Copilot Instructions

## System outline

- Next.js 13 "pages" app in `src/pages/**` with shared layouts in `src/components/AppLayout.tsx`; middleware redirects `/` to `/new`.
- Data stack: NextAuth (GitHub OAuth) + Prisma/PostgreSQL (`prisma/schema.prisma`) with `Component` + `ComponentRevision` storing UI code as JSON `ComponentFile[]` blobs.
- API layer is tRPC (`src/server/api/**`); routers are aggregated in `appRouter` and exposed client-side through `src/utils/api.ts` (React Query with superjson).
- Server utilities live under `src/server`; `ssgHelper` wires SSR to tRPC + session, and `env.mjs` enforces typed environment variables.

## AI + data flow

- Prompting happens through `RichTextInput`, which emits `{ text, media }`; `/new` calls `api.component.createComponent` and `/r/[id]` uses `makeRevision`.
- `generateNewComponent` / `reviseComponent` (`src/server/openai.ts`) expect LLM replies formatted as `tsx // 文件: Name.tsx (主文件)` blocks; they merge back into `ComponentFile[]`. Preserve this contract when altering prompts or parsers.
- `parseCodeToComponentFiles` normalizes DB payloads; always run responses through it before feeding renderers.
- `PageEditor` compiles previews via `compileTypescript` (esbuild-wasm + Babel + in-browser Tailwind). Keep files flagged with `isMain` so the entrypoint renders the right component.
- Action capture: iframe listeners push `ActionRecord`s into the Jotai store; `ActionTimeline` dispatches custom events (`actionSequenceDrop`) consumed by `RichTextInput`. Emit the same events if you add new capture sources.
- Element selection mode in `PageEditor` fires `elementDrop` with HTML; `RichTextInput` turns these into badges. Maintain event payload shape `{ type, name, content }`.

## Frontend patterns

- UI panes organized with `react-resizable-panels`, `EditorTabs`, `PagePanel` (iframe canvas), and `CodePanel` (read-only CodeMirror with drag-to-input support). Reuse the drag payload `{ type: "code", filename, content }`.
- State management favors Jotai (`actionHistoryAtom`, `selectedActionIdsAtom`) plus local React state; avoid introducing Redux.
- Toasts via `react-hot-toast`; navigation with Next router or `<Link>`. Auth-guarded views rely on `useSession({ required: true })` as seen in `my-uis.tsx`.
- Table/list UIs use `@tanstack/react-table`; follow `my-uis.tsx` for pagination + flexRender conventions.
- Tailwind is the styling baseline; `cn` (`src/utils/utils.ts`) wraps `clsx` + `tailwind-merge` to merge class names.

## Environment & workflows

- Required env vars: DB + GitHub OAuth + multiple AI keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, etc.) plus `MODEL_NAME` and `NEXT_PUBLIC_URL`; validation fails early via `env.mjs`.
- Local bootstrap: `npm install`, `npm run db:push` to sync Prisma, then `npm run dev`. Production build uses `npm run build:production` (runs `prisma migrate deploy` + `next build`).
- Postinstall runs `prisma generate`; keep schema changes accompanied by migrations (`prisma migrate dev`).
- Linting is the main check (`npm run lint`); there are no packaged unit tests yet.
- `esbuild-wasm` loads from a CDN; offline environments need an alternate `wasmURL` before calling `compileTypescript`.

## Tips & pitfalls

- Respect Prisma JSON columns when mutating components—send serialized arrays to the API, not raw strings.
- When adding AI providers, extend `getModelByName` instead of branching elsewhere; it centralizes base URLs and API keys.
- Preserve SSR hydration by registering new routers inside `appRouter` and exporting them through `src/server/api/routers/*`.
- Custom events binding (`window.addEventListener`) require cleanup inside `useEffect` returns; follow existing patterns to avoid leaks.
- Middleware already handles `/` redirect; avoid duplicating server redirects in page components.
