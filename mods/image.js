const skittles = require("../src/skittles")
const fs = require("fs")
const Jimp = require("jimp")

const googleImageSearch = async (searchTerm) => {
    return new Promise(async (resolve, reject) => {
        const config = skittles.config()
        const cxG = config.googleImageSearch_cx
        const keyG = config.googleImageSearch_key
        if (!cxG || !keyG) {
            resolve({ error: "Google Image Search is misconfigured, sorry." })
            return
        }

        const searchURL = `https://www.googleapis.com/customsearch/v1?q=${encodeURI(
            searchTerm
        )}&cx=${cxG}&fileType=jpg&searchType=image&key=${keyG}`
        const req = await skittles.jsonRequest(searchURL)
        if (req.error) {
            return resolve({ error: req.error })
        }
        if (!req.data || !req.data.items || req.data.items.length < 1) {
            return resolve({ error: "Image search failed." })
        }

        const urls = []
        for (const item of req.data.items) {
            urls.push(item.link)
        }
        return resolve({ urls: urls })
    })
}

const randomGoogleImage = async (req, key, capture) => {
    const searchTerm = capture[1].trim()
    const search = await googleImageSearch(searchTerm)
    if (search.error) {
        return req.reply({ text: `ERROR: ${search.error}` })
    }
    const randomURL = search.urls[Math.floor(Math.random() * search.urls.length)]
    req.reply({ text: randomURL })
}

const compositeImage = async (req, key, capture) => {
    const compositeFilename = req.action.compositeFilename
    if (!compositeFilename) {
        return req.reply({ text: "ERROR: compositeImage is misconfigured, sorry." })
    }

    // Find some image URLs
    const searchTerm = capture[1].trim()
    const search = await googleImageSearch(searchTerm)
    if (search.error) {
        return req.reply({ text: `ERROR: ${search.error}` })
    }

    // Download a random image URL
    const randomURL = search.urls[Math.floor(Math.random() * search.urls.length)]
    const downloaded = await skittles.tempDownload(randomURL)
    if (downloaded.error) {
        return req.reply({ text: `ERROR: ${downloaded.error}` })
    }

    // Load a base image and the downloaded (composite) image
    let baseImage = null
    let compositeImage = null
    try {
        baseImage = await Jimp.read(downloaded.filename)
        compositeImage = await Jimp.read(compositeFilename)
    } catch (e) {
        return req.reply({ text: `ERROR: ${e}` })
    }

    // blit on top depending on mode
    if (req.action.compositeBottomLeft) {
        compositeImage.resize(Jimp.AUTO, Math.floor(baseImage.bitmap.height * req.action.compositeBottomLeft))
        baseImage.blit(compositeImage, 0, baseImage.bitmap.height - compositeImage.bitmap.height)
    } else if (req.action.compositeBottomRandom) {
        compositeImage.resize(Jimp.AUTO, Math.floor(baseImage.bitmap.height * req.action.compositeBottomRandom))
        const wiggleRoom = Math.max(0, baseImage.bitmap.width - compositeImage.bitmap.width)
        const xOffset = Math.floor(Math.random() * wiggleRoom)
        baseImage.blit(compositeImage, xOffset, baseImage.bitmap.height - compositeImage.bitmap.height)
    }

    // Save and upload to discord
    const outputImageFilename = skittles.tempFile("jpg")
    await baseImage.writeAsync(outputImageFilename)
    req.reply({ text: "=>", files: [outputImageFilename] })
}

const request = async (req, key, capture) => {
    switch (key) {
        case "image":
            return randomGoogleImage(req, key, capture)
        case "composite":
            return compositeImage(req, key, capture)
    }
    req.reply({ text: `image module: unknown key ${key}` })
}

module.exports = {
    request
}
