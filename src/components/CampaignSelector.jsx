import React from 'react';
import { ChevronsUpDown, Check, Calendar, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const CampaignSelector = ({ campaigns = [], selectedId, onSelect, readOnly = false }) => {
  const selectedCampaign = campaigns.find(c => c.id === selectedId) || campaigns[0];

  if (!selectedCampaign) return null;

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Campanha Ativa</span>
        <div className="flex items-center gap-2 text-white font-medium text-lg">
          <Activity className="w-5 h-5 text-emerald-500" />
          {selectedCampaign.name || selectedCampaign.campaign_name}
        </div>
        {(selectedCampaign.period_start || selectedCampaign.periodEnd) && (
            <div className="flex items-center gap-1 text-xs text-zinc-500">
                <Calendar className="w-3 h-3" />
                {new Date(selectedCampaign.period_start || selectedCampaign.periodStart || Date.now()).toLocaleDateString()} 
                {' - '}
                {new Date(selectedCampaign.period_end || selectedCampaign.periodEnd || Date.now()).toLocaleDateString()}
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider mb-1">Selecionar Campanha</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-[300px] justify-between bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
          >
            <span className="truncate">{selectedCampaign.name || selectedCampaign.campaign_name}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[300px] bg-zinc-900 border-zinc-800 text-zinc-200">
          {campaigns.map((campaign) => (
            <DropdownMenuItem
              key={campaign.id}
              onSelect={() => onSelect(campaign.id)}
              className="focus:bg-zinc-800 focus:text-white cursor-pointer py-2"
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  selectedId === campaign.id ? "opacity-100" : "opacity-0"
                )}
              />
              <div className="flex flex-col">
                 <span className="font-medium">{campaign.name || campaign.campaign_name}</span>
                 <span className="text-xs text-zinc-500 flex gap-2">
                    <span>{campaign.status === 'active' ? 'Ativa' : 'Pausada'}</span>
                    {campaign.period_start && <span>• {new Date(campaign.period_start).toLocaleDateString()}</span>}
                 </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default CampaignSelector;