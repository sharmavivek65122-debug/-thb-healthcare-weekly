import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(".");
const distDir = path.join(rootDir, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await cp(path.join(rootDir, "index.html"), path.join(distDir, "index.html"));
await cp(path.join(rootDir, "assets"), path.join(distDir, "assets"), { recursive: true });
await cp(path.join(rootDir, "data", "site-manifest.json"), path.join(distDir, "data", "site-manifest.json"), {
  recursive: true
});
await cp(path.join(rootDir, "newsletter", "issues"), path.join(distDir, "newsletter", "issues"), {
  recursive: true
});

console.log(`Static site prepared at ${distDir}`);
