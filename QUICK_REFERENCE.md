# Quick Reference: TripAdvisor Population

## 🚀 Get Started in 30 Seconds

### Option 1: Web UI (Easiest)
1. Click **Admin** button
2. Click **Full TripAdvisor API** tab
3. Click **Start Full Population**
4. Watch the progress bar (10-30 minutes)
5. See success message with count

### Option 2: Command Line
```bash
npm run populate-all
```

### Option 3: Bash
```bash
./scripts/populate-all-listings.sh
```

## 📊 What You Get

```
120 cities × 9 categories = 2,500-3,500 listings

Categories: Attractions, Museums, Parks, Beaches, 
            Hotels, Restaurants, Churches, and more

Cities: Manila, Cebu, Davao, Boracay, Palawan, 
        Baguio, Iloilo, Bacolod, and 112 more
```

## 🔍 Verify It Worked

In Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM nearby_listings;
-- Should show: 2,500-3,500
```

## 🎯 Common Tasks

| Task | Command |
|------|---------|
| **Populate all cities** | `npm run populate-all` |
| **Import photos** | `npm run import-photos` |
| **View in admin** | Click Admin button |
| **Check count** | `SELECT COUNT(*) FROM nearby_listings;` |
| **Export data** | `SELECT * FROM nearby_listings LIMIT 100;` |

## ⚙️ Configuration

Set these environment variables:
```bash
VITE_PROJECT_URL=https://your-project.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
VITE_TRIPADVISOR=optional-api-key
```

## 📝 Files Changed/Created

### Modified
- ✏️ `src/components/AdminPopulate.jsx` - Added progress tracking
- ✏️ `src/lib/populateTripadvisorListings.js` - Rewritten with real logic
- ✏️ `package.json` - Added npm script

### Created
- ✨ `scripts/populate-all-listings.js` - Standalone Node.js script
- ✨ `scripts/populate-all-listings.sh` - Bash script
- ✨ `COMPREHENSIVE_POPULATION_GUIDE.md` - Full documentation
- ✨ `POPULATION_IMPLEMENTATION_SUMMARY.md` - Technical details
- ✨ `QUICK_REFERENCE.md` - This file

## ⏱️ Timeline

| Phase | Time | What Happens |
|-------|------|--------------|
| Fetch | 5-10 min | Queries TripAdvisor for 1,080 city/category combos |
| Deduplicate | <1 min | Removes duplicate listings |
| Insert | 5-15 min | Saves 2,500-3,500 listings to database |
| **Total** | **10-30 min** | Done! |

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Missing env variables" | Set `VITE_PROJECT_URL` and `VITE_SUPABASE_SERVICE_ROLE_KEY` |
| Progress bar not showing | Refresh page, check browser console |
| Database error | Verify `nearby_listings` table exists |
| Very slow | Normal! API calls take time. 1,080 requests × 300ms = 5-10 min |
| 0 listings inserted | Check TripAdvisor API key validity |

## 📚 Full Docs

- **How-to guide**: `COMPREHENSIVE_POPULATION_GUIDE.md`
- **Technical details**: `POPULATION_IMPLEMENTATION_SUMMARY.md`
- **Import photos**: `IMPORT_PHOTOS_GUIDE.md`

## 🎓 How It Works (Simple)

```
1. You click button in Admin UI
2. Script fetches from TripAdvisor (or uses mock data)
3. Shows you progress in real-time
4. Saves 2,800+ listings to database
5. You see success message
6. Data ready to use in your app!
```

## ✅ Success Checklist

- [ ] Clicked "Start Full Population" OR ran `npm run populate-all`
- [ ] Saw progress bar or console output
- [ ] Waited 10-30 minutes
- [ ] Saw success message
- [ ] Verified count in Supabase
- [ ] Next: Import photos with `npm run import-photos`

## 🔗 Related Commands

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run populate-all     # Populate listings
npm run import-photos    # Import TripAdvisor photos
npm run populate-nearby  # Alternative populate script
```

## 📞 Need Help?

1. Check browser console (Ctrl+Shift+K)
2. Read `COMPREHENSIVE_POPULATION_GUIDE.md` (Troubleshooting)
3. Check Supabase logs in dashboard
4. Verify environment variables are set

---

**Everything is set up and ready to go!** 🎉

Just click that button or run the command. It handles the rest automatically.
