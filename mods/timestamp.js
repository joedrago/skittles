const skittles = require("../src/skittles")
const sugar = require("sugar")

const request = async (req, key, capture) => {
    const rawTime = capture[1].trim()
    const sugarDate = new sugar.Date(rawTime, { fromUTC: false })
    const timestamp = Math.floor(parseInt(sugarDate.format("{x}")) / 1000)
    console.log("Timestamp: ", timestamp)
    req.reply({ text: `<t:${timestamp}> - \`<t:${timestamp}>\`\n<t:${timestamp}:R> - \`<t:${timestamp}:R>\`` })
}

module.exports = {
    request
}
