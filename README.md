Smart Ration Shop — Mini Project

This is a simple static web app that demonstrates a smart ration shop system. It implements:

- Customer registration using ration card and mobile number
- Automatic digital token generation with estimated pickup time
- Queue management (call next, reset)
- Sales recording and automatic inventory updates
- Public dashboard showing stock availability and upcoming tokens

How to run

1. Open `index.html` in a browser (no server required). On macOS you can double-click or run:

   open index.html

2. Shopkeeper and Customer flows

- Customer: Register with Ration Card number (RC), mobile (10 digits) and password (min 4 chars). Then login using RC + password and click "Login & Request Token" to get a digital token with ETA.
- Shopkeeper: Register a shop using government-provided Shop ID and reference, fill contact and password. Then login with Shop ID + password to access the admin panel.

3. Stock update behavior

- When a shopkeeper logs in, the app starts an hourly timer that records a "last stock update" timestamp for that shop. This simulates regular hourly stock confirmations required by the government.
- The shopkeeper can also manually click "Update Stock Now" in the admin panel to update the timestamp immediately.

Notes and limitations

- This demo stores all data in browser localStorage. Clearing browser data will reset the demo.
- No authentication beyond the simple PIN (for demo only). For production, add proper auth and server-side persistence.
- No SMS notifications: they can be added via an API when integrating with a backend.

Note: For demo simplicity, passwords are stored in localStorage as plain text. For production, never store credentials in plaintext and always use a secure server-side authentication system.

Next steps (suggested)

- Persist data to a backend (Node/Python + DB)
- Add user authentication and role-based access
- Add reporting and download/export of sales

