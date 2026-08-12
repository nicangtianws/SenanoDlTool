export function getFileNameFromUrl(url) {
  try {
    // 解析 URL
    const parsedUrl = new URL(url)
    // 获取路径部分，例如 /path/to/file.pdf
    const pathname = parsedUrl.pathname
    // 按 '/' 分割，取最后一段
    let fileName = pathname.split('/').pop()

    // 如果最后一段为空（例如路径以 / 结尾），或者没有扩展名，可降级处理
    if (!fileName || !fileName.includes('.')) {
      // 尝试从 search 参数中获取（例如 ?file=image.png）
      const fileParam =
        parsedUrl.searchParams.get('file') ||
        parsedUrl.searchParams.get('download')
      if (fileParam) fileName = fileParam
    }

    return decodeURIComponent(fileName) // 解码 %20 等特殊字符
  } catch (e) {
    // 如果 URL 不合法，使用备用方法
    return url.split('/').pop().split('?')[0].split('#')[0]
  }
}

export async function getFileNameFromHeader(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    const disposition = response.headers.get('content-disposition')

    if (disposition) {
      // 匹配 filename*=UTF-8''xxx 或 filename="xxx"
      const match = disposition.match(/filename\*?=([^;]+)/)
      if (match) {
        // 去除引号并解码
        let fileName = match[1].trim().replace(/^"|"$/g, '')
        // 处理 URL 编码（如 UTF-8''%E6%96%87%E4%BB%B6）
        if (fileName.includes("''")) {
          const parts = fileName.split("''")
          fileName = parts[1] || parts[0]
        }
        return decodeURIComponent(fileName)
      }
    }
    // 如果响应头没有，回退到 URL 提取
    return getFileNameFromUrl(url)
  } catch (e) {
    console.warn('无法获取响应头，使用 URL 提取', e)
    return getFileNameFromUrl(url)
  }
}
