// Providers: connection management. Add any OpenAI-compatible endpoint,
// test the connection with a real request, discover models via GET /models.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Server,
  MoreVertical,
  Trash2,
  Pencil,
  RefreshCw,
  Boxes,
  Check,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import type { ProviderDTO } from "@/lib/types";
import {
  useCreateProvider,
  useDeleteProvider,
  useDiscoverModels,
  useProviders,
  useTestProvider,
  useUpdateProvider,
} from "@/hooks/mythicalmind/queries";
import { toast } from "sonner";

const PRESETS: { name: string; baseUrl: string; note: string }[] = [
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", note: "official API" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", note: "100+ models gateway" },
  { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", note: "fast inference" },
  { name: "Together", baseUrl: "https://api.together.xyz/v1", note: "open models" },
  { name: "Fireworks", baseUrl: "https://api.fireworks.ai/inference/v1", note: "fast serving" },
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", note: "reasoning models" },
  { name: "Ollama", baseUrl: "http://localhost:11434/v1", note: "local models" },
  { name: "LM Studio", baseUrl: "http://localhost:1234/v1", note: "local server" },
  { name: "vLLM", baseUrl: "http://localhost:8000/v1", note: "self-hosted serving" },
  { name: "LocalAI", baseUrl: "http://localhost:8080/v1", note: "self-hosted" },
];

const EMPTY_FORM = {
  name: "",
  type: "openai-compatible",
  baseUrl: "",
  apiKey: "",
  defaultModel: "",
  customHeaders: "",
};

function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) out[key] = value;
    }
  }
  return out;
}

function stringifyHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

export function ProvidersPage() {
  const { data: providers, isLoading } = useProviders();
  const [editing, setEditing] = useState<ProviderDTO | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-7">
        <div className="flex items-center gap-3 mb-1.5">
          <h1 className="text-[19px] font-semibold tracking-tight">
            AI Providers
          </h1>
        </div>
        <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">
          Connect any OpenAI-compatible endpoint — cloud gateways or your own
          servers. Keys are stored server-side and never sent back to the
          browser.
        </p>

        <div className="flex items-center gap-2.5 mb-5">
          <Button
            onClick={() => setCreating(true)}
            className="bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white shadow-[0_0_24px_-8px_var(--aurora-accent)]"
          >
            <Plus className="size-4" /> Add provider
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : (providers ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center">
            <Server className="size-6 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-[13.5px] text-muted-foreground">
              No providers connected yet.
            </p>
            <p className="text-[12px] text-muted-foreground/60 mt-1">
              Add your first OpenAI-compatible endpoint to start generating.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(providers ?? []).map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                onEdit={() => setEditing(p)}
              />
            ))}
          </div>
        )}
      </div>

      <ProviderFormDialog
        open={creating}
        onOpenChange={setCreating}
        provider={null}
      />
      <ProviderFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => !v && setEditing(null)}
        provider={editing}
      />
    </div>
  );
}

function StatusDot({ status }: { status: ProviderDTO["status"] }) {
  return (
    <span
      className={cn(
        "size-1.5 rounded-full",
        status === "connected" && "bg-emerald-400",
        status === "error" && "bg-destructive",
        status === "unverified" && "bg-amber-400/70"
      )}
      aria-label={status}
    />
  );
}

function ProviderCard({
  provider,
  onEdit,
}: {
  provider: ProviderDTO;
  onEdit: () => void;
}) {
  const test = useTestProvider();
  const discover = useDiscoverModels();
  const deleteProvider = useDeleteProvider();

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.022] p-4.5 flex flex-col gap-3 hover:border-white/12 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] flex-none">
          <Server className="size-4 text-[var(--aurora-accent-2)]/85" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-medium truncate">{provider.name}</h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-[9.5px] bg-white/[0.05] text-muted-foreground flex-none">
              {provider.type === "openai-compatible" ? "OpenAI-compatible" : provider.type}
            </Badge>
          </div>
          <p className="text-[11.5px] text-muted-foreground/70 truncate mt-0.5 font-mono">
            {provider.baseUrl}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Provider actions">
              <MoreVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-3.5" /> Manage
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (
                  window.confirm(
                    `Remove provider “${provider.name}”? Its ${provider.modelCount} saved models are removed too. Conversations keep their content.`
                  )
                ) {
                  deleteProvider.mutate(provider.id);
                }
              }}
            >
              <Trash2 className="size-3.5" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 text-[12px]">
        <StatusDot status={provider.status} />
        <span
          className={cn(
            "text-muted-foreground truncate",
            provider.status === "connected" && "text-emerald-300/90",
            provider.status === "error" && "text-destructive/90"
          )}
        >
          {provider.status === "connected" && "Connected"}
          {provider.status === "error" && (provider.statusDetail ?? "Connection error")}
          {provider.status === "unverified" && "Not verified yet"}
        </span>
        {provider.lastTestedAt && (
          <span className="text-muted-foreground/45 text-[10.5px] flex-none">
            · {relativeTime(provider.lastTestedAt)}
          </span>
        )}
      </div>

      {provider.statusDetail && provider.status === "connected" && (
        <p className="text-[11px] text-muted-foreground/60 truncate">
          {provider.statusDetail}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground/70 flex-wrap">
          <span className="flex-none">{provider.modelCount} models</span>
          {provider.hasKey && (
            <span className="font-mono text-[10.5px] flex-none">{provider.keyHint}</span>
          )}
        </div>
        {provider.defaultModel && (
          <div className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5 min-w-0">
            <span className="flex-none">default</span>
            <span className="font-mono truncate">{provider.defaultModel}</span>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-[12px] border-white/10 flex-1"
          onClick={() => test.mutate(provider.id)}
          disabled={test.isPending && test.variables === provider.id}
        >
          {test.isPending && test.variables === provider.id ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Test
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-[12px] border-white/10 flex-1"
          onClick={() => discover.mutate(provider.id)}
          disabled={discover.isPending && discover.variables === provider.id}
        >
          {discover.isPending && discover.variables === provider.id ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Boxes className="size-3.5" />
          )}
          Discover models
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-[12px] flex-1"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" /> Manage
        </Button>
      </div>
    </div>
  );
}

export function ProviderFormDialog({
  open,
  onOpenChange,
  provider,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  provider: ProviderDTO | null;
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
        <ProviderFormInner
          key={`${resetKey}-${provider?.id ?? "new"}`}
          provider={provider}
          onClose={() => handleOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ProviderFormInner({
  provider,
  onClose,
}: {
  provider: ProviderDTO | null;
  onClose: () => void;
}) {
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const test = useTestProvider();
  const [form, setForm] = useState(() =>
    provider
      ? {
          name: provider.name,
          type: provider.type,
          baseUrl: provider.baseUrl,
          apiKey: "", // blank = keep existing key
          defaultModel: provider.defaultModel ?? "",
          customHeaders: stringifyHeaders(provider.customHeaders ?? {}),
        }
      : EMPTY_FORM
  );
  const [showKey, setShowKey] = useState(false);

  const save = (andTest: boolean) => {
    const payload = {
      name: form.name.trim(),
      type: form.type,
      baseUrl: form.baseUrl.trim(),
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      defaultModel: form.defaultModel.trim() || null,
      customHeaders: parseHeaders(form.customHeaders),
    };
    if (!payload.name || !payload.baseUrl) {
      toast.error("Name and Base URL are required.");
      return;
    }
    if (!provider && !form.apiKey.trim() && !payload.baseUrl.includes("localhost") && !payload.baseUrl.includes("127.0.0.1")) {
      // keyless non-local providers are allowed but warned
      toast.info("No API key set — many providers will reject unauthenticated requests.");
    }
    const onDone = (id: string) => {
      if (andTest) {
        test.mutate(id);
      }
      onClose();
    };
    if (provider) {
      update.mutate(
        { id: provider.id, ...payload },
        { onSuccess: () => onDone(provider.id) }
      );
    } else {
      create.mutate(payload, {
        onSuccess: (data) => onDone(data.provider.id),
      });
    }
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>
            {provider ? `Manage ${provider.name}` : "Add AI provider"}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            Any endpoint implementing <span className="font-mono">POST /chat/completions</span>{" "}
            with Bearer authentication works. The Base URL usually ends with{" "}
            <span className="font-mono">/v1</span>.
          </DialogDescription>
        </DialogHeader>

        {!provider && (
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() =>
                  setForm((f) => ({ ...f, name: f.name || p.name, baseUrl: p.baseUrl }))
                }
                title={`${p.note} — ${p.baseUrl}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.06] transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="provider-name" className="text-[12px]">
              Provider name
            </Label>
            <Input
              id="provider-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My VPS"
              className="h-9 bg-white/[0.03] border-white/10 text-[13.5px]"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="provider-type" className="text-[12px]">
              API type
            </Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v })}
              disabled
            >
              <SelectTrigger id="provider-type" className="h-9 bg-white/[0.03] border-white/10 text-[13.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai-compatible">
                  OpenAI-compatible
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground/60">
              One universal adapter today — the registry is designed for more
              protocols.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="provider-url" className="text-[12px]">
              Base URL
            </Label>
            <Input
              id="provider-url"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://ai.example.com/v1"
              className="h-9 bg-white/[0.03] border-white/10 text-[13px] font-mono"
              spellCheck={false}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="provider-key" className="text-[12px]">
              API key {provider && provider.hasKey && "(stored — leave blank to keep)"}
            </Label>
            <div className="relative">
              <Input
                id="provider-key"
                type={showKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={provider?.keyHint ?? "sk-…"}
                className="h-9 bg-white/[0.03] border-white/10 text-[13px] font-mono pr-9"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              Stored server-side only; requests proxy through this app. Never
              returned to the browser.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="provider-model" className="text-[12px]">
              Default model (optional)
            </Label>
            <Input
              id="provider-model"
              value={form.defaultModel}
              onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
              placeholder="e.g. gpt-4o-mini, llama3.3:70b"
              className="h-9 bg-white/[0.03] border-white/10 text-[13px] font-mono"
              spellCheck={false}
            />
            <p className="text-[11px] text-muted-foreground/60">
              Used for connection tests when /models is unavailable, and as
              the initial model for new conversations.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="provider-headers" className="text-[12px]">
              Custom headers (optional)
            </Label>
            <Textarea
              id="provider-headers"
              value={form.customHeaders}
              onChange={(e) => setForm({ ...form, customHeaders: e.target.value })}
              placeholder={"X-Title: MythicalMind\nHTTP-Referer: https://example.com"}
              className="min-h-[64px] bg-white/[0.03] border-white/10 text-[12px] font-mono resize-y"
              spellCheck={false}
            />
            <p className="text-[11px] text-muted-foreground/60">
              One “Header: value” per line — sent with every request to this
              provider (useful for gateways like OpenRouter).
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-9"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => save(true)}
            disabled={create.isPending || update.isPending}
            className="h-9 border-white/12"
          >
            {test.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Save & test
          </Button>
          <Button
            onClick={() => save(false)}
            disabled={create.isPending || update.isPending}
            className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
          >
            Save
          </Button>
        </DialogFooter>
    </>
  );
}
