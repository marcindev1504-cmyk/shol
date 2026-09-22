import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { packColorSymbols, type Pack } from '../domain/packs'

const POSTER_W = 1080
const POSTER_H = 1440
const ART_COLORS: Record<Pack['color'], string> = { mint: '#b9f66e', orange: '#f5a06c', blue: '#86b9e8', violet: '#b39ddb', rose: '#e88ba6', amber: '#e8c96a' }


function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

export function PlakatDialog({ pack, shareUrl, onClose }: { pack: Pack; shareUrl: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const qrRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function draw() {
      const canvas = canvasRef.current
      const svg = qrRef.current?.querySelector('svg')
      if (!canvas || !svg) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const accent = ART_COLORS[pack.color]

      ctx.fillStyle = '#101515'
      ctx.fillRect(0, 0, POSTER_W, POSTER_H)
      const glow = ctx.createRadialGradient(POSTER_W / 2, -80, 0, POSTER_W / 2, -80, 900)
      glow.addColorStop(0, 'rgba(185,246,110,.20)')
      glow.addColorStop(1, 'rgba(185,246,110,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, POSTER_W, POSTER_H)

      ctx.globalAlpha = 0.1
      ctx.fillStyle = accent
      ctx.font = '700 560px "Avenir Next", "Segoe UI", sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(packColorSymbols[pack.color], POSTER_W - 40, 560)
      ctx.globalAlpha = 1

      roundRect(ctx, 72, 72, 92, 92, 24)
      ctx.fillStyle = '#b9f66e'
      ctx.fill()
      ctx.fillStyle = '#131914'
      ctx.font = '900 52px "Avenir Next", "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('K', 118, 134)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#eff4ee'
      ctx.font = '700 34px "Avenir Next", "Segoe UI", sans-serif'
      ctx.fillText('kompas', 190, 110)
      ctx.fillStyle = '#899794'
      ctx.font = '700 15px "Avenir Next", "Segoe UI", sans-serif'
      ctx.letterSpacing = '6px'
      ctx.fillText('WIEDZY', 190, 138)
      ctx.letterSpacing = '0px'

      ctx.fillStyle = accent
      ctx.font = '800 22px "Avenir Next", "Segoe UI", sans-serif'
      ctx.letterSpacing = '5px'
      ctx.fillText(pack.subject.toUpperCase(), 76, 250)
      ctx.letterSpacing = '0px'

      ctx.fillStyle = '#eff4ee'
      ctx.font = '500 68px "Avenir Next", "Segoe UI", sans-serif'
      const titleLines = wrapText(ctx, pack.title, POSTER_W - 152)
      titleLines.slice(0, 3).forEach((line, index) => ctx.fillText(line, 76, 330 + index * 84))
      const afterTitleY = 330 + Math.min(titleLines.length, 3) * 84

      ctx.fillStyle = '#899794'
      ctx.font = '500 30px "Avenir Next", "Segoe UI", sans-serif'
      ctx.fillText(`${pack.flashcards.length} fiszek · paczka edukacyjna`, 76, afterTitleY + 34)

      const qrSize = 470
      const cardX = (POSTER_W - qrSize - 96) / 2
      const cardY = 640
      roundRect(ctx, cardX, cardY, qrSize + 96, qrSize + 96, 36)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.shadowColor = 'rgba(0,0,0,.35)'
      ctx.shadowBlur = 60
      ctx.fill()
      ctx.shadowBlur = 0

      const xml = new XMLSerializer().serializeToString(svg)
      const img = new Image()
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
      await img.decode()
      if (cancelled) return
      ctx.drawImage(img, cardX + 48, cardY + 48, qrSize, qrSize)

      ctx.textAlign = 'center'
      ctx.fillStyle = '#b9f66e'
      ctx.font = '800 30px "Avenir Next", "Segoe UI", sans-serif'
      ctx.letterSpacing = '8px'
      ctx.fillText('ZESKANUJ KOD TELEFONEM', POSTER_W / 2, cardY + qrSize + 96 + 44)
      ctx.letterSpacing = '0px'
      ctx.fillStyle = '#899794'
      ctx.font = '500 24px "Avenir Next", "Segoe UI", sans-serif'
      ctx.fillText('Aplikacja zainstaluje się automatycznie i zadziała offline.', POSTER_W / 2, cardY + qrSize + 96 + 84)

      ctx.strokeStyle = 'rgba(236,244,231,.14)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(72, POSTER_H - 110)
      ctx.lineTo(POSTER_W - 72, POSTER_H - 110)
      ctx.stroke()
      ctx.fillStyle = '#71817d'
      ctx.font = '500 20px "Avenir Next", "Segoe UI", sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`PAKIET-${pack.id} · ${new Date().toLocaleDateString('pl-PL')}`, 76, POSTER_H - 64)
      ctx.textAlign = 'right'
      ctx.fillText('KOMPAS WIEDZY', POSTER_W - 76, POSTER_H - 64)

      if (!cancelled) setReady(true)
    }
    void draw()
    return () => { cancelled = true }
  }, [pack, shareUrl])

  function downloadPng() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `kompas-plakat-${pack.id}.png`
      anchor.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal poster-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <p className="kicker">DYSTRYBUCJA</p>
        <h2>Plakat z kodem QR</h2>
        <p className="modal-copy">Wyślij plakat na ekran w akademiku. Słuchacz skanuje kod, pobiera paczkę i instaluje aplikację — później działa w pełni offline.</p>
        <div ref={qrRef} className="qr-hidden"><QRCodeSVG value={shareUrl} size={512} bgColor="#ffffff" fgColor="#17201f" /></div>
        <canvas ref={canvasRef} width={POSTER_W} height={POSTER_H} className="poster-canvas" />
        <p className="poster-url"><small>{shareUrl}</small></p>
        <button className="primary-button full" disabled={!ready} onClick={downloadPng}>Pobierz plakat (PNG)</button>
      </div>
    </div>
  )
}
