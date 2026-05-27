import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSupabase } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { Info, Copy } from "lucide-react";

export const Route = createFileRoute("/settings/integration")({
  head: () => ({ meta: [{ title: "Integração — Claudia IA" }] }),
  component: IntegrationSettings,
});

function IntegrationSettings() {
  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/webhooks/whatsapp`
      : "/api/public/webhooks/whatsapp";

  useEffect(() => {
    getSupabase()
      .then((supabase) =>
        supabase.from("integration_config").select("*").limit(1).maybeSingle()
      )
      .then(({ data }) => setCfg(data));
  }, []);

  if (!cfg)
    return (
      <AppShell title="Integração WhatsApp">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );

  const save = async () => {
    setBusy(true);
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("integration_config")
      .update({
        evolution_api_url: cfg.evolution_api_url,
        evolution_api_key: cfg.evolution_api_key,
        instance_name: cfg.instance_name,
      })
      .eq("id", cfg.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Integração salva");
  };

  const test = async () => {
    if (!cfg.evolution_api_url || !cfg.evolution_api_key || !cfg.instance_name) {
      return toast.error("Preencha todos os campos antes de testar.");
    }
    setTesting(true);
    try {
      const r = await fetch(
        `${cfg.evolution_api_url.replace(/\/$/,"")}/instance/connectionState/${cfg.instance_name}`,
        { headers: { apikey: cfg.evolution_api_key } }
      );
      if (r.ok) toast.success("Conexão estabelecida com sucesso!");
      else toast.error(`Falha (HTTP ${r.status}). Verifique URL, API Key e instância.`);
    } catch (e) {
      toast.error("Erro de rede: " + e.message);
    } finally {
      setTesting(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  return (
    <AppShell title="Integração WhatsApp">
      <div className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolution API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>URL base</Label>
              <Input
                placeholder="https://evolution.seudominio.com"
                value={cfg.evolution_api_url ?? ""}
                onChange={(e) => setCfg({ ...cfg, evolution_api_url: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <Input
                type="password"
                value={cfg.evolution_api_key ?? ""}
                onChange={(e) => setCfg({ ...cfg, evolution_api_key: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome da instância</Label>
              <Input
                placeholder="clinica"
                value={cfg.instance_name ?? ""}
                onChange={(e) => setCfg({ ...cfg, instance_name: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={busy}>Salvar</Button>
              <Button variant="outline" onClick={test} disabled={testing}>
                {testing ? "Testando…" : "Testar conexão"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Como configurar o webhook</AlertTitle>
          <AlertDescription className="space-y-2 text-sm">
            <p>1. Acesse o painel da sua Evolution API e selecione a instância.</p>
            <p>2. Configure o webhook apontando para a URL abaixo:</p>
            <div className="flex items-center gap-2 rounded bg-muted px-3 py-2">
              <code className="flex-1 text-xs break-all">{webhookUrl}</code>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={copyWebhook}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p>3. Ative os eventos <strong>MESSAGES_UPSERT</strong>.</p>
            <p>4. Salve e envie uma mensagem de teste no WhatsApp.</p>
          </AlertDescription>
        </Alert>
      </div>
    </AppShell>
  );
}
