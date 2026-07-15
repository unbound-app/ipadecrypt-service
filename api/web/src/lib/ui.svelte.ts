export type Theme = 'dark' | 'light';

function readStoredTheme(): Theme | null {
  const stored = localStorage.getItem('theme');
  return stored === 'dark' || stored === 'light' ? stored : null;
}

export const themeState = $state<{ value: Theme | null }>({ value: readStoredTheme() });

export function setTheme(theme: Theme): void {
  themeState.value = theme;
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme(): void {
  if (themeState.value) document.documentElement.setAttribute('data-theme', themeState.value);
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastSeq = 0;
export const toastState = $state<{ items: Toast[] }>({ items: [] });

export function showToast(message: string, type: Toast['type'] = 'success'): void {
  const id = ++toastSeq;
  toastState.items.push({ id, message, type });
  setTimeout(() => {
    toastState.items = toastState.items.filter((t) => t.id !== id);
  }, 3000);
}

interface ConfirmState {
  open: boolean;
  message: string;
  resolve?: (value: boolean) => void;
}

export const confirmState = $state<ConfirmState>({ open: false, message: '' });

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    confirmState.open = true;
    confirmState.message = message;
    confirmState.resolve = resolve;
  });
}

export function resolveConfirm(result: boolean): void {
  confirmState.open = false;
  confirmState.resolve?.(result);
  confirmState.resolve = undefined;
}

export const paletteState = $state<{ open: boolean }>({ open: false });

export function openPalette(): void {
  paletteState.open = true;
}

export function closePalette(): void {
  paletteState.open = false;
}

export type TabId = 'home' | 'keys' | 'logs' | 'docs' | 'settings';

export const tabState = $state<{ active: TabId; settingsSubtab: string }>({
  active: (localStorage.getItem('activeTab') as TabId | null) ?? 'home',
  settingsSubtab: localStorage.getItem('activeSettingsSubtab') ?? 'scheduler',
});

export function setActiveTab(tab: TabId): void {
  tabState.active = tab;
  localStorage.setItem('activeTab', tab);
  window.scrollTo(0, 0);
}

export function setSettingsSubtab(subtab: string): void {
  tabState.settingsSubtab = subtab;
  localStorage.setItem('activeSettingsSubtab', subtab);
  window.scrollTo(0, 0);
}
