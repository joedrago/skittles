#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const readline = require("readline")
const http = require("http")
const https = require("https")
const childProcessSpawn = require("child_process").spawn

// =============================================================================
// Mock skittles module
// =============================================================================

const TEMP_DIR = path.join(__dirname, "skittles.temp.debug")

// Ensure temp directory exists
try {
    fs.mkdirSync(TEMP_DIR)
} catch (e) {
    // Already exists, that's fine
}

const randomString = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

const mockSkittles = {
    config: {},

    tempFile(ext) {
        while (true) {
            const filename = path.join(TEMP_DIR, `${randomString()}.${ext}`)
            if (!fs.existsSync(filename)) {
                console.log(`[skittles.tempFile] => ${filename}`)
                return filename
            }
        }
    },

    async tempDownload(url, forcedExtension) {
        return new Promise((resolve, reject) => {
            const proto = !url.charAt(4).localeCompare("s") ? https : http

            let ext = ""
            if (forcedExtension && forcedExtension.length > 0) {
                ext = forcedExtension
            } else {
                let parsedURL = null
                let parsed = null
                try {
                    parsedURL = new URL(url)
                    parsed = path.parse(parsedURL.pathname)
                } catch (e) {
                    return resolve({ error: `Not a valid URL: ${url}` })
                }
                ext = parsed.ext.substr(1)
            }
            if (!ext.length) {
                return resolve({ error: `Couldn't detect extension: ${url}` })
            }

            const tempFilename = this.tempFile(ext)
            const req = proto.request(
                url,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json"
                    }
                },
                (res) => {
                    if (res.statusCode !== 200) {
                        resolve({ error: `Failed to get \`${url}\` (${res.statusCode})` })
                        return
                    }

                    const file = fs.createWriteStream(tempFilename)
                    res.pipe(file)

                    file.on("finish", () => {
                        resolve({ filename: tempFilename })
                    })
                }
            )
            console.log(`[skittles.tempDownload] ${url} => ${tempFilename}`)
            req.on("error", (e) => {
                resolve({ error: e })
            })
            req.end()
        })
    },

    modFile(modName, filename) {
        const result = path.join(__dirname, "mods", modName, filename)
        console.log(`[skittles.modFile] (${modName}, ${filename}) => ${result}`)
        return result
    },

    modFiles(modName) {
        const modDir = path.join(__dirname, "mods", modName)
        if (!fs.existsSync(modDir)) {
            console.log(`[skittles.modFiles] Doesn't exist: ${modDir}`)
            return []
        }
        let files = []
        const filenames = fs.readdirSync(modDir)
        for (const filename of filenames) {
            const filePath = path.join(modDir, filename)
            files.push(filePath)
        }
        console.log(`[skittles.modFiles] (${modName}) => ${files.length} files`)
        return files
    },

    async spawn(executable, args, lines = false) {
        return new Promise((resolve, reject) => {
            console.log(`[skittles.spawn] ${executable}`, args)

            const stdio = lines ? "pipe" : "inherit"
            const proc = childProcessSpawn(executable, args, { stdio: stdio, cwd: __dirname })
            let output = ""
            proc.on("error", (err) => {
                console.error(`[skittles.spawn] Failed: ${err}`)
                resolve(null)
            })
            if (lines) {
                proc.stdout.on("data", (data) => {
                    output += data
                })
            }
            proc.on("close", (code) => {
                if (lines) {
                    resolve(output.split(/[\r\n]/))
                } else {
                    resolve(true)
                }
            })
        })
    },

    async jsonRequest(url, postdata = null) {
        return new Promise((resolve, reject) => {
            const method = postdata ? "POST" : "GET"
            const req = https.request(
                url,
                {
                    method: method,
                    headers: {
                        "Content-Type": "application/json"
                    }
                },
                (res) => {
                    let raw = ""
                    res.on("data", (chunk) => {
                        raw += chunk
                    })
                    res.on("end", () => {
                        let data = null
                        try {
                            data = JSON.parse(raw)
                        } catch (e) {
                            data = null
                        }
                        resolve({ raw: raw, data: data })
                    })
                }
            )
            if (postdata) {
                req.write(JSON.stringify(postdata))
            }
            console.log(`[skittles.jsonRequest] ${method} ${url}`)
            req.on("error", (e) => {
                resolve({ error: e })
            })
            req.end()
        })
    },

    shout(guildSnowflake, channelSnowflake, text) {
        console.log(`[skittles.shout] guild=${guildSnowflake} channel=${channelSnowflake} text="${text}"`)
    },

    addReplacement(replacement, func) {
        console.log(`[skittles.addReplacement] ${replacement}`)
    },

    commands() {
        return []
    },

    cli() {
        return true
    },

    fatal(...args) {
        console.error("[FATAL]", ...args)
        process.exit(1)
    },

    clone(o) {
        return JSON.parse(JSON.stringify(o))
    },

    shuffle(array) {
        for (let i = array.length - 1; i > 0; --i) {
            const j = Math.floor(Math.random() * (i + 1))
            const temp = array[i]
            array[i] = array[j]
            array[j] = temp
        }
    }
}

// Inject our mock skittles into the require cache BEFORE loading the mod
const skittlesPath = require.resolve("./src/skittles")
require.cache[skittlesPath] = {
    id: skittlesPath,
    filename: skittlesPath,
    loaded: true,
    exports: mockSkittles
}

// =============================================================================
// CLI and REPL
// =============================================================================

const args = process.argv.slice(2)

if (args.length < 1) {
    console.log("Usage: node mod-debug.js <mod-name> [key]")
    console.log("")
    console.log("  mod-name   Name of the mod to load (e.g., 'jeopardy', 'gif')")
    console.log("  key        Optional key to pass to the mod (default: none)")
    console.log("")
    console.log("Available mods:")
    const modsDir = path.join(__dirname, "mods")
    const files = fs.readdirSync(modsDir)
    for (const file of files) {
        if (file.endsWith(".js")) {
            console.log(`  - ${file.replace(".js", "")}`)
        }
    }
    process.exit(1)
}

const modName = args[0]
let currentKey = args[1] || null

// Load the mod
const modPath = path.join(__dirname, "mods", `${modName}.js`)
if (!fs.existsSync(modPath)) {
    console.error(`Error: Mod not found: ${modPath}`)
    process.exit(1)
}

console.log(`\n=== Mod Debug REPL ===`)
console.log(`Loading mod: ${modName}`)
if (currentKey) {
    console.log(`Initial key: ${currentKey}`)
}
console.log("")

let mod
try {
    mod = require(modPath)
} catch (err) {
    console.error(`Error loading mod: ${err.message}`)
    console.error(err.stack)
    process.exit(1)
}

if (!mod.request) {
    console.error(`Error: Mod does not export a 'request' function`)
    process.exit(1)
}

console.log(`Mod loaded successfully!\n`)

// REPL state
let channelId = "debug-channel-123"
let isDM = false
let images = []
let rawMode = "capture1" // "capture1" = req.raw is capture[1], "full" = req.raw is full input

function printHelp() {
    console.log(`
Commands:
  .help              Show this help
  .key <name>        Set the key passed to the mod (current: ${currentKey || "(none)"})
  .channel <id>      Set channel ID (current: ${channelId})
  .dm <true|false>   Set DM mode (current: ${isDM})
  .images <url,...>  Set image URLs (comma-separated, or empty to clear)
  .state             Show current REPL state
  .quit              Exit the REPL

Sending messages:
  Just type any text and press Enter to send it as a message to the mod.
  The text becomes both req.raw and capture[0], with capture[1] being everything
  after the first word (simulating a typical trigger pattern like "!command (.*)")

  Use ">" prefix for a raw capture override:
  > foo|bar|baz      Sets capture = ["foo|bar|baz", "foo", "bar", "baz"] (split by |)
`)
}

function printState() {
    console.log(`
Current State:
  Mod:      ${modName}
  Key:      ${currentKey || "(none)"}
  Channel:  ${channelId}
  DM:       ${isDM}
  Images:   ${images.length > 0 ? images.join(", ") : "(none)"}
`)
}

async function sendRequest(raw, captureOverride = null) {
    // Build capture array
    let capture
    if (captureOverride) {
        capture = captureOverride
    } else {
        // Simulate a typical trigger: capture[0] = full match, capture[1] = rest after first word
        const firstSpace = raw.indexOf(" ")
        if (firstSpace > 0) {
            capture = [raw, raw.substring(firstSpace + 1)]
        } else {
            capture = [raw, ""]
        }
    }

    // Build the request object
    const req = {
        channel: channelId,
        dm: isDM,
        raw: raw,
        ref: null,
        images: images.length > 0 ? [...images] : undefined,
        action: {
            key: currentKey,
            mod: modName
        },
        suppress: () => {
            console.log(`  [req.suppress() called]`)
        },
        reply: async (r) => {
            console.log(`\n  ╭─────────────────────────────────────`)
            console.log(`  │ req.reply() called:`)
            console.log(`  │   text: ${JSON.stringify(r.text)}`)
            if (r.reply !== undefined) {
                console.log(`  │   reply: ${r.reply}`)
            }
            if (r.files) {
                console.log(`  │   files: ${JSON.stringify(r.files)}`)
            }
            console.log(`  ╰─────────────────────────────────────\n`)
        }
    }

    // Print debug info about what we're sending
    console.log(`\n╔═══════════════════════════════════════════════════════════════`)
    console.log(`║ Sending request to mod: ${modName}`)
    console.log(`╠═══════════════════════════════════════════════════════════════`)
    console.log(`║ key:     ${currentKey || "(none)"}`)
    console.log(`║ capture: ${JSON.stringify(capture)}`)
    console.log(`║ req.raw: ${JSON.stringify(raw)}`)
    console.log(`║ req.dm:  ${isDM}`)
    if (images.length > 0) {
        console.log(`║ req.images: ${JSON.stringify(images)}`)
    }
    console.log(`╚═══════════════════════════════════════════════════════════════\n`)

    try {
        await mod.request(req, currentKey, capture)
    } catch (err) {
        console.error(`\n  ⚠ Error from mod.request():`)
        console.error(`    ${err.message}`)
        console.error(err.stack)
    }
}

// Start the REPL
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${modName}> `
})

printHelp()
rl.prompt()

rl.on("line", async (line) => {
    const trimmed = line.trim()

    if (trimmed === "") {
        rl.prompt()
        return
    }

    // Handle commands
    if (trimmed.startsWith(".")) {
        const parts = trimmed.split(/\s+/)
        const cmd = parts[0].toLowerCase()

        switch (cmd) {
            case ".help":
                printHelp()
                break

            case ".key":
                currentKey = parts[1] || null
                console.log(`Key set to: ${currentKey || "(none)"}`)
                break

            case ".channel":
                channelId = parts[1] || "debug-channel-123"
                console.log(`Channel set to: ${channelId}`)
                break

            case ".dm":
                isDM = parts[1] === "true"
                console.log(`DM mode set to: ${isDM}`)
                break

            case ".images":
                if (parts[1]) {
                    images = parts[1].split(",").map((s) => s.trim())
                } else {
                    images = []
                }
                console.log(`Images set to: ${images.length > 0 ? images.join(", ") : "(none)"}`)
                break

            case ".state":
                printState()
                break

            case ".quit":
            case ".exit":
            case ".q":
                console.log("Goodbye!")
                process.exit(0)

            default:
                console.log(`Unknown command: ${cmd}. Type .help for help.`)
        }

        rl.prompt()
        return
    }

    // Handle raw capture override
    if (trimmed.startsWith(">")) {
        const captureStr = trimmed.substring(1).trim()
        const capture = captureStr.split("|")
        await sendRequest(capture[0], capture)
        rl.prompt()
        return
    }

    // Send as a normal message
    await sendRequest(trimmed)
    rl.prompt()
})

rl.on("close", () => {
    console.log("\nGoodbye!")
    process.exit(0)
})
