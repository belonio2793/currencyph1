// AI Service - Handles all intelligent interactions seamlessly
// Uses X AI backend, completely transparent to user

const AI_API_URL = 'https://api.x.ai/v1/chat/completions'

class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.conversationMemory = new Map()
    this.cache = new Map()
    this.requestQueue = []
    this.isProcessing = false
  }

  // Main method: Get response for any context
  async generateResponse(context, systemPrompt, userMessage, options = {}) {
    const cacheKey = `${context}:${userMessage}`
    
    // Check cache for identical requests
    if (this.cache.has(cacheKey) && !options.ignoreCache) {
      return this.cache.get(cacheKey)
    }

    // Add to queue
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        context,
        systemPrompt,
        userMessage,
        options,
        resolve,
        reject
      })
      this.processQueue()
    })
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return
    this.isProcessing = true

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      try {
        const response = await this.callAPI(
          request.systemPrompt,
          request.userMessage,
          request.context
        )
        
        // Cache the result
        const cacheKey = `${request.context}:${request.userMessage}`
        this.cache.set(cacheKey, response)
        
        request.resolve(response)
      } catch (error) {
        request.reject(error)
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    this.isProcessing = false
  }

  async callAPI(systemPrompt, userMessage, context) {
    try {
      const memory = this.getMemory(context)
      
      const messages = [
        { role: 'system', content: systemPrompt },
        ...memory.getMessages(),
        { role: 'user', content: userMessage }
      ]

      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-2',
          messages,
          max_tokens: 150,
          temperature: 0.8
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()
      const result = data.choices[0]?.message?.content || ''

      // Store in memory
      memory.addMessage('user', userMessage)
      memory.addMessage('assistant', result)

      return result
    } catch (error) {
      console.error('AI Service error:', error)
      return this.getFallbackResponse(context)
    }
  }

  getMemory(context) {
    if (!this.conversationMemory.has(context)) {
      this.conversationMemory.set(context, new ConversationMemory(context))
    }
    return this.conversationMemory.get(context)
  }

  getFallbackResponse(context) {
    const fallbacks = {
      'market_price': 'The market prices are stable today.',
      'weather': 'The weather is clear and pleasant.'
    }
    return fallbacks[context] || 'Hello!'
  }

  clearMemory(context) {
    this.conversationMemory.delete(context)
  }
}

class ConversationMemory {
  constructor(contextId, maxMessages = 20) {
    this.contextId = contextId
    this.messages = []
    this.maxMessages = maxMessages
    this.createdAt = Date.now()
  }

  addMessage(role, content) {
    this.messages.push({ role, content })
    if (this.messages.length > this.maxMessages) {
      this.messages.shift()
    }
  }

  getMessages() {
    return this.messages.slice(-10) // Return last 10 messages for context
  }

  clear() {
    this.messages = []
  }
}

// Context-specific prompt builders
export const PromptBuilders = {
  marketPricing: (item, city, season) => ({
    system: `You are a market analyst for ${city}. Calculate realistic price for "${item}" in ${season}.
    Consider local supply/demand. Return ONLY: "₱[price]" with brief reason.`,
    context: 'market_price'
  }),

  weatherEvent: (city) => ({
    system: `Generate a realistic weather description for ${city}, Philippines today.
    Keep it 1 sentence. No flowery language.`,
    context: 'weather'
  })
}

// Initialize singleton
let aiServiceInstance = null

export function initAIService(apiKey) {
  aiServiceInstance = new AIService(apiKey)
  return aiServiceInstance
}

export function getAIService() {
  if (!aiServiceInstance) {
    const key = process.env.VITE_X_API_KEY || process.env.X_API_KEY
    aiServiceInstance = new AIService(key)
  }
  return aiServiceInstance
}

export default getAIService
