'use client';

import { FiCheck } from 'react-icons/fi';

type JourneyStep = {
    label: string;
    done: boolean;
    hint: string;
};

export default function FirstWeekJourneyCard({ steps }: { steps: JourneyStep[] }) {
    const completeCount = steps.filter((step) => step.done).length;

    return (
        <section className="rounded-[1.25rem] border border-[rgba(216,199,232,0.28)] bg-[rgba(216,199,232,0.1)] p-3.5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="section-label">First week</p>
                    <h3 className="notebook-title mt-1 text-[1.02rem] leading-tight">Let Notive learn gently.</h3>
                </div>
                <span className="rounded-full border border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.42)] px-2 py-1 text-[0.62rem] font-semibold text-[rgb(107,107,107)]">
                    {completeCount}/{steps.length}
                </span>
            </div>
            <div className="mt-3 space-y-2">
                {steps.map((step) => (
                    <div key={step.label} className="flex items-start gap-2.5 rounded-[0.95rem] border border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.36)] px-3 py-2.5">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${step.done ? 'border-[rgba(138,154,111,0.45)] bg-[rgba(138,154,111,0.14)] text-[rgb(118,134,91)]' : 'border-[rgba(92,92,92,0.16)] text-[rgb(150,150,150)]'}`}>
                            {step.done ? <FiCheck size={12} aria-hidden="true" /> : null}
                        </span>
                        <div>
                            <p className="text-[0.76rem] font-semibold leading-5 text-[rgb(var(--paper-ink))]">{step.label}</p>
                            <p className="mt-0.5 text-[0.68rem] leading-5 text-[rgb(107,107,107)]">{step.hint}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
