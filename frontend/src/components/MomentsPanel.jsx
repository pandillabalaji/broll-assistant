function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const CATEGORY_COLORS = {
  emotion: 'category-emotion',
  activity: 'category-activity',
  location: 'category-location',
  object: 'category-object',
  event: 'category-event',
}

export default function MomentsPanel({ moments, selections, selectedMoment, onSelect, onSeek }) {
  if (!moments || moments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
        No moments detected
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
      {moments.map((moment, i) => {
        const isSelected = selectedMoment === i
        const hasClip = !!selections[i]
        const duration = (moment.end_timestamp - moment.timestamp).toFixed(1)

        return (
          <div
            key={i}
            className={`p-3 rounded-lg cursor-pointer border transition-all duration-150 ${
              isSelected
                ? 'border-brand-500/50 bg-brand-500/8'
                : hasClip
                ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                : 'border-dark-500 bg-dark-700 hover:border-dark-400'
            }`}
            onClick={() => onSelect(i)}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <button
                  className="text-xs font-mono text-brand-500 hover:text-brand-400"
                  onClick={(e) => { e.stopPropagation(); onSeek(moment.timestamp) }}
                >
                  {formatTime(moment.timestamp)}
                </button>
                <span className={`category-badge ${CATEGORY_COLORS[moment.category] || 'category-activity'}`}>
                  {moment.category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasClip && (
                  <span className="text-xs font-mono text-emerald-500">✓ selected</span>
                )}
                <span className="text-xs font-mono text-zinc-600">{duration}s</span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed mb-1.5 line-clamp-2">
              {moment.text}
            </p>

            <div className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
                <circle cx="5" cy="5" r="4" stroke="#52525b" strokeWidth="1"/>
                <path d="M5 3V5L6.5 6.5" stroke="#52525b" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              <span className="text-xs font-mono text-zinc-600 truncate">
                {moment.search_query}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
