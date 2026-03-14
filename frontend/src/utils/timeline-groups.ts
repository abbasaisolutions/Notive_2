type TimelineEntryLike = {
    createdAt: string;
};

export type TimelineMonthGroup<T extends TimelineEntryLike> = {
    key: string;
    label: string;
    year: string;
    anchorId: string;
    count: number;
    entries: Array<T & { timelineIndex: number }>;
};

export const buildTimelineMonthKey = (value: Date | string) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const buildTimelineMonthGroups = <T extends TimelineEntryLike>(
    entries: T[]
): Array<TimelineMonthGroup<T>> => {
    const sortedEntries = [...entries].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const groups: Array<TimelineMonthGroup<T>> = [];

    sortedEntries.forEach((entry, timelineIndex) => {
        const date = new Date(entry.createdAt);
        const key = buildTimelineMonthKey(date);
        const label = date.toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric',
        });
        const year = String(date.getFullYear());
        const existingGroup = groups[groups.length - 1];

        if (!existingGroup || existingGroup.key !== key) {
            groups.push({
                key,
                label,
                year,
                anchorId: `timeline-month-${key}`,
                count: 1,
                entries: [{ ...entry, timelineIndex }],
            });
            return;
        }

        existingGroup.entries.push({ ...entry, timelineIndex });
        existingGroup.count += 1;
    });

    return groups;
};
