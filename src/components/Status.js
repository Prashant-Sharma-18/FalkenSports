import React from "react";
import { RefreshCw } from "./Icons";

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

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-card error-state" role="alert">
      <div className="error-icon-circle" aria-hidden="true">⚠️</div>
      <h3 className="error-title">Unable to load data</h3>
      <p className="error-message">{message}</p>
      {onRetry && (
        <button className="primary-btn retry-btn" onClick={onRetry}>
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ label, hint }) {
  return (
    <div className="state-card empty-state">
      <div className="empty-icon-circle" aria-hidden="true">⚽</div>
      <p className="empty-label">{label}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  );
}
