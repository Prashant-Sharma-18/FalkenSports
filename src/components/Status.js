import React from "react";
import { AlertTriangle, CalendarDays, RefreshCw } from "./Icons";

export function Loading({ label }) {
  return (
    <div className="state-card loading-state" role="status">
      <div className="modern-spinner" aria-hidden="true">
        <div className="spinner-ring" />
        <div className="spinner-core" />
      </div>
      <p className="state-label">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry, title = "Unable to load data", retryLabel = "Try again" }) {
  return (
    <div className="state-card error-state" role="alert">
      <div className="error-icon-circle" aria-hidden="true">
        <AlertTriangle size={22} />
      </div>
      <h3 className="error-title">{title}</h3>
      <p className="error-message">{message}</p>
      {onRetry && (
        <button className="primary-btn retry-btn" onClick={onRetry}>
          <RefreshCw size={14} /> {retryLabel}
        </button>
      )}
    </div>
  );
}

// `icon` is an icon element; defaults to a calendar (most empty states are "nothing on this day").
export function Empty({ label, hint, icon }) {
  return (
    <div className="state-card empty-state">
      <div className="empty-icon-circle" aria-hidden="true">
        {icon || <CalendarDays size={22} />}
      </div>
      <p className="empty-label">{label}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  );
}
