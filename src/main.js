#!/usr/bin/env node

const { init } = require("./skittles")
const path = require("path")

init(path.join(__dirname, "..", "skittles.toml"))
