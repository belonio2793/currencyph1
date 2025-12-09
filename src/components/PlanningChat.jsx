import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'

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
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)
  const [markers, setMarkers] = useState([])
  const [authChecked, setAuthChecked] = useState(false)
  const messagesEndRef = useRef(null)

  // Check auth on mount
  useEffect(() => {
    checkAuth().finally(() => setAuthChecked(true))
  }, [])

  // Subscribe to messages
  useEffect(() => {
    if (!isAuthenticated || !planningUser) return

    const subscription = supabase
      .from('planning_messages')
      .on('*', payload => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new])
        }
      })
      .subscribe()

    loadMessages()

    return () => {
      subscription.unsubscribe()
    }
  }, [isAuthenticated, planningUser])

  // Subscribe to markers
  useEffect(() => {
    if (!isAuthenticated || !planningUser) return

    const subscription = supabase
      .from('planning_markers')
      .on('*', payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          loadMarkers()
        }
      })
      .subscribe()

    loadMarkers()

    return () => {
      subscription.unsubscribe()
    }
  }, [isAuthenticated, planningUser])

  // Subscribe to online users
  useEffect(() => {
    if (!isAuthenticated) return

    const countOnlineUsers = async () => {
      const { count } = await supabase
        .from('planning_users')
        .select('id', { count: 'exact' })
        .eq('status', 'active')

      setOnlineCount(count || 0)
    }

    countOnlineUsers()
    const interval = setInterval(countOnlineUsers, 10000)

    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        // No planning_user record exists yet - user needs to register
        setPlanningUser(null)
        setAuthError('')
        return
      }

      if (data) {
        setPlanningUser(data)
        if (data.status === 'pending') {
          setAuthError('Your account is pending approval. Please wait for an administrator to activate your access.')
        } else if (data.status === 'active') {
          setAuthError('')
        } else if (data.status === 'suspended') {
          setAuthError('Your account has been suspended. Please contact an administrator.')
        }
      }
    } catch (error) {
      console.error('Error loading planning user:', error)
      setPlanningUser(null)
    }
  }

  const loadMessages = async () => {
    try {
      const { data } = await supabase
        .from('planning_messages')
        .select('*, planning_users!inner(name, email)')
        .order('created_at', { ascending: true })
        .limit(100)

      setMessages(data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const loadMarkers = async () => {
    try {
      const { data } = await supabase
        .from('planning_markers')
        .select('*')
        .order('created_at', { ascending: false })

      setMarkers(data || [])
    } catch (error) {
      console.error('Error loading markers:', error)
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
          status: 'pending',
          role: 'member'
        })

      if (insertError) {
        setAuthError(insertError.message)
        return
      }

      setAuthError('Registration successful! Please wait for admin approval.')
      setEmail('')
      setPassword('')
      setName('')
      setTimeout(() => {
        setAuthMode('login')
      }, 2000)
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
    setMarkers([])
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

  const defaultMarkers = [
    { id: '1', name: 'Processing Facility 1', latitude: 14.5994, longitude: 120.9842, marker_type: 'facility', status: 'planned' },
    { id: '2', name: 'Distribution Center', latitude: 14.6091, longitude: 121.0045, marker_type: 'distribution', status: 'active' },
    { id: '3', name: 'Equipment Warehouse', latitude: 14.5792, longitude: 121.0093, marker_type: 'storage', status: 'planned' }
  ]

  const displayMarkers = markers.length > 0 ? markers : defaultMarkers

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
            <span className="text-white text-sm">{userEmail}</span>
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
              attribution={null}
            />
            {displayMarkers.map(marker => (
              <Marker
                key={marker.id}
                position={[Number(marker.latitude), Number(marker.longitude)]}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-sm">{marker.name}</h3>
                    <p className="text-xs text-slate-600">{marker.marker_type}</p>
                    <p className="text-xs text-slate-600">Status: {marker.status}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Chat Section */}
        <div className="w-96 rounded-lg border border-slate-700 bg-slate-800 flex flex-col overflow-hidden">
          {/* Online Count */}
          <div className="bg-slate-700 px-4 py-3 border-b border-slate-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-white text-sm font-medium">{onlineCount} users online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-slate-500 text-center py-8 text-sm">
                No messages yet. Start the discussion!
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="text-sm">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-blue-400">
                      {msg.planning_users?.name || 'Unknown'}
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
              ))
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
              {planningUser && planningUser.status === 'pending' && (
                <div className="p-3 rounded text-sm bg-yellow-900 text-yellow-100">
                  Your account is pending approval. Please wait for an administrator to activate your access.
                </div>
              )}
              {planningUser && planningUser.status === 'suspended' && (
                <div className="p-3 rounded text-sm bg-red-900 text-red-100">
                  Your account has been suspended. Please contact an administrator.
                </div>
              )}
              {!isAuthenticated && authError && (
                <div className={`p-3 rounded text-sm ${
                  authError.includes('successful')
                    ? 'bg-green-900 text-green-100'
                    : 'bg-red-900 text-red-100'
                }`}>
                  {authError}
                </div>
              )}

              {!isAuthenticated && (
                <>
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
                </>
              )}

              {planningUser && (planningUser.status === 'pending' || planningUser.status === 'suspended') && (
                <button
                  onClick={handleSignOut}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded transition-colors"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
