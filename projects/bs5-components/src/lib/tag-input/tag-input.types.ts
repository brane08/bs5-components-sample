import { Observable } from 'rxjs';

/** A tag is a plain string or an object identified by `identifyBy` and labelled by `displayBy`. */
export type TagModel = string | Record<string, any>;

/** Runs before a tag is added or removed. Return/resolve/emit the (possibly transformed) tag to continue;
 * throw, reject, or complete without emitting to cancel. */
export type TagHook = (tag: TagModel) => TagModel | Promise<TagModel> | Observable<TagModel>;

export type TagMatchingFn = (text: string, item: TagModel) => boolean;

export type TagAutocompleteFn = (text: string) => Observable<TagModel[]>;
