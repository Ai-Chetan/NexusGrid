import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';
import Modal from '@/components/common/Modal';
import { parseSystemCodeFromQrValue } from '@/lib/qr';

interface Props {
  open: boolean;
  onClose: () => void;
  onCodeDetected: (code: string) => void;
}

export default function QrScannerModal({ open, onClose, onCodeDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  const stopStream = useCallback(() => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setError('');
      setManualValue('');
      setIsReady(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser context. Use manual code entry below.');
      return;
    }

    const detectorCtor = (window as Window & {
      BarcodeDetector?: new (opts?: { formats?: string[] }) => {
        detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;
    const detector = detectorCtor ? new detectorCtor({ formats: ['qr_code'] }) : null;

    if (!detector) {
      setError('Using compatibility scanner mode for this browser.');
    }

    let cancelled = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);

        const scan = async () => {
          if (!videoRef.current || !context) return;
          const vw = videoRef.current.videoWidth;
          const vh = videoRef.current.videoHeight;
          if (vw > 0 && vh > 0) {
            canvas.width = vw;
            canvas.height = vh;
            context.drawImage(videoRef.current, 0, 0, vw, vh);

            // Preferred fast path: native BarcodeDetector
            if (detector) {
              try {
                const results = await detector.detect(canvas);
                const first = results.find((r) => !!r.rawValue)?.rawValue;
                const code = first ? parseSystemCodeFromQrValue(first) : null;
                if (code) {
                  onCodeDetected(code);
                  return;
                }
              } catch {
                // Fall through to jsQR compatibility path.
              }
            }

            // Compatibility path for browsers without BarcodeDetector support.
            try {
              const image = context.getImageData(0, 0, vw, vh);
              const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
              const code = decoded?.data ? parseSystemCodeFromQrValue(decoded.data) : null;
              if (code) {
                onCodeDetected(code);
                return;
              }
            } catch {
              // Keep scanning on transient frame/decoding errors.
            }
          }
          frameRef.current = requestAnimationFrame(scan);
        };

        frameRef.current = requestAnimationFrame(scan);
      } catch {
        setError('Unable to access camera. Allow permission or use manual code entry.');
      }
    }

    start().catch(() => {
      setError('Failed to start scanner.');
    });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, onCodeDetected, stopStream]);

  const submitManual = () => {
    const parsed = parseSystemCodeFromQrValue(manualValue);
    if (!parsed) {
      toast.error('Invalid code. Use format like NGSYS-123.');
      return;
    }
    onCodeDetected(parsed);
  };

  return (
    <Modal open={open} onClose={onClose} title="Scan System QR" size="sm">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2">
          <div className="aspect-square rounded-lg overflow-hidden bg-black/90 relative">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
            {!isReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-200 text-xs gap-2">
                <Camera className="w-5 h-5" />
                <span>Initializing camera...</span>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-amber-600">{error}</p>}

        <div>
          <label className="label">Manual code entry</label>
          <input
            type="text"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            className="input"
            placeholder="NGSYS-123"
          />
          <p className="text-[11px] text-slate-500 mt-1">Tip: you can also paste the full QR URL.</p>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Close</button>
          <button type="button" onClick={submitManual} className="btn-primary flex-1">Go to System</button>
        </div>
      </div>
    </Modal>
  );
}
