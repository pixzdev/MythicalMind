// Provider · model selector. Switching models mid-conversation is a
// first-class action — never requires a new conversation.

"use client";

import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Check,
  ChevronsUpDown,
  Server,
  Eye,
  Brain,
  Wrench,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useModels, useProviders } from "@/hooks/mythicalmind/queries";
import { useWorkspace } from "@/store/workspace-store";
import type { ModelSelection } from "@/store/workspace-store";

interface ModelPickerProps {
  providerId?: string | null;
  modelKey?: string | null;
  onPick: (selection: ModelSelection) => void;
  compact?: boolean;
}

interface FlatModel {
  providerId: string;
  providerName: string;
  modelId: string;
  rowId: string;
  name: string;
  vision: boolean;
  reasoning: boolean;
  tools: boolean;
  contextWindow: number | null;
}

export function ModelPicker({ providerId, modelKey, onPick, compact }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: providers } = useProviders();
  const { data: allModels } = useModels();
  const setView = useWorkspace((s) => s.setView);

  const models = useMemo<FlatModel[]>(
    () =>
      (allModels ?? []).map((m) => ({
        providerId: m.providerId,
        providerName: m.providerName,
        modelId: m.modelId,
        rowId: m.id,
        name: m.name,
        vision: m.vision,
        reasoning: m.reasoning,
        tools: m.tools,
        contextWindow: m.contextWindow,
      })),
    [allModels]
  );

  const selected = useMemo(
    () => models.find((m) => m.providerId === providerId && m.modelId === modelKey),
    [models, providerId, modelKey]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.modelId.toLowerCase().includes(q) ||
        m.providerName.toLowerCase().includes(q)
    );
  }, [models, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, FlatModel[]>();
    for (const m of filtered) {
      const list = groups.get(m.providerName) ?? [];
      list.push(m);
      groups.set(m.providerName, list);
    }
    return [...groups.entries()];
  }, [filtered]);

  const providerName =
    providers?.find((p) => p.id === providerId)?.name ?? selected?.providerName ?? "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 justify-between gap-1.5 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] font-normal max-w-[300px]",
            compact && "h-7 w-full text-[12px]"
          )}
          aria-label="Pilih penyedia dan model"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <Server className="size-3.5 text-[var(--aurora-accent-2)] flex-none" />
            {providerName && (
              <span className="text-muted-foreground text-[11px] hidden sm:inline truncate">
                {providerName}
              </span>
            )}
            <span className="text-foreground/90 text-[12px] font-mono truncate">
              {modelKey ?? "Pilih model"}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground flex-none" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[340px] p-0 glass rounded-xl"
      >
        <div className="flex items-center gap-2 border-b border-white/8 px-3 h-10">
          <Search className="size-3.5 text-muted-foreground/70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari penyedia & model…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50"
            aria-label="Cari model"
          />
          {(allModels?.length ?? 0) === 0 && (
            <span className="text-[10.5px] text-muted-foreground/60">belum ada model</span>
          )}
        </div>

        <ScrollArea className="max-h-[300px]">
          <div className="p-1.5">
            {grouped.length === 0 && (
              <div className="px-3 py-6 text-center text-[12.5px] text-muted-foreground/70 leading-relaxed">
                Belum ada model. Temukan dari penyedia, atau tambahkan manual.
              </div>
            )}
            {grouped.map(([group, items]) => (
              <div key={group} className="mb-1">
                <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/60">
                  {group}
                </div>
                {items.map((m) => {
                  const isSelected =
                    m.providerId === providerId && m.modelId === modelKey;
                  return (
                    <button
                      key={m.rowId}
                      onClick={() => {
                        onPick({
                          providerId: m.providerId,
                          modelKey: m.modelId,
                        });
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-white/[0.05] transition-colors",
                        isSelected && "bg-[var(--aurora-accent)]/10"
                      )}
                    >
                      <Check
                        className={cn(
                          "size-3.5 flex-none",
                          isSelected ? "text-[var(--aurora-accent-2)]" : "opacity-0"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-mono text-foreground/90 truncate">
                          {m.modelId}
                        </span>
                        {m.name !== m.modelId && (
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {m.name}
                          </span>
                        )}
                      </span>
                      <span className="flex gap-1 flex-none">
                        {m.reasoning && (
                          <Badge variant="secondary" className="h-5 px-1.5 gap-1 text-[9.5px] bg-white/[0.05]">
                            <Brain className="size-2.5" /> reason
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
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t border-white/8 p-1.5">
          <button
            onClick={() => {
              setOpen(false);
              setView("providers");
            }}
            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground/90 transition-colors"
          >
            <Plus className="size-3.5" /> Sambungkan penyedia lain
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
