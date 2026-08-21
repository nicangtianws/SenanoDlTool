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
      // 更新设置值
      const data = res.data
      let showSettings = settings
      if (data && data.length > 0) {
        const newSettings = { ...settings }
        data.forEach((item) => {
          settings[item.settingsKey].value = item.settingsValue
        })
        setSettings(newSettings)
        showSettings = newSettings
      }
      Object.keys(showSettings).forEach((key) => {
        const setting = showSettings[key]
        if (setting.value) {
          setValue(setting.key, setting.value)
        } else if (
          setting.key !== 'proxyAddress' ||
          showSettings.proxyType.value === 'CUSTOM'
        ) {
          setValue(setting.key, setting.defaultValue || '')
        }
      })
    })
  }, [refresh])

  // 提交
  const onSubmit = async (data) => {
    // console.log('settings form data: ', data)
    // console.log('settings: ', settings)
    const params = []
    const newSettings = { ...settings }
    // 更新设置值
    Object.keys(data).forEach((key) => {
      // 当未选择自定义代理时清空代理地址
      if (key === 'proxyAddress' && data.proxyType !== 'CUSTOM') {
        newSettings.proxyAddress.value = ''
        params.push({
          settingsKey: key,
          settingsValue: '',
        })
      } else {
        newSettings[key].value = data[key]
        params.push({
          settingsKey: key,
          settingsValue: data[key] + '',
        })
      }
    })
    // console.log('settings new: ', newSettings)
    SettingUpdate(JSON.stringify(params)).then((response) => {
      const res = JSON.parse(response)
      if (res.code != 200) {
        error(res.message)
        return
      }
      setSettings(newSettings)
      // console.log('save settings success')
    })
  }

  const settingsItems = Object.keys(settings).map((key) => {
    const setting = settings[key]
    if (setting.type === 'DIRECTORY_SELECTOR') {
      setting.action = handleFolderSelect
    }
    if (setting.type === 'SELECT') {
      const options = setting.options.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))
      return (
        <Form.Group
          key={setting.key}
          as={Row}
          className="mb-3"
          controlId={setting.key}
        >
          <Form.Label column md="2">
            {setting.label}
          </Form.Label>
          <Col md="4">
            <Form.Select
              name="theme"
              {...register('theme', {
                onChange: () => {
                  handleSubmit(onSubmit)()
                },
              })}
              aria-label={setting.label}
            >
              {options}
            </Form.Select>
          </Col>
        </Form.Group>
      )
    } else if (setting.type === 'DIRECTORY_SELECTOR') {
      return (
        <Form.Group
          key={setting.key}
          as={Row}
          className="mb-3"
          controlId={setting.key}
        >
          <Form.Label column md="2">
            {setting.label}
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
    } else if (setting.type === 'INPUT_NUMBER') {
      const key = setting.key
      return (
        <Form.Group key={key} as={Row} className="mb-3" controlId={key}>
          <Form.Label column md="2">
            {setting.label}
          </Form.Label>
          <Col md="4">
            <Form.Control
              type="number"
              name={key}
              {...register(key, {
                valueAsNumber: true,
                min: { value: 1, message: 'Invalid!' },
                max: { value: 128, message: '128 max!' },
                onBlur: (e) => {
                  trigger(key)
                  if (e.target.value < 1) {
                    setValue(key, 1)
                  } else if (e.target.value > 128) {
                    setValue(key, 128)
                  }
                  handleSubmit(onSubmit)()
                },
              })}
              isInvalid={!!errors[key]}
            />
            {errors[key] && (
              <Form.Control.Feedback type="invalid">
                {errors[key].message}
              </Form.Control.Feedback>
            )}
          </Col>
        </Form.Group>
      )
    } else if (setting.type === 'INPUT_RADIO') {
      const key = setting.key
      const radios = setting.options.map((item) => {
        return (
          <Form.Check
            key={item.value}
            {...register(key, {
              onChange: () => {
                if (setting.key === 'proxyType' && item.value === 'CUSTOM') {
                  setValue('proxyAddress', settings.proxyAddress.defaultValue)
                }
                handleSubmit(onSubmit)()
              },
            })}
            inline
            label={item.label}
            name={key}
            type="radio"
            value={item.value}
            id={item.id}
          />
        )
      })
      return (
        <Form.Group key={key} as={Row} className="mb-3" controlId={key}>
          <Form.Label column md="2">
            {setting.label}
          </Form.Label>
          <Col md="8">
            <div className="mb-3">{radios}</div>
          </Col>
        </Form.Group>
      )
    } else if (setting.type === 'INPUT_TEXT') {
      const key = setting.key
      const disabled =
        settings.proxyType.value !== 'CUSTOM' && setting.key == 'proxyAddress'
      return (
        <Form.Group key={key} as={Row} className="mb-3" controlId={key}>
          <Form.Label column md="2">
            {setting.label}
          </Form.Label>
          <Col md="8">
            <Form.Control
              {...register(key, {
                ...setting.rules,
                onBlur: () => {
                  trigger(key)
                  handleSubmit(onSubmit)()
                },
              })}
              type="text"
              placeholder={setting.placeholder}
              isInvalid={!!errors[key]}
              disabled={disabled}
            />
            {errors[key] && (
              <Form.Control.Feedback type="invalid">
                {errors[key].message}
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
