@AGENTS.md
content = """# Gemini AI Context - Expo Mastodon Client

This file serves as a contextual guide and prompt anchor for Gemini AI when assisting with the development of the Expo-based Mastodon application. It ensures the AI understands the project's tech stack, design architecture, and integration points.

---

## 🚀 Project Overview

This project is a cross-platform mobile application built using **Expo** and **React Native**. The core functionality of the app is to interface with the **Mastodon** decentralized social network, allowing users to log in via OAuth, view their timelines, post statuses, and interact with the Fediverse natively.

### Core Stack
- **Framework:** Expo (React Native)
- **Language:** TypeScript
- **State Management:** React Context / TanStack Query (for server state)
- **Styling:** Tailwind CSS (via NativeWind)

---

## 📚 Official Documentation & Sources

When generating code, debugging, or designing features, prioritize the official standards and implementations described in these references:

- 🐘 **Mastodon API Documentation:** [https://docs.joinmastodon.org/](https://docs.joinmastodon.org/)
- 🚀 **Expo Guides & Documentation:** [https://docs.expo.dev/guides/overview/](https://docs.expo.dev/guides/overview/)

---

## 🛠️ Key Architectural Instructions

### 1. Mastodon API & Authentication Flow
- **OAuth Registration:** The app must dynamically register an application on the user's specified Mastodon instance (`POST /api/v1/apps`) to obtain a `client_id` and `client_secret`.
- **User Authentication:** Use Expo's `WebBrowser` or `AuthSession` modules to handle the OAuth2 code exchange flow safely on mobile devices.
- **Token Storage:** Safely persist the user's access token and the instance URL using `expo-secure-store`. Never expose these in plain AsyncStorage.
- **API Versioning:** Default to the stable `/api/v1/` endpoints unless specified (e.g., streaming or specialized media filters available in `/api/v2/`).

### 2. Expo & Mobile Environment Guidelines
- **TypeScript Strictness:** Always enforce strict typing for API responses (e.g., typing Mastodon `Status`, `Account`, and `Context` objects accurately).
- **Asynchronous Safe Rendering:** Ensure list views utilize `FlashList` (from Shopify) or Expo-optimized `FlatList` to handle infinite scrolling timelines smoothly without memory leaks.
- **Image & Media Handling:** Use optimized image components to handle Mastodon's extensive image attachments, animated GIFs, and custom emojis seamlessly.

### 3. Feature Roadmap AI Directives
When asked to build features, implement them in alignment with these standard Mastodon paradigms:
- **Home Timeline:** Fetch via `GET /api/v1/timelines/home` supporting pagination using `max_id` and `since_id`.
- **Publishing Statuses:** Implement a character counter (500-character standard default) and support Content Warnings (CW) via `spoiler_text`.
- **Media Uploads:** Handle multi-part form uploads (`POST /api/v1/media`) before attaching the returned IDs to a new status.

### 4. User Settings
- Use `yarn` this project was wrote to work with yarn

---

# Pugdom: Mobile Application Architecture & Interface Design Specification

## 1. Executive Summary & Core Design Vision

**Pugdom** is a highly specialized pet-wellness and social ecosystem crafted explicitly for Pug owners. Pugs have distinct physiological requirements that demand meticulous, proactive management—including respiratory observation, temperature-dependent exercise thresholds, strict weight management, and precise therapeutic routines (such as antibiotic cycles). 

This design document bridges structured clinical data collection with an engaging decentralized social layer. The visual system translates complex, high-friction tracking tasks into a supportive and intuitive interface. By combining a calming, organic **Sage Olive and Warm Bone** theme for everyday tracking with a high-contrast **Midnight Glass** system for advanced data telemetry, the layout promotes daily tracking habits while lowering owner anxiety during health management periods.

---

## 2. Design Tokens & Design System

### 2.1 The Hybrid Color Strategy
The interface relies on two distinct visual contexts optimized for specific tasks:
1. **The Organic Canvas (Light Mode):** Applied to the primary medical tracker, chronological logging, and treatment sheets. It uses comforting, soft earth tones to reduce health-related stress.
2. **The Deep Analytical Mesh (Dark Mode):** Applied to real-time telemetry, historical trend aggregations, and performance dashboards. This approach leverages high-contrast neon accents over dark backgrounds to ensure clean visibility of technical graphs.

| Design Token | Value / Mapping | Applied UX Component |
| :--- | :--- | :--- |
| **Primary Theme** | `HEX #556B2F` (Sage Olive) | Primary action sheets, page banners, navigation headers, confirmation buttons. |
| **Secondary Accent** | `HEX #A3B18A` (Soft Moss) | Selected states, slider tracks, verified badges, tab navigation frames. |
| **Base Surface** | `HEX #F4F3EF` (Warm Bone) | Light-mode canvas background, content containers, timeline dividers. |
| **Analytics Surface** | `HEX #0F0E17` to `#1E1B2E` | Deep multi-stop gradient background reserved for dark-mode telemetry. |
| **Alert / Priority** | `HEX #E63946` (Crimson) | Missed medication blocks, breathing anomalies, low inventory alerts. |
| **Warning / Status** | `HEX #FFB703` (Amber) | Mid-tier pain indices, elevated regional temperatures, upcoming refills. |

### 2.2 Typography & Spacing Hierarchy
* **Primary System Font:** Inter, Roboto, or SF Pro Display.
* **Component Corner Radius:** Standard card layouts utilize a `16px` border-radius; primary control buttons utilize a `24px` pill shape.
* **Layout Margins:** Consistent `16px` horizontal padding across phone frames to align text boxes with screen boundaries.

---

## 3. Core Structural Modules

### 3.1 Chronological Treatment Console (Meals & Meds)
A timeline layout focused on day-to-day operational execution. It prevents gaps in critical routines by grouping nutritional plans and clinical dosages into a single schedule.

* **Calibrated Feeding Logs:** Displays food measurements in grams alongside precise time labels (e.g., *"Breakfast: Fiber Mix x 230g at 8:00 AM"*).
* **Clinical Dosage Management:** Highlights medication windows, dosage sizes, and completion tallies (e.g., *"Amoxicillin 100mg x 4 pills at 8:30 AM"*).
* **Contextual Safety Cards:** Inline tips to assist with proper medication delivery (e.g., 💡 *"Amoxicillin is better tolerated when taken with a soft protein food pack to prevent digestive discomfort."*).

### 3.2 Quantitative Symptom Engine (Pug-Specific Metrics)
Simplifies complex symptom logging into clean, accessible controls. This makes it easier to track conditions related to brachycephalic airway obstruction syndrome (BAOS) and corneal vulnerabilities.

* **Visual Parameter Sliders:** Interactive, color-coded sliders that allow owners to log soft metrics quickly:
  * **Overall Mood:** (Green track / Relaxed state)
  * **Energy & Vitality:** (Amber track / Moderate movement)
  * **Pain & Respiratory Effort:** (Red track / High priority tracking)
* **Dictation Box:** Features a floating microphone icon to log spoken observations immediately during vet evaluations.

### 3.3 Decentralized Social Layer ("Hubline")
Integrates decentralized social networking protocols (ActivityPub) directly into the pet-care ecosystem, connecting users with the broader community.

* **The Local Timeline ("Hubline"):** Displays posts, photo updates, and advice streams shared by local dog owners.
* **Cross-Instance Network Router:** A clean onboarding flow that lets users browse global registries, filter by popular tags, and connect seamlessly to federated servers (e.g., `pugdom.online`).

---

## 4. Screen Component Architectures

### Screen 1: The Daily Treatment Console
* **Header Stack:** Clean text hierarchy displaying `Sync Meals & Meds` in bold, paired with a subtle confirmation sub-header: *"Syncing meals and pills boosts treatment results."*
* **Item Framework:** High-contrast container elements featuring circular asset icons (e.g., salad icons, pill graphics) on the left, clear task descriptions in the center, and time alignments on the right.
* **Action Footer:** Split buttons (`+ Add Meal` / `+ Add Med`) designed for quick updates on the move.

### Screen 2: Diagnostics & Observation Sheet
* **Status Header:** Displays `Mood & Symptoms` alongside an expressive mood indicator.
* **Interactive Control Grid:** Stacked horizontal tracking rows with clear percentage indicators (e.g., `78%`, `61%`, `54%`). The progress tracks automatically shift color as sliders move toward critical thresholds.
* **Audio Capture Box:** A text box labeled `Note` with an absolute-positioned audio input icon (`bottom: 12px`, `right: 12px`) for hands-free dictation.

### Screen 3: Telemetry Dashboard & Supply Track
* **Analytical Telemetry:** Features a deep dark-mode interface centered around a neon performance ring displaying the target score (`79% Team Performance Score`). It includes a vertical frequency spectrum to track time-based trends and efficiency metrics (`Efficiency: 89%`).
* **Supply Ledger:** Displays inventory alerts (e.g., `12 pills left / 4 days remaining`) paired with an embedded verification QR code for quick scanning at pharmacy counters or veterinary check-ins.
* **Primary Action Trigger:** A solid-color button labeled `Order Refill` that automatically handles pharmacy supply reorders.

---

## 5. Technical Context Guidelines for AI Agents

When utilizing this specification to write application code, your developer agents should adhere to the following execution guidelines:

```javascript
// Example component guideline for layout rendering
const CardLayoutConfig = {
  borderRadius: 16,
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: '#F4F3EF', // Light Base Surface
  alternativeColor: '#0F0E17', // Dark Analytical Surface
};

const PriorityRules = {
  AlertThreshhold: 'value > 70% -> triggers Crimson styling',
  WarningThreshhold: '50% < value <= 70% -> triggers Amber styling',
};
```