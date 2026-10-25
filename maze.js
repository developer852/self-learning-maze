// Maze generator with Recursive Backtracking, Braiding, and BFS Solver
class MazeGenerator {
    constructor(cols = 21, rows = 21, braidRatio = 0.1) {
        // Ensure odd dimensions for proper wall/path grid layout
        this.cols = cols % 2 === 0 ? cols + 1 : cols;
        this.rows = rows % 2 === 0 ? rows + 1 : rows;
        this.braidRatio = braidRatio; // 0 = perfect maze (no loops), 0.2 = some alternative paths
        this.grid = [];
        this.start = { x: 1, y: 1 };
        this.exit = { x: this.cols - 2, y: this.rows - 2 };
        this.gems = [];
        this.key = null;
        this.optimalPath = [];
    }

    generate(gemCount = 3, requireKey = false) {
        // Initialize all as walls (1)
        this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(1));

        // Carve paths using Recursive Backtracker (DFS)
        const stack = [];
        const startX = 1;
        const startY = 1;
        this.grid[startY][startX] = 0;
        stack.push({ x: startX, y: startY });

        const directions = [
            { x: 0, y: -2, dx: 0, dy: -1 }, // North
            { x: 2, y: 0, dx: 1, dy: 0 },   // East
            { x: 0, y: 2, dx: 0, dy: 1 },   // South
            { x: -2, y: 0, dx: -1, dy: 0 }  // West
        ];

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = [];

            for (const dir of directions) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;

                if (nx > 0 && nx < this.cols - 1 && ny > 0 && ny < this.rows - 1 && this.grid[ny][nx] === 1) {
                    neighbors.push({ nx, ny, wallX: current.x + dir.dx, wallY: current.y + dir.dy });
                }
            }

            if (neighbors.length > 0) {
                // Pick a random unvisited neighbor
                const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.grid[chosen.wallY][chosen.wallX] = 0;
                this.grid[chosen.ny][chosen.nx] = 0;
                stack.push({ x: chosen.nx, y: chosen.ny });
            } else {
                stack.pop();
            }
        }

        // Braiding: carve some dead ends to make it more interesting and non-frustrating if braidRatio > 0
        if (this.braidRatio > 0) {
            this.applyBraiding();
        }

        // Ensure start and exit are open
        this.grid[this.start.y][this.start.x] = 0;
        this.grid[this.exit.y][this.exit.x] = 0;

        // Calculate optimal path using BFS
        this.optimalPath = this.solvePath(this.start, this.exit);

        // Find candidate dead ends for gems and key
        this.placeItems(gemCount, requireKey);

        return {
            grid: this.grid,
            cols: this.cols,
            rows: this.rows,
            start: this.start,
            exit: this.exit,
            gems: this.gems,
            key: this.key,
            optimalPathLength: this.optimalPath.length
        };
    }

    applyBraiding() {
        for (let y = 1; y < this.rows - 1; y += 2) {
            for (let x = 1; x < this.cols - 1; x += 2) {
                if (this.grid[y][x] === 0) {
                    // Count open neighbors
                    const neighbors = [
                        { x: x + 1, y: y, wx: x + 1, wy: y },
                        { x: x - 1, y: y, wx: x - 1, wy: y },
                        { x: x, y: y + 1, wx: x, wy: y + 1 },
                        { x: x, y: y - 1, wx: x, wy: y - 1 }
                    ].filter(n => n.x > 0 && n.x < this.cols - 1 && n.y > 0 && n.y < this.rows - 1);

                    const openNeighbors = neighbors.filter(n => this.grid[n.y][n.x] === 0);

                    // If it's a dead end (only 1 open neighbor)
                    if (openNeighbors.length === 1 && Math.random() < this.braidRatio) {
                        const wallNeighbors = neighbors.filter(n => this.grid[n.y][n.x] === 1);
                        if (wallNeighbors.length > 0) {
                            const chosen = wallNeighbors[Math.floor(Math.random() * wallNeighbors.length)];
                            this.grid[chosen.y][chosen.x] = 0;
                        }
                    }
                }
            }
        }
    }

    placeItems(gemCount, requireKey) {
        this.gems = [];
        this.key = null;

        const candidateCells = [];
        for (let y = 1; y < this.rows - 1; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                if (this.grid[y][x] === 0) {
                    // Exclude start and exit area
                    if ((x === this.start.x && y === this.start.y) || (x === this.exit.x && y === this.exit.y)) {
                        continue;
                    }
                    candidateCells.push({ x, y });
                }
            }
        }

        // Shuffle candidate cells
        for (let i = candidateCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidateCells[i], candidateCells[j]] = [candidateCells[j], candidateCells[i]];
        }

        // Place Key if required
        if (requireKey && candidateCells.length > 0) {
            // Find a cell reasonably far from start and exit
            let bestKeyCell = candidateCells[0];
            let maxDist = -1;
            for (let i = 0; i < Math.min(25, candidateCells.length); i++) {
                const cell = candidateCells[i];
                const dStart = Math.hypot(cell.x - this.start.x, cell.y - this.start.y);
                const dExit = Math.hypot(cell.x - this.exit.x, cell.y - this.exit.y);
                const distScore = dStart * 0.7 + dExit * 0.3;
                if (distScore > maxDist) {
                    maxDist = distScore;
                    bestKeyCell = cell;
                }
            }
            this.key = { ...bestKeyCell, collected: false };
            const idx = candidateCells.indexOf(bestKeyCell);
            if (idx > -1) candidateCells.splice(idx, 1);
        }

        // Place Gems
        const numGems = Math.min(gemCount, candidateCells.length);
        for (let i = 0; i < numGems; i++) {
            this.gems.push({
                x: candidateCells[i].x,
                y: candidateCells[i].y,
                collected: false,
                id: i
            });
        }
    }

    solvePath(start, goal) {
        const queue = [{ x: start.x, y: start.y, path: [{ x: start.x, y: start.y }] }];
        const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
        visited[start.y][start.x] = true;

        const dirs = [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 }
        ];

        while (queue.length > 0) {
            const { x, y, path } = queue.shift();

            if (x === goal.x && y === goal.y) {
                return path;
            }

            for (const d of dirs) {
                const nx = x + d.x;
                const ny = y + d.y;

                if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                    if (this.grid[ny][nx] === 0 && !visited[ny][nx]) {
                        visited[ny][nx] = true;
                        queue.push({
                            x: nx,
                            y: ny,
                            path: [...path, { x: nx, y: ny }]
                        });
                    }
                }
            }
        }
        return [];
    }

    isPassable(x, y) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false;
        return this.grid[y][x] === 0;
    }
}

window.MazeGenerator = MazeGenerator;
