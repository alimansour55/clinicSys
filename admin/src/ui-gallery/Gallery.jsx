import { useEffect, useState } from 'react'
import { CalendarDays, Plus, Search } from 'lucide-react'
import { LanguageToggle, useLanguage } from '../i18n'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
  SkeletonGroup,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
  ThemeToggle,
  ToastViewport,
  notify,
} from '../components/ui'

const Section = ({ title, children }) => (
  <section className='space-y-4'>
    <h2 className='text-title font-semibold text-ink'>{title}</h2>
    {children}
  </section>
)

const SWATCHES = [
  ['bg-canvas', 'text-ink'],
  ['bg-surface', 'text-ink'],
  ['bg-surface-sunken', 'text-ink'],
  ['bg-primary', 'text-on-primary'],
  ['bg-primary-soft', 'text-brand'],
  ['bg-accent', 'text-on-accent'],
  ['bg-accent-soft', 'text-accent-ink'],
  ['bg-success', 'text-on-status'],
  ['bg-warning', 'text-on-status'],
  ['bg-danger', 'text-on-status'],
  ['bg-info', 'text-on-status'],
]

/** Dev-only preview of every primitive: `npm run dev`, then open /ui-gallery.html. */
export default function Gallery() {
  const { language } = useLanguage()
  const [modalOpen, setModalOpen] = useState(false)
  const [rtl, setRtl] = useState(language === 'ar')
  const arabic = language === 'ar'
  const text = (en, ar) => (arabic ? ar : en)

  useEffect(() => setRtl(language === 'ar'), [language])

  /* A frame later, because LanguageProvider sets dir in its own effect after this one runs */
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr'
      document.body.dir = rtl ? 'rtl' : 'ltr'
    })
    return () => cancelAnimationFrame(frame)
  }, [rtl, language])

  return (
    <main className='mx-auto max-w-5xl space-y-12 px-gutter py-10'>
      <ToastViewport />
      <header className='flex flex-wrap items-center justify-between gap-4'>
        <h1 className='font-display text-display text-ink'>{text('Clinivo design system', 'نظام تصميم كلينيفو')}</h1>
        <div className='flex items-center gap-2'>
          <Button variant='secondary' size='sm' onClick={() => setRtl((value) => !value)}>
            {rtl ? 'RTL' : 'LTR'}
          </Button>
          <LanguageToggle compact />
          <ThemeToggle />
        </div>
      </header>

      <Section title={text('Colour', 'الألوان')}>
        <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
          {SWATCHES.map(([bg, fg]) => (
            <div key={bg} className={`rounded-control border border-line p-3 text-caption font-medium ${bg} ${fg}`}>
              {bg}
            </div>
          ))}
        </div>
      </Section>

      <Section title={text('Type', 'الخطوط')}>
        <p className='font-display text-display-xl text-ink'>{text('Care that remembers you', 'رعاية تتذكرك')}</p>
        <p className='font-display text-display text-ink'>{text('Find the right doctor', 'اعثر على الطبيب المناسب')}</p>
        <p className='text-title-lg font-semibold text-ink'>{text('Your next appointment', 'موعدك القادم')}</p>
        <p className='text-title font-semibold text-ink'>{text('Tuesday at 10:00', 'الثلاثاء الساعة ١٠:٠٠')}</p>
        <p className='text-body text-ink-2'>
          {text(
            'Body text stays comfortable to read at length, in either language.',
            'يبقى النص الأساسي مريحًا للقراءة الطويلة بكلتا اللغتين، مع مساحة كافية للحركات.',
          )}
        </p>
        <p className='text-body-sm text-ink-3'>{text('Secondary detail', 'تفاصيل ثانوية')}</p>
        <p className='text-caption text-ink-3'>{text('Caption', 'تعليق توضيحي')}</p>
      </Section>

      <Section title={text('Buttons', 'الأزرار')}>
        <div className='flex flex-wrap items-center gap-3'>
          <Button leadingIcon={<CalendarDays aria-hidden='true' className='size-4' />}>
            {text('Book a visit', 'احجز زيارة')}
          </Button>
          <Button variant='accent'>{text('Urgent', 'عاجل')}</Button>
          <Button variant='secondary'>{text('Secondary', 'ثانوي')}</Button>
          <Button variant='ghost'>{text('Ghost', 'شفاف')}</Button>
          <Button variant='danger'>{text('Cancel visit', 'إلغاء الزيارة')}</Button>
          <Button loading>{text('Saving', 'جارٍ الحفظ')}</Button>
          <Button disabled>{text('Disabled', 'معطل')}</Button>
          <Button size='sm'>{text('Small', 'صغير')}</Button>
          <Button size='lg'>{text('Large', 'كبير')}</Button>
          <IconButton label={text('Search', 'بحث')}>
            <Search aria-hidden='true' className='size-4' />
          </IconButton>
          <IconButton label={text('Add', 'إضافة')} variant='primary'>
            <Plus aria-hidden='true' className='size-4' />
          </IconButton>
        </div>
      </Section>

      <Section title={text('Cards', 'البطاقات')}>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <Card>
            <CardHeader title={text('Raised', 'مرتفعة')} description={text('The default', 'الافتراضية')} />
            <CardBody>
              <Badge tone='brand'>{text('Available', 'متاح')}</Badge>
            </CardBody>
          </Card>
          <Card variant='signature'>
            <CardHeader title={text('Signature', 'المميزة')} description={text('The leaf corner', 'زاوية الورقة')} />
            <CardBody>
              <Badge tone='accent' dot>
                {text('New', 'جديد')}
              </Badge>
            </CardBody>
          </Card>
          <Card as='button' type='button' interactive>
            <CardHeader title={text('Interactive', 'تفاعلية')} description={text('A real button', 'زر حقيقي')} />
            <CardBody />
          </Card>
          <Card variant='flat'>
            <CardBody>{text('Flat', 'مسطحة')}</CardBody>
            <CardFooter>
              <Button size='sm' variant='secondary'>
                {text('Action', 'إجراء')}
              </Button>
            </CardFooter>
          </Card>
          <Card variant='sunken'>
            <CardBody>{text('Sunken', 'غائرة')}</CardBody>
          </Card>
        </div>
      </Section>

      <Section title={text('Fields', 'الحقول')}>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field label={text('Full name', 'الاسم الكامل')} hint={text('As on your ID', 'كما في بطاقتك')} required>
            <Input placeholder={text('Your name', 'اسمك')} />
          </Field>
          <Field label={text('Email', 'البريد الإلكتروني')} error={text('Email is required', 'البريد الإلكتروني مطلوب')}>
            <Input type='email' />
          </Field>
          <Field label={text('Specialty', 'التخصص')}>
            <Select>
              <option>{text('Cardiology', 'أمراض القلب')}</option>
              <option>{text('Dermatology', 'الأمراض الجلدية')}</option>
            </Select>
          </Field>
          <Field label={text('Notes', 'ملاحظات')}>
            <Textarea rows={2} />
          </Field>
          <Field label={text('Disabled', 'معطل')}>
            <Input disabled value={text('Locked', 'مقفل')} readOnly />
          </Field>
        </div>
      </Section>

      <Section title={text('Badges', 'الشارات')}>
        <div className='flex flex-wrap gap-2'>
          {['neutral', 'brand', 'accent', 'success', 'warning', 'danger', 'info'].map((tone) => (
            <Badge key={tone} tone={tone} dot>
              {tone}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title={text('Tabs', 'علامات التبويب')}>
        <Tabs defaultValue='upcoming'>
          <TabList label={text('Appointments', 'المواعيد')}>
            <Tab value='upcoming'>{text('Upcoming', 'القادمة')}</Tab>
            <Tab value='past'>{text('Past', 'السابقة')}</Tab>
            <Tab value='cancelled' disabled>
              {text('Cancelled', 'الملغاة')}
            </Tab>
          </TabList>
          <TabPanel value='upcoming' className='pt-4 text-body-sm text-ink-2'>
            {text('Upcoming visits', 'الزيارات القادمة')}
          </TabPanel>
          <TabPanel value='past' className='pt-4 text-body-sm text-ink-2'>
            {text('Past visits', 'الزيارات السابقة')}
          </TabPanel>
        </Tabs>
      </Section>

      <Section title={text('Modal and toast', 'النافذة والإشعارات')}>
        <div className='flex flex-wrap gap-3'>
          <Button variant='secondary' onClick={() => setModalOpen(true)}>
            {text('Open modal', 'افتح النافذة')}
          </Button>
          <Button variant='secondary' onClick={() => notify.success(text('Appointment saved', 'تم حفظ الموعد'))}>
            {text('Success toast', 'إشعار نجاح')}
          </Button>
          <Button variant='secondary' onClick={() => notify.error(text('Could not save', 'تعذر الحفظ'))}>
            {text('Error toast', 'إشعار خطأ')}
          </Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={text('Confirm your visit', 'أكد زيارتك')}
          description={text('Tuesday at 10:00', 'الثلاثاء الساعة ١٠:٠٠')}
          footer={
            <>
              <Button variant='ghost' onClick={() => setModalOpen(false)}>
                {text('Not now', 'ليس الآن')}
              </Button>
              <Button onClick={() => notify.success(text('Confirmed', 'تم التأكيد'))}>{text('Confirm', 'تأكيد')}</Button>
            </>
          }
        >
          <Field label={text('Notes for the doctor', 'ملاحظات للطبيب')}>
            <Textarea rows={3} />
          </Field>
        </Modal>
      </Section>

      <Section title={text('Skeleton', 'الهيكل المؤقت')}>
        <SkeletonGroup className='flex items-center gap-4'>
          <Skeleton circle className='size-12' />
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-1/2' />
            <Skeleton className='h-3 w-1/3' />
          </div>
        </SkeletonGroup>
      </Section>

      <Section title={text('Empty state', 'الحالة الفارغة')}>
        <Card variant='flat'>
          <EmptyState
            icon={<CalendarDays />}
            title={text('No visits yet', 'لا توجد زيارات بعد')}
            description={text('When you book a visit, it will appear here.', 'عند حجز زيارة ستظهر هنا.')}
            action={<Button>{text('Find a doctor', 'ابحث عن طبيب')}</Button>}
          />
        </Card>
      </Section>
    </main>
  )
}
