import React from 'react';
import { twMerge } from 'tailwind-merge';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }[];
}

interface ChartProps {
  data: ChartData;
  height?: number;
  className?: string;
}

export const Chart: React.FC<ChartProps> = ({
  data,
  height = 300,
  className
}) => {
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#262626',
        titleColor: '#fff',
        bodyColor: '#a3a3a3',
        borderColor: '#404040',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          color: '#a3a3a3'
        }
      },
      y: {
        grid: {
          color: '#262626',
          drawBorder: false
        },
        ticks: {
          color: '#a3a3a3',
          padding: 10
        }
      }
    },
    elements: {
      line: {
        tension: 0.4
      },
      point: {
        radius: 0
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  const enhancedData = {
    ...data,
    datasets: data.datasets.map(dataset => ({
      ...dataset,
      borderColor: dataset.borderColor || '#22C55E',
      backgroundColor: dataset.backgroundColor || 'rgba(34, 197, 94, 0.1)',
      fill: true
    }))
  };

  return (
    <div 
      className={twMerge('w-full bg-[#171717] rounded-lg p-4', className)}
      style={{ height }}
    >
      <Line options={options} data={enhancedData} />
    </div>
  );
}; 