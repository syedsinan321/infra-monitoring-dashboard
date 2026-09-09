# Infra Monitoring Dashboard

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-2ea44f?logo=github)](https://syedsinan321.github.io/infra-monitoring-dashboard/)
[![GitHub Repo](https://img.shields.io/badge/Source_Code-GitHub-181717?logo=github)](https://github.com/syedsinan321/infra-monitoring-dashboard)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-2-FF6384)
![React Router](https://img.shields.io/badge/React_Router-7-CA4245?logo=reactrouter&logoColor=white)

A single-pane-of-glass dashboard concept for infrastructure fleet management —
chassis/blade utilization, fabric interconnects, server profiles, firmware
tracking, host inventory, and audit history.

This build runs entirely on static mock data — there is no backend. It's a
UI/UX showcase of what a full operational dashboard looks like, not a
connected monitoring tool.

---

## 👉 [View Live Demo](https://syedsinan321.github.io/infra-monitoring-dashboard/)

---

## Features

- **Overview dashboard**: chassis, blade slot utilization, fabric interconnect pairs
- **Inventory & server profiles**: hardware catalog and profile assignments
- **Firmware tracking**: blade firmware versions and compliance
- **Host diagnostics**: sample crash/log analysis reports
- **Audit log**: sample activity history
- **Architecture view**: pan/zoom topology renderer
- **Light/dark theming**

## Running locally

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

## Deployment

Pushing to `main` triggers a GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
that builds the app and publishes it to the `gh-pages` branch, which GitHub
Pages serves at the live demo link above.

## Tech stack

React 18, Vite, Tailwind CSS, Recharts, React Router.
