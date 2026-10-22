'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

/** Mensaje en español según lo que falló (el del navegador sale en el idioma del navegador). */
function mensaje(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const v = el.validity
  const a = el as HTMLInputElement
  if (v.valueMissing) return el instanceof HTMLSelectElement ? 'Elegí una opción' : a.type === 'checkbox' || a.type === 'radio' ? 'Marcá esta casilla' : 'Completá este campo'
  if (v.typeMismatch) return a.type === 'email' ? 'Ingresá un email válido' : a.type === 'url' ? 'Ingresá una dirección web válida' : 'El formato no es válido'
  if (v.patternMismatch) return el.title || 'El formato no es válido'
  if (v.tooShort) return `Escribí al menos ${a.minLength} caracteres`
  if (v.tooLong) return `Escribí como máximo ${a.maxLength} caracteres`
  if (v.rangeUnderflow) return `Ingresá un valor mayor o igual a ${a.min}`
  if (v.rangeOverflow) return `Ingresá un valor menor o igual a ${a.max}`
  if (v.stepMismatch || v.badInput) return 'Ingresá un número válido'
  return el.validationMessage || 'Revisá este campo'
}

interface Burbuja { texto: string; top: number; left: number; ancho: number }

/**
 * Reemplaza la burbuja de validación del navegador ("Completá este campo") por un aviso con el estilo de Risto Suite.
 * Escucha el evento `invalid` de cualquier campo: cancela la burbuja nativa, lleva el foco al primer campo con error,
 * lo marca en rojo y muestra el mensaje debajo. Se va solo al escribir, al salir del campo o a los 6 segundos.
 */
export default function ValidacionPropia() {
  const [b, setB] = useState<Burbuja | null>(null)

  useEffect(() => {
    let atendido = false
    let marcado: HTMLElement | null = null
    let temporizador: ReturnType<typeof setTimeout> | null = null

    const limpiar = () => {
      if (temporizador) clearTimeout(temporizador)
      temporizador = null
      marcado?.removeAttribute('aria-invalid')
      marcado = null
      setB(null)
    }

    const alInvalido = (e: Event) => {
      e.preventDefault()                       // sin burbuja del navegador
      if (atendido) return                     // el navegador avisa campo por campo: solo se atiende el primero
      atendido = true
      setTimeout(() => { atendido = false }, 0)
      const el = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      if (marcado && marcado !== el) marcado.removeAttribute('aria-invalid')
      marcado = el
      el.setAttribute('aria-invalid', 'true')
      el.focus({ preventScroll: false })
      const r = el.getBoundingClientRect()
      const ancho = Math.min(Math.max(r.width, 220), 340)
      setB({ texto: mensaje(el), top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)), ancho })
      if (temporizador) clearTimeout(temporizador)
      temporizador = setTimeout(limpiar, 6000)
    }
    const alEscribir = (e: Event) => { if (e.target === marcado) limpiar() }
    const alSalir = (e: Event) => { if (e.target === marcado) limpiar() }
    const alTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') limpiar() }

    document.addEventListener('invalid', alInvalido, true)   // `invalid` no burbujea: se escucha en captura
    document.addEventListener('input', alEscribir, true)
    document.addEventListener('change', alEscribir, true)
    document.addEventListener('focusout', alSalir, true)
    window.addEventListener('scroll', limpiar, true)
    window.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('invalid', alInvalido, true)
      document.removeEventListener('input', alEscribir, true)
      document.removeEventListener('change', alEscribir, true)
      document.removeEventListener('focusout', alSalir, true)
      window.removeEventListener('scroll', limpiar, true)
      window.removeEventListener('keydown', alTecla)
      if (temporizador) clearTimeout(temporizador)
    }
  }, [])

  if (!b) return null
  return createPortal(
    <div role="alert" className="pointer-events-none fixed z-[95] animate-scale-in rounded-rs-lg border border-rs-warn/40 bg-rs-header/95 px-3 py-2 text-sm shadow-xl shadow-black/50 backdrop-blur" style={{ top: b.top, left: b.left, maxWidth: b.ancho }}>
      <span className="absolute -top-1.5 left-5 h-3 w-3 rotate-45 border-l border-t border-rs-warn/40 bg-rs-header" aria-hidden />
      <p className="relative flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-rs-warn" />{b.texto}</p>
    </div>,
    document.body,
  )
}
