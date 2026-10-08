"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/format";

type ToastKind = "success" | "error" | "info";
interface ToastMsg {
  id: number;
  message: string;
  kind: ToastKind;
}

const EVENT = "nk:toast";

/** Muestra un aviso breve desde cualquier componente cliente. */
export function toast(message: string, kind: ToastKind = "success") {
  window.dispatchEvent(new CustomEvent<Omit<ToastMsg, "id">>(EVENT, { detail: { message, kind } }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    let id = 0;
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<Omit<ToastMsg, "id">>).detail;
      const t = { ...detail, id: ++id };
      setToasts((prev) => [...prev.slice(-2), t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? XCircle : Info;
        return (
          <div
            key={t.id}
            role="status"
            className="surface-glass animate-fade-up pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl"
          >
            <Icon
              className={cn(
                "size-5 shrink-0",
                t.kind === "success" && "text-success",
                t.kind === "error" && "text-danger",
                t.kind === "info" && "text-nova-cyan",
              )}
            />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
