import React from 'react'
import Header from '../components/Header'
import SpecialityMenu from '../components/SpecialityMenu'
import TopDoctors from '../components/TopDoctors'
import Banner from '../components/Banner'
import HomeMobileDock from '../components/HomeMobileDock'

const Home = () => {
  return (
    <div className='overflow-x-hidden pb-2'>
      <Header />
      <SpecialityMenu />
      <TopDoctors />
      <Banner />
      <HomeMobileDock />
    </div>
  )
}

export default Home
