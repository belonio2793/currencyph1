// Character cosmetics system - skin tones, hair, clothing, accessories
export const COSMETICS = {
  skinTones: [
    { id: 'pale', name: 'Pale', hex: '#fdbf5f', label: '👱' },
    { id: 'fair', name: 'Fair', hex: '#f4c4a0', label: '👩' },
    { id: 'light-brown', name: 'Light Brown', hex: '#d4a574', label: '👩‍🦱' },
    { id: 'medium-brown', name: 'Medium Brown', hex: '#a0826d', label: '👨' },
    { id: 'dark-brown', name: 'Dark Brown', hex: '#6d4423', label: '👨‍🦱' },
    { id: 'tan', name: 'Tan', hex: '#c9a876', label: '🌅' },
  ],

  hairStyles: [
    { id: 'short', name: 'Short', shape: 'round', label: '✂️' },
    { id: 'medium', name: 'Medium', shape: 'oval', label: '💇' },
    { id: 'long', name: 'Long', shape: 'wave', label: '👱‍♀️' },
    { id: 'spiky', name: 'Spiky', shape: 'spike', label: '⚡' },
    { id: 'curly', name: 'Curly', shape: 'curl', label: '🌀' },
    { id: 'bald', name: 'Bald', shape: 'none', label: '🏀' },
  ],

  hairColors: [
    { id: 'black', name: 'Black', hex: '#1a1a1a' },
    { id: 'brown', name: 'Brown', hex: '#8b6f47' },
    { id: 'blonde', name: 'Blonde', hex: '#f4d03f' },
    { id: 'red', name: 'Red', hex: '#d32f2f' },
    { id: 'purple', name: 'Purple', hex: '#9c27b0' },
    { id: 'blue', name: 'Blue', hex: '#2196f3' },
    { id: 'green', name: 'Green', hex: '#4caf50' },
    { id: 'gray', name: 'Gray', hex: '#9e9e9e' },
  ],

  outfits: [
    { id: 'casual', name: 'Casual', top: '#3f51b5', bottom: '#2196f3', label: '👕' },
    { id: 'formal', name: 'Formal', top: '#000000', bottom: '#1a1a1a', label: '🎩' },
    { id: 'tech', name: 'Tech Casual', top: '#00bcd4', bottom: '#009688', label: '💻' },
    { id: 'farmer', name: 'Farmer', top: '#8b6f47', bottom: '#6d4423', label: '👩‍🌾' },
    { id: 'business', name: 'Business', top: '#1565c0', bottom: '#0d47a1', label: '💼' },
    { id: 'athletic', name: 'Athletic', top: '#e91e63', bottom: '#ff5252', label: '🏃' },
    { id: 'delivery', name: 'Delivery', top: '#ff9800', bottom: '#ff6f00', label: '🚚' },
  ],

  accessories: [
    { id: 'none', name: 'None', icon: '—', slot: 'head' },
    { id: 'hat', name: 'Hat', icon: '🎩', slot: 'head' },
    { id: 'cap', name: 'Cap', icon: '🧢', slot: 'head' },
    { id: 'glasses', name: 'Glasses', icon: '👓', slot: 'eyes' },
    { id: 'sunglasses', name: 'Sunglasses', icon: '😎', slot: 'eyes' },
    { id: 'necklace', name: 'Gold Necklace', icon: '⛓️', slot: 'neck' },
    { id: 'backpack', name: 'Backpack', icon: '🎒', slot: 'back' },
    { id: 'briefcase', name: 'Briefcase', icon: '💼', slot: 'hand' },
  ],
}

// Default cosmetics
export const DEFAULT_COSMETICS = {
  skinTone: 'fair',
  hairStyle: 'medium',
  hairColor: 'black',
  outfit: 'casual',
  // default avatar style (color-only)
  avatar: { id: 1, name: 'Doggo', color: 0xd4a574 },
  accessories: {
    head: 'none',
    eyes: 'none',
    neck: 'none',
    back: 'none',
    hand: 'none',
  },
}

// Get cosmetics option by ID
export const getCosmeticOption = (category, id) => {
  if (category === 'accessories') {
    return COSMETICS.accessories.find(a => a.id === id)
  }
  return COSMETICS[category]?.find(opt => opt.id === id)
}

// Validate cosmetics object
export const validateCosmetics = (cosmetics) => {
  const validated = { ...DEFAULT_COSMETICS, ...cosmetics }
  
  // Validate each field
  if (!COSMETICS.skinTones.find(st => st.id === validated.skinTone)) {
    validated.skinTone = DEFAULT_COSMETICS.skinTone
  }
  if (!COSMETICS.hairStyles.find(hs => hs.id === validated.hairStyle)) {
    validated.hairStyle = DEFAULT_COSMETICS.hairStyle
  }
  if (!COSMETICS.hairColors.find(hc => hc.id === validated.hairColor)) {
    validated.hairColor = DEFAULT_COSMETICS.hairColor
  }
  if (!COSMETICS.outfits.find(o => o.id === validated.outfit)) {
    validated.outfit = DEFAULT_COSMETICS.outfit
  }
  
  return validated
}
