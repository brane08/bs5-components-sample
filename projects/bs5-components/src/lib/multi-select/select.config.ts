import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';

export type DropdownPosition = 'bottom' | 'top' | 'auto';

/** App-wide defaults and texts for `<app-multi-select>` (like ng-select's NgSelectConfig). */
export interface SelectConfig {
  placeholder: string;
  notFoundText: string;
  typeToSearchText: string;
  addTagText: string;
  loadingText: string;
  clearAllText: string;
  selectAllText: string;
  /** Chip remove button label; `{label}` is replaced. */
  removeItemText: string;
  /** Screen-reader announcements; `{label}` is replaced. */
  selectedText: string;
  deselectedText: string;
  clearedText: string;
  /** Chip variant (`text-bg-*`). */
  type: string;
  appendTo: 'body' | null;
  dropdownPosition: DropdownPosition;
  clearable: boolean;
  searchable: boolean;
  markFirst: boolean;
  clearSearchOnAdd: boolean;
  /** Row height in px for virtual scroll. */
  itemSize: number;
}

export const DEFAULT_SELECT_CONFIG: SelectConfig = {
  placeholder: '',
  notFoundText: 'No items found',
  typeToSearchText: 'Type to search',
  addTagText: 'Add item',
  loadingText: 'Loading...',
  clearAllText: 'Clear all',
  selectAllText: 'Select all',
  removeItemText: 'Remove {label}',
  selectedText: '{label} selected',
  deselectedText: '{label} removed',
  clearedText: 'Selection cleared',
  type: 'secondary',
  appendTo: null,
  dropdownPosition: 'auto',
  clearable: true,
  searchable: true,
  markFirst: true,
  clearSearchOnAdd: true,
  itemSize: 32
};

export const SELECT_CONFIG = new InjectionToken<SelectConfig>('SELECT_CONFIG', {
  factory: () => DEFAULT_SELECT_CONFIG
});

/** `providers: [provideSelectConfig({ notFoundText: $localize`Nothing found`, appendTo: 'body' })]` */
export function provideSelectConfig(config: Partial<SelectConfig>): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SELECT_CONFIG, useValue: { ...DEFAULT_SELECT_CONFIG, ...config } }]);
}
