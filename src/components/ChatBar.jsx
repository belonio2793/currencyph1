import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { generateSymmetricKey, exportKeyToBase64, importKeyFromBase64, encryptString, decryptString } from '../lib/crypto'

export default function ChatBar({ userId, userEmail }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const subRef = useRef(null)

  useEffect(() => {
    return () => {
      if (subRef.current) supabase.removeSubscription(subRef.current)
    }
  }, [])

  const toggleOpen = () => setOpen(!open)

  // Basic user search
  const searchUsers = async (q) => {
    if (!q || q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone')
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(20)

    setLoading(false)
    if (error) {
      console.warn('User search error', error)
      setResults([])
      return
    }
    // Filter out self
    setResults((data || []).filter(u => u.id !== userId))
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.length >= 2) searchUsers(search)
      else setResults([])
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Conversation key management (client-only for MVP): store per pair
  const convKeyId = (a, b) => [a, b].sort().join('_')

  async function ensureConversationKey(a, b) {
    const keyName = `conv_key_${convKeyId(a, b)}`
    let keyB64 = localStorage.getItem(keyName)
    if (keyB64) {
      return importKeyFromBase64(keyB64)
    }
    const key = await generateSymmetricKey()
    keyB64 = await exportKeyToBase64(key)
    localStorage.setItem(keyName, keyB64)
    return key
  }

  async function loadMessagesWith(user) {
    setSelectedUser(user)
    setMessages([])
    // unsubscribe previous
    if (subRef.current) supabase.removeSubscription(subRef.current)

    // load recent messages between the two users
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${user.id}),and(sender_id.eq.${user.id},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) {
      console.warn('Could not load messages', error)
    } else {
      const key = await ensureConversationKey(userId, user.id)
      const decrypted = await Promise.all((data || []).map(async m => {
        const plain = await decryptString(key, m.ciphertext, m.iv)
        return { ...m, plain }
      }))
      setMessages(decrypted)
    }

    // subscribe to new messages
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async payload => {
        const m = payload.new
        // if relevant to this conversation
        if ((m.sender_id === user.id && m.recipient_id === userId) || (m.sender_id === userId && m.recipient_id === user.id)) {
          const key = await ensureConversationKey(userId, user.id)
          const plain = await decryptString(key, m.ciphertext, m.iv)
          setMessages(prev => [...prev, { ...m, plain }])
        }
      })
      .subscribe()

    subRef.current = channel
  }

  const sendMessage = async () => {
    if (!selectedUser || !text.trim()) return
    setSending(true)
    try {
      const key = await ensureConversationKey(userId, selectedUser.id)
      const { ciphertext, iv } = await encryptString(key, text.trim())
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: userId,
            recipient_id: selectedUser.id,
            ciphertext,
            iv,
            metadata: { via: 'chatbar' }
          }
        ])
      if (error) throw error
      setText('')
    } catch (err) {
      console.error('Send failed', err)
    } finally {
      setSending(false)
    }
  }

  const deleteMessage = async (messageId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date() })
        .eq('id', messageId)
      if (error) throw error
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted_at: new Date() } : m))
    } catch (err) {
      console.warn('Delete failed', err)
    }
  }

  return (
    <div>
      {/* Collapsed button */}
      <div className="fixed bottom-4 right-4 z-50">
        <button onClick={toggleOpen} className="bg-blue-600 text-white rounded-full p-3 shadow-lg">{open ? '✕' : 'Chat'}</button>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-3xl md:max-w-4xl bg-white border border-slate-200 rounded-xl shadow-lg p-4 flex">
          {/* Left: search & users */}
          <div className="w-1/3 border-r pr-4">
            <div className="mb-2">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users (name, email, phone)" className="w-full px-3 py-2 border rounded" />
            </div>
            <div className="h-96 overflow-y-auto">
              {loading && <div className="text-sm text-slate-500">Searching...</div>}
              {results.map(u => (
                <div key={u.id} className="p-2 cursor-pointer hover:bg-slate-50 rounded flex items-center justify-between" onClick={() => loadMessagesWith(u)}>
                  <div>
                    <div className="font-medium">{u.full_name || u.email}</div>
                    <div className="text-xs text-slate-500">{u.email} {u.phone ? `• ${u.phone}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: messages */}
          <div className="w-2/3 pl-4 flex flex-col">
            <div className="mb-2">
              {selectedUser ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{selectedUser.full_name || selectedUser.email}</div>
                    <div className="text-xs text-slate-500">Chat</div>
                  </div>
                  <div>
                    {/* Friend action placeholder */}
                    <button className="px-3 py-1 text-sm bg-slate-100 rounded">Add Friend</button>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500">Select a user to start</div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto h-96 border rounded p-3 mb-3 bg-slate-50">
              {messages.length === 0 && <div className="text-sm text-slate-500">No messages</div>}
              {messages.map(m => (
                <div key={m.id} className={`mb-2 ${m.sender_id === userId ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block p-2 rounded ${m.sender_id === userId ? 'bg-blue-600 text-white' : 'bg-white text-slate-900'}`}>
                    {m.deleted_at ? <em className="text-xs text-slate-400">message deleted</em> : (m.plain || <em className="text-xs text-slate-400">Encrypted</em>)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(m.created_at).toLocaleString()}
                    {m.sender_id === userId && !m.deleted_at && (
                      <button onClick={() => deleteMessage(m.id)} className="ml-2 text-red-500">Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Write a message" className="flex-1 px-3 py-2 border rounded" />
              <button onClick={sendMessage} disabled={sending || !selectedUser} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
