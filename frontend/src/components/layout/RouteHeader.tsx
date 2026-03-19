'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getRouteMeta } from '@/components/layout/nav-config';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import WorkspaceResumeCard from '@/components/layout/WorkspaceResumeCard';

export default function RouteHeader() {
    const pathname = usePathname();
    const routeMeta = getRouteMeta(pathname);

    if (!routeMeta || routeMeta.headerMode === 'none') return null;

    const currentReturnTo = buildCurrentReturnTo(pathname, typeof window !== 'undefined' ? window.location.search : '');

    return (
        <header className="px-4 pt-3 md:px-8 md:pt-4" aria-label="Page context">
            <div className="mx-auto max-w-6xl border-b border-white/8 px-1 pb-3 md:px-0 md:pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 flex-1">
                        <nav aria-label="Breadcrumb" className="min-w-0">
                        <ol className="flex items-center gap-1.5 text-[11px] text-ink-muted">
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
                        <div className="mt-2 min-w-0">
                            <h1 className="text-lg font-semibold text-white md:text-[1.35rem]">{routeMeta.title}</h1>
                            <p className="mt-1 text-sm text-ink-secondary line-clamp-1 md:line-clamp-2">{routeMeta.description}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {routeMeta.secondaryAction && (
                            <Link
                                href={appendReturnTo(routeMeta.secondaryAction.href, currentReturnTo)}
                                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.08]"
                            >
                                {routeMeta.secondaryAction.shortLabel || routeMeta.secondaryAction.label}
                            </Link>
                        )}
                        {routeMeta.primaryAction && (
                            <Link
                                href={appendReturnTo(routeMeta.primaryAction.href, currentReturnTo)}
                                className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/20"
                            >
                                {routeMeta.primaryAction.shortLabel || routeMeta.primaryAction.label}
                            </Link>
                        )}
                    </div>
                </div>

                {routeMeta.showResumeCard && (
                    <WorkspaceResumeCard currentReturnTo={currentReturnTo} pathname={pathname} className="mt-3 max-w-sm border-white/8 bg-white/[0.02]" />
                )}
            </div>
        </header>
    );
}

