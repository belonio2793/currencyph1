import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import ChatBar from '../ChatBar'
import { ABILITIES, STATUS_EFFECTS, combatEngine, animations, TimerManager } from './DuelEnhancements'

const TURN_TIME_LIMIT = 30000 // 30 seconds per turn

export default function DuelMatch({ sessionId, player, opponent, onEnd, userId, userEmail }) {
  const [playerHP, setPlayerHP] = useState(100)
  const [opponentHP, setOpponentHP] = useState(100)
  const [playerEnergy, setPlayerEnergy] = useState(100)
  const [opponentEnergy, setOpponentEnergy] = useState(100)
  const [logs, setLogs] = useState([])
  const [isAttacking, setIsAttacking] = useState(false)
  const [matchStartTime] = useState(Date.now())
  const [roundNumber, setRoundNumber] = useState(0)
  const [matchEnded, setMatchEnded] = useState(false)
  const [turnStartTime, setTurnStartTime] = useState(Date.now())
  const [timeRemaining, setTimeRemaining] = useState(TURN_TIME_LIMIT / 1000)
  const [activeAnimations, setActiveAnimations] = useState([])
  const [playerCooldowns, setPlayerCooldowns] = useState({})
  const [playerStatus, setPlayerStatus] = useState({})
  const [opponentStatus, setOpponentStatus] = useState({})
  
  const channelRef = useRef(null)
  const actionsRef = useRef([])
  const timerIntervalRef = useRef(null)

  // Timer countdown
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      const remaining = TimerManager.remaining(turnStartTime, TURN_TIME_LIMIT)
      setTimeRemaining(remaining)
      
      if (remaining <= 0 && !matchEnded && !isAttacking) {
        handleTurnTimeout()
      }
    }, 100)

    return () => clearInterval(timerIntervalRef.current)
  }, [turnStartTime, matchEnded, isAttacking])

  // Animation cleanup
  useEffect(() => {
    setActiveAnimations(prev => 
      prev.filter(anim => (Date.now() - anim.startTime) < anim.duration)
    )
  }, [activeAnimations])

  useEffect(() => {
    let mounted = true
    const channel = supabase.channel(`public:duel_${sessionId}`)

    channel.on('broadcast', { event: 'duel_action' }, (payload) => {
      try {
        const p = payload?.payload
        if (!p || p.sessionId !== sessionId) return
        
        if (p.type === 'action') {
          if (p.from === player?.id) return
          
          const damage = Number(p.damage || 0)
          const abilityName = p.abilityName || 'Attack'
          
          setPlayerHP((hp) => Math.max(0, hp - damage))
          setLogs((l) => [`${p.from_name} used ${abilityName} for ${damage} damage!`, ...l].slice(0, 25))
          
          if (p.effects) {
            p.effects.forEach(effect => {
              setPlayerStatus(s => ({ ...s, [effect.name]: effect }))
            })
          }
          
          setActiveAnimations(prev => [...prev, animations.createDamageAnimation(damage, true)])
        }
        
        if (p.type === 'heal') {
          if (p.from === player?.id) return
          const healAmount = Number(p.amount || 0)
          setOpponentHP((hp) => Math.min(100, hp + healAmount))
          setLogs((l) => [`${p.from_name} healed for ${healAmount}!`, ...l].slice(0, 25))
          setActiveAnimations(prev => [...prev, animations.createHealAnimation(healAmount, false)])
        }
        
        if (p.type === 'end') {
          const winner = p.winner
          if (mounted) {
            setLogs((l) => [`Match ended. Winner: ${winner}`, ...l].slice(0, 25))
            setTimeout(() => { try { onEnd && onEnd({ winner }) } catch (e){} }, 500)
          }
        }
      } catch (e) { console.warn('duel_action handler', e) }
    })

    channel.subscribe().then(() => {
      channelRef.current = channel
      try { 
        channel.send({ 
          type: 'broadcast', 
          event: 'duel_action', 
          payload: { sessionId, type: 'join', from: player?.id, from_name: player?.name } 
        }) 
      } catch (e) {}
    }).catch(() => {})

    return () => {
      mounted = false
      try { if (channelRef.current) channelRef.current.unsubscribe() } catch (e) {}
      channelRef.current = null
    }
  }, [sessionId, player?.id, player?.name, onEnd])

  useEffect(() => {
    if (playerHP <= 0) {
      endMatch(opponent?.name || 'Opponent')
    }
    if (opponentHP <= 0) {
      endMatch(player?.name || 'You')
    }
  }, [playerHP, opponentHP])

  const handleTurnTimeout = async () => {
    setLogs((l) => ['Turn timeout! You forfeited.', ...l].slice(0, 25))
    await endMatch(opponent?.name || 'Opponent')
  }

  const sendAction = async (action) => {
    if (!channelRef.current) return
    try {
      await channelRef.current.send({ type: 'broadcast', event: 'duel_action', payload: action })
    } catch (e) { console.warn('sendAction failed', e) }
  }

  const executeAbility = async (abilityKey) => {
    if (isAttacking || matchEnded || timeRemaining <= 0) return
    
    const ability = ABILITIES[abilityKey]
    if (!ability) return

    const cooldown = playerCooldowns[abilityKey] || 0
    if (cooldown > 0) {
      setLogs((l) => [`${ability.name} is on cooldown for ${cooldown} more turns.`, ...l].slice(0, 25))
      return
    }

    setIsAttacking(true)
    const nextRound = roundNumber + 1
    setRoundNumber(nextRound)

    const result = ability.execute({ level: player?.level || 1 })
    const damage = combatEngine.calculateDamage(ability, player, { activeEffects: playerStatus })
    
    // Update own energy
    setPlayerEnergy((e) => Math.max(0, e - (result.energy || 0)))
    
    // Apply cooldown
    if (ability.cooldown > 0) {
      setPlayerCooldowns(c => ({ ...c, [abilityKey]: ability.cooldown }))
    }

    // Reduce all cooldowns
    setPlayerCooldowns(c => 
      Object.keys(c).reduce((acc, key) => ({
        ...acc,
        [key]: Math.max(0, c[key] - 1)
      }), {})
    )

    // Handle different ability types
    if (result.type === 'heal') {
      const healAmount = result.heal || 20
      setPlayerHP((hp) => Math.min(100, hp + healAmount))
      setLogs((l) => [`You healed for ${healAmount}!`, ...l].slice(0, 25))
      setActiveAnimations(prev => [...prev, animations.createHealAnimation(healAmount, true)])
      
      await sendAction({ 
        sessionId, 
        type: 'heal', 
        from: player?.id, 
        from_name: player?.name, 
        amount: healAmount,
        abilityName: ability.name
      })
    } else {
      // Damage action
      setOpponentHP((hp) => Math.max(0, hp - damage))
      setLogs((l) => [`You used ${ability.name} for ${damage} damage!`, ...l].slice(0, 25))
      setActiveAnimations(prev => [...prev, animations.createDamageAnimation(damage, false)])

      // Apply effects from ability
      const effects = []
      if (result.shield) {
        setPlayerStatus(s => ({
          ...s,
          shield: { ...STATUS_EFFECTS.shield, turnsRemaining: 2 }
        }))
        effects.push('shield')
      }
      
      if (result.stun) {
        effects.push('stun')
      }

      await sendAction({ 
        sessionId, 
        type: 'action', 
        from: player?.id, 
        from_name: player?.name, 
        damage,
        abilityName: ability.name,
        effects
      })
    }

    // Simulate opponent turn after delay
    setTimeout(() => {
      performOpponentTurn()
      setTurnStartTime(Date.now())
      setIsAttacking(false)
    }, ability.cooldown === 0 ? 1200 : 1800)
  }

  const performOpponentTurn = () => {
    // Simple AI: randomly choose attack or heal based on HP
    const shouldHeal = opponentHP < 40 && Math.random() < 0.6
    const abilityKey = shouldHeal ? 'powerHeal' : (Math.random() < 0.7 ? 'attack' : 'powerStrike')
    
    const ability = ABILITIES[abilityKey]
    if (!ability) return

    const result = ability.execute({ level: opponent?.level || 1 })
    const damage = combatEngine.calculateDamage(ability, opponent, { activeEffects: opponentStatus })

    if (result.type === 'heal') {
      const healAmount = result.heal || 20
      setOpponentHP((hp) => Math.min(100, hp + healAmount))
      setLogs((l) => [`${opponent?.name} healed for ${healAmount}!`, ...l].slice(0, 25))
    } else {
      setPlayerHP((hp) => Math.max(0, hp - damage))
      setLogs((l) => [`${opponent?.name} used ${ability.name} for ${damage} damage!`, ...l].slice(0, 25))
      setActiveAnimations(prev => [...prev, animations.createDamageAnimation(damage, true)])
    }
  }

  const endMatch = async (winner) => {
    if (matchEnded) return
    setMatchEnded(true)

    try {
      await sendAction({ sessionId, type: 'end', winner })
    } catch (e) { console.warn('sendAction failed', e) }

    const winnerId = winner === player?.name ? player?.id : opponent?.id
    const isPlayerWinner = winnerId === player?.id
    const durationSeconds = Math.floor((Date.now() - matchStartTime) / 1000)

    try {
      const { error: matchError } = await supabase
        .from('game_matches')
        .insert([{
          session_id: sessionId,
          player1_id: player?.id,
          player2_id: opponent?.id,
          player1_name: player?.name,
          player2_name: opponent?.name,
          winner_id: winnerId,
          player1_final_hp: isPlayerWinner ? playerHP : opponentHP,
          player2_final_hp: isPlayerWinner ? opponentHP : playerHP,
          duration_seconds: durationSeconds,
          total_rounds: roundNumber,
          reward_winner: 100,
          reward_loser: 25,
          status: 'completed'
        }])

      if (!matchError) {
        await distributeRewards(isPlayerWinner)
      }
    } catch (e) {
      console.error('Error saving match:', e)
    }

    try { onEnd && onEnd({ winner, winnerId, isPlayerWinner }) } catch (e) {}
  }

  const distributeRewards = async (playerWon) => {
    try {
      const winnerReward = 100
      const loserReward = 25

      const winnerId = playerWon ? player?.id : opponent?.id
      const loserId = playerWon ? opponent?.id : player?.id

      await supabase
        .from('game_characters')
        .update({ money: playerWon ? playerWon : loserReward, updated_at: new Date() })
        .eq('id', winnerId)

      await supabase
        .from('game_characters')
        .update({ money: loserReward, updated_at: new Date() })
        .eq('id', loserId)

      setLogs((l) => [
        `Winner received ${winnerReward} credits!`,
        ...l
      ].slice(0, 25))
    } catch (e) {
      console.error('Error distributing rewards:', e)
    }
  }

  const getAbilitiesList = () => Object.entries(ABILITIES).map(([key, ability]) => ({ key, ...ability }))

  return (
    <div className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-5xl w-full p-4 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-xl">⚔️ Duel Arena</div>
          <div className="flex gap-3 items-center">
            <div className={`text-2xl font-bold ${timeRemaining > 10 ? 'text-yellow-300' : 'text-red-400'}`}>
              {timeRemaining}s
            </div>
            <div className="text-xs text-slate-400">Round {roundNumber}</div>
          </div>
        </div>

        {/* Battle Arena */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Player 1 */}
          <div className="bg-slate-800/30 p-4 rounded border border-slate-700">
            <div className="text-center mb-3">
              <div className="text-sm text-slate-400">You</div>
              <div className="text-lg font-bold text-yellow-300">{player?.name}</div>
              <div className="text-sm text-slate-400 mt-1">Level {player?.level || 1}</div>
            </div>

            {/* HP Bar */}
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1">{playerHP} / 100 HP</div>
              <div className="h-3 bg-slate-700 rounded overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-green-400" style={{ width: `${playerHP}%` }} />
              </div>
            </div>

            {/* Energy Bar */}
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1">{playerEnergy} / 100 Energy</div>
              <div className="h-2 bg-slate-700 rounded overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${playerEnergy}%` }} />
              </div>
            </div>

            {/* Status Effects */}
            <div className="flex gap-1 flex-wrap mb-3">
              {Object.entries(playerStatus).map(([key, effect]) => (
                <div key={key} title={effect.description} className="px-2 py-1 bg-yellow-600/20 border border-yellow-600/40 rounded text-xs flex items-center gap-1">
                  <span>{effect.icon}</span>
                  <span>{effect.turnsRemaining}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Player 2 */}
          <div className="bg-slate-800/30 p-4 rounded border border-slate-700">
            <div className="text-center mb-3">
              <div className="text-sm text-slate-400">Opponent</div>
              <div className="text-lg font-bold text-red-300">{opponent?.name}</div>
              <div className="text-sm text-slate-400 mt-1">Level {opponent?.level || 1}</div>
            </div>

            {/* HP Bar */}
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1">{opponentHP} / 100 HP</div>
              <div className="h-3 bg-slate-700 rounded overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-green-400" style={{ width: `${opponentHP}%` }} />
              </div>
            </div>

            {/* Energy Bar */}
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1">{opponentEnergy} / 100 Energy</div>
              <div className="h-2 bg-slate-700 rounded overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${opponentEnergy}%` }} />
              </div>
            </div>

            {/* Status Effects */}
            <div className="flex gap-1 flex-wrap mb-3">
              {Object.entries(opponentStatus).map(([key, effect]) => (
                <div key={key} title={effect.description} className="px-2 py-1 bg-yellow-600/20 border border-yellow-600/40 rounded text-xs flex items-center gap-1">
                  <span>{effect.icon}</span>
                  <span>{effect.turnsRemaining}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Abilities */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {getAbilitiesList().map(ability => {
            const cooldown = playerCooldowns[ability.key] || 0
            const isOnCooldown = cooldown > 0
            
            return (
              <button
                key={ability.key}
                onClick={() => executeAbility(ability.key)}
                disabled={isAttacking || matchEnded || isOnCooldown || timeRemaining <= 0}
                title={ability.description}
                className={`relative px-3 py-3 rounded text-sm font-bold transition ${
                  isOnCooldown
                    ? 'bg-slate-700 text-slate-500'
                    : isAttacking || matchEnded
                    ? 'bg-slate-700 text-slate-500'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <div className="text-lg mb-1">{ability.icon}</div>
                <div className="text-xs">{ability.name}</div>
                {isOnCooldown && <div className="text-xs font-bold text-red-300">{cooldown}</div>}
              </button>
            )
          })}
        </div>

        {/* Combat Log & Chat */}
        <div className="grid grid-cols-3 gap-4">
          {/* Combat Log */}
          <div className="col-span-2">
            <div className="h-64 overflow-y-auto bg-slate-900/30 p-3 rounded border border-slate-700">
              <div className="text-xs font-bold text-slate-400 mb-2">Combat Log:</div>
              {logs.length === 0 && <div className="text-slate-500 text-sm">Match started...</div>}
              {logs.map((l, i) => (
                <div key={i} className="mb-1.5 text-slate-200 text-sm">
                  <span className="text-slate-500">•</span> {l}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="col-span-1">
            <div className="flex flex-col h-64 border border-slate-700 rounded bg-slate-900/30 overflow-hidden">
              <div className="text-xs font-bold text-slate-400 p-2 border-b border-slate-700">Chat</div>
              <div className="flex-1 flex flex-col overflow-hidden">
                <ChatBar 
                  userId={userId}
                  userEmail={userEmail}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Animations Overlay */}
        {activeAnimations.map(anim => (
          <div
            key={anim.id}
            className={`fixed pointer-events-none font-bold text-lg ${
              anim.type === 'damage' ? 'text-red-400' : 'text-green-400'
            }`}
            style={{
              left: `${anim.isPlayer ? '35%' : '65%'}`,
              top: '30%',
              opacity: 1 - (Date.now() - anim.startTime) / anim.duration,
              transform: `translateY(${(Date.now() - anim.startTime) / anim.duration * 100}px)`,
              transition: 'opacity 0.1s'
            }}
          >
            {anim.type === 'damage' ? `-${anim.damage}` : `+${anim.amount}`}
          </div>
        ))}
      </div>
    </div>
  )
}
