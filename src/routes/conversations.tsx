import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { MessagesSquare } from "lucide-react";

export const Route = createFileRoute("/conversations")({
  head: () => ({ meta: [{ title: "Conversas — Claudia IA" }] }),
  component: () => (
    <AppShell title="Conversas">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <MessagesSquare className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-md">
            A interface de chat estilo WhatsApp Web será ativada na próxima etapa (junto com o webhook e a IA).
          </p>
        </CardContent>
      </Card>
    </AppShell>
  ),
});
