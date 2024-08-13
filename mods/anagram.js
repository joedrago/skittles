const skittles = require("../src/skittles")
const fs = require("fs")

const request = async (req, key, capture) => {
    let letters = capture[1].trim()
    if (!letters) {
        return req.reply({ text: "Syntax: `#anagram LETTERS`" })
    }
    letters = letters.replace(/^\s*/g, "")
    letters = letters.replace(/\s*$/g, "")
    letters = letters.replace(/[^a-zA-Z]/g, "")
    letters = letters.toLowerCase()

    console.log(`Requesting anagram: ${letters}`)
    const list = await skittles.spawn("../anagram", [letters], true)
    if (!list || list.length < 1) {
        return req.reply({ text: `Failed to anagram, sorry` })
    }
    console.log(list)

    let reply = ""
    for(let w of list) {
        if((reply.length + 2 + w.length) > 1500) {
            break
        }
        if(reply.length > 0) {
            reply += ", "
        }
        reply += w
    }

    if(reply.length > 1) {
        req.reply({ text: reply })
    } else {
        req.reply({ text: "No anagram results, sorry" })
    }
}

module.exports = {
    request
}
