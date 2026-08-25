import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import {
  Camera,
  Loader2,
  Lock,
  QrCode,
  ScanLine,
  X,
  ClipboardPaste,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useSessionReady } from '@/hooks/useSessionReady';
import { getPlatformFees, payPixQrCode } from '@/lib/payments.functions';
import { parsePixEmv, guessPixKeyType, type ParsedPixQr } from '@/lib/pix-emv';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/pay-qr')({
  component: PayQrPage,
});

function PayQrPage() {
  const sessionReady = useSessionReady();
  const fetchFees = useServerFn(getPlatformFees);
  const doPay = useServerFn(payPixQrCode);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const jsQRRef = useRef<any>(null);
  const scanningActiveRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedPixQr | null>(null);
  const [manualEmv, setManualEmv] = useState('');
  const [amountOverride, setAmountOverride] = useState('');
  const [txPass, setTxPass] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: fees } = useQuery({
    queryKey: ['platform-fees'],
    queryFn: () => fetchFees(),
    enabled: sessionReady,
    staleTime: 60_000,
  });

  const feeFixed = Number(fees?.withdrawal?.fixed ?? 0.8);

  const { data: wallet } = useQuery({
    queryKey: ['wallet-balance-pay-qr'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: sessionReady,
  });

  const stopCamera = useCallback(() => {
    scanningActiveRef.current = false;
    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const [manualKey, setManualKey] = useState('');

  const applyPayload = useCallback((text: string) => {
    try {
      const result = parsePixEmv(text);
      stopCamera();
      setParsed(result);
      setManualKey(result.pixKey || '');
      if (result.amount != null) {
        setAmountOverride(String(result.amount).replace('.', ','));
      } else {
        setAmountOverride('');
      }
      if (result.pixKey) {
        toast.success('QR Code reconhecido!');
      } else if (result.pixUrl) {
        toast.message('QR dinâmico detectado', {
          description: 'Informe a chave PIX do destinatário ou cole o Copia e Cola completo de um QR estático.',
        });
      } else if (result.isPix) {
        toast.message('PIX detectado, chave não embutida', {
          description: 'Digite a chave PIX do destinatário no campo abaixo.',
        });
      } else {
        toast.error('Não foi possível extrair a chave PIX deste QR.');
      }
    } catch (err: any) {
      toast.error(err.message || 'QR inválido');
    }
  }, [stopCamera]);

  const startCamera = async () => {
    setCameraError(null);
    setParsed(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Câmera não suportada neste dispositivo.');
      }

      // Load jsQR (works on iOS Safari + Chrome — BarcodeDetector alone is unreliable)
      if (!jsQRRef.current) {
        try {
          const mod = await import('jsqr');
          jsQRRef.current = mod.default || mod;
        } catch (e) {
          console.warn('jsQR import failed, trying CDN', e);
          const mod = await import(/* @vite-ignore */ 'https://esm.sh/jsqr@1.4.0');
          jsQRRef.current = (mod as any).default || mod;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
      setScanning(true);
      scanningActiveRef.current = true;

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const BD = (window as any).BarcodeDetector;
      if (typeof BD === 'function') {
        try {
          detectorRef.current = new BD({ formats: ['qr_code'] });
        } catch {
          detectorRef.current = null;
        }
      }

      const tick = async () => {
        if (!scanningActiveRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
          scanTimerRef.current = window.setTimeout(tick, 200);
          return;
        }

        try {
          // Native detector first (when available)
          if (detectorRef.current) {
            try {
              const codes = await detectorRef.current.detect(video);
              if (codes?.length) {
                const raw = codes[0].rawValue || codes[0].rawData;
                if (raw) {
                  applyPayload(String(raw));
                  return;
                }
              }
            } catch {
              // fall through to jsQR
            }
          }

          // jsQR frame analysis
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (w > 0 && h > 0) {
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const imageData = ctx.getImageData(0, 0, w, h);
              const code = jsQRRef.current(
                imageData.data,
                imageData.width,
                imageData.height,
                { inversionAttempts: 'attemptBoth' },
              );
              if (code?.data) {
                applyPayload(String(code.data));
                return;
              }
            }
          }
        } catch (err) {
          console.warn('scan tick error', err);
        }

        scanTimerRef.current = window.setTimeout(tick, 250);
      };

      scanTimerRef.current = window.setTimeout(tick, 300);
    } catch (err: any) {
      console.error(err);
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Permissão da câmera negada. Libere o acesso nas configurações do navegador.'
          : err?.message || 'Não foi possível abrir a câmera.';
      setCameraError(msg);
      toast.error(msg);
      stopCamera();
    }
  };

  const payAmount = (() => {
    if (amountOverride.trim()) {
      const n = Number(amountOverride.replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    return parsed?.amount ?? 0;
  })();

  const totalDebit = Math.round((payAmount + feeFixed) * 100) / 100;
  const balance = Number(wallet?.balance || 0);

  const openConfirm = () => {
    const key = (manualKey || parsed?.pixKey || '').trim();
    if (!key) {
      toast.error('Informe a chave PIX do destinatário.');
      return;
    }
    if (payAmount <= 0) {
      toast.error('Informe o valor do pagamento.');
      return;
    }
    if (balance < totalDebit) {
      toast.error('Saldo insuficiente para valor + taxa.');
      return;
    }
    setTxPass('');
    setShowConfirm(true);
  };

  const handlePay = async () => {
    const key = (manualKey || parsed?.pixKey || '').trim();
    if (!key || txPass.length !== 4) return;
    setLoading(true);
    try {
      await doPay({
        data: {
          amount: payAmount,
          pixKey: key,
          pixKeyType: guessPixKeyType(key),
          merchantName: parsed?.merchantName || undefined,
          emv: parsed?.raw,
          transactionPassword: txPass,
        },
      });
      toast.success('Pagamento enviado com sucesso!');
      setShowConfirm(false);
      setParsed(null);
      setManualEmv('');
      setAmountOverride('');
    } catch (err: any) {
      toast.error(err?.message || 'Falha no pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-16 w-full max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
          Pagar QR Code
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
          Escaneie um PIX e pague com o saldo da conta · Taxa fixa R${' '}
          {feeFixed.toFixed(2).replace('.', ',')}
        </p>
      </div>

      <Card className="border-white/5 bg-card/40 rounded-[2rem] overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <QrCode className="w-4 h-4" /> Leitor de QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-[3/4] max-h-[420px] w-full overflow-hidden rounded-2xl bg-black border border-white/10">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                'h-full w-full object-cover',
                !scanning && 'opacity-0 absolute'
              )}
            />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-white/70" />
                </div>
                <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest leading-relaxed">
                  Aponte a câmera para o QR Code PIX
                </p>
              </div>
            )}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-[70%] aspect-square border-2 border-white/40 rounded-2xl relative">
                  <ScanLine className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-white/80 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {cameraError && (
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider text-center">
              {cameraError}
            </p>
          )}

          <div className="flex gap-2">
            {!scanning ? (
              <Button
                onClick={startCamera}
                className="flex-1 h-12 rounded-xl bg-white text-black font-black uppercase text-[10px] tracking-widest"
              >
                <Camera className="w-4 h-4 mr-2" />
                Ler QR Code
              </Button>
            ) : (
              <Button
                onClick={stopCamera}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-white/10 font-black uppercase text-[10px] tracking-widest"
              >
                <X className="w-4 h-4 mr-2" />
                Parar câmera
              </Button>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
              Ou cole o Pix Copia e Cola
            </Label>
            <div className="flex gap-2">
              <Input
                value={manualEmv}
                onChange={(e) => setManualEmv(e.target.value)}
                placeholder="00020126..."
                className="bg-white/5 border-white/10 rounded-xl h-12 text-[11px] font-mono"
              />
              <Button
                type="button"
                onClick={() => applyPayload(manualEmv)}
                className="h-12 rounded-xl bg-white/10 hover:bg-white/15 font-black uppercase text-[9px] tracking-widest px-4"
              >
                <ClipboardPaste className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {parsed && (
        <Card className="border-primary/20 bg-primary/5 rounded-[2rem]">
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Destinatário
              </p>
              <p className="text-lg font-black tracking-tight">
                {parsed.merchantName || 'Não identificado'}
              </p>
              {parsed.merchantCity && (
                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                  {parsed.merchantCity}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Chave PIX
              </Label>
              <Input
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                className="bg-white/5 border-white/10 rounded-xl h-12 text-xs font-bold"
              />
              {parsed.pixUrl && !parsed.pixKey && (
                <p className="text-[9px] font-bold text-amber-500/80 uppercase tracking-wider leading-relaxed">
                  QR dinâmico (sem chave embutida). Confirme ou digite a chave do recebedor.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Valor (R$)
              </Label>
              <Input
                value={amountOverride}
                onChange={(e) =>
                  setAmountOverride(e.target.value.replace(/[^\d.,]/g, ''))
                }
                placeholder="0,00"
                className="bg-white/5 border-white/10 rounded-xl h-14 text-xl font-black"
              />
              {parsed.amount == null && (
                <p className="text-[9px] font-bold text-amber-500/80 uppercase tracking-wider">
                  Este QR não tem valor fixo — informe o valor
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Valor do PIX</span>
                <span>
                  {payAmount.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Taxa plataforma</span>
                <span className="text-red-400">
                  +{' '}
                  {feeFixed.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black uppercase tracking-widest pt-2 border-t border-white/10">
                <span>Total debitado</span>
                <span className="text-primary">
                  {totalDebit.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
              </div>
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider pt-1">
                Seu saldo:{' '}
                {balance.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </div>

            <Button
              onClick={openConfirm}
              className="w-full h-14 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs"
            >
              Pagar agora
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-card border-white/10 rounded-[2rem] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tighter">
              Confirmar pagamento
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {parsed?.merchantName || 'Destinatário PIX'} ·{' '}
              {totalDebit.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Senha de transação (4 dígitos)
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={txPass}
                  onChange={(e) => setTxPass(e.target.value.replace(/\D/g, ''))}
                  placeholder="****"
                  className="bg-white/5 border-white/10 rounded-2xl h-14 pl-12 font-black text-xl tracking-[0.5em] text-center"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <Button
              onClick={handlePay}
              disabled={loading || txPass.length !== 4}
              className="w-full h-14 rounded-2xl bg-primary text-black font-black uppercase tracking-widest"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Confirmar pagamento'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowConfirm(false)}
              className="text-[10px] font-black uppercase tracking-widest"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
