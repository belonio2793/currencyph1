# ReceiveMoney Component - Optional Chat Message Feature

## Overview

The ReceiveMoney component has been enhanced to include an **optional chat notification** feature on Step 3 (Finalization). This allows users to notify the payer about the payment request directly through the chat system when the user is active in the system.

## Feature Details

### What Was Added

#### 1. **Optional Chat Message Setting on Step 3**
- **Checkbox Control**: Users can enable/disable sending a chat message to the payer
- **Default Behavior**: Enabled by default (`sendChatMessage: true`)
- **Conditional Display**: Only shows when a guest profile (recipient) is selected
- **User Status Badge**: Displays recipient's online status (if available)

#### 2. **Recipient Online Status Detection**
- Checks if the payment recipient is currently active in the system
- Shows status indicator: "Currently online" or "Offline"
- Helps user decide whether to send the message

#### 3. **Chat Message Integration**
When the checkbox is enabled:
- Creates a conversation between sender and recipient
- Sends a structured payment request message
- Includes payment details and shareable link
- Message type: `payment_request` for special handling

### UI Components

#### Step 3 Finalization Section

```
┌─────────────────────────────────────────┐
│ Your Profile                             │
│ [Name, Email, Phone]                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Payment Details Summary                  │
│ From: [User Name]                        │
│ Amount: ₱1,000                           │
│ Method: [GCash/Bank/Crypto]              │
└─────────────────────────────────────────┘

[If Crypto]
┌─────────────────────────────────────────┐
│ Send to this address:                    │
│ [Network]: [Address]      [Copy Button]  │
└─────────────────────────────────────────┘

[NEW] Optional Chat Message
┌─────────────────────────────────────────┐
│ ☑ Send payment request via chat          │
│   Notify [Recipient Name] about this     │
│   payment request                        │
│   (Currently online)                     │
└─────────────────────────────────────────┘

[Back] [Create Payment Request + Send Chat]
```

## State Variables Added

```javascript
// Optional setting for chat notification
const [sendChatMessage, setSendChatMessage] = useState(true)

// Tracks recipient's online status
const [recipientOnlineStatus, setRecipientOnlineStatus] = useState(null)
```

## Functions Enhanced/Added

### 1. **checkRecipientStatus(recipientUserId)**
Checks if the recipient is currently active in the system.

```javascript
const checkRecipientStatus = async (recipientUserId) => {
  try {
    const { data: presence } = await supabase
      .from('presence')
      .select('is_online')
      .eq('user_id', recipientUserId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
    
    if (presence) {
      setRecipientOnlineStatus(presence.is_online)
    }
  } catch (err) {
    console.warn('Could not check recipient status:', err)
  }
}
```

**When Called:** Automatically triggered when user selects a guest profile

### 2. **handleSelectGuestProfile(profile)**
Now calls `checkRecipientStatus()` to determine if recipient is online.

```javascript
const handleSelectGuestProfile = (profile) => {
  setSelectedGuestProfile(profile)
  setGuestSearch('')
  setShowSearchResults(false)
  // NEW: Check if recipient is online
  checkRecipientStatus(profile.id)
}
```

### 3. **sendPaymentRequestMessage(recipient, transfer, amount, currency)**
Enhanced to create a conversation and send a structured chat message.

```javascript
const sendPaymentRequestMessage = async (recipient, transfer, amount, currency) => {
  // 1. Create conversation with recipient
  const conversation = await createConversation(
    userId,
    `Payment Request: ${amount} ${currency}`,
    [recipient.id]
  )

  // 2. Send structured message
  const { error } = await supabase
    .from('messages')
    .insert([{
      conversation_id: conversation.id,
      sender_id: userId,
      content: messageContent,
      message_type: 'payment_request',
      metadata: {
        payment_request: {
          transfer_id,
          amount,
          currency,
          from_user_id: userId,
          to_user_id: recipient.id,
          payment_link,
          created_at: new Date().toISOString()
        }
      }
    }])
}
```

### 4. **handleCreateTransfer(e)**
Updated to check `sendChatMessage` before sending notification.

```javascript
// Send chat message to the other user (if request mode AND user enabled it)
if (selectedGuestProfile && sendChatMessage) {
  try {
    await sendPaymentRequestMessage(selectedGuestProfile, transfer, finalAmount, finalCurrency)
  } catch (chatErr) {
    console.warn('Could not send chat message:', chatErr)
  }
}
```

## Message Structure

When sent, the chat message includes:

### Content
```
"Payment Request: ₱1,000 from John Doe. View and confirm: https://app.domain.com/payment/{transferId}"
```

### Metadata
```json
{
  "message_type": "payment_request",
  "metadata": {
    "payment_request": {
      "transfer_id": "uuid",
      "amount": 1000,
      "currency": "PHP",
      "from_user_id": "sender-uuid",
      "to_user_id": "recipient-uuid",
      "payment_link": "https://app.domain.com/payment/{transferId}",
      "created_at": "2024-...-..."
    }
  }
}
```

## User Flow

### Step 1: Select Recipient & Enter Amount
```
User selects "Request from another user"
↓
Searches and selects recipient
↓
Enters amount and selects currency
↓
Proceeds to Step 2
```

### Step 2: Select Payment Method
```
Chooses between GCash, Bank Transfer, or Crypto
↓
Provides method details
↓
Proceeds to Step 3
```

### Step 3: Finalize & Optional Chat
```
Reviews payment summary
↓
[NEW] Sees optional chat checkbox
     - ☑ Send payment request via chat
     - Shows recipient online status
↓
User toggles checkbox on/off
↓
Clicks "Create Payment Request + Send Chat"
↓
System creates transfer request
↓
[If enabled] Sends chat notification to recipient
↓
Shows success message
```

## Benefits

✅ **User Choice**: Sender can decide whether to notify via chat

✅ **Real-time Status**: Shows if recipient is online to help inform decision

✅ **Seamless Integration**: Chat message includes direct payment link

✅ **Structured Data**: Message includes all payment details in metadata

✅ **Non-blocking**: If chat fails, transfer is still created successfully

✅ **Optional Feature**: Gracefully handles missing presence data or conversation creation errors

## Error Handling

The feature is designed with graceful degradation:

1. **If presence check fails**: Status shows as null (doesn't prevent flow)
2. **If conversation creation fails**: Transfer is still created, message just isn't sent
3. **If message send fails**: Warning logged but user sees success anyway
4. **If user is not authenticated**: Chat message skipped, transfer proceeds normally

## Integration with Existing Systems

### Chat System
- Uses existing `createConversation()` from `lib/conversations`
- Uses existing `messages` table in Supabase
- Message type: `payment_request` for future special handling

### Presence System
- Queries existing `presence` table
- Checks `is_online` status
- Gracefully handles if not available

### Transfer System
- Works alongside existing transfer creation
- Doesn't block or modify transfer logic
- Just adds an optional notification

## Configuration

### To Disable Chat by Default
```javascript
const [sendChatMessage, setSendChatMessage] = useState(false) // Default off
```

### To Hide Chat Option Entirely
Remove the entire "Optional Chat Message" section from Step 3:
```jsx
{/* Optional Chat Message Setting - REMOVE THIS BLOCK */}
{selectedGuestProfile && (
  <div className="...">...</div>
)}
```

### To Make Chat Required
Change checkbox to disabled when guest selected:
```jsx
<input
  type="checkbox"
  checked={true}
  disabled={!!selectedGuestProfile}
  onChange={() => {}} // No-op, always send
/>
```

## Testing Checklist

- [ ] Step 3 shows checkbox when guest profile selected
- [ ] Checkbox is unchecked by default
- [ ] Online status displays correctly (or null if unavailable)
- [ ] Unchecking disables chat message
- [ ] Button text changes to show "+ Send Chat" when enabled
- [ ] Payment transfer creates successfully
- [ ] Chat message is sent when checkbox enabled
- [ ] Chat message not sent when checkbox disabled
- [ ] Message includes correct recipient and transfer details
- [ ] Payment link in message is clickable and correct
- [ ] Works on mobile responsive layout
- [ ] Error handling: chat failure doesn't block transfer
- [ ] Online status check doesn't cause errors

## Files Modified

- **src/components/ReceiveMoney.jsx**
  - Added `sendChatMessage` and `recipientOnlineStatus` state
  - Added `checkRecipientStatus()` function
  - Enhanced `handleSelectGuestProfile()` to check status
  - Enhanced `sendPaymentRequestMessage()` to create conversation
  - Updated `handleCreateTransfer()` to respect preference
  - Added UI checkbox and status display on Step 3
  - Updated submit button text to reflect chat option

## Future Enhancements

- [ ] Sound/visual notification when chat is sent
- [ ] Auto-accept payments if user offline (scheduled)
- [ ] Retry mechanism if chat sending fails
- [ ] Custom message template/text field
- [ ] Multiple recipient broadcast (one payment, many notifications)
- [ ] Message read receipts
- [ ] Recurring payment reminders via chat

---

**Status**: ✅ Implementation Complete
**Last Updated**: 2024
**Component**: ReceiveMoney.jsx
