// One-command release:
//   1. builds the installer with electron-builder
//   2. uploads it to a GitHub release (as a draft, electron-builder's default)
//   3. flips that release to "published / latest" so auto-update can see it
//
// Auth: uses GH_TOKEN if set, otherwise pulls a token from the GitHub CLI
// (`gh auth token`). The token is never printed.
const { spawnSync, execSync } = require('child_process');
const path = require('path');

const pkg = require(path.join('..', 'package.json'));
const version = pkg.version;
const repo = `${pkg.build.publish[0].owner}/${pkg.build.publish[0].repo}`;

function gh(args, opts = {}) {
  // Resolve gh whether or not it's on PATH yet.
  const candidates = ['gh', `${process.env.ProgramFiles}\\GitHub CLI\\gh.exe`];
  for (const bin of candidates) {
    const r = spawnSync(bin, args, { encoding: 'utf8', ...opts });
    if (r.error == null) return r;
  }
  throw new Error('GitHub CLI (gh) not found. Run "gh auth login" first.');
}

// Ensure we have a token for electron-builder's GitHub publisher.
let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  const r = gh(['auth', 'token']);
  if (r.status !== 0) {
    console.error('Could not get a GitHub token. Run "gh auth login" first.');
    process.exit(1);
  }
  token = r.stdout.trim();
}

console.log(`\n=== Building & publishing Platform Racer v${version} -> ${repo} ===\n`);

// 0: push source + tags so the public repo stays in sync with each release.
try {
  execSync('git push origin HEAD --follow-tags', { stdio: 'inherit' });
} catch (e) {
  console.warn('Warning: git push failed (continuing with the release upload).');
}

// 1 + 2: build and upload (draft release).
const build = spawnSync('npx', ['electron-builder', '--publish', 'always'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, GH_TOKEN: token },
});
if (build.status !== 0) {
  console.error('\nBuild/publish failed.');
  process.exit(build.status || 1);
}

// 3: flip the draft to a published "latest" release.
console.log(`\n=== Marking v${version} as the latest published release ===\n`);
const edit = gh(
  ['release', 'edit', `v${version}`, '--repo', repo, '--draft=false', '--latest'],
  { stdio: 'inherit', env: { ...process.env, GH_TOKEN: token } }
);
if (edit.status !== 0) {
  console.error('Failed to publish the draft release. You can do it manually with:');
  console.error(`  gh release edit v${version} --repo ${repo} --draft=false --latest`);
  process.exit(edit.status || 1);
}

console.log(`\nDone. v${version} is live: https://github.com/${repo}/releases/tag/v${version}\n`);
