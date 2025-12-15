
import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingDown, DollarSign } from 'lucide-react';

const PerformanceAlerts = ({ clients }) => {
  const alerts = [];

  clients.forEach(client => {
    client.campaigns.forEach(campaign => {
      // High CPA alert
      if (campaign.cpa > 70) {
        alerts.push({
          type: 'warning',
          icon: DollarSign,
          title: 'Alerta de CPA Alto',
          message: `${client.name} - ${campaign.name} está com CPA de R$${campaign.cpa.toFixed(2)}`,
          color: 'orange'
        });
      }

      // Low ROAS alert
      if (campaign.roas < 3) {
        alerts.push({
          type: 'danger',
          icon: TrendingDown,
          title: 'Alerta de ROAS Baixo',
          message: `${client.name} - ${campaign.name} está com ROAS de ${campaign.roas.toFixed(1)}x`,
          color: 'red'
        });
      }

      // Budget utilization alert
      const utilization = (campaign.spend / campaign.budget) * 100;
      if (utilization > 90) {
        alerts.push({
          type: 'info',
          icon: AlertTriangle,
          title: 'Alerta de Orçamento',
          message: `${client.name} - ${campaign.name} consumiu ${utilization.toFixed(0)}% do orçamento`,
          color: 'blue'
        });
      }
    });
  });

  if (alerts.length === 0) {
    return null; // Hide the component completely if there are no alerts
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 shadow-lg"
    >
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-orange-400" />
        Alertas de Desempenho
      </h2>

      <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
        {alerts.map((alert, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`p-4 rounded-lg border bg-gradient-to-r ${
                alert.color === 'red' 
                  ? 'from-red-900/10 to-red-900/5 border-red-900/20 text-red-200' 
                  : alert.color === 'orange'
                  ? 'from-orange-900/10 to-orange-900/5 border-orange-900/20 text-orange-200'
                  : 'from-blue-900/10 to-blue-900/5 border-blue-900/20 text-blue-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <alert.icon className={`w-5 h-5 flex-shrink-0 ${
                  alert.color === 'red' ? 'text-red-400' 
                  : alert.color === 'orange' ? 'text-orange-400'
                  : 'text-blue-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{alert.title}</p>
                  <p className="text-zinc-400 text-xs mt-1">{alert.message}</p>
                </div>
              </div>
            </motion.div>
          ))}
      </div>
    </motion.div>
  );
};

export default PerformanceAlerts;
