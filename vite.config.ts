import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleTranslateRequest } from "./server/translation-service.mjs";

async function readRequestBody(request: IncomingMessage) {
  let body = "";
  for await (const chunk of request) body += chunk.toString();
  return body;
}

async function serveTranslationRequest(request: IncomingMessage, response: ServerResponse) {
  const headers = new Headers();
  Object.entries(request.headers).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  });
  const method = request.method ?? "GET";
  const apiResponse = await handleTranslateRequest(new Request("http://localhost/api/translate", {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await readRequestBody(request),
  }));
  response.statusCode = apiResponse.status;
  apiResponse.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(await apiResponse.text());
}

function translationApiPlugin(): Plugin {
  return {
    name: "tasko-translation-api",
    configureServer(server) {
      server.middlewares.use("/api/translate", (request, response, next) => {
        void serveTranslationRequest(request, response).catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [translationApiPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
