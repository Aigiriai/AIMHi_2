import React from 'react';
import { MatrixReportBuilder } from './MatrixReportBuilder';
import { AIReportBuilder } from './AIReportBuilder';

type SimpleReportBuilderProps = {
  // When set to 'ai-only', render just the AI reporting experience (hide builder/templates/results tabs)
  mode?: 'ai-only' | 'full';
};

export function SimpleReportBuilder({ mode = 'full' }: SimpleReportBuilderProps) {
  if (mode === 'ai-only') {
    return <AIReportBuilder />;
  }
  return <MatrixReportBuilder />;
}