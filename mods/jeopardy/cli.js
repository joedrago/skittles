#!/usr/bin/env node

/**
 * TriviaBot CLI - Interactive trivia game demo
 */

const readline = require("readline")
const path = require("path")
const TriviaBot = require("./TriviaBot")

// Commands that skip the current question
const SKIP_COMMANDS = ["?", "skip", "pass", "give up", "giveup", "idk", "i don't know"]

// Commands that exit the game
const EXIT_COMMANDS = ["quit", "exit", "q", "bye"]

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

    let prefix = `[${year}] From ${category} for ${value}`
    if (question.dailyDouble) {
        prefix = `[DAILY DOUBLE] ${prefix}`
    }

    return `\n${prefix}:\n${clue}\n`
}

async function main() {
    // Find database path relative to this script
    const dbPath = path.resolve(__dirname, "trivia.sqlite")
    const cachePath = path.resolve(__dirname, ".trivia-cache.json")

    console.log("Welcome to TriviaBot!")
    console.log('Type your answer, "?" to skip, or "quit" to exit.\n')

    let bot
    try {
        bot = new TriviaBot(dbPath, cachePath)
    } catch (err) {
        console.error(`Error opening database: ${err.message}`)
        console.error(`Expected database at: ${dbPath}`)
        process.exit(1)
    }

    const seen = bot.getSeenCount()
    const total = bot.getTotalCount()
    console.log(`Loaded ${total.toLocaleString()} questions (${seen.toLocaleString()} previously seen).\n`)

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    let currentQuestion = null

    // Handle Ctrl+C gracefully
    rl.on("close", () => {
        console.log("\n\nThanks for playing!")
        bot.close()
        process.exit(0)
    })

    function askQuestion() {
        currentQuestion = bot.getQuestion()

        if (!currentQuestion) {
            console.log("\nWow! You've gone through all the questions!")
            bot.close()
            rl.close()
            return
        }
        console.log(formatQuestion(currentQuestion))
        promptAnswer()
    }

    function promptAnswer() {
        rl.question("> ", (input) => {
            const answer = input.trim()

            if (!answer) {
                promptAnswer()
                return
            }

            const lowerAnswer = answer.toLowerCase()

            // Check for exit commands
            if (EXIT_COMMANDS.includes(lowerAnswer)) {
                console.log("\nThanks for playing!")
                bot.close()
                rl.close()
                return
            }

            // Check for skip commands
            if (SKIP_COMMANDS.includes(lowerAnswer)) {
                const correctAnswer = bot.giveUp(currentQuestion.id)
                console.log(`\nThe answer was: ${correctAnswer}\n`)
                askQuestion()
                return
            }

            // Check the answer
            const result = bot.checkAnswer(currentQuestion.id, answer)

            if (result.correct) {
                console.log("\nCorrect!\n")
                askQuestion()
            } else {
                console.log("Incorrect. Try again, or type ? to skip.")
                promptAnswer()
            }
        })
    }

    // Start the game
    askQuestion()
}

main().catch((err) => {
    console.error("Fatal error:", err)
    process.exit(1)
})
