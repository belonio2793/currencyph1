import React, { useState, useEffect, useRef } from 'react'
import { useDevice } from '../context/DeviceContext'
import ExpandableModal from './ExpandableModal'

export default function ChatModal({ ride, currentUserId, otherUserName, onClose, onSendMessage, loading }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender_id: 'driver-123',
      sender_type: 'driver',
      message: 'I am 5 minutes away',
      message_type: 'text',
      created_at: new Date(Date.now() - 60000),
      is_read: true
    },
    {
      id: 2,
      sender_id: currentUserId,
      sender_type: 'rider',
      message: 'Thank you! Please call me when you arrive',
      message_type: 'text',
      created_at: new Date(Date.now() - 30000),
      is_read: true
    }
  ])
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    if (!newMessage.trim()) return

    const message = {
      id: messages.length + 1,
      sender_id: currentUserId,
      sender_type: 'rider',
      message: newMessage,
      message_type: 'text',
      created_at: new Date(),
      is_read: false
    }

    setMessages([...messages, message])
    onSendMessage(ride.id, newMessage)
    setNewMessage('')
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const { isMobile } = useDevice()

  const quickActionButtons = (
    <div className="grid grid-cols-2 gap-2 w-full">
      <button className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition-colors font-medium">
        📄 Share
      </button>
      <button className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition-colors font-medium">
        📞 Call
      </button>
    </div>
  )

  const sendButton = (
    <div className="flex gap-2 w-full">
      <input
        type="text"
        placeholder="Type a message..."
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
      />
      <button
        onClick={handleSend}
        disabled={loading || !newMessage.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-slate-400"
      >
        Send
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title={otherUserName}
      icon="ud83d\udcac"
      size={isMobile ? 'fullscreen' : 'sm'}
      footer={sendButton}
      defaultExpanded={!isMobile}
    >

        <div className="flex-1 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500 text-center">
                Start a conversation with your driver
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.sender_id === currentUserId
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className={`text-xs mt-1 ${msg.sender_id === currentUserId ? 'text-blue-100' : 'text-slate-600'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
    </ExpandableModal>
  )
}
