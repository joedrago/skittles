const skittles = require("../src/skittles")
const fs = require("fs")
const Jimp = require("jimp")

const request = async (req, key, capture) => {
    let caption = ""
    if (capture[1]) {
        console.log(capture)
        caption = capture[1].trim()
    }
    if(!req.images) {
        req.reply({ text: `That requires an attached image.` } )
        return
    }

    const chromaVideo = skittles.modFile("chromakey", req.action.chromaVideoBasename + ".mp4")
    const downloaded = await skittles.tempDownload(req.images[0])
    if (downloaded.error) {
        return req.reply({ text: `ERROR: ${downloaded.error}` })
    }

    // Load a base image and the downloaded (composite) image
    let image = null
    let blackFont = null
    let whiteFont = null
    try {
        image = await Jimp.read(downloaded.filename)
        blackFont = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK)
        whiteFont = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE)
    } catch (e) {
        return req.reply({ text: `ERROR: ${e}` })
    }

    const x = req.action.x || 0
    const y = req.action.y || 0
    const w = req.action.w
    const h = req.action.h
    const margin = req.action.margin
    const chromakeyTolerance = req.action.tolerance
    const chromakeyScale = `${w}:${h}`
    const shadow = req.action.shadow

    await image.resize(Jimp.AUTO, h)
    if(image.bitmap.width < w) {
        await image.resize(w, h)
    }
    await image.crop(0, 0, w, h)
    if (caption.length > 0) {
        for(let iy = -1; iy <= 1; ++iy) {
            for(let ix = -1; ix <= 1; ++ix) {
                await image.print(blackFont, x + margin + (shadow * ix), y + margin + (shadow * iy), {
                    text: caption,
                    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    alignmentY: Jimp.VERTICAL_ALIGN_TOP
                }, w - (margin * 2), h - (margin * 2))
            }
        }

        await image.print(whiteFont, x + margin, y + margin, {
            text: caption,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP
        }, w - (margin * 2), h - (margin * 2))
    }
    const imageFilename = skittles.tempFile("jpg")
    await image.writeAsync(imageFilename)

    const reencodeFilename = skittles.tempFile("mp4")
    const reencoded = await skittles.spawn("ffmpeg", [
        "-y",
        "-i", imageFilename,
        "-i", chromaVideo,
        "-filter_complex", `[1:v]scale=${chromakeyScale}[scaleout];[scaleout]colorkey=0x00FF00:${chromakeyTolerance}:0[ckout];[0:v]scale=${chromakeyScale}:force_original_aspect_ratio=decrease,pad=${chromakeyScale}:(ow-iw)/2:(oh-ih)/2,setsar=1[imgout];[imgout][ckout]overlay[out]`,
        "-map", "[out]:v",
        "-map", "1:a",
        reencodeFilename
    ])
    if (!reencoded || !fs.existsSync(reencodeFilename)) {
        return req.reply({ text: `Failed to create chromakey video, sorry.` })
    }

    req.reply({ text: "=>", files: [reencodeFilename] })
}

module.exports = {
    request
}
