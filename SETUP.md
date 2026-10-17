# Setting up Film Production

**Editors** sign in with their email and a code sent to it (no passwords, no sign-up form).
**Viewers** don't sign in: each project has a view link on its Overview tab, and anyone with the link can look at the project but not change it.
Sign-in can't work by double-clicking `index.html`; the site is served from GitHub Pages, or locally with
`python3 -m http.server 8000` and http://localhost:8000.

## One-time setup (Supabase)
1. SQL Editor: run `supabase/setup.sql` (once; put your own email in it), then `step2_projects.sql`, `step4_files.sql`, and `step6_share_and_editors.sql`. Each is safe to run again.
2. Keys: put the Project URL and public key in `config.js`. Set `siteUrl` to the live address (view links are built from it).
3. **Real email sending** (the built-in sender allows only a couple of emails per hour, and every sign-in code is an email).
   Authentication, Emails, SMTP Settings: switch on custom SMTP (Gmail: host `smtp.gmail.com`, port `465`, username = your Gmail,
   password = a Google *App password*; or a service such as Resend).
4. Authentication, Sign In / Providers: switch **ON** "Allow new users to sign up". This is safe: the database only lets in emails you added as editors.
   Under Email, make sure "Confirm email" is on and Email OTP Length is 6.
5. Authentication, URL Configuration: Site URL = your live address (https://jusondre.github.io/film-production/); add it to Redirect URLs.
6. Authentication, Emails, Templates: paste `supabase/emails/sign-in-code.html` into both **Magic link** and **Confirm sign up**
   (the subject is written at the top of the file). The code is what matters: it must contain `{{ .Token }}`.
7. Edge Functions, Deploy a new function, Via Editor: name it `shared-files`, paste `supabase/functions/shared-files/index.ts`, deploy.
   This only lets people with a view link see and download the Files tab. The old `invite-user` function is no longer used and can be deleted.

## Adding editors
Profile menu, Admin: type an email, choose a project (or all projects), press "Add editor". They open the site, enter that email,
and type the code that arrives. "Remove" deletes their account; the × on a project takes them off just that project.

## Sharing a project
Open the project, Overview tab, "Share link for viewers", Copy link. "New link" makes the old one stop working.
Profile menu, "View as viewer" shows you exactly what viewers see.
