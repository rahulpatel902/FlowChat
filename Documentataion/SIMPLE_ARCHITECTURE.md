# FlowChat - Simple Architecture Diagram

A clean, user-centric view of how data flows through FlowChat.

---

## System Data Flow

```mermaid
flowchart TB
    %% LAYER 0: USER
    subgraph L0[ ]
      direction TB
      User([👤 User])
    end

    %% LAYER 1: CLIENT INTENT (what the user does)
    subgraph L1[Presentation]
      direction LR
      ULogin[[Login]]
      USend[[Send Message]]
      UUpload[[Upload File]]
      UCreate[[Create Room]]
      UView[[View Profile]]
      UPresence[[Toggle Presence]]
    end

    %% LAYER 2: APPLICATION SERVICES
    subgraph L2[Application Services]
      direction LR
      Auth[Authentication<br/>Django]
      FAuth[Firebase Auth]
      Chat[Chat<br/>Django + Firestore]
      Profile[Profile<br/>Django]
      Media[Media<br/>Cloudinary]
      Presence[Presence<br/>Firebase RTDB]
      WS[Notifications<br/>Channels + Redis]
    end

    %% LAYER 3: DATA STORES
    subgraph L3[Data Stores]
      direction LR
      PG[(PostgreSQL<br/>Neon)]
      FS[(Firestore)]
      ST[(Cloudinary Storage)]
      RT[(RTDB)]
    end

    %% FLOWS (Top -> Down, Left -> Right)
    User --> ULogin
    User --> USend
    User --> UUpload
    User --> UCreate
    User --> UView
    User --> UPresence

    ULogin --> Auth
    Auth --> PG
    Auth -->|JWT + Custom Token| FAuth

    USend --> Chat
    Chat --> PG
    Chat --> FS
    Chat --> WS

    UUpload --> Media
    Media --> ST
    Media --> FS
    ST -->|File URL| FS

    UCreate --> Chat
    Chat --> PG
    UView --> Profile
    Profile --> PG

    UPresence --> Presence
    Presence --> RT

    %% Styling
    classDef user fill:#e8f5e9,stroke:#388e3c,stroke-width:3px
    classDef present fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef apps fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef data fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px

    class User user
    class ULogin,USend,UUpload,UPresence present
    class Auth,FAuth,Chat,Profile,Media,Presence,WS apps
    class PG,FS,ST,RT data
```

---

## Key Data Flows

**User → Auth:** Login Credentials  
**Auth → Postgres:** Verify User  
**Auth → User:** JWT + Firebase Token  

**User → Chat:** Send Message  
**Chat → Postgres:** Validate Permission  
**Chat → Firestore:** Store Message  
**Firestore → User:** Real-time Sync  

**User → Media:** Upload File  
**Media → Storage:** Store File  
**Storage → Firestore:** File URL  
**Firestore → User:** Display Media  

**User → Presence:** Online Status  
**Presence → Firestore:** Write Status  
**Firestore → User:** Show Status  

---

## System Components

### 🔐 Authentication System
- **Technology**: Django + PostgreSQL (Neon)
- **Function**: Verify credentials, generate JWT and Firebase tokens
- **Data**: User accounts, passwords, sessions

### 💬 Chat System
- **Technology**: Django + Firebase Firestore
- **Function**: Validate permissions, store messages, real-time sync
- **Data**: Messages, typing indicators, read receipts

### 📁 Media System
- **Technology**: Cloudinary
- **Function**: Store and serve files, images, avatars
- **Data**: Profile pictures, chat images, file attachments

### 👥 Presence System
- **Technology**: Firebase RTDB
- **Function**: Track online/offline status in real-time
- **Data**: User presence, last seen, active sessions

---

## Data Storage

| Database | What It Stores | Why |
|----------|----------------|-----|
| **PostgreSQL (Neon)** | Users, Rooms, Members, Permissions | Structured relational data |
| **Firestore** | Messages, Typing, Read Receipts | Real-time synchronization |
| **Cloudinary Storage** | Images, Files, Avatars | Large binary files |
| **RTDB** | Online Status, Presence | Real-time presence tracking |

---

## Technology Stack

**Frontend**: React + TailwindCSS + shadcn/ui (Vercel)  
**Backend**: Django + Django REST Framework (Render)  
**Database**: PostgreSQL (Neon)  
**Real-time**: Firebase (Firestore + RTDB)  
**WebSocket**: Django Channels + Redis  

---

*FlowChat - Simple, Fast, Real-time*
