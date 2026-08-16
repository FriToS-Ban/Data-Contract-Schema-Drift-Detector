import { AlertConfig, DriftReport } from './types.js';

/**
 * Fire all configured alerts for a drift report.
 * Non-blocking — errors are caught and logged, not thrown.
 */
export async function fireAlerts(
  alerts: AlertConfig[],
  report: DriftReport,
): Promise<void> {
  const promises = alerts
    .filter((a) => shouldFire(a, report))
    .map((a) => sendAlert(a, report).catch(console.error));

  await Promise.allSettled(promises);
}

function shouldFire(alert: AlertConfig, report: DriftReport): boolean {
  if (!report.hasDrift) return false;
  if (!alert.onSeverity || alert.onSeverity.length === 0) return true;

  const severities = new Set(alert.onSeverity);
  return report.changes.some((c) => severities.has(c.severity));
}

async function sendAlert(alert: AlertConfig, report: DriftReport): Promise<void> {
  switch (alert.type) {
    case 'slack':
      return sendSlack(alert.url!, report);
    case 'webhook':
      return sendWebhook(alert.url!, report);
    case 'pagerduty':
      return sendPagerDuty(alert.routingKey!, report);
    default:
      console.warn(`Unknown alert type: ${(alert as AlertConfig).type}`);
  }
}

// ─── Slack ────────────────────────────────────────────────────────────────────

async function sendSlack(webhookUrl: string, report: DriftReport): Promise<void> {
  const emoji =
    report.criticalCount > 0 ? '🔴' : report.warningCount > 0 ? '🟡' : '🟢';

  const body = {
    text: `${emoji} *Schema Drift Detected* — ${report.contractName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Schema Drift — ${report.contractName}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Environment:*\n${report.environment}` },
          { type: 'mrkdwn', text: `*Detected At:*\n${new Date(report.detectedAt).toLocaleString()}` },
          { type: 'mrkdwn', text: `*Critical:*\n${report.criticalCount}` },
          { type: 'mrkdwn', text: `*Warnings:*\n${report.warningCount}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Summary:*\n${report.summary}` },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '*Changes:*\n' +
            report.changes
              .slice(0, 10)
              .map((c) => `• \`${c.path}\` — ${c.message}`)
              .join('\n') +
            (report.changes.length > 10
              ? `\n_…and ${report.changes.length - 10} more_`
              : ''),
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Slack webhook failed: ${res.status}`);
}

// ─── Generic Webhook ──────────────────────────────────────────────────────────

async function sendWebhook(url: string, report: DriftReport): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'schema.drift.detected',
      report,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!res.ok) throw new Error(`Webhook failed: ${res.status} ${res.statusText}`);
}

// ─── PagerDuty ────────────────────────────────────────────────────────────────

async function sendPagerDuty(routingKey: string, report: DriftReport): Promise<void> {
  const severity =
    report.criticalCount > 0 ? 'critical' : report.warningCount > 0 ? 'warning' : 'info';

  const body = {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: `schema-drift-${report.contractId}`,
    payload: {
      summary: `Schema drift detected: ${report.contractName} — ${report.summary}`,
      source: report.contractName,
      severity,
      timestamp: report.detectedAt,
      custom_details: {
        environment: report.environment,
        changes: report.changes,
      },
    },
  };

  const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`PagerDuty alert failed: ${res.status}`);
}
