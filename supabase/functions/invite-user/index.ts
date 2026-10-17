// Edge Function: invite-user
// Lets a site admin invite people to projects, create a fresh invitation link, or revoke an invitation.
// It runs on Supabase's servers because these actions need the private service key, which must never be in the website.
//
// Body: { action?: "invite" | "link" | "revoke", email, projectId, role?, redirectTo }
//   invite: add to the project and email an invitation. If the email can't be sent, the person is still added
//           and a link comes back so the admin can send it by hand.
//   link:   make a new invitation link without sending any email (an earlier link stops working).
//   delete: remove the person completely: their account, sign-in and every project they were on.
//   revoke: remove the person from the project. If they never finished signing up and have no other project,
//           their pending account is deleted too, so the old link stops working.

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

  // 1. Only signed-in, approved site admins may do any of this.
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return reply({ error: "You are not signed in." }, 401);
  const { data: me } = await admin.from("profiles").select("email, full_name, role, status").eq("id", user.id).single();
  if (me?.role !== "admin" || me?.status !== "approved") return reply({ error: "Only admins can manage invitations." }, 403);

  // 2. Check the request.
  const body = await req.json();
  const action = body.action ?? "invite";
  const { projectId, role, redirectTo } = body;
  const address = String(body.email ?? "").trim().toLowerCase();
  if (!["invite", "link", "revoke", "delete"].includes(action)) return reply({ error: "Unknown action." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return reply({ error: "That doesn’t look like an email address." }, 400);

  // The profile columns come from supabase/step5_people.sql. Without them this function can't tell
  // who has finished signing up, so it stops rather than guess.
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id, role, joined_at").eq("email", address).maybeSingle();
  if (profileError) return reply({ error: "Run supabase/step5_people.sql in the SQL Editor first." }, 500);
  const joined = Boolean(profile?.joined_at) || profile?.role === "admin";

  const findUser = async () => {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    return list?.users.find((u) => u.email?.toLowerCase() === address);
  };

  // 3a. Delete: remove the person entirely (account, sign-in, project access) so they can no longer sign in.
  if (action === "delete") {
    if (profile?.id === user.id) return reply({ error: "You can’t delete your own account." }, 400);
    await admin.from("project_members").delete().eq("email", address);
    await admin.from("invites").delete().eq("email", address);
    const account = profile?.id ? { id: profile.id } : await findUser();
    if (account) {
      const removed = await admin.auth.admin.deleteUser(account.id);
      if (removed.error) return reply({ error: removed.error.message }, 400);
    }
    await admin.from("profiles").delete().eq("email", address); // in case the profile outlived the account
    return reply({ status: "deleted" });
  }

  // 3b. Revoke.
  if (action === "revoke") {
    const removed = await admin.from("project_members").delete().eq("project_id", projectId).eq("email", address);
    if (removed.error) return reply({ error: removed.error.message }, 400);
    const { data: left } = await admin.from("project_members").select("project_id").eq("email", address);
    if (!joined && !left?.length) {
      const pending = await findUser();
      if (pending) await admin.auth.admin.deleteUser(pending.id);
    }
    return reply({ status: "revoked" });
  }

  // 4. Invite or link: check the role and the project.
  if (!["editor", "viewer"].includes(role)) return reply({ error: "Role must be editor or viewer." }, 400);
  const { data: project } = await admin.from("projects").select("title").eq("id", projectId).single();
  if (!project) return reply({ error: "Project not found." }, 404);

  // Membership first: the sign-up rules only let listed emails create an account.
  const added = await admin.from("project_members").upsert({ project_id: projectId, email: address, role });
  if (added.error) return reply({ error: added.error.message }, 400);
  await admin.from("profiles").update({ status: "approved" }).eq("email", address).eq("status", "revoked");

  // Someone who finished signing up just sees the project next time. Nothing to send.
  if (joined) return reply({ status: "exists" });

  const data = { project_title: project.title, role, invited_by: me.full_name || me.email };

  // Removes an account that was invited but never finished, so the invitation can start fresh.
  const clearPending = async () => {
    const pending = await findUser();
    if (pending) await admin.auth.admin.deleteUser(pending.id);
  };

  const makeLink = async () => {
    await clearPending();
    const made = await admin.auth.admin.generateLink({ type: "invite", email: address, options: { redirectTo, data } });
    if (made.error) return { error: made.error.message };
    return { link: `${redirectTo}?token_hash=${made.data.properties.hashed_token}&type=invite` };
  };

  if (action === "link") {
    const made = await makeLink();
    return made.error ? reply({ error: made.error }, 400) : reply({ status: "link", link: made.link });
  }

  // 5. Send the invitation email. If sending fails, fall back to a link the admin can pass on.
  await clearPending();
  const invited = await admin.auth.admin.inviteUserByEmail(address, { redirectTo, data });
  if (!invited.error) return reply({ status: "invited", emailed: true });
  const made = await makeLink();
  if (made.error) return reply({ error: invited.error.message }, 400);
  return reply({ status: "invited", emailed: false, emailError: invited.error.message, link: made.link });
});
