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
      const response = await fetch('https://transcript-y3gciju2vq-ew.a.run.app/transcribe', {
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const generateTextForCopy = (withPrompt = false) => {
    if (!result) return '';
    
    let text = '';
    
    if (withPrompt) {
      text += 'Ось транскрипція розмови. Зверни увагу: через те, що люди часто говорять короткими фразами або перебивають одне одного, система могла помилитися і приписати деякі фрази не тому спікеру, або змішати їхні слова. Будь ласка, враховуй цей контекст при аналізі або редагуванні тексту.\n\n';
    }

    if (result.utterances && result.utterances.length > 0) {
      text += result.utterances.map(utt => `[${formatTime(utt.start)} - ${formatTime(utt.end)}] ${utt.speaker}:\n${utt.text}`).join('\n\n');
    } else {
      text += result.text;
    }
    
    return text;
  };

  const copyToClipboard = async (withPrompt) => {
    const text = generateTextForCopy(withPrompt);
    try {
      await navigator.clipboard.writeText(text);
      alert(withPrompt ? 'Скопійовано з промптом для ChatGPT!' : 'Текст скопійовано!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('Помилка копіювання');
    }
  };

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
          <div className="transcript-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
              Результат транскрипції
            </h2>
            <div className="action-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                onClick={() => copyToClipboard(false)}
                style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--glass-border)' }}
              >
                Копіювати текст
              </button>
              <button 
                onClick={() => copyToClipboard(true)}
                style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', background: 'linear-gradient(45deg, #10a37f, #0b7a5f)' }}
              >
                Копіювати для ChatGPT
              </button>
            </div>
          </div>
          
          <div className="utterances">
            {result.utterances && result.utterances.length > 0 ? (
              result.utterances.map((utt, index) => (
                <div key={index} className={`utterance speaker-${(index % 3) + 1}`}>
                  <div className="speaker-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <span className="speaker-label" style={{ margin: 0 }}>{utt.speaker}</span>
                    <span className="timestamp" style={{ fontSize: '0.85rem', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {formatTime(utt.start)} - {formatTime(utt.end)}
                    </span>
                  </div>
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
