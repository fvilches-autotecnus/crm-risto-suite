'use client'

import { useState } from 'react'
import { BASE_PRESET, MODULOS, PRESETS, conSugeridos, type ModuloClave, type ModulosActivos } from '@/lib/modulos'

const GRUPOS = ['Operación', 'Clientes y marketing', 'Análisis y bot'] as const
const titulo = (c: ModuloClave) => MODULOS.find((m) => m.clave === c)!.titulo

/**
 * Elige qué módulos tiene un negocio. Va dentro de un <form>: cada módulo es un checkbox con el nombre de su clave (ver leerModulosForm).
 * Todos son independientes. Cuando un módulo funciona mejor acompañado de otro ("conviene"), al encenderlo se enciende el otro también
 * y se explica por qué, pero se puede volver a apagar.
 */
export default function ModulosPicker({ valores }: { valores: ModulosActivos }) {
  const [on, setOn] = useState<ModulosActivos>(valores)
  const [aviso, setAviso] = useState<string | null>(null)

  const cambiar = (clave: ModuloClave, valor: boolean) => {
    if (!valor) { setOn({ ...on, [clave]: false }); setAviso(null); return }
    const n = conSugeridos(on, clave)
    const sumados = MODULOS.filter((m) => !on[m.clave] && n[m.clave] && m.clave !== clave).map((m) => m.titulo)
    setOn(n)
    setAviso(sumados.length ? `Se encendió también ${sumados.join(' y ')}: ${MODULOS.find((m) => m.clave === clave)!.conviene?.porque} Si no lo necesitás, podés apagarlo.` : null)
  }
  const preset = (activos: ModuloClave[]) => {
    const set = new Set<ModuloClave>([...BASE_PRESET, ...activos, ...(activos.includes('reservas') ? (['metricas'] as ModuloClave[]) : [])])
    const n = {} as ModulosActivos
    for (const m of MODULOS) n[m.clave] = set.has(m.clave)
    setOn(n); setAviso(null)
  }

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
      <p className="rounded-md bg-rs-raised/60 px-3 py-2 text-xs text-rs-muted">Cada módulo se puede encender o apagar por separado. Cuando uno funciona mejor acompañado de otro, lo marcamos con <span className="font-semibold text-rs-lime">Conviene con…</span> y lo encendemos juntos por defecto, pero podés sacarlo si ese negocio no lo necesita.</p>
      {aviso && <p role="status" className="rounded-md border border-rs-lime/30 bg-rs-lime/10 px-3 py-2 text-xs">{aviso}</p>}
      {GRUPOS.map((g) => (
        <fieldset key={g} className="space-y-3">
          <legend className="card-title mb-1">{g}</legend>
          {MODULOS.filter((m) => m.grupo === g).map((m) => {
            const faltan = m.conviene ? m.conviene.con.filter((q) => !on[q]) : []
            return (
              <div key={m.clave} className="text-sm">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" name={m.clave} checked={on[m.clave]} onChange={(e) => cambiar(m.clave, e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
                  <span>
                    <span className="font-medium">{m.titulo}</span>
                    {m.enPreparacion && <span className="ml-2 rounded-full bg-rs-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rs-muted">en preparación</span>}
                    <span className="block text-rs-muted">{m.texto}</span>
                  </span>
                </label>
                {m.conviene && (
                  <p className={'ml-7 mt-1 text-xs ' + (on[m.clave] && faltan.length ? 'text-rs-warn' : 'text-rs-muted')}>
                    <span className="font-semibold">{on[m.clave] && faltan.length ? `Sin ${faltan.map(titulo).join(' y ')}: ` : `Conviene con ${m.conviene.con.map(titulo).join(' y ')}: `}</span>{m.conviene.porque}
                    {on[m.clave] && faltan.length > 0 && <button type="button" onClick={() => setOn((o) => { const n = { ...o }; for (const q of faltan) n[q] = true; return n })} className="ml-2 font-semibold text-rs-lime underline-offset-2 hover:underline">Encender {faltan.map(titulo).join(' y ')}</button>}
                  </p>
                )}
              </div>
            )
          })}
        </fieldset>
      ))}
    </div>
  )
}
