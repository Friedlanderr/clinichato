import { createFileRoute } from "@tanstack/react-router";
import { processIncomingMessage } from "@/lib/whatsapp.server";

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = await request.json();
          // Evolution API MESSAGES_UPSERT shape
          const data = payload?.data ?? payload;
          const key = data?.key ?? {};
          const fromMe = key.fromMe === true;
          if (fromMe) return Response.json({ ok: true, skipped: "fromMe" });

          const remoteJid: string = key.remoteJid ?? "";
          if (!remoteJid || remoteJid.includes("@g.us")) {
            return Response.json({ ok: true, skipped: "group_or_invalid" });
          }
          const phone = remoteJid.split("@")[0];
          const text: string =
            data?.message?.conversation ??
            data?.message?.extendedTextMessage?.text ??
            "";
          if (!text) return Response.json({ ok: true, skipped: "no_text" });

          const pushName = data?.pushName as string | undefined;
          await processIncomingMessage(phone, text, pushName);
          return Response.json({ ok: true });
        } catch (e: any) {
          console.error("webhook error", e);
          return new Response(`error: ${e?.message ?? e}`, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, info: "WhatsApp webhook ready" }),
    },
  },
});
