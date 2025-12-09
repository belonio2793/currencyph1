import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import L from 'leaflet'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons (needed for proper Leaflet functionality)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function PlanningChat() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [planningUser, setPlanningUser] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [editingName, setEditingName] = useState('')
  const messagesEndRef = useRef(null)

  // Check auth on mount
  useEffect(() => {
    checkAuth().finally(() => setAuthChecked(true))
  }, [])

  // Subscribe to messages
  useEffect(() => {
    if (!isAuthenticated) return

    loadMessages()

    try {
      const channel = supabase
        .channel('planning_messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'planning_messages'
        }, (payload) => {
          setMessages(prev => [...prev, payload.new])
        })
        .subscribe()

      return () => {
        try { channel.unsubscribe() } catch (e) { /* ignore */ }
      }
    } catch (error) {
      console.debug('Message subscription error (non-critical):', error?.message)
      return () => {}
    }
  }, [isAuthenticated])

  // Subscribe to online users
  useEffect(() => {
    if (!isAuthenticated) return

    const loadOnlineUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('planning_users')
          .select('*')
          .eq('status', 'active')
          .order('name', { ascending: true })

        if (error) {
          console.debug('Online users loading error:', error.code)
          return
        }

        setOnlineUsers(data || [])
      } catch (error) {
        console.debug('Error loading online users:', error?.message)
      }
    }

    loadOnlineUsers()
    const interval = setInterval(loadOnlineUsers, 15000)

    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize editing name when planning user loads
  useEffect(() => {
    if (planningUser?.name) {
      setEditingName(planningUser.name)
    }
  }, [planningUser])

  const checkAuth = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (data?.session?.user) {
        setUserId(data.session.user.id)
        setUserEmail(data.session.user.email || '')
        setIsAuthenticated(true)
        await loadPlanningUser(data.session.user.id)
      } else {
        setIsAuthenticated(false)
        setPlanningUser(null)
        setUserEmail('')
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setIsAuthenticated(false)
      setPlanningUser(null)
      setUserEmail('')
    }
  }

  const loadPlanningUser = async (uid) => {
    try {
      const { data, error } = await supabase
        .from('planning_users')
        .select('*')
        .eq('user_id', uid)
        .single()

      if (error) {
        // No planning_user record exists yet - create one
        const displayName = userEmail.split('@')[0]
        const { data: newUser } = await supabase
          .from('planning_users')
          .insert({
            user_id: uid,
            email: userEmail,
            name: displayName,
            status: 'active',
            role: 'member'
          })
          .select()
          .single()

        if (newUser) {
          setPlanningUser(newUser)
          setEditingName(newUser.name)
        }
        return
      }

      if (data) {
        setPlanningUser(data)
        setEditingName(data.name)
      }
    } catch (error) {
      console.error('Error loading planning user:', error)
      setPlanningUser(null)
    }
  }

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('planning_messages')
        .select('*, planning_users(name, email)')
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) {
        console.debug('Message loading error (table may not exist yet):', error.code)
        return
      }

      setMessages(data || [])
    } catch (error) {
      console.debug('Error loading messages:', error?.message)
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setAuthError(error.message)
        return
      }

      setUserId(data.user.id)
      setUserEmail(data.user.email || '')
      setIsAuthenticated(true)
      loadPlanningUser(data.user.id)
      setEmail('')
      setPassword('')
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      })

      if (authError) {
        setAuthError(authError.message)
        return
      }

      const { error: insertError } = await supabase
        .from('planning_users')
        .insert({
          user_id: authData.user.id,
          email,
          name: name || email.split('@')[0],
          status: 'active',
          role: 'member'
        })

      if (insertError) {
        setAuthError(insertError.message)
        return
      }

      setAuthError('Registration successful!')
      setEmail('')
      setPassword('')
      setName('')
      setTimeout(() => {
        setAuthMode('login')
        checkAuth()
      }, 1500)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setUserId(null)
    setUserEmail('')
    setPlanningUser(null)
    setMessages([])
    setOnlineUsers([])
  }

  const sendMessage = async () => {
    if (!messageInput.trim() || !planningUser) return

    const messageText = messageInput.trim()
    setMessageInput('')

    try {
      const { data, error } = await supabase
        .from('planning_messages')
        .insert({
          user_id: userId,
          planning_user_id: planningUser.id,
          message: messageText
        })
        .select()

      if (error) {
        console.error('Error sending message:', error.code, error.message)
        setMessageInput(messageText)
        return
      }

      if (data && data.length > 0) {
        setMessages(prev => [...prev, { ...data[0], planning_users: { name: planningUser.name, email: userEmail } }])
      }
    } catch (error) {
      console.error('Error sending message:', error?.message)
      setMessageInput(messageText)
    }
  }

  const handleSaveProfile = async () => {
    if (!planningUser || !editingName.trim()) return

    try {
      const { error } = await supabase
        .from('planning_users')
        .update({ name: editingName.trim(), updated_at: new Date().toISOString() })
        .eq('id', planningUser.id)

      if (error) {
        console.error('Profile update error:', error)
        setAuthError('Failed to update profile: ' + error.message)
        return
      }

      const newUser = { ...planningUser, name: editingName.trim() }
      setPlanningUser(newUser)
      setShowProfileSettings(false)
      setAuthError('')
    } catch (error) {
      console.error('Error updating profile:', error)
      setAuthError('Error updating profile: ' + error.message)
    }
  }

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white mb-4">Initializing Planning Group...</div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-300"></div>
          </div>
        </div>
      </div>
    )
  }

  const showAuthModal = !isAuthenticated

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planning Group</h1>
          <p className="text-sm text-slate-400">Strategic partner coordination for manufacturing & distribution</p>
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowProfileSettings(true)}
              className="text-slate-300 hover:text-white text-sm transition-colors"
              title="Edit profile"
            >
              {planningUser?.name || userEmail}
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Map Section */}
        <div className="flex-1 rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
          <MapContainer center={[14.5994, 120.9842]} zoom={12} className="w-full h-full" attributionControl={false}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution=""
            />
          </MapContainer>
        </div>

        {/* Chat Section */}
        <div className="w-96 rounded-lg border border-slate-700 bg-slate-800 flex flex-col overflow-hidden">
          {/* Online Users Header */}
          <div className="bg-slate-700 px-4 py-3 border-b border-slate-600">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-white text-sm font-medium">{onlineUsers.length} members online</span>
            </div>
          </div>

          {/* Members List */}
          {onlineUsers.length > 0 && (
            <div className="max-h-32 overflow-y-auto border-b border-slate-600 bg-slate-750">
              <div className="p-3 space-y-2">
                {onlineUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className="text-slate-300 truncate">{user.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-slate-500 text-center py-8 text-sm">
                No messages yet. Start the discussion!
              </div>
            ) : (
              messages.map(msg => {
                const userName = msg.planning_users?.name || (msg.planning_users && typeof msg.planning_users === 'object' && msg.planning_users[0]?.name) || 'Unknown'
                return (
                  <div key={msg.id} className="text-sm">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-blue-400">
                        {userName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-slate-300 break-words">{msg.message}</p>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t border-slate-600 p-4 bg-slate-750">
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h1 className="text-3xl font-bold text-white mb-2 text-center">Planning Group</h1>
            <p className="text-slate-400 text-center mb-6 text-sm">Strategic partner coordination for manufacturing, facilities, and distribution</p>

            <div className="space-y-4">
              {authError && (
                <div className={`p-3 rounded text-sm ${
                  authError.includes('successful')
                    ? 'bg-green-900 text-green-100'
                    : 'bg-red-900 text-red-100'
                }`}>
                  {authError}
                </div>
              )}

              <form onSubmit={authMode === 'login' ? handleSignIn : handleRegister} className="space-y-4">
                {authMode === 'register' && (
                  <input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    disabled={authLoading}
                  />
                )}

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  disabled={authLoading}
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  disabled={authLoading}
                />

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-2 rounded transition-colors"
                >
                  {authLoading ? 'Loading...' : authMode === 'login' ? 'Sign In' : 'Register'}
                </button>
              </form>

              <div className="border-t border-slate-700 pt-4">
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login')
                    setAuthError('')
                  }}
                  className="w-full text-blue-400 hover:text-blue-300 text-sm"
                >
                  {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Sign In'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileSettings && isAuthenticated && planningUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Profile Settings</h2>

            {authError && (
              <div className="p-3 rounded text-sm bg-red-900 text-red-100 mb-4">
                {authError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Display Name</label>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={userEmail}
                  disabled
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Role</label>
                <input
                  type="text"
                  value={planningUser.role || 'member'}
                  disabled
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-slate-400 cursor-not-allowed capitalize"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowProfileSettings(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={!editingName.trim() || editingName === planningUser.name}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
