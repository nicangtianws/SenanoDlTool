package util

import (
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

func GetFinalURLWithHead(initialURL string) (string, error) {
	// 使用 http.Head 方法
	resp, err := http.Head(initialURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	finalURL := resp.Request.URL.String()
	return finalURL, nil
}

// GetFileNameFromURL 从 URL 中提取文件名。
// 优先从路径最后一段获取；若缺失或无扩展名，则从查询参数 file 或 download 中获取。
// 返回解码后的文件名（自动处理 %20 等百分号编码）。
func GetFileNameFromURL(rawURL string) (string, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("解析 URL 失败: %w", err)
	}

	// 1. 从路径中取最后一段
	fileName := path.Base(parsed.Path)
	// 若为空、为 "." 或 "/" 或没有扩展名（简单判断），尝试从查询参数获取
	if fileName == "" || fileName == "." || fileName == "/" || !strings.Contains(fileName, ".") {
		if q := parsed.Query().Get("file"); q != "" {
			fileName = q
		} else if q := parsed.Query().Get("download"); q != "" {
			fileName = q
		}
	}

	// 2. 解码百分号编码（如 %20 → 空格）
	decoded, err := url.QueryUnescape(fileName)
	if err != nil {
		// 解码失败则返回原始值（通常不会失败）
		return fileName, nil
	}
	return decoded, nil
}

// GetFileNameFromHeader 通过 HEAD 请求从 Content-Disposition 响应头获取文件名。
// 若获取失败或头不存在，则回退到 GetFileNameFromURL。
func GetFileNameFromHeader(rawURL string) (string, error) {
	client := &http.Client{
		Timeout: 10 * time.Second, // 建议设置超时
		// 默认自动跟随重定向（最多 10 次）
	}

	resp, err := client.Head(rawURL)
	if err != nil {
		return "", fmt.Errorf("HEAD 请求失败: %w", err)
	}
	defer resp.Body.Close()

	disposition := resp.Header.Get("Content-Disposition")
	if disposition != "" {
		if name := parseContentDisposition(disposition); name != "" {
			// 解码以防头部包含百分号编码（某些服务器会编码）
			decoded, err := url.QueryUnescape(name)
			if err == nil {
				return decoded, nil
			}
			return name, nil
		}
	}

	// 回退到 URL 提取
	return GetFileNameFromURL(rawURL)
}

// parseContentDisposition 解析 Content-Disposition 头部，优先获取 filename*（RFC 5987），其次 filename。
// 返回原始未解码的字符串（但会去除引号）。
func parseContentDisposition(disposition string) string {
	// 查找 filename*（支持编码）
	if idx := strings.Index(disposition, "filename*="); idx != -1 {
		start := idx + len("filename*=")
		end := strings.Index(disposition[start:], ";")
		if end == -1 {
			end = len(disposition) - start
		}
		part := strings.TrimSpace(disposition[start : start+end])
		part = strings.Trim(part, `"`)

		// 处理格式：UTF-8''%E4%BE%8B%E5%AD%90.pdf
		if strings.Contains(part, "''") {
			parts := strings.SplitN(part, "''", 2)
			if len(parts) == 2 {
				// 尝试解码第二部分（百分比编码）
				decoded, err := url.QueryUnescape(parts[1])
				if err == nil {
					return decoded
				}
				return parts[1]
			}
		}
		// 直接解码（可能是纯文件名）
		decoded, err := url.QueryUnescape(part)
		if err == nil {
			return decoded
		}
		return part
	}

	// 查找 filename=
	if idx := strings.Index(disposition, "filename="); idx != -1 {
		start := idx + len("filename=")
		end := strings.Index(disposition[start:], ";")
		if end == -1 {
			end = len(disposition) - start
		}
		part := strings.TrimSpace(disposition[start : start+end])
		part = strings.Trim(part, `"`)
		// 解码百分号编码
		decoded, err := url.QueryUnescape(part)
		if err == nil {
			return decoded
		}
		return part
	}

	return ""
}
