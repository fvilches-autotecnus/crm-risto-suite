/** Achica una foto en el navegador (WEBP, máx. `max` px de lado) para que la página cargue rápido y la subida sea liviana. Solo se usa del lado del cliente. */
export async function achicarImagen(file: File, max = 1100): Promise<File> {
  const bmp = await createImageBitmap(file)
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * escala); canvas.height = Math.round(bmp.height * escala)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', 0.82))
  if (!blob) throw new Error('No se pudo procesar la foto')
  return new File([blob], 'foto.webp', { type: 'image/webp' })
}
