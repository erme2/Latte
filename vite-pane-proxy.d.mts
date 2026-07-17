export interface PaneProxyEnv {
  VITE_PANE_PROXY_TARGET?: string;
  VITE_PANE_PROXY_HOST?: string;
}

export interface PaneProxyOptions {
  target: string;
  changeOrigin: true;
  secure: false;
  headers?: {
    Host: string;
  };
  rewrite: (path: string) => string;
}

export function validatePaneProxyTarget(value?: string): string;
export function validatePaneProxyHost(value?: string): string | undefined;
export function createPaneProxyOptions(env: PaneProxyEnv): PaneProxyOptions;
