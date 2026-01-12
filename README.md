# Songsmith

**Agentic AI Tools for Musicians** - A SaaS platform powered by autonomous agents that help songwriters create, refine, and enhance their music through intelligent orchestration and iterative improvement.

## 🎯 Project Overview

Songsmith is a **production-ready agentic AI system** designed for musicians and songwriters. It demonstrates real-world implementation of autonomous agents that orchestrate multiple LLM-powered tools to create, evaluate, and iteratively improve musical content.

Unlike simple prompt wrappers, Songsmith implements a **true agentic architecture** with:
- **Autonomous orchestration** using plan → act → observe → reflect cycles
- **Rule-based agents** that make intelligent decisions without LLM calls
- **LLM-powered tools** for creative work (generation, evaluation, improvement)
- **Iterative improvement** with automatic quality assessment
- **Full observability** through structured tracing
- **Guardrails** to prevent infinite loops and ensure reliability
- **Human-in-the-loop** capabilities for content approval
- **User management & quotas** for SaaS deployment

## 🤖 Agentic AI Architecture

Songsmith is built on a sophisticated agentic AI foundation:

### Core Components

**Orchestrator** (`lib/agent/core/orchestrator.ts`)
- Implements the **plan → act → observe → reflect** cycle
- Manages agent execution with guardrails (max steps, max tool calls, max iterations)
- Handles state management and trace logging
- Supports human-in-the-loop interactions
- Rule-based (no LLM calls in orchestrator itself)

**Agents** (`lib/agent/agents/`)
- **BriefAgent**: Orchestrates song generation workflow (generate → evaluate → improve)
- **MelodyAgent**: Orchestrates melody generation workflow (generate → evaluate → improve)
- Rule-based decision making (deterministic logic, no LLM calls)
- Iterative improvement with quality thresholds

**Tools** (`lib/agent/tools/`)
- **GenerateSongStructureTool**: Creates song lyrics from creative brief
- **EvaluateLyricsTool**: Assesses quality and identifies improvements
- **ImproveLyricsTool**: Refines lyrics based on feedback
- **GenerateMelodyTool**: Creates MIDI melodies from lyrics
- **EvaluateMelodyTool**: Evaluates melody quality and harmony
- **ImproveMelodyTool**: Enhances melodies based on feedback
- All tools use Zod schemas for type-safe input/output validation
- LLM calls are isolated to tools (agent orchestration is rule-based)

**State Management** (`lib/agent/core/state-store.ts`)
- In-memory key-value store for artifacts (creative briefs, song structures, evaluations)
- Thread-safe operations
- Persistent across tool calls within an execution

**Observability** (`lib/agent/core/trace.ts`)
- Structured event logging for all operations
- Tracks tool calls, agent decisions, iterations
- Full audit trail for debugging and analysis

### Design Principles

1. **Separation of Concerns**: Orchestration (rule-based) vs. Creative Work (LLM-powered)
2. **Type Safety**: Zod schemas for all inputs/outputs
3. **Observability**: Complete trace of all operations
4. **Guardrails**: Max steps, max tool calls, max iterations prevent infinite loops
5. **Iterative Improvement**: Agents automatically improve until quality threshold is met
6. **Human-in-the-Loop**: Optional approval workflows for generated content
7. **SaaS-Ready**: User management, quotas, authentication, database persistence

## 🛠️ Technology Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type-safe development
- **CSS Modules** - Styled components with custom design system
- **Tone.js** - Web Audio API for browser-based MIDI playback

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Server-Sent Events (SSE)** - Real-time progress streaming
- **NextAuth.js (Auth.js)** - Authentication with Google OAuth
- **Prisma ORM** - Database abstraction and migrations

### Database
- **SQLite** - Development (file-based)
- **PostgreSQL** - Production (Vercel/Neon/Supabase)
- **Prisma Schema** - Type-safe database models

### AI/LLM
- **OpenAI API** - GPT-4 Turbo for creative generation and evaluation
- **Configurable models** - Support for different OpenAI models via environment variable
- **Mock mode** - Testing without API costs (USE_MOCK_LLM=true)

### Agentic AI Framework
- **Custom Orchestrator** - Plan → act → observe → reflect cycle
- **Zod** - Schema validation for tool inputs/outputs
- **Type-safe tool interface** - Automatic validation and error handling
- **State management** - Persistent state across tool calls
- **Trace system** - Full observability and audit trail

### Authentication & User Management
- **NextAuth.js** - OAuth authentication (Google)
- **Prisma Adapter** - Database-backed sessions
- **User quotas** - Daily limits for LLM calls (5 drafts/day)
- **Guest support** - Limited resources for unauthenticated users

### Development Tools
- **Jest** - Testing framework
- **React Testing Library** - Component testing
- **TypeScript** - Static type checking
- **ESLint** - Code linting

### Deployment
- **Vercel** - Serverless hosting (free tier available)
- **Neon/Supabase** - PostgreSQL hosting (free tier available)
- **Environment-based config** - Different settings for dev/prod

## 🎵 Features

### Songwriter Agent
- Generate complete song structures from creative briefs
- Automatic quality evaluation and iterative improvement
- Support for multiple languages (English, Portuguese - Brazil)
- Human-in-the-loop approval workflows
- Persistent storage of generated songs

### Melody Agent
- Generate MIDI melodies that match lyrics
- Professional-level composition with high note density
- Customizable tempo, key, and time signature
- Real-time audio playback in browser
- Synchronized lyrics highlighting during playback

### User Features
- **Guest Mode**: 5 drafts/day, no song saving
- **Registered Users**: 5 drafts/day, save up to 10 songs
- **Google OAuth**: Seamless authentication
- **History**: Access to previously generated songs and melodies
- **Quality Scores**: Automatic assessment of generated content

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key (or use mock mode for testing)
- PostgreSQL database (for production) or SQLite (for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd agentic-songwriter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create `.env.local`:
   ```bash
   # Required for LLM calls
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-4-turbo-preview  # Optional, defaults to gpt-4-turbo-preview
   USE_MOCK_LLM=false  # Set to true for testing without API costs

   # Database (development)
   DATABASE_URL="file:./dev.db"

   # NextAuth (for authentication)
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_secret_here  # Generate with: openssl rand -base64 32

   # Google OAuth (optional, for authentication)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

4. **Set up database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   Navigate to `http://localhost:3000`

### Mock Mode (Testing Without API Costs)

Set `USE_MOCK_LLM=true` in `.env.local` to test the agentic system without making actual LLM calls. This is useful for:
- Testing the orchestration logic
- Development without API costs
- Demonstrating the system architecture

## 📚 Architecture Deep Dive

### Agentic AI Pattern

Songsmith implements a **true agentic AI system** (not a prompt wrapper):

1. **Rule-Based Orchestration**: The orchestrator and agents make decisions using deterministic logic (if/else decision trees, no LLM calls)
2. **LLM-Powered Tools**: Creative work (generation, evaluation) happens in tools - LLM calls are ONLY in tools, never in agents
3. **Iterative Improvement**: Agents automatically improve until quality thresholds are met (using rule-based logic to decide when to iterate)
4. **Observability**: Every operation is traced and logged
5. **Guardrails**: Multiple safety mechanisms prevent infinite loops

### Data Flow

```
User Input → API Route → Orchestrator → Agent → Tools → LLM → Results → State Store → Response
```

1. User submits request via API
2. Orchestrator initializes agent with tools
3. Agent decides which tool to call (rule-based logic: if/else trees, NO LLM calls)
4. Tool validates input, calls LLM (this is where LLM calls happen), validates output
5. Results stored in state store
6. Agent evaluates results and decides next action (rule-based logic, NO LLM calls)
7. Process repeats until quality threshold met or max iterations reached
8. Final results returned to user

### State Management

- **StateStore**: In-memory key-value store for execution context
- **Database**: Persistent storage for songs, melodies, users, usage
- **Sessions**: NextAuth manages user sessions
- **Quotas**: Tracked in database per user/session per day

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

Test coverage includes:
- Core components (StateStore, ApprovalStore, Tool, Agent, Trace)
- Agent workflows (BriefAgent, MelodyAgent)
- Schema validation
- API routes

## 🚢 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy to Vercel:
1. Push code to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy!

**Free hosting options:**
- ✅ Vercel - Next.js hosting (free tier)
- ✅ Neon/Supabase - PostgreSQL database (free tier)

## 📖 Key Concepts

### Agentic AI vs. Prompt Engineering

**Traditional Approach (Prompt Engineering):**
- Single LLM call with a long prompt
- No iteration or improvement
- No decision-making logic
- Limited observability

**Agentic Approach (Songsmith):**
- Multiple LLM calls orchestrated intelligently by rule-based agents
- Iterative improvement with quality checks (agents decide when to iterate using deterministic logic)
- Rule-based decision making (agents use if/else trees, NOT LLM calls for decisions)
- Full observability and trace logging
- State management across calls
- Guardrails and safety mechanisms

### Tool Interface

All tools implement a base `Tool` class with:
- Automatic input/output validation (Zod schemas)
- Type-safe execution
- Error handling
- Trace logging

### Orchestration Pattern

The orchestrator implements:
- **Plan**: Agent decides what to do next
- **Act**: Execute tool call
- **Observe**: Store results in state
- **Reflect**: Agent evaluates and decides if improvement needed
- **Repeat**: Until quality threshold or max iterations

## 🔐 Security & Quotas

- **Authentication**: NextAuth.js with Google OAuth
- **User Management**: Database-backed sessions
- **Quotas**: 5 drafts/day per user (authenticated or guest)
- **Song Limits**: 10 saved songs for registered users, 0 for guests
- **API Rate Limiting**: Per-user daily quotas prevent abuse

## 📝 License

[Add your license here]

## 🤝 Contributing

[Add contribution guidelines here]

## 📧 Contact

[Add contact information here]
