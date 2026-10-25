import math
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio.v2 as imageio

# 1. Procedural Maze Generator (DFS)
def generate_maze(cols=21, rows=21):
    grid = [[1 for _ in range(cols)] for _ in range(rows)]
    stack = [(1, 1)]
    grid[1][1] = 0

    directions = [(0, -2, 0, -1), (2, 0, 1, 0), (0, 2, 0, 1), (-2, 0, -1, 0)]

    while stack:
        cx, cy = stack[-1]
        neighbors = []
        for dx, dy, wx, wy in directions:
            nx, ny = cx + dx, cy + dy
            if 0 < nx < cols - 1 and 0 < ny < rows - 1 and grid[ny][nx] == 1:
                neighbors.append((nx, ny, cx + wx, cy + wy))

        if neighbors:
            nx, ny, wall_x, wall_y = random.choice(neighbors)
            grid[wall_y][wall_x] = 0
            grid[ny][nx] = 0
            stack.append((nx, ny))
        else:
            stack.pop()

    start = (1, 1)
    exit_pos = (cols - 2, rows - 2)
    grid[start[1]][start[0]] = 0
    grid[exit_pos[1]][exit_pos[0]] = 0
    return grid, start, exit_pos

# 2. Self-Learning Brain
class Brain:
    def __init__(self, cols, rows, goal):
        self.cols = cols
        self.rows = rows
        self.goal = goal
        self.V = [[0.0 for _ in range(cols)] for _ in range(rows)]
        self.visits = [[0 for _ in range(cols)] for _ in range(rows)]
        self.known_walls = [[False for _ in range(cols)] for _ in range(rows)]
        self.restarts = 0
        self.goal_reached = False
        self.best_path = None

# 3. Non-Deterministic Stochastic Agent
class Agent:
    def __init__(self, agent_id, color, start_pos):
        self.id = agent_id
        self.color = color
        self.start_pos = start_pos
        self.x, self.y = start_pos
        self.render_x, self.render_y = float(self.x), float(self.y)
        self.path = [start_pos]
        self.status = 'exploring'

    def reset(self):
        self.x, self.y = self.start_pos
        self.render_x, self.render_y = float(self.x), float(self.y)
        self.path = [self.start_pos]
        self.status = 'exploring'

    def step(self, grid, goal, brain, particles):
        if self.status == 'reached_goal':
            return

        if (self.x, self.y) == goal:
            self.status = 'reached_goal'
            brain.goal_reached = True
            brain.best_path = list(self.path)
            reward = 100.0
            for px, py in reversed(self.path):
                brain.V[py][px] += reward
                reward *= 0.93
            return

        dirs = [(0, -1), (1, 0), (0, 1), (-1, 0)]
        valid_moves = []
        for dx, dy in dirs:
            nx, ny = self.x + dx, self.y + dy
            if 0 <= nx < brain.cols and 0 <= ny < brain.rows:
                if grid[ny][nx] == 1:
                    brain.known_walls[ny][nx] = True
                else:
                    valid_moves.append((nx, ny))

        forward_moves = [m for m in valid_moves if m not in self.path]

        # STUCK AT DEAD END!
        if not forward_moves:
            brain.restarts += 1
            brain.V[self.y][self.x] -= 16.0
            penalty = -12.0
            for i in range(len(self.path) - 2, max(0, len(self.path) - 8) - 1, -1):
                px, py = self.path[i]
                brain.V[py][px] += penalty
                penalty *= 0.75

            particles.append({'x': self.x, 'y': self.y, 'life': 20, 'color': (255, 45, 85)})
            self.reset()
            return

        # Softmax probabilistic action selection
        temperature = 1.15
        scores = []
        for mx, my in forward_moves:
            val = brain.V[my][mx]
            novelty = 3.2 / (1.0 + brain.visits[my][mx])
            scores.append(val + novelty)

        max_score = max(scores)
        exp_scores = [math.exp((s - max_score) / temperature) for s in scores]
        sum_exp = sum(exp_scores)
        probs = [e / sum_exp for e in exp_scores]

        rand_val = random.random()
        cum = 0.0
        chosen = forward_moves[0]
        for idx, p in enumerate(probs):
            cum += p
            if rand_val <= cum:
                chosen = forward_moves[idx]
                break

        self.x, self.y = chosen
        self.path.append(chosen)
        brain.visits[self.y][self.x] += 1

        if (self.x, self.y) == goal:
            self.status = 'reached_goal'
            brain.goal_reached = True
            brain.best_path = list(self.path)
            reward = 100.0
            for px, py in reversed(self.path):
                brain.V[py][px] += reward
                reward *= 0.93

# 4. Render and Record Video
def record_simulation(output_path='self_learning_maze_demo.mp4', cols=21, rows=21):
    print(f"Generating maze {cols}x{rows} and setting up self-learning agents...")
    grid, start, exit_pos = generate_maze(cols, rows)
    brain = Brain(cols, rows, exit_pos)

    colors = [
        (0, 243, 255),  # Cyan
        (255, 0, 127),  # Magenta
        (255, 230, 0),  # Gold
        (168, 85, 247)  # Purple
    ]
    agents = [Agent(i, colors[i % len(colors)], start) for i in range(4)]
    particles = []

    # Canvas dimensions
    width, height = 1280, 720
    fps = 30
    writer = imageio.get_writer(output_path, fps=fps, codec='libx264', quality=8)

    # Centered stationary maze layout
    hud_h = 80
    avail_w, avail_h = width - 80, height - hud_h - 60
    cell_size = min(avail_w // cols, avail_h // rows)
    maze_w = cols * cell_size
    maze_h = rows * cell_size
    offset_x = (width - maze_w) // 2
    offset_y = hud_h + (height - hud_h - maze_h) // 2

    # Fonts
    try:
        font_large = ImageFont.truetype("arial.ttf", 22)
        font_med = ImageFont.truetype("arial.ttf", 15)
        font_bold = ImageFont.truetype("arialbd.ttf", 16)
    except:
        font_large = font_med = font_bold = None

    frame_count = 0
    max_frames = 1200 # max 40 seconds
    victory_hold = 0
    step_interval = 3 # step every 3 frames for cinematic, clear movement

    print("Recording cinematic simulation frames...")
    while frame_count < max_frames:
        frame_count += 1

        # Step simulation at interval
        if not brain.goal_reached:
            if frame_count % step_interval == 0:
                for agent in agents:
                    agent.step(grid, exit_pos, brain, particles)
                    if brain.goal_reached:
                        break
        else:
            victory_hold += 1
            if victory_hold > 90: # hold victory for 3 seconds
                break

        # Smooth agent rendering positions (lerp)
        for agent in agents:
            agent.render_x += (agent.x - agent.render_x) * 0.38
            agent.render_y += (agent.y - agent.render_y) * 0.38

        # Create frame image
        img = Image.new('RGB', (width, height), (8, 11, 20))
        draw = ImageDraw.Draw(img)

        # Draw HUD Header
        draw.rectangle([(0, 0), (width, hud_h)], fill=(16, 22, 38))
        draw.line([(0, hud_h), (width, hud_h)], fill=(255, 255, 255, 25), width=1)

        # Brand / Title
        draw.text((36, 18), "SELF-LEARNING MULTI-AGENT MAZE EXPLORER", fill=(0, 243, 255), font=font_large)
        draw.text((36, 48), "Non-Deterministic Softmax Policy | Dead-End Penalty Backpropagation | Zero Pre-Programmed Paths", fill=(140, 160, 185), font=font_med)

        # HUD Stats Badges
        restarts_text = f"Restarts (Stuck): {brain.restarts}"
        draw.text((width - 480, 28), restarts_text, fill=(255, 230, 0), font=font_bold)

        status_text = "Goal Discovered!" if brain.goal_reached else "Autonomous Learning..."
        status_color = (0, 255, 136) if brain.goal_reached else (0, 243, 255)
        draw.text((width - 240, 28), status_text, fill=status_color, font=font_bold)

        # Draw Stationary Maze Background
        draw.rectangle([(offset_x, offset_y), (offset_x + maze_w, offset_y + maze_h)], fill=(6, 9, 18))

        # Draw Walls
        for y in range(rows):
            for x in range(cols):
                rx = offset_x + x * cell_size
                ry = offset_y + y * cell_size

                if grid[y][x] == 1:
                    draw.rectangle([(rx, ry), (rx + cell_size, ry + cell_size)], fill=(17, 24, 44))
                    # Cyan edge
                    draw.rectangle([(rx, ry), (rx + cell_size, ry + cell_size)], outline=(0, 190, 235), width=1)
                else:
                    # Explored / Visited corridor tint
                    v = brain.visits[y][x]
                    val = brain.V[y][x]
                    if v > 0 and val >= 0:
                        alpha = min(70, 20 + v * 8)
                        draw.rectangle([(rx + 1, ry + 1), (rx + cell_size - 1, ry + cell_size - 1)], fill=(0, 45, 65))

                    # Learned Dead-End penalty (Negative V)
                    if val < -2.0:
                        draw.rectangle([(rx + 1, ry + 1), (rx + cell_size - 1, ry + cell_size - 1)], fill=(55, 15, 25))
                        # Red warning dot
                        cx = rx + cell_size // 2
                        cy = ry + cell_size // 2
                        r = max(2, cell_size // 6)
                        draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=(255, 45, 85))

        # Discovered Winning Goal Path (if found)
        if brain.best_path and len(brain.best_path) > 1:
            points = []
            for px, py in brain.best_path:
                points.append((offset_x + int((px + 0.5) * cell_size), offset_y + int((py + 0.5) * cell_size)))
            draw.line(points, fill=(0, 255, 136), width=max(3, cell_size // 4))

        # Draw Exit Beacon
        ex = offset_x + int((exit_pos[0] + 0.5) * cell_size)
        ey = offset_y + int((exit_pos[1] + 0.5) * cell_size)
        er = int(cell_size * 0.4)
        draw.ellipse([(ex - er, ey - er), (ex + er, ey + er)], outline=(0, 255, 136), width=2)
        draw.ellipse([(ex - er // 2, ey - er // 2), (ex + er // 2, ey + er // 2)], fill=(0, 255, 136))

        # Draw Particles
        for p in particles:
            px = offset_x + int((p['x'] + 0.5) * cell_size)
            py = offset_y + int((p['y'] + 0.5) * cell_size)
            pr = max(1, p['life'] // 4)
            draw.ellipse([(px - pr, py - pr), (px + pr, py + pr)], fill=p['color'])
            p['life'] -= 1
        particles[:] = [p for p in particles if p['life'] > 0]

        # Draw Agents
        for agent in agents:
            ax = offset_x + int((agent.render_x + 0.5) * cell_size)
            ay = offset_y + int((agent.render_y + 0.5) * cell_size)
            ar = int(cell_size * 0.35)

            # Outer glow body
            draw.ellipse([(ax - ar, ay - ar), (ax + ar, ay + ar)], fill=agent.color)
            # Inner white highlight
            draw.ellipse([(ax - ar // 3, ay - ar // 3), (ax + ar // 3, ay + ar // 3)], fill=(255, 255, 255))

        # Convert to numpy and write frame
        writer.append_data(np.array(img))

    writer.close()
    print(f"Video saved successfully to {output_path} ({frame_count} frames, {frame_count/fps:.1f}s)!")
    return output_path

if __name__ == '__main__':
    record_simulation('self_learning_maze_demo.mp4', 21, 21)
