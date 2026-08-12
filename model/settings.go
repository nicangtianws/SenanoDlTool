package model

type Setting struct {
	SettingsKey   string `json:"settingsKey" gorm:"primaryKey"`
	SettingsValue string `json:"settingsValue"`
}

func SettingUpdate(setting *Setting) {
	DB.Save(setting)
}

func SettingsList() []Setting {
	var settings []Setting
	DB.Find(&settings)
	return settings
}

func SettingValue(key string) string {
	var setting Setting
	DB.Where(&Setting{SettingsKey: key}).Find(&setting)
	return setting.SettingsValue
}
