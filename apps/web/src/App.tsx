import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Button, ConfigProvider, InputNumber, Segmented, Select, Tooltip } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeviceShadowSnapshot, RealtimeEvent } from '@moyan/contracts';
import {
  Activity,
  BatteryCharging,
  ChevronRight,
  CircleDot,
  Cloud,
  Cpu,
  Droplets,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Radio,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Wifi
} from 'lucide-react';
import { AssistantPanel } from './components/AssistantPanel';
import { MetricCard } from './components/MetricCard';
import type { TrendPoint } from './components/TrendChart';
import { api } from './lib/api';

const RoomScene = lazy(() => import('./components/RoomScene').then((module) => ({ default: module.RoomScene })));
const TrendChart = lazy(() => import('./components/TrendChart').then((module) => ({ default: module.TrendChart })));

const emptyMetrics: DeviceShadowSnapshot['reported'] = {
  temperature: null,
  humidity: null,
  luminance: null,
  distance: null,
  battery: null,
  lamp: 'UNKNOWN',
  mode: 'UNKNOWN'
};

function value(value: number | null, suffix: string, digits = 0): string {
  return value === null ? '--' : `${value.toFixed(digits)}${suffix}`;
}

function timeText(time: string | null | undefined): string {
  if (!time) return '--:--:--';
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

function Dashboard() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [history, setHistory] = useState<TrendPoint[]>([]);
  const [threshold, setThreshold] = useState<number | null>(28);
  const [streamState, setStreamState] = useState<'connecting' | 'live' | 'offline'>('connecting');

  const healthQuery = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15_000 });
  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: api.devices, refetchInterval: 15_000 });
  const deviceList = devicesQuery.data?.data ?? [];

  useEffect(() => {
    if (!selectedDeviceId && deviceList[0]) setSelectedDeviceId(deviceList[0].deviceId);
  }, [deviceList, selectedDeviceId]);

  const shadowQuery = useQuery({
    queryKey: ['shadow', selectedDeviceId],
    queryFn: () => api.shadow(selectedDeviceId),
    enabled: Boolean(selectedDeviceId),
    refetchInterval: streamState === 'live' ? false : 5_000
  });

  const logsQuery = useQuery({
    queryKey: ['logs', selectedDeviceId],
    queryFn: () => api.logs(selectedDeviceId),
    enabled: Boolean(selectedDeviceId),
    refetchInterval: 4_000
  });

  useEffect(() => {
    if (!selectedDeviceId) return;
    const source = new EventSource(api.eventsUrl(selectedDeviceId));
    setStreamState('connecting');
    source.onopen = () => setStreamState('live');
    source.onerror = () => setStreamState('offline');
    const onShadow = (event: MessageEvent<string>) => {
      const realtime = JSON.parse(event.data) as RealtimeEvent<DeviceShadowSnapshot>;
      queryClient.setQueryData(['shadow', selectedDeviceId], {
        data: realtime.data,
        meta: {
          requestId: realtime.id,
          provider: healthQuery.data?.data.provider ?? 'mock',
          timestamp: realtime.createdAt
        }
      });
      setStreamState('live');
    };
    source.addEventListener('shadow.updated', onShadow as EventListener);
    return () => {
      source.removeEventListener('shadow.updated', onShadow as EventListener);
      source.close();
    };
  }, [healthQuery.data?.data.provider, queryClient, selectedDeviceId]);

  const shadow = shadowQuery.data?.data;
  const metrics = shadow?.reported ?? emptyMetrics;

  useEffect(() => {
    if (!shadow) return;
    setHistory((current) => {
      const time = timeText(shadow.observedAt);
      if (current.at(-1)?.time === time) return current;
      return [...current, { time, temperature: shadow.reported.temperature, humidity: shadow.reported.humidity }].slice(-18);
    });
  }, [shadow]);

  const commandMutation = useMutation({
    mutationFn: (command: Parameters<typeof api.command>[1]) => api.command(selectedDeviceId, command),
    onSuccess: async (result) => {
      message.success(`命令 ${result.data.commandName} 已执行`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shadow', selectedDeviceId] }),
        queryClient.invalidateQueries({ queryKey: ['logs', selectedDeviceId] })
      ]);
    },
    onError: (error) => message.error(error.message)
  });

  const desiredMutation = useMutation({
    mutationFn: () => api.updateDesired(selectedDeviceId, {
      serviceId: shadow?.serviceId,
      desired: { threshold: threshold ?? 28 },
      version: shadow?.version ?? undefined
    }),
    onSuccess: (result) => {
      queryClient.setQueryData(['shadow', selectedDeviceId], result);
      message.success('设备影子期望阈值已更新');
    },
    onError: (error) => message.error(error.message)
  });

  const refreshDeviceActivity = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['shadow', selectedDeviceId] }),
      queryClient.invalidateQueries({ queryKey: ['logs', selectedDeviceId] })
    ]);
  };

  const selectedDevice = deviceList.find((device) => device.deviceId === selectedDeviceId);
  const provider = healthQuery.data?.data.provider ?? 'mock';
  const logs = logsQuery.data?.data ?? [];
  const online = shadow?.status === 'ONLINE' || selectedDevice?.status === 'ONLINE';
  const statusLabel = streamState === 'live' ? '实时流已连接' : streamState === 'connecting' ? '正在连接实时流' : '实时流已断开';

  const airScore = useMemo(() => {
    if (metrics.temperature === null || metrics.humidity === null) return 0;
    const tempPenalty = Math.abs(metrics.temperature - 24) * 4;
    const humidityPenalty = Math.abs(metrics.humidity - 52) * 0.7;
    return Math.round(Math.max(42, Math.min(99, 96 - tempPenalty - humidityPenalty)));
  }, [metrics.humidity, metrics.temperature]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <div className="brand-mark__glyph"><Sparkles size={20} /></div>
          <div><strong>MOYAN</strong><span>SPACE OS</span></div>
        </div>

        <nav className="side-nav" aria-label="主导航">
          <span className="side-nav__caption">SPACE</span>
          <button className="side-nav__item active"><LayoutDashboard size={18} /><span>空间总览</span><i /></button>
        </nav>

        <div className="sidebar__system-card">
          <div className="sidebar__system-row"><span><Cloud size={14} /> IoTDA</span><b>{provider === 'mock' ? '模拟环境' : '华为云'}</b></div>
          <div className="sidebar__system-row"><span><ShieldCheck size={14} /> API</span><b className={healthQuery.data?.data.status === 'ok' ? 'ok' : 'warn'}>{healthQuery.data?.data.status === 'ok' ? '健康' : '检查中'}</b></div>
          <div className="sidebar__version">CORE / 0.1.0</div>
        </div>
      </aside>

      <main className="main-stage">
        <header className="topbar">
          <div>
            <span className="eyebrow">INTELLIGENT SPACE / LIVE</span>
            <h1>智慧空间控制台</h1>
          </div>
          <div className="topbar__actions">
            <Select
              className="device-select"
              value={selectedDeviceId || undefined}
              placeholder="选择设备"
              loading={devicesQuery.isLoading}
              onChange={setSelectedDeviceId}
              options={deviceList.map((device) => ({ label: device.deviceName, value: device.deviceId }))}
            />
            <Tooltip title="刷新设备影子">
              <Button
                className="icon-button"
                icon={<RefreshCw size={17} />}
                loading={shadowQuery.isFetching}
                onClick={() => shadowQuery.refetch()}
              />
            </Tooltip>
            <button className="operator-badge" aria-label="当前操作员">
              <span>OP</span><div><b>空间操作员</b><small>ADMIN</small></div><ChevronRight size={15} />
            </button>
          </div>
        </header>

        <section className="device-hero">
          <div className="device-hero__identity">
            <div className={`status-orbit ${online ? 'online' : ''}`}><Cpu size={22} /></div>
            <div>
              <div className="device-hero__name-row">
                <h2>{selectedDevice?.deviceName ?? '正在载入设备'}</h2>
                <span className={`status-pill ${online ? 'online' : ''}`}><i />{online ? 'ONLINE' : 'OFFLINE'}</span>
              </div>
              <p>{selectedDeviceId || '等待设备'} · 服务 {shadow?.serviceId ?? 'smartRoom'} · 更新于 {timeText(shadow?.observedAt)}</p>
            </div>
          </div>
          <div className="live-status"><Radio size={15} /><span>{statusLabel}</span><b>{provider.toUpperCase()}</b></div>
        </section>

        <section className="metrics-grid" aria-label="实时环境指标">
          <MetricCard icon={<Thermometer />} label="环境温度" value={value(metrics.temperature, '°C', 1)} detail="舒适区 22—26°C" tone="cyan" progress={metrics.temperature ? metrics.temperature * 2.8 : 0} />
          <MetricCard icon={<Droplets />} label="相对湿度" value={value(metrics.humidity, '%', 1)} detail="建议区间 40—65%" tone="violet" progress={metrics.humidity ?? 0} />
          <MetricCard icon={<Lightbulb />} label="空间光照" value={value(metrics.luminance, ' lx')} detail={metrics.lamp === 'ON' ? '主灯已开启' : '主灯已关闭'} tone="amber" progress={Math.min(100, (metrics.luminance ?? 0) / 8)} />
          <MetricCard icon={<Ruler />} label="感知距离" value={value(metrics.distance, '')} detail="单位以产品模型为准" tone="green" progress={Math.min(100, (metrics.distance ?? 0) / 2.4)} />
        </section>

        <section className="workspace-grid">
          <article className="panel spatial-panel">
            <div className="panel__heading overlay-heading">
              <div><span className="panel__kicker">DIGITAL TWIN</span><h3>空间实时映射</h3></div>
              <div className="scene-metrics"><span><i />空气评分 <b>{airScore || '--'}</b></span><span><BatteryCharging size={14} /> {value(metrics.battery, '%')}</span></div>
            </div>
            <Suspense fallback={<div className="visual-loading"><span />正在构建三维空间</div>}>
              <RoomScene metrics={metrics} />
            </Suspense>
          </article>

          <article className="panel control-panel">
            <div className="panel__heading">
              <div><span className="panel__kicker">REMOTE CONTROL</span><h3>空间控制</h3></div>
              <Gauge size={20} />
            </div>

            <div className={`lamp-control ${metrics.lamp === 'ON' ? 'on' : ''}`}>
              <div className="lamp-control__visual"><Lightbulb size={28} /></div>
              <div><span>主照明</span><strong>{metrics.lamp === 'ON' ? '运行中' : '已关闭'}</strong></div>
              <Button
                className="lamp-toggle"
                loading={commandMutation.isPending}
                onClick={() => commandMutation.mutate({ type: 'LIGHT', value: metrics.lamp === 'ON' ? 'OFF' : 'ON' })}
              >{metrics.lamp === 'ON' ? '关闭' : '开启'}</Button>
            </div>

            <div className="control-block">
              <label>控制模式 <span>当前 · {metrics.mode}</span></label>
              <Segmented
                block
                value={metrics.mode === 'UNKNOWN' ? undefined : metrics.mode}
                options={[
                  { label: '自动', value: 'AUTO' },
                  { label: '人工', value: 'HUMAN' },
                  { label: '语音', value: 'VOICE' }
                ]}
                onChange={(mode) => commandMutation.mutate({ type: 'MODE', value: String(mode) })}
              />
            </div>

            <div className="control-block desired-block">
              <label>温度预警阈值 <span>写入 desired</span></label>
              <div className="desired-row">
                <InputNumber min={16} max={40} step={0.5} value={threshold} onChange={setThreshold} suffix="°C" />
                <Button type="primary" loading={desiredMutation.isPending} onClick={() => desiredMutation.mutate()}>同步影子</Button>
              </div>
              <small>真实设备需要在产品模型中定义可写属性 threshold。</small>
            </div>

            <AssistantPanel
              deviceId={selectedDeviceId}
              metrics={metrics}
              onCommandConfirmed={refreshDeviceActivity}
            />

            <div className="control-panel__foot">
              <span><CircleDot size={13} />命令经服务端代理</span><span>最近响应 {timeText(shadow?.observedAt)}</span>
            </div>
          </article>
        </section>

        <section className="lower-grid">
          <article className="panel trend-panel">
            <div className="panel__heading">
              <div><span className="panel__kicker">SESSION TELEMETRY</span><h3>环境变化趋势</h3></div>
              <span className="panel__chip"><Activity size={13} /> 本次会话</span>
            </div>
            <Suspense fallback={<div className="chart-loading">正在载入趋势引擎</div>}>
              <TrendChart data={history} />
            </Suspense>
          </article>

          <article className="panel activity-panel">
            <div className="panel__heading">
              <div><span className="panel__kicker">ACTIVITY STREAM</span><h3>最近活动</h3></div>
              <span className="panel__chip">{logs.length} EVENTS</span>
            </div>
            <div className="activity-list">
              {logs.length === 0 ? (
                <div className="empty-activity"><Wifi size={18} /><span>等待设备活动</span></div>
              ) : logs.slice(0, 6).map((entry) => (
                <div className={`activity-item level-${entry.level}`} key={entry.id}>
                  <i />
                  <div><strong>{entry.message}</strong><span>{entry.category.toUpperCase()} · {timeText(entry.createdAt)}</span></div>
                </div>
              ))}
            </div>
            <details className="raw-shadow">
              <summary>查看原始设备影子</summary>
              <pre>{JSON.stringify(shadow?.raw ?? {}, null, 2)}</pre>
            </details>
          </article>
        </section>
      </main>
    </div>
  );
}

export function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#5dd7df',
          colorInfo: '#5dd7df',
          colorBgContainer: '#102231',
          colorText: '#eaf8ff',
          colorTextSecondary: '#7e9aaa',
          borderRadius: 10,
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif'
        },
        components: {
          Button: { primaryShadow: '0 8px 28px rgba(65, 207, 219, .2)' },
          Segmented: { itemSelectedBg: '#295568', trackBg: '#0b1925' }
        }
      }}
    >
      <AntdApp>
        <Dashboard />
      </AntdApp>
    </ConfigProvider>
  );
}
