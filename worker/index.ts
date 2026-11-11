import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { api } from "./api";
import { auth } from "./auth";
import { dailyRefresh } from "./cron";
import { HttpError, type AppEnv, type Bindings } from "./env";

const app = new Hono<AppEnv>();

app.use("*", secureHeaders());

// CSRF guard: state-changing requests must come from this origin.
app.use("*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin && origin !== new URL(c.req.url).origin) throw new HttpError(403, "Cross-origin request blocked");
  }
  await next();
});

app.route("/auth", auth);
app.route("/api", api);
app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Something went wrong" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(dailyRefresh(env));
  },
} satisfies ExportedHandler<Bindings>;
