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

// Words that are too generic to count as partial answers - they must match the entire answer
const TRIVIAL_WORDS = new Set([
    // Articles
    'a', 'an', 'the',
    // Coordinating conjunctions
    'and', 'but', 'or', 'for', 'nor', 'yet', 'so',
    // Common short words
    'it', 'is', 'be', 'to', 'of', 'in', 'on', 'at', 'by', 'as', 'if', 'do', 'go', 'no', 'up', 'us', 'we', 'he', 'me', 'my',
    // Titles and honorifics (common category prefixes)
    'king', 'queen', 'prince', 'princess', 'lord', 'lady', 'sir', 'dame',
    'pope', 'saint', 'st',
    'duke', 'duchess', 'earl', 'baron', 'count', 'countess',
    'emperor', 'empress',
    'general', 'admiral', 'colonel', 'major', 'captain', 'lieutenant',
    'doctor', 'dr', 'mr', 'mrs', 'miss', 'ms',
    // Geographic prefixes
    'lake', 'mount', 'mt', 'river', 'sea', 'ocean', 'bay', 'gulf', 'cape', 'port', 'fort', 'isle', 'island',
    'north', 'south', 'east', 'west', 'northern', 'southern', 'eastern', 'western',
    'new', 'old', 'great', 'grand', 'little', 'big',
    // Colors (common category prefixes like "Red Sea", "Black Forest")
    'red', 'blue', 'green', 'black', 'white', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'grey',
    // Other common category words
    'world', 'national', 'american', 'british', 'french', 'german', 'roman', 'ancient', 'modern',
    'first', 'second', 'third', 'last',
    'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that', 'what', 'who', 'how', 'why', 'when', 'where'
])

// Minimum length for substring matching - shorter guesses must match whole words
const MIN_SUBSTRING_LENGTH = 4

/**
 * Check if a word appears as a complete word in a string (not as a substring of another word)
 */
function isWholeWord(word, str) {
    if (!word || !str) return false
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')
    return regex.test(str)
}

/**
 * Simple singularization - converts common plural forms to singular
 * Handles: -s, -es, -ies endings
 */
function singularize(word) {
    if (!word || word.length < 3) return word

    // Words ending in 'ies' -> 'y' (stories -> story, cities -> city)
    if (word.endsWith('ies') && word.length > 4) {
        return word.slice(0, -3) + 'y'
    }

    // Words ending in 'es' after s, x, z, ch, sh -> remove 'es'
    if (word.endsWith('ses') || word.endsWith('xes') ||
        word.endsWith('zes') || word.endsWith('ches') ||
        word.endsWith('shes')) {
        return word.slice(0, -2)
    }

    // Words ending in 's' (but not 'ss') -> remove 's'
    if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
        return word.slice(0, -1)
    }

    return word
}

/**
 * Singularize all words in a string
 */
function singularizeAll(str) {
    if (!str) return ""
    return str.split(/\s+/).map(singularize).join(' ')
}

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
 * Check if a normalized string is purely numerical (digits only)
 * Used to detect answers like years, counts, quantities
 */
function isPurelyNumerical(str) {
    if (!str) return false
    return /^\d+$/.test(str)
}

/**
 * Extract quoted strings from clue text
 * Returns an array of lowercase quoted words/phrases
 */
function extractQuotedStrings(clueText) {
    if (!clueText) return []
    const results = []

    // Match straight double quotes
    const doubleQuotes = clueText.match(/"([^"]+)"/g)
    if (doubleQuotes) {
        for (const m of doubleQuotes) {
            const inner = basicNormalize(m.slice(1, -1))
            if (inner) results.push(inner)
        }
    }

    // Match curly double quotes (Unicode)
    const curlyQuotes = clueText.match(/\u201c([^\u201d]+)\u201d/g)
    if (curlyQuotes) {
        for (const m of curlyQuotes) {
            const inner = basicNormalize(m.slice(1, -1))
            if (inner) results.push(inner)
        }
    }

    // Match single quotes (but be careful - these could be apostrophes)
    // Only match if it looks like a quoted phrase (has spaces or is ALL CAPS)
    const singleQuotes = clueText.match(/'([^']+)'/g)
    if (singleQuotes) {
        for (const m of singleQuotes) {
            const inner = m.slice(1, -1)
            // Only treat as quoted if it's ALL CAPS or contains a space
            if (/^[A-Z\s]+$/.test(inner) || inner.includes(' ')) {
                const normalized = basicNormalize(inner)
                if (normalized) results.push(normalized)
            }
        }
    }

    return results
}

/**
 * Check if the user's answer is just a quoted hint from the clue
 * This prevents gaming by typing the quoted word from the question
 */
function isJustQuotedHint(userAnswer, clueText) {
    if (!clueText) return false
    const quotedStrings = extractQuotedStrings(clueText)
    if (quotedStrings.length === 0) return false

    const userNormalized = basicNormalize(userAnswer)

    // Check if the user's answer exactly matches any quoted string from the clue
    for (const quoted of quotedStrings) {
        if (userNormalized === quoted) {
            return true
        }
    }
    return false
}

/**
 * Check if two answers match using flexible comparison
 * Returns true if the answers are considered equivalent
 * @param {string} userAnswer - The user's answer
 * @param {string} correctAnswer - The correct answer
 * @param {string} [clueText] - Optional clue text to detect quoted hint gaming
 */
function checkAnswer(userAnswer, correctAnswer, clueText) {
    if (!userAnswer || !correctAnswer) return false

    // Check if user is just typing a quoted word from the clue
    // This must be checked early, before substring matching could accept it
    if (isJustQuotedHint(userAnswer, clueText)) {
        // The user typed exactly what was quoted in the clue - reject this
        // unless it's actually the complete correct answer
        const userNormalized = basicNormalize(userAnswer)
        const correctNormalized = basicNormalize(correctAnswer)
        if (userNormalized !== correctNormalized) {
            return false
        }
    }

    // Normalize both answers
    const userBasic = basicNormalize(userAnswer)
    const correctBasic = basicNormalize(correctAnswer)

    // Exact match after basic normalization
    if (userBasic === correctBasic) return true

    // Trivial words (articles, conjunctions, etc.) can only match if they ARE the entire answer
    // Since we already checked exact match above, if user gave a trivial word it's wrong
    if (TRIVIAL_WORDS.has(userBasic)) return false

    // Try with numbers as digits
    const userDigits = normalize(userAnswer)
    const correctDigits = normalize(correctAnswer)
    if (userDigits === correctDigits) return true

    // Try with numbers as words
    const userWords = normalizeToWords(userAnswer)
    const correctWords = normalizeToWords(correctAnswer)
    if (userWords === correctWords) return true

    // Try with singularization (comics -> comic, comic books -> comic book)
    const userSingular = singularizeAll(userDigits)
    const correctSingular = singularizeAll(correctDigits)
    if (userSingular === correctSingular) return true

    // Check if singularized forms match via substring
    // e.g., "comics" -> "comic" is substring of "comic books" -> "comic book"
    // For short answers, require whole-word matching to prevent gaming with short substrings
    if (correctSingular.length >= 3 && userSingular.includes(correctSingular)) return true
    if (userSingular.length >= MIN_SUBSTRING_LENGTH && correctSingular.includes(userSingular)) return true
    if (userSingular.length >= 3 && userSingular.length < MIN_SUBSTRING_LENGTH && isWholeWord(userSingular, correctSingular)) return true

    // For purely numerical answers (years, counts, quantities), require exact match
    // No fuzzy matching allowed - "1776" should not match "1876"
    if (isPurelyNumerical(correctDigits) && isPurelyNumerical(userDigits)) {
        return false
    }

    // Check if user answer contains the correct answer or vice versa
    // This handles cases like "Jesse James" matching "jesse james" in a longer response
    // But skip this for purely numerical correct answers to prevent partial number matches
    if (!isPurelyNumerical(correctDigits)) {
        // User gave more context than needed - check if correct answer is within their response
        if (correctDigits.length >= 3 && userDigits.includes(correctDigits)) return true

        // User gave partial answer - must be a meaningful portion (>=40%) of the full answer
        // e.g., "stooges" for "the three stooges" (44%) - OK
        // e.g., "and" for "Lincoln and Jefferson" (16%) - NOT OK
        // For short answers (< MIN_SUBSTRING_LENGTH), require whole-word matching
        const partialRatio = userDigits.length / correctDigits.length
        if (userDigits.length >= MIN_SUBSTRING_LENGTH && partialRatio >= 0.4 && correctDigits.includes(userDigits)) {
            return true
        }
        // Short answers (3 chars) can still match but only as whole words with stricter ratio
        if (userDigits.length >= 3 && userDigits.length < MIN_SUBSTRING_LENGTH && partialRatio >= 0.4 && isWholeWord(userDigits, correctDigits)) {
            return true
        }
    }

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
    isPurelyNumerical,
    // Pluralization utilities
    singularize,
    singularizeAll,
    // Fuzzy matching utilities
    damerauLevenshtein,
    isWithinEditDistance,
    doubleMetaphone,
    phoneticMatch,
    isWholeWord,
    // Quoted hint detection
    extractQuotedStrings,
    isJustQuotedHint,
    // Constants for answer validation
    TRIVIAL_WORDS,
    MIN_SUBSTRING_LENGTH
}
