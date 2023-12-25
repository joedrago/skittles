const skittles = require("../src/skittles")
const fs = require("fs")

const request = async (req, key, capture) => {
    let args = capture[1].trim().split(/\s+/)
    const url = args.shift()
    const start = args.shift()
    const duration = args.shift()

    if (!url || !start || !duration) {
        return req.reply({ text: "Syntax: `#gif YOUTUBE_URL START_SECONDS DURATION_SECONDS`" })
    }

    const downloadFilename = skittles.tempFile("mp4")
    const gifFilename = skittles.tempFile("gif")

    console.log(`Downloading ${url} => ${downloadFilename}`)
    const downloaded = await skittles.spawn("yt-dlp", ["--remux-video", "mp4", url, "-o", downloadFilename])
    if (!downloaded || !fs.existsSync(downloadFilename)) {
        return req.reply({ text: `Failed to download video: ${url}` })
    }

    console.log(`Generating GIF ${downloadFilename} => ${gifFilename}`)
    const reencoded = await skittles.spawn("ffmpeg", [
        "-ss",
        start,
        "-t",
        duration,
        "-i",
        downloadFilename,
        "-filter_complex",
        "[0:v] fps=12,scale=480:-1,split [a][b];[a] palettegen [p];[b][p] paletteuse",
        gifFilename
    ])
    if (!reencoded || !fs.existsSync(gifFilename)) {
        return req.reply({ text: `Failed to create GIF: ${url}` })
    }

    req.reply({ text: `=>`, files: [gifFilename] })
}

module.exports = {
    request
}
