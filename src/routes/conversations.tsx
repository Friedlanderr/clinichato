import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase-browser";
import { sendAgentMessage } from "@/lib/whatsapp.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessagesSquare, Send, UserCog, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/conversations")({
  head: () => ({ meta: [{ title: "Conversas — Claudia IA" }] }),
  component: ConversationsPage,
});

type Conv = {
  id: string;
  status: "bot_active" | "waiting_human" | "closed";
  last_message_at: string | null;
  updated_at: string;
  contact_id: string;
  contacts: { name: string | null; whatsapp_number: string } | null;
};
type Msg = { id: string; role: "user" | "assistant"; content: string; created_at: string };

function statusLabel(s: Conv["status"]) {
  return s === "bot_active" ? "Bot ativo" : s === "waiting_human" ? "Aguardando humano" : "Encerrada";
}
function statusVariant(s: Conv["status"]): "default" | "destructive" | "secondary" {
  return s === "waiting_human" ? "destructive" : s === "closed" ? "secondary" : "default";
}

function ConversationsPage() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const send = useServerFn(sendAgentMessage);

  const active = convs.find((c) => c.id === activeId) ?? null;

  // Load conversations + subscribe to realtime
  useEffect(() => {
    let channel: any;
    (async () => {
      const supabase = await getSupabase();
      const { data } = await supabase
        .from("conversations")
        .select("id,status,last_message_at,updated_at,contact_id,contacts(name,whatsapp_number)")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100);
      setConvs((data ?? []) as unknown as Conv[]);

      channel = supabase
        .channel("conversations-feed")
        .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, async () => {
          const { data } = await supabase
            .from("conversations")
            .select("id,status,last_message_at,updated_at,contact_id,contacts(name,whatsapp_number)")
            .order("last_message_at", { ascending: false, nullsFirst: false })
            .limit(100);
          setConvs((data ?? []) as unknown as Conv[]);
        })
        .subscribe();
    })();
    return () => { if (channel) channel.unsubscribe(); };
  }, []);

  // Load messages for active conversation + subscribe
  useEffect(() => {
    if (!activeId) { setMsgs([]); return; }
    let channel: any;
    (async () => {
      const supabase = await getSupabase();
      const { data } = await supabase
        .from("messages").select("*").eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      setMsgs((data ?? []) as Msg[]);

      channel = supabase
        .channel(`msgs-${activeId}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}`,
        }, (payload) => {
          setMsgs((prev) => [...prev, payload.new as Msg]);
        })
        .subscribe();
    })();
    return () => { if (channel) channel.unsubscribe(); };
  }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const handleSend = async () => {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    try {
      await send({ data: { conversationId: activeId, text: draft.trim() } });
      setDraft("");
    } catch (e: any) { toast.error(e.message ?? "Falha ao enviar"); }
    finally { setSending(false); }
  };

  const setStatus = async (s: Conv["status"]) => {
    if (!activeId) return;
    const supabase = await getSupabase();
    const { error } = await supabase.from("conversations").update({ status: s }).eq("id", activeId);
    if (error) toast.error(error.message);
    else toast.success("Status atualizado");
  };

  return (
    <AppShell title="Conversas">
      <Card className="grid h-[calc(100vh-7rem)] grid-cols-[320px_1fr] overflow-hidden">
        {/* sidebar list */}
        <div className="border-r flex flex-col min-h-0">
          <div className="border-b p-3 text-sm font-medium">Conversas ({convs.length})</div>
          <ScrollArea className="flex-1">
            {convs.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <MessagesSquare className="mx-auto mb-2 h-8 w-8" />
                Nenhuma conversa ainda.
              </div>
            )}
            {convs.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full border-b px-3 py-3 text-left hover:bg-muted/40 ${activeId === c.id ? "bg-muted/60" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{c.contacts?.name || c.contacts?.whatsapp_number || "Contato"}</p>
                  <Badge variant={statusVariant(c.status)} className="shrink-0 text-[10px]">{statusLabel(c.status)}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleString("pt-BR") : "—"}
                </p>
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* chat */}
        <div className="flex min-h-0 flex-col">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessagesSquare className="h-10 w-10" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b p-3">
                <div>
                  <p className="font-medium text-sm">{active.contacts?.name || active.contacts?.whatsapp_number}</p>
                  <p className="text-xs text-muted-foreground">{active.contacts?.whatsapp_number}</p>
                </div>
                <div className="flex gap-2">
                  {active.status !== "waiting_human" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus("waiting_human")}>
                      <UserCog className="mr-1 h-3.5 w-3.5" /> Assumir
                    </Button>
                  )}
                  {active.status !== "bot_active" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus("bot_active")}>Devolver ao bot</Button>
                  )}
                  {active.status !== "closed" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus("closed")}>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Encerrar
                    </Button>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 bg-muted/20 p-4">
                <div className="mx-auto flex max-w-2xl flex-col gap-2">
                  {msgs.map((m) => (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                        m.role === "user" ? "bg-background" : "bg-primary text-primary-foreground"
                      }`}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        <p className={`mt-1 text-[10px] ${m.role === "user" ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
              </ScrollArea>

              <div className="border-t p-3">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                  <Input
                    placeholder={active.status === "bot_active" ? "Bot está ativo — assuma para responder" : "Escreva uma mensagem…"}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={sending || active.status === "closed"}
                  />
                  <Button type="submit" disabled={sending || !draft.trim() || active.status === "closed"}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
