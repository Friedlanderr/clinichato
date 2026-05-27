import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export const Route = createFileRoute("/leads")({
  head: () => ({ meta: [{ title: "Leads — Claudia IA" }] }),
  component: () => (
    <AppShell title="Leads">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">A tabela de leads e exportação CSV virão na próxima etapa.</p>
        </CardContent>
      </Card>
    </AppShell>
  ),
});
