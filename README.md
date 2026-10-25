# 🧠 Self-Learning Maze Explorer (Non-Deterministic)

An autonomous multi-agent reinforcement learning experiment where agents discover and solve mazes through trial, error, and memory.

## 🚀 True Self-Learning Architecture

- **Zero Pre-Programmed Paths**:
  - The agents do not receive any precalculated route, distance matrices, or global wall maps.
  - Agents only sense walls locally as they move through adjacent corridors.
- **Non-Deterministic Exploration (Softmax / Boltzmann Selection)**:
  - Movement decisions are stochastic, balancing learned state value $V(s)$ with novelty/curiosity for unvisited tiles.
  - Multi-agent swarms naturally diverge into different branches rather than following robotic identical paths.
- **Dead-End Penalties & Experience Retention**:
  - When an agent is trapped with no forward passage, it recognizes that it is **stuck in a dead end**.
  - It penalizes the dead-end cell ($V(s) \leftarrow V(s) - 16$) and backpropagates this negative reinforcement along its recent approach corridor.
  - The agent restarts at the maze entrance **with its learned memory intact**. On future episodes, the probability of re-entering that branch drops to near zero.
- **Goal Reward Propagation**:
  - When an agent discovers the exit, a massive positive reinforcement (+100) backpropagates along the winning trajectory.
  - The route to the goal is permanently highlighted in glowing emerald.

## 🎛️ Interactive UI Controls

- **Agents Slider**: Set between **1 to 15 concurrent learning agents**.
- **Speed Slider**: Regulate simulation speed from **1 step/s** (observe individual decision steps) to **60 steps/s** (high-speed convergence).
- **Controls**:
  - `⏸ Pause` / `▶ Run`: Toggle exploration.
  - `⏭ Step`: Advance a single step manually.
  - `↺ Reset Memory`: Clear learned Q-values to watch agents start learning the maze from scratch again.
  - `🔄 New Maze`: Generate a new random maze (15×15, 21×21, 29×29).

## 🎮 How to Run

Simply clone or download this repository and open `index.html` in any web browser:

```bash
# Clone the repository
git clone https://github.com/developer852/self-learning-maze.git

# Open index.html in your browser
start index.html
```
