'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

const defaultVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0 },
};

// Entry views get a "page lift" — a slightly longer spring that rises from
// below with a hair of scale, so opening a note feels like turning the page
// rather than swapping a screen.
const pageLiftVariants = {
    hidden: { opacity: 0, y: 18, scale: 0.985 },
    visible: { opacity: 1, y: 0, scale: 1 },
};

const isEntryViewRoute = (pathname: string | null) =>
    pathname?.startsWith('/entry/view') || pathname?.startsWith('/entry/edit');

export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const reducedMotion = useReducedMotion();
    const usePageLift = isEntryViewRoute(pathname);

    if (reducedMotion) {
        return <div>{children}</div>;
    }

    return (
        <motion.div
            key={pathname}
            variants={usePageLift ? pageLiftVariants : defaultVariants}
            initial="hidden"
            animate="visible"
            transition={
                usePageLift
                    ? { duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }
                    : { duration: 0.18, ease: 'easeOut' }
            }
        >
            {children}
        </motion.div>
    );
}
