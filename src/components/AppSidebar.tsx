import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessagesSquare,
  CalendarDays,
  Users,
  Bot,
  Building2,
  Plug,
  LogOut,
  Stethoscope,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/conversations", label: "Conversas", icon: MessagesSquare },
  { to: "/appointments", label: "Agendamentos", icon: CalendarDays },
  { to: "/leads", label: "Leads", icon: Users },
];

const settings = [
  { to: "/settings/bot", label: "Bot & FAQ", icon: Bot },
  { to: "/settings/clinic", label: "Clínica", icon: Building2 },
  { to: "/settings/integration", label: "Integração", icon: Plug },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Claudia IA</p>
            <p className="text-xs text-muted-foreground">Atendimento clínico</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((i) => (
                <SidebarMenuItem key={i.to}>
                  <SidebarMenuButton asChild isActive={path === i.to}>
                    <Link to={i.to}>
                      <i.icon /> <span>{i.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settings.map((i) => (
                <SidebarMenuItem key={i.to}>
                  <SidebarMenuButton asChild isActive={path === i.to}>
                    <Link to={i.to}>
                      <i.icon /> <span>{i.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{user?.email}</p>
            <p className="text-[10px] text-muted-foreground">Atendente</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
