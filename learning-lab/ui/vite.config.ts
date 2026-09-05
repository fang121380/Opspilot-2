import { defineConfig, type Connect, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

const readOnlyGuard: Connect.NextHandleFunction = (request, response, next) => {
  const raw = request.url ?? "/";
  if (!raw.startsWith("/lab-api") && !raw.startsWith("/opspilot-api")) {
    next();
    return;
  }
  const [path, query = ""] = raw.split("?");
  const options = new URLSearchParams(query);
  const labQuery = options.get("query") ?? "resources";
  const labAllowed = (path === "/lab-api" || path === "/lab-api/")
    && raw.split("?").length <= 2
    && [...options.keys()].every((key) => key === "query")
    && options.getAll("query").length <= 1
    && ["resources", "events", "nodes", "logs", "context"].includes(labQuery);
  const healthAllowed = path === "/lab-api/health" && !query;
  const opsAllowed = !query && (
    path === "/opspilot-api/health"
    || path === "/opspilot-api/incidents"
    || /^\/opspilot-api\/incidents\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/audit$/i.test(path)
  );
  if (request.method !== "GET" || raw.split("?").length > 2
      || !(labAllowed || healthAllowed || opsAllowed)) {
    response.statusCode = request.method !== "GET" ? 405 : 403;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Allow", "GET");
    response.end(JSON.stringify({
      ok: false,
      error: request.method !== "GET" ? "method_not_allowed" : "route_not_allowed",
      message: "The workbench exposes only its listed read-only GET endpoints.",
    }));
    return;
  }
  next();
};

function readOnlyWorkbenchApi(): Plugin {
  return {
    name: "read-only-workbench-api",
    configureServer(server) { server.middlewares.use(readOnlyGuard); },
    configurePreviewServer(server) { server.middlewares.use(readOnlyGuard); },
  };
}

function localTarget(value: string | undefined, fallback: string): string {
  const target = new URL(value ?? fallback);
  if (target.protocol !== "http:" || target.hostname !== "127.0.0.1"
      || target.username || target.password || target.pathname !== "/"
      || target.search || target.hash) {
    throw new Error("Workbench API targets must be plain HTTP URLs on 127.0.0.1.");
  }
  return target.origin;
}

const proxy: Record<string, ProxyOptions> = {
  "/lab-api": {
    target: localTarget(process.env.LAB_API_TARGET, "http://127.0.0.1:8787"),
    rewrite: (path) => path.replace(/^\/lab-api/, "") || "/",
  },
  "/opspilot-api": {
    target: localTarget(process.env.OPSPILOT_API_TARGET, "http://127.0.0.1:8000"),
    rewrite: (path) => path.replace(/^\/opspilot-api/, "") || "/",
  },
};

export default defineConfig({
  plugins: [react(), readOnlyWorkbenchApi()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
});
