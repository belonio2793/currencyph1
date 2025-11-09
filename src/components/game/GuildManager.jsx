import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function GuildManager({ character, onClose }) {
  const [activeTab, setActiveTab] = useState('browse') // browse, my-guild, create
  const [guilds, setGuilds] = useState([])
  const [myGuild, setMyGuild] = useState(null)
  const [guildMembers, setGuildMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [guildName, setGuildName] = useState('')
  const [guildDescription, setGuildDescription] = useState('')
  const [selectedGuild, setSelectedGuild] = useState(null)

  useEffect(() => {
    loadGuilds()
  }, [character?.id])

  async function loadGuilds() {
    try {
      setLoading(true)

      // Load all guilds
      const { data: allGuilds } = await supabase
        .from('game_guilds')
        .select('*')
        .eq('status', 'active')
        .order('member_count', { ascending: false })

      setGuilds(allGuilds || [])

      // Load player's guild if any
      const { data: memberData } = await supabase
        .from('game_guild_members')
        .select('guild_id')
        .eq('character_id', character.id)
        .single()

      if (memberData) {
        const { data: guildData } = await supabase
          .from('game_guilds')
          .select('*')
          .eq('id', memberData.guild_id)
          .single()

        setMyGuild(guildData)

        // Load guild members
        const { data: members } = await supabase
          .from('game_guild_members')
          .select(`
            *,
            game_characters(name, level, wealth)
          `)
          .eq('guild_id', memberData.guild_id)

        setGuildMembers(members || [])
      }
    } catch (err) {
      console.error('Failed to load guilds:', err)
    } finally {
      setLoading(false)
    }
  }

  async function createGuild() {
    if (!guildName.trim()) {
      alert('Please enter a guild name')
      return
    }

    try {
      // Create guild
      const { data: guild, error: guildError } = await supabase
        .from('game_guilds')
        .insert([{
          name: guildName,
          description: guildDescription,
          leader_id: character.id,
          member_count: 1
        }])
        .select()
        .single()

      if (guildError) throw guildError

      // Add leader as member
      const { error: memberError } = await supabase
        .from('game_guild_members')
        .insert([{
          guild_id: guild.id,
          character_id: character.id,
          role: 'leader'
        }])

      if (memberError) throw memberError

      alert('Guild created successfully!')
      setGuildName('')
      setGuildDescription('')
      setActiveTab('my-guild')
      loadGuilds()
    } catch (err) {
      console.error('Failed to create guild:', err)
      alert('Failed to create guild')
    }
  }

  async function joinGuild(guildId) {
    try {
      const { error } = await supabase
        .from('game_guild_members')
        .insert([{
          guild_id: guildId,
          character_id: character.id,
          role: 'member'
        }])

      if (error) throw error

      // Update guild member count
      await supabase
        .from('game_guilds')
        .update({ member_count: guildMembers.length + 1 })
        .eq('id', guildId)

      alert('Successfully joined guild!')
      loadGuilds()
    } catch (err) {
      console.error('Failed to join guild:', err)
      alert('Failed to join guild')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-3xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">⚔️ Guild System</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 p-4 border-b border-slate-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded font-medium transition-colors whitespace-nowrap ${
              activeTab === 'browse'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Browse Guilds
          </button>
          {myGuild && (
            <button
              onClick={() => setActiveTab('my-guild')}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                activeTab === 'my-guild'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              My Guild
            </button>
          )}
          {!myGuild && (
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                activeTab === 'create'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Create Guild
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : activeTab === 'browse' ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-400 mb-4">
                Browse and join existing guilds to work together!
              </div>
              {guilds.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No guilds available yet
                </div>
              ) : (
                guilds.map(guild => (
                  <div
                    key={guild.id}
                    className="p-4 bg-slate-800 rounded border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-white">{guild.name}</h3>
                        <p className="text-sm text-slate-400">{guild.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-amber-400">
                          Lv {guild.level}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-400 mb-3">
                      <div>Members: {guild.member_count}</div>
                      <div>Treasury: ₱{Number(guild.treasury).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => joinGuild(guild.id)}
                      disabled={myGuild !== null}
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
                    >
                      {myGuild ? 'Already in a Guild' : 'Join Guild'}
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'my-guild' && myGuild ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800 rounded border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-2">{myGuild.name}</h3>
                <p className="text-slate-400 mb-4">{myGuild.description}</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-slate-400">Level</div>
                    <div className="text-2xl font-bold text-amber-400">{myGuild.level}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Members</div>
                    <div className="text-2xl font-bold text-blue-400">{myGuild.member_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Treasury</div>
                    <div className="text-lg font-bold text-green-400">
                      ₱{Number(myGuild.treasury).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-white mb-3">Guild Members</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {guildMembers.map(member => (
                    <div
                      key={member.id}
                      className="p-3 bg-slate-800 rounded border border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-white">
                          {member.game_characters?.name}
                          {member.role === 'leader' && <span className="text-xs text-amber-400 ml-2">👑 Leader</span>}
                          {member.role === 'officer' && <span className="text-xs text-blue-400 ml-2">⚔️ Officer</span>}
                        </div>
                        <div className="text-xs text-slate-400">
                          Level {member.game_characters?.level}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-400">
                          +₱{Number(member.contribution).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'create' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Guild Name
                </label>
                <input
                  type="text"
                  value={guildName}
                  onChange={(e) => setGuildName(e.target.value)}
                  placeholder="Enter guild name..."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={guildDescription}
                  onChange={(e) => setGuildDescription(e.target.value)}
                  placeholder="What's your guild about?"
                  rows="4"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 resize-none"
                />
              </div>

              <button
                onClick={createGuild}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
              >
                Create Guild
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
