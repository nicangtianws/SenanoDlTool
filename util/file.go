package util

import (
	"os"
	"path"
)

func FileExists(filename string) bool {
	_, err := os.Stat(filename)
	return !os.IsNotExist(err)
}

func GetDownloadDir() (string, error) {
	dir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir = path.Join(dir, "Download")
	if !FileExists(dir) {
		err = os.Mkdir(dir, 0755)
		if err != nil {
			return "", err
		}
	}
	return dir, nil
}
