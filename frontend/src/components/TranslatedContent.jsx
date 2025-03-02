import React, { useState } from 'react';
import { Card, Button } from 'react-bootstrap';

const TranslatedContent = ({ source, translation, index }) => {
  const [showSource, setShowSource] = useState(false);

  return (
    <Card className="mb-3">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Translation {index + 1}</span>
        <Button 
          variant="outline-secondary" 
          size="sm"
          onClick={() => setShowSource(!showSource)}
        >
          {showSource ? 'Hide Source' : 'Show Source'}
        </Button>
      </Card.Header>
      <Card.Body>
        <div className="mb-3">
          <h5>Translation:</h5>
          <div className="p-3 bg-light rounded">{translation}</div>
        </div>
        
        {showSource && (
          <div>
            <h5>Source Text:</h5>
            <div className="p-3 bg-light rounded">{source}</div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default TranslatedContent;