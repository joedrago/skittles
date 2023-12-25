const skittles = require("../src/skittles")
const fs = require("fs")

const SPACES = "                                                                                                      "

const pad = (str, len) => {
    return str + SPACES.substr(0, len - str.length)
}

const request = async (req, key, capture) => {
    if (!req.action.file || !req.action.url) {
        return req.reply({ text: `Sorry, \`#commands\` is incorrectly configured.` })
    }
    const commands = skittles.commands()

    // find the longest trigger
    let longestTriggerLen = 0
    for (let command of commands) {
        if (longestTriggerLen < command[0].length) {
            longestTriggerLen = command[0].length
        }
    }

    // Write HTML to action.file
    let html = "<pre>\n"
    html += "Skittles Commands\n"
    html += "-----------------\n\n"
    for (let command of commands) {
        html += `${pad(command[0], longestTriggerLen)} - ${command[1]}\n`
    }
    fs.writeFileSync(req.action.file, html)

    // Reply with action.html (where action.file is hosted)
    req.reply({ text: req.action.url })
}

module.exports = {
    request
}
