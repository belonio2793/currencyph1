# Encrypted Chat System Implementation Guide

## Overview
A complete end-to-end encrypted messaging system with Facebook-like collapsible bottom bar UI, friend management, media sharing, and voice messages.

## Features Implemented

### 1. **Encrypted Messaging**
- **AES-256-GCM encryption** using Web Crypto API
- Per-conversation encryption keys stored in localStorage
- All messages encrypted before storage
- Client-side decryption for display

### 2. **Chat Interface (ChatBar Component)**
- **Collapsible/Expandable** bottom-right corner panel (like Facebook's live chat)
- **Two Tabs:**
  - **Chats**: Browse conversations and search users to start chatting
  - **Friends**: View friends list with online status indicators
- **Real-time Updates**: Messages update instantly via Supabase subscriptions
- **Online Status**: Green dot indicates users who are online/away/offline

### 3. **Friend Management**
- Add friends via user search (search by name, email, phone)
- View friends list with online status
- Remove friends
- Friend request system (pending, accepted, rejected)
- Block/unblock users

### 4. **Message Features**
- Send/receive text messages
- Delete messages (soft delete - marks as deleted)
- Edit messages (re-encrypts with new content)
- Message timestamps
- View conversation history
- Auto-scroll to latest message

### 5. **Media Sharing**
- Upload files (images, documents, etc.) up to 50MB
- Files stored in Supabase Storage
- Encrypted metadata in database
- Media attached to messages

### 6. **Voice Messages**
- Record voice messages directly in chat
- Stop/send voice recordings
- Voice message duration tracking
- Stores as WebM audio format

### 7. **Presence Tracking**
- Real-time online/away/offline status
- Last seen timestamp
- Automatic status updates every 30 seconds
- Presence cleanup on tab visibility change
- Green indicator dot for online users

## Database Schema

### Tables Created

#### `messages` (updated)
- `id`: UUID primary key
- `sender_id`: Reference to users
- `recipient_id`: Reference to users (for direct messages)
- `conversation_id`: Reference to conversations (NEW)
- `ciphertext`: Encrypted message content
- `iv`: Encryption initialization vector
- `metadata`: JSONB (type, timestamps, etc)
- `created_at`: Timestamp
- `deleted_at`: Soft delete timestamp

#### `conversations` (NEW)
- `id`: UUID primary key
- `created_by`: Reference to creator user
- `title`: Conversation title (e.g., "direct_userid1_userid2")
- `metadata`: JSONB for extensibility
- `created_at`: Timestamp

#### `conversation_members` (NEW)
- `id`: UUID primary key
- `conversation_id`: Reference to conversation
- `user_id`: Reference to user
- `role`: 'admin' or 'member'
- `joined_at`: Timestamp
- Constraint: unique(conversation_id, user_id)

#### `friends` (NEW)
- `id`: UUID primary key
- `user_id`: Reference to user
- `friend_id`: Reference to friend
- `status`: 'pending', 'accepted', or 'blocked'
- `created_at`: Timestamp
- Constraint: unique(user_id, friend_id)

#### `friend_requests` (NEW)
- `id`: UUID primary key
- `requester_id`: Reference to user making request
- `receiver_id`: Reference to user receiving request
- `message`: Optional request message
- `status`: 'pending', 'accepted', or 'rejected'
- `created_at`: Timestamp

#### `message_media` (NEW)
- `id`: UUID primary key
- `message_id`: Reference to message
- `storage_path`: Path in Supabase Storage
- `mime_type`: File type
- `size`: File size in bytes
- `metadata`: JSONB (duration for voice messages)
- `created_at`: Timestamp

#### `voice_calls` (NEW)
- `id`: UUID primary key
- `caller_id`: Reference to caller
- `recipient_id`: Reference to recipient
- `conversation_id`: Reference to conversation (optional)
- `call_type`: 'voice' or 'video'
- `status`: 'pending', 'accepted', 'rejected', 'missed', 'completed'
- `started_at`, `ended_at`: Timestamps
- `duration_seconds`: Call duration
- `metadata`: JSONB for extensibility

#### `user_presence` (NEW)
- `id`: UUID primary key
- `user_id`: Unique reference to user
- `status`: 'online', 'away', or 'offline'
- `last_seen`: Last activity timestamp
- `updated_at`: Last status update

#### `message_read_receipts` (NEW)
- `id`: UUID primary key
- `message_id`: Reference to message
- `reader_id`: Reference to user who read
- `read_at`: Read timestamp
- Constraint: unique(message_id, reader_id)

## Library Functions

### `src/lib/crypto.js`
- `generateSymmetricKey()`: Create AES-256 key
- `exportKeyToBase64()`: Serialize key for storage
- `importKeyFromBase64()`: Deserialize key from storage
- `encryptString()`: Encrypt plaintext
- `decryptString()`: Decrypt ciphertext
- `encodeUTF8()`, `decodeUTF8()`: Text encoding helpers

### `src/lib/friends.js`
```javascript
sendFriendRequest(requesterId, receiverId, message)
acceptFriendRequest(requestId)
rejectFriendRequest(requestId)
blockUser(userId, blockedUserId)
unblockUser(userId, unblockedUserId)
removeFriend(userId, friendId)
getFriendsList(userId)
getPendingFriendRequests(userId)
getSentFriendRequests(userId)
isFriend(userId, otherUserId)
getBlockedUsers(userId)
```

### `src/lib/conversations.js`
```javascript
createConversation(createdBy, title, participantIds)
addParticipantToConversation(conversationId, userId, role)
removeParticipantFromConversation(conversationId, userId)
getConversationsByUser(userId)
getConversationMembers(conversationId)
updateConversationTitle(conversationId, title)
deleteConversation(conversationId)
getConversationKey(conversationId)
getOrCreateDirectConversation(userId1, userId2)
getConversationMessages(conversationId, limit)
sendConversationMessage(conversationId, senderId, plaintext, type)
deleteConversationMessage(messageId)
editConversationMessage(messageId, newPlaintext)
```

### `src/lib/chatMedia.js`
```javascript
uploadMediaToChat(messageId, file)
getMessageMedia(messageId)
getMediaDownloadUrl(storagePath)
deleteMessageMedia(mediaId, storagePath)
uploadVoiceMessage(messageId, audioBlob, duration)
getVoiceMessageDuration(mediaId)
```

### `src/lib/presence.js`
```javascript
initializePresence(userId)          // Start presence tracking
stopPresence()                       // Stop presence tracking
getUserPresence(userId)              // Get user's current status
subscribeToUserPresence(userId, callback)
subscribeToMultiplePresence(userIds, callback)
getMultipleUsersPresence(userIds)
markMessagesAsRead(messageIds, readerId)
getUnreadMessageCount(userId)
```

### `src/lib/voiceCalls.js`
```javascript
initiateVoiceCall(callerId, recipientId, callType, conversationId)
acceptVoiceCall(callId)
rejectVoiceCall(callId)
endVoiceCall(callId, durationSeconds)
missVoiceCall(callId)
getCallHistory(userId, limit)
subscribeToIncomingCalls(userId, onIncomingCall)
subscribeToCallUpdates(callId, onUpdate)
```

## Usage Examples

### Start a Chat
```javascript
import { getOrCreateDirectConversation } from '../lib/conversations'

const conversationId = await getOrCreateDirectConversation(userId, otherUserId)
// ChatBar handles opening the conversation
```

### Send an Encrypted Message
```javascript
import { sendConversationMessage } from '../lib/conversations'

await sendConversationMessage(conversationId, userId, "Hello!", "text")
```

### Upload Media
```javascript
import { uploadMediaToChat } from '../lib/chatMedia'

const file = inputElement.files[0]
await uploadMediaToChat(messageId, file)
```

### Record Voice Message
```javascript
// Done through ChatBar UI - click voice button to start/stop recording
// Automatically uploads and encrypts voice message
```

### Track User Presence
```javascript
import { initializePresence, subscribeToMultiplePresence } from '../lib/presence'

// On login
initializePresence(userId)

// Subscribe to friends' status
const unsubscribe = await subscribeToMultiplePresence(friendIds, (userId, status) => {
  console.log(`User ${userId} is now ${status}`)
})
```

## Security Considerations

### Encryption
- ✅ **Client-side encryption**: Messages encrypted before leaving device
- ✅ **Per-conversation keys**: Each conversation has unique encryption key
- ✅ **Key storage**: Keys stored in browser localStorage (ephemeral)
- ✅ **Web Crypto API**: Uses standard browser cryptography

### Server Storage
- ✅ Messages stored as ciphertext only
- ✅ Initialization vectors (IVs) stored separately
- ✅ Server cannot decrypt messages
- ✅ Metadata encrypted but stored for filtering

### Privacy
- ✅ Friend relationships are private
- ✅ Online status only visible to friends
- ✅ Media files encrypted in storage
- ✅ Presence data only shared with friends

## Deployment Requirements

### Database
- Run migrations 004, 005, 006:
  - `004_create_chat_tables.sql` - Friend/conversation tables
  - `005_add_conversation_id_to_messages.sql` - Message schema update
  - `006_create_voice_and_presence_tables.sql` - Voice/presence tables

### Storage
- Create Supabase Storage bucket: `chat-media`
- Configure CORS for media uploads
- Set appropriate access levels

### Environment Variables
- `VITE_PROJECT_URL`: Supabase project URL ✅ (already set)
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key ✅ (already set)

## UI Components

### ChatBar Component
- **File**: `src/components/ChatBar.jsx`
- **Props**: `userId`, `userEmail`
- **Features**:
  - Minimizable bottom-right panel
  - User search with debouncing
  - Real-time message sync
  - Media upload button
  - Voice recording button
  - Online status indicators

## Testing the Chat System

### 1. Create Two Test Accounts
```
Account 1: user1@test.com / password123
Account 2: user2@test.com / password123
```

### 2. Test Chat Flow
1. Login as User 1
2. Open ChatBar (bottom right)
3. Search for User 2
4. Click to start chat
5. Send a message
6. Open new tab, login as User 2
7. Verify message received in real-time
8. Send reply, verify User 1 receives it

### 3. Test Friend Management
1. In Chats tab, search for User 2
2. Click user to start chat
3. Verify online status indicator
4. Remove friend from Friends tab

### 4. Test Media Upload
1. In chat, click attachment icon
2. Select a file
3. Verify file appears in message
4. Refresh page, verify file persists

### 5. Test Voice Messages
1. In chat, click microphone icon
2. Record message (5 seconds)
3. Click again to stop
4. Verify voice message appears
5. Receive as User 2, verify playback

## Performance Optimizations

- **Message pagination**: Loads last 200 messages, can paginate
- **Real-time subscriptions**: Only for active conversations
- **Presence updates**: Every 30 seconds (configurable)
- **Lazy loading**: Friends loaded only when Friends tab opened
- **IndexDB-backed**: Encryption keys cached in localStorage

## Known Limitations & Future Improvements

### Current Limitations
- Group conversations: Schema supports, but UI shows direct messages only
- Voice/video calls: Database schema ready, UI not fully implemented
- Message reactions: Not implemented
- Typing indicators: Not implemented
- Message search: Not implemented
- Message forwarding: Not implemented

### Potential Future Features
1. **Group Chat UI**: Multi-user conversation interface
2. **Voice/Video Calls**: WebRTC integration for calls
3. **Message Reactions**: Add emoji reactions to messages
4. **Typing Indicators**: Show when user is typing
5. **Message Search**: Search across conversations
6. **End-to-End Encryption Keys**: Server-side key exchange
7. **Message Backup**: Export encrypted conversations
8. **Rate Limiting**: Prevent spam/abuse
9. **Message Threading**: Reply to specific messages
10. **Custom Emojis**: User-created emoji support

## Troubleshooting

### Messages Not Sending
- Check browser console for errors
- Verify Supabase connection
- Check localStorage for encryption keys
- Ensure conversation_id exists

### Presence Not Updating
- Check user_presence table has record
- Verify presence update interval running
- Check browser tab visibility
- Ensure userId is valid UUID

### Media Upload Failing
- Check file size (max 50MB)
- Verify chat-media bucket exists in Storage
- Check CORS configuration
- Ensure message created before media upload

### Encryption Issues
- Clear localStorage and refresh
- Regenerate conversation keys
- Check crypto.js imports
- Verify Web Crypto API support in browser

## Support & Contact

For issues or questions:
1. Check browser console for error messages
2. Verify database migrations ran successfully
3. Check Supabase Storage bucket configuration
4. Review this guide for common issues
