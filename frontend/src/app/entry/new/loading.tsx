import Skeleton from '@/components/ui/SkeletonLoader';

export default function NewEntryLoading() {
    return (
        <div className="min-h-screen px-3 pb-24 pt-4 sm:px-4 md:pb-8 md:pt-8">
            <div className="mx-auto max-w-3xl">
                <div className="workspace-soft-panel mb-3 rounded-2xl px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-2xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-3 w-24 rounded-full" />
                                <Skeleton className="h-3 w-32 rounded-full" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-7 w-24 rounded-full" />
                            <Skeleton className="h-9 w-16 rounded-full" />
                        </div>
                    </div>
                </div>

                <div className="entry-paper entry-paper-shell entry-paper-ruled overflow-hidden rounded-[1.75rem]">
                    <Skeleton className="h-14 w-full rounded-none" />
                    <div className="space-y-4 px-5 py-6">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-11/12" />
                        <Skeleton className="h-5 w-4/5" />
                        <Skeleton className="mt-10 h-5 w-3/4" />
                        <Skeleton className="h-5 w-10/12" />
                        <Skeleton className="h-5 w-5/6" />
                    </div>
                </div>

                <div className="workspace-soft-panel mt-3 flex items-center justify-between rounded-2xl px-3 py-3">
                    <Skeleton className="h-8 w-24 rounded-xl" />
                    <Skeleton className="h-12 w-28 rounded-full" />
                </div>

                <div className="workspace-panel mt-6 rounded-2xl p-4">
                    <Skeleton className="h-3 w-28 rounded-full" />
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <Skeleton className="h-24 w-full rounded-2xl" />
                        <Skeleton className="h-24 w-full rounded-2xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}
