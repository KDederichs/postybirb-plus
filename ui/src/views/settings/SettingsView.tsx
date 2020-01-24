import React from 'react';
import { inject, observer } from 'mobx-react';
import { SettingsStore } from '../../stores/settings.store';
import SettingsService from '../../services/settings.service';
import { Settings } from '../../../../electron-app/src/settings/settings.interface';
import { Form, Collapse, Switch, Tooltip, InputNumber, Radio, Input } from 'antd';
import { UIStore } from '../../stores/ui.store';

interface Props {
  settingsStore?: SettingsStore;
  uiStore?: UIStore;
}

@inject('settingsStore', 'uiStore')
@observer
export default class SettingsView extends React.Component<Props> {
  private updateSetting(key: keyof Settings, value: any) {
    if (value === undefined || value === '' || value === null) return;
    SettingsService.updateSetting(key, value);
  }

  private exampleDimensionChange(value: number, height: number, width: number) {
    const percent = (100 - value) / 100;
    return (
      <span>
        A {height} x {width} image would be reduced down to a maximum of {percent * height} x{' '}
        {percent * width}.
      </span>
    );
  }

  render() {
    const settings = this.props.settingsStore!.settings;
    return (
      <Form layout="vertical">
        <Collapse bordered={false}>
          <Collapse.Panel header="Posting" key="1">
            <Form.Item label="Help Advertise Postybirb">
              <Tooltip
                title={
                  'Adds "Posted using Postybirb" to the end of descriptions for most websites.'
                }
              >
                <Switch
                  checked={settings.advertise}
                  onChange={value => this.updateSetting('advertise', value)}
                />
              </Tooltip>
            </Form.Item>
            <Form.Item label="Clear Queue on Failure">
              <Tooltip title="Clears the posting queue when a post fails.">
                <Switch
                  checked={settings.emptyQueueOnFailedPost}
                  onChange={value => this.updateSetting('emptyQueueOnFailedPost', value)}
                />
              </Tooltip>
            </Form.Item>
            <Form.Item label="Post Retries">
              <Tooltip title="# of times to try posting a submission if a failure happens.">
                <InputNumber
                  min={0}
                  max={5}
                  value={settings.postRetries}
                  onChange={value => this.updateSetting('postRetries', Math.max(0, Number(value)))}
                />
              </Tooltip>
            </Form.Item>
          </Collapse.Panel>
          <Collapse.Panel header="Autoscaling" key="autoscaling">
            <p>
              <em>PostyBirb converts .bmp, .tiff to JPEG or PNG (if opacity is detected).</em>
            </p>
            <Form.Item label="PNG">
              <p>
                <em>
                  If file size requirements cannot be met using PNG options, the image will be
                  converted to JPEG.
                </em>
              </p>
              <Form.Item
                label="Max Height / Width Reduction"
                extra={this.exampleDimensionChange(settings.maxPNGSizeCompression, 1000, 1000)}
              >
                <InputNumber
                  min={0}
                  max={99}
                  value={settings.maxPNGSizeCompression}
                  formatter={value => `${value}%`}
                  onChange={value =>
                    this.updateSetting('maxPNGSizeCompression', Math.max(0, Number(value)))
                  }
                />
              </Form.Item>
              <Form.Item
                label="Max Height / Width Reduction (For Images with Opacity)"
                extra={this.exampleDimensionChange(
                  settings.maxPNGSizeCompressionWithAlpha,
                  1000,
                  1000
                )}
              >
                <InputNumber
                  min={0}
                  max={99}
                  value={settings.maxPNGSizeCompressionWithAlpha}
                  formatter={value => `${value}%`}
                  onChange={value =>
                    this.updateSetting('maxPNGSizeCompressionWithAlpha', Math.max(0, Number(value)))
                  }
                />
              </Form.Item>
            </Form.Item>
            <Form.Item label="JPEG">
              <Form.Item
                label="Max Height / Width Reduction"
                extra={this.exampleDimensionChange(settings.maxJPEGSizeCompression, 1000, 1000)}
              >
                <InputNumber
                  min={0}
                  max={99}
                  value={settings.maxJPEGSizeCompression}
                  formatter={value => `${value}%`}
                  onChange={value =>
                    this.updateSetting('maxJPEGSizeCompression', Math.max(0, Number(value)))
                  }
                />
              </Form.Item>
              <Form.Item
                label="Max Image Quality Reduction"
                extra="Size reduction is attempted before quality reduction."
              >
                <InputNumber
                  min={0}
                  max={99}
                  value={settings.maxJPEGQualityCompression}
                  formatter={value => `${value}%`}
                  onChange={value =>
                    this.updateSetting('maxJPEGQualityCompression', Math.max(0, Number(value)))
                  }
                />
              </Form.Item>
            </Form.Item>
          </Collapse.Panel>
          <Collapse.Panel header="Display" key="2">
            <Form.Item label="Theme">
              <Radio.Group
                value={this.props.uiStore!.state.theme}
                onChange={value => this.props.uiStore!.changeTheme(value.target.value)}
              >
                <Radio.Button value="light">Light</Radio.Button>
                <Radio.Button value="dark">Dark</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Collapse.Panel>
          <Collapse.Panel header="Performance" key="3">
            <Form.Item label="Use hardware acceleration">
              <Switch
                disabled={/Linux/.test(navigator.platform)}
                checked={settings.useHardwareAcceleration}
                onChange={value => this.updateSetting('useHardwareAcceleration', value)}
              />
            </Form.Item>
          </Collapse.Panel>
          <Collapse.Panel header="Startup" key="4">
            <Form.Item label="Open PostyBirb on application startup">
              <Switch
                checked={settings.openOnStartup}
                onChange={value => this.updateSetting('openOnStartup', value)}
              />
            </Form.Item>
          </Collapse.Panel>
          <Collapse.Panel header="Performance" key="5">
            <Form.Item label="Use hardware acceleration (requires restart)">
              <Switch
                disabled={/Linux/.test(navigator.platform)}
                checked={settings.useHardwareAcceleration}
                onChange={value => this.updateSetting('useHardwareAcceleration', value)}
              />
            </Form.Item>
          </Collapse.Panel>
          <Collapse.Panel header="Remote" key="6">
            <p>
              Connect to a PostyBirb client over the internet.
              <br />
              <strong>
                Any changes to these settings will require you to refresh the application (ctrl+r or
                application restart).
              </strong>
            </p>
            <Form.Item label="URL">
              <Input
                placeholder={`https://localhost:${window.PORT}`}
                defaultValue={localStorage.getItem('REMOTE_URI') || ''}
                onBlur={({ target }) => localStorage.setItem('REMOTE_URI', target.value)}
              />
            </Form.Item>
            <Form.Item label="Authorization (You will need to get this from the other PostyBirb instance)">
              <Input
                placeholder={window.AUTH_ID}
                defaultValue={localStorage.getItem('REMOTE_AUTH') || ''}
                onBlur={({ target }) => localStorage.setItem('REMOTE_AUTH', target.value)}
              />
            </Form.Item>
          </Collapse.Panel>
        </Collapse>
      </Form>
    );
  }
}
