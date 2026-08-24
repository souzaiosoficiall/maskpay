/** Runtime error reporting for MaskPay (client-side). */

type ErrorOptions = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

type ErrorEvents = {
  captureException?: (
    error: unknown,
    options?: ErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __maskpayEvents?: ErrorEvents;
    __maskpayReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      context?: Record<string, unknown>;
    }) => void;
  }
}

export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  window.__maskpayEvents?.captureException?.(error, {
    tags: { source: "maskpay" },
    extra: context,
  });

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";
  const stack = error instanceof Error ? error.stack : undefined;

  window.__maskpayReportRuntimeError?.({
    message,
    stack,
    context,
  });

  if (process.env.NODE_ENV !== "production") {
    console.error("[MaskPay]", message, context, error);
  }
}

