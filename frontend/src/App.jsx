import { useState } from 'react'
import UploadStep from './components/UploadStep.jsx'
import ProcessingStep from './components/ProcessingStep.jsx'
import EditorStep from './components/EditorStep.jsx'

export default function App() {
  const [step, setStep] = useState('upload') // upload | processing | editor
  const [jobId, setJobId] = useState(null)
  const [intensity, setIntensity] = useState(5)
  const [results, setResults] = useState(null)

  const handleUploadComplete = (id) => {
    setJobId(id)
    setStep('processing')
  }

  const handleProcessingComplete = (data) => {
    setResults(data)
    setStep('editor')
  }

  const handleReset = () => {
    setStep('upload')
    setJobId(null)
    setResults(null)
    setIntensity(5)
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="border-b border-dark-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5"/>
              <path d="M11 6.5L15 4.5V11.5L11 9.5V6.5Z" fill="white"/>
            </svg>
          </div>
          <span className="font-display font-bold text-lg tracking-tight">B-Roll Assistant</span>
          <span className="text-xs font-mono text-zinc-500 bg-dark-700 px-2 py-0.5 rounded">BETA</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Step indicator */}
          {['upload', 'processing', 'editor'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-colors ${
                step === s ? 'bg-brand-500' :
                ['upload', 'processing', 'editor'].indexOf(step) > i ? 'bg-zinc-600' : 'bg-dark-500'
              }`} />
              {i < 2 && <div className="w-4 h-px bg-dark-600" />}
            </div>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {step === 'upload' && (
          <UploadStep
            intensity={intensity}
            setIntensity={setIntensity}
            onComplete={handleUploadComplete}
          />
        )}
        {step === 'processing' && (
          <ProcessingStep
            jobId={jobId}
            intensity={intensity}
            onComplete={handleProcessingComplete}
            onReset={handleReset}
          />
        )}
        {step === 'editor' && results && (
          <EditorStep
            jobId={jobId}
            results={results}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}
