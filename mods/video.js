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
        case "id": {
            if (!url.match(/^https:\/\/([a-zA-Z0-9]+\.)?(instagram).com\/[^\?]+/)) {
                return req.reply({ text: `Not an Instagram URL?: \`${url}\`` })
            }
            break
        }
    }

    const downloadFilename = skittles.tempFile("mp4")
    const reencodeFilename = skittles.tempFile("mp4")

    console.log(`Downloading ${url} => ${downloadFilename}`)
    let args = ["--remux-video", "mp4", url, "-o", downloadFilename]
    if(req.action.cookies) {
        args.push("--cookies")
        args.push(req.action.cookies)
    }
    const downloaded = await skittles.spawn("yt-dlp", args)
    if (!downloaded || !fs.existsSync(downloadFilename)) {
        return req.reply({ text: `Failed to download video: ${url}` })
    }

    if(req.action.skipEncode) {
        console.log(`Copying ${downloadFilename} => ${reencodeFilename}`)
        const copied = await skittles.spawn("cp", [downloadFilename, reencodeFilename])
        if (!copied || !fs.existsSync(reencodeFilename)) {
            return req.reply({ text: `Failed to copy video: ${url}` })
        }
    } else {
        console.log(`Reencoding ${downloadFilename} => ${reencodeFilename}`)
        const reencoded = await skittles.spawn("ffmpeg", ["-i", downloadFilename, reencodeFilename, "-c:v", "h264", "-c:a", "aac"])
        if (!reencoded || !fs.existsSync(reencodeFilename)) {
            return req.reply({ text: `Failed to reencode video: ${url}` })
        }
    }

    req.reply({ text: `=>`, files: [reencodeFilename] })
}

module.exports = {
    request
}
