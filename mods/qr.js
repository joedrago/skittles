const skittles = require("../src/skittles")
const fs = require("fs")

const request = async (req, key, capture) => {
    const text = capture[1].trim()
    if (!text) {
        return req.reply({ text: "Syntax: `#qr TEXT`" })
    }

    const qrFilename = skittles.tempFile("png")
    const qrBasename = qrFilename.replace(/.png$/, "")

    console.log(`Generating QR '${text}' => ${qrBasename}`)
    const qrRan = await skittles.spawn("qrcode", ["-o", qrBasename, text])
    if (!qrRan || !fs.existsSync(qrFilename)) {
        return req.reply({ text: `Failed to generate QR: \`${text}\`` })
    }

    req.reply({ text: `=>`, files: [qrFilename] })
}

module.exports = {
    request
}
