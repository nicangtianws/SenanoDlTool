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
  const [proxyType, setProxyType] = useState(0)

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
      if (data && data.length > 0) {
        const newSettings = {...settings}
        data.forEach((item) => {
          settings[item.settingsKey].value = item.settingsValue
        })
        setSettings(newSettings)
        Object.keys(newSettings).forEach((key) => {
          const setting = newSettings[key]
          setValue(setting.key, setting.value)
        })
      }
    })
  }, [refresh])

  const onSubmit = async (data) => {
    console.log('settings form data: ', data)
    console.log('settings: ', settings)
    const params = []
    const newSettings = {...settings} 
    // 更新设置值
    Object.keys(data).forEach((key) => {
      newSettings[key].value = data[key]
      params.push({
        settingsKey: key,
        settingsValue: data[key] + '',
      })
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

  let proxyInputBox = (<div></div>)
  if (proxyType === 2) {
    proxyInputBox = (
      <div>
        <Form.Group className="mb-3" controlId={'proxyAddress'}>
          <Form.Label>Proxy address</Form.Label>
          <Form.Control type="text" placeholder="Please input proxy adress" />
        </Form.Group>
      </div>
    )
  }

  const handleProxyTypeChange = (e) => {
    setProxyType(e.target.value)
  }

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
              <Form.Group
                key='proxy'
                as={Row}
                className="mb-3"
                controlId="proxy"
              >
                <Form.Label column md="2">
                  Proxy
                </Form.Label>
                <Col md="8">
                  <div className="mb-3">
                    <Form.Check
                      inline
                      label="No proxy"
                      name="proxyType"
                      type='radio'
                      value={0}
                      onChange={handleProxyTypeChange}
                    />
                    <Form.Check
                      inline
                      label="Fallow system"
                      name="proxyType"
                      type='radio'
                      value={1}
                      onChange={handleProxyTypeChange}
                    />
                    <Form.Check
                      inline
                      label="Custom"
                      name="proxyType"
                      type='radio'
                      value={2}
                      onChange={handleProxyTypeChange}
                    />
                  </div>
                  {proxyInputBox}
                </Col>
              </Form.Group>
            </Form>
          </Col>
        </Row>
      </Container>
    </div>
  )
}
