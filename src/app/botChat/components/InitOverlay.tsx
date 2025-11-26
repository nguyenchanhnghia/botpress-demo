"use client";

import { useEffect, useState } from "react";

export function InitOverlay({ active }: { active: boolean }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [minDone, setMinDone] = useState(false);

  useEffect(() => {
    if (!active) return;

    setStep(1);
    setMinDone(false);

    const t1 = setTimeout(() => setStep(2), 800);
    const t2 = setTimeout(() => setStep(3), 1600);
    const t3 = setTimeout(() => setMinDone(true), 2400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active]);

  const visible = active || !minDone;

  return (
    <div
      className={`absolute inset-0 z-40 flex items-center justify-center transition-opacity duration-500 ${visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
    >
      <div className="relative z-10 w-full max-w-md px-8 py-6 bg-white/10 border border-white/20 rounded-3xl backdrop-blur-2xl shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-red-500/30">
              <span className="text-white text-lg">AI</span>
            </div>
            <div className="text-xs font-medium text-gray-700 uppercase tracking-wide">
              TVJ Internal Assistant
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-600 bg-emerald-50/80 border border-emerald-100 px-2 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="hidden sm:inline">Booting AI workspace</span>
            <span className="sm:hidden">Starting…</span>
          </div>
        </div>

        <div className="space-y-1 mb-5">
          <h2 className="text-xl font-semibold text-gray-900">
            Preparing your AI cockpit
          </h2>
          <p className="text-xs text-gray-500">
            Securely connecting to VietJet Thailand systems and loading your context.
          </p>
        </div>

        <div className="space-y-2 text-xs">
          <InitStep
            label="Initializing AI engine"
            state={step > 1 ? "done" : step === 1 ? "active" : "pending"}
          />
          <InitStep
            label="Syncing VietJet Thailand knowledge base"
            state={step > 2 ? "done" : step === 2 ? "active" : "pending"}
          />
          <InitStep
            label="Preparing your conversation workspace"
            state={step === 3 ? "active" : "pending"}
            last
          />
        </div>

        <div className="mt-5 flex items-center justify-between text-[11px] text-gray-400">
          <span>All actions are logged securely.</span>
          <span className="font-mono">TVJ · AI · Secure</span>
        </div>
      </div>
    </div>
  );
}

function InitStep({
  label,
  state,
  last,
}: {
  label: string;
  state: "pending" | "active" | "done";
  last?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <StepBullet state={state} last={last} />
      <span
        className={
          state === "active"
            ? "text-gray-900"
            : state === "done"
              ? "text-gray-700"
              : "text-gray-400"
        }
      >
        {label}
      </span>
    </div>
  );
}

function StepBullet({
  state,
  last,
}: {
  state: "pending" | "active" | "done";
  last?: boolean;
}) {
  if (state === "done") {
    return (
      <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white">
        ✓
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="relative w-4 h-4 flex items-center justify-center">
        <div className="absolute inline-flex w-4 h-4 rounded-full bg-blue-400 opacity-40 animate-ping" />
        <div className="relative w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
      </div>
    );
  }
  return (
    <div
      className={`w-3 h-3 rounded-full border border-gray-300 ${last ? "opacity-70" : "opacity-40"
        }`}
    />
  );
}