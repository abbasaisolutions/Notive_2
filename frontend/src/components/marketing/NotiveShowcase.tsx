import type { CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import NotiveLogo from '@/components/ui/NotiveLogo';

type StoryCard = {
    src: string;
    alt: string;
    caption: string;
    story: string;
};

const fadeUp = {
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.5, ease: 'easeOut' },
} as const;

export const quietNotebookPageStyle: CSSProperties = {
    backgroundColor: 'rgb(var(--paper-bg))',
    backgroundImage: [
        'radial-gradient(circle at 16% 20%, rgba(138, 154, 111, 0.08), transparent 34%)',
        'radial-gradient(circle at 84% 12%, rgba(237, 228, 216, 0.42), transparent 28%)',
        'linear-gradient(180deg, rgba(255,255,255,0.46), rgba(255,255,255,0.18))',
        'repeating-linear-gradient(0deg, rgba(92, 92, 92, 0.02) 0px, rgba(92, 92, 92, 0.02) 1px, transparent 1px, transparent 22px)',
        'repeating-linear-gradient(90deg, rgba(92, 92, 92, 0.014) 0px, rgba(92, 92, 92, 0.014) 1px, transparent 1px, transparent 26px)',
    ].join(', '),
};

export const quietNotebookPanelStyle: CSSProperties = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,251,245,0.74))',
    border: '2px solid rgba(92, 92, 92, 0.92)',
    boxShadow: '0 4px 12px rgba(92, 92, 92, 0.08)',
};

export const storyCards: StoryCard[] = [
    {
        src: '/images/hero-1.jpg',
        alt: 'Teen reading a Notive action brief on a phone after feeling overwhelmed, using one short counselor message as the next calm step.',
        caption: 'Action Brief',
        story: 'He usually feels steadier after reaching out, so Notive turns the moment into one short message to a counselor instead of another hour of looping.',
    },
    {
        src: '/images/hero-2.jpg',
        alt: 'Teen reviewing a Notive strength, evidence, and readiness table that turns journal notes into clearer college essay material.',
        caption: 'Strength / Evidence / Readiness States',
        story: 'Her notes already show self-advocacy and resilience. Notive gathers the evidence and points to a calmer college-essay direction she can actually use.',
    },
    {
        src: '/images/hero-3.jpg',
        alt: 'Teen using Notive to choose a trusted friend after a messy group chat and sending one honest text after school.',
        caption: 'Why this person',
        story: 'After a messy group chat, Notive points her back to the friend who has been steady before and drafts the first honest text instead of a perfect one.',
    },
    {
        src: '/images/hero-4.jpg',
        alt: 'Teen seeing a Notive adaptive focus card that suggests one small task and a quick capture when the week feels heavier.',
        caption: 'Adaptive Focus Card',
        story: 'When the week feels heavier, Notive does not flood the screen. It suggests one small task, quick capture, then continue when there is room.',
    },
    {
        src: '/images/hero-5.jpg',
        alt: 'Teen checking Notive on a phone and keeping one calm next step as a gentle action after a full day.',
        caption: 'One calm next step',
        story: 'She does not need a whole plan tonight. Notive helps her keep one calm next step and the part of the day that is still worth carrying forward.',
    },
];

function QuietNotebookCard({
    src,
    alt,
    caption,
    story,
    priority = false,
}: StoryCard & { priority?: boolean }) {
    return (
        <article
            className="min-w-[17.5rem] snap-start rounded-[1.85rem] p-3 md:min-w-0"
            style={quietNotebookPanelStyle}
        >
            <div className="relative overflow-hidden rounded-[1.35rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(248,244,237,0.92)]">
                <Image
                    src={src}
                    alt={alt}
                    width={640}
                    height={860}
                    priority={priority}
                    className="h-[18rem] w-full object-cover md:h-[15rem] lg:h-[14rem]"
                    sizes="(max-width: 767px) 78vw, (max-width: 1279px) 42vw, 20vw"
                />
            </div>
            <div className="px-1 pb-1 pt-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[rgb(126,117,103)]">
                    {caption}
                </p>
                <p className="mt-2 text-sm leading-7 text-[rgb(75,69,61)]">
                    {story}
                </p>
            </div>
        </article>
    );
}

export function QuietNotebookHero() {
    return (
        <motion.section
            {...fadeUp}
            className="relative overflow-hidden rounded-[2.2rem] border border-[rgba(122,112,98,0.2)]"
            style={{
                boxShadow: '0 16px 32px rgba(92,92,92,0.1)',
            }}
        >
            <div className="relative min-h-[74svh] md:min-h-[44rem]">
                <Image
                    src={storyCards[0].src}
                    alt={storyCards[0].alt}
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(58,58,58,0.14),rgba(58,58,58,0.56))]" />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-5 md:px-8 md:py-7">
                    <div
                        className="rounded-[1.2rem] px-3 py-1.5"
                        style={{
                            background: 'rgba(255,251,245,0.84)',
                            border: '1.5px solid rgba(92,92,92,0.18)',
                            backdropFilter: 'blur(8px)',
                        }}
                    >
                        <NotiveLogo href="/" size="xs" />
                    </div>
                    <NotebookDoodle name="sprout" accent="sage" className="h-10 w-10 sprout-accent opacity-95 md:h-12 md:w-12" />
                </div>

                <div className="relative z-10 flex min-h-[74svh] items-end px-4 pb-4 pt-28 md:min-h-[44rem] md:px-8 md:pb-8 md:pt-32">
                    <div
                        className="w-full max-w-3xl rounded-[1.9rem] p-5 md:p-8"
                        style={{
                            background: 'rgba(255,251,245,0.8)',
                            border: '2px solid rgba(92,92,92,0.18)',
                            backdropFilter: 'blur(12px)',
                        }}
                    >
                        <h1 className="max-w-2xl text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-[rgb(38,34,30)] md:text-[3.55rem]">
                            Drop what happened. See one calm next step. Keep the part that helps you grow.
                        </h1>
                        <p className="mt-4 max-w-xl text-sm leading-7 text-[rgb(76,70,62)] md:text-base">
                            Notive is a quiet notebook for real moments, one useful reflection, and the next move you can actually make.
                        </p>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/register"
                                className="inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 text-sm font-semibold text-[rgb(34,32,29)] transition-transform hover:-translate-y-0.5"
                                style={{
                                    background: 'rgb(138, 154, 111)',
                                    border: '2px solid rgba(92,92,92,0.84)',
                                    color: 'rgb(255,251,245)',
                                }}
                            >
                                Start with one note
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 text-sm font-medium text-[rgb(62,57,50)] transition-opacity hover:opacity-80"
                                style={{
                                    background: 'rgba(255,255,255,0.72)',
                                    border: '1.5px solid rgba(92,92,92,0.2)',
                                }}
                            >
                                Sign in
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </motion.section>
    );
}

export function RealStudentsRealMoves() {
    return (
        <motion.section {...fadeUp} className="mt-8 rounded-[2rem] px-4 py-8 md:mt-10 md:px-6 md:py-10" style={quietNotebookPanelStyle}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[rgb(126,117,103)]">
                        Real students, real moves
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[rgb(39,35,31)] md:text-[2.35rem]">
                        Five quiet ways Notive helps a hard moment become a clearer next step.
                    </h2>
                </div>
                <p className="max-w-xl text-sm leading-7 text-[rgb(84,78,70)]">
                    These are not hype stories. They are ordinary school-day moments where one calmer prompt, message, or story seed changes what happens next.
                </p>
            </div>

            <div className="mt-8 flex snap-x gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-5">
                {storyCards.map((card, index) => (
                    <QuietNotebookCard key={card.src} {...card} priority={index === 0} />
                ))}
            </div>
        </motion.section>
    );
}

export function QuietNotebookAuthIllustration({
    src,
    alt,
    eyebrow,
    body,
}: {
    src: string;
    alt: string;
    eyebrow: string;
    body: string;
}) {
    return (
        <div
            className="hidden lg:flex lg:flex-col lg:justify-between rounded-[2rem] p-5"
            style={quietNotebookPanelStyle}
        >
            <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[rgb(126,117,103)]">
                    {eyebrow}
                </p>
                <p className="mt-3 max-w-sm text-sm leading-7 text-[rgb(76,70,62)]">
                    {body}
                </p>
            </div>
            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[rgba(92,92,92,0.18)]">
                <Image
                    src={src}
                    alt={alt}
                    width={760}
                    height={1040}
                    className="h-[28rem] w-full object-cover object-center opacity-90"
                    sizes="(min-width: 1024px) 34vw, 100vw"
                />
            </div>
        </div>
    );
}
