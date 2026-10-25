'use client'

import { useState } from 'react'
import { BASE_PRESET, MODULOS, PRESETS, aplicarDependencias, type ModuloClave, type ModulosActivos } from '@/lib/modulos'

const GRUPOS = ['Operación', 'Clientes y marketing', 'Análisis y bot'] as const
const titulo = (c: ModuloClave) => MODULOS.find((m) => m.clave === c)!.titulo

/**
 * Elige qué módulos tiene un negocio. Va dentro de un <form>: cada módulo es un checkbox con el nombre de su clave
 * (ver leerModulosForm). Los módulos que dependen de otro se bloquean mientras el otro está apagado (Pedidos enciende la Carta;
 * Métricas y Derivadas necesitan Reservas).
 */
export default function ModulosPicker({ valores }: { valores: ModulosActivos }) {
  const [on, setOn] = useState<ModulosActivos>(valores)

  const cambiar = (clave: ModuloClave, valor: boolean) => {
    const n = { ...on, [clave]: valor }
    if (clave === 'pedidos' && valor) n.carta = true       // los pedidos se arman desde la carta
    return setOn(aplicarDependencias(n))
  }
  const preset = (activos: ModuloClave[]) => {
    const n = {} as ModulosActivos
    const set = new Set<ModuloClave>([...BASE_PRESET, ...activos, ...(activos.includes('reservas') ? (['metricas'] as ModuloClave[]) : [])])
    for (const m of MODULOS) n[m.clave] = set.has(m.clave)
    setOn(aplicarDependencias(n))
  }
  // Pedidos no se bloquea: al encenderlo prende la Carta solo (y apagar la Carta apaga Pedidos)
  const bloqueado = (clave: ModuloClave) => (clave === 'pedidos' ? [] : MODULOS.find((m) => m.clave === clave)?.requiere?.filter((q) => !on[q]) ?? [])

  return (
    <div className="space-y-4">
      <input type="hidden" name="__modulos" value="1" />
      <div>
        <p className="label">Tipo de negocio (atajos)</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => <button key={p.id} type="button" onClick={() => preset(p.activos)} className="btn btn-sm">{p.titulo}</button>)}
        </div>
        <p className="mt-1.5 text-xs text-rs-muted">Elegí uno para empezar y después ajustá módulo por módulo. Los atajos dejan encendidos Clientes, Consultas, Cumpleaños, Vouchers y Reseñas.</p>
      </div>
      {GRUPOS.map((g) => (
        <fieldset key={g} className="space-y-2.5">
          <legend className="card-title mb-1">{g}</legend>
          {MODULOS.filter((m) => m.grupo === g).map((m) => {
            const faltan = bloqueado(m.clave)
            return (
              <label key={m.clave} className={'flex items-start gap-3 text-sm ' + (faltan.length ? 'cursor-not-allowed opacity-55' : 'cursor-pointer')}>
                <input type="checkbox" name={m.clave} checked={on[m.clave]} disabled={faltan.length > 0} onChange={(e) => cambiar(m.clave, e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
                <span>
                  <span className="font-medium">{m.titulo}</span>
                  {m.enPreparacion && <span className="ml-2 rounded-full bg-rs-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rs-muted">en preparación</span>}
                  <span className="block text-rs-muted">{m.texto}</span>
                  {faltan.length > 0 && <span className="block text-xs text-rs-warn">Necesita {faltan.map(titulo).join(' y ')} encendido.</span>}
                  {m.clave === 'pedidos' && on.pedidos && <span className="block text-xs text-rs-muted">La Carta queda encendida mientras Pedidos esté encendido.</span>}
                </span>
              </label>
            )
          })}
        </fieldset>
      ))}
      {/* los checkboxes deshabilitados no se envían: el servidor igual los trata como apagados (ver aplicarDependencias) */}
    </div>
  )
}
