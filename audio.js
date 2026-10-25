// Procedural Web Audio API sound synthesizer - zero external sound assets needed
class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.hasInteracted = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.hasInteracted = true;
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    playMove() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);

        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    playBump() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    playGem() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime + idx * 0.045;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.15);
        });
    }

    playKey() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const freqs = [440, 554.37, 659.25, 880];
        freqs.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime + i * 0.06;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.25);
        });
    }

    playHint() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(640, now + 0.2);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
    }

    playWin() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const chord = [
            { f: 523.25, t: 0 },    // C5
            { f: 659.25, t: 0.1 },  // E5
            { f: 783.99, t: 0.2 },  // G5
            { f: 1046.50, t: 0.3 }, // C6
            { f: 1318.51, t: 0.45 } // E6
        ];

        chord.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime + n.t;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(n.f, now);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.65);
        });
    }
}

window.soundManager = new SoundManager();
