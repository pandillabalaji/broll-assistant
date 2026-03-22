import { useEffect, useState } from 'react'
import axios from 'axios'

const STEPS = [
  { key: 'Compressing video...', label: 'Compressing video', icon: '🎥', pct: 10 },
  { key: 'Extracting audio...', label: 'Extracting audio', icon: '🎵', pct: 25 },
  { key: 'Transcribing speech...', label: 'Transcribing speech (Whisper AI)', icon: '📝', pct: 40 },
  { key: 'Detecting B-roll moments...', label: 'Detecting B-roll moments (Groq AI)', icon: '✨', pct: 65 },
  { key: 'Complete', label: 'Analysis complete!', icon: '✅', pct: 100 },
]

export default function ProcessingStep({ jobId, intensity, onComplete, onReset }) {
  const [status, setStatus] = useState({ step: 'Starting...', progress: 0 })
  const [error, setError] = useState(null)
  const [started, setStarted] = useState(false)

  // Kick off processing
  useEffect(() => {
    if (!jobId || started) return
    setStarted(true)
    axios.post(`/api/process/${jobId}?intensity=${intensity}`)
      .catch(err => setError(err.response?.data?.detail || 'Failed to start processing'))
  }, [jobId, intensity, started])

  // Poll for status
  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/status/${jobId}`)
        const data = res.data
        setStatus(data)

        if (data.status === 'complete') {
          clearInterval(interval)
          // Fetch full results
          const results = await axios.get(`/api/results/${jobId}`)
          setTimeout(() => onComplete(results.data), 800)
        } else if (data.status === 'error') {
          clearInterval(interval)
          setError(data.error || 'Processing failed')
        }
      } catch (err) {
        // Keep polling
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [jobId])

  const currentStepIndex = STEPS.findIndex(s =>
    status.step?.includes(s.key.replace('...', ''))
  )
  const progress = status.progress || 0

  if (error) {
    return (
      <div className="max-w-lg mx-auto pt-16 text-center fade-in">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">❌</span>
        </div>
        <h2 className="font-display font-bold text-2xl mb-3 text-white">Processing Failed</h2>
        <p className="text-zinc-400 mb-2 text-sm">{error}</p>
        <p className="text-zinc-600 text-xs mb-8">
          Make sure FFmpeg is installed and your API keys are set in the .env file.
        </p>
        <button className="btn-primary" onClick={onReset}>Try Again</button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pt-16 fade-in">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-6">
          <svg className="animate-spin w-7 h-7 text-brand-500" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="32" strokeDashoffset="12" opacity="0.3"/>
            <path d="M12 2C6.477 2 2 6.477 2 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className="font-display font-bold text-2xl mb-2 text-white">Analysing Your Video</h2>
        <p className="text-zinc-400 text-sm">This may take 1–5 minutes depending on video length</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-xs font-mono text-zinc-400">{status.step || 'Initialising...'}</span>
          <span className="text-xs font-mono text-brand-500">{progress}%</span>
        </div>
        <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
          <div
            className="progress-bar h-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="card space-y-3">
        {STEPS.map((step, i) => {
          const isDone = progress >= step.pct && status.status !== 'error'
          const isActive = status.step?.includes(step.key.replace('...', ''))

          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                isActive ? 'bg-brand-500/10' : ''
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-all ${
                isDone ? 'bg-emerald-500/20' : isActive ? 'bg-brand-500/20' : 'bg-dark-600'
              }`}>
                {isDone ? '✓' : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-brand-500 pulse-dot block" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-dark-400 block" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-body transition-colors ${
                  isDone ? 'text-zinc-300' : isActive ? 'text-white' : 'text-zinc-600'
                }`}>
                  {step.label}
                </p>
              </div>
              {isActive && (
                <span className="text-xs font-mono text-brand-500">Running...</span>
              )}
              {isDone && !isActive && (
                <span className="text-xs font-mono text-emerald-500">Done</span>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-zinc-600 text-xs mt-6">
        First run downloads the Whisper model (~145MB). Subsequent runs are faster.
      </p>
    </div>
  )
}
