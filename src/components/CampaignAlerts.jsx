import React from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CampaignAlerts = ({ trends }) => {
  // Need at least 2 data points to compare
  if (!trends || trends.length < 2) return null;

  const current = trends[trends.length - 1];
  const previous = trends[trends.length - 2];
  
  const alerts = [];

  // Helper to calculate percentage change
  const calcChange = (curr, prev) => {
    const c = parseFloat(curr);
    const p = parseFloat(prev);
    if (!p) return 0;
    return ((c - p) / p) * 100;
  };

  // 1. Check ROAS (Bad if drops)
  const roasChange = calcChange(current.roas, previous.roas);
  if (roasChange < -10) {
    alerts.push({
      level: 'critical',
      metric: 'ROAS',
      message: `ROAS caiu ${Math.abs(roasChange).toFixed(1)}% em comparação ao mês anterior.`,
      value: `${current.roas}x (vs ${previous.roas}x)`,
      icon: AlertTriangle
    });
  }

  // 2. Check Conversions (Bad if drops)
  const convChange = calcChange(current.conversions, previous.conversions);
  if (convChange < -15) {
    alerts.push({
      level: 'warning',
      metric: 'Conversões',
      message: `Volume de conversões caiu ${Math.abs(convChange).toFixed(1)}%.`,
      value: `${current.conversions} (vs ${previous.conversions})`,
      icon: ArrowDownRight
    });
  }

  // 3. Check CPA (Bad if rises)
  const cpaChange = calcChange(current.cpa, previous.cpa);
  if (cpaChange > 15) {
    alerts.push({
      level: 'critical',
      metric: 'CPA',
      message: `Custo por aquisição aumentou ${cpaChange.toFixed(1)}%.`,
      value: `R$${current.cpa} (vs R$${previous.cpa})`,
      icon: ArrowUpRight
    });
  }

  // 4. Check Spend (Alert if drops significantly - maybe issues with payment or disapproval)
  const spendChange = calcChange(current.spend, previous.spend);
  if (spendChange < -20) {
     alerts.push({
      level: 'warning',
      metric: 'Investimento',
      message: `Investimento caiu drasticamente (${Math.abs(spendChange).toFixed(1)}%). Verifique saldo ou reprovações.`,
      value: `R$${current.spend} (vs R$${previous.spend})`,
      icon: AlertTriangle
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="grid gap-3 mb-6 animate-in slide-in-from-top-4 duration-500">
      {alerts.map((alert, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          className={`flex items-center gap-4 p-4 rounded-lg border-l-4 shadow-md ${
            alert.level === 'critical' 
              ? 'bg-red-950/30 border-l-red-500 border-y border-r border-y-red-900/50 border-r-red-900/50' 
              : 'bg-orange-950/30 border-l-orange-500 border-y border-r border-y-orange-900/50 border-r-orange-900/50'
          }`}
        >
          <div className={`p-2 rounded-full ${
             alert.level === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
          }`}>
            <alert.icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className={`font-bold text-sm ${
                alert.level === 'critical' ? 'text-red-200' : 'text-orange-200'
              }`}>
                Alerta de {alert.metric}: {alert.level === 'critical' ? 'Crítico' : 'Atenção'}
              </h4>
              <span className="text-xs font-mono bg-black/40 px-2 py-1 rounded text-zinc-300">
                {alert.value}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-0.5">
              {alert.message}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default CampaignAlerts;