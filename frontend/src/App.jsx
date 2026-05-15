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
  
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

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
      const res = await fetch(`${API_URL}/audio_url?url=${encodeURIComponent(sourceUrl)}`)
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
      const response = await fetch(`${API_URL}/transcribe`, {
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

      <div className="main-content" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {history.length > 0 && (
          <div className="left-panel" style={{ flex: '1 1 250px', maxWidth: '350px' }}>
            <div className="history-container" style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--accent)' }}>Історія транскрипцій</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {history.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => loadFromHistory(item)}
                    style={{ cursor: 'pointer', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid var(--glass-border)', transition: 'all 0.2s' }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8 }}>
                      {item.url}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="right-panel" style={{ flex: '2 1 500px', minWidth: '0' }}>
          {loading && (
            <div className="loader">
              <div className="spinner"></div>
              <p>Завантажуємо аудіо та розпізнаємо голоси...</p>
            </div>
          )}

          {error && (
            <div className="error-message" style={{ color: '#ff6b6b', textAlign: 'center', padding: '1.5rem', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '16px', marginBottom: '2rem' }}>
              <strong>Помилка:</strong> {error}
            </div>
          )}

          {result && (
            <div className="transcript-container" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
              <div className="transcript-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>Результат транскрипції</h2>
                <div className="action-buttons" style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                  <button onClick={() => copyToClipboard(false)} style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>Копіювати текст</button>
                  <button onClick={() => copyToClipboard(true)} style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: 'linear-gradient(45deg, #10a37f, #0b7a5f)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(16, 163, 127, 0.3)' }}>Копіювати для ChatGPT</button>
                </div>
              </div>
              
              {audioUrl && (
                <div style={{ marginBottom: '2.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                  <audio ref={audioRef} controls src={audioUrl} style={{ width: '100%', borderRadius: '8px', outline: 'none' }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--accent)', marginTop: '0.8rem', textAlign: 'center', fontWeight: '500' }}>
                    💡 Натисніть на таймкод біля фрази, щоб відтворити аудіо з цього моменту
                  </p>
                </div>
              )}
              
              <div className="utterances">
                {result.utterances && result.utterances.length > 0 ? (
                  result.utterances.map((utt, index) => (
                    <div key={index} className={`utterance speaker-${(index % 3) + 1}`} style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1rem' }}>
                      <div className="speaker-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <span className="speaker-label" style={{ margin: 0, padding: '0.3rem 0.8rem', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.85rem' }}>{utt.speaker}</span>
                        <span 
                          className="timestamp" 
                          onClick={() => handleTimestampClick(utt.start)}
                          style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: 'linear-gradient(45deg, rgba(131, 58, 180, 0.3), rgba(253, 29, 29, 0.3))', padding: '0.3rem 0.8rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                          title="Відтворити з цього моменту"
                          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(253, 29, 29, 0.2)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          ▶ {formatTime(utt.start)} - {formatTime(utt.end)}
                        </span>
                      </div>
                      <p className="text-content" style={{ margin: 0, fontSize: '1.05rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.9)' }}>{utt.text}</p>
                    </div>
                  ))
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-content" style={{ margin: 0, fontSize: '1.05rem', lineHeight: '1.6' }}>{result.text}</p>
                  </div>
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
