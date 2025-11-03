#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import readline from 'readline'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = 'nearby_listings'

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
  error: (msg) => console.error(`${colors.red}[✗]${colors.reset} ${msg}`)
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
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
      allFiles.push(fullPath)
    } else {
      await recursiveListFiles(supabase, fullPath, allFiles)
    }
  }

  return allFiles
}

async function deleteFilesFromBucket(supabase, files) {
  log.warn(`\nDeleting ${files.length} files from bucket...`)
  
  let deleted = 0
  let failed = 0

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath])

    if (error) {
      failed++
      log.warn(`Failed to delete ${filePath}: ${error.message}`)
    } else {
      deleted++
    }

    if ((i + 1) % 50 === 0) {
      const progress = Math.round(((i + 1) / files.length) * 100)
      process.stdout.write(`\r${colors.blue}[•]${colors.reset} Deleted ${deleted}/${files.length} (${progress}%)`)
    }
  }
  console.log('')
  
  log.success(`Deleted ${deleted}/${files.length} files`)
  if (failed > 0) {
    log.warn(`${failed} files failed to delete`)
  }
}

async function clearDatabaseReferences(supabase) {
  log.info('Clearing image URL references from database...')

  const { error } = await supabase
    .from('nearby_listings')
    .update({
      image_urls: [],
      primary_image_url: null,
      stored_image_path: null,
      image_downloaded_at: null
    })
    .is('image_urls', 'not.is.null')

  if (error) {
    log.warn(`Database update warning: ${error.message}`)
  } else {
    log.success('Cleared database references')
  }
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  ${colors.red}DELETE BUCKET - DESTRUCTIVE OPERATION${colors.reset}')
  console.log('='.repeat(60) + '\n')

  try {
    if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
      log.error('Missing PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY')
      process.exit(1)
    }

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
    log.success('Supabase client initialized')

    log.info('Scanning bucket for files...')
    const files = await recursiveListFiles(supabase)

    if (files.length === 0) {
      log.warn('No files found in bucket')
      process.exit(0)
    }

    log.warn(`\n⚠️  Found ${files.length} files in the bucket`)
    log.error('WARNING: This will permanently delete all files!')
    log.error('This action cannot be undone.')

    const confirm1 = await prompt(`\n${colors.yellow}Type "DELETE" to confirm deletion: ${colors.reset}`)
    if (confirm1 !== 'DELETE') {
      log.warn('Deletion cancelled')
      process.exit(0)
    }

    const confirm2 = await prompt(`${colors.red}Type "DELETE ALL" to confirm permanently deleting ALL files: ${colors.reset}`)
    if (confirm2 !== 'DELETE ALL') {
      log.warn('Deletion cancelled')
      process.exit(0)
    }

    await deleteFilesFromBucket(supabase, files)
    await clearDatabaseReferences(supabase)

    log.success('\n✓ Bucket cleanup completed!')
    log.info('All files have been deleted and database references cleared')

  } catch (err) {
    log.error(`Error: ${err.message}`)
    process.exit(1)
  }
}

main()
