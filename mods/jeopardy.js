const skittles = require("../src/skittles")
const TriviaBot = require("./jeopardy/TriviaBot")

// Round timeout - if no requests for this long, consider it a fresh round
const ROUND_TIMEOUT_SECONDS = 300 // 5 minutes

// Commands that skip the current question
const SKIP_COMMANDS = ["?", "skip", "pass", "give up", "giveup", "idk", "i don't know"]

// Scorekeeping
let scoreboard = {} // { nickname: correctCount }
let lastRequestTime = null

// Format the scoreboard for display (terse, sorted by score descending)
function formatScoreboard(scores, isFinal = false) {
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return null

    const label = isFinal ? "Final Scores" : "Scores"
    const maxNameLen = Math.max(...entries.map(([name]) => name.length), 4)
    const maxScoreLen = Math.max(...entries.map(([, count]) => String(count).length), 1)

    const lines = entries.map(([name, count]) => {
        const paddedName = name.padEnd(maxNameLen)
        const paddedScore = String(count).padStart(maxScoreLen)
        return `${paddedName}  ${paddedScore}`
    })

    const innerWidth = maxNameLen + maxScoreLen + 2
    const divider = "─".repeat(innerWidth)

    return "```\n" + label + "\n" + divider + "\n" + lines.join("\n") + "\n```"
}

// Strip HTML tags from clue text
function stripHtml(str) {
    return str.replace(/<[^>]*>/g, "").trim()
}

// Format a question for display
function formatQuestion(question) {
    const category = question.category.toUpperCase()
    const value = question.value || "???"
    const clue = stripHtml(question.clue)
    const year = question.airDate ? new Date(question.airDate).getFullYear() : "???"

    let prefix = `[**aired ${year}**] From **${category}** for **${value}**`
    if (question.dailyDouble) {
        prefix = `[**DAILY DOUBLE**] ${prefix}`
    }

    return `_${prefix}:_\n> # ${clue}`
}

let inited = false
let bot = null
let currentQuestion = null

const request = async (req, key, capture) => {
    if (!inited) {
        inited = true
        const dbPath = skittles.modFile("jeopardy", "trivia.sqlite")
        const cachePath = "/home/joe/jeopardy-cache.json"
        try {
            bot = new TriviaBot(dbPath, cachePath)
        } catch (err) {
            console.error(`Error opening database: ${err.message}`)
            console.error(`Expected database at: ${dbPath}`)
            bot = null
        }
        if (bot) {
            const seen = bot.getSeenCount()
            const total = bot.getTotalCount()
            console.log(`Loaded ${total.toLocaleString()} questions (${seen.toLocaleString()} previously seen).\n`)
        }
    }
    if (!bot) {
        console.log("jeopardy is broken, bot failed to load, skipping request")
        return
    }

    // Check for round timeout - if 5+ minutes since last request, finalize the round
    const now = Date.now()
    if (lastRequestTime !== null) {
        const elapsed = (now - lastRequestTime) / 1000
        if (elapsed >= ROUND_TIMEOUT_SECONDS && Object.keys(scoreboard).length > 0) {
            const finalScores = formatScoreboard(scoreboard, true)
            let newRoundText = `It's been a while since anyone played. Let's start a new round!\nHere are last round's scores:\n${finalScores}`
            if (currentQuestion) {
                newRoundText += `\n\nAs a reminder, here's the current question:\n${formatQuestion(currentQuestion)}`
            }
            req.reply({ text: newRoundText })
            scoreboard = {}
        }
    }
    lastRequestTime = now

    console.log(`guesser: ${req.nickname}`)

    const answer = capture[1].trim()
    const lowerAnswer = answer.toLowerCase()

    // Check for skip commands
    if (currentQuestion && SKIP_COMMANDS.includes(lowerAnswer)) {
        const correctAnswer = bot.giveUp(currentQuestion.id)
        req.reply({ text: `The answer was: **${correctAnswer}**` })
        currentQuestion = null
    }

    if (currentQuestion) {
        // Check the answer
        const result = bot.checkAnswer(currentQuestion.id, answer)

        if (result.correct) {
            // Update scoreboard
            scoreboard[req.nickname] = (scoreboard[req.nickname] || 0) + 1

            req.reply({ text: `# **Correct: ** ${result.answer}`, reply: true })
            currentQuestion = null
        } else {
            return // req.reply({ text: "**Incorrect. Try again, or type ? to skip.**", reply: true })
        }
    }

    if (!currentQuestion) {
        currentQuestion = bot.getQuestion()
    }

    // Build question text with scoreboard if not empty
    const scoreText = formatScoreboard(scoreboard)
    const questionText = formatQuestion(currentQuestion)
    const fullText = scoreText ? `${scoreText}\n${questionText}` : questionText

    return req.reply({ text: fullText })
}

module.exports = {
    request
}
