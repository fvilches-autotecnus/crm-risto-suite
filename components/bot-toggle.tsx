'use client'

import { useTransition } from 'react'
import { Bot, Power } from 'lucide-react'
import { cambiarEstadoBot } from '@/app/(panel)/actions'
import { useConfirm, useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'

// Interruptor del bot de WhatsApp. Apagar pide confirmación; encender no.
export default function BotToggle({ activo, puedeCambiar }: { activo: boolean; puedeCambiar: boolean }) {
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()

  const cambiar = async () => {
    if (activo && !(await confirmar({ titulo: '¿Apagar el bot?', texto: 'Deja de responder los mensajes de WhatsApp y no se registran conversaciones hasta que lo vuelvas a encender.', confirmar: 'Apagar bot', peligro: true }))) return
    start(async () => {
      const r = await cambiarEstadoBot(!activo)
      if (r.ok) toast({ tipo: activo ? 'info' : 'ok', texto: activo ? 'Bot apagado' : 'Bot encendido' })
      else toast({ tipo: 'error', texto: r.error ?? 'No se pudo cambiar el estado del bot' })
    })
  }

  const estado = (
    <>
      <span className={'relative flex h-2 w-2'}>
        {activo && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rs-ok opacity-60" />}
        <span className={'relative inline-flex h-2 w-2 rounded-full ' + (activo ? 'bg-rs-ok' : 'bg-rs-danger')} />
      </span>
      <Bot size={14} />
      <span className="hidden sm:inline">{activo ? 'Bot activo' : 'Bot apagado'}</span>
    </>
  )

  if (!puedeCambiar) {
    return <span className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-rs-control px-3 text-sm text-rs-muted">{estado}</span>
  }
  return (
    <button
      onClick={cambiar}
      disabled={pending}
      title={activo ? 'Apagar el bot' : 'Encender el bot'}
      aria-label={activo ? 'Apagar el bot' : 'Encender el bot'}
      className={'inline-flex h-8 items-center gap-2 rounded-[10px] border px-3 text-sm font-medium transition active:scale-[.97] disabled:opacity-60 ' + (activo ? 'border-rs-control text-rs-text hover:bg-rs-raised' : 'border-rs-danger/50 bg-rs-danger/10 text-rs-danger hover:bg-rs-danger/20')}
    >
      {estado}
      {pending ? <Spinner size={14} /> : <Power size={14} className="opacity-70" />}
    </button>
  )
}
