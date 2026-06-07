let hasPlayedSplashDing = false

function playDing(audioContext) {
  const now = audioContext.currentTime
  const master = audioContext.createGain()
  const tone = audioContext.createOscillator()
  const overtone = audioContext.createOscillator()
  const sparkle = audioContext.createOscillator()
  const toneGain = audioContext.createGain()
  const overtoneGain = audioContext.createGain()
  const sparkleGain = audioContext.createGain()
  const filter = audioContext.createBiquadFilter()

  tone.type = 'sine'
  overtone.type = 'triangle'
  sparkle.type = 'sine'
  tone.frequency.setValueAtTime(1568, now)
  overtone.frequency.setValueAtTime(2352, now)
  sparkle.frequency.setValueAtTime(3136, now)

  filter.type = 'highpass'
  filter.frequency.setValueAtTime(980, now)
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(0.16, now + 0.012)
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.46)

  toneGain.gain.setValueAtTime(0.0001, now)
  overtoneGain.gain.setValueAtTime(0.0001, now)
  sparkleGain.gain.setValueAtTime(0.0001, now)
  toneGain.gain.exponentialRampToValueAtTime(0.56, now + 0.014)
  toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42)
  overtoneGain.gain.exponentialRampToValueAtTime(0.48, now + 0.018)
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  sparkleGain.gain.exponentialRampToValueAtTime(0.32, now + 0.008)
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)

  tone.frequency.exponentialRampToValueAtTime(1760, now + 0.055)
  overtone.frequency.exponentialRampToValueAtTime(2637, now + 0.07)

  tone.connect(toneGain)
  overtone.connect(overtoneGain)
  sparkle.connect(sparkleGain)
  toneGain.connect(filter)
  overtoneGain.connect(filter)
  sparkleGain.connect(filter)
  filter.connect(master)
  master.connect(audioContext.destination)

  tone.start(now)
  overtone.start(now + 0.03)
  sparkle.start(now)
  tone.stop(now + 0.5)
  overtone.stop(now + 0.36)
  sparkle.stop(now + 0.2)

  tone.addEventListener('ended', () => {
    tone.disconnect()
    overtone.disconnect()
    sparkle.disconnect()
    toneGain.disconnect()
    overtoneGain.disconnect()
    sparkleGain.disconnect()
    filter.disconnect()
    master.disconnect()
  })
}

export function playSplashDing() {
  if (hasPlayedSplashDing || typeof window === 'undefined') return undefined

  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return undefined

  const audioContext = new AudioContext()
  let didCancel = false

  async function play() {
    if (didCancel || hasPlayedSplashDing) return

    try {
      await audioContext.resume()
      if (audioContext.state !== 'running') {
        throw new Error('Audio context is not running')
      }

      playDing(audioContext)
      hasPlayedSplashDing = true
      window.removeEventListener('pointerdown', play)
      window.removeEventListener('keydown', play)
      window.setTimeout(() => {
        if (audioContext.state !== 'closed') {
          audioContext.close()
        }
      }, 1000)
    } catch {
      window.addEventListener('pointerdown', play, { once: true })
      window.addEventListener('keydown', play, { once: true })
    }
  }

  play()

  return () => {
    didCancel = true
    window.removeEventListener('pointerdown', play)
    window.removeEventListener('keydown', play)
    if (audioContext.state !== 'closed') {
      audioContext.close()
    }
  }
}
