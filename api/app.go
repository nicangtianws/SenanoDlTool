package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"strconv"
	"strings"

	homedir "github.com/mitchellh/go-homedir"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"himenosena.top/model"
	"himenosena.top/util"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	home, _ := homedir.Dir()
	dir := path.Join(home, "Documents", "SenanoDlTool")
	fmt.Printf("document path: %s", dir)
	model.InitDatabase(&dir)
	// 启动时将未完成的下载变更为暂停状态
	model.UpdateDownloadingToPaused()
	model.InitDownloadManager(ctx)
}

func (a *App) DomReady(ctx context.Context) {
	runtime.EventsOn(ctx, "openDirectoryDialog", func(optionalData ...any) {
		a.openDirectoryDialog()
	})
}

func (a *App) Shutdown(ctx context.Context) {
	// 关闭时将所有下载任务暂停
	model.PauseAll()
}

// openDirectoryDialog 打开选择文件夹对话框
func (a *App) openDirectoryDialog() {
	var err error
	downloadDir := model.SettingValue("saveDir")
	if strings.TrimSpace(downloadDir) == "" || !util.FileExists(downloadDir) {
		downloadDir, err = util.GetDownloadDir()
		if err != nil {
			downloadDir, err = os.UserHomeDir()
			if err != nil {
				log.Printf("获取用户主目录出错: %s", err.Error())
				return
			}
		}
	}
	dialogRes, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		DefaultDirectory:     downloadDir,
		Title:                "Select Save Folder",
		Filters:              nil,
		ShowHiddenFiles:      false,
		CanCreateDirectories: true,
	})
	if err != nil {
		return
	}
	// also called when canceled
	if dialogRes == "" {
		return
	}
	runtime.EventsEmit(a.ctx, "openDirectoryDialog_result", dialogRes)
}

// Save 保存下载任务
func (a *App) Save(params string) string {
	fileInfo := model.DlFile{}
	err := json.Unmarshal([]byte(params), &fileInfo)
	if err != nil {
		return ResultError("参数错误!")
	}

	err = model.Save(&fileInfo, a.ctx)
	if err != nil {
		return ResultError(fmt.Sprintf("保存失败：%s", err.Error()))
	}

	return ResultSuccess()
}

// List 查询下载任务列表
func (a *App) List(params string) string {
	fileInfo := model.DlFile{}
	err := json.Unmarshal([]byte(params), &fileInfo)
	if err != nil {
		return ResultError("参数错误!")
	}
	dlInfos, err := model.List(&fileInfo)
	if err != nil {
		return ResultError(fmt.Sprintf("查询失败：%s", err.Error()))
	}
	return ResultData(dlInfos)
}

// Get 查询下载任务
func (a *App) Get(params string) string {
	var fileInfo model.DlFile
	err := json.Unmarshal([]byte(params), &fileInfo)
	if err != nil {
		return ResultError("参数错误!")
	}
	id := fileInfo.Id
	if id == 0 {
		return ResultError("参数错误!")
	}
	dlInfo, err := model.Get(id)
	if err != nil {
		return ResultError(fmt.Sprintf("查询失败: %s", err.Error()))
	}
	return ResultData(dlInfo)
}

// Delete 删除下载任务
func (a *App) Delete(params string) string {
	var deleteVo model.DeleteVo
	err := json.Unmarshal([]byte(params), &deleteVo)
	if err != nil {
		return ResultMsg("参数错误!")
	}
	// log.Printf("params: %s", params)
	err = model.Delete(&deleteVo)
	if err != nil {
		return ResultError("删除失败！")
	}
	return ResultMsg("删除成功!")
}

// ParseUrl 从URL解析文件名和最终下载地址
func (a *App) ParseUrl(params string) string {
	url := strings.TrimSpace(params)
	name, err := util.GetFileNameFromURL(url)
	if err != nil {
		return ResultError(fmt.Sprintf("解析失败: %s", err.Error()))
	}
	finalUrl, err := util.GetFinalURLWithHead(url)
	if err != nil {
		return ResultError(fmt.Sprintf("解析失败: %s", err.Error()))
	}
	// 读取全局设置文件夹
	downloadDir := model.SettingValue("saveDir")
	if strings.TrimSpace(downloadDir) == "" {
		downloadDir, err = util.GetDownloadDir()
		if err != nil {
			downloadDir = ""
		}
	}
	// 读取全局设置线程
	threadNumber := model.SettingValue("threadNumber")
	tn, err := strconv.Atoi(threadNumber)
	if err != nil || tn < 1 {
		tn = 4
	}
	data := map[string]string{
		"name":         name,
		"finalUrl":     finalUrl,
		"sourceUrl":    url,
		"saveDir":      downloadDir, // 默认保存目录为Download目录
		"threadNumber": strconv.Itoa(tn),
	}
	return ResultData(data)
}

// Resume 恢复下载
func (a *App) Resume(params string) string {
	var fileInfo model.DlFile
	err := json.Unmarshal([]byte(params), &fileInfo)
	if err != nil {
		return ResultError("参数错误!")
	}
	id := fileInfo.Id
	if id == 0 {
		return ResultError("参数错误!")
	}

	err = model.Resume(id, a.ctx)
	if err != nil {
		return ResultError(fmt.Sprintf("下载启动失败: %s", err.Error()))
	}
	return ResultSuccess()
}

// Pause 暂停下载
func (a *App) Pause(params string) string {
	var fileInfo model.DlFile
	err := json.Unmarshal([]byte(params), &fileInfo)
	if err != nil {
		return ResultError("参数错误!")
	}
	id := fileInfo.Id
	if id == 0 {
		return ResultError("参数错误!")
	}

	err = model.Pause(id, a.ctx)
	if err != nil {
		return ResultError(fmt.Sprintf("下载暂停失败: %s", err.Error()))
	}
	return ResultSuccess()
}

// LoadSettings 加载设置
func (a *App) LoadSettings(params string) string {
	settings := model.SettingsList()
	return ResultData(settings)
}

// SettingUpdate 更新设置
func (a *App) SettingUpdate(params string) string {
	var settings []model.Setting
	// log.Printf("settings param: %s", params)
	err := json.Unmarshal([]byte(params), &settings)
	if err != nil {
		log.Printf("%s", err.Error())
		return ResultError("参数错误!")
	}
	for _, setting := range settings {
		model.SettingUpdate(&setting)
	}
	return ResultData(settings)
}
