'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getRouteMeta, journeyStages } from '@/components/layout/nav-config';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import WorkspaceResumeCard from '@/components/layout/WorkspaceResumeCard';

export default function RouteHeader() {
    const pathname = usePathname();
    const routeMeta = getRouteMeta(pathname);

    if (!routeMeta) return null;

    const currentReturnTo = buildCurrentReturnTo(pathname, typeof window !== 'undefined' ? window.location.search : '');
    const currentStageIndex = journeyStages.findIndex((stage) => stage.id === routeMeta.journeyStage);
    const stageProgress = currentStageIndex < 0 ? 0 : ((currentStageIndex + 1) / journeyStages.length) * 100;
    const stageLabel = currentStageIndex >= 0 ? `${currentStageIndex + 1}/${journeyStages.length}` : null;

    return (
        <header className="px-4 pt-4 md:px-8 md:pt-6" aria-label="Page context">
            <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-surface-1/60 px-4 py-4 backdrop-blur-xl md:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <nav aria-label="Breadcrumb" className="min-w-0">
                        <ol className="flex items-center gap-1.5 text-xs text-ink-muted">
                            {routeMeta.breadcrumbs.map((crumb, index) => {
                                const isLast = index === routeMeta.breadcrumbs.length - 1;
                                return (
                                    <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5 min-w-0">
                                        {crumb.href && !isLast ? (
                                            <Link href={crumb.href} className="truncate hover:text-white transition-colors">
                                                {crumb.label}
                                            </Link>
                                        ) : (
                                            <span aria-current={isLast ? 'page' : undefined} className={`truncate ${isLast ? 'text-white font-semibold' : ''}`}>
                                                {crumb.label}
                                            </span>
                                        )}
                                        {!isLast && <span aria-hidden="true">/</span>}
                                    </li>
                                );
                            })}
                        </ol>
                    </nav>

                    <div className="flex items-center gap-2">
                        {routeMeta.secondaryAction && (
                            <Link
                                href={appendReturnTo(routeMeta.secondaryAction.href, currentReturnTo)}
                                className="px-3 py-2 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-secondary hover:text-white hover:bg-white/10 transition-colors"
                            >
                                {routeMeta.secondaryAction.shortLabel || routeMeta.secondaryAction.label}
                            </Link>
                        )}
                        {routeMeta.primaryAction && (
                            <Link
                                href={appendReturnTo(routeMeta.primaryAction.href, currentReturnTo)}
                                className="px-3 py-2 rounded-xl border border-primary/35 bg-primary/15 text-xs font-semibold uppercase tracking-[0.12em] text-primary hover:bg-primary/25 transition-colors"
                            >
                                {routeMeta.primaryAction.shortLabel || routeMeta.primaryAction.label}
                            </Link>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink-muted">
                            {routeMeta.section}
                            {stageLabel && (
                                <span className="rounded-full border border-white/15 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold tracking-[0.14em] text-ink-secondary">
                                    Stage {stageLabel}
                                </span>
                            )}
                        </div>
                        <h1 className="text-lg font-semibold text-white md:text-xl">{routeMeta.title}</h1>
                        <p className="mt-1 text-sm text-ink-secondary line-clamp-2">{routeMeta.description}</p>
                        {routeMeta.visibleInfo.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {routeMeta.visibleInfo.map((item) => (
                                    <span
                                        key={item}
                                        className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-xs uppercase tracking-[0.1em] text-ink-secondary"
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid w-full gap-3 xl:max-w-sm">
                        <section className="rounded-2xl border border-white/10 bg-surface-2/30 p-3" aria-label="Journey flow">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">Journey Flow</p>
                                <span className="text-xs uppercase tracking-[0.12em] text-ink-secondary">
                                    {journeyStages[currentStageIndex]?.label || 'Workspace'}
                                </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-secondary"
                                    style={{ width: `${stageProgress}%` }}
                                />
                            </div>
                            <ol className="mt-3 grid grid-cols-5 gap-1.5">
                                {journeyStages.map((stage, index) => {
                                    const isCurrent = index === currentStageIndex;
                                    const isCompleted = currentStageIndex >= 0 && index < currentStageIndex;
                                    return (
                                        <li key={stage.id}>
                                            <Link
                                                href={appendReturnTo(stage.href, currentReturnTo)}
                                                title={stage.description}
                                                className={`flex flex-col items-center gap-1 rounded-xl px-1.5 py-1.5 transition-colors ${isCurrent
                                                    ? 'bg-primary/15 text-white border border-primary/30'
                                                    : 'border border-transparent text-ink-secondary hover:bg-white/5 hover:text-white'
                                                    }`}
                                            >
                                                <span
                                                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isCurrent
                                                        ? 'bg-primary/25 text-primary'
                                                        : isCompleted
                                                            ? 'bg-primary/20 text-primary'
                                                            : 'bg-white/10 text-ink-muted'
                                                        }`}
                                                >
                                                    {isCompleted ? '✓' : index + 1}
                                                </span>
                                                <span className={`block text-xs font-semibold uppercase tracking-[0.08em] ${isCurrent ? 'text-white' : ''}`}>
                                                    {stage.label}
                                                </span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                        <WorkspaceResumeCard currentReturnTo={currentReturnTo} pathname={pathname} />
                    </div>
                </div>
            </div>
        </header>
    );
}

