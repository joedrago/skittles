const skittles = require("../src/skittles")

const MORSE = {
    'A': '.-',    'B': '-...', 'C': '-.-.', 'D': '-..',
    'E': '.',     'F': '..-.', 'G': '--.',  'H': '....',
    'I': '..',    'J': '.---', 'K': '-.-',  'L': '.-..',
    'M': '--',    'N': '-.',   'O': '---',  'P': '.--.',
    'Q': '--.-',  'R': '.-.',  'S': '...',  'T': '-',
    'U': '..-',   'V': '...-', 'W': '.--',  'X': '-..-',
    'Y': '-.--',  'Z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '/': '-...-',
    ':': '---...', "'": '.----.', '-': '-....-',
    '?': '..--..', '!': '..--.', '@': '...-.-', '+': '.-.-.'
}

const request = async (req, key, capture) => {
    // morse_codes: space-separated "dot dash" characters, e.g. ". -" or "· −"
    // Read from the action block first, then top-level config, then default
    const cfg = skittles.config()
    const morseCodesStr = (req.action && req.action.morse_codes) || cfg.morse_codes || ". -"
    const parts = morseCodesStr.split(" ")
    const dot = parts[0] || "."
    const dash = parts[1] || "-"

    let text = capture[1] ? capture[1].trim() : ""
    text = text.replace(/[^a-z0-9 .,\/:'"_?!@+]/gi, "")

    const words = text.split(/\s+/).filter(w => w.length > 0)
    if (!words.length) {
        return req.reply({ text: "Syntax: `#morse TEXT`" })
    }

    const encoded = words.map(word => {
        const letters = word.split("").map(ch => MORSE[ch.toUpperCase()] || "").filter(c => c.length > 0)
        // Join letters with _ placeholder, then substitute dot/dash chars, then _ becomes the intra-word letter separator
        let morse = letters.join("_")
        morse = morse.replace(/\./g, dot)
        morse = morse.replace(/-/g, dash)
        morse = morse.replace(/_/g, "-")
        return morse
    })

    req.reply({ text: encoded.join("  ") })
}

module.exports = { request }
