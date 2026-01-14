const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const skittles = require("../src/skittles")
const TriviaBot = require("./jeopardy/TriviaBot")

// Start Express + Socket.IO server
const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Dashboard state
let lastMessage = null

// Strip HTML tags from clue text
function stripHtml(str) {
    return str.replace(/<[^>]*>/g, "").trim()
}

// Parse dollar value from question value string (e.g., "$200" -> 200)
function parseValue(valueStr) {
    if (!valueStr) return 0
    const match = valueStr.replace(/,/g, "").match(/\d+/)
    return match ? parseInt(match[0], 10) : 0
}

// Format a number as dollars with commas (e.g., 10000 -> "$10,000")
function formatDollars(amount) {
    return "$" + amount.toLocaleString()
}

// Build dashboard state object
function getDashboardState() {
    let question = null
    if (currentQuestion) {
        question = {
            category: currentQuestion.category.toUpperCase(),
            value: currentQuestion.value || "???",
            clue: stripHtml(currentQuestion.clue),
            year: currentQuestion.airDate ? new Date(currentQuestion.airDate).getFullYear() : null,
            dailyDouble: currentQuestion.dailyDouble
        }
    }
    return {
        message: lastMessage,
        scoreboard: { ...scoreboard },
        question
    }
}

// Broadcast current state to all connected clients
function broadcastState() {
    io.emit("state", getDashboardState())
}

// Dashboard HTML
const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jeopardy Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body {
            height: 100%;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0f0f1a;
            color: #e0e0e0;
        }
        .container {
            display: flex;
            height: 100vh;
            padding: clamp(12px, 2vw, 24px);
            gap: clamp(12px, 2vw, 24px);
        }
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-width: 0;
        }
        .message {
            color: #ffd700;
            font-size: clamp(14px, 2.5vw, 24px);
            font-weight: 600;
            margin-top: clamp(12px, 2vh, 24px);
        }
        .meta {
            color: #888;
            font-size: clamp(12px, 2vw, 18px);
            margin-bottom: clamp(8px, 1.5vh, 16px);
            display: flex;
            flex-wrap: wrap;
            gap: 0.5em;
            align-items: center;
        }
        .meta .category {
            color: #7b9fff;
            font-weight: 600;
        }
        .meta .value {
            color: #ffd700;
            font-weight: 700;
        }
        .meta .year {
            color: #666;
        }
        .meta .daily-double {
            background: #ffd700;
            color: #0f0f1a;
            padding: 0.1em 0.5em;
            border-radius: 4px;
            font-weight: 700;
            font-size: 0.9em;
        }
        .meta .sep {
            color: #444;
        }
        .clue {
            color: #fff;
            font-size: clamp(20px, 5vw, 48px);
            font-weight: 500;
            line-height: 1.3;
            word-wrap: break-word;
        }
        .clue a {
            color: #7b9fff;
            text-decoration: none;
        }
        .clue a:hover {
            text-decoration: underline;
        }
        .sidebar {
            width: clamp(120px, 20vw, 220px);
            background: #1a1a2e;
            border-radius: 8px;
            padding: clamp(12px, 1.5vw, 20px);
            display: flex;
            flex-direction: column;
        }
        .sidebar-title {
            color: #7b9fff;
            font-size: clamp(12px, 1.5vw, 16px);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: clamp(8px, 1vh, 16px);
            padding-bottom: clamp(6px, 0.8vh, 12px);
            border-bottom: 1px solid #2a2a4e;
        }
        .scores {
            flex: 1;
            overflow-y: auto;
        }
        .score-row {
            display: flex;
            justify-content: space-between;
            padding: clamp(4px, 0.6vh, 8px) 0;
            font-size: clamp(12px, 1.5vw, 16px);
        }
        .score-row .name {
            color: #ccc;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-right: 8px;
        }
        .score-row .points {
            color: #ffd700;
            font-weight: 600;
            flex-shrink: 0;
        }
        .no-scores {
            color: #555;
            font-style: italic;
            font-size: clamp(11px, 1.3vw, 14px);
        }
        .waiting {
            color: #555;
            font-size: clamp(16px, 3vw, 28px);
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="main" id="main">
            <div class="waiting">Waiting for game...</div>
        </div>
        <div class="sidebar">
            <div class="sidebar-title">Scores</div>
            <div class="scores" id="scores">
                <div class="no-scores">No scores yet</div>
            </div>
        </div>
    </div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const mainEl = document.getElementById("main");
        const scoresEl = document.getElementById("scores");

        function render(state) {
            // Render main content
            if (state.question) {
                let html = "";
                html += '<div class="meta">';
                if (state.question.dailyDouble) {
                    html += '<span class="daily-double">DAILY DOUBLE</span>';
                }
                html += '<span class="category">' + escapeHtml(state.question.category) + '</span>';
                html += '<span class="sep">·</span>';
                html += '<span class="value">' + escapeHtml(state.question.value) + '</span>';
                if (state.question.year) {
                    html += '<span class="sep">·</span>';
                    html += '<span class="year">aired ' + state.question.year + '</span>';
                }
                html += '</div>';
                html += '<div class="clue">' + linkifyUrls(state.question.clue) + '</div>';
                if (state.message) {
                    html += '<div class="message">' + escapeHtml(state.message) + '</div>';
                }
                mainEl.innerHTML = html;
            } else {
                mainEl.innerHTML = '<div class="waiting">Waiting for game...</div>';
            }

            // Render scoreboard
            const entries = Object.entries(state.scoreboard || {}).sort((a, b) => b[1] - a[1]);
            if (entries.length === 0) {
                scoresEl.innerHTML = '<div class="no-scores">No scores yet</div>';
            } else {
                scoresEl.innerHTML = entries.map(([name, score]) =>
                    '<div class="score-row"><span class="name">' + escapeHtml(name) + '</span><span class="points">$' + score.toLocaleString() + '</span></div>'
                ).join("");
            }
        }

        function escapeHtml(text) {
            const div = document.createElement("div");
            div.textContent = text;
            return div.innerHTML;
        }

        function linkifyUrls(text) {
            const urlRegex = /(https?:\\/\\/[^\\s]+)/g;
            return escapeHtml(text).replace(urlRegex, function(url) {
                const lower = url.toLowerCase();
                const isImage = /\\.(jpg|jpeg|png|gif|webp|svg|bmp)(\\?|$)/i.test(lower);
                const isVideo = /\\.(mp4|webm|mov|avi|mkv)(\\?|$)/i.test(lower) ||
                               /youtube\\.com|youtu\\.be|vimeo\\.com/i.test(lower);
                const label = isVideo ? "Video" : "Image";
                return '[<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>]';
            });
        }

        socket.on("state", render);
    </script>
</body>
</html>`

app.get("/", (req, res) => {
    res.send(dashboardHtml)
})

io.on("connection", (socket) => {
    socket.emit("state", getDashboardState())
})

server.listen(3093, "127.0.0.1", () => {
    console.log("Jeopardy dashboard listening on http://127.0.0.1:3093")
})

// Round timeout - if no requests for this long, consider it a fresh round
const ROUND_TIMEOUT_SECONDS = 300 // 5 minutes

// Commands that skip the current question
const SKIP_COMMANDS = ["?", "skip", "pass", "give up", "giveup", "idk", "i don't know"]

// Scorekeeping
let scoreboard = {} // { nickname: correctCount }
let lastRequestTime = null

// Timeout tracking for auto-skip
let firstGuessTime = null
let timeoutTimer = null
let lastChannel = null // { guildId, channelId }
const ANSWER_TIMEOUT_MS = 30 * 1000
const WINNING_SCORE = 10000

// Format the scoreboard for display (terse, sorted by score descending)
function formatScoreboard(scores, isFinal = false) {
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return null

    const label = isFinal ? "Final Scores" : `Scores - First to ${formatDollars(WINNING_SCORE)} wins!`
    const maxNameLen = Math.max(...entries.map(([name]) => name.length), 4)
    const formattedScores = entries.map(([, amount]) => formatDollars(amount))
    const maxScoreLen = Math.max(...formattedScores.map(s => s.length), 1)

    const lines = entries.map(([name, amount], i) => {
        const paddedName = name.padEnd(maxNameLen)
        const paddedScore = formattedScores[i].padStart(maxScoreLen)
        return `${paddedName}  ${paddedScore}`
    })

    const innerWidth = maxNameLen + maxScoreLen + 2
    const divider = "─".repeat(innerWidth)

    return "```\n" + label + "\n" + divider + "\n" + lines.join("\n") + "\n```"
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

// Build full message with optional prefix, scoreboard, and question
function buildQuestionMessage(question, prefix = null) {
    const scoreText = formatScoreboard(scoreboard)
    const questionText = formatQuestion(question)
    let parts = []
    if (prefix) parts.push(prefix)
    if (scoreText) parts.push(scoreText)
    parts.push(questionText)
    return parts.join("\n\n")
}

let inited = false
let bot = null
let currentQuestion = null

// Handle timeout - auto-skip when time runs out
function handleTimeout() {
    console.log("[jeopardy] Timeout fired!")
    if (!currentQuestion || !lastChannel || !bot) {
        console.log("[jeopardy] Timeout aborted: missing currentQuestion, lastChannel, or bot")
        return
    }

    const correctAnswer = bot.giveUp(currentQuestion.id)
    console.log(`[jeopardy] Time's up! Answer was: ${correctAnswer}`)
    currentQuestion = bot.getQuestion()
    firstGuessTime = null

    const prefix = `**Time is up!** The answer was: **${correctAnswer}**`
    lastMessage = `Time is up! The answer was: ${correctAnswer}`
    broadcastState()

    const fullText = buildQuestionMessage(currentQuestion, prefix)
    skittles.shout(lastChannel.guildId, lastChannel.channelId, fullText)
}

// Clear any existing timeout
function clearAnswerTimeout() {
    if (timeoutTimer) {
        console.log("[jeopardy] Clearing answer timeout")
        clearTimeout(timeoutTimer)
        timeoutTimer = null
    }
    firstGuessTime = null
}

// Start the answer timeout (called on first guess for a question)
function startAnswerTimeout() {
    clearAnswerTimeout()
    firstGuessTime = Date.now()
    timeoutTimer = setTimeout(handleTimeout, ANSWER_TIMEOUT_MS)
    console.log(`[jeopardy] Started ${ANSWER_TIMEOUT_MS / 1000}s answer timeout`)
}

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
            clearAnswerTimeout()
            const finalScores = formatScoreboard(scoreboard, true)
            let newRoundText = `It's been a while since anyone played. Let's start a new round!\nHere are last round's scores:\n${finalScores}`
            if (currentQuestion) {
                newRoundText += `\n\nAs a reminder, here's the current question:\n${formatQuestion(currentQuestion)}`
            }
            req.reply({ text: newRoundText })
            scoreboard = {}
            lastMessage = "New round started!"
            broadcastState()
        }
    }
    lastRequestTime = now

    // Track the channel for timeout shouts
    if (req.discordMsg && req.discordMsg.guildId) {
        lastChannel = {
            guildId: req.discordMsg.guildId,
            channelId: req.discordMsg.channelId
        }
    }

    const answer = capture[1].trim()
    const lowerAnswer = answer.toLowerCase()

    // Check for skip commands
    if (currentQuestion && SKIP_COMMANDS.includes(lowerAnswer)) {
        clearAnswerTimeout()
        const correctAnswer = bot.giveUp(currentQuestion.id)
        req.reply({ text: `The answer was: **${correctAnswer}**` })
        lastMessage = `The answer was: ${correctAnswer}`
        currentQuestion = null
    }

    if (currentQuestion) {
        // Check the answer
        const result = bot.checkAnswer(currentQuestion.id, answer)

        if (result.correct) {
            clearAnswerTimeout()
            // Update scoreboard with question's dollar value
            const questionValue = parseValue(currentQuestion.value)
            scoreboard[req.nickname] = (scoreboard[req.nickname] || 0) + questionValue

            // Always show the correct answer
            req.reply({ text: `# **Correct: ** ${result.answer} (+${formatDollars(questionValue)})`, reply: true })

            // Check for winner
            if (scoreboard[req.nickname] >= WINNING_SCORE) {
                req.reply({ text: `# 🎉🏆 ${req.nickname} wins with ${formatDollars(scoreboard[req.nickname])}! 🏆🎉` })
                req.reply({ text: `Starting new game...` })
                lastMessage = `${req.nickname} wins the game with ${formatDollars(scoreboard[req.nickname])}!`
                scoreboard = {}
            } else {
                lastMessage = `${req.nickname} got it! ${result.answer} (+${formatDollars(questionValue)})`
            }
            currentQuestion = null
        } else {
            // Wrong answer - start timeout on first guess for this question
            if (!firstGuessTime) {
                startAnswerTimeout()
            }
            return // req.reply({ text: "**Incorrect. Try again, or type ? to skip.**", reply: true })
        }
    }

    if (!currentQuestion) {
        currentQuestion = bot.getQuestion()
        lastMessage = null
    }

    broadcastState()
    return req.reply({ text: buildQuestionMessage(currentQuestion) })
}

module.exports = {
    request
}
