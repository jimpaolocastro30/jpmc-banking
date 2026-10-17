# Bankak

Bilingual customer banking app and staff portal for the Bankak SRS. Customers move money, pay bills, top up a phone, and manage cards. Staff work from a separate portal with role-based access. Balances live in MongoDB. There is no connection to a real core banking system.

## Stack

- Next.js App Router
- MongoDB (Mongoose), with a cached connection for serverless
- httpOnly JWT sessions, admin TOTP, and an append-only audit log

## Local setup

1. Start MongoDB. If you do not have it installed, run `npm run db:memory` and leave that terminal open. It writes `.env.local` for a temporary local database. Otherwise copy `.env.example` to `.env.local`:

```
MONGODB_URI=mongodb://127.0.0.1:27017/bankak
JWT_SECRET=replace-with-a-long-random-string
APP_URL=http://localhost:3000
```

2. Install, seed, and start:

```
npm install
npm run seed
npm run dev
```

Open `http://localhost:3000`.

## Demo access

Password for every seeded user: `Bankak#2026`

| Who | Sign in |
| --- | --- |
| Amal Hassan | `amal.hassan@bankak.demo` or `+249900000001` |
| Yusuf Ibrahim | `yusuf.ibrahim@bankak.demo` |
| Support | `support@bankak.demo` |
| Operations | `operations@bankak.demo` |
| Administrator | `admin@bankak.demo` |
| Security | `security@bankak.demo` |

Staff sign-in asks for a 6-digit authenticator code. Every seeded staff account uses the demo secret `JBSWY3DPEHPK3PXP`. Card PIN on the seeded cards is `1234`.

Yusuf's account number, for an internal transfer, is `1002881100221190`.

`npm run seed` clears the Bankak collections and loads this demo data again.

## Vercel

1. Create a MongoDB Atlas cluster and a database user.
2. Allow network access from Vercel (`0.0.0.0/0`, or the Atlas Vercel integration).
3. Import this repo in Vercel. Framework preset: Next.js.
4. Set `MONGODB_URI`, `JWT_SECRET`, and `APP_URL` (your `https://…vercel.app` URL) in the project environment.
5. Deploy. Seed from your machine with the same `MONGODB_URI` before the first sign-in. Do not run the seed on every deployment.

The app stays on the Node.js runtime. It does not write to the local disk, and it does not need a custom `vercel.json`.

## What is simulated

Transfers, bill payments, top-ups, card controls, and reversals post to MongoDB. External transfers stay pending until an operations officer settles them. Reversals and privileged staff roles wait for a second officer. SMS, email, and push preferences are stored only. Full card numbers and PINs are never returned by the API.
