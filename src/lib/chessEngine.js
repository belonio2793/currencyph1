export default class ChessEngine {
  constructor(fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    this.fen = fen
    this.board = this.fenToBoard(fen)
    this.whiteTurn = this.fen.split(' ')[1] === 'w'
    this.castlingRights = this.fen.split(' ')[2]
    this.enPassantSquare = this.fen.split(' ')[3]
    this.halfmoveClock = parseInt(this.fen.split(' ')[4])
    this.fullmoveNumber = parseInt(this.fen.split(' ')[5])
  }

  fenToBoard(fen) {
    const board = Array(64).fill(null)
    const boardFen = fen.split(' ')[0]
    const rows = boardFen.split('/')
    
    rows.forEach((row, rowIndex) => {
      let col = 0
      for (let char of row) {
        if (/[0-9]/.test(char)) {
          col += parseInt(char)
        } else {
          board[rowIndex * 8 + col] = char
          col++
        }
      }
    })
    return board
  }

  boardToFen(board) {
    const rows = []
    for (let row = 0; row < 8; row++) {
      let fenRow = ''
      let emptyCount = 0
      for (let col = 0; col < 8; col++) {
        const piece = board[row * 8 + col]
        if (piece) {
          if (emptyCount) {
            fenRow += emptyCount
            emptyCount = 0
          }
          fenRow += piece
        } else {
          emptyCount++
        }
      }
      if (emptyCount) fenRow += emptyCount
      rows.push(fenRow)
    }
    const turn = this.whiteTurn ? 'w' : 'b'
    return rows.join('/') + ` ${turn} ${this.castlingRights} ${this.enPassantSquare} ${this.halfmoveClock} ${this.fullmoveNumber}`
  }

  getBoard() {
    return this.board
  }

  getFen() {
    return this.boardToFen(this.board)
  }

  isWhiteTurn() {
    return this.whiteTurn
  }

  squareToIndex(square) {
    const col = square.charCodeAt(0) - 97
    const row = 8 - parseInt(square[1])
    return row * 8 + col
  }

  indexToSquare(index) {
    const row = Math.floor(index / 8)
    const col = index % 8
    return String.fromCharCode(97 + col) + (8 - row)
  }

  getPieceAt(square) {
    return this.board[this.squareToIndex(square)]
  }

  isWhitePiece(piece) {
    return piece && piece === piece.toUpperCase()
  }

  isBlackPiece(piece) {
    return piece && piece === piece.toLowerCase()
  }

  getLegalMoves() {
    const moves = []

    for (let fromIndex = 0; fromIndex < 64; fromIndex++) {
      const p = this.board[fromIndex]
      if (!p) continue
      if (this.whiteTurn !== this.isWhitePiece(p)) continue

      const fromSquare = this.indexToSquare(fromIndex)
      const possibleMoves = this.getPossibleMoves(fromSquare)

      possibleMoves.forEach(toSquare => {
        const move = { from: fromSquare, to: toSquare }
        if (this.isLegalMove(move)) {
          moves.push(move)
        }
      })
    }
    return moves
  }

  getPossibleMoves(square) {
    const moves = []
    const index = this.squareToIndex(square)
    const piece = this.board[index]
    if (!piece) return moves

    const lower = piece.toLowerCase()
    const isWhite = this.isWhitePiece(piece)

    const addMove = (toIndex) => {
      if (toIndex < 0 || toIndex >= 64) return
      const toSquare = this.indexToSquare(toIndex)
      const targetPiece = this.board[toIndex]
      if (targetPiece && this.isWhitePiece(targetPiece) === isWhite) return
      moves.push(toSquare)
    }

    const row = Math.floor(index / 8)
    const col = index % 8

    if (lower === 'p') {
      const direction = isWhite ? -1 : 1
      const startRow = isWhite ? 6 : 1
      const newIndex = index + direction * 8
      if (newIndex >= 0 && newIndex < 64 && !this.board[newIndex]) {
        moves.push(this.indexToSquare(newIndex))
        if (row === startRow && !this.board[newIndex + direction * 8]) {
          moves.push(this.indexToSquare(newIndex + direction * 8))
        }
      }
      const captureLeft = newIndex - 1
      const captureRight = newIndex + 1
      if (captureLeft >= 0 && captureLeft < 64 && Math.floor(captureLeft / 8) === Math.floor(newIndex / 8)) {
        const target = this.board[captureLeft]
        if (target && this.isWhitePiece(target) !== isWhite) moves.push(this.indexToSquare(captureLeft))
      }
      if (captureRight >= 0 && captureRight < 64 && Math.floor(captureRight / 8) === Math.floor(newIndex / 8)) {
        const target = this.board[captureRight]
        if (target && this.isWhitePiece(target) !== isWhite) moves.push(this.indexToSquare(captureRight))
      }
    } else if (lower === 'n') {
      const jumps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]
      ]
      jumps.forEach(([dr, dc]) => {
        const newRow = row + dr
        const newCol = col + dc
        if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
          addMove(newRow * 8 + newCol)
        }
      })
    } else if (lower === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const newRow = row + dr
          const newCol = col + dc
          if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            addMove(newRow * 8 + newCol)
          }
        }
      }
    } else if (lower === 'b' || lower === 'r' || lower === 'q') {
      const directions = []
      if (lower === 'b' || lower === 'q') {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1])
      }
      if (lower === 'r' || lower === 'q') {
        directions.push([-1, 0], [1, 0], [0, -1], [0, 1])
      }
      directions.forEach(([dr, dc]) => {
        for (let i = 1; i < 8; i++) {
          const newRow = row + dr * i
          const newCol = col + dc * i
          if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break
          const newIndex = newRow * 8 + newCol
          const target = this.board[newIndex]
          if (!target) {
            moves.push(this.indexToSquare(newIndex))
          } else {
            if (this.isWhitePiece(target) !== isWhite) {
              moves.push(this.indexToSquare(newIndex))
            }
            break
          }
        }
      })
    }

    return moves
  }

  isLegalMove(move) {
    const fromIndex = this.squareToIndex(move.from)
    const toIndex = this.squareToIndex(move.to)
    const piece = this.board[fromIndex]

    const testBoard = [...this.board]
    testBoard[toIndex] = testBoard[fromIndex]
    testBoard[fromIndex] = null

    const kingIndex = this.findKing(testBoard, this.whiteTurn)
    return !this.isKingInCheck(testBoard, kingIndex)
  }

  findKing(board, isWhite) {
    const king = isWhite ? 'K' : 'k'
    return board.indexOf(king)
  }

  isKingInCheck(board, kingIndex) {
    if (kingIndex < 0) return false
    const kingSquare = this.indexToSquare(kingIndex)
    const isWhiteKing = board[kingIndex] === 'K'

    for (let index = 0; index < 64; index++) {
      const p = board[index]
      if (!p || (this.isWhitePiece(p) === isWhiteKing)) continue

      const fromSquare = this.indexToSquare(index)
      const testMoves = this.getPossibleMovesForBoard(board, fromSquare)
      if (testMoves.includes(kingSquare)) {
        return true
      }
    }
    return false
  }

  getPossibleMovesForBoard(board, square) {
    const moves = []
    const index = this.squareToIndex(square)
    const piece = board[index]
    if (!piece) return moves

    const lower = piece.toLowerCase()
    const isWhite = piece === piece.toUpperCase()
    const row = Math.floor(index / 8)
    const col = index % 8

    const addMove = (toIndex) => {
      if (toIndex < 0 || toIndex >= 64) return
      const targetPiece = board[toIndex]
      if (targetPiece && this.isWhitePiece(targetPiece) === isWhite) return
      moves.push(this.indexToSquare(toIndex))
    }

    if (lower === 'p') {
      const direction = isWhite ? -1 : 1
      const newIndex = index + direction * 8
      if (newIndex >= 0 && newIndex < 64 && !board[newIndex]) {
        moves.push(this.indexToSquare(newIndex))
      }
      const captureLeft = newIndex - 1
      const captureRight = newIndex + 1
      if (captureLeft >= 0 && captureLeft < 64 && Math.floor(captureLeft / 8) === Math.floor(newIndex / 8)) {
        const target = board[captureLeft]
        if (target && this.isWhitePiece(target) !== isWhite) moves.push(this.indexToSquare(captureLeft))
      }
      if (captureRight >= 0 && captureRight < 64 && Math.floor(captureRight / 8) === Math.floor(newIndex / 8)) {
        const target = board[captureRight]
        if (target && this.isWhitePiece(target) !== isWhite) moves.push(this.indexToSquare(captureRight))
      }
    } else if (lower === 'n') {
      const jumps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]
      ]
      jumps.forEach(([dr, dc]) => {
        const newRow = row + dr
        const newCol = col + dc
        if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
          addMove(newRow * 8 + newCol)
        }
      })
    } else if (lower === 'b' || lower === 'r' || lower === 'q') {
      const directions = []
      if (lower === 'b' || lower === 'q') {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1])
      }
      if (lower === 'r' || lower === 'q') {
        directions.push([-1, 0], [1, 0], [0, -1], [0, 1])
      }
      directions.forEach(([dr, dc]) => {
        for (let i = 1; i < 8; i++) {
          const newRow = row + dr * i
          const newCol = col + dc * i
          if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break
          const newIndex = newRow * 8 + newCol
          const target = board[newIndex]
          if (!target) {
            moves.push(this.indexToSquare(newIndex))
          } else {
            if (this.isWhitePiece(target) !== isWhite) {
              moves.push(this.indexToSquare(newIndex))
            }
            break
          }
        }
      })
    } else if (lower === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const newRow = row + dr
          const newCol = col + dc
          if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            addMove(newRow * 8 + newCol)
          }
        }
      }
    }

    return moves
  }

  makeMove(move) {
    const fromIndex = this.squareToIndex(move.from)
    const toIndex = this.squareToIndex(move.to)
    const piece = this.board[fromIndex]

    if (!piece || this.isWhitePiece(piece) !== this.whiteTurn) {
      return false
    }

    this.board[toIndex] = this.board[fromIndex]
    this.board[fromIndex] = null
    this.whiteTurn = !this.whiteTurn
    this.halfmoveClock++
    if (!this.whiteTurn) this.fullmoveNumber++

    return true
  }

  getGameStatus() {
    const legalMoves = this.getLegalMoves()

    if (legalMoves.length === 0) {
      const kingIndex = this.findKing(this.board, this.whiteTurn)
      if (this.isKingInCheck(this.board, kingIndex)) {
        return this.whiteTurn ? 'white_checkmate' : 'black_checkmate'
      }
      return 'stalemate'
    }

    const kingIndex = this.findKing(this.board, this.whiteTurn)
    if (this.isKingInCheck(this.board, kingIndex)) {
      return 'check'
    }

    return 'in_progress'
  }
}
