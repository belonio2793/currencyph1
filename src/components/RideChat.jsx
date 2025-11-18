import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function RideChat({ rideId, userId, otherUserName, onClose }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [quickReplies] = useState([
    'I\'m arriving soon',
    'Where are you exactly?',
    'I\'m at the pickup location',
    'Thanks for the ride!',
    'Can you cancel this ride?'
  ])
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadMessages()
    subscribeToMessages()
  }, [rideId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_chat_messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true })
        .limit(50)

      if (!error && data) {
        setMessages(data)
      }
    } catch (err) {
      console.warn('Could not load messages:', err)
    } finally {
      setLoading(false)
    }
  }

  const subscribeToMessages = () => {
    try {
      const subscription = supabase
        .channel(`ride-chat:${rideId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_chat_messages',
          filter: `ride_id=eq.${rideId}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new])
        })
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    } catch (err) {
      console.warn('Subscription error:', err)
      return () => {}
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    try {
      const { error } = await supabase
        .from('ride_chat_messages')
        .insert({
          ride_id: rideId,
          sender_id: userId,
          message: newMessage,
          message_type: 'text',
          sender_type: 'user', // Will be determined by role
          created_at: new Date().toISOString()
        })

      if (!error) {
        setNewMessage('')
      }
    } catch (err) {
      console.error('Error sending message:', err)
    }
  }

  const sendQuickReply = async (reply) => {
    setNewMessage(reply)
    try {
      await supabase
        .from('ride_chat_messages')
        .insert({
          ride_id: rideId,
          sender_id: userId,
          message: reply,
          message_type: 'text',
          sender_type: 'user',
          created_at: new Date().toISOString()
        })
    } catch (err) {
      console.error('Error sending quick reply:', err)
    }
  }

  const sendLocationShare = async () => {
    try {
      // Get current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords

          await supabase
            .from('ride_chat_messages')
            .insert({
              ride_id: rideId,
              sender_id: userId,
              message: 'Shared location',
              message_type: 'location',
              location_latitude: latitude,
              location_longitude: longitude,
              sender_type: 'user',
              created_at: new Date().toISOString()
            })
        })
      }
    } catch (err) {
      console.error('Error sharing location:', err)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="p-6 text-center text-slate-600">Loading chat...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-96 flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4 rounded-t-lg flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{otherUserName || 'Driver'}</h3>
          <p className="text-xs text-blue-100">Active now</p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-blue-100 text-2xl"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-slate-600 py-8">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs text-slate-500 mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs rounded-lg px-4 py-2 ${
                  msg.sender_id === userId
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-900'
                }`}
              >
                {msg.message_type === 'location' ? (
                  <div className="text-sm">
                    📍 Location shared
                    <p className="text-xs mt-1 opacity-75">
                      {msg.location_latitude?.toFixed(4)}, {msg.location_longitude?.toFixed(4)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm">{msg.message}</p>
                )}
                <p className={`text-xs mt-1 ${msg.sender_id === userId ? 'text-blue-100' : 'text-slate-600'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      <div className="border-t border-slate-200 p-3 bg-slate-50">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {quickReplies.slice(0, 2).map((reply, idx) => (
            <button
              key={idx}
              onClick={() => sendQuickReply(reply)}
              className="text-xs bg-white border border-slate-300 rounded px-2 py-1 hover:bg-slate-100 text-slate-700"
              title={reply}
            >
              {reply.length > 15 ? reply.substring(0, 12) + '...' : reply}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-4 bg-white rounded-b-lg">
        <div className="flex gap-2 mb-2">
          <button
            onClick={sendLocationShare}
            className="flex-1 px-3 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 text-sm font-medium"
          >
            📍 Share Location
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
