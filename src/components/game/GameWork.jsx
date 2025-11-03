import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function GameWork({ character, onEarnings }) {
  const [jobs, setJobs] = useState([
    {
      id: 'merchant',
      name: 'Street Merchant',
      description: 'Sell goods on the street',
      label: 'Merchant',
      baseWage: 50,
      duration: 30,
      energy: 20,
      experience: 10
    },
    {
      id: 'courier',
      name: 'Courier',
      description: 'Deliver packages around the city',
      label: 'Courier',
      baseWage: 75,
      duration: 45,
      energy: 30,
      experience: 15
    },
    {
      id: 'construction',
      name: 'Construction Worker',
      description: 'Work on construction projects',
      label: 'Construction',
      baseWage: 100,
      duration: 60,
      energy: 40,
      experience: 20
    },
    {
      id: 'security',
      name: 'Security Guard',
      description: 'Provide security services',
      label: 'Security',
      baseWage: 80,
      duration: 120,
      energy: 25,
      experience: 12
    },
    {
      id: 'vendor',
      name: 'Market Vendor',
      description: 'Manage a market stall',
      label: 'Vendor',
      baseWage: 120,
      duration: 90,
      energy: 35,
      experience: 18
    },
    {
      id: 'tutor',
      name: 'Tutor',
      description: 'Provide tutoring services',
      label: 'Tutor',
      baseWage: 150,
      duration: 60,
      energy: 15,
      experience: 25
    }
  ])

  const [activeJob, setActiveJob] = useState(null)
  const [working, setWorking] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [earnings, setEarnings] = useState(0)
  const [error, setError] = useState('')
  const [completedJobs, setCompletedJobs] = useState([])

  useEffect(() => {
    if (!working || !activeJob) return

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          completeJob()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [working, activeJob])

  const startWork = async (job) => {
    if (!character) {
      setError('Character not found')
      return
    }

    if ((character.energy || 100) < job.energy) {
      setError(`Not enough energy (need ${job.energy}, have ${character.energy || 100})`)
      return
    }

    try {
      setActiveJob(job)
      setWorking(true)
      setTimeRemaining(job.duration)
      setError('')
      setEarnings(0)

      await supabase
        .from('game_characters')
        .update({
          energy: Math.max(0, (character.energy || 100) - job.energy)
        })
        .eq('id', character.id)
    } catch (err) {
      setError(err.message)
      setWorking(false)
    }
  }

  const completeJob = async () => {
    if (!activeJob || !character) return

    const earnedAmount = activeJob.baseWage + Math.floor(Math.random() * activeJob.baseWage * 0.5)
    const expGain = activeJob.experience + Math.floor(Math.random() * 5)

    try {
      const currentChar = await supabase
        .from('game_characters')
        .select('*')
        .eq('id', character.id)
        .single()

      if (currentChar.data) {
        await supabase
          .from('game_characters')
          .update({
            money: (currentChar.data.money || 0) + earnedAmount,
            experience: (currentChar.data.experience || 0) + expGain,
            energy: Math.min(100, (currentChar.data.energy || 50) + 5)
          })
          .eq('id', character.id)
      }

      setCompletedJobs([...completedJobs, { job: activeJob, earnings: earnedAmount, exp: expGain }])
      setEarnings(earnedAmount)

      if (onEarnings) {
        onEarnings(earnedAmount)
      }

      setTimeout(() => {
        setWorking(false)
        setActiveJob(null)
        setTimeRemaining(0)
      }, 2000)
    } catch (err) {
      setError('Failed to complete job: ' + err.message)
      setWorking(false)
    }
  }

  const cancelWork = () => {
    setWorking(false)
    setActiveJob(null)
    setTimeRemaining(0)
    setEarnings(0)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getJobWageWithBonus = (job) => {
    const characterLevel = character?.level || 1
    const levelBonus = characterLevel * 0.1
    return Math.floor(job.baseWage * (1 + levelBonus))
  }

  if (working && activeJob) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-md p-8 text-center">
          <p className="text-2xl font-bold text-blue-400 mb-4">{activeJob.label}</p>
          <h2 className="text-2xl font-bold text-white mb-2">{activeJob.name}</h2>
          <p className="text-slate-400 mb-6">{activeJob.description}</p>

          <div className="bg-slate-700 rounded-lg p-6 mb-6">
            <div className="text-5xl font-bold text-blue-400 font-mono">
              {formatTime(timeRemaining)}
            </div>
            <div className="w-full bg-slate-600 rounded h-3 mt-4 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-1000"
                style={{
                  width: `${((activeJob.duration - timeRemaining) / activeJob.duration) * 100}%`
                }}
              />
            </div>
          </div>

          {earnings > 0 && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-6">
              <p className="text-green-400 text-sm">WORK COMPLETED!</p>
              <p className="text-2xl font-bold text-green-400">+₱{earnings.toLocaleString()}</p>
            </div>
          )}

          <button
            onClick={cancelWork}
            disabled={earnings > 0}
            className={`w-full py-3 rounded font-bold transition-colors ${
              earnings > 0
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {earnings > 0 ? 'Close' : 'Cancel Work'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Balance</p>
          <p className="text-xl font-bold text-yellow-400">₱{(character?.money || 0).toLocaleString()}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Level</p>
          <p className="text-xl font-bold text-blue-400">{character?.level || 1}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Energy</p>
          <p className="text-xl font-bold text-green-400">{character?.energy || 100}/100</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Experience</p>
          <p className="text-xl font-bold text-purple-400">{character?.experience || 0}</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map(job => (
          <div
            key={job.id}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded font-semibold">
                {job.label}
              </span>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                {job.duration}s
              </span>
            </div>

            <h3 className="font-bold text-white mb-1">{job.name}</h3>
            <p className="text-slate-400 text-sm mb-3">{job.description}</p>

            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Base Wage</span>
                <span className="font-bold text-yellow-400">₱{getJobWageWithBonus(job).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Energy Cost</span>
                <span className="font-bold text-orange-400">{job.energy}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Experience</span>
                <span className="font-bold text-purple-400">+{job.experience}</span>
              </div>
            </div>

            <button
              onClick={() => startWork(job)}
              disabled={(character?.energy || 100) < job.energy}
              className={`w-full py-2 rounded font-bold text-sm transition-colors ${
                (character?.energy || 100) >= job.energy
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'
              }`}
            >
              Start Work
            </button>
          </div>
        ))}
      </div>

      {/* Recently Completed */}
      {completedJobs.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h3 className="font-bold text-white mb-3">Recent Earnings</h3>
          <div className="space-y-2">
            {completedJobs.slice(-5).reverse().map((entry, idx) => (
              <div key={idx} className="flex justify-between text-sm text-slate-400">
                <span>{entry.job.name}</span>
                <span className="text-green-400 font-bold">+₱{entry.earnings.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
