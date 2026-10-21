'use client'

import { useState, useTransition } from 'react'
import { Bot, Power } from 'lucide-react'
import { cambiarEstadoBot } from '@/app/(panel)/actions'

// Interruptor del bot de WhatsApp. Apagar pide confirmación; encender no.
export default function BotToggle({ activo, puedeCambiar }: { activo: boolean; puedeCambiar: boolean }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cambiar = () => {
    if (activo && !confirm('¿Apagar el bot?\n\nDeja de responder los mensajes de WhatsApp hasta que lo vuelvas a encender. Las conversaciones siguen guardándose.')) return
    setError(null)
    start(async () => {
      const r = await cambiarEstadoBot(!activo)
      if (!r.ok) setError(r.error ?? 'Error')
    })
  }

  const estado = (
    <>
      <span className={'h-2 w-2 rounded-full ' + (activo ? 'bg-rs-ok' : 'bg-rs-danger')} />
      <Bot size={14} />
      <span className="hidden sm:inline">{activo ? 'Bot activo' : 'Bot apagado'}</span>
    </>
  )

  if (!puedeCambiar) {
    return <span className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-rs-control px-3 text-sm text-rs-muted">{estado}</span>
  }
  return (
    <div className="flex items-center gap-2">
      {error && <span role="alert" className="text-xs text-rs-danger">{error}</span>}
      <button
        onClick={cambiar}
        disabled={pending}
        title={activo ? 'Apagar el bot' : 'Encender el bot'}
        aria-label={activo ? 'Apagar el bot' : 'Encender el bot'}
        className={'inline-flex h-8 items-center gap-2 rounded-[10px] border px-3 text-sm font-medium transition disabled:opacity-50 ' + (activo ? 'border-rs-control text-rs-text hover:bg-rs-raised' : 'border-rs-danger/50 bg-rs-danger/10 text-rs-danger hover:bg-rs-danger/20')}
      >
        {estado}
        <Power size={14} className="opacity-70" />
      </button>
    </div>
  )
}
