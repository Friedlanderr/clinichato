import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSupabase } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

export const Route = createFileRoute("/settings/clinic")({
  head: () => ({ meta: [{ title: "Clínica — Claudia IA" }] }),
  component: ClinicSettings,
});

function TagList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (v.trim()) { onChange([...items, v.trim()]); setV(""); } }
        }} />
        <Button type="button" variant="outline" size="icon" onClick={() => { if (v.trim()) { onChange([...items, v.trim()]); setV(""); } }}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <Badge key={i} variant="secondary" className="gap-1">
            {t}
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ClinicSettings() {
  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSupabase().then((supabase) => supabase.from("clinic_config").select("*").limit(1).maybeSingle()).then(({ data }) => setCfg(data));
  }, []);

  if (!cfg) return <AppShell title="Dados da clínica"><p className="text-sm text-muted-foreground">Carregando…</p></AppShell>;

  const save = async () => {
    setBusy(true);
    const supabase = await getSupabase();
    const { error } = await supabase.from("clinic_config").update({
      name: cfg.name, address: cfg.address, phone: cfg.phone, email: cfg.email,
      specialties: cfg.specialties, insurance_plans: cfg.insurance_plans,
    }).eq("id", cfg.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Dados da clínica salvos");
  };

  return (
    <AppShell title="Dados da clínica">
      <div className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle className="text-base">Informações gerais</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Nome da clínica</Label>
              <Input value={cfg.name ?? ""} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Endereço</Label>
              <Textarea rows={2} value={cfg.address ?? ""} onChange={(e) => setCfg({ ...cfg, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={cfg.phone ?? ""} onChange={(e) => setCfg({ ...cfg, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={cfg.email ?? ""} onChange={(e) => setCfg({ ...cfg, email: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Especialidades</CardTitle></CardHeader>
          <CardContent>
            <TagList items={cfg.specialties ?? []} onChange={(v) => setCfg({ ...cfg, specialties: v })} placeholder="Ex: Cardiologia" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Convênios aceitos</CardTitle></CardHeader>
          <CardContent>
            <TagList items={cfg.insurance_plans ?? []} onChange={(v) => setCfg({ ...cfg, insurance_plans: v })} placeholder="Ex: Unimed" />
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button onClick={save} disabled={busy}>Salvar</Button></div>
      </div>
    </AppShell>
  );
}
