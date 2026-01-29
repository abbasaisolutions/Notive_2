const postJson = async (url, payload, { timeoutMs = 10000 } = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
};

const findSimilarEntries = async (query, entries, { threshold = 0.03, topK = 5 } = {}) => {
    try {
        const url = 'http://localhost:8001/similarity';
        const payload = {
            user_id: "user_123",
            query,
            entries,
            threshold,
            top_k: topK,
        };

        const response = await postJson(url, payload, { timeoutMs: 10000 });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            console.error("HTTP Error:", response.status, errorBody);
            return [];
        }

        const data = await response.json();
        return data.relevant_entries ?? [];
    } catch (error) {
        if (error?.name === 'AbortError') {
            console.error("Request timed out (10s). Is the service reachable / overloaded?");
            return [];
        }
        console.error("Request failed.", error);
        return [];
    }
};

const debugSimilarityScores = async (query, entries, { threshold = 0.03, topK = 5 } = {}) => {
    try {
        const url = 'http://localhost:8001/similarity/debug';
        const payload = {
            user_id: "user_123",
            query,
            entries,
            threshold,
            top_k: topK,
        };

        const response = await postJson(url, payload, { timeoutMs: 10000 });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            console.error("HTTP Error (debug):", response.status, errorBody);
            return null;
        }

        return await response.json();
    } catch (error) {
        if (error?.name === 'AbortError') {
            console.error("Debug request timed out (10s).\n");
            return null;
        }
        console.error("Debug request failed.", error);
        return null;
    }
};

// --- WRAP THE CALL IN AN ASYNC BLOCK ---
const runSearch = async () => {
    const query = "my life is going great";
    const options = { threshold: 0.03, topK: 5 };
    const entries = [
        "Woke up early and went for a jog, feeling energized!",
        "Work was hectic, but I managed to finish all my tasks.",
        "Successfully fixed a bug in my project, proud moment!",
        "that day was tough but I pushed through and learned a lot. faced a lot",
        "Had a productive coding session, nailed it."
        // ... (rest of your entries)
    ];

    console.log("Searching...");
    const relevantEntries = await findSimilarEntries(query, entries, options);
    console.log("Relevant Entries:", relevantEntries);

    if (relevantEntries.length === 0) {
        console.log("No relevant entries returned. Showing debug scores (top 5):");
        const debug = await debugSimilarityScores(query, entries, options);
        if (debug?.scores?.length) {
            console.table(debug.scores.slice(0, 5));
        } else {
            console.log("(No debug scores returned)");
        }
    }
};

runSearch();