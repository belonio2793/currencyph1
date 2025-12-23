import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const ACHIEVEMENT_LEVELS = [
  { 
    level: 'bronze', 
    minValue: 0, 
    label: 'Bronze Member', 
    icon: '🥉',
    description: 'Getting started',
    color: 'from-amber-900 to-amber-800',
    textColor: 'text-amber-300'
  },
  { 
    level: 'silver', 
    minValue: 50000, 
    label: 'Silver Member', 
    icon: '🥈',
    description: 'Rising contributor',
    color: 'from-slate-600 to-slate-700',
    textColor: 'text-slate-200'
  },
  { 
    level: 'gold', 
    minValue: 250000, 
    label: 'Gold Member', 
    icon: '🥇',
    description: 'Major contributor',
    color: 'from-yellow-700 to-yellow-800',
    textColor: 'text-yellow-200'
  },
  { 
    level: 'platinum', 
    minValue: 1000000, 
    label: 'Platinum Member', 
    icon: '💎',
    description: 'Elite partner',
    color: 'from-cyan-700 to-cyan-800',
    textColor: 'text-cyan-200'
  },
  { 
    level: 'diamond', 
    minValue: 5000000, 
    label: 'Diamond Elite', 
    icon: '✨',
    description: 'Legend status',
    color: 'from-purple-700 to-purple-800',
    textColor: 'text-purple-200'
  }
]

const MILESTONES = [
  { value: 10000, icon: '🎯', label: 'First ₱10K', description: 'First major milestone' },
  { value: 100000, icon: '🚀', label: '₱100K Club', description: 'Reaching six figures' },
  { value: 500000, icon: '⭐', label: '₱500K Superstar', description: 'Half a million achieved' },
  { value: 1000000, icon: '👑', label: 'Millionaire', description: 'Million peso partner' },
  { value: 5000000, icon: '💫', label: 'Mega Contributor', description: 'Five million milestone' }
]

const getAchievementLevel = (totalValue) => {
  for (let i = ACHIEVEMENT_LEVELS.length - 1; i >= 0; i--) {
    if (totalValue >= ACHIEVEMENT_LEVELS[i].minValue) {
      return ACHIEVEMENT_LEVELS[i]
    }
  }
  return ACHIEVEMENT_LEVELS[0]
}

const getUnlockedMilestones = (totalValue) => {
  return MILESTONES.filter(m => totalValue >= m.value)
}

const getNextMilestone = (totalValue) => {
  const next = MILESTONES.find(m => totalValue < m.value)
  return next
}

export default function UserContributionProfile({ userId, isMobile = false }) {
  const [profile, setProfile] = useState(null)
  const [commitments, setCommitments] = useState([])
  const [totalValue, setTotalValue] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      loadUserData()
    }
  }, [userId])

  const loadUserData = async () => {
    try {
      setLoading(true)

      // Load profile
      const { data: profileData } = await supabase
        .from('commitment_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (profileData) {
        setProfile(profileData)

        // Load commitments
        const { data: commitmentsData = [] } = await supabase
          .from('commitments')
          .select('*')
          .eq('commitment_profile_id', profileData.id)
          .eq('status', 'active')

        setCommitments(commitmentsData)

        const total = commitmentsData.reduce((sum, c) => sum + (c.grand_total || 0), 0)
        setTotalValue(total)
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !profile) {
    return null
  }

  const currentLevel = getAchievementLevel(totalValue)
  const unlockedMilestones = getUnlockedMilestones(totalValue)
  const nextMilestone = getNextMilestone(totalValue)
  const progressToNext = nextMilestone 
    ? Math.min(100, (totalValue / nextMilestone.value) * 100)
    : 100

  return (
    <div className={`space-y-4 ${isMobile ? 'px-3' : 'px-6'}`}>
      {/* Main Achievement Card */}
      <div className={`bg-gradient-to-br ${currentLevel.color} rounded-xl p-6 border border-opacity-30 border-white shadow-xl`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-5xl mb-2">{currentLevel.icon}</div>
            <h3 className={`text-2xl font-bold ${currentLevel.textColor} mb-1`}>
              {currentLevel.label}
            </h3>
            <p className="text-white/80 text-sm">{currentLevel.description}</p>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-sm">Total Committed</p>
            <p className="text-3xl font-bold text-white">₱{(totalValue / 1000000).toFixed(1)}M</p>
            <p className="text-white/60 text-xs mt-1">{commitments.length} active contribution{commitments.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Progress to Next Level */}
      {nextMilestone && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-300 text-sm font-semibold">Progress to {nextMilestone.label}</p>
            <p className="text-slate-400 text-xs">{progressToNext.toFixed(0)}%</p>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-500"
              style={{ width: `${progressToNext}%` }}
            ></div>
          </div>
          <p className="text-slate-400 text-xs mt-2">
            ₱{(nextMilestone.value - totalValue).toLocaleString('en-US')} more to reach {nextMilestone.label}
          </p>
        </div>
      )}

      {/* Unlocked Milestones */}
      {unlockedMilestones.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h4 className="text-slate-300 font-semibold text-sm mb-3">🏆 Achievements Unlocked</h4>
          <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {unlockedMilestones.map((milestone, idx) => (
              <div key={idx} className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-lg p-3 border border-yellow-700/30">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{milestone.icon}</span>
                  <div>
                    <p className="text-yellow-200 font-semibold text-sm">{milestone.label}</p>
                    <p className="text-yellow-100/70 text-xs">{milestone.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 text-center">
          <p className="text-slate-400 text-xs font-medium">Active Items</p>
          <p className="text-white font-bold text-xl mt-1">{commitments.length}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 text-center">
          <p className="text-slate-400 text-xs font-medium">Business Type</p>
          <p className="text-white font-bold text-sm mt-1 capitalize truncate">
            {profile.business_type?.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 text-center">
          <p className="text-slate-400 text-xs font-medium">Member Since</p>
          <p className="text-white font-bold text-sm mt-1">
            {new Date(profile.created_at).getFullYear()}
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 text-center">
          <p className="text-slate-400 text-xs font-medium">Level</p>
          <p className="text-emerald-300 font-bold text-sm mt-1">
            {ACHIEVEMENT_LEVELS.findIndex(l => l.level === currentLevel.level) + 1}/5
          </p>
        </div>
      </div>
    </div>
  )
}
