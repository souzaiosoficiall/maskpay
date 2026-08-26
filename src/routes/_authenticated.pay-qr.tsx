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
  CheckCircle2,
  User,
  Wallet,
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
import { getPlatformFees, payPixQrCode, resolvePixDynamic } from '@/lib/payments.functions';
import { getProfile, updateTransactionPassword } from '@/lib/settings.functions';
import { parsePixEmv, guessPixKeyType, type ParsedPixQr } from '@/lib/pix-emv';
import { cn, formatAppError } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/pay-qr')({
  component: PayQrPage,
});

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function PayQrPage() {
  const sessionReady = useSessionReady();
  const fetchFees = useServerFn(getPlatformFees);
  const doPay = useServerFn(payPixQrCode);
  const doResolve = useServerFn(resolvePixDynamic);
  const fetchProfile = useServerFn(getProfile);
  const doSetTxPass = useServerFn(updateTransactionPassword);

  // ---- refs (stable) ----
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const jsQRRef = useRef<any>(null);
  const scanningActiveRef = useRef(false);

  // ---- state (all hooks before any conditional logic) ----
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedPixQr | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [manualEmv, setManualEmv] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [amountOverride, setAmountOverride] = useState('');
  const [txPass, setTxPass] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [amountLocked, setAmountLocked] = useState(false);
  const [setupPass, setSetupPass] = useState('');
  const [setupPass2, setSetupPass2] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  const { data: fees } = useQuery({
    queryKey: ['platform-fees'],
    queryFn: () => fetchFees(),
    enabled: sessionReady,
    staleTime: 60_000,
  });

  const feeFixed = Number(fees?.withdrawal?.fixed ?? 0.8);

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
    staleTime: 30_000,
  });

  const hasTxPassword = !!(profile as any)?.transaction_password_hash;

  const { data: wallet } = useQuery({
    queryKey: ['wallet-balance-pay-qr'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      try {
        videoRef.current.pause();
      } catch {
        /* ignore */
      }
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Preload jsQR as soon as the page opens
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (jsQRRef.current) return;
      try {
        const mod = await import('jsqr');
        if (!cancelled) jsQRRef.current = (mod as any).default || mod;
      } catch {
        try {
          const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js');
          if (!cancelled) jsQRRef.current = (mod as any).default || (window as any).jsQR || mod;
        } catch (e) {
          console.warn('jsQR preload failed', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Called whenever a QR string is decoded — always opens the payment sheet. */
  const applyPayload = useCallback(
    async (text: string) => {
      const rawIn = (text || '').trim();
      if (!rawIn || rawIn.length < 10) return;
      // Avoid double-fire from consecutive frames
      if (scanningActiveRef.current === false && sheetOpen) return;

      try {
        const result = parsePixEmv(rawIn);
        stopCamera();
        setParsed(result);
        setManualKey(result.raw || rawIn);
        const hasAmount = result.amount != null && result.amount > 0;
        setAmountOverride(hasAmount ? String(result.amount).replace('.', ',') : '');
        setAmountLocked(hasAmount);
        setSheetOpen(true);
        toast.success('QR Code lido com sucesso');

        const needsResolve =
          !(result.amount && result.amount > 0) || !result.pixKey;
        if (needsResolve && (result.pixUrl || result.raw?.startsWith('0002'))) {
          setResolving(true);
          try {
            const resolved = await doResolve({ data: { emv: result.raw } });
            if (resolved?.amount && resolved.amount > 0) {
              setAmountOverride(String(resolved.amount).replace('.', ','));
              setAmountLocked(true);
              toast.success(
                `Valor detectado: R$ ${Number(resolved.amount).toFixed(2).replace('.', ',')}`
              );
            }
            if (resolved?.merchantName) {
              setParsed((prev) =>
                prev
                  ? { ...prev, merchantName: resolved.merchantName || prev.merchantName }
                  : prev
              );
            }
            if (resolved?.pixKey) {
              setParsed((prev) =>
                prev ? { ...prev, pixKey: resolved.pixKey || prev.pixKey } : prev
              );
            }
          } catch (err) {
            console.warn('resolvePixDynamic failed', err);
          } finally {
            setResolving(false);
          }
        }
      } catch (err: any) {
        // Keep camera running if payload was garbage noise from a bad frame
        console.warn('parsePixEmv', err);
      }
    },
    [stopCamera, doResolve, sheetOpen]
  );

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Câmera não suportada neste dispositivo.');
      }

      // Ensure jsQR is ready
      if (!jsQRRef.current) {
        try {
          const mod = await import('jsqr');
          jsQRRef.current = (mod as any).default || mod;
        } catch {
          // last resort: global from script
          if ((window as any).jsQR) {
            jsQRRef.current = (window as any).jsQR;
          }
        }
      }

      if (!jsQRRef.current && !(window as any).BarcodeDetector) {
        toast.error('Leitor indisponível. Use Pix Copia e Cola.');
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

      const video = videoRef.current;
      if (!video) throw new Error('Elemento de vídeo não encontrado.');

      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      video.srcObject = stream;
      await video.play();

      setScanning(true);
      scanningActiveRef.current = true;

      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');

      const BD = (window as any).BarcodeDetector;
      if (typeof BD === 'function') {
        try {
          detectorRef.current = new BD({ formats: ['qr_code'] });
        } catch {
          detectorRef.current = null;
        }
      }

      let lastAttempt = 0;

      const tick = async () => {
        if (!scanningActiveRef.current) return;
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas || v.readyState < 2) {
          scanTimerRef.current = window.setTimeout(tick, 150);
          return;
        }

        const now = Date.now();
        // Throttle decode to ~6 fps for performance
        if (now - lastAttempt < 160) {
          scanTimerRef.current = window.setTimeout(tick, 80);
          return;
        }
        lastAttempt = now;

        try {
          // 1) Native BarcodeDetector
          if (detectorRef.current) {
            try {
              const codes = await detectorRef.current.detect(v);
              if (codes?.length) {
                const raw = codes[0].rawValue || codes[0].rawData;
                if (raw && String(raw).length > 10) {
                  await applyPayload(String(raw));
                  return;
                }
              }
            } catch {
              /* fall through */
            }
          }

          // 2) jsQR on a downscaled frame (much more reliable / faster)
          if (jsQRRef.current) {
            const vw = v.videoWidth;
            const vh = v.videoHeight;
            if (vw > 0 && vh > 0) {
              const maxW = 640;
              const scale = vw > maxW ? maxW / vw : 1;
              const w = Math.max(1, Math.floor(vw * scale));
              const h = Math.max(1, Math.floor(vh * scale));
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(v, 0, 0, w, h);
                const imageData = ctx.getImageData(0, 0, w, h);
                const code = jsQRRef.current(
                  imageData.data,
                  imageData.width,
                  imageData.height,
                  { inversionAttempts: 'attemptBoth' }
                );
                if (code?.data && String(code.data).length > 10) {
                  await applyPayload(String(code.data));
                  return;
                }
              }
            }
          }
        } catch (err) {
          console.warn('scan tick', err);
        }

        if (scanningActiveRef.current) {
          scanTimerRef.current = window.setTimeout(tick, 120);
        }
      };

      scanTimerRef.current = window.setTimeout(tick, 250);
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Permissão da câmera negada. Libere o acesso nas configurações.'
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

  // Taxa desconta do valor do QR: sai da conta o valor do PIX; destinatário recebe valor - taxa
  const totalDebit = Math.round(payAmount * 100) / 100;
  const recipientGets = Math.max(0, Math.round((payAmount - feeFixed) * 100) / 100);
  const balance = Number(wallet?.balance || 0);
  const effectiveKey = (manualKey || parsed?.pixKey || '').trim();

  const closeSheet = () => {
    setSheetOpen(false);
    setParsed(null);
    setManualKey('');
    setAmountOverride('');
    setAmountLocked(false);
  };

  const balanceAfter = Math.round((balance - totalDebit) * 100) / 100;

  const openConfirm = () => {
    if (!effectiveKey) {
      toast.error('Pix Copia e Cola inválido ou vazio.');
      return;
    }
    if (payAmount <= 0 || !amountLocked) {
      toast.error(
        'Não foi possível obter o valor deste QR Code. Escaneie novamente ou use um código com valor definido.'
      );
      return;
    }
    if (balance < totalDebit) {
      toast.error(`Saldo insuficiente. Você precisa de ${formatBRL(totalDebit)}.`);
      return;
    }
    setTxPass('');
    setSetupPass('');
    setSetupPass2('');
    // Close payment sheet so the PIN dialog is fully visible (not under z-80 overlay)
    setSheetOpen(false);
    setShowConfirm(true);
  };

  const handleSaveTxPassword = async () => {
    if (setupPass.length !== 4 || setupPass2.length !== 4) {
      toast.error('A senha deve ter 4 dígitos.');
      return;
    }
    if (setupPass !== setupPass2) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setSavingPass(true);
    try {
      await doSetTxPass({
        data: { newPassword: setupPass, confirmPassword: setupPass2 },
      });
      await refetchProfile();
      toast.success('Senha de transação configurada!');
      setTxPass(setupPass);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar senha');
    } finally {
      setSavingPass(false);
    }
  };

  const handlePay = async () => {
    if (!effectiveKey || txPass.length !== 4) return;
    setLoading(true);
    try {
      const emvPayload = effectiveKey.startsWith('0002')
        ? effectiveKey
        : (parsed?.raw || effectiveKey);
      const keyForApi = (() => {
        if (parsed?.pixKey) return parsed.pixKey;
        try {
          const p = parsePixEmv(emvPayload);
          if (p.pixKey) return p.pixKey;
        } catch { /* ignore */ }
        // Fallback: send EMV itself — server will try to resolve
        return emvPayload;
      })();
      await doPay({
        data: {
          amount: payAmount,
          pixKey: keyForApi,
          pixKeyType: guessPixKeyType(keyForApi),
          merchantName: parsed?.merchantName || undefined,
          emv: emvPayload,
          transactionPassword: txPass,
        },
      });
      toast.success('Pagamento enviado com sucesso!');
      setShowConfirm(false);
      closeSheet();
      setManualEmv('');
    } catch (err: any) {
      toast.error(err?.message || 'Falha no pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-28 w-full max-w-xl mx-auto relative">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
          Pagar QR Code
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
          Escaneie um PIX · Taxa fixa {formatBRL(feeFixed)}
        </p>
      </div>

      {/* Scanner */}
      <Card className="border-white/5 bg-card/40 rounded-[2rem] overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <QrCode className="w-4 h-4" /> Leitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-[3/4] max-h-[380px] w-full overflow-hidden rounded-2xl bg-black border border-white/10">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn('h-full w-full object-cover', !scanning && 'opacity-0 absolute')}
            />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-white/70" />
                </div>
                <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest leading-relaxed">
                  Aponte para o QR Code PIX
                </p>
              </div>
            )}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-[72%] aspect-square border-2 border-white/50 rounded-2xl relative overflow-hidden">
                  <ScanLine className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-white animate-pulse" />
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
                className="h-12 rounded-xl bg-white/10 hover:bg-white/15 px-4"
              >
                <ClipboardPaste className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== BANK-STYLE PAYMENT SHEET ===== */}
      {sheetOpen && parsed && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Fechar"
            onClick={closeSheet}
          />
          <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-[#0c0c0c] border border-white/10 shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    QR reconhecido
                  </p>
                  <h2 className="text-lg font-black tracking-tight">
                    {parsed.pixKey ? 'PIX estático' : parsed.pixUrl ? 'PIX dinâmico' : 'PIX detectado'}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    Destinatário
                  </p>
                  <p className="text-base font-black truncate">
                    {parsed.merchantName || 'Informe os dados abaixo'}
                  </p>
                  {parsed.merchantCity && (
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">
                      {parsed.merchantCity}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  Pix Copia e Cola *
                </Label>
                <textarea
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  placeholder="00020126..."
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-[10px] font-mono text-white/90 leading-relaxed resize-none focus:outline-none focus:border-white/25"
                />
                <p className="text-[9px] font-bold text-muted-foreground/70 leading-relaxed">
                  Código completo do QR (Copia e Cola). Já preenchido automaticamente na leitura.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  Valor a pagar (R$) *
                </Label>
                <div className="relative">
                  <Input
                    value={amountOverride || (resolving ? '' : '—')}
                    readOnly
                    placeholder="Aguardando leitura..."
                    className="bg-white/5 border-white/10 rounded-xl h-14 text-2xl font-black opacity-90 cursor-not-allowed"
                  />
                  {resolving && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Buscando valor
                    </div>
                  )}
                </div>
                <p className="text-[9px] font-bold text-muted-foreground/70 leading-relaxed">
                  Valor bloqueado por segurança — definido pelo QR Code, sem edição.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/50 p-4 space-y-3">
              <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Valor do PIX</span>
                <span className="text-white">{formatBRL(payAmount)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Taxa MaskPay (descontada)</span>
                <span className="text-red-400">− {formatBRL(feeFixed)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-white/10">
                <span className="text-[11px] font-black uppercase tracking-widest">Destinatário recebe</span>
                <span className="text-xl font-black text-green-400">{formatBRL(recipientGets)}</span>
              </div>
              <p className="text-[9px] font-bold text-muted-foreground/70 leading-relaxed">
                A taxa é descontada do valor. Sai da sua conta o valor do PIX; quem recebe fica com valor menos a taxa.
              </p>
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <Wallet className="w-3.5 h-3.5" />
                Saldo atual: {formatBRL(balance)}
              </div>
              <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest pt-1">
                <span className="text-muted-foreground">Saldo após pagamento</span>
                <span className={balanceAfter < 0 ? 'text-red-400' : 'text-white'}>
                  {formatBRL(Math.max(0, balanceAfter))}
                </span>
              </div>
            </div>

            <Button
              onClick={openConfirm}
              disabled={resolving || payAmount <= 0 || !amountLocked}
              className="w-full h-14 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs disabled:opacity-40"
            >
              {resolving ? 'Obtendo valor...' : 'Continuar'}
            </Button>
          </div>
        </div>
      )}

      {/* Password confirm */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-card border-white/10 rounded-[2rem] max-w-md z-[220]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tighter">
              Confirmar pagamento
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {parsed?.merchantName || 'PIX'} · {formatBRL(totalDebit)} · Saldo após:{' '}
              {formatBRL(Math.max(0, balanceAfter))}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!hasTxPassword ? (
              <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  Configure sua senha de transação
                </p>
                <p className="text-[10px] font-bold text-muted-foreground leading-relaxed">
                  Crie uma senha de 4 dígitos para autorizar saques e pagamentos. Você só precisa
                  fazer isso uma vez.
                </p>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    Nova senha (4 dígitos)
                  </Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={setupPass}
                    onChange={(e) => setSetupPass(e.target.value.replace(/\D/g, ''))}
                    placeholder="****"
                    className="bg-white/5 border-white/10 rounded-xl h-12 font-black text-center tracking-[0.4em]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    Confirmar senha
                  </Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={setupPass2}
                    onChange={(e) => setSetupPass2(e.target.value.replace(/\D/g, ''))}
                    placeholder="****"
                    className="bg-white/5 border-white/10 rounded-xl h-12 font-black text-center tracking-[0.4em]"
                  />
                </div>
                <Button
                  onClick={handleSaveTxPassword}
                  disabled={savingPass || setupPass.length !== 4 || setupPass2.length !== 4}
                  className="w-full h-12 rounded-xl bg-white text-black font-black uppercase text-[10px] tracking-widest"
                >
                  {savingPass ? <Loader2 className="animate-spin" /> : 'Salvar senha'}
                </Button>
              </div>
            ) : (
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
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <Button
              onClick={handlePay}
              disabled={loading || !hasTxPassword || txPass.length !== 4}
              className="w-full h-14 rounded-2xl bg-primary text-black font-black uppercase tracking-widest"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Confirmar pagamento'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowConfirm(false);
                if (parsed) setSheetOpen(true);
              }}
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
