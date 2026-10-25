'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function HojaQR({ negocio, slug, grupos, conPedidos, conCarta }: { negocio: string; slug: string; grupos: { nombre: string; mesas: string[] }[]; conPedidos: boolean; conCarta: boolean }) {
  const [qrs, setQrs] = useState<Record<string, string>>({})
  const url = (mesa: string) => `${window.location.origin}/carta/${slug}?mesa=${encodeURIComponent(mesa)}`
  useEffect(() => {
    let vivo = true
    void (async () => {
      const salida: Record<string, string> = {}
      for (const g of grupos) for (const m of g.mesas) salida[m] = await QRCode.toDataURL(url(m), { width: 360, margin: 1, errorCorrectionLevel: 'M' })
      if (vivo) setQrs(salida)
    })()
    return () => { vivo = false }
  }, [grupos, slug]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="min-h-screen bg-white p-6 text-black print:p-0">
      <div className="mx-auto max-w-4xl print:max-w-none">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div><h1 className="text-xl font-bold">QR de mesas · {negocio}</h1><p className="text-sm text-gray-600">{conPedidos ? 'Quien lo escanea abre la carta con su mesa cargada y puede pedir desde el celular.' : conCarta ? 'Quien lo escanea abre la carta del local. Para que además pueda pedir, encendé el módulo Pedidos.' : 'Para que el QR muestre la carta, encendé el módulo Carta.'}</p></div>
          <button onClick={() => window.print()} className="rounded border border-black px-4 py-1.5 text-sm font-semibold">Imprimir</button>
        </div>
        {grupos.length === 0 && <p className="text-sm text-gray-600">Todavía no hay mesas cargadas en el plano.</p>}
        {grupos.map((g) => (
          <section key={g.nombre} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-600 print:hidden">{g.nombre}</h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
              {g.mesas.map((m) => (
                <li key={m} className="break-inside-avoid rounded-lg border-2 border-black p-3 text-center">
                  <p className="text-2xl font-extrabold">Mesa {m}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {qrs[m] ? <img src={qrs[m]} alt={`Código QR de la mesa ${m}`} className="mx-auto my-1 h-40 w-40" /> : <div className="mx-auto my-1 h-40 w-40 animate-pulse bg-gray-100" />}
                  <p className="text-xs font-semibold">{conPedidos ? 'Escaneá, mirá la carta y pedí desde tu mesa' : 'Escaneá y mirá nuestra carta'}</p>
                  <p className="text-[10px] text-gray-500">{negocio}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
