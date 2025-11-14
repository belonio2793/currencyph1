import React from 'react'
import DraggableQuickAccessCards from './DraggableQuickAccessCards'

const CARD_CONFIG = {
  receipts: {
    title: 'Receipts',
    description: 'View and download digital receipts'
  },
  deposit: {
    title: 'Deposit',
    description: 'Add funds to your wallet'
  },
  nearby: {
    title: 'Nearby',
    description: 'Find nearby businesses'
  },
  messages: {
    title: 'Messages',
    description: 'Check your messages and stay connected'
  },
  p2p: {
    title: 'P2P Loan Marketplace',
    description: 'Browse loans and submit offers'
  },
  poker: {
    title: 'Poker',
    description: 'Play poker games and win rewards'
  },
  networkBalances: {
    title: 'Network Balances',
    description: 'View balances across the network'
  },
  myBusiness: {
    title: 'My Business',
    description: 'Manage your business and tax information'
  }
}

export default function CustomizeQuickAccessModal({
  isOpen,
  onClose,
  userId,
  quickAccessCards,
  onToggleCard,
  enabledCards,
  customizeReorderKey,
  onSave,
  onCardClick,
  showReorderSection = true
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Customize Quick Access</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-slate-600 mb-4">
            {showReorderSection ? 'Enable/disable cards and drag to reorder:' : 'Enable/disable cards to customize your home page:'}
          </p>

          <div className="space-y-3 mb-6">
            {Object.entries(CARD_CONFIG).map(([cardKey, config]) => (
              <label
                key={cardKey}
                className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={quickAccessCards[cardKey] || false}
                  onChange={() => onToggleCard(cardKey)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{config.title}</p>
                  <p className="text-xs text-slate-500">{config.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {showReorderSection && enabledCards && enabledCards.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-slate-600 font-medium mb-3">Reorder enabled cards (drag to move or click to preview):</p>
            <DraggableQuickAccessCards
              key={customizeReorderKey}
              userId={userId}
              cardKeys={enabledCards}
              onCardClick={onCardClick}
              isDragEnabled={true}
              isLargeMode={false}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
          >
            Save Preferences
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
