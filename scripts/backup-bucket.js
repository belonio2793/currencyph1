#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

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

async function listBucketFiles(supabase) {
  log.info(`Listing files in bucket: ${BUCKET_NAME}`)
  
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list('', {
    limit: 10000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  })

  if (error) {
    throw new Error(`Failed to list bucket files: ${error.message}`)
  }

  log.success(`Found ${data.length} items in bucket`)
  return data
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

async function createZipArchive(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2)
      log.success(`Archive created: ${outputPath}`)
      log.success(`Archive size: ${sizeMB} MB`)
      resolve()
    })

    archive.on('error', (err) => {
      reject(err)
    })

    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
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

    log.progress(`Downloading ${files.length} files...`)
    
    let downloaded = 0
    for (const file of files) {
      const localPath = path.join(TEMP_DIR, file.fullPath)
      const localDir = path.dirname(localPath)

      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true })
      }

      try {
        await downloadFile(supabase, file.fullPath, localPath)
        downloaded++
        const progress = Math.round((downloaded / files.length) * 100)
        process.stdout.write(`\r${colors.blue}[•]${colors.reset} Downloaded ${downloaded}/${files.length} (${progress}%)`)
      } catch (err) {
        log.warn(`Failed to download ${file.fullPath}: ${err.message}`)
      }
    }
    console.log('')

    log.progress('Creating zip archive...')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const zipPath = path.join(BACKUP_DIR, `nearby_listings_backup_${timestamp}.zip`)

    await createZipArchive(TEMP_DIR, zipPath)

    log.success(`\nBackup completed!`)
    log.success(`Archive saved to: ${zipPath}`)
    log.info(`You can now download and upload this file to Google Drive or Dropbox`)

    await cleanup()

  } catch (err) {
    log.error(`Error: ${err.message}`)
    await cleanup()
    process.exit(1)
  }
}

main()
