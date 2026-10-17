# Setting up Film Production

Hosted on GitHub Pages: https://jusondre.github.io/film-production/
**Anyone who opens the site can look at the projects straight away** (no account). Dark mode is in the Menu.
**Editors** press **Sign in** (top right), enter their email, and type the code emailed to them (no passwords).
Only emails you add in Admin can sign in.

## One-time setup (Supabase)
1. SQL Editor: run `supabase/setup.sql` (once; put your own email in it), then `step2_projects.sql`, `step4_files.sql`, and `step6_share_and_editors.sql`. Each is safe to run again.
2. Keys: put the Project URL and public key in `config.js`. `siteUrl` is already the GitHub address.
3. **Real email sending** (the built-in sender allows only a couple of emails per hour, and every sign-in code is an email).
   Authentication, Emails, SMTP Settings: switch on custom SMTP (Gmail: host `smtp.gmail.com`, port `465`, username = your Gmail,
   password = a Google *App password*; or a service such as Resend).
4. Authentication, Sign In / Providers: switch **ON** "Allow new users to sign up". This is safe: the database only lets in emails you added as editors.
5. **Authentication, URL Configuration: set Site URL to `https://jusondre.github.io/film-production/`** (replace `http://localhost:3000`) and add the same address to Redirect URLs.
   This is what stops anything from pointing at localhost.
6. Authentication, Emails, Templates: paste `supabase/emails/sign-in-code.html` into both **Magic link** and **Confirm sign up**
   (the subject is written at the top of the file). The email should show a 6-digit code and no link.

## Adding editors
Profile menu, Admin: type an email, choose a project (or all projects), press "Add editor". They open the site, press Sign in,
enter that email, and type the code that arrives. "Remove" deletes their account; the × on a project takes them off just that project.
Profile menu, "View as viewer" shows you exactly what visitors see.
