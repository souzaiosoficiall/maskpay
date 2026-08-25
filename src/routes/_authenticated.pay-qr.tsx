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
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
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

  const applyPayload = useCallback((text: string) => {
    try {
      const result = parsePixEmv(text);
      if (!result.pixKey) {
        toast.error('QR lido, mas não foi possível extrair a chave PIX.');
        return;
      }
      stopCamera();
      setParsed(result);
      if (result.amount != null) {
        setAmountOverride(String(result.amount).replace('.', ','));
      } else {
        setAmountOverride('');
      }
      toast.success('QR Code reconhecido!');
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
        await videoRef.current.play();
      }
      setScanning(true);

      // Prefer native BarcodeDetector when available
      const BD = (window as any).BarcodeDetector;
      if (typeof BD === 'function') {
        try {
          detectorRef.current = new BD({ formats: ['qr_code'] });
        } catch {
          detectorRef.current = null;
        }
      }

      scanTimerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        try {
          if (detectorRef.current) {
            const codes = await detectorRef.current.detect(video);
            if (codes?.length) {
              const raw = codes[0].rawValue || codes[0].rawData;
              if (raw) applyPayload(String(raw));
            }
          }
        } catch {
          // keep scanning
        }
      }, 500);
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
    if (!parsed?.pixKey) {
      toast.error('Escaneie ou cole um QR Code PIX válido.');
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
    if (!parsed?.pixKey || txPass.length !== 4) return;
    setLoading(true);
    try {
      await doPay({
        data: {
          amount: payAmount,
          pixKey: parsed.pixKey,
          pixKeyType: guessPixKeyType(parsed.pixKey),
          merchantName: parsed.merchantName || undefined,
          emv: parsed.raw,
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

            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Chave PIX
              </p>
              <p className="text-xs font-bold break-all text-white/80">{parsed.pixKey}</p>
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
