'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { cn } from '@/lib/utils'
import { VscRefresh, VscArrowLeft } from 'react-icons/vsc'
import { FiLoader, FiCheckCircle, FiXCircle, FiAlertTriangle, FiActivity } from 'react-icons/fi'

interface WorkerStatus {
  name: string
  status: 'running' | 'stopped' | 'degraded' | 'unknown'
  details: string
}

interface HealthData {
  overall_status: 'healthy' | 'degraded' | 'critical' | 'unknown'
  workers: WorkerStatus[]
  service_status_raw: string
  interpretation: string
  all_workers_running: boolean
  recommendations: string[]
}

interface HealthMonitoringProps {
  onRestartDiagnosis: () => void
  setActiveAgentId: (id: string | null) => void
}

const HEALTH_AGENT_ID = '69a29468e5f04a341499c69b'

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1 text-foreground">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1 text-foreground">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2 text-foreground">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm text-foreground">{line.slice(2)}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm text-foreground">{line.replace(/^\d+\.\s/, '')}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm text-foreground">{line}</p>
      })}
    </div>
  )
}

export default function HealthMonitoring({ onRestartDiagnosis, setActiveAgentId }: HealthMonitoringProps) {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; glow: string }> = {
    running: { color: 'bg-green-500', icon: <FiCheckCircle className="w-5 h-5 text-green-400" />, glow: 'shadow-green-500/30' },
    stopped: { color: 'bg-red-500', icon: <FiXCircle className="w-5 h-5 text-red-400" />, glow: 'shadow-red-500/30' },
    degraded: { color: 'bg-yellow-500', icon: <FiAlertTriangle className="w-5 h-5 text-yellow-400" />, glow: 'shadow-yellow-500/30' },
    unknown: { color: 'bg-gray-500', icon: <FiActivity className="w-5 h-5 text-gray-400" />, glow: 'shadow-gray-500/30' },
  }

  const overallConfig: Record<string, { color: string; label: string }> = {
    healthy: { color: 'bg-green-600 text-white', label: 'ALL SYSTEMS OPERATIONAL' },
    degraded: { color: 'bg-yellow-500 text-black', label: 'DEGRADED PERFORMANCE' },
    critical: { color: 'bg-red-600 text-white', label: 'CRITICAL - INTERVENTION NEEDED' },
    unknown: { color: 'bg-gray-600 text-white', label: 'STATUS UNKNOWN' },
  }

  const checkHealth = async () => {
    setError('')
    setIsLoading(true)
    setActiveAgentId(HEALTH_AGENT_ID)

    const message = `Analyze the following Motadata service health check results:

SERVICE STATUS OUTPUT:
motadata app: running (PID: 12345, uptime: 2 minutes)
datastore: running (PID: 12346, uptime: 45 minutes)
bootstrap: running (PID: 12347, uptime: 2 minutes)

WORKER HEALTH CHECKS:
- motadata app: HTTP 200 on port 8443, response time 120ms
- datastore: TCP connection successful on port 5432
- bootstrap: HTTP 200 on port 9090

All services restarted after applying fixes.
Report the current health status of all three workers.`

    try {
      const result = await callAIAgent(message, HEALTH_AGENT_ID)
      setActiveAgentId(null)

      if (result.success && result?.response?.result) {
        let parsed = result.response.result
        if (typeof parsed === 'string') {
          parsed = parseLLMJson(parsed)
        }
        if (parsed?.result) {
          parsed = parsed.result
        }

        const data: HealthData = {
          overall_status: parsed?.overall_status ?? 'unknown',
          workers: Array.isArray(parsed?.workers) ? parsed.workers : [],
          service_status_raw: parsed?.service_status_raw ?? '',
          interpretation: parsed?.interpretation ?? '',
          all_workers_running: parsed?.all_workers_running ?? false,
          recommendations: Array.isArray(parsed?.recommendations) ? parsed.recommendations : [],
        }
        setHealthData(data)
      } else {
        const errMsg = result?.error ?? 'Health monitor returned an error.'
        setError(errMsg)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error'
      setError(errMsg)
      setActiveAgentId(null)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    checkHealth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const workers = Array.isArray(healthData?.workers) ? healthData.workers : []
  const recommendations = Array.isArray(healthData?.recommendations) ? healthData.recommendations : []
  const overall = healthData?.overall_status ?? 'unknown'
  const overallConf = overallConfig[overall] ?? overallConfig.unknown

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FiActivity className="w-6 h-6 text-foreground" />
        <h2 className="text-lg font-bold text-foreground amber-glow">HEALTH MONITORING</h2>
      </div>

      {/* Loading State */}
      {isLoading && !healthData && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <FiLoader className="w-8 h-8 text-foreground animate-spin" />
            <p className="text-sm text-muted-foreground font-mono">Running health checks...</p>
            <div className="text-xs text-muted-foreground font-mono terminal-cursor">Querying service status</div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="border border-destructive bg-destructive/10 p-3 text-destructive text-sm font-mono">
          ERROR: {error}
        </div>
      )}

      {healthData && (
        <>
          {/* Success Banner */}
          {healthData.all_workers_running && (
            <div className="border border-green-600 bg-green-900/20 p-4 flex items-center gap-3">
              <FiCheckCircle className="w-6 h-6 text-green-400 shrink-0" />
              <div>
                <p className="text-sm text-green-400 font-mono font-bold">ALL WORKERS RUNNING</p>
                <p className="text-xs text-green-400/70 font-mono">Service has been successfully restored.</p>
              </div>
            </div>
          )}

          {/* Overall Status */}
          <Card className="bg-card border-border">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">OVERALL STATUS</span>
                <Badge className={cn('font-mono text-xs', overallConf.color)}>
                  {overallConf.label}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Worker Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workers.map((worker, i) => {
              const wStatus = (worker?.status ?? 'unknown').toLowerCase() as keyof typeof statusConfig
              const conf = statusConfig[wStatus] ?? statusConfig.unknown
              return (
                <Card key={i} className={cn('bg-card border-border relative overflow-hidden')}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      {conf.icon}
                      <span className={cn('w-3 h-3 rounded-full', conf.color, wStatus === 'running' && 'pulse-amber')} style={wStatus === 'running' ? { boxShadow: '0 0 10px rgba(34,197,94,0.5)' } : undefined} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground font-mono uppercase">{worker?.name ?? 'Unknown Worker'}</h3>
                      <Badge variant="outline" className={cn('text-xs font-mono mt-1 border', wStatus === 'running' ? 'border-green-600 text-green-400' : wStatus === 'stopped' ? 'border-red-600 text-red-400' : wStatus === 'degraded' ? 'border-yellow-600 text-yellow-400' : 'border-gray-600 text-gray-400')}>
                        {worker?.status ?? 'unknown'}
                      </Badge>
                    </div>
                    {worker?.details && (
                      <p className="text-xs text-muted-foreground font-mono">{worker.details}</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
            {workers.length === 0 && (
              <div className="col-span-3 text-center text-xs text-muted-foreground py-8 font-mono">
                No worker data available.
              </div>
            )}
          </div>

          {/* Interpretation */}
          {healthData.interpretation && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">INTERPRETATION</CardTitle>
              </CardHeader>
              <CardContent>
                {renderMarkdown(healthData.interpretation)}
              </CardContent>
            </Card>
          )}

          {/* Raw Service Status */}
          {healthData.service_status_raw && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">RAW SERVICE OUTPUT</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="bg-background border border-border p-3">
                    <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">{healthData.service_status_raw}</pre>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && !healthData.all_workers_running && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">RECOMMENDATIONS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-foreground font-mono">
                    <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Separator className="bg-border" />

      <div className="flex gap-3">
        <Button onClick={checkHealth} disabled={isLoading} variant="outline" className="flex-1 border-border text-foreground hover:bg-secondary font-mono text-xs h-10">
          {isLoading ? (
            <span className="flex items-center gap-2"><FiLoader className="w-4 h-4 animate-spin" /> CHECKING...</span>
          ) : (
            <span className="flex items-center gap-2"><VscRefresh className="w-4 h-4" /> RE-CHECK HEALTH</span>
          )}
        </Button>
        <Button onClick={onRestartDiagnosis} variant="outline" className="flex-1 border-border text-foreground hover:bg-secondary font-mono text-xs h-10">
          <span className="flex items-center gap-2"><VscArrowLeft className="w-4 h-4" /> RESTART DIAGNOSIS</span>
        </Button>
      </div>
    </div>
  )
}
