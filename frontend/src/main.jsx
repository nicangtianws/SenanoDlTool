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
export const settingsAtom = atom({
  theme: {
    label: 'Theme',
    key: 'theme',
    type: 'SELECT',
    value: 'LIGHT',
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
  saveDir: {
    label: 'Save Dir',
    key: 'saveDir',
    value: '',
    type: 'DIRECTORY_SELECTOR',
    options: [],
  },
  threadNumber: {
    label: 'Thread Number',
    key: 'threadNumber',
    value: 4,
    type: 'INPUT_NUMBER',
    options: [],
  },
  proxyType: {
    label: 'Proxy Type',
    key: 'proxyType',
    value: 'NO_PROXY',
    type: 'INPUT_RADIO',
    options: [
      {
        label: 'No Proxy',
        value: 'NO_PROXY',
      },
      {
        label: 'Follow System',
        value: 'FOLLOW_SYSTEM',
      },
      {
        label: 'Custom',
        value: 'CUSTOM',
      },
    ],
  },
  proxyAddress: {
    label: 'Proxy Address',
    key: 'proxyAddress',
    value: '',
    type: 'INPUT_TEXT',
    placeholder: 'Please input proxy address!',
    rules: {
      minLength: { value: 9, message: 'Too short!' },
      maxLength: { value: 21, message: 'Too long!' },
    },
    defaultValue: '127.0.0.1:10808',
    options: [],
  },
})

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
