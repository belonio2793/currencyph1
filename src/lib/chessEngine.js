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
    const piece = (p, index) => this.board[index]

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
    const piece = this.board[index].toLowerCase()
    const isWhite = this.isWhitePiece(this.board[index])

    const addMove = (toIndex) => {
      if (toIndex < 0 || toIndex >= 64) return
      const toSquare = this.indexToSquare(toIndex)
      const targetPiece = this.board[toIndex]
      if (targetPiece && this.isWhitePiece(targetPiece) === isWhite) return
      moves.push(toSquare)
    }

    const row = Math.floor(index / 8)
    const col = index % 8

    if (piece === 'p') {
      const direction = isWhite ? -1 : 1
      const startRow = isWhite ? 6 : 1
      const newIndex = index + direction * 8
      if (newIndex >= 0 && newIndex < 64 && !this.board[newIndex]) {
        moves.push(this.indexToSquare(newIndex))
        if (row === startRow && !this.board[newIndex + direction * 8]) {
          moves.push(this.indexToSquare(newIndex + direction * 8))
        }
      }
      // Captures
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
    } else if (piece === 'n') {
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
    } else if (piece === 'k') {
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
      // Castling
      if (this.canCastle(isWhite, true)) {
        moves.push(isWhite ? 'g1' : 'g8')
      }
      if (this.canCastle(isWhite, false)) {
        moves.push(isWhite ? 'c1' : 'c8')
      }
    } else if (piece === 'b' || piece === 'r' || piece === 'q') {
      const directions = []
      if (piece === 'b' || piece === 'q') {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1])
      }
      if (piece === 'r' || piece === 'q') {
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

  canCastle(isWhite, kingSide) {
    const rights = this.castlingRights
    if (isWhite) {
      if (kingSide && !rights.includes('K')) return false
      if (!kingSide && !rights.includes('Q')) return false
    } else {
      if (kingSide && !rights.includes('k')) return false
      if (!kingSide && !rights.includes('q')) return false
    }

    const kingIndex = isWhite ? 4 : 60
    const rook1Index = isWhite ? 7 : 63
    const rook2Index = isWhite ? 0 : 56

    if (kingSide) {
      return this.board[kingIndex] === (isWhite ? 'K' : 'k') &&
             this.board[rook1Index] === (isWhite ? 'R' : 'r') &&
             !this.board[5] && !this.board[6]
    } else {
      return this.board[kingIndex] === (isWhite ? 'K' : 'k') &&
             this.board[rook2Index] === (isWhite ? 'R' : 'r') &&
             !this.board[1] && !this.board[2] && !this.board[3]
    }
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
    const piece = board[index]?.toLowerCase()
    if (!piece) return moves

    const isWhite = board[index] === board[index].toUpperCase()
    const row = Math.floor(index / 8)
    const col = index % 8

    const addMove = (toIndex) => {
      if (toIndex < 0 || toIndex >= 64) return
      const targetPiece = board[toIndex]
      if (targetPiece && this.isWhitePiece(targetPiece) === isWhite) return
      moves.push(this.indexToSquare(toIndex))
    }

    if (piece === 'p') {
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
    } else if (piece === 'n') {
      [[−2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dr, dc]) => {
        const newRow = row + dr
        const newCol = col + dc
        if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
          addMove(newRow * 8 + newCol)
        }
      })
    } else if (piece === 'b' || piece === 'r' || piece === 'q') {
      const directions = []
      if (piece === 'b' || piece === 'q') {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1])
      }
      if (piece === 'r' || piece === 'q') {
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
    } else if (piece === 'k') {
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

  isWhitePiece(piece) {
    return piece && piece === piece.toUpperCase()
  }

  isBlackPiece(piece) {
    return piece && piece === piece.toLowerCase()
  }
}