# Use Clinivo on your phone (same Wi‑Fi)

## Quick steps

### 1. Allow Windows Firewall (once)

1. Press **Windows**, type **PowerShell**
2. Right‑click **Windows PowerShell** → **Run as administrator**
3. Run:

```powershell
cd "d:\project 2\clinicSys"
npm run mobile:firewall
```

### 2. Start all three apps (three terminals)

**Terminal 1 — API**

```powershell
cd "d:\project 2\clinicSys\backend"
npm run server
```

**Terminal 2 — Patient site**

```powershell
cd "d:\project 2\clinicSys\frontend"
npm run dev
```

**Terminal 3 — Staff panel**

```powershell
cd "d:\project 2\clinicSys\admin"
npm run dev
```

Each terminal prints a box with your **PC IP** and URLs.

### 3. On your phone

1. Connect the phone to the **same Wi‑Fi** as the PC (not mobile data only).
2. Find your PC IP in the terminal (example: `192.168.1.42`).
3. Open in the phone browser:

| App | URL |
|-----|-----|
| **Patients** | `http://192.168.1.42:5173` |
| **Staff** (admin / doctor / reception) | `http://192.168.1.42:5174` |

Replace `192.168.1.42` with **your** IP.

**Do not** open `localhost` on the phone — that will not work.

### 4. Check the API from the phone

Open: `http://YOUR_IP:4000/`  
You should see: `API WORKING`

---

## If it still does not work

| Problem | What to do |
|---------|------------|
| Page does not load | Run `npm run mobile:firewall` as **Administrator** again |
| Login works on PC but not phone | Phone must use `http://YOUR_IP:5173`, not `localhost` |
| Staff login shows API error | Start **backend** first; test `http://YOUR_IP:4000/` on the phone |
| Wrong IP | On PC run `ipconfig` → **Wireless LAN** → **IPv4 Address** |
| Guest Wi‑Fi | Some routers block phone↔PC; use main home Wi‑Fi |
| VPN on PC or phone | Turn VPN off while testing |

Show URLs anytime:

```powershell
cd "d:\project 2\clinicSys"
npm run mobile:urls
```

---

## How it works

The app detects when you open it via `192.168.x.x` and automatically calls the API at `http://192.168.x.x:4000` (you do not need to change `.env` for normal LAN testing).
