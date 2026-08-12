package util

import (
	"context"

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
	DlFileId int  `json:"dlFileId"`
	PartNum  int  `json:"partNum"`
	Success  bool `json:"success"`
}

type DlEvent struct {
	ctx context.Context
}

func (d *DlEvent) ErrorEvent(dlFileId int) {
	errorEvent := EventData{
		EventType: "error",
		EventData: Progress{
			DlFileId: dlFileId,
		},
	}
	runtime.EventsEmit(d.ctx, "downloadEvent_result", errorEvent)
}
