import maskPlatformAsset from "@/lib/mask-asset";
import { QrCode, Code2, Headphones } from "lucide-react";

/**
 * Desktop-only visual panel for the auth page.
 * Network diagram: PIX / API / Suporte → MaskPay → Você
 * with a continuous light traveling along the connecting lines.
 */
export function AuthVisualPanel() {
  return (
    <div className="relative hidden lg:flex h-full min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] select-none">
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Soft vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0a0a0a_70%)]" />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center px-10">
        <h2 className="mb-14 text-center text-3xl font-bold tracking-tight text-white xl:text-4xl">
          Pagamentos de um jeito{" "}
          <span className="text-white">fácil.</span>
        </h2>

        {/* Diagram */}
        <div className="relative mx-auto h-[340px] w-full max-w-[420px]">
          {/* SVG connecting lines */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 420 340"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <defs>
              <linearGradient id="lineBase" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
              </linearGradient>

              {/* Animated light gradient */}
              <linearGradient id="lightGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="40%" stopColor="rgba(255,255,255,0.15)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.95)" />
                <stop offset="60%" stopColor="rgba(255,255,255,0.15)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>

            {/* Base paths: left nodes → center */}
            {/* PIX */}
            <path
              d="M 70 40 C 140 40, 170 160, 210 170"
              stroke="url(#lineBase)"
              strokeWidth="1.5"
              fill="none"
            />
            {/* API */}
            <path
              d="M 70 170 C 140 170, 170 170, 210 170"
              stroke="url(#lineBase)"
              strokeWidth="1.5"
              fill="none"
            />
            {/* Suporte */}
            <path
              d="M 70 300 C 140 300, 170 180, 210 170"
              stroke="url(#lineBase)"
              strokeWidth="1.5"
              fill="none"
            />
            {/* Center → Você */}
            <path
              d="M 210 170 L 350 170"
              stroke="url(#lineBase)"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Animated light strokes */}
            <path
              className="auth-line-light"
              d="M 70 40 C 140 40, 170 160, 210 170"
              stroke="url(#lightGrad)"
              strokeWidth="2"
              fill="none"
              strokeDasharray="40 200"
              pathLength={240}
            />
            <path
              className="auth-line-light auth-line-light-delay-1"
              d="M 70 170 C 140 170, 170 170, 210 170"
              stroke="url(#lightGrad)"
              strokeWidth="2"
              fill="none"
              strokeDasharray="40 160"
              pathLength={200}
            />
            <path
              className="auth-line-light auth-line-light-delay-2"
              d="M 70 300 C 140 300, 170 180, 210 170"
              stroke="url(#lightGrad)"
              strokeWidth="2"
              fill="none"
              strokeDasharray="40 200"
              pathLength={240}
            />
            <path
              className="auth-line-light auth-line-light-delay-3"
              d="M 210 170 L 350 170"
              stroke="url(#lightGrad)"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="30 120"
              pathLength={150}
            />
          </svg>

          {/* Left nodes */}
          <Node
            className="absolute left-0 top-[12px]"
            icon={<QrCode className="h-4 w-4" />}
            label="PIX"
          />
          <Node
            className="absolute left-0 top-[142px]"
            icon={<Code2 className="h-4 w-4" />}
            label="API"
          />
          <Node
            className="absolute left-0 top-[272px]"
            icon={<Headphones className="h-4 w-4" />}
            label="SUPORTE"
          />

          {/* Center — MaskPay logo */}
          <div className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black shadow-[0_0_40px_rgba(255,255,255,0.08)]">
            <img
              src={maskPlatformAsset.url}
              alt="MaskPay"
              className="h-9 w-9 object-contain"
            />
          </div>

          {/* Right — Você */}
          <Node
            className="absolute right-0 top-[142px]"
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 19c0-3.5 3-6 7-6s7 2.5 7 6" />
              </svg>
            }
            label="você"
          />
        </div>

        <p className="mt-14 text-center text-2xl font-bold tracking-tight text-white xl:text-3xl">
          Venha ser <span className="font-black">MASKPAY</span>
        </p>
      </div>

      {/* CSS for light travel animation */}
      <style>{`
        @keyframes auth-line-travel {
          0% { stroke-dashoffset: 240; }
          100% { stroke-dashoffset: 0; }
        }
        .auth-line-light {
          animation: auth-line-travel 2.4s linear infinite;
        }
        .auth-line-light-delay-1 {
          animation-delay: 0.4s;
        }
        .auth-line-light-delay-2 {
          animation-delay: 0.8s;
        }
        .auth-line-light-delay-3 {
          animation-delay: 1.2s;
        }
      `}</style>
    </div>
  );
}

function Node({
  className,
  icon,
  label,
}: {
  className?: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ""}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black text-white shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        {icon}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
        {label}
      </span>
    </div>
  );
}
