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
2. **Use logical classes**: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `rounded-se-`. Never `ml-`, `mr-`, `left-`, `right-`, `text-left` in new code. The patient site is LTR in Arabic today (see [Direction](#direction)), so a mistake here will not show up until it flips.
3. **Do not edit `components/ui`, `styles/`, `i18n/mergeAreas.js`, `i18n/loadAreas.js`, `utils/theme.js`, or `i18n.jsx`.** They are shared by parallel sessions. Build what you need on top, inside your feature's folder. If a primitive has a real bug, fix it in both apps in a small separate commit.
4. **Add strings only to your own area file.**
5. **Run `npm test` in the package you changed** and compare with the [baseline](#baseline-test-results).

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

`ui.js` holds the strings the primitives use. A new file in that folder is picked up automatically.

- **Precedence.** Area strings win over `i18n.jsx`, so you can correct an old translation from your area without touching the shared file.
- **Conflicts.** If two areas give the same key different text, `src/i18n/areas.test.jsx` fails and names both files. Add context to your key, for example `'Book (verb)'`.
- **Keys that are not English sentences.** Add an `en` block: `{ en: { 'booking.done': 'You are booked' }, ar: { 'booking.done': 'تم الحجز' } }`.

## Dark mode

```js
import { useTheme } from '../utils/theme'
const { theme, isDark, preference, setPreference, toggle } = useTheme() // needs no provider
```

The theme is stored in `localStorage` under `clinivoTheme` as `light`, `dark` or `system`, and applied as `data-theme` on `<html>` by a pre-paint script in `index.html`, so a dark visit does not flash light.

**The default is `light`.** Visitors opt in with the toggle. To follow the OS once the feature sessions have finished, change `DEFAULT_THEME_PREFERENCE` in `utils/theme.js` (both apps) and `var theme` in `index.html` (both apps). A test keeps these in step.

**Old pages get dark mode from `styles/dark-compat.css`.** It remaps the variables behind raw Tailwind colours, so `bg-white` becomes a surface and `text-gray-700` turns light, with no page edits. It covers classes, not inline styles or colours inside images. The file is generated: change `scripts/generate-dark-compat.mjs` and rerun it, do not edit the output. It is a bridge, and it is why new code should use tokens.

## Direction

- `admin/` is RTL in Arabic.
- **`frontend/` is LTR in Arabic, deliberately set that way in an earlier commit (`6f4b64d`).** Text is Arabic but the layout does not mirror. This foundation keeps that behaviour.
- To flip it, change `dir` on the `ar` entry of `LANGUAGES` in `frontend/src/i18n.jsx`. The provider now reads that value, so it is the only edit needed in that file. Pages written with physical classes would then need fixing.
- Primitives already handle both directions. Use the gallery's LTR/RTL button to check.
- Use `isRtl` from `useLanguage()` rather than checking the language.

## Keeping the apps in step

The apps deploy separately, so the shared files are copied rather than imported across folders. `frontend/src/test/designSystemSync.test.js` fails if `styles/`, `components/ui/`, `ui-gallery/`, `i18n/mergeAreas.js`, `i18n/loadAreas.js`, `i18n/areas/ui.js`, `utils/theme.js` or `utils/theme.test.js` differ between them. `src/styles/tokens.test.js` checks WCAG AA for every token pair above, in both themes.

## Baseline test results

Recorded before this foundation at commit `a94058c`. These failures already existed and are not yours to explain:

| Package | Result | Failing tests |
|---|---|---|
| `backend` | 240 of 240 pass | None |
| `frontend` | 161 of 164 pass | `chatbotEmptySpecialty.test.js`: "builds bilingual empty messages" and "formats Arabic specialty names". `publicSiteDefaults.test.js`: "includes app display name in footer copy" |
| `admin` | 82 of 83 pass | `siteSettingsCache.test.js`: "reads from localStorage when session empty" |

Root `npm test` chains packages with `&&`, so it stops at `frontend` and never reaches `admin`. Run `npm test` inside each package to see everything.
