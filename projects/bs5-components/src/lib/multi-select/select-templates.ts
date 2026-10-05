import { Directive, TemplateRef, inject } from '@angular/core';

/*
 * Template slots, equivalent to ng-select's ng-*-tmp directives:
 *   <ng-template appSelectOption let-item let-search="searchTerm">...</ng-template>
 */

export interface SelectOptionContext<T = any> {
  $implicit: T;
  item: T;
  index: number;
  searchTerm: string;
  selected: boolean;
  disabled: boolean;
}

export interface SelectLabelContext<T = any> {
  $implicit: T;
  item: T;
  /** Removes the item from the selection. */
  clear: () => void;
}

export interface SelectMultiLabelContext<T = any> {
  $implicit: T[];
  items: T[];
  clear: (item: T) => void;
}

export interface SelectGroupContext<T = any> {
  /** Group key returned by `groupBy`. */
  $implicit: unknown;
  label: string;
  items: T[];
  selected: boolean;
}

export interface SelectSearchContext {
  $implicit: string;
  searchTerm: string;
}

@Directive({ selector: 'ng-template[appSelectOption]' })
export class SelectOptionTemplate {
  readonly template = inject<TemplateRef<SelectOptionContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SelectOptionTemplate, ctx: unknown): ctx is SelectOptionContext { return true; }
}

@Directive({ selector: 'ng-template[appSelectLabel]' })
export class SelectLabelTemplate {
  readonly template = inject<TemplateRef<SelectLabelContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SelectLabelTemplate, ctx: unknown): ctx is SelectLabelContext { return true; }
}

@Directive({ selector: 'ng-template[appSelectMultiLabel]' })
export class SelectMultiLabelTemplate {
  readonly template = inject<TemplateRef<SelectMultiLabelContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SelectMultiLabelTemplate, ctx: unknown): ctx is SelectMultiLabelContext {
    return true;
  }
}

@Directive({ selector: 'ng-template[appSelectOptgroup]' })
export class SelectOptgroupTemplate {
  readonly template = inject<TemplateRef<SelectGroupContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SelectOptgroupTemplate, ctx: unknown): ctx is SelectGroupContext { return true; }
}

@Directive({ selector: 'ng-template[appSelectHeader]' })
export class SelectHeaderTemplate {
  readonly template = inject<TemplateRef<SelectSearchContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SelectHeaderTemplate, ctx: unknown): ctx is SelectSearchContext { return true; }
}

@Directive({ selector: 'ng-template[appSelectFooter]' })
export class SelectFooterTemplate {
  readonly template = inject<TemplateRef<SelectSearchContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SelectFooterTemplate, ctx: unknown): ctx is SelectSearchContext { return true; }
}

@Directive({ selector: 'ng-template[appSelectNotFound]' })
export class SelectNotFoundTemplate {
  readonly template = inject<TemplateRef<SelectSearchContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SelectNotFoundTemplate, ctx: unknown): ctx is SelectSearchContext { return true; }
}

@Directive({ selector: 'ng-template[appSelectLoading]' })
export class SelectLoadingTemplate {
  readonly template = inject<TemplateRef<SelectSearchContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SelectLoadingTemplate, ctx: unknown): ctx is SelectSearchContext { return true; }
}

@Directive({ selector: 'ng-template[appSelectTypeToSearch]' })
export class SelectTypeToSearchTemplate {
  readonly template = inject<TemplateRef<SelectSearchContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SelectTypeToSearchTemplate, ctx: unknown): ctx is SelectSearchContext {
    return true;
  }
}

@Directive({ selector: 'ng-template[appSelectTag]' })
export class SelectTagTemplate {
  readonly template = inject<TemplateRef<SelectSearchContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: SelectTagTemplate, ctx: unknown): ctx is SelectSearchContext { return true; }
}

export const SELECT_TEMPLATES = [
  SelectOptionTemplate, SelectLabelTemplate, SelectMultiLabelTemplate, SelectOptgroupTemplate, SelectHeaderTemplate,
  SelectFooterTemplate, SelectNotFoundTemplate, SelectLoadingTemplate, SelectTypeToSearchTemplate, SelectTagTemplate
] as const;
