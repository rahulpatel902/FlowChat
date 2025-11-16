# FlowChat - System Data Flow Diagram

A simple visual guide showing how data flows through the FlowChat application.

---

## Complete System Architecture Flow

```mermaid
graph TB
    subgraph Client["🖥️ CLIENT (Browser)"]
        UI[React UI<br/>TailwindCSS + shadcn/ui]
        AuthContext[Auth Context<br/>JWT Storage]
        ChatContext[Chat Context<br/>State Management]
        FirebaseSDK[Firebase SDK<br/>Client Library]
    end
    
    subgraph Backend["⚙️ BACKEND (Render)"]
        Django[Django API<br/>REST Framework]
        Channels[Django Channels<br/>WebSocket Server]
        Redis[(Redis<br/>Channel Layer)]
    end
    
    subgraph Database["💾 DATABASES"]
        Postgres[(PostgreSQL<br/>Neon)]
        Firestore[(Firestore<br/>Messages)]
        RTDB[(RTDB<br/>Presence)]
        Storage[(Cloudinary<br/>Media Files)]
    end
    
    UI -->|1. Login/Register| Django
    Django -->|2. Verify Credentials| Postgres
    Postgres -->|3. User Data| Django
    Django -->|4. JWT Token| UI
    Django -->|5. Firebase Custom Token| UI
    UI -->|6. Sign in to Firebase| FirebaseSDK
    
    UI -->|7. Send Message| Django
    Django -->|8. Validate & Store Metadata| Postgres
    Django -->|9. Write Message| Firestore
    Firestore -->|10. Real-time Update| FirebaseSDK
    FirebaseSDK -->|11. Display Message| UI
    
    UI -->|12. Upload File| Django
    Django -->|13. Store File| Storage
    Storage -->|14. File URL| Django
    Django -->|15. Create Message with URL| Firestore
    
    UI -->|16. Connect WebSocket| Channels
    Channels -->|17. Pub/Sub| Redis
    Redis -->|18. Broadcast| Channels
    Channels -->|19. Push Notification| UI
    
    UI -->|20. Update Presence| FirebaseSDK
    FirebaseSDK -->|21. Write Status| RTDB
    RTDB -->|22. Real-time Presence| FirebaseSDK
    FirebaseSDK -->|23. Show Online Status| UI
    
    style Client fill:#e1f5ff
    style Backend fill:#fff4e1
    style Database fill:#f0f0f0
```

---

## 1️⃣ Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant React
    participant Django
    participant Postgres
    participant Firebase
    
    User->>React: Enter credentials
    React->>Django: POST /api/auth/login
    Django->>Postgres: Query user table
    Postgres-->>Django: User record
    Django->>Django: Verify password
    Django->>Django: Generate JWT token
    Django->>Django: Generate Firebase custom token
    Django-->>React: JWT + Firebase token
    React->>React: Store JWT in localStorage
    React->>Firebase: signInWithCustomToken()
    Firebase-->>React: Firebase auth success
    React->>User: Redirect to chat
    
    Note over React,Firebase: User is now authenticated<br/>on both Django and Firebase
```

**Key Points:**
- Django handles primary authentication
- JWT token for Django API calls
- Firebase custom token for Firebase SDK access
- Both tokens issued simultaneously

---

## 2️⃣ Send Message Flow

```mermaid
sequenceDiagram
    participant User
    participant React
    participant Django
    participant Postgres
    participant Firestore
    participant OtherUsers
    
    User->>React: Type and send message
    React->>Django: POST /api/messages/ (JWT)
    Django->>Django: Validate JWT
    Django->>Postgres: Check room membership
    Postgres-->>Django: User is member
    Django->>Firestore: Write to chat_rooms_{roomId}
    Firestore-->>Django: Message ID
    Django->>Postgres: Store message metadata (optional)
    Django-->>React: Success response
    
    Firestore->>OtherUsers: Real-time listener triggers
    OtherUsers->>OtherUsers: Display new message
    
    Note over Firestore,OtherUsers: Real-time sync via<br/>Firebase SDK listeners
```

**Key Points:**
- Django validates permissions
- Message content stored in Firestore
- Real-time delivery via Firebase listeners
- Optional metadata in PostgreSQL

---

## 3️⃣ File Upload Flow

```mermaid
sequenceDiagram
    participant User
    participant React
    participant DjangoAPI
    participant Firestore
    participant OtherUsers
    
    User->>React: Select file/image
    React->>React: Validate file (size, type)
    React->>DjangoAPI: Upload (multipart/form-data)
    DjangoAPI-->>React: Upload progress events
    DjangoAPI-->>React: Cloudinary URL
    React->>Firestore: Create message with file URL
    Firestore-->>React: Message created
    React->>User: Show uploaded file
    
    Firestore->>OtherUsers: Real-time update
    OtherUsers->>DjangoAPI: Fetch file via Cloudinary URL
    DjangoAPI-->>OtherUsers: File data (via Cloudinary CDN)
    
    Note over React,Firestore: Files stored in Cloudinary<br/>URLs stored in Firestore messages
```

**Key Points:**
- Direct upload to Cloudinary via Django API
- No Firebase involvement (reduces backend load)
- Download URLs stored in message documents
- Real-time file sharing

---

## 4️⃣ Real-time Presence Flow

```mermaid
sequenceDiagram
    participant User
    participant React
    participant RTDB
    participant OtherUsers
    
    User->>React: Login/Open app
    React->>RTDB: Write to status/{uid}/connections/{sessionId}
    React->>RTDB: Register onDisconnect() handler
    RTDB-->>React: Presence confirmed
    React->>User: Show as online
    
    RTDB->>OtherUsers: Real-time presence update
    OtherUsers->>OtherUsers: Show user online
    
    User->>React: Close tab/logout
    RTDB->>RTDB: Trigger onDisconnect()
    RTDB->>RTDB: Remove session
    RTDB->>OtherUsers: Presence update (offline)
    OtherUsers->>OtherUsers: Show user offline
    
    Note over React,RTDB: Multi-session support:<br/>online if any session active
```

**Key Points:**
- Firebase RTDB for real-time presence
- Multi-session tracking (multiple tabs/devices)
- Automatic offline on disconnect
- No Django involvement

---

## 5️⃣ WebSocket Notification Flow

```mermaid
sequenceDiagram
    participant UserA
    participant ReactA
    participant DjangoChannels
    participant Redis
    participant ReactB
    participant UserB
    
    UserA->>ReactA: Perform action (create room, etc.)
    ReactA->>DjangoChannels: WebSocket message
    DjangoChannels->>DjangoChannels: Authenticate JWT
    DjangoChannels->>Redis: Publish to channel
    Redis->>DjangoChannels: Broadcast to subscribers
    DjangoChannels->>ReactB: Push notification
    ReactB->>UserB: Show notification/update UI
    
    Note over DjangoChannels,Redis: Used for instant notifications<br/>when Firestore listeners aren't enough
```

**Key Points:**
- Django Channels for WebSocket connections
- Redis as message broker
- Real-time notifications (room created, member added, etc.)
- Complements Firebase real-time features

---

## 6️⃣ Create Chat Room Flow

```mermaid
sequenceDiagram
    participant User
    participant React
    participant Django
    participant Postgres
    participant Firestore
    participant WebSocket
    participant OtherUser
    
    User->>React: Create new room
    React->>Django: POST /api/rooms/ (JWT)
    Django->>Django: Validate JWT
    Django->>Postgres: Create room record
    Django->>Postgres: Add members
    Postgres-->>Django: Room created
    Django->>Firestore: Initialize empty collection
    Django->>WebSocket: Notify members
    Django-->>React: Room data
    React->>User: Show new room
    
    WebSocket->>OtherUser: Room created notification
    OtherUser->>OtherUser: Add room to sidebar
    
    Note over Django,Firestore: Room metadata in Postgres<br/>Messages in Firestore
```

**Key Points:**
- Room metadata in PostgreSQL (Neon)
- Members and permissions in PostgreSQL
- Message collection initialized in Firestore
- WebSocket notifies other members

---

## 7️⃣ Read Receipts & Typing Indicators

```mermaid
sequenceDiagram
    participant UserA
    participant ReactA
    participant Firestore
    participant ReactB
    participant UserB
    
    rect rgb(240, 248, 255)
        Note over UserA,UserB: Typing Indicator Flow
        UserA->>ReactA: Start typing
        ReactA->>Firestore: Write to typing_{roomId}/{userId}
        Firestore->>ReactB: Real-time update
        ReactB->>UserB: Show "UserA is typing..."
        UserA->>ReactA: Stop typing
        ReactA->>Firestore: Delete typing_{roomId}/{userId}
        Firestore->>ReactB: Real-time update
        ReactB->>UserB: Hide typing indicator
    end
    
    rect rgb(255, 248, 240)
        Note over UserA,UserB: Read Receipt Flow
        UserB->>ReactB: View message
        ReactB->>Firestore: Write to read_receipts_{roomId}_{msgId}/{userId}
        Firestore->>ReactA: Real-time update
        ReactA->>UserA: Show "Read by UserB"
    end
```

**Key Points:**
- All handled by Firestore (no Django)
- Real-time updates via Firebase SDK
- Typing: temporary documents
- Read receipts: permanent documents

---

## Data Storage Summary

| Data Type | Storage Location | Why |
|-----------|------------------|-----|
| **User accounts** | PostgreSQL (Neon) | Structured, relational data |
| **Room metadata** | PostgreSQL (Neon) | Relationships, permissions |
| **Room members** | PostgreSQL (Neon) | Many-to-many relationships |
| **Chat messages** | Firestore | Real-time sync, scalability |
| **Typing indicators** | Firestore | Real-time, temporary |
| **Read receipts** | Firestore | Real-time, per-message |
| **Online status** | RTDB | Real-time presence |
| **Images/Files** | Cloudinary | Large binary files |
| **Profile pictures** | Cloudinary | Media files |
| **WebSocket sessions** | Redis | Temporary, fast pub/sub |

---

## Technology Stack Map

```mermaid
graph LR
    subgraph Frontend["Frontend (Vercel)"]
        React[React.js]
        Tailwind[TailwindCSS]
        Shadcn[shadcn/ui]
    end
    
    subgraph Backend["Backend (Render)"]
        Django[Django + DRF]
        Channels[Django Channels]
        Gunicorn[Gunicorn]
    end
    
    subgraph Firebase["Firebase"]
        Firestore[Firestore]
        RTDB[RTDB]
        Auth[Auth SDK]
    end
    
    subgraph Infrastructure["Infrastructure"]
        Neon[Neon PostgreSQL]
        Redis[Redis]
        Vercel[Vercel CDN]
        Render[Render Hosting]
        Cloudinary[Cloudinary]
    end
    
    React --> Django
    React --> Auth
    Auth --> Firestore
    Auth --> RTDB
    Django --> Neon
    Channels --> Redis
    Django --> Firestore
    Django --> Cloudinary
    
    style Frontend fill:#e1f5ff
    style Backend fill:#fff4e1
    style Firebase fill:#ffe1e1
    style Infrastructure fill:#f0f0f0
```

---

## Request Flow Examples

### Example 1: User sends a text message
1. User types in React UI
2. React → Django API (validate permission)
3. Django → PostgreSQL (check membership)
4. Django → Firestore (write message)
5. Firestore → All clients (real-time update)
6. React displays message

### Example 2: User uploads an image
1. User selects image in React
2. React → Django API (validate and upload)
3. Django → Cloudinary (store file)
4. Cloudinary → Django (download URL)
5. Django → Firestore (message with image URL)
6. Firestore → All clients (real-time update)
7. Clients fetch image from Cloudinary URL

### Example 3: User goes online
1. User logs in
2. React → Firebase RTDB (write presence)
3. RTDB registers onDisconnect handler
4. RTDB → All subscribers (real-time presence)
5. Other users see "online" status

### Example 4: User searches for another user
1. User types in search box
2. React → Django API (search query)
3. Django → PostgreSQL (query users table)
4. PostgreSQL → Django (matching users)
5. Django → React (user list)
6. React displays results

---

## Security Flow

```mermaid
graph TB
    Request[Client Request]
    
    Request --> CheckJWT{Has JWT?}
    CheckJWT -->|No| Reject[401 Unauthorized]
    CheckJWT -->|Yes| ValidateJWT[Validate JWT]
    
    ValidateJWT --> JWTValid{Valid?}
    JWTValid -->|No| Reject
    JWTValid -->|Yes| CheckPermission[Check Permissions]
    
    CheckPermission --> HasPermission{Authorized?}
    HasPermission -->|No| Forbidden[403 Forbidden]
    HasPermission -->|Yes| ProcessRequest[Process Request]
    
    ProcessRequest --> FirebaseAuth{Needs Firebase?}
    FirebaseAuth -->|Yes| CheckFirebaseToken[Validate Firebase Token]
    FirebaseAuth -->|No| Response[Return Response]
    
    CheckFirebaseToken --> FirebaseValid{Valid?}
    FirebaseValid -->|No| Reject
    FirebaseValid -->|Yes| Response
    
    style Reject fill:#ffcccc
    style Forbidden fill:#ffcccc
    style Response fill:#ccffcc
```

**Security Layers:**
1. **JWT Authentication**: All Django API requests
2. **Firebase Authentication**: All Firebase SDK operations
3. **Permission Checks**: Room membership, ownership
4. **Firebase Rules**: Firestore, Storage, RTDB security rules
5. **CORS**: Restrict origins to Vercel domain

---

## Summary: Data Flow Patterns

### Pattern 1: Django-First (Structured Data)
**User Management, Room Metadata, Permissions**
```
Client → Django API → PostgreSQL → Django → Client
```

### Pattern 2: Firebase-First (Real-time Data)
**Messages, Typing, Presence**
```
Client → Firebase SDK → Firestore/RTDB → Firebase SDK → All Clients
```

### Pattern 3: Hybrid (Validation + Real-time)
**Send Message, Create Room**
```
Client → Django (validate) → PostgreSQL + Firestore → Firebase SDK → All Clients
```

### Pattern 4: Direct Upload (Media)
**Images, Files, Avatars**
```
Client → Firebase Storage → Download URL → Firestore → All Clients
```

---

*FlowChat - Simple, Fast, Real-time*
