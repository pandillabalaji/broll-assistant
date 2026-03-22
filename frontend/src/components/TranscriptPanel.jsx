import { useEffect, useRef } from 'react'

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function TranscriptPanel({ transcript, currentTime, moments, onSeek }) {
  const containerRef = useRef()
  const activeRef = useRef()

  // Find active segment
  const activeIndex = transcript.findIndex(
    seg => currentTime >= seg.start && currentTime < seg.end
  )

  // Build set of moment timestamps for quick lookup
  const momentTimestamps = new Set(moments.map(m => m.timestamp))

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeIndex])

  if (!transcript || transcript.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
        No transcript available
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto space-y-1 pr-1"
    >
      {transcript.map((seg, i) => {
        const isActive = i === activeIndex
        // Check if any moment is near this segment
        const hasMoment = moments.some(
          m => m.timestamp >= seg.start && m.timestamp < seg.end
        )

        return (
          <div
            key={i}
            ref={isActive ? activeRef : null}
            className={`transcript-line ${isActive ? 'active' : ''}`}
            onClick={() => onSeek(seg.start)}
          >
            <div className="flex items-start gap-2">
              <span className="text-zinc-600 font-mono text-xs flex-shrink-0 mt-0.5 w-10">
                {formatTime(seg.start)}
              </span>
              <span className={`text-xs leading-relaxed flex-1 ${
                isActive ? 'text-brand-500' : 'text-zinc-300'
              }`}>
                {seg.text}
              </span>
              {hasMoment && (
                <div
                  className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0 mt-1.5"
                  title="B-roll moment here"
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
