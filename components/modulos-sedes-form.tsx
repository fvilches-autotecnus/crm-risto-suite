'use client'

import { guardarModulosSedes } from '@/app/(panel)/config-sedes-actions'
import { useResultado } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import type { ConfigSede } from '@/lib/config-sedes'
import { MODULOS, MODULOS_POR_SEDE, type ModulosActivos } from '@/lib/modulos'

/** Qué módulos usa cada sede. Solo se pueden apagar los que el negocio tiene; la sede no puede tener uno que el negocio no contrató. */
export default function ModulosSedesForm({ sedes, modulosNegocio, configSedes }: { sedes: { id: string; nombre: string }[]; modulosNegocio: ModulosActivos; configSedes: Record<string, ConfigSede> }) {
  const { state, pending, formProps } = useAccionFormulario(guardarModulosSedes)
  useResultado(state, 'Módulos de las sedes guardados')
  const disponibles = MODULOS.filter((m) => MODULOS_POR_SEDE.includes(m.clave) && modulosNegocio[m.clave])
  if (sedes.length === 0 || disponibles.length === 0) return null
  return (
    <form {...formProps} className="mt-4 space-y-3 border-t border-rs-border pt-4">
      <h3 className="text-sm font-semibold">Módulos por sede</h3>
      <p className="text-xs text-rs-muted">Cada sede usa los módulos del negocio, y acá podés apagarle los que no usa (por ejemplo, una sede sin plano de mesas). No se pueden prender los que el negocio no tiene. Lo que se apaga desaparece del menú de quien mira esa sede y del sitio de reservas de esa sede; los datos no se borran.</p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-xs text-rs-muted"><th className="pb-1 pr-4 font-medium">Sede</th>{disponibles.map((m) => <th key={m.clave} className="px-2 pb-1 text-center font-medium">{m.titulo}</th>)}</tr></thead>
          <tbody>
            {sedes.map((s) => (
              <tr key={s.id} className="border-t border-rs-border/60">
                <td className="py-2 pr-4 font-medium"><input type="hidden" name="sede_id" value={s.id} />{s.nombre}</td>
                {disponibles.map((m) => <td key={m.clave} className="px-2 py-2 text-center"><input type="checkbox" name={`m_${s.id}_${m.clave}`} defaultChecked={configSedes[s.id]?.modulos?.[m.clave] !== false} aria-label={`${s.nombre}: ${m.titulo}`} className="h-4 w-4 accent-[#c8e62b]" /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar'}</button>
    </form>
  )
}
