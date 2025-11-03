#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
}

function log(color, message) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

function section(title) {
  console.log('\n' + '='.repeat(80))
  log('bright', title)
  console.log('='.repeat(80))
}

function reportAnalysis() {
  section('PHASE 1: CODE ANALYSIS')
  
  const srcDir = path.join(__dirname, '../src')
  const files = {
    rpm: [],
    sprites: [],
    gameComponents: [],
    threeJs: [],
    gameLogic: []
  }

  // Scan files
  const scanDir = (dir, category) => {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true })
      items.forEach(item => {
        const fullPath = path.join(dir, item.name)
        const relativePath = path.relative(srcDir, fullPath)
        
        if (item.isDirectory()) {
          scanDir(fullPath, category)
        } else if (item.isFile() && item.name.endsWith('.jsx')) {
          const content = fs.readFileSync(fullPath, 'utf8')
          
          if (content.includes('AvatarCreatorRPM') || content.includes('readyplayer')) {
            files.rpm.push(relativePath)
          }
          if (content.includes('Sprite') || content.includes('sprite')) {
            files.sprites.push(relativePath)
          }
          if (content.includes('three') || content.includes('THREE')) {
            files.threeJs.push(relativePath)
          }
          if (content.includes('GameProperties') || content.includes('Marketplace') || content.includes('Inventory')) {
            files.gameLogic.push(relativePath)
          }
        }
      })
    } catch (e) {
      console.error(`Error scanning ${dir}:`, e.message)
    }
  }

  scanDir(srcDir, 'all')

  log('yellow', '\n📦 ReadyPlayer.me References:')
  files.rpm.forEach(f => log('blue', `  - ${f}`))

  log('yellow', '\n🎨 Sprite System Files:')
  files.sprites.forEach(f => log('blue', `  - ${f}`))

  log('yellow', '\n🔮 Three.js References:')
  files.threeJs.forEach(f => log('blue', `  - ${f}`))

  log('yellow', '\n🎮 Game Logic Files:')
  files.gameLogic.forEach(f => log('blue', `  - ${f}`))

  return files
}

function createBackup() {
  section('CREATING BACKUP')
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(__dirname, `../backups/refactor-${timestamp}`)
  
  try {
    execSync(`mkdir -p ${backupDir}`, { stdio: 'inherit' })
    execSync(`cp -r src ${backupDir}/src`, { stdio: 'inherit' })
    execSync(`cp package.json ${backupDir}/package.json`, { stdio: 'inherit' })
    log('green', `✓ Backup created at: ${backupDir}`)
    return backupDir
  } catch (e) {
    log('red', `✗ Backup failed: ${e.message}`)
    return null
  }
}

function phase1FixAvatarPersistence() {
  section('PHASE 1: FIX AVATAR PERSISTENCE')

  log('yellow', '\nStep 1: Analyzing avatar persistence issues...')
  
  const issues = {
    rpmNotSaving: 'ReadyPlayer.me avatars not persisting to database',
    schemaInconsistency: 'Appearance schema has multiple avatar storage paths',
    missingFallback: 'No fallback when RPM fails'
  }

  Object.entries(issues).forEach(([key, issue]) => {
    log('blue', `  ⚠ ${issue}`)
  })

  log('yellow', '\nStep 2: Recommendations for Phase 1...')
  log('green', `
  1. Update game_characters table schema:
     - Standardize appearance.sprite object
     - Keep appearance.rpm for legacy users (read-only)
     - Add sprite_version field for versioning

  2. Create migration for existing avatars:
     - Extract any RPM data from appearance objects
     - Convert to sprite customization defaults
     - Set migration_date timestamp

  3. Update gameAPI.js:
     - Fix appearance saving logic
     - Use sprite as primary, RPM as fallback only
     - Add validation before save

  4. Create new SpriteCustomizer component:
     - Replace AvatarCreatorRPM in UI
     - Store directly to appearance.sprite
     - Add preview functionality
  `)

  return true
}

function phase2DesignUIUX() {
  section('PHASE 2: REDESIGN UI/UX')

  log('yellow', '\nStep 1: Identifying UI/UX components to improve...')

  const components = [
    'PlayCurrency.jsx - Main game page layout',
    'IsometricGameMap.jsx - Game world rendering',
    'GameProperties.jsx - Property management UI',
    'GameMarketplace.jsx - Trading interface',
    'Navbar.jsx - Top navigation bar',
    'GameSettings.jsx - User preferences'
  ]

  components.forEach(c => log('blue', `  📱 ${c}`))

  log('yellow', '\nStep 2: Modern design improvements...')
  log('green', `
  1. Visual Design:
     - Replace dark theme with modern gradient
     - Add glass-morphism cards
     - Improve typography (use CSS variables)
     - Add smooth animations/transitions
     - Mobile-first responsive design

  2. Component Redesign:
     - Game World: Add immersive first-person view
     - Properties: Card-based grid layout
     - Marketplace: Product showcase design
     - Navigation: Sticky tabs with smooth scrolling
     - Modals: Improved dialog styling

  3. User Experience:
     - Add loading states and transitions
     - Better error messages and feedback
     - Reduced cognitive load with better hierarchy
     - Touch-friendly buttons and interactions
     - Dark mode support

  4. Accessibility:
     - ARIA labels for game controls
     - Keyboard navigation support
     - High contrast mode option
     - Screen reader optimizations
  `)

  return true
}

function phase3GameEngineModernization() {
  section('PHASE 3: GAME ENGINE MODERNIZATION')

  log('yellow', '\nStep 1: Evaluating modern game engines...')

  const engines = {
    'Phaser 3': {
      pros: 'Excellent isometric support, lightweight, great 2D',
      cons: 'Limited 3D capabilities',
      effort: 'Medium'
    },
    'Babylon.js': {
      pros: 'Best 3D quality, modern, good documentation',
      cons: 'Heavier bundle, steeper learning curve',
      effort: 'High'
    },
    'Three.js + Phaser': {
      pros: 'Best of both worlds, 2D/3D toggle easy',
      cons: 'Complex integration, more code',
      effort: 'Very High'
    },
    'PlayCanvas': {
      pros: 'Cloud-native, best multiplayer, modern visuals',
      cons: 'Vendor lock-in, higher costs',
      effort: 'Medium'
    }
  }

  Object.entries(engines).forEach(([name, details]) => {
    log('blue', `\n  🎮 ${name}`)
    log('green', `     Pros: ${details.pros}`)
    log('yellow', `     Cons: ${details.cons}`)
    log('yellow', `     Effort: ${details.effort}`)
  })

  log('yellow', '\nStep 2: Implementation strategy...')
  log('green', `
  RECOMMENDED: Phaser 3 + Babylon.js hybrid

  1. Phaser 3 for 2D:
     - Isometric tile rendering
     - Property grid display
     - Character movement
     - Mobile performance

  2. Babylon.js for 3D:
     - First-person street view
     - Property visualization
     - Character models
     - Environmental details

  3. 2D/3D Toggle:
     - Unified state management
     - Smooth view transitions
     - Same game logic for both
     - Progressive enhancement

  4. Integration Steps:
     - Install: npm install phaser babylon
     - Create wrapper components
     - Migrate Three.js to Babylon
     - Build 2D/3D toggle system
     - Implement camera transitions

  5. Monopoly Integration:
     - Map Philippines cities to board
     - Use street names for properties
     - Rent calculation system
     - Auction mechanics
     - Player turns and rolls

  6. Timeline:
     - Week 1: Phaser 2D implementation
     - Week 2: Babylon 3D integration
     - Week 3: Toggle system
     - Week 4: Monopoly mechanics
  `)

  return true
}

function generateImplementationPlan() {
  section('IMPLEMENTATION PLAN SUMMARY')

  const plan = `
PHASE 1 - Avatar Persistence Fix (Days 1-2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Backup existing code
✓ Update database schema
✓ Create migration script
��� Replace AvatarCreatorRPM with SpriteCustomizer
✓ Fix appearance save logic
✓ Test persistence with new characters
✓ Verify legacy avatar conversion

PHASE 2 - UI/UX Redesign (Days 3-7)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Update Tailwind color scheme
✓ Redesign PlayCurrency layout
✓ Improve IsometricGameMap visuals
✓ Refactor GameProperties component
✓ Enhance Navbar and navigation
✓ Add loading states and animations
✓ Mobile responsive improvements
✓ Test across devices

PHASE 3 - Game Engine Swap (Days 8-21)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Install Phaser 3 and Babylon.js
✓ Create PhaserGameWorld component
✓ Create BabylonGameWorld component
✓ Implement 2D/3D toggle logic
✓ Migrate game state management
✓ Integrate Monopoly board mechanics
✓ Add property cards for streets
✓ Implement rent calculations
✓ Player turn management
✓ Auction system
✓ Comprehensive testing
✓ Performance optimization

ROLLOUT STRATEGY
━━━━━━━━━━━━━━━━
1. Deploy Phase 1 ASAP (fixes critical persistence bug)
2. Deploy Phase 2 gradually (improve UX without breaking logic)
3. Deploy Phase 3 as new feature (opt-in game engine for testing)
4. Monitor metrics and user feedback
5. Full migration after validation
  `

  log('green', plan)
}

function checkDependencies() {
  section('CHECKING DEPENDENCIES')

  const deps = {
    'phaser': 'Modern 2D game engine',
    'babylon': 'Modern 3D engine',
    'zustand': 'State management (if not present)',
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const installed = Object.keys(packageJson.dependencies || {})

  Object.entries(deps).forEach(([pkg, desc]) => {
    const isInstalled = installed.some(dep => dep.includes(pkg))
    const status = isInstalled ? '✓' : '○'
    const color = isInstalled ? 'green' : 'yellow'
    log(color, `  ${status} ${pkg}: ${desc}`)
  })
}

function main() {
  log('bright', '\n🚀 CURRENCY.PH GAME SYSTEM REFACTOR TOOLKIT\n')

  // Run all phases
  const files = reportAnalysis()
  const backup = createBackup()
  
  phase1FixAvatarPersistence()
  phase2DesignUIUX()
  phase3GameEngineModernization()
  
  generateImplementationPlan()
  checkDependencies()

  section('NEXT STEPS')
  log('yellow', '\n1. Review the analysis and recommendations above')
  log('yellow', '2. Start with Phase 1 (avatar persistence)')
  log('yellow', '3. Test thoroughly before deploying')
  log('yellow', '4. Use backup if rollback needed:')
  log('blue', `   Location: ${backup}`)
  
  log('green', '\n✓ Refactor toolkit generated successfully!\n')
}

main()
