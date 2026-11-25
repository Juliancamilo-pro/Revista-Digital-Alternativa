import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { EditorialButton, EditorialModal, EditorialNotice } from './ui/EditorialPrimitives';

interface QuoteShareModalProps {
  open: boolean;
  quoteText: string;
  quoteAuthor?: string;
  articleTitle: string;
  siteName: string;
  primaryColor?: string;
  onClose: () => void;
}

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export const QuoteShareModal: React.FC<QuoteShareModalProps> = ({
  open,
  quoteText,
  quoteAuthor,
  articleTitle,
  siteName,
  primaryColor = '#B91C1C',
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    if (!open || !quoteText) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = 1080;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#141414');
    grad.addColorStop(1, '#090909');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = `${primaryColor}28`;
    ctx.beginPath();
    ctx.arc(930, 140, 260, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, size, 18);

    ctx.fillStyle = '#FCA5A5';
    ctx.font = '700 28px "Barlow Condensed", system-ui, sans-serif';
    ctx.fillText(siteName.toUpperCase(), 84, 110);

    ctx.fillStyle = primaryColor;
    ctx.font = '700 130px Georgia, serif';
    ctx.fillText('“', 74, 245);

    ctx.fillStyle = '#F4F1EA';
    const cleanQuote = quoteText.trim();
    const fontSize = cleanQuote.length > 220 ? 38 : cleanQuote.length > 130 ? 46 : 54;
    ctx.font = `italic 500 ${fontSize}px "Source Serif 4", Georgia, serif`;
    const lines = wrapCanvasLines(ctx, `${cleanQuote}”`, size - 168).slice(0, 10);
    const lineHeight = Math.round(fontSize * 1.32);
    let y = 285;
    for (const line of lines) {
      ctx.fillText(line, 84, y);
      y += lineHeight;
    }

    if (quoteAuthor?.trim()) {
      ctx.fillStyle = primaryColor;
      ctx.fillRect(84, Math.min(820, y + 20), 64, 5);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 30px "Barlow Condensed", system-ui, sans-serif';
      ctx.fillText(quoteAuthor.trim().toUpperCase(), 84, Math.min(865, y + 66));
    }

    ctx.strokeStyle = '#2A2A2A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(84, 925);
    ctx.lineTo(size - 84, 925);
    ctx.stroke();

    ctx.fillStyle = '#A3A3A3';
    ctx.font = '600 24px "Barlow Condensed", system-ui, sans-serif';
    const titleLines = wrapCanvasLines(ctx, articleTitle, size - 168).slice(0, 2);
    titleLines.forEach((tLine, idx) => {
      ctx.fillText(tLine, 84, 972 + idx * 32);
    });

    setPreviewUrl(canvas.toDataURL('image/png'));
  }, [open, quoteText, quoteAuthor, articleTitle, siteName, primaryColor]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `cita-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleNativeShare = async () => {
    setShareNote('');
    const canvas = canvasRef.current;
    if (!canvas || !navigator.share) {
      handleDownload();
      return;
    }
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const file = new File([blob], 'cita-editorial.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: articleTitle,
            text: `“${quoteText}”`,
            files: [file],
          });
        } else {
          await navigator.share({
            title: articleTitle,
            text: `“${quoteText}” — ${siteName}`,
          });
        }
      } catch {
        setShareNote('Puedes descargar la imagen PNG directamente con el botón de descarga.');
      }
    }, 'image/png');
  };

  return (
    <EditorialModal
      open={open}
      onClose={onClose}
      kicker="Tarjeta visual para redes"
      title="Compartir cita"
    >
      <canvas ref={canvasRef} className="hidden" />

      {previewUrl && (
        <div className="rounded-2xl overflow-hidden border border-[var(--editorial-border)] shadow-lg">
          <img src={previewUrl} alt="Vista previa de tarjeta de cita" className="w-full h-auto block" />
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        <EditorialButton onClick={handleDownload} size="md" className="flex-1">
          <Download className="w-4 h-4" />
          <span>Descargar PNG</span>
        </EditorialButton>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <EditorialButton variant="secondary" size="md" onClick={handleNativeShare}>
            <Share2 className="w-4 h-4" />
            <span>Compartir</span>
          </EditorialButton>
        )}
      </div>
      {shareNote && <EditorialNotice>{shareNote}</EditorialNotice>}
    </EditorialModal>
  );
};
