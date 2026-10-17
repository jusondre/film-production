# Film Production: pre-production pipeline

Sign-in needs a web address and a Supabase project: follow `SETUP.md`.
Projects are saved in the shared database and only visible to the people added to them.
Project details and tab content are saved as you type; uploaded files go to Supabase Storage.

## Structure
- `css/tokens.css`   colors, font, light/dark themes
- `css/base.css`     reset and shared components (buttons, dialogs)
- `css/layout.css`   top bar, tabs, page layout
- `css/crew.css`, `calendar.css`, `tasks.css`, `overview.css`, `files.css`  one file per tab
- `js/storage.js`    saving and loading
- `js/theme.js`      light/dark toggle
- `js/projects.js`   project state: create, rename, delete, autosave, project switcher
- `js/overview.js`   Overview tab (project details, summary, rename, delete)
- `js/files.js`      Files tab (upload, download, delete; stored in Supabase Storage)
- `js/crew.js`       Crew tab (also shared crew helpers)
- `js/calendar.js`   Calendar tab
- `js/tasks.js`      Tasks tab (board, drag and drop, detail panel)
- `js/app.js`        tabs list and wiring (add new stages in `TABS`)

## Visualize tab
- `js/visualize.js`  switches between the three sections
- `js/moodboards.js`, `storyboard.js`, `shotlist.js`  one file per section
- `js/images.js`     picks and shrinks images (stored in the browser, so very large boards can fill storage)
- `js/dialogs.js`, `js/dom.js`  shared name prompt and DOM helpers

## Accounts
- `config.js`        your Supabase keys
- `supabase/setup.sql`  tables, access rules, first admin
- `js/auth.js`      sign-in, invitation, password-reset screens
- `js/admin.js`     Admin screen, opened from the top bar by admins (invite by email, pending/accepted, roles, revoke, all projects)
- `supabase/step2_projects.sql`  projects, project members, invite-only sign-up
- `css/access.css`  view-only mode for viewers
- `supabase/functions/invite-user/`  server function that sends invitations, makes links, revokes
- `supabase/emails/`  invitation and reset email templates
- `supabase/step3_passwords.sql`  password sign-in support
- `supabase/step4_files.sql`  private file bucket and its access rules
- `supabase/step5_people.sql`  name/phone on profiles, pending vs accepted, crew autofill
