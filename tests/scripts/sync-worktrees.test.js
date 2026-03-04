import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'bin/sync-worktrees.sh');

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@test.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@test.com',
  PATH: process.env.PATH,
  HOME: process.env.HOME
};

let tmpDir;
let originDir;
let mainDir;
let wtDir;

function run(cmd, cwd) {
  return execSync(cmd, {
    cwd,
    env: GIT_ENV,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}

function setupRepos() {
  const seedDir = path.join(tmpDir, 'seed');
  originDir = path.join(tmpDir, 'origin.git');
  mainDir = path.join(tmpDir, 'kata-orchestrator');
  wtDir = path.join(tmpDir, 'kata-orchestrator.worktrees');

  fs.mkdirSync(seedDir, { recursive: true });
  run('git init -b main', seedDir);
  fs.writeFileSync(path.join(seedDir, 'README.md'), 'base\n');
  run('git add README.md', seedDir);
  run('git commit -m "init"', seedDir);

  run(`git init --bare "${originDir}"`, tmpDir);
  run(`git remote add origin "${originDir}"`, seedDir);
  run('git push -u origin main', seedDir);

  run(`git clone "${originDir}" "${mainDir}"`, tmpDir);
  run('git switch -c main --track origin/main', mainDir);
  fs.mkdirSync(wtDir, { recursive: true });

  run(`git worktree add "${path.join(wtDir, 'wt-a')}" -b wt-a-standby main`, mainDir);
  run(`git worktree add "${path.join(wtDir, 'wt-b')}" -b wt-b-standby main`, mainDir);
}

function pushMainCommitFromUpdater() {
  const updaterDir = path.join(tmpDir, 'updater');
  run(`git clone "${originDir}" "${updaterDir}"`, tmpDir);
  run('git switch -c main --track origin/main', updaterDir);
  fs.writeFileSync(path.join(updaterDir, 'README.md'), 'base\nchange\n');
  run('git add README.md', updaterDir);
  run('git commit -m "advance main"', updaterDir);
  run('git push origin main', updaterDir);
}

describe('sync-worktrees.sh', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kata-sync-worktrees-test-'));
    setupRepos();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('repairs stale main index/worktree and syncs standby worktrees in one run', () => {
    pushMainCommitFromUpdater();

    // Bring in origin/main, then move local main ref without updating files/index.
    run('git fetch origin main', mainDir);
    const targetSha = run('git rev-parse origin/main', mainDir);
    run(`git update-ref refs/heads/main ${targetSha}`, mainDir);

    // Verify repo is in the same kind of "stale index vs ref" mismatch.
    const preStatus = run('git status --short', mainDir);
    assert.ok(preStatus.length > 0, 'expected non-clean main before sync');

    execSync(`bash "${SCRIPT}"`, {
      cwd: ROOT,
      env: {
        ...GIT_ENV,
        MAIN_DIR: mainDir,
        WT_DIR: wtDir
      },
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const postStatus = run('git status --short', mainDir);
    assert.strictEqual(postStatus, '', 'main checkout should be clean after sync');
    assert.strictEqual(run('git rev-parse HEAD', mainDir), targetSha, 'main should match origin/main');

    const wtAPath = path.join(wtDir, 'wt-a');
    const wtBPath = path.join(wtDir, 'wt-b');
    assert.strictEqual(run('git branch --show-current', wtAPath), 'wt-a-standby');
    assert.strictEqual(run('git branch --show-current', wtBPath), 'wt-b-standby');
    assert.strictEqual(run('git rev-parse HEAD', wtAPath), targetSha, 'wt-a should match target');
    assert.strictEqual(run('git rev-parse HEAD', wtBPath), targetSha, 'wt-b should match target');
  });
});
