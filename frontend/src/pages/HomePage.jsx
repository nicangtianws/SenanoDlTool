import { useEffect, useState, useRef, useCallback } from 'react'
import { Container, Row, Col, Stack } from 'react-bootstrap'
import { ListGroup, Table, Button } from 'react-bootstrap'
import { Modal, Form, Spinner, ProgressBar } from 'react-bootstrap'
import { OverlayTrigger, Tooltip, ToastContainer } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { atom, useAtom, useAtomValue } from 'jotai'
import { settingsAtom, progressAtom, loadingGlobalAtom } from '../main'
import { getFileNameFromHeader } from '../utils/url-util'
import styled from 'styled-components'
import { ArrowClockwise, StopFill, PlayFill, Gear } from 'react-bootstrap-icons'
import GlobalBackdrop from '../components/GlobalBackdrop'
import { useMessage, MessageContainer } from '../hooks/UseMessage'
import { useNavigate } from 'react-router'
import { ToolBoxDiv, ToolIconSpan } from '../App'

import {
  Save,
  List,
  Delete,
  ParseUrl,
  Get,
  Resume,
  Pause,
} from '../../wailsjs/go/api/App'
import {
  EventsOn,
  EventsOff,
  EventsEmit,
  EventsOnce,
} from '../../wailsjs/runtime/runtime'

const OptIconSpan = styled.span`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: black;
  font-size: 16px;
  :hover {
    color: rgb(62, 198, 198);
  }
`
const TruncateTextSpan = styled.span`
  display: inline-block;
  max-width: ${(props) =>
    props.$maxtextwidth ? props.$maxtextwidth : '160px'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

function HomePage() {
  const navigate = useNavigate()
  // 加载动画
  const [loadingGlobal, setLoadingGlobal] = useAtom(loadingGlobalAtom)
  // 提示信息
  const { success, error, warning, info, addMessage } = useMessage()
  // 设置
  const settings = useAtomValue(settingsAtom)

  const [dlList, setDlList] = useState([])
  const [parsedUrl, setParsedUrl] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refresh, setRefresh] = useState(false)

  // 新增表单
  const formRef = useRef(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm()

  // 详情表单
  const { register: registerDetail, setValue: setValueDetail } = useForm()

  const [checkedRows, setCheckedRows] = useState([])

  const [currentRow, setCurrentRow] = useState({})

  const handleRefresh = () => {
    setRefresh(!refresh)
  }

  // 新增弹窗
  const [show, setShow] = useState(false)
  const handleClose = () => {
    setShow(false)
    setParsedUrl(false)
    setLoading(false)
    reset()
  }
  const handleShow = () => setShow(true)
  const onSubmit = async (data) => {
    const url = data.url
    if (!parsedUrl) {
      setLoading(true)
      ParseUrl(url)
        .then((response) => {
          const res = JSON.parse(response)
          if (res.code != 200) {
            error('Parse url failed: ' + res.message)
            return
          }
          // console.log('parsed url data: ', res)
          const data = res.data
          setValue('name', data.fileName)
          setValue('url', data.finalUrl)
          setValue('sourceUrl', data.sourceUrl)
          setValue('saveDir', data.saveDir)
          setParsedUrl(true)
        })
        .finally(() => {
          setLoading(false)
        })
      return
    }
    // e.preventDefault()
    // console.log('e', e.target)
    // const data = {...formData}
    // console.log('form data: ', data)
    Save(JSON.stringify(data))
      .then((response) => {
        const res = JSON.parse(response)
        // console.log('save res: ', res)
        if (res.code != 200) {
          // console.log('error: ', res.message)
          error(res.message)
          return
        }
        setShow(false)
        handleRefresh()
        info('Save Success!')
      })
      .finally(() => {
        setParsedUrl(false)
        setLoading(false)
        reset()
      })
  }

  // 表格行选中
  const checkAllRef = useRef(null)
  const handleTableRowChecked = (e) => {
    const targetId = e.target.id
    const value = parseInt(targetId)
    // console.log(e)
    // console.log('before checked rows: ', checkedRows)
    if (e.target.checked) {
      if (!checkedRows.includes(value)) {
        checkedRows.push(value)
        const newArr = [...checkedRows]
        setCheckedRows(newArr)
        if (newArr.length === dlList.length) {
          checkAllRef.current.checked = true
        }
      }
    } else {
      if (checkedRows.includes(value)) {
        const filtered = checkedRows.filter((item) => item !== value)
        setCheckedRows(filtered)
        if (filtered.length !== dlList.length) {
          checkAllRef.current.checked = false
        }
      }
    }
    // console.log('after checked rows: ', checkedRows)
  }
  const handleTableCheckedAll = (e) => {
    if (e.target.checked) {
      const allIds = dlList.map((item) => item.id)
      setCheckedRows(allIds)
    } else {
      setCheckedRows([])
    }
  }

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
    })
  }

  // 后端推送事件监听
  // 下载进度监听
  const [dlProgress, setDlProgress] = useAtom(progressAtom)
  useEffect(() => {
    const handler = (data) => {
      if (data.eventType === 'progress') {
        const { progressValue, dlFileId } = data.eventData
        const key = 'progress' + dlFileId
        // 使用函数更新避免闭包问题
        setDlProgress((prev) => ({
          ...prev,
          [key]: progressValue,
        }))
      } else if (data.eventType === 'completed') {
        handleRefresh()
      } else if (data.eventType === 'error') {
        handleRefresh()
      } else if (data.eventType === 'message') {
        const eventData = data.eventData
        addMessage({
          type: eventData.messageType,
          content: eventData.messageValue,
        })
      }
    }

    EventsOn('downloadEvent_result', handler)

    return () => {
      EventsOff('downloadEvent_result', handler)
    }
  }, [])

  // 详情弹窗
  const [detailDialogShow, setDetailDialogShow] = useState(false)
  const handleDetailDialogClose = (e) => {
    setDetailDialogShow(false)
  }
  const handleDetailDialogOpen = (e, item) => {
    Get(JSON.stringify(item)).then((response) => {
      const res = JSON.parse(response)
      if (res.code != 200) {
        // console.log('Get failed!')
        error(res.message)
        return
      }
      const data = res.data
      Object.keys(data).forEach((key) => {
        setValueDetail(key, data[key])
      })
      setDetailDialogShow(true)
    })
  }

  // 删除弹窗
  const [deleteDialogShow, setDeleteDialogShow] = useState(false)
  const handleDeleteDialogClose = (e) => {
    setDeleteDialogShow(false)
  }
  const handleDeleteDialogOpen = (e) => {
    if (checkedRows.length === 0) {
      // console.log('Select rows is empty!')
      warning('Select rows is empty!')
      return
    }
    setDeleteDialogShow(true)
  }
  const handleDelete = (e) => {
    Delete(
      JSON.stringify({ isDeleteFile: false, deleteIds: checkedRows }),
    ).then((response) => {
      const res = JSON.parse(response)
      if (res.code != 200) {
        // console.log('Delete failed!')
        error(res.message)
        return
      }
      setDeleteDialogShow(false)
      handleRefresh()
      checkAllRef.current.checked = false
      info('Deleted!')
    })
  }
  const handleDeleteWithFile = (e) => {
    Delete(JSON.stringify({ isDeleteFile: true, deleteIds: checkedRows })).then(
      (response) => {
        const res = JSON.parse(response)
        if (res.code != 200) {
          // console.log('Delete failed!')
          error(res.message)
          return
        }
        setDeleteDialogShow(false)
        handleRefresh()
        checkAllRef.current.checked = false
        info('Deleted!')
      },
    )
  }

  // 表格加载
  const ProgressTd = ({ dlStatus, progress, dlFile }) => {
    if (dlStatus === 0) {
      if (progress === 100) {
        return <span>Completed</span>
      }
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px' }}>
          <ProgressBar animated now={progress} />
          <OptIconSpan>
            <StopFill
              onClick={() => {
                Pause(JSON.stringify(dlFile)).then((response) => {
                  const res = JSON.parse(response)
                  if (res.code != 200) {
                    // console.log('Pause failed!')
                    error(res.message)
                    return
                  }
                  handleRefresh()
                  info('Pause Success!')
                })
              }}
            />
          </OptIconSpan>
        </div>
      )
    } else if (dlStatus === 1) {
      return (
        <OptIconSpan>
          Suspend&nbsp;
          <PlayFill
            onClick={() => {
              Resume(JSON.stringify(dlFile)).then((response) => {
                const res = JSON.parse(response)
                if (res.code != 200) {
                  // console.log('Resume failed!')
                  error(res.message)
                  return
                }
                handleRefresh()
                info('Resume Success!')
              })
            }}
          />
        </OptIconSpan>
      )
    } else if (dlStatus === 2) {
      return <span>Completed</span>
    } else {
      return (
        <OptIconSpan>
          Error&nbsp;
          <ArrowClockwise
            onClick={() => {
              Resume(JSON.stringify(dlFile)).then((response) => {
                const res = JSON.parse(response)
                if (res.code != 200) {
                  // console.log('ReTry failed!')
                  error(res.message)
                  return
                }
                handleRefresh()
                info('ReTry Success!')
              })
            }}
          />
        </OptIconSpan>
      )
    }
  }
  // 带提示的单元格
  const TruncatedCell = ({ content, maxTextWidth }) => {
    if (!content) return <td>-</td>
    return (
      <td>
        <OverlayTrigger
          placement="top"
          overlay={<Tooltip className="custom-tooltip-wide">{content}</Tooltip>}
        >
          <TruncateTextSpan $maxtextwidth={maxTextWidth}>
            {content}
          </TruncateTextSpan>
        </OverlayTrigger>
      </td>
    )
  }
  const dlTableTrs = dlList.map((item, index) => {
    return (
      <tr
        key={item.id}
        onDoubleClick={(e) => {
          handleDetailDialogOpen(e, item)
        }}
      >
        <td>
          <Form.Check
            type={'checkbox'}
            id={item.id}
            onChange={handleTableRowChecked}
            checked={checkedRows.includes(item.id)}
          />
        </td>
        <td>{index + 1}</td>
        <TruncatedCell content={item.name} maxTextWidth={'160px'} />
        <TruncatedCell content={item.url} maxTextWidth={'300px'} />
        <td>{item.saveDir}</td>
        <td style={{ minWidth: '120px' }}>
          <ProgressTd
            dlFile={item}
            dlStatus={item.dlStatus}
            progress={dlProgress['progress' + item.id]}
          />
        </td>
        <td>{item.fileSizeHuman}</td>
      </tr>
    )
  })
  const listDlInfos = (callback) => {
    List(JSON.stringify({}))
      .then((response) => {
        const res = JSON.parse(response)
        // console.log('list res', res)
        if (res.code != 200) {
          error(res.message)
          return
        }
        setDlList(res.data)
        const newProgress = { ...dlProgress }
        res.data.forEach((item) => {
          if (item.dlStatus === 0 && !dlProgress['progress' + item.id]) {
            newProgress['progress' + item.id] = item.percent
          }
        })
        // console.log('refresh progress: ', newProgress)
        setDlProgress(newProgress)
      })
      .finally(() => {
        // debugger
        callback()
      })
  }
  useEffect(() => {
    setLoadingGlobal(true)
    listDlInfos(() => {
      setLoadingGlobal(false)
    })
  }, [refresh])

  return (
    <div id="home">
      <Container fluid>
        <Row>
          <Col sm="12" md="12">
            <Stack direction="horizontal" gap={3}>
              <div className="p-2">
                <ToolBoxDiv>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShow(true)
                    }}
                  >
                    New
                  </Button>
                  <Button variant="danger" onClick={handleDeleteDialogOpen}>
                    Delete
                  </Button>
                </ToolBoxDiv>
              </div>
              <div className="p-2 ms-auto"></div>
              <div className="p-2">
                <ToolBoxDiv>
                  <ToolIconSpan>
                    <ArrowClockwise
                      onClick={() => {
                        handleRefresh()
                      }}
                    />
                  </ToolIconSpan>
                  <ToolIconSpan>
                    <Gear
                      onClick={() => {
                        // 跳转设置页面
                        navigate('/settings')
                      }}
                    />
                  </ToolIconSpan>
                </ToolBoxDiv>
              </div>
            </Stack>
          </Col>
        </Row>
        <Row>
          <Col sm="12" md="12">
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>
                    <Form.Check
                      ref={checkAllRef}
                      type={'checkbox'}
                      id={'table-checked-all'}
                      onChange={handleTableCheckedAll}
                      disabled={dlList.length === 0}
                    />
                  </th>
                  <th>#</th>
                  <th>Name</th>
                  <th>Url</th>
                  <th>Save Dir</th>
                  <th>DlStatus</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>{dlTableTrs}</tbody>
            </Table>
          </Col>
        </Row>
      </Container>

      {/** 全局加载遮罩层 */}
      <GlobalBackdrop active={loadingGlobal} />

      {/** 提示信息弹窗 */}
      <MessageContainer />

      {/** 详情弹窗 */}
      <Modal show={detailDialogShow} onHide={handleDetailDialogClose}>
        <Modal.Header closeButton>
          <Modal.Title>Detail</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3" controlId="currentRow.name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                name="name"
                type="text"
                placeholder=""
                readOnly
                {...registerDetail('name')}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="currentRow.saveDir">
              <Form.Label>Save dir</Form.Label>
              <Form.Control
                name="saveDir"
                type="text"
                placeholder=""
                readOnly
                {...registerDetail('saveDir')}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="currentRow.fullPath">
              <Form.Label>Full path</Form.Label>
              <Form.Control
                name="fullPath"
                type="text"
                placeholder=""
                readOnly
                {...registerDetail('fullPath')}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="currentRow.sourceUrl">
              <Form.Label>Source url</Form.Label>
              <Form.Control
                name="sourceUrl"
                type="text"
                placeholder=""
                readOnly
                {...registerDetail('sourceUrl')}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="currentRow.url">
              <Form.Label>Url</Form.Label>
              <Form.Control
                name="url"
                type="text"
                placeholder=""
                readOnly
                {...registerDetail('url')}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleDetailDialogClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/** 删除弹窗 */}
      <Modal show={deleteDialogShow} onHide={handleDeleteDialogClose}>
        <Modal.Header closeButton>
          <Modal.Title>Are you ok?</Modal.Title>
        </Modal.Header>
        <Modal.Body>Please ensure delete checked rows!</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleDeleteDialogClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleDelete}>
            Delete
          </Button>
          <Button variant="danger" onClick={handleDeleteWithFile}>
            Delete with file
          </Button>
        </Modal.Footer>
      </Modal>

      {/** 新增弹窗 */}
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Create</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form ref={formRef} id="form" onSubmit={handleSubmit(onSubmit)}>
            <Form.Group className="mb-3" controlId="form.urlInput">
              <Form.Label>Url</Form.Label>
              <Form.Control
                {...register('url', { required: 'Url is required' })}
                name="url"
                type="text"
                placeholder="Please input url"
              />
              <Form.Control
                {...register('sourceUrl')}
                name="sourceUrl"
                type="text"
                placeholder="Please input url"
                style={{ display: 'none' }}
              />
            </Form.Group>
            <Form.Group
              className="mb-3"
              controlId="form.nameInput"
              style={{
                display: parsedUrl ? 'inline' : 'none',
              }}
            >
              <Form.Label>Name</Form.Label>
              <Form.Control
                {...register('name')}
                name="name"
                type="text"
                placeholder="Please input filename"
              />
            </Form.Group>
            <Form.Group
              style={{
                display: parsedUrl ? 'inline' : 'none',
              }}
            >
              <Form.Label>Save Dir</Form.Label>
              <Form.Control
                {...register('saveDir')}
                name="saveDir"
                type="text"
                placeholder="Please choose a folder"
                readOnly
              />
              <Button variant="primary" onClick={handleFolderSelect}>
                Folder select
              </Button>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="form"
            style={{
              display: !loading ? 'inline' : 'none',
            }}
          >
            {parsedUrl ? 'Start' : 'Parse'}
          </Button>
          <Button
            variant="primary"
            disabled
            style={{
              display: !parsedUrl && loading ? 'inline' : 'none',
            }}
          >
            <Spinner
              as="span"
              animation="grow"
              size="sm"
              role="status"
              aria-hidden="true"
            />
            Loading...
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default HomePage
