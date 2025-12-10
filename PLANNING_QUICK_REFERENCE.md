# Planning Page - Quick Reference Card

## 🚀 Getting Started (3 Steps)

### Step 1: Apply Migrations
```bash
npm run apply-planning-migrations
```

### Step 2: Start Server
```bash
npm run dev
```

### Step 3: Access Planning
Navigate to `/planning` and register with your email.

---

## 📋 What Was Implemented

| Component | Status | File |
|-----------|--------|------|
| `planning_users` table | ✅ | `supabase/migrations/create_planning_users.sql` |
| `planning_messages` table | ✅ | `supabase/migrations/create_planning_messages.sql` |
| `planning_markers` table | ✅ | `supabase/migrations/create_planning_markers.sql` |
| `planning_shipping_ports` table | ✅ | `supabase/migrations/056_create_planning_shipping_ports.sql` |
| PlanningChat component | ✅ | `src/components/PlanningChat.jsx` |
| Rate calculator service | ✅ | `src/lib/portRateCalculatorService.js` |
| Migration runner script | ✅ | `scripts/apply-all-planning-migrations.js` |

---

## 🎯 Features

### Map & Navigation
- 🗺️ Interactive Leaflet map
- 📍 15 shipping ports (5 PH, 10 China)
- 🎨 Color-coded markers (Red=PH, Blue=China)
- 🔍 Multiple tile layers (Street/Satellite/Terrain)
- ➕ Create custom location markers

### Shipping Rates
- 💰 Real-time cost calculation
- ⚖️ Three cargo types (kg, TEU, CBM)
- ↔️ Import/Export pricing
- 📊 Detailed fee breakdown
- 🇵🇭 Prices in Philippine Peso

### Team Collaboration
- 💬 Real-time chat messaging
- 👥 Online member tracking
- ⚡ Instant message sync
- 📜 Message history
- 🔐 Private per-user locations

---

## 🏙️ Included Ports

### Philippine (5)
- Port of Manila (South Harbor) - International
- Port of Cebu - International
- Port of Iloilo - Domestic
- Port of Davao - International
- Port of General Santos - Domestic

### Chinese (10)
- Shanghai, Shenzhen, Ningbo-Zhoushan
- Qingdao, Tianjin, Guangzhou
- Dalian, Xiamen, Suzhou, Nantong, Wuhan

---

## 💰 Rate Structure Example

**1 TEU Import to Manila:**
```
Handling:        ₱8,000
Documentation:   ₱2,500
Port Authority:  ₱6,000
Security:        ₱2,000
Customs:         ₱3,500
─────────────────────────
Subtotal:       ₱22,000
Import (12%):    ₱2,640
═════════════════════════
TOTAL:          ₱24,640
```

---

## 📚 Documentation

- **Full Guide**: `PLANNING_PAGE_IMPLEMENTATION_GUIDE.md` (425 lines)
- **Quick Start**: `PLANNING_SETUP_QUICK_START.md` (303 lines)
- **Summary**: `PLANNING_PAGE_COMPLETION_SUMMARY.md` (439 lines)
- **Technical**: `PLANNING_INFERENCE_AND_IMPLEMENTATION.md` (489 lines)

---

## 🔧 Common Commands

```bash
# Apply all migrations at once
npm run apply-planning-migrations

# Apply individual migrations
npm run migrate-planning-ports

# Start dev server
npm run dev

# Build for production
npm run build
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Table not found" | Run `npm run apply-planning-migrations` |
| No ports on map | Verify 056 migration was applied |
| Can't login | Check Supabase Auth is configured |
| Map not loading | Clear cache, refresh browser |
| No online users | Apply `create_planning_users.sql` |

---

## 🔐 Security

All data protected by Row-Level Security (RLS):
- ✅ Users see only public data by default
- ✅ Users control their own locations & profiles
- ✅ Authenticated users required for chat
- ✅ Email-based authentication via Supabase
- ✅ No secrets exposed in frontend

---

## 📊 Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Leaflet, Tailwind CSS |
| Backend | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Real-time | Supabase Realtime |
| Calculations | JavaScript (no dependencies) |

---

## ✨ What You Can Do Now

1. ✅ Calculate shipping costs in real-time
2. ✅ View all major Asian ports on map
3. ✅ Create custom facility locations
4. ✅ Chat with team members in real-time
5. ✅ Compare rates between ports
6. ✅ Plan multi-port shipping routes
7. ✅ Track team presence and availability
8. ✅ View detailed port information

---

## 🎓 Learning Paths

### For End Users
1. Register with email
2. View ports on map
3. Click a port to see details
4. Calculate shipping cost
5. Create custom location
6. Chat with team

### For Developers
1. Check `PlanningChat.jsx` for component structure
2. Review `portRateCalculatorService.js` for rate logic
3. Examine migration files for schema
4. Customize RLS policies as needed
5. Add new ports or rate structures

---

## 📈 Capacity Range

| Metric | Range |
|--------|-------|
| Port Annual Capacity | 500k - 4.4M TEU |
| Max Vessel Length | 200-400 meters |
| Max Port Depth | 9-15 meters |
| Berth Count | 6-128 |
| Handling Fee (per kg) | ₱14-30 |
| Handling Fee (per TEU) | ₱2,800-8,000 |
| Total Fees (per shipment) | ₱12k-35k+ |

---

## 🚦 Status

```
✅ Database Schema      - COMPLETE
✅ Frontend Component   - COMPLETE
✅ Rate Calculator      - COMPLETE
✅ Authentication       - COMPLETE
✅ Real-time Features   - COMPLETE
✅ Documentation        - COMPLETE
✅ Migration Scripts     - COMPLETE
✅ Security (RLS)       - COMPLETE
✅ Ready for Production  - YES
```

---

## 📞 Support

For detailed information:
- Technical: `PLANNING_PAGE_IMPLEMENTATION_GUIDE.md`
- Setup: `PLANNING_SETUP_QUICK_START.md`
- Complete: `PLANNING_PAGE_COMPLETION_SUMMARY.md`
- Inference: `PLANNING_INFERENCE_AND_IMPLEMENTATION.md`

---

## 🎯 Next Steps

```
1. npm run apply-planning-migrations
2. npm run dev
3. Go to /planning
4. Register with email
5. Start collaborating!
```

---

**Implementation Status:** ✅ COMPLETE & READY FOR USE

Last Updated: December 2024
