package model

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type EventData struct {
	EventType    string `json:"eventType"`    // 类型
	EventMessage string `json:"eventMessage"` // 信息
	EventData    any    `json:"eventData"`    // 数据
}

type Progress struct {
	DlFileId      int `json:"dlFileId"`
	ProgressValue int `json:"progressValue"`
}

type ProgressEvent struct {
	PartNum int  `json:"partNum"`
	Success bool `json:"success"`
}

// 多线程下载任务
type DownloadTask struct {
	ID        string
	DlFile    *DlFile
	FileParts *[]FilePart
	mu        sync.Mutex
	ctx       context.Context
	cancel    context.CancelFunc
	paused    bool
	cond      *sync.Cond
	wg        sync.WaitGroup
	progress  int    // 初始进度
	errorMsg  string // 错误信息
}

func NewDownloadTask(id string, dlFile *DlFile, fileParts *[]FilePart, appCtx context.Context, progress int) *DownloadTask {
	ctx, cancel := context.WithCancel(appCtx)
	task := &DownloadTask{
		ID:        id,
		DlFile:    dlFile,
		FileParts: fileParts,
		ctx:       ctx,
		cancel:    cancel,
		paused:    false,
		progress:  progress,
		errorMsg:  "",
	}
	task.cond = sync.NewCond(&task.mu)
	return task
}

// 下载管理器
type DownloadManager struct {
	tasks  map[string]*DownloadTask
	mu     sync.Mutex
	appCtx context.Context
}

func NewDownloadManager(appCtx context.Context) *DownloadManager {
	return &DownloadManager{
		tasks:  make(map[string]*DownloadTask),
		appCtx: appCtx,
	}
}

func (dm *DownloadManager) AddTask(id string, dlFile *DlFile, fileParts *[]FilePart, appCtx context.Context, progress int) *DownloadTask {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	task := NewDownloadTask(id, dlFile, fileParts, appCtx, progress)
	dm.tasks[id] = task
	return task
}

func (dm *DownloadManager) GetTask(id string) *DownloadTask {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	return dm.tasks[id]
}

func (dm *DownloadManager) PauseAll() {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	for _, task := range dm.tasks {
		task.paused = true
		task.Cancel()
	}
}

// 全局调用
var DM *DownloadManager

// 初始化下载管理器
func InitDownloadManager(appCtx context.Context) {
	DM = NewDownloadManager(appCtx)
}

// 启动下载任务
func (t *DownloadTask) Start() {
	t.wg.Go(func() {
		t.download()
	})
}

// 暂停下载任务
func (t *DownloadTask) Cancel() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.cancel()
}

func (t *DownloadTask) download() {
	DownloadFileByParts(t)
}

// 多线程分块下载（按已分块文件信息）
func DownloadFileByParts(task *DownloadTask) {
	dlFile := task.DlFile
	parts := task.FileParts
	ctx := DM.appCtx
	taskCtx := task.ctx
	cancel := task.cancel
	progress := task.progress

	log.Printf("Download completed: %d%%", progress*100/dlFile.PartNum)
	dlFile = task.DlFile

	dlUrl := dlFile.Url
	ua := SettingValue("userAgent")
	if strings.TrimSpace(ua) == "" {
		ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
	}
	// 多线程控制参数
	sem := make(chan struct{}, 4) // 并发控制，空结构类型不占用空间
	totalCount := dlFile.PartNum  // 统计总数
	var wg sync.WaitGroup         // 进度控制
	var successCount atomic.Int32 // 多线程计数，使用原子化操作
	var lastPercent int32 = -1    // 下载完成比例是否变化
	var mu sync.Mutex             // 保护 lastPercent

	file, err := os.OpenFile(dlFile.FullPath, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("文件：%s下载失败: %v", dlFile.Name, err)
		dlFile.DlStatus = 3
		dlFile.StatusMsg = err.Error()
		// 发送错误事件
		errorEvent := EventData{
			EventType: "error",
			EventData: Progress{
				DlFileId: dlFile.Id,
			},
		}
		runtime.EventsEmit(ctx, "downloadEvent_result", errorEvent)
		DB.Save(dlFile).Commit()
		return
	}
	defer file.Close()

	for _, part := range *parts {
		sem <- struct{}{}
		wg.Add(1)
		go func(p FilePart) {
			defer wg.Done()
			defer func() { <-sem }()

			select {
			case <-taskCtx.Done():
				log.Printf("Canceled download for file: %s, part: %d", dlFile.Name, p.PartNum)
				return
			default:
				// 下载分块文件
				err := downloadPartFile(file, dlUrl, ua, p.PartNum, p.StartByte, p.EndByte, taskCtx)
				if err != nil {
					// 下载失败
					cancel() // 取消其他协程
					log.Printf("File %s download failed: %v", dlFile.Name, err)
					task.errorMsg = err.Error()
					p.DlStatus = 2
					DB.Save(p).Commit()
				} else {
					// 下载成功
					p.DlStatus = 1
					log.Printf("File part status updated: %d - %d download successful", p.Id, p.PartNum)
					DB.Save(p).Commit()
					// 增加成功计数
					newCount := successCount.Add(1)
					// 计算百分比
					percent := (int(newCount) + progress) * 100 / totalCount
					// 只有百分比变化时才推送
					mu.Lock()
					if percent != int(lastPercent) {
						lastPercent = int32(percent)
						mu.Unlock()
						log.Printf("Update progress %d%%", percent)
						eventData := EventData{
							EventType: "progress",
							EventData: Progress{
								DlFileId:      dlFile.Id,
								ProgressValue: percent,
							},
						}
						runtime.EventsEmit(ctx, "downloadEvent_result", eventData)
					} else {
						mu.Unlock()
					}
				}
			}
		}(part)
	}

	// 等待所有下载完成
	wg.Wait()

	// 更新文件状态
	if IsAllComplete(dlFile.Id) {
		dlFile.DlStatus = 2
		DB.Save(dlFile).Commit()
		// 发送完成事件
		completeEvent := EventData{
			EventType: "completed",
			EventData: Progress{
				DlFileId: dlFile.Id,
			},
		}
		runtime.EventsEmit(ctx, "downloadEvent_result", completeEvent)
	} else {
		if !task.paused {
			dlFile.DlStatus = 3
			dlFile.StatusMsg = task.errorMsg
			DB.Save(dlFile).Commit()
			// 发送错误事件
			errorEvent := EventData{
				EventType: "error",
				EventData: Progress{
					DlFileId: dlFile.Id,
				},
			}
			runtime.EventsEmit(ctx, "downloadEvent_result", errorEvent)
		}
	}
}

func generateClient(proxyType int, proxyAddress string) (*http.Client, error) {
	var client *http.Client
	var err error
	// 使用系统代理
	switch proxyType {
	case 1:
		client = &http.Client{
			Transport: &http.Transport{
				Proxy: http.ProxyFromEnvironment,
			},
		}
	case 2:
		// 自定义代理地址
		if strings.TrimSpace(proxyAddress) != "" {
			// 创建代理
			proxy, err := url.Parse(proxyAddress)
			if err != nil {
				log.Printf("错误的代理地址: %s", proxyAddress)
				return nil, err
			}
			client = &http.Client{
				Transport: &http.Transport{
					Proxy: http.ProxyURL(proxy),
				},
			}
		} else {
			return nil, fmt.Errorf("错误的代理地址: %s", proxyAddress)
		}
	default:
		// 使用默认请求客户端
		client = http.DefaultClient
	}

	return client, err
}

// 下载文件块
func downloadPartFile(file *os.File, dlUrl, ua string, partNum int, start, end int64, ctx context.Context) error {
	// 初始化客户端
	var client *http.Client
	proxyType := SettingValue("proxyType")
	intProxyType, err := strconv.Atoi(proxyType)
	if err != nil {
		intProxyType = 0
	}
	proxyAddress := SettingValue("proxyAddress")
	client, err = generateClient(intProxyType, proxyAddress)

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, "GET", dlUrl, nil)
	if err != nil {
		return err
	}
	// 设置下载部分文件
	req.Header.Set("Range", fmt.Sprintf("bytes=%v-%v", start, end))
	if strings.TrimSpace(ua) != "" {
		req.Header.Set("User-Agent", ua)
	}

	// 执行请求
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 保存到文件
	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	log.Printf("Save file part %d: %d bytes\n", partNum, len(content))
	return save2file(file, int64(start), content)
}

// 写入目标文件
func save2file(file *os.File, start int64, content []byte) error {
	// bufWriter := bufio.NewWriter(file)

	_, err := file.Seek(start, 0)
	if err != nil {
		return err
	}

	_, err = file.Write(content)
	if err != nil {
		return err
	}
	return nil
}
