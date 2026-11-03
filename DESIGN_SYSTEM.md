# Clinivo design system

The shared foundation for the patient site (`frontend/`) and the staff portals (`admin/`). Preview every primitive with `npm run dev`, then open `/ui-gallery.html`. That page is dev-only and is not part of the production build.

## The language

Clinivo reads as a calm, well-kept clinic rather than a software dashboard.

- **Mineral neutrals.** Surfaces and greys carry a faint green, so the brand feels present even where no brand colour appears.
- **Viridian brand.** The existing green, deepened one step so white text on it passes WCAG AA.
- **One warm accent.** Coral is for what needs a person's attention now. If everything is coral, nothing is.
- **Editorial headlines.** Newsreader and Noto Naskh Arabic for display, Instrument Sans and IBM Plex Sans Arabic for everything else. Serif pairs with naskh and sans with sans, so both languages have the same character.
- **The leaf corner.** One large corner on the inline-end side (`rounded-se-signature`). It is the Clinivo shape, and it mirrors in RTL. Use it on hero-level cards and dialogs, not on every card.

## Rules for feature sessions

1. **Use semantic tokens in new code**, not `bg-white` or `text-gray-700`. Old classes still work in both themes, but only tokens are checked for contrast.
2. **Use logical classes**: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `rounded-se-`. Never `ml-`, `mr-`, `left-`, `right-`, `text-left`. Both apps are now right-to-left in Arabic, so a physical class shows up as a visible bug. See [Direction](#direction).
3. **Do not edit `components/ui`, `styles/`, `i18n/mergeAreas.js`, `i18n/loadAreas.js`, `utils/theme.js`, or `i18n.jsx`.** They are shared by parallel sessions. Build what you need on top, inside your feature's folder. If a primitive has a real bug, fix it in both apps in a small separate commit.
4. **Every string a person can see goes through `t()`**, with both languages present. That includes toasts, validation errors, placeholders, `aria-label`, `title` and `alt`. Add strings only to your own area file.
5. **Anything an admin, doctor or receptionist types that patients or other staff will read is stored in both languages.** Use the [bilingual pattern](#admin-entered-content). Never ask someone to enter both by hand, and never translate it only at display time.
6. **Run `npm test` in the package you changed** and compare with the [baseline](#baseline-test-results).

## Tokens

Tokens live in `src/styles/tokens.css` as Tailwind `@theme` variables, so each one is a utility class. Dark values switch automatically, so `dark:` is rarely needed. When it is, it follows the theme toggle rather than the OS.

### Colour

| Token | Classes | Use |
|---|---|---|
| `canvas` | `bg-canvas` | Page background |
| `surface`, `surface-raised`, `surface-sunken` | `bg-surface` … | Cards, menus and dialogs, wells and tracks |
| `ink`, `ink-2`, `ink-3` | `text-ink` … | Primary, secondary and tertiary text. All pass AA on every surface |
| `line`, `line-strong` | `border-line` … | Dividers and card edges |
| `field` | `border-field` | Form control borders (3:1, WCAG 1.4.11) |
| `primary`, `primary-dark` | `bg-primary` | Brand **fills** only, under `text-on-primary` |
| `primary-soft` | `bg-primary-soft` | Tinted brand wash, under `text-brand` |
| `brand` | `text-brand` | Brand **text and icons**. Passes AA in both themes |
| `accent`, `accent-soft`, `accent-ink` | `bg-accent text-on-accent`, `bg-accent-soft text-accent-ink` | The warm counterpoint |
| `success`, `warning`, `danger`, `info` | `bg-success text-on-status` | Solid status fills |
| `*-soft`, `*-ink` | `bg-success-soft text-success-ink` | Quiet status pairs. Always use them together |
| `focus` | `outline-focus` | Focus ring, already applied globally to `:focus-visible` |

`--color-scrim` is the modal backdrop: `bg-(--color-scrim)`.

### Type

| Class | Use |
|---|---|
| `font-display text-display-xl` | The one big idea on a page |
| `font-display text-display` | Page titles |
| `text-title-lg`, `text-title`, `text-subtitle` | Section and card headings |
| `text-body`, `text-body-sm` | Reading text, UI text |
| `text-caption` | Hints and metadata |

Line height and letter spacing are built into these classes and adapt to Arabic through `html[lang='ar']`. Arabic is never letter-spaced, because spacing breaks the joins between letters. A global rule zeroes `tracking-*` on Arabic pages.

### Space, radius, elevation

- **Space:** Tailwind's 4px scale, plus `px-gutter` (page side padding) and `py-section` (between page sections). Both are fluid.
- **Radius:** `rounded-control` (12px), `rounded-card` (20px), `rounded-sheet` (28px), `rounded-se-signature` (44px, the leaf).
- **Elevation:** `shadow-e1` (resting), `shadow-e2` (hover, popovers), `shadow-e3` (dialogs), `shadow-brand` (the glow under a primary action).

### Motion

- **Durations:** `duration-(--duration-fast)` 120ms, `duration-(--duration-base)` 200ms, `duration-(--duration-slow)` 360ms.
- **Easing:** `ease-standard`, `ease-enter`, `ease-exit`.
- **Animations:** `animate-rise`, `animate-fade`, `animate-sheet`, `animate-shimmer`.

`prefers-reduced-motion` zeroes the durations, and `base.css` also stops any other animation in the app. Still make sure nothing depends on an animation finishing.

## Components

Import from `components/ui`, for example `import { Button, Card, Field, Input } from '../components/ui'`. The API is the same in both apps.

| Component | Key props |
|---|---|
| `Button` | `variant` primary, accent, secondary, ghost, danger. `size` sm, md, lg. `loading`, `leadingIcon`, `trailingIcon`, `fullWidth`, `as={Link}` |
| `IconButton` | `label` (required, the accessible name), `variant`, `size` |
| `Card` | `variant` raised, flat, sunken, signature. `interactive`, `as`. Parts: `CardHeader` (`title`, `description`, `action`, `headingLevel`), `CardBody`, `CardFooter` |
| `Field` | `label`, `hint`, `error`, `required`, wrapping one `Input`, `Textarea` or `Select`. Wires up the id and ARIA for you |
| `Modal` | `open`, `onClose`, `title`, `description`, `size` sm, md, lg, `footer`. Bottom sheet on phones. Add `data-autofocus` to choose the first focused element |
| `notify` | `notify.success(t('Saved'))`, also `error`, `warning`, `info`, `dismiss`. `toast` from react-toastify keeps working and shares the same styled list. Do not mount another `ToastViewport`: each app already has one |
| `Skeleton`, `SkeletonGroup` | `Skeleton`: `circle`, sized with classes. Wrap in `SkeletonGroup` so it is announced once |
| `EmptyState` | `icon`, `title`, `description`, `action`, `headingLevel` |
| `Badge` | `tone` neutral, brand, accent, success, warning, danger, info. `dot` |
| `Tabs` | `Tabs` (`value` + `onChange`, or `defaultValue`), `TabList` (`label` required), `Tab` (`value`, `disabled`), `TabPanel` (`value`) |
| `ThemeToggle` | Already in both navbars and the staff login |
| `LanguageToggle` (from `i18n`) | Already in both navbars and the staff login. `compact` is one button naming the language it switches to. The full form shows both languages |
| `BilingualField` (admin only, `components/BilingualField`) | See [Admin-entered content](#admin-entered-content) |

```jsx
<Card variant='signature'>
  <CardHeader title={t('Your next visit')} action={<Badge tone='success' dot>{t('Confirmed')}</Badge>} />
  <CardBody>
    <Field label={t('Notes')} hint={t('Only your doctor sees this')}>
      <Textarea />
    </Field>
  </CardBody>
  <CardFooter>
    <Button loading={saving} onClick={save}>{t('Save')}</Button>
  </CardFooter>
</Card>
```

Primitives join class names and do not merge them, so to override one of their classes use Tailwind's `!` suffix: `className='rounded-sheet!'`.

Tests that render a primitive using `t()` should use `renderWithLanguage` from `src/test/renderWithLanguage.jsx`.

## Translations

The API has not changed: `const { t, tc } = useLanguage()`, and `t('English text')` still looks up the English text.

Add strings to your area file. Nothing else needs editing:

```js
// frontend/src/i18n/areas/booking.js
export default {
  ar: {
    'Choose a time': 'اختر الوقت',
  },
}
```

| App | Area files in `src/i18n/areas/` |
|---|---|
| `frontend/` | `discovery`, `booking`, `account`, `assistant` |
| `admin/` | `admin`, `doctor`, `receptionist` |

`ui.js` holds the strings the primitives use and `gaps.js` holds older strings that had no Arabic. A new file in that folder is picked up automatically.

- **Precedence.** Area strings win over `i18n.jsx`, so you can correct an old translation from your area without touching the shared file.
- **Conflicts.** If two areas give the same key different text, `src/i18n/areas.test.jsx` fails and names both files. Add context to your key, for example `'Book (verb)'`.
- **Keys that are not English sentences.** Add an `en` block: `{ en: { 'booking.done': 'You are booked' }, ar: { 'booking.done': 'تم الحجز' } }`.
- **Missing Arabic fails the tests.** `src/i18n/missingKeys.test.js` scans for `t('literal')` and fails on any key with no Arabic. It starts from zero in both apps, so it names exactly the string you just added. It cannot see `t(variable)`, so in development `t()` also logs `[i18n] No Arabic for: …` once per string. Database values appear in that log too, so read it as a prompt rather than a list of bugs.
- **Switching is instant.** Read `t` and `tc` from `useLanguage()` during render, so the text follows the language. Do not store translated text in state or at module level.

## Admin-entered content

When someone types into an admin form, the text is saved on the record in both English and Arabic. They type in either language, the other is generated, and both stay visible and editable.

| Situation | What happens |
|---|---|
| Types English or Arabic | The other side is generated and stored on the record |
| Corrects the generated side | Marked `manual`, and kept on every later save |
| Changes the source text | The other side is regenerated, replacing any correction |
| Translator unavailable | **The save still succeeds.** The other side stays blank with status `pending`, and display falls back to the language that exists |
| Pending record | Retried on the next admin clinic list load (at most every 10 minutes), from **Try again** on the language settings page, or by the backfill script |

**Names are transliterated, not translated.** Each field declares a `kind`:

| `kind` | Use for | How the other language is produced |
|---|---|---|
| `name` | People | Name dictionary, then letter by letter. Offline, so it is never pending |
| `label` | Departments, specialities | Reviewed list in `backend/data/clinicLabels.js`, then a translator |
| `place` | Addresses, areas | Known places in `backend/data/placeNamesLatinToAr.js`, then a translator |
| `text` | Sentences | A translator |

Translators are tried in this order, and only the ones configured are used: `GOOGLE_TRANSLATE_API_KEY`, then `OPENAI_API_KEY` (the chatbot's key), then `LIBRETRANSLATE_URL`. The OpenAI step runs only for authenticated admin content, never for the public translate routes.

### Applying it to a form

The clinics form is the worked example: `backend/models/clinicModel.js`, `backend/controllers/clinicController.js`, `admin/src/pages/Admin/Clinics.jsx`.

**1. Model.** Add `i18n` and declare the fields. Keep the old plain field, because other code reads it.

```js
import { bilingualFieldSchema } from './bilingualFieldSchema.js'

export const doctorBilingualFields = { name: { kind: 'name' }, about: { kind: 'text' } }

// in the schema
i18n: {
  name: { type: bilingualFieldSchema, default: undefined },
  about: { type: bilingualFieldSchema, default: undefined },
},
```

**2. Controller.** Set the plain field with `primaryText`, then apply the rest. Forms that still post a plain string keep working.

```js
doctor.name = primaryText(req.body.nameI18n ?? req.body.name)
await applyBilingualFields(doctor, doctorBilingualFields, req.body)
await doctor.save()
```

Check what depends on the plain field before renaming it. Doctors match clinics by name, so `updateClinic` only renames when English was supplied.

**3. Registry.** Add the model to `backend/services/bilingualRegistry.js`, so retry, status and the backfill include it.

**4. Form.**

```jsx
const [name, setName] = useState(() => bilingualFromRecord(doctor, 'name'))

<BilingualField label={t('Name')} kind='name' value={name} onChange={setName} translate={translatePreview} required />

await save({ nameI18n: bilingualPayload(name) })
```

`translatePreview` comes from `AdminContext` and needs an admin token. Doctor and receptionist forms need their own authenticated route that calls `postTranslatePreview`.

**5. Display.** `tc()` picks the current language and falls back to the other, so pending text is never blank.

```jsx
{tc(doctor.i18n?.name) || doctor.name}
```

### Forms still to convert

The clinics form is the only one converted. Their plain fields keep working until then.

| Session | Form | Fields and kinds |
|---|---|---|
| Admin | `AddDoctor.jsx`, `DoctorsList.jsx` | name `name`, about `text`, degree and speciality `label`, address `place` |
| Admin | `AddReceptionist.jsx`, `EditReceptionist.jsx`, `ReceptionistList.jsx` | name `name` |
| Admin | `InsuranceProvidersSettings.jsx` | provider names `label` |
| Admin | `FooterSettings.jsx`, `HomeHeroSettings.jsx`, `HomeBannerSettings.jsx`, `HomeServiceCardsSettings.jsx` | all text `text`. Site settings are one document, so also needs a registry entry that can walk nested fields |
| Doctor | `DoctorProfile.jsx` | about `text`, address `place` |
| Receptionist | `ReceptionistProfile.jsx`, `ReceptionistPatients.jsx` | name `name`. Decide with the owner whether patient records should be translated at all |

### Existing records

```bash
cd backend && node scripts/backfill-bilingual.js
```

Without flags this is a dry run that writes nothing and calls no translator. Add `--apply` to write. It can be run repeatedly, skips finished fields and never touches hand corrections. It refuses a non-local `MONGODB_URI` unless `--allow-remote` is also passed.

## Dark mode

```js
import { useTheme } from '../utils/theme'
const { theme, isDark, preference, setPreference, toggle } = useTheme() // needs no provider
```

The theme is stored in `localStorage` under `clinivoTheme` as `light`, `dark` or `system`, and applied as `data-theme` on `<html>` by a pre-paint script in `index.html`, so a dark visit does not flash light.

**The default is `light`.** Visitors opt in with the toggle. To follow the OS once the feature sessions have finished, change `DEFAULT_THEME_PREFERENCE` in `utils/theme.js` (both apps) and `var theme` in `index.html` (both apps). A test keeps these in step.

**Old pages get dark mode from `styles/dark-compat.css`.** It remaps the variables behind raw Tailwind colours, so `bg-white` becomes a surface and `text-gray-700` turns light, with no page edits. It covers classes, not inline styles or colours inside images. The file is generated: change `scripts/generate-dark-compat.mjs` and rerun it, do not edit the output. It is a bridge, and it is why new code should use tokens.

## Direction

- Both apps set `lang` and `dir` on `<html>` from the language, before first paint, and flip instantly when it changes.
- The choice survives reloads and logging in or out. If a role's policy forces another language, the person's own choice comes back as soon as the policy allows it.
- Use logical classes for layout. Where there is no logical class, use the `rtl:` variant, for example `object-left rtl:object-right`.
- Icons that point somewhere get `rtl:-scale-x-100` (arrows, chevrons). Icons that do not, such as search or calendar, stay as they are.
- `left-1/2 -translate-x-1/2` centring stays physical. `translate-x` does not mirror, so pair it with `rtl:`.
- `scrollBy` and `scrollLeft` run the opposite way in RTL. `SpecialityMenu.jsx` has the pattern.
- Keep `dir='ltr'` on values that always read left to right, such as phone numbers and emails.
- Use `isRtl` from `useLanguage()` rather than checking the language. Do not combine it with logical classes, or the layout mirrors twice.
- The gallery's LTR/RTL button previews a primitive in either direction.

## Keeping the apps in step

The apps deploy separately, so the shared files are copied rather than imported across folders. `frontend/src/test/designSystemSync.test.js` fails if `styles/`, `components/ui/`, `ui-gallery/`, `i18n/mergeAreas.js`, `i18n/loadAreas.js`, `i18n/areas/ui.js`, `utils/theme.js` or `utils/theme.test.js` differ between them. `src/styles/tokens.test.js` checks WCAG AA for every token pair above, in both themes.

## Baseline test results

Recorded before this foundation at commit `a94058c`. These failures already existed and are not yours to explain:

| Package | Result | Failing tests |
|---|---|---|
| `backend` | 240 of 240 pass | None |
| `frontend` | 161 of 164 pass | `chatbotEmptySpecialty.test.js`: "builds bilingual empty messages" and "formats Arabic specialty names". `publicSiteDefaults.test.js`: "includes app display name in footer copy" |
| `admin` | 82 of 83 pass | `siteSettingsCache.test.js`: "reads from localStorage when session empty" |
| `backend` integration (`npm run test:integration`, serial) | 33 of 42 pass | `appointments` T3.9, T3.10, T3.11. `auth` T3.3. `rbac` T3.4 (4 tests). `receptionist` T3.8 |

Root `npm test` chains packages with `&&`, so it stops at `frontend` and never reaches `admin`. Run `npm test` inside each package to see everything. `backend/__tests__/mongodbConnect.test.js` takes a few seconds and can hit its 5-second limit when the machine is busy. Rerun it alone before treating that as a failure.
