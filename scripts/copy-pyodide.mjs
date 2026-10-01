import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "node_modules", "pyodide");
const targetDir = path.join(root, "public", "pyodide");

if (!fs.existsSync(sourceDir)) {
  console.warn(
    "[copy-pyodide] node_modules/pyodide is missing; skip public/pyodide copy.",
  );
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });

/** Clear previous copies so we never leave stale full-tree leftovers. */
for (const entry of fs.readdirSync(targetDir)) {
  fs.rmSync(path.join(targetDir, entry), { recursive: true, force: true });
}

const required = ["pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

const asmLoader = ["pyodide.asm.mjs", "pyodide.asm.js"].find((name) =>
  fs.existsSync(path.join(sourceDir, name)),
);
const jsLoader = ["pyodide.mjs", "pyodide.js"].find((name) =>
  fs.existsSync(path.join(sourceDir, name)),
);

if (!asmLoader) {
  console.error("[copy-pyodide] Missing pyodide.asm.mjs / pyodide.asm.js");
  process.exit(1);
}
if (!jsLoader) {
  console.error("[copy-pyodide] Missing pyodide.mjs / pyodide.js");
  process.exit(1);
}

const toCopy = [...required, asmLoader, jsLoader];
for (const name of toCopy) {
  const from = path.join(sourceDir, name);
  if (!fs.existsSync(from)) {
    console.error(`[copy-pyodide] Missing required file: ${name}`);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(targetDir, name));
}

console.log(`[copy-pyodide] Copied ${toCopy.join(", ")} -> public/pyodide`);
