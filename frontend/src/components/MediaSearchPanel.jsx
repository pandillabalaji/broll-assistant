import { useState, useEffect } from 'react'
import axios from 'axios'

export default function MediaSearchPanel({ jobId, moment, momentIndex, selection, onSelectMedia }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [mediaType, setMediaType] = useState('videos')
  const [query, setQuery] = useState('')
  const [previewId, setPreviewId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [error, setError] = useState(null)

  // When moment changes, auto-search
  useEffect(() => {
    if (!moment) return
    setQuery(moment.search_query)
    doSearch(moment.search_query, mediaType)
  }, [moment?.search_query])

  const doSearch = async (q, type) => {
    if (!q?.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    try {
      const res = await axios.get(`/api/search-media`, {
        params: { query: q, per_page: 6, media_type: type }
      })
      if (res.data.error) {
        setError(res.data.error)
      } else {
        setResults(res.data.results || [])
      }
    } catch (err) {
      setError('Search failed. Check your Pexels API key.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    doSearch(query, mediaType)
  }

  const handleTypeSwitch = (type) => {
    setMediaType(type)
    doSearch(query || moment?.search_query, type)
  }

  const handleDownload = async (item) => {
    if (!moment) return
    setDownloadingId(item.id)
    try {
      const duration = Math.max(2, moment.end_timestamp - moment.timestamp)
      const filename = `broll_${momentIndex}_${item.id}_${Math.round(duration)}s.mp4`

      const res = await axios.post('/api/trim-clip', {
        url: item.download_url,
        duration: duration,
        filename: filename,
      })

      if (res.data.success) {
        // Trigger browser download
        window.open(`/api/download/${res.data.filename}`, '_blank')
        onSelectMedia(momentIndex, { ...item, filename: res.data.filename })
      } else {
        alert(`Download failed: ${res.data.error}`)
      }
    } catch (err) {
      alert('Download failed. Check console for details.')
      console.error(err)
    } finally {
      setDownloadingId(null)
    }
  }

  // Empty state
  if (!moment) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <div className="w-12 h-12 rounded-xl bg-dark-600 flex items-center justify-center mb-4">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4V10M10 10L7 8M10 10L13 8" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="2" y="2" width="16" height="16" rx="3" stroke="#52525b" strokeWidth="1.5"/>
          </svg>
        </div>
        <p className="font-display font-semibold text-zinc-400 text-sm mb-1">Select a moment</p>
        <p className="text-zinc-600 text-xs">
          Click any B-roll moment on the left to search for matching stock footage
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 mb-3">
        <p className="font-display font-semibold text-sm text-zinc-300 mb-2">Stock Media</p>

        {/* Type toggle */}
        <div className="flex gap-1 mb-2">
          {['videos', 'photos'].map(type => (
            <button
              key={type}
              className={`text-xs px-3 py-1.5 rounded-md transition-all font-body ${
                mediaType === type
                  ? 'bg-brand-500 text-white'
                  : 'bg-dark-600 text-zinc-400 hover:text-zinc-300'
              }`}
              onClick={() => handleTypeSwitch(type)}
            >
              {type === 'videos' ? '🎬 Videos' : '🖼 Photos'}
            </button>
          ))}
        </div>

        {/* Search input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search stock footage..."
            className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-brand-500 transition-colors"
          />
          <button type="submit" className="btn-ghost text-xs px-3">
            Search
          </button>
        </form>

        {selection && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs text-emerald-400 font-mono">
              ✓ {selection.filename || 'Clip selected'}
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto pr-1">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <svg className="animate-spin w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="32" strokeDashoffset="12" opacity="0.3"/>
              <path d="M12 2C6.477 2 2 6.477 2 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {!loading && !error && results.length === 0 && query && (
          <div className="text-center py-8 text-zinc-600 text-xs">
            No results found. Try a different search term.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {results.map(item => (
            <div key={item.id} className="group relative rounded-lg overflow-hidden bg-dark-700 border border-dark-600 hover:border-dark-400 transition-all">
              {/* Thumbnail */}
              <div className="aspect-video relative overflow-hidden">
                <img
                  src={item.thumbnail}
                  alt="media thumbnail"
                  className="w-full h-full object-cover"
                />

                {/* Preview overlay */}
                {item.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <button
                      className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
                      onClick={() => setPreviewId(previewId === item.id ? null : item.id)}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                        <path d="M3 2L10 6L3 10V2Z"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* Duration badge */}
                {item.duration > 0 && (
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                    {item.duration}s
                  </div>
                )}
              </div>

              {/* Preview video */}
              {previewId === item.id && item.type === 'video' && (
                <video
                  src={item.preview_url}
                  autoPlay
                  muted
                  loop
                  className="absolute inset-0 w-full h-full object-cover"
                  onClick={() => setPreviewId(null)}
                />
              )}

              {/* Footer */}
              <div className="p-2">
                <p className="text-xs text-zinc-500 truncate mb-1.5">{item.photographer}</p>
                <div className="flex gap-1">
                  <button
                    className={`flex-1 text-xs py-1.5 rounded-md transition-all font-body ${
                      downloadingId === item.id
                        ? 'bg-dark-500 text-zinc-500 cursor-not-allowed'
                        : 'bg-brand-500/20 text-brand-400 hover:bg-brand-500/30'
                    }`}
                    disabled={downloadingId === item.id}
                    onClick={() => handleDownload(item)}
                  >
                    {downloadingId === item.id ? (
                      <span className="flex items-center justify-center gap-1">
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
                        </svg>
                        Trimming...
                      </span>
                    ) : (
                      `↓ Use (${Math.round(moment.end_timestamp - moment.timestamp)}s)`
                    )}
                  </button>
                  <a
                    href={item.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs py-1.5 px-2 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all"
                    title="Download full quality"
                  >
                    ↓ Full
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
