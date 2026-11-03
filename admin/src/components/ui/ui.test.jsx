import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { renderWithLanguage } from '../../test/renderWithLanguage'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Skeleton,
  SkeletonGroup,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  ThemeToggle,
  ToastViewport,
  notify,
} from './index'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  cleanup()
  document.body.dir = ''
})

describe('Button', () => {
  it('is a non-submitting button by default', () => {
    renderWithLanguage(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('blocks presses and reports busy while loading', () => {
    const onClick = vi.fn()
    renderWithLanguage(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as a link without button-only attributes', () => {
    renderWithLanguage(
      <Button as='a' href='/doctors'>
        Doctors
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Doctors' })
    expect(link).toHaveAttribute('href', '/doctors')
    expect(link).not.toHaveAttribute('type')
  })

  it('names an icon button from its label', () => {
    renderWithLanguage(
      <IconButton label='Search'>
        <svg />
      </IconButton>,
    )
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('uses a logical corner for the signature shape, so it mirrors in RTL', () => {
    renderWithLanguage(<Card variant='signature'>Body</Card>)
    expect(screen.getByText('Body').className).toContain('rounded-se-signature')
  })

  it('renders as the element it is given', () => {
    renderWithLanguage(
      <Card as='button' interactive>
        Open
      </Card>,
    )
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
  })
})

describe('Field', () => {
  it('links the label, hint and error to the control', () => {
    renderWithLanguage(
      <Field label='Email' hint='We never share it' error='Email is required' required>
        <Input />
      </Field>,
    )
    const input = screen.getByLabelText(/Email/)
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('We never share it Email is required')
  })

  it('keeps an id the caller set on the control', () => {
    renderWithLanguage(
      <Field label='Name'>
        <Input id='patient-name' />
      </Field>,
    )
    expect(screen.getByLabelText('Name')).toHaveAttribute('id', 'patient-name')
  })

  it('leaves a valid control unmarked', () => {
    renderWithLanguage(
      <Field label='Name'>
        <Input />
      </Field>,
    )
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
  })
})

describe('Modal', () => {
  const Harness = ({ onClose = () => {} }) => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type='button' onClick={() => setOpen(true)}>
          Open
        </button>
        <Modal
          open={open}
          title='Confirm visit'
          description='Tuesday at 10:00'
          onClose={() => {
            setOpen(false)
            onClose()
          }}
        >
          <button type='button'>Inner</button>
        </Modal>
      </>
    )
  }

  it('renders nothing while closed', () => {
    renderWithLanguage(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is named, described and takes focus when opened', () => {
    renderWithLanguage(<Harness />)
    fireEvent.click(screen.getByText('Open'))
    const dialog = screen.getByRole('dialog', { name: 'Confirm visit' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Tuesday at 10:00')
    expect(dialog).toContainElement(document.activeElement)
  })

  it('closes on Escape and returns focus to the opener', () => {
    const onClose = vi.fn()
    renderWithLanguage(<Harness onClose={onClose} />)
    const opener = screen.getByText('Open')
    opener.focus()
    fireEvent.click(opener)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('keeps Tab inside the dialog in both directions', () => {
    renderWithLanguage(<Harness />)
    fireEvent.click(screen.getByText('Open'))
    const dialog = screen.getByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'Close' })
    const inner = within(dialog).getByRole('button', { name: 'Inner' })
    inner.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(inner).toHaveFocus()
  })

  it('closes from the backdrop but not from inside the panel', () => {
    const onClose = vi.fn()
    renderWithLanguage(<Harness onClose={onClose} />)
    fireEvent.click(screen.getByText('Open'))
    const dialog = screen.getByRole('dialog')
    fireEvent.mouseDown(dialog)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(dialog.parentElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks page scroll only while open', () => {
    renderWithLanguage(<Harness />)
    fireEvent.click(screen.getByText('Open'))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(document.body.style.overflow).toBe('')
  })

  it('translates the close label', () => {
    localStorage.setItem('clinicSysLanguage', 'ar')
    renderWithLanguage(
      <Modal open title='x' onClose={() => {}}>
        y
      </Modal>,
    )
    expect(screen.getByRole('button', { name: 'إغلاق' })).toBeInTheDocument()
  })
})

describe('Tabs', () => {
  const Example = () => (
    <Tabs defaultValue='a'>
      <TabList label='Sections'>
        <Tab value='a'>First</Tab>
        <Tab value='b' disabled>
          Second
        </Tab>
        <Tab value='c'>Third</Tab>
      </TabList>
      <TabPanel value='a'>Panel A</TabPanel>
      <TabPanel value='c'>Panel C</TabPanel>
    </Tabs>
  )

  it('links tabs to panels and keeps one tab in the tab order', () => {
    renderWithLanguage(<Example />)
    const first = screen.getByRole('tab', { name: 'First' })
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Third' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: 'First' })).toHaveTextContent('Panel A')
  })

  it('moves with arrow keys, skipping disabled tabs and wrapping', () => {
    renderWithLanguage(<Example />)
    const first = screen.getByRole('tab', { name: 'First' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    const third = screen.getByRole('tab', { name: 'Third' })
    expect(third).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel C')
    fireEvent.keyDown(third, { key: 'ArrowRight' })
    expect(first).toHaveFocus()
  })

  it('swaps the arrow keys in RTL', () => {
    renderWithLanguage(
      <div style={{ direction: 'rtl' }}>
        <Example />
      </div>,
    )
    const first = screen.getByRole('tab', { name: 'First' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Third' })).toHaveFocus()
  })

  it('supports Home and End', () => {
    renderWithLanguage(<Example />)
    const first = screen.getByRole('tab', { name: 'First' })
    first.focus()
    fireEvent.keyDown(first, { key: 'End' })
    const third = screen.getByRole('tab', { name: 'Third' })
    expect(third).toHaveFocus()
    fireEvent.keyDown(third, { key: 'Home' })
    expect(first).toHaveFocus()
  })

  it('reports changes when controlled', () => {
    const onChange = vi.fn()
    renderWithLanguage(
      <Tabs value='a' onChange={onChange}>
        <TabList label='Sections'>
          <Tab value='a'>First</Tab>
          <Tab value='b'>Second</Tab>
        </TabList>
      </Tabs>,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Second' }))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Skeleton', () => {
  it('hides shapes from assistive tech and announces the group once', () => {
    renderWithLanguage(
      <SkeletonGroup>
        <Skeleton className='h-4 w-32' />
      </SkeletonGroup>,
    )
    const group = screen.getByRole('status', { name: 'Loading' })
    expect(group.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('EmptyState', () => {
  it('shows its title, description and action', () => {
    renderWithLanguage(
      <EmptyState title='No visits' description='Book your first visit' action={<Button>Book</Button>} />,
    )
    expect(screen.getByRole('heading', { name: 'No visits' })).toBeInTheDocument()
    expect(screen.getByText('Book your first visit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book' })).toBeInTheDocument()
  })
})

describe('Badge', () => {
  it('uses the token pair for its tone', () => {
    renderWithLanguage(<Badge tone='success'>Paid</Badge>)
    const badge = screen.getByText('Paid')
    expect(badge.className).toContain('bg-success-soft')
    expect(badge.className).toContain('text-success-ink')
  })
})

describe('ThemeToggle', () => {
  it('is a switch that sets and remembers the theme', () => {
    renderWithLanguage(<ThemeToggle />)
    const toggle = screen.getByRole('switch', { name: 'Dark mode' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('clinivoTheme')).toBe('dark')
    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

describe('Toast', () => {
  it('shows a notify message as an alert', async () => {
    renderWithLanguage(<ToastViewport />)
    await act(async () => {
      notify.success('Saved')
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Saved')
    await act(async () => {
      notify.dismiss()
    })
  })
})
