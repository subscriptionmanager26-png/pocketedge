/** Stable content fingerprint — use for Excel where filenames commonly collide. */
export async function hashFileContent(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Screenshots are usually uniquely named; name + size is enough to skip re-uploads. */
export function screenshotDedupeKey(file) {
  const name = String(file?.name ?? '')
    .trim()
    .toLowerCase();
  const size = Number(file?.size) || 0;
  return `${name}::${size}`;
}
