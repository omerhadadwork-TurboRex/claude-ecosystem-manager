#!/usr/bin/env node
/**
 * CLI entry point for Claude Ecosystem Manager.
 * Usage: npx claude-ecosystem-manager [--port 3847] [--no-open] [--claude-dir path]
 */
import path from 'path'
import os from 'os'
import { parseArgs } from 'node:util'
import { startServer } from '../server/index.js'

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '3847', short: 'p' },
    'no-open': { type: 'boolean', default: false },
    'claude-dir': { type: 'string', short: 'd' },
    help: { type: 'boolean', default: false, short: 'h' },
  },
  strict: false,
})

if (values.help) {
  console.log(`
  Claude Ecosystem Manager — Visualize & manage your Claude Code setup

  Usage:
    claude-ecosystem [options]

  Options:
    -p, --port <number>      Port to run on (default: 3847)
    -d, --claude-dir <path>  Path to .claude directory (default: ~/.claude)
    --no-open                Don't open browser automatically
    -h, --help               Show this help

  Examples:
    claude-ecosystem
    claude-ecosystem --port 4000
    claude-ecosystem --claude-dir /custom/path/.claude
`)
  process.exit(0)
}

const port = parseInt(values.port as string || '3847', 10)
const claudeDir = (values['claude-dir'] as string) || path.join(os.homedir(), '.claude')

async function main() {
  console.log('\n  Starting Claude Ecosystem Manager...\n')

  await startServer({ port, claudeDir })

  // Open browser unless --no-open
  if (!values['no-open']) {
    const url = `http://localhost:${port}`
    try {
      const open = await import('open')
      await open.default(url)
    } catch {
      console.log(`  Open in your browser: ${url}\n`)
    }
  }
}

main().catch((err) => {
  console.error('Failed to start:', err.message)
  process.exit(1)
})
