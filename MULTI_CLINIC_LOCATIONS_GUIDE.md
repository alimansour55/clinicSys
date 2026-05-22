# Multi-Clinic Locations Feature Guide

## 📋 Overview

Doctors can now manage **multiple clinic locations** with **individual schedules** for each location. Patients can select their preferred clinic location when booking appointments, and they'll see available slots based on that specific location's schedule.

---

## 👨‍⚕️ For Doctors

### Step 1: Add Clinic Locations

1. Go to your **Doctor Panel → Profile** tab
2. Scroll to **"Clinic locations"** section
3. Click **"Edit"** button
4. Click **"Add location"** to add multiple clinic branches
5. Enter location names/addresses (e.g., "Mohandseen Clinic", "Downtown Branch")
6. Click **"Save"** to store the locations

**Example locations:**

- Mohandseen Clinic
- Downtown Branch
- New Cairo Office
- Heliopolis Center

### Step 2: Set Working Hours Per Location

1. Go to your **Doctor Panel → Availability** tab
2. First, set your **main schedule** (this is used as default):
   - Select working days (Sun, Mon, Tue, etc.)
   - Set start and end times
   - Add any breaks (lunch time, etc.)
   - Set slot duration (30 min, 60 min, etc.)

3. Scroll down to **"Clinic branch availability"** section
4. For each location, you can:
   - **Use main schedule** → Copy main schedule to this location
   - **Clear custom** → Remove location-specific schedule and use main schedule
   - **Customize independently** → Set different days/hours for this location

5. For each location, you can set:
   - ✅ Working days (which days you work)
   - ⏰ Start/end times (opening hours)
   - ⏱️ Slot duration (appointment length)
   - 🚫 Breaks (lunch breaks, break times)

### Step 3: Save Changes

Click **"Save availability"** button to store all location schedules.

---

### 📅 Example Scenario

**Doctor Info:**

- Main clinic: Mohandseen (9 AM - 5 PM, Mon-Fri)
- Secondary clinic: Downtown (2 PM - 8 PM, Tue-Sat)

**Setup:**

**Main Schedule (Mohandseen):**

- Days: Mon, Tue, Wed, Thu, Fri
- Time: 9:00 AM - 5:00 PM
- Breaks: 1:00 PM - 2:00 PM (lunch)
- Slot duration: 30 minutes

**Downtown Location Schedule:**

- Days: Tue, Wed, Thu, Fri, Sat
- Time: 2:00 PM - 8:00 PM
- Breaks: 4:00 PM - 4:30 PM (tea break)
- Slot duration: 45 minutes

When patients book:

- If they choose **Mohandseen**: They see 9 AM - 5 PM slots on Mon-Fri with 30-min intervals
- If they choose **Downtown**: They see 2 PM - 8 PM slots on Tue-Sat with 45-min intervals

---

## 🏥 For Patients

### Booking an Appointment

1. Find the doctor on the homepage or doctors list
2. Click **"Book appointment"**
3. Select **"In clinic"** as appointment type
4. **Important:** Choose the clinic location from the dropdown
5. Select your preferred date and time
6. Complete the booking

### What You'll See

- **One location only?** → Auto-selected (you don't need to choose)
- **Multiple locations?** → You MUST select one before booking slots appear
- **Location-specific slots** → Available times based on that location's schedule

---

## 🔧 Technical Details

### Data Structure (Backend)

```javascript
doctor: {
  // Main schedule (used as default)
  schedule: {
    workingDays: [1, 2, 3, 4, 5],      // 0=Sun, 1=Mon, ..., 6=Sat
    startTime: "09:00",
    endTime: "17:00",
    breaks: [{ startTime: "13:00", endTime: "14:00" }],
    slotDuration: 30,
    blockedDates: []
  },

  // Location-specific schedules
  locationSchedules: {
    "Mohandseen": {
      workingDays: [1, 2, 3, 4, 5],
      startTime: "09:00",
      endTime: "17:00",
      breaks: [{ startTime: "13:00", endTime: "14:00" }],
      slotDuration: 30,
      blockedDates: []
    },
    "Downtown": {
      workingDays: [2, 3, 4, 5, 6],
      startTime: "14:00",
      endTime: "20:00",
      breaks: [{ startTime: "16:00", endTime: "16:30" }],
      slotDuration: 45,
      blockedDates: []
    }
  },

  // Clinic locations list
  locations: ["Mohandseen", "Downtown"]
}
```

### API Endpoints

**Update doctor profile with locations:**

```
POST /api/doctor/update-profile
{
  "locations": ["Location 1", "Location 2", "Location 3"],
  "schedule": { /* main schedule */ },
  "locationSchedules": {
    "Location 1": { /* schedule */ },
    "Location 2": { /* schedule */ }
  }
}
```

---

## ✨ Features

✅ **Unlimited clinic locations** - Add as many as needed  
✅ **Individual schedules** - Each location has its own hours  
✅ **Flexible slot management** - Different slot durations per location  
✅ **Location-specific breaks** - Manage breaks separately  
✅ **Patient selection** - Patients choose their preferred location  
✅ **Automatic fallback** - Uses main schedule if no location schedule set  
✅ **Easy management** - Intuitive UI in doctor panel

---

## ❓ Common Questions

**Q: What if I have only one clinic?**  
A: You can still use the system normally. The schedule won't require location selection from patients.

**Q: Can I change a location's name?**  
A: Yes, just edit it in the Profile tab, but note that any custom schedule for that location will need to be re-entered.

**Q: What if I don't set a schedule for a location?**  
A: It will use your main schedule automatically.

**Q: Can patients choose appointment times for any location?**  
A: Only when booking "In clinic" appointments. Home visits and telemedicine don't use locations.

**Q: How do I handle holidays?**  
A: Add dates to "Unavailable dates" section for each location in the Availability tab.

---

## 📞 Need Help?

If you encounter any issues:

1. Check the Profile tab - ensure all locations are added
2. Check the Availability tab - ensure schedules are properly configured
3. Make sure to click "Save availability" after making changes
4. Test booking on the frontend to verify location selection works

Happy scheduling! 🎉
