#!/usr/bin/env node
/**
 * Fail OpenFin Vercel builds if the host-split SPA is missing.
 * Social builds skip this check (VERCEL_PROJECT_NAME !== openfin-pocketedge).
 */
import fs from 'node:fs';
import path from 'node:path';

const OPENFIN_PROJECT_ID = 'prj_tnqTbknIkuMpTUTsNIAMAlkw3E8i';
const OPENFIN_PROJECT_NAME = 'openfin-pocketedge';

const projectId = process.env.VERCEL_PROJECT_ID ?? '';
const projectName = process.env.VERCEL_PROJECT_NAME ?? '';
const isOpenFinBuild =
  projectId === OPENFIN_PROJECT_ID ||
  projectName === OPENFIN_PROJECT_NAME ||
  process.env.OPENFIN_BUILD === '1';

if (!isOpenFinBuild) {
  process.exit(0);
}

const root = process.cwd();
const requiredFiles = ['src/OpenFinApp.jsx', 'src/lib/openfinHost.js', 'src/main.jsx'];

const missing = requiredFiles.filter((rel) => !fs.existsSync(path.join(root, rel)));
if (missing.length) {
  console.error(
    `\n[verify-openfin-build] OpenFin deploy blocked — missing required files:\n  ${missing.join('\n  ')}\n`
  );
  process.exit(1);
}

const mainJsx = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
const markers = ['OpenFinApp', 'isOpenFinHost'];
const absent = markers.filter((m) => !mainJsx.includes(m));
if (absent.length) {
  console.error(
    `\n[verify-openfin-build] OpenFin deploy blocked — src/main.jsx missing: ${absent.join(', ')}\n`
  );
  process.exit(1);
}

console.log('[verify-openfin-build] OpenFin host split present — build may proceed.');
