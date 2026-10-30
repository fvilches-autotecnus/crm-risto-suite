'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { Spinner } from '@/components/ui'

/** Qué mostrar al lado de lo que se guarda solo: nada todavía, "se guarda solo", guardando, guardado o con error. */
export type Estado = 'quieto' | 'sucio' | 'guardando' | 'guardado' | 'error'

export function EstadoGuardado({ estado, error, className = '' }: { estado: Estado; error?: string | null; className?: string }) {
  return (
    <p role="status" aria-live="polite" className={'flex min-h-5 items-center gap-1.5 text-xs ' + className}>
      {estado === 'guardando' && <><Spinner size={12} /><span className="text-rs-muted">Guardando…</span></>}
      {estado === 'sucio' && <span className="text-rs-muted">Cambios sin guardar…</span>}
      {estado === 'guardado' && <><Check size={13} className="text-rs-ok" /><span className="text-rs-ok">Guardado</span></>}
      {estado === 'error' && <><AlertCircle size={13} className="text-rs-danger" /><span className="text-rs-danger">{error || 'No se pudo guardar'}</span></>}
      {estado === 'quieto' && <span className="text-rs-muted/80">Los cambios se guardan solos.</span>}
    </p>
  )
}

/** Estado para los formularios que usan useAccionFormulario con `auto`. */
export function estadoDeFormulario(f: { state: { ok: boolean; error?: string } | null; pending: boolean; sucio: boolean }): Estado {
  if (f.pending) return 'guardando'
  if (f.sucio) return 'sucio'
  if (f.state) return f.state.ok ? 'guardado' : 'error'
  return 'quieto'
}

/**
 * Guarda solo lo que cambia en una pantalla que arma su propio valor (listas, días, interruptores) y lo guarda con una función propia.
 * `valor` es el contenido serializado: cuando cambia (y no es el inicial) se espera `demora` ms y se llama a `guardar`. Devuelve el estado para mostrar.
 */
export function useAutoGuardar(valor: string, guardar: () => Promise<{ ok: boolean; error?: string }>, opciones: { activo?: boolean; demora?: number } = {}) {
  const { activo = true, demora = 700 } = opciones
  const [estado, setEstado] = useState<Estado>('quieto')
  const [error, setError] = useState<string | null>(null)
  const ultimo = useRef(valor)            // el último valor ya guardado (o el inicial)
  const guardarRef = useRef(guardar); guardarRef.current = guardar
  const enCurso = useRef(false)
  const valorRef = useRef(valor); valorRef.current = valor
  useEffect(() => {
    if (!activo) return
    // se volvió al último valor guardado (por ejemplo, tras corregir un dato inválido): no hay nada pendiente ni con error
    if (valor === ultimo.current) { setEstado((e) => (e === 'error' || e === 'sucio' ? 'guardado' : e)); return }
    setEstado('sucio')
    const t = setTimeout(async function intentar() {
      if (enCurso.current) { setTimeout(intentar, 250); return }
      enCurso.current = true; setEstado('guardando')
      const enviado = valorRef.current
      try {
        const r = await guardarRef.current()
        if (r.ok) { ultimo.current = enviado; setError(null); setEstado(valorRef.current === enviado ? 'guardado' : 'sucio') }
        else { setError(r.error ?? null); setEstado('error') }
      } catch { setError('No se pudo guardar. Probá de nuevo.'); setEstado('error') }
      finally { enCurso.current = false }
    }, demora)
    return () => clearTimeout(t)
  }, [valor, activo, demora])
  return { estado, error }
}
