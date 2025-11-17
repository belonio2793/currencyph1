import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function GameChat({ tableId, userId }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const unsubscribeRef = useRef(null)

  useEffect(() => {
    loadMessages()
    subscribeToMessages()
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current.unsubscribe()
      }
    }
  }, [tableId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function loadMessages() {
    try {
      const { data } = await supabase
        .from('poker_chat')
        .select('*')
        .eq('table_id', tableId)
        .order('created_at', { ascending: true })
        .limit(20)
      
      setMessages(data || [])
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }

  function subscribeToMessages() {
    unsubscribeRef.current = supabase
      .channel(`poker_chat:table_id=eq.${tableId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'poker_chat',
        filter: `table_id=eq.${tableId}`
      }, (payload) => {
        if (payload.new) {
          setMessages(prev => [...prev, payload.new])
        }
      })
      .subscribe()
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !userId) return

    setLoading(true)
    try {
      const { error } = await supabase.from('poker_chat').insert([{
        table_id: tableId,
        user_id: userId,
        message: newMessage
      }])

      if (error) throw error
      setNewMessage('')
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="text-xs text-slate-500 italic text-center py-4">No messages yet</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="text-xs">
              <span className="text-emerald-400 font-semibold">
                {msg.user_id === userId ? 'You' : 'Player'}:
              </span>
              <span className="text-slate-300 ml-1">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {userId && (
        <form onSubmit={sendMessage} className="flex gap-2 flex-shrink-0">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Say something..."
            maxLength="100"
            disabled={loading}
            className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="px-3 py-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded transition whitespace-nowrap"
          >
            Send
          </button>
        </form>
      )}
    </div>
  )
}
