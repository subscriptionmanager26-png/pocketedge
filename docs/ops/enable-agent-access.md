# Enable Pocketedge AI for a user

Production checks `social_profiles.agent_access` (boolean) on the **main social** Supabase project (`zweqxjeuwwfrlpbuuayg`).

There is no in-app toggle yet. Use the Supabase dashboard:

1. Open [Supabase](https://supabase.com/dashboard) → project linked to `VITE_SUPABASE_URL` (Pocketedge main / social).
2. **SQL Editor** → New query → run (replace the email):

```sql
-- Requires migration 20261016120000_social_profiles_agent_access.sql applied once.
update public.social_profiles sp
set agent_access = true,
    updated_at = now()
from auth.users u
where u.id = sp.user_id
  and u.email = 'you@example.com';
```

3. Reload [www.pocketedge.in/ai](https://www.pocketedge.in/ai).

**Table editor:** **Table Editor** → `social_profiles` → find the row for the user (`user_id` matches **Authentication → Users** → UUID) → set `agent_access` to `true`.

**Auth “User metadata”** in the dashboard is optional; the app does not require it if `social_profiles.agent_access` is set.
