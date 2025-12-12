# Splicing Hair, Head and Body Obj Files(Models) Demo using vue3 + three.

## Project Structure

```tex
root
├── public/                # Static assets
├── src/
│   ├── components/        # Vue components
│   │   ├── three/         # Three.js specific components (e.g., Scene)
│   │   └── ui/            # UI components (e.g., LoadingOverlay)
│   ├── constants/         # Project constants and shared configurations
│   ├── stores/            # Pinia stores (State Management)
│   ├── three/             # Three.js core logic
│   │   ├── gui/           # Tweakpane GUI configuration
│   │   ├── loaders/       # 3D Model and Texture loaders
│   │   ├── managers/      # Managers (e.g., GlobalLoadingManager)
│   │   └── ...
│   ├── App.vue            # Main App Component
│   └── main.ts            # Entry point
├── updates/               # Development updates and documentation
│   ├── CSG_CUT_HEAD_OPERATIONS_OPT.md
│   └── LOADING_BAR_IMPLEMENTATION.md
└── README.md
```
