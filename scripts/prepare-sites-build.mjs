import { copyFile, mkdir, writeFile } from "node:fs/promises";

const worker = `import { handleTranslateRequest } from "./translation-service.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/translate") {
      return handleTranslateRequest(request);
    }
    const response = await env.ASSETS.fetch(request);
    if (
      response.status !== 404 ||
      request.method !== "GET" ||
      !request.headers.get("accept")?.includes("text/html")
    ) {
      return response;
    }

    const indexUrl = new URL("/index.html", request.url);
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
`;

await mkdir("dist/server", { recursive: true });
await writeFile("dist/server/index.js", worker, "utf8");
await copyFile("server/translation-service.mjs", "dist/server/translation-service.mjs");
