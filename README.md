# GymGenius – AI Fitness Coach App

A cross-platform fitness tracking app built with React Native (Expo) and Supabase. Features an AI-powered workout coach, plan generation, workout logging, and progress analytics.

## Tech Stack

- **Framework:** React Native with [Expo](https://expo.dev) (SDK 54)
- **Routing:** [Expo Router](https://docs.expo.dev/router/introduction/) (file-based)
- **Styling:** [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
- **Backend:** [Supabase](https://supabase.com/) (Auth, Database, Storage)
- **AI:** OpenAI API (GPT-4o for coaching & plan generation)
- **Testing:** Jest + ts-jest
- **Language:** TypeScript

## Project Structure

```
app/                    # Screens & routing (Expo Router file-based routing)
├── (auth)/             # Login & signup screens
├── (tabs)/             # Main tab navigation (Dashboard, Planner, Chat)
├── plans/              # Plan creation & editing
├── workout/            # Workout logging & summaries
├── onboarding.tsx      # User onboarding flow
└── profile.tsx         # Settings & user profile

src/
├── components/         # Reusable UI components
├── constants/          # Theme & config
├── context/            # React contexts (Auth, Workout, Plan, AIChat)
├── hooks/              # Custom hooks
├── lib/                # Database types, Supabase client, OpenAI client
├── patterns/           # Design patterns (see below)
├── services/           # Business logic & API calls
└── tests/              # Test suites (unit, integration, system, e2e)

supabase/               # Database migrations
scripts/                # Utility scripts (exercise sync, embeddings, etc.)
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm
- Expo CLI (`npm install -g expo-cli`)
- A Supabase project (for backend)
- An OpenAI API key

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/maximpazer/fitness-app.git
cd fitness-app

# 2. Install dependencies
npm install

# 3. Set up environment variables
#    Create a .env or configure in your Supabase/OpenAI dashboards:
#    - EXPO_PUBLIC_SUPABASE_URL
#    - EXPO_PUBLIC_SUPABASE_ANON_KEY
#    - EXPO_PUBLIC_OPENAI_API_KEY

# 4. Start the development server
npx expo start
```

This will open options to run on:
- iOS Simulator
- Android Emulator
- Web browser
- Expo Go (on physical device)

### Build & Deploy (Web)

```bash
# Export static web build
npx expo export --platform web

# Deploy to EAS Hosting
eas deploy --prod
```

## Design Patterns

The app implements two creational design patterns to keep the AI layer flexible and extensible.

### Factory Method – `CoachFactory`

**Location:** `src/patterns/factory/CoachFactory.ts`

Creates specialized coaching personalities based on user preference. Each coach generates different system prompts and analysis styles for the AI.

- **Interface:** `WorkoutCoach` – defines `getAnalysisPrompt(workoutData, profile, comparison)`
- **Products:** `AnalyticCoach` (data-focused, numbers-first) and `MotivationalCoach` (encouraging, consistency-focused)
- **Factory:** `CoachFactory.createCoach(type)` – returns the right coach based on the `type` parameter

```typescript
const coach = CoachFactory.createCoach('analytic');
const { systemInstruction, userPrompt } = coach.getAnalysisPrompt(workoutData, profile, comparison);
```

### Abstract Factory – `AIFactory`

**Location:** `src/patterns/abstract-factory/AIFactory.ts`

Creates families of AI-related products (coach + plan generator) that are compatible with a specific AI provider. This makes it easy to swap between AI backends (e.g. OpenAI ↔ Gemini) without changing client code.

- **Abstract Products:** `AbstractWorkoutCoach`, `AbstractPlanGenerator`
- **Abstract Factory:** `AIFactory` interface with `createCoach()` and `createPlanGenerator()`
- **Concrete Factories:** `GeminiAIFactory` and `OpenAIAIFactory` – each produces a matching coach + plan generator pair
- **Client:** `AIClient` – consumes the factory without knowing which AI backend is used

```typescript
const factory = new OpenAIAIFactory();
const coach = factory.createCoach();
const generator = factory.createPlanGenerator();
```

## Testing

Tests are organized by scope under `src/tests/`:

```
src/tests/
├── unit/           # 4 unit tests – CoachFactory
├── integration/    # 2 integration tests – AIFactory
├── system/         # 1 system test – Workout analysis flow
└── e2e/            # 1 end-to-end test – Full user journey
```

### Running Tests

```bash
# Run all tests
npx jest

# Run with coverage report
npx jest --coverage

# Run a specific test suite
npx jest src/tests/unit/CoachFactory.test.ts
```

### Test Overview

| Type | File | What it tests |
|------|------|---------------|
| **Unit** | `CoachFactory.test.ts` | Factory creates correct coach types; each coach returns the right prompt structure |
| **Integration** | `AIFactory.test.ts` | Abstract factory creates compatible product families (Gemini & OpenAI) |
| **System** | `WorkoutAnalysisFlow.test.ts` | Full analysis flow: mock data → CoachFactory → prompt construction |
| **E2E** | `FullUserJourney.test.ts` | Simulated user journey: login → plan generation → workout log → analysis |
