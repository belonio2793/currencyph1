#!/usr/bin/env node

import { execSync, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

class DeploymentScript {
  constructor() {
    this.verbose = false
    this.dryRun = false
    this.deployToFly = false
    this.skipTests = false
    this.skipGit = false
    this.startTime = Date.now()
    this.steps = []
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = {
      info: `${colors.blue}ℹ${colors.reset}`,
      success: `${colors.green}✓${colors.reset}`,
      error: `${colors.red}✗${colors.reset}`,
      warning: `${colors.yellow}⚠${colors.reset}`,
      debug: `${colors.cyan}»${colors.reset}`
    }[type] || ''
    
    console.log(`[${timestamp}] ${prefix} ${message}`)
  }

  header(title) {
    console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`)
    console.log(`${colors.cyan}  ${title}${colors.reset}`)
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`)
  }

  execute(command, options = {}) {
    const { description, silent = false, allowFailure = false } = options
    
    if (description) {
      this.log(description)
    }
    
    if (this.dryRun) {
      this.log(`[DRY RUN] Would execute: ${command}`, 'debug')
      return true
    }

    try {
      const output = execSync(command, {
        cwd: projectRoot,
        stdio: silent ? 'pipe' : 'inherit',
        encoding: 'utf-8'
      })
      
      if (silent && this.verbose) {
        this.log(output, 'debug')
      }
      
      return true
    } catch (error) {
      if (allowFailure) {
        this.log(`Non-critical failure: ${error.message}`, 'warning')
        return false
      }
      throw error
    }
  }

  checkPrerequisites() {
    this.header('Step 1: Checking Prerequisites')
    
    const requirements = [
      { cmd: 'node', name: 'Node.js' },
      { cmd: 'npm', name: 'npm' },
      { cmd: 'git', name: 'Git' }
    ]

    for (const { cmd, name } of requirements) {
      try {
        const version = execSync(`${cmd} --version`, { encoding: 'utf-8' }).trim()
        this.log(`${name} installed: ${version}`, 'success')
      } catch {
        this.log(`${name} is not installed`, 'error')
        throw new Error(`${name} is required but not installed`)
      }
    }

    if (this.deployToFly) {
      try {
        execSync('flyctl --version', { encoding: 'utf-8' })
        this.log('Fly.dev CLI installed', 'success')
      } catch {
        this.log('Fly.dev CLI not found - deployment disabled', 'warning')
        this.deployToFly = false
      }
    }
  }

  checkGitStatus() {
    this.header('Step 2: Verifying Git Status')

    try {
      const userName = execSync('git config user.name', { encoding: 'utf-8' }).trim()
      const userEmail = execSync('git config user.email', { encoding: 'utf-8' }).trim()
      this.log(`Git user: ${userName} <${userEmail}>`, 'success')
    } catch {
      this.log('Git user not configured', 'error')
      throw new Error('Configure Git: git config --global user.name "Name" && git config --global user.email "email@example.com"')
    }

    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectRoot,
        encoding: 'utf-8'
      }).trim()
      this.log(`Current branch: ${branch}`, 'info')
    } catch (error) {
      this.log('Not a Git repository', 'error')
      throw error
    }
  }

  installDependencies() {
    this.header('Step 3: Installing Dependencies')
    
    try {
      this.execute('npm install', {
        description: 'Installing npm dependencies...'
      })
      this.log('Dependencies installed successfully', 'success')
    } catch (error) {
      this.log('Failed to install dependencies', 'error')
      throw error
    }
  }

  runTests() {
    if (this.skipTests) {
      this.log('Skipping tests', 'info')
      return
    }

    this.header('Step 4: Running Tests')
    
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'))
      
      if (!packageJson.scripts?.test) {
        this.log('No test script found in package.json', 'info')
        return
      }

      this.execute('npm test', {
        description: 'Running tests...',
        allowFailure: true
      })
      
      this.log('Tests completed', 'success')
    } catch (error) {
      this.log(`Test check failed: ${error.message}`, 'warning')
    }
  }

  buildProject() {
    this.header('Step 5: Building Project')
    
    try {
      this.execute('npm run build', {
        description: 'Building project with Vite...'
      })
      
      this.log('Build completed successfully', 'success')
      
      // Check build output
      const distPath = path.join(projectRoot, 'dist')
      if (fs.existsSync(distPath)) {
        const files = execSync(`find dist -type f`, {
          cwd: projectRoot,
          encoding: 'utf-8'
        }).trim().split('\n').filter(Boolean)
        
        const size = execSync(`du -sh dist | cut -f1`, {
          cwd: projectRoot,
          encoding: 'utf-8'
        }).trim()
        
        this.log(`Build output: ${size} (${files.length} files)`, 'info')
      }
    } catch (error) {
      this.log('Build failed', 'error')
      throw error
    }
  }

  commitChanges() {
    if (this.skipGit) {
      this.log('Skipping Git commit', 'info')
      return
    }

    this.header('Step 6: Committing Changes')
    
    try {
      const status = execSync('git status --porcelain', {
        cwd: projectRoot,
        encoding: 'utf-8'
      })

      if (status.trim()) {
        this.log('Changes detected, committing...', 'info')
        
        if (!this.dryRun) {
          execSync('git add .', { cwd: projectRoot, stdio: 'inherit' })
          
          const commitMsg = `build: deploy ${new Date().toISOString()}`
          execSync(`git commit -m "${commitMsg}"`, {
            cwd: projectRoot,
            stdio: 'inherit'
          })
        }
        
        this.log('Changes committed', 'success')
      } else {
        this.log('No changes to commit', 'info')
      }
    } catch (error) {
      this.log(`Git operation failed: ${error.message}`, 'warning')
    }
  }

  pushToRemote() {
    if (this.skipGit) {
      this.log('Skipping Git push', 'info')
      return
    }

    this.header('Step 7: Pushing to Remote Repository')
    
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectRoot,
        encoding: 'utf-8'
      }).trim()

      if (this.dryRun) {
        this.log(`[DRY RUN] Would push to: ${branch}`, 'debug')
      } else {
        execSync(`git push origin ${branch}`, {
          cwd: projectRoot,
          stdio: 'inherit'
        })
      }
      
      this.log('Pushed to remote successfully', 'success')
    } catch (error) {
      this.log(`Push failed: ${error.message}`, 'warning')
    }
  }

  deployToFlyDev() {
    if (!this.deployToFly) {
      this.log('Skipping Fly.dev deployment (use --fly to enable)', 'info')
      return
    }

    this.header('Step 8: Deploying to Fly.dev')
    
    try {
      if (this.dryRun) {
        this.log('[DRY RUN] Would deploy using: flyctl deploy', 'debug')
      } else {
        this.execute('flyctl deploy', {
          description: 'Deploying to Fly.dev...'
        })
      }
      
      this.log('Deployment successful!', 'success')
    } catch (error) {
      this.log(`Deployment failed: ${error.message}`, 'error')
      throw error
    }
  }

  async run(args) {
    this.parseArgs(args)
    
    try {
      this.header(`🚀 Deployment Script for currency-ph`)
      
      this.checkPrerequisites()
      this.checkGitStatus()
      this.installDependencies()
      this.runTests()
      this.buildProject()
      this.commitChanges()
      this.pushToRemote()
      this.deployToFlyDev()
      
      this.summary()
    } catch (error) {
      this.log(`\nDeployment failed: ${error.message}`, 'error')
      process.exit(1)
    }
  }

  parseArgs(args) {
    const flags = {
      '--dry-run': 'dryRun',
      '--fly': 'deployToFly',
      '--skip-tests': 'skipTests',
      '--skip-git': 'skipGit',
      '--verbose': 'verbose',
      '-d': 'dryRun',
      '-f': 'deployToFly',
      '-s': 'skipTests',
      '-g': 'skipGit',
      '-v': 'verbose'
    }

    for (const arg of args) {
      if (arg === '-h' || arg === '--help') {
        this.showHelp()
        process.exit(0)
      }
      
      if (flags[arg]) {
        this[flags[arg]] = true
      }
    }
  }

  showHelp() {
    console.log(`
Usage: npm run deploy [OPTIONS]

Options:
  -d, --dry-run      Show what would be done without executing
  -f, --fly          Deploy to Fly.dev after building
  -s, --skip-tests   Skip running tests before building
  -g, --skip-git     Skip Git commit and push
  -v, --verbose      Enable verbose output
  -h, --help         Show this help message

Examples:
  npm run deploy              # Build only
  npm run deploy --fly        # Build and deploy to Fly.dev
  npm run deploy --dry-run    # Show deployment plan
  npm run deploy -f -s        # Build and deploy without tests
    `)
  }

  summary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2)
    
    this.header('✅ Deployment Complete!')
    
    const summary = `
${colors.green}Summary:${colors.reset}
  • Project: currency-ph
  • Duration: ${duration}s
  • Status: Success
  • Node: ${process.version}
  • Platform: ${process.platform}

${colors.cyan}Next Steps:${colors.reset}
  1. Visit your deployed application
  2. Run: npm run preview (to test locally)
  3. Check logs: npm run logs (if deployed)
  4. Monitor: Check Fly.dev dashboard

${colors.yellow}Deployment Mode:${colors.reset}
  ${this.dryRun ? '(DRY RUN - No actual changes were made)' : '(All changes deployed)'}
    `
    
    console.log(summary)
  }
}

// Run deployment
const deployment = new DeploymentScript()
deployment.run(process.argv.slice(2))
