import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { Alert } from 'react-bootstrap'

const MessageContext = createContext(null)

/**
 * provider
 * 提供消息创建、删除等方法
 * @param {*} param0 
 * @returns 
 */
export function MessageProvider({
  children,
  defaultDuration = 3000,
  maxCount = 5,
}) {
  const [messages, setMessages] = useState([])

  // 添加消息
  const addMessage = useCallback(
    (options) => {
      const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const newMessage = {
        id,
        content: options.content,
        type: options.type || 'info',
        duration: options.duration ?? defaultDuration,
      }

      setMessages((prev) => {
        const updated = [...prev, newMessage]
        if (updated.length > maxCount) {
          return updated.slice(updated.length - maxCount)
        }
        return updated
      })

      return id
    },
    [defaultDuration, maxCount],
  )

  // 删除消息
  const removeMessage = useCallback((id) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id))
  }, [])

  // 清空所有
  const clearAll = useCallback(() => {
    setMessages([])
  }, [])

  // 快捷方法
  const success = useCallback(
    (content, duration) => addMessage({ content, type: 'success', duration }),
    [addMessage],
  )
  const error = useCallback(
    (content, duration) => addMessage({ content, type: 'danger', duration }),
    [addMessage],
  )
  const warning = useCallback(
    (content, duration) => addMessage({ content, type: 'warning', duration }),
    [addMessage],
  )
  const info = useCallback(
    (content, duration) => addMessage({ content, type: 'info', duration }),
    [addMessage],
  )

  const api = {
    messages,
    addMessage,
    removeMessage,
    clearAll,
    success,
    error,
    warning,
    info,
  }

  return (
    <MessageContext.Provider value={api}>{children}</MessageContext.Provider>
  )
}

/**
 * 向外暴露hooks
 * 
 * @returns 
 */
export function useMessage() {
  const context = useContext(MessageContext)
  if (!context) {
    throw new Error('useMessage must be used within a MessageProvider')
  }
  return context
}


/**
 * 消息项
 * 使用bootstrap alert
 * hover可查看消息
 * 超时自动关闭
 * @param {*} param0 
 * @returns 
 */
function MessageItem({ message, onRemove }) {
  const timerRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const setTimer = useCallback(() => {
    clearTimer()
    timerRef.current = setTimeout(() => {
      onRemove(message.id)
    }, message.duration || 3000)
  }, [clearTimer, message.duration, message.id, onRemove])

  const handleMouseEnter = () => {
    setIsHovered(true)
    clearTimer()
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTimer()
  }

  useEffect(() => {
    setTimer()
    return clearTimer
  }, [setTimer, clearTimer])

  useEffect(() => {
    if (!isHovered) {
      setTimer()
    }
  }, [setTimer, isHovered])

  return (
    <Alert
      variant={message.type}
      dismissible
      onClose={() => onRemove(message.id)}
      className="mb-0 shadow-sm message-item"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {message.content}
    </Alert>
  )
}

/**
 * 消息容器
 * 右上角显示
 * @param {*} param0 
 * @returns 
 */
export function MessageContainer({ className = '', style = {} }) {
  const { messages, removeMessage } = useMessage()

  if (messages.length === 0) {
    return null
  }

  return (
    <div
      className={`message-container ${className}`}
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 420,
        width: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            pointerEvents: 'auto',
            animation: 'slideInRight 0.35s ease-out',
          }}
        >
          <MessageItem message={msg} onRemove={removeMessage} />
        </div>
      ))}
    </div>
  )
}

/**
 * 全局样式
 */
export const messageStyles = `
  @keyframes slideInRight {
    from {
      transform: translateX(calc(100% + 20px));
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .message-item {
    transition: all 0.3s ease;
    border-radius: 8px !important;
  }

  .message-container .alert {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
`

export default useMessage
