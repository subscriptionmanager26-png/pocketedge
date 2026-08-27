# GitHub dispatch auth (Supabase cron → Actions)

Supabase `pg_cron` calls `dispatch-github-workflow`, which triggers GitHub Actions via `workflow_dispatch`.

## Recommended: GitHub App (no manual token expiry)

The App **private key does not expire**. Each dispatch mints a fresh 1-hour installation token.

### One-time setup

1. **Create app** (logged in as `subscriptionmanager26-png`):  
   [Register new GitHub App](https://github.com/settings/apps/new)

   | Field | Value |
   |-------|--------|
   | Name | `PocketEdge Cron Dispatch` |
   | Homepage | `https://www.pocketedge.in` |
   | Webhook | Disabled |
   | Repository permissions → Actions | Read and write |
   | Repository permissions → Metadata | Read |
   | Where | Only on `subscriptionmanager26-png/pocketedge` |

2. **Generate a private key** (.pem) and download it.

3. **Install the app** on `subscriptionmanager26-png/pocketedge`.

4. **Note IDs**:
   - App ID — app settings page
   - Installation ID — URL after install (`/settings/installations/<id>`) or:
     ```bash
     gh api /repos/subscriptionmanager26-png/pocketedge/installation -H "Authorization: Bearer <app-jwt>"
     ```

5. **Set Supabase Edge secrets** (project `zweqxjeuwwfrlpbuuayg`):
   ```bash
   supabase secrets set \
     GITHUB_APP_ID=123456 \
     GITHUB_APP_INSTALLATION_ID=78901234 \
     GITHUB_APP_PRIVATE_KEY="$(cat pocketedge-dispatch.pem)" \
     --project-ref zweqxjeuwwfrlpbuuayg
   ```

6. **Optional**: remove `GITHUB_DISPATCH_TOKEN` from edge secrets once App auth works.

7. **Redeploy** the edge function if needed:
   ```bash
   supabase functions deploy dispatch-github-workflow --project-ref zweqxjeuwwfrlpbuuayg
   ```

## Fallback: Personal access token (PAT)

Use when App setup is not done yet.

| Type | Expiry | Notes |
|------|--------|--------|
| **Classic PAT** | Can be **No expiration** | Preferred if org policy allows. Scopes: `repo`, `workflow`. |
| Fine-grained PAT | Max **1 year** | Will break again unless rotated. |

### Rotate PAT

```bash
GITHUB_DISPATCH_TOKEN=github_pat_... npm run rotate:github-dispatch
```

This verifies dispatch, updates Supabase edge secret, and Vercel production env (if CLI linked).

Set the same token in **Vercel** for weekly `asset-sync` cron (`/api/cron/dispatch-github/asset-sync`).

## Verify

```bash
# After PAT rotation or App setup — smoke test via Supabase (needs service role + DB token)
curl -sS -X POST "https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/dispatch-github-workflow" \
  -H "Content-Type: application/json" \
  -H "x-dispatch-token: $(psql ... or read from social_market_job_config)" \
  -d '{"job":"amc-inav"}'
```

Expect `{"ok":true,...}`.

## Jobs using dispatch

| Job | Cron | Workflow |
|-----|------|----------|
| `amc-inav` | pg_cron every 1m (NSE session) | `refresh-amc-etf-inav.yml` |
| `asset-sync` | Vercel weekly | `social-market-asset-sync.yml` |

Commodities and most price jobs **do not** use GitHub dispatch anymore.
