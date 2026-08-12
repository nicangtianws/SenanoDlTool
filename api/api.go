package api

import "encoding/json"

// api response result definition
type Result[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

// api list response result definition
type PageResult[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    []T    `json:"data"`
}

func ResultSuccess() string {
	result := Result[string]{
		Code:    200,
		Message: "success",
		Data:    "",
	}
	jsonData, err := json.Marshal(result)
	if err != nil {
		return ""
	}
	return string(jsonData)
}

func ResultError(msg string) string {
	result := Result[string]{
		Code:    500,
		Message: msg,
		Data:    "",
	}
	jsonData, err := json.Marshal(result)
	if err != nil {
		return ""
	}
	return string(jsonData)
}

func ResultMsg(msg string) string {
	result := Result[string]{
		Code:    200,
		Message: msg,
		Data:    "",
	}
	jsonData, err := json.Marshal(result)
	if err != nil {
		return ""
	}
	return string(jsonData)
}

func ResultCodeMsg(code int, msg string) string {
	result := Result[string]{
		Code:    code,
		Message: msg,
		Data:    "",
	}
	jsonData, err := json.Marshal(result)
	if err != nil {
		return ""
	}
	return string(jsonData)
}

func ResultData[T any](data T) string {
	result := Result[T]{
		Code:    200,
		Message: "success",
		Data:    data,
	}
	jsonData, err := json.Marshal(result)
	if err != nil {
		return ""
	}
	return string(jsonData)
}

func ResultMsgData[T any](msg string, data T) string {
	result := Result[T]{
		Code:    200,
		Message: msg,
		Data:    data,
	}
	jsonData, err := json.Marshal(result)
	if err != nil {
		return ""
	}
	return string(jsonData)
}
