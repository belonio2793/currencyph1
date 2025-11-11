import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { supabase } from '../lib/supabaseClient'
import { getOnlineUsers, subscribeToOnlineUsers } from '../lib/presence'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Create custom icons for friend vs non-friend
const createUserIcon = (isFriend) => {
  return L.divIcon({
    className: 'custom-user-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${isFriend ? '#10b981' : '#3b82f6'};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        font-size: 14px;
        font-weight: bold;
        color: white;
      ">
        ${isFriend ? '👤' : '🔵'}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  })
}

function MapBounds({ markers }) {
  const map = useMap()

  useEffect(() => {
    if (markers.length === 0) return

    const bounds = L.latLngBounds(markers.map(m => [m.latitude, m.longitude]))
    try {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 })
    } catch (e) {
      console.debug('fitBounds failed:', e)
    }
  }, [markers, map])

  return null
}

export default function OnlineUsers({ userId, userEmail }) {
  const [onlineUsers, setOnlineUsers] = useState([])
  const [friends, setFriends] = useState([])
  const [userProfiles, setUserProfiles] = useState({})
  const [filter, setFilter] = useState('all') // 'all' or 'friends'
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [pendingRequests, setPendingRequests] = useState({})
  const [loadError, setLoadError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  // Load friends list
  useEffect(() => {
    if (!userId) return

    const loadFriends = async () => {
      try {
        const { data, error } = await supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', userId)
          .eq('status', 'accepted')

        if (error && error.code !== 'PGRST116') throw error

        const friendIds = (data || []).map(f => f.friend_id)
        setFriends(friendIds)
      } catch (err) {
        console.warn('Failed to load friends:', err)
      }
    }

    loadFriends()
  }, [userId])

  // Load online users with real-time updates and a timeout/retry
  useEffect(() => {
    let isMounted = true
    let unsubscribe
    let timeoutId

    const loadOnlineUsers = async () => {
      setLoadError(null)
      try {
        const users = await getOnlineUsers()
        if (!isMounted) return
        setOnlineUsers(users)

        // Load user profiles for online users
        const profiles = {}
        for (const user of users) {
          if (!userProfiles[user.user_id]) {
            try {
              const { data, error } = await supabase
                .from('users')
                .select('id, email, full_name, profile_picture_url')
                .eq('id', user.user_id)
                .single()

              if (!error && data) profiles[user.user_id] = data
            } catch (err) {
              console.warn(`Failed to load profile for user ${user.user_id}:`, err)
            }
          }
        }

        if (isMounted) setUserProfiles(prev => ({ ...prev, ...profiles }))
      } catch (err) {
        console.warn('Failed to load online users:', err)
        if (isMounted) setLoadError(err?.message || 'Failed to load online users')
      } finally {
        if (isMounted) setLoading(false)
        clearTimeout(timeoutId)
      }
    }

    // Start a timeout to fail gracefully if loading takes too long
    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false)
        setLoadError('Unable to load online users. Please try again later.')
      }
    }, 8000)

    setLoading(true)
    loadOnlineUsers()

    // Subscribe to real-time updates
    try {
      subscribeToOnlineUsers(async (payload) => {
        try {
          const users = await getOnlineUsers()
          if (!isMounted) return
          setOnlineUsers(users)
        } catch (e) {
          console.warn('Realtime refresh failed:', e)
        }
      }).then(unsub => {
        unsubscribe = unsub
      })
    } catch (err) {
      console.warn('Failed to subscribe to online users:', err)
    }

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      if (unsubscribe) unsubscribe()
    }
  }, [retryCount])

  // Filter users based on friends/all selection
  const filteredUsers = filter === 'friends'
    ? onlineUsers.filter(u => friends.includes(u.user_id))
    : onlineUsers.filter(u => u.user_id !== userId) // Exclude current user

  // Add or remove friend
  const handleAddFriend = async (friendUserId) => {
    if (!userId) return

    try {
      setPendingRequests(prev => ({ ...prev, [friendUserId]: true }))

      // Check if friend request already exists
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id, status')
        .eq('requester_id', userId)
        .eq('receiver_id', friendUserId)
        .maybeSingle()

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          alert('Friend request already sent')
          return
        }
        if (existingRequest.status === 'accepted') {
          // Remove friend
          const { error } = await supabase
            .from('friends')
            .delete()
            .eq('user_id', userId)
            .eq('friend_id', friendUserId)

          if (!error) {
            setFriends(prev => prev.filter(id => id !== friendUserId))
          }
          return
        }
      }

      // Send friend request
      const { error } = await supabase
        .from('friend_requests')
        .insert([{
          requester_id: userId,
          receiver_id: friendUserId,
          status: 'pending'
        }])

      if (error) throw error

      alert('Friend request sent!')
    } catch (err) {
      console.error('Failed to add friend:', err)
      alert('Failed to send friend request')
    } finally {
      setPendingRequests(prev => ({ ...prev, [friendUserId]: false }))
    }
  }

  const isFriend = (friendUserId) => friends.includes(friendUserId)

  return (
    <div className="w-full h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Users Online ({filteredUsers.length})</h2>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Users
          </button>
          <button
            onClick={() => setFilter('friends')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'friends'
                ? 'bg-green-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Friends ({friends.length})
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex gap-4 p-4">
        {/* Map */}
        <div className="flex-1 min-h-[500px] bg-white rounded-lg shadow overflow-hidden relative">
          {loading ? (
            loadError ? (
              <div className="h-full flex items-center justify-center bg-slate-100 p-6">
                <div className="text-center">
                  <p className="text-red-600 font-medium mb-2">{loadError}</p>
                  <p className="text-slate-500 text-sm mb-4">If this persists, check your connection or try again.</p>
                  <div className="flex justify-center">
                    <button onClick={() => { setRetryCount(c => c + 1); setLoading(true); setLoadError(null) }} className="px-4 py-2 bg-blue-600 text-white rounded-md">Retry</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-slate-100">
                <div className="text-center">
                  <div className="animate-spin mb-4">
                    <svg className="w-8 h-8 text-blue-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 font-medium">Fetching online users...</p>
                </div>
              </div>
            )
          ) : filteredUsers.length > 0 ? (
            <MapContainer
              center={[12.5, 121.5]}
              zoom={13}
              keyboard={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />

              {filteredUsers.map(user => (
                <Marker
                  key={user.user_id}
                  position={[user.latitude, user.longitude]}
                  icon={createUserIcon(isFriend(user.user_id))}
                  eventHandlers={{
                    click: () => setSelectedUser(user)
                  }}
                >
                  <Popup>
                    <div className="text-sm max-w-xs">
                      <div className="font-semibold">{userProfiles[user.user_id]?.full_name || 'User'}</div>
                      <div className="text-xs text-slate-600 mt-1">{user.city || 'Location unknown'}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {user.latitude.toFixed(4)}, {user.longitude.toFixed(4)}
                      </div>
                      <button
                        onClick={() => handleAddFriend(user.user_id)}
                        disabled={pendingRequests[user.user_id]}
                        className={`mt-2 px-3 py-1 rounded text-xs font-medium transition-colors w-full ${
                          isFriend(user.user_id)
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        } disabled:opacity-50`}
                      >
                        {pendingRequests[user.user_id] ? 'Sending...' : isFriend(user.user_id) ? '👤 Friend' : '+ Add Friend'}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              <MapBounds markers={filteredUsers} />
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-100">
              <div className="text-center">
                <p className="text-slate-600 font-medium">
                  {filter === 'friends' ? 'None of your friends are online right now.' : 'No users are currently online.'}
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  {filter === 'friends'
                    ? 'Invite friends to connect — they\'ll appear here when they come online.'
                    : 'There are no users online at the moment. Try again later or share your profile so others can find you.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Users List */}
        <div className="w-80 min-h-[500px] bg-white rounded-lg shadow overflow-y-auto flex flex-col">
          {loading ? (
            loadError ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <p className="text-red-600 font-medium mb-2">{loadError}</p>
                  <button onClick={() => { setRetryCount(c => c + 1); setLoading(true); setLoadError(null) }} className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm">Retry</button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="animate-spin mb-2">
                    <svg className="w-6 h-6 text-blue-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 font-medium text-sm">Fetching users...</p>
                </div>
              </div>
            )
          ) : filteredUsers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <p className="text-slate-600 font-medium text-sm">
                  {filter === 'friends' ? 'None of your friends are online right now.' : 'No users are currently online.'}
                </p>
              </div>
            </div>
          ) : (
            <div>
              {filteredUsers.map(user => {
                const profile = userProfiles[user.user_id]
                const isFriendUser = isFriend(user.user_id)

                return (
                  <div
                    key={user.user_id}
                    onClick={() => setSelectedUser(user)}
                    className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${
                      selectedUser?.user_id === user.user_id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{profile?.full_name || 'User'}</div>
                        <div className="text-xs text-slate-500 mt-1">{profile?.email || 'No email'}</div>
                        <div className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${isFriendUser ? 'bg-green-500' : 'bg-slate-300'}`} />
                          {user.city || 'Location unknown'}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddFriend(user.user_id)
                        }}
                        disabled={pendingRequests[user.user_id]}
                        className={`ml-2 px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                          isFriendUser
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        } disabled:opacity-50`}
                      >
                        {pendingRequests[user.user_id] ? '...' : isFriendUser ? '✓' : '+'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
