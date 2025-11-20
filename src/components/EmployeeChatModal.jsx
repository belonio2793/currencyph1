import React, { useState, useEffect, useRef } from 'react'
import { employeeMessagingService } from '../lib/employeeMessagingService'

export default function EmployeeChatModal({ 
  businessId, 
  employee, 
  currentUserId, 
  currentUserName,
  onClose 
}) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const [subscription, setSubscription] = useState(null)

  // Load messages on mount
  useEffect(() => {
    loadMessages()
    
    // Subscribe to new messages
    const sub = employeeMessagingService.subscribeToEmployeeMessages(
      businessId,
      employee.id,
      (newMsg) => {
        setMessages(prev => [...prev, newMsg])
      }
    )
    setSubscription(sub)

    return () => {
      if (sub) sub.unsubscribe()
    }
  }, [businessId, employee.id])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      setLoading(true)
      const { data, error } = await employeeMessagingService.getMessages(
        businessId,
        employee.id
      )
      
      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!newMessage.trim()) return

    try {
      setSending(true)
      const { data, error } = await employeeMessagingService.sendMessage(
        businessId,
        employee.id,
        currentUserId,
        newMessage
      )

      if (error) throw error

      setMessages([...messages, data])
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const isMessageFromCurrentUser = (msg) => msg.user_id === currentUserId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>
            <div>
              <h2 className="font-bold">{employee.first_name} {employee.last_name}</h2>
              <p className="text-xs opacity-80">{employee.position}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500 text-center">
                No messages yet. Start a conversation!
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const showDate = index === 0 || 
                  formatDate(messages[index - 1].created_at) !== formatDate(msg.created_at)
                
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-slate-300"></div>
                        <span className="text-xs text-slate-500 font-medium">
                          {formatDate(msg.created_at)}
                        </span>
                        <div className="flex-1 h-px bg-slate-300"></div>
                      </div>
                    )}
                    <div
                      className={`flex ${
                        isMessageFromCurrentUser(msg) ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          isMessageFromCurrentUser(msg)
                            ? 'bg-purple-600 text-white rounded-br-none'
                            : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <p
                          className={`text-xs mt-1 ${
                            isMessageFromCurrentUser(msg)
                              ? 'text-purple-100'
                              : 'text-slate-600'
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-200 bg-white p-4 flex gap-3">
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            disabled={sending}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-purple-600 disabled:bg-slate-100"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 font-medium transition-colors"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
