# Fudo

A local, open-source floor and order tool for one restaurant.

## MVP

This version is built toward three capabilities:

- A product catalog, with categories and subcategories.
- A free-form floor plan whose shapes can match a real room.
- A waiter floor, where a tap on a table builds an order.

Every screen is available in English and Spanish.

This version does not include:

- Accounts
- Payments
- Stock
- Printing
- A kitchen display
- Delivery
- Reports
- Multiple floors
- Translated menus

## Languages

English and Spanish ship for the interface. Restaurant-authored names stay as entered.

## Run

```bash
npm install
npm run dev
```

## Build sequence

Work is sequenced in [`plans/`](plans/).

## Conventions

- Database code is server-only. Pages stay on the Node.js runtime.
- Feature code lives in `src/features/<feature>/`.
- Shared UI lives in `src/components/`.
- User-visible chrome lives in `messages/en.json` and `messages/es.json`.
