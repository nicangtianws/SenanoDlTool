// components/GlobalBackdrop.jsx
import { useEffect } from 'react'
import { Spinner } from 'react-bootstrap'

/**
 * 带滚动锁定的全局遮罩
 * @param {*} param0 
 * @returns 
 */
const GlobalBackdrop = ({ active }) => {
  useEffect(() => {
    if (active) {
      // 滚动锁定
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [active])

  if (!active) return null

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
      style={{
        zIndex: 9999, // 确保在最上层
        backgroundColor: 'rgba(0, 0, 0, 0.55)', // 半透明灰
        backdropFilter: 'blur(2px)', // 可选：毛玻璃效果
      }}
    >
      <div className="text-center text-white">
        <Spinner animation="border" variant="light" size="lg" />
        {/* <div className="mt-3 fw-semibold">加载中...</div> */}
      </div>
    </div>
  )
}

export default GlobalBackdrop
