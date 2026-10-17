# Film Production: pre-production pipeline

Sign-in needs a web address and a Supabase project: follow `SETUP.md`.
Everyone can view; editors sign in with an emailed code.
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
- `config.js`        your Supabase keys and the live site address
- `js/auth.js`       Sign in for editors (emailed code); visitors can look without signing in
- `js/admin.js`      Admin screen (add/remove editors), opened from the Profile menu by admins
- `supabase/setup.sql`, `step2_projects.sql`, `step4_files.sql`  tables, access rules, file storage
- `supabase/step6_share_and_editors.sql`  open viewing, remove-editor function
- `supabase/emails/sign-in-code.html`  the sign-in code email
- `css/access.css`   view-only mode (visitors and the admin's preview)
