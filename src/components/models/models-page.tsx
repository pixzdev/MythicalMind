// Models: every model across providers, manual metadata (capabilities,
// context window), manual add, delete.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Boxes,
  Plus,
  Trash2,
  Pencil,
  Eye,
  Brain,
  Wrench,
  Server,
} from "lucide-react";
import type { ModelDTO } from "@/lib/types";
import {
  useAddModel,
  useDeleteModel,
  useModels,
  useProviders,
  useUpdateModel,
} from "@/hooks/mythicalmind/queries";
import { toast } from "sonner";

export function ModelsPage() {
  const { data: models, isLoading } = useModels();
  const { data: providers } = useProviders();
  const deleteModel = useDeleteModel();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ModelDTO | null>(null);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-7">
        <div className="flex flex-wrap items-center gap-3 mb-1.5">
          <h1 className="text-[19px] font-semibold tracking-tight">Models</h1>
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-8.5 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
            onClick={() => setAddOpen(true)}
            disabled={(providers ?? []).length === 0}
          >
            <Plus className="size-3.5" /> Add model
          </Button>
        </div>
        <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">
          {models?.length ?? 0} models across {providers?.length ?? 0} providers.
          Capabilities marked here inform the picker — providers rarely report
          them, so edit them yourself when you know.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (models ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center">
            <Boxes className="size-6 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-[13.5px] text-muted-foreground">
              No models registered yet.
            </p>
            <p className="text-[12px] text-muted-foreground/60 mt-1">
              Use “Discover models” on a provider (works when it exposes{" "}
              <span className="font-mono">/models</span>), or add models
              manually.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/8">
                  <TableHead className="text-[11px] h-10">Model</TableHead>
                  <TableHead className="text-[11px]">Provider</TableHead>
                  <TableHead className="text-[11px] hidden md:table-cell">
                    Capabilities
                  </TableHead>
                  <TableHead className="text-[11px] hidden sm:table-cell">
                    Context
                  </TableHead>
                  <TableHead className="text-[11px] w-20 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(models ?? []).map((m) => (
                  <TableRow key={m.id} className="border-white/6">
                    <TableCell className="py-2.5">
                      <span className="font-mono text-[12.5px] text-foreground/90">
                        {m.modelId}
                      </span>
                      {m.name !== m.modelId && (
                        <span className="block text-[11px] text-muted-foreground/70">
                          {m.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {m.providerName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex gap-1">
                        {m.reasoning && (
                          <Badge variant="secondary" className="h-5 px-1.5 gap-1 text-[9.5px] bg-white/[0.05]">
                            <Brain className="size-2.5" /> reasoning
                          </Badge>
                        )}
                        {m.vision && (
                          <Badge variant="secondary" className="h-5 px-1.5 gap-1 text-[9.5px] bg-white/[0.05]">
                            <Eye className="size-2.5" /> vision
                          </Badge>
                        )}
                        {m.tools && (
                          <Badge variant="secondary" className="h-5 px-1.5 gap-1 text-[9.5px] bg-white/[0.05]">
                            <Wrench className="size-2.5" /> tools
                          </Badge>
                        )}
                        {!m.reasoning && !m.vision && !m.tools && (
                          <span className="text-[11px] text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-[12px] text-muted-foreground tabular-nums">
                      {m.contextWindow ? `${(m.contextWindow / 1000).toFixed(0)}k` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          onClick={() => setEditing(m)}
                          aria-label={`Edit ${m.modelId}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (window.confirm(`Delete model ${m.modelId}?`)) {
                              deleteModel.mutate(m.id);
                            }
                          }}
                          aria-label={`Delete ${m.modelId}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ModelEditDialog
        key={editing?.id ?? "none"}
        model={editing}
        onOpenChange={(v) => !v && setEditing(null)}
      />
      <ModelAddDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        providers={providers ?? []}
      />
    </div>
  );
}

function ModelAddDialog({
  open,
  onOpenChange,
  providers,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providers: { id: string; name: string }[];
}) {
  const add = useAddModel();
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [modelId, setModelId] = useState("");
  const [name, setName] = useState("");

  const save = () => {
    if (!providerId || !modelId.trim()) {
      toast.error("Provider and model ID are required.");
      return;
    }
    add.mutate(
      {
        providerId,
        modelId: modelId.trim(),
        name: name.trim() || undefined,
      },
      {
        onSuccess: () => {
          setModelId("");
          setName("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass sm:max-w-[440px] rounded-2xl border-white/10">
        <DialogHeader>
          <DialogTitle>Add model manually</DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            For providers without a{" "}
            <span className="font-mono">/models</span> endpoint — enter the
            exact model ID the API expects.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label className="text-[12px]">Provider</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger className="h-9 bg-white/[0.03] border-white/10 text-[13.5px]">
                <SelectValue placeholder="Choose provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[12px]">Model ID</Label>
            <Input
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="my-model"
              className="h-9 bg-white/[0.03] border-white/10 text-[13px] font-mono"
              spellCheck={false}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[12px]">Display name (optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Model"
              className="h-9 bg-white/[0.03] border-white/10 text-[13.5px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-9">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={add.isPending}
            className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
          >
            Add model
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModelEditDialog({
  model,
  onOpenChange,
}: {
  model: ModelDTO | null;
  onOpenChange: (v: boolean) => void;
}) {
  const update = useUpdateModel();
  const [state, setState] = useState(() => ({
    name: model?.name ?? "",
    contextWindow: model?.contextWindow ? String(model.contextWindow) : "",
    vision: model?.vision ?? false,
    reasoning: model?.reasoning ?? false,
    tools: model?.tools ?? false,
  }));

  if (!model) return null;

  const save = () => {
    update.mutate(
      {
        id: model.id,
        name: state.name.trim() || model.modelId,
        contextWindow: state.contextWindow
          ? Number(state.contextWindow) || null
          : null,
        vision: state.vision,
        reasoning: state.reasoning,
        tools: state.tools,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={Boolean(model)} onOpenChange={onOpenChange}>
      <DialogContent className="glass sm:max-w-[440px] rounded-2xl border-white/10">
        <DialogHeader>
          <DialogTitle className="font-mono text-[14px]">{model.modelId}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-[12.5px]">
            <Server className="size-3" /> {model.providerName}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label className="text-[12px]">Display name</Label>
            <Input
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
              className="h-9 bg-white/[0.03] border-white/10 text-[13.5px]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[12px]">Context window (tokens)</Label>
            <Input
              value={state.contextWindow}
              onChange={(e) =>
                setState({ ...state, contextWindow: e.target.value.replace(/\D/g, "") })
              }
              placeholder="e.g. 128000"
              className="h-9 bg-white/[0.03] border-white/10 text-[13px] tabular-nums"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2.5">
            <Label className="text-[12px]">Capabilities</Label>
            {(
              [
                ["reasoning", "Reasoning — emits reasoning_content / reasoning deltas"],
                ["vision", "Vision — accepts image inputs"],
                ["tools", "Tool calling — supports function calls"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 text-[12.5px] text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={state[key]}
                  onCheckedChange={(v) => setState({ ...state, [key]: v === true })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-9">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={update.isPending}
            className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
