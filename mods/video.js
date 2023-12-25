const skittles = require("../src/skittles")
const fs = require("fs")

const request = async (req, key, capture) => {
    let url = capture[1].trim()

    console.log(`capture: `, capture)

    switch (key) {
        case "ttd": {
            if (!url.match(/^https:\/\/[a-zA-Z0-9]+\.tiktok.com\/[^\?]+/)) {
                return req.reply({ text: `Not a TikTok URL?: \`${url}\`` })
            }
            break
        }
        case "td": {
            if (!url.match(/^https:\/\/([a-zA-Z0-9]+\.)?(twitter|x).com\/[^\?]+/)) {
                return req.reply({ text: `Not a Twitter URL?: \`${url}\`` })
            }
            break
        }
    }

    const downloadFilename = skittles.tempFile("mp4")
    const reencodeFilename = skittles.tempFile("mp4")

    console.log(`Downloading ${url} => ${downloadFilename}`)
    const downloaded = await skittles.spawn("yt-dlp", ["--remux-video", "mp4", url, "-o", downloadFilename])
    if (!downloaded || !fs.existsSync(downloadFilename)) {
        return req.reply({ text: `Failed to download video: ${url}` })
    }

    console.log(`Reencoding ${downloadFilename} => ${downloadFilename}`)
    const reencoded = await skittles.spawn("ffmpeg", ["-i", downloadFilename, reencodeFilename, "-c:v", "h264", "-c:a", "aac"])
    if (!reencoded || !fs.existsSync(reencodeFilename)) {
        return req.reply({ text: `Failed to reencode video: ${url}` })
    }

    req.reply({ text: `=>`, files: [reencodeFilename] })
}

module.exports = {
    request
}
