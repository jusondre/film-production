# Setting up Film Production

Sign-in is email + password. The admin adds people to a project; they get an emailed invitation, choose a
password, and sign in. Sign-in cannot work by double-clicking `index.html`; test locally with
`python3 -m http.server 8000` in this folder and open http://localhost:8000.

## One-time setup (Supabase)
1. SQL Editor: run `supabase/setup.sql` (once), then `supabase/step2_projects.sql`, then `supabase/step3_passwords.sql`, then `supabase/step4_files.sql` (file storage for the Files tab), then `supabase/step5_people.sql` (name and phone at sign-up, pending vs accepted, crew autofill).
2. Keys: put the Project URL and public key in `config.js`.
3. **Real email sending** (the built-in sender is limited to a couple of emails per hour). Authentication, Emails,
   SMTP Settings: switch on custom SMTP. For Gmail: host `smtp.gmail.com`, port `465`, username = your Gmail address,
   password = a Google *App password* (Google Account, Security, 2-Step Verification, App passwords).
4. Authentication, Sign In / Providers: switch OFF "Allow new users to sign up" (only invitations create accounts).
   Under Email, set minimum password length to 8 and Email OTP expiration to 86400 (24 hours).
5. Authentication, URL Configuration: Site URL = your live address; add it and `http://localhost:8000` to Redirect URLs.
6. Edge Functions, Deploy a new function, Via Editor: name it `invite-user`, paste `supabase/functions/invite-user/index.ts`, deploy. If it already exists, open it and replace the code with this version, then deploy again (it now also creates links and revokes invitations).
7. Authentication, Emails, Templates: paste `supabase/emails/invite.html` into "Invite user" and
   `supabase/emails/reset-password.html` into "Reset password" (subjects are written at the top of each file).
8. Your own password: sign in, click "Change password" (top right). If you can't sign in, use Authentication, Users,
   Add user, Create new user (tick Auto Confirm) with your admin email.

## Inviting people
Only admins see the **Admin** button in the top bar. There, add an email, choose the project and a role, and press "Add and send link".
If the email can't be sent (custom SMTP not set up yet, or the rate limit was hit), the person is still added and a link is shown to copy and send yourself.
Pending invitations also have "Copy link", "Resend" and "Revoke" (use Revoke if you typed the wrong email).
