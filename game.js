// Self-Learning Non-Deterministic Multi-Agent Brain
// Zero pre-programmed paths. Agents discover the maze purely by trial, error, and reinforcement.
class SelfLearningBrain {
    constructor(cols, rows, goal) {
        this.reset(cols, rows, goal);
    }

    reset(cols, rows, goal) {
        this.cols = cols;
        this.rows = rows;
        this.goal = { ...goal };

        // Learned Value Table V(s) — starts with 0.0 everywhere. No pre-loaded heuristic!
        this.V = Array.from({ length: rows }, () => Array(cols).fill(0.0));

        // Visit counter for curiosity & exploration encouragement
        this.visits = Array.from({ length: rows }, () => Array(cols).fill(0));

        // Walls physically encountered by agents (starts completely unknown)
        this.knownWalls = Array.from({ length: rows }, () => Array(cols).fill(false));

        this.restartsCount = 0;
        this.goalReached = false;
        this.bestPath = null;
    }

    clearLearning() {
        this.V = Array.from({ length: this.rows }, () => Array(this.cols).fill(0.0));
        this.visits = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
        this.knownWalls = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
        this.restartsCount = 0;
        this.goalReached = false;
        this.bestPath = null;
    }

    getExplorationPercentage(maze) {
        let visitedCount = 0;
        let totalPassable = 0;

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (maze.grid[y][x] === 0) {
                    totalPassable++;
                    if (this.visits[y][x] > 0) {
                        visitedCount++;
                    }
                }
            }
        }
        return totalPassable > 0 ? Math.round((visitedCount / totalPassable) * 100) : 0;
    }
}

// Autonomous Agent with Non-Deterministic Softmax Exploration
class NonDeterministicLearner {
    constructor(id, color, startPos) {
        this.id = id;
        this.color = color;
        this.startPos = { ...startPos };
        this.x = startPos.x;
        this.y = startPos.y;
        this.renderX = startPos.x;
        this.renderY = startPos.y;
        this.path = [{ x: startPos.x, y: startPos.y }];
        this.status = 'exploring'; // 'exploring' | 'reached_goal'
    }

    reset() {
        this.x = this.startPos.x;
        this.y = this.startPos.y;
        this.renderX = this.startPos.x;
        this.renderY = this.startPos.y;
        this.path = [{ x: this.startPos.x, y: this.startPos.y }];
        this.status = 'exploring';
    }

    step(maze, goal, brain, particles, sound, cellSize) {
        if (this.status === 'reached_goal') return;

        // Check if agent reached the goal
        if (this.x === goal.x && this.y === goal.y) {
            this.handleGoalReached(brain, particles, sound, cellSize);
            return;
        }

        const dirs = [
            { x: 0, y: -1 }, // North
            { x: 1, y: 0 },  // East
            { x: 0, y: 1 },  // South
            { x: -1, y: 0 }  // West
        ];

        // Probe immediate adjacent cells locally (learning walls dynamically)
        const validMoves = [];
        for (const d of dirs) {
            const nx = this.x + d.x;
            const ny = this.y + d.y;

            if (nx >= 0 && nx < brain.cols && ny >= 0 && ny < brain.rows) {
                if (maze.grid[ny][nx] === 1) {
                    brain.knownWalls[ny][nx] = true; // Discover wall through local sensing
                } else {
                    validMoves.push({ x: nx, y: ny });
                }
            }
        }

        // Avoid immediately looping back into the path visited on this current attempt
        const forwardMoves = validMoves.filter(m => !this.path.some(p => p.x === m.x && p.y === m.y));

        // If no unvisited forward path exists -> AGENT IS STUCK AT A DEAD END!
        if (forwardMoves.length === 0) {
            this.handleStuck(brain, particles, sound, cellSize);
            return;
        }

        // NON-DETERMINISTIC SOFTMAX EXPLORATION
        // Value = learned V(s) + novelty bonus (curiosity for unvisited tiles)
        const temperature = 1.15; // Softmax temperature controls exploration vs exploitation
        const scores = forwardMoves.map(m => {
            const learnedVal = brain.V[m.y][m.x];
            const novelty = 3.2 / (1.0 + brain.visits[m.y][m.x]);
            return learnedVal + novelty;
        });

        // Compute Softmax probabilities
        const maxScore = Math.max(...scores);
        const expScores = scores.map(s => Math.exp((s - maxScore) / temperature));
        const sumExp = expScores.reduce((a, b) => a + b, 0);
        const probs = expScores.map(e => e / sumExp);

        // Stochastic choice using Math.random() (completely non-deterministic!)
        const rand = Math.random();
        let chosenIdx = 0;
        let cumulative = 0;
        for (let i = 0; i < probs.length; i++) {
            cumulative += probs[i];
            if (rand <= cumulative) {
                chosenIdx = i;
                break;
            }
        }

        const chosen = forwardMoves[chosenIdx];
        this.x = chosen.x;
        this.y = chosen.y;
        this.path.push({ x: this.x, y: this.y });
        brain.visits[this.y][this.x]++;

        // Trail particle
        if (particles && cellSize) {
            const px = (this.x + 0.5) * cellSize;
            const py = (this.y + 0.5) * cellSize;
            particles.addTrail(px, py, this.color);
        }

        // Check if goal reached after move
        if (this.x === goal.x && this.y === goal.y) {
            this.handleGoalReached(brain, particles, sound, cellSize);
        }
    }

    handleStuck(brain, particles, sound, cellSize) {
        brain.restartsCount++;
        if (sound) sound.playBump();

        // 1. Penalize the dead-end cell heavily
        brain.V[this.y][this.x] -= 16.0;

        // 2. Backpropagate penalty along the recent trajectory so agents learn to avoid this corridor
        let penalty = -12.0;
        const lookback = Math.max(0, this.path.length - 8);
        for (let i = this.path.length - 2; i >= lookback; i--) {
            const p = this.path[i];
            brain.V[p.y][p.x] += penalty;
            penalty *= 0.75;
        }

        // Spawn visual burst at dead end
        if (particles && cellSize) {
            const px = (this.x + 0.5) * cellSize;
            const py = (this.y + 0.5) * cellSize;
            particles.burst(px, py, '#ff2a5f', 16, 2.8);
        }

        // 3. Restart agent at the entrance with all learning saved!
        this.reset();
    }

    handleGoalReached(brain, particles, sound, cellSize) {
        this.status = 'reached_goal';
        brain.goalReached = true;
        brain.bestPath = [...this.path];

        if (sound) sound.playWin();

        // Backpropagate massive positive reward along the winning path
        let reward = 100.0;
        for (let i = this.path.length - 1; i >= 0; i--) {
            const p = this.path[i];
            brain.V[p.y][p.x] += reward;
            reward *= 0.93; // Temporal credit assignment
        }

        if (particles && cellSize) {
            const ex = (this.x + 0.5) * cellSize;
            const ey = (this.y + 0.5) * cellSize;
            particles.burst(ex, ey, '#00ff88', 40, 4.5);
        }
    }
}

// Main Maze Game & Multi-Agent Controller
class MazeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = new ParticleSystem();
        this.sound = window.soundManager;

        // Maze settings
        this.difficulty = 'medium'; // 'easy' (15x15), 'medium' (21x21), 'hard' (29x29)
        this.mazeGen = null;
        this.mazeData = null;

        // Fixed stationary maze positioning
        this.cellSize = 24;
        this.camera = { x: 0, y: 0 };
        this.dpr = window.devicePixelRatio || 1;

        // Multi-Agent Simulation Settings
        this.agentCount = 3;
        this.speed = 15; // steps per second (1 to 60)
        this.isRunning = true;
        this.stepAccumulator = 0;
        this.lastFrameTime = performance.now();

        // Distinct vibrant neon colors for agents
        this.agentColors = [
            '#00f3ff', // Cyan
            '#ff007f', // Magenta
            '#ffe600', // Yellow
            '#a855f7', // Purple
            '#00ff88', // Emerald
            '#fb923c', // Orange
            '#ec4899', // Pink
            '#38bdf8', // Sky Blue
            '#a3e635', // Lime
            '#f43f5e', // Rose
            '#e879f9', // Violet
            '#22d3ee', // Turquoise
            '#facc15', // Amber
            '#67e8f9', // Light Cyan
            '#c084fc'  // Lavender
        ];

        this.agents = [];
        this.brain = null;

        // Theme palette
        this.colors = {
            bg: '#080b14',
            wallFill: '#11182c',
            wallStroke: '#00d0ff',
            wallGlow: 'rgba(0, 208, 255, 0.4)',
            path: '#060912',
            visited: 'rgba(0, 243, 255, 0.08)',
            deadEndDot: '#ff2d55',
            deadEndGlow: 'rgba(255, 45, 85, 0.5)',
            goalPath: '#00ff88',
            goalPathGlow: '#00ff88',
            exit: '#00ff88'
        };

        this.initDOM();
        this.bindEvents();
        this.resizeCanvas();
        this.newGame();
        this.startLoop();
    }

    initDOM() {
        this.agentCountInput = document.getElementById('agentCountInput');
        this.agentCountVal = document.getElementById('agentCountVal');
        this.speedInput = document.getElementById('speedInput');
        this.speedVal = document.getElementById('speedVal');
        this.statRestarts = document.getElementById('statRestarts');
        this.statExplored = document.getElementById('statExplored');
        this.statStatus = document.getElementById('statStatus');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.winBanner = document.getElementById('winBanner');
        this.winBannerText = document.getElementById('winBannerText');
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resizeCanvas());

        // Agent Count Slider
        if (this.agentCountInput) {
            this.agentCountInput.addEventListener('input', (e) => {
                const count = parseInt(e.target.value, 10);
                this.agentCount = count;
                if (this.agentCountVal) this.agentCountVal.textContent = count;
                this.updateAgentPopulation();
            });
        }

        // Speed Slider
        if (this.speedInput) {
            this.speedInput.addEventListener('input', (e) => {
                const spd = parseInt(e.target.value, 10);
                this.speed = spd;
                if (this.speedVal) this.speedVal.textContent = `${spd} steps/s`;
            });
        }

        // Play / Pause
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => {
                this.isRunning = !this.isRunning;
                this.playPauseBtn.textContent = this.isRunning ? '⏸ Pause' : '▶ Run';
                this.playPauseBtn.className = this.isRunning ? 'btn btn-primary' : 'btn btn-accent';
            });
        }

        // Step Button
        const stepBtn = document.getElementById('stepBtn');
        if (stepBtn) {
            stepBtn.addEventListener('click', () => {
                this.stepSimulation();
            });
        }

        // Reset Memory (clears learning but keeps maze)
        const resetMemoryBtn = document.getElementById('resetMemoryBtn');
        if (resetMemoryBtn) {
            resetMemoryBtn.addEventListener('click', () => {
                this.resetLearningMemory();
            });
        }

        // New Maze
        const newMazeBtn = document.getElementById('newMazeBtn');
        if (newMazeBtn) {
            newMazeBtn.addEventListener('click', () => this.newGame());
        }

        // Size toggles
        const sizeButtons = document.querySelectorAll('.btn-size');
        sizeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                sizeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficulty = btn.dataset.size || 'medium';
                this.newGame();
            });
        });
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;

        const displayWidth = Math.floor(rect.width);
        const displayHeight = Math.floor(rect.height);

        this.canvas.width = Math.floor(displayWidth * this.dpr);
        this.canvas.height = Math.floor(displayHeight * this.dpr);
        this.canvas.style.width = `${displayWidth}px`;
        this.canvas.style.height = `${displayHeight}px`;

        this.screenWidth = displayWidth;
        this.screenHeight = displayHeight;

        this.centerStationaryMaze();
    }

    getDimensionsForDifficulty() {
        switch (this.difficulty) {
            case 'easy': return { cols: 15, rows: 15 };
            case 'hard': return { cols: 29, rows: 29 };
            case 'medium':
            default:
                return { cols: 21, rows: 21 };
        }
    }

    newGame() {
        this.particles.reset();
        if (this.winBanner) this.winBanner.classList.add('hidden');

        const config = this.getDimensionsForDifficulty();
        this.mazeGen = new MazeGenerator(config.cols, config.rows, 0.08);
        this.mazeData = this.mazeGen.generate(0, false);

        // Initialize fresh brain with zero prior knowledge
        this.brain = new SelfLearningBrain(
            this.mazeData.cols,
            this.mazeData.rows,
            this.mazeData.exit
        );

        // Create agents
        this.updateAgentPopulation();

        // Fixed stationary centering
        this.centerStationaryMaze();
        this.updateStatsUI();
    }

    resetLearningMemory() {
        if (!this.brain || !this.mazeData) return;
        this.brain.clearLearning();
        this.particles.reset();
        if (this.winBanner) this.winBanner.classList.add('hidden');

        // Reset all active agents to start
        this.agents.forEach(agent => agent.reset());
        this.updateStatsUI();
    }

    updateAgentPopulation() {
        if (!this.mazeData) return;

        while (this.agents.length < this.agentCount) {
            const id = this.agents.length;
            const color = this.agentColors[id % this.agentColors.length];
            this.agents.push(new NonDeterministicLearner(id, color, this.mazeData.start));
        }

        while (this.agents.length > this.agentCount) {
            this.agents.pop();
        }
    }

    centerStationaryMaze() {
        if (!this.mazeData || !this.screenWidth || !this.screenHeight) return;

        const padding = 54;
        const availW = Math.max(100, this.screenWidth - padding);
        const availH = Math.max(100, this.screenHeight - padding);

        this.cellSize = Math.floor(Math.min(availW / this.mazeData.cols, availH / this.mazeData.rows));
        this.cellSize = Math.max(8, this.cellSize);

        const mazeW = this.mazeData.cols * this.cellSize;
        const mazeH = this.mazeData.rows * this.cellSize;

        this.camera.x = Math.round((this.screenWidth - mazeW) / 2);
        this.camera.y = Math.round((this.screenHeight - mazeH) / 2);
    }

    stepSimulation() {
        if (!this.mazeData || !this.brain) return;

        for (const agent of this.agents) {
            agent.step(
                this.mazeData,
                this.mazeData.exit,
                this.brain,
                this.particles,
                this.sound,
                this.cellSize
            );
        }
        this.updateStatsUI();
    }

    updateStatsUI() {
        if (!this.brain) return;

        if (this.statRestarts) {
            this.statRestarts.textContent = this.brain.restartsCount;
        }

        if (this.statExplored && this.mazeData) {
            this.statExplored.textContent = `${this.brain.getExplorationPercentage(this.mazeData)}%`;
        }

        if (this.statStatus) {
            if (this.brain.goalReached) {
                this.statStatus.textContent = '🎉 Goal Discovered!';
                this.statStatus.className = 'stat-value badge-goal';
                if (this.winBanner) {
                    this.winBanner.classList.remove('hidden');
                    if (this.winBannerText && this.brain.bestPath) {
                        this.winBannerText.textContent = `🎉 Goal Discovered! Route Length: ${this.brain.bestPath.length} | Lessons/Restarts: ${this.brain.restartsCount}`;
                    }
                }
            } else {
                this.statStatus.textContent = 'Self-Learning...';
                this.statStatus.className = 'stat-value badge-exploring';
            }
        }
    }

    update(now) {
        const dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        if (this.isRunning && !this.brain.goalReached) {
            this.stepAccumulator += dt * this.speed;

            const maxStepsPerFrame = Math.max(1, Math.ceil(this.speed / 10));
            let stepsToExecute = Math.floor(this.stepAccumulator);
            stepsToExecute = Math.min(stepsToExecute, maxStepsPerFrame);

            if (stepsToExecute > 0) {
                for (let i = 0; i < stepsToExecute; i++) {
                    this.stepSimulation();
                    if (this.brain.goalReached) break;
                }
                this.stepAccumulator -= stepsToExecute;
            }
        }

        // Smooth agent render lerp
        const lerpSpeed = Math.min(0.4, 0.15 + (this.speed / 60) * 0.3);
        for (const agent of this.agents) {
            agent.renderX += (agent.x - agent.renderX) * lerpSpeed;
            agent.renderY += (agent.y - agent.renderY) * lerpSpeed;
        }

        this.particles.update();
    }

    render() {
        const ctx = this.ctx;
        const cs = this.cellSize;
        const dpr = this.dpr || 1;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Screen Background
        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        // Centered Stationary Maze
        ctx.save();
        ctx.translate(this.camera.x, this.camera.y);

        if (this.mazeData && this.brain) {
            this.renderMaze(ctx, cs);
            this.renderHeatmap(ctx, cs);
            this.renderDiscoveredGoalPath(ctx, cs);
            this.renderExit(ctx, cs);
            this.renderAgents(ctx, cs);
            this.particles.render(ctx);
        }

        ctx.restore();
    }

    renderMaze(ctx, cs) {
        const rows = this.mazeData.rows;
        const cols = this.mazeData.cols;
        const grid = this.mazeData.grid;

        // Base floor
        ctx.fillStyle = this.colors.path;
        ctx.fillRect(0, 0, cols * cs, rows * cs);

        // Walls
        ctx.fillStyle = this.colors.wallFill;
        ctx.strokeStyle = this.colors.wallStroke;
        ctx.lineWidth = Math.max(1, cs * 0.08);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (grid[y][x] === 1) {
                    const wx = x * cs;
                    const wy = y * cs;

                    ctx.fillRect(wx, wy, cs, cs);

                    // Dynamic glow for walls encountered by agents
                    const isKnown = this.brain.knownWalls[y][x];
                    ctx.strokeStyle = isKnown ? this.colors.wallStroke : 'rgba(0, 208, 255, 0.25)';
                    ctx.shadowColor = isKnown ? this.colors.wallGlow : 'transparent';
                    ctx.shadowBlur = isKnown ? 5 : 0;
                    ctx.strokeRect(wx + 0.5, wy + 0.5, cs - 1, cs - 1);
                    ctx.shadowBlur = 0;
                }
            }
        }
    }

    renderHeatmap(ctx, cs) {
        const rows = this.mazeData.rows;
        const cols = this.mazeData.cols;
        const half = cs * 0.5;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const visits = this.brain.visits[y][x];
                const val = this.brain.V[y][x];

                // 1. Explored corridors tint
                if (visits > 0 && val >= 0) {
                    const alpha = Math.min(0.25, 0.04 + visits * 0.02);
                    ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
                    ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
                }

                // 2. Learned Dead-End penalties (Negative V)
                if (val < -2.0) {
                    ctx.fillStyle = 'rgba(255, 45, 85, 0.18)';
                    ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);

                    const dotR = Math.max(2, cs * 0.14);
                    ctx.save();
                    ctx.fillStyle = this.colors.deadEndDot;
                    ctx.shadowColor = this.colors.deadEndGlow;
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    ctx.arc(x * cs + half, y * cs + half, dotR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // 3. Rewarded winning path (Positive V)
                if (val > 10.0) {
                    ctx.fillStyle = 'rgba(0, 255, 136, 0.18)';
                    ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
                }
            }
        }
    }

    renderDiscoveredGoalPath(ctx, cs) {
        const path = this.brain.bestPath;
        if (!path || path.length < 2) return;

        ctx.save();
        ctx.strokeStyle = this.colors.goalPath;
        ctx.lineWidth = Math.max(3, cs * 0.22);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = this.colors.goalPathGlow;
        ctx.shadowBlur = 14;

        ctx.beginPath();
        path.forEach((pt, i) => {
            const hx = (pt.x + 0.5) * cs;
            const hy = (pt.y + 0.5) * cs;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        });
        ctx.stroke();

        ctx.restore();
    }

    renderExit(ctx, cs) {
        const exit = this.mazeData.exit;
        const ex = (exit.x + 0.5) * cs;
        const ey = (exit.y + 0.5) * cs;
        const r = cs * 0.38;
        const time = Date.now() * 0.003;

        ctx.save();
        ctx.translate(ex, ey);

        ctx.shadowColor = this.colors.exit;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = this.colors.exit;
        ctx.lineWidth = 2.5;

        const pulseR = r + Math.sin(time * 3) * 2;
        ctx.beginPath();
        ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 255, 136, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    renderAgents(ctx, cs) {
        for (const agent of this.agents) {
            const ax = (agent.renderX + 0.5) * cs;
            const ay = (agent.renderY + 0.5) * cs;
            const r = cs * 0.34;

            ctx.save();
            ctx.translate(ax, ay);

            // Glowing Outer Body
            ctx.shadowColor = agent.color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = agent.color;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Inner Core
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-r * 0.2, -r * 0.2, r * 0.35, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    startLoop() {
        const loop = (now) => {
            this.update(now);
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new MazeGame();
});
