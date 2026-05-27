import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase-browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/appointments")({
  head: () => ({ meta: [{ title: "Agendamentos — Claudia IA" }] }),
  component: AppointmentsPage,
});

type Status = "pending" | "confirmed" | "cancelled" | "completed";
type Appt = {
  id: string; patient_name: string; phone: string;
  appointment_date: string; appointment_time: string;
  specialty: string | null; notes: string | null; status: Status; created_at: string;
};

const label: Record<Status, string> = {
  pending: "Pendente", confirmed: "Confirmado", cancelled: "Cancelado", completed: "Realizado",
};
const variant: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", confirmed: "default", cancelled: "destructive", completed: "secondary",
};

function AppointmentsPage() {
  const [items, setItems] = useState<Appt[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");

  const load = async () => {
    const supabase = await getSupabase();
    const { data } = await supabase.from("appointments").select("*")
      .order("appointment_date", { ascending: true }).order("appointment_time", { ascending: true });
    setItems((data ?? []) as Appt[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((a) =>
    (filter === "all" || a.status === filter) &&
    (q === "" || a.patient_name.toLowerCase().includes(q.toLowerCase()) || a.phone.includes(q))
  );

  const updateStatus = async (id: string, status: Status) => {
    const supabase = await getSupabase();
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); load(); }
  };

  return (
    <AppShell title="Agendamentos">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{filtered.length} agendamento(s)</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Buscar paciente ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="confirmed">Confirmados</SelectItem>
                <SelectItem value="completed">Realizados</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <CalendarDays className="h-12 w-12" />
              <p className="text-sm">Nenhum agendamento encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{new Date(a.appointment_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{a.appointment_time?.slice(0, 5)}</TableCell>
                    <TableCell className="font-medium">{a.patient_name}</TableCell>
                    <TableCell>{a.phone}</TableCell>
                    <TableCell>{a.specialty ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={a.status} onValueChange={(v) => updateStatus(a.id, v as Status)}>
                        <SelectTrigger className="h-8 w-36">
                          <Badge variant={variant[a.status]}>{label[a.status]}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="confirmed">Confirmado</SelectItem>
                          <SelectItem value="completed">Realizado</SelectItem>
                          <SelectItem value="cancelled">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
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
