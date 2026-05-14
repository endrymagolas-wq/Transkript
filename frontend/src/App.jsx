import { useState } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleTranscribe = async (e) => {
    e.preventDefault()
    if (!url) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('http://localhost:8001/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'Something went wrong')
      }

      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="App">
      <header>
        <h1>InstaVoice</h1>
        <p>Перетворіть Instagram Reels на текст із розподілом по спікерах</p>
      </header>

      <div className="input-container">
        <form onSubmit={handleTranscribe}>
          <div className="input-group">
            <input 
              type="text" 
              placeholder="Вставте посилання на Instagram Reel..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !url}>
              {loading ? 'Обробка...' : 'Транскрибувати'}
            </button>
          </div>
        </form>
      </div>

      {loading && (
        <div className="loader">
          <div className="spinner"></div>
          <p>Завантажуємо аудіо та розпізнаємо голоси...</p>
        </div>
      )}

      {error && (
        <div className="error-message" style={{ color: '#ff6b6b', textAlign: 'center', padding: '1rem', background: 'rgba(255,107,107,0.1)', borderRadius: '12px', marginBottom: '2rem' }}>
          <strong>Помилка:</strong> {error}
        </div>
      )}

      {result && (
        <div className="transcript-container">
          <h2 style={{ marginBottom: '2rem', fontSize: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
            Результат транскрипції
          </h2>
          
          <div className="utterances">
            {result.utterances && result.utterances.length > 0 ? (
              result.utterances.map((utt, index) => (
                <div key={index} className={`utterance speaker-${(index % 3) + 1}`}>
                  <span className="speaker-label">{utt.speaker}</span>
                  <p className="text-content">{utt.text}</p>
                </div>
              ))
            ) : (
              <p className="text-content">{result.text}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
