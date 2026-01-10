# Agentic Songwriter

A learning-first agentic AI project that demonstrates orchestrator patterns, tool interfaces, state management, and iterative improvement. This Next.js application helps songwriters create improved song drafts through an autonomous agent system.

## ⚠️ Important: OpenAI API Key Required

**To run this project locally, you need an OpenAI API key with credits.**

1. **Get an OpenAI API key** from [platform.openai.com](https://platform.openai.com)
2. **Add credits** to your OpenAI account
3. **Set up `.env.local`** with your API key (see Setup section below)

**Alternative: Mock Mode** - For testing without API costs, you can use mock mode (see Setup section).


## 🎯 Project Overview

This project implements a **true agentic AI system** (not just a prompt wrapper) that:

- Uses a **plan → act → observe → reflect** orchestrator loop
- Implements **rule-based agents** that make decisions without LLM calls
- Uses **LLM-powered tools** for creative work (song generation, evaluation, improvement)
- Supports **iterative improvement** with automatic quality evaluation
- Provides **full observability** through structured tracing
- Enforces **guardrails** to prevent infinite loops

## 🏗️ Architecture

### Key Concepts

**LLM Usage Rule: LLM calls exist ONLY inside tools**

- ✅ **Tools**: Make LLM calls to perform creative/generative work
- ✅ **Agents**: Pure decision-makers using rule-based logic (no LLM)
- ✅ **Orchestrator**: Model-agnostic control loop (no LLM)

### System Flow

```
User Input (lyrics + emotion + genre)
    ↓
Orchestrator.run() [Rule-based control]
    ↓
BriefAgent.execute() [Rule-based: decides which tools to call]
    ├─→ Create CreativeBrief (deterministic, no LLM)
    └─→ Decide: "Call GenerateSongStructure tool"
        ↓
    GenerateSongStructure Tool [*** LLM CALL ***]
        └─→ Generates initial song structure
        ↓
    EvaluateLyrics Tool [*** LLM CALL ***]
        └─→ Evaluates quality, returns score + needsImprovement flag
        ↓
    [If needsImprovement and iterations < 3]
        ↓
    ImproveLyrics Tool [*** LLM CALL ***]
        └─→ Improves lyrics based on evaluation
        ↓
    [Loop back to EvaluateLyrics]
        ↓
    Return final result with full trace
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- OpenAI API account with credits (for real LLM mode)
  - **OR** use mock mode for testing (no API key needed)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd agentic-songwriter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the project root:

   **Option A: Use Real LLM (requires OpenAI credits)**
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```

   **Option B: Use Mock Mode (for testing, no API key needed)**
   ```env
   USE_MOCK_LLM=true
   ```

   > **Note**: Mock mode generates sample data based on your inputs, allowing you to test the full agentic flow without API costs.

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📋 Usage

1. **Enter your song inputs:**
   - **Lyrics** (textarea): Your base lyrics
   - **Emotion** (input): The emotion you want to convey (e.g., "happy", "sad", "love", "angry")
   - **Genre** (optional): Select a genre or leave as "None"

2. **Click "Generate Draft"**
   - The agent will create a creative brief from your inputs
   - Generate an initial song structure
   - Evaluate the quality
   - Automatically improve it if needed (up to 3 iterations)

3. **View Results:**
   - **Creative Brief**: The structured brief derived from your inputs
   - **Song Structure**: Final song with title and sections (verse, chorus, bridge, etc.)
   - **Evaluation**: Quality score, strengths, weaknesses, and suggestions
   - **Iteration Info**: Number of improvement cycles completed
   - **Trace**: Full JSON trace of all agent/tool operations (collapsible)

## 🎨 Features

### Core Features

- ✅ **Automatic Song Generation**: Creates complete song structures from lyrics and emotion
- ✅ **Quality Evaluation**: LLM evaluates generated songs and provides detailed feedback
- ✅ **Iterative Improvement**: Automatically improves songs based on evaluation (up to 3 iterations)
- ✅ **Full Trace Logging**: Every step is recorded for debugging and transparency
- ✅ **Guardrails**: Prevents infinite loops with max steps, max tool calls, and iteration limits

### UI Features

- ✅ Clean, modern interface with gradient theme
- ✅ Real-time loading states
- ✅ Color-coded quality scores
- ✅ Organized results display
- ✅ Collapsible trace viewer
- ✅ Responsive design

## 🏛️ Project Structure

```
agentic-songwriter/
├── app/
│   ├── api/
│   │   └── run/
│   │       └── route.ts          # API endpoint for song generation
│   ├── page.tsx                   # Main UI component
│   ├── layout.tsx                 # Root layout
│   └── globals.css                # Global styles
├── lib/
│   └── agent/
│       ├── core/
│       │   ├── orchestrator.ts   # Orchestrator loop implementation
│       │   ├── agent.ts          # Agent base class
│       │   ├── tool.ts           # Tool base class
│       │   ├── state-store.ts    # In-memory state management
│       │   └── trace.ts          # Tracing system
│       ├── agents/
│       │   └── brief-agent.ts    # BriefAgent implementation
│       ├── tools/
│       │   ├── generate-song-structure.ts  # Song generation (LLM)
│       │   ├── evaluate-lyrics.ts          # Quality evaluation (LLM)
│       │   └── improve-lyrics.ts           # Lyrics improvement (LLM)
│       └── schemas/
│           ├── creative-brief.ts  # CreativeBrief Zod schema
│           ├── song-structure.ts  # SongStructure Zod schema
│           └── evaluation.ts      # LyricsEvaluation Zod schema
├── types/
│   └── agent.ts                   # TypeScript interfaces
└── package.json
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes* | Your OpenAI API key (required for real LLM mode) |
| `USE_MOCK_LLM` | No | Set to `"true"` to use mock mode (no API key needed) |

\* Required unless using mock mode

### Orchestrator Guardrails

The orchestrator is configured with the following defaults (can be adjusted in `app/api/run/route.ts`):

- `maxSteps`: 20 (maximum orchestrator loop iterations)
- `maxToolCalls`: 15 (maximum tool executions)
- `maxIterations`: 3 (maximum improvement cycles)

## 🧪 Testing

### Mock Mode

To test without API costs, set `USE_MOCK_LLM=true` in `.env.local`. This will:

- Generate sample song structures based on your inputs
- Create rule-based evaluations (quality scores typically 6-8/10)
- Show improvement iterations (will trigger if quality < 7)
- Allow you to test the full agentic flow

### Real LLM Mode

When you have OpenAI credits:

1. Remove `USE_MOCK_LLM=true` (or set to `false`)
2. Add `OPENAI_API_KEY=sk-your-key-here`
3. Restart the dev server

The system will automatically use real LLM calls.

## 📚 Architecture Details

### Agentic Concepts Demonstrated

1. **Orchestrator Loop**: plan → act → observe → reflect cycle
2. **Tool Interface**: Strict input/output schemas with Zod validation
3. **State Store**: In-memory persistence of artifacts across steps
4. **Tracing**: Structured event logging for every operation
5. **Guardrails**: maxSteps, maxToolCalls, allowedTools, stop conditions
6. **Human-in-the-Loop**: Optional approval hook (implemented, can be enabled)

### LLM Usage (Hybrid Approach)

- **GenerateSongStructure**: Creates song from creative brief
- **EvaluateLyrics**: Evaluates quality and provides feedback
- **ImproveLyrics**: Improves lyrics based on evaluation

All LLM reasoning happens in tools. Agents and orchestrators use rule-based logic.

### Iteration Logic

The system automatically:

1. Generates initial song
2. Evaluates quality
3. If quality < 7 or needsImprovement = true → improves
4. Re-evaluates improved version
5. Repeats up to 3 times or until quality is acceptable

## 🛠️ Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Adding New Tools

1. Create a new tool class extending `Tool` base class
2. Implement `executeInternal()` method with LLM call
3. Define input/output Zod schemas
4. Add tool to BriefAgent constructor in API route

### Adding New Agents

1. Create agent class extending `Agent` base class
2. Implement `execute()` method with rule-based decision logic
3. Add agent to orchestrator in API route

## 🔒 Security Notes

- **Never commit `.env.local`** - it's already in `.gitignore`
- API keys are only used server-side (never exposed to browser)
- All LLM calls happen in API routes, not in client components

## 🙏 Acknowledgments

This project demonstrates agentic AI patterns for educational purposes, focusing on clean architecture and separation of concerns between decision-making (agents) and execution (tools).

---

**Built with**: Next.js 14, React, TypeScript, Zod, OpenAI API
