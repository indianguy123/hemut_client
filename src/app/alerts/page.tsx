'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { xhrGet, xhrPatch } from '@/lib/xhr';
import { API } from '@/lib/constants';
import { getAuthHeaders } from '@/lib/auth';
import { useWebSocket } from '@/context/WebSocketContext';
import styles from './alerts.module.css';

interface AiAlert {
  id: string;
  channel_id: string;
  channel_name: string;
  message_id: string;
  shipment_id: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  reason: string;
  ai_summary: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AlertsPage() {
  const router = useRouter();
  const { on, off } = useWebSocket();
  const [alerts, setAlerts] = useState<AiAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const { promise } = xhrGet<{ alerts: AiAlert[] }>(API.ALERTS, getAuthHeaders());
      const res = await promise;
      setAlerts(res.data.alerts);
    } catch (e) {
      console.error('Failed to load alerts', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const handleNewAlert = (data: Record<string, unknown>) => {
      const newAlert = data.alert as AiAlert;
      setAlerts(prev => {
        // Simple client-side insert and resort (HIGH first, then newest)
        const updated = [newAlert, ...prev];
        return updated.sort((a, b) => {
          const sevMap = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          if (sevMap[a.severity] !== sevMap[b.severity]) {
            return sevMap[b.severity] - sevMap[a.severity];
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });
    };

    on('AI_ALERT_CREATED', handleNewAlert);
    return () => off('AI_ALERT_CREATED', handleNewAlert);
  }, [on, off]);

  const handleResolve = async (e: React.MouseEvent, alertId: string) => {
    e.stopPropagation();
    try {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      await xhrPatch(API.RESOLVE_ALERT(alertId), {}, getAuthHeaders()).promise;
    } catch (err) {
      console.error('Failed to resolve alert', err);
      fetchAlerts(); // rollback on error
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString([], { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  if (loading) return <div className={styles.container}>Loading alerts...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span style={{ fontSize: '32px' }}>⚠️</span> Actionable AI Alerts
        </h1>
      </div>

      {alerts.length === 0 ? (
        <div className={styles.emptyState}>
          <span style={{ fontSize: '48px' }}>🎉</span>
          <h2>All clear! No pending logistics alerts.</h2>
        </div>
      ) : (
        <div className={styles.grid}>
          {alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`${styles.alertCard} ${styles[alert.severity.toLowerCase()]}`}
              onClick={() => router.push(`/chat/channel/${alert.channel_id}?msg=${alert.message_id}`)}
            >
              <div className={styles.cardHeader}>
                <div className={styles.alertTitle}>{alert.title}</div>
                <span className={`${styles.severityBadge} ${styles[alert.severity.toLowerCase()]}`}>
                  {alert.severity}
                </span>
              </div>
              
              <div className={styles.cardBody}>
                <div className={styles.reason}>{alert.reason}</div>
                
                <div className={styles.metaGrid}>
                  {alert.shipment_id && (
                    <div className={styles.metaItem}>
                      📦 <span className={styles.metaValue}>{alert.shipment_id}</span>
                    </div>
                  )}
                  <div className={styles.metaItem}>
                    💬 <span className={styles.metaValue}>#{alert.channel_name}</span>
                  </div>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.timestamp}>{formatTime(alert.created_at)}</span>
                <button 
                  className={styles.resolveButton}
                  onClick={(e) => handleResolve(e, alert.id)}
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
