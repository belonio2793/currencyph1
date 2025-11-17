import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { generateSymmetricKey, exportKeyToBase64, importKeyFromBase64, encryptString, decryptString } from '../lib/crypto'
import { getFriendsList, sendFriendRequest, removeFriend, isFriend, getPendingFriendRequests, getSentFriendRequests, acceptFriendRequest, rejectFriendRequest, blockUser, unblockUser, getBlockedUsers } from '../lib/friends'
import { getOrCreateDirectConversation } from '../lib/conversations'
import { uploadMediaToChat, uploadVoiceMessage } from '../lib/chatMedia'
import { subscribeToMultiplePresence, getMultipleUsersPresence } from '../lib/presence'
import { useGeolocation } from '../lib/useGeolocation'

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
  const privacySubRef = useRef(null)

  const [allUsers, setAllUsers] = useState([])
  const [allLoading, setAllLoading] = useState(false)
  const [sortAscending, setSortAscending] = useState(true)
  const [pendingRequests, setPendingRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [blockedUsers, setBlockedUsers] = useState([])
  const [userStatus, setUserStatus] = useState('online')

  const { location: userLocation } = useGeolocation()

  useEffect(() => {
    if (!userId || activeTab !== 'friends') return
    loadFriends()
    loadRequests()
  }, [userId, activeTab])

  // Allow other components to open the chat and start a conversation via a global event
  useEffect(() => {
    const handler = (e) => {
      const otherUser = e?.detail?.otherUser
      if (!otherUser) return
      setMinimized(false)
      setActiveTab('chats')
      startChat(otherUser)
    }

    const openChatHandler = (e) => {
      const otherUserId = e?.detail?.userId
      if (!otherUserId) return
      setMinimized(false)
      setActiveTab('chats')
      // Create a temporary user object from the userId
      startChat({ id: otherUserId })
    }

    window.addEventListener('openChatWithUser', handler)
    window.addEventListener('openChat', openChatHandler)
    return () => {
      window.removeEventListener('openChatWithUser', handler)
      window.removeEventListener('openChat', openChatHandler)
    }
  }, [])

  useEffect(() => {
    if (!userId || activeTab !== 'all') return
    loadAllUsers()
  }, [userId, activeTab, userLocation, sortAscending])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.length >= 2) {
        dbSearchUsers(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    if (!selectedConversation) return
    loadMessages()
    subscribeToMessages()
    return () => {
      if (subRef.current) supabase.removeSubscription(subRef.current)
    }
  }, [selectedConversation])

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!userId) return
    loadUserStatus()

    // Subscribe to privacy_settings changes for this user so status updates reflect immediately
    try {
      const channel = supabase
        .channel(`privacy:${userId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'privacy_settings', filter: `user_id=eq.${userId}` }, (payload) => {
          const row = payload.new
          if (row.field_name === 'presence_status') {
            setUserStatus(row.visibility)
          }
        })
        .subscribe()

      privacySubRef.current = channel
    } catch (e) {
      // ignore
    }

    return () => {
      try { if (privacySubRef.current) supabase.removeChannel(privacySubRef.current) } catch (e) {}
    }
  }, [userId])

  const dbSearchUsers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone_number, profile_picture_url, display_name_type')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone_number.ilike.%${query}%`)
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

      if (friendsList.length > 0) {
        const friendIds = friendsList.map(f => f.id)
        const presenceMap = await getMultipleUsersPresence(friendIds)
        setOnlineUsers(presenceMap)

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

  const loadRequests = async () => {
    try {
      const incoming = await getPendingFriendRequests(userId)
      setPendingRequests(incoming)
      const sent = await getSentFriendRequests(userId)
      setSentRequests(sent)
      const blocked = await getBlockedUsers(userId)
      setBlockedUsers(blocked)
    } catch (err) {
      console.warn('Load requests error:', err)
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
        .insert([{ sender_id: userId, conversation_id: convId, ciphertext, iv, metadata: { type: 'text', via: 'chatbar' } }])
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
        setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m)))
      }
    } catch (err) {
      console.warn('Delete message error:', err)
    }
  }

  const handleAddFriend = async (user) => {
    try {
      await sendFriendRequest(userId, user.id)
      setAllUsers(prev => prev.map(u => (u.id === user.id ? { ...u, friendRequested: true } : u)))
      await loadRequests()
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

  const handleAcceptRequest = async (requestId) => {
    try {
      await acceptFriendRequest(requestId)
      await loadFriends()
      await loadRequests()
    } catch (err) {
      console.warn('Accept request error:', err)
    }
  }

  const handleRejectRequest = async (requestId) => {
    try {
      await rejectFriendRequest(requestId)
      await loadRequests()
    } catch (err) {
      console.warn('Reject request error:', err)
    }
  }

  const handleBlockUser = async (blockedId) => {
    try {
      await blockUser(userId, blockedId)
      await loadRequests()
      await loadFriends()
    } catch (err) {
      console.warn('Block user error:', err)
    }
  }

  const handleUnblockUser = async (unblockedId) => {
    try {
      await unblockUser(userId, unblockedId)
      await loadRequests()
      await loadFriends()
    } catch (err) {
      console.warn('Unblock user error:', err)
    }
  }

  const handleMediaUpload = async (file) => {
    if (!file || !selectedConversation?.id || !userId) return

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

      const { ciphertext, iv } = await encryptString(key, `[File: ${file.name}]`)

      const { data: messageData, error: msgError } = await supabase
        .from('messages')
        .insert([{ sender_id: userId, conversation_id: convId, ciphertext, iv, metadata: { type: 'media', filename: file.name, mime_type: file.type } }])
        .select()

      if (msgError) throw msgError

      const messageId = messageData[0].id
      await uploadMediaToChat(messageId, file)

      setMessages(prev => [...prev, { ...messageData[0], plain: `[File: ${file.name}]`, decrypted: true }])
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
        .insert([{ sender_id: userId, conversation_id: convId, ciphertext, iv, metadata: { type: 'voice_message', duration } }])
        .select()

      if (msgError) throw msgError

      const messageId = messageData[0].id
      await uploadVoiceMessage(messageId, audioBlob, duration)

      setMessages(prev => [...prev, { ...messageData[0], plain: '[Voice Message]', decrypted: true }])
    } catch (err) {
      console.warn('Voice message upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const toRad = (d) => d * Math.PI / 180
  const distanceKm = (lat1, lon1, lat2, lon2) => {
    if (![lat1, lon1, lat2, lon2].every(v => typeof v === 'number' && !isNaN(v))) return Infinity
    const R = 6371
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const loadAllUsers = async () => {
    try {
      setAllLoading(true)
      const { data: usersData, error } = await supabase
        .from('users')
        .select('id, full_name, email, profile_picture_url, display_name_type, country_code, latitude, longitude')
        .neq('id', userId)
        .limit(200)

      if (error) {
        console.warn('Load users error:', error)
        setAllUsers([])
        return
      }

      const users = usersData || []
      const ids = users.map(u => u.id)

      let privacyMap = {}
      if (ids.length > 0) {
        const { data: privData } = await supabase
          .from('privacy_settings')
          .select('user_id, field_name, visibility')
          .in('user_id', ids)
          .eq('field_name', 'listed_in_all')

        (privData || []).forEach(p => {
          privacyMap[p.user_id] = p.visibility
        })
      }

      const visibleUsers = users.filter(u => (privacyMap[u.id] || 'everyone') !== 'only_me')

      const enriched = visibleUsers.map(u => {
        const lat = Number(u.latitude)
        const lon = Number(u.longitude)
        const dist = (userLocation && userLocation.latitude && userLocation.longitude && lat && lon) ? distanceKm(userLocation.latitude, userLocation.longitude, lat, lon) : Infinity
        return { ...u, distance_km: dist }
      })

      enriched.sort((a, b) => sortAscending ? (a.distance_km || Infinity) - (b.distance_km || Infinity) : (b.distance_km || Infinity) - (a.distance_km || Infinity))

      const sent = await getSentFriendRequests(userId)
      const sentMap = {}
      (sent || []).forEach(s => { if (s.receiver_id) sentMap[s.receiver_id] = s.status })

      const blocked = await getBlockedUsers(userId)
      const blockedMap = {}
      (blocked || []).forEach(b => { blockedMap[b.id] = true })

      const final = enriched.map(u => ({ ...u, friendRequested: !!sentMap[u.id], blocked: !!blockedMap[u.id] }))

      setAllUsers(final)
    } catch (err) {
      console.warn('Error loading all users:', err)
      setAllUsers([])
    } finally {
      setAllLoading(false)
    }
  }

  const toggleSortOrder = () => setSortAscending(prev => !prev)

  const loadUserStatus = async () => {
    if (!userId) return
    try {
      const { data } = await supabase
        .from('privacy_settings')
        .select('visibility')
        .eq('user_id', userId)
        .eq('field_name', 'presence_status')
        .limit(1)

      const vis = Array.isArray(data) && data.length > 0 ? data[0].visibility : 'online'
      setUserStatus(vis)
    } catch (e) {
      setUserStatus('online')
    }
  }

  const updateUserStatus = async (status) => {
    if (!userId) return
    setUserStatus(status)

    try {
      const { data: existingArr } = await supabase
        .from('privacy_settings')
        .select('id')
        .eq('user_id', userId)
        .eq('field_name', 'presence_status')
        .limit(1)

      const existing = Array.isArray(existingArr) && existingArr.length > 0 ? existingArr[0] : null

      if (existing) {
        await supabase.from('privacy_settings').update({ visibility: status }).eq('id', existing.id)
      } else {
        await supabase.from('privacy_settings').insert([{ user_id: userId, field_name: 'presence_status', visibility: status }])
      }

      // If user chose to Hide, also set listed_in_all to only_me; if switching away from hide, restore to everyone
      const { data: listedArr } = await supabase
        .from('privacy_settings')
        .select('id, visibility')
        .eq('user_id', userId)
        .eq('field_name', 'listed_in_all')
        .limit(1)

      const listedExisting = Array.isArray(listedArr) && listedArr.length > 0 ? listedArr[0] : null

      if (status === 'hide') {
        if (listedExisting) {
          if (listedExisting.visibility !== 'only_me') await supabase.from('privacy_settings').update({ visibility: 'only_me' }).eq('id', listedExisting.id)
        } else {
          await supabase.from('privacy_settings').insert([{ user_id: userId, field_name: 'listed_in_all', visibility: 'only_me' }])
        }
      } else {
        // if previously private because of hide, set to everyone when leaving hide
        if (listedExisting && listedExisting.visibility === 'only_me') {
          await supabase.from('privacy_settings').update({ visibility: 'everyone' }).eq('id', listedExisting.id)
        }
      }
    } catch (e) {
      console.warn('Failed updating presence status:', e)
    }
  }

  return (
    <div className="fixed bottom-0 right-0 z-50 flex flex-col light-mode-widget">
      {minimized && (
        <button onClick={() => setMinimized(false)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-t-lg shadow-lg flex items-center gap-2 border-t border-l border-r border-blue-700">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" /></svg>
          <span className="font-medium text-sm">Messages</span>
          {Object.values(unreadCounts).reduce((a, b) => a + b, 0) > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-2">{Object.values(unreadCounts).reduce((a, b) => a + b, 0)}</span>
          )}
        </button>
      )}

      {!minimized && (
        <div className="bg-white rounded-t-lg shadow-2xl border border-slate-200 w-96 h-screen md:h-[600px] flex flex-col">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-lg">Messages</h2>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${userStatus === 'online' ? 'bg-green-400' : userStatus === 'busy' ? 'bg-red-400' : userStatus === 'away' ? 'bg-yellow-400' : userStatus === 'hide' ? 'bg-black' : 'bg-slate-400'}`} />
                <select value={userStatus} onChange={(e) => updateUserStatus(e.target.value)} className="text-sm bg-blue-700/40 text-white px-2 py-1 rounded">
                  <option value="online">Online</option>
                  <option value="busy">Busy</option>
                  <option value="away">Away</option>
                  <option value="invisible">Offline</option>
                  <option value="hide">Hide</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setMinimized(true)} className="hover:bg-blue-800 p-1 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
          </div>

          {/* rest of UI unchanged, reuse previous rendering logic */}

          <div className="flex border-b border-slate-200">
            <button onClick={() => setActiveTab('chats')} className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'chats' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}>Chats</button>
            <button onClick={() => setActiveTab('friends')} className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'friends' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}>Friends</button>
            <button onClick={() => setActiveTab('all')} className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'all' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}>All</button>
          </div>

          <div className="p-3 border-b border-slate-200">
            <input type="text" placeholder={activeTab === 'chats' ? 'Search conversations...' : activeTab === 'friends' ? 'Search friends...' : 'Search users...'} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'chats' ? (
              selectedConversation ? (
                <div className="flex flex-col h-full">
                  <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${onlineUsers[selectedConversation.user?.id] === 'online' ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <div>
                        <div className="font-medium text-sm">{selectedConversation.user?.full_name || selectedConversation.user?.email}</div>
                        <div className="text-xs text-slate-500">{onlineUsers[selectedConversation.user?.id] === 'online' ? 'Active now' : onlineUsers[selectedConversation.user?.id] === 'away' ? 'Away' : 'Offline'}</div>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedConversation(null); setMessages([]) }} className="text-slate-600 hover:text-slate-900">Close</button>
                  </div>

                  <div ref={messageListRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-white">
                    {messages.length === 0 && (<div className="text-center text-sm text-slate-500 mt-4">No messages yet. Start the conversation!</div>)}
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-xs">
                          <div className={`px-3 py-2 rounded-lg text-sm ${msg.sender_id === userId ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-200 text-slate-900 rounded-bl-none'} break-words`}>{msg.deleted_at ? (<em className="text-xs opacity-75">Message deleted</em>) : (msg.plain || '[Unable to decrypt]')}</div>
                          <div className="flex items-center justify-between mt-1 px-1 text-xs text-slate-500">
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {msg.sender_id === userId && !msg.deleted_at && (<button onClick={() => handleDeleteMessage(msg.id, msg.sender_id)} className="text-red-500 hover:text-red-700 ml-2">Delete</button>)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Write a message..." value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                      <button onClick={sendMessage} disabled={sending || !messageText.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">Send</button>
                    </div>
                    <div className="flex gap-2">
                      <input ref={mediaInputRef} type="file" onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0])} className="hidden" />
                      <button onClick={() => mediaInputRef.current?.click()} disabled={uploading} title="Upload file" className="text-slate-600 hover:text-blue-600 disabled:opacity-50 transition-colors text-sm">📎 Upload</button>
                      <button onClick={recordingVoice ? stopVoiceRecording : startVoiceRecording} disabled={uploading} title={recordingVoice ? 'Stop recording' : 'Record voice message'} className={`text-slate-600 disabled:opacity-50 transition-colors text-sm ${recordingVoice ? 'text-red-500 animate-pulse' : 'hover:text-blue-600'}`}>🎤 Record</button>
                      <div className="flex-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-y-auto flex-1">
                  {searchResults.length > 0 ? (
                    <div className="p-2">
                      <div className="text-xs font-semibold text-slate-600 px-2 py-1 mb-2">Start a conversation</div>
                      {searchResults.map((user) => (
                        <button key={user.id} onClick={() => startChat(user)} className="w-full text-left p-2 hover:bg-slate-100 rounded-lg transition-colors text-sm">
                          <div className="font-medium">{user.full_name || user.email}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-slate-500 mt-4">Search for users to start chatting</div>
                  )}
                </div>
              )
            ) : activeTab === 'friends' ? (
              <div className="overflow-y-auto flex-1">
                {loading ? (<div className="text-center text-sm text-slate-500 mt-4">Loading friends...</div>) : (
                  <div className="p-2">
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-slate-600 px-2 py-1">Requests</div>
                      {pendingRequests.length === 0 && <div className="text-xs text-slate-500 px-2">No incoming requests</div>}
                      {pendingRequests.map(req => (
                        <div key={req.id} className="flex items-center justify-between p-2 bg-slate-50 rounded mb-1">
                          <div className="text-sm">{req.users?.full_name || req.users?.email}</div>
                          <div className="flex gap-2">
                            <button onClick={() => handleAcceptRequest(req.id)} className="text-emerald-600 text-xs">Accept</button>
                            <button onClick={() => handleRejectRequest(req.id)} className="text-red-600 text-xs">Reject</button>
                            <button onClick={() => handleBlockUser(req.requester_id)} className="text-slate-600 text-xs">Block</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mb-3">
                      <div className="text-xs font-semibold text-slate-600 px-2 py-1">Sent</div>
                      {sentRequests.length === 0 && <div className="text-xs text-slate-500 px-2">No sent requests</div>}
                      {sentRequests.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-slate-50 rounded mb-1">
                          <div className="text-sm">{s.users?.full_name || s.users?.email}</div>
                          <div className="text-xs text-slate-500">{s.status}</div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-600 px-2 py-1 mb-2">Friends</div>
                      {friends.length === 0 && <div className="text-xs text-slate-500 px-2">No friends yet</div>}
                      {friends.map((friend) => (
                        <button key={friend.id} onClick={() => startChat(friend)} className="w-full text-left p-2 hover:bg-slate-100 rounded-lg transition-colors mb-1 flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <div className={`w-2.5 h-2.5 rounded-full ${onlineUsers[friend.id] === 'online' ? 'bg-green-500' : 'bg-slate-300'}`} />
                            <div>
                              <div className="font-medium text-sm">{friend.full_name || friend.email}</div>
                              <div className="text-xs text-slate-500">{onlineUsers[friend.id] === 'online' ? 'online' : onlineUsers[friend.id] === 'away' ? 'away' : 'offline'}</div>
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handleRemoveFriend(friend.id) }} className="text-slate-400 hover:text-red-500 text-xs">✕</button>
                        </button>
                      ))}
                    </div>

                    {blockedUsers.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-slate-600 px-2 py-1">Blocked</div>
                        {blockedUsers.map(b => (
                          <div key={b.id} className="flex items-center justify-between p-2 bg-slate-50 rounded mb-1">
                            <div className="text-sm">{b.full_name || b.email}</div>
                            <button onClick={() => handleUnblockUser(b.id)} className="text-xs text-blue-600">Unblock</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                <div className="p-2 flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-600">All Users</div>
                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={toggleSortOrder} className="text-slate-600 hover:text-slate-900">{sortAscending ? 'Closest' : 'Farthest'}</button>
                    <span className="text-slate-400">{allLoading ? 'Loading...' : ''}</span>
                  </div>
                </div>
                {allUsers.length === 0 && !allLoading && <div className="text-xs text-slate-500 px-2">No users available</div>}
                {allUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-2 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-3" onClick={() => startChat(u)}>
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center text-slate-600">
                        {u.profile_picture_url ? <img src={u.profile_picture_url} alt="avatar" className="w-full h-full object-cover" /> : (u.full_name?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase())}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{u.full_name || u.email}</div>
                        <div className="text-xs text-slate-500">{u.display_name_type ? u.display_name_type.replace(/_/g, ' ') : 'default'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-400">{u.distance_km === Infinity ? '—' : `${u.distance_km.toFixed(1)} km`}</div>
                      {!u.blocked && (
                        u.friendRequested ? (
                          <div className="text-xs text-slate-500">Pending</div>
                        ) : (
                          <button onClick={() => handleAddFriend(u)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Add</button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
