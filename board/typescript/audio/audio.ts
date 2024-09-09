/** This file is part of King Thirteen.
 * https://github.com/mvasilkov/board2024
 * @license Proprietary | Copyright (c) 2024 Mark Vasilkov
 */
'use strict'

import { convertMidiToFrequency } from '../../node_modules/natlib/audio/audio.js'
import { AudioHandle } from '../../node_modules/natlib/audio/AudioHandle.js'
import type { ExtendedBool } from '../../node_modules/natlib/prelude'
import { Mulberry32 } from '../../node_modules/natlib/prng/Mulberry32.js'
import { randomUint32LessThan } from '../../node_modules/natlib/prng/prng.js'

import { ImpulseResponse } from './ImpulseResponse.js'
import { play } from './song.js'

const TEMPO_MUL = 120 / 70

export const audioHandle = new AudioHandle

const prng = new Mulberry32(9)

let audioOut: GainNode
let audioOutEffects: GainNode
let songStart: number

export const initializeAudio = (con: AudioContext) => {
    const mute = localStorage.getItem('king13.mute') === '1'

    audioOut = new GainNode(con, { gain: mute ? 0 : 0.3333 })
    audioOutEffects = new GainNode(con, { gain: 0.3333 })

    // Reverb
    const convolver = new ConvolverNode(con)
    const reverbDry = new GainNode(con, { gain: 0.5 })
    const reverbWet = new GainNode(con, { gain: 0.3333 })

    audioOut.connect(convolver)
    audioOut.connect(reverbDry)
    audioOutEffects.connect(convolver)
    audioOutEffects.connect(reverbDry)
    convolver.connect(reverbWet)
    reverbDry.connect(con.destination)
    reverbWet.connect(con.destination)

    const ir = new ImpulseResponse(2, con.sampleRate, prng)
    ir.generateReverb(buf => {
        convolver.buffer = buf

        songStart = con.currentTime + 0.05

        enqueue()
        setInterval(enqueue, 999)
    }, 16000, 1000, 2 * TEMPO_MUL, 0.00001, -90)
}

export function toggleAudio(off: ExtendedBool) {
    if (audioOut) {
        audioOut.gain.value = off ? 0 : 0.3333
    }
}

function decay(osc: OscillatorNode, start: number) {
    const envelope = new GainNode(audioHandle.con!, { gain: 0.5 })
    envelope.gain.setValueAtTime(0.5, songStart + start)
    envelope.gain.exponentialRampToValueAtTime(0.00001, songStart + start + 2 * TEMPO_MUL)
    osc.connect(envelope)
    return envelope
}

function playNote(n: number, start: number, end: number) {
    start *= TEMPO_MUL
    end *= TEMPO_MUL

    const osc = new OscillatorNode(audioHandle.con!, {
        type: 'square',
        frequency: convertMidiToFrequency(n),
    })
    decay(osc, start).connect(audioOut)
    osc.start(songStart + start)
    osc.stop(songStart + end)
}

let prevPart = -1

function enqueue() {
    let bufferWanted = audioHandle.con!.currentTime - songStart + 4
    let queued = (prevPart + 1) * TEMPO_MUL

    if (queued > bufferWanted) return
    bufferWanted += 4

    while (queued < bufferWanted) {
        const n = ++prevPart
        play((index, start, end) => playNote(index, start + n, end + n), n % 57)

        queued += TEMPO_MUL
    }
}

// Sound effects

export const enum SoundEffect {
    BUTTON_CLICK,
    CONNECT,
    DISCONNECT,
    WIN,
}

export function sound(effect: SoundEffect) {
    if (!audioOutEffects) return

    switch (effect) {
        case SoundEffect.BUTTON_CLICK:
            playNote2(91, 0, 0.04) // G6
            break

        case SoundEffect.CONNECT:
            playNote2(76, 0, 0.05) // E5
            playNote2(79, 0.05, 0.05) // G5
            playNote2(83, 0.1, 0.1) // B5
            break

        case SoundEffect.DISCONNECT:
            playNote2(83, 0, 0.05) // B5
            playNote2(79, 0.05, 0.05) // G5
            playNote2(76, 0.1, 0.1) // E5
            break

        case SoundEffect.WIN:
            playNote2(74, 0, 0.05) // D5
            playNote2(76, 0.05, 0.05) // E5
            playNote2(79, 0.1, 0.05) // G5
            playNote2(83, 0.15, 0.05) // B5
            playNote2(86, 0.2, 0.05) // D6
            playNote2(88, 0.25, 0.1) // E6
            break

        /*
        case SoundEffect.LEVEL_END:
            playNote2(92, 0, 0.1) // Ab6
            playNote2(87, 0.1, 0.1) // Eb6
            playNote2(80, 0.2, 0.1) // Ab5
            playNote2(82, 0.3, 0.1) // Bb5
            break
        */
    }
}

// playNote() but for sound effects
function playNote2(n: number, start: number, duration: number) {
    start += audioHandle.con!.currentTime

    const osc = new OscillatorNode(audioHandle.con!, {
        type: 'square',
        frequency: convertMidiToFrequency(n),
    })
    // decay(osc, start).connect(audioOut)
    osc.connect(audioOutEffects)
    osc.start(start)
    osc.stop(start + duration)
}

// B, C, D, D#, E, F#, G, A
const stepNotes = [35, 36, 38, 39, 40, 42, 43, 45]

export function step() {
    if (!audioOutEffects) return

    const con = audioHandle.con!

    const start = con.currentTime
    const duration = 0.2
    const frequency = convertMidiToFrequency(stepNotes[randomUint32LessThan(prng, stepNotes.length)]!)

    const osc = new OscillatorNode(con, {
        type: 'square',
        frequency: frequency,
    })
    const gain = new GainNode(con)

    osc.connect(gain)
    gain.connect(audioOutEffects)

    osc.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(1, start)

    osc.frequency.exponentialRampToValueAtTime(0.5 * frequency, start + duration)
    gain.gain.exponentialRampToValueAtTime(0.00001, start + duration)

    osc.start(start)
    osc.stop(start + duration)
}
