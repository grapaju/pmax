import React from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';

const DateRangeSelector = ({ selectedPeriod, onPeriodChange }) => {
  const periods = [
    { label: 'Últimos 7 dias', value: '7d' },
    { label: 'Últimos 15 dias', value: '15d' },
    { label: 'Últimos 30 dias', value: '30d' },
    { label: 'Últimos 60 dias', value: '60d' },
    { label: 'Últimos 90 dias', value: '90d' },
    { label: 'Personalizado', value: 'custom' },
  ];

  const handleSelect = (value) => {
    if (value === 'custom') {
       toast({
        title: 'Seleção Personalizada',
        description: 'Seletor de data personalizado será aberto aqui. (Simulação)',
      });
    }
    onPeriodChange(value);
  };

  const currentLabel = periods.find(p => p.value === selectedPeriod)?.label || 'Selecionar Período';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white min-w-[180px] justify-between">
          <div className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4 text-emerald-500" />
            <span>{currentLabel}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-white min-w-[180px]">
        {periods.map((period) => (
          <DropdownMenuItem
            key={period.value}
            onClick={() => handleSelect(period.value)}
            className="focus:bg-zinc-800 focus:text-emerald-400 cursor-pointer"
          >
            {period.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DateRangeSelector;