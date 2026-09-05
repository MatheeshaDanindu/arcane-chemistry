# 🔮 Arcane Chemistry: Interactive WebXR Experience

**Arcane Chemistry** is an interactive, browser-based Extended Reality (XR) application that transforms traditional chemistry education into a gamified, "Wizarding World" potion-brewing simulator. 

It addresses the challenges of physical chemistry labs (safety hazards, material costs) by providing a safe, immersive spatial learning environment directly in a mobile web browser.

---

## ✨ Features

This project implements both core and advanced WebXR features[cite: 1]:

*   **Marker-Based AR (The Spellbook):** Utilizes AR.js custom pattern tracking (`.patt`) to anchor a 3D animated spellbook to a physical marker[cite: 1]. Includes raycaster-enabled touch gestures (swipe-to-turn pages) and immersive ambient audio.
*   **Markerless Spatial AR:** Utilizes the native WebXR Device API (`hit-test` and `local-floor`) to scan physical environments. Users can tap to anchor life-sized virtual objects (e.g., a chemistry station) onto detected flat planes without needing a printed marker[cite: 1].
*   **Complex Interaction (Advanced Feature):** Implements a multi-step potion brewing minigame[cite: 1]. 
    *   Synchronizes an HTML/CSS DOM overlay with the 3D WebGL canvas.
    *   Features real-time state management to validate user ingredient selection.
    *   Triggers reactive 3D particle animations and audio cues based on success or failure states.

---

## 🛠️ Technology Stack

*   **Core:** HTML5, CSS3, Vanilla JavaScript
*   **3D Framework:** [A-Frame (v1.3.0)](https://aframe.io/) - Chosen for robust entity-component structuring[cite: 1].
*   **Marker AR Engine:** [AR.js](https://ar-js-org.github.io/AR.js-Docs/) (Pattern Tracking)[cite: 1].
*   **Markerless Engine:** WebXR Device API[cite: 1].
*   **Asset Optimization:** `glTF` / `.glb` models utilizing Draco compression for rapid mobile web delivery[cite: 1].

---

## 🚀 How to Run the Project

### Live Demo
The application is hosted securely via GitHub Pages (HTTPS is strictly required for WebXR camera access).
👉 **https://matheeshadanindu.github.io/arcane-chemistry**

### Local Development
To run this project locally, you cannot simply double-click the HTML files. Browsers block camera access for `file:///` protocols.
1. Clone the repository:
   ```bash
   git clone [https://github.com/MatheeshaDanindu/arcane-chemistry.git](https://github.com/MatheeshaDanindu/arcane-chemistry.git)