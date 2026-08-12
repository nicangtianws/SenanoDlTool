import { useAtom } from 'jotai'
import { useEffect, useState, useCallback } from 'react'
import { settingsAtom } from '../main'
import {
  Container,
  Form,
  Row,
  Col,
  Stack,
  Button,
  FormControl,
} from 'react-bootstrap'
import { ToolBoxDiv, ToolIconSpan } from '../App'
import { ArrowLeftCircle } from 'react-bootstrap-icons'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'

import useMessage from '../hooks/UseMessage'

import { LoadSettings, SettingUpdate } from '../../wailsjs/go/api/App'
import { EventsOnce, EventsEmit } from '../../wailsjs/runtime/runtime'

export const SettingsPage = () => {
  const navigate = useNavigate()
  const { success, error, warning, info, addMessage } = useMessage()
  const [settings, setSettings] = useAtom(settingsAtom)
  const [refresh, setRefresh] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    trigger,
  } = useForm()

  // 选择文件夹
  const openFileDialog = useCallback((callback) => {
    EventsOnce('openDirectoryDialog_result', (data) => {
      // console.log('selected folder: ', data)
      callback(data)
    })
    EventsEmit('openDirectoryDialog')
  })

  const handleFolderSelect = (e) => {
    openFileDialog((folder) => {
      setValue('saveDir', folder)
      handleSubmit(onSubmit)()
    })
  }

  // useEffect(() => {
  //   settings.forEach((setting) => {
  //     setValue(setting.settingsKey, setting.settingsValue)
  //   })
  // })

  useEffect(() => {
    LoadSettings().then((response) => {
      // console.log('settings string: ', response)
      const res = JSON.parse(response)
      if (res.code != 200) {
        error(res.message)
        return
      }
      let newSettings = settings
      const data = res.data
      if (data && data.length > 0) {
        // 更新设置值
        newSettings = settings.map((setting) => {
          const d = data.find(
            (item) => item.settingsKey === setting.settingsKey,
          )
          return {
            ...setting,
            settingsValue: d.settingsValue || setting.settingsValue,
          }
        })
        setSettings(newSettings)
      }
      newSettings.forEach((setting) => {
        setValue(setting.settingsKey, setting.settingsValue)
      })
    })
  }, [refresh])

  const onSubmit = async (data) => {
    console.log('settings form data: ', data)
    console.log('settings: ', settings)
    const params = []
    const newSettings = settings.map((setting) => {
      const key = Object.keys(data).find((item) => item === setting.settingsKey)
      params.push({
        settingsKey: key,
        settingsValue: data[key] + '',
      })
      return {
        ...setting,
        settingsValue: data[key],
      }
    })
    console.log('settings new: ', newSettings)
    SettingUpdate(JSON.stringify(params)).then((response) => {
      const res = JSON.parse(response)
      if (res.code != 200) {
        error(res.message)
        return
      }
      setSettings(newSettings)
      console.log('save settings success')
    })
  }

  const settingsItems = settings.map((setting) => {
    if (setting.settingsType === 'DIRECTORY_SELECTOR') {
      setting.action = handleFolderSelect
    }
    if (setting.settingsType === 'SELECT') {
      const options = setting.options.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))
      return (
        <Form.Group
          key={setting.settingsKey}
          as={Row}
          className="mb-3"
          controlId={setting.settingsKey}
        >
          <Form.Label column md="2">
            {setting.settingsLabel}
          </Form.Label>
          <Col md="4">
            <Form.Select
              name="theme"
              {...register('theme', {
                onChange: () => {
                  handleSubmit(onSubmit)()
                },
              })}
              aria-label={setting.settingsLabel}
            >
              {options}
            </Form.Select>
          </Col>
        </Form.Group>
      )
    } else if (setting.settingsType === 'DIRECTORY_SELECTOR') {
      return (
        <Form.Group
          key={setting.settingsKey}
          as={Row}
          className="mb-3"
          controlId={setting.settingsKey}
        >
          <Form.Label column md="2">
            {setting.settingsLabel}
          </Form.Label>
          <Col md="8">
            <Form.Control
              {...register('saveDir')}
              name="saveDir"
              type="text"
              placeholder="Please choose a folder"
              readOnly
            />
          </Col>
          <Col md="2">
            <Button variant="primary" onClick={setting.action}>
              Folder select
            </Button>
          </Col>
        </Form.Group>
      )
    } else if (setting.settingsType === 'INPUT_NUMBER') {
      return (
        <Form.Group
          key={setting.settingsKey}
          as={Row}
          className="mb-3"
          controlId={setting.settingsKey}
        >
          <Form.Label column md="2">
            {setting.settingsLabel}
          </Form.Label>
          <Col md="4">
            <FormControl
              type="number"
              name="threadNumber"
              {...register('threadNumber', {
                valueAsNumber: true,
                min: { value: 1, message: '无效线程数' },
                max: { value: 128, message: '最大128个线程' },
                onBlur: (e) => {
                  trigger('threadNumber')
                  if (e.target.value < 1) {
                    setValue('threadNumber', 1)
                  } else if (e.target.value > 128) {
                    setValue('threadNumber', 128)
                  }
                  handleSubmit(onSubmit)()
                },
              })}
              isInvalid={!!errors.threadNumber}
            />
            {errors.threadNumber && (
              <Form.Control.Feedback type="invalid">
                {errors.threadNumber.message}
              </Form.Control.Feedback>
            )}
          </Col>
        </Form.Group>
      )
    }
  })

  return (
    <div id="settings">
      <Container fluid>
        <Row>
          <Col md={12}>
            <Stack direction="horizontal" gap={3}>
              <div className="p-2">
                <ToolBoxDiv>
                  <ToolIconSpan>
                    <ArrowLeftCircle
                      onClick={() => {
                        navigate('/')
                      }}
                    />
                  </ToolIconSpan>
                </ToolBoxDiv>
              </div>
              <div className="p-2 ms-auto"></div>
              <div className="p-2"></div>
            </Stack>
          </Col>
        </Row>
        <Row>
          <Col md={12}>
            <Form id="form" onSubmit={handleSubmit(onSubmit)}>
              {settingsItems}
            </Form>
          </Col>
        </Row>
      </Container>
    </div>
  )
}
