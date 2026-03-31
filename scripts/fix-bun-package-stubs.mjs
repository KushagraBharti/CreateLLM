import { mkdir, mkdtemp, readFile, rm, stat, cp, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const nodeModulesDir = path.join(repoRoot, "node_modules");

const PACKAGE_FIXES = [
  { name: "@swc/helpers", expectedFiles: ["cjs/index.cjs", "cjs/_interop_require_default.cjs"] },
  { name: "react", expectedFiles: ["index.js", "jsx-runtime.js"] },
  { name: "react-dom", expectedFiles: ["index.js", "client.js"] },
  { name: "ws", expectedFiles: ["index.js", "lib/websocket.js"] },
  { name: "prettier", expectedFiles: ["index.cjs", "plugins/typescript.js"] },
  { name: "@convex-dev/auth", expectedFiles: ["dist/server/index.js", "dist/react/index.js"] },
  { name: "@convex-dev/workflow", expectedFiles: ["dist/cjs/client/index.cjs", "dist/cjs/server/index.cjs"] },
  { name: "@convex-dev/workpool", expectedFiles: ["dist/cjs/client/index.cjs", "dist/cjs/server/index.cjs"] },
  { name: "convex-helpers", expectedFiles: ["index.js", "validators.js"], version: "0.1.114" },
  { name: "async-channel", expectedFiles: ["lib/index.js"], version: "0.2.0" },
  { name: "cookie", expectedFiles: ["dist/index.js"], version: "1.0.1" },
  { name: "@oslojs/crypto", expectedFiles: ["dist/random/index.js", "dist/sha2/index.js"] },
  { name: "@oslojs/binary", expectedFiles: ["dist/index.js"], version: "1.0.0" },
  { name: "@oslojs/encoding", expectedFiles: ["dist/index.js"] },
  { name: "oauth4webapi", expectedFiles: ["build/index.js"] },
  { name: "jose", expectedFiles: ["dist/browser/index.js"] },
  { name: "@panva/hkdf", expectedFiles: ["dist/web/index.js"] },
  { name: "@auth/core", expectedFiles: ["index.js", "jwt.js"] },
  { name: "tslib", expectedFiles: ["tslib.js"] },
];

function packageDir(name) {
  return path.join(nodeModulesDir, ...name.split("/"));
}

function tarballName(name, version) {
  const base = name.startsWith("@") ? name.split("/")[1] : name;
  return `${base}-${version}.tgz`;
}

function registryUrl(name, version) {
  const encoded = name.startsWith("@")
    ? `${encodeURIComponent(name.split("/")[0])}%2f${name.split("/")[1]}`
    : name;
  return `https://registry.npmjs.org/${encoded}/-/${tarballName(name, version)}`;
}

function registryMetadataUrl(name, tag = "latest") {
  const encoded = name.startsWith("@")
    ? `${encodeURIComponent(name.split("/")[0])}%2f${name.split("/")[1]}`
    : name;
  return `https://registry.npmjs.org/${encoded}/${tag}`;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function shouldRepair(dir, expectedFiles) {
  if (!(await exists(path.join(dir, "package.json")))) {
    return true;
  }
  for (const relativeFile of expectedFiles) {
    if (!(await exists(path.join(dir, relativeFile)))) {
      return true;
    }
  }
  return false;
}

async function fetchTarball(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
}

async function fetchLatestVersion(name) {
  const response = await fetch(registryMetadataUrl(name));
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for ${name}: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  return payload.version;
}

async function repairPackage(name, expectedFiles, fallbackVersion) {
  const dir = packageDir(name);
  if (!(await shouldRepair(dir, expectedFiles))) {
    return false;
  }

  const packageJsonPath = path.join(dir, "package.json");
  const packageJson = (await exists(packageJsonPath))
    ? JSON.parse(await readFile(packageJsonPath, "utf8"))
    : null;
  const version = packageJson?.version ?? fallbackVersion ?? (await fetchLatestVersion(name));
  if (!version) {
    throw new Error(`Missing version for ${name}`);
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bun-stub-fix-"));
  const tgzPath = path.join(tempRoot, tarballName(name, version));
  const extractDir = path.join(tempRoot, "extract");
  await mkdir(extractDir, { recursive: true });

  try {
    await fetchTarball(registryUrl(name, version), tgzPath);
    await execFileAsync("tar", ["-xzf", tgzPath, "-C", extractDir]);

    const unpackedDir = path.join(extractDir, "package");
    const targetParent = path.dirname(dir);
    await rm(dir, { recursive: true, force: true });
    await mkdir(targetParent, { recursive: true });
    await cp(unpackedDir, dir, { recursive: true, force: true });
    return true;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const repaired = [];
  for (const entry of PACKAGE_FIXES) {
    const didRepair = await repairPackage(entry.name, entry.expectedFiles, entry.version);
    if (didRepair) {
      repaired.push(entry.name);
    }
  }

  if (repaired.length > 0) {
    console.log(`[fix-bun-package-stubs] Repaired ${repaired.length} package(s): ${repaired.join(", ")}`);
  }
}

await main();
