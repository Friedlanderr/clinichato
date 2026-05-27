import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { getSupabase } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/settings/bot")({
  head: () => ({ meta: [{ title: "Bot — Claudia IA" }] }),
  component: BotSettings,
});

const DAYS = [
  { label: "Dom", value: 0 },
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
];

function BotSettings() {
  const [cfg, setCfg] = useState<any>(null);
  const [faq, setFaq] = useState<{ q: string; a: string }[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSupabase()
      .then((supabase) =>
        supabase.from("bot_config").select("*").limit(1).maybeSingle()
      )
      .then(({ data }) => {
        if (data) {
          setCfg(data);
          setFaq(Array.isArray(data.faq) ? (data.faq as unknown as { q: string; a: string }[]) : []);
          setWorkingDays(
            Array.isArray(data.working_days) && data.working_days.length > 0
              ? (data.working_days as number[])
              : [1, 2, 3, 4, 5]
          );
        }
      });
  }, []);

  if (!cfg)
    return (
      <AppShell title="Configurações do Bot">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );

  const toggleDay = (day: number) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const save = async () => {
    setBusy(true);
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("bot_config")
      .update({
        system_prompt: cfg.system_prompt,
        faq,
        working_hours_start: cfg.working_hours_start,
        working_hours_end: cfg.working_hours_end,
        working_days: workingDays,
        off_hours_message: cfg.off_hours_message,
        is_active: cfg.is_active,
      })
      .eq("id", cfg.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
  };

  return (
    <AppShell title="Configurações do Bot">
      <div className="space-y-6 max-w-4xl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Status do bot</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="active" className="text-sm">{cfg.is_active ? "Ativo" : "Desativado"}</Label>
              <Switch id="active" checked={cfg.is_active} onCheckedChange={(v) => setCfg({ ...cfg, is_active: v })} />
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Prompt do sistema</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={12} value={cfg.system_prompt} onChange={(e) => setCfg({ ...cfg, system_prompt: e.target.value })} />
            <p className="mt-2 text-xs text-muted-foreground">
              Use <code className="rounded bg-muted px-1">{"{clinic_data}"}</code> e <code className="rounded bg-muted px-1">{"{faq_data}"}</code> como placeholders.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Para agendamentos automáticos, instrua o bot a incluir{" "}
              <code className="rounded bg-muted px-1">{'[AGENDAR:{"nome":"...","data":"YYYY-MM-DD","hora":"HH:MM","especialidade":"..."}]'}</code>{" "}
              quando confirmar um agendamento.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Horário de atendimento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Dias de funcionamento</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((d) => (
                  <label key={d.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <Checkbox checked={workingDays.includes(d.value)} onCheckedChange={() => toggleDay(d.value)} />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="time" value={cfg.working_hours_start?.slice(0, 5)} onChange={(e) => setCfg({ ...cfg, working_hours_start: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="time" value={cfg.working_hours_end?.slice(0, 5)} onChange={(e) => setCfg({ ...cfg, working_hours_end: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem fora do horário</Label>
              <Textarea rows={3} value={cfg.off_hours_message} onChange={(e) => setCfg({ ...cfg, off_hours_message: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Perguntas frequentes (FAQ)</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setFaq([...faq, { q: "", a: "" }])}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {faq.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pergunta cadastrada.</p>}
            {faq.map((item, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex gap-2">
                  <Input placeholder="Pergunta" value={item.q} onChange={(e) => { const next = [...faq]; next[i] = { ...next[i], q: e.target.value }; setFaq(next); }} />
                  <Button size="icon" variant="ghost" onClick={() => setFaq(faq.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <Textarea placeholder="Resposta" value={item.a} onChange={(e) => { const next = [...faq]; next[i] = { ...next[i], a: e.target.value }; setFaq(next); }} />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>Salvar alterações</Button>
        </div>
      </div>
    </AppShell>
  );
}
