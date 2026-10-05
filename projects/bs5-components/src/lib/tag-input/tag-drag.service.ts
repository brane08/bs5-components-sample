import { Injectable } from '@angular/core';
import type { TagInputComponent } from './tag-input.component';
import { TagModel } from './tag-input.types';

/** Shares the tag being dragged between tag inputs of the same `dragZone` (native HTML5 drag & drop). */
@Injectable({ providedIn: 'root' })
export class TagDragService {
  current: { zone: string; item: TagModel; index: number; source: TagInputComponent } | null = null;
}
