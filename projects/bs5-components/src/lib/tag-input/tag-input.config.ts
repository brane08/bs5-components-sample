import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';

/** App-wide defaults and texts for `<app-tag-input>`. */
export interface TagInputConfig {
  placeholder: string;
  secondaryPlaceholder: string | undefined;
  /** Chip variant (`text-bg-*`). */
  type: string;
  separatorKeys: string[];
  separatorKeyCodes: number[];
  addOnBlur: boolean;
  addOnPaste: boolean;
  pasteSplitPattern: string | RegExp;
  trimTags: boolean;
  allowDupes: boolean;
  editable: boolean;
  removable: boolean;
  modelAsStrings: boolean;
  identifyBy: string;
  displayBy: string;
  errorMessages: Record<string, string>;
  minimumTextLength: number;
  textChangeDebounce: number;
  loadingText: string;
  /** Labels and screen-reader announcements; `{label}` is replaced. */
  removeTagText: string;
  editTagText: string;
  addedText: string;
  removedText: string;
}

export const DEFAULT_TAG_INPUT_CONFIG: TagInputConfig = {
  placeholder: '',
  secondaryPlaceholder: undefined,
  type: 'secondary',
  separatorKeys: [],
  separatorKeyCodes: [],
  addOnBlur: true,
  addOnPaste: false,
  pasteSplitPattern: ',',
  trimTags: true,
  allowDupes: false,
  editable: false,
  removable: true,
  modelAsStrings: true,
  identifyBy: 'value',
  displayBy: 'display',
  errorMessages: {},
  minimumTextLength: 1,
  textChangeDebounce: 250,
  loadingText: 'Loading...',
  removeTagText: 'Remove {label}',
  editTagText: 'Edit {label}',
  addedText: '{label} added',
  removedText: '{label} removed'
};

export const TAG_INPUT_CONFIG = new InjectionToken<TagInputConfig>('TAG_INPUT_CONFIG', {
  factory: () => DEFAULT_TAG_INPUT_CONFIG
});

/** `providers: [provideTagInputConfig({ separatorKeys: [','], removeTagText: $localize`Remove {label}` })]` */
export function provideTagInputConfig(config: Partial<TagInputConfig>): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: TAG_INPUT_CONFIG, useValue: { ...DEFAULT_TAG_INPUT_CONFIG, ...config } }
  ]);
}
