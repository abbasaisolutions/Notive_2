import type { CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiArrowRight, FiBookOpen, FiLock, FiSearch, FiStar } from 'react-icons/fi';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { NOTIVE_VOICE } from '@/content/notive-voice';

type StoryCard = {
    src: string;
    alt: string;
    caption: string;
    story: string;
};

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

export const storyCards: StoryCard[] = [
    {
        src: '/images/hero-1.jpg',
        alt: 'Teen capturing a real moment in Notive on a phone so the memory is saved while it is still fresh.',
        caption: 'Capture',
        story: 'Write or speak the moment before the details fade.',
    },
    {
        src: '/images/hero-2.jpg',
        alt: 'Teen reviewing a Notive story workspace that pulls lessons, skills, and evidence from saved notes.',
        caption: 'Notice',
        story: 'See the lesson, people, tags, and patterns without sorting every note yourself.',
    },
    {
        src: '/images/hero-3.jpg',
        alt: 'Teen revisiting an older diary entry in Notive after a new memory brings it back into focus.',
        caption: 'Use',
        story: 'Turn a saved memory into a story, summary, or proof of growth when it matters.',
    },
];

const heroTrustPoints = [
    { icon: FiLock, label: 'Private by default' },
    { icon: FiBookOpen, label: 'No public feed' },
    { icon: FiStar, label: 'Built for later use' },
];

const outcomeProofCards = [
    {
        eyebrow: 'From note',
        title: 'A messy thought can become a clear lesson.',
        body: 'Capture the real version first. Notive can help you pull out what changed, what mattered, and what you learned.',
    },
    {
        eyebrow: 'From pattern',
        title: 'Repeated moments can become useful signals.',
        body: 'When similar moods, people, or topics return, Notive helps make the pattern easier to see.',
    },
    {
        eyebrow: 'From memory',
        title: 'Saved experience can become story material.',
        body: 'Use your own evidence for applications, interviews, decisions, or the next honest conversation.',
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
            className="radius-ui-xl min-w-[17.5rem] snap-start p-3 md:min-w-0"
            style={quietNotebookPanelStyle}
        >
            <div className="radius-ui-lg relative overflow-hidden border border-[rgba(92,92,92,0.18)] bg-[rgba(248,244,237,0.92)]">
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
                <p className="type-overline text-[rgb(126,117,103)]">
                    {caption}
                </p>
                <p className="mt-2 text-sm leading-7 text-[rgb(75,69,61)]">
                    {story}
                </p>
            </div>
        </article>
    );
}

export function QuietNotebookHero({
    onPrimaryCtaClick,
    onSecondaryCtaClick,
}: QuietNotebookHeroProps = {}) {
    return (
        <motion.section
            {...fadeUp}
            className="radius-ui-hero relative overflow-hidden border border-[rgba(122,112,98,0.2)]"
            style={{
                boxShadow: '0 16px 32px rgba(92,92,92,0.1)',
            }}
        >
            <div className="relative min-h-[72svh] md:min-h-[42rem]">
                <Image
                    src={storyCards[0].src}
                    alt={storyCards[0].alt}
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(28,25,22,0.08),rgba(28,25,22,0.62))]" />
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

                <div className="relative z-10 flex min-h-[72svh] items-end px-4 pb-8 pt-28 md:min-h-[42rem] md:px-10 md:pb-12 md:pt-32">
                    <div
                        className="w-full max-w-3xl p-1 md:p-0"
                        style={{
                            textShadow: '0 1px 16px rgba(0,0,0,0.24)',
                        }}
                    >
                        <h1 className="max-w-2xl text-[2rem] font-semibold leading-[1.08] tracking-normal text-white md:text-[3.55rem]">
                            {NOTIVE_VOICE.home.heroTitle}
                        </h1>
                        <p className="mt-4 max-w-xl text-sm leading-7 text-[rgba(255,251,245,0.92)] md:text-base">
                            {NOTIVE_VOICE.home.heroBody}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            {heroTrustPoints.map(({ icon: Icon, label }) => (
                                <span
                                    key={label}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/18 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md"
                                >
                                    <Icon size={13} aria-hidden="true" />
                                    {label}
                                </span>
                            ))}
                        </div>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/register"
                                onClick={onPrimaryCtaClick}
                                className="radius-ui-lg inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-[rgb(34,32,29)] transition-transform hover:-translate-y-0.5"
                                style={{
                                    background: 'rgb(138, 154, 111)',
                                    border: '1.5px solid rgba(255,251,245,0.62)',
                                    color: 'rgb(255,251,245)',
                                }}
                            >
                                {NOTIVE_VOICE.home.heroPrimaryCta}
                                <FiArrowRight className="ml-2" size={15} aria-hidden="true" />
                            </Link>
                            <Link
                                href="/login"
                                onClick={onSecondaryCtaClick}
                                className="radius-ui-lg inline-flex items-center justify-center px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-80"
                                style={{
                                    background: 'rgba(255,255,255,0.16)',
                                    border: '1.5px solid rgba(255,255,255,0.28)',
                                    backdropFilter: 'blur(10px)',
                                }}
                            >
                                {NOTIVE_VOICE.home.heroSecondaryCta}
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
        <motion.section {...fadeUp} className="quiet-panel radius-ui-hero mt-8 px-4 py-8 md:mt-10 md:px-6 md:py-10">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="type-overline text-[rgb(126,117,103)]">
                        {NOTIVE_VOICE.home.showcaseEyebrow}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[rgb(39,35,31)] md:text-[2.35rem]">
                        {NOTIVE_VOICE.home.showcaseTitle}
                    </h2>
                </div>
                <p className="max-w-xl text-sm leading-7 text-[rgb(84,78,70)]">
                    {NOTIVE_VOICE.home.showcaseBody}
                </p>
            </div>

            <div className="mt-8 flex snap-x gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
                {storyCards.map((card, index) => (
                    <QuietNotebookCard key={card.src} {...card} priority={index === 0} />
                ))}
            </div>
        </motion.section>
    );
}

export function OutcomeProofSection() {
    return (
        <motion.section
            {...fadeUp}
            className="quiet-panel radius-ui-hero mt-8 px-4 py-8 md:mt-10 md:px-6 md:py-10"
        >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="type-overline text-[rgb(126,117,103)]">
                        Why it matters
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-normal text-[rgb(39,35,31)] md:text-[2.35rem]">
                        The payoff is usable language from real life.
                    </h2>
                </div>
                <p className="max-w-xl text-sm leading-7 text-[rgb(84,78,70)]">
                    Notive helps the raw moment become something you can understand, return to, and use when the situation asks for words.
                </p>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
                {outcomeProofCards.map((card, index) => (
                    <article
                        key={card.eyebrow}
                        className="radius-ui-lg border border-[rgba(92,92,92,0.16)] bg-[rgba(255,255,255,0.5)] p-4"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="type-overline text-[rgb(126,117,103)]">
                                {card.eyebrow}
                            </p>
                            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(92,92,92,0.14)] bg-[rgba(248,244,237,0.9)] text-[rgb(138,154,111)]">
                                {index === 0 ? <FiBookOpen size={16} aria-hidden="true" /> : index === 1 ? <FiSearch size={16} aria-hidden="true" /> : <FiStar size={16} aria-hidden="true" />}
                            </span>
                        </div>
                        <h3 className="mt-4 text-xl font-semibold leading-[1.18] tracking-normal text-[rgb(39,35,31)]">
                            {card.title}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-[rgb(76,70,62)]">
                            {card.body}
                        </p>
                    </article>
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
            className="quiet-panel radius-ui-hero hidden lg:flex lg:flex-col lg:justify-between p-5"
        >
            <div>
                <p className="type-overline text-[rgb(126,117,103)]">
                    {eyebrow}
                </p>
                <p className="mt-3 max-w-sm text-sm leading-7 text-[rgb(76,70,62)]">
                    {body}
                </p>
            </div>
            <div className="radius-ui-xl mt-6 overflow-hidden border border-[rgba(92,92,92,0.18)]">
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
