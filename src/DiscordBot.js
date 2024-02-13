const { EventEmitter } = require("node:events")
const Discord = require("discord.js")

const DiscordBot = class DiscordBot {
    constructor(secret) {
        this.secret = secret
        this.emitter = new EventEmitter()
        this.on = this.emitter.on.bind(this.emitter)
        this.discordClient = new Discord.Client({
            partials: [Discord.Partials.Channel],
            intents: [
                Discord.IntentsBitField.Flags.Guilds,
                Discord.IntentsBitField.Flags.GuildMessages,
                Discord.IntentsBitField.Flags.DirectMessages,
                Discord.IntentsBitField.Flags.DirectMessageReactions,
                Discord.IntentsBitField.Flags.MessageContent
            ]
        })
        this.discordClient.on("ready", this.discordReady.bind(this))
        this.discordClient.on("messageCreate", this.discordMessage.bind(this))
    }

    discordReady() {
        this.discordTag = this.discordClient.user.tag
        this.emitter.emit("ready", this.discordTag)
    }

    async discordMessage(msg) {
        // console.log(msg)

        if (msg.author.bot) {
            return
        }

        if (!msg.content || msg.content.length < 1) {
            return
        }

        let ref = null
        if (msg.type === Discord.MessageType.Reply) {
            ref = await msg.fetchReference()
            if (ref.author.id !== this.discordClient.user.id) {
                // Only send this if the person is trying to reply to us
                ref = null
            }
        }

        let raw = msg.content.trim()
        let req = {
            discordMsg: msg,
            dm: !msg.inGuild(),
            raw: raw,
            ref: ref
        }

        if (msg.attachments != null) {
            msg.attachments.each(function (a) {
                if (
                    a.url != null &&
                    (a.contentType === "image/png" || a.contentType === "image/jpg" || a.contentType === "image/jpeg")
                ) {
                    if (req.images == null) {
                        req.images = []
                    }
                    return req.images.push(a.url)
                }
            })
        }
        req.suppress = function() {
            if (req.discordMsg.inGuild()) {
                console.log("Suppressing embeds...")
                req.discordMsg.suppressEmbeds(true)
            } else {
                console.log("It's a DM, not suppressing embeds...")
            }
        }
        req.reply = async function (r) {
            if (!r.text) {
                console.warn("DiscordBot: Ignoring reply with no .text field")
                return
            }

            let msgPayload = {
                content: r.text,
                allowedMentions: {
                    repliedUser: false // don't ping the user, it is annoying
                }
            }

            let msgUploadError = {
                content: "Upload error!",
                allowedMentions: {
                    repliedUser: false
                }
            }

            if (r.files) {
                msgPayload.files = r.files
            }

            if (r.reply) {
                try {
                    await req.discordMsg.reply(msgPayload)
                } catch (e) {
                    console.log(`Upload error: ${e}`)
                    req.discordMsg.reply(msgUploadError)
                }
            } else {
                try {
                    await req.discordMsg.channel.send(msgPayload)
                } catch (e) {
                    console.log(`Upload error: ${e}`)
                    req.discordMsg.channel.send(msgUploadError)
                }
            }
        }
        this.emitter.emit("request", req)
    }

    login() {
        this.discordClient.login(this.secret)
    }
}

module.exports = DiscordBot
