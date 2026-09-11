#!/usr/bin/env node
/**
 * `npm run poc` - get ConnectSphere running on this computer with one command.
 * The HELP text below is the user-facing description; `npm run poc -- --help` prints it.
 */
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import {
  IS_MAC,
  IS_WINDOWS,
  ROOT,
  capture,
  colour,
  commandExists,
  log,
  npmInvocation,
  requireUv,
  run,
} from './lib/tools.mjs'

const HELP = `npm run poc - get ConnectSphere running on this computer with one command.

Every step checks first and skips work that is already done, so it is safe to run daily.

  1. Node.js     checks the version (Node cannot install itself)
  2. Docker      installs Docker Desktop if missing (asks first), starts it if stopped
  3. uv          installs it if missing; uv then fetches Python 3.12 by itself
  4. Packages    npm packages (root, frontend) when package files changed; uv sync
  5. .env files  creates backend/.env and frontend/.env from the samples if missing
  6. Database    docker compose up, migrate, seed, verify
  7. DBeaver     offers once to install the free database viewer (remembers "no")
  8. App         starts the backend and frontend

Options go after --, for example: npm run poc -- --yes
  --yes           install everything without asking
  --skip-dbeaver  do not check for or offer DBeaver
  --no-start      prepare everything but do not start the servers
  --help          show this message
`

const KNOWN_OPTIONS = new Set(['--yes', '-y', '--skip-dbeaver', '--no-start', '--help', '-h'])
const argv = process.argv.slice(2)
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(HELP)
  process.exit(0)
}
const options = {
  yes: argv.includes('--yes') || argv.includes('-y'),
  skipDbeaver: argv.includes('--skip-dbeaver'),
  start: !argv.includes('--no-start'),
}
const interactive = Boolean(process.stdin.isTTY) && !process.env.CI

// Remembers answers such as "don't offer DBeaver again". Git-ignored.
const STATE_FILE = path.join(ROOT, '.poc-state.json')

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function saveState(patch) {
  writeFileSync(STATE_FILE, `${JSON.stringify({ ...readState(), ...patch }, null, 2)}\n`)
}

async function ask(question) {
  if (options.yes) return true
  if (!interactive) return false
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await prompt.question(`      ${question} [Y/n] `)).trim().toLowerCase()
    return answer === '' || answer === 'y' || answer === 'yes'
  } finally {
    prompt.close()
  }
}

async function waitFor(check, seconds) {
  const deadline = Date.now() + seconds * 1000
  let waiting = false
  while (Date.now() < deadline) {
    if (check()) {
      if (waiting) process.stdout.write('\n')
      return true
    }
    process.stdout.write(waiting ? '.' : '      waiting')
    waiting = true
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  if (waiting) process.stdout.write('\n')
  return false
}

// --- 1. Node.js ---------------------------------------------------------------------------
function checkNode() {
  log.step('Node.js')
  const major = Number(process.versions.node.split('.')[0])
  if (major < 22) {
    log.error(
      `Node.js ${process.versions.node} is too old. This project needs version 22 or newer.`,
    )
    log.info(
      IS_WINDOWS
        ? 'Install it with: winget install OpenJS.NodeJS.LTS'
        : IS_MAC
          ? 'Install it with: brew install node@22'
          : 'Install Node.js 22 from https://nodejs.org',
    )
    process.exit(1)
  }
  log.ok(`Node.js ${process.versions.node}`)
}

// --- 2. Docker ----------------------------------------------------------------------------
const DOCKER_DESKTOP_EXE = path.join(
  process.env.ProgramFiles ?? 'C:\\Program Files',
  'Docker',
  'Docker',
  'Docker Desktop.exe',
)

function dockerEngineRunning() {
  return capture('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 15_000 }).ok
}

async function ensureDocker() {
  log.step('Docker')
  if (!commandExists('docker')) {
    log.warn('Docker Desktop is not installed. It runs the project database.')
    const installer = IS_WINDOWS
      ? commandExists('winget') && [
          'winget',
          [
            'install',
            '-e',
            '--id',
            'Docker.DockerDesktop',
            '--accept-package-agreements',
            '--accept-source-agreements',
          ],
        ]
      : IS_MAC && commandExists('brew') && ['brew', ['install', '--cask', 'docker-desktop']]
    if (
      installer &&
      (await ask('Install Docker Desktop now? It needs admin rights and a few minutes.'))
    ) {
      if (run(...installer) === 0) {
        log.ok('Docker Desktop installed.')
        log.info('Open Docker Desktop once, accept its terms and wait for "Engine running".')
        log.info('Windows may ask you to restart first. Then run `npm run poc` again.')
        process.exit(1)
      }
      log.error('The Docker Desktop installation did not finish.')
    } else if (installer && !interactive) {
      log.info('Run `npm run poc -- --yes` to install it automatically.')
    }
    log.info(
      'Or install it from https://www.docker.com/products/docker-desktop/ and run `npm run poc` again.',
    )
    process.exit(1)
  }
  if (dockerEngineRunning()) {
    log.ok('Docker engine is running')
    return
  }
  log.warn('Docker is installed but its engine is not running. Starting Docker Desktop ...')
  if (IS_WINDOWS && existsSync(DOCKER_DESKTOP_EXE)) {
    spawn(DOCKER_DESKTOP_EXE, [], { detached: true, stdio: 'ignore' }).unref()
  } else if (IS_MAC) {
    run('open', ['-a', 'Docker'])
  } else {
    log.info('Start the Docker engine (for example `sudo systemctl start docker`), then try again.')
    process.exit(1)
  }
  if (await waitFor(dockerEngineRunning, 180)) {
    log.ok('Docker engine is running')
    return
  }
  log.error('Docker did not start within 3 minutes.')
  log.info('Open Docker Desktop, wait for "Engine running", then run `npm run poc` again.')
  process.exit(1)
}

// --- 3 and 4. Tools and packages ----------------------------------------------------------
function npmPackagesStale(dir) {
  // npm rewrites node_modules/.package-lock.json on every install, so a package file newer
  // than it means something changed since the last install (for example after `git pull`).
  const installedMarker = path.join(dir, 'node_modules', '.package-lock.json')
  if (!existsSync(installedMarker)) return true
  const installedAt = statSync(installedMarker).mtimeMs
  return ['package.json', 'package-lock.json'].some((file) => {
    const full = path.join(dir, file)
    return existsSync(full) && statSync(full).mtimeMs > installedAt
  })
}

function ensureNpmPackages(label, dir) {
  if (!npmPackagesStale(dir)) {
    log.ok(`${label} npm packages up to date`)
    return
  }
  log.info(`Installing ${label} npm packages ...`)
  for (const npmArgs of [
    ['ci', '--no-audit', '--no-fund'],
    ['install', '--no-audit', '--no-fund'],
  ]) {
    const npm = npmInvocation(npmArgs)
    if (run(npm.command, npm.args, { cwd: dir, shell: npm.shell }) === 0) {
      log.ok(`${label} npm packages installed`)
      return
    }
    if (npmArgs[0] === 'ci') log.warn('npm ci failed, retrying with npm install ...')
  }
  log.error(`Could not install the ${label} npm packages (see the output above).`)
  process.exit(1)
}

function ensureTools() {
  log.step('Tools and packages')
  const uv = requireUv()
  log.ok(capture(uv, ['--version']).stdout || 'uv')
  if (uv !== 'uv') {
    log.info(colour.dim(`uv is not on PATH. npm scripts still find it; to type \`uv\` yourself,`))
    log.info(colour.dim(`add ${path.dirname(uv)} to PATH.`))
  }
  ensureNpmPackages('root', ROOT)
  ensureNpmPackages('frontend', path.join(ROOT, 'frontend'))
  log.info('Syncing backend Python packages (uv downloads Python 3.12 if needed) ...')
  if (run(uv, ['--directory', 'backend', 'sync']) !== 0) {
    log.error('uv sync failed (see the output above).')
    process.exit(1)
  }
  log.ok('backend Python packages up to date')
  return uv
}

// --- 5. .env files ------------------------------------------------------------------------
function databaseSettings() {
  for (const file of ['backend/.env', 'backend/.env.sample']) {
    const full = path.join(ROOT, file)
    if (!existsSync(full)) continue
    const match = readFileSync(full, 'utf8').match(
      /^DATABASE_URL=[^\s:]+:\/\/([^:\s]+):([^@\s]+)@([^:/\s]+):(\d+)\/(\w+)/m,
    )
    if (match) {
      const [, user, password, host, port, database] = match
      return { user, password, host, port, database }
    }
  }
  return null
}

function ensureEnvFiles() {
  log.step('Environment files')
  for (const dir of ['backend', 'frontend']) {
    const envFile = path.join(ROOT, dir, '.env')
    const sample = path.join(ROOT, dir, '.env.sample')
    if (existsSync(envFile)) {
      log.ok(`${dir}/.env present`)
    } else if (existsSync(sample)) {
      copyFileSync(sample, envFile)
      log.ok(`created ${dir}/.env from ${dir}/.env.sample`)
    }
  }
  const composePort = readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8').match(
    /-\s*"(\d+):5432"/,
  )?.[1]
  const settings = databaseSettings()
  if (composePort && settings?.host === 'localhost' && settings.port !== composePort) {
    log.warn(
      `backend/.env uses port ${settings.port}, but the Docker database listens on ${composePort}.`,
    )
    log.info(
      `Change the port in DATABASE_URL to ${composePort} unless you run your own PostgreSQL.`,
    )
  }
}

// --- 6. Database --------------------------------------------------------------------------
function prepareDatabase(uv) {
  log.step('Database')
  if (run('docker', ['compose', 'up', '-d']) !== 0) {
    log.error('docker compose up failed (see the output above).')
    process.exit(1)
  }
  if (run(uv, ['--directory', 'backend', 'run', 'python', '-m', 'app.dbtool', 'ready']) !== 0) {
    log.error('The database is not ready (see the output above).')
    process.exit(1)
  }
}

// --- 7. DBeaver ---------------------------------------------------------------------------
function printViewerSettings() {
  const db = databaseSettings()
  if (!db) return
  log.info(colour.dim(`Viewer connection: PostgreSQL, host ${db.host}, port ${db.port},`))
  log.info(colour.dim(`database ${db.database}, user ${db.user}, password ${db.password}.`))
}

function dbeaverInstalled() {
  const candidates = IS_WINDOWS
    ? [
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'DBeaver', 'dbeaver.exe'),
        process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'DBeaver', 'dbeaver.exe'),
      ]
    : IS_MAC
      ? ['/Applications/DBeaver.app', path.join(homedir(), 'Applications', 'DBeaver.app')]
      : ['/usr/bin/dbeaver', '/usr/bin/dbeaver-ce', '/snap/bin/dbeaver-ce']
  if (candidates.some((candidate) => candidate && existsSync(candidate))) return true
  if (IS_WINDOWS && commandExists('winget')) {
    // Catches installs in unusual folders. Slower, so remember a positive answer.
    const listed = capture(
      'winget',
      ['list', '--id', 'DBeaver.DBeaver.Community', '-e', '--accept-source-agreements'],
      { timeout: 60_000 },
    ).ok
    if (listed) saveState({ dbeaver: 'installed' })
    return listed
  }
  return false
}

async function offerDbeaver() {
  log.step('Database viewer (DBeaver)')
  const state = readState()
  if (options.skipDbeaver || (state.dbeaver === 'declined' && !options.yes)) {
    log.info(colour.dim('skipped. `npm run poc -- --yes` installs DBeaver later.'))
    printViewerSettings()
    return
  }
  if (state.dbeaver === 'installed' || dbeaverInstalled()) {
    log.ok('DBeaver is installed')
    printViewerSettings()
    return
  }
  const installer =
    IS_WINDOWS && commandExists('winget')
      ? [
          'winget',
          [
            'install',
            '-e',
            '--id',
            'DBeaver.DBeaver.Community',
            '--accept-package-agreements',
            '--accept-source-agreements',
          ],
        ]
      : IS_MAC && commandExists('brew')
        ? ['brew', ['install', '--cask', 'dbeaver-community']]
        : null
  if (!installer) {
    log.info('Install DBeaver Community from https://dbeaver.io/download/ to browse the database.')
    printViewerSettings()
    return
  }
  if (!interactive && !options.yes) {
    log.info('DBeaver is not installed. `npm run poc -- --yes` installs it automatically.')
    printViewerSettings()
    return
  }
  if (!(await ask('DBeaver, a free database viewer, is not installed. Install it now?'))) {
    saveState({ dbeaver: 'declined' })
    log.info('Okay, not asking again. `npm run poc -- --yes` installs it later.')
    printViewerSettings()
    return
  }
  log.info('Installing DBeaver (one-time, takes a minute or two) ...')
  if (run(...installer) === 0) {
    saveState({ dbeaver: 'installed' })
    log.ok('DBeaver installed')
  } else {
    log.warn(
      'DBeaver could not be installed automatically. Get it from https://dbeaver.io/download/',
    )
  }
  printViewerSettings()
}

// --- 8. App -------------------------------------------------------------------------------
function startServers() {
  log.step('Starting backend (http://localhost:8000) and frontend (http://localhost:5173)')
  log.info(colour.dim('Press Ctrl+C to stop both.'))
  const npm = npmInvocation(['run', 'dev'])
  const child = spawn(npm.command, npm.args, { stdio: 'inherit', cwd: ROOT, shell: npm.shell })
  process.on('SIGINT', () => {})
  process.on('SIGTERM', () => child.kill('SIGTERM'))
  child.on('exit', (code) => process.exit(code ?? 0))
}

async function main() {
  console.log(colour.bold('ConnectSphere: preparing everything for local development'))
  for (const arg of argv) {
    if (!KNOWN_OPTIONS.has(arg))
      log.warn(`Ignoring unknown option ${arg} (see npm run poc -- --help)`)
  }
  checkNode()
  await ensureDocker()
  const uv = ensureTools()
  ensureEnvFiles()
  prepareDatabase(uv)
  await offerDbeaver()
  if (options.start) {
    startServers()
  } else {
    log.step('Everything is ready. Start the app with `npm run dev`.')
  }
}

main().catch((error) => {
  log.error(error?.stack ?? String(error))
  process.exit(1)
})
