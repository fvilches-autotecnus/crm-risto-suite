'use client'

import { useActionState, useCallback, useEffect, useRef, useTransition } from 'react'
import type { ActionResult } from '@/app/(panel)/actions'

/**
 * Envía un formulario a una server action SIN el "reinicio automático" de React 19 (que borraba lo
 * escrito cuando la acción devolvía un error: el usuario tenía que volver a tipear todo).
 * Los valores se conservan; con `reiniciar` el formulario se limpia solo cuando la acción sale bien.
 */
export function useAccionFormulario(accion: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>, opciones: { reiniciar?: boolean } = {}) {
  const [state, dispatch, pending] = useActionState(accion, null as ActionResult | null)
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
