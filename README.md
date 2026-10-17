# Film Production: pre-production pipeline

Sign-in needs a web address and a Supabase project: follow `SETUP.md`.
Sign in with Discord: server members can view, members with the admin role can edit.
Project details and tab content are saved as you type; the equipment list is saved with the project too.

## Structure
- `css/tokens.css`   colors, font, light/dark themes
- `css/base.css`     reset and shared components (buttons, dialogs)
- `css/layout.css`   top bar, tabs, page layout
- `css/crew.css`, `calendar.css`, `tasks.css`, `overview.css`, `equipment.css`  one file per tab
- `js/storage.js`    saving and loading
- `js/theme.js`      light/dark toggle
- `js/projects.js`   project state: create, rename, delete, autosave, project switcher
- `js/overview.js`   Overview tab (project details, summary, rename, delete)
- `js/equipment.js` Equipment tab (searchable gear list: category, quantity, source, status, supplier, cost, details)
- `js/crew.js`       Crew tab (also shared crew helpers)
- `js/calendar.js`   Calendar tab (click a day to open a popup with everything planned that day)
- `js/tasks.js`      Tasks tab (board, drag and drop, detail panel)
- `js/app.js`        tabs list and wiring (add new stages in `TABS`)

## Visualize tab
- `js/visualize.js`  switches between the three sections
- `js/moodboards.js`, `storyboard.js`, `shotlist.js`  one file per section
- `js/images.js`     picks and shrinks images (stored in the browser, so very large boards can fill storage)
- `js/dialogs.js`, `js/dom.js`  shared name prompt and DOM helpers

## Accounts
- `config.js`        your Supabase keys and the live site address
- `js/auth.js`       Discord sign-in; asks the discord-access function who is in the server and who has the admin role
- `supabase/functions/discord-access/`  checks Discord with the bot and records the answer
- `supabase/setup.sql`, `step2_projects.sql`  tables (`step4_files.sql` is only for the removed Files tab)
- `supabase/step7_discord.sql`  access rules: Discord members read, Discord admins edit
- `supabase/step8_owner.sql`  only the Discord user `jusondre` can delete a project (admins can't)
- `css/access.css`   view-only mode (members without the admin role, and the admin's preview)
