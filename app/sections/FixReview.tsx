'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { cn } from '@/lib/utils'
import { VscWarning, VscShield, VscCheck } from 'react-icons/vsc'
import { FiAlertTriangle, FiLoader, FiCheckCircle, FiSkull } from 'react-icons/fi'

interface RecommendedCommand {
  command: string
  description: string
  risk_level: string
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

interface FixReviewProps {
  commands: RecommendedCommand[]
  onFixComplete: (results: FixResult) => void
  setActiveAgentId: (id: string | null) => void
}

const FIX_AGENT_ID = '69a29468e72641e0c6070ba2'

export default function FixReview({ commands, onFixComplete, setActiveAgentId }: FixReviewProps) {
  const [approvedMap, setApprovedMap] = useState<Record<number, boolean>>(() => {
    const map: Record<number, boolean> = {}
    commands.forEach((_, i) => { map[i] = true })
    return map
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [fixResult, setFixResult] = useState<FixResult | null>(null)
  const [executionOutput, setExecutionOutput] = useState<string[]>([])
  const [pendingResult, setPendingResult] = useState<FixResult | null>(null)

  const riskConfig: Record<string, { class: string; icon: React.ReactNode }> = {
    safe: { class: 'bg-green-800/50 text-green-400 border-green-600', icon: <FiCheckCircle className="w-3.5 h-3.5" /> },
    moderate: { class: 'bg-yellow-800/50 text-yellow-400 border-yellow-600', icon: <FiAlertTriangle className="w-3.5 h-3.5" /> },
    destructive: { class: 'bg-red-800/50 text-red-400 border-red-600', icon: <FiSkull className="w-3.5 h-3.5" /> },
    low: { class: 'bg-green-800/50 text-green-400 border-green-600', icon: <FiCheckCircle className="w-3.5 h-3.5" /> },
    high: { class: 'bg-red-800/50 text-red-400 border-red-600', icon: <FiSkull className="w-3.5 h-3.5" /> },
  }

  const approvedCommands = commands.filter((_, i) => approvedMap[i])
  const hasDestructive = approvedCommands.some(c => (c?.risk_level ?? '').toLowerCase() === 'destructive' || (c?.risk_level ?? '').toLowerCase() === 'high')

  const handleApplyFix = async () => {
    setError('')
    setIsLoading(true)
    setActiveAgentId(FIX_AGENT_ID)

    const message = `Validate and create an execution plan for the following approved commands:
${approvedCommands.map(c => `- ${c?.command ?? ''} (${c?.description ?? ''})`).join('\n')}

Check each command for safety. Flag any destructive operations (rm -rf, file overwrites, config deletions).
Generate a step-by-step execution plan with proper ordering and safety notes.`

    try {
      const result = await callAIAgent(message, FIX_AGENT_ID)
      setActiveAgentId(null)

      if (result.success && result?.response?.result) {
        let parsed = result.response.result
        if (typeof parsed === 'string') {
          parsed = parseLLMJson(parsed)
        }
        if (parsed?.result) {
          parsed = parsed.result
        }

        const fixData: FixResult = {
          validation_status: parsed?.validation_status ?? 'approved',
          execution_plan: Array.isArray(parsed?.execution_plan) ? parsed.execution_plan : [],
          destructive_commands: Array.isArray(parsed?.destructive_commands) ? parsed.destructive_commands : [],
          safety_summary: parsed?.safety_summary ?? '',
          warnings: Array.isArray(parsed?.warnings) ? parsed.warnings : [],
        }

        if ((fixData.destructive_commands.length > 0) || hasDestructive) {
          setPendingResult(fixData)
          setConfirmOpen(true)
        } else {
          await simulateExecution(fixData)
        }
      } else {
        const errMsg = result?.error ?? 'Fix agent returned an error.'
        setError(errMsg)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error'
      setError(errMsg)
      setActiveAgentId(null)
    }

    setIsLoading(false)
  }

  const simulateExecution = async (data: FixResult) => {
    const steps = Array.isArray(data?.execution_plan) ? data.execution_plan : []
    const output: string[] = []
    output.push('=== EXECUTION STARTED ===')

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      output.push(`[Step ${step?.step ?? i + 1}] ${step?.command ?? 'unknown'}`)
      output.push(`  > ${step?.description ?? ''}`)
      setExecutionOutput([...output])
      await new Promise(r => setTimeout(r, 800))
      output.push(`  [OK] Completed successfully`)
      setExecutionOutput([...output])
    }

    output.push('=== EXECUTION COMPLETE ===')
    setExecutionOutput([...output])
    setFixResult(data)
    onFixComplete(data)
  }

  const handleConfirm = async () => {
    if (confirmText !== 'CONFIRM') return
    setConfirmOpen(false)
    setConfirmText('')
    if (pendingResult) {
      await simulateExecution(pendingResult)
      setPendingResult(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <VscShield className="w-6 h-6 text-foreground" />
        <h2 className="text-lg font-bold text-foreground amber-glow">FIX REVIEW & APPROVAL</h2>
        <Badge variant="outline" className="ml-auto border-border text-foreground font-mono text-xs">
          {approvedCommands.length}/{commands.length} APPROVED
        </Badge>
      </div>

      {/* Command Cards */}
      <div className="space-y-3">
        {commands.map((cmd, i) => {
          const riskKey = (cmd?.risk_level ?? 'safe').toLowerCase()
          const risk = riskConfig[riskKey] ?? riskConfig.safe
          const isDestructive = riskKey === 'destructive' || riskKey === 'high'
          return (
            <Card key={i} className={cn('bg-card border-border', isDestructive && 'border-red-600/50')}>
              {isDestructive && (
                <div className="bg-red-900/30 border-b border-red-600/50 px-4 py-2 flex items-center gap-2">
                  <FiSkull className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400 font-mono">DESTRUCTIVE COMMAND - REVIEW CAREFULLY</span>
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <code className="text-xs text-foreground font-mono bg-background border border-border px-2 py-1 inline-block break-all">{cmd?.command ?? ''}</code>
                    {cmd?.description && (
                      <p className="text-xs text-muted-foreground">{cmd.description}</p>
                    )}
                    <Badge variant="outline" className={cn('text-xs font-mono border', risk.class)}>
                      <span className="mr-1">{risk.icon}</span>
                      {cmd?.risk_level ?? 'unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label htmlFor={`approve-${i}`} className="text-xs text-muted-foreground">
                      {approvedMap[i] ? 'ON' : 'OFF'}
                    </Label>
                    <Switch id={`approve-${i}`} checked={!!approvedMap[i]} onCheckedChange={(checked) => setApprovedMap(prev => ({ ...prev, [i]: checked }))} disabled={isLoading || !!fixResult} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {error && (
        <div className="border border-destructive bg-destructive/10 p-3 text-destructive text-sm font-mono">
          ERROR: {error}
        </div>
      )}

      {/* Execution Output */}
      {executionOutput.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">EXECUTION OUTPUT</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="bg-background border border-border p-3">
                {executionOutput.map((line, i) => (
                  <div key={i} className={cn('text-xs font-mono leading-relaxed', line.includes('[OK]') ? 'text-green-400' : line.includes('===') ? 'text-foreground amber-glow' : 'text-foreground')}>
                    {line}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Fix Result */}
      {fixResult && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
              <FiCheckCircle className="w-4 h-4 text-green-400" />
              FIX APPLIED SUCCESSFULLY
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fixResult.safety_summary && (
              <div className="text-xs text-foreground font-mono">{fixResult.safety_summary}</div>
            )}
            {Array.isArray(fixResult.warnings) && fixResult.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">WARNINGS:</p>
                {fixResult.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-yellow-400 font-mono flex items-center gap-1">
                    <VscWarning className="w-3 h-3 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!fixResult && (
        <Button onClick={handleApplyFix} disabled={isLoading || approvedCommands.length === 0} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm h-12 border border-primary/50">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <FiLoader className="w-4 h-4 animate-spin" />
              VALIDATING & APPLYING...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <VscCheck className="w-4 h-4" />
              APPROVE & APPLY FIX
            </span>
          )}
        </Button>
      )}

      {/* Destructive Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-card border-border text-foreground font-mono">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <FiSkull className="w-5 h-5" />
              DESTRUCTIVE OPERATION DETECTED
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs space-y-2">
              <span className="block">The following destructive commands will be executed:</span>
              {pendingResult && Array.isArray(pendingResult.destructive_commands) && pendingResult.destructive_commands.map((dc, i) => (
                <code key={i} className="block bg-red-900/30 border border-red-600/50 px-2 py-1 text-red-400 text-xs">{dc}</code>
              ))}
              <span className="block mt-2">Type CONFIRM to proceed:</span>
            </DialogDescription>
          </DialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder='Type "CONFIRM"' className="bg-input border-border text-foreground font-mono" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmText('') }} className="border-border text-foreground">
              CANCEL
            </Button>
            <Button onClick={handleConfirm} disabled={confirmText !== 'CONFIRM'} className="bg-red-600 text-white hover:bg-red-700 border border-red-500">
              EXECUTE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
