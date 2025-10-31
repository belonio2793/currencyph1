import ChessEngine from './chessEngine'

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 }

function evaluateBoard(engine) {
  const board = engine.getBoard()
  let score = 0
  for (const p of board) {
    if (!p) continue
    const val = PIECE_VALUES[p.toLowerCase()] || 0
    score += p === p.toUpperCase() ? val : -val
  }
  // Mild mobility bonus
  const moves = engine.getLegalMoves().length
  score += (engine.isWhiteTurn() ? 1 : -1) * moves * 2
  return score
}

function cloneAndMakeMove(fen, move) {
  const e = new ChessEngine(fen)
  e.makeMove(move)
  return e
}

function minimax(fen, depth, alpha, beta, maximizingPlayer) {
  const engine = new ChessEngine(fen)
  const legal = engine.getLegalMoves()
  if (depth === 0 || legal.length === 0) {
    return { score: evaluateBoard(engine), move: null }
  }

  let bestMove = null
  if (maximizingPlayer) {
    let maxEval = -Infinity
    for (const m of legal) {
      const child = cloneAndMakeMove(fen, m)
      const { score } = minimax(child.getFen(), depth - 1, alpha, beta, false)
      if (score > maxEval) {
        maxEval = score
        bestMove = m
      }
      alpha = Math.max(alpha, score)
      if (beta <= alpha) break
    }
    return { score: maxEval, move: bestMove }
  } else {
    let minEval = Infinity
    for (const m of legal) {
      const child = cloneAndMakeMove(fen, m)
      const { score } = minimax(child.getFen(), depth - 1, alpha, beta, true)
      if (score < minEval) {
        minEval = score
        bestMove = m
      }
      beta = Math.min(beta, score)
      if (beta <= alpha) break
    }
    return { score: minEval, move: bestMove }
  }
}

const DIFFICULTY_DEPTH = { easy: 1, medium: 2, hard: 3, very_hard: 4 }

export function getBestMove(fen, difficulty = 'medium') {
  const depth = DIFFICULTY_DEPTH[difficulty] || 2
  const engine = new ChessEngine(fen)
  const maximizingPlayer = engine.isWhiteTurn() // evaluate from side to move
  const { move } = minimax(fen, depth, -Infinity, Infinity, maximizingPlayer)
  // Fallback random legal move if search fails
  return move || (engine.getLegalMoves()[Math.floor(Math.random() * engine.getLegalMoves().length)] || null)
}

export function difficultyLabel(key) {
  return {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    very_hard: 'Very Hard'
  }[key] || 'Medium'
}
