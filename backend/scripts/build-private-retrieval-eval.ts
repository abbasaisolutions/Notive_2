import fs from 'fs';
import path from 'path';

import prisma from '../src/config/prisma';

type EntryRecord = {
    id: string;
    title: string | null;
    content: string;
    tags: string[];
    mood: string | null;
    createdAt: Date;
};

type QuerySelector = {
    titleIncludes?: string;
    contentIncludes?: string;
    tagsAny?: string[];
    mood?: string | null;
    limit?: number;
};

type QuerySpec = {
    id: string;
    text: string;
    selectors: QuerySelector[];
};

const DEFAULT_OUTPUT_PATH = path.resolve(
    process.cwd(),
    '../similarity-service/eval/private/notive_retrieval.current.json'
);

const QUERY_SPECS: QuerySpec[] = [
    {
        id: 'q_happy_worried_work',
        text: 'feeling happy and worried about work at the same time',
        selectors: [{ titleIncludes: 'I Am Happy but Same Time Worry' }],
    },
    {
        id: 'q_ramadan_eid',
        text: 'writing about Ramadan fasting and looking forward to Eid on Friday',
        selectors: [{ titleIncludes: 'Ramadan' }],
    },
    {
        id: 'q_waited_months_for_good_news',
        text: 'great news after waiting for months and feeling relieved it was worth it',
        selectors: [{ titleIncludes: 'Great News On FRiday' }],
    },
    {
        id: 'q_probabilistic_model_direction',
        text: 'thinking through a probabilistic model to choose the next direction',
        selectors: [{ titleIncludes: 'Random Position' }],
    },
    {
        id: 'q_life_is_a_test',
        text: 'life is a test and I need strength for the challenges ahead',
        selectors: [{ titleIncludes: 'That Life Is a Test' }],
    },
    {
        id: 'q_preserve_today_conversation',
        text: 'what conversation or experience today deserves to be preserved',
        selectors: [{ titleIncludes: 'What Conversation or Experience Today Deserves' }],
    },
    {
        id: 'q_predict_from_historical_data',
        text: 'build a model from historical data and predict correctly',
        selectors: [{ contentIncludes: 'historical data' }],
    },
    {
        id: 'q_tune_model_better',
        text: 'trying to tune a model even better and understand it with a friend',
        selectors: [{ titleIncludes: 'Because We Just Said That This Is Doing' }],
    },
    {
        id: 'q_teaching_nephews_ai',
        text: 'teaching my nephews a quick introduction to artificial intelligence',
        selectors: [{ contentIncludes: 'artificial intelligence introduction' }],
    },
    {
        id: 'q_second_ramadan_reflection',
        text: 'second day of Ramadan and feeling good after coming back from iftar',
        selectors: [{ titleIncludes: 'Second Ramadan' }],
    },
    {
        id: 'q_grateful_sunset',
        text: 'feeling grateful while reflecting on a beautiful sunset in nature',
        selectors: [{ titleIncludes: 'beautiful sunset' }],
    },
    {
        id: 'q_japan_travel_goals',
        text: 'planning a trip to Japan and setting travel goals',
        selectors: [{ titleIncludes: 'trip to Japan' }],
    },
    {
        id: 'q_coffee_coding_focus',
        text: 'coffee and coding with a strong work focus',
        selectors: [{ titleIncludes: 'Coffee and coding' }],
    },
    {
        id: 'q_friends_park',
        text: 'having a great time with friends at the park',
        selectors: [{ titleIncludes: 'friends at the park' }],
    },
    {
        id: 'q_hiking_fresh_air',
        text: 'hiking in the mountains and enjoying the fresh air',
        selectors: [{ titleIncludes: 'Hiking the mountains' }],
    },
    {
        id: 'q_gym_study_prayer',
        text: 'planning gym study and prayers across the day',
        selectors: [{ titleIncludes: "Ready To Go To Gym" }],
    },
    {
        id: 'q_morning_work_homework',
        text: 'a good morning with work homework and study still ahead',
        selectors: [{ titleIncludes: 'My Morning Is Great' }],
    },
    {
        id: 'q_hectic_day_excited_weekend',
        text: 'a hectic work day while still feeling excited for the weekend',
        selectors: [{ titleIncludes: 'This Morning Is Absolutely Fantastic' }],
    },
    {
        id: 'q_growth_and_learning_memory',
        text: 'reflecting on an old memory that was a time of growth and learning',
        selectors: [{ contentIncludes: 'growth and learning', limit: 6 }],
    },
    {
        id: 'q_throwback_friends_vibes',
        text: 'amazing vibes with friends in an instagram throwback memory',
        selectors: [{ contentIncludes: 'Amazing vibes with friends', limit: 6 }],
    },
    {
        id: 'q_beach_break_after_loss',
        text: 'a beach day with family after a death in the family helped me find peace',
        selectors: [{ contentIncludes: 'uncle death' }],
    },
    {
        id: 'q_temporary_life_and_mechanic',
        text: 'a boring temporary life and errands at the mechanic shop to replace a battery',
        selectors: [
            { titleIncludes: 'Temporary' },
            { contentIncludes: 'mechanic shop' },
        ],
    },
    {
        id: 'q_gym_but_depressed_after_yesterday',
        text: 'feeling fresh for the gym but still depressed about what happened yesterday',
        selectors: [{ contentIncludes: "ready to go for gym" }],
    },
    {
        id: 'q_life_without_bike_or_job',
        text: 'life feels depressing without a bike or a job',
        selectors: [{ contentIncludes: 'without bike' }],
    },
    {
        id: 'q_story_of_my_life',
        text: 'a sad note about the story of my life',
        selectors: [{ contentIncludes: 'Story of my life' }],
    },
];

const getArgValue = (flag: string): string | null => {
    const index = process.argv.indexOf(flag);
    if (index === -1) return null;
    const value = process.argv[index + 1];
    return value && !value.startsWith('--') ? value : null;
};

const normalize = (value: string | null | undefined): string =>
    (value || '').toLowerCase();

const matchesSelector = (entry: EntryRecord, selector: QuerySelector): boolean => {
    const title = normalize(entry.title);
    const content = normalize(entry.content);
    const tags = (entry.tags || []).map((tag) => normalize(tag));
    const mood = normalize(entry.mood);

    if (selector.titleIncludes && !title.includes(normalize(selector.titleIncludes))) {
        return false;
    }

    if (selector.contentIncludes && !content.includes(normalize(selector.contentIncludes))) {
        return false;
    }

    if (selector.tagsAny && selector.tagsAny.length > 0) {
        const wanted = selector.tagsAny.map((tag) => normalize(tag));
        if (!wanted.some((tag) => tags.includes(tag))) {
            return false;
        }
    }

    if (selector.mood !== undefined && selector.mood !== null && mood !== normalize(selector.mood)) {
        return false;
    }

    return true;
};

const resolveRelevantIds = (entries: EntryRecord[], selectors: QuerySelector[]): string[] => {
    const relevant = new Set<string>();

    selectors.forEach((selector) => {
        const matches = entries
            .filter((entry) => matchesSelector(entry, selector))
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
            .slice(0, selector.limit || entries.length);

        matches.forEach((entry) => relevant.add(entry.id));
    });

    return [...relevant];
};

const pickDefaultUserId = async (): Promise<string> => {
    const grouped = await prisma.entry.groupBy({
        by: ['userId'],
        _count: { _all: true },
        where: { deletedAt: null },
        orderBy: {
            _count: {
                userId: 'desc',
            },
        },
    });

    const fallback = grouped[0]?.userId;
    if (!fallback) {
        throw new Error('No journal entries found. Create a few entries before building a private eval dataset.');
    }

    return fallback;
};

async function main() {
    const userId = getArgValue('--user') || await pickDefaultUserId();
    const outputPath = path.resolve(getArgValue('--output') || DEFAULT_OUTPUT_PATH);

    const entries = await prisma.entry.findMany({
        where: {
            userId,
            deletedAt: null,
        },
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            id: true,
            title: true,
            content: true,
            tags: true,
            mood: true,
            createdAt: true,
        },
    });

    const queries = QUERY_SPECS.map((spec) => ({
        id: spec.id,
        text: spec.text,
        relevant: resolveRelevantIds(entries, spec.selectors),
    })).filter((query) => query.relevant.length > 0);

    const dataset = {
        meta: {
            userId,
            generatedAt: new Date().toISOString(),
            entryCount: entries.length,
            queryCount: queries.length,
        },
        entries: entries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            text: entry.content,
        })),
        queries,
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2), 'utf8');

    const skipped = QUERY_SPECS.length - queries.length;
    console.log(`Saved private retrieval dataset: ${outputPath}`);
    console.log(`- userId: ${userId}`);
    console.log(`- entries: ${entries.length}`);
    console.log(`- queries: ${queries.length}`);
    console.log(`- skipped queries: ${skipped}`);
}

main()
    .catch(async (error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
