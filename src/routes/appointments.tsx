import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/appointments")({
  head: () => ({ meta: [{ title: "Agendamentos — Claudia IA" }] }),
  component: () => (
    <AppShell title="Agendamentos">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Calendário e gestão de agendamentos virão na próxima etapa.</p>
        </CardContent>
      </Card>
    </AppShell>
  ),
});
