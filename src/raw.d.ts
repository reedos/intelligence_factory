// Vite and Vitest import any file as text with ?raw
declare module '*?raw' { const text: string; export default text; }
