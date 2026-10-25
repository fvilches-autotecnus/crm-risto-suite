'use client'

import { useState, useTransition } from 'react'
import { guardarMensajeBot, restaurarMensajeBot } from '@/app/(panel)/config-reservas-actions'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import type { MensajeBotDef } from '@/lib/reservas-config'

/** Textos que el bot le manda al cliente. Cada uno trae su original; si el negocio no escribió el suyo se usa el original. */
export default function ConfigMensajesBot({ mensajes, originales, propios }: { mensajes: MensajeBotDef[]; originales: Record<string, string>; propios: Record<string, string> }) {
  const toast = useToast()
  const [textos, setTextos] = useState<Record<string, string>>(() => Object.fromEntries(mensajes.map((m) => [m.clave, propios[m.clave] ?? originales[m.clave] ?? ''])))
  const [guardados, setGuardados] = useState<Record<string, string>>(propios)
  const [pending, start] = useTransition()
  const [ocupado, setOcupado] = useState<string | null>(null)

  const guardar = (m: MensajeBotDef) => start(async () => {
    setOcupado(m.clave)
    const igualOriginal = textos[m.clave].trim() === (originales[m.clave] ?? '').trim()
    const r = igualOriginal ? await restaurarMensajeBot(m.clave) : await guardarMensajeBot(m.clave, textos[m.clave])
    setOcupado(null)
    if (!r.ok) { toast({ tipo: 'error', texto: r.error ?? 'No se pudo guardar' }); return }
    setGuardados((g) => { const c = { ...g }; if (igualOriginal) delete c[m.clave]; else c[m.clave] = textos[m.clave].trim(); return c })
    toast({ texto: igualOriginal ? 'Mensaje restaurado al original' : 'Mensaje guardado' })
  })
  const restaurar = (m: MensajeBotDef) => start(async () => {
    setOcupado(m.clave)
    const r = await restaurarMensajeBot(m.clave)
    setOcupado(null)
    if (!r.ok) { toast({ tipo: 'error', texto: r.error ?? 'No se pudo restaurar' }); return }
    setTextos((t) => ({ ...t, [m.clave]: originales[m.clave] ?? '' })); setGuardados((g) => { const c = { ...g }; delete c[m.clave]; return c })
    toast({ texto: 'Mensaje restaurado al original' })
  })

  return (
    <ul className="space-y-4">
      {mensajes.map((m) => {
        const cambiado = textos[m.clave].trim() !== (guardados[m.clave] ?? originales[m.clave] ?? '').trim()
        return (
          <li key={m.clave} className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2"><label htmlFor={`mb_${m.clave}`} className="font-semibold">{m.titulo}</label>{guardados[m.clave] ? <span className="rounded-full bg-rs-lime/15 px-2 py-0.5 text-[11px] font-semibold text-rs-lime">Personalizado</span> : <span className="rounded-full bg-rs-raised px-2 py-0.5 text-[11px] text-rs-muted">Original</span>}</div>
            <p className="text-xs text-rs-muted">{m.cuando}</p>
            <textarea id={`mb_${m.clave}`} value={textos[m.clave]} onChange={(e) => setTextos((t) => ({ ...t, [m.clave]: e.target.value }))} rows={3} maxLength={600} className="input w-full" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-rs-muted">{m.variables.length ? <>Variables: {m.variables.map((v) => <code key={v} className="mr-1 rounded bg-rs-raised px-1 font-mono text-rs-lime">{`{${v}}`}</code>)}</> : 'Sin variables.'}</p>
              <div className="flex gap-1.5">
                {guardados[m.clave] && <button type="button" disabled={pending} onClick={() => restaurar(m)} className="btn btn-sm">Restaurar el original</button>}
                <button type="button" disabled={pending || !cambiado} onClick={() => guardar(m)} className="btn btn-sm btn-primary">{ocupado === m.clave && <Spinner />}Guardar</button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
