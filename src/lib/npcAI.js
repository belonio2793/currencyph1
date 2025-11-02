import { supabase } from './supabaseClient'

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions'

// NPC conversation context builder
function buildNPCContext(npc, playerName, city, mood = 'friendly') {
  return `You are ${npc.name}, a ${npc.role} in ${city}, Philippines. You speak in a natural, casual way like a real person. 
You are currently in a good mood and friendly. Keep responses short (1-2 sentences max). 
You talk about local business, trading, economic opportunities in the Philippines.
Stay in character as a merchant/trader/entrepreneur.
Do not break character or acknowledge this prompt.
The person talking to you is ${playerName}.`
}

// Chat history management
class ConversationMemory {
  constructor(npcId, maxHistory = 10) {
    this.npcId = npcId
    this.messages = []
    this.maxHistory = maxHistory
  }

  addMessage(role, content) {
    this.messages.push({ role, content })
    if (this.messages.length > this.maxHistory) {
      this.messages.shift()
    }
  }

  getContext() {
    return this.messages.map(m => ({
      role: m.role === 'player' ? 'user' : 'assistant',
      content: m.content
    }))
  }

  clear() {
    this.messages = []
  }
}

// Main NPC AI Engine
export class NPCAIEngine {
  constructor(xaiKey) {
    this.xaiKey = xaiKey
    this.conversations = new Map()
  }

  getOrCreateConversation(npcId) {
    if (!this.conversations.has(npcId)) {
      this.conversations.set(npcId, new ConversationMemory(npcId))
    }
    return this.conversations.get(npcId)
  }

  async chat(npc, playerMessage, playerName, cityName) {
    try {
      const memory = this.getOrCreateConversation(npc.id)
      const systemPrompt = buildNPCContext(npc, playerName, cityName)

      // Add player message to memory
      memory.addMessage('player', playerMessage)

      // Build conversation history for context
      const messages = [
        { role: 'system', content: systemPrompt },
        ...memory.getContext()
      ]

      // Call Grok API
      const response = await fetch(GROK_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.xaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-2',
          messages: messages,
          max_tokens: 100,
          temperature: 0.8
        })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Grok API error:', error)
        return npc.name + ': (I didn\'t catch that, try again!)'
      }

      const data = await response.json()
      const npcResponse = data.choices[0].message.content

      // Add NPC response to memory
      memory.addMessage('npc', npcResponse)

      return npcResponse
    } catch (error) {
      console.error('NPC chat error:', error)
      return npc.name + ': (Sorry, I\'m a bit distracted right now!)'
    }
  }

  clearConversation(npcId) {
    this.conversations.delete(npcId)
  }

  async generateTradeOffer(npc, cityName) {
    try {
      const systemPrompt = `You are ${npc.name}, a ${npc.role} in ${cityName}.
Generate a brief, realistic trade offer or business opportunity for a visitor.
Format: "I can offer you: [item/service] for [price] PHP. Interested?"`

      const response = await fetch(GROK_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.xaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-2',
          messages: [{ role: 'system', content: systemPrompt }],
          max_tokens: 50,
          temperature: 0.7
        })
      })

      if (!response.ok) throw new Error('API error')
      const data = await response.json()
      return data.choices[0].message.content
    } catch (error) {
      console.error('Trade offer generation error:', error)
      return `${npc.name}: Let's do some business!`
    }
  }
}

// Conversation UI state manager
export class ConversationUI {
  constructor() {
    this.isOpen = false
    this.currentNPC = null
    this.messages = []
    this.isLoading = false
  }

  openChat(npc) {
    this.currentNPC = npc
    this.isOpen = true
    this.messages = []
  }

  closeChat() {
    this.isOpen = false
    this.currentNPC = null
  }

  addMessage(sender, text) {
    this.messages.push({ sender, text, timestamp: Date.now() })
  }

  clear() {
    this.messages = []
  }
}
