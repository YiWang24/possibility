"use client";
import { create } from "zustand";

let token = 0;

export const useToast = create<{
  message: string | null;
  show: (text: string) => void;
}>((set) => ({
  message: null,
  show: (text: string) => {
    set({ message: text });
    const current = ++token;
    setTimeout(() => {
      if (current === token) set({ message: null });
    }, 2000);
  },
}));

export function ToastHost() {
  const message = useToast((s) => s.message);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[130px] z-[90] flex justify-center">
      <div
        className={`text-[13px] text-[#CFE0FF] px-[22px] py-3 rounded-chip bg-[#161A26]/95 border border-[#6FA5FF]/40 shadow-[0_8px_20px_rgba(0,0,0,0.6)] transition-all duration-300 ${
          message ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {message ?? ""}
      </div>
    </div>
  );
}
