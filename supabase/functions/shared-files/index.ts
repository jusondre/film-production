// Edge Function: shared-files
// Lets people who opened a project through its view link see and download that project's files.
// Files sit in a private bucket, so this checks the link's token and then hands out short-lived download links.
//
// Body: { token, action: "list" | "download", name? }

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { token, action, name } = await req.json().catch(() => ({}));

  if (typeof token !== "string" || token.length < 32) return reply({ error: "This link isn’t valid." }, 400);
  const { data: project } = await admin.from("projects").select("id").eq("share_token", token).maybeSingle();
  if (!project) return reply({ error: "This link is no longer active." }, 404);

  const bucket = admin.storage.from("project-files");

  if (action === "list") {
    const { data, error } = await bucket.list(project.id, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (error) return reply({ error: error.message }, 400);
    return reply({ files: data.filter((f) => f.name !== ".emptyFolderPlaceholder") });
  }

  if (action === "download") {
    if (typeof name !== "string" || !name || name.includes("/") || name.includes("..")) return reply({ error: "Unknown file." }, 400);
    const { data, error } = await bucket.createSignedUrl(`${project.id}/${name}`, 60, { download: name.replace(/^\d+__/, "") });
    if (error) return reply({ error: error.message }, 400);
    return reply({ url: data.signedUrl });
  }

  return reply({ error: "Unknown action." }, 400);
});
