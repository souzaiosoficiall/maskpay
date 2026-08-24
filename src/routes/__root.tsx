import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, type ReactNode } from "react";
import { getUserIntegrations } from "@/lib/integrations.functions";
import { useQuery } from "@tanstack/react-query";


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import maskPlatformAsset from "@/lib/mask-asset";
import { Toaster } from "@/components/ui/sonner";
import { DevToolsDetector } from "@/components/DevToolsDetector";
import { useSessionReady } from "@/hooks/useSessionReady";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-foreground">
      <div className="mb-12 flex items-center gap-3">
        <img src={maskPlatformAsset.url} alt="MaskPay" className="w-16 h-16 object-contain" />
        <span className="text-3xl font-black tracking-tight uppercase flex items-center gap-2">
          MaskPay |
        </span>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2 uppercase">Ops, pagina nao encontrada</h2>
        <div className="text-[12rem] font-black tracking-tighter leading-none opacity-5 mb-8 select-none">
          404
        </div>
        <div className="flex justify-center mt-4">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-10 py-4 text-sm font-bold text-primary-foreground transition-all hover:scale-105 uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            Voltar ao menu inicial
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-foreground">
      <div className="mb-12 flex items-center gap-3">
        <img src={maskPlatformAsset.url} alt="MaskPay" className="w-16 h-16 object-contain" />
        <span className="text-3xl font-black tracking-tight uppercase flex items-center gap-2">
          MaskPay |
        </span>
      </div>
      
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2 uppercase">Ops, pagina nao encontrada</h2>
        <div className="text-[12rem] font-black tracking-tighter leading-none opacity-5 mb-8 select-none">
          ERR
        </div>
        <div className="flex justify-center mt-4">
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center justify-center rounded-full bg-primary px-10 py-4 text-sm font-bold text-primary-foreground transition-all hover:scale-105 uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            Voltar ao menu inicial
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "MaskPay | Infraestrutura de Pagamentos Global" },
      { name: "description", content: "Aceite pagamentos, envie transferências e gerencie seu fluxo de caixa global com a MaskPay." },
      { name: "author", content: "MaskPay" },
      { property: "og:title", content: "MaskPay | Pagamentos do Futuro" },
      { property: "og:description", content: "Infraestrutura de pagamentos escalável e segura para desenvolvedores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "MaskPay" },
      { name: "theme-color", content: "#000000" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <IntegrationScripts />
      <Outlet />
      <Toaster
        position="bottom-center"
        offset={24}
        visibleToasts={3}
        richColors
        closeButton
      />
      <DevToolsDetector />
    </QueryClientProvider>
  );
}

function IntegrationScripts() {
  const sessionReady = useSessionReady();
  const fetchUserIntegrations = useServerFn(getUserIntegrations);
  const { data: integrations = [] } = useQuery({
    queryKey: ['userIntegrations'],
    queryFn: () => fetchUserIntegrations(),
    enabled: sessionReady,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (!integrations || integrations.length === 0) return;

    // Google Analytics
    const googleInt = (integrations as any[]).find(i => i.provider === 'google');
    if (googleInt?.config?.['googleId']) {
      const googleId = googleInt.config['googleId'];
      const scriptId = 'google-analytics-script';
      
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${googleId}`;
        document.head.appendChild(script);

        const inlineScript = document.createElement('script');
        inlineScript.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${googleId}');
        `;
        document.head.appendChild(inlineScript);
      }
    }

    // Utmify
    const utmifyInt = (integrations as any[]).find(i => i.provider === 'utmify');
    if (utmifyInt?.config?.['token']) {
      const token = utmifyInt.config['token'];
      const scriptId = 'utmify-script';
      
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.src = `https://cdn.utmify.com.br/scripts/utms/latest.js`;
        script.dataset['token'] = token;
        document.head.appendChild(script);
      }
    }
  }, [integrations]);

  return null;
}
