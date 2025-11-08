import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import ChatBar from '../ChatBar'

export default function DuelMatch({ sessionId, player, opponent, onEnd }) {
  const [playerHP, setPlayerHP] = useState(100)
  const [opponentHP, setOpponentHP] = useState(100)
  const [logs, setLogs] = useState([])
  const [isAttacking, setIsAttacking] = useState(false)
  const [matchStartTime] = useState(Date.now())
  const [roundNumber, setRoundNumber] = useState(0)
  const [matchEnded, setMatchEnded] = useState(false)
  const channelRef = useRef(null)
  const actionsRef = useRef([])

  useEffect(() => {
    let mounted = true
    const channel = supabase.channel(`public:duel_${sessionId}`)

    channel.on('broadcast', { event: 'duel_action' }, (payload) => {
      try {
        const p = payload?.payload
        if (!p || p.sessionId !== sessionId) return
        if (p.type === 'attack') {
          if (p.from === player?.id) return // ignore our own broadcast
          const dmg = Number(p.damage || 0)
          setLogs((l) => [`${p.from_name || 'Opponent'} hit you for ${dmg}`, ...l].slice(0, 20))
          setPlayerHP((hp) => Math.max(0, hp - dmg))
        }
        if (p.type === 'end') {
          // opponent ended match
          const winner = p.winner
          if (mounted) {
            setLogs((l) => [`Match ended. Winner: ${winner}`, ...l].slice(0, 20))
            setTimeout(() => { try { onEnd && onEnd({ winner }) } catch (e){} }, 500)
          }
        }
      } catch (e) { console.warn('duel_action handler', e) }
    })

    channel.subscribe().then(() => {
      channelRef.current = channel
      // announce join
      try { channel.send({ type: 'broadcast', event: 'duel_action', payload: { sessionId, type: 'join', from: player?.id, from_name: player?.name } }) } catch (e) {}
    }).catch(() => {})

    return () => {
      mounted = false
      try { if (channelRef.current) channelRef.current.unsubscribe() } catch (e) {}
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    // check win condition
    if (playerHP <= 0) {
      endMatch(opponent?.name || 'Opponent')
    }
    if (opponentHP <= 0) {
      endMatch(player?.name || 'You')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerHP, opponentHP])

  const sendAction = async (action) => {
    if (!channelRef.current) return
    try {
      await channelRef.current.send({ type: 'broadcast', event: 'duel_action', payload: action })
    } catch (e) { console.warn('sendAction failed', e) }
  }

  const attack = async () => {
    if (isAttacking) return
    setIsAttacking(true)
    const damage = 5 + Math.floor(Math.random() * 16) // 5-20
    setLogs((l) => [`You hit ${opponent?.name || 'opponent'} for ${damage}`, ...l].slice(0,20))
    setOpponentHP((hp) => Math.max(0, hp - damage))
    // broadcast
    await sendAction({ sessionId, type: 'attack', from: player?.id, from_name: player?.name, damage })
    setTimeout(() => setIsAttacking(false), 800)
  }

  const skill = async () => {
    if (isAttacking) return
    setIsAttacking(true)
    const damage = 15 + Math.floor(Math.random() * 26) // 15-40
    setLogs((l) => [`You used Skill on ${opponent?.name || 'opponent'} for ${damage}`, ...l].slice(0,20))
    setOpponentHP((hp) => Math.max(0, hp - damage))
    await sendAction({ sessionId, type: 'attack', from: player?.id, from_name: player?.name, damage })
    setTimeout(() => setIsAttacking(false), 1800)
  }

  const endMatch = async (winner) => {
    if (matchEnded) return
    setMatchEnded(true)

    // Broadcast end action
    try {
      await sendAction({ sessionId, type: 'end', winner })
    } catch (e) { console.warn('sendAction failed', e) }

    // Determine winner ID
    const winnerId = winner === player?.name ? player?.id : opponent?.id
    const isPlayerWinner = winnerId === player?.id

    // Save match to database
    try {
      const durationSeconds = Math.floor((Date.now() - matchStartTime) / 1000)

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

      if (matchError) {
        console.error('Failed to save match:', matchError)
      } else {
        // Distribute rewards
        await distributeRewards(isPlayerWinner)
        setLogs((l) => ['Match saved to history.', ...l].slice(0, 25))
      }
    } catch (e) {
      console.error('Error saving match:', e)
    }

    // Notify parent component
    try { onEnd && onEnd({ winner, winnerId, isPlayerWinner }) } catch (e) {}
  }

  const distributeRewards = async (playerWon) => {
    try {
      const winnerReward = 100
      const loserReward = 25

      const winnerId = playerWon ? player?.id : opponent?.id
      const loserId = playerWon ? opponent?.id : player?.id

      // Award winner
      const { error: winError } = await supabase
        .from('game_characters')
        .update({
          money: supabase.rpc('increment_money', { char_id: winnerId, amount: winnerReward }),
          wealth: supabase.rpc('increment_wealth', { char_id: winnerId, amount: winnerReward }),
          updated_at: new Date()
        })
        .eq('id', winnerId)

      // Award loser consolation
      const { error: loseError } = await supabase
        .from('game_characters')
        .update({
          money: supabase.rpc('increment_money', { char_id: loserId, amount: loserReward }),
          wealth: supabase.rpc('increment_wealth', { char_id: loserId, amount: loserReward }),
          updated_at: new Date()
        })
        .eq('id', loserId)

      if (!winError && !loseError) {
        setLogs((l) => [
          `Winner received ${winnerReward} credits!`,
          `Loser received ${loserReward} credits consolation.`,
          ...l
        ].slice(0, 25))
      }
    } catch (e) {
      console.error('Error distributing rewards:', e)
    }
  }

  const recordAction = async (actionType, damage) => {
    try {
      actionsRef.current.push({
        type: actionType,
        damage,
        playerHP,
        opponentHP,
        round: roundNumber
      })
    } catch (e) { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 p-6 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full p-4 text-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold">Duel: {player?.name} vs {opponent?.name}</div>
          <div className="text-sm text-slate-400">Session: {sessionId}</div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-slate-800/30 rounded text-center">
            <div className="text-sm text-slate-400">You</div>
            <div className="text-xl font-bold text-yellow-300">{player?.name}</div>
            <div className="text-2xl font-bold mt-2">{playerHP} HP</div>
          </div>
          <div className="p-3 bg-slate-800/30 rounded text-center">
            <div className="text-sm text-slate-400">Opponent</div>
            <div className="text-xl font-bold text-slate-100">{opponent?.name}</div>
            <div className="text-2xl font-bold mt-2">{opponentHP} HP</div>
          </div>
        </div>

        <div className="flex gap-3 mb-3">
          <button onClick={attack} disabled={isAttacking} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded">Attack</button>
          <button onClick={skill} disabled={isAttacking} className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded">Skill</button>
          <button onClick={() => endMatch(opponent?.name || 'Opponent')} className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded">Forfeit</button>
        </div>

        <div className="h-36 overflow-y-auto bg-slate-900/20 p-2 rounded text-sm">
          {logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
        </div>

      </div>
    </div>
  )
}
