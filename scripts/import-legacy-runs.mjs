import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.CONVEX_SITE_URL ||
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  process.env.NEXT_PUBLIC_CONVEX_URL;
const secret = process.env.LEGACY_MIGRATION_SECRET;
let ownerUserId = process.env.LEGACY_IMPORT_OWNER_USER_ID;
let organizationId = process.env.LEGACY_IMPORT_ORG_ID;
let projectId = process.env.LEGACY_IMPORT_PROJECT_ID;

if (!baseUrl || !secret) {
  throw new Error(
    "Missing required env: CONVEX_SITE_URL/NEXT_PUBLIC_CONVEX_SITE_URL/NEXT_PUBLIC_CONVEX_URL, LEGACY_MIGRATION_SECRET",
  );
}

const cwd = process.cwd();
const runsDir = path.join(cwd, "data", "runs");
const promptCapturesDir = path.join(cwd, "data", "prompt-captures");

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-migration-secret": secret,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

if (!ownerUserId || !organizationId || !projectId) {
  const target = await postJson(`${baseUrl}/api/migrations/bootstrap-target`, {});
  ownerUserId = target.ownerUserId;
  organizationId = target.organizationId;
  projectId = target.projectId;
  console.log(
    `Bootstrapped import target owner=${ownerUserId} org=${organizationId} project=${projectId}`,
  );
}

const files = (await readdir(runsDir))
  .filter((entry) => entry.endsWith(".json"))
  .sort();

for (const file of files) {
  const legacyRunId = file.replace(/\.json$/, "");
  const runPath = path.join(runsDir, file);
  const promptCapturePath = path.join(promptCapturesDir, `${legacyRunId}.jsonl`);
  const run = JSON.parse(await readFile(runPath, "utf8"));
  let promptCaptureJsonl;
  try {
    promptCaptureJsonl = await readFile(promptCapturePath, "utf8");
  } catch {
    promptCaptureJsonl = undefined;
  }

  const result = await postJson(`${baseUrl}/api/migrations/import-legacy-run`, {
    ownerUserId,
    organizationId,
    projectId,
    legacyRunId,
    run,
    promptCaptureJsonl,
  });

  console.log(`Imported ${legacyRunId} -> ${result.runId}`);
}

await postJson(`${baseUrl}/api/migrations/rebuild-read-models`, {});
console.log(`Rebuilt public read models after importing ${files.length} run(s).`);
