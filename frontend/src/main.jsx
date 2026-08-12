import React from 'react'
import { createRoot } from 'react-dom/client'
{
  /* The following line can be included in your src/index.js or App.js file */
}
import 'bootstrap/dist/css/bootstrap.min.css'
import './style.css'
import App from './App'
import { atom } from 'jotai'
import { MessageProvider, messageStyles } from './hooks/UseMessage'

// 设置 全局状态
export const settingsAtom = atom([
  {
    settingsLabel: 'Theme',
    settingsKey: 'theme',
    settingsType: 'SELECT',
    settingsValue: 'LIGHT',
    options: [
      {
        label: 'LIGHT',
        value: 'LIGHT',
      },
      {
        label: 'DARK',
        value: 'DARK',
      },
    ],
  },
  {
    settingsLabel: 'Save Dir',
    settingsKey: 'saveDir',
    settingsValue: '',
    settingsType: 'DIRECTORY_SELECTOR',
    options: [],
  },
  {
    settingsLabel: 'Thread Number',
    settingsKey: 'threadNumber',
    settingsValue: 4,
    settingsType: 'INPUT_NUMBER',
    options: [],
  },
])

export const statusAtom = atom({})
export const progressAtom = atom({})
export const loadingGlobalAtom = atom(false)

// 提示信息样式
const styleEl = document.createElement('style')
styleEl.textContent = messageStyles
document.head.appendChild(styleEl)

const container = document.getElementById('root')

const root = createRoot(container)

root.render(
  <React.StrictMode>
    <MessageProvider defaultDuration={3000} maxCount={5}>
      <App />
    </MessageProvider>
  </React.StrictMode>,
)
