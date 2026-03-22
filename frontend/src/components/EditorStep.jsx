import { useState, useRef } from 'react'
import TranscriptPanel from './TranscriptPanel.jsx'
import MomentsPanel from './MomentsPanel.jsx'
import MediaSearchPanel from './MediaSearchPanel.jsx'
import axios from 'axios'

export default function EditorStep({ jobId, results, onReset }) {
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedMoment, setSelectedMoment] = useState(null)
  const [selections, setSelections] = useState({})
  const [moments, setMoments] = useState(results.moments)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exportStep, setExportStep] = useState(null) // null | 'downloading' | 'done'
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 })
  const [exportFolder, setExportFolder] = useState(null)
  const [fcpxmlContent, setFcpxmlContent] = useState(null)
  const videoRef = useRef()
  const { transcript } = results

  const seekTo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      videoRef.current.play()
    }
  }

  const handleSelectMedia = (momentIndex, media) => {
    setSelections(prev => ({
      ...prev,
      [momentIndex]: { ...prev[momentIndex], media }
    }))
  }

  const pollForResults = (id, onDone) => {
    const poll = setInterval(async () => {
      try {
        const status = await axios.get('/api/status/' + id)
        if (status.data.status === 'complete') {
          clearInterval(poll)
          const newResults = await axios.get('/api/results/' + id)
          onDone(newResults.data)
        } else if (status.data.status === 'error') {
          clearInterval(poll)
          setLoadingMore(false)
        }
      } catch (e) {
        clearInterval(poll)
        setLoadingMore(false)
      }
    }, 2000)
  }

  const handleLoadMore = async () => {
    setLoadingMore(true)
    try {
      await axios.post('/api/redetect/' + jobId + '?intensity=9')
      pollForResults(jobId, (data) => {
        setMoments(data.moments)
        setLoadingMore(false)
      })
    } catch (e) {
      setLoadingMore(false)
    }
  }

  const handleRefresh = async () => {
    setLoadingMore(true)
    try {
      await axios.post('/api/redetect/' + jobId + '?intensity=' + (results.intensity || 5))
      pollForResults(jobId, (data) => {
        setMoments(data.moments)
        setLoadingMore(false)
      })
    } catch (e) {
      setLoadingMore(false)
    }
  }

  // ── MASTER EXPORT ──────────────────────────────────────────
  // Step 1: trim + download every selected clip via backend
  // Step 2: generate FCPXML pointing to ~/Downloads/BRoll_Export/
  // Step 3: user opens FCP and imports the XML
  const handleMasterExport = async () => {
    const selectedEntries = moments
      .map((m, i) => ({ moment: m, index: i, sel: selections[i] }))
      .filter(e => e.sel?.media)

    if (selectedEntries.length === 0) {
      alert('Please select at least one clip first by clicking a B-roll moment and pressing "↓ Use" on a video.')
      return
    }

    setExportStep('downloading')
    setExportProgress({ current: 0, total: selectedEntries.length })

    const exportedClips = []
    const folderName = 'BRoll_Export'

    for (let i = 0; i < selectedEntries.length; i++) {
      const { moment, index, sel } = selectedEntries[i]
      setExportProgress({ current: i + 1, total: selectedEntries.length })

      try {
        const duration = Math.max(2, moment.end_timestamp - moment.timestamp)
        const filename = `broll_${String(i + 1).padStart(2, '0')}_${moment.search_query.replace(/\s+/g, '_').slice(0, 30)}.mp4`

        const res = await axios.post('/api/trim-clip', {
          url: sel.media.download_url,
          duration: duration,
          filename: filename,
        })

        if (res.data.success) {
          // Trigger browser download
          const link = document.createElement('a')
          link.href = '/api/download/' + res.data.filename
          link.download = res.data.filename
          link.click()
          await new Promise(r => setTimeout(r, 800)) // small delay between downloads

          exportedClips.push({
            filename: res.data.filename,
            timestamp: moment.timestamp,
            end_timestamp: moment.end_timestamp,
            duration: duration,
            text: moment.text,
            search_query: moment.search_query,
          })
        }
      } catch (e) {
        console.error('Failed to download clip', i, e)
      }
    }

    // Generate and download FCPXML with real filenames
    // Points to ~/Downloads/ where the browser saved everything
    // Call backend to generate FCPXML — backend serves it as a real file
    try {
      const res = await fetch('/api/generate-fcpxml/' + jobId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips: exportedClips,
          username: 'bobby',
          folder: folderName,
        })
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'broll_timeline.fcpxml'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch(e) {
      console.error('FCPXML generation failed', e)
    }

    // Also generate a plain text guide
    generateReadme(exportedClips, folderName)

    setExportStep('done')
    setExportFolder(folderName)
  }

  const generateFCPXML = (clips, folderName) => {
    const fps = 30
    const toFrames = (sec) => Math.round(sec * fps)
    const basePath = `/Users/${getUsername()}/Downloads/${folderName}`

    const assets = clips.map((c, i) => {
      const id = `r${i + 2}`
      const dur = `${toFrames(c.duration)}/${fps}s`
      const src = `file://${basePath}/${c.filename}`
      return `    <asset id="${id}" name="${c.filename}" uid="${id}" start="0s" duration="${dur}" hasVideo="1" videoSources="1" hasAudio="0" audioSources="0" format="r1">\n      <media-rep kind="original-media" src="${src}"/>\n    </asset>`
    }).join('\n')

    const clipElements = clips.map((c, i) => {
      const id = `r${i + 2}`
      const dur = `${toFrames(c.duration)}/${fps}s`
      const offset = `${toFrames(c.timestamp)}/${fps}s`
      const safeText = c.text.replace(/[<>&"']/g, ' ')
      return `            <asset-clip ref="${id}" name="${c.filename}" offset="${offset}" duration="${dur}" tcFormat="NDF">\n              <note>${safeText}</note>\n            </asset-clip>`
    }).join('\n')

    const totalDuration = toFrames((clips[clips.length - 1]?.timestamp || 0) + 30)

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="r1" name="FFVideoFormat1080p30" frameDuration="1/${fps}s" width="1920" height="1080"/>
${assets}
  </resources>
  <library location="file:///Users/${getUsername()}/Movies/B-Roll-Assistant.fcpbundle">
    <event name="B-Roll Assistant Export">
      <project name="B-Roll Project">
        <sequence format="r1" duration="${totalDuration}/${fps}s" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${clipElements}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`

    setFcpxmlContent(xml)
  }

  const generateReadme = (clips, folderName) => {
    const lines = [
      '==============================================',
      ' B-ROLL EXPORT — HOW TO USE IN FINAL CUT PRO',
      '==============================================',
      '',
      'STEP 1 — Move your downloaded clips:',
      `   Create a folder: Downloads/${folderName}/`,
      '   Move ALL the .mp4 files into that folder.',
      '',
      'STEP 2 — Import into Final Cut Pro:',
      '   1. Open Final Cut Pro',
      '   2. Go to File → Import → XML',
      '   3. Select the "broll_timeline.fcpxml" file',
      '   4. Click Import',
      '',
      'STEP 3 — Use the clips:',
      '   Your B-roll clips will appear in a new Event.',
      '   Drag them onto your timeline above your main video on track V2.',
      '',
      '==============================================',
      ' CLIP LIST',
      '==============================================',
      '',
      ...clips.map((c, i) =>
        `${String(i + 1).padStart(2, '0')}. ${formatTime(c.timestamp)} → ${c.filename}\n    Context: "${c.text}"\n    Search: ${c.search_query}\n`
      )
    ]
    download(lines.join('\n'), 'HOW_TO_USE.txt', 'text/plain')
  }

  const getUsername = () => {
    // Best guess — user can correct path in FCP if needed
    return 'bobby'
  }

  const download = (content, filename, type) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const selectedCount = Object.keys(selections).filter(k => selections[k]?.media).length

  return (
    <div className="fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-white">
            Editor — {moments.length} B-roll moments detected
          </h2>
          <p className="text-zinc-500 text-sm mt-0.5">
            {transcript.length} transcript segments · {selectedCount} clips selected
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-ghost text-sm" onClick={onReset}>← New Video</button>
          <button className="btn-ghost text-sm" onClick={handleRefresh} disabled={loadingMore}>
            {loadingMore ? '⟳ Loading...' : '⟳ Refresh'}
          </button>
          <button className="btn-ghost text-sm" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : '+ More Suggestions'}
          </button>
          <button
            className="btn-primary text-sm px-5 py-2.5"
            onClick={handleMasterExport}
            disabled={exportStep === 'downloading' || selectedCount === 0}
          >
            {exportStep === 'downloading'
              ? `Downloading ${exportProgress.current}/${exportProgress.total}...`
              : `↓ Export All (${selectedCount} clips)`}
          </button>
        </div>
      </div>

      {/* Export success banner */}
      {exportStep === 'done' && (
        <div className="mb-4 px-4 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 fade-in">
          <p className="text-emerald-400 font-display font-semibold text-sm mb-2">
            ✅ Clips downloaded! Now get your Final Cut Pro file:
          </p>
          {fcpxmlContent && (
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <a
                href={"data:application/octet-stream;charset=utf-8," + encodeURIComponent(fcpxmlContent)}
                download="broll_timeline.fcpxml"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-xs font-display font-semibold hover:bg-brand-600 transition-colors"
              >
                🎬 Click here to download broll_timeline.fcpxml
              </a>
            </div>
          )}
          <p className="text-zinc-400 text-xs leading-relaxed">
            <strong>Then in FCP:</strong> Move .mp4 files into <code className="bg-dark-600 px-1 rounded">Downloads/BRoll_Export/</code> → File → Import → XML → select the .fcpxml file
          </p>
        </div>
      )}

      {/* 3-column layout */}
      <div className="grid grid-cols-12 gap-4" style={{ height: 'calc(100vh - 220px)' }}>

        {/* LEFT — Transcript */}
        <div className="col-span-3 flex flex-col min-h-0">
          <div className="card flex-1 overflow-hidden flex flex-col">
            <p className="font-display font-semibold text-sm mb-3 text-zinc-300 flex-shrink-0">Transcript</p>
            <TranscriptPanel transcript={transcript} currentTime={currentTime} moments={moments} onSeek={seekTo} />
          </div>
        </div>

        {/* MIDDLE — Video + Timeline + Moments */}
        <div className="col-span-5 flex flex-col gap-4 min-h-0">
          <div className="card flex-shrink-0">
            <div className="bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
              <div className="text-center p-6">
                <div className="text-4xl mb-2">🎬</div>
                <p className="font-display font-semibold text-zinc-400 text-sm mb-1">Video Player</p>
                <p className="text-xs text-zinc-600">Transcript sync & seeking functional below.</p>
              </div>
            </div>
          </div>

          <div className="card flex-shrink-0">
            <p className="font-display font-semibold text-xs text-zinc-500 mb-2 uppercase tracking-widest">Timeline</p>
            <div className="relative h-10 bg-dark-700 rounded-lg overflow-hidden">
              {transcript.length > 0 && moments.length > 0 && (() => {
                const totalDuration = transcript[transcript.length - 1]?.end || 1
                return moments.map((m, i) => {
                  const leftPct = (m.timestamp / totalDuration) * 100
                  const widthPct = Math.max(0.5, ((m.end_timestamp - m.timestamp) / totalDuration) * 100)
                  return (
                    <div
                      key={i}
                      className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all ${
                        selectedMoment === i ? 'bg-brand-500 opacity-90' :
                        selections[i]?.media ? 'bg-emerald-500 opacity-70' :
                        'bg-brand-500 opacity-30 hover:opacity-60'
                      }`}
                      style={{ left: leftPct + '%', width: widthPct + '%', minWidth: '4px' }}
                      onClick={() => setSelectedMoment(i)}
                      title={m.search_query}
                    />
                  )
                })
              })()}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs font-mono text-zinc-600">0:00</span>
              <span className="text-xs font-mono text-zinc-600">
                {transcript.length > 0 ? formatTime(transcript[transcript.length - 1]?.end || 0) : '--:--'}
              </span>
            </div>
          </div>

          <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
            <p className="font-display font-semibold text-sm mb-3 text-zinc-300 flex-shrink-0">B-Roll Moments</p>
            <MomentsPanel moments={moments} selections={selections} selectedMoment={selectedMoment} onSelect={setSelectedMoment} onSeek={seekTo} />
          </div>
        </div>

        {/* RIGHT — Media search */}
        <div className="col-span-4 flex flex-col min-h-0">
          <div className="card flex-1 overflow-hidden flex flex-col">
            <MediaSearchPanel
              jobId={jobId}
              moment={selectedMoment !== null ? moments[selectedMoment] : null}
              momentIndex={selectedMoment}
              selection={selectedMoment !== null ? selections[selectedMoment] : null}
              onSelectMedia={handleSelectMedia}
            />
          </div>
        </div>

      </div>
    </div>
  )
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m + ':' + s.toString().padStart(2, '0')
}
