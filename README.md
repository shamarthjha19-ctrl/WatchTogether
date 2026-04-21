WatchTogether

A real-time web app to watch YouTube videos together with synced playback across multiple users.

Live : https://watch-together-mlhzjkzpr-shamarth-jha.vercel.app/
Features

* Real-time sync (play, pause, seek, change video)
* Room-based system (create/join via link or code)
* YouTube player integration (IFrame API)
* Role-based control:

  * **Host** – full control
  * **Participant** – view only
  * Live participant updates

Tech Stack

* **Frontend:** React, TypeScript, Vite
* **Backend:** Node.js, Express
* **Real-time:** Socket.IO (WebSockets)
* **Deployment:** Vercel (Frontend), Render (Backend)

Setup

```bash
git clone https://github.com/shamarthjha19-ctrl/WatchTogether.git
cd WatchTogether
npm install
```

Run backend:

```bash
npm run server
```

Run frontend:

```bash
npm run dev
```

How It Works

* Users join a room via WebSocket
* Server assigns roles (Host/Participant)
* Playback actions are validated on backend
* Events are broadcast to keep all users in sync

Author->
Shamarth Jha
[https://github.com/shamarthjha19-ctrl](https://github.com/shamarthjha19-ctrl)