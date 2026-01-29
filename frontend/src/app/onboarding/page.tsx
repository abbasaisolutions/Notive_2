'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Camera, Sprout, Zap, Sparkles } from 'lucide-react';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { Button } from '@/components/ui/form-elements';

const GOALS = [
    { id: 'clarity', icon: Brain, label: 'Mental Clarity', desc: 'Clear my mind and organize thoughts' },
    { id: 'memory', icon: Camera, label: 'Memory Keeping', desc: 'Preserve moments and milestones' },
    { id: 'growth', icon: Sprout, label: 'Personal Growth', desc: 'Track progress and build habits' },
    { id: 'productivity', icon: Zap, label: 'Productivity', desc: 'Plan days and review achievements' },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
    const [name, setName] = useState('');

    const handleNext = () => {
        if (step === 2) {
            // Complete onboarding
            // In a real app, save preferences to backend
            localStorage.setItem('hasOnboarded', 'true');
            router.push('/dashboard');
        } else {
            setStep(step + 1);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-2xl relative z-10">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl"
                        >
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 text-center">
                                What brings you to <span className="text-primary">Notive</span>?
                            </h1>
                            <p className="text-slate-400 text-center mb-8">
                                Select your primary focus to personalize your experience.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {GOALS.map((goal) => (
                                    <button
                                        key={goal.id}
                                        onClick={() => setSelectedGoal(goal.id)}
                                        className={`p-6 rounded-2xl border text-left transition-all group ${selectedGoal === goal.id
                                            ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10'
                                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                            }`}
                                    >
                                        <span className="text-3xl mb-3 block">
                                            <goal.icon className="w-8 h-8 text-white" />
                                        </span>
                                        <h3 className={`font-bold mb-1 ${selectedGoal === goal.id ? 'text-white' : 'text-slate-200'}`}>
                                            {goal.label}
                                        </h3>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            {goal.desc}
                                        </p>
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    onClick={handleNext}
                                    disabled={!selectedGoal}
                                    className="px-8"
                                >
                                    Continue
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl text-center"
                        >
                            <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Sparkles className="w-9 h-9" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                You're all set!
                            </h1>
                            <p className="text-slate-400 mb-8 max-w-md mx-auto">
                                Notive uses AI to help you capture your life, understand your emotions, and grow every day. Let's make your first entry.
                            </p>

                            <Button onClick={handleNext} className="w-full max-w-xs">
                                Start Your Journey
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Progress Indicators */}
                <div className="flex justify-center gap-2 mt-8">
                    {[1, 2].map((i) => (
                        <div
                            key={i}
                            className={`h-1 rounded-full transition-all duration-300 ${step >= i ? 'w-8 bg-primary' : 'w-2 bg-slate-700'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
