import ReactECharts from 'echarts-for-react';

export interface TrendPoint {
  time: string;
  temperature: number | null;
  humidity: number | null;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const option = {
    animationDuration: 500,
    backgroundColor: 'transparent',
    grid: { left: 10, right: 10, top: 34, bottom: 12, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(7, 17, 31, .94)',
      borderColor: '#24475e',
      textStyle: { color: '#eaf8ff' }
    },
    legend: {
      right: 4,
      top: 0,
      textStyle: { color: '#7895a7', fontSize: 11 },
      data: ['温度', '湿度']
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map((point) => point.time),
      axisLine: { lineStyle: { color: '#1d3445' } },
      axisTick: { show: false },
      axisLabel: { color: '#607c8e', fontSize: 10 }
    },
    yAxis: [
      {
        type: 'value',
        min: 15,
        max: 35,
        axisLabel: { color: '#607c8e', formatter: '{value}°' },
        splitLine: { lineStyle: { color: 'rgba(76, 116, 139, .14)' } }
      },
      {
        type: 'value',
        min: 20,
        max: 90,
        axisLabel: { color: '#607c8e', formatter: '{value}%' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: data.map((point) => point.temperature),
        lineStyle: { color: '#65dce8', width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(101,220,232,.28)' }, { offset: 1, color: 'rgba(101,220,232,0)' }]
          }
        }
      },
      {
        name: '湿度',
        type: 'line',
        smooth: true,
        symbol: 'none',
        yAxisIndex: 1,
        data: data.map((point) => point.humidity),
        lineStyle: { color: '#9d88ff', width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(157,136,255,.18)' }, { offset: 1, color: 'rgba(157,136,255,0)' }]
          }
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: 240, width: '100%' }} notMerge lazyUpdate />;
}
