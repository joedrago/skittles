const skittles = require("../src/skittles")
const fs = require("fs")
const path = require("path")

let madlibs = {}

const filenames = skittles.modFiles("madlibs")
for (const filename of filenames) {
    const parsed = path.parse(filename)
    const pool = fs
        .readFileSync(filename, "utf8")
        .split(/[\r\n]/)
        .filter((l) => {
            return l.length > 0
        })

    const key = `ML_${parsed.name}`
    let e = {
        key: key,
        pool: pool,
        deck: []
    }

    skittles.addReplacement(key, async () => {
        if (e.deck.length < 1) {
            e.deck = skittles.clone(e.pool)
            skittles.shuffle(e.deck)
        }
        return e.deck.pop()
    })
}
