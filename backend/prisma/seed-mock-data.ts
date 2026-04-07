/// <reference types="node" />
// Mock Data Seed Script for Testing
// Run with: npx ts-node prisma/seed-mock-data.ts

import { PrismaClient, Category, EntrySource } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_EMAIL = 'mmalimehdi111@gmail.com';

// Helper to generate dates
function daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
}

function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Sample journal entries with varied moods and content
const mockEntries = [
    {
        title: "A Great Start to the New Year",
        content: "Today felt like a fresh beginning. Woke up early, went for a morning jog, and felt energized throughout the day. Had a productive meeting at work and finished the quarterly report ahead of schedule. Celebrated with a nice dinner with friends.",
        mood: "happy",
        tags: ["productivity", "exercise", "friends", "new-year"],
        category: Category.PERSONAL,
        daysAgo: 0
    },
    {
        title: "Deep Work Session",
        content: "Spent 4 hours in deep focus mode working on the new project architecture. No interruptions, just pure concentration. The design is coming together nicely. Feeling accomplished but mentally tired.",
        mood: "focused",
        tags: ["work", "programming", "deep-work"],
        category: Category.PROFESSIONAL,
        daysAgo: 1
    },
    {
        title: "Reflection on Goals",
        content: "Took some time today to review my annual goals. I've made good progress on fitness and reading, but need to work more on learning a new language. Setting up a schedule to practice Spanish 30 minutes daily.",
        mood: "thoughtful",
        tags: ["goals", "self-improvement", "reflection"],
        category: Category.PERSONAL,
        daysAgo: 2
    },
    {
        title: "Challenging Day at Work",
        content: "Had some difficult conversations today about project timelines. The client wants everything faster, but quality takes time. Feeling a bit stressed but handled it professionally. Need to decompress tonight.",
        mood: "stressed",
        tags: ["work", "challenges", "stress"],
        category: Category.PROFESSIONAL,
        daysAgo: 3
    },
    {
        title: "Weekend Hike Adventure",
        content: "Finally made it to the mountain trail! The view from the top was absolutely breathtaking. 12km hike with 800m elevation gain. My legs are sore but my soul is refreshed. Nature is the best therapy.",
        mood: "excited",
        tags: ["hiking", "nature", "weekend", "adventure"],
        category: Category.PERSONAL,
        daysAgo: 4
    },
    {
        title: "Learning React Native",
        content: "Started a new course on React Native for mobile development. The concepts are familiar from React, but there are some platform-specific quirks to learn. Built my first 'Hello World' app!",
        mood: "curious",
        tags: ["learning", "programming", "react-native"],
        category: Category.PROFESSIONAL,
        daysAgo: 5
    },
    {
        title: "Quiet Sunday",
        content: "A restful day at home. Read 100 pages of 'Atomic Habits', cooked a nice meal, and watched a documentary about space exploration. Sometimes doing nothing is exactly what you need.",
        mood: "calm",
        tags: ["rest", "reading", "weekend"],
        category: Category.PERSONAL,
        daysAgo: 6
    },
    {
        title: "Team Building Event",
        content: "Company organized a team building escape room event. Our team solved it in 45 minutes! Great bonding experience with colleagues I don't usually interact with. Feeling more connected to the team.",
        mood: "happy",
        tags: ["work", "team", "social"],
        category: Category.PROFESSIONAL,
        daysAgo: 7
    },
    {
        title: "Meditation Journey",
        content: "Completed a 20-minute meditation session this morning. Finding it easier to focus and let go of intrusive thoughts. The app says I've meditated for 30 days in a row now!",
        mood: "peaceful",
        tags: ["meditation", "mindfulness", "streak"],
        category: Category.PERSONAL,
        daysAgo: 8
    },
    {
        title: "Project Launch Success",
        content: "We launched the new feature today! Everything went smoothly, no critical bugs. Got positive feedback from the first users. Months of hard work finally paying off. Time to celebrate!",
        mood: "excited",
        tags: ["work", "launch", "success", "celebration"],
        category: Category.PROFESSIONAL,
        daysAgo: 9
    },
    {
        title: "Family Video Call",
        content: "Had a long video call with my parents and siblings. It's been months since we last talked properly. Made plans for a family gathering next month. Missing them a lot.",
        mood: "nostalgic",
        tags: ["family", "connection", "planning"],
        category: Category.PERSONAL,
        daysAgo: 10
    },
    {
        title: "Code Review Day",
        content: "Spent the entire day reviewing PRs and providing feedback. It's tedious but important work. Found a few security issues that could have been problematic. Team is improving!",
        mood: "focused",
        tags: ["work", "code-review", "security"],
        category: Category.PROFESSIONAL,
        daysAgo: 11
    },
    {
        title: "Gym Progress",
        content: "Hit a new personal record on deadlifts today - 150kg! Been working towards this for 6 months. Proper form, proper nutrition, consistency pays off. Feeling strong 💪",
        mood: "proud",
        tags: ["fitness", "gym", "personal-record"],
        category: Category.PERSONAL,
        daysAgo: 12
    },
    {
        title: "Rainy Day Blues",
        content: "Gloomy weather matching my mood today. Feeling a bit down for no particular reason. Tried to stay productive but energy was low. Sometimes it's okay to have an off day.",
        mood: "sad",
        tags: ["weather", "mood", "self-care"],
        category: Category.PERSONAL,
        daysAgo: 13
    },
    {
        title: "Mentoring Session",
        content: "Had a great mentoring session with a junior developer. Seeing their growth over the past months is rewarding. Teaching really solidifies your own understanding too.",
        mood: "grateful",
        tags: ["work", "mentoring", "growth"],
        category: Category.PROFESSIONAL,
        daysAgo: 14
    },
    {
        title: "Concert Night",
        content: "Went to see my favorite band live! The energy was incredible, sang along to every song. Music has this magical ability to make you forget all worries. What a night!",
        mood: "excited",
        tags: ["music", "concert", "entertainment"],
        category: Category.PERSONAL,
        daysAgo: 15
    },
    {
        title: "Strategic Planning Meeting",
        content: "Q2 planning session with leadership. Ambitious targets but realistic roadmap. My suggestions for the API redesign were well received. Feeling valued in the team.",
        mood: "confident",
        tags: ["work", "planning", "strategy"],
        category: Category.PROFESSIONAL,
        daysAgo: 16
    },
    {
        title: "Cooking Experiment",
        content: "Tried making homemade pasta for the first time. It took 3 hours and made a huge mess, but the result was delicious! There's something satisfying about making food from scratch.",
        mood: "happy",
        tags: ["cooking", "hobby", "food"],
        category: Category.PERSONAL,
        daysAgo: 17
    },
    {
        title: "Technical Interview",
        content: "Conducted two technical interviews today. One candidate was exceptional - rare to find that combination of skills and humility. Hope they accept our offer.",
        mood: "optimistic",
        tags: ["work", "hiring", "interviews"],
        category: Category.PROFESSIONAL,
        daysAgo: 18
    },
    {
        title: "Morning Routine Refined",
        content: "Finally found a morning routine that works: wake at 6, 10 min stretch, cold shower, journal, healthy breakfast. Day 5 of sticking to it. Energy levels are noticeably better.",
        mood: "energetic",
        tags: ["routine", "habits", "morning"],
        category: Category.PERSONAL,
        daysAgo: 19
    },
    {
        title: "Bug Hunt Success",
        content: "Tracked down that elusive memory leak that's been plaguing production for weeks. It was a subtle issue with event listener cleanup. Satisfying to finally squash it!",
        mood: "relieved",
        tags: ["work", "debugging", "programming"],
        category: Category.PROFESSIONAL,
        daysAgo: 20
    },
    {
        title: "Book Club Discussion",
        content: "Our book club met to discuss 'Thinking Fast and Slow'. Great insights about cognitive biases I wasn't aware of. The chapter on loss aversion really resonated with me.",
        mood: "curious",
        tags: ["reading", "book-club", "learning"],
        category: Category.PERSONAL,
        daysAgo: 21
    },
    {
        title: "Remote Work Challenges",
        content: "One of those days where Zoom fatigue hit hard. Back-to-back meetings, screen time through the roof. Need to set better boundaries for meeting-free time blocks.",
        mood: "tired",
        tags: ["work", "remote", "burnout-prevention"],
        category: Category.PROFESSIONAL,
        daysAgo: 22
    },
    {
        title: "Gratitude Practice",
        content: "Today I'm grateful for: 1) Good health 2) A job I enjoy 3) Friends who check in 4) Access to clean water 5) The ability to learn new things. Simple things matter most.",
        mood: "grateful",
        tags: ["gratitude", "mindfulness", "positivity"],
        category: Category.PERSONAL,
        daysAgo: 23
    },
    {
        title: "API Documentation Sprint",
        content: "Dedicated today to improving our API documentation. Not glamorous work, but future developers (including future me) will thank present me. Added 20 new examples.",
        mood: "productive",
        tags: ["work", "documentation", "quality"],
        category: Category.PROFESSIONAL,
        daysAgo: 24
    },
    {
        title: "Sunset Photography",
        content: "Caught an amazing sunset at the beach. The sky was painted in shades of orange and pink. Captured some great shots. Photography is such a mindful hobby.",
        mood: "peaceful",
        tags: ["photography", "nature", "sunset"],
        category: Category.PERSONAL,
        daysAgo: 25
    },
    {
        title: "Quarterly Review",
        content: "Got my performance review - exceeded expectations! Raise and bonus coming through. Hard work recognized. But more importantly, the feedback helps me know where to improve.",
        mood: "proud",
        tags: ["work", "career", "achievement"],
        category: Category.PROFESSIONAL,
        daysAgo: 26
    },
    {
        title: "Old Friend Reunion",
        content: "Met my college roommate after 5 years! We picked up right where we left off. True friendships don't fade with time or distance. Made plans to stay in touch better.",
        mood: "happy",
        tags: ["friendship", "reunion", "memories"],
        category: Category.PERSONAL,
        daysAgo: 27
    },
    {
        title: "System Design Session",
        content: "Led a system design session for the new microservices architecture. Whiteboarding with the team, considering trade-offs, planning for scale. This is the work I love most.",
        mood: "engaged",
        tags: ["work", "architecture", "design"],
        category: Category.PROFESSIONAL,
        daysAgo: 28
    },
    {
        title: "Monthly Review",
        content: "End of month review: completed 85% of planned tasks, exercised 20 days, read 3 books, saved 25% of income. Not perfect but progress is progress. Onto next month!",
        mood: "satisfied",
        tags: ["review", "goals", "progress"],
        category: Category.PERSONAL,
        daysAgo: 29
    }
];

// Generate health data for 30 days
function generateHealthData(userId: string) {
    const healthData = [];
    
    for (let i = 0; i < 30; i++) {
        const date = daysAgo(i);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        
        // Generate realistic variations
        const sleepBase = isWeekend ? 480 : 420; // More sleep on weekends
        const stepsBase = isWeekend ? 8000 : 6500;
        const activeBase = isWeekend ? 45 : 30;
        
        healthData.push({
            userId,
            date,
            sleepMinutes: sleepBase + randomBetween(-60, 90),
            sleepQuality: ['poor', 'fair', 'good', 'good', 'excellent'][randomBetween(0, 4)],
            steps: stepsBase + randomBetween(-2000, 4000),
            activeMinutes: activeBase + randomBetween(-15, 30),
            caloriesBurned: 1800 + randomBetween(200, 800),
            avgHeartRate: 72 + randomBetween(-8, 15),
            restingHeartRate: 58 + randomBetween(-4, 8),
            source: 'SELF_REPORT'
        });
    }
    
    return healthData;
}

// Generate health insights
function generateHealthInsights(userId: string) {
    return [
        {
            userId,
            type: 'sleep_mood',
            title: 'Sleep & Mood Correlation',
            description: 'Over the past month, your journal entries show a strong correlation between sleep quality and mood. Days with 7+ hours of sleep had 78% positive mood entries, compared to 42% on days with less sleep.',
            data: JSON.parse(JSON.stringify({
                correlation: 0.78,
                avgSleepGoodMood: 7.5,
                avgSleepBadMood: 5.8,
                dataPoints: 30
            })),
            period: 'month'
        },
        {
            userId,
            type: 'activity_mood',
            title: 'Exercise Boosts Your Mood',
            description: 'Your data shows that on days with 8000+ steps, you reported feeling "happy" or "energetic" 85% of the time. Consider maintaining your activity levels for better mental wellbeing.',
            data: JSON.parse(JSON.stringify({
                correlation: 0.72,
                avgStepsGoodMood: 9200,
                avgStepsBadMood: 4800,
                dataPoints: 30
            })),
            period: 'month'
        },
        {
            userId,
            type: 'pattern',
            title: 'Weekend Wellness Pattern',
            description: 'Your weekends show 25% more sleep and 40% more physical activity compared to weekdays. This extra rest seems to contribute to your more positive Monday entries.',
            data: JSON.parse(JSON.stringify({
                weekendSleepAvg: 8.2,
                weekdaySleepAvg: 6.5,
                weekendStepsAvg: 10500,
                weekdayStepsAvg: 7500
            })),
            period: 'week'
        },
        {
            userId,
            type: 'weekly_summary',
            title: 'This Week at a Glance',
            description: 'You averaged 7.2 hours of sleep, walked 52,000 steps total, and had 4 positive mood days. Your most productive day was Tuesday with 3 completed tasks mentioned in your journal.',
            data: JSON.parse(JSON.stringify({
                avgSleep: 7.2,
                totalSteps: 52000,
                positiveDays: 4,
                mostProductiveDay: 'Tuesday'
            })),
            period: 'week'
        },
        {
            userId,
            type: 'sleep_mood',
            title: 'Bedtime Consistency Matters',
            description: 'Entries written on days when you went to bed before 11 PM show higher energy levels and focus. Consider maintaining a consistent sleep schedule.',
            data: JSON.parse(JSON.stringify({
                earlyBedtimeMoodScore: 8.2,
                lateBedtimeMoodScore: 6.1,
                recommendation: 'Try to maintain a 10:30 PM bedtime'
            })),
            period: 'month'
        }
    ];
}

// Chapters for organizing entries
const chapters = [
    { name: 'Career Growth', description: 'Work achievements and professional development', color: '#6366f1', icon: '💼' },
    { name: 'Health & Fitness', description: 'Exercise, nutrition, and wellness journey', color: '#22c55e', icon: '🏃' },
    { name: 'Personal Growth', description: 'Self-improvement and learning', color: '#f59e0b', icon: '🌱' },
    { name: 'Relationships', description: 'Friends, family, and social connections', color: '#ec4899', icon: '❤️' },
    { name: 'Hobbies', description: 'Creative pursuits and leisure activities', color: '#06b6d4', icon: '🎨' }
];

async function main() {
    console.log('🌱 Starting mock data seed...\n');
    
    // Find the target user
    const user = await prisma.user.findUnique({
        where: { email: TARGET_EMAIL }
    });
    
    if (!user) {
        console.error(`❌ User with email ${TARGET_EMAIL} not found!`);
        console.log('Please make sure the user exists in the database.');
        process.exit(1);
    }
    
    // TypeScript doesn't recognize that process.exit() never returns,
    // so we use a const assertion to narrow the type
    const validUser = user!;
    
    console.log(`✅ Found user: ${validUser.name || validUser.email} (${validUser.id})\n`);
    
    // Clear existing mock data for this user
    console.log('🧹 Clearing existing data...');
    await prisma.healthInsight.deleteMany({ where: { userId: validUser.id } });
    await prisma.healthContext.deleteMany({ where: { userId: validUser.id } });
    await prisma.entry.deleteMany({ where: { userId: validUser.id } });
    await prisma.chapter.deleteMany({ where: { userId: validUser.id } });
    console.log('✅ Cleared existing data\n');
    
    // Create chapters
    console.log('📚 Creating chapters...');
    const createdChapters = await Promise.all(
        chapters.map(ch => 
            prisma.chapter.create({
                data: {
                    ...ch,
                    userId: validUser.id
                }
            })
        )
    );
    console.log(`✅ Created ${createdChapters.length} chapters\n`);
    
    // Create entries with chapter assignments
    console.log('📝 Creating journal entries...');
    const chapterMap: { [key: string]: string } = {
        'work': createdChapters[0].id,
        'programming': createdChapters[0].id,
        'career': createdChapters[0].id,
        'fitness': createdChapters[1].id,
        'gym': createdChapters[1].id,
        'hiking': createdChapters[1].id,
        'exercise': createdChapters[1].id,
        'meditation': createdChapters[1].id,
        'learning': createdChapters[2].id,
        'goals': createdChapters[2].id,
        'habits': createdChapters[2].id,
        'reading': createdChapters[2].id,
        'self-improvement': createdChapters[2].id,
        'family': createdChapters[3].id,
        'friends': createdChapters[3].id,
        'friendship': createdChapters[3].id,
        'social': createdChapters[3].id,
        'team': createdChapters[3].id,
        'music': createdChapters[4].id,
        'cooking': createdChapters[4].id,
        'photography': createdChapters[4].id,
        'hobby': createdChapters[4].id
    };
    
    for (const entry of mockEntries) {
        const createdAt = daysAgo(entry.daysAgo);
        
        // Find matching chapter
        let chapterId: string | null = null;
        for (const tag of entry.tags) {
            if (chapterMap[tag]) {
                chapterId = chapterMap[tag];
                break;
            }
        }
        
        await prisma.entry.create({
            data: {
                title: entry.title,
                content: entry.content,
                contentHtml: `<p>${entry.content}</p>`,
                mood: entry.mood,
                tags: entry.tags,
                category: entry.category,
                userId: validUser.id,
                chapterId,
                source: EntrySource.NOTIVE,
                createdAt,
                updatedAt: createdAt
            }
        });
    }
    console.log(`✅ Created ${mockEntries.length} journal entries\n`);
    
    // Create health context data
    console.log('💪 Creating health data...');
    const healthData = generateHealthData(validUser.id);
    for (const data of healthData) {
        await prisma.healthContext.create({ data });
    }
    console.log(`✅ Created ${healthData.length} days of health data\n`);
    
    // Create health insights
    console.log('🧠 Creating health insights...');
    const insights = generateHealthInsights(validUser.id);
    for (const insight of insights) {
        await prisma.healthInsight.create({ data: insight });
    }
    console.log(`✅ Created ${insights.length} health insights\n`);
    
    // Update user profile
    console.log('👤 Updating user profile...');
    await prisma.userProfile.upsert({
        where: { userId: validUser.id },
        create: {
            userId: validUser.id,
            bio: 'Software developer passionate about building great products and continuous learning. Love hiking, reading, and exploring new technologies.',
            location: 'San Francisco, CA',
            occupation: 'Senior Software Engineer',
            website: 'https://github.com',
            lifeGoals: ['Build meaningful products', 'Travel to 30 countries', 'Write a book', 'Learn 3 languages', 'Run a marathon']
        },
        update: {
            bio: 'Software developer passionate about building great products and continuous learning. Love hiking, reading, and exploring new technologies.',
            location: 'San Francisco, CA',
            occupation: 'Senior Software Engineer',
            website: 'https://github.com',
            lifeGoals: ['Build meaningful products', 'Travel to 30 countries', 'Write a book', 'Learn 3 languages', 'Run a marathon']
        }
    });
    console.log('✅ Updated user profile\n');
    
    // Summary
    console.log('=' .repeat(50));
    console.log('🎉 Mock data seeding complete!\n');
    console.log('Summary:');
    console.log(`  📚 Chapters: ${chapters.length}`);
    console.log(`  📝 Journal Entries: ${mockEntries.length}`);
    console.log(`  💪 Health Data Days: ${healthData.length}`);
    console.log(`  🧠 Health Insights: ${insights.length}`);
    console.log(`  👤 User Profile: Updated`);
    console.log('=' .repeat(50));
}

main()
    .catch((e) => {
        console.error('Error seeding mock data:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
