'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { cn } from '@/lib/utils'
import { VscTerminal, VscDebugDisconnect, VscLock, VscServer } from 'react-icons/vsc'
import { FiLoader } from 'react-icons/fi'

interface DiagnosisData {
  root_cause: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  affected_components: string[]
  diagnosis_details: string
  recommended_commands: { command: string; description: string; risk_level: string }[]
  log_analysis: string
  summary: string
}

interface ConnectionSetupProps {
  onDiagnosisComplete: (data: DiagnosisData) => void
  onStatusChange: (status: 'disconnected' | 'connecting' | 'connected') => void
  connectionStatus: 'disconnected' | 'connecting' | 'connected'
  isLoading: boolean
  setIsLoading: (v: boolean) => void
  setActiveAgentId: (id: string | null) => void
}

const DIAGNOSIS_AGENT_ID = '69a29468e5f04a341499c699'

export default function ConnectionSetup({
  onDiagnosisComplete,
  onStatusChange,
  connectionStatus,
  isLoading,
  setIsLoading,
  setActiveAgentId,
}: ConnectionSetupProps) {
  const [machineIp, setMachineIp] = useState('')
  const [sshUsername, setSshUsername] = useState('')
  const [sshPassword, setSshPassword] = useState('')
  const [vpnEnabled, setVpnEnabled] = useState(false)
  const [vpnServer, setVpnServer] = useState('')
  const [vpnUsername, setVpnUsername] = useState('')
  const [vpnPassword, setVpnPassword] = useState('')
  const [error, setError] = useState('')
  const [terminalLines, setTerminalLines] = useState<string[]>([])

  const addTerminalLine = (line: string) => {
    setTerminalLines(prev => [...prev, line])
  }

  const isValidIp = (ip: string) => {
    const pattern = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!pattern.test(ip)) return false
    const parts = ip.split('.')
    return parts.every(p => parseInt(p) >= 0 && parseInt(p) <= 255)
  }

  const handleConnect = async () => {
    setError('')
    setTerminalLines([])

    if (!machineIp || !sshUsername || !sshPassword) {
      setError('All connection fields are required.')
      return
    }
    if (!isValidIp(machineIp)) {
      setError('Invalid IP address format.')
      return
    }

    setIsLoading(true)
    onStatusChange('connecting')
    addTerminalLine(`$ ssh ${sshUsername}@${machineIp}`)
    addTerminalLine('Establishing SSH connection...')

    if (vpnEnabled) {
      addTerminalLine(`$ vpn connect ${vpnServer}`)
      addTerminalLine('VPN tunnel established.')
    }

    await new Promise(r => setTimeout(r, 2000))
    onStatusChange('connected')
    addTerminalLine('Connection established.')
    addTerminalLine('$ service motadata status')
    addTerminalLine('Collecting service diagnostics...')

    setActiveAgentId(DIAGNOSIS_AGENT_ID)

    const diagMessage = `Analyze the following Motadata service diagnostics:

SERVICE STATUS:
service motadata status output:
- motadata app: stopped
- datastore: running
- bootstrap: degraded

LOG CONTENTS (from /motadata/motadata/logs):
[2024-01-15 10:23:45] ERROR: motadata app process crashed - OutOfMemoryError
[2024-01-15 10:23:46] WARN: Bootstrap health check failed - connection timeout to datastore
[2024-01-15 10:24:01] ERROR: Failed to restart motadata app - port 8443 already in use

CONFIG DATA:
max_memory=512M
port=8443
datastore_host=localhost
datastore_port=5432

Machine IP: ${machineIp}
SSH User: ${sshUsername}

Please provide a thorough diagnosis.`

    try {
      const result = await callAIAgent(diagMessage, DIAGNOSIS_AGENT_ID)
      setActiveAgentId(null)

      if (result.success && result?.response?.result) {
        let parsed = result.response.result
        if (typeof parsed === 'string') {
          parsed = parseLLMJson(parsed)
        }
        if (parsed?.result) {
          parsed = parsed.result
        }

        const diagData: DiagnosisData = {
          root_cause: parsed?.root_cause ?? 'Unknown root cause',
          severity: parsed?.severity ?? 'medium',
          affected_components: Array.isArray(parsed?.affected_components) ? parsed.affected_components : [],
          diagnosis_details: parsed?.diagnosis_details ?? '',
          recommended_commands: Array.isArray(parsed?.recommended_commands) ? parsed.recommended_commands : [],
          log_analysis: parsed?.log_analysis ?? '',
          summary: parsed?.summary ?? '',
        }

        addTerminalLine('Diagnosis complete.')
        addTerminalLine(`Root cause identified: ${diagData.root_cause}`)
        onDiagnosisComplete(diagData)
      } else {
        const errMsg = result?.error ?? 'Diagnosis agent returned an error.'
        setError(errMsg)
        addTerminalLine(`ERROR: ${errMsg}`)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error'
      setError(errMsg)
      addTerminalLine(`FATAL: ${errMsg}`)
      setActiveAgentId(null)
    }

    setIsLoading(false)
  }

  const statusColor = connectionStatus === 'connected'
    ? 'bg-green-500'
    : connectionStatus === 'connecting'
      ? 'bg-yellow-500'
      : 'bg-red-500'

  const statusLabel = connectionStatus === 'connected'
    ? 'CONNECTED'
    : connectionStatus === 'connecting'
      ? 'CONNECTING...'
      : 'DISCONNECTED'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <VscTerminal className="w-6 h-6 text-foreground" />
        <h2 className="text-lg font-bold text-foreground amber-glow">SSH CONNECTION SETUP</h2>
        <Badge variant="outline" className="ml-auto flex items-center gap-2 border-border">
          <span className={cn('w-2 h-2 rounded-full', statusColor, connectionStatus === 'connecting' && 'animate-pulse')} />
          {statusLabel}
        </Badge>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <VscServer className="w-4 h-4" />
            MACHINE CREDENTIALS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="machine-ip" className="text-xs text-muted-foreground">MACHINE IP *</Label>
            <Input id="machine-ip" placeholder="192.168.1.100" value={machineIp} onChange={(e) => setMachineIp(e.target.value)} className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground" disabled={isLoading} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ssh-user" className="text-xs text-muted-foreground">SSH USERNAME *</Label>
              <Input id="ssh-user" placeholder="root" value={sshUsername} onChange={(e) => setSshUsername(e.target.value)} className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground" disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssh-pass" className="text-xs text-muted-foreground">SSH PASSWORD *</Label>
              <Input id="ssh-pass" type="password" placeholder="********" value={sshPassword} onChange={(e) => setSshPassword(e.target.value)} className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground" disabled={isLoading} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2"><VscLock className="w-4 h-4" /> VPN CONFIGURATION</span>
            <Switch checked={vpnEnabled} onCheckedChange={setVpnEnabled} disabled={isLoading} />
          </CardTitle>
        </CardHeader>
        {vpnEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vpn-server" className="text-xs text-muted-foreground">VPN SERVER</Label>
              <Input id="vpn-server" placeholder="vpn.example.com" value={vpnServer} onChange={(e) => setVpnServer(e.target.value)} className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground" disabled={isLoading} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vpn-user" className="text-xs text-muted-foreground">VPN USERNAME</Label>
                <Input id="vpn-user" placeholder="vpnuser" value={vpnUsername} onChange={(e) => setVpnUsername(e.target.value)} className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground" disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vpn-pass" className="text-xs text-muted-foreground">VPN PASSWORD</Label>
                <Input id="vpn-pass" type="password" placeholder="********" value={vpnPassword} onChange={(e) => setVpnPassword(e.target.value)} className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground" disabled={isLoading} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {error && (
        <div className="border border-destructive bg-destructive/10 p-3 text-destructive text-sm font-mono">
          ERROR: {error}
        </div>
      )}

      {terminalLines.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">TERMINAL OUTPUT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-background border border-border p-3 max-h-48 overflow-y-auto">
              {terminalLines.map((line, i) => (
                <div key={i} className="text-xs font-mono text-foreground leading-relaxed">
                  {line}
                </div>
              ))}
              {isLoading && <span className="text-xs font-mono text-foreground terminal-cursor" />}
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleConnect} disabled={isLoading || !machineIp || !sshUsername || !sshPassword} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm h-12 border border-primary/50">
        {isLoading ? (
          <span className="flex items-center gap-2">
            <FiLoader className="w-4 h-4 animate-spin" />
            CONNECTING & DIAGNOSING...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <VscDebugDisconnect className="w-4 h-4" />
            CONNECT & DIAGNOSE
          </span>
        )}
      </Button>
    </div>
  )
}
