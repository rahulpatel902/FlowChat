# FlowChat - Data Flow Diagrams (DFD)

This document contains Data Flow Diagrams for the FlowChat application at different levels of abstraction.

---

## Level 0 DFD (Context Diagram)

The context diagram shows the FlowChat system as a single process with external entities.

```mermaid
graph TB
    User([User])
    Admin([Admin])
    Firebase[(Firebase Services)]
    
    System[FlowChat System]
    
    User -->|Register/Login| System
    User -->|Send Messages| System
    User -->|Upload Files| System
    User -->|View Profile| System
    
    System -->|Authentication Token| User
    System -->|Messages/Notifications| User
    System -->|Profile Data| User
    
    Admin -->|Manage System| System
    System -->|System Reports| Admin
    
    System -->|Store Messages| Firebase
    System -->|Store Media| Firebase
    System -->|Presence Updates| Firebase
    Firebase -->|Real-time Data| System
```

**External Entities:**
- **User**: End users who chat, send messages, and manage profiles
- **Admin**: System administrators who manage the application
- **Firebase Services**: External cloud services for real-time messaging, storage, and presence

**Data Flows:**
- User authentication and registration
- Message exchange and file uploads
- Profile management
- Real-time notifications and presence updates

---

## Level 1 DFD

Level 1 breaks down the FlowChat system into major subsystems.

```mermaid
graph TB
    User([User])
    Admin([Admin])
    
    subgraph FlowChat_System[FlowChat System]
        Auth[1.0<br/>Authentication<br/>Module]
        Chat[2.0<br/>Chat<br/>Module]
        Profile[3.0<br/>Profile<br/>Module]
        Media[4.0<br/>Media<br/>Module]
        Presence[5.0<br/>Presence<br/>Module]
    end
    
    PostgresDB[(PostgreSQL<br/>Neon)]
    FirestoreDB[(Firestore<br/>Messages)]
    RTDB[(RTDB<br/>Presence)]
    Storage[(Cloudinary<br/>Storage)]
    
    User -->|Login Credentials| Auth
    User -->|Registration Data| Auth
    Auth -->|JWT Token| User
    Auth -->|User Data| PostgresDB
    PostgresDB -->|User Records| Auth
    
    User -->|Chat Messages| Chat
    User -->|Create Room| Chat
    Chat -->|Messages| User
    Chat -->|Room Metadata| PostgresDB
    Chat -->|Message Content| FirestoreDB
    FirestoreDB -->|Real-time Messages| Chat
    PostgresDB -->|Room Data| Chat
    
    User -->|Profile Updates| Profile
    Profile -->|Profile Info| User
    Profile -->|User Data| PostgresDB
    PostgresDB -->|Profile Data| Profile
    
    User -->|Upload Files/Images| Media
    Media -->|File URLs| User
    Media -->|Store Files via Django API| Storage
    Storage -->|Download URLs| Media
    
    User -->|Online Status| Presence
    Presence -->|Presence Data| User
    Presence -->|Status Updates| RTDB
    RTDB -->|Real-time Presence| Presence
    
    Admin -->|System Queries| Auth
    Admin -->|User Management| Profile
    Auth -->|Admin Reports| Admin
    Profile -->|User Reports| Admin
```

**Major Processes:**
1. **Authentication Module (1.0)**: Handles user registration, login, JWT token generation
2. **Chat Module (2.0)**: Manages chat rooms, messages, typing indicators, read receipts
3. **Profile Module (3.0)**: User profile management, search, settings
4. **Media Module (4.0)**: File and image uploads, storage management
5. **Presence Module (5.0)**: Online/offline status, last seen tracking

**Data Stores:**
- **PostgreSQL (Neon)**: User accounts, room metadata, memberships
- **Firestore**: Chat messages, typing indicators, read receipts
- **RTDB**: Real-time presence and online status
- **Cloudinary**: Images, files, avatars

---

## Level 2 DFD - Authentication Module (1.0)

Detailed breakdown of the Authentication Module.

```mermaid
graph TB
    User([User])
    
    subgraph Auth_Module[1.0 Authentication Module]
        Register[1.1<br/>User<br/>Registration]
        Login[1.2<br/>User<br/>Login]
        TokenGen[1.3<br/>JWT Token<br/>Generation]
        FirebaseAuth[1.4<br/>Firebase Custom<br/>Token]
        Validate[1.5<br/>Token<br/>Validation]
    end
    
    PostgresDB[(PostgreSQL<br/>Users Table)]
    SessionStore[(Django<br/>Sessions)]
    
    User -->|Registration Form| Register
    Register -->|Validate Data| Register
    Register -->|Store User| PostgresDB
    Register -->|Trigger Login| Login
    
    User -->|Login Credentials| Login
    Login -->|Verify Credentials| PostgresDB
    PostgresDB -->|User Record| Login
    Login -->|Request Token| TokenGen
    
    TokenGen -->|Generate JWT| TokenGen
    TokenGen -->|JWT Token| User
    TokenGen -->|Create Session| SessionStore
    TokenGen -->|Request Firebase Token| FirebaseAuth
    
    FirebaseAuth -->|Custom Token| User
    
    User -->|API Request + Token| Validate
    Validate -->|Verify JWT| SessionStore
    SessionStore -->|Session Data| Validate
    Validate -->|Authorized| User
```

**Sub-processes:**
- **1.1 User Registration**: Validates and creates new user accounts
- **1.2 User Login**: Authenticates users against stored credentials
- **1.3 JWT Token Generation**: Creates JWT tokens for API access
- **1.4 Firebase Custom Token**: Generates Firebase tokens for client SDK
- **1.5 Token Validation**: Validates tokens on protected endpoints

---

## Level 2 DFD - Chat Module (2.0)

Detailed breakdown of the Chat Module.

```mermaid
graph TB
    User([User])
    
    subgraph Chat_Module[2.0 Chat Module]
        RoomMgmt[2.1<br/>Room<br/>Management]
        SendMsg[2.2<br/>Send<br/>Message]
        ReceiveMsg[2.3<br/>Receive<br/>Message]
        Typing[2.4<br/>Typing<br/>Indicator]
        ReadReceipt[2.5<br/>Read<br/>Receipts]
        Search[2.6<br/>Search<br/>Messages]
    end
    
    PostgresDB[(PostgreSQL<br/>Rooms/Members)]
    FirestoreDB[(Firestore<br/>Messages)]
    WebSocket[WebSocket<br/>Connection]
    
    User -->|Create/Join Room| RoomMgmt
    RoomMgmt -->|Room Metadata| PostgresDB
    PostgresDB -->|Room List| RoomMgmt
    RoomMgmt -->|Room Info| User
    
    User -->|Message Content| SendMsg
    SendMsg -->|Store Message| FirestoreDB
    SendMsg -->|Notify via WS| WebSocket
    SendMsg -->|Message Metadata| PostgresDB
    
    WebSocket -->|New Message Event| ReceiveMsg
    FirestoreDB -->|Message Data| ReceiveMsg
    ReceiveMsg -->|Display Message| User
    
    User -->|Typing Event| Typing
    Typing -->|Update Firestore| FirestoreDB
    FirestoreDB -->|Typing Status| Typing
    Typing -->|Show Indicator| User
    
    User -->|Mark as Read| ReadReceipt
    ReadReceipt -->|Store Receipt| FirestoreDB
    FirestoreDB -->|Receipt Data| ReadReceipt
    ReadReceipt -->|Update UI| User
    
    User -->|Search Query| Search
    Search -->|Query Messages| FirestoreDB
    FirestoreDB -->|Search Results| Search
    Search -->|Display Results| User
```

**Sub-processes:**
- **2.1 Room Management**: Create, join, leave rooms; manage members
- **2.2 Send Message**: Process and store outgoing messages
- **2.3 Receive Message**: Handle incoming messages via WebSocket
- **2.4 Typing Indicator**: Real-time typing status updates
- **2.5 Read Receipts**: Track and display message read status
- **2.6 Search Messages**: Query and retrieve message history

---

## Level 2 DFD - Profile Module (3.0)

Detailed breakdown of the Profile Module.

```mermaid
graph TB
    User([User])
    
    subgraph Profile_Module[3.0 Profile Module]
        ViewProfile[3.1<br/>View<br/>Profile]
        EditProfile[3.2<br/>Edit<br/>Profile]
        UploadAvatar[3.3<br/>Upload<br/>Avatar]
        SearchUsers[3.4<br/>Search<br/>Users]
        Settings[3.5<br/>User<br/>Settings]
    end
    
    PostgresDB[(PostgreSQL<br/>Users)]
    Storage[(Firebase<br/>Storage)]
    
    User -->|Request Profile| ViewProfile
    ViewProfile -->|Query User Data| PostgresDB
    PostgresDB -->|User Info| ViewProfile
    ViewProfile -->|Display Profile| User
    
    User -->|Update Data| EditProfile
    EditProfile -->|Validate Changes| EditProfile
    EditProfile -->|Update Record| PostgresDB
    PostgresDB -->|Confirmation| EditProfile
    EditProfile -->|Success Message| User
    
    User -->|Upload Image| UploadAvatar
    UploadAvatar -->|Store Image via Django API| Storage
    Storage -->|Image URL| UploadAvatar
    UploadAvatar -->|Update Profile| PostgresDB
    UploadAvatar -->|New Avatar| User
    
    User -->|Search Query| SearchUsers
    SearchUsers -->|Query Users| PostgresDB
    PostgresDB -->|User List| SearchUsers
    SearchUsers -->|Display Results| User
    
    User -->|Change Settings| Settings
    Settings -->|Update Preferences| PostgresDB
    PostgresDB -->|Settings Data| Settings
    Settings -->|Confirmation| User
```

**Sub-processes:**
- **3.1 View Profile**: Display user profile information
- **3.2 Edit Profile**: Update user details (name, bio, etc.)
- **3.3 Upload Avatar**: Handle profile picture uploads
- **3.4 Search Users**: Find users by username or email
- **3.5 User Settings**: Manage preferences and privacy settings

---

## Level 2 DFD - Media Module (4.0)

Detailed breakdown of the Media Module.

```mermaid
graph TB
    User([User])
    
    subgraph Media_Module[4.0 Media Module]
        UploadImage[4.1<br/>Upload<br/>Image]
        UploadFile[4.2<br/>Upload<br/>File]
        Validate[4.3<br/>Validate<br/>Media]
        Compress[4.4<br/>Compress<br/>Image]
        GetURL[4.5<br/>Get Download<br/>URL]
    end
    
    Storage[(Firebase<br/>Storage)]
    FirestoreDB[(Firestore<br/>Messages)]
    
    User -->|Select Image| UploadImage
    UploadImage -->|Validate File| Validate
    Validate -->|Check Size/Type| Validate
    Validate -->|Compress| Compress
    Compress -->|Optimized Image| UploadImage
    UploadImage -->|Store Image via Django API| Storage
    Storage -->|Image URL| UploadImage
    UploadImage -->|Create Message| FirestoreDB
    UploadImage -->|Display Image| User
    
    User -->|Select File| UploadFile
    UploadFile -->|Validate File| Validate
    Validate -->|Approved| UploadFile
    UploadFile -->|Store File via Django API| Storage
    Storage -->|File URL| UploadFile
    UploadFile -->|Create Message| FirestoreDB
    UploadFile -->|File Link| User
    
    User -->|Request Media| GetURL
    GetURL -->|Query Storage| Storage
    Storage -->|Download URL| GetURL
    GetURL -->|Serve Media| User
```

**Sub-processes:**
- **4.1 Upload Image**: Handle image uploads to chat
- **4.2 Upload File**: Handle document/file uploads
- **4.3 Validate Media**: Check file size, type, and permissions
- **4.4 Compress Image**: Optimize images before storage
- **4.5 Get Download URL**: Retrieve signed URLs for media access

---

## Level 2 DFD - Presence Module (5.0)

Detailed breakdown of the Presence Module.

```mermaid
graph TB
    User([User])
    
    subgraph Presence_Module[5.0 Presence Module]
        Connect[5.1<br/>Connect<br/>Session]
        UpdateStatus[5.2<br/>Update<br/>Status]
        Disconnect[5.3<br/>Handle<br/>Disconnect]
        Subscribe[5.4<br/>Subscribe to<br/>Presence]
        LastSeen[5.5<br/>Update<br/>Last Seen]
    end
    
    RTDB[(Firebase RTDB<br/>status/{uid})]
    PostgresDB[(PostgreSQL<br/>Users)]
    
    User -->|Login/Connect| Connect
    Connect -->|Create Session| RTDB
    Connect -->|Register onDisconnect| RTDB
    RTDB -->|Session ID| Connect
    Connect -->|Online Status| User
    
    User -->|Activity| UpdateStatus
    UpdateStatus -->|Write Status| RTDB
    UpdateStatus -->|Timestamp| RTDB
    RTDB -->|Confirmation| UpdateStatus
    
    User -->|Close Tab/Logout| Disconnect
    Disconnect -->|Trigger onDisconnect| RTDB
    RTDB -->|Remove Session| RTDB
    RTDB -->|Update Last Seen| LastSeen
    LastSeen -->|Store Timestamp| PostgresDB
    
    User -->|View Chat| Subscribe
    Subscribe -->|Listen to Status| RTDB
    RTDB -->|Presence Updates| Subscribe
    Subscribe -->|Display Status| User
    
    RTDB -->|Last Changed| LastSeen
    LastSeen -->|Update DB| PostgresDB
```

**Sub-processes:**
- **5.1 Connect Session**: Establish presence tracking on user login
- **5.2 Update Status**: Real-time online/offline status updates
- **5.3 Handle Disconnect**: Cleanup on unexpected disconnects
- **5.4 Subscribe to Presence**: Listen to other users' presence
- **5.5 Update Last Seen**: Track and store last activity timestamp

---

## Data Store Details

### PostgreSQL (Neon)
- **users**: User accounts, credentials, profile data
- **chat_rooms**: Room metadata, type (direct/group), avatar
- **chat_room_members**: Membership, roles (admin/member), join dates
- **message_metadata**: Optional message references, types
- **django_session**: Active sessions

### Firebase Firestore
- **chat_rooms_{roomId}**: Messages per room
- **typing_{roomId}**: Typing indicators per room
- **read_receipts_{roomId}_{messageId}**: Read receipts per message

### Firebase RTDB
- **status/{uid}/connections/{sessionId}**: Multi-session presence tracking
- **status/{uid}/state**: Online/offline state (legacy)
- **status/{uid}/last_changed**: Last activity timestamp

### Cloudinary Storage
- **chat_images/{roomId}**: Chat image uploads
- **chat_files/{roomId}**: Chat file uploads
- **profile_pictures/{userId}**: User profile pictures
- **group_avatars/{roomId}**: Group chat avatars

---

## Key Data Flows Summary

1. **Authentication Flow**: User → Django → PostgreSQL → JWT → Firebase Custom Token
2. **Message Flow**: User → Django API → Firestore → WebSocket → Other Users
3. **Media Flow**: User → Firebase Storage → Download URL → Firestore Message
4. **Presence Flow**: User → Firebase RTDB → Real-time Listeners → UI Updates
5. **Profile Flow**: User → Django API → PostgreSQL → Response

---

## Technology Mapping

- **Frontend**: React.js (handles user interactions and displays)
- **Backend API**: Django + DRF (processes 1.0-3.0, 4.0 validation)
- **WebSocket**: Django Channels + Redis (real-time notifications)
- **Database**: PostgreSQL on Neon (structured data storage)
- **Real-time DB**: Firebase Firestore + RTDB (messages and presence)
- **Storage**: Cloudinary (media files)
- **Hosting**: Vercel (frontend), Render (backend), Neon (database)

---

*Generated for FlowChat - Real-Time Chat Application*
