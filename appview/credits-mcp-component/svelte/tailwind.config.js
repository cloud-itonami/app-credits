import { etzhayyimUIKit } from '@etzhayyim/design-system/plugin';

export default {
  content: [
    './src/**/*.{html,js,svelte,ts}'
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        etzhayyim: {
          bg: 'var(--gv2-bg-primary)',
          card: 'var(--gv2-bg-card)',
          text: 'var(--gv2-text-primary)',
          muted: 'var(--gv2-text-muted)',
          accent: 'var(--gv2-accent)',
          border: 'var(--gv2-border)'
        }
      },
      fontFamily: {
        sans: ["'Noto Sans JP'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", "'Hiragino Kaku Gothic ProN'", 'sans-serif']
      }
    }
  },
  plugins: [etzhayyimUIKit]
};
