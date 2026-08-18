package model

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"himenosena.top/util"
)

type DlFile struct {
	gorm.Model
	Id            int    `json:"id" gorm:"unique;primaryKey;autoIncrement"`
	Name          string `json:"name"`          // 文件名
	Url           string `json:"url"`           // 目标链接
	SourceUrl     string `json:"sourceUrl"`     // 来源链接
	SaveDir       string `json:"saveDir"`       // 存储路径
	FullPath      string `json:"fullPath"`      // 全路径
	FileStatus    int    `json:"fileStatus"`    // 文件状态 0. 正常 1. 已删除
	DlStatus      int    `json:"dlStatus"`      // 下载状态 0. 正在下载 1. 已暂停 2. 已完成 3. 下载失败
	StatusMsg     string `json:"statusMsg"`     // 状态信息
	FileSize      int64  `json:"fileSize"`      // 大小
	FileSizeHuman string `json:"fileSizeHuman"` // 格式化显示大小
	ThreadNumber  int    `json:"threadNumber"`  // 线程数
	PartNum       int    `json:"partNum"`       // 分块数
}

type FilePart struct {
	gorm.Model
	Id         int    `json:"id" gorm:"unique;primaryKey;autoIncrement"`
	DlFileId   int    `json:"dlFileId"`   // 下载文件信息
	PartNum    int    `json:"partNum"`    // 分块号
	PartSize   int64  `json:"partSize"`   // 分块大小
	PartRegion string `json:"partRegion"` // 分块区域大小
	StartByte  int64  `json:"startByte"`  // 开始字节
	EndByte    int64  `json:"endByte"`    // 结束字节
	DlStatus   int    `json:"dlStatus"`   // 块下载状态 0. 未完成 1. 已完成 2. 下载失败
}

func Save(fileInfo *DlFile, ctx context.Context) error {
	err := DB.Transaction(func(tx *gorm.DB) error {
		if !util.FileExists(fileInfo.SaveDir) {
			return errors.New("Wrong folder!")
		}
		filePath := filepath.Join(fileInfo.SaveDir, fileInfo.Name)
		fileInfo.FileStatus = 1
		fileInfo.DlStatus = 0
		fileInfo.FullPath = filePath
		if fileInfo.ThreadNumber > 128 {
			fileInfo.ThreadNumber = 128
		}
		if fileInfo.ThreadNumber < 1 {
			fileInfo.ThreadNumber = 4
		}

		// 获取文件大小
		res, err := http.Head(fileInfo.Url)
		if err != nil {
			return err
		}
		contentLength := res.ContentLength
		fileInfo.FileSize = contentLength
		// 格式化大小
		fileSizeHuman := getFormatSize(contentLength)
		fileInfo.FileSizeHuman = fileSizeHuman
		DB.Save(&fileInfo)

		// 计算分块
		var fileParts []FilePart
		if len(res.Header["Accept-Ranges"]) != 0 && res.Header["Accept-Ranges"][0] == "bytes" {
			// 多线程分块
			fileParts, err = getFileParts(contentLength, fileInfo)
			if err != nil {
				return errors.New("Get file parts failed!")
			}
		} else {
			// 不支持多线程下载
			singlePart := FilePart{
				DlFileId:   fileInfo.Id,
				PartNum:    1,
				PartSize:   contentLength,
				PartRegion: fileSizeHuman,
				StartByte:  0,
				EndByte:    contentLength,
			}
			fileParts = append(fileParts, singlePart)
		}

		DB.CreateInBatches(fileParts, 100)
		fileInfo.PartNum = len(fileParts)
		DB.Save(&fileInfo)

		// 创建后台线程下载
		// go DownloadFileByParts(fileInfo, &fileParts, ctx)
		task := DM.AddTask(strconv.Itoa(fileInfo.Id), fileInfo, &fileParts, ctx, 0)
		task.Start()
		return nil
	})

	return err
}

// 文件大小格式化
func getFormatSize(contentLength int64) string {
	fileSizeHuman := strconv.FormatInt(contentLength, 10)
	if contentLength < 1 {
		fileSizeHuman = "UNKNOWN"
	} else {
		calcSize := float32(contentLength) / 1024
		if calcSize > 1 {
			fileSizeHuman = fmt.Sprintf("%.2fK", calcSize)
			calcSize = calcSize / 1024
			if calcSize > 1 {
				fileSizeHuman = fmt.Sprintf("%.2fM", calcSize)
				calcSize = calcSize / 1024
				if calcSize > 1 {
					fileSizeHuman = fmt.Sprintf("%.2fG", calcSize)
				}
			}
		} else {
			fileSizeHuman = fmt.Sprintf("%dB", contentLength)
		}
	}
	return fileSizeHuman
}

// 按数量分块
func getPartsByNum(contentLength int64, fileInfoId, partNum int) []FilePart {
	var fileParts []FilePart
	partSize := contentLength / int64(partNum)
	humanSize := getFormatSize(partSize)
	for i := range partNum {
		var singlePart FilePart
		if i == (partNum - 1) {
			startByte := partSize * int64(i)
			endByte := contentLength
			partSize = contentLength - startByte
			singlePart = FilePart{
				DlFileId:   fileInfoId,
				PartNum:    i,
				PartSize:   partSize,
				PartRegion: humanSize,
				StartByte:  startByte,
				EndByte:    endByte,
			}
		} else {
			startByte := partSize * int64(i)
			endByte := partSize * int64(i+1)
			singlePart = FilePart{
				DlFileId:   fileInfoId,
				PartNum:    i,
				PartSize:   partSize,
				PartRegion: humanSize,
				StartByte:  startByte,
				EndByte:    endByte,
			}
		}

		fileParts = append(fileParts, singlePart)
	}
	return fileParts
}

// 按大小分块
func getPartsBySize(partSize, contentLength int64, fileInfoId int) []FilePart {
	var fileParts []FilePart
	numParts := int(contentLength / partSize)
	if contentLength%partSize != 0 {
		numParts++
	}
	for i := 0; i < numParts; i++ {
		startByte := partSize * int64(i)
		endByte := partSize * int64(i+1)
		singlePart := FilePart{
			DlFileId:   fileInfoId,
			PartNum:    i,
			PartSize:   partSize,
			PartRegion: "100M",
			StartByte:  startByte,
			EndByte:    endByte,
		}
		fileParts = append(fileParts, singlePart)
	}
	return fileParts
}

// 分块主逻辑
func getFileParts(contentLength int64, fileInfo *DlFile) ([]FilePart, error) {
	var fileParts []FilePart
	if contentLength < 1024 {
		// <1K单线程下载
		singlePart := FilePart{
			DlFileId:   fileInfo.Id,
			PartNum:    1,
			PartSize:   contentLength,
			PartRegion: "1K",
			StartByte:  0,
			EndByte:    contentLength,
		}
		fileParts = append(fileParts, singlePart)
	} else {
		// 分为128块
		fileParts = getPartsByNum(contentLength, fileInfo.Id, 128)
	}
	return fileParts, nil
}

type DlList struct {
	Id            int    `json:"id"`
	Name          string `json:"name"`
	Url           string `json:"url"`
	SaveDir       string `json:"saveDir"`
	DlStatus      int    `json:"dlStatus"`
	FileSizeHuman string `json:"fileSizeHuman"`
	PartNum       int    `json:"partNum"`
	CompletedNum  int    `json:"completedNum"`
	Percent       int    `json:"percent"`
}

func List(fileInfo *DlFile) ([]DlList, error) {
	dlFiles, err := gorm.G[DlList](DB).Raw(`
		select 
			f.id,
			f.name,
			f.url,
			f.save_dir,
			f.file_size,
			f.dl_status,
			f.file_size_human,
			f.part_num,
			(select count(*) from file_parts p where p.dl_file_id = f.id and p.dl_status = 1) as completed_num
		from dl_files f
	`).Find(context.Background())

	list := []DlList{}
	for _, dlFile := range dlFiles {
		if dlFile.DlStatus == 0 {
			percent := int(dlFile.CompletedNum) * 100 / dlFile.PartNum
			dlFile.Percent = percent
		}
		list = append(list, dlFile)
	}

	return list, err
}

func Get(id int) (DlFile, error) {
	dlFIle := DlFile{}
	DB.Model(&DlFile{}).Where("id = ?", id).Find(&dlFIle)
	return dlFIle, nil
}

type DeleteVo struct {
	DeleteIds    []int `json:"deleteIds"`
	IsDeleteFile bool  `json:"isDeleteFile"`
}

// 删除
func Delete(deleteVo *DeleteVo) error {
	deleteIds := deleteVo.DeleteIds
	var deletedFiles []DlFile
	DB.Transaction(func(tx *gorm.DB) error {
		for _, id := range deleteIds {
			var deletedParts []FilePart
			tx.Unscoped().Where(&FilePart{DlFileId: id}).Delete(&deletedParts)
		}
		tx.Unscoped().Clauses(clause.Returning{}).Delete(&deletedFiles, deleteIds)

		// 删除文件
		if deleteVo.IsDeleteFile {
			go func(files []DlFile) {
				for _, f := range files {
					fullPath := f.FullPath
					if !util.FileExists(fullPath) {
						log.Printf("File not exists: %s\n", fullPath)
						continue
					}
					err := os.Remove(fullPath)
					if err != nil {
						log.Printf("Delete file failed: %s\n", fullPath)
						continue
					}
					log.Printf("Delete file success: %s\n", fullPath)
				}
			}(deletedFiles)
		}

		return nil
	})
	return nil
}

func Resume(id int, ctx context.Context) error {
	fileInfo := DlFile{}
	DB.Model(&DlFile{}).Where("id = ?", id).Find(&fileInfo)
	if fileInfo.Id == 0 {
		return errors.New("Not Found!")
	}

	fileInfo.DlStatus = 0
	fileParts := []FilePart{}
	DB.Model(&FilePart{}).Where("dl_file_id = ? and dl_status IN (?)", fileInfo.Id, []int{0, 2}).Find(&fileParts)
	DB.Save(fileInfo)
	// go DownloadFileByParts(&fileInfo, &fileParts, ctx)
	task := DM.AddTask(strconv.Itoa(fileInfo.Id), &fileInfo, &fileParts, ctx, fileInfo.PartNum-len(fileParts))
	task.Start()
	return nil
}

func Pause(id int, ctx context.Context) error {
	fileInfo := DlFile{}
	DB.Model(&DlFile{}).Where("id = ?", id).Find(&fileInfo)
	if fileInfo.Id == 0 {
		return errors.New("Not Found!")
	}
	fileInfo.DlStatus = 1
	DB.Save(fileInfo).Commit()
	task := DM.GetTask(strconv.Itoa(id))
	task.paused = true
	task.Cancel()
	return nil
}

func PauseAll() {
	DB.Model(&DlFile{}).Where("dl_status = ?", 0).Update("dl_status", 1)
	DM.PauseAll()
}

func IsAllComplete(id int) bool {
	fileInfo := DlFile{}
	DB.Model(&DlFile{}).Where("id = ?", id).Find(&fileInfo)
	var completedNum int64
	DB.Model(&FilePart{}).Where("dl_status = 1 and dl_file_id = ?", id).Count(&completedNum)
	return completedNum == int64(fileInfo.PartNum)
}

func UpdateDownloadingToPaused() {
	DB.Model(&DlFile{}).Where("dl_status = ?", 0).Update("dl_status", 1)
}
