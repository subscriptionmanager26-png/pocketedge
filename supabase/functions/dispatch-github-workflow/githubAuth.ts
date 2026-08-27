import jwt from 'npm:jsonwebtoken@9';

/** Short-lived JWT signed with the GitHub App private key. */
export function createGitHubAppJwt(appId: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({}, privateKeyPem, {
    algorithm: 'RS256',
    issuer: appId,
    issuedAt: now - 60,
    expiresIn: '9m',
  });
}

/** Exchange app JWT for a 1-hour installation token (minted on every dispatch). */
export async function getGitHubInstallationToken(
  appId: string,
  privateKeyPem: string,
  installationId: string,
): Promise<string> {
  const appJwt = createGitHubAppJwt(appId, privateKeyPem);
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${appJwt}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'pocketedge-supabase-dispatch',
      },
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub installation token failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const payload = JSON.parse(text) as { token?: string };
  if (!payload.token) {
    throw new Error('GitHub installation token response missing token');
  }
  return payload.token;
}

/**
 * Prefer GitHub App (private key never expires; tokens minted per request).
 * Fall back to GITHUB_DISPATCH_TOKEN PAT when App env is not configured.
 */
export async function resolveGitHubDispatchToken(): Promise<{
  token: string;
  source: 'github-app' | 'pat';
}> {
  const appId = Deno.env.get('GITHUB_APP_ID')?.trim();
  const installationId = Deno.env.get('GITHUB_APP_INSTALLATION_ID')?.trim();
  let privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY') ?? '';
  privateKey = privateKey.replace(/\\n/g, '\n').trim();

  if (appId && installationId && privateKey) {
    const token = await getGitHubInstallationToken(appId, privateKey, installationId);
    return { token, source: 'github-app' };
  }

  const pat = Deno.env.get('GITHUB_DISPATCH_TOKEN')?.trim() ?? '';
  if (!pat) {
    throw new Error(
      'Missing GitHub auth: set GITHUB_APP_ID + GITHUB_APP_INSTALLATION_ID + GITHUB_APP_PRIVATE_KEY ' +
        'or GITHUB_DISPATCH_TOKEN',
    );
  }
  return { token: pat, source: 'pat' };
}
