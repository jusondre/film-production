# Setting up Film Production

Hosted on GitHub Pages: https://jusondre.github.io/film-production/
Everyone signs in with **Discord**. Only people **in your Discord server** can see anything.
Members with the **admin** role can edit; everyone else in the server can only look.
There are no passwords, no sign-up, no invitations and no emails to send. Roles are managed in Discord.

## 1. Discord (about 5 minutes)
1. https://discord.com/developers/applications, **New Application**.
2. **OAuth2**: copy the **Client ID**, press Reset Secret and copy the **Client Secret**. Under Redirects add
   `https://vioxoepubvaqjzvkxqjo.supabase.co/auth/v1/callback` and save.
3. **Bot**: press Reset Token and copy the token. (Nothing else on this page needs changing.)
4. Add the bot to your server: **OAuth2, URL Generator**, tick scope `bot`, no permissions needed, open the link it makes and choose your server.
   The bot only looks up who is in the server and which roles they have.
5. Your server's ID: in Discord, Settings, Advanced, switch on Developer Mode; then right-click your server's name and choose **Copy Server ID**.
6. In your server, make sure there is a role named **admin** and give it to the people who should edit.

## 2. Supabase
1. SQL Editor: if this is a brand-new project run `setup.sql`, `step2_projects.sql`, `step4_files.sql` first. Then run **`step7_discord.sql`**.
2. Authentication, Sign In / Providers, **Discord**: switch on, paste the Client ID and Client Secret, save.
   Make sure "Allow new users to sign up" is **on** (Discord sign-in creates the account; the server check decides who gets in).
3. Authentication, URL Configuration: Site URL = `https://jusondre.github.io/film-production/` and add the same address under Redirect URLs.
4. Edge Functions, Deploy a new function, Via Editor: name it `discord-access`, paste `supabase/functions/discord-access/index.ts`, deploy.
5. Edge Functions, Secrets (or Project Settings, Edge Functions): add
   - `DISCORD_BOT_TOKEN` = the bot token from step 1.3
   - `DISCORD_GUILD_ID` = the server ID from step 1.5
   - `DISCORD_ADMIN_ROLE` = `admin` (only needed if your role is named something else; a role ID works too)
6. Keys: `config.js` already has your Supabase URL and public key.

## How it behaves
- Not signed in: the site only shows "Sign in with Discord" (and the dark mode switch in the menu).
- Signed in but not in the server: a short message, nothing else.
- In the server: all projects, read-only. With the admin role: editing, new projects, deleting, and "View as viewer" in the menu.
- The site asks Discord again every 15 minutes (and when you return to the tab), so someone who leaves the server or loses the admin role is locked out or demoted quickly.
- Anyone who was added through the old email system is not needed any more; old accounts and tables can stay or be deleted.
