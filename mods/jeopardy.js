const skittles = require("../src/skittles")
const TriviaBot = require("./jeopardy/TriviaBot")

// Commands that skip the current question
const SKIP_COMMANDS = ["?", "skip", "pass", "give up", "giveup", "idk", "i don't know"]

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
    if(!inited) {
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
        if(bot) {
            const seen = bot.getSeenCount()
            const total = bot.getTotalCount()
            console.log(`Loaded ${total.toLocaleString()} questions (${seen.toLocaleString()} previously seen).\n`)
        }
    }
    if(!bot) {
        console.log("jeopardy is broken, bot failed to load, skipping request")
        return
    }

    const answer = capture[1].trim()
    const lowerAnswer = answer.toLowerCase()

    // Check for skip commands
    if (SKIP_COMMANDS.includes(lowerAnswer)) {
        const correctAnswer = bot.giveUp(currentQuestion.id)
        req.reply({ text: `The answer was: **${correctAnswer}**` })
        currentQuestion = null
    }

    if(currentQuestion) {
        // Check the answer
        const result = bot.checkAnswer(currentQuestion.id, answer)

        if (result.correct) {
            req.reply({ text: `# **Correct: ** ${result.answer}`, reply: true })
            currentQuestion = null
        } else {
            return // req.reply({ text: "**Incorrect. Try again, or type ? to skip.**", reply: true })
        }
    }

    if (!currentQuestion) {
        currentQuestion = bot.getQuestion()
    }
    return req.reply({ text: formatQuestion(currentQuestion) })
}

module.exports = {
    request
}
