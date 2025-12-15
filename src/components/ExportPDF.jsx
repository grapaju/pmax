import React from 'react';
import { FileDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const ExportPDF = ({ campaignName }) => {
  const handlePrint = () => {
    // Check if there is data to print
    const dashboardElement = document.getElementById('campaign-dashboard-content');
    if (!dashboardElement) {
      toast({ 
        title: "Erro ao exportar", 
        description: "Nenhum dado de campanha visível para gerar relatório.", 
        variant: "destructive" 
      });
      return;
    }

    // Trigger browser print
    window.print();
    
    toast({ 
      title: "Exportação iniciada", 
      description: "Prepare o layout de impressão para Salvar como PDF.", 
      className: "bg-blue-900 border-blue-800 text-white print:hidden" 
    });
  };

  return (
    <Button 
      variant="outline" 
      onClick={handlePrint}
      className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300 gap-2 print:hidden"
    >
      <Printer className="w-4 h-4" />
      Exportar Relatório PDF
    </Button>
  );
};

export default ExportPDF;