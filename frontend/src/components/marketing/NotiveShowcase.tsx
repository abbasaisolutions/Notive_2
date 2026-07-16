import type { CSSProperties } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiArrowRight, FiBookOpen, FiLock, FiStar } from 'react-icons/fi';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { NOTIVE_VOICE } from '@/content/notive-voice';

type QuietNotebookHeroProps = {
    onPrimaryCtaClick?: () => void;
    onSecondaryCtaClick?: () => void;
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
    background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,251,245,0.66))',
    border: '1px solid rgba(92, 92, 92, 0.2)',
    boxShadow: '0 10px 26px rgba(92, 92, 92, 0.06)',
};

/**
 * Ruled-paper surface used wherever a marketing or auth screen wants a "page" to
 * write on. The ruling sits behind content at low contrast so ink-dark text on
 * top always clears WCAG AA — unlike a photographic backdrop, which cannot
 * guarantee contrast at an arbitrary crop.
 */
const paperSheetStyle: CSSProperties = {
    background: [
        'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,251,245,0.78))',
        'repeating-linear-gradient(0deg, transparent 0px, transparent 33px, rgba(92, 92, 92, 0.09) 33px, rgba(92, 92, 92, 0.09) 34px)',
    ].join(', '),
};

const heroTrustPoints = [
    { icon: FiLock, label: 'Private by default' },
    { icon: FiBookOpen, label: 'No public feed' },
    { icon: FiStar, label: 'Built for later use' },
];

export function QuietNotebookHero({
    onPrimaryCtaClick,
    onSecondaryCtaClick,
}: QuietNotebookHeroProps = {}) {
    return (
        <motion.section
            {...fadeUp}
            className="radius-ui-hero relative overflow-hidden border border-[rgba(122,112,98,0.2)]"
            style={{
                ...paperSheetStyle,
                boxShadow: '0 16px 32px rgba(92,92,92,0.1)',
            }}
        >
            <div className="relative flex min-h-[38rem] flex-col md:min-h-[40rem]">
                <div className="flex items-center justify-between px-5 py-5 md:px-10 md:py-7">
                    <NotiveLogo href="/" size="sm" />
                    <NotebookDoodle
                        name="sprout"
                        accent="sage"
                        className="sprout-accent h-10 w-10 opacity-90 md:h-12 md:w-12"
                    />
                </div>

                <div className="flex flex-1 items-center px-5 pb-9 pt-6 md:px-10 md:pb-14">
                    <div className="w-full max-w-2xl">
                        <p className="type-overline text-[rgb(126,117,103)]">
                            {NOTIVE_VOICE.home.showcaseEyebrow}
                        </p>

                        <h1 className="mt-4 text-[2.15rem] font-semibold leading-[1.06] tracking-[-0.02em] text-[rgb(39,35,31)] md:text-[3.4rem]">
                            {NOTIVE_VOICE.home.heroTitle}
                        </h1>

                        <p className="mt-5 max-w-xl text-base leading-8 text-[rgb(76,70,62)] md:text-lg">
                            {NOTIVE_VOICE.home.heroBody}
                        </p>

                        <div className="mt-7 flex flex-wrap gap-2">
                            {heroTrustPoints.map(({ icon: Icon, label }) => (
                                <span
                                    key={label}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(92,92,92,0.16)] bg-[rgba(248,244,237,0.86)] px-3 py-1.5 text-xs font-semibold text-[rgb(76,70,62)]"
                                >
                                    <Icon size={13} aria-hidden="true" />
                                    {label}
                                </span>
                            ))}
                        </div>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/register"
                                onClick={onPrimaryCtaClick}
                                className="radius-ui-lg inline-flex min-h-[3.25rem] items-center justify-center px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                                style={{
                                    background: 'rgb(var(--brand))',
                                    border: '1.5px solid rgba(122,112,98,0.34)',
                                    color: 'rgb(255,251,245)',
                                }}
                            >
                                {NOTIVE_VOICE.home.heroPrimaryCta}
                                <FiArrowRight className="ml-2" size={15} aria-hidden="true" />
                            </Link>
                            <Link
                                href="/login"
                                onClick={onSecondaryCtaClick}
                                className="radius-ui-lg inline-flex min-h-[3.25rem] items-center justify-center px-6 py-3 text-sm font-semibold text-[rgb(62,57,50)] transition-opacity hover:opacity-75"
                                style={{
                                    background: 'rgba(255,255,255,0.72)',
                                    border: '1.5px solid rgba(122,112,98,0.24)',
                                }}
                            >
                                {NOTIVE_VOICE.home.heroSecondaryCta}
                            </Link>
                        </div>

                        <p className="mt-5 text-xs leading-6 text-[rgb(126,117,103)]">
                            {NOTIVE_VOICE.home.heroCtaFootnote}
                        </p>
                    </div>
                </div>
            </div>
        </motion.section>
    );
}

/**
 * Side panel for the auth screens. Deliberately typographic: it carries the
 * page's promise in real, selectable text instead of a rendered mockup.
 */
export function QuietNotebookAuthIllustration({
    eyebrow,
    body,
    doodle = 'sprout',
}: {
    eyebrow: string;
    body: string;
    doodle?: 'sprout' | 'quill' | 'compass';
}) {
    return (
        <div
            className="quiet-panel radius-ui-hero relative hidden overflow-hidden p-6 lg:flex lg:flex-col lg:justify-between"
            style={paperSheetStyle}
        >
            <div className="relative">
                <p className="type-overline text-[rgb(126,117,103)]">
                    {eyebrow}
                </p>
                <p className="mt-4 max-w-sm text-base leading-8 text-[rgb(60,55,48)]">
                    {body}
                </p>
            </div>

            <div className="relative mt-8 flex items-end justify-between">
                <div className="max-w-[15rem]">
                    <p className="type-overline text-[rgb(126,117,103)]">
                        {NOTIVE_VOICE.auth.sideTitle}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[rgb(84,78,70)]">
                        {NOTIVE_VOICE.auth.sideBody}
                    </p>
                </div>
                <NotebookDoodle
                    name={doodle}
                    accent="sage"
                    className="sprout-accent h-16 w-16 shrink-0 opacity-85"
                />
            </div>
        </div>
    );
}
