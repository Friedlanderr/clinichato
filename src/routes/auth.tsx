import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase-browser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Claudia IA" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-emerald-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Stethoscope className="h-6 w-6" />
          </div>
          <CardTitle>Claudia IA</CardTitle>
          <CardDescription>Painel de atendimento WhatsApp da clínica</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e1">E-mail</Label>
                  <Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p1">Senha</Label>
                  <Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">Entrar</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="n2">Nome completo</Label>
                  <Input id="n2" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e2">E-mail</Label>
                  <Input id="e2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p2">Senha</Label>
                  <Input id="p2" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">Criar conta</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}
