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

## Pages

**Dashboard** — Fleet-wide overview: infrastructure health (blade power, hardware state, vCenter health) by site, blade/chassis utilization, fabric interconnect pairs, and a bulk lookup to check whether a device exists anywhere in the fleet.

**Host Lifecycle / Hosts** — Host inventory with full lifecycle history — first seen, age, and removals across vCenter.

**Inventory** — Spare hardware on hand (blades, DIMMs, drives, PSUs, NICs, fabric interconnects, CPUs), tracked outside the management platform and searchable via bulk lookup.

**Decommissioned** — Blades decommissioned out of a UCS domain, checked against live inventory to catch stale records.

**Blade Firmware** — Running firmware versions across all blades, broken out by domain and model.

**ESXi Versions** — ESXi build/version compliance across hosts and clusters.

**VMware Tools** — VMware Tools version status across VMs and datacenters.

**OpenShift Licensing** — Worker node and cluster licensing coverage.

**Backup Status** — Backup health and compliance for Windows and RHEL VMs.

**VM Crash Reports** — Identify VMs affected by a host failure — crashed, vMotioned, or powered off.

**AI Diagnostics** — AI-assisted analysis of servers, fabric interconnects, and chassis, plus a usage/cost breakdown for the underlying model calls.

**Reboot CIMC** — Guided remote reboot workflow for hosts with a server profile attached.

**TPM Keys** — TPM recovery key lookup, gated behind a demo password.

**Audit Log** — Who did what — reboots, TPM key operations, and deletions across the app.

**Architecture** — Pan/zoom topology view of how the management platform connects to the fleet, from the cloud down to every chassis port.

**Settings** — Live status of every platform this app integrates with.

## Deployment

Pushing to `main` triggers a GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
that builds the app and publishes it to the `gh-pages` branch, which GitHub
Pages serves at the live demo link above.

## Tech stack

React 18, Vite, Tailwind CSS, Recharts, React Router.
