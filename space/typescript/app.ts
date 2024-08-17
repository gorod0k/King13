'use strict'

import { startMainloop } from '../node_modules/natlib/scheduling/mainloop.js'

import { con, Settings } from './prelude.js'

const update = () => {
}

const render = () => {
    con.fillStyle = '#000'
    con.fillRect(0, 0, Settings.screenWidth, Settings.screenHeight)
}

startMainloop(update, render)
