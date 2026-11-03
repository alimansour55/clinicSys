import React, { useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { Button, EmptyState, Skeleton, SkeletonGroup, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { useAccountApi, useServerText } from '../components/account/accountUi'
import HubOverview from '../components/account/HubOverview'
import HealthTimeline from '../components/account/HealthTimeline'
import FamilyPanel from '../components/account/FamilyPanel'
import RemindersPanel from '../components/account/RemindersPanel'
import PassportPanel from '../components/account/PassportPanel'
import ProfilePanel from '../components/account/ProfilePanel'
import SecurityPanel from '../components/account/SecurityPanel'
import OnboardingGuide from '../components/account/OnboardingGuide'

const TABS = [
  { value: 'overview', label: 'Today' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'family', label: 'Family' },
  { value: 'passport', label: 'Health passport' },
  { value: 'profile', label: 'My details' },
  { value: 'security', label: 'Security' }
]

const NEW_ACCOUNT_DAYS = 7

const greetingKey = (hour) => {
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** The patient's personal health hub. It lives on /my-profile, so every existing link already leads here. */
const MyProfile = () => {
  const { userData, token, displayPersonName } = useContext(AppContext)
  const { t } = useLanguage()
  const say = useServerText()
  const api = useAccountApi()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [hub, setHub] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)

  const requested = searchParams.get('tab')
  const tab = TABS.some((item) => item.value === requested) ? requested : 'overview'

  const openTab = useCallback((next) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      params.set('tab', next)
      params.delete('welcome')
      return params
    }, { replace: true })
  }, [setSearchParams])

  const reload = useCallback(async () => {
    const data = await api('get', `/api/account/hub?tz=${new Date().getTimezoneOffset()}`)
    if (data.success) {
      setHub(data)
      setLoadError('')
    } else {
      setLoadError(data.message)
    }
    return data
  }, [api])

  useEffect(() => {
    if (!token) {
      navigate('/login?mode=login', { replace: true })
      return
    }
    reload().then((data) => {
      if (!data.success) return
      const ageDays = (Date.now() - new Date(data.createdAt).getTime()) / (24 * 3600 * 1000)
      const untouched = !data.onboarding?.completedAt && !data.onboarding?.dismissedAt
      if (searchParams.get('welcome') || (untouched && ageDays < NEW_ACCOUNT_DAYS && !guideAlreadyShown())) {
        markGuideShown()
        setGuideOpen(true)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the guide decision is made once per visit
  }, [token])

  if (loadError && !hub) {
    return (
      <main className='py-12'>
        <EmptyState
          title={t('We could not open your health space')}
          description={say(loadError)}
          action={<Button onClick={reload}>{t('Try again')}</Button>}
        />
      </main>
    )
  }

  if (!userData || !hub) {
    return (
      <main className='py-8'>
        <SkeletonGroup label={t('Loading...')}>
          <Skeleton className='mb-4 h-12 w-64' />
          <Skeleton className='mb-6 h-10 w-full max-w-xl' />
          <div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
            <Skeleton className='h-52 rounded-card' />
            <Skeleton className='h-52 rounded-card' />
          </div>
        </SkeletonGroup>
      </main>
    )
  }

  const firstName = String(displayPersonName(userData.name) || '').split(' ')[0]

  return (
    <main className='pt-6 pb-12'>
      <header className='mb-6 flex items-center gap-4'>
        <img src={userData.image} alt='' className='size-14 rounded-card bg-surface-sunken object-cover' />
        <div className='min-w-0'>
          <p className='text-body-sm text-ink-2'>{t(greetingKey(new Date().getHours()))}</p>
          <h1 dir='auto' className='truncate font-display text-display text-ink'>{firstName}</h1>
        </div>
      </header>

      <Tabs value={tab} onChange={openTab}>
        <TabList label={t('Your health space')} className='mb-6'>
          {TABS.map((item) => <Tab key={item.value} value={item.value}>{t(item.label)}</Tab>)}
        </TabList>
        <TabPanel value='overview'>
          <HubOverview userData={userData} hub={hub} reload={reload} onOpenTab={openTab} onOpenGuide={() => setGuideOpen(true)} />
        </TabPanel>
        <TabPanel value='timeline'><HealthTimeline members={hub.members} onChanged={reload} /></TabPanel>
        <TabPanel value='reminders'><RemindersPanel reminders={hub.reminders} members={hub.members} reload={reload} /></TabPanel>
        <TabPanel value='family'><FamilyPanel members={hub.members} reload={reload} /></TabPanel>
        <TabPanel value='passport'><PassportPanel userData={userData} hub={hub} reload={reload} /></TabPanel>
        <TabPanel value='profile'><ProfilePanel userData={userData} /></TabPanel>
        <TabPanel value='security'><SecurityPanel userData={userData} phoneVerified={hub.phoneVerified} reload={reload} /></TabPanel>
      </Tabs>

      {guideOpen && (
        <OnboardingGuide
          userData={userData}
          hub={hub}
          onOpenTab={openTab}
          onClose={() => {
            setGuideOpen(false)
            reload()
          }}
        />
      )}
    </main>
  )
}

export default MyProfile
