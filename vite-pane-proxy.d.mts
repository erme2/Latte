export interface PaneProxyEnv {
  VITE_PANE_PROXY_TARGET?: string;
  VITE_PANE_PROXY_HOST?: string;
  VITE_PANE_PROXY_VERIFY_TLS?: string;
}

export interface PaneProxyOptions {
  target: string;
  changeOrigin: true;
  secure: boolean;
  headers?: {
    Host: string;
  };
  rewrite: (path: string) => string;
}

export function validatePaneProxyTarget(value?: string): string;
export function validatePaneProxyHost(value?: string): string | undefined;
export function validatePaneProxyVerifyTls(value?: string): boolean;
export function createPaneProxyOptions(env: PaneProxyEnv): PaneProxyOptions;
