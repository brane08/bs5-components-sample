import { Directive, TemplateRef, inject } from '@angular/core';
import { TagModel } from './tag-input.types';

export interface TagContext {
  $implicit: TagModel;
  item: TagModel;
  index: number;
  display: string;
  removable: boolean;
  remove: () => void;
}

export interface TagDropdownItemContext {
  $implicit: TagModel;
  item: TagModel;
  index: number;
  display: string;
}

/** Custom chip content: `<ng-template appTag let-item let-display="display">`. */
@Directive({ selector: 'ng-template[appTag]' })
export class TagTemplate {
  readonly template = inject<TemplateRef<TagContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: TagTemplate, ctx: unknown): ctx is TagContext { return true; }
}

/** Custom autocomplete row: `<ng-template appTagDropdownItem let-item>`. */
@Directive({ selector: 'ng-template[appTagDropdownItem]' })
export class TagDropdownItemTemplate {
  readonly template = inject<TemplateRef<TagDropdownItemContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: TagDropdownItemTemplate, ctx: unknown): ctx is TagDropdownItemContext {
    return true;
  }
}
