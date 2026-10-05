import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, debounceTime, delay, map, of, switchMap, tap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  MultiSelectComponent, SelectLabelTemplate, SelectOptionTemplate, TOAST_POSITIONS, TagInputComponent, TagModel,
  TagTemplate, ToastPositionClass, ToastService
} from 'bs5-components';
import { FormField, form, minLength } from '@angular/forms/signals';

interface Language {
  id: number;
  name: string;
  kind: string;
  disabled?: boolean;
}

const LANGUAGES: Language[] = [
  { id: 1, name: 'Python', kind: 'Dynamic' },
  { id: 2, name: 'Java', kind: 'Static' },
  { id: 3, name: 'TypeScript', kind: 'Static' },
  { id: 4, name: 'JavaScript', kind: 'Dynamic' },
  { id: 5, name: 'Go', kind: 'Static' },
  { id: 6, name: 'Rust', kind: 'Static' },
  { id: 7, name: 'Ruby', kind: 'Dynamic' },
  { id: 8, name: 'COBOL', kind: 'Static', disabled: true }
];

const PEOPLE = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Linus Torvalds', 'Margaret Hamilton'];

const CITIES = Array.from({ length: 10000 }, (_, i) => ({ id: i + 1, name: `City ${i + 1}` }));

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, ReactiveFormsModule, FormField, JsonPipe, TagInputComponent, MultiSelectComponent,
    SelectOptionTemplate, SelectLabelTemplate, TagTemplate
  ]
})
export class AppComponent {
  protected readonly toast = inject(ToastService);

  protected readonly variants = ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'dark'];
  protected readonly variant = signal('primary');
  protected readonly modalOpen = signal(false);

  // Tag input
  protected readonly tagList = signal<TagModel[]>(['initial', 'values', 'here']);
  protected readonly languageTags = signal<TagModel[]>([LANGUAGES[0]]);
  protected readonly emails = signal<TagModel[]>([]);
  protected readonly emailValidators = [Validators.email];
  protected readonly emailErrors = { email: 'Enter a valid e-mail address.' };
  protected readonly peopleTags = signal<TagModel[]>([]);
  protected readonly teamA = signal<TagModel[]>(['Ada', 'Alan', 'Grace']);
  protected readonly teamB = signal<TagModel[]>(['Linus']);
  protected readonly searchPeople = (text: string): Observable<TagModel[]> => of(PEOPLE).pipe(
    delay(300),
    map(all => all.filter(p => p.toLowerCase().includes(text.toLowerCase())))
  );
  protected readonly lowerCase = (tag: TagModel) => (typeof tag === 'string' ? tag.toLowerCase() : tag);

  // Select (template-driven)
  protected readonly languages = LANGUAGES;
  protected readonly selectedLanguageIds = signal<number[]>([1, 3]);
  protected readonly favourite = signal<Language | null>(null);
  protected readonly tags = signal<string[]>([]);
  protected readonly cities = CITIES;
  protected readonly city = signal<number | null>(42);

  // Async (typeahead) search against a fake server
  protected readonly peopleInput$ = new Subject<string>();
  protected readonly peopleLoading = signal(false);
  protected readonly people = toSignal(this.peopleInput$.pipe(
    debounceTime(200),
    tap(() => this.peopleLoading.set(true)),
    switchMap(term => of(PEOPLE)
      .pipe(delay(400), map(all => all.filter(p => p.toLowerCase().includes(term.toLowerCase()))))),
    tap(() => this.peopleLoading.set(false))
  ), { initialValue: [] as string[] });
  protected readonly selectedPeople = signal<string[]>([]);

  // Reactive
  protected readonly form = inject(NonNullableFormBuilder).group({
    tags: [['reactive'], Validators.required],
    languages: [[2], Validators.required],
    favourite: [null as number | null, Validators.required]
  });

  // Signal Forms (experimental in Angular 21)
  protected readonly profileModel = signal({ skills: ['Angular'] as TagModel[], languages: [3] as number[] });
  protected readonly profile = form(this.profileModel, p => {
    minLength(p.skills, 1);
    minLength(p.languages, 1);
  });

  // Toast playground
  protected readonly positions = TOAST_POSITIONS;
  protected readonly position = signal<ToastPositionClass>('toast-top-right');
  protected readonly title = signal('Heads up');
  protected readonly message = signal('Something happened');
  protected readonly timeOut = signal(5000);
  protected readonly progressBar = signal(true);
  protected readonly closeButton = signal(true);
  protected readonly tapToDismiss = signal(true);
  protected readonly enableHtml = signal(false);

  protected readonly addCustomTag = (name: string) => ({ id: Date.now(), name, kind: 'Custom' });

  showToast(type: 'success' | 'info' | 'warning' | 'error') {
    const active = this.toast[type](this.message(), this.title() || undefined, {
      positionClass: this.position(),
      timeOut: this.timeOut(),
      progressBar: this.progressBar(),
      closeButton: this.closeButton(),
      tapToDismiss: this.tapToDismiss(),
      enableHtml: this.enableHtml()
    });
    active.onTap.subscribe(() => this.toast.info('Toast tapped', undefined, { positionClass: this.position() }));
  }

  setGlobal(key: 'preventDuplicates' | 'newestOnTop' | 'countDuplicates', value: boolean) {
    this.toast.config[key] = value;
  }

  setMaxOpened(value: number) {
    this.toast.config.maxOpened = value;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.toast.error('Please fix the highlighted fields', 'Invalid form');
      return;
    }
    this.toast.success(JSON.stringify(this.form.getRawValue()), 'Submitted');
  }

  toggleDisabled() {
    if (this.form.disabled) {
      this.form.enable();
    } else {
      this.form.disable();
    }
  }
}
