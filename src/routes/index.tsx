import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSupabase } from "@/lib/supabase-browser";
import { MessagesSquare, CalendarDays, Users, UserCog } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Claudia IA" }] }),
  component: Dashboard,
});

type Stats = { conversations: number; appointments: number; leads: number; waitingHuman: number };

function Dashboard() {
  const [stats, setStats] = useState<Stats>({ conversations: 0, appointments: 0, leads: 0, waitingHuman: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = await getSupabase();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      const [c, a, l, w, r] = await Promise.all([
        supabase.from("conversations").select("id", { count: "exact", head: true }).gte("created_at", iso),
        supabase.from("appointments").select("id", { count: "exact", head: true }).gte("created_at", iso),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", iso),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("status", "waiting_human"),
        supabase.from("conversations").select("id,status,updated_at,contacts(name,whatsapp_number)").order("updated_at", { ascending: false }).limit(8),
      ]);
      setStats({
        conversations: c.count ?? 0,
        appointments: a.count ?? 0,
        leads: l.count ?? 0,
        waitingHuman: w.count ?? 0,
      });
      setRecent(r.data ?? []);
    };
    load();
  }, []);

  const cards = [
    { label: "Conversas hoje", value: stats.conversations, icon: MessagesSquare, tone: "bg-sky-100 text-sky-700" },
    { label: "Agendamentos hoje", value: stats.appointments, icon: CalendarDays, tone: "bg-emerald-100 text-emerald-700" },
    { label: "Leads capturados", value: stats.leads, icon: Users, tone: "bg-violet-100 text-violet-700" },
    { label: "Aguardando humano", value: stats.waitingHuman, icon: UserCog, tone: "bg-amber-100 text-amber-700" },
  ];

  return (
    <AppShell title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${c.tone}`}>
                <c.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Conversas recentes</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma conversa ainda. Configure a integração com a Evolution API para começar.
            </div>
          ) : (
            <div className="divide-y">
              {recent.map((r: any) => (
                <Link key={r.id} to="/conversations" className="flex items-center justify-between py-3 hover:bg-muted/40 px-2 rounded">
                  <div>
                    <p className="font-medium text-sm">{r.contacts?.name || r.contacts?.whatsapp_number || "Contato"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <Badge variant={r.status === "waiting_human" ? "destructive" : r.status === "closed" ? "secondary" : "default"}>
                    {r.status === "bot_active" ? "Bot ativo" : r.status === "waiting_human" ? "Aguardando humano" : "Encerrada"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
