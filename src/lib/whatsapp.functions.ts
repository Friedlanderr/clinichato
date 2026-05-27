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
      .from("conversations").select("id, contact_id, contacts(whatsapp_number)").eq("id", data.conversationId).single();
    // @ts-expect-error nested select
    const number = conv?.contacts?.whatsapp_number as string | undefined;
    if (!number) throw new Error("Conversation not found");

    await sendWhatsApp(number, data.text);
    await supabaseAdmin.from("messages").insert({
      conversation_id: data.conversationId, role: "assistant", content: data.text,
    });
    await supabaseAdmin.from("conversations").update({
      last_message_at: new Date().toISOString(),
      assigned_to: context.userId,
    }).eq("id", data.conversationId);
    return { ok: true };
  });
