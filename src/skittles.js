const DiscordBot = require("./DiscordBot")
const fs = require("fs")
const path = require("path")
const CSON = require("cson")
const childProcessSpawn = require("child_process").spawn

const TEMP_FILE_CLEANUP_MS = 10 * 60 * 1000 // 10 minutes

const fatal = (...args) => {
    console.error(...args)
    process.exit(1)
}

const clone = (o) => {
    return JSON.parse(JSON.stringify(o))
}

const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; --i) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = array[i]
        array[i] = array[j]
        array[j] = temp
    }
}

const randomString = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

const watch = (filename) => {
    fs.watch(filename, { persistent: false, recursive: true }, (eventType, filename) => {
        console.log(`[${eventType}] ${filename} -> restarting...`)
        process.exit(1)
    })
}

class Skittles {
    constructor() {
        this.configFilename = null
        this.config = {}
        this.bots = []
        this.mods = {}
        this.replacements = {}
        this.actions = []
    }

    init(configFilename) {
        if (this.configFilename) {
            fatal("You may not call skittles.init() twice!")
        }

        this.configFilename = configFilename
        if (!fs.existsSync(this.configFilename)) {
            fatal(`Cannot find config file: ${this.configFilename}`)
        }

        // Watch for changes, so forever can restart the script
        watch(path.join(__dirname, "..", "src"))
        watch(path.join(__dirname, "..", "mods"))
        watch(configFilename)

        // Make an empty, fresh tempdir
        this.tempDir = path.join(__dirname, "..", "skittles.temp")
        try {
            fs.mkdirSync(this.tempDir)
        } catch (e) {
            // Who cares
        }
        const oldTempFiles = fs.readdirSync(this.tempDir)
        for (const oldTempFile of oldTempFiles) {
            const oldTempFilename = path.join(this.tempDir, oldTempFile)
            console.log(`Cleanup: ${oldTempFilename}`)
            try {
                fs.unlinkSync(oldTempFilename)
            } catch (e) {
                // Who cares
            }
        }

        this.config = CSON.parse(fs.readFileSync(this.configFilename))
        if (this.config instanceof Error) {
            fatal(this.config.stack)
        }

        if (!this.config.discordBotToken) {
            return fatal(`Config missing "discordBotToken": ${this.configFilename}`)
        }

        let botTokens = []
        if (Array.isArray(this.config.discordBotToken)) {
            botTokens = this.config.discordBotToken
        } else {
            botTokens = [this.config.discordBotToken]
        }

        for (const botToken of botTokens) {
            let bot = new DiscordBot(botToken)
            bot.on("ready", (tag) => {
                console.log("Logged in: ", tag)
            })
            bot.on("request", (req) => {
                this.request(req)
            })
            bot.login()
            this.bots.push(bot)
        }

        const modDirs = [path.join(__dirname, "..", "mods")]
        for (const modDir of modDirs) {
            if (!fs.existsSync(modDir)) {
                continue
            }

            const files = fs.readdirSync(modDir)
            for (const filename of files) {
                const parsed = path.parse(filename)
                if (parsed.ext != ".js") {
                    continue
                }

                const filePath = path.join(modDir, filename)
                const e = {
                    name: parsed.name,
                    mod: require(filePath)
                }
                this.mods[e.name] = e
                console.log(`Mod Loaded: ${e.name}`)
            }
        }

        this.actions = []
        for (const action of this.config.actions) {
            let a = clone(action)
            a.deck = []
            this.actions.push(a)
        }
    }

    tempFile(ext) {
        while (true) {
            const filename = path.join(this.tempDir, `${randomString()}.${ext}`)
            if (!fs.existsSync(filename)) {
                setTimeout(() => {
                    console.log(`cleaning up: ${filename}`)
                    try {
                        fs.unlinkSync(filename)
                    } catch (e) {
                        // Who cares
                    }
                }, TEMP_FILE_CLEANUP_MS)
                return filename
            }
        }
    }

    addReplacement(replacement, func) {
        this.replacements[replacement] = {
            replacement: replacement,
            func: func
        }
        // console.log(`Replacement: ${replacement}`)
    }

    commands() {
        let cmds = []
        for (const action of this.actions) {
            for (const trigger of action.triggers) {
                if (!action.noop && trigger.indexOf("#") != -1) {
                    let sanitizedTrigger = trigger.replace(/\\b/g, "")
                    sanitizedTrigger = sanitizedTrigger.replace(/\(\.\*\)/g, "")
                    cmds.push([sanitizedTrigger, action.description])
                }
            }
        }
        cmds.sort((a, b) => {
            if (a[0] < b[0]) {
                return -1
            }
            if (a[0] > b[0]) {
                return 1
            }
            return 0
        })
        return cmds
    }

    async replaceAll(matches, text) {
        const regex = /!([^!]+)!/g
        const promises = []
        text.replace(regex, async (match, key) => {
            const promise = this.replacements[key]
                ? this.replacements[key].func(key, matches)
                : new Promise((resolve, reject) => {
                      resolve("")
                  })
            promises.push(promise)
        })
        const data = await Promise.all(promises)
        return text.replace(regex, () => data.shift())
    }

    actionReply(action) {
        if (action.deck.length < 1) {
            action.deck = clone(action.replies)
            shuffle(action.deck)
        }
        return action.deck.pop()
    }

    async request(req) {
        console.log(`Request: "${req.raw}"`)

        for (const action of this.actions) {
            for (const trigger of action.triggers) {
                const capture = req.raw.match(trigger)
                if (capture) {
                    req.action = action
                    console.log(`matched: ${action.description}`)
                    if (action.noop) {
                        // Do nothing!
                        return
                    }
                    const sayIt = Math.floor(Math.random() * 1000)
                    if (!action.chance || sayIt < action.chance) {
                        if (action.mod) {
                            const e = this.mods[action.mod]
                            if (e) {
                                e.mod.request(req, action.key, capture)
                            } else {
                                console.warn(`no mod entry named: ${action.mod}`)
                            }
                        } else {
                            let text = this.actionReply(action)
                            let replacedText = await this.replaceAll(capture, text)
                            req.reply({ text: replacedText, reply: false })
                        }
                    }
                }
            }
        }
    }
}
let instance_ = new Skittles()

const addReplacement = (...args) => {
    return instance_.addReplacement(...args)
}

const spawn = async (executable, args) => {
    return new Promise((resolve, reject) => {
        console.error(`skittles.spawn(${executable}): `, args)

        const proc = childProcessSpawn(executable, args, { stdio: "inherit", cwd: path.join(__dirname, "..") })
        proc.on("error", (err) => {
            console.error(`Failed to spawn process: ${err}`)
            resolve(null)
        })
        proc.on("close", (code) => {
            resolve(true)
        })
    })
}

const modFiles = (modName) => {
    const modDir = path.join(__dirname, "..", "mods", modName)
    if (!fs.existsSync(modDir)) {
        console.log(`modFiles: Doesn't exist: ${modDir}`)
        return []
    }
    let files = []
    const filenames = fs.readdirSync(modDir)
    for (const filename of filenames) {
        const filePath = path.join(modDir, filename)
        files.push(filePath)
    }
    return files
}

const tempFile = (...args) => {
    return instance_.tempFile(...args)
}
const commands = (...args) => {
    return instance_.commands(...args)
}

const init = (...args) => {
    instance_.init(...args)
}

module.exports = {
    fatal,
    clone,
    shuffle,

    Skittles,

    spawn,
    addReplacement,
    modFiles,
    tempFile,
    commands,
    init
}
