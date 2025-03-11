import React from 'react';
import { Reference } from '@/types';
import { useTokenizer } from '@/hooks/useTokenizer';

interface ReferenceItemProps {
  reference: Reference;
  onDelete?: (id: string) => void;
  onEdit?: (reference: Reference) => void;
}

const ReferenceItem: React.FC<ReferenceItemProps> = ({
  reference,
  onDelete,
  onEdit,
}) => {
  const { count, isLoading } = useTokenizer(reference.content);

  // Update reference.tokenCount if it's different from the calculated count
  React.useEffect(() => {
    if (!isLoading && count !== null && count !== reference.tokenCount) {
      reference.tokenCount = count;
    }
  }, [count, isLoading, reference]);

  return (
    <div className="reference-item mb-4 rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{reference.title}</h3>
        <div className="flex items-center">
          <span className="mr-4 text-sm text-gray-500">
            {isLoading ? '...' : count?.toLocaleString() || 'Unknown'} tokens
          </span>

          {onEdit && (
            <button
              onClick={() => onEdit(reference)}
              className="mr-2 text-blue-600 hover:text-blue-800"
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
