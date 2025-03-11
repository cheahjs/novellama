import { QualityCheckResponse } from '@/types';
import React, { useState, useRef } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';

interface QualityIndicatorProps {
  qualityCheck?: QualityCheckResponse;
  className?: string;
}

const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  qualityCheck,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  if (!qualityCheck) return null;

  const { score, feedback } = qualityCheck;

  let color = '';
  let icon = null;

  if (score >= 8) {
    color = 'text-green-500';
    icon = <FiCheckCircle className="mr-1 inline-block" />;
  } else if (score >= 6) {
    color = 'text-yellow-400';
    icon = <FiInfo className="mr-1 inline-block" />;
  } else {
    color = 'text-red-500';
    icon = <FiAlertTriangle className="mr-1 inline-block" />;
  }

  return (
    <div className={`${className} relative`}>
      <div
        className={`flex items-center text-sm font-medium ${color} cursor-help`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {icon}
        Quality Score: {score}/10
      </div>

      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute left-0 z-10 mt-2 w-64 max-w-xs rounded-md bg-gray-800 p-3 text-sm shadow-lg"
          style={{ top: '100%' }}
        >
          <div className="absolute -top-2 left-4 h-4 w-4 rotate-45 bg-gray-800"></div>
          <p className="relative z-10 text-gray-200">{feedback}</p>
        </div>
      )}
    </div>
  );
};

export default QualityIndicator;
