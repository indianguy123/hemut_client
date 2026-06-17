'use client';

import styles from './chat.module.css';

export default function ChatDefaultPage() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className={styles.emptyTitle}>Welcome to Hemut Logistics</h2>
      <p className={styles.emptySubtitle}>
        Select a channel or start a direct message to begin collaborating with your team.
      </p>
    </div>
  );
}
