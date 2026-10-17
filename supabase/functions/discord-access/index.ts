// Edge Function: discord-access
// Checks, with the Discord server itself, whether the signed-in person is in the server and has the admin role,
// and records the answer where the database rules can see it. The website calls this after every sign-in and every
// few minutes while it is open, so leaving the server or losing the role takes effect quickly.
//
// Secrets (Supabase: Edge Functions, Secrets):
//   DISCORD_BOT_TOKEN   the bot's token (the bot must be in your server)
//   DISCORD_GUILD_ID    your server's ID
//   DISCORD_ADMIN_ROLE  the name (or ID) of the role that may edit; defaults to "admin"

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

  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1. Who is asking? Only a signed-in Discord account counts.
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return reply({ error: "You are not signed in." }, 401);
  const identity = user.identities?.find((i) => i.provider === "discord");
  const discordId = identity?.identity_data?.provider_id ?? identity?.identity_data?.sub ?? identity?.id;
  if (!discordId) return reply({ error: "This account isn’t a Discord account." }, 400);

  const meta = user.user_metadata ?? {};
  const name = meta.custom_claims?.global_name ?? meta.full_name ?? meta.name ?? "Discord user";
  const avatar = meta.avatar_url ?? meta.picture ?? null;

  const token = Deno.env.get("DISCORD_BOT_TOKEN");
  const guild = Deno.env.get("DISCORD_GUILD_ID");
  const roleWanted = (Deno.env.get("DISCORD_ADMIN_ROLE") ?? "admin").trim().toLowerCase();
  if (!token || !guild) return reply({ error: "The server isn’t set up yet: DISCORD_BOT_TOKEN and DISCORD_GUILD_ID are missing. See SETUP.md." }, 500);

  const discord = (path: string) =>
    fetch(`https://discord.com/api/v10${path}`, { headers: { Authorization: `Bot ${token}` } });

  // 2. Is this person in the server, and which roles do they have?
  const memberRes = await discord(`/guilds/${guild}/members/${discordId}`);
  let isMember = false, isAdmin = false;
  if (memberRes.ok) {
    isMember = true;
    const member = await memberRes.json();
    const rolesRes = await discord(`/guilds/${guild}/roles`);
    if (!rolesRes.ok) return reply({ error: `Discord wouldn’t list the server’s roles (${rolesRes.status}). Check the bot is in the server.` }, 502);
    const roles: { id: string; name: string }[] = await rolesRes.json();
    const adminIds = roles.filter((r) => r.id === roleWanted || r.name.toLowerCase() === roleWanted).map((r) => r.id);
    isAdmin = (member.roles as string[]).some((id) => adminIds.includes(id));
  } else if (memberRes.status !== 404) {
    return reply({ error: `Discord couldn’t be reached (${memberRes.status}). Check the bot token and server ID.` }, 502);
  }

  // 3. Record the answer for the database rules.
  const saved = await admin.from("discord_access").upsert({
    user_id: user.id, discord_id: String(discordId), name, avatar_url: avatar,
    is_member: isMember, is_admin: isAdmin, checked_at: new Date().toISOString(),
  });
  if (saved.error) return reply({ error: saved.error.message }, 500);

  return reply({ isMember, isAdmin, name, avatar });
});
