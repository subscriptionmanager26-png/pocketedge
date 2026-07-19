# PocketEdge Social (www)

Primary social product at https://www.pocketedge.in

This repo previously hosted both social and global tools. Global lives in [pocketedge-global](https://github.com/subscriptionmanager26-png/pocketedge-global).

## Supabase

Auth + social data + DMA signals: `zweqxjeuwwfrlpbuuayg`

This project should only hold social/auth tables (`social_*`, `app_members`, `user_referrals`, `nse_dma_*`). IBKR / UCITS / baskets live in the global Supabase project (`ewmvjbmkfnjpatficony`).

Auth allow-list (includes global.pocketedge.in): `npm run auth:push`

## Dev

```bash
npm install
npm run dev
```
