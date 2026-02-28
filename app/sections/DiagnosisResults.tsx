'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { VscChevronDown, VscChevronRight } from 'react-icons/vsc'
import { FiAlertTriangle, FiArrowRight, FiClipboard, FiCheck } from 'react-icons/fi'

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

interface DiagnosisResultsProps {
  diagnosisData: DiagnosisData
  onProceedToFix: (commands: RecommendedCommand[]) => void
}

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

export default function DiagnosisResults({ diagnosisData, onProceedToFix }: DiagnosisResultsProps) {
  const [logOpen, setLogOpen] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const severityConfig: Record<string, { color: string; border: string }> = {
    critical: { color: 'bg-red-600 text-white', border: 'border-red-600' },
    high: { color: 'bg-orange-500 text-black', border: 'border-orange-500' },
    medium: { color: 'bg-yellow-500 text-black', border: 'border-yellow-500' },
    low: { color: 'bg-green-600 text-white', border: 'border-green-600' },
  }

  const riskConfig: Record<string, string> = {
    safe: 'bg-green-800/50 text-green-400 border-green-600',
    moderate: 'bg-yellow-800/50 text-yellow-400 border-yellow-600',
    destructive: 'bg-red-800/50 text-red-400 border-red-600',
    low: 'bg-green-800/50 text-green-400 border-green-600',
    high: 'bg-red-800/50 text-red-400 border-red-600',
  }

  const severity = diagnosisData?.severity ?? 'medium'
  const sevConf = severityConfig[severity] ?? severityConfig.medium

  const handleCopy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    } catch {
      // clipboard not available
    }
  }

  const commands = Array.isArray(diagnosisData?.recommended_commands) ? diagnosisData.recommended_commands : []
  const components = Array.isArray(diagnosisData?.affected_components) ? diagnosisData.affected_components : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FiAlertTriangle className="w-6 h-6 text-foreground" />
        <h2 className="text-lg font-bold text-foreground amber-glow">DIAGNOSIS RESULTS</h2>
        <Badge className={cn('ml-auto text-xs font-mono uppercase', sevConf.color)}>
          {severity}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - 60% */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">ROOT CAUSE</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground font-mono">{diagnosisData?.root_cause ?? 'Unknown'}</p>
            </CardContent>
          </Card>

          {/* Summary text */}
          {diagnosisData?.summary && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">SUMMARY</CardTitle>
              </CardHeader>
              <CardContent>
                {renderMarkdown(diagnosisData.summary)}
              </CardContent>
            </Card>
          )}

          {/* Affected Components */}
          {components.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">AFFECTED COMPONENTS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {components.map((comp, i) => (
                    <Badge key={i} variant="outline" className="border-border text-foreground font-mono text-xs">
                      {comp}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Diagnosis Details */}
          {diagnosisData?.diagnosis_details && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">DIAGNOSIS DETAILS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-background border border-border p-3 overflow-x-auto">
                  {renderMarkdown(diagnosisData.diagnosis_details)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended Commands */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">RECOMMENDED COMMANDS ({commands.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {commands.length === 0 && (
                <p className="text-xs text-muted-foreground">No commands recommended.</p>
              )}
              {commands.map((cmd, i) => {
                const riskKey = (cmd?.risk_level ?? 'safe').toLowerCase()
                const riskClass = riskConfig[riskKey] ?? riskConfig.safe
                return (
                  <div key={i} className="bg-background border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <code className="text-xs text-foreground font-mono flex-1 break-all">{cmd?.command ?? ''}</code>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <Badge variant="outline" className={cn('text-xs font-mono border', riskClass)}>
                          {cmd?.risk_level ?? 'unknown'}
                        </Badge>
                        <button onClick={() => handleCopy(cmd?.command ?? '', i)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {copiedIdx === i ? <FiCheck className="w-3.5 h-3.5" /> : <FiClipboard className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    {cmd?.description && (
                      <p className="text-xs text-muted-foreground">{cmd.description}</p>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 40% */}
        <div className="lg:col-span-2 space-y-4">
          {/* Log Analysis Collapsible */}
          <Collapsible open={logOpen} onOpenChange={setLogOpen}>
            <Card className="bg-card border-border">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-2 hover:bg-secondary/30 transition-colors">
                  <CardTitle className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>LOG ANALYSIS</span>
                    {logOpen ? <VscChevronDown className="w-4 h-4" /> : <VscChevronRight className="w-4 h-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="bg-background border border-border p-3">
                      {diagnosisData?.log_analysis ? renderMarkdown(diagnosisData.log_analysis) : (
                        <p className="text-xs text-muted-foreground">No log analysis available.</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Copy All Commands */}
          <Button variant="outline" onClick={() => handleCopy(commands.map(c => c?.command ?? '').join('\n'), -1)} className="w-full border-border text-foreground hover:bg-secondary font-mono text-xs">
            <FiClipboard className="w-3.5 h-3.5 mr-2" />
            {copiedIdx === -1 ? 'COPIED ALL' : 'COPY ALL COMMANDS'}
          </Button>
        </div>
      </div>

      <Separator className="bg-border" />

      <Button onClick={() => onProceedToFix(commands)} disabled={commands.length === 0} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm h-12 border border-primary/50">
        <span className="flex items-center gap-2">
          <FiArrowRight className="w-4 h-4" />
          PROCEED TO FIX ({commands.length} COMMAND{commands.length !== 1 ? 'S' : ''})
        </span>
      </Button>
    </div>
  )
}
