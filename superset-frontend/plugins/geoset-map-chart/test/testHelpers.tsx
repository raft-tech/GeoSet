import '@testing-library/jest-dom';
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import {
  EmotionCacheProvider,
  createEmotionCache,
  supersetTheme,
  ThemeProvider,
} from '@superset-ui/core';

const emotionCache = createEmotionCache({ key: 'test' });

export function ProviderWrapper({ children }: { children?: React.ReactNode }) {
  return (
    <EmotionCacheProvider value={emotionCache}>
      <ThemeProvider theme={supersetTheme}>{children}</ThemeProvider>
    </EmotionCacheProvider>
  );
}

export function renderWithTheme(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: ProviderWrapper, ...options });
}
