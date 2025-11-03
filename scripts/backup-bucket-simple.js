#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = 'nearby_listings'
const BACKUP_DIR = path.join(__dirname, '..', 'backups')
const TEMP_DIR = path.join(BACKUP_DIR, 'temp')

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
}

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[✓]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[!]${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}[✗]${colors.reset} ${msg}`),
  progress: (msg) => console.log(`${colors.blue}[•]${colors.reset} ${msg}`)
}

async function ensureDirectories() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }
}

async function recursiveListFiles(supabase, path = '', allFiles = []) {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(path, {
    limit: 10000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  })

  if (error) {
    log.warn(`Failed to list path ${path}: ${error.message}`)
    return allFiles
  }

  for (const item of data) {
    const fullPath = path ? `${path}/${item.name}` : item.name
    if (item.id) {
      allFiles.push({
        name: item.name,
        fullPath,
        isDir: false,
        size: item.metadata?.size || 0
      })
    } else {
      await recursiveListFiles(supabase, fullPath, allFiles)
    }
  }

  return allFiles
}

async function downloadFile(supabase, filePath, localPath) {
  return new Promise((resolve, reject) => {
    const { data, error } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)
    
    if (error) {
      reject(error)
      return
    }

    const url = data.publicUrl
    const file = fs.createWriteStream(localPath)

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }

      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(localPath, () => {})
      reject(err)
    })
  })
}

async function createZipWithSystemCommand() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  const zipPath = path.join(BACKUP_DIR, `nearby_listings_backup_${timestamp}.zip`)

  try {
    log.progress(`Creating zip with system command...`)
    execSync(`cd "${TEMP_DIR}" && zip -r "${zipPath}" . -q`, { stdio: 'inherit' })
    return zipPath
  } catch (err) {
    throw new Error(`Failed to create zip: ${err.message}`)
  }
}

async function cleanup() {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true })
    log.info('Cleaned up temporary files')
  }
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  Supabase Bucket Backup Tool')
  console.log('='.repeat(60) + '\n')

  try {
    if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
      log.error('Missing PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY')
      process.exit(1)
    }

    await ensureDirectories()
    log.success('Directories ready')

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
    log.success('Supabase client initialized')

    log.progress('Scanning bucket structure...')
    const files = await recursiveListFiles(supabase)

    if (files.length === 0) {
      log.warn('No files found in bucket')
      process.exit(0)
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2)
    log.success(`Total files: ${files.length}`)
    log.success(`Total size: ${totalSizeMB} MB`)

    log.progress(`Downloading ${files.length} files (this may take a while for 2GB)...`)
    
    let downloaded = 0
    let failed = 0
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const localPath = path.join(TEMP_DIR, file.fullPath)
      const localDir = path.dirname(localPath)

      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true })
      }

      try {
        await downloadFile(supabase, file.fullPath, localPath)
        downloaded++
      } catch (err) {
        failed++
        log.warn(`Failed to download ${file.fullPath}: ${err.message}`)
      }

      if ((i + 1) % 10 === 0) {
        const progress = Math.round(((i + 1) / files.length) * 100)
        process.stdout.write(`\r${colors.blue}[•]${colors.reset} Downloaded ${downloaded}/${files.length} (${progress}%) - Failed: ${failed}`)
      }
    }
    console.log('')
    log.success(`Downloaded ${downloaded}/${files.length} files`)

    if (failed > 0) {
      log.warn(`${failed} files failed to download`)
    }

    const zipPath = await createZipWithSystemCommand()

    log.success(`\n✓ Backup completed!`)
    log.info(`Archive saved to: ${zipPath}`)
    log.success(`Download this file and upload to Google Drive or Dropbox`)
    log.success(`Once uploaded, run: npm run delete-bucket to remove the original files`)

    await cleanup()

  } catch (err) {
    log.error(`Error: ${err.message}`)
    await cleanup()
    process.exit(1)
  }
}

main()
