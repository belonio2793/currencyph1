import React, { useState, useRef } from 'react'
import { quickAccessManager } from '../lib/quickAccessManager'

const CARD_CONFIG = {
  receipts: {
    title: 'Receipts',
    description: 'View and download your digital receipts',
    icon: (
      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    colorClasses: 'bg-amber-100 group-hover:bg-amber-200 text-amber-600',
    borderClasses: 'hover:border-amber-300'
  },
  deposit: {
    title: 'Deposit',
    description: 'Add funds to your wallet using fiat or cryptocurrency',
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    colorClasses: 'bg-blue-100 group-hover:bg-blue-200 text-blue-600',
    borderClasses: 'hover:border-blue-300'
  },
  nearby: {
    title: 'Nearby',
    description: 'Find nearby businesses, shops, and services',
    icon: (
      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    colorClasses: 'bg-green-100 group-hover:bg-green-200 text-green-600',
    borderClasses: 'hover:border-green-300'
  },
  messages: {
    title: 'Messages',
    description: 'Check your messages and stay connected',
    icon: (
      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    colorClasses: 'bg-purple-100 group-hover:bg-purple-200 text-purple-600',
    borderClasses: 'hover:border-purple-300'
  },
  p2p: {
    title: 'Peer To Peer Loan Marketplace',
    description: 'Browse loans • Submit offers • Manage your lending portfolio',
    icon: (
      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    colorClasses: 'bg-purple-100 group-hover:bg-purple-200 text-purple-600',
    borderClasses: 'hover:border-purple-300'
  },
  poker: {
    title: 'Poker',
    description: 'Play poker games and win rewards',
    icon: (
      <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M7.172 7.172C5.26 9.083 5 11.622 5 15c0 4.418 2.612 8 5 8s5-3.582 5-8c0-3.378-.26-5.917-2.172-7.828m5.656 5.656a4 4 0 010 5.656M9.172 9.172L12 6m0 0l2.828 2.828M12 6v6m0 0l-2.828-2.828M12 12l2.828 2.828" />
      </svg>
    ),
    colorClasses: 'bg-rose-100 group-hover:bg-rose-200 text-rose-600',
    borderClasses: 'hover:border-rose-300'
  },
  networkBalances: {
    title: 'Network Balances',
    description: 'View balances across the network',
    icon: (
      <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    colorClasses: 'bg-teal-100 group-hover:bg-teal-200 text-teal-600',
    borderClasses: 'hover:border-teal-300'
  },
  myBusiness: {
    title: 'My Business',
    description: 'Manage your businesses and tax information',
    icon: (
      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      </svg>
    ),
    colorClasses: 'bg-indigo-100 group-hover:bg-indigo-200 text-indigo-600',
    borderClasses: 'hover:border-indigo-300'
  }
}

export default function DraggableQuickAccessCards({
  userId,
  cardKeys = [],
  onCardClick,
  isDragEnabled = true,
  isLargeMode = true
}) {
  const [draggedItem, setDraggedItem] = useState(null)
  const [dragOverItem, setDragOverItem] = useState(null)
  const dragCounter = useRef(0)

  const handleDragStart = (e, cardKey, index) => {
    if (!isDragEnabled) {
      e.preventDefault()
      return
    }

    setDraggedItem({ cardKey, index })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.currentTarget)

    // Set custom drag image
    const dragImage = new Image()
    dragImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="50" height="50"%3E%3Crect fill="%233b82f6" width="50" height="50" rx="4"/%3E%3C/svg%3E'
    e.dataTransfer.setDragImage(dragImage, 0, 0)
  }

  const handleDragOver = (e, index) => {
    if (!isDragEnabled) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverItem(index)
  }

  const handleDragLeave = (e) => {
    if (!isDragEnabled) return

    dragCounter.current -= 1
    if (dragCounter.current === 0) {
      setDragOverItem(null)
    }
  }

  const handleDragEnter = (e) => {
    if (!isDragEnabled) return
    dragCounter.current += 1
  }

  const handleDrop = async (e, toIndex) => {
    if (!isDragEnabled) {
      e.preventDefault()
      return
    }

    e.preventDefault()
    e.stopPropagation()

    if (!draggedItem || draggedItem.index === toIndex) {
      setDraggedItem(null)
      setDragOverItem(null)
      dragCounter.current = 0
      return
    }

    const previousOrder = quickAccessManager.getCardOrder(userId)

    try {
      // Perform the reorder
      const newOrder = quickAccessManager.reorderCards(userId, draggedItem.index, toIndex)

      // Validate the new order
      if (!quickAccessManager.isValidOrder(newOrder)) {
        throw new Error('Invalid card order after reorder')
      }

      // Try to save the new order
      const saved = quickAccessManager.setCardOrder(userId, newOrder)

      if (!saved) {
        throw new Error('Failed to save card order')
      }

      // Clear drag state
      setDraggedItem(null)
      setDragOverItem(null)
      dragCounter.current = 0

      // Force re-render by triggering the event again
      window.dispatchEvent(new CustomEvent('quick-access-reordered', { detail: { userId, newOrder } }))
    } catch (error) {
      console.error('Failed to reorder cards:', error)

      // Revert to previous order on failure
      quickAccessManager.setCardOrder(userId, previousOrder)

      // Clear drag state
      setDraggedItem(null)
      setDragOverItem(null)
      dragCounter.current = 0

      // Notify of error
      window.dispatchEvent(new CustomEvent('quick-access-reorder-failed', { detail: { userId, error: error.message } }))
    }
  }

  if (!cardKeys || cardKeys.length === 0) {
    return null
  }

  if (isLargeMode) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cardKeys.map((cardKey, index) => {
          const config = CARD_CONFIG[cardKey]
          if (!config) return null

          const isDragging = draggedItem?.cardKey === cardKey
          const isDragOver = dragOverItem === index

          return (
            <div
              key={cardKey}
              draggable={isDragEnabled}
              onDragStart={(e) => handleDragStart(e, cardKey, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={`cursor-move group transition-all duration-200 ${
                isDragEnabled ? 'cursor-grab active:cursor-grabbing' : ''
              } ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'scale-105' : ''}`}
            >
              <button
                onClick={() => onCardClick && onCardClick(cardKey)}
                className={`bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl transition-all w-full h-full ${CARD_CONFIG[cardKey]?.borderClasses || ''} ${
                  isDragOver ? 'ring-2 ring-blue-400 ring-offset-2' : ''
                }`}
              >
                <div className="flex justify-center mb-4">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${config.colorClasses}`}>
                    {config.icon}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{config.title}</h3>
                <p className="text-sm text-slate-600 mb-4">{config.description}</p>
                <div className={`text-sm font-medium ${config.colorClasses.split(' ').filter(c => c.includes('text-')).join(' ')}`}>
                  {isDragEnabled ? 'Drag to reorder • Click to open →' : 'Click to open →'}
                </div>
              </button>
            </div>
          )
        })}
      </div>
    )
  } else {
    // Compact mode for profile settings
    return (
      <div className="space-y-2">
        {cardKeys.map((cardKey, index) => {
          const config = CARD_CONFIG[cardKey]
          if (!config) return null

          const isDragging = draggedItem?.cardKey === cardKey
          const isDragOver = dragOverItem === index

          return (
            <div
              key={cardKey}
              draggable={isDragEnabled}
              onDragStart={(e) => handleDragStart(e, cardKey, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={`transition-all duration-200 ${isDragEnabled ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-50' : ''}`}
            >
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  isDragOver ? 'ring-2 ring-blue-400 scale-102' : ''
                } ${
                  cardKey === 'receipts'
                    ? 'bg-blue-50 border-blue-200'
                    : cardKey === 'deposit'
                      ? 'bg-green-50 border-green-200'
                      : cardKey === 'nearby'
                        ? 'bg-purple-50 border-purple-200'
                        : cardKey === 'messages'
                          ? 'bg-pink-50 border-pink-200'
                          : 'bg-slate-50 border-slate-200'
                }`}
              >
                {isDragEnabled && (
                  <div className="cursor-grab active:cursor-grabbing flex items-center gap-1 text-slate-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8 5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8 15a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM12.5 5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM12.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM12.5 15a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
                    </svg>
                  </div>
                )}
                <span className="text-xs font-medium text-slate-700 flex-1">{config.title}</span>
                {isDragEnabled && <span className="text-xs text-slate-500">drag</span>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
}
