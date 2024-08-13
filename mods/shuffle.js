const skittles = require("../src/skittles")
const fs = require("fs")

const shuffle = (arr) => {
  let i = arr.length
  let j = 0
  let temp = 0
  while(--i > 0){
    j = Math.floor(Math.random()*(i+1))
    temp = arr[j]
    arr[j] = arr[i]
    arr[i] = temp
  }
}

const request = async (req, key, capture) => {
    const rawWords = capture[1].trim()
    const words = rawWords.split(/ /)
    shuffle(words)
    req.reply({ text: `${words.join(" ")}` })
}

module.exports = {
    request
}
