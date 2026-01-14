/**
 * TriviaBot - A Jeopardy! trivia bot with 370k+ questions
 */

const fs = require("fs")
const Database = require("better-sqlite3")
const { checkAnswer } = require("./normalizer")

// Field separator used in the Anki database
const FIELD_SEP = "\x1f"

/**
 * Parse the flds column from the notes table
 * Fields: showNumber, airDate, showNotes, round, position, category, clueNum, value, dailyDouble, clue, mediaUrl, answer
 */
function parseFields(flds) {
    const parts = flds.split(FIELD_SEP)
    return {
        showNumber: parts[0] || "",
        airDate: parts[1] || "",
        showNotes: parts[2] || "",
        round: parts[3] || "",
        position: parts[4] || "",
        category: parts[5] || "",
        clueNum: parts[6] || "",
        value: parts[7] || "",
        dailyDouble: parts[8] === "True",
        clue: parts[9] || "",
        mediaUrl: parts[10] || "",
        answer: parts[11] || ""
    }
}

class TriviaBot {
    /**
     * Create a new TriviaBot instance
     * @param {string} dbPath - Path to the SQLite database
     * @param {string} [cachePath] - Optional path to cache file for persisting seen questions
     */
    constructor(dbPath, cachePath) {
        this.db = new Database(dbPath, { readonly: true })
        this.cachePath = cachePath || null
        this.seenIds = new Set()
        this.answerCache = new Map() // Cache answers for checking

        // Load seen IDs from cache file if it exists
        if (this.cachePath && fs.existsSync(this.cachePath)) {
            try {
                const data = fs.readFileSync(this.cachePath, "utf8")
                const ids = JSON.parse(data)
                if (Array.isArray(ids)) {
                    for (const id of ids) {
                        this.seenIds.add(id)
                    }
                }
            } catch (err) {
                // Ignore invalid cache, start fresh
            }
        }

        // Get total count for random offset selection
        const countResult = this.db.prepare("SELECT COUNT(*) as count FROM notes").get()
        this.totalQuestions = countResult.count

        // Prepare statements
        this.randomQuestionStmt = this.db.prepare(`
            SELECT id, flds FROM notes
            WHERE id NOT IN (SELECT value FROM json_each(?))
            ORDER BY RANDOM()
            LIMIT 1
        `)

        this.questionByIdStmt = this.db.prepare("SELECT id, flds FROM notes WHERE id = ?")

        // Fallback for large seen sets - use offset-based random
        this.offsetQuestionStmt = this.db.prepare("SELECT id, flds FROM notes LIMIT 1 OFFSET ?")
    }

    /**
     * Reset seen questions and prepare for a new game
     */
    shuffle() {
        this.seenIds.clear()
        this.answerCache.clear()
        this._saveCache()
    }

    /**
     * Save seen IDs to cache file if cachePath is configured
     * @private
     */
    _saveCache() {
        if (this.cachePath) {
            try {
                fs.writeFileSync(this.cachePath, JSON.stringify([...this.seenIds]))
            } catch (err) {
                // Ignore write errors
            }
        }
    }

    /**
     * Get the next random question that hasn't been seen
     * @returns {Object|null} Question object or null if all questions exhausted
     */
    getQuestion() {
        // Check if we've seen all questions
        if (this.seenIds.size >= this.totalQuestions) {
            return null
        }

        let row

        // For smaller seen sets, use NOT IN query
        if (this.seenIds.size < 1000) {
            const seenArray = JSON.stringify([...this.seenIds])
            row = this.randomQuestionStmt.get(seenArray)
        } else {
            // For larger sets, use offset-based random selection
            // Keep trying until we find an unseen question
            let attempts = 0
            while (attempts < 100) {
                const offset = Math.floor(Math.random() * this.totalQuestions)
                row = this.offsetQuestionStmt.get(offset)
                if (row && !this.seenIds.has(row.id)) {
                    break
                }
                attempts++
            }
        }

        if (!row) {
            return null
        }

        const fields = parseFields(row.flds)

        // Mark as seen and cache the answer and clue
        this.seenIds.add(row.id)
        this.answerCache.set(row.id, { answer: fields.answer, clue: fields.clue })
        this._saveCache()

        return {
            id: row.id,
            showNumber: fields.showNumber,
            airDate: fields.airDate,
            round: fields.round,
            category: fields.category,
            value: fields.value,
            clue: fields.mediaUrl ? fields.clue + " - " + fields.mediaUrl : fields.clue,
            dailyDouble: fields.dailyDouble
        }
    }

    /**
     * Check if the provided answer is correct
     * @param {number} questionId - The question ID
     * @param {string} userAnswer - The user's answer
     * @returns {Object} { correct: boolean, correctAnswer?: string }
     */
    checkAnswer(questionId, userAnswer) {
        const cached = this.answerCache.get(questionId)

        if (!cached) {
            // Question not in cache, fetch from database
            const row = this.questionByIdStmt.get(questionId)
            if (!row) {
                return { correct: false, error: "Question not found" }
            }
            const fields = parseFields(row.flds)
            this.answerCache.set(questionId, { answer: fields.answer, clue: fields.clue })
            return {
                correct: checkAnswer(userAnswer, fields.answer, fields.clue)
            }
        }

        return {
            correct: checkAnswer(userAnswer, cached.answer, cached.clue),
            answer: cached.answer
        }
    }

    /**
     * Give up on a question and get the correct answer
     * @param {number} questionId - The question ID
     * @returns {string|null} The correct answer or null if not found
     */
    giveUp(questionId) {
        const cached = this.answerCache.get(questionId)

        if (cached) {
            return cached.answer
        }

        const row = this.questionByIdStmt.get(questionId)
        if (row) {
            const fields = parseFields(row.flds)
            return fields.answer
        }

        return null
    }

    /**
     * Get the number of questions seen so far
     * @returns {number}
     */
    getSeenCount() {
        return this.seenIds.size
    }

    /**
     * Get the total number of questions in the database
     * @returns {number}
     */
    getTotalCount() {
        return this.totalQuestions
    }

    /**
     * Close the database connection
     */
    close() {
        this.db.close()
    }
}

module.exports = TriviaBot
