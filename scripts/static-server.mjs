import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "packages", "web", "out");
const port = Number(process.env.PORT ?? "4173");
const server = createServer(async (req, res) => {
  try {
    const requestPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    if (relativePath.includes("..") || relativePath.includes("\\") || relativePath.includes("\0")) {
      res.writeHead(400);
      res.end("bad request");
      return;
    }

    const candidates = [
      path.join(root, relativePath),
      path.join(root, relativePath, "index.html"),
      path.join(root, relativePath, "index.htm"),
    ];

    let target = "";
    for (const candidate of candidates) {
      try {
        const info = await stat(candidate);
        if (info.isFile()) {
          target = candidate;
          break;
        }
      } catch {
        // Try the next candidate.
      }
    }

    if (!target) {
      target = path.join(root, "404.html");
      try {
        await stat(target);
      } catch {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("not found");
        return;
      }
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(await readFile(target));
      return;
    }

    const extension = path.extname(target);
    const contentType =
      extension === ".html" ? "text/html; charset=utf-8" :
      extension === ".css" ? "text/css; charset=utf-8" :
      extension === ".js" ? "text/javascript; charset=utf-8" :
      extension === ".json" ? "application/json; charset=utf-8" :
      extension === ".svg" ? "image/svg+xml" :
      "application/octet-stream";

    res.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
    res.end(await readFile(target));
  } catch {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("internal server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write("ORBIT static test server listening on http://127.0.0.1:" + port + "\n");
});
