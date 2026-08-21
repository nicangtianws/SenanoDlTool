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
    label: '主题',
    key: 'theme',
    type: 'SELECT',
    value: 'LIGHT',
    options: [
      {
        id: 'light',
        label: '明亮',
        value: 'LIGHT',
      },
      {
        id: 'dark',
        label: '黑暗',
        value: 'DARK',
      },
    ],
  },
  saveDir: {
    label: '保存路径',
    key: 'saveDir',
    value: '',
    type: 'DIRECTORY_SELECTOR',
    placeholder: '请选择文件夹！',
    options: [],
  },
  threadNumber: {
    label: '线程数',
    key: 'threadNumber',
    value: 4,
    type: 'INPUT_NUMBER',
    options: [],
  },
  proxyType: {
    label: '代理方式',
    key: 'proxyType',
    value: 'NO_PROXY',
    type: 'INPUT_RADIO',
    options: [
      {
        id: 'no-proxy',
        label: '无',
        value: 'NO_PROXY',
      },
      {
        id: 'follow-system',
        label: '跟随系统',
        value: 'FOLLOW_SYSTEM',
      },
      {
        id: 'custom',
        label: '自定义',
        value: 'CUSTOM',
      },
    ],
  },
  proxyAddress: {
    label: '代理地址',
    key: 'proxyAddress',
    value: '',
    type: 'INPUT_TEXT',
    placeholder: '请输入代理地址!',
    rules: {
      minLength: { value: 9, message: 'Too short!' },
      maxLength: { value: 21, message: 'Too long!' },
    },
    defaultValue: '127.0.0.1:10808',
    options: [],
  },
  userAgent: {
    label: '自定义UA',
    key: 'userAgent',
    value: '',
    type: 'INPUT_TEXT',
    placeholder: '请输入User agent!',
    rules: {
      maxLength: { value: 500, message: 'Too long!' },
    },
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
