import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase-browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leads")({
  head: () => ({ meta: [{ title: "Leads — Claudia IA" }] }),
  component: LeadsPage,
});

type Lead = {
  id: string; name: string; phone: string; email: string | null;
  interest: string | null; status: "new" | "contacted" | "converted" | "lost"; created_at: string;
};

const statusLabel: Record<Lead["status"], string> = {
  new: "Novo", contacted: "Contatado", converted: "Convertido", lost: "Perdido",
};

function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Lead["status"] | "all">("all");

  const load = async () => {
    const supabase = await getSupabase();
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads((data ?? []) as Lead[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = leads.filter((l) =>
    (filter === "all" || l.status === filter) &&
    (q === "" || l.name.toLowerCase().includes(q.toLowerCase()) || l.phone.includes(q))
  );

  const updateStatus = async (id: string, status: Lead["status"]) => {
    const supabase = await getSupabase();
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status atualizado"); load(); }
  };

  const exportCSV = () => {
    const headers = ["Nome", "Telefone", "E-mail", "Interesse", "Status", "Criado em"];
    const rows = filtered.map((l) => [l.name, l.phone, l.email ?? "", l.interest ?? "", statusLabel[l.status], new Date(l.created_at).toLocaleString("pt-BR")]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell title="Leads">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{filtered.length} lead(s)</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Buscar nome ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="new">Novos</SelectItem>
                <SelectItem value="contacted">Contatados</SelectItem>
                <SelectItem value="converted">Convertidos</SelectItem>
                <SelectItem value="lost">Perdidos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <Users className="h-12 w-12" />
              <p className="text-sm">Nenhum lead capturado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Interesse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>{l.phone}</TableCell>
                    <TableCell>{l.email ?? "—"}</TableCell>
                    <TableCell>{l.interest ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v as Lead["status"])}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new"><Badge variant="default">Novo</Badge></SelectItem>
                          <SelectItem value="contacted"><Badge variant="secondary">Contatado</Badge></SelectItem>
                          <SelectItem value="converted"><Badge>Convertido</Badge></SelectItem>
                          <SelectItem value="lost"><Badge variant="destructive">Perdido</Badge></SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
