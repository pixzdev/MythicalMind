// Agents: reusable personas (system prompt + model defaults). Starting a
// conversation from an agent seeds it with that configuration.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  MessageSquarePlus,
  Sparkles,
  Brain,
  Code2,
  Feather,
  Telescope,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentDTO } from "@/lib/types";
import {
  useAgents,
  useCreateAgent,
  useCreateConversation,
  useDeleteAgent,
  useModels,
  useUpdateAgent,
} from "@/hooks/mythicalmind/queries";
import { useWorkspace } from "@/store/workspace-store";

const ICONS: Record<string, React.ElementType> = {
  sparkles: Sparkles,
  brain: Brain,
  code: Code2,
  feather: Feather,
  telescope: Telescope,
  shield: ShieldCheck,
  bot: Bot,
};

const EMPTY = {
  name: "",
  description: "",
  systemPrompt: "",
  temperature: 0.7,
  providerId: "",
  modelKey: "",
  icon: "sparkles",
};

export function AgentsPage() {
  const { data: agents, isLoading } = useAgents();
  const [editing, setEditing] = useState<AgentDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const openConversation = useWorkspace((s) => s.openConversation);
  const createConversation = useCreateConversation();
  const deleteAgent = useDeleteAgent();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-7">
        <div className="flex flex-wrap items-center gap-3 mb-1.5">
          <h1 className="text-[19px] font-semibold tracking-tight">Agents</h1>
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-8.5 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-3.5" /> New agent
          </Button>
        </div>
        <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">
          Agents are reusable personas: a system prompt plus default model
          settings. Conversations started from an agent inherit its
          instructions — and can still switch models at any time.
        </p>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : (agents ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center">
            <Bot className="size-6 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-[13.5px] text-muted-foreground">No agents yet.</p>
            <p className="text-[12px] text-muted-foreground/60 mt-1">
              Create one to codify the way you like to work with models.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(agents ?? []).map((agent) => {
              const Icon = ICONS[agent.icon] ?? Sparkles;
              return (
                <div
                  key={agent.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.022] p-4.5 flex flex-col gap-3 hover:border-white/12 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] flex-none">
                      <Icon className="size-4 text-[var(--aurora-accent-2)]/85" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-medium truncate">
                        {agent.name}
                      </h3>
                      {agent.description && (
                        <p className="text-[11.5px] text-muted-foreground/75 truncate mt-0.5">
                          {agent.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-0.5 flex-none">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        onClick={() => setEditing(agent)}
                        aria-label={`Edit ${agent.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (window.confirm(`Delete agent “${agent.name}”?`)) {
                            deleteAgent.mutate(agent.id);
                          }
                        }}
                        aria-label={`Delete ${agent.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-[11.5px] text-muted-foreground/65 leading-relaxed line-clamp-3 min-h-[2.6em]">
                    {agent.systemPrompt}
                  </p>

                  <div className="mt-auto flex items-center gap-2.5 text-[11px] text-muted-foreground/60">
                    {agent.modelKey && (
                      <span className="font-mono truncate">{agent.modelKey}</span>
                    )}
                    {agent.temperature != null && (
                      <span className="tabular-nums">temp {agent.temperature.toFixed(1)}</span>
                    )}
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11.5px] border-white/10"
                      onClick={() =>
                        createConversation.mutate(
                          { agentId: agent.id },
                          { onSuccess: (d) => openConversation(d.conversation.id) }
                        )
                      }
                      disabled={createConversation.isPending}
                    >
                      <MessageSquarePlus className="size-3" /> New conversation
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AgentFormDialog
        open={creating}
        onOpenChange={setCreating}
        agent={null}
      />
      <AgentFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => !v && setEditing(null)}
        agent={editing}
      />
    </div>
  );
}

function AgentFormDialog({
  open,
  onOpenChange,
  agent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agent: AgentDTO | null;
}) {
  // remounts the form on close so the next open re-initializes from props
  const [resetKey, setResetKey] = useState(0);
  const handleOpen = (v: boolean) => {
    if (!v) setResetKey((k) => k + 1);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="glass sm:max-w-[520px] rounded-2xl border-white/10 max-h-[88dvh] overflow-y-auto">
        <AgentFormInner
          key={`${resetKey}-${agent?.id ?? "new"}`}
          agent={agent}
          onClose={() => handleOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AgentFormInner({
  agent,
  onClose,
}: {
  agent: AgentDTO | null;
  onClose: () => void;
}) {
  const create = useCreateAgent();
  const update = useUpdateAgent();
  const { data: models } = useModels();
  const [form, setForm] = useState(() =>
    agent
      ? {
          name: agent.name,
          description: agent.description ?? "",
          systemPrompt: agent.systemPrompt,
          temperature: agent.temperature ?? 0.7,
          providerId: agent.providerId ?? "",
          modelKey: agent.modelKey ?? "",
          icon: agent.icon,
        }
      : EMPTY
  );

  const providerModels = (models ?? []).filter(
    (m) => !form.providerId || m.providerId === form.providerId
  );

  const save = () => {
    if (!form.name.trim() || !form.systemPrompt.trim()) {
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      systemPrompt: form.systemPrompt.trim(),
      temperature: form.temperature,
      providerId: form.providerId || null,
      modelKey: form.modelKey || null,
      icon: form.icon,
    };
    if (agent) {
      update.mutate({ id: agent.id, ...payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>{agent ? `Edit ${agent.name}` : "New agent"}</DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            The system prompt is sent as the system message on every request
            in conversations started from this agent.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="grid gap-1.5">
              <Label className="text-[12px]">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Research companion"
                className="h-9 bg-white/[0.03] border-white/10 text-[13.5px]"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px]">Icon</Label>
              <div className="flex gap-1">
                {Object.entries(ICONS).map(([key, Icon]) => (
                  <button
                    key={key}
                    onClick={() => setForm({ ...form, icon: key })}
                    className={cn(
                      "size-9 rounded-lg border flex items-center justify-center transition-colors",
                      form.icon === key
                        ? "border-[var(--aurora-accent)]/50 bg-[var(--aurora-accent)]/15 text-[var(--aurora-accent-2)]"
                        : "border-white/10 text-muted-foreground hover:bg-white/[0.05]"
                    )}
                    aria-label={`Icon ${key}`}
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-[12px]">Description (optional)</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Careful sourcing, structured answers"
              className="h-9 bg-white/[0.03] border-white/10 text-[13.5px]"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-[12px]">System prompt</Label>
            <Textarea
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              placeholder="You are a meticulous research assistant…"
              className="min-h-[130px] bg-white/[0.03] border-white/10 text-[13px] resize-y"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-[12px]">
              Temperature — {form.temperature.toFixed(1)}
            </Label>
            <Slider
              value={[form.temperature]}
              min={0}
              max={1.5}
              step={0.1}
              onValueChange={([v]) => setForm({ ...form, temperature: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-[12px]">Provider (optional)</Label>
              <Select
                value={form.providerId || "any"}
                onValueChange={(v) =>
                  setForm({ ...form, providerId: v === "any" ? "" : v, modelKey: "" })
                }
              >
                <SelectTrigger className="h-9 bg-white/[0.03] border-white/10 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Workspace default</SelectItem>
                  {[...new Set((models ?? []).map((m) => m.providerId))].map((pid) => {
                    const name = (models ?? []).find((m) => m.providerId === pid)?.providerName ?? pid;
                    return (
                      <SelectItem key={pid} value={pid}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px]">Model (optional)</Label>
              <Select
                value={form.modelKey || "any"}
                onValueChange={(v) => setForm({ ...form, modelKey: v === "any" ? "" : v })}
              >
                <SelectTrigger className="h-9 bg-white/[0.03] border-white/10 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Follow conversation</SelectItem>
                  {providerModels.map((m) => (
                    <SelectItem key={m.id} value={m.modelId} className="font-mono text-[12px]">
                      {m.modelId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="h-9">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={!form.name.trim() || !form.systemPrompt.trim() || create.isPending || update.isPending}
            className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
          >
            {agent ? "Save agent" : "Create agent"}
          </Button>
        </DialogFooter>
    </>
  );
}
