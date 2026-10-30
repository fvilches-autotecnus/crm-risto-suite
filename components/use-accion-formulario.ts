'use client'

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { ActionResult } from '@/app/(panel)/actions'
import { useToast } from '@/components/feedback'

/** Cuánto se espera después de la última tecla antes de guardar solo (un tilde, un menú o un interruptor guardan casi al instante). */
const DEMORA_TECLEO = 900
const DEMORA_CAMBIO = 150
const SIN_TEXTO = ['checkbox', 'radio', 'hidden', 'range', 'file', 'button', 'submit']

/**
 * Envía un formulario a una server action SIN el "reinicio automático" de React 19 (que borraba lo
 * escrito cuando la acción devolvía un error: el usuario tenía que volver a tipear todo).
 * Los valores se conservan; con `reiniciar` el formulario se limpia solo cuando la acción sale bien.
 *
 * Con `auto`, el formulario se guarda solo: apenas se cambia un interruptor, un menú o un tilde, y un instante después de dejar de escribir
 * (o al salir del campo). No hace falta botón "Guardar". Si falta algo o es inválido, la acción devuelve el error y el formulario lo muestra.
 */
export function useAccionFormulario(accion: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>, opciones: { reiniciar?: boolean; okTexto?: string; auto?: boolean } = {}) {
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
  const [sucio, setSucio] = useState(false)   // hay cambios todavía sin guardar (solo con `auto`)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ocupado = useRef(false)
  ocupado.current = pending

  useEffect(() => {
    if (opciones.reiniciar && state?.ok) ref.current?.reset()
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    setSucio(false)
    start(() => dispatch(datos))
  }, [dispatch])

  /** Guarda dentro de `ms` (si ya hay un guardado en curso, espera a que termine). Lo usan los cambios que no son del formulario (agregar o quitar una fila…). */
  const guardarPronto = useCallback((ms = DEMORA_CAMBIO) => {
    // OJO: no se cambia el estado de React en el mismo instante del evento: el navegador lo dibujaría ANTES de que React lea lo que se escribió
    // en un campo controlado y se perdería el primer caracter. Por eso va en el turno siguiente.
    setTimeout(() => setSucio(true), 0)
    if (temporizador.current) clearTimeout(temporizador.current)
    const intentar = () => {
      if (ocupado.current) { temporizador.current = setTimeout(intentar, 250); return }
      temporizador.current = null
      ref.current?.requestSubmit()
    }
    temporizador.current = setTimeout(intentar, ms)
  }, [])

  useEffect(() => {
    const f = ref.current
    if (!opciones.auto || !f) return
    const alEvento = (e: Event) => {
      const el = e.target as HTMLInputElement | null
      if (!el || !('name' in el)) return
      const esTexto = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !SIN_TEXTO.includes(el.type))
      // al teclear se espera; al terminar de editar (change/blur) o con tilde, menú o interruptor se guarda enseguida
      guardarPronto(e.type === 'input' && esTexto ? DEMORA_TECLEO : DEMORA_CAMBIO)
    }
    f.addEventListener('input', alEvento); f.addEventListener('change', alEvento)
    return () => { f.removeEventListener('input', alEvento); f.removeEventListener('change', alEvento); if (temporizador.current) clearTimeout(temporizador.current) }
  }, [opciones.auto, guardarPronto])

  return { state, pending, sucio, guardarPronto, formProps: { ref, onSubmit } }
}
