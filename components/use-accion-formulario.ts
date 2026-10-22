'use client'

import { useActionState, useCallback, useEffect, useRef, useTransition } from 'react'
import type { ActionResult } from '@/app/(panel)/actions'
import { useToast } from '@/components/feedback'

/**
 * Envía un formulario a una server action SIN el "reinicio automático" de React 19 (que borraba lo
 * escrito cuando la acción devolvía un error: el usuario tenía que volver a tipear todo).
 * Los valores se conservan; con `reiniciar` el formulario se limpia solo cuando la acción sale bien.
 */
export function useAccionFormulario(accion: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>, opciones: { reiniciar?: boolean; okTexto?: string } = {}) {
  const toast = useToast()
  // El aviso de éxito se muestra apenas vuelve la respuesta (no desde un efecto): si la página se actualiza y el
  // formulario desaparece enseguida (ej. el botón "Crear voucher" de una fila que ya lo tiene), el aviso igual sale.
  const accionConAviso = async (prev: ActionResult | null, fd: FormData) => {
    const r = await accion(prev, fd)
    if (r.ok && opciones.okTexto) toast({ texto: opciones.okTexto })
    return r
  }
  const [state, dispatch, pending] = useActionState(accionConAviso, null as ActionResult | null)
  const [, start] = useTransition()
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (opciones.reiniciar && state?.ok) ref.current?.reset()
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    start(() => dispatch(datos))
  }, [dispatch])

  return { state, pending, formProps: { ref, onSubmit } }
}
