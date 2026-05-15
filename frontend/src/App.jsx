import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  
  const [audioUrl, setAudioUrl] = useState('')
  const [history, setHistory] = useState([])
  const audioRef = useRef(null)

  useEffect(() => {
    try {
      const savedHistory = JSON.parse(localStorage.getItem('transcriptionHistory') || '[]');
      setHistory(savedHistory);
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }, [])

  const saveToHistory = (sourceUrl, data) => {
    try {
      const currentHistory = JSON.parse(localStorage.getItem('transcriptionHistory') || '[]');
      const newEntry = { url: sourceUrl, data, date: new Date().toISOString() };
      const updatedHistory = [newEntry, ...currentHistory.filter(h => h.url !== sourceUrl)].slice(0, 10);
      localStorage.setItem('transcriptionHistory', JSON.stringify(updatedHistory));
      setHistory(updatedHistory);
    } catch (e) {
      console.error(e);
    }
  }

  const loadFromHistory = (item) => {
    setUrl(item.url)
    setResult(item.data)
    setError(null)
    fetchAudioUrl(item.url)
  }

  const fetchAudioUrl = async (sourceUrl) => {
    try {
      const res = await fetch(`https://transcript-y3gciju2vq-ew.a.run.app/audio_url?url=${encodeURIComponent(sourceUrl)}`)
      if (res.ok) {
        const data = await res.json()
        setAudioUrl(data.url)
      }
    } catch (err) {
      console.error("Failed to load audio url", err)
    }
  }

  const handleTranscribe = async (e) => {
    e.preventDefault()
    if (!url) return

    setLoading(true)
    setError(null)
    setResult(null)
    setAudioUrl('')

    try {
      const response = await fetch('https://transcript-y3gciju2vq-ew.a.run.app/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'Something went wrong')
      }

      setResult(data)
      saveToHistory(url, data)
      fetchAudioUrl(url)
      
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

  const handleTimestampClick = (start) => {
    if (audioRef.current) {
      audioRef.current.currentTime = start;
      audioRef.current.play();
    }
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

      <div className="main-content" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div className="left-panel" style={{ flex: '1 1 300px' }}>
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

          {history.length > 0 && (
            <div className="history-container" style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Історія транскрипцій</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {history.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => loadFromHistory(item)}
                    style={{ cursor: 'pointer', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--glass-border)', transition: 'all 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.2)'}
                  >
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>
                      {new Date(item.date).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.url}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="right-panel" style={{ flex: '2 1 500px' }}>
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
              <div className="transcript-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Результат транскрипції</h2>
                <div className="action-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button onClick={() => copyToClipboard(false)} style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--glass-border)' }}>Копіювати текст</button>
                  <button onClick={() => copyToClipboard(true)} style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', background: 'linear-gradient(45deg, #10a37f, #0b7a5f)' }}>Копіювати для ChatGPT</button>
                </div>
              </div>
              
              {audioUrl && (
                <div style={{ marginBottom: '2rem' }}>
                  <audio ref={audioRef} controls src={audioUrl} style={{ width: '100%', borderRadius: '12px' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.5rem', textAlign: 'center' }}>
                    Натисніть на таймкод біля фрази, щоб відтворити аудіо з цього моменту
                  </p>
                </div>
              )}
              
              <div className="utterances">
                {result.utterances && result.utterances.length > 0 ? (
                  result.utterances.map((utt, index) => (
                    <div key={index} className={`utterance speaker-${(index % 3) + 1}`}>
                      <div className="speaker-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <span className="speaker-label" style={{ margin: 0 }}>{utt.speaker}</span>
                        <span 
                          className="timestamp" 
                          onClick={() => handleTimestampClick(utt.start)}
                          style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)' }}
                          title="Відтворити з цього моменту"
                        >
                          ▶ {formatTime(utt.start)} - {formatTime(utt.end)}
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
      </div>
    </div>
  )
}

export default App
