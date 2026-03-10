# Infra Monitoring Dashboard

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-2ea44f?logo=github)](https://syedsinan321.github.io/infra-monitoring-dashboard/)
[![GitHub Repo](https://img.shields.io/badge/Source_Code-GitHub-181717?logo=github)](https://github.com/syedsinan321/infra-monitoring-dashboard)

A modern, glassmorphic infrastructure monitoring dashboard built with React. This is a fully static demo application that uses mock data to showcase a unified view of datacenter infrastructure — from UCS chassis and blade servers to VMware capacity planning and TPM key management.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-2-FF6384)


---

## Screenshots

| Dark Mode | Light Mode |
|-----------|------------|
| ![Dashboard Dark](screenshots/dashboard-dark.png) | ![Dashboard Light](screenshots/dashboard-light.png) |
| ![Capacity Dark](screenshots/capacity-dark.png) | ![Capacity Light](screenshots/capacity-light.png) |

> **Tip:** To add your own screenshots, take screenshots of the app and save them in a `screenshots/` folder at the project root.

---

## Overview

This dashboard provides a single-pane-of-glass view into enterprise infrastructure, combining Cisco UCS hardware inventory with VMware virtualization metrics. It is designed for infrastructure and platform engineering teams who need real-time visibility across physical and virtual layers.

All data in this demo is generated client-side using realistic mock data — no backend or API server is required.

---

## Tech Stack

| Layer        | Technology                          |
|-------------|--------------------------------------|
| Framework   | React 18 with Hooks                  |
| Build Tool  | Vite 5                               |
| Styling     | Tailwind CSS 3 with custom glassmorphism |
| Charts      | Recharts 2                           |
| Icons       | Lucide React                         |
| Routing     | React Router v7                      |
| Export      | SheetJS (xlsx) for CSV/Excel export  |

---

## Features

### Infrastructure Dashboard
- Summary cards for chassis, blades, FIs, and server profiles
- Domain overview widgets with port utilization
- Expandable chassis/blade inventory with slot utilization bars
- Fabric Interconnect and Network Switch sections grouped by domain
- Server Profiles grouped by chassis with config state indicators
- Unified search across all device types
- Bulk serial number lookup with CSV export

### Host Inventory
- ESXi host tracking with first-seen/last-seen timestamps
- Filter by datacenter, cluster, and active/removed status
- Sortable columns with live search
- Sync trigger for inventory refresh

### Capacity Planning
- Cluster CPU and memory utilization with color-coded status bars
- Horizontal bar charts (top 10 / all clusters)
- Time series line charts for CPU, memory, and storage trends
- Datastore cluster storage utilization table
- Top hosts and VMs by CPU/memory usage
- VM congestion metrics (CPU Ready, Co-Stop)
- Per-datacenter filtering

### ESXi Build Versions
- Cluster-level ESXi version and build tracking
- Filter by datacenter, version, and build number
- Grouped display by datacenter with host counts

### VMware Tools Audit
- Full VM inventory with OS and tools version
- OS distribution bar chart
- Filter by datacenter, OS, tools version, or missing tools
- Grouped tables by datacenter with sortable columns

### TPM Recovery Keys
- Password-protected page (mock authentication)
- TPM status badges (Enabled, Disabled, Present, Not Found)
- Recovery key display with one-click copy
- Collection log viewer with live status
- JSON import and refresh capabilities

### UI/UX
- Dark/Light mode toggle with localStorage persistence
- Animated canvas background with aurora orbs and particles
- Liquid glass panels with prismatic shimmer edges
- Fully responsive layout with collapsible sidebar
- Smooth transitions and hover effects throughout

---

## Purpose

This project demonstrates a production-quality frontend for infrastructure monitoring without requiring access to real Cisco Intersight or VMware APIs. It serves as:

- A **portfolio piece** showcasing modern React, data visualization, and UI design
- A **design prototype** for infrastructure teams evaluating dashboard layouts
- A **reference implementation** for glassmorphic UI patterns with Tailwind CSS
- A **starting point** that can be connected to real backend APIs by swapping out the mock data layer in `src/api.js`

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

The app will be available at `http://localhost:5173`.

---

## Project Structure

```
src/
├── api.js                  # Mock API layer (swap for real endpoints)
├── mockData.js             # Generated placeholder data
├── App.jsx                 # Root with routing
├── main.jsx                # Entry point
├── index.css               # Tailwind + custom glassmorphism styles
├── ThemeContext.jsx         # Dark/light mode provider
├── SidebarContext.jsx       # Sidebar collapse state
├── components/
│   ├── Layout.jsx           # Main layout with sidebar
│   ├── Sidebar.jsx          # Navigation sidebar
│   ├── Header.jsx           # Page header
│   ├── ThemeToggle.jsx      # Dark/light toggle
│   ├── FiberBackground.jsx  # Animated canvas background
│   ├── SummaryCards.jsx     # Dashboard summary cards
│   ├── ChassisSection.jsx   # Chassis/blade inventory
│   ├── DomainWidgets.jsx    # Domain overview cards
│   ├── FabricInterconnectSection.jsx
│   ├── NetworkSwitchesSection.jsx
│   ├── ServerProfilesSection.jsx
│   ├── SearchBar.jsx        # Search + bulk serial lookup
│   ├── LoadingSpinner.jsx
│   └── ErrorMessage.jsx
└── pages/
    ├── DashboardPage.jsx
    ├── HostInventoryPage.jsx
    ├── CapacityPlanningPage.jsx
    ├── VMwareToolsPage.jsx   # ESXi build versions
    ├── VMToolsPage.jsx       # VMware tools audit
    └── TPMKeysPage.jsx
```
