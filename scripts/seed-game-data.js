import { supabase } from '../src/lib/supabaseClient.js'

const GAME_ITEMS = [
  // Clothing - Head
  { name: 'Nike Baseball Cap', description: 'A classic Nike baseball cap', item_type: 'clothing', equipment_slot: 'head', brand: 'Nike', base_price: 1500, image_url: 'https://via.placeholder.com/100?text=Nike+Cap' },
  { name: 'Adidas Beanie', description: 'Warm Adidas beanie', item_type: 'clothing', equipment_slot: 'head', brand: 'Adidas', base_price: 2000, image_url: 'https://via.placeholder.com/100?text=Adidas+Beanie' },
  { name: 'Gucci Sunglasses', description: 'Luxury sunglasses', item_type: 'clothing', equipment_slot: 'head', brand: 'Gucci', base_price: 15000, image_url: 'https://via.placeholder.com/100?text=Gucci+Shades' },

  // Clothing - Body
  { name: 'Plain White T-Shirt', description: 'A basic white t-shirt', item_type: 'clothing', equipment_slot: 'body', brand: 'Uniqlo', base_price: 500, image_url: 'https://via.placeholder.com/100?text=White+Shirt' },
  { name: 'Nike Hoodie', description: 'Comfortable Nike hoodie', item_type: 'clothing', equipment_slot: 'body', brand: 'Nike', base_price: 3500, image_url: 'https://via.placeholder.com/100?text=Nike+Hoodie' },
  { name: 'Gucci T-Shirt', description: 'Designer Gucci t-shirt', item_type: 'clothing', equipment_slot: 'body', brand: 'Gucci', base_price: 12000, image_url: 'https://via.placeholder.com/100?text=Gucci+Shirt' },
  { name: 'Polo Ralph Lauren Shirt', description: 'Classic polo shirt', item_type: 'clothing', equipment_slot: 'body', brand: 'Ralph Lauren', base_price: 5000, image_url: 'https://via.placeholder.com/100?text=Polo+Shirt' },

  // Clothing - Legs
  { name: 'Blue Jeans', description: 'Classic blue denim jeans', item_type: 'clothing', equipment_slot: 'legs', brand: 'Levi\'s', base_price: 2500, image_url: 'https://via.placeholder.com/100?text=Blue+Jeans' },
  { name: 'Nike Joggers', description: 'Comfortable Nike joggers', item_type: 'clothing', equipment_slot: 'legs', brand: 'Nike', base_price: 3000, image_url: 'https://via.placeholder.com/100?text=Joggers' },
  { name: 'Gucci Trousers', description: 'Luxury designer trousers', item_type: 'clothing', equipment_slot: 'legs', brand: 'Gucci', base_price: 20000, image_url: 'https://via.placeholder.com/100?text=Gucci+Pants' },

  // Clothing - Feet
  { name: 'Nike Air Force 1', description: 'Classic Nike sneakers', item_type: 'clothing', equipment_slot: 'feet', brand: 'Nike', base_price: 4500, image_url: 'https://via.placeholder.com/100?text=AF1' },
  { name: 'Adidas Ultra Boost', description: 'Premium Adidas shoes', item_type: 'clothing', equipment_slot: 'feet', brand: 'Adidas', base_price: 6000, image_url: 'https://via.placeholder.com/100?text=Ultraboost' },
  { name: 'Gucci Loafers', description: 'Luxury leather loafers', item_type: 'clothing', equipment_slot: 'feet', brand: 'Gucci', base_price: 18000, image_url: 'https://via.placeholder.com/100?text=Gucci+Loafers' },

  // Accessories - Right Hand
  { name: 'Stainless Steel Watch', description: 'Elegant stainless steel watch', item_type: 'accessory', equipment_slot: 'right_hand', brand: 'Citizen', base_price: 8000, image_url: 'https://via.placeholder.com/100?text=Watch' },
  { name: 'Rolex Submariner', description: 'Luxury sports watch', item_type: 'accessory', equipment_slot: 'right_hand', brand: 'Rolex', base_price: 500000, image_url: 'https://via.placeholder.com/100?text=Rolex' },

  // Accessories - Left Hand
  { name: 'Silver Ring', description: 'Elegant silver ring', item_type: 'accessory', equipment_slot: 'left_hand', brand: 'Pandora', base_price: 3000, image_url: 'https://via.placeholder.com/100?text=Ring' },

  // Accessories - Necklace
  { name: 'Gold Chain Necklace', description: 'Classic gold chain', item_type: 'accessory', equipment_slot: 'necklace', brand: 'Generic', base_price: 5000, image_url: 'https://via.placeholder.com/100?text=Necklace' },

  // Backpack
  { name: 'North Face Backpack', description: 'Durable outdoor backpack', item_type: 'equipment', equipment_slot: 'backpack', brand: 'North Face', base_price: 6000, image_url: 'https://via.placeholder.com/100?text=Backpack' },
  { name: 'Gucci Backpack', description: 'Designer luxury backpack', item_type: 'equipment', equipment_slot: 'backpack', brand: 'Gucci', base_price: 35000, image_url: 'https://via.placeholder.com/100?text=Gucci+Pack' },

  // Consumables
  { name: 'Energy Drink', description: 'Restore energy quickly', item_type: 'consumable', brand: 'Red Bull', base_price: 200, image_url: 'https://via.placeholder.com/100?text=Energy+Drink' },
  { name: 'Health Potion', description: 'Restore health', item_type: 'consumable', brand: 'Generic', base_price: 500, image_url: 'https://via.placeholder.com/100?text=Health+Potion' }
]

const QUESTS = [
  { name: 'First Steps', description: 'Walk around and explore the world', quest_type: 'exploration', category: 'story', xp_reward: 100, money_reward: 500, min_level: 0 },
  { name: 'Monster Slayer', description: 'Defeat 5 monsters', quest_type: 'combat', category: 'daily', xp_reward: 500, money_reward: 2000, min_level: 0 },
  { name: 'Trash Collector', description: 'Pick up garbage around town', quest_type: 'gathering', category: 'daily', xp_reward: 200, money_reward: 1000, min_level: 0 },
  { name: 'Trader', description: 'Complete 3 marketplace transactions', quest_type: 'trading', category: 'daily', xp_reward: 300, money_reward: 1500, min_level: 0 },
  { name: 'Business Owner', description: 'Purchase your first property', quest_type: 'business', category: 'story', xp_reward: 1000, money_reward: 5000, min_level: 5 },
  { name: 'City Explorer', description: 'Visit all major cities', quest_type: 'exploration', category: 'special', xp_reward: 2000, money_reward: 10000, min_level: 10 },
  { name: 'Millionaire', description: 'Accumulate 1,000,000 PHP', quest_type: 'business', category: 'special', xp_reward: 5000, money_reward: 50000, min_level: 20 }
]

const ACHIEVEMENTS = [
  { name: 'First Blood', description: 'Defeat your first monster', icon: '⚔️', category: 'combat', reward_xp: 50 },
  { name: 'Level 10', description: 'Reach level 10', icon: '📈', category: 'progression', reward_xp: 100 },
  { name: 'Wealthy', description: 'Collect 100,000 PHP', icon: '💰', category: 'wealth', reward_xp: 200 },
  { name: 'Property Owner', description: 'Own a property', icon: '🏠', category: 'business', reward_xp: 150 },
  { name: 'Trader', description: 'Complete 10 trades', icon: '💳', category: 'trading', reward_xp: 100 },
  { name: 'Fashionista', description: 'Equip items in all slots', icon: '👗', category: 'social', reward_xp: 75 }
]

async function seedGameData() {
  try {
    console.log('Starting game data seed...')

    // Insert items
    console.log('Inserting items...')
    for (const item of GAME_ITEMS) {
      await supabase.from('game_items').insert([item])
    }
    console.log(`✓ Inserted ${GAME_ITEMS.length} items`)

    // Insert quests
    console.log('Inserting quests...')
    for (const quest of QUESTS) {
      await supabase.from('game_quests').insert([quest])
    }
    console.log(`✓ Inserted ${QUESTS.length} quests`)

    // Insert achievements
    console.log('Inserting achievements...')
    for (const achievement of ACHIEVEMENTS) {
      await supabase.from('game_achievements').insert([achievement])
    }
    console.log(`✓ Inserted ${ACHIEVEMENTS.length} achievements`)

    console.log('\n✅ Game data seeded successfully!')
  } catch (error) {
    console.error('Error seeding game data:', error)
    process.exit(1)
  }
}

seedGameData()
