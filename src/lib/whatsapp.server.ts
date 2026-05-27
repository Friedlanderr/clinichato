// Server-only helpers for WhatsApp + AI processing.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "google/gemini-2.5-flash";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function callAI(messages: ChatMsg[]): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, messages }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function sendWhatsApp(toNumber: string, text: string) {
  const { data: cfg } = await supabaseAdmin.from("integration_config").select("*").limit(1).maybeSingle();
  if (!cfg?.evolution_api_url || !cfg?.evolution_api_key || !cfg?.instance_name) {
    throw new Error("Evolution API not configured");
  }
  const url = `${cfg.evolution_api_url.replace(/\/$/, "")}/message/sendText/${cfg.instance_name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: cfg.evolution_api_key, "Content-Type": "application/json" },
    body: JSON.stringify({ number: toNumber, text }),
  });
  if (!res.ok) throw new Error(`Evolution send failed ${res.status}: ${await res.text()}`);
  return res.json();
}

function isWithinHours(start: string, end: string, days: number[]): boolean {
  const now = new Date();
  const day = now.getDay();
  if (!days.includes(day)) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return cur >= sh * 60 + sm && cur <= eh * 60 + em;
}

export async function processIncomingMessage(phone: string, text: string, pushName?: string) {
  const number = phone.replace(/\D/g, "");

  // contact upsert
  let { data: contact } = await supabaseAdmin
    .from("contacts").select("*").eq("whatsapp_number", number).maybeSingle();
  if (!contact) {
    const ins = await supabaseAdmin.from("contacts")
      .insert({ whatsapp_number: number, name: pushName ?? null }).select().single();
    contact = ins.data!;
  } else if (pushName && !contact.name) {
    await supabaseAdmin.from("contacts").update({ name: pushName }).eq("id", contact.id);
  }

  // conversation - latest open
  let { data: conv } = await supabaseAdmin
    .from("conversations").select("*").eq("contact_id", contact.id)
    .neq("status", "closed").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!conv) {
    const ins = await supabaseAdmin.from("conversations")
      .insert({ contact_id: contact.id, status: "bot_active", last_message_at: new Date().toISOString() })
      .select().single();
    conv = ins.data!;
  }

  // store user message
  await supabaseAdmin.from("messages").insert({ conversation_id: conv.id, role: "user", content: text });
  await supabaseAdmin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

  // if conversation is being handled by a human, do nothing
  if (conv.status === "waiting_human") return;

  // load bot + clinic config
  const [{ data: bot }, { data: clinic }] = await Promise.all([
    supabaseAdmin.from("bot_config").select("*").limit(1).maybeSingle(),
    supabaseAdmin.from("clinic_config").select("*").limit(1).maybeSingle(),
  ]);
  if (!bot?.is_active) return;

  // off-hours
  const days = Array.isArray(bot.working_days) ? (bot.working_days as number[]) : [1, 2, 3, 4, 5];
  if (!isWithinHours(bot.working_hours_start, bot.working_hours_end, days)) {
    await sendWhatsApp(number, bot.off_hours_message);
    await supabaseAdmin.from("messages").insert({ conversation_id: conv.id, role: "assistant", content: bot.off_hours_message });
    return;
  }

  // build prompt
  const clinicData = clinic ? JSON.stringify({
    nome: clinic.name, endereco: clinic.address, telefone: clinic.phone,
    email: clinic.email, especialidades: clinic.specialties, convenios: clinic.insurance_plans,
  }) : "{}";
  const faqData = Array.isArray(bot.faq) ? JSON.stringify(bot.faq) : "[]";
  const system = bot.system_prompt
    .replace("{clinic_data}", clinicData)
    .replace("{faq_data}", faqData);

  // history
  const { data: history } = await supabaseAdmin.from("messages")
    .select("role, content").eq("conversation_id", conv.id)
    .order("created_at", { ascending: true }).limit(30);

  const messages: ChatMsg[] = [
    { role: "system", content: system },
    ...(history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  let reply: string;
  try {
    reply = await callAI(messages);
  } catch (e) {
    console.error("AI call failed", e);
    return;
  }

  if (reply.includes("TRANSFERIR_HUMANO")) {
    await supabaseAdmin.from("conversations").update({ status: "waiting_human" }).eq("id", conv.id);
    const handoff = "Vou transferir você para um de nossos atendentes. Aguarde um momento, por favor.";
    await sendWhatsApp(number, handoff);
    await supabaseAdmin.from("messages").insert({ conversation_id: conv.id, role: "assistant", content: handoff });
    return;
  }

  await sendWhatsApp(number, reply);
  await supabaseAdmin.from("messages").insert({ conversation_id: conv.id, role: "assistant", content: reply });
}
