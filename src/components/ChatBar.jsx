import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { generateSymmetricKey, exportKeyToBase64, importKeyFromBase64, encryptString, decryptString } from '../lib/crypto'
import { getFriendsList, sendFriendRequest, removeFriend, isFriend } from '../lib/friends'
import { getOrCreateDirectConversation, sendConversationMessage, deleteConversationMessage } from '../lib/conversations'
import { uploadMediaToChat, getMessageMedia, getMediaDownloadUrl, deleteMessageMedia, uploadVoiceMessage } from '../lib/chatMedia'
import { subscribeToMultiplePresence, getMultipleUsersPresence } from '../lib/presence'

export default function ChatBar({ userId, userEmail }) {
  const [minimized, setMinimized] = useState(true)
  const [activeTab, setActiveTab] = useState('chats')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [friends, setFriends] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [onlineUsers, setOnlineUsers] = useState({})
  const [recordingVoice, setRecordingVoice] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [presenceUnsubscribe, setPresenceUnsubscribe] = useState(null)
  const messageListRef = useRef(null)
  const subRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const mediaInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  // Load friends on mount
  useEffect(() => {
    if (!userId || activeTab !== 'friends') return
    loadFriends()
  }, [userId, activeTab])

  // Search users with debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchUsers(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  // Load messages when conversation changes
  useEffect(() => {
    if (!selectedConversation) return
    loadMessages()
    subscribeToMessages()
    return () => {
      if (subRef.current) supabase.removeSubscription(subRef.current)
    }
  }, [selectedConversation])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [messages])

  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .neq('id', userId)
        .limit(20)

      if (!error && data) {
        setSearchResults(data)
      }
    } catch (err) {
      console.warn('Search error:', err)
    } finally {
      setSearching(false)
    }
  }

  const loadFriends = async () => {
    try {
      setLoading(true)
      const friendsList = await getFriendsList(userId)
      setFriends(friendsList)

      // Load presence for all friends
      if (friendsList.length > 0) {
        const friendIds = friendsList.map(f => f.id)
        const presenceMap = await getMultipleUsersPresence(friendIds)
        setOnlineUsers(presenceMap)

        // Subscribe to presence updates
        if (presenceUnsubscribe) presenceUnsubscribe()
        const unsubscribe = await subscribeToMultiplePresence(friendIds, (userId, status) => {
          setOnlineUsers(prev => ({ ...prev, [userId]: status }))
        })
        setPresenceUnsubscribe(() => unsubscribe)
      }
    } catch (err) {
      console.warn('Load friends error:', err)
    } finally {
      setLoading(false)
    }
  }

  const startChat = async (otherUser) => {
    try {
      const convId = await getOrCreateDirectConversation(userId, otherUser.id)
      setSelectedConversation({ id: convId, user: otherUser })
      setSearchQuery('')
      setSearchResults([])
    } catch (err) {
      console.warn('Start chat error:', err)
    }
  }

  const loadMessages = async () => {
    if (!selectedConversation?.id) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*, users:sender_id(id, full_name, email)')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true })
        .limit(200)

      if (!error && data) {
        const decrypted = await Promise.all(
          data.map(async (msg) => {
            if (msg.ciphertext && msg.iv) {
              try {
                const keyB64 = localStorage.getItem(`conv_key_${selectedConversation.id}`)
                if (keyB64) {
                  const key = await importKeyFromBase64(keyB64)
                  const plain = await decryptString(key, msg.ciphertext, msg.iv)
                  return { ...msg, plain, decrypted: true }
                }
              } catch (e) {
                console.warn('Decrypt error:', e)
              }
            }
            return { ...msg, plain: msg.plain || '[Encrypted]', decrypted: false }
          })
        )
        setMessages(decrypted)
      }
    } catch (err) {
      console.warn('Load messages error:', err)
    } finally {
      setLoading(false)
    }
  }

  const subscribeToMessages = () => {
    if (!selectedConversation?.id) return

    const channel = supabase
      .channel(`conv:${selectedConversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedConversation.id}`
      }, async (payload) => {
        const msg = payload.new
        if (msg.ciphertext && msg.iv) {
          try {
            const keyB64 = localStorage.getItem(`conv_key_${selectedConversation.id}`)
            if (keyB64) {
              const key = await importKeyFromBase64(keyB64)
              const plain = await decryptString(key, msg.ciphertext, msg.iv)
              setMessages(prev => [...prev, { ...msg, plain, decrypted: true }])
            }
          } catch (e) {
            console.warn('Decrypt error:', e)
            setMessages(prev => [...prev, { ...msg, plain: '[Encrypted]', decrypted: false }])
          }
        }
      })
      .subscribe()

    subRef.current = channel
  }

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation?.id || !userId) return

    setSending(true)
    try {
      const convId = selectedConversation.id
      const keyB64 = localStorage.getItem(`conv_key_${convId}`)
      let key

      if (keyB64) {
        key = await importKeyFromBase64(keyB64)
      } else {
        key = await generateSymmetricKey()
        const newKeyB64 = await exportKeyToBase64(key)
        localStorage.setItem(`conv_key_${convId}`, newKeyB64)
      }

      const { ciphertext, iv } = await encryptString(key, messageText.trim())

      const { data, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: userId,
          conversation_id: convId,
          ciphertext,
          iv,
          metadata: { type: 'text', via: 'chatbar' }
        }])
        .select()

      if (!error) {
        setMessageText('')
        if (data?.[0]) {
          const msg = data[0]
          setMessages(prev => [...prev, { ...msg, plain: messageText.trim(), decrypted: true }])
        }
      }
    } catch (err) {
      console.warn('Send message error:', err)
    } finally {
      setSending(false)
    }
  }

  const handleDeleteMessage = async (messageId, senderId) => {
    if (senderId !== userId) return

    try {
      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId)

      if (!error) {
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m))
        )
      }
    } catch (err) {
      console.warn('Delete message error:', err)
    }
  }

  const handleAddFriend = async (user) => {
    try {
      await sendFriendRequest(userId, user.id)
      setSearchResults(prev =>
        prev.map(u => (u.id === user.id ? { ...u, friendRequested: true } : u))
      )
    } catch (err) {
      console.warn('Friend request error:', err)
    }
  }

  const handleRemoveFriend = async (friendId) => {
    try {
      await removeFriend(userId, friendId)
      setFriends(prev => prev.filter(f => f.id !== friendId))
    } catch (err) {
      console.warn('Remove friend error:', err)
    }
  }

  const handleMediaUpload = async (file) => {
    if (!file || !selectedConversation?.id || !userId) return

    setUploading(true)
    try {
      // First, create a message without media
      const convId = selectedConversation.id
      const keyB64 = localStorage.getItem(`conv_key_${convId}`)
      let key

      if (keyB64) {
        key = await importKeyFromBase64(keyB64)
      } else {
        key = await generateSymmetricKey()
        const newKeyB64 = await exportKeyToBase64(key)
        localStorage.setItem(`conv_key_${convId}`, newKeyB64)
      }

      const { ciphertext, iv } = await encryptString(key, `[File: ${file.name}]`)

      const { data: messageData, error: msgError } = await supabase
        .from('messages')
        .insert([{
          sender_id: userId,
          conversation_id: convId,
          ciphertext,
          iv,
          metadata: { type: 'media', filename: file.name, mime_type: file.type }
        }])
        .select()

      if (msgError) throw msgError

      // Upload the file to storage
      const messageId = messageData[0].id
      await uploadMediaToChat(messageId, file)

      // Add message to list
      setMessages(prev => [...prev, {
        ...messageData[0],
        plain: `[File: ${file.name}]`,
        decrypted: true
      }])
      setMessageText('')
    } catch (err) {
      console.warn('Media upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const duration = Math.round(audioChunksRef.current.length / 50)
        await handleVoiceMessageUpload(audioBlob, duration)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setRecordingVoice(true)
    } catch (err) {
      console.warn('Voice recording error:', err)
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setRecordingVoice(false)
    }
  }

  const handleVoiceMessageUpload = async (audioBlob, duration) => {
    if (!selectedConversation?.id || !userId) return

    setUploading(true)
    try {
      const convId = selectedConversation.id
      const keyB64 = localStorage.getItem(`conv_key_${convId}`)
      let key

      if (keyB64) {
        key = await importKeyFromBase64(keyB64)
      } else {
        key = await generateSymmetricKey()
        const newKeyB64 = await exportKeyToBase64(key)
        localStorage.setItem(`conv_key_${convId}`, newKeyB64)
      }

      const { ciphertext, iv } = await encryptString(key, '[Voice Message]')

      const { data: messageData, error: msgError } = await supabase
        .from('messages')
        .insert([{
          sender_id: userId,
          conversation_id: convId,
          ciphertext,
          iv,
          metadata: { type: 'voice_message', duration }
        }])
        .select()

      if (msgError) throw msgError

      const messageId = messageData[0].id
      const voiceFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
      await uploadVoiceMessage(messageId, audioBlob, duration)

      setMessages(prev => [...prev, {
        ...messageData[0],
        plain: '[Voice Message]',
        decrypted: true
      }])
    } catch (err) {
      console.warn('Voice message upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed bottom-0 right-0 z-50 flex flex-col">
      {/* Minimized Button */}
      {minimized && (
        <button
          onClick={() => setMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-t-lg shadow-lg flex items-center gap-2 border-t border-l border-r border-blue-700"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
          </svg>
          <span className="font-medium text-sm">Messages</span>
          {Object.values(unreadCounts).reduce((a, b) => a + b, 0) > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-2">
              {Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>
      )}

      {/* Expanded Panel */}
      {!minimized && (
        <div className="bg-white rounded-t-lg shadow-2xl border border-slate-200 w-96 h-screen md:h-[600px] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
            <h2 className="font-bold text-lg">Messages</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMinimized(true)}
                className="hover:bg-blue-800 p-1 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === 'chats'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === 'friends'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Friends
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-slate-200">
            <input
              type="text"
              placeholder={activeTab === 'chats' ? 'Search conversations...' : 'Search users...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'chats' ? (
              selectedConversation ? (
                // Chat View
                <div className="flex flex-col h-full">
                  {/* Chat Header */}
                  <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium text-sm">
                          {selectedConversation.user?.full_name || selectedConversation.user?.email}
                        </div>
                        <div className="text-xs text-slate-500">
                          {onlineUsers.has(selectedConversation.user?.id) ? 'Active now' : 'Offline'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedConversation(null)
                        setMessages([])
                      }}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Messages */}
                  <div
                    ref={messageListRef}
                    className="flex-1 overflow-y-auto p-3 space-y-3 bg-white"
                  >
                    {messages.length === 0 && (
                      <div className="text-center text-sm text-slate-500 mt-4">
                        No messages yet. Start the conversation!
                      </div>
                    )}
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="max-w-xs">
                          <div
                            className={`px-3 py-2 rounded-lg text-sm ${
                              msg.sender_id === userId
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-slate-200 text-slate-900 rounded-bl-none'
                            } break-words`}
                          >
                            {msg.deleted_at ? (
                              <em className="text-xs opacity-75">Message deleted</em>
                            ) : (
                              msg.plain || '[Unable to decrypt]'
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1 px-1 text-xs text-slate-500">
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {msg.sender_id === userId && !msg.deleted_at && (
                              <button
                                onClick={() => handleDeleteMessage(msg.id, msg.sender_id)}
                                className="text-red-500 hover:text-red-700 ml-2"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input */}
                  <div className="p-3 border-t border-slate-200 bg-slate-50">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Write a message..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={sending || !messageText.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Chats List
                <div className="overflow-y-auto flex-1">
                  {searchResults.length > 0 ? (
                    <div className="p-2">
                      <div className="text-xs font-semibold text-slate-600 px-2 py-1 mb-2">
                        Start a conversation
                      </div>
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => startChat(user)}
                          className="w-full text-left p-2 hover:bg-slate-100 rounded-lg transition-colors text-sm"
                        >
                          <div className="font-medium">{user.full_name || user.email}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-slate-500 mt-4">
                      Search for users to start chatting
                    </div>
                  )}
                </div>
              )
            ) : (
              // Friends Tab
              <div className="overflow-y-auto flex-1">
                {loading ? (
                  <div className="text-center text-sm text-slate-500 mt-4">Loading friends...</div>
                ) : friends.length > 0 ? (
                  <div className="p-2">
                    {friends.map((friend) => (
                      <button
                        key={friend.id}
                        onClick={() => startChat(friend)}
                        className="w-full text-left p-2 hover:bg-slate-100 rounded-lg transition-colors mb-1 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-sm">{friend.full_name || friend.email}</div>
                          <div className="text-xs text-slate-500">{friend.email}</div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveFriend(friend.id)
                          }}
                          className="text-slate-400 hover:text-red-500 text-xs"
                        >
                          ✕
                        </button>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-sm text-slate-500 mt-4">
                    <p>No friends yet</p>
                    <p className="text-xs mt-1">Add friends from the search tab</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
