# Bootstrap 5 Angular Components

Standalone Angular 21 components styled with Bootstrap 5.3 classes, packaged as the `bs5-components` library
(`projects/bs5-components`) with a demo app (`src/`). They are zoneless-ready, use signals and `OnPush`, and every form
control works with template-driven (`ngModel`), reactive and Signal Forms (`[formField]`).

| Component | Similar to | Bootstrap building blocks |
|---|---|---|
| `ToastService` | [ngx-toastr](https://github.com/scttcper/ngx-toastr) | `.toast-container`, `.toast`, `.toast-header`, `.toast-body`, `.progress`, `text-bg-*` |
| `<app-multi-select>` | [ng-select](https://github.com/ng-select/ng-select) | `.form-select`, `.dropdown-menu`, `.dropdown-item`, `.dropdown-header`, `.badge`, `.form-check-input` |
| `<app-tag-input>` | [ngx-chips](https://github.com/Gbuomprisco/ngx-chips) | `.form-control`, `.badge`, `.btn-close`, `.dropdown-menu`, `.focus-ring`, `.invalid-feedback` |

## Styling

Templates use Bootstrap components and utility classes only, for example `.form-select`, `.dropdown-menu`, `.badge`,
`.is-invalid`, `bg-body-tertiary`, and `.fade`/`.show`. Custom CSS is limited to what Bootstrap cannot express. Each
rule is commented in its stylesheet:

| Rule | Why |
|---|---|
| `:focus-within` ring on the chip controls | Bootstrap styles `:focus` on the control itself, but here focus sits on an inner `<input>`. Values come from Bootstrap's Sass variables (`$input-focus-border-color`, `$input-focus-box-shadow`). |
| `max-height` on the option / suggestion lists | Bootstrap has no max-height utility. |
| Toast progress keyframes | Bootstrap has no timed progress animation. |
| `.cdk-overlay-container` z-index (global, `bs5-components/styles`) | Puts `appendTo="body"` dropdowns at Bootstrap's `$zindex-popover`: above modals, below toasts. The CDK default would sit behind modals. |

Theme Bootstrap as usual (Sass variables or CSS custom properties) and the components follow.

## Getting started

```bash
npm install
npm start            # http://localhost:4200 – demo of every feature
npm test             # library specs (Vitest, headless Chromium, watch mode)
npm run test:app     # demo app specs
npm run test:ci      # both, single run; fails below 100% statement/branch/function/line coverage
npm run build:lib    # builds the library to dist/bs5-components
npm run build        # builds the demo app
```

Tests run with Vitest in a real browser (Playwright Chromium; run `npx playwright install chromium` once).

## Using the library

```ts
import { MultiSelectComponent, TagInputComponent, ToastService, provideToastr } from 'bs5-components';
```

```scss
@use "bootstrap/scss/bootstrap";
@use "bs5-components/styles"; // one global rule: overlay stacking for appendTo="body"
```

Peer dependencies: Angular 21 (`core`, `common`, `forms`, `cdk`), Bootstrap 5.3 and RxJS 7. The selectors keep the
`app-` prefix of the original sample.

### App-wide defaults and translations

Every component reads its defaults and all user-visible texts (including ARIA labels and screen-reader
announcements) from a provider; `{label}` is replaced with the item label. Pass `$localize` strings to translate:

```ts
providers: [
  provideToastr({ closeLabel: $localize`Close` }),
  provideSelectConfig({ notFoundText: $localize`Nothing found`, appendTo: 'body', removeItemText: $localize`Remove {label}` }),
  provideTagInputConfig({ separatorKeys: [','], addedText: $localize`{label} added` })
]
```

### Signal Forms (experimental)

The components work with Angular's Signal Forms through its built-in `NgControl` interop: values, `disabled`,
`touched` and validity are all synced, and `.is-invalid` shows once a field is touched.

```ts
readonly model = signal({ skills: ['Angular'], languages: [] as number[] });
readonly profile = form(this.model, p => minLength(p.languages, 1)); // `required` does not treat [] as empty
```

```html
<app-tag-input [formField]="profile.skills" />
<app-multi-select [formField]="profile.languages" [items]="languages" bindLabel="name" bindValue="id" />
```

### Accessibility

- Chips are keyboard reachable in both the select and the tag input: ← from the start of the input focuses the last
  chip, ←/→ move, Backspace/Delete remove, Esc returns to the input.
- The select supports ↑/↓, Home/End, PageUp/PageDown, Enter, Esc, Tab, and type-to-jump when `searchable` is false.
- Selection and tag changes are announced in a visually hidden live region.
- Toasts pause while hovered or focused (WCAG 2.2.1), close with Esc, and their progress bar is hidden from
  screen readers.

## Toast service

```ts
// app.config.ts
providers: [provideToastr({ timeOut: 5000, closeButton: true, progressBar: true })]

// any component
private readonly toast = inject(ToastService);

const active = this.toast.success('Saved', 'Done');      // also error/info/warning/show
active.onTap.subscribe(() => ...);                     // onShown, onHidden, onAction
this.toast.clear();                                    // clear(id), remove(id)
```

The container is attached to `<body>` automatically. Options match ngx-toastr: `timeOut`, `extendedTimeOut`,
`disableTimeOut`, `closeButton`, `progressBar`, `progressAnimation`, `enableHtml`, `tapToDismiss`, `positionClass`
(`toast-top-right`, `toast-bottom-full-width`, ...), `toastClass`, `titleClass`, `messageClass`, `easeTime`,
`toastComponent`, `payload`. Global-only options: `maxOpened`, `autoDismiss`, `newestOnTop`, `preventDuplicates`,
`includeTitleDuplicates`, `resetTimeoutOnDuplicate`, `countDuplicates`, `iconClasses` (type → `text-bg-*`).

Hovering or focusing a toast pauses it. When the pointer or focus leaves, it closes after `extendedTimeOut`.
Like ngx-toastr, `newestOnTop` applies when a toast is inserted; changing it never reorders open toasts. A custom `toastComponent` can
`inject(ToastPackage)` and call `toastRef.close()`, `triggerAction()` or `triggerTap()`.

## Multi select

```html
<app-multi-select [items]="languages" bindLabel="name" bindValue="id" groupBy="kind"
                  selectableGroup showSelectAll placeholder="Pick languages"
                  [(ngModel)]="ids" />

<app-multi-select formControlName="favourite" [items]="languages" bindLabel="name" [multiple]="false"
                  appendTo="body">
  <ng-template appSelectOption let-item let-search="searchTerm">{{ item.name }}</ng-template>
  <ng-template appSelectLabel let-item>{{ item.name }}</ng-template>
</app-multi-select>
```

| Feature | Inputs / outputs |
|---|---|
| Data | `items`, `bindLabel` (dotted paths), `bindValue`, `compareWith`, `searchFn`, `groupBy`, `selectableGroup` |
| Mode | `multiple` (default `true`), `closeOnSelect`, `hideSelected`, `maxSelectedItems`, `readonly`, `disabled` |
| Search | `searchable`, `typeahead` (a `Subject<string>` for server search), `minTermLength`, `loading` |
| Tagging | `addTag` (`true` or `(term) => item \| Promise<item>`), `addTagText` |
| Keyboard | arrows, Enter, Esc, Tab (`selectOnTab`), Space when not searchable, Backspace (`clearOnBackspace`), `openOnEnter`, `markFirst`, `keyDownFn` |
| Large lists | `virtualScroll`, `itemSize`, `(scroll)`, `(scrollToEnd)` |
| Layout | `appendTo="body"` (CDK overlay), `dropdownPosition` (`auto`/`top`/`bottom`), `size` (`sm`/`lg`), `type` (chip variant), `showSelectAll`, `clearable` |
| Events | `(open)`, `(close)`, `(focus)`, `(blur)`, `(search)`, `(add)`, `(remove)`, `(change)`, `(clear)`, `[(isOpen)]` |
| Templates | `appSelectOption`, `appSelectLabel`, `appSelectMultiLabel`, `appSelectOptgroup`, `appSelectHeader`, `appSelectFooter`, `appSelectNotFound`, `appSelectLoading`, `appSelectTypeToSearch`, `appSelectTag` |

When the control is `ng-invalid ng-touched` (or has `is-invalid`), it gets Bootstrap's invalid styles.

## Tag input

```html
<app-tag-input [(ngModel)]="tags" [separatorKeys]="[',']" addOnPaste editable
               placeholder="+ Tag" secondaryPlaceholder="Add tags" />

<app-tag-input formControlName="languages" [autocompleteItems]="languages" identifyBy="id" displayBy="name"
               [modelAsStrings]="false" onlyFromAutocomplete [maxItems]="3">
  <ng-template appTag let-item let-display="display">{{ display }}</ng-template>
</app-tag-input>
```

Same feature set as ngx-chips, built only on Bootstrap classes and without the Angular CDK:

| Feature | Inputs / outputs |
|---|---|
| Model | `[(tags)]`, `ngModel`, reactive forms; string or object tags with `identifyBy`, `displayBy`, `modelAsStrings` |
| Adding | Enter, `separatorKeys`, `separatorKeyCodes`, `allow-space`, `addOnBlur`, `clearOnBlur`, `addOnPaste` + `pasteSplitPattern`, `trimTags`, `maxItems`, `allowDupes`, `blinkIfDupe` |
| Hooks & validation | `onAdding` / `onRemoving` (value, Promise or Observable; reject/empty cancels), `validators`, `asyncValidators`, `errorMessages` |
| Editing | `editable` (double-click; Enter/blur saves, Esc cancels), `removable` |
| Keyboard | Backspace/← at the start focuses the last tag, ←/→ move between tags, Backspace/Delete remove, Esc returns to the input |
| Autocomplete | `autocompleteItems`, `autocompleteObservable`, `onlyFromAutocomplete`, `showDropdownIfEmpty`, `keepOpen`, `minimumTextLength`, `limitItemsTo`, `matchingFn`, `focusFirstElement`, `textChangeDebounce` |
| Drag & drop | `dragZone`: native HTML5 drag between inputs in the same zone, and reordering |
| Rendering | `placeholder`, `secondaryPlaceholder`, `inputId`, `inputClass`, `tabindex`, `hideForm`, `editor`, `type` (chip variant), `disabled`, `[(inputText)]` |
| Templates | `appTag` (chip), `appTagDropdownItem` (suggestion) |
| Events | `(add)`, `(remove)`, `(select)`, `(focus)`, `(blur)`, `(textChange)`, `(paste)`, `(validationError)`, `(tagEdited)` |

Differences from ngx-chips:
- Outputs drop the `on` prefix (Angular's naming guideline), so `(onAdd)` becomes `(add)`.
- Autocomplete inputs sit on the tag input itself. There is no separate `<tag-input-dropdown>`.
- Typed tags stay strings by default (`modelAsStrings` defaults to `true`).
- Backspace on the empty input first focuses the last tag, and a second press removes it.
- The suggestion list is an inline `.dropdown-menu`, so `appendToBody`, `zIndex` and `dynamicUpdate` are not supported. Use the select for body-appended dropdowns.
- `theme`, `ripple` and `animationDuration` are replaced by Bootstrap variants (`type`).

## Credits

The toast service, the select and the tag input reproduce the public APIs of three excellent MIT-licensed libraries. No source code
was copied; the implementations here are original and built on Bootstrap.

- [ngx-toastr](https://github.com/scttcper/ngx-toastr) by Scott Cooper, MIT License. Inspired the toast service API
  and options.
- [ng-select](https://github.com/ng-select/ng-select) by Andžej Maciusovič, MIT License. Inspired the select
  component's inputs, outputs and template directives.
- [ngx-chips](https://github.com/Gbuomprisco/ngx-chips) by Giancarlo Buomprisco, MIT License. Inspired the
  tag input's inputs, outputs and behaviour.

Also built on [Bootstrap](https://getbootstrap.com) (MIT) and [Angular](https://angular.dev) / Angular CDK (MIT).
