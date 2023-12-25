const skittles = require("../src/skittles")
const fs = require("fs")

const request = async (req, key, capture) => {
    let url = capture[1].trim()

    console.log(`capture: `, capture)

    switch (key) {
        case "tta": {
            if (!url.match(/^https:\/\/[a-zA-Z0-9]+\.tiktok.com\/[^\?]+/)) {
                return req.reply({ text: `Not a TikTok URL?: \`${url}\`` })
            }
            break
        }
    }

    console.log(`TTA: ${url}`)
    const https = require("follow-redirects").https
    const httpsReq = https.request(
        url,
        {
            method: "HEAD",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 6.1)"
            }
        },
        (res) => {
            let redirectedUrl = res.responseUrl.replace(/\?.+/, "")
            req.reply({ text: redirectedUrl })
        }
    )
    httpsReq.on("error", (err) => {
        req.reply({ text: `Failed to anonymize URL, sorry.` })
    })
    httpsReq.end()
}

module.exports = {
    request
}
