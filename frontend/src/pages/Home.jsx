import React from 'react'
import Header from '../components/Header'
import HomeSectionNav from '../components/HomeSectionNav'
import SpecialityMenu from '../components/SpecialityMenu'
import TopDoctors from '../components/TopDoctors'
import Banner from '../components/Banner'

const Home = () => {
  return (
    <div className='overflow-x-hidden'>
      <Header />
      <HomeSectionNav />
      <SpecialityMenu />
      <TopDoctors />
      <Banner />
    </div>
  )
}

export default Home
