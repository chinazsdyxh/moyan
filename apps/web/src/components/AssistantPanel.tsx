import { useEffect, useMemo, useRef, useState } from 'react';
import { App as AntdApp, Button, Input } from 'antd';
import { useMutation } from '@tanstack/react-query';
import type { DeviceShadowSnapshot } from '@moyan/contracts';
import { BotMessageSquare, Check, Lightbulb, RotateCcw, Send, X, Zap } from 'lucide-react';
import { api, type AssistantPendingAction } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

interface AssistantPanelProps {
  deviceId: string;
  metrics: DeviceShadowSnapshot['reported'];
  onCommandConfirmed(): Promise<void>;
}

export function AssistantPanel({ deviceId, metrics, onCommandConfirmed }: AssistantPanelProps) {
  const { message } = AntdApp.useApp();
  const [input, setInput] = useState('');
  const [suggestedButtons, setSuggestedButtons] = useState<string[]>(['查看状态', '开灯', '关灯', '自动模式']);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: '您好，我可以帮您查看家里状态，也可以在您确认后控制灯光和模式。'
    }
  ]);
  const [pendingAction, setPendingAction] = useState<AssistantPendingAction | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const deviceState = useMemo(
    () => ({
      Temp: cleanNumber(metrics.temperature),
      Humi: cleanNumber(metrics.humidity),
      Lumi: cleanNumber(metrics.luminance),
      Dist: metrics.distance !== null && metrics.distance >= 0 ? metrics.distance : null,
      LampST: metrics.lamp,
      CtlMode: metrics.mode
    }),
    [metrics.distance, metrics.humidity, metrics.lamp, metrics.luminance, metrics.mode, metrics.temperature]
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingAction]);

  const chatMutation = useMutation({
    mutationFn: (text: string) =>
      api.assistantChat({
        userId: 'web_operator',
        deviceId,
        message: text,
        deviceState
      }),
    onSuccess: (result) => {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: result.replyText }
      ]);
      setPendingAction(result.pendingAction);
      setSuggestedButtons(normalizeSuggestedButtons(result.assistant.suggested_buttons));
    },
    onError: (error) => {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'system', text: error instanceof Error ? error.message : '助手请求失败' }
      ]);
    }
  });

  const confirmMutation = useMutation({
    mutationFn: (action: AssistantPendingAction) => api.assistantConfirm(action),
    onSuccess: async (result) => {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: result.replyText }
      ]);
      setPendingAction(null);
      setSuggestedButtons(['查看状态', '开灯', '关灯', '自动模式']);
      await onCommandConfirmed();
      message.success(result.replyText);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : '确认执行失败')
  });

  const send = (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || !deviceId || chatMutation.isPending || confirmMutation.isPending) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text }]);
    setPendingAction(null);
    setInput('');
    chatMutation.mutate(text);
  };

  const cancelPending = () => {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'system', text: '已取消本次控制操作。' }]);
    setPendingAction(null);
  };

  return (
    <div className="assistant-widget">
      <div className="assistant-widget__title">
        <span><BotMessageSquare size={15} /> 文字助手</span>
        <b>{confirmMutation.isPending ? '执行中' : chatMutation.isPending ? '思考中' : 'READY'}</b>
      </div>

      <div className="assistant-widget__messages" ref={listRef}>
        {messages.map((item) => (
          <div className={`assistant-message assistant-message--${item.role}`} key={item.id}>
            {item.text}
          </div>
        ))}

        {pendingAction ? (
          <div className="assistant-confirm">
            <strong>{pendingAction.confirmQuestion}</strong>
            <p>确认后才会下发设备命令，取消则不会执行。</p>
            <div>
              <Button
                size="small"
                type="primary"
                icon={<Check size={13} />}
                loading={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate(pendingAction)}
              >
                确认
              </Button>
              <Button size="small" icon={<X size={13} />} onClick={cancelPending}>
                取消
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="assistant-suggestions" aria-label="快捷提问">
        {suggestedButtons.map((label) => (
          <button type="button" key={label} disabled={!deviceId || chatMutation.isPending} onClick={() => send(label)}>
            {iconForSuggestion(label)}
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="assistant-widget__input">
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 3 }}
          value={input}
          disabled={!deviceId}
          placeholder={deviceId ? '输入：现在家里怎么样？' : '请先选择设备'}
          onChange={(event) => setInput(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <Button
          className="assistant-send"
          type="primary"
          icon={<Send size={14} />}
          loading={chatMutation.isPending}
          disabled={!input.trim() || !deviceId || confirmMutation.isPending}
          onClick={() => send()}
        />
      </div>
    </div>
  );
}

function cleanNumber(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeSuggestedButtons(value: unknown[] | undefined): string[] {
  const buttons = (value ?? [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 4);
  return buttons.length > 0 ? buttons : ['查看状态', '开灯', '关灯', '自动模式'];
}

function iconForSuggestion(label: string) {
  if (label.includes('开灯') || label.includes('关灯')) return <Lightbulb size={12} />;
  if (label.includes('模式')) return <RotateCcw size={12} />;
  return <Zap size={12} />;
}
