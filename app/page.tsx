'use client'

import React, { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { VscTerminal, VscServer, VscShield, VscPulse } from 'react-icons/vsc'
import { FiActivity, FiCheck } from 'react-icons/fi'
import ConnectionSetup from './sections/ConnectionSetup'
import DiagnosisResults from './sections/DiagnosisResults'
import FixReview from './sections/FixReview'
import HealthMonitoring from './sections/HealthMonitoring'

// --- Types ---

interface RecommendedCommand {
  command: string
  description: string
  risk_level: string
}

interface DiagnosisData {
  root_cause: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  affected_components: string[]
  diagnosis_details: string
  recommended_commands: RecommendedCommand[]
  log_analysis: string
  summary: string
}

interface ExecutionStep {
  step: number
  command: string
  description: string
  risk_level: string
  is_destructive: boolean
  safety_notes: string
}

interface FixResult {
  validation_status: 'approved' | 'requires_confirmation' | 'rejected'
  execution_plan: ExecutionStep[]
  destructive_commands: string[]
  safety_summary: string
  warnings: string[]
}

// --- Sample Data ---

const SAMPLE_DIAGNOSIS: DiagnosisData = {
  root_cause: 'OutOfMemoryError in motadata app process. Memory limit of 512M exceeded during peak traffic. Port 8443 conflict after crash prevented automatic restart.',
  severity: 'critical',
  affected_components: ['motadata app', 'bootstrap', 'port 8443'],
  diagnosis_details: 'The motadata application service crashed due to an OutOfMemoryError. The configured maximum memory of 512M is insufficient for the current workload. After the crash, port 8443 was not released properly, preventing the automatic restart mechanism from functioning. The bootstrap service is degraded because it depends on the motadata app for health check responses.',
  recommended_commands: [
    { command: 'kill -9 $(lsof -t -i:8443)', description: 'Kill the process holding port 8443', risk_level: 'moderate' },
    { command: 'sed -i "s/max_memory=512M/max_memory=2048M/" /motadata/motadata/conf/motadata.conf', description: 'Increase memory allocation to 2GB', risk_level: 'safe' },
    { command: 'systemctl restart motadata-app', description: 'Restart the motadata application service', risk_level: 'safe' },
    { command: 'systemctl restart motadata-bootstrap', description: 'Restart the bootstrap service', risk_level: 'safe' },
  ],
  log_analysis: '## Log Analysis\n\n### Critical Errors\n- **10:23:45** - motadata app process crashed with OutOfMemoryError\n- **10:24:01** - Failed restart attempt: port 8443 in use\n\n### Warnings\n- **10:23:46** - Bootstrap health check failed\n- Connection timeout to datastore observed\n\n### Pattern\nThe OOM crash triggered a cascade: port leak prevented restart, which caused bootstrap health check failures.',
  summary: 'Critical service outage caused by memory exhaustion in the motadata app process. A cascading failure pattern is observed where the crash left port 8443 occupied, blocking automatic recovery. Immediate remediation involves killing the stale port-holder process, increasing memory limits, and restarting affected services.',
}

const SAMPLE_FIX: FixResult = {
  validation_status: 'approved',
  execution_plan: [
    { step: 1, command: 'kill -9 $(lsof -t -i:8443)', description: 'Free port 8443', risk_level: 'moderate', is_destructive: false, safety_notes: 'Only kills process on specific port' },
    { step: 2, command: 'sed -i "s/max_memory=512M/max_memory=2048M/" /motadata/motadata/conf/motadata.conf', description: 'Increase memory', risk_level: 'safe', is_destructive: false, safety_notes: 'Config backup recommended' },
    { step: 3, command: 'systemctl restart motadata-app', description: 'Restart app', risk_level: 'safe', is_destructive: false, safety_notes: 'Brief downtime expected' },
    { step: 4, command: 'systemctl restart motadata-bootstrap', description: 'Restart bootstrap', risk_level: 'safe', is_destructive: false, safety_notes: 'Depends on app being up' },
  ],
  destructive_commands: [],
  safety_summary: 'All commands validated. No destructive operations detected. Recommended execution order maintained for dependency safety.',
  warnings: ['Brief service interruption during restart', 'Verify memory availability before increasing allocation'],
}

// --- Agents ---

const AGENTS = [
  { id: '69a29468e5f04a341499c699', name: 'Diagnosis Agent', purpose: 'Analyzes service logs and status to identify root causes' },
  { id: '69a29468e72641e0c6070ba2', name: 'Fix Execution Agent', purpose: 'Validates commands and creates safe execution plans' },
  { id: '69a29468e5f04a341499c69b', name: 'Health Monitor Agent', purpose: 'Checks service health and worker status post-fix' },
]

// --- Stepper ---

const STEPS = [
  { label: 'CONNECT', icon: VscTerminal },
  { label: 'DIAGNOSE', icon: VscServer },
  { label: 'FIX', icon: VscShield },
  { label: 'MONITOR', icon: VscPulse },
]

// --- ErrorBoundary ---

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground font-mono">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-mono">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- Main Page ---

export default function Page() {
  const [currentStep, setCurrentStep] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [diagnosisData, setDiagnosisData] = useState<DiagnosisData | null>(null)
  const [fixCommands, setFixCommands] = useState<RecommendedCommand[]>([])
  const [, setFixResults] = useState<FixResult | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [useSampleData, setUseSampleData] = useState(false)

  const handleDiagnosisComplete = useCallback((data: DiagnosisData) => {
    setDiagnosisData(data)
    setCurrentStep(1)
  }, [])

  const handleStatusChange = useCallback((status: 'disconnected' | 'connecting' | 'connected') => {
    setConnectionStatus(status)
  }, [])

  const handleProceedToFix = useCallback((commands: RecommendedCommand[]) => {
    setFixCommands(commands)
    setCurrentStep(2)
  }, [])

  const handleFixComplete = useCallback((results: FixResult) => {
    setFixResults(results)
    setCurrentStep(3)
  }, [])

  const handleRestartDiagnosis = useCallback(() => {
    setCurrentStep(0)
    setConnectionStatus('disconnected')
    setDiagnosisData(null)
    setFixCommands([])
    setFixResults(null)
    setActiveAgentId(null)
  }, [])

  const handleSampleToggle = useCallback((checked: boolean) => {
    setUseSampleData(checked)
    if (checked) {
      setDiagnosisData(SAMPLE_DIAGNOSIS)
      setFixCommands(SAMPLE_DIAGNOSIS.recommended_commands)
      setFixResults(SAMPLE_FIX)
      setConnectionStatus('connected')
      setCurrentStep(1)
    } else {
      handleRestartDiagnosis()
    }
  }, [handleRestartDiagnosis])

  const activeAgent = AGENTS.find(a => a.id === activeAgentId)

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground font-mono flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <VscTerminal className="w-6 h-6 text-foreground" />
              <h1 className="text-base font-bold text-foreground amber-glow-strong tracking-wider">MOTADATA SERVICE TROUBLESHOOTER</h1>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground">Sample Data</Label>
              <Switch id="sample-toggle" checked={useSampleData} onCheckedChange={handleSampleToggle} />
            </div>
          </div>
        </header>

        {/* Stepper */}
        <div className="border-b border-border bg-card/50 px-4 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            {STEPS.map((step, i) => {
              const StepIcon = step.icon
              const isActive = i === currentStep
              const isCompleted = i < currentStep
              return (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={() => { if (isCompleted) setCurrentStep(i) }} disabled={!isCompleted && !isActive} className={cn('w-10 h-10 flex items-center justify-center border-2 transition-all', isActive ? 'border-primary bg-primary text-primary-foreground pulse-amber' : isCompleted ? 'border-primary bg-primary/20 text-foreground' : 'border-muted text-muted-foreground', isCompleted && 'cursor-pointer hover:bg-primary/30')}>
                      {isCompleted ? <FiCheck className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                    </button>
                    <span className={cn('text-xs font-mono', isActive ? 'text-foreground amber-glow' : isCompleted ? 'text-foreground' : 'text-muted-foreground')}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn('flex-1 h-px mx-2', i < currentStep ? 'bg-primary' : 'bg-muted')} />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Sidebar */}
          <aside className="w-64 border-r border-border bg-card/30 p-4 hidden lg:block">
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground font-mono">CONNECTION</h3>
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500')} />
                  <span className="text-xs text-foreground font-mono uppercase">{connectionStatus}</span>
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Session Info */}
              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground font-mono">SESSION</h3>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Step</span>
                    <span className="text-foreground">{currentStep + 1}/4</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Phase</span>
                    <span className="text-foreground">{STEPS[currentStep]?.label ?? 'N/A'}</span>
                  </div>
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Agent Status */}
              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground font-mono">AGENTS</h3>
                <div className="space-y-2">
                  {AGENTS.map((agent) => (
                    <div key={agent.id} className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-1.5 h-1.5 rounded-full', activeAgentId === agent.id ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40')} />
                        <span className="text-xs text-foreground font-mono truncate">{agent.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-3.5 leading-tight">{agent.purpose}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Panel */}
          <main className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {currentStep === 0 && (
                <ConnectionSetup
                  onDiagnosisComplete={handleDiagnosisComplete}
                  onStatusChange={handleStatusChange}
                  connectionStatus={connectionStatus}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  setActiveAgentId={setActiveAgentId}
                />
              )}
              {currentStep === 1 && diagnosisData && (
                <DiagnosisResults
                  diagnosisData={diagnosisData}
                  onProceedToFix={handleProceedToFix}
                />
              )}
              {currentStep === 2 && fixCommands.length > 0 && (
                <FixReview
                  commands={fixCommands}
                  onFixComplete={handleFixComplete}
                  setActiveAgentId={setActiveAgentId}
                />
              )}
              {currentStep === 3 && (
                <HealthMonitoring
                  onRestartDiagnosis={handleRestartDiagnosis}
                  setActiveAgentId={setActiveAgentId}
                />
              )}
            </div>
          </main>
        </div>

        {/* Bottom Bar */}
        <footer className="border-t border-border bg-card px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiActivity className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">
                {activeAgent ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                    {activeAgent.name} active
                  </span>
                ) : 'System idle'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground font-mono">
                {connectionStatus === 'connected' ? 'SSH: SECURE' : 'SSH: N/A'}
              </span>
              <Badge variant="outline" className="text-xs font-mono border-border text-muted-foreground">
                v1.0.0
              </Badge>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
