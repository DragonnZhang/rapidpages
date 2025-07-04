import { componentRouter } from "~/server/api/routers/component";
import { userRouter } from "~/server/api/routers/user";
import { aiRouter } from "~/server/api/routers/ai";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  healthcheck: publicProcedure.query(() => "ok"),
  component: componentRouter,
  user: userRouter,
  ai: aiRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
