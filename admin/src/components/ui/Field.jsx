import { Children, cloneElement, forwardRef, isValidElement, useId } from 'react'
import { cx } from './cx'

const CONTROL =
  'w-full rounded-control border border-field bg-surface px-3.5 text-body-sm text-ink ' +
  'transition duration-(--duration-fast) ease-standard placeholder:text-ink-3 ' +
  'hover:border-ink-3 focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary/30 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-70 ' +
  'aria-invalid:border-danger aria-invalid:focus:outline-danger/30'

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx(CONTROL, 'min-h-11', className)} {...props} />
})

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cx(CONTROL, 'py-2.5', className)} {...props} />
})

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cx(CONTROL, 'min-h-11 cursor-pointer', className)} {...props}>
      {children}
    </select>
  )
})

/**
 * Label, hint and error around one control. Wires up id, aria-describedby, aria-invalid
 * and required on the child, so <Field label='Email'><Input /></Field> is all it takes.
 * `data-input-field` is what utils/mobileTapFix.js and the 16px touch rule look for.
 */
export function Field({ label, hint, error, required = false, className, children }) {
  const baseId = useId()
  const control = Children.only(children)
  const controlId = (isValidElement(control) && control.props.id) || `${baseId}-control`
  const hintId = hint ? `${baseId}-hint` : undefined
  const errorId = error ? `${baseId}-error` : undefined
  const describedBy = [control.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div data-input-field className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className='text-body-sm font-medium text-ink'>
        {label}
        {required && (
          <span aria-hidden='true' className='ms-1 text-danger-ink'>
            *
          </span>
        )}
      </label>
      {cloneElement(control, {
        id: controlId,
        required: required || control.props.required,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : control.props['aria-invalid'],
      })}
      {hint && (
        <p id={hintId} className='text-caption text-ink-3'>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className='text-caption font-medium text-danger-ink'>
          {error}
        </p>
      )}
    </div>
  )
}
