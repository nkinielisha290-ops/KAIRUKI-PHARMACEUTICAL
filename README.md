# Kairuki Pharmaceutical POS

A simple point-of-sale for a pharmacy, written in plain HTML, CSS and JavaScript. There is no build step.

## Features
- **Sell**: search medicines, add them to a cart, apply a discount, choose a payment method (Cash, M-Pesa, Card, Insurance), see the change due, and complete the sale.
- **Receipts**: a printable receipt for each sale.
- **Products**: add, edit and delete products. Low stock (10 or fewer) is highlighted, and stock goes down automatically after each sale.
- **Sales history**: daily sales count, revenue and items sold, with each receipt available again.

## Run
Open `index.html` in a browser, or serve the folder with any static server.

Data is saved in the browser's `localStorage`, so it stays on one device and one browser.
