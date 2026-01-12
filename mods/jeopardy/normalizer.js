/**
 * Answer normalization utilities for flexible answer matching
 */

// ============================================
// Fuzzy Matching: Damerau-Levenshtein Distance
// ============================================

/**
 * Calculate Damerau-Levenshtein distance between two strings
 * Handles insertions, deletions, substitutions, and transpositions
 */
function damerauLevenshtein(a, b) {
    if (a === b) return 0
    if (!a.length) return b.length
    if (!b.length) return a.length

    const lenA = a.length
    const lenB = b.length

    // Create distance matrix
    const d = Array(lenA + 1)
        .fill(null)
        .map(() => Array(lenB + 1).fill(0))

    for (let i = 0; i <= lenA; i++) d[i][0] = i
    for (let j = 0; j <= lenB; j++) d[0][j] = j

    for (let i = 1; i <= lenA; i++) {
        for (let j = 1; j <= lenB; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1

            d[i][j] = Math.min(
                d[i - 1][j] + 1, // deletion
                d[i][j - 1] + 1, // insertion
                d[i - 1][j - 1] + cost // substitution
            )

            // Transposition
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost)
            }
        }
    }

    return d[lenA][lenB]
}

/**
 * Check if two strings are within acceptable edit distance
 * Threshold scales with string length
 */
function isWithinEditDistance(a, b) {
    const maxLen = Math.max(a.length, b.length)
    if (maxLen === 0) return true

    // Calculate allowed distance based on length
    // Short words (<=4): 1 edit
    // Medium words (5-8): 2 edits
    // Longer words: ~20% of length, max 4
    let threshold
    if (maxLen <= 4) threshold = 1
    else if (maxLen <= 8) threshold = 2
    else threshold = Math.min(4, Math.floor(maxLen * 0.2))

    const distance = damerauLevenshtein(a, b)
    return distance <= threshold
}

// ============================================
// Fuzzy Matching: Double Metaphone
// ============================================

/**
 * Double Metaphone phonetic encoding
 * Returns [primary, alternate] codes for a word
 */
function doubleMetaphone(str) {
    if (!str) return ["", ""]

    const word = str.toUpperCase()
    let primary = ""
    let secondary = ""
    let pos = 0
    const len = word.length
    const last = len - 1

    // Helper functions
    const charAt = (p) => (p >= 0 && p < len ? word[p] : "")
    const substr = (p, n) => word.substring(p, p + n)
    const isVowel = (c) => "AEIOU".includes(c)
    const isSlavoGermanic = () => /W|K|CZ|WITZ/.test(word)

    // Skip initial silent letters
    if (["GN", "KN", "PN", "WR", "PS"].includes(substr(0, 2))) pos++

    // Initial X pronounced as S
    if (charAt(0) === "X") {
        primary += "S"
        secondary += "S"
        pos++
    }

    while (pos < len && (primary.length < 4 || secondary.length < 4)) {
        const c = charAt(pos)

        switch (c) {
            case "A":
            case "E":
            case "I":
            case "O":
            case "U":
            case "Y":
                if (pos === 0) {
                    primary += "A"
                    secondary += "A"
                }
                pos++
                break

            case "B":
                primary += "P"
                secondary += "P"
                pos += charAt(pos + 1) === "B" ? 2 : 1
                break

            case "C":
                if (substr(pos, 2) === "CH") {
                    primary += "X"
                    secondary += "X"
                    pos += 2
                } else if (substr(pos, 2) === "CK") {
                    primary += "K"
                    secondary += "K"
                    pos += 2
                } else if (["CI", "CE", "CY"].includes(substr(pos, 2))) {
                    primary += "S"
                    secondary += "S"
                    pos += 1
                } else {
                    primary += "K"
                    secondary += "K"
                    pos += ["CC", "CQ", "CG"].includes(substr(pos, 2)) ? 2 : 1
                }
                break

            case "D":
                if (substr(pos, 2) === "DG") {
                    if (["DGI", "DGE", "DGY"].includes(substr(pos, 3))) {
                        primary += "J"
                        secondary += "J"
                        pos += 3
                    } else {
                        primary += "TK"
                        secondary += "TK"
                        pos += 2
                    }
                } else {
                    primary += "T"
                    secondary += "T"
                    pos += ["DT", "DD"].includes(substr(pos, 2)) ? 2 : 1
                }
                break

            case "F":
                primary += "F"
                secondary += "F"
                pos += charAt(pos + 1) === "F" ? 2 : 1
                break

            case "G":
                if (charAt(pos + 1) === "H") {
                    if (pos > 0 && !isVowel(charAt(pos - 1))) {
                        pos += 2
                    } else if (pos === 0) {
                        primary += "K"
                        secondary += "K"
                        pos += 2
                    } else {
                        primary += "F"
                        secondary += "F"
                        pos += 2
                    }
                } else if (charAt(pos + 1) === "N") {
                    if (pos === 0) {
                        primary += "KN"
                        secondary += "N"
                    } else {
                        primary += "N"
                        secondary += "N"
                    }
                    pos += 2
                } else if (["GI", "GE", "GY"].includes(substr(pos, 2))) {
                    primary += "J"
                    secondary += "K"
                    pos += 1
                } else {
                    primary += "K"
                    secondary += "K"
                    pos += charAt(pos + 1) === "G" ? 2 : 1
                }
                break

            case "H":
                if (pos === 0 || (isVowel(charAt(pos - 1)) && isVowel(charAt(pos + 1)))) {
                    primary += "H"
                    secondary += "H"
                    pos += 2
                } else {
                    pos++
                }
                break

            case "J":
                primary += "J"
                secondary += "J"
                pos += charAt(pos + 1) === "J" ? 2 : 1
                break

            case "K":
                primary += "K"
                secondary += "K"
                pos += charAt(pos + 1) === "K" ? 2 : 1
                break

            case "L":
                primary += "L"
                secondary += "L"
                pos += charAt(pos + 1) === "L" ? 2 : 1
                break

            case "M":
                primary += "M"
                secondary += "M"
                pos += charAt(pos + 1) === "M" || (charAt(pos - 1) === "U" && substr(pos + 1, 2) === "BER") ? 2 : 1
                break

            case "N":
                primary += "N"
                secondary += "N"
                pos += charAt(pos + 1) === "N" ? 2 : 1
                break

            case "P":
                if (charAt(pos + 1) === "H") {
                    primary += "F"
                    secondary += "F"
                    pos += 2
                } else {
                    primary += "P"
                    secondary += "P"
                    pos += ["PP", "PB"].includes(substr(pos, 2)) ? 2 : 1
                }
                break

            case "Q":
                primary += "K"
                secondary += "K"
                pos += charAt(pos + 1) === "Q" ? 2 : 1
                break

            case "R":
                primary += "R"
                secondary += "R"
                pos += charAt(pos + 1) === "R" ? 2 : 1
                break

            case "S":
                if (substr(pos, 2) === "SH") {
                    primary += "X"
                    secondary += "X"
                    pos += 2
                } else if (substr(pos, 3) === "SCH") {
                    primary += "SK"
                    secondary += "SK"
                    pos += 3
                } else if (["SI", "SIO", "SIA"].some((s) => substr(pos, s.length) === s)) {
                    primary += isSlavoGermanic() ? "S" : "X"
                    secondary += "S"
                    pos += 1
                } else {
                    primary += "S"
                    secondary += "S"
                    pos += ["SS", "SZ"].includes(substr(pos, 2)) ? 2 : 1
                }
                break

            case "T":
                if (substr(pos, 4) === "TION") {
                    primary += "XN"
                    secondary += "XN"
                    pos += 4
                } else if (substr(pos, 3) === "TCH" || substr(pos, 2) === "TH") {
                    primary += "0" // 0 represents 'th' sound
                    secondary += "T"
                    pos += substr(pos, 3) === "TCH" ? 3 : 2
                } else {
                    primary += "T"
                    secondary += "T"
                    pos += ["TT", "TD"].includes(substr(pos, 2)) ? 2 : 1
                }
                break

            case "V":
                primary += "F"
                secondary += "F"
                pos += charAt(pos + 1) === "V" ? 2 : 1
                break

            case "W":
                if (charAt(pos + 1) === "R") {
                    primary += "R"
                    secondary += "R"
                    pos += 2
                } else if (pos === 0 && isVowel(charAt(pos + 1))) {
                    primary += "A"
                    secondary += "F"
                    pos++
                } else if (isVowel(charAt(pos - 1)) && isVowel(charAt(pos + 1))) {
                    primary += "F"
                    secondary += "F"
                    pos++
                } else {
                    pos++
                }
                break

            case "X":
                primary += "KS"
                secondary += "KS"
                pos += ["XX", "XC"].includes(substr(pos, 2)) ? 2 : 1
                break

            case "Z":
                primary += "S"
                secondary += "S"
                pos += charAt(pos + 1) === "Z" ? 2 : 1
                break

            default:
                pos++
        }
    }

    return [primary.substring(0, 4), secondary.substring(0, 4)]
}

/**
 * Check if two strings match phonetically using Double Metaphone
 */
function phoneticMatch(a, b) {
    if (!a || !b) return false

    // Get metaphone codes for each word in both strings
    const wordsA = a.split(/\s+/).filter(Boolean)
    const wordsB = b.split(/\s+/).filter(Boolean)

    // For single words, direct comparison
    if (wordsA.length === 1 && wordsB.length === 1) {
        const [primaryA, secondaryA] = doubleMetaphone(wordsA[0])
        const [primaryB, secondaryB] = doubleMetaphone(wordsB[0])

        return (
            (primaryA && (primaryA === primaryB || primaryA === secondaryB)) ||
            (secondaryA && (secondaryA === primaryB || secondaryA === secondaryB))
        )
    }

    // For multi-word strings, all words must have a phonetic match
    if (wordsA.length !== wordsB.length) return false

    for (let i = 0; i < wordsA.length; i++) {
        const [primaryA, secondaryA] = doubleMetaphone(wordsA[i])
        const [primaryB, secondaryB] = doubleMetaphone(wordsB[i])

        const matches =
            (primaryA && (primaryA === primaryB || primaryA === secondaryB)) ||
            (secondaryA && (secondaryA === primaryB || secondaryA === secondaryB))

        if (!matches) return false
    }

    return true
}

// Number word to digit mappings
const numberWords = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
    thirteen: "13",
    fourteen: "14",
    fifteen: "15",
    sixteen: "16",
    seventeen: "17",
    eighteen: "18",
    nineteen: "19",
    twenty: "20",
    thirty: "30",
    forty: "40",
    fifty: "50",
    sixty: "60",
    seventy: "70",
    eighty: "80",
    ninety: "90",
    hundred: "100",
    thousand: "1000",
    million: "1000000"
}

// Reverse mapping: digits to words
const digitWords = Object.fromEntries(Object.entries(numberWords).map(([word, digit]) => [digit, word]))

// Ordinal mappings
const ordinalWords = {
    first: "1st",
    second: "2nd",
    third: "3rd",
    fourth: "4th",
    fifth: "5th",
    sixth: "6th",
    seventh: "7th",
    eighth: "8th",
    ninth: "9th",
    tenth: "10th",
    eleventh: "11th",
    twelfth: "12th",
    thirteenth: "13th",
    fourteenth: "14th",
    fifteenth: "15th",
    sixteenth: "16th",
    seventeenth: "17th",
    eighteenth: "18th",
    nineteenth: "19th",
    twentieth: "20th"
}

// Reverse ordinal mapping
const ordinalDigits = Object.fromEntries(Object.entries(ordinalWords).map(([word, digit]) => [digit, word]))

/**
 * Basic normalization: lowercase, strip articles, punctuation, whitespace
 */
function basicNormalize(str) {
    if (!str) return ""

    let result = str.toLowerCase()

    // Strip HTML tags (some clues have them)
    result = result.replace(/<[^>]*>/g, "")

    // Normalize ampersand to "and"
    result = result.replace(/&/g, " and ")

    // Strip leading articles
    result = result.replace(/^(a|an|the)\s+/i, "")

    // Strip punctuation but keep alphanumeric and spaces
    result = result.replace(/[^a-z0-9\s]/g, "")

    // Collapse whitespace
    result = result.replace(/\s+/g, " ").trim()

    return result
}

/**
 * Convert number words to digits
 */
function wordsToDigits(str) {
    let result = str

    // Replace ordinals first (longer matches)
    for (const [word, digit] of Object.entries(ordinalWords)) {
        result = result.replace(new RegExp(`\\b${word}\\b`, "gi"), digit)
    }

    // Replace cardinal numbers
    for (const [word, digit] of Object.entries(numberWords)) {
        result = result.replace(new RegExp(`\\b${word}\\b`, "gi"), digit)
    }

    return result
}

/**
 * Convert digits to number words
 */
function digitsToWords(str) {
    let result = str

    // Replace ordinal digits first (e.g., 1st, 2nd)
    for (const [digit, word] of Object.entries(ordinalDigits)) {
        result = result.replace(new RegExp(`\\b${digit.replace(/([st|nd|rd|th])/g, "$1")}\\b`, "gi"), word)
    }

    // Replace cardinal digits (only standalone numbers)
    for (const [digit, word] of Object.entries(digitWords)) {
        result = result.replace(new RegExp(`\\b${digit}\\b`, "g"), word)
    }

    return result
}

/**
 * Full normalization with number conversion to digits
 */
function normalize(str) {
    return wordsToDigits(basicNormalize(str))
}

/**
 * Full normalization with number conversion to words
 */
function normalizeToWords(str) {
    return digitsToWords(basicNormalize(str))
}

/**
 * Check if two answers match using flexible comparison
 * Returns true if the answers are considered equivalent
 */
function checkAnswer(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return false

    // Normalize both answers
    const userBasic = basicNormalize(userAnswer)
    const correctBasic = basicNormalize(correctAnswer)

    // Exact match after basic normalization
    if (userBasic === correctBasic) return true

    // Try with numbers as digits
    const userDigits = normalize(userAnswer)
    const correctDigits = normalize(correctAnswer)
    if (userDigits === correctDigits) return true

    // Try with numbers as words
    const userWords = normalizeToWords(userAnswer)
    const correctWords = normalizeToWords(correctAnswer)
    if (userWords === correctWords) return true

    // Check if user answer contains the correct answer or vice versa
    // This handles cases like "Jesse James" matching "jesse james" in a longer response
    if (correctDigits.length >= 3 && userDigits.includes(correctDigits)) return true
    if (userDigits.length >= 3 && correctDigits.includes(userDigits)) return true

    // Check if correct answer contains user answer (for partial matches)
    // e.g., user says "stooges" for "the three stooges"
    if (userDigits.length >= 4 && correctDigits.includes(userDigits)) return true

    // Fuzzy matching: phonetic similarity (handles pronunciation-based errors)
    // e.g., "Tchaikovsky" vs "Chaikovsky", "Nietzsche" vs "Nietsche"
    if (phoneticMatch(userDigits, correctDigits)) return true

    // Fuzzy matching: edit distance (handles typos and transpositions)
    // e.g., "Shakespaere" vs "Shakespeare", "teh" vs "the"
    if (isWithinEditDistance(userDigits, correctDigits)) return true

    return false
}

module.exports = {
    basicNormalize,
    normalize,
    normalizeToWords,
    wordsToDigits,
    digitsToWords,
    checkAnswer,
    // Fuzzy matching utilities
    damerauLevenshtein,
    isWithinEditDistance,
    doubleMetaphone,
    phoneticMatch
}
