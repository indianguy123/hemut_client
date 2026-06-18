# 🖥️ Hemut Logistics Platform — Frontend

> **Real-time logistics collaboration UI** built with Next.js 16, React 19, TypeScript, and raw XMLHttpRequest.  
> Slack-inspired interface with channels, DMs, presence indicators, AI-powered RAG chat, and automated logistics alerting.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Screens & Features](#screens--features)
- [XHR Implementation](#xhr-implementation)
- [WebSocket Client](#websocket-client)
- [State Management](#state-management)
- [Form Validation](#form-validation)
- [Getting Started](#getting-started)
- [Docker](#docker)
- [Environment Configuration](#environment-configuration)
- [Design Decisions & Tradeoffs](#design-decisions--tradeoffs)

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│                    Next.js App Router                         │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                  Context Providers                       │ │
│  │  ┌──────────────┐    ┌────────────────────┐              │ │
│  │  │ AuthProvider  │    │ WebSocketProvider  │              │ │
│  │  │ (JWT + User)  │    │ (Real-time events) │              │ │
│  │  └──────┬───────┘    └────────┬───────────┘              │ │
│  └─────────┼─────────────────────┼──────────────────────────┘ │
│            │                     │                            │
│  ┌─────────▼─────────────────────▼──────────────────────────┐ │
│  │                     Pages                                │ │
│  │  /login  /register  /chat  /chat/channel/[id]            │ │
│  │  /chat/dm/[userId]  /alerts                              │ │
│  └──────────────┬───────────────────────────────────────────┘ │
│                 │                                             │
│  ┌──────────────▼───────────────────────────────────────────┐ │
│  │                  Components                              │ │
│  │  Sidebar (channels + DMs + shipments)                    │ │
│  │  AiChatPanel (RAG interface)                             │ │
│  └──────────────┬───────────────────────────────────────────┘ │
│                 │                                             │
│  ┌──────────────▼───────────────────────────────────────────┐ │
│  │                  Libraries                               │ │
│  │  ┌──────────┐  ┌───────────┐  ┌──────┐  ┌───────────┐   │ │
│  │  │ xhr.ts   │  │websocket.ts│  │auth.ts│ │constants.ts│  │ │
│  │  │ (Raw XHR)│  │(WS Client)│  │(Token)│  │(API URLs) │  │ │
│  │  └──────────┘  └───────────┘  └──────┘  └───────────┘   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                         │                    │                 │
│              XHR Requests            WebSocket                │
│                    │                    │                      │
└────────────────────┼────────────────────┼─────────────────────┘
                     │                    │
                     ▼                    ▼
              ┌────────────┐    ┌──────────────────┐
              │ FastAPI     │    │ FastAPI WebSocket │
              │ REST API    │    │ /ws?token=<JWT>  │
              └────────────┘    └──────────────────┘
```

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Next.js 16 (App Router) | Server/client routing, layouts |
| **UI Library** | React 19 | Component rendering with latest features |
| **Language** | TypeScript 5 | Type safety across the codebase |
| **Styling** | CSS Modules | Scoped, collision-free styling |
| **HTTP Client** | Raw `XMLHttpRequest` | **Assignment constraint** — full lifecycle handling |
| **Real-time** | Native `WebSocket` | Custom client with auto-reconnect + heartbeat |
| **State** | React Context API | Auth state + WebSocket connection sharing |
| **Build** | Next.js compiler (Turbopack) | Fast development builds |

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx                # Root layout with Context providers
│   │   ├── page.tsx                  # Landing / redirect to login
│   │   ├── globals.css               # Global design system + CSS variables
│   │   ├── page.module.css           # Landing page styles
│   │   │
│   │   ├── login/
│   │   │   ├── page.tsx              # Login form with XHR validation
│   │   │   └── auth.module.css       # Auth pages shared styles
│   │   │
│   │   ├── register/
│   │   │   └── page.tsx              # Registration form with real-time validation
│   │   │
│   │   ├── chat/
│   │   │   ├── layout.tsx            # Chat layout (sidebar + content area)
│   │   │   ├── page.tsx              # Default chat view (welcome screen)
│   │   │   ├── chat.module.css       # Chat view styles
│   │   │   │
│   │   │   ├── channel/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # Channel message view (24KB — full featured)
│   │   │   │
│   │   │   └── dm/
│   │   │       └── [userId]/
│   │   │           └── page.tsx      # Direct message 1:1 view
│   │   │
│   │   └── alerts/
│   │       ├── page.tsx              # AI alerts dashboard
│   │       └── alerts.module.css     # Alerts page styles
│   │
│   ├── components/
│   │   └── chat/
│   │       ├── Sidebar.tsx           # Channel list, DMs, shipments sidebar
│   │       ├── Sidebar.module.css    # Sidebar styles
│   │       ├── AiChatPanel.tsx       # AI RAG chat slide-out panel
│   │       └── AiChatPanel.module.css# AI panel styles
│   │
│   ├── context/
│   │   ├── AuthContext.tsx           # Auth state provider (token, user, login/logout)
│   │   └── WebSocketContext.tsx      # WebSocket connection provider
│   │
│   └── lib/
│       ├── xhr.ts                    # Raw XMLHttpRequest utility (core constraint)
│       ├── websocket.ts             # WebSocket client with reconnect + heartbeat
│       ├── auth.ts                   # Token/user localStorage helpers
│       └── constants.ts             # API URL constants
│
├── public/                           # Static assets
├── Dockerfile                        # Multi-stage production build
├── package.json                      # Dependencies (zero extra libraries!)
├── tsconfig.json                     # TypeScript configuration
├── next.config.ts                    # Next.js configuration
└── eslint.config.mjs                 # ESLint configuration
```

---

## Screens & Features

### 1. Login Page (`/login`)

- **DB-backed credential validation** via raw XHR POST to `/api/auth/login`
- Case-insensitive username/email matching
- Client-side form validation (required fields, minimum lengths)
- Error display for invalid credentials (401)
- Auto-redirect to `/chat` on success
- Link to register page

### 2. Register Page (`/register`)

- **Full registration form** with real-time field validation:
  - Username: 3–50 chars, alphanumeric + underscore/hyphen only
  - Email: Valid email format
  - Password: Minimum 6 characters, confirmation match
  - Display name: Required
- Duplicate username/email detection (409 conflict handling)
- Auto-join to all public channels on registration
- Auto-redirect to `/chat` on success

### 3. Chat Layout (`/chat`)

- **Sidebar** with three sections:
  - **Channels**: Joined channels with `#` prefix and unread count badges
  - **Direct Messages**: DM conversations with other user display
  - **Shipments**: Sidebar panel listing all shipments with status color coding
- **Channel creation** modal
- **User picker** for initiating DMs
- Active channel/DM highlighting
- Responsive layout

### 4. Channel Message View (`/chat/channel/[id]`)

- **Real-time messaging** via WebSocket (messages appear instantly)
- **Message history** with infinite scroll (cursor-based pagination)
- **Message input** with Enter to send
- **Sender info**: Avatar/initials, display name, timestamp
- **Typing indicators**: Shows when other users are typing
- **Unread tracking**: Marks channel as read on view
- **Presence indicators**: Online (green), Away (amber), Offline (gray) dots on member list
- **Shipment preview cards**: Messages containing tracking IDs render enriched shipment cards with status, route, carrier, ETA
- **AI Chat panel**: Slide-out RAG assistant for asking questions about channel context
- **File attachments**: Upload images/files via Cloudinary integration
- **Channel members list** with live presence status
- **Message types**: Text, shipment cards, AI summaries, media

### 5. Direct Message View (`/chat/dm/[userId]`)

- **1:1 messaging** with real-time delivery
- Same feature set as channel view (typing indicators, presence, history)
- Auto-creates DM channel on first message
- Shows other user's online status prominently

### 6. AI Alerts Dashboard (`/alerts`)

- **Paginated alert list** with severity-based ordering (HIGH → MEDIUM → LOW)
- **Alert cards** showing: severity badge, title, reason, source channel, timestamp
- **Resolve action**: Mark alerts as resolved
- **Real-time notifications**: New alerts appear instantly via WebSocket broadcast
- **Color-coded severity**: RED for HIGH, AMBER for MEDIUM, BLUE for LOW

### Logistics Context Surfaces

The platform is permeated with logistics domain awareness:

| Surface | Implementation |
|---------|---------------|
| **Channel names** | `#route-east`, `#warehouse-mumbai`, `#dispatch`, `#escalations` |
| **Mock shipments** | 10 realistic Indian logistics shipments (Mumbai→Delhi, Chennai→Bangalore, etc.) |
| **Shipment sidebar** | Dedicated sidebar panel listing all shipments with status colors |
| **Shipment preview cards** | Messages mentioning tracking IDs auto-render rich shipment cards |
| **AI chat** | RAG-grounded answers about channel conversations AND shipment data |
| **AI alerts** | Automated detection of delays, escalations, SLA risks in messages |
| **Presence indicators** | Critical for dispatch teams to know who's online/available |

---

## XHR Implementation

### Why Raw XMLHttpRequest?

The assignment explicitly requires `XMLHttpRequest` instead of `fetch` or `axios` to demonstrate understanding of the HTTP request lifecycle. Our implementation in [`xhr.ts`](src/lib/xhr.ts) handles **every XHR event**:

```typescript
// Full lifecycle demonstration
xhr.open(method, url, true);          // 1. Open connection (async)
xhr.setRequestHeader(key, value);     // 2. Set headers
xhr.timeout = timeout;                 // 3. Configure timeout

// 4. Event handlers
xhr.onload = () => { ... };           // Request completed (any status)
xhr.onerror = () => { ... };          // Network failure (DNS, CORS, no connection)
xhr.ontimeout = () => { ... };        // Exceeded timeout threshold
xhr.onabort = () => { ... };          // xhr.abort() was called
xhr.onprogress = handler;            // Download progress tracking
xhr.upload.onprogress = handler;     // Upload progress tracking

// 5. Send
xhr.send(JSON.stringify(body));       // Fire the request
```

### Features

| Feature | Implementation |
|---------|---------------|
| **Typed responses** | Generic `XHRResponse<T>` with parsed JSON |
| **Error classification** | `network`, `timeout`, `abort`, `http`, `parse` error types |
| **Abort support** | Returns `XHRHandle` with `.abort()` method |
| **Progress tracking** | Both download and upload progress events |
| **FormData support** | Auto-detects FormData for file uploads (skips JSON Content-Type) |
| **Convenience wrappers** | `xhrGet`, `xhrPost`, `xhrPatch`, `xhrDelete` |
| **Auth integration** | Headers passed from `getAuthHeaders()` utility |

### Usage Pattern

```typescript
// Every API call uses raw XHR
import { xhrPost, xhrGet } from '@/lib/xhr';
import { getAuthHeaders } from '@/lib/auth';

// Login (no auth header needed)
const { promise } = xhrPost(API.LOGIN, { username, password });
const response = await promise;

// Fetch channels (with JWT auth)
const { promise } = xhrGet(API.CHANNELS, getAuthHeaders());
const channels = (await promise).data;

// Abort example
const handle = xhrGet(API.MESSAGES(channelId), getAuthHeaders());
// ... later
handle.abort(); // Cancels the request
```

---

## WebSocket Client

The custom WebSocket client in [`websocket.ts`](src/lib/websocket.ts) provides:

### Auto-Reconnect with Exponential Backoff

```
Attempt 1: 1000ms delay
Attempt 2: 2000ms delay
Attempt 3: 4000ms delay
...
Attempt 10: 30000ms (capped)
→ Max reconnect reached → emit 'max_reconnect' event
```

### Heartbeat Mechanism

- Sends `{"type": "ping"}` every 30 seconds
- Server responds with `{"type": "pong"}`
- Keeps connection alive through proxies/load balancers
- Refreshes Redis presence TTL server-side

### Event-Driven Architecture

```typescript
const client = createWSClient(wsUrl);

// Register handlers
client.on('new_message', (data) => {
  // Handle real-time message
});

client.on('presence_update', (data) => {
  // Update user status indicator
});

client.on('typing_indicator', (data) => {
  // Show typing animation
});

client.on('AI_ALERT_CREATED', (data) => {
  // Show alert notification
});

// Lifecycle events
client.on('connected', () => { /* WS open */ });
client.on('disconnected', () => { /* WS closed */ });
client.on('auth_error', () => { /* Token expired */ });
```

### Connection Lifecycle Management

- **Connect**: Creates WebSocket, registers handlers, starts heartbeat
- **Disconnect**: Intentional close (code 1000), stops heartbeat, clears timers
- **Reconnect**: Automatic on abnormal close (not on auth failure code 4001)
- **Deduplication**: Prevents multiple simultaneous connection attempts

---

## State Management

### AuthContext

Manages authentication state across the application:

```typescript
interface AuthContextType {
  user: StoredUser | null;    // Current user info
  token: string | null;       // JWT token
  isLoading: boolean;         // Initial hydration state
  login: (token, user) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}
```

- **Persistence**: Token + user stored in `localStorage`
- **Hydration**: Reads from localStorage on mount (SSR-safe with `typeof window` check)
- **Token refresh**: Calls `/api/auth/me` to validate and refresh user data

### WebSocketContext

Provides WebSocket access to all child components:

```typescript
interface WebSocketContextType {
  send: (data) => void;       // Send message to server
  on: (type, handler) => void; // Register event handler
  off: (type, handler) => void;// Unregister handler
  isConnected: boolean;        // Connection status
}
```

- **Auto-connect**: Connects when `token` is available, disconnects on logout
- **Cleanup**: Properly disconnects on unmount to prevent memory leaks
- **Shared connection**: Single WebSocket connection shared across all pages/components

---

## Form Validation

All form validation uses **raw XMLHttpRequest** as required:

### Login Form

```typescript
// Client-side validation
if (!username.trim()) errors.push('Username is required');
if (!password.trim()) errors.push('Password is required');

// Server-side validation via XHR
const { promise } = xhrPost(API.LOGIN, { username, password });
try {
  const response = await promise;
  // Success: redirect to /chat
} catch (err) {
  if (err.type === 'http' && err.status === 401) {
    setError('Invalid username or password');
  }
}
```

### Register Form

- **Username**: 3+ chars, alphanumeric + `_`/`-` pattern
- **Email**: Format validation
- **Password**: 6+ chars, confirmation must match
- **Display name**: Required, non-empty
- **Server validation**: Duplicate username/email returns 409

---

## Getting Started

### Prerequisites

- Node.js 20+
- Backend server running on `http://localhost:8000`

### Setup

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Configure environment
# Create .env.local (or use defaults):
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:8000" >> .env.local

# 4. Start development server
npm run dev
```

The app will be available at **http://localhost:3000**.

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start development server (Turbopack) |
| `build` | `npm run build` | Production build |
| `start` | `npm run start` | Start production server |
| `lint` | `npm run lint` | Run ESLint |

---

## Docker

The easiest way to run the entire platform (frontend, backend, database, redis) is using Docker Compose.

### 1. Environment Configuration
Create a `.env` file in the root of the project with the following necessary variables:
```env
# Required for Backend Authentication
JWT_SECRET=your_super_secret_jwt_key_here

# Optional: AI Features (RAG, Alerts)
OPENAI_API_KEY=your_openai_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=hemut-rag

# Optional: Cloudinary File Uploads
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```
*Note: `DATABASE_URL` and `REDIS_URL` are already configured inside the `docker-compose.yml` for the local container network.*

### 2. Run the Platform
Run the following command from the root directory to spin up all services:
```bash
docker-compose up --build
```
Once running, the frontend will be available at **http://localhost:3000** and the backend API at **http://localhost:8000**.

### `docker-compose.yml` Reference
If you don't have the `docker-compose.yml` file, here is the complete content to place in the root directory:

```yaml
services:
  # ---------------------------------------------------------------------------
  # Infrastructure
  # ---------------------------------------------------------------------------
  postgres:
    image: postgres:16-alpine
    container_name: hemut-postgres
    environment:
      POSTGRES_USER: hemut
      POSTGRES_PASSWORD: hemut_secret
      POSTGRES_DB: hemut_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hemut -d hemut_db"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: hemut-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ---------------------------------------------------------------------------
  # Application
  # ---------------------------------------------------------------------------
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: hemut-backend
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      # Override DB/Redis URLs to point to Docker service hostnames
      DATABASE_URL: postgresql://hemut:hemut_secret@postgres:5432/hemut_db
      REDIS_URL: redis://redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: http://localhost:8000
        NEXT_PUBLIC_WS_URL: ws://localhost:8000
    container_name: hemut-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      - NEXT_PUBLIC_WS_URL=ws://localhost:8000
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Multi-Stage Build & Manual Docker Run

The Dockerfile uses a multi-stage build for minimal production images:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
# ... npm ci, next build

# Stage 2: Production
FROM node:20-alpine AS runner
# ... only .next/standalone + static assets
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
# Build
docker build -t hemut-frontend \
  --build-arg NEXT_PUBLIC_API_URL=http://api.example.com \
  --build-arg NEXT_PUBLIC_WS_URL=ws://api.example.com \
  ./frontend

# Run
docker run -p 3000:3000 hemut-frontend
```

---

## Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend REST API base URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8000` | Backend WebSocket base URL |

These are **build-time variables** (prefixed with `NEXT_PUBLIC_`) — they're embedded in the client bundle at build time.

---

## Design Decisions & Tradeoffs

### Why CSS Modules over Tailwind?

- **Assignment scope**: Demonstrates CSS mastery without framework dependency
- **Scoping**: Automatic class name collision prevention
- **Performance**: No utility CSS overhead in production bundle
- **Colocation**: Styles live next to their components

### Why React Context over Redux/Zustand?

- **Minimal overhead**: Only 2 global concerns (Auth + WebSocket)
- **Zero dependencies**: No additional state management libraries
- **React 19 optimized**: Context works well with React 19's rendering improvements
- **WebSocket singleton**: Context ensures one WS connection per session

### Handling Real-Time State in React

The hardest challenges in real-time chat with React, and how we address them:

| Challenge | Solution |
|-----------|----------|
| **Stale closures** in WS handlers | Event-driven architecture with `on/off` pattern; handlers reference latest state via refs |
| **Memory leaks** on unmount | `useEffect` cleanup calls `client.disconnect()` and `off()` for all handlers |
| **Reconnection after network loss** | Exponential backoff with max 10 attempts; `connected`/`disconnected` events update UI |
| **Message ordering** | Server assigns monotonic `sequence_num`; UI sorts by sequence number |
| **Re-render churn** | Messages stored in component state; WebSocket context only exposes connection utilities |

### XHR vs Fetch Tradeoff

| Aspect | XHR (Used) | Fetch (Not Used) |
|--------|-----------|-------------------|
| **Progress events** | ✅ Native `onprogress` + `upload.onprogress` | ❌ Requires ReadableStream workaround |
| **Abort** | ✅ `xhr.abort()` | ✅ `AbortController` |
| **Timeout** | ✅ Native `xhr.timeout` property | ❌ Manual with `setTimeout` |
| **Error handling** | ✅ Separate `onerror`, `ontimeout`, `onabort` | ❌ Single `catch` for all failures |
| **Streaming** | ❌ Buffered response | ✅ ReadableStream |
| **Ergonomics** | ❌ Callback-based (wrapped in Promise) | ✅ Promise-native |

We wrapped XHR in a Promise-based API (`xhrRequest<T>`) to get the best of both worlds: full XHR lifecycle control with modern async/await ergonomics.

### Zero External UI Dependencies

The entire frontend uses **only 3 dependencies**: `next`, `react`, `react-dom`. No UI libraries, no HTTP clients, no state management libraries. Everything is built from scratch to demonstrate understanding of the underlying APIs.
