import { useState, useRef } from 'react'
import axios from 'axios'

const INTENSITY_LABELS = {
  1: 'Minimal', 2: 'Very Light', 3: 'Light', 4: 'Moderate-Light',
  5: 'Balanced', 6: 'Moderate-Heavy', 7: 'Frequent',
  8: 'Heavy', 9: 'Very Heavy', 10: 'Maximum'
}

const INTENSITY_DESCRIPTIONS = {
  1: '~2-4 suggestions', 2: '~4-6 suggestions', 3: '~6-10 suggestions',
  4: '~10-14 suggestions', 5: '~14-20 suggestions', 6: '~20-26 suggestions',
  7: '~26-34 suggestions', 8: '~34-44 suggestions', 9: '~44-56 suggestions',
  10: '~56+ suggestions'
}

export default function UploadStep({ intensity, setIntensity, onComplete }) {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef()

  const ALLOWED = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/mkv']
  const MAX_SIZE = 4 * 1024 * 1024 * 1024

  const handleFile = (f) => {
    setError(null)
    if (!f) return
    if (!ALLOWED.includes(f.type) && !f.name.match(/\.(mp4|mov|mkv)$/i)) {
      setError('Unsupported format. Please use MP4, MOV, or MKV.')
      return
    }
    if (f.size > MAX_SIZE) {
      setError('File too large. Maximum size is 4GB.')
      return
    }
    setFile(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }

  const formatSize = (bytes) => {
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
    if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
    return `${(bytes / 1e3).toFixed(0)} KB`
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await axios.post('/api/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      onComplete(res.data.job_id)
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Is the backend running?')
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pt-8 fade-in">
      {/* Title */}
      <div className="mb-10 text-center">
        <h1 className="font-display font-bold text-4xl mb-3 tracking-tight">
          Auto B-Roll Suggestions
        </h1>
        <p className="text-zinc-400 text-base">
          Upload your video. We'll transcribe it, analyze the content,<br/>
          and suggest perfect B-roll footage automatically.
        </p>
      </div>

      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 mb-6 ${
          dragging
            ? 'border-brand-500 bg-brand-500/5'
            : file
            ? 'border-zinc-600 bg-dark-800'
            : 'border-dark-500 bg-dark-800 hover:border-dark-400 hover:bg-dark-700'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.mov,.mkv,video/mp4,video/quicktime,video/x-matroska"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {file ? (
          <div className="fade-in">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 10L19.5528 7.72361C20.2177 7.39116 21 7.87465 21 8.61803V15.382C21 16.1253 20.2177 16.6088 19.5528 16.2764L15 14M5 18H13C14.1046 18 15 17.1046 15 16V8C15 6.89543 14.1046 6 13 6H5C3.89543 6 3 6.89543 3 8V16C3 17.1046 3.89543 18 5 18Z" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="font-display font-semibold text-white mb-1">{file.name}</p>
            <p className="text-zinc-400 text-sm">{formatSize(file.size)}</p>
            <button
              className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 underline"
              onClick={(e) => { e.stopPropagation(); setFile(null) }}
            >
              Remove & choose another
            </button>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 rounded-xl bg-dark-600 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 20H16C18.2091 20 20 18.2091 20 16V8C20 5.79086 18.2091 4 16 4H8C5.79086 4 4 5.79086 4 8V16C4 18.2091 5.79086 20 8 20Z" stroke="#71717a" strokeWidth="1.5"/>
              </svg>
            </div>
            <p className="font-display font-semibold text-zinc-300 mb-1">
              {dragging ? 'Drop your video here' : 'Drag & drop your video'}
            </p>
            <p className="text-zinc-500 text-sm">or click to browse</p>
            <p className="text-zinc-600 text-xs mt-3">MP4 · MOV · MKV · Max 4GB · Max 10 min</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm fade-in">
          {error}
        </div>
      )}

      {/* Intensity slider */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-display font-semibold text-sm text-white">B-Roll Intensity</p>
            <p className="text-zinc-500 text-xs mt-0.5">How many B-roll suggestions to generate</p>
          </div>
          <div className="text-right">
            <span className="font-display font-bold text-xl text-brand-500">{intensity}</span>
            <p className="text-zinc-400 text-xs">{INTENSITY_LABELS[intensity]}</p>
          </div>
        </div>

        <input
          type="range"
          min="1"
          max="10"
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-dark-500"
          style={{
            background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${(intensity - 1) / 9 * 100}%, #27272a ${(intensity - 1) / 9 * 100}%, #27272a 100%)`
          }}
        />

        <div className="flex justify-between mt-2">
          <span className="intensity-label">Minimal</span>
          <span className="text-xs font-mono text-zinc-400">{INTENSITY_DESCRIPTIONS[intensity]}</span>
          <span className="intensity-label">Maximum</span>
        </div>
      </div>

      {/* Upload button */}
      <button
        className="btn-primary w-full py-3 text-base"
        disabled={!file || uploading}
        onClick={handleUpload}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
            </svg>
            Uploading...
          </span>
        ) : (
          'Upload & Analyse →'
        )}
      </button>

      {/* Info footer */}
      <p className="text-center text-zinc-600 text-xs mt-4">
        Processing happens locally on your machine. Nothing is sent to external servers except AI analysis.
      </p>
    </div>
  )
}
