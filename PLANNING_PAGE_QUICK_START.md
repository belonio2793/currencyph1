# Planning Page - Quick Start Guide

## 🎯 What's New

The Planning Page now has full support for:
- ✅ **Custom Location Markers** - Add locations by clicking on the map
- ✅ **Agricultural Products** - Track water, coconut, and mango farms
- ✅ **Public Group Chat** - Discuss with all team members
- ✅ **Private Messaging** - 1-on-1 conversations with team members
- ✅ **User Attribution** - See who added each marker/product

---

## 🗺️ Using the Map

### Add a Location
1. Click **"+ Add Location"** button
2. Click on the map where you want to place the marker
3. A form appears with lat/long auto-filled
4. Enter location name and description
5. Click **"Save Location"**

**Tip**: Use the map controls to zoom/pan first, then add location

### View Product Farms
Products appear as **colored markers**:
- 🔵 **Blue** = Water sources
- 🟤 **Brown** = Coconut farms
- 🟡 **Amber** = Mango farms

Click any product marker to see:
- Farm name and description
- Location (city/province)
- Available quantity and unit
- Harvest season
- Creator name

### Jump to Locations
Use the dropdown in the header:
1. "Locations" dropdown - jump to saved markers
2. "Ports" dropdown - jump to shipping ports

Use map controls:
- 🇵🇭 = Center on Philippines
- **−** = Zoom out
- **+** = Zoom in
- **Layers** = Switch map styles (Street/Satellite/Terrain)

---

## 💬 Chat Features

### Public Group Chat
**When to use**: Team discussions, announcements, planning

**How to use**:
1. Click the **"Public"** tab
2. View online members list
3. Type your message in the input box
4. Press Enter or click Send
5. Messages show: `Username HH:MM - message`

**Quick tip**: Click 💬 next to any member to message them privately

### Private Messaging
**When to use**: One-on-one conversations, sensitive discussions

**How to start**:
1. Click **"Private"** tab
2. Click 💬 next to any online member
3. Or click 💬 on a user from a marker popup
4. Chat window opens with that user

**How to message**:
1. Type your message in the input box
2. Press Enter or click Send
3. Your messages appear in **green**
4. Their messages appear in **blue**
5. Click ✕ to close conversation

**Note**: Private messages are separate from public chat and are only visible to both participants

---

## 👥 Managing Markers

### Your Markers
- You see a **"Delete"** button on markers you created
- You can always delete your own markers
- Markers created by others show a **"Message"** button instead

### Viewing Markers
- All markers are visible to everyone
- Click marker to see details and creator name
- Can message the creator directly from the popup

---

## 🌾 Adding Products (Farms)

**Note**: Products are currently view-only in the Planning Page. To add a product, you'll use the product management interface.

**When viewing products**:
- Click any product marker on the map
- See farm location and production details
- Know who manages the farm (creator name)

---

## 🔍 Troubleshooting

### Marker Won't Save
**Check**:
1. Did you enter a location name?
2. Did you click on the map to set coordinates?
3. Check browser console (F12 → Console) for error messages

**Common errors**:
- "Please enter a location name" = Name field empty
- "Please click on the map to select a location" = No coordinates selected
- "Failed to save location" = Check console for details

### No Products Showing
- Products are marked as `is_active = true`
- May need to refresh page to load new products
- Check internet connection for real-time updates

### Private Messages Not Sending
- Make sure you've selected a user
- Check if they're still online
- Look for error message above input field

### Online Users List Empty
- Might be loading - wait a moment
- No other users logged in right now
- Refresh page to reload user list

---

## 🎮 Tips & Tricks

### Navigation
- Double-click marker to focus on it
- Drag to pan, scroll to zoom
- Use "Layers" button to switch between Street/Satellite/Terrain maps

### Chat
- Click username in any message to... (future feature: view profile)
- Press Ctrl+Enter to submit message (coming soon)
- Messages auto-scroll to latest

### Markers
- Hover over marker name to see full text
- Pin dropdown selections to quickly jump between locations
- Use location dropdown to compare multiple sites

---

## 📊 Data Structure

### Location Markers
Store custom locations you want to highlight on the map
- **Created by**: You (shown in marker)
- **Can edit/delete**: Only the creator
- **Can see**: Everyone

### Products
Agricultural/production sources
- **Product Type**: Water, Coconut, or Mango
- **Production Info**: Quantity available + season
- **Can see**: Everyone
- **Can manage**: Creator only

### Public Messages
Group chat for team coordination
- **Visibility**: Everyone
- **Attribution**: Shows sender name and time
- **Permanent**: Stays in history

### Private Messages
One-on-one conversations
- **Visibility**: Only participants
- **Attribution**: Shows sender name and time
- **Separate**: Different history per conversation pair

---

## 🔐 Privacy & Permissions

**What Others Can See**:
- ✅ Your markers and their details
- ✅ Your products and production data
- ✅ Your public messages
- ✅ Your display name and status

**What Others Can't See**:
- ❌ Private messages (only recipient sees)
- ❌ Your email (unless shared publicly)
- ❌ Your password and auth details

**Delete Your Data**:
- Markers: Click the marker, click Delete
- Products: Managed via product management interface
- Messages: Public messages cannot be deleted (team record)

---

## 📞 Getting Help

If something isn't working:
1. **Check the console** (F12 → Console tab)
2. **Look for error messages** in the UI
3. **Refresh the page** and try again
4. **Check your internet** connection

**Error patterns**:
- `PGRST116` = Table doesn't exist yet (admin needs to run migration)
- `permission denied` = RLS policy issue (contact admin)
- `unable to execute` = Server error (try again later)

---

## 🚀 Next Steps

1. **Try creating a location** - Click "+ Add Location"
2. **Send a public message** - Test group chat
3. **Message a team member** - Try private chat
4. **View products** - See farm locations on map

Enjoy coordinating with your team! 🎉
