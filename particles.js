// High-performance canvas particle system for visual juice
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.ambientMotes = [];
        this.maxAmbient = 35;
    }

    reset() {
        this.particles = [];
        this.ambientMotes = [];
    }

    initAmbient(width, height) {
        this.ambientMotes = [];
        for (let i = 0; i < this.maxAmbient; i++) {
            this.ambientMotes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                size: Math.random() * 2 + 0.8,
                alpha: Math.random() * 0.4 + 0.1,
                baseAlpha: Math.random() * 0.3 + 0.1,
                pulse: Math.random() * Math.PI * 2
            });
        }
    }

    addTrail(x, y, color) {
        for (let i = 0; i < 2; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 6,
                y: y + (Math.random() - 0.5) * 6,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                size: Math.random() * 3.5 + 2,
                color: color || '#00f3ff',
                life: 1.0,
                decay: 0.035 + Math.random() * 0.02,
                type: 'glow'
            });
        }
    }

    burst(x, y, color, count = 18, speed = 3) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
            const velocity = (Math.random() * 0.6 + 0.7) * speed;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                size: Math.random() * 4 + 2.5,
                color: color,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02,
                type: 'spark'
            });
        }
    }

    confetti(width, height) {
        const colors = ['#00f3ff', '#ff007f', '#ffe600', '#00ff88', '#bf55ec', '#ff6b6b'];
        for (let i = 0; i < 70; i++) {
            this.particles.push({
                x: width * 0.5 + (Math.random() - 0.5) * 80,
                y: height * 0.4 + (Math.random() - 0.5) * 80,
                vx: (Math.random() - 0.5) * 12,
                vy: -Math.random() * 10 - 3,
                gravity: 0.28,
                drag: 0.98,
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 15,
                size: Math.random() * 7 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0,
                decay: 0.009 + Math.random() * 0.008,
                type: 'confetti'
            });
        }
    }

    update(dt = 1) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            if (p.gravity) p.vy += p.gravity * dt;
            if (p.drag) {
                p.vx *= p.drag;
                p.vy *= p.drag;
            }
            if (p.rotSpeed) p.rotation += p.rotSpeed * dt;

            p.life -= p.decay * dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render(ctx) {
        ctx.save();

        // Render ambient motes
        for (let mote of this.ambientMotes) {
            mote.pulse += 0.02;
            const currentAlpha = Math.max(0.05, mote.baseAlpha + Math.sin(mote.pulse) * 0.15);
            ctx.fillStyle = `rgba(180, 220, 255, ${currentAlpha})`;
            ctx.beginPath();
            ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Render dynamic particles
        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.life);

            if (p.type === 'glow') {
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'confetti') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                ctx.restore();
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}

window.ParticleSystem = ParticleSystem;
