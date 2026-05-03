import { useState } from 'react'
import SetupScreen from './components/SetupScreen.jsx'
import GameScreen from './components/GameScreen.jsx'

export default function App() {
  const [gameState, setGameState] = useState(null)

  // The app now runs as a local hot-seat multiplayer session: the state carries
  // an entire `party` (1-6 characters), and GameScreen tracks whose turn it is.
  // Backwards-compat: SetupScreen may still return { character } for a solo
  // session — we normalise that into a single-member party here.
  function startGame({ party, character, module }) {
    const finalParty = party ?? (character ? [character] : [])
    setGameState({ party: finalParty, module })
  }

  function endGame() {
    setGameState(null)
  }

  return gameState
    ? <GameScreen party={gameState.party} module={gameState.module} onEndGame={endGame} />
    : <SetupScreen onStartGame={startGame} />
}
