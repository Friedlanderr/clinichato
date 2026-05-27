import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendWhatsApp } from "@/lib/whatsapp.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const sendAgentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      conversationId: z.string().uuid(),
      text: z.string().min(1).max(4000),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id, contact_id, contacts(whatsapp_number)")
      .eq("id", data.conversationId)
      .single();

    const contacts = (conv as unknown as { contacts: { whatsapp_number: string } | null })?.contacts;
    const number = contacts?.whatsapp_number;
    if (!number) throw new Error("Conversation not found");

    await sendWhatsApp(number, data.text);

    // Salva como "human_agent" para diferenciar visualmente do bot ("assistant")
    await supabaseAdmin.from("messages").insert({
      conversation_id: data.conversationId,
      role: "human_agent" as any,
      content: data.text,
    });

    await supabaseAdmin
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        assigned_to: context.userId,
      })
      .eq("id", data.conversationId);

    return { ok: true };
  });
