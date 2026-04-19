import Skeleton from '@/components/ui/SkeletonLoader';

export default function ProfileLoading() {
    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-3xl space-y-6">
                <section className="workspace-panel rounded-[2rem] p-6 md:p-8">
                    <div className="flex items-center gap-5">
                        <Skeleton className="h-20 w-20 rounded-[1.5rem]" />
                        <div className="min-w-0 flex-1 space-y-3">
                            <Skeleton className="h-7 w-40" />
                            <Skeleton className="h-4 w-52" />
                            <Skeleton className="h-4 w-44" />
                        </div>
                        <Skeleton className="h-10 w-10 rounded-xl" />
                    </div>
                    <Skeleton className="mt-5 h-2 w-full rounded-full" />
                    <div className="mt-5 flex gap-2">
                        <Skeleton className="h-10 w-24 rounded-xl" />
                        <Skeleton className="h-10 w-32 rounded-xl" />
                    </div>
                </section>

                <section className="workspace-panel rounded-[2rem] p-6">
                    <Skeleton className="h-6 w-28" />
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Skeleton className="h-24 w-full rounded-2xl" />
                        <Skeleton className="h-24 w-full rounded-2xl" />
                        <Skeleton className="h-24 w-full rounded-2xl" />
                        <Skeleton className="h-24 w-full rounded-2xl" />
                    </div>
                </section>

                <section className="workspace-panel rounded-[2rem] p-6">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="mt-3 h-4 w-11/12" />
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Skeleton className="h-8 w-28 rounded-full" />
                        <Skeleton className="h-8 w-32 rounded-full" />
                        <Skeleton className="h-8 w-24 rounded-full" />
                    </div>
                </section>

                <section className="workspace-panel rounded-[2rem] p-6">
                    <Skeleton className="h-6 w-24" />
                    <div className="mt-4 space-y-3">
                        <Skeleton className="h-14 w-full rounded-2xl" />
                        <Skeleton className="h-14 w-full rounded-2xl" />
                        <Skeleton className="h-14 w-full rounded-2xl" />
                    </div>
                </section>
            </div>
        </div>
    );
}
