import React, { useState, useRef } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';

interface QualityIndicatorProps {
    qualityCheck: {
        isGoodQuality: boolean;
        score: number;
        feedback: string;
    };
    className?: string;
}

const QualityIndicator: React.FC<QualityIndicatorProps> = ({ qualityCheck, className = '' }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    if (!qualityCheck) return null;

    const { isGoodQuality, score, feedback } = qualityCheck;

    let color = '';
    let icon = null;

    if (score >= 8) {
        color = 'text-green-500';
        icon = <FiCheckCircle className="inline-block mr-1" />;
    } else if (score >= 6) {
        color = 'text-yellow-400';
        icon = <FiInfo className="inline-block mr-1" />;
    } else {
        color = 'text-red-500';
        icon = <FiAlertTriangle className="inline-block mr-1" />;
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
                    className="absolute z-10 p-3 bg-gray-800 rounded-md text-sm shadow-lg max-w-xs w-64 mt-2 left-0"
                    style={{ top: '100%' }}
                >
                    <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-800 rotate-45"></div>
                    <p className="text-gray-200 relative z-10">{feedback}</p>
                </div>
            )}
        </div>
    );
};

export default QualityIndicator;
