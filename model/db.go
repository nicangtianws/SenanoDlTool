package model

import (
	"fmt"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"himenosena.top/util"
)

var DB *gorm.DB

const DB_FILE = "DlFile.db"

// 初始化数据库
func InitDatabase(basedir *string) {
	if !util.FileExists(*basedir) {
		err := os.Mkdir(*basedir, 0744)
		if err != nil {
			fmt.Printf("Init db failed: %s", err.Error())
			return
		}
	}

	dbpath := filepath.Join(*basedir, DB_FILE)
	var err error
	DB, err = gorm.Open(sqlite.Open(dbpath), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	DB.AutoMigrate(&DlFile{})
	DB.AutoMigrate(&FilePart{})
	DB.AutoMigrate(&Setting{})

	// InitSettings()
}
