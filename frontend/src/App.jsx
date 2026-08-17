import { useAtom, useAtomValue } from 'jotai'
import './App.css'
import GlobalBackdrop from './components/GlobalBackdrop'
import { MessageContainer } from './hooks/UseMessage'
import HomePage from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'
import { useState, useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { loadingGlobalAtom, settingsAtom } from './main'
import styled from 'styled-components'

import { LoadSettings } from '../wailsjs/go/api/App'

export const ToolBoxDiv = styled.div`
  display: flex;
  gap: 10px;
`
export const ToolIconSpan = styled.span`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50px;
  height: 50px;
  color: black;
  font-size: 24px;
  :hover {
    color: rgb(62, 198, 198);
  }
`

function App() {
  const [settings, setSettings] = useAtom(settingsAtom)
  useEffect(() => {
    LoadSettings().then((response) => {
      // console.log('settings string: ', response)
      const res = JSON.parse(response)
      if (res.code != 200) {
        error(res.message)
        return
      }
      // 更新设置值
      const data = res.data
      if (data && data.length > 0) {
        const newSettings = {...settings}
        data.forEach((item) => {
          settings[item.settingsKey].value = item.settingsValue
        })
        setSettings(newSettings)
        // console.log('load settings', newSettings)
      }
    })
  }, [])

  const loadingGlobal = useAtomValue(loadingGlobalAtom)

  const router = createBrowserRouter([
    {
      path: '/',
      Component: HomePage,
    },
    {
      path: '/home',
      Component: HomePage,
    },
    {
      path: '/settings',
      Component: SettingsPage,
    },
  ])

  return (
    <div id="app">
      {/** 全局加载遮罩层 */}
      <GlobalBackdrop active={loadingGlobal} />

      {/** 提示信息弹窗 */}
      <MessageContainer />
      <RouterProvider router={router} />
    </div>
  )
}

export default App
