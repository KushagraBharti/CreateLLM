"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import Button from "@/components/ui/Button";

type Visibility = "private" | "org_shared" | "public" | "public_full";

export default function SettingsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const viewer = useQuery(api.app.currentViewer, isAuthenticated ? {} : "skip");
  const workspace = useQuery(api.projects.listAccessible, isAuthenticated ? {} : "skip");
  const providerStatus = useQuery(api.settings.getProviderStatus, isAuthenticated ? {} : "skip");
  const saveProviderKeys = useAction(api.settingsActions.saveProviderKeys);
  const updateProviderPolicy = useMutation(api.settings.updateProviderPolicy);
  const createProject = useMutation(api.projects.create);
  const updateVisibility = useMutation(api.projects.updateVisibility);
  const setDefaultProject = useMutation(api.app.setDefaultProject);
  const addMemberByEmail = useMutation(api.projects.addMemberByEmail);
  const requestProjectSummaryExport = useMutation(api.exports.requestProjectSummaryExport);
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [exaApiKey, setExaApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);
  const [projectExportMessage, setProjectExportMessage] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [maxModelsPerRun, setMaxModelsPerRun] = useState(8);
  const [maxConcurrentRuns, setMaxConcurrentRuns] = useState(2);
  const [dailySpendLimitUsd, setDailySpendLimitUsd] = useState("");
  const [monthlySpendLimitUsd, setMonthlySpendLimitUsd] = useState("");
  const [researchEnabled, setResearchEnabled] = useState(true);
  const [hardBlockOnBudget, setHardBlockOnBudget] = useState(true);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectVisibility, setNewProjectVisibility] = useState<Visibility>("private");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"editor" | "viewer">("viewer");
  const [memberOrgRole, setMemberOrgRole] = useState<"admin" | "member">("member");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (viewer?.defaultProjectId && !selectedProjectId) {
      setSelectedProjectId(String(viewer.defaultProjectId));
    }
  }, [selectedProjectId, viewer?.defaultProjectId]);

  const selectedProject = useMemo(() => {
    const organizations = (workspace?.organizations ?? []).filter(Boolean);
    for (const organization of organizations) {
      if (!organization) {
        continue;
      }
      const match = organization.projects.find((project: { id: string }) => project.id === selectedProjectId);
      if (match) {
        return {
          organizationId: organization.id as string,
          organizationName: organization.name as string,
          organizationRole: organization.role as string,
          project: match as {
            id: string;
            name: string;
            visibility: Visibility;
            role: string;
            isDefault: boolean;
          },
        };
      }
    }
    return null;
  }, [selectedProjectId, workspace?.organizations]);

  const projectPolicy = useQuery(
    api.settings.getProjectPolicy,
    isAuthenticated && selectedProjectId ? { projectId: selectedProjectId as never } : "skip",
  );
  const projectMembers = useQuery(
    api.projects.listMembers,
    isAuthenticated && selectedProjectId ? { projectId: selectedProjectId as never } : "skip",
  );
  const projectExports = useQuery(
    api.exports.listByProject,
    isAuthenticated && selectedProjectId ? { projectId: selectedProjectId as never } : "skip",
  );
  const diagnostics = useQuery(
    api.diagnostics.getProjectDiagnostics,
    isAuthenticated && selectedProjectId ? { projectId: selectedProjectId as never } : "skip",
  );

  useEffect(() => {
    if (!projectPolicy) return;
    setMaxModelsPerRun(projectPolicy.maxModelsPerRun);
    setMaxConcurrentRuns(projectPolicy.maxConcurrentRuns);
    setDailySpendLimitUsd(
      typeof projectPolicy.dailySpendLimitUsd === "number" ? String(projectPolicy.dailySpendLimitUsd) : "",
    );
    setMonthlySpendLimitUsd(
      typeof projectPolicy.monthlySpendLimitUsd === "number" ? String(projectPolicy.monthlySpendLimitUsd) : "",
    );
    setResearchEnabled(projectPolicy.researchEnabled);
    setHardBlockOnBudget(projectPolicy.hardBlockOnBudget);
  }, [projectPolicy]);

  if (isLoading) {
    return <div className="max-w-5xl mx-auto px-6 py-10 text-text-muted">Loading settings...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-display text-4xl text-text-primary mb-3">Settings</h1>
        <p className="text-text-secondary mb-6">
          Sign in to store encrypted provider keys and manage workspace policy.
        </p>
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => void signIn("github", { redirectTo: "/settings" })}>
            Sign in with GitHub
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    startTransition(() => {
      void saveProviderKeys({
        openrouterApiKey: openrouterApiKey.trim() || undefined,
        exaApiKey: exaApiKey.trim() || undefined,
      })
        .then(() => {
          setOpenrouterApiKey("");
          setExaApiKey("");
          setMessage("Keys saved.");
        })
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : "Failed to save keys.");
        });
    });
  };

  const handlePolicySubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!projectPolicy) return;
    setPolicyMessage(null);
    startTransition(() => {
      void updateProviderPolicy({
        organizationId: projectPolicy.organizationId,
        projectId: projectPolicy.projectId,
        maxModelsPerRun,
        maxConcurrentRuns,
        dailySpendLimitUsd: dailySpendLimitUsd.trim() ? Number(dailySpendLimitUsd) : undefined,
        monthlySpendLimitUsd: monthlySpendLimitUsd.trim() ? Number(monthlySpendLimitUsd) : undefined,
        researchEnabled,
        hardBlockOnBudget,
      })
        .then(() => setPolicyMessage("Project policy saved."))
        .catch((error) => {
          setPolicyMessage(error instanceof Error ? error.message : "Failed to save project policy.");
        });
    });
  };

  const handleCreateProject = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProject?.organizationId || !newProjectName.trim()) return;
    setWorkspaceMessage(null);
    startTransition(() => {
      void createProject({
        organizationId: selectedProject.organizationId as never,
        name: newProjectName.trim(),
        visibility: newProjectVisibility,
      })
        .then((projectId) => {
          setNewProjectName("");
          setSelectedProjectId(String(projectId));
          setWorkspaceMessage("Project created.");
        })
        .catch((error) => {
          setWorkspaceMessage(error instanceof Error ? error.message : "Failed to create project.");
        });
    });
  };

  const handleSetDefaultProject = () => {
    if (!selectedProjectId) return;
    setWorkspaceMessage(null);
    startTransition(() => {
      void setDefaultProject({ projectId: selectedProjectId as never })
        .then(() => setWorkspaceMessage("Default project updated."))
        .catch((error) => {
          setWorkspaceMessage(error instanceof Error ? error.message : "Failed to update default project.");
        });
    });
  };

  const handleUpdateVisibility = (visibility: Visibility) => {
    if (!selectedProjectId) return;
    setWorkspaceMessage(null);
    startTransition(() => {
      void updateVisibility({ projectId: selectedProjectId as never, visibility })
        .then(() => setWorkspaceMessage("Project visibility updated."))
        .catch((error) => {
          setWorkspaceMessage(error instanceof Error ? error.message : "Failed to update visibility.");
        });
    });
  };

  const handleAddMember = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId || !memberEmail.trim()) return;
    setMemberMessage(null);
    startTransition(() => {
      void addMemberByEmail({
        projectId: selectedProjectId as never,
        email: memberEmail.trim().toLowerCase(),
        role: memberRole,
        organizationRole: memberOrgRole,
      })
        .then(() => {
          setMemberEmail("");
          setMemberMessage("Member updated.");
        })
        .catch((error) => {
          setMemberMessage(error instanceof Error ? error.message : "Failed to update member.");
        });
    });
  };

  const handleProjectExport = (format: "json" | "csv") => {
    if (!selectedProjectId) return;
    setProjectExportMessage(`Queueing ${format.toUpperCase()} project summary export...`);
    startTransition(() => {
      void requestProjectSummaryExport({
        projectId: selectedProjectId as never,
        format,
      })
        .then(() => setProjectExportMessage(`${format.toUpperCase()} project summary export queued.`))
        .catch((error) => {
          setProjectExportMessage(
            error instanceof Error ? error.message : "Failed to queue project summary export.",
          );
        });
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div>
        <Link href="/" className="text-sm text-text-muted hover:text-text-primary transition-colors">
          &larr; Back
        </Link>
        <h1 className="font-display text-4xl text-text-primary mt-3">Workspace Settings</h1>
        <p className="text-text-secondary mt-2">
          NovelBench is bring-your-own-key. Provider secrets are encrypted before storage and only decrypted in Convex actions during execution.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.25fr_0.9fr]">
        <div className="space-y-8">
          <div className="border border-border rounded-xl p-6 space-y-4">
            <div>
              <p className="label mb-1">Viewer</p>
              <p className="text-text-primary">{viewer?.user.name ?? viewer?.user.email ?? "Authenticated user"}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-border/70 p-4">
                <p className="text-text-muted">OpenRouter</p>
                <p className="text-text-primary mt-1">
                  {providerStatus?.openrouterConfigured ? "Configured" : "Missing"}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 p-4">
                <p className="text-text-muted">Exa</p>
                <p className="text-text-primary mt-1">
                  {providerStatus?.exaConfigured ? "Configured" : "Missing"}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border border-border rounded-xl p-6 space-y-5">
            <div>
              <label htmlFor="openrouter" className="label block mb-2">
                OpenRouter API Key
              </label>
              <input
                id="openrouter"
                type="password"
                value={openrouterApiKey}
                onChange={(event) => setOpenrouterApiKey(event.target.value)}
                className="w-full rounded-lg border border-border bg-bg-deep px-4 py-3 text-text-primary outline-none focus:border-accent"
                placeholder="sk-or-v1-..."
              />
            </div>

            <div>
              <label htmlFor="exa" className="label block mb-2">
                Exa API Key
              </label>
              <input
                id="exa"
                type="password"
                value={exaApiKey}
                onChange={(event) => setExaApiKey(event.target.value)}
                className="w-full rounded-lg border border-border bg-bg-deep px-4 py-3 text-text-primary outline-none focus:border-accent"
                placeholder="exa_..."
              />
            </div>

            {message && <p className="text-sm text-text-secondary">{message}</p>}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Keys"}
              </Button>
              <p className="text-sm text-text-muted">Leave a field blank to keep the stored key unchanged.</p>
            </div>
          </form>

          <div className="border border-border rounded-xl p-6 space-y-5">
            <div>
              <p className="label mb-1">Projects</p>
              <p className="text-sm text-text-muted">
                Switch your active project, create new projects, and control visibility.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.1fr_auto]">
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                className="rounded-lg border border-border bg-bg-deep px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
              >
                <option value="">Select a project</option>
                {(workspace?.organizations ?? []).flatMap((organization: any) =>
                  organization.projects.map((project: any) => (
                    <option key={project.id} value={project.id}>
                      {organization.name} / {project.name}
                    </option>
                  )),
                )}
              </select>
              <Button type="button" variant="ghost" onClick={handleSetDefaultProject} disabled={!selectedProjectId || isPending}>
                Make Default
              </Button>
            </div>

            {selectedProject ? (
              <div className="rounded-xl border border-border/70 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-text-primary">{selectedProject.project.name}</p>
                    <p className="text-sm text-text-muted">
                      {selectedProject.organizationName} · {selectedProject.project.role} · {selectedProject.project.visibility}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(["private", "org_shared", "public", "public_full"] as Visibility[]).map((visibility) => (
                      <button
                        key={visibility}
                        type="button"
                        onClick={() => handleUpdateVisibility(visibility)}
                        className={`rounded-md border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors ${
                          selectedProject.project.visibility === visibility
                            ? "border-accent text-accent"
                            : "border-border text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {visibility}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCreateProject} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="New project name"
                    className="rounded-lg border border-border bg-bg-deep px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                  />
                  <select
                    value={newProjectVisibility}
                    onChange={(event) => setNewProjectVisibility(event.target.value as Visibility)}
                    className="rounded-lg border border-border bg-bg-deep px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                  >
                    <option value="private">private</option>
                    <option value="org_shared">org_shared</option>
                    <option value="public">public</option>
                    <option value="public_full">public_full</option>
                  </select>
                  <Button type="submit" disabled={isPending || !newProjectName.trim()}>
                    Create Project
                  </Button>
                </form>
              </div>
            ) : null}

            {workspaceMessage && <p className="text-sm text-text-secondary">{workspaceMessage}</p>}
          </div>

          {projectPolicy && (
            <form onSubmit={handlePolicySubmit} className="border border-border rounded-xl p-6 space-y-5">
              <div>
                <p className="label mb-1">Project Policy</p>
                <p className="text-sm text-text-muted">
                  These limits govern model selection, concurrency, budgets, and Exa-backed research.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="max-models" className="label block mb-2">
                    Max Models Per Run
                  </label>
                  <input
                    id="max-models"
                    type="number"
                    min={2}
                    max={8}
                    value={maxModelsPerRun}
                    onChange={(event) => setMaxModelsPerRun(Number(event.target.value))}
                    className="w-full rounded-lg border border-border bg-bg-deep px-4 py-3 text-text-primary outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="max-concurrency" className="label block mb-2">
                    Max Concurrent Runs
                  </label>
                  <input
                    id="max-concurrency"
                    type="number"
                    min={1}
                    max={8}
                    value={maxConcurrentRuns}
                    onChange={(event) => setMaxConcurrentRuns(Number(event.target.value))}
                    className="w-full rounded-lg border border-border bg-bg-deep px-4 py-3 text-text-primary outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="daily-budget" className="label block mb-2">
                    Daily Spend Limit (USD)
                  </label>
                  <input
                    id="daily-budget"
                    type="number"
                    min={0}
                    step="0.01"
                    value={dailySpendLimitUsd}
                    onChange={(event) => setDailySpendLimitUsd(event.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-deep px-4 py-3 text-text-primary outline-none focus:border-accent"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label htmlFor="monthly-budget" className="label block mb-2">
                    Monthly Spend Limit (USD)
                  </label>
                  <input
                    id="monthly-budget"
                    type="number"
                    min={0}
                    step="0.01"
                    value={monthlySpendLimitUsd}
                    onChange={(event) => setMonthlySpendLimitUsd(event.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-deep px-4 py-3 text-text-primary outline-none focus:border-accent"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={researchEnabled}
                  onChange={(event) => setResearchEnabled(event.target.checked)}
                />
                Enable Exa-backed research in generate and revise
              </label>

              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={hardBlockOnBudget}
                  onChange={(event) => setHardBlockOnBudget(event.target.checked)}
                />
                Hard-block new runs that would exceed budget caps
              </label>

              {policyMessage && <p className="text-sm text-text-secondary">{policyMessage}</p>}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Project Policy"}
                </Button>
              </div>
            </form>
          )}

          {selectedProjectId ? (
            <div className="border border-border rounded-xl p-6 space-y-5">
              <div>
                <p className="label mb-1">Members</p>
                <p className="text-sm text-text-muted">
                  Add existing authenticated users to this project by email.
                </p>
              </div>

              <form onSubmit={handleAddMember} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_140px_auto]">
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="user@example.com"
                  className="rounded-lg border border-border bg-bg-deep px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                />
                <select
                  value={memberRole}
                  onChange={(event) => setMemberRole(event.target.value as "editor" | "viewer")}
                  className="rounded-lg border border-border bg-bg-deep px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                </select>
                <select
                  value={memberOrgRole}
                  onChange={(event) => setMemberOrgRole(event.target.value as "admin" | "member")}
                  className="rounded-lg border border-border bg-bg-deep px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="member">org member</option>
                  <option value="admin">org admin</option>
                </select>
                <Button type="submit" disabled={isPending || !memberEmail.trim()}>
                  Add Member
                </Button>
              </form>

              {memberMessage && <p className="text-sm text-text-secondary">{memberMessage}</p>}

              <div className="space-y-3">
                {(projectMembers ?? []).map((member: any) => (
                  <div key={member.id} className="rounded-xl border border-border/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-text-primary">{member.name ?? member.email ?? "Unknown member"}</p>
                        <p className="text-sm text-text-muted">
                          {member.email ?? "No email"} · project {member.projectRole} · org {member.organizationRole}
                        </p>
                      </div>
                      {member.isCurrentUser ? (
                        <span className="text-xs uppercase tracking-[0.18em] text-text-muted">You</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedProjectId ? (
            <div className="border border-border rounded-xl p-6 space-y-5">
              <div>
                <p className="label mb-1">Project Exports</p>
                <p className="text-sm text-text-muted">
                  Export the current project summary as JSON or CSV.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="ghost" onClick={() => handleProjectExport("json")} disabled={isPending}>
                  Export Project JSON
                </Button>
                <Button type="button" variant="ghost" onClick={() => handleProjectExport("csv")} disabled={isPending}>
                  Export Project CSV
                </Button>
              </div>

              {projectExportMessage ? (
                <p className="text-sm text-text-secondary">{projectExportMessage}</p>
              ) : null}

              <div className="space-y-2">
                {(projectExports ?? []).map((entry: any) => (
                  <div key={entry.id} className="rounded-lg border border-border/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-text-primary">
                          {entry.artifactLabel ?? `Project export ${entry.format.toUpperCase()}`}
                        </p>
                        <p className="text-text-muted">
                          {entry.status} · {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {entry.downloadUrl ? (
                        <a
                          href={entry.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-text-muted hover:text-text-primary transition-colors"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-8">
          <div className="border border-border rounded-xl p-6 space-y-4">
            <div>
              <p className="label mb-1">Diagnostics</p>
              <p className="text-sm text-text-muted">
                Recent run, job, budget, and audit activity for the active project.
              </p>
            </div>

            {diagnostics ? (
              <div className="space-y-5 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/70 p-4">
                    <p className="text-text-muted">Recent Runs</p>
                    <p className="mt-1 text-xl text-text-primary">{diagnostics.recentRuns.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 p-4">
                    <p className="text-text-muted">Tracked Jobs</p>
                    <p className="mt-1 text-xl text-text-primary">{diagnostics.recentJobs.length}</p>
                  </div>
                </div>

                <div>
                  <p className="label mb-2">Budgets</p>
                  <div className="space-y-2">
                    {diagnostics.budgets.map((budget: any) => (
                      <div key={`${budget.period}:${budget.periodKey}`} className="rounded-lg border border-border/70 px-3 py-2">
                        <p className="text-text-primary">
                          {budget.period} {budget.periodKey}
                        </p>
                        <p className="text-text-muted">
                          Reserved ${budget.reservedUsd.toFixed(2)} · Settled ${budget.settledUsd.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="label mb-2">Recent Jobs</p>
                  <div className="space-y-2">
                    {diagnostics.recentJobs.map((job: any) => (
                      <div key={job.id} className="rounded-lg border border-border/70 px-3 py-2">
                        <p className="text-text-primary">
                          {job.jobType} · {job.status}
                        </p>
                        <p className="text-text-muted">
                          attempts {job.attempts}/{job.maxAttempts}
                          {job.lastError ? ` · ${job.lastError}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="label mb-2">Recent Audit Events</p>
                  <div className="space-y-2">
                    {diagnostics.recentAuditLogs.map((entry: any) => (
                      <div key={entry.id} className="rounded-lg border border-border/70 px-3 py-2">
                        <p className="text-text-primary">{entry.action}</p>
                        <p className="text-text-muted">
                          {entry.resourceType}:{entry.resourceId} · {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Loading diagnostics...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
