'use client'

import { createContext, useContext } from 'react'
import { TZ_AR } from '@/lib/fechas'

/** La zona horaria del negocio que se está viendo, para los componentes del navegador que muestran horas (el servidor se la pasa desde el layout). */
const Zona = createContext<string>(TZ_AR)
export const ZonaProvider = ({ zona, children }: { zona: string; children: React.ReactNode }) => <Zona.Provider value={zona}>{children}</Zona.Provider>
export const useZona = () => useContext(Zona)
