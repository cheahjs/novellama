import React from 'react';
import { Reference } from '@/types';

interface ReferenceItemProps {
  reference: Reference;
  onDelete?: (id: string) => void;
  onEdit?: (reference: Reference) => void;
}

const ReferenceItem: React.FC<ReferenceItemProps> = ({ 
  reference, 
  onDelete, 
  onEdit 
}) => {
  return (
    <div className="reference-item border rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">{reference.title}</h3>
        <div className="flex items-center">
          <span className="text-sm text-gray-500 mr-4">
            {reference.tokenCount?.toLocaleString() || 'Unknown'} tokens
          </span>
          
          {onEdit && (
            <button 
              onClick={() => onEdit(reference)} 
              className="text-blue-600 hover:text-blue-800 mr-2"
            >
              Edit
            </button>
          )}
          
          {onDelete && (
            <button 
              onClick={() => onDelete(reference.id)} 
              className="text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      
      <div className="reference-content text-sm whitespace-pre-wrap">
        {reference.content.length > 200 
          ? `${reference.content.substring(0, 200)}...` 
          : reference.content}
      </div>
    </div>
  );
};

export default ReferenceItem;
