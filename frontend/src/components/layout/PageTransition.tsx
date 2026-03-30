'use client';

import { motion } from 'framer-motion';

const variants = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0 },
};

export default function PageTransition({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            variants={variants}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.18, ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    );
}
