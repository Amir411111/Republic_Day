import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// content/ is served as static root, so card images live at /images/<file>
export default defineConfig({
  plugins: [react()],
  publicDir: 'content',
});
